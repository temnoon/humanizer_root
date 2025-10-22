"""
Documents API routes

Endpoints for document ingestion, retrieval, and search.

Endpoints:
- POST /api/documents/ingest - Ingest documents from directory
- POST /api/documents/ingest/file - Ingest single file
- GET /api/documents - List documents (paginated)
- GET /api/documents/{id} - Get document details
- GET /api/documents/{id}/content - Get full text
- GET /api/documents/{id}/chunks - Get chunks
- GET /api/documents/{id}/media - Get extracted media
- POST /api/documents/search - Semantic search
- PATCH /api/documents/{id} - Update metadata
- DELETE /api/documents/{id} - Delete document
- GET /api/documents/batches - List batches
- GET /api/documents/batches/{id} - Get batch details
"""

from uuid import UUID
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from humanizer.database import get_session
from humanizer.models.document import (
    Document,
    DocumentChunk,
    DocumentMedia,
    IngestionBatch,
    StorageStrategy,
    EmbeddingStatus,
)
from humanizer.models.schemas import (
    DocumentIngestRequest,
    DocumentIngestResponse,
    DocumentResponse,
    DocumentChunkResponse,
    DocumentChunksListResponse,
    DocumentMediaResponse,
    DocumentListResponse,
    DocumentSearchRequest,
    DocumentSearchResponse,
    DocumentSearchResultItem,
    DocumentUpdateRequest,
    IngestionBatchResponse,
    BatchListResponse,
)
from humanizer.services.document_ingestion import DocumentIngestionService
from humanizer.services.embedding import EmbeddingService

router = APIRouter(prefix="/api/documents", tags=["documents"])


# ========================================
# Ingestion Endpoints
# ========================================

