"""
PipelineExecutor - Manages batch processing jobs for embeddings

Handles job creation, execution, progress tracking, and error handling
for batch operations on large collections of messages.
"""

import asyncio
from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import UUID
import numpy as np
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from humanizer.models.pipeline import PipelineJob
from humanizer.models.chatgpt import ChatGPTMessage
from humanizer.services.embedding import EmbeddingService


class PipelineExecutor:
    """
    Executes and manages pipeline jobs.

    Handles batch embedding of messages with progress tracking,
    error handling, and database updates.

    Example:
        >>> async with PipelineExecutor(session) as executor:
        >>>     job = await executor.create_embedding_job(limit=100)
        >>>     await executor.execute_job(job.id)
    """

    def __init__(
        self,
        session: AsyncSession,
        batch_size: int = 32,
        commit_interval: int = 100,
    ):
        """
        Initialize pipeline executor.

        Args:
            session: Database session
            batch_size: Number of items to process per batch (default: 32)
            commit_interval: Commit to DB every N items (default: 100)
        """
        self.session = session
        self.batch_size = batch_size
        self.commit_interval = commit_interval
        self._embedding_service: Optional[EmbeddingService] = None

    async def __aenter__(self):
        """Async context manager entry."""
        self._embedding_service = await EmbeddingService().__aenter__()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self._embedding_service:
            await self._embedding_service.__aexit__(exc_type, exc_val, exc_tb)
            self._embedding_service = None

    async def create_embedding_job(
        self,
        limit: Optional[int] = None,
        author_role: Optional[str] = None,
    ) -> PipelineJob:
        """
        Create a new embedding pipeline job.

        Args:
            limit: Maximum number of messages to process (None = all)
            author_role: Filter by author role (None = all roles)

        Returns:
            Created PipelineJob instance
        """
        # Build filter criteria
        target_filter: Dict[str, Any] = {}
        if author_role:
            target_filter["author_role"] = author_role
        if limit:
            target_filter["limit"] = limit

        # Count messages that need embeddings
        stmt = select(ChatGPTMessage).where(ChatGPTMessage.embedding.is_(None))
        if author_role:
            stmt = stmt.where(ChatGPTMessage.author_role == author_role)
        if limit:
            stmt = stmt.limit(limit)

        result = await self.session.execute(stmt)
        messages = result.scalars().all()
        total_items = len(messages)

        # Create job
        job = PipelineJob(
            job_type="embed",
            status="pending",
            target_type="messages",
            target_filter=target_filter,
            total_items=total_items,
            job_config={
                "model": "mxbai-embed-large",
                "batch_size": self.batch_size,
            },
        )

        self.session.add(job)
        await self.session.commit()
        await self.session.refresh(job)

        return job

    async def execute_job(self, job_id: UUID) -> PipelineJob:
        """
        Execute a pipeline job.

        Args:
            job_id: ID of job to execute

        Returns:
            Updated PipelineJob with final status

        Raises:
            ValueError: If job not found or invalid status
        """
        # Load job
        stmt = select(PipelineJob).where(PipelineJob.id == job_id)
        result = await self.session.execute(stmt)
        job = result.scalar_one_or_none()

        if not job:
            raise ValueError(f"Job {job_id} not found")

        if job.status not in ["pending", "failed"]:
            raise ValueError(f"Job {job_id} has status {job.status}, cannot execute")

        # Mark as running
        job.status = "running"
        job.started_at = datetime.utcnow()
        await self.session.commit()

        try:
            if job.job_type == "embed":
                await self._execute_embedding_job(job)
            else:
                raise ValueError(f"Unknown job type: {job.job_type}")

            # Mark as completed
            job.status = "completed"
            job.completed_at = datetime.utcnow()

        except Exception as e:
            # Mark as failed
            job.status = "failed"
            job.completed_at = datetime.utcnow()

            # Log error
            if job.error_log is None:
                job.error_log = []
            job.error_log.append({
                "timestamp": datetime.utcnow().isoformat(),
                "error": str(e),
                "type": type(e).__name__,
            })

            await self.session.commit()
            raise

        await self.session.commit()
        await self.session.refresh(job)
        return job

    async def _execute_embedding_job(self, job: PipelineJob):
        """
        Execute an embedding job.

        Args:
            job: PipelineJob instance to execute
        """
        # Get messages that need embeddings
        stmt = select(ChatGPTMessage).where(ChatGPTMessage.embedding.is_(None))

        # Apply filters
        if job.target_filter:
            if "author_role" in job.target_filter:
                stmt = stmt.where(
                    ChatGPTMessage.author_role == job.target_filter["author_role"]
                )
            if "limit" in job.target_filter:
                stmt = stmt.limit(job.target_filter["limit"])

        result = await self.session.execute(stmt)
        messages = result.scalars().all()

        if not messages:
            job.result_summary = {"message": "No messages to process"}
            return

        # Process in batches
        successful_count = 0
        failed_count = 0
        failed_items: List[Dict[str, Any]] = []

        for i in range(0, len(messages), self.batch_size):
            batch = messages[i : i + self.batch_size]

            # Extract texts
            texts = []
            for msg in batch:
                text = msg.content_text or ""
                texts.append(text.strip() if text else "")

            # Generate embeddings
            try:
                embeddings = await self._embedding_service.embed_batch(texts)

                # Update messages
                for msg, embedding in zip(batch, embeddings):
                    # Convert numpy array to list for pgvector
                    msg.embedding = embedding.tolist()
                    successful_count += 1

            except Exception as e:
                # Log failures
                for msg in batch:
                    failed_count += 1
                    failed_items.append({
                        "message_uuid": str(msg.uuid),
                        "error": str(e),
                    })

            # Update progress
            job.processed_items = i + len(batch)
            job.successful_items = successful_count
            job.failed_items = failed_count
            job.update_progress()

            # Commit periodically
            if (i + len(batch)) % self.commit_interval == 0:
                await self.session.commit()
                await self.session.refresh(job)

        # Final commit
        await self.session.commit()

        # Set result summary
        job.result_summary = {
            "total_messages": len(messages),
            "successful": successful_count,
            "failed": failed_count,
            "model": job.job_config.get("model"),
        }

        if failed_items:
            job.error_log = failed_items

    async def get_job(self, job_id: UUID) -> Optional[PipelineJob]:
        """Get a pipeline job by ID."""
        stmt = select(PipelineJob).where(PipelineJob.id == job_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_jobs(
        self,
        job_type: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> List[PipelineJob]:
        """
        List pipeline jobs.

        Args:
            job_type: Filter by job type (None = all)
            status: Filter by status (None = all)
            limit: Maximum number of jobs to return

        Returns:
            List of PipelineJob instances
        """
        stmt = select(PipelineJob).order_by(PipelineJob.created_at.desc())

        if job_type:
            stmt = stmt.where(PipelineJob.job_type == job_type)
        if status:
            stmt = stmt.where(PipelineJob.status == status)

        stmt = stmt.limit(limit)

        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def cancel_job(self, job_id: UUID) -> PipelineJob:
        """
        Cancel a running job.

        Args:
            job_id: ID of job to cancel

        Returns:
            Updated PipelineJob
        """
        stmt = select(PipelineJob).where(PipelineJob.id == job_id)
        result = await self.session.execute(stmt)
        job = result.scalar_one_or_none()

        if not job:
            raise ValueError(f"Job {job_id} not found")

        if job.status not in ["pending", "running"]:
            raise ValueError(f"Cannot cancel job with status {job.status}")

        job.status = "cancelled"
        job.completed_at = datetime.utcnow()

        await self.session.commit()
        await self.session.refresh(job)
        return job
