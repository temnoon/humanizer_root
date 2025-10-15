"""
Transformation API - TRM vs LLM Comparison Endpoints

Endpoints:
- POST /transform/trm - Transform using TRM iterative method
- POST /transform/llm - Transform using LLM only
- POST /transform/compare - Run both and compare results
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from humanizer.services.transformation import TransformationService
from humanizer.models.transformation import TransformationType
from humanizer.database.connection import get_session


router = APIRouter(prefix="/api/transform", tags=["transformation"])

# Initialize transformation service
transformation_service = TransformationService()

# Default user ID (TODO: Replace with actual auth system)
DEFAULT_USER_ID = UUID("00000000-0000-0000-0000-000000000001")


# ============================================================================
# Request/Response Models
# ============================================================================

class TransformRequest(BaseModel):
    """Request for text transformation."""
    text: str = Field(..., description="Text to transform")
    user_prompt: Optional[str] = Field(
        None,
        description="User's description of what the transformation should achieve"
    )
    source_message_uuid: Optional[str] = Field(
        None,
        description="UUID of source ChatGPT message if transforming existing message"
    )
    povm_pack: str = Field(
        default="tetralemma",
        description="POVM pack to use (tetralemma, tone, ontology, pragmatics, audience)",
    )
    target_stance: Dict[str, float] = Field(
        ...,
        description="Target stance probabilities (e.g., {'A': 0.7, '¬A': 0.1, 'both': 0.1, 'neither': 0.1})",
    )
    max_iterations: Optional[int] = Field(
        default=5,
        description="Maximum iterations for TRM method",
    )
    convergence_threshold: Optional[float] = Field(
        default=0.05,
        description="Convergence threshold for TRM method",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "text": "The mind constructs reality through language.",
                "user_prompt": "Make this sound more conversational and less academic",
                "povm_pack": "tetralemma",
                "target_stance": {
                    "A": 0.7,
                    "¬A": 0.1,
                    "both": 0.1,
                    "neither": 0.1,
                },
                "max_iterations": 5,
            }
        }
    }


class LLMTransformRequest(BaseModel):
    """Request for LLM-only transformation."""
    text: str = Field(..., description="Text to transform")
    user_prompt: Optional[str] = Field(
        None,
        description="User's description of what the transformation should achieve"
    )
    source_message_uuid: Optional[str] = Field(
        None,
        description="UUID of source ChatGPT message if transforming existing message"
    )
    target_stance: Dict[str, float] = Field(
        ...,
        description="Target stance (used for prompt construction)",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "text": "The mind constructs reality through language.",
                "user_prompt": "Simplify this for a general audience",
                "target_stance": {
                    "A": 0.7,
                    "¬A": 0.1,
                },
            }
        }
    }


class TransformResponse(BaseModel):
    """Response from transformation."""
    transformation_id: str = Field(..., description="UUID of saved transformation")
    method: str = Field(..., description="Method used (trm or llm)")
    transformed_text: str = Field(..., description="Transformed text")
    processing_time: int = Field(..., description="Processing time in milliseconds")
    iterations: Optional[int] = Field(None, description="Number of iterations (TRM only)")
    convergence_score: Optional[float] = Field(None, description="Final convergence score (TRM only)")
    embedding_drift: Optional[List[float]] = Field(None, description="Drift per iteration (TRM only)")
    steps: Optional[List[Dict]] = Field(None, description="Intermediate steps (TRM only)")
    saved: bool = Field(True, description="Whether transformation was saved to database")


class ComparisonRequest(BaseModel):
    """Request for TRM vs LLM comparison."""
    text: str = Field(..., description="Text to transform")
    povm_pack: str = Field(
        default="tetralemma",
        description="POVM pack to use",
    )
    target_stance: Dict[str, float] = Field(
        ...,
        description="Target stance probabilities",
    )
    max_iterations: Optional[int] = Field(
        default=5,
        description="Maximum iterations for TRM",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "text": "Quantum mechanics reveals the nature of reality.",
                "povm_pack": "tone",
                "target_stance": {
                    "analytical": 0.6,
                    "critical": 0.2,
                    "empathic": 0.1,
                    "playful": 0.05,
                    "neutral": 0.05,
                },
            }
        }
    }


class ComparisonResponse(BaseModel):
    """Response from comparison."""
    trm_result: Dict = Field(..., description="TRM transformation result")
    llm_result: Dict = Field(..., description="LLM transformation result")
    comparison: Dict = Field(..., description="Comparison metrics")


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/trm", response_model=TransformResponse)
async def transform_trm(
    request: TransformRequest,
    db: AsyncSession = Depends(get_session)
) -> TransformResponse:
    """
    Transform text using TRM iterative embedding approximation.

    This method:
    1. Measures current state with POVM
    2. Generates transformation toward target stance
    3. Measures new state
    4. Iterates until convergence or max iterations
    5. Saves transformation to database

    Returns transformed text with convergence metrics and transformation ID.
    """
    try:
        # Perform transformation
        result = await transformation_service.transform_trm(
            text=request.text,
            povm_pack_name=request.povm_pack,
            target_stance=request.target_stance,
            max_iterations=request.max_iterations,
            convergence_threshold=request.convergence_threshold,
        )

        # Parse source_message_uuid if provided
        source_uuid = None
        if request.source_message_uuid:
            try:
                source_uuid = UUID(request.source_message_uuid)
            except ValueError:
                pass  # Invalid UUID, treat as None

        # Save to database
        transformation = await transformation_service.save_transformation(
            db=db,
            user_id=DEFAULT_USER_ID,
            source_text=request.text,
            result_text=result["transformed_text"],
            transformation_type=TransformationType.TRM,
            parameters={
                "povm_pack": request.povm_pack,
                "target_stance": request.target_stance,
                "max_iterations": request.max_iterations,
                "convergence_threshold": request.convergence_threshold,
            },
            metrics={
                "iterations": result.get("iterations"),
                "convergence_score": result.get("convergence_score"),
                "processing_time_ms": result.get("processing_time"),
                "embedding_drift": result.get("embedding_drift"),
                "steps": result.get("steps"),
            },
            user_prompt=request.user_prompt,
            source_message_uuid=source_uuid,
        )

        # Return response with transformation ID
        return TransformResponse(
            transformation_id=str(transformation.id),
            **result,
            saved=True
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transformation failed: {str(e)}")


@router.post("/llm", response_model=TransformResponse)
async def transform_llm(
    request: LLMTransformRequest,
    db: AsyncSession = Depends(get_session)
) -> TransformResponse:
    """
    Transform text using LLM only (baseline).

    Single-pass transformation without iterative refinement.
    Used for comparison with TRM method.
    Saves transformation to database.
    """
    try:
        # Perform transformation
        result = await transformation_service.transform_llm_only(
            text=request.text,
            target_stance=request.target_stance,
        )

        # Parse source_message_uuid if provided
        source_uuid = None
        if request.source_message_uuid:
            try:
                source_uuid = UUID(request.source_message_uuid)
            except ValueError:
                pass

        # Save to database
        transformation = await transformation_service.save_transformation(
            db=db,
            user_id=DEFAULT_USER_ID,
            source_text=request.text,
            result_text=result["transformed_text"],
            transformation_type=TransformationType.LLM,
            parameters={
                "target_stance": request.target_stance,
            },
            metrics={
                "processing_time_ms": result.get("processing_time"),
            },
            user_prompt=request.user_prompt,
            source_message_uuid=source_uuid,
        )

        # Return response with transformation ID
        return TransformResponse(
            transformation_id=str(transformation.id),
            **result,
            saved=True
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transformation failed: {str(e)}")


@router.post("/compare", response_model=ComparisonResponse)
async def compare_methods(request: ComparisonRequest) -> ComparisonResponse:
    """
    Compare TRM iterative method vs LLM-only baseline.

    Runs both methods on the same input and returns:
    - Both transformation results
    - Comparison metrics (alignment, improvement)
    - Which method performed better

    Useful for validating TRM approach.
    """
    try:
        result = await transformation_service.compare_methods(
            text=request.text,
            povm_pack_name=request.povm_pack,
            target_stance=request.target_stance,
            max_iterations=request.max_iterations,
        )

        return ComparisonResponse(**result)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison failed: {str(e)}")


@router.get("/povm-packs")
async def get_povm_packs() -> Dict[str, Dict]:
    """
    Get available POVM packs with their axes.

    Returns pack names and descriptions for UI display.
    """
    packs = transformation_service.povm_packs

    return {
        pack_name: {
            "name": pack.name,
            "description": pack.description,
            "axes": [op.name for op in pack.operators],
        }
        for pack_name, pack in packs.items()
    }


@router.get("/history")
async def get_transformation_history(
    db: AsyncSession = Depends(get_session),
    limit: int = 50,
    offset: int = 0,
    transformation_type: Optional[str] = None
) -> Dict:
    """
    Get transformation history for the current user.

    Args:
        limit: Maximum number of transformations to return (default: 50)
        offset: Number of transformations to skip (default: 0)
        transformation_type: Filter by type (trm, llm, personify_trm, personify_llm)

    Returns:
        List of transformations with metadata
    """
    from sqlalchemy import select, desc
    from humanizer.models.transformation import Transformation

    try:
        # Build query
        query = select(Transformation).where(
            Transformation.user_id == DEFAULT_USER_ID
        )

        # Filter by type if specified
        if transformation_type:
            query = query.where(Transformation.transformation_type == transformation_type)

        # Order by created_at DESC
        query = query.order_by(desc(Transformation.created_at))

        # Apply pagination
        query = query.limit(limit).offset(offset)

        # Execute query
        result = await db.execute(query)
        transformations = result.scalars().all()

        # Convert to dict (with previews only)
        items = [t.to_dict(include_metrics=False, include_full_text=False) for t in transformations]

        # Get total count
        count_query = select(Transformation).where(
            Transformation.user_id == DEFAULT_USER_ID
        )
        if transformation_type:
            count_query = count_query.where(Transformation.transformation_type == transformation_type)

        count_result = await db.execute(count_query)
        total = len(count_result.scalars().all())

        return {
            "items": items,
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {str(e)}")


@router.get("/by-source/{source_uuid}")
async def get_transformations_by_source(
    source_uuid: str,
    db: AsyncSession = Depends(get_session)
) -> Dict:
    """
    Get all transformations for a specific source message.

    Args:
        source_uuid: UUID of the source ChatGPT message

    Returns:
        List of transformations for this source
    """
    from sqlalchemy import select, desc
    from humanizer.models.transformation import Transformation

    try:
        # Parse UUID
        try:
            parsed_uuid = UUID(source_uuid)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid UUID format")

        # Query transformations
        query = select(Transformation).where(
            Transformation.source_uuid == parsed_uuid
        ).order_by(desc(Transformation.created_at))

        result = await db.execute(query)
        transformations = result.scalars().all()

        # Convert to dict (include full text for context)
        items = [t.to_dict(include_metrics=True, include_full_text=True) for t in transformations]

        return {
            "source_uuid": source_uuid,
            "count": len(items),
            "transformations": items,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch transformations: {str(e)}")


@router.get("/{transformation_id}")
async def get_transformation(
    transformation_id: str,
    db: AsyncSession = Depends(get_session)
) -> Dict:
    """
    Get a specific transformation by ID.

    Args:
        transformation_id: UUID of the transformation

    Returns:
        Full transformation details including all text and metrics
    """
    from sqlalchemy import select
    from humanizer.models.transformation import Transformation

    try:
        # Parse UUID
        try:
            parsed_uuid = UUID(transformation_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid UUID format")

        # Query transformation
        query = select(Transformation).where(Transformation.id == parsed_uuid)
        result = await db.execute(query)
        transformation = result.scalar_one_or_none()

        if not transformation:
            raise HTTPException(status_code=404, detail="Transformation not found")

        # Return full details
        return transformation.to_dict(include_metrics=True, include_full_text=True)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch transformation: {str(e)}")


@router.get("/health")
async def health_check() -> Dict[str, str]:
    """Health check for transformation service."""
    return {
        "status": "healthy",
        "service": "transformation",
        "embedding_model": "all-MiniLM-L6-v2",
        "rank": "64",
    }
