"""
ChatGPT Archive Ingestion Service

Handles importing ChatGPT conversation archives:
1. Discover archives (chat2-chat8 folders)
2. Parse conversations.json files
3. UUID-based temporal merge (latest update wins)
4. Media file tracking and matching
5. Database persistence with full provenance
"""

import json
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Set
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from humanizer.models.chatgpt import (
    ChatGPTConversation,
    ChatGPTMessage,
    ChatGPTMedia,
    ChatGPTProvenance,
)
from humanizer.models.schemas import (
    ChatGPTIngestRequest,
    ChatGPTIngestResponse,
    ChatGPTConversationResponse,
    ChatGPTConversationListItem,
    ChatGPTConversationListResponse,
    ChatGPTMessageResponse,
    ChatGPTSearchRequest,
    ChatGPTSearchResponse,
    ChatGPTArchiveStatsResponse,
)


# ========================================
# Archive Discovery
# ========================================

def find_archives(home_dir: str, pattern: str = "chat[2-8]") -> List[Path]:
    """
    Find all ChatGPT archive folders matching pattern.

    Args:
        home_dir: Home directory to search
        pattern: Glob pattern (default: "chat[2-8]")

    Returns:
        List of archive paths
    """
    home_path = Path(home_dir).expanduser()
    archives = []

    # Use glob to find matching directories
    for archive_path in home_path.glob(pattern):
        if archive_path.is_dir():
            # Check if it has conversations.json
            conversations_file = archive_path / "conversations.json"
            if conversations_file.exists():
                archives.append(archive_path)

    return sorted(archives)


# ========================================
# JSON Parsing
# ========================================

def sanitize_json(obj):
    """
    Recursively sanitize JSON data by removing null bytes.

    PostgreSQL JSONB doesn't support \\u0000 (null bytes).

    Args:
        obj: JSON object (dict, list, str, etc.)

    Returns:
        Sanitized object
    """
    if isinstance(obj, dict):
        return {k: sanitize_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_json(v) for v in obj]
    elif isinstance(obj, str):
        # Remove null bytes
        return obj.replace('\x00', '')
    else:
        return obj


def parse_conversations_json(json_path: Path) -> List[Dict]:
    """
    Parse ChatGPT's conversations.json file.

    Args:
        json_path: Path to conversations.json

    Returns:
        List of conversation dicts
    """
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Handle both list and dict formats
    if isinstance(data, list):
        conversations = data
    elif isinstance(data, dict) and 'conversations' in data:
        conversations = data['conversations']
    else:
        conversations = []

    # Sanitize all conversations
    return [sanitize_json(conv) for conv in conversations]


def extract_content_text(message: Dict) -> Optional[str]:
    """
    Extract text content from message.

    Handles various content structures:
    - content.parts (list of strings)
    - content (direct string)
    - text (direct string)

    Args:
        message: Message dict

    Returns:
        Extracted text or None
    """
    content = message.get('content')

    if content is None:
        return None

    # Handle dict with parts
    if isinstance(content, dict):
        parts = content.get('parts', [])
        if parts and isinstance(parts, list):
            # Join all text parts
            text_parts = [p for p in parts if isinstance(p, str)]
            return ' '.join(text_parts) if text_parts else None
        return None

    # Handle direct string
    if isinstance(content, str):
        return content

    return None


def unix_to_datetime(timestamp: Optional[float]) -> Optional[datetime]:
    """
    Convert Unix timestamp to datetime.

    Args:
        timestamp: Unix timestamp (seconds since epoch)

    Returns:
        datetime or None
    """
    if timestamp is None:
        return None
    try:
        return datetime.fromtimestamp(timestamp)
    except (ValueError, OSError):
        return None


# ========================================
# Media Extraction
# ========================================