@router.post("/ingest", response_model=DocumentIngestResponse)
async def ingest_documents(
    request: DocumentIngestRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Ingest documents from a directory.

    Process:
    1. Discover files matching patterns
    2. Check for duplicates (SHA256 hash)
    3. Parse each file (delegates to appropriate parser)
    4. Store files (centralized or in-place)
    5. Chunk large documents
    6. Queue for embedding generation
    7. Track batch statistics

    Args:
        request: Ingestion request with directory and options

    Returns:
        Batch statistics (success/failed/skipped counts)

    Raises:
        HTTPException 400: Invalid request (bad directory, etc.)
        HTTPException 500: Ingestion failed
    """
    service = DocumentIngestionService()

    # Convert storage_strategy string to enum
    try:
        storage_strategy = StorageStrategy(request.storage_strategy)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid storage_strategy: {request.storage_strategy}. Must be 'centralized' or 'in_place'"
        )

    try:
        batch = await service.ingest_directory(
            session=session,
            source_directory=request.source_directory,
            file_types=request.file_types,
            storage_strategy=storage_strategy,
            centralized_base_path=request.centralized_base_path,
            recursive=request.recursive,
            force_reimport=request.force_reimport,
            generate_embeddings=request.generate_embeddings,
        )

        return DocumentIngestResponse(
            batch_id=str(batch.id),
            total_files=batch.total_files,
            successful=batch.successful,
            failed=batch.failed,
            skipped=batch.skipped,
            processing_time_ms=batch.processing_time_ms or 0,
            errors=batch.errors or [],
        )

    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ingest documents: {str(e)}"
        )


@router.post("/ingest/file", response_model=DocumentResponse)
async def ingest_single_file(
    file_path: str = Query(..., description="Path to file to ingest"),
    storage_strategy: str = Query(default="in_place", description="Storage strategy"),
    force_reimport: bool = Query(default=False, description="Force reimport if exists"),
    generate_embeddings: bool = Query(default=True, description="Generate embeddings"),
    session: AsyncSession = Depends(get_session),
):
    """
    Ingest a single file.

    Args:
        file_path: Path to file
        storage_strategy: 'centralized' or 'in_place'
        force_reimport: Re-import even if exists
        generate_embeddings: Queue for embedding generation

    Returns:
        Document details

    Raises:
        HTTPException 404: File not found
        HTTPException 400: Invalid storage strategy
        HTTPException 500: Ingestion failed
    """
    service = DocumentIngestionService()

    # Convert storage_strategy
    try:
        strategy = StorageStrategy(storage_strategy)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid storage_strategy: {storage_strategy}"
        )

    try:
        document = await service.ingest_file(
            session=session,
            file_path=file_path,
            storage_strategy=strategy,
            force_reimport=force_reimport,
            generate_embeddings=generate_embeddings,
        )

        # Get counts
        chunk_count = len(document.chunks) if document.chunks else 0
        media_count = len(document.media) if document.media else 0

        return DocumentResponse(
            id=str(document.id),
            filename=document.filename,
            file_path=document.file_path,
            file_type=document.file_type,
            file_size=document.file_size,
            mime_type=document.mime_type,
            file_hash=document.file_hash,
            storage_strategy=document.storage_strategy.value,
            title=document.title,
            author=document.author,
            created_at=document.created_at,
            ingested_at=document.ingested_at,
            file_modified_at=document.file_modified_at,
            source_directory=document.source_directory,
            embedding_status=document.embedding_status.value,
            custom_metadata=document.custom_metadata,
            chunk_count=chunk_count,
            media_count=media_count,
        )

    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ingest file: {str(e)}"
        )


# ========================================
# Retrieval Endpoints
# ========================================

@router.get("", response_model=DocumentListResponse)
async def list_documents(
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=50, ge=1, le=100, description="Items per page"),
    file_type: Optional[str] = Query(default=None, description="Filter by file type"),
    embedding_status: Optional[str] = Query(default=None, description="Filter by embedding status"),
    search: Optional[str] = Query(default=None, description="Search in title/filename"),
    session: AsyncSession = Depends(get_session),
):
    """
    List all documents with pagination and filtering.

    Args:
        page: Page number (1-indexed)
        page_size: Items per page (max 100)
        file_type: Filter by file type (pdf, txt, md, image)
        embedding_status: Filter by embedding status
        search: Search query (title/filename)

    Returns:
        Paginated list of documents
    """
    # Build query
    stmt = select(Document)

    # Filters
    if file_type:
        stmt = stmt.where(Document.file_type == file_type)
    if embedding_status:
        try:
            status_enum = EmbeddingStatus(embedding_status)
            stmt = stmt.where(Document.embedding_status == status_enum)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid embedding_status: {embedding_status}"
            )
    if search:
        stmt = stmt.where(
            or_(
                Document.title.ilike(f"%{search}%"),
                Document.filename.ilike(f"%{search}%")
            )
        )

    # Get total count
    count_stmt = select(func.count()).select_from(Document)
    if file_type:
        count_stmt = count_stmt.where(Document.file_type == file_type)
    if embedding_status:
        count_stmt = count_stmt.where(Document.embedding_status == status_enum)
    if search:
        count_stmt = count_stmt.where(
            or_(
                Document.title.ilike(f"%{search}%"),
                Document.filename.ilike(f"%{search}%")
            )
        )

    total_result = await session.execute(count_stmt)
    total = total_result.scalar()

    # Pagination
    offset = (page - 1) * page_size
    stmt = stmt.order_by(Document.ingested_at.desc()).offset(offset).limit(page_size)

    result = await session.execute(stmt)
    documents = result.scalars().all()

    # Convert to response
    doc_responses = []
    for doc in documents:
        # Get counts
        chunk_count_stmt = select(func.count()).select_from(DocumentChunk).where(DocumentChunk.document_id == doc.id)
        chunk_count_result = await session.execute(chunk_count_stmt)
        chunk_count = chunk_count_result.scalar()

        media_count_stmt = select(func.count()).select_from(DocumentMedia).where(DocumentMedia.document_id == doc.id)
        media_count_result = await session.execute(media_count_stmt)
        media_count = media_count_result.scalar()

        doc_responses.append(DocumentResponse(
            id=str(doc.id),
            filename=doc.filename,
            file_path=doc.file_path,
            file_type=doc.file_type,
            file_size=doc.file_size,
            mime_type=doc.mime_type,
            file_hash=doc.file_hash,
            storage_strategy=doc.storage_strategy.value,
            title=doc.title,
            author=doc.author,
            created_at=doc.created_at,
            ingested_at=doc.ingested_at,
            file_modified_at=doc.file_modified_at,
            source_directory=doc.source_directory,
            embedding_status=doc.embedding_status.value,
            custom_metadata=doc.custom_metadata,
            chunk_count=chunk_count,
            media_count=media_count,
        ))

    total_pages = (total + page_size - 1) // page_size

    return DocumentListResponse(
        documents=doc_responses,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


# ========================================
# Batch Endpoints (must come before /{document_id})
# ========================================

@router.get("/batches", response_model=BatchListResponse)
async def list_batches(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    """
    List all ingestion batches with pagination.

    Args:
        page: Page number
        page_size: Items per page

    Returns:
        Paginated list of batches
    """
    # Get total count
    count_stmt = select(func.count()).select_from(IngestionBatch)
    total_result = await session.execute(count_stmt)
    total = total_result.scalar()

    # Get batches
    offset = (page - 1) * page_size
    stmt = select(IngestionBatch).order_by(IngestionBatch.started_at.desc()).offset(offset).limit(page_size)
    result = await session.execute(stmt)
    batches = result.scalars().all()

    batch_responses = [
        IngestionBatchResponse(
            id=str(b.id),
            source_directory=b.source_directory,
            batch_type=b.batch_type,
            storage_strategy=b.storage_strategy.value,
            total_files=b.total_files,
            successful=b.successful,
            failed=b.failed,
            skipped=b.skipped,
            started_at=b.started_at,
            completed_at=b.completed_at,
            processing_time_ms=b.processing_time_ms,
            errors=b.errors or [],
        )
        for b in batches
    ]

    total_pages = (total + page_size - 1) // page_size

    return BatchListResponse(
        batches=batch_responses,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/batches/{batch_id}", response_model=IngestionBatchResponse)
async def get_batch(
    batch_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    """
    Get batch details by ID.

    Args:
        batch_id: Batch UUID

    Returns:
        Batch details

    Raises:
        HTTPException 404: Batch not found
    """
    stmt = select(IngestionBatch).where(IngestionBatch.id == batch_id)
    result = await session.execute(stmt)
    batch = result.scalar_one_or_none()

    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Batch not found: {batch_id}"
        )

    return IngestionBatchResponse(
        id=str(batch.id),
        source_directory=batch.source_directory,
        batch_type=batch.batch_type,
        storage_strategy=batch.storage_strategy.value,
        total_files=batch.total_files,
        successful=batch.successful,
        failed=batch.failed,
        skipped=batch.skipped,
        started_at=batch.started_at,
        completed_at=batch.completed_at,
        processing_time_ms=batch.processing_time_ms,
        errors=batch.errors or [],
    )


# ========================================
# Search Endpoint (must come before /{document_id})
# ========================================

@router.post("/search", response_model=DocumentSearchResponse)
async def search_documents(
    request: DocumentSearchRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Search documents semantically or by text.

    Semantic search uses embeddings for similarity matching.
    Text search uses SQL LIKE queries.

    Args:
        request: Search request with query and options

    Returns:
        Search results with scores

    Raises:
        HTTPException 500: Search failed
    """
    start_time = datetime.now()

    try:
        if request.semantic:
            # Semantic search using embeddings
            embedding_service = EmbeddingService()
            query_embedding = await embedding_service.embed_text(request.query)

            # Search chunks by embedding similarity
            # Note: This is a simplified version. In production, use pgvector operators
            # For now, we'll fall back to text search
            stmt = select(DocumentChunk).join(Document)

            if request.file_types:
                stmt = stmt.where(Document.file_type.in_(request.file_types))

            stmt = stmt.where(DocumentChunk.chunk_text.ilike(f"%{request.query}%"))
            stmt = stmt.limit(request.limit)

            result = await session.execute(stmt)
            chunks = result.scalars().all()

            # Build results
            results = []
            for chunk in chunks:
                # Get document
                doc_stmt = select(Document).where(Document.id == chunk.document_id)
                doc_result = await session.execute(doc_stmt)
                doc = doc_result.scalar_one()

                # Create highlight
                query_lower = request.query.lower()
                text_lower = chunk.chunk_text.lower()
                if query_lower in text_lower:
                    pos = text_lower.index(query_lower)
                    start = max(0, pos - 50)
                    end = min(len(chunk.chunk_text), pos + len(request.query) + 50)
                    highlight = "..." + chunk.chunk_text[start:end] + "..."
                else:
                    highlight = chunk.chunk_text[:100] + "..."

                results.append(DocumentSearchResultItem(
                    document_id=str(doc.id),
                    document_title=doc.title or doc.filename,
                    document_filename=doc.filename,
                    chunk_id=str(chunk.id),
                    chunk_text=chunk.chunk_text,
                    chunk_index=chunk.chunk_index,
                    page_number=chunk.start_page,
                    score=0.8,  # Placeholder score
                    highlight=highlight,
                ))

        else:
            # Text search
            stmt = select(Document)

            if request.file_types:
                stmt = stmt.where(Document.file_type.in_(request.file_types))

            stmt = stmt.where(
                or_(
                    Document.title.ilike(f"%{request.query}%"),
                    Document.raw_text.ilike(f"%{request.query}%")
                )
            )
            stmt = stmt.limit(request.limit)

            result = await session.execute(stmt)
            documents = result.scalars().all()

            # Build results
            results = []
            for doc in documents:
                results.append(DocumentSearchResultItem(
                    document_id=str(doc.id),
                    document_title=doc.title or doc.filename,
                    document_filename=doc.filename,
                    score=0.8,  # Placeholder score
                ))

        end_time = datetime.now()
        processing_time_ms = int((end_time - start_time).total_seconds() * 1000)

        return DocumentSearchResponse(
            results=results,
            total=len(results),
            query=request.query,
            processing_time_ms=processing_time_ms,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}"
        )


