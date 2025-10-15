"""
Pipeline API - Endpoints for batch processing jobs

Provides endpoints for creating, executing, and monitoring
pipeline jobs (embedding, transformation, analysis).
"""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from humanizer.database import get_session
from humanizer.services.pipeline import PipelineExecutor
from humanizer.models.pipeline import PipelineJob


router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])


# ==================== Request/Response Models ====================


class CreateEmbeddingJobRequest(BaseModel):
    """Request to create an embedding job."""

    limit: Optional[int] = Field(None, description="Max messages to process (None = all)")
    author_role: Optional[str] = Field(None, description="Filter by author role")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "limit": 100,
                    "author_role": "assistant",
                },
                {"limit": None, "author_role": None},  # Process all
            ]
        }
    }


class PipelineJobResponse(BaseModel):
    """Response for pipeline job."""

    id: UUID
    job_type: str
    status: str
    target_type: str
    target_filter: Optional[dict] = None
    total_items: int
    processed_items: int
    successful_items: int
    failed_items: int
    progress_percent: float
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    job_config: Optional[dict] = None
    result_summary: Optional[dict] = None
    error_log: Optional[list] = None

    @classmethod
    def from_model(cls, job: PipelineJob) -> "PipelineJobResponse":
        """Convert PipelineJob model to response."""
        return cls(
            id=job.id,
            job_type=job.job_type,
            status=job.status,
            target_type=job.target_type,
            target_filter=job.target_filter,
            total_items=job.total_items,
            processed_items=job.processed_items,
            successful_items=job.successful_items,
            failed_items=job.failed_items,
            progress_percent=job.progress_percent,
            created_at=job.created_at.isoformat() if job.created_at else "",
            started_at=job.started_at.isoformat() if job.started_at else None,
            completed_at=job.completed_at.isoformat() if job.completed_at else None,
            job_config=job.job_config,
            result_summary=job.result_summary,
            error_log=job.error_log,
        )


class JobListResponse(BaseModel):
    """Response for list of jobs."""

    jobs: List[PipelineJobResponse]
    total: int


class EmbeddingStatsResponse(BaseModel):
    """Response for embedding statistics."""

    total_messages: int
    messages_with_embeddings: int
    messages_without_embeddings: int
    coverage_percent: float


# ==================== Background Task ====================


async def execute_job_background(job_id: UUID, session: AsyncSession):
    """Execute a job in the background."""
    async with PipelineExecutor(session) as executor:
        await executor.execute_job(job_id)


# ==================== Endpoints ====================


@router.post("/jobs/embed", response_model=PipelineJobResponse)
async def create_embedding_job(
    request: CreateEmbeddingJobRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
):
    """
    Create a new embedding job.

    Creates a job to embed messages that don't have embeddings yet.
    The job is automatically started in the background.

    Returns the created job with status 'running'.
    """
    async with PipelineExecutor(session) as executor:
        # Create job
        job = await executor.create_embedding_job(
            limit=request.limit,
            author_role=request.author_role,
        )

        # Start execution in background
        background_tasks.add_task(execute_job_background, job.id, session)

        return PipelineJobResponse.from_model(job)


@router.get("/jobs/{job_id}", response_model=PipelineJobResponse)
async def get_job(
    job_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    """
    Get a pipeline job by ID.

    Returns job details including progress, status, and results.
    """
    async with PipelineExecutor(session) as executor:
        job = await executor.get_job(job_id)

        if not job:
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

        return PipelineJobResponse.from_model(job)


@router.get("/jobs", response_model=JobListResponse)
async def list_jobs(
    job_type: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    session: AsyncSession = Depends(get_session),
):
    """
    List pipeline jobs.

    Filter by job type and status. Results are sorted by creation time (newest first).
    """
    async with PipelineExecutor(session) as executor:
        jobs = await executor.list_jobs(
            job_type=job_type,
            status=status,
            limit=limit,
        )

        return JobListResponse(
            jobs=[PipelineJobResponse.from_model(j) for j in jobs],
            total=len(jobs),
        )


@router.post("/jobs/{job_id}/cancel", response_model=PipelineJobResponse)
async def cancel_job(
    job_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    """
    Cancel a running job.

    Only jobs with status 'pending' or 'running' can be cancelled.
    """
    async with PipelineExecutor(session) as executor:
        try:
            job = await executor.cancel_job(job_id)
            return PipelineJobResponse.from_model(job)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))


@router.get("/stats/embeddings", response_model=EmbeddingStatsResponse)
async def get_embedding_stats(session: AsyncSession = Depends(get_session)):
    """
    Get embedding coverage statistics.

    Shows how many messages have embeddings vs. how many don't.
    """
    from sqlalchemy import text

    result = await session.execute(text("SELECT * FROM embedding_coverage"))
    row = result.fetchone()

    if not row:
        return EmbeddingStatsResponse(
            total_messages=0,
            messages_with_embeddings=0,
            messages_without_embeddings=0,
            coverage_percent=0.0,
        )

    return EmbeddingStatsResponse(
        total_messages=row[0],
        messages_with_embeddings=row[1],
        messages_without_embeddings=row[2],
        coverage_percent=row[3],
    )


@router.post("/health")
async def health_check():
    """
    Check if Ollama embedding service is available.

    Returns status of Ollama and embedding model.
    """
    from humanizer.services.embedding import EmbeddingService

    async with EmbeddingService() as service:
        status = await service.health_check()
        return status