def extract_media_references(messages: List[Dict]) -> List[Dict]:
    """
    Extract media file references from messages.

    Finds:
    - Markdown images: ![alt](file-xxx.png)
    - Protocol references: sediment://file_HASH, file-service://file-HASH
    - JSON attachments in metadata
    - Content parts with file references

    Args:
        messages: List of message dicts

    Returns:
        List of media reference dicts
    """
    refs = []
    seen_file_ids = set()

    for message in messages:
        message_id = message.get('id')
        author_role = message.get('author', {}).get('role')

        # Extract from content text (markdown images)
        content_text = extract_content_text(message)
        if content_text:
            # Find markdown images: ![alt](file-xxx.png)
            image_refs = re.findall(r'!\[.*?\]\((file-[^)]+)\)', content_text)
            for file_id in image_refs:
                if file_id not in seen_file_ids:
                    refs.append({
                        'file_id': file_id,
                        'message_id': message_id,
                        'source': 'markdown',
                        'mime_type': None,
                    })
                    seen_file_ids.add(file_id)

            # Extract protocol-prefixed references (tool messages with generated images)
            # sediment://file_HASH or file-service://file-HASH
            protocol_refs = re.findall(r'(?:sediment|file-service)://(file[_-][^\s\)"\'\]]+)', content_text)
            for file_id in protocol_refs:
                # Normalize: convert file_ to file- for consistency
                normalized_id = file_id.replace('file_', 'file-')
                if normalized_id not in seen_file_ids:
                    refs.append({
                        'file_id': normalized_id,
                        'message_id': message_id,
                        'source': 'protocol',
                        'mime_type': 'image/png' if 'sediment' in content_text else None,
                    })
                    seen_file_ids.add(normalized_id)

        # Extract from metadata attachments
        metadata = message.get('metadata', {})
        if metadata and 'attachments' in metadata:
            for att in metadata['attachments']:
                file_id = att.get('id')
                if file_id and file_id not in seen_file_ids:
                    refs.append({
                        'file_id': file_id,
                        'message_id': message_id,
                        'source': 'metadata',
                        'mime_type': att.get('mimeType'),
                        'name': att.get('name'),
                        'metadata': att,
                    })
                    seen_file_ids.add(file_id)

    return refs


def find_media_file(archives: List[Path], file_id: str) -> Optional[Tuple[Path, str]]:
    """
    Find media file across all archives.

    Handles multiple ChatGPT archive formats and folder structures:
    1. Top-level user uploads: file-{ID}-{original}.ext
    2. files/ subdirectory (optional)
    3. dalle-generations/: file-{ID}-{UUID}.webp
    4. user-{alphanumeric}/: file_{HASH}-{UUID}.png (sediment)
    5. {UUID}/audio/: file_{HASH}-{UUID}.wav

    Args:
        archives: List of archive paths
        file_id: File ID to find (e.g., "file-abc123" or "file-abc123.png")

    Returns:
        (file_path, archive_name) or None
    """
    # Normalize file_id:
    # 1. Strip extension if present: file-abc123.png -> file-abc123
    # 2. Convert underscore to dash: file_abc123 -> file-abc123
    base_file_id = file_id
    if '.' in base_file_id:
        base_file_id = base_file_id.rsplit('.', 1)[0]

    # Normalize underscore to dash (sediment format)
    normalized_id = base_file_id.replace('file_', 'file-')

    # Also keep original for matching sediment files
    sediment_id = base_file_id.replace('file-', 'file_')

    for archive_path in archives:
        # Search locations in order of likelihood
        search_locations = [
            archive_path / "files",              # Optional files/ subdirectory
            archive_path,                        # Top-level (user uploads)
            archive_path / "dalle-generations",  # Old DALL-E images
        ]

        # Add user-* folders (sediment format, Jan 2025+)
        try:
            for user_dir in archive_path.glob("user-*"):
                if user_dir.is_dir():
                    search_locations.append(user_dir)
        except (OSError, PermissionError):
            pass

        # Add UUID/audio folders (Mar 2025+)
        try:
            for uuid_dir in archive_path.iterdir():
                if uuid_dir.is_dir() and len(uuid_dir.name) == 36:  # UUID length
                    audio_dir = uuid_dir / "audio"
                    if audio_dir.exists():
                        search_locations.append(audio_dir)
        except (OSError, PermissionError):
            pass

        # Search each location
        for search_dir in search_locations:
            if not search_dir.exists() or not search_dir.is_dir():
                continue

            try:
                for file_path in search_dir.iterdir():
                    if not file_path.is_file():
                        continue

                    filename = file_path.name

                    # Match if filename STARTS with any of our normalized IDs
                    if (filename.startswith(normalized_id) or
                        filename.startswith(sediment_id) or
                        filename.startswith(base_file_id)):
                        return (file_path, archive_path.name)
            except (OSError, PermissionError):
                # Skip directories we can't read
                continue

    return None


# ========================================
# Temporal Merge Logic
# ========================================

