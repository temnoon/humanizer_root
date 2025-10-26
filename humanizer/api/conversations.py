"""
Unified Conversations API

Combines ChatGPT and Claude conversations into a single browsable interface.
Provides unified endpoints for listing, viewing, and searching conversations
from all sources.
"""

from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from humanizer.database import get_session
from humanizer.services import unified_conversations
from humanizer.services.unified_render import render_unified_conversation
from humanizer.models.schemas import (
    UnifiedConversationListResponse,
    UnifiedConversationResponse,
    UnifiedConversationDetailResponse,
    UnifiedSearchRequest,
    UnifiedSearchResponse,
    ChatGPTRenderRequest,
    ChatGPTRenderResponse,
)

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.get("/", response_model=UnifiedConversationListResponse)
async def get_unified_conversations(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(50, ge=1, le=100, description="Number of results per page"),
    search: Optional[str] = Query(None, description="Search in titles/names"),
    source: Optional[str] = Query(
        None,
        description="Filter by source: 'chatgpt' or 'claude' (None for all)",
        regex="^(chatgpt|claude)$"
    ),
    sort_by: str = Query(
        "updated_at",
        description="Field to sort by",
        regex="^(created_at|updated_at|title)$"
    ),
    sort_desc: bool = Query(True, description="Sort descending if True"),
    session: AsyncSession = Depends(get_session),
):
    """
    Get unified list of conversations from all sources.

    Merges ChatGPT and Claude conversations into a single paginated list.
    Supports filtering by source, searching by title, and sorting.

    Args:
        page: Page number (1-indexed)
        page_size: Number of results per page (1-100)
        search: Optional text search in conversation titles
        source: Optional filter by 'chatgpt' or 'claude' (None = all)
        sort_by: Field to sort by ('created_at', 'updated_at', 'title')
        sort_desc: Sort descending (True) or ascending (False)
        session: Database session

    Returns:
        UnifiedConversationListResponse with conversations and pagination info

    Example:
        GET /api/conversations?page=1&page_size=50&source=claude&sort_by=updated_at
    """

    conversations, total = await unified_conversations.get_unified_conversations(
        session=session,
        page=page,
        page_size=page_size,
        search=search,
        source=source,
        sort_by=sort_by,
        sort_desc=sort_desc,
    )

    return UnifiedConversationListResponse(
        conversations=[
            UnifiedConversationResponse(**conv)
            for conv in conversations
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/stats", response_model=dict)
async def get_unified_stats(
    session: AsyncSession = Depends(get_session),
):
    """
    Get statistics about all conversations.

    Returns counts and breakdowns by source.

    Example:
        GET /api/conversations/stats
    """

    from sqlalchemy import select, func
    from humanizer.models.chatgpt import ChatGPTConversation, ChatGPTMessage
    from humanizer.models.claude import ClaudeConversation, ClaudeMessage

    # Get ChatGPT stats
    chatgpt_conv_count = await session.execute(
        select(func.count()).select_from(ChatGPTConversation)
    )
    chatgpt_msg_count = await session.execute(
        select(func.count()).select_from(ChatGPTMessage)
    )

    # Get Claude stats
    claude_conv_count = await session.execute(
        select(func.count()).select_from(ClaudeConversation)
    )
    claude_msg_count = await session.execute(
        select(func.count()).select_from(ClaudeMessage)
    )

    chatgpt_convs = chatgpt_conv_count.scalar()
    chatgpt_msgs = chatgpt_msg_count.scalar()
    claude_convs = claude_conv_count.scalar()
    claude_msgs = claude_msg_count.scalar()

    return {
        "total_conversations": chatgpt_convs + claude_convs,
        "total_messages": chatgpt_msgs + claude_msgs,
        "by_source": {
            "chatgpt": {
                "conversations": chatgpt_convs,
                "messages": chatgpt_msgs,
            },
            "claude": {
                "conversations": claude_convs,
                "messages": claude_msgs,
            }
        }
    }


@router.get("/{conversation_id}", response_model=UnifiedConversationDetailResponse)
async def get_conversation_detail(
    conversation_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    """
    Get conversation details from any source.

    Automatically detects whether the conversation is from ChatGPT or Claude
    and returns the appropriate data structure with full message history.

    Args:
        conversation_id: Conversation UUID
        session: Database session

    Returns:
        UnifiedConversationDetailResponse with messages and media

    Raises:
        404: Conversation not found in any source

    Example:
        GET /api/conversations/550e8400-e29b-41d4-a716-446655440000
    """

    result = await unified_conversations.get_conversation_detail(
        session=session,
        conversation_id=conversation_id,
    )

    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Conversation {conversation_id} not found in any source"
        )

    return UnifiedConversationDetailResponse(**result)


@router.post("/search", response_model=UnifiedSearchResponse)
async def search_conversations(
    request: UnifiedSearchRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Search across all conversation messages.

    Performs full-text search in message content from both ChatGPT and Claude
    conversations. Returns matching messages with conversation context.

    Args:
        request: Search request with query, optional source filter, and limit
        session: Database session

    Returns:
        UnifiedSearchResponse with matching messages

    Example:
        POST /api/conversations/search
        {
            "query": "quantum consciousness",
            "source": null,
            "limit": 50
        }
    """

    results = await unified_conversations.search_unified_conversations(
        session=session,
        query=request.query,
        source=request.source,
        limit=request.limit,
    )

    return UnifiedSearchResponse(
        results=results,
        count=len(results),
        query=request.query,
    )


@router.post("/{conversation_id}/render", response_model=ChatGPTRenderResponse)
async def render_conversation(
    conversation_id: UUID,
    request: ChatGPTRenderRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Render conversation as markdown from any source.

    Automatically detects whether the conversation is from ChatGPT or Claude
    and renders it appropriately.

    Features:
    - Filters empty messages
    - Role indicators (emoji by default)
    - Optional pagination
    - Embedded media support
    - Timestamps (configurable)

    Args:
        conversation_id: Conversation UUID
        request: Render options (pagination, media inclusion)
        session: Database session

    Returns:
        ChatGPTRenderResponse with markdown content and media references

    Raises:
        404: Conversation not found in any source

    Example:
        POST /api/conversations/{uuid}/render
        {
            "include_media": true,
            "filter_empty_messages": true
        }
    """

    try:
        response = await render_unified_conversation(session, conversation_id, request)
        return response
    except ValueError as e:
        raise HTTPException(
            status_code=404,
            detail=str(e)
        )
