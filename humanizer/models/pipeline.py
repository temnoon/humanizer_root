"""
Pipeline models - SQLAlchemy models for batch processing jobs

These models track long-running batch operations:
- PipelineJob: Tracks batch embedding/transformation/analysis jobs
- Job status tracking with progress indicators
- Error handling and retry logic
"""

from datetime import datetime
from uuid import UUID, uuid4
from sqlalchemy import Column, String, Text, Integer, DateTime, Float, Boolean
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID

from humanizer.database import Base


class PipelineJob(Base):
    """
    Tracks batch processing jobs (embedding, transformation, analysis).

    Jobs process multiple items (messages, conversations) in batches.
    Provides progress tracking, error handling, and result storage.

    Attributes:
        id: Unique job ID (UUID, primary key)
        job_type: Type of job ('embed', 'transform', 'analyze')
        status: Current status ('pending', 'running', 'completed', 'failed', 'cancelled')
        target_type: What we're processing ('messages', 'conversations')
        target_filter: JSONB filter for selecting targets
        total_items: Total number of items to process
        processed_items: Number of items processed so far
        successful_items: Number of items processed successfully
        failed_items: Number of items that failed
        progress_percent: Calculated progress (0.0 - 100.0)
        started_at: When job started running
        completed_at: When job finished (success or failure)
        created_at: When job was created
        job_config: Job-specific configuration (JSONB)
        result_summary: Summary of results (JSONB)
        error_log: List of errors encountered (JSONB)
    """
    __tablename__ = "pipeline_jobs"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    job_type = Column(String(50), nullable=False, index=True)  # 'embed', 'transform', 'analyze'
    status = Column(String(20), nullable=False, default='pending', index=True)  # 'pending', 'running', 'completed', 'failed', 'cancelled'

    # Target selection
    target_type = Column(String(50), nullable=False)  # 'messages', 'conversations'
    target_filter = Column(JSONB, nullable=True)  # Filter criteria for selecting targets

    # Progress tracking
    total_items = Column(Integer, nullable=False, default=0)
    processed_items = Column(Integer, nullable=False, default=0)
    successful_items = Column(Integer, nullable=False, default=0)
    failed_items = Column(Integer, nullable=False, default=0)
    progress_percent = Column(Float, nullable=False, default=0.0)

    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Configuration and results
    job_config = Column(JSONB, nullable=True)  # Job-specific config
    result_summary = Column(JSONB, nullable=True)  # Summary of results
    error_log = Column(JSONB, nullable=True)  # List of errors

    def __repr__(self) -> str:
        return f"<PipelineJob id={self.id} type={self.job_type} status={self.status} progress={self.progress_percent:.1f}%>"

    def update_progress(self):
        """Calculate and update progress percentage."""
        if self.total_items > 0:
            self.progress_percent = (self.processed_items / self.total_items) * 100.0
        else:
            self.progress_percent = 0.0