def merge_conversation_versions(versions: List[Dict]) -> Dict:
    """
    Merge multiple versions of the same conversation.

    Strategy:
    - Latest update_time wins for conversation metadata
    - Collect all unique messages across versions
    - Keep latest version of each message

    Args:
        versions: List of conversation dicts

    Returns:
        Merged conversation dict
    """
    # Sort by update_time (latest first)
    # Handle None values by using 0 as default
    versions = sorted(
        versions,
        key=lambda v: v.get('update_time') or 0,
        reverse=True
    )

    # Latest version is primary
    primary = versions[0].copy()

    # Collect all unique messages
    messages_by_id = {}
    for version in versions:
        for msg in version.get('mapping', {}).values():
            # Skip empty messages
            if not msg or 'message' not in msg:
                continue

            message = msg['message']
            if not message:
                continue

            msg_id = message.get('id')
            if not msg_id:
                continue

            # Keep latest version of message
            if msg_id not in messages_by_id:
                messages_by_id[msg_id] = message
            else:
                # Compare create_time (handle None values)
                existing_time = messages_by_id[msg_id].get('create_time') or 0
                new_time = message.get('create_time') or 0
                if new_time > existing_time:
                    messages_by_id[msg_id] = message

    # Replace messages in primary
    primary['merged_messages'] = list(messages_by_id.values())

    return primary


# ========================================
# Database Persistence
# ========================================

async def save_conversation(
    session: AsyncSession,
    conversation: Dict,
    archive_name: str,
    media_refs: List[Dict],
    force_reimport: bool = False
) -> Tuple[ChatGPTConversation, int, int]:
    """
    Save conversation to database.

    Args:
        session: Database session
        conversation: Conversation dict
        archive_name: Archive name (e.g., "chat5")
        media_refs: List of media references
        force_reimport: Force re-import if conversation exists

    Returns:
        (ChatGPTConversation, messages_imported, media_imported)
    """
    conv_uuid = UUID(conversation['id'])

    # Check if conversation exists
    stmt = select(ChatGPTConversation).where(ChatGPTConversation.uuid == conv_uuid)
    result = await session.execute(stmt)
    existing_conv = result.scalar_one_or_none()

    if existing_conv and not force_reimport:
        # Update provenance
        await update_provenance(
            session,
            conv_uuid,
            archive_name,
            len(conversation.get('merged_messages', []))
        )
        return existing_conv, 0, 0

    # Create or update conversation
    if existing_conv:
        conv_db = existing_conv
        # Update metadata
        conv_db.title = conversation.get('title')
        conv_db.updated_at = unix_to_datetime(conversation.get('update_time'))
        conv_db.custom_metadata = conversation
    else:
        conv_db = ChatGPTConversation(
            uuid=conv_uuid,
            title=conversation.get('title'),
            created_at=unix_to_datetime(conversation.get('create_time')),
            updated_at=unix_to_datetime(conversation.get('update_time')),
            source_archive=archive_name,
            custom_metadata=conversation,
        )
        session.add(conv_db)

    # Save messages
    messages_imported = 0
    for message in conversation.get('merged_messages', []):
        msg_uuid = UUID(message['id'])

        # Check if message exists
        stmt = select(ChatGPTMessage).where(ChatGPTMessage.uuid == msg_uuid)
        result = await session.execute(stmt)
        existing_msg = result.scalar_one_or_none()

        if not existing_msg:
            msg_db = ChatGPTMessage(
                uuid=msg_uuid,
                conversation_uuid=conv_uuid,
                created_at=unix_to_datetime(message.get('create_time')),
                author_role=message.get('author', {}).get('role', 'unknown'),
                content_text=extract_content_text(message),
                content_parts=message.get('content', {}).get('parts'),
                custom_metadata=message,
            )
            session.add(msg_db)
            messages_imported += 1

    # Save media
    media_imported = 0
    for media_ref in media_refs:
        file_id = media_ref['file_id']

        # Check if media exists
        stmt = select(ChatGPTMedia).where(ChatGPTMedia.file_id == file_id)
        result = await session.execute(stmt)
        existing_media = result.scalar_one_or_none()

        if not existing_media:
            # Create new media record
            media_db = ChatGPTMedia(
                file_id=file_id,
                conversation_uuid=conv_uuid,
                message_uuid=UUID(media_ref['message_id']) if media_ref.get('message_id') else None,
                file_path=media_ref.get('file_path'),
                source_archive=media_ref.get('source_archive'),
                mime_type=media_ref.get('mime_type'),
                file_metadata=media_ref.get('metadata'),
            )
            session.add(media_db)
            media_imported += 1
        else:
            # Update existing media record with file path if found
            if media_ref.get('file_path') and not existing_media.file_path:
                existing_media.file_path = media_ref['file_path']
                existing_media.source_archive = media_ref.get('source_archive')
                # Update mime_type if not set
                if media_ref.get('mime_type') and not existing_media.mime_type:
                    existing_media.mime_type = media_ref['mime_type']
                media_imported += 1

    # Update provenance
    await update_provenance(
        session,
        conv_uuid,
        archive_name,
        len(conversation.get('merged_messages', []))
    )

    await session.flush()

    return conv_db, messages_imported, media_imported


