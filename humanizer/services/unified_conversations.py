"""
Unified Conversations Service

Combines ChatGPT and Claude conversations into a single browsable interface.
Handles querying, merging, and normalizing data from both sources.
"""

import asyncio
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from sqlalchemy.orm import selectinload

from humanizer.models.chatgpt import ChatGPTConversation, ChatGPTMessage
from humanizer.models.claude import ClaudeConversation, ClaudeMessage


async def get_unified_conversations(
    session: AsyncSession,
    page: int = 1,
    page_size: int = 50,
    search: Optional[str] = None,
    source: Optional[str] = None,  # 'chatgpt', 'claude', or None for all
    sort_by: str = "updated_at",
    sort_desc: bool = True,
) -> Tuple[List[Dict[str, Any]], int]:
    """
    Query and merge conversations from multiple sources.

    Args:
        session: Database session
        page: Page number (1-indexed)
        page_size: Number of results per page
        search: Optional text search query (searches titles/names)
        source: Optional source filter ('chatgpt' or 'claude')
        sort_by: Field to sort by ('created_at', 'updated_at', 'title')
        sort_desc: Sort descending if True

    Returns:
        Tuple of (conversations list, total count)
    """

    # Build and execute queries sequentially (SQLAlchemy async doesn't support parallel on same session)
    unified = []

    # Query ChatGPT conversations if needed
    if source is None or source == "chatgpt":
        chatgpt_results = await _query_chatgpt_conversations(session, search)
        for conv in chatgpt_results:
            unified.append(_normalize_chatgpt_conversation(conv))

    # Query Claude conversations if needed
    if source is None or source == "claude":
        claude_results = await _query_claude_conversations(session, search)
        for conv in claude_results:
            unified.append(_normalize_claude_conversation(conv))

    # Sort unified results
    unified.sort(
        key=lambda x: x.get(sort_by) or datetime.min,
        reverse=sort_desc
    )

    # Get total count
    total = len(unified)

    # Paginate
    start = (page - 1) * page_size
    end = start + page_size
    paginated = unified[start:end]

    return paginated, total


async def _query_chatgpt_conversations(
    session: AsyncSession,
    search: Optional[str] = None,
) -> List[ChatGPTConversation]:
    """Query ChatGPT conversations with optional search."""

    stmt = select(ChatGPTConversation)

    if search:
        stmt = stmt.where(
            or_(
                ChatGPTConversation.title.ilike(f"%{search}%"),
                ChatGPTConversation.custom_metadata.contains({"mapping": {}}),  # Basic JSONB search
            )
        )

    result = await session.execute(stmt)
    return list(result.scalars().all())


async def _query_claude_conversations(
    session: AsyncSession,
    search: Optional[str] = None,
) -> List[ClaudeConversation]:
    """Query Claude conversations with optional search."""

    stmt = select(ClaudeConversation)

    if search:
        stmt = stmt.where(
            or_(
                ClaudeConversation.name.ilike(f"%{search}%"),
                ClaudeConversation.summary.ilike(f"%{search}%"),
            )
        )

    result = await session.execute(stmt)
    return list(result.scalars().all())


def _normalize_chatgpt_conversation(conv: ChatGPTConversation) -> Dict[str, Any]:
    """Normalize ChatGPT conversation to unified format."""
    # Note: message_count and media_count will be 0 here for list queries
    # We don't load relationships to avoid performance issues
    return {
        "uuid": conv.uuid,
        "title": conv.title or "(Untitled)",
        "created_at": conv.created_at,
        "updated_at": conv.updated_at,
        "source": "chatgpt",
        "source_archive": conv.source_archive,
        "message_count": 0,  # Placeholder - could be queried separately if needed
        "media_count": 0,  # Placeholder - could be queried separately if needed
        "metadata": conv.custom_metadata,
    }


def _normalize_claude_conversation(conv: ClaudeConversation) -> Dict[str, Any]:
    """Normalize Claude conversation to unified format."""
    # Note: message_count and media_count will be 0 here for list queries
    # We don't load relationships to avoid performance issues
    return {
        "uuid": conv.uuid,
        "title": conv.name or "(Untitled)",
        "created_at": conv.created_at,
        "updated_at": conv.updated_at,
        "source": "claude",
        "source_archive": conv.source_archive,
        "message_count": 0,  # Placeholder - could be queried separately if needed
        "media_count": 0,  # Placeholder - could be queried separately if needed
        "metadata": conv.custom_metadata,
        "summary": conv.summary,  # Claude-specific
        "project_uuid": conv.project_uuid,  # Claude-specific
    }


async def get_conversation_detail(
    session: AsyncSession,
    conversation_id: UUID,
) -> Optional[Dict[str, Any]]:
    """
    Get conversation details from any source.

    Strategy:
    1. Try to find in chatgpt_conversations
    2. If not found, try claude_conversations
    3. Return with source tag

    Args:
        session: Database session
        conversation_id: Conversation UUID

    Returns:
        Normalized conversation dict or None if not found
    """

    # Try ChatGPT first
    chatgpt_stmt = select(ChatGPTConversation).where(
        ChatGPTConversation.uuid == conversation_id
    ).options(
        selectinload(ChatGPTConversation.messages),
        selectinload(ChatGPTConversation.media)
    )

    result = await session.execute(chatgpt_stmt)
    chatgpt_conv = result.scalar_one_or_none()

    if chatgpt_conv:
        return _normalize_chatgpt_conversation_detail(chatgpt_conv)

    # Try Claude
    claude_stmt = select(ClaudeConversation).where(
        ClaudeConversation.uuid == conversation_id
    ).options(
        selectinload(ClaudeConversation.messages),
        selectinload(ClaudeConversation.media)
    )

    result = await session.execute(claude_stmt)
    claude_conv = result.scalar_one_or_none()

    if claude_conv:
        return _normalize_claude_conversation_detail(claude_conv)

    return None


