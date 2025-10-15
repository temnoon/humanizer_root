"""
Personifier API - Transform AI text to conversational register

Endpoints:
- POST /api/personify/trm - Transform using TRM iterative method
- POST /api/personify/llm - Transform using LLM only
- POST /api/personify/compare - Run both and compare results
- GET /api/personify/target-stance - Get target stance from training data
- GET /api/personify/health - Health check
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from humanizer.services.personifier import get_personifier_service
from humanizer.database.connection import get_session


router = APIRouter(prefix="/api/personify", tags=["personifier"])

# Default user ID (TODO: Replace with actual auth system)
DEFAULT_USER_ID = UUID("00000000-0000-0000-0000-000000000001")


# ============================================================================
# Request/Response Models
# ============================================================================

class PersonifyTRMRequest(BaseModel):
    """Request for TRM-based personification."""
    text: str = Field(..., description="AI-written text to transform")
    user_prompt: Optional[str] = Field(
        None,
        description="User's description of desired personification (optional - will use default if not provided)"
    )
    source_message_uuid: Optional[str] = Field(
        None,
        description="UUID of source ChatGPT message if transforming existing message"
    )
    povm_pack: str = Field(
        default="tone",
        description="POVM pack to use (tone, tetralemma, etc.)",
    )
    max_iterations: Optional[int] = Field(
        default=5,
        description="Maximum iterations for TRM method",
    )
    convergence_threshold: Optional[float] = Field(
        default=0.05,
        description="Convergence threshold",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "text": "It's worth noting that this approach can be beneficial in many cases. You might want to consider the following factors.",
                "user_prompt": "Transform from AI register to natural conversational tone",
                "povm_pack": "tone",
                "max_iterations": 5,
            }
        }
    }


class PersonifyLLMRequest(BaseModel):
    """Request for LLM-only personification."""
    text: str = Field(..., description="AI-written text to transform")
    user_prompt: Optional[str] = Field(
        None,
        description="User's description of desired personification (optional - will use default if not provided)"
    )
    source_message_uuid: Optional[str] = Field(
        None,
        description="UUID of source ChatGPT message if transforming existing message"
    )
    strength: Optional[float] = Field(
        default=1.0,
        ge=0.5,
        le=2.0,
        description="Transformation strength (0.5-2.0)",
    )
    use_examples: Optional[bool] = Field(
        default=True,
        description="Include training examples in prompt",
    )
    n_examples: Optional[int] = Field(
        default=3,
        description="Number of examples to include",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "text": "It's worth noting that this approach can be beneficial in many cases.",
                "user_prompt": "Make this sound like a friend explaining, not an AI assistant",
                "strength": 1.0,
                "use_examples": True,
                "n_examples": 3,
            }
        }
    }


class PersonifyCompareRequest(BaseModel):
    """Request for comparing both methods."""
    text: str = Field(..., description="AI-written text to transform")
    user_prompt: Optional[str] = Field(
        None,
        description="User's description of desired personification (optional)"
    )
    source_message_uuid: Optional[str] = Field(
        None,
        description="UUID of source ChatGPT message if transforming existing message"
    )
    povm_pack: str = Field(
        default="tone",
        description="POVM pack for TRM method",
    )
    max_iterations: Optional[int] = Field(
        default=5,
        description="Max iterations for TRM",
    )
    llm_strength: Optional[float] = Field(
        default=1.0,
        description="Strength for LLM method",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "text": "It's worth noting that this approach can be beneficial.",
                "povm_pack": "tone",
                "max_iterations": 5,
                "llm_strength": 1.0,
            }
        }
    }


class PersonifyResponse(BaseModel):
    """Response from personification."""
    transformation_id: str = Field(..., description="UUID of saved transformation")
    method: str = Field(..., description="Method used (trm or llm)")
    original_text: str = Field(..., description="Original text")
    transformed_text: str = Field(..., description="Transformed text")
    ai_patterns: Dict = Field(..., description="Detected AI patterns")
    ai_confidence: float = Field(..., description="AI confidence (0-100)")
    processing_time: int = Field(..., description="Processing time in ms")
    saved: bool = Field(True, description="Whether transformation was saved to database")

    # TRM-specific fields
    target_stance: Optional[Dict[str, float]] = Field(None, description="Target stance (TRM only)")
    iterations: Optional[int] = Field(None, description="Iterations (TRM only)")
    convergence_score: Optional[float] = Field(None, description="Final drift (TRM only)")
    embedding_drift: Optional[List[float]] = Field(None, description="Drift per iteration (TRM only)")
    steps: Optional[List[Dict]] = Field(None, description="Intermediate steps (TRM only)")

    # LLM-specific fields
    examples_used: Optional[List[Dict]] = Field(None, description="Training examples (LLM only)")
    strength: Optional[float] = Field(None, description="Strength used (LLM only)")


class PersonifyCompareResponse(BaseModel):
    """Response from method comparison."""
    trm_result: Dict = Field(..., description="TRM result with metrics")
    llm_result: Dict = Field(..., description="LLM result with metrics")
    comparison: Dict = Field(..., description="Comparison metrics")


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/trm", response_model=PersonifyResponse)
async def personify_trm(
    request: PersonifyTRMRequest,
    db: AsyncSession = Depends(get_session)
) -> PersonifyResponse:
    """
    Transform AI text to conversational using TRM iterative method.

    Uses target stance learned from 396 curated training pairs.
    Iteratively refines text until it matches the conversational stance.
    Saves transformation to database.

    Returns:
        Transformed text with convergence metrics and transformation ID
    """
    try:
        service = get_personifier_service()

        # Perform personification
        result = await service.personify_trm(
            text=request.text,
            povm_pack=request.povm_pack,
            max_iterations=request.max_iterations,
            convergence_threshold=request.convergence_threshold,
        )

        # Parse source_message_uuid if provided
        source_uuid = None
        if request.source_message_uuid:
            try:
                source_uuid = UUID(request.source_message_uuid)
            except ValueError:
                pass

        # Save to database
        transformation = await service.save_personification(
            db=db,
            user_id=DEFAULT_USER_ID,
            source_text=request.text,
            result_text=result["transformed_text"],
            method="trm",
            parameters={
                "povm_pack": request.povm_pack,
                "max_iterations": request.max_iterations,
                "convergence_threshold": request.convergence_threshold,
                "target_stance": result.get("target_stance"),
            },
            metrics={
                "processing_time_ms": result.get("processing_time"),
                "iterations": result.get("iterations"),
                "convergence_score": result.get("convergence_score"),
                "embedding_drift": result.get("embedding_drift"),
                "ai_patterns": result.get("ai_patterns"),
                "ai_confidence": result.get("ai_confidence"),
            },
            user_prompt=request.user_prompt,
            source_message_uuid=str(source_uuid) if source_uuid else None,
        )

        # Return response with transformation ID
        return PersonifyResponse(
            transformation_id=str(transformation.id),
            **result,
            saved=True
        )

    except FileNotFoundError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Training data not found: {str(e)}"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Personification failed: {str(e)}"
        )


@router.post("/llm", response_model=PersonifyResponse)
async def personify_llm(
    request: PersonifyLLMRequest,
    db: AsyncSession = Depends(get_session)
) -> PersonifyResponse:
    """
    Transform AI text to conversational using LLM only.

    Single-pass transformation with pattern detection and example-based prompting.
    Faster but less precise than TRM method.
    Saves transformation to database.

    Returns:
        Transformed text with AI pattern analysis and transformation ID
    """
    try:
        service = get_personifier_service()

        # Perform personification
        result = await service.personify_llm(
            text=request.text,
            strength=request.strength,
            use_examples=request.use_examples,
            n_examples=request.n_examples,
        )

        # Parse source_message_uuid if provided
        source_uuid = None
        if request.source_message_uuid:
            try:
                source_uuid = UUID(request.source_message_uuid)
            except ValueError:
                pass

        # Save to database
        transformation = await service.save_personification(
            db=db,
            user_id=DEFAULT_USER_ID,
            source_text=request.text,
            result_text=result["transformed_text"],
            method="llm",
            parameters={
                "strength": request.strength,
                "use_examples": request.use_examples,
                "n_examples": request.n_examples,
            },
            metrics={
                "processing_time_ms": result.get("processing_time"),
                "ai_patterns": result.get("ai_patterns"),
                "ai_confidence": result.get("ai_confidence"),
                "examples_used": result.get("examples_used"),
            },
            user_prompt=request.user_prompt,
            source_message_uuid=str(source_uuid) if source_uuid else None,
        )

        # Return response with transformation ID
        return PersonifyResponse(
            transformation_id=str(transformation.id),
            **result,
            saved=True
        )

    except FileNotFoundError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Training data not found: {str(e)}"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Personification failed: {str(e)}"
        )

    except FileNotFoundError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Training data not found: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Personification failed: {str(e)}"
        )


@router.post("/compare", response_model=PersonifyCompareResponse)
async def compare_methods(request: PersonifyCompareRequest) -> PersonifyCompareResponse:
    """
    Compare TRM iterative vs LLM-only personification.

    Runs both methods and returns:
    - Both transformation results
    - Alignment with target conversational stance
    - Word reduction metrics
    - Processing times
    - Which method performed better

    Useful for evaluating TRM effectiveness.
    """
    try:
        service = get_personifier_service()
        result = await service.compare_methods(
            text=request.text,
            povm_pack=request.povm_pack,
            max_iterations=request.max_iterations,
            llm_strength=request.llm_strength,
        )

        return PersonifyCompareResponse(**result)

    except FileNotFoundError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Training data not found: {str(e)}"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Comparison failed: {str(e)}"
        )


@router.get("/target-stance")
async def get_target_stance(povm_pack: str = "tone") -> Dict:
    """
    Get target conversational stance from training data.

    Computes average POVM readings across all casual examples
    in the 396 training pairs. This is the target that TRM method
    converges toward.

    Args:
        povm_pack: POVM pack to use (default: tone)

    Returns:
        dict with:
            - target_stance: {axis: probability}
            - povm_pack: Pack name
            - n_training_pairs: Number of training examples
    """
    try:
        service = get_personifier_service()
        target_stance = service._compute_target_stance(povm_pack)

        return {
            "target_stance": target_stance,
            "povm_pack": povm_pack,
            "n_training_pairs": len(service.training_pairs),
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to compute target stance: {str(e)}"
        )


@router.get("/health")
async def health_check() -> Dict[str, str]:
    """Health check for personifier service."""
    try:
        service = get_personifier_service()
        n_pairs = len(service.training_pairs)

        return {
            "status": "healthy",
            "service": "personifier",
            "training_pairs": str(n_pairs),
            "methods": "trm,llm",
        }

    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
        }