# ========================================
# Document Detail Endpoints (dynamic routes)
# ========================================

@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: UUID,
    include_chunks: bool = Query(default=False, description="Include chunks in response"),
    include_media: bool = Query(default=False, description="Include media in response"),
    session: AsyncSession = Depends(get_session),
):
    """
    Get document details by ID.

    Args:
        document_id: Document UUID
        include_chunks: Include chunks in response
        include_media: Include media in response

    Returns:
        Document details

    Raises:
        HTTPException 404: Document not found
    """
    stmt = select(Document).where(Document.id == document_id)
    result = await session.execute(stmt)
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document not found: {document_id}"
        )

    # Get chunks if requested
    chunks = None
    chunk_count = 0
    if include_chunks:
        chunks_stmt = select(DocumentChunk).where(DocumentChunk.document_id == document_id).order_by(DocumentChunk.chunk_index)
        chunks_result = await session.execute(chunks_stmt)
        chunk_models = chunks_result.scalars().all()
        chunks = [
            DocumentChunkResponse(
                id=str(c.id),
                chunk_index=c.chunk_index,
                chunk_text=c.chunk_text,
                chunk_size=c.chunk_size,
                start_page=c.start_page,
                end_page=c.end_page,
                start_offset=c.start_offset,
                end_offset=c.end_offset,
                embedding_status=c.embedding_status.value,
                has_embedding=c.embedding is not None,
            )
            for c in chunk_models
        ]
        chunk_count = len(chunks)
    else:
        chunk_count_stmt = select(func.count()).select_from(DocumentChunk).where(DocumentChunk.document_id == document_id)
        chunk_count_result = await session.execute(chunk_count_stmt)
        chunk_count = chunk_count_result.scalar()

    # Get media if requested
    media = None
    media_count = 0
    if include_media:
        media_stmt = select(DocumentMedia).where(DocumentMedia.document_id == document_id)
        media_result = await session.execute(media_stmt)
        media_models = media_result.scalars().all()
        media = [
            DocumentMediaResponse(
                id=str(m.id),
                media_type=m.media_type,
                file_path=m.file_path,
                page_number=m.page_number,
                width=m.width,
                height=m.height,
            )
            for m in media_models
        ]
        media_count = len(media)
    else:
        media_count_stmt = select(func.count()).select_from(DocumentMedia).where(DocumentMedia.document_id == document_id)
        media_count_result = await session.execute(media_count_stmt)
        media_count = media_count_result.scalar()

    return DocumentResponse(
        id=str(document.id),
        filename=document.filename,
        file_path=document.file_path,
        file_type=document.file_type,
        file_size=document.file_size,
        mime_type=document.mime_type,
        file_hash=document.file_hash,
        storage_strategy=document.storage_strategy.value,
        title=document.title,
        author=document.author,
        page_count=document.custom_metadata.get('page_count') if document.custom_metadata else None,
        created_at=document.created_at,
        ingested_at=document.ingested_at,
        file_modified_at=document.file_modified_at,
        source_directory=document.source_directory,
        embedding_status=document.embedding_status.value,
        custom_metadata=document.custom_metadata,
        chunk_count=chunk_count,
        media_count=media_count,
        chunks=chunks,
        media=media,
    )