async def update_provenance(
    session: AsyncSession,
    conversation_uuid: UUID,
    archive_name: str,
    message_count: int
):
    """
    Update provenance record.

    Args:
        session: Database session
        conversation_uuid: Conversation UUID
        archive_name: Archive name
        message_count: Number of messages from this archive
    """
    stmt = select(ChatGPTProvenance).where(
        ChatGPTProvenance.conversation_uuid == conversation_uuid,
        ChatGPTProvenance.archive_name == archive_name
    )
    result = await session.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        existing.message_count = message_count
        existing.archive_date = datetime.now()
    else:
        prov_db = ChatGPTProvenance(
            conversation_uuid=conversation_uuid,
            archive_name=archive_name,
            archive_date=datetime.now(),
            message_count=message_count,
        )
        session.add(prov_db)


# ========================================
# Main Ingestion Function
# ========================================

async def ingest_archives(
    session: AsyncSession,
    request: ChatGPTIngestRequest
) -> ChatGPTIngestResponse:
    """
    Main ingestion function.

    1. Find archives
    2. Parse conversations.json from each
    3. Merge by UUID
    4. Match media files
    5. Save to database

    Args:
        session: Database session
        request: Ingestion request

    Returns:
        Ingestion response with statistics
    """
    start_time = time.time()
    errors = []

    # 1. Find archives
    archives = find_archives(request.home_dir, request.archive_pattern)

    if not archives:
        return ChatGPTIngestResponse(
            archives_found=0,
            conversations_processed=0,
            messages_imported=0,
            media_files_found=0,
            media_files_matched=0,
            errors=["No archives found"],
            processing_time_seconds=time.time() - start_time
        )

    # 2. Index all conversations by UUID
    conversation_index: Dict[str, List[Dict]] = {}

    for archive_path in archives:
        try:
            conversations_file = archive_path / "conversations.json"
            conversations = parse_conversations_json(conversations_file)

            for conv in conversations:
                conv_id = conv.get('id')
                if not conv_id:
                    continue

                if conv_id not in conversation_index:
                    conversation_index[conv_id] = []

                conversation_index[conv_id].append({
                    'archive': archive_path,
                    'archive_name': archive_path.name,
                    'data': conv,
                    'updated_at': conv.get('update_time', 0),
                })

        except Exception as e:
            errors.append(f"Error parsing {archive_path.name}: {str(e)}")

    # 3. Merge and save conversations
    total_messages = 0
    total_media_found = 0
    total_media_matched = 0

    for conv_id, versions in conversation_index.items():
        try:
            # Merge temporal versions
            merged_conv = merge_conversation_versions([v['data'] for v in versions])

            # Extract media references
            messages = merged_conv.get('merged_messages', [])
            media_refs = extract_media_references(messages)
            total_media_found += len(media_refs)

            # Match media files
            for media_ref in media_refs:
                file_id = media_ref['file_id']
                match = find_media_file(archives, file_id)
                if match:
                    file_path, archive_name = match
                    media_ref['file_path'] = str(file_path)
                    media_ref['source_archive'] = archive_name
                    total_media_matched += 1

            # Save to database
            archive_name = versions[0]['archive_name']  # Primary archive
            _, msg_count, media_count = await save_conversation(
                session,
                merged_conv,
                archive_name,
                media_refs,
                request.force_reimport
            )

            total_messages += msg_count

        except Exception as e:
            errors.append(f"Error processing conversation {conv_id[:8]}: {str(e)}")

    # Commit
    await session.commit()

    elapsed = time.time() - start_time

    return ChatGPTIngestResponse(
        archives_found=len(archives),
        conversations_processed=len(conversation_index),
        messages_imported=total_messages,
        media_files_found=total_media_found,
        media_files_matched=total_media_matched,
        errors=errors,
        processing_time_seconds=elapsed
    )


