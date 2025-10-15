"""
Embedding Space Explorer API

Endpoints for exploring embedding space with TRM perturbation theory:
- POST /api/explore/search - Semantic search with embeddings
- POST /api/explore/neighbors - Find k-nearest neighbors
- POST /api/explore/direction - Compute semantic direction
- POST /api/explore/perturb - TRM perturbation analysis
- POST /api/explore/trajectory - Explore embedding trajectory
- POST /api/explore/clusters - Find semantic clusters
"""

from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from humanizer.database import get_session
from humanizer.services.embedding_explorer import EmbeddingExplorer
from humanizer.services.embedding import EmbeddingService
from humanizer.models.chatgpt import ChatGPTMessage
from sqlalchemy import select

router = APIRouter(prefix="/api/explore", tags=["embedding-explorer"])


# ========================================
# Request/Response Schemas
# ========================================

class SemanticSearchRequest(BaseModel):
    """Request for semantic search."""
    query: str = Field(..., description="Search query text")
    k: int = Field(10, ge=1, le=100, description="Number of results")
    min_similarity: float = Field(0.0, ge=0.0, le=1.0, description="Minimum similarity threshold")


class NeighborResponse(BaseModel):
    """Response for a single neighbor."""
    uuid: str
    content_text: str
    author_role: str
    conversation_uuid: str
    similarity: float
    distance: float


class SemanticSearchResponse(BaseModel):
    """Response for semantic search."""
    query: str
    results: List[NeighborResponse]
    total_results: int


class FindNeighborsRequest(BaseModel):
    """Request to find neighbors of a message."""
    message_uuid: UUID = Field(..., description="Message UUID to find neighbors for")
    k: int = Field(10, ge=1, le=100, description="Number of neighbors")
    min_similarity: float = Field(0.0, ge=0.0, le=1.0, description="Minimum similarity")


class ComputeDirectionRequest(BaseModel):
    """Request to compute semantic direction."""
    positive_query: str = Field(..., description="What we want more of")
    negative_query: str = Field(..., description="What we want less of")


class DirectionResponse(BaseModel):
    """Response with semantic direction."""
    positive_query: str
    negative_query: str
    direction: List[float]  # 1024-dim vector
    magnitude: float


class PerturbationRequest(BaseModel):
    """Request for TRM perturbation analysis."""
    text: str = Field(..., description="Text to analyze")
    direction: Optional[List[float]] = Field(None, description="Pre-computed direction (1024-dim)")
    positive_query: Optional[str] = Field(None, description="Compute direction: more of this")
    negative_query: Optional[str] = Field(None, description="Compute direction: less of this")
    magnitude: float = Field(0.1, ge=0.0, le=1.0, description="Perturbation magnitude")
    povm_pack: str = Field("tetralemma", description="POVM pack for measurements")
    trm_rank: int = Field(64, ge=16, le=128, description="TRM matrix rank")


class PerturbationResponse(BaseModel):
    """Response with TRM perturbation analysis."""
    text: str
    original_reading: dict
    perturbed_reading: dict
    delta_probabilities: dict
    rho_distance: float
    max_change: dict
    embedding_shift: float


class TrajectoryRequest(BaseModel):
    """Request for trajectory exploration."""
    text: str = Field(..., description="Starting text")
    direction: Optional[List[float]] = Field(None, description="Pre-computed direction")
    positive_query: Optional[str] = Field(None, description="Direction: more of this")
    negative_query: Optional[str] = Field(None, description="Direction: less of this")
    steps: int = Field(5, ge=1, le=20, description="Number of steps")
    step_size: float = Field(0.05, ge=0.01, le=0.5, description="Step size")
    povm_pack: str = Field("tetralemma", description="POVM pack")
    trm_rank: int = Field(64, ge=16, le=128, description="TRM rank")


class TrajectoryResponse(BaseModel):
    """Response with trajectory data."""
    text: str
    direction_description: str
    trajectory: List[dict]


class ClusterRequest(BaseModel):
    """Request to find semantic clusters."""
    n_samples: int = Field(1000, ge=100, le=10000, description="Number of messages to sample")
    n_clusters: int = Field(5, ge=2, le=20, description="Number of clusters")


class ClusterResponse(BaseModel):
    """Response with cluster analysis."""
    n_clusters: int
    n_samples: int
    clusters: List[dict]


# ========================================
# Endpoints
# ========================================

