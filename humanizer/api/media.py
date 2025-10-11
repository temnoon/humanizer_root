"""
Universal Media API routes

Simple, source-agnostic endpoints for all media in the system.
Supports ChatGPT archives, TRM readings, user uploads, etc.
"""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pathlib import Path
from typing import Optional

from humanizer.database import get_session
from humanizer.models.chatgpt import ChatGPTMedia
from humanizer.models.schemas import MediaListResponse, MediaItemResponse

router = APIRouter(prefix="/media", tags=["media"])


@router.get("", response_model=MediaListResponse)
async def list_media(
    page: int = 1,
    page_size: int = 50,
    source: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
):
    """
    List all media in the system.

    Simple pagination, optional filtering by source.
    Works with any media source - ChatGPT, TRM, uploads, etc.

    Args:
        page: Page number (1-indexed)
        page_size: Items per page (max 100)
        source: Optional filter by source (e.g., "chat7", "trm", "uploads")

    Returns:
        Paginated list of media items with metadata
    """
    # Limit page size
    page_size = min(page_size, 100)
    offset = (page - 1) * page_size

    # Build query - prioritize items with file_path
    query = select(ChatGPTMedia).where(ChatGPTMedia.file_path.isnot(None))

    if source:
        query = query.where(ChatGPTMedia.source_archive == source)

    # Get total count (only items with file_path)
    count_query = select(func.count()).select_from(ChatGPTMedia).where(ChatGPTMedia.file_path.isnot(None))
    if source:
        count_query = count_query.where(ChatGPTMedia.source_archive == source)

    total_result = await session.execute(count_query)
    total = total_result.scalar()

    # Get page of items (order by file_id since no timestamp)
    query = query.order_by(ChatGPTMedia.file_id)
    query = query.offset(offset).limit(page_size)

    result = await session.execute(query)
    items = result.scalars().all()

    # Calculate pagination
    total_pages = (total + page_size - 1) // page_size

    return MediaListResponse(
        items=[MediaItemResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{file_id}")
async def get_media_file(
    file_id: str,
    session: AsyncSession = Depends(get_session),
):
    """
    Serve media file by file_id.

    Universal endpoint - works for any media source.
    Returns the actual file for browser display.

    Args:
        file_id: File identifier (e.g., "file-abc123", "trm-xyz789")

    Returns:
        File content with appropriate content-type
    """
    # Look up file in database
    stmt = select(ChatGPTMedia).where(ChatGPTMedia.file_id == file_id)
    result = await session.execute(stmt)
    media = result.scalar_one_or_none()

    if not media:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Media file not found: {file_id}"
        )

    if not media.file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File path not available for: {file_id}"
        )

    # Check if file exists
    file_path = Path(media.file_path)
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File not found on disk: {media.file_path}"
        )

    # Serve file
    # Infer mime type from extension if not in DB
    mime_type = media.mime_type
    if not mime_type:
        import mimetypes
        mime_type, _ = mimetypes.guess_type(str(file_path))
        mime_type = mime_type or "application/octet-stream"

    return FileResponse(
        path=str(file_path),
        media_type=mime_type,
    )


@router.get("/info/{file_id}", response_model=MediaItemResponse)
async def get_media_info(
    file_id: str,
    session: AsyncSession = Depends(get_session),
):
    """
    Get metadata for a media file.

    Returns all available info without serving the file.

    Args:
        file_id: File identifier

    Returns:
        Media metadata
    """
    stmt = select(ChatGPTMedia).where(ChatGPTMedia.file_id == file_id)
    result = await session.execute(stmt)
    media = result.scalar_one_or_none()

    if not media:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Media not found: {file_id}"
        )

    return MediaItemResponse.model_validate(media)
