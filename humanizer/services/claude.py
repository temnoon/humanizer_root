"""
Claude Archive Ingestion Service

Handles importing Claude/Anthropic conversation archives:
1. Discover archives (zip files or extracted directories)
2. Extract zip files if needed
3. Parse conversations.json and projects.json files
4. UUID-based temporal merge (latest updated_at wins)
5. Media file tracking and matching (attachments + files)
6. Project definitions import
7. Database persistence with full provenance
"""

import json
import re
import time
import zipfile
import tempfile
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Set, Any
from uuid import UUID

from sqlalchemy import select, func, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession

from humanizer.models.claude import (
    ClaudeConversation,
    ClaudeMessage,
    ClaudeMedia,
    ClaudeProject,
    ClaudeProvenance,
)
from humanizer.models.schemas import (
    ClaudeIngestRequest,
    ClaudeIngestResponse,
    ClaudeConversationResponse,
    ClaudeConversationListResponse,
    ClaudeMessageResponse,
    ClaudeMediaResponse,
    ClaudeSearchRequest,
    ClaudeSearchResponse,
    ClaudeProjectResponse,
    ClaudeArchiveStatsResponse,
    ClaudeEmbeddingGenerationResponse,  # NEW
)
from humanizer.services.embedding import EmbeddingService  # NEW


# ========================================
# Archive Discovery
# ========================================

def find_archive(archive_path: str) -> Tuple[Optional[Path], bool]:
    """
    Find Claude archive (zip file or directory with conversations.json).

    Args:
        archive_path: Path to zip file or directory

    Returns:
        Tuple of (path, is_zip)
    """
    path = Path(archive_path).expanduser().resolve()

    if path.is_file() and path.suffix == '.zip':
        return (path, True)
    elif path.is_dir():
        # Check if it has conversations.json
        conversations_file = path / "conversations.json"
        if conversations_file.exists():
            return (path, False)

    return (None, False)