@router.get("/{document_id}/content")
async def get_document_content(
    document_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    """
    Get full text content of document.

    Args:
        document_id: Document UUID

    Returns:
        Dict with full text

    Raises:
        HTTPException 404: Document not found
    """
    stmt = select(Document).where(Document.id == document_id)
    result = await session.execute(stmt)
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document not found: {document_id}"
        )

    return {
        "document_id": str(document.id),
        "title": document.title,
        "content": document.raw_text,
    }


@router.get("/{document_id}/chunks", response_model=DocumentChunksListResponse)
async def get_document_chunks(
    document_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    """
    Get all chunks for a document.

    Args:
        document_id: Document UUID

    Returns:
        Object containing chunks list and total count

    Raises:
        HTTPException 404: Document not found
    """
    # Verify document exists
    doc_stmt = select(Document).where(Document.id == document_id)
    doc_result = await session.execute(doc_stmt)
    document = doc_result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document not found: {document_id}"
        )

    # Get chunks
    stmt = select(DocumentChunk).where(DocumentChunk.document_id == document_id).order_by(DocumentChunk.chunk_index)
    result = await session.execute(stmt)
    chunks = result.scalars().all()

    chunk_responses = [
        DocumentChunkResponse(
            id=str(c.id),
            chunk_index=c.chunk_index,
            chunk_text=c.chunk_text,
            chunk_size=c.chunk_size,
            start_page=c.start_page,
            end_page=c.end_page,
            start_offset=c.start_offset,
            end_offset=c.end_offset,
            embedding_status=c.embedding_status.value,
            has_embedding=c.embedding is not None,
        )
        for c in chunks
    ]

    return DocumentChunksListResponse(
        chunks=chunk_responses,
        total=len(chunk_responses)
    )