# ========================================
# Query Functions
# ========================================

async def get_conversation(
    session: AsyncSession,
    conversation_uuid: UUID
) -> Optional[ChatGPTConversationResponse]:
    """Get conversation by UUID."""
    stmt = select(ChatGPTConversation).where(
        ChatGPTConversation.uuid == conversation_uuid
    )
    result = await session.execute(stmt)
    conv = result.scalar_one_or_none()

    if not conv:
        return None

    # Count messages and media
    msg_stmt = select(func.count(ChatGPTMessage.uuid)).where(
        ChatGPTMessage.conversation_uuid == conversation_uuid
    )
    msg_result = await session.execute(msg_stmt)
    message_count = msg_result.scalar() or 0

    media_stmt = select(func.count(ChatGPTMedia.file_id)).where(
        ChatGPTMedia.conversation_uuid == conversation_uuid
    )
    media_result = await session.execute(media_stmt)
    media_count = media_result.scalar() or 0

    return ChatGPTConversationResponse(
        uuid=conv.uuid,
        title=conv.title,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        source_archive=conv.source_archive,
        message_count=message_count,
        media_count=media_count,
        custom_metadata=conv.custom_metadata
    )


async def search_messages(
    session: AsyncSession,
    request: ChatGPTSearchRequest
) -> ChatGPTSearchResponse:
    """Search messages by text query."""
    stmt = select(ChatGPTMessage)

    # Filter by conversation if specified
    if request.conversation_uuid:
        stmt = stmt.where(ChatGPTMessage.conversation_uuid == request.conversation_uuid)

    # Filter by author role
    if request.author_role:
        stmt = stmt.where(ChatGPTMessage.author_role == request.author_role)

    # Filter by date range
    if request.date_from:
        stmt = stmt.where(ChatGPTMessage.created_at >= request.date_from)
    if request.date_to:
        stmt = stmt.where(ChatGPTMessage.created_at <= request.date_to)

    # Text search (simple LIKE for now - can upgrade to full-text search)
    stmt = stmt.where(ChatGPTMessage.content_text.ilike(f"%{request.query}%"))

    # Limit
    stmt = stmt.limit(request.limit)

    result = await session.execute(stmt)
    messages = result.scalars().all()

    return ChatGPTSearchResponse(
        results=[
            ChatGPTMessageResponse(
                uuid=msg.uuid,
                conversation_uuid=msg.conversation_uuid,
                created_at=msg.created_at,
                author_role=msg.author_role,
                content_text=msg.content_text,
                content_parts=msg.content_parts,
                custom_metadata=msg.custom_metadata
            )
            for msg in messages
        ],
        count=len(messages),
        query=request.query
    )


async def get_archive_stats(
    session: AsyncSession
) -> ChatGPTArchiveStatsResponse:
    """Get archive statistics."""
    # Count conversations
    conv_stmt = select(func.count(ChatGPTConversation.uuid))
    conv_result = await session.execute(conv_stmt)
    total_conversations = conv_result.scalar() or 0

    # Count messages
    msg_stmt = select(func.count(ChatGPTMessage.uuid))
    msg_result = await session.execute(msg_stmt)
    total_messages = msg_result.scalar() or 0

    # Count media
    media_stmt = select(func.count(ChatGPTMedia.file_id))
    media_result = await session.execute(media_stmt)
    total_media = media_result.scalar() or 0

    # Get unique archives
    archives_stmt = select(ChatGPTProvenance.archive_name).distinct()
    archives_result = await session.execute(archives_stmt)
    archives_ingested = [row[0] for row in archives_result.all()]

    # Get date range
    date_stmt = select(
        func.min(ChatGPTMessage.created_at),
        func.max(ChatGPTMessage.created_at)
    )
    date_result = await session.execute(date_stmt)
    date_row = date_result.first()
    date_range = None
    if date_row and date_row[0] and date_row[1]:
        date_range = {
            "earliest": date_row[0],
            "latest": date_row[1]
        }

    # Get top conversations (by message count)
    top_stmt = select(
        ChatGPTConversation.uuid,
        ChatGPTConversation.title,
        func.count(ChatGPTMessage.uuid).label('msg_count')
    ).join(
        ChatGPTMessage,
        ChatGPTMessage.conversation_uuid == ChatGPTConversation.uuid
    ).group_by(
        ChatGPTConversation.uuid,
        ChatGPTConversation.title
    ).order_by(
        func.count(ChatGPTMessage.uuid).desc()
    ).limit(10)

    top_result = await session.execute(top_stmt)
    top_conversations = [
        {"title": row[1] or "Untitled", "message_count": row[2]}
        for row in top_result.all()
    ]

    return ChatGPTArchiveStatsResponse(
        total_conversations=total_conversations,
        total_messages=total_messages,
        total_media=total_media,
        archives_ingested=sorted(archives_ingested),
        date_range=date_range,
        top_conversations=top_conversations
    )