def _normalize_chatgpt_conversation_detail(conv: ChatGPTConversation) -> Dict[str, Any]:
    """Normalize ChatGPT conversation detail with messages."""
    return {
        "uuid": conv.uuid,
        "title": conv.title or "(Untitled)",
        "created_at": conv.created_at,
        "updated_at": conv.updated_at,
        "source": "chatgpt",
        "source_archive": conv.source_archive,
        "metadata": conv.custom_metadata,
        "messages": [
            {
                "uuid": msg.uuid,
                "created_at": msg.created_at,
                "role": msg.author_role,
                "text": msg.content_text,
                "content": msg.content_parts,
            }
            for msg in sorted(conv.messages, key=lambda m: m.created_at or datetime.min)
        ],
        "media": [
            {
                "file_id": media.file_id,
                "file_name": media.file_name,
                "mime_type": media.mime_type,
            }
            for media in conv.media
        ] if conv.media else [],
    }


def _normalize_claude_conversation_detail(conv: ClaudeConversation) -> Dict[str, Any]:
    """Normalize Claude conversation detail with messages."""
    return {
        "uuid": conv.uuid,
        "title": conv.name or "(Untitled)",
        "created_at": conv.created_at,
        "updated_at": conv.updated_at,
        "source": "claude",
        "source_archive": conv.source_archive,
        "metadata": conv.custom_metadata,
        "summary": conv.summary,
        "project_uuid": conv.project_uuid,
        "messages": [
            {
                "uuid": msg.uuid,
                "created_at": msg.created_at,
                "role": msg.sender,  # 'human' or 'assistant'
                "text": msg.text,
                "content_blocks": msg.content_blocks,
            }
            for msg in sorted(conv.messages, key=lambda m: m.created_at or datetime.min)
        ],
        "media": [
            {
                "id": media.id,
                "file_name": media.file_name,
                "extracted_content": media.extracted_content,
            }
            for media in conv.media
        ] if conv.media else [],
    }


async def search_unified_conversations(
    session: AsyncSession,
    query: str,
    source: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """
    Search across all conversation messages.

    Supports:
    - Full-text search in message content
    - Filters by source

    Args:
        session: Database session
        query: Search query string
        source: Optional source filter ('chatgpt' or 'claude')
        limit: Maximum number of results per source

    Returns:
        List of matching messages with conversation context
    """

    # Execute searches sequentially (SQLAlchemy async doesn't support parallel on same session)
    unified_results = []

    if source is None or source == "chatgpt":
        chatgpt_results = await _search_chatgpt_messages(session, query, limit)
        unified_results.extend(chatgpt_results)

    if source is None or source == "claude":
        claude_results = await _search_claude_messages(session, query, limit)
        unified_results.extend(claude_results)

    # Sort by relevance (for now, by created_at desc)
    unified_results.sort(
        key=lambda x: x.get("created_at") or datetime.min,
        reverse=True
    )

    return unified_results[:limit]


async def _search_chatgpt_messages(
    session: AsyncSession,
    query: str,
    limit: int,
) -> List[Dict[str, Any]]:
    """Search ChatGPT messages."""

    stmt = select(ChatGPTMessage).join(
        ChatGPTConversation
    ).where(
        ChatGPTMessage.content_text.ilike(f"%{query}%")
    ).options(
        selectinload(ChatGPTMessage.conversation)
    ).limit(limit)

    result = await session.execute(stmt)
    messages = result.scalars().all()

    return [
        {
            "message_uuid": msg.uuid,
            "conversation_uuid": msg.conversation_uuid,
            "conversation_title": msg.conversation.title if msg.conversation else None,
            "created_at": msg.created_at,
            "role": msg.author_role,
            "text": msg.content_text,
            "source": "chatgpt",
        }
        for msg in messages
    ]


async def _search_claude_messages(
    session: AsyncSession,
    query: str,
    limit: int,
) -> List[Dict[str, Any]]:
    """Search Claude messages."""

    stmt = select(ClaudeMessage).join(
        ClaudeConversation
    ).where(
        ClaudeMessage.text.ilike(f"%{query}%")
    ).options(
        selectinload(ClaudeMessage.conversation)
    ).limit(limit)

    result = await session.execute(stmt)
    messages = result.scalars().all()

    return [
        {
            "message_uuid": msg.uuid,
            "conversation_uuid": msg.conversation_uuid,
            "conversation_title": msg.conversation.name if msg.conversation else None,
            "created_at": msg.created_at,
            "role": msg.sender,
            "text": msg.text,
            "source": "claude",
        }
        for msg in messages
    ]