@router.get("/{document_id}/media", response_model=List[DocumentMediaResponse])
async def get_document_media(
    document_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    """
    Get all media for a document.

    Args:
        document_id: Document UUID

    Returns:
        List of media items

    Raises:
        HTTPException 404: Document not found
    """
    # Verify document exists
    doc_stmt = select(Document).where(Document.id == document_id)
    doc_result = await session.execute(doc_stmt)
    document = doc_result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document not found: {document_id}"
        )

    # Get media
    stmt = select(DocumentMedia).where(DocumentMedia.document_id == document_id)
    result = await session.execute(stmt)
    media = result.scalars().all()

    return [
        DocumentMediaResponse(
            id=str(m.id),
            media_type=m.media_type,
            file_path=m.file_path,
            page_number=m.page_number,
            width=m.width,
            height=m.height,
        )
        for m in media
    ]


# ========================================
# Update/Delete Endpoints
# ========================================

@router.patch("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: UUID,
    request: DocumentUpdateRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Update document metadata.

    Args:
        document_id: Document UUID
        request: Update request

    Returns:
        Updated document

    Raises:
        HTTPException 404: Document not found
    """
    stmt = select(Document).where(Document.id == document_id)
    result = await session.execute(stmt)
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document not found: {document_id}"
        )

    # Update fields
    if request.title is not None:
        document.title = request.title
    if request.author is not None:
        document.author = request.author
    if request.custom_metadata is not None:
        document.custom_metadata = request.custom_metadata

    await session.commit()
    await session.refresh(document)

    # Get counts
    chunk_count_stmt = select(func.count()).select_from(DocumentChunk).where(DocumentChunk.document_id == document.id)
    chunk_count_result = await session.execute(chunk_count_stmt)
    chunk_count = chunk_count_result.scalar()

    media_count_stmt = select(func.count()).select_from(DocumentMedia).where(DocumentMedia.document_id == document.id)
    media_count_result = await session.execute(media_count_stmt)
    media_count = media_count_result.scalar()

    return DocumentResponse(
        id=str(document.id),
        filename=document.filename,
        file_path=document.file_path,
        file_type=document.file_type,
        file_size=document.file_size,
        mime_type=document.mime_type,
        file_hash=document.file_hash,
        storage_strategy=document.storage_strategy.value,
        title=document.title,
        author=document.author,
        created_at=document.created_at,
        ingested_at=document.ingested_at,
        file_modified_at=document.file_modified_at,
        source_directory=document.source_directory,
        embedding_status=document.embedding_status.value,
        custom_metadata=document.custom_metadata,
        chunk_count=chunk_count,
        media_count=media_count,
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    """
    Delete a document.

    Cascades to delete chunks and media records.
    Does NOT delete the actual file (for safety).

    Args:
        document_id: Document UUID

    Raises:
        HTTPException 404: Document not found
    """
    stmt = select(Document).where(Document.id == document_id)
    result = await session.execute(stmt)
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document not found: {document_id}"
        )

    await session.delete(document)
    await session.commit()