async def list_conversations(
    session: AsyncSession,
    page: int = 1,
    page_size: int = 50,
    search: Optional[str] = None,
    sort_by: str = "created_at",
    order: str = "desc",
    has_images: Optional[bool] = None,
    has_latex: Optional[bool] = None,
    gizmo_id: Optional[str] = None,
) -> ChatGPTConversationListResponse:
    """
    List conversations with pagination, search, and filtering.

    OPTIMIZED VERSION: Paginate first, then get counts only for displayed rows.
    This is much faster than the previous version which grouped all conversations.

    Args:
        session: Database session
        page: Page number (1-indexed)
        page_size: Number of conversations per page
        search: Search query for title
        sort_by: Field to sort by ('created_at', 'title', 'message_count', 'updated_at')
        order: Sort order ('asc' or 'desc')
        has_images: Filter by presence of images
        has_latex: Filter by presence of LaTeX
        gizmo_id: Filter by gizmo ID

    Returns:
        ChatGPTConversationListResponse with conversations and pagination info
    """
    # Calculate offset
    offset = (page - 1) * page_size

    # STEP 1: Build base query for conversations only (no joins yet)
    stmt = select(ChatGPTConversation)

    # Apply filters
    if search:
        stmt = stmt.where(ChatGPTConversation.title.ilike(f"%{search}%"))

    if gizmo_id:
        stmt = stmt.where(
            ChatGPTConversation.custom_metadata['gizmo_id'].astext == gizmo_id
        )

    # STEP 2: Get total count (before pagination)
    count_stmt = select(func.count()).select_from(
        select(ChatGPTConversation.uuid).select_from(ChatGPTConversation)
    )
    if search:
        count_stmt = count_stmt.where(ChatGPTConversation.title.ilike(f"%{search}%"))
    if gizmo_id:
        count_stmt = count_stmt.where(
            ChatGPTConversation.custom_metadata['gizmo_id'].astext == gizmo_id
        )

    total = await session.scalar(count_stmt) or 0

    # STEP 3: Apply sorting (on conversation table directly)
    if sort_by == "title":
        order_col = ChatGPTConversation.title
    elif sort_by == "updated_at":
        order_col = ChatGPTConversation.updated_at
    elif sort_by == "message_count":
        # For message_count sorting, we need a subquery
        # But for now, fall back to created_at to keep it simple
        # TODO: Add message_count and media_count columns to ChatGPTConversation
        order_col = ChatGPTConversation.created_at
    else:  # default to created_at
        order_col = ChatGPTConversation.created_at

    if order == "asc":
        stmt = stmt.order_by(order_col.asc())
    else:
        stmt = stmt.order_by(order_col.desc())

    # STEP 4: Apply pagination
    stmt = stmt.offset(offset).limit(page_size)

    # STEP 5: Execute query to get conversations
    result = await session.execute(stmt)
    conversations_orm = result.scalars().all()

    # STEP 6: Get counts for just these conversations (much faster!)
    conversations = []
    for conv in conversations_orm:
        # Get message count
        msg_count_stmt = select(func.count()).where(
            ChatGPTMessage.conversation_uuid == conv.uuid
        )
        message_count = await session.scalar(msg_count_stmt) or 0

        # Get media count
        media_count_stmt = select(func.count(ChatGPTMedia.file_id.distinct())).where(
            ChatGPTMedia.conversation_uuid == conv.uuid
        )
        media_count = await session.scalar(media_count_stmt) or 0

        conversations.append(
            ChatGPTConversationListItem(
                uuid=conv.uuid,
                title=conv.title,
                created_at=conv.created_at,
                updated_at=conv.updated_at,
                source_archive=conv.source_archive,
                message_count=message_count,
                media_count=media_count
            )
        )

    # Calculate total pages
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return ChatGPTConversationListResponse(
        conversations=conversations,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )
