"""
Embeddings API routes

Provides endpoints for managing and monitoring embeddings across all data sources:
- ChatGPT messages
- Claude messages
- Document chunks
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from humanizer.database import get_session
from humanizer.models.chatgpt import ChatGPTMessage
from humanizer.models.claude import ClaudeMessage
from humanizer.models.document import DocumentChunk, EmbeddingStatus

router = APIRouter(prefix="/api/embeddings", tags=["embeddings"])


@router.get("/status")
async def get_embeddings_status(
    session: AsyncSession = Depends(get_session),
):
    """
    Get embedding status across all data sources.

    Returns statistics about embeddings for:
    - ChatGPT messages
    - Claude messages
    - Document chunks

    Returns:
        Dict with embedding status for each source

    Example:
        GET /api/embeddings/status

        Response:
        {
            "chatgpt_messages": {
                "total": 47699,
                "with_embeddings": 47699,
                "without_embeddings": 0,
                "percentage_complete": 100.0
            },
            "claude_messages": {
                "total": 4710,
                "with_embeddings": 0,
                "without_embeddings": 4710,
                "percentage_complete": 0.0
            },
            "document_chunks": {
                "total": 1250,
                "pending": 0,
                "processing": 0,
                "completed": 1250,
                "failed": 0,
                "percentage_complete": 100.0
            },
            "overall": {
                "total_embeddings": 53659,
                "completed_embeddings": 48949,
                "pending_embeddings": 4710,
                "percentage_complete": 91.2
            }
        }
    """
    # ChatGPT message stats
    chatgpt_total = await session.execute(
        select(func.count()).select_from(ChatGPTMessage)
    )
    chatgpt_with_embeddings = await session.execute(
        select(func.count()).select_from(ChatGPTMessage).where(
            ChatGPTMessage.embedding.isnot(None)
        )
    )

    chatgpt_total_count = chatgpt_total.scalar()
    chatgpt_with_count = chatgpt_with_embeddings.scalar()
    chatgpt_without_count = chatgpt_total_count - chatgpt_with_count
    chatgpt_percentage = (chatgpt_with_count / chatgpt_total_count * 100) if chatgpt_total_count > 0 else 0.0

    # Claude message stats
    claude_total = await session.execute(
        select(func.count()).select_from(ClaudeMessage)
    )
    claude_with_embeddings = await session.execute(
        select(func.count()).select_from(ClaudeMessage).where(
            ClaudeMessage.embedding.isnot(None)
        )
    )

    claude_total_count = claude_total.scalar()
    claude_with_count = claude_with_embeddings.scalar()
    claude_without_count = claude_total_count - claude_with_count
    claude_percentage = (claude_with_count / claude_total_count * 100) if claude_total_count > 0 else 0.0

    # Document chunk stats (by status)
    doc_total = await session.execute(
        select(func.count()).select_from(DocumentChunk)
    )
    doc_pending = await session.execute(
        select(func.count()).select_from(DocumentChunk).where(
            DocumentChunk.embedding_status == EmbeddingStatus.PENDING
        )
    )
    doc_processing = await session.execute(
        select(func.count()).select_from(DocumentChunk).where(
            DocumentChunk.embedding_status == EmbeddingStatus.PROCESSING
        )
    )
    doc_completed = await session.execute(
        select(func.count()).select_from(DocumentChunk).where(
            DocumentChunk.embedding_status == EmbeddingStatus.COMPLETED
        )
    )
    doc_failed = await session.execute(
        select(func.count()).select_from(DocumentChunk).where(
            DocumentChunk.embedding_status == EmbeddingStatus.FAILED
        )
    )

    doc_total_count = doc_total.scalar()
    doc_pending_count = doc_pending.scalar()
    doc_processing_count = doc_processing.scalar()
    doc_completed_count = doc_completed.scalar()
    doc_failed_count = doc_failed.scalar()
    doc_percentage = (doc_completed_count / doc_total_count * 100) if doc_total_count > 0 else 0.0

    # Overall stats
    total_embeddings = chatgpt_total_count + claude_total_count + doc_total_count
    completed_embeddings = chatgpt_with_count + claude_with_count + doc_completed_count
    pending_embeddings = chatgpt_without_count + claude_without_count + doc_pending_count + doc_processing_count
    overall_percentage = (completed_embeddings / total_embeddings * 100) if total_embeddings > 0 else 0.0

    return {
        "chatgpt_messages": {
            "total": chatgpt_total_count,
            "with_embeddings": chatgpt_with_count,
            "without_embeddings": chatgpt_without_count,
            "percentage_complete": round(chatgpt_percentage, 1),
        },
        "claude_messages": {
            "total": claude_total_count,
            "with_embeddings": claude_with_count,
            "without_embeddings": claude_without_count,
            "percentage_complete": round(claude_percentage, 1),
        },
        "document_chunks": {
            "total": doc_total_count,
            "pending": doc_pending_count,
            "processing": doc_processing_count,
            "completed": doc_completed_count,
            "failed": doc_failed_count,
            "percentage_complete": round(doc_percentage, 1),
        },
        "overall": {
            "total_embeddings": total_embeddings,
            "completed_embeddings": completed_embeddings,
            "pending_embeddings": pending_embeddings,
            "percentage_complete": round(overall_percentage, 1),
        },
    }
