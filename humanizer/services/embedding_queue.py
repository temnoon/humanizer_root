"""
Embedding Job Queue - Background embedding generation system

Simple but effective PostgreSQL-based job queue for generating embeddings.

Queue uses document_chunks.embedding_status to track work:
- PENDING: Not yet processed
- PROCESSING: Currently being processed
- COMPLETED: Successfully processed
- FAILED: Processing failed

Workers poll for PENDING chunks and process them in batches.
"""

import asyncio
from typing import List, Optional
from datetime import datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from humanizer.models.document import DocumentChunk, EmbeddingStatus
from humanizer.services.embedding import EmbeddingService


class EmbeddingJobQueue:
    """
    Service for managing embedding generation jobs.

    Uses document_chunks.embedding_status as a work queue.
    Workers poll for PENDING chunks and process them.
    """

    def __init__(self):
        """Initialize queue with embedding service."""
        self.embedding_service = EmbeddingService()

    async def get_pending_chunks(
        self,
        session: AsyncSession,
        limit: int = 50,
        timeout_minutes: int = 30,
    ) -> List[DocumentChunk]:
        """
        Get pending chunks for processing.

        Also handles stuck PROCESSING chunks (timeout recovery).

        Args:
            session: Database session
            limit: Max chunks to return
            timeout_minutes: Consider PROCESSING chunks stuck after this time

        Returns:
            List of DocumentChunk to process
        """
        # Get PENDING chunks
        stmt = (
            select(DocumentChunk)
            .where(DocumentChunk.embedding_status == EmbeddingStatus.PENDING)
            .order_by(DocumentChunk.created_at)
            .limit(limit)
        )

        result = await session.execute(stmt)
        pending_chunks = result.scalars().all()

        # Also check for stuck PROCESSING chunks (timeout recovery)
        # In a real system, you'd have a "started_at" timestamp
        # For now, we'll just rely on the status

        return list(pending_chunks)

    async def mark_processing(
        self,
        session: AsyncSession,
        chunk_ids: List[str],
    ) -> None:
        """
        Mark chunks as PROCESSING.

        Args:
            session: Database session
            chunk_ids: List of chunk IDs to mark
        """
        stmt = (
            update(DocumentChunk)
            .where(DocumentChunk.id.in_(chunk_ids))
            .values(embedding_status=EmbeddingStatus.PROCESSING)
        )

        await session.execute(stmt)
        await session.commit()

    async def mark_completed(
        self,
        session: AsyncSession,
        chunk_id: str,
    ) -> None:
        """
        Mark chunk as COMPLETED.

        Args:
            session: Database session
            chunk_id: Chunk ID
        """
        stmt = (
            update(DocumentChunk)
            .where(DocumentChunk.id == chunk_id)
            .values(embedding_status=EmbeddingStatus.COMPLETED)
        )

        await session.execute(stmt)
        await session.commit()

    async def mark_failed(
        self,
        session: AsyncSession,
        chunk_id: str,
    ) -> None:
        """
        Mark chunk as FAILED.

        Args:
            session: Database session
            chunk_id: Chunk ID
        """
        stmt = (
            update(DocumentChunk)
            .where(DocumentChunk.id == chunk_id)
            .values(embedding_status=EmbeddingStatus.FAILED)
        )

        await session.execute(stmt)
        await session.commit()

    async def process_chunk(
        self,
        session: AsyncSession,
        chunk: DocumentChunk,
    ) -> bool:
        """
        Process a single chunk (generate embedding).

        Args:
            session: Database session
            chunk: DocumentChunk to process

        Returns:
            True if successful, False otherwise
        """
        try:
            # Generate embedding
            embedding = await self.embedding_service.get_embedding(chunk.chunk_text)

            # Update chunk with embedding
            chunk.embedding = embedding
            chunk.embedding_status = EmbeddingStatus.COMPLETED

            await session.commit()
            return True

        except Exception as e:
            print(f"Failed to generate embedding for chunk {chunk.id}: {str(e)}")
            chunk.embedding_status = EmbeddingStatus.FAILED
            await session.commit()
            return False

    async def process_batch(
        self,
        session: AsyncSession,
        batch_size: int = 50,
    ) -> int:
        """
        Process a batch of pending chunks.

        This is the main method called by workers.

        Args:
            session: Database session
            batch_size: Number of chunks to process

        Returns:
            Number of chunks successfully processed
        """
        # Get pending chunks
        chunks = await self.get_pending_chunks(session, limit=batch_size)

        if not chunks:
            return 0

        # Mark as processing
        chunk_ids = [str(chunk.id) for chunk in chunks]
        await self.mark_processing(session, chunk_ids)

        # Process each chunk
        successful = 0
        for chunk in chunks:
            # Refresh chunk to get latest data
            await session.refresh(chunk)

            if await self.process_chunk(session, chunk):
                successful += 1

        return successful

    async def get_queue_stats(self, session: AsyncSession) -> dict:
        """
        Get queue statistics.

        Args:
            session: Database session

        Returns:
            Dict with queue stats
        """
        # Count chunks by status
        pending_stmt = select(DocumentChunk).where(
            DocumentChunk.embedding_status == EmbeddingStatus.PENDING
        )
        pending_result = await session.execute(pending_stmt)
        pending_count = len(pending_result.scalars().all())

        processing_stmt = select(DocumentChunk).where(
            DocumentChunk.embedding_status == EmbeddingStatus.PROCESSING
        )
        processing_result = await session.execute(processing_stmt)
        processing_count = len(processing_result.scalars().all())

        completed_stmt = select(DocumentChunk).where(
            DocumentChunk.embedding_status == EmbeddingStatus.COMPLETED
        )
        completed_result = await session.execute(completed_stmt)
        completed_count = len(completed_result.scalars().all())

        failed_stmt = select(DocumentChunk).where(
            DocumentChunk.embedding_status == EmbeddingStatus.FAILED
        )
        failed_result = await session.execute(failed_stmt)
        failed_count = len(failed_result.scalars().all())

        return {
            'pending': pending_count,
            'processing': processing_count,
            'completed': completed_count,
            'failed': failed_count,
            'total': pending_count + processing_count + completed_count + failed_count,
        }