@router.post("/search", response_model=SemanticSearchResponse)
async def semantic_search(
    request: SemanticSearchRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Semantic search using embedding similarity.

    Example:
        POST /api/explore/search
        {"query": "quantum mechanics", "k": 10}
    """
    try:
        explorer = EmbeddingExplorer()

        async with explorer.embedding_service as service:
            # Embed query
            query_embedding = await service.embed_text(request.query)

            # Find neighbors
            neighbors = await explorer.find_neighbors(
                session=session,
                query_embedding=query_embedding,
                k=request.k,
                min_similarity=request.min_similarity,
            )

            return SemanticSearchResponse(
                query=request.query,
                results=[NeighborResponse(**n) for n in neighbors],
                total_results=len(neighbors),
            )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}"
        )


@router.post("/neighbors", response_model=SemanticSearchResponse)
async def find_neighbors(
    request: FindNeighborsRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Find k-nearest neighbors of a message.

    Example:
        POST /api/explore/neighbors
        {"message_uuid": "...", "k": 10}
    """
    try:
        # Get message embedding
        stmt = select(ChatGPTMessage).where(ChatGPTMessage.uuid == request.message_uuid)
        result = await session.execute(stmt)
        message = result.scalar_one_or_none()

        if not message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Message {request.message_uuid} not found"
            )

        if message.embedding is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Message has no embedding"
            )

        explorer = EmbeddingExplorer()

        # Find neighbors (excluding self)
        neighbors = await explorer.find_neighbors(
            session=session,
            query_embedding=message.embedding,
            k=request.k,
            exclude_uuid=request.message_uuid,
            min_similarity=request.min_similarity,
        )

        return SemanticSearchResponse(
            query=message.content_text[:100] + "...",
            results=[NeighborResponse(**n) for n in neighbors],
            total_results=len(neighbors),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to find neighbors: {str(e)}"
        )


@router.post("/direction", response_model=DirectionResponse)
async def compute_direction(
    request: ComputeDirectionRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Compute semantic direction vector.

    Direction = embed(positive) - embed(negative)

    Examples:
        - "technical" - "casual"
        - "detailed" - "concise"
        - "formal" - "informal"
    """
    try:
        explorer = EmbeddingExplorer()

        direction = await explorer.compute_semantic_direction(
            session=session,
            positive_query=request.positive_query,
            negative_query=request.negative_query,
        )

        import numpy as np
        magnitude = float(np.linalg.norm(direction))

        return DirectionResponse(
            positive_query=request.positive_query,
            negative_query=request.negative_query,
            direction=direction.tolist(),
            magnitude=magnitude,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compute direction: {str(e)}"
        )


@router.post("/perturb", response_model=PerturbationResponse)
async def compute_perturbation(
    request: PerturbationRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Compute TRM perturbation when embedding changes.

    Shows how density matrix ρ and POVM measurements change
    when we move in embedding space.

    Example:
        POST /api/explore/perturb
        {
            "text": "This is a casual message",
            "positive_query": "formal",
            "negative_query": "casual",
            "magnitude": 0.1
        }
    """
    try:
        explorer = EmbeddingExplorer()

        # Get direction (either from request or compute it)
        if request.direction:
            import numpy as np
            direction = np.array(request.direction, dtype=np.float32)
        elif request.positive_query and request.negative_query:
            direction = await explorer.compute_semantic_direction(
                session=session,
                positive_query=request.positive_query,
                negative_query=request.negative_query,
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Must provide either 'direction' or both 'positive_query' and 'negative_query'"
            )

        # Compute perturbation
        result = await explorer.compute_trm_perturbation(
            text=request.text,
            direction=direction,
            magnitude=request.magnitude,
            povm_pack=request.povm_pack,
            trm_rank=request.trm_rank,
        )

        return PerturbationResponse(
            text=request.text,
            **result
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compute perturbation: {str(e)}"
        )


@router.post("/trajectory", response_model=TrajectoryResponse)
async def explore_trajectory(
    request: TrajectoryRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Explore trajectory in embedding space.

    Moves along a semantic direction in steps,
    showing how TRM measurements evolve.

    Example:
        POST /api/explore/trajectory
        {
            "text": "Hello world",
            "positive_query": "technical",
            "negative_query": "casual",
            "steps": 5,
            "step_size": 0.05
        }
    """
    try:
        explorer = EmbeddingExplorer()

        # Get direction
        if request.direction:
            import numpy as np
            direction = np.array(request.direction, dtype=np.float32)
            direction_desc = "Custom direction"
        elif request.positive_query and request.negative_query:
            direction = await explorer.compute_semantic_direction(
                session=session,
                positive_query=request.positive_query,
                negative_query=request.negative_query,
            )
            direction_desc = f"{request.positive_query} ← → {request.negative_query}"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Must provide direction or queries"
            )

        # Explore trajectory
        trajectory = await explorer.explore_trajectory(
            text=request.text,
            direction=direction,
            steps=request.steps,
            step_size=request.step_size,
            povm_pack=request.povm_pack,
            trm_rank=request.trm_rank,
        )

        return TrajectoryResponse(
            text=request.text,
            direction_description=direction_desc,
            trajectory=trajectory,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to explore trajectory: {str(e)}"
        )


@router.post("/clusters", response_model=ClusterResponse)
async def find_clusters(
    request: ClusterRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Find semantic clusters in embedding space.

    Uses k-means clustering on a sample of messages.

    Example:
        POST /api/explore/clusters
        {"n_samples": 1000, "n_clusters": 5}
    """
    try:
        explorer = EmbeddingExplorer()

        result = await explorer.find_semantic_clusters(
            session=session,
            n_samples=request.n_samples,
            n_clusters=request.n_clusters,
        )

        return ClusterResponse(**result)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to find clusters: {str(e)}"
        )
