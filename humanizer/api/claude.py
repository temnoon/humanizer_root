"""
Claude Archive API routes

Endpoints:
- POST /claude/ingest - Ingest Claude/Anthropic archives
- GET /claude/stats - Get archive statistics
- GET /claude/conversations - List conversations
- GET /claude/conversation/{uuid} - Get conversation details
- POST /claude/search - Search messages
- GET /claude/projects - List projects
- GET /claude/project/{uuid} - Get project details
"""

from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from humanizer.database import get_session
from humanizer.services.claude import (
    ingest_archive,
    get_conversation,
    list_conversations,
    search_messages,
    get_archive_stats,
    generate_embeddings_for_messages,  # NEW
)
from humanizer.models.schemas import (
    ClaudeIngestRequest,
    ClaudeIngestResponse,
    ClaudeConversationResponse,
    ClaudeConversationListResponse,
    ClaudeSearchRequest,
    ClaudeSearchResponse,
    ClaudeProjectResponse,
    ClaudeArchiveStatsResponse,
    ClaudeEmbeddingGenerationRequest,  # NEW
    ClaudeEmbeddingGenerationResponse,  # NEW
)

router = APIRouter(prefix="/api/claude", tags=["claude"])


@router.post("/ingest", response_model=ClaudeIngestResponse)
async def ingest_claude_archive(
    request: ClaudeIngestRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Ingest Claude/Anthropic conversation archive.

    Process:
    1. Detect zip file or extracted directory
    2. Extract zip if needed (to temp directory)
    3. Parse conversations.json and projects.json
    4. Merge conversation versions (temporal merge)
    5. Extract and match media files (attachments + files)
    6. Save to database with full provenance
    7. Clean up temp files

    Args:
        request: Ingestion request (archive_path, force_reimport, import_projects)

    Returns:
        ClaudeIngestResponse with statistics and errors

    Example:
        ```python
        POST /api/claude/ingest
        {
            "archive_path": "~/Downloads/data-2025-10-25-16-14-18-batch-0000.zip",
            "force_reimport": false,
            "import_projects": true
        }
        ```
    """
    try:
        response = await ingest_archive(session, request)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ingest archive: {str(e)}"
        )


@router.get("/stats", response_model=ClaudeArchiveStatsResponse)
async def get_claude_stats(
    session: AsyncSession = Depends(get_session),
):
    """
    Get Claude archive statistics.

    Returns:
        Archive statistics including:
        - Total conversations, messages, media, projects
        - Per-archive breakdown
        - Date range
        - Top conversations by message count

    Example:
        ```python
        GET /api/claude/stats
        ```
    """
    try:
        stats = await get_archive_stats(session)
        return stats
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get stats: {str(e)}"
        )


@router.get("/conversations", response_model=ClaudeConversationListResponse)
async def list_claude_conversations(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search in name and summary"),
    project_uuid: Optional[UUID] = Query(None, description="Filter by project UUID"),
    session: AsyncSession = Depends(get_session),
):
    """
    List Claude conversations with pagination and filtering.

    Args:
        page: Page number (1-indexed)
        page_size: Items per page (1-100)
        search: Optional search query for name/summary
        project_uuid: Optional project filter

    Returns:
        Paginated conversation list

    Example:
        ```python
        GET /api/claude/conversations?page=1&page_size=20&search=quantum
        ```
    """
    try:
        response = await list_conversations(
            session,
            page=page,
            page_size=page_size,
            search=search,
            project_uuid=project_uuid,
        )
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list conversations: {str(e)}"
        )


@router.get("/conversation/{conversation_uuid}", response_model=ClaudeConversationResponse)
async def get_claude_conversation(
    conversation_uuid: UUID,
    include_messages: bool = Query(True, description="Include messages"),
    include_media: bool = Query(True, description="Include media files"),
    session: AsyncSession = Depends(get_session),
):
    """
    Get Claude conversation by UUID.

    Args:
        conversation_uuid: Conversation UUID
        include_messages: Include messages in response
        include_media: Include media in response

    Returns:
        Conversation with messages and media

    Raises:
        404: Conversation not found

    Example:
        ```python
        GET /api/claude/conversation/061f8300-6dc2-43f4-95e9-982fa6033400
        ```
    """
    try:
        conversation = await get_conversation(
            session,
            conversation_uuid,
            include_messages=include_messages,
            include_media=include_media,
        )

        if not conversation:
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


@router.post("/search", response_model=ClaudeSearchResponse)
async def search_claude_messages(
    request: ClaudeSearchRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Search Claude messages by text.

    Args:
        request: Search request with query and filters

    Returns:
        Search results with message + conversation metadata

    Example:
        ```python
        POST /api/claude/search
        {
            "query": "quantum mechanics",
            "sender": "assistant",
            "limit": 20
        }
        ```
    """
    try:
        results = await search_messages(session, request)
        return results
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}"
        )


@router.get("/projects", response_model=list)
async def list_claude_projects(
    session: AsyncSession = Depends(get_session),
):
    """
    List Claude projects.

    Returns:
        List of projects with metadata

    Note:
        Full implementation pending - requires project query function

    Example:
        ```python
        GET /api/claude/projects
        ```
    """
    # TODO: Implement list_projects service function
    return []


@router.get("/project/{project_uuid}", response_model=ClaudeProjectResponse)
async def get_claude_project(
    project_uuid: UUID,
    session: AsyncSession = Depends(get_session),
):
    """
    Get Claude project by UUID.

    Args:
        project_uuid: Project UUID

    Returns:
        Project with metadata and doc count

    Raises:
        404: Project not found
        501: Not implemented

    Note:
        Full implementation pending - requires get_project service function

    Example:
        ```python
        GET /api/claude/project/2fa15399-f1c9-4aee-8c8b-69af89d01558
        ```
    """
    # TODO: Implement get_project service function
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Project retrieval not yet implemented"
    )


@router.post("/generate-embeddings", response_model=ClaudeEmbeddingGenerationResponse)
async def generate_claude_embeddings(
    request: ClaudeEmbeddingGenerationRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Generate embeddings for Claude messages that don't have them.

    This endpoint processes Claude messages in batches, generating 1024-dimensional
    semantic embeddings using the mxbai-embed-large model via Ollama.

    Args:
        request: Generation request with batch_size parameter
        session: Database session

    Returns:
        ClaudeEmbeddingGenerationResponse with statistics

    Example:
        ```python
        POST /api/claude/generate-embeddings
        {
            "batch_size": 1000
        }
        ```

    Process:
    1. Query Claude messages where embedding IS NULL
    2. Generate embeddings in batches using Ollama
    3. Update message records with embeddings
    4. Return statistics (processed, failed, total_time)

    Note:
        Processing ~4,710 messages takes approximately 5 minutes
    """
    try:
        response = await generate_embeddings_for_messages(session, request.batch_size)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate embeddings: {str(e)}"
        )