def extract_archive(zip_path: Path, target_dir: Optional[Path] = None) -> Path:
    """
    Extract Claude archive zip file.

    Args:
        zip_path: Path to zip file
        target_dir: Target directory (default: temp directory)

    Returns:
        Path to extracted directory
    """
    if target_dir is None:
        target_dir = Path(tempfile.mkdtemp(prefix="claude_archive_"))

    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(target_dir)

    return target_dir


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
    Parse Claude's conversations.json file.

    Args:
        json_path: Path to conversations.json

    Returns:
        List of conversation dictionaries
    """
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Claude format is array of conversations
    if not isinstance(data, list):
        raise ValueError(f"Expected list in conversations.json, got {type(data)}")

    # Sanitize null bytes for PostgreSQL JSONB
    data = sanitize_json(data)

    return data


def parse_projects_json(json_path: Path) -> List[Dict]:
    """
    Parse Claude's projects.json file.

    Args:
        json_path: Path to projects.json

    Returns:
        List of project dictionaries
    """
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Claude format is array of projects
    if not isinstance(data, list):
        raise ValueError(f"Expected list in projects.json, got {type(data)}")

    # Sanitize null bytes for PostgreSQL JSONB
    data = sanitize_json(data)

    return data


def iso_to_datetime(iso_string: Optional[str]) -> Optional[datetime]:
    """
    Convert Claude's ISO 8601 timestamp to datetime.

    Args:
        iso_string: ISO 8601 timestamp (e.g., "2024-03-19T03:50:35.790022Z")

    Returns:
        datetime object or None (timezone-naive for PostgreSQL compatibility)
    """
    if not iso_string:
        return None

    try:
        # Parse ISO 8601 format with timezone
        dt = datetime.fromisoformat(iso_string.replace('Z', '+00:00'))
        # Remove timezone info for PostgreSQL TIMESTAMP WITHOUT TIME ZONE
        return dt.replace(tzinfo=None)
    except (ValueError, AttributeError):
        return None


# ========================================
# Content Extraction
# ========================================

def extract_text_content(message: Dict) -> Optional[str]:
    """
    Extract text content from Claude message.

    Claude messages have:
    - text: Direct text field
    - content: Array of content blocks with type/text

    Args:
        message: Claude message dictionary

    Returns:
        Extracted text or None
    """
    # Try direct text field first
    if message.get('text'):
        return message['text']

    # Try content blocks
    content = message.get('content', [])
    if isinstance(content, list):
        texts = []
        for block in content:
            if isinstance(block, dict) and block.get('type') == 'text':
                text = block.get('text', '')
                if text:
                    texts.append(text)

        if texts:
            return '\n\n'.join(texts)

    return None


# ========================================
# Media Extraction
# ========================================

def extract_media_references(message: Dict) -> List[Dict]:
    """
    Extract media file references from Claude message.

    Claude messages can have:
    1. attachments: Array of {file_name, file_size, file_type, extracted_content}
    2. files: Array of {file_name}

    Args:
        message: Claude message dictionary

    Returns:
        List of media reference dictionaries
    """
    media_refs = []

    # Extract attachments (usually text files with extracted_content)
    attachments = message.get('attachments', [])
    if isinstance(attachments, list):
        for attach in attachments:
            if isinstance(attach, dict):
                media_refs.append({
                    'source': 'attachment',
                    'file_name': attach.get('file_name'),
                    'file_size': attach.get('file_size'),
                    'file_type': attach.get('file_type'),
                    'extracted_content': attach.get('extracted_content'),
                })

    # Extract files (usually images)
    files = message.get('files', [])
    if isinstance(files, list):
        for file_ref in files:
            if isinstance(file_ref, dict):
                media_refs.append({
                    'source': 'file',
                    'file_name': file_ref.get('file_name'),
                    'file_size': None,
                    'file_type': None,
                    'extracted_content': None,
                })

    return media_refs


def find_media_file(archive_path: Path, conversation_uuid: str, file_name: str) -> Optional[Path]:
    """
    Find media file in Claude archive directory.

    Claude stores media in UUID-named directories matching conversation_uuid.

    Search locations:
    1. {archive_path}/{conversation_uuid}/{file_name}
    2. {archive_path}/{conversation_uuid}/**/{file_name} (subdirectories)

    Args:
        archive_path: Path to archive directory
        conversation_uuid: Conversation UUID
        file_name: File name to find

    Returns:
        Path to file or None
    """
    if not file_name:
        return None

    # Try direct path first
    media_dir = archive_path / str(conversation_uuid)
    if media_dir.exists() and media_dir.is_dir():
        # Try direct file
        file_path = media_dir / file_name
        if file_path.exists() and file_path.is_file():
            return file_path

        # Try subdirectories (recursively)
        for file_path in media_dir.rglob(file_name):
            if file_path.is_file():
                return file_path

    return None


# ========================================
# Temporal Merge
# ========================================

def merge_conversation_versions(conversations: List[Dict]) -> Dict[UUID, Dict]:
    """
    Merge multiple versions of same conversation from different archives.

    Latest updated_at wins for metadata.
    Collect all unique messages by UUID.

    Args:
        conversations: List of conversation dictionaries

    Returns:
        Dict mapping conversation UUID to merged conversation
    """
    merged = {}

    for conv in conversations:
        conv_uuid = UUID(conv['uuid'])

        if conv_uuid not in merged:
            merged[conv_uuid] = conv
        else:
            # Latest updated_at wins
            existing_updated = iso_to_datetime(merged[conv_uuid].get('updated_at'))
            new_updated = iso_to_datetime(conv.get('updated_at'))

            if new_updated and existing_updated and new_updated > existing_updated:
                # Keep newer metadata, but merge messages
                old_messages = merged[conv_uuid].get('chat_messages', [])
                new_messages = conv.get('chat_messages', [])

                # Update to newer version
                merged[conv_uuid] = conv

                # Merge unique messages by UUID
                message_map = {}
                for msg in old_messages + new_messages:
                    msg_uuid = msg.get('uuid')
                    if msg_uuid:
                        # Keep latest version of each message
                        if msg_uuid not in message_map:
                            message_map[msg_uuid] = msg
                        else:
                            existing_msg_updated = iso_to_datetime(message_map[msg_uuid].get('updated_at'))
                            new_msg_updated = iso_to_datetime(msg.get('updated_at'))
                            if new_msg_updated and existing_msg_updated and new_msg_updated > existing_msg_updated:
                                message_map[msg_uuid] = msg

                merged[conv_uuid]['chat_messages'] = list(message_map.values())

    return merged


# ========================================
# Database Persistence
# ========================================

async def save_project(
    session: AsyncSession,
    project: Dict,
    archive_name: str,
) -> ClaudeProject:
    """
    Save Claude project to database.

    Args:
        session: Database session
        project: Project dictionary
        archive_name: Archive identifier

    Returns:
        ClaudeProject instance
    """
    project_uuid = UUID(project['uuid'])

    # Check if project already exists
    stmt = select(ClaudeProject).where(ClaudeProject.uuid == project_uuid)
    result = await session.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        # Update if newer
        new_updated = iso_to_datetime(project.get('updated_at'))
        if new_updated and existing.updated_at and new_updated > existing.updated_at:
            existing.name = project.get('name', '')
            existing.description = project.get('description')
            existing.is_private = project.get('is_private', True)
            existing.is_starter_project = project.get('is_starter_project', False)
            existing.prompt_template = project.get('prompt_template')
            existing.updated_at = new_updated
            existing.docs = project.get('docs')
            existing.custom_metadata = project
        return existing

    # Create new project
    creator = project.get('creator', {})
    db_project = ClaudeProject(
        uuid=project_uuid,
        name=project.get('name', ''),
        description=project.get('description'),
        is_private=project.get('is_private', True),
        is_starter_project=project.get('is_starter_project', False),
        prompt_template=project.get('prompt_template'),
        created_at=iso_to_datetime(project.get('created_at')),
        updated_at=iso_to_datetime(project.get('updated_at')),
        creator_uuid=UUID(creator['uuid']) if creator.get('uuid') else None,
        docs=project.get('docs'),
        custom_metadata=project,
    )

    session.add(db_project)
    return db_project


async def save_conversation(
    session: AsyncSession,
    conversation: Dict,
    archive_name: str,
    archive_path: Path,
    force_reimport: bool = False,
) -> Tuple[ClaudeConversation, int, int, int]:
    """
    Save Claude conversation to database with deduplication.

    Args:
        session: Database session
        conversation: Conversation dictionary
        archive_name: Archive identifier (e.g., "data-2025-10-25")
        archive_path: Path to archive directory (for media matching)
        force_reimport: Force re-import existing conversations

    Returns:
        Tuple of (conversation, messages_imported, media_matched, is_new)
    """
    conv_uuid = UUID(conversation['uuid'])

    # Check if conversation already exists
    stmt = select(ClaudeConversation).where(ClaudeConversation.uuid == conv_uuid)
    result = await session.execute(stmt)
    existing = result.scalar_one_or_none()

    messages_imported = 0
    media_matched = 0
    is_new = 0

    if existing and not force_reimport:
        # Incremental import: Add only new messages
        # Load existing messages explicitly (avoid lazy loading in async)
        msg_stmt = select(ClaudeMessage).where(ClaudeMessage.conversation_uuid == conv_uuid)
        msg_result = await session.execute(msg_stmt)
        existing_messages = msg_result.scalars().all()
        existing_msg_uuids = {m.uuid for m in existing_messages}

        new_messages = [
            msg for msg in conversation.get('chat_messages', [])
            if UUID(msg['uuid']) not in existing_msg_uuids
        ]

        # Phase 1: Add all new messages first
        for msg_data in new_messages:
            db_message = ClaudeMessage(
                uuid=UUID(msg_data['uuid']),
                conversation_uuid=conv_uuid,
                sender=msg_data.get('sender', 'human'),
                text=extract_text_content(msg_data),
                content_blocks=msg_data.get('content'),
                created_at=iso_to_datetime(msg_data.get('created_at')),
                updated_at=iso_to_datetime(msg_data.get('updated_at')),
                custom_metadata=msg_data,
            )
            session.add(db_message)
            messages_imported += 1

        # Flush messages to database so they can be referenced by media
        if new_messages:
            await session.flush()

        # Phase 2: Add media for the now-persisted messages
        for msg_data in new_messages:
            msg_uuid = UUID(msg_data['uuid'])
            media_refs = extract_media_references(msg_data)

            for media_ref in media_refs:
                file_name = media_ref['file_name']
                if file_name:
                    file_path = find_media_file(archive_path, str(conv_uuid), file_name)

                    db_media = ClaudeMedia(
                        conversation_uuid=conv_uuid,
                        message_uuid=msg_uuid,
                        file_name=file_name,
                        file_path=str(file_path) if file_path else None,
                        file_type=media_ref.get('file_type'),
                        file_size=media_ref.get('file_size'),
                        extracted_content=media_ref.get('extracted_content'),
                        source_archive=archive_name,
                    )
                    session.add(db_media)

                    if file_path:
                        media_matched += 1

        # Update metadata if newer
        new_updated = iso_to_datetime(conversation.get('updated_at'))
        if new_updated and existing.updated_at and new_updated > existing.updated_at:
            existing.name = conversation.get('name')
            existing.summary = conversation.get('summary')
            existing.updated_at = new_updated
            existing.custom_metadata = conversation

        # Update provenance
        stmt = select(ClaudeProvenance).where(
            ClaudeProvenance.conversation_uuid == conv_uuid,
            ClaudeProvenance.archive_name == archive_name
        )
        result = await session.execute(stmt)
        prov = result.scalar_one_or_none()

        if prov:
            prov.message_count += messages_imported
        else:
            db_prov = ClaudeProvenance(
                conversation_uuid=conv_uuid,
                archive_name=archive_name,
                message_count=len(conversation.get('chat_messages', [])),
            )
            session.add(db_prov)

        return existing, messages_imported, media_matched, is_new

    # Create new conversation
    account = conversation.get('account', {})

    db_conversation = ClaudeConversation(
        uuid=conv_uuid,
        name=conversation.get('name'),
        summary=conversation.get('summary'),
        created_at=iso_to_datetime(conversation.get('created_at')),
        updated_at=iso_to_datetime(conversation.get('updated_at')),
        account_uuid=UUID(account['uuid']) if account.get('uuid') else None,
        project_uuid=None,  # Will be linked later if project exists
        source_archive=archive_name,
        custom_metadata=conversation,
    )

    session.add(db_conversation)
    is_new = 1

    # Phase 1: Add all messages first
    messages_data = conversation.get('chat_messages', [])
    for msg_data in messages_data:
        db_message = ClaudeMessage(
            uuid=UUID(msg_data['uuid']),
            conversation_uuid=conv_uuid,
            sender=msg_data.get('sender', 'human'),
            text=extract_text_content(msg_data),
            content_blocks=msg_data.get('content'),
            created_at=iso_to_datetime(msg_data.get('created_at')),
            updated_at=iso_to_datetime(msg_data.get('updated_at')),
            custom_metadata=msg_data,
        )
        session.add(db_message)
        messages_imported += 1

    # Flush messages to database so they can be referenced by media
    await session.flush()

    # Phase 2: Add media that references the now-persisted messages
    for msg_data in messages_data:
        msg_uuid = UUID(msg_data['uuid'])
        media_refs = extract_media_references(msg_data)

        for media_ref in media_refs:
            file_name = media_ref['file_name']
            if file_name:
                file_path = find_media_file(archive_path, str(conv_uuid), file_name)

                db_media = ClaudeMedia(
                    conversation_uuid=conv_uuid,
                    message_uuid=msg_uuid,
                    file_name=file_name,
                    file_path=str(file_path) if file_path else None,
                    file_type=media_ref.get('file_type'),
                    file_size=media_ref.get('file_size'),
                    extracted_content=media_ref.get('extracted_content'),
                    source_archive=archive_name,
                )
                session.add(db_media)

                if file_path:
                    media_matched += 1

    # Add provenance
    db_prov = ClaudeProvenance(
        conversation_uuid=conv_uuid,
        archive_name=archive_name,
        message_count=len(conversation.get('chat_messages', [])),
    )
    session.add(db_prov)

    return db_conversation, messages_imported, media_matched, is_new


# ========================================
# Main Ingestion
# ========================================

async def ingest_archive(
    session: AsyncSession,
    request: ClaudeIngestRequest,
) -> ClaudeIngestResponse:
    """
    Ingest Claude/Anthropic conversation archive.

    Args:
        session: Database session
        request: Ingestion request

    Returns:
        Ingestion response with statistics
    """
    start_time = time.time()
    errors = []

    # Find archive
    archive_path, is_zip = find_archive(request.archive_path)

    if not archive_path:
        return ClaudeIngestResponse(
            archives_found=0,
            conversations_processed=0,
            conversations_new=0,
            conversations_updated=0,
            messages_imported=0,
            projects_imported=0,
            media_files_found=0,
            media_files_matched=0,
            errors=[f"Archive not found or invalid: {request.archive_path}"],
            processing_time_seconds=time.time() - start_time
        )

    # Extract if zip
    extracted_dir = None
    if is_zip:
        try:
            extracted_dir = extract_archive(archive_path)
            working_dir = extracted_dir
        except Exception as e:
            return ClaudeIngestResponse(
                archives_found=1,
                conversations_processed=0,
                conversations_new=0,
                conversations_updated=0,
                messages_imported=0,
                projects_imported=0,
                media_files_found=0,
                media_files_matched=0,
                errors=[f"Failed to extract archive: {e}"],
                processing_time_seconds=time.time() - start_time
            )
    else:
        working_dir = archive_path

    try:
        # Parse conversations.json
        conversations_file = working_dir / "conversations.json"
        if not conversations_file.exists():
            errors.append(f"conversations.json not found in {working_dir}")
            return ClaudeIngestResponse(
                archives_found=1,
                conversations_processed=0,
                conversations_new=0,
                conversations_updated=0,
                messages_imported=0,
                projects_imported=0,
                media_files_found=0,
                media_files_matched=0,
                errors=errors,
                processing_time_seconds=time.time() - start_time
            )

        conversations = parse_conversations_json(conversations_file)

        # Parse projects.json if requested
        projects_imported = 0
        if request.import_projects:
            projects_file = working_dir / "projects.json"
            if projects_file.exists():
                try:
                    projects = parse_projects_json(projects_file)
                    for project in projects:
                        await save_project(session, project, archive_path.stem)
                        projects_imported += 1
                except Exception as e:
                    errors.append(f"Failed to import projects: {e}")

        # Extract archive name from path
        archive_name = archive_path.stem  # e.g., "data-2025-10-25-16-14-18-batch-0000"

        # Merge conversation versions (in case of duplicates within same archive)
        merged = merge_conversation_versions(conversations)

        # Save conversations
        conversations_new = 0
        conversations_updated = 0
        messages_imported = 0
        media_files_found = 0
        media_files_matched = 0

        for conv_uuid, conv in merged.items():
            try:
                _, msg_count, media_count, new_count = await save_conversation(
                    session,
                    conv,
                    archive_name,
                    working_dir,
                    request.force_reimport
                )

                messages_imported += msg_count
                media_files_matched += media_count

                if new_count:
                    conversations_new += new_count
                else:
                    conversations_updated += 1

                # Count media references
                for msg in conv.get('chat_messages', []):
                    media_refs = extract_media_references(msg)
                    media_files_found += len(media_refs)

            except Exception as e:
                errors.append(f"Failed to save conversation {conv_uuid}: {e}")

        # Commit transaction
        await session.commit()

        return ClaudeIngestResponse(
            archives_found=1,
            conversations_processed=len(merged),
            conversations_new=conversations_new,
            conversations_updated=conversations_updated,
            messages_imported=messages_imported,
            projects_imported=projects_imported,
            media_files_found=media_files_found,
            media_files_matched=media_files_matched,
            errors=errors,
            processing_time_seconds=time.time() - start_time
        )

    finally:
        # Clean up extracted files
        if extracted_dir:
            try:
                shutil.rmtree(extracted_dir)
            except Exception:
                pass  # Best effort cleanup


# ========================================
# Query Functions
# ========================================

async def get_conversation(
    session: AsyncSession,
    conversation_uuid: UUID,
    include_messages: bool = True,
    include_media: bool = True,
) -> Optional[ClaudeConversationResponse]:
    """
    Get Claude conversation by UUID.

    Args:
        session: Database session
        conversation_uuid: Conversation UUID
        include_messages: Include messages in response
        include_media: Include media in response

    Returns:
        Conversation response or None
    """
    stmt = select(ClaudeConversation).where(ClaudeConversation.uuid == conversation_uuid)
    result = await session.execute(stmt)
    conversation = result.scalar_one_or_none()

    if not conversation:
        return None

    # Get message count
    msg_stmt = select(func.count(ClaudeMessage.uuid)).where(
        ClaudeMessage.conversation_uuid == conversation_uuid
    )
    msg_result = await session.execute(msg_stmt)
    message_count = msg_result.scalar()

    # Get media count
    media_stmt = select(func.count(ClaudeMedia.id)).where(
        ClaudeMedia.conversation_uuid == conversation_uuid
    )
    media_result = await session.execute(media_stmt)
    media_count = media_result.scalar()

    response_data = {
        "uuid": conversation.uuid,
        "name": conversation.name,
        "summary": conversation.summary,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
        "account_uuid": conversation.account_uuid,
        "project_uuid": conversation.project_uuid,
        "source_archive": conversation.source_archive,
        "message_count": message_count,
        "media_count": media_count,
    }

    if include_messages:
        messages = conversation.messages
        response_data["messages"] = [
            ClaudeMessageResponse(
                uuid=msg.uuid,
                sender=msg.sender,
                text=msg.text,
                content_blocks=msg.content_blocks,
                created_at=msg.created_at,
                updated_at=msg.updated_at,
                has_attachments=False,  # TODO: Check if message has attachments
                has_files=False,  # TODO: Check if message has files
            )
            for msg in messages
        ]

    if include_media:
        media = conversation.media
        response_data["media"] = [
            ClaudeMediaResponse(
                id=m.id,
                file_name=m.file_name,
                file_path=m.file_path,
                file_type=m.file_type,
                file_size=m.file_size,
                has_extracted_content=bool(m.extracted_content),
                mime_type=m.mime_type,
            )
            for m in media
        ]

    return ClaudeConversationResponse(**response_data)


async def list_conversations(
    session: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    project_uuid: Optional[UUID] = None,
) -> ClaudeConversationListResponse:
    """
    List Claude conversations with pagination.

    Args:
        session: Database session
        page: Page number (1-indexed)
        page_size: Items per page
        search: Optional search query
        project_uuid: Optional project filter

    Returns:
        Paginated conversation list
    """
    # Build base query
    stmt = select(ClaudeConversation)

    # Apply filters
    if search:
        search_pattern = f"%{search}%"
        stmt = stmt.where(
            or_(
                ClaudeConversation.name.ilike(search_pattern),
                ClaudeConversation.summary.ilike(search_pattern)
            )
        )

    if project_uuid:
        stmt = stmt.where(ClaudeConversation.project_uuid == project_uuid)

    # Get total count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    count_result = await session.execute(count_stmt)
    total = count_result.scalar()

    # Apply ordering and pagination
    stmt = stmt.order_by(desc(ClaudeConversation.updated_at))
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    result = await session.execute(stmt)
    conversations = result.scalars().all()

    # Convert to response objects
    conversation_responses = []
    for conv in conversations:
        # Get counts
        msg_stmt = select(func.count(ClaudeMessage.uuid)).where(
            ClaudeMessage.conversation_uuid == conv.uuid
        )
        msg_result = await session.execute(msg_stmt)
        message_count = msg_result.scalar()

        media_stmt = select(func.count(ClaudeMedia.id)).where(
            ClaudeMedia.conversation_uuid == conv.uuid
        )
        media_result = await session.execute(media_stmt)
        media_count = media_result.scalar()

        conversation_responses.append(
            ClaudeConversationResponse(
                uuid=conv.uuid,
                name=conv.name,
                summary=conv.summary,
                created_at=conv.created_at,
                updated_at=conv.updated_at,
                account_uuid=conv.account_uuid,
                project_uuid=conv.project_uuid,
                source_archive=conv.source_archive,
                message_count=message_count,
                media_count=media_count,
            )
        )

    total_pages = (total + page_size - 1) // page_size

    return ClaudeConversationListResponse(
        conversations=conversation_responses,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


async def search_messages(
    session: AsyncSession,
    request: ClaudeSearchRequest,
) -> ClaudeSearchResponse:
    """
    Search Claude messages.

    Args:
        session: Database session
        request: Search request

    Returns:
        Search response with results
    """
    # Build query
    stmt = select(ClaudeMessage, ClaudeConversation).join(
        ClaudeConversation,
        ClaudeMessage.conversation_uuid == ClaudeConversation.uuid
    )

    # Text search
    search_pattern = f"%{request.query}%"
    stmt = stmt.where(ClaudeMessage.text.ilike(search_pattern))

    # Apply filters
    if request.sender:
        stmt = stmt.where(ClaudeMessage.sender == request.sender)

    if request.project_uuid:
        stmt = stmt.where(ClaudeConversation.project_uuid == request.project_uuid)

    if request.start_date:
        stmt = stmt.where(ClaudeMessage.created_at >= request.start_date)

    if request.end_date:
        stmt = stmt.where(ClaudeMessage.created_at <= request.end_date)

    # Get total count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    count_result = await session.execute(count_stmt)
    total = count_result.scalar()

    # Order by relevance (most recent first)
    stmt = stmt.order_by(desc(ClaudeMessage.created_at))
    stmt = stmt.limit(request.limit)

    result = await session.execute(stmt)
    rows = result.all()

    # Format results
    results = []
    for message, conversation in rows:
        results.append({
            "message_uuid": str(message.uuid),
            "conversation_uuid": str(conversation.uuid),
            "conversation_name": conversation.name,
            "sender": message.sender,
            "text": message.text[:500] if message.text else None,  # Truncate for preview
            "created_at": message.created_at.isoformat() if message.created_at else None,
        })

    return ClaudeSearchResponse(
        results=results,
        total=total,
        query=request.query,
    )


async def get_archive_stats(
    session: AsyncSession,
) -> ClaudeArchiveStatsResponse:
    """
    Get statistics about Claude archives.

    Args:
        session: Database session

    Returns:
        Archive statistics
    """
    # Total conversations
    conv_stmt = select(func.count(ClaudeConversation.uuid))
    conv_result = await session.execute(conv_stmt)
    total_conversations = conv_result.scalar()

    # Total messages
    msg_stmt = select(func.count(ClaudeMessage.uuid))
    msg_result = await session.execute(msg_stmt)
    total_messages = msg_result.scalar()

    # Total media
    media_stmt = select(func.count(ClaudeMedia.id))
    media_result = await session.execute(media_stmt)
    total_media = media_result.scalar()

    # Total projects
    proj_stmt = select(func.count(ClaudeProject.uuid))
    proj_result = await session.execute(proj_stmt)
    total_projects = proj_result.scalar()

    # Archives (from provenance)
    prov_stmt = select(
        ClaudeProvenance.archive_name,
        func.count(ClaudeProvenance.conversation_uuid).label('conversations'),
        func.sum(ClaudeProvenance.message_count).label('messages')
    ).group_by(ClaudeProvenance.archive_name)
    prov_result = await session.execute(prov_stmt)
    archives = [
        {
            "name": row.archive_name,
            "conversations": row.conversations,
            "messages": row.messages
        }
        for row in prov_result
    ]

    # Date range
    date_stmt = select(
        func.min(ClaudeConversation.created_at).label('earliest'),
        func.max(ClaudeConversation.updated_at).label('latest')
    )
    date_result = await session.execute(date_stmt)
    date_row = date_result.one()

    date_range = None
    if date_row.earliest and date_row.latest:
        date_range = {
            "earliest": date_row.earliest,
            "latest": date_row.latest
        }

    # Top conversations (most messages)
    top_stmt = select(
        ClaudeConversation.uuid,
        ClaudeConversation.name,
        func.count(ClaudeMessage.uuid).label('message_count')
    ).join(
        ClaudeMessage,
        ClaudeConversation.uuid == ClaudeMessage.conversation_uuid
    ).group_by(
        ClaudeConversation.uuid,
        ClaudeConversation.name
    ).order_by(
        desc('message_count')
    ).limit(10)

    top_result = await session.execute(top_stmt)
    top_conversations = [
        {
            "uuid": str(row.uuid),
            "name": row.name,
            "message_count": row.message_count
        }
        for row in top_result
    ]

    return ClaudeArchiveStatsResponse(
        total_conversations=total_conversations,
        total_messages=total_messages,
        total_media=total_media,
        total_projects=total_projects,
        archives=archives,
        date_range=date_range,
        top_conversations=top_conversations,
    )


# ========================================
# Embedding Generation
# ========================================

async def generate_embeddings_for_messages(
    session: AsyncSession,
    batch_size: int = 1000,
) -> ClaudeEmbeddingGenerationResponse:
    """
    Generate embeddings for Claude messages that don't have them.

    This function:
    1. Queries for messages where embedding IS NULL
    2. Generates embeddings in batches using Ollama (mxbai-embed-large, 1024-dim)
    3. Updates message records with generated embeddings
    4. Returns statistics

    Args:
        session: Database session
        batch_size: Number of messages to process per batch

    Returns:
        ClaudeEmbeddingGenerationResponse with processing stats

    Example:
        >>> response = await generate_embeddings_for_messages(session, batch_size=1000)
        >>> print(f"Processed {response.processed}/{response.total_messages} messages")
    """
    start_time = time.time()

    # Query messages without embeddings
    stmt = select(ClaudeMessage).where(
        ClaudeMessage.embedding.is_(None),
        ClaudeMessage.text.isnot(None),  # Only process messages with text
        ClaudeMessage.text != "",  # Skip empty strings
    ).order_by(ClaudeMessage.created_at)

    result = await session.execute(stmt)
    messages = result.scalars().all()

    total_messages = len(messages)
    if total_messages == 0:
        return ClaudeEmbeddingGenerationResponse(
            total_messages=0,
            processed=0,
            failed=0,
            processing_time_seconds=0.0,
        )

    print(f"📊 Found {total_messages} Claude messages without embeddings")

    # Initialize embedding service
    embedding_service = EmbeddingService()

    # Process in batches
    processed = 0
    failed = 0

    async with embedding_service:  # Use context manager for automatic cleanup
        for i in range(0, total_messages, batch_size):
            batch = messages[i:i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (total_messages + batch_size - 1) // batch_size

            print(f"⚙️  Processing batch {batch_num}/{total_batches} ({len(batch)} messages)...")

            for msg in batch:
                try:
                    # Generate embedding
                    embedding = await embedding_service.embed_text(msg.text)

                    # Update message
                    msg.embedding = embedding.tolist()  # Convert numpy array to list for pgvector
                    processed += 1

                except Exception as e:
                    print(f"❌ Failed to generate embedding for message {msg.uuid}: {str(e)}")
                    failed += 1

            # Commit batch
            try:
                await session.commit()
                print(f"✅ Batch {batch_num}/{total_batches} committed ({processed} total processed)")
            except Exception as e:
                print(f"❌ Failed to commit batch {batch_num}: {str(e)}")
                await session.rollback()
                failed += len(batch)
                processed -= len(batch)

    processing_time = time.time() - start_time

    print(f"\n🎉 Embedding generation complete!")
    print(f"   Processed: {processed}/{total_messages}")
    print(f"   Failed: {failed}")
    print(f"   Time: {processing_time:.2f}s ({processing_time/60:.1f} min)")

    return ClaudeEmbeddingGenerationResponse(
        total_messages=total_messages,
        processed=processed,
        failed=failed,
        processing_time_seconds=processing_time,
    )
