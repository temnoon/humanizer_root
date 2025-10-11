"""
ChatGPT Archive API routes

Endpoints:
- POST /chatgpt/ingest - Ingest ChatGPT archives
- GET /chatgpt/stats - Get archive statistics
- GET /chatgpt/conversation/{uuid} - Get conversation details
- POST /chatgpt/search - Search messages
"""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from humanizer.database import get_session
from humanizer.services.chatgpt import (
    ingest_archives,
    get_conversation,
    search_messages,
    get_archive_stats,
    list_conversations,
)
from humanizer.services.chatgpt_render import (
    render_conversation_markdown,
    export_conversation,
)
from humanizer.models.schemas import (
    ChatGPTIngestRequest,
    ChatGPTIngestResponse,
    ChatGPTConversationResponse,
    ChatGPTConversationListResponse,
    ChatGPTSearchRequest,
    ChatGPTSearchResponse,
    ChatGPTArchiveStatsResponse,
    ChatGPTRenderRequest,
    ChatGPTRenderResponse,
    ChatGPTExportRequest,
    ChatGPTExportResponse,
)

router = APIRouter(prefix="/chatgpt", tags=["chatgpt"])


@router.post("/ingest", response_model=ChatGPTIngestResponse)
async def ingest_chatgpt_archives(
    request: ChatGPTIngestRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Ingest ChatGPT conversation archives.

    Process:
    1. Find all chat2-chat8 folders in home directory
    2. Parse conversations.json from each archive
    3. Merge conversations by UUID (temporal merge)
    4. Extract and match media files
    5. Save to database with full provenance

    Args:
        request: Ingestion request (home_dir, archive_pattern, force_reimport)

    Returns:
        ChatGPTIngestResponse with statistics and errors
    """
    try:
        response = await ingest_archives(session, request)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ingest archives: {str(e)}"
        )


@router.get("/stats", response_model=ChatGPTArchiveStatsResponse)
async def get_chatgpt_stats(
    session: AsyncSession = Depends(get_session),
):
    """
    Get ChatGPT archive statistics.

    Returns:
        - Total conversations, messages, media
        - List of ingested archives
        - Date range (earliest/latest message)
        - Top conversations by message count
    """
    try:
        response = await get_archive_stats(session)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get stats: {str(e)}"
        )


@router.get("/conversations", response_model=ChatGPTConversationListResponse)
async def get_conversations_list(
    page: int = 1,
    page_size: int = 50,
    search: str = None,
    sort_by: str = "created_at",
    order: str = "desc",
    has_images: bool = None,
    has_latex: bool = None,
    gizmo_id: str = None,
    session: AsyncSession = Depends(get_session),
):
    """
    List all conversations with pagination, search, and filtering.

    Returns paginated list of conversations with:
    - Title (real conversation titles)
    - Created/updated timestamps
    - Source archive
    - Message and media counts

    Args:
        page: Page number (1-indexed, default: 1)
        page_size: Number of conversations per page (default: 50, max: 100)
        search: Search query for title (optional)
        sort_by: Sort field - 'created_at', 'title', 'message_count' (default: 'created_at')
        order: Sort order - 'asc' or 'desc' (default: 'desc')
        has_images: Filter conversations with/without images (optional)
        has_latex: Filter conversations with/without LaTeX (optional)
        gizmo_id: Filter by specific gizmo ID (optional)
        session: Database session

    Returns:
        ChatGPTConversationListResponse with conversations and pagination info
    """
    # Validate parameters
    if page < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Page must be >= 1"
        )
    if page_size < 1 or page_size > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Page size must be between 1 and 100"
        )
    if sort_by not in ["created_at", "title", "message_count", "updated_at"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="sort_by must be one of: created_at, title, message_count, updated_at"
        )
    if order not in ["asc", "desc"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="order must be 'asc' or 'desc'"
        )

    try:
        response = await list_conversations(
            session=session,
            page=page,
            page_size=page_size,
            search=search,
            sort_by=sort_by,
            order=order,
            has_images=has_images,
            has_latex=has_latex,
            gizmo_id=gizmo_id
        )
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list conversations: {str(e)}"
        )


@router.get("/conversation/{conversation_uuid}", response_model=ChatGPTConversationResponse)
async def get_chatgpt_conversation(
    conversation_uuid: UUID,
    session: AsyncSession = Depends(get_session),
):
    """
    Get conversation details by UUID.

    Args:
        conversation_uuid: Conversation UUID

    Returns:
        ChatGPTConversationResponse with conversation metadata
    """
    try:
        conversation = await get_conversation(session, conversation_uuid)

        if conversation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Conversation {conversation_uuid} not found"
            )

        return conversation
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get conversation: {str(e)}"
        )


@router.post("/search", response_model=ChatGPTSearchResponse)
async def search_chatgpt_messages(
    request: ChatGPTSearchRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Search ChatGPT messages.

    Supports:
    - Text search (LIKE query)
    - Filter by conversation UUID
    - Filter by author role (user, assistant, system)
    - Filter by date range

    Args:
        request: Search request

    Returns:
        ChatGPTSearchResponse with matching messages
    """
    try:
        response = await search_messages(session, request)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search messages: {str(e)}"
        )


@router.post("/conversation/{conversation_uuid}/render", response_model=ChatGPTRenderResponse)
async def render_conversation(
    conversation_uuid: UUID,
    request: ChatGPTRenderRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Render conversation as markdown.

    Features:
    - Filters zero-length messages
    - Subtle role indicators (emoji by default)
    - Optional pagination
    - Embedded media support
    - Timestamps (configurable)

    Customization:
    - Modify `RenderConfig` in `chatgpt_render.py` to change defaults
    - Role indicators: emoji vs text labels
    - Timestamp formatting
    - Message filtering rules
    - Media embedding options

    Args:
        conversation_uuid: Conversation UUID
        request: Render options (pagination, media inclusion)

    Returns:
        ChatGPTRenderResponse with markdown content and media references
    """
    try:
        response = await render_conversation_markdown(session, conversation_uuid, request)
        return response
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to render conversation: {str(e)}"
        )


@router.post("/conversation/{conversation_uuid}/export", response_model=ChatGPTExportResponse)
async def export_conversation_endpoint(
    conversation_uuid: UUID,
    request: ChatGPTExportRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Export conversation in various formats.

    Supported Formats:
    - **raw_markdown**: Plain markdown with embedded images
    - **rendered_html**: Styled HTML with MathJax support
    - **pdf**: PDF document (coming soon)

    Future Enhancements:
    - SVG conversation flow diagrams
    - Custom headers/footers with metadata
    - Animated PDF features (transitions, page effects)
    - PDF forms (fillable fields, annotations)
    - Custom themes and styling
    - LaTeX rendering in PDF
    - Code syntax highlighting
    - Interactive elements

    Customization:
    - Edit `RenderConfig` in `chatgpt_render.py`:
      - `HTML_THEME`: light, dark, custom
      - `PDF_PAGE_SIZE`: A4, Letter, Legal
      - `PDF_MARGINS`: custom margins
      - `INCLUDE_MATHJAX`: enable/disable LaTeX
      - `SYNTAX_HIGHLIGHTING`: code block styling
      - `CUSTOM_CSS`: path to custom CSS
      - Many more options!

    Args:
        conversation_uuid: Conversation UUID
        request: Export options (format, pagination, media)

    Returns:
        ChatGPTExportResponse with content in requested format
    """
    try:
        response = await export_conversation(session, conversation_uuid, request)
        return response
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except NotImplementedError as e:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export conversation: {str(e)}"
        )
