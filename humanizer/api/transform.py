"""
Transformation API - TRM vs LLM Comparison Endpoints

Endpoints:
- POST /transform/trm - Transform using TRM iterative method
- POST /transform/llm - Transform using LLM only
- POST /transform/compare - Run both and compare results
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, List, Optional

from humanizer.services.transformation import TransformationService


router = APIRouter(prefix="/api/transform", tags=["transformation"])

# Initialize transformation service
transformation_service = TransformationService()


# ============================================================================
# Request/Response Models
# ============================================================================

class TransformRequest(BaseModel):
    """Request for text transformation."""
    text: str = Field(..., description="Text to transform")
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
    target_stance: Dict[str, float] = Field(
        ...,
        description="Target stance (used for prompt construction)",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "text": "The mind constructs reality through language.",
                "target_stance": {
                    "A": 0.7,
                    "¬A": 0.1,
                },
            }
        }
    }


class TransformResponse(BaseModel):
    """Response from transformation."""
    method: str = Field(..., description="Method used (trm or llm)")
    text: str = Field(..., description="Transformed text")
    processing_time: int = Field(..., description="Processing time in milliseconds")
    iterations: Optional[int] = Field(None, description="Number of iterations (TRM only)")
    convergence_score: Optional[float] = Field(None, description="Final convergence score (TRM only)")
    embedding_drift: Optional[List[float]] = Field(None, description="Drift per iteration (TRM only)")
    steps: Optional[List[Dict]] = Field(None, description="Intermediate steps (TRM only)")


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
async def transform_trm(request: TransformRequest) -> TransformResponse:
    """
    Transform text using TRM iterative embedding approximation.

    This method:
    1. Measures current state with POVM
    2. Generates transformation toward target stance
    3. Measures new state
    4. Iterates until convergence or max iterations

    Returns transformed text with convergence metrics.
    """
    try:
        result = await transformation_service.transform_trm(
            text=request.text,
            povm_pack_name=request.povm_pack,
            target_stance=request.target_stance,
            max_iterations=request.max_iterations,
            convergence_threshold=request.convergence_threshold,
        )

        return TransformResponse(**result)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transformation failed: {str(e)}")


@router.post("/llm", response_model=TransformResponse)
async def transform_llm(request: LLMTransformRequest) -> TransformResponse:
    """
    Transform text using LLM only (baseline).

    Single-pass transformation without iterative refinement.
    Used for comparison with TRM method.
    """
    try:
        result = await transformation_service.transform_llm_only(
            text=request.text,
            target_stance=request.target_stance,
        )

        return TransformResponse(**result)

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


@router.get("/health")
async def health_check() -> Dict[str, str]:
    """Health check for transformation service."""
    return {
        "status": "healthy",
        "service": "transformation",
        "embedding_model": "all-MiniLM-L6-v2",
        "rank": "64",
    }
