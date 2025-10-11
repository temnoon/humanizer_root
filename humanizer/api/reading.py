"""
Reading API routes - Quantum reading sessions

Endpoints:
- POST /reading/start - Start new reading session
- POST /reading/step - Execute TRM iteration
- POST /reading/measure - Measure with additional POVM
- POST /reading/apply - Apply corner view
- GET /reading/{id}/trace - Get full trajectory
"""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from humanizer.database import get_session
from humanizer.services.reading import ReadingService
from humanizer.models.schemas import (
    ReadingStartRequest,
    ReadingStartResponse,
    ReadingStepRequest,
    ReadingStepResponse,
    ReadingMeasureRequest,
    ReadingMeasureResponse,
    ReadingApplyRequest,
    ReadingApplyResponse,
    ReadingTraceResponse,
)

router = APIRouter(prefix="/reading", tags=["reading"])


@router.post("/start", response_model=ReadingStartResponse)
async def start_reading(
    request: ReadingStartRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Start a new quantum reading session.

    Process:
    1. Embed text
    2. Construct density matrix ρ
    3. Measure with POVM packs
    4. Return initial state

    Returns:
        ReadingStartResponse with reading_id, initial ρ state, and POVM readings
    """
    # For now, use a fixed user ID (TODO: get from auth)
    user_id = UUID("00000000-0000-0000-0000-000000000001")

    service = ReadingService()

    try:
        response = await service.start(session, request, user_id)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start reading: {str(e)}"
        )


@router.post("/step", response_model=ReadingStepResponse)
async def step_reading(
    request: ReadingStepRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Execute one TRM iteration step.

    Process:
    1. Load current state
    2. Run TRM iteration
    3. Construct new ρ
    4. Re-measure POVMs
    5. Generate corner views

    Returns:
        ReadingStepResponse with refined text, POVM readings, and corner views
    """
    service = ReadingService()

    try:
        response = await service.step(session, request)
        return response
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to step reading: {str(e)}"
        )


@router.post("/measure", response_model=ReadingMeasureResponse)
async def measure_reading(
    request: ReadingMeasureRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Measure current state with additional POVM pack.

    Allows applying different measurement perspectives to the current reading state.

    Returns:
        ReadingMeasureResponse with POVM readings
    """
    service = ReadingService()

    try:
        response = await service.measure(session, request)
        return response
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to measure reading: {str(e)}"
        )


@router.post("/apply", response_model=ReadingApplyResponse)
async def apply_corner(
    request: ReadingApplyRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Apply a corner view transformation.

    Accepts one of the four corner views (A, ¬A, both, neither) as the new text.

    Returns:
        ReadingApplyResponse with updated text and provenance
    """
    service = ReadingService()

    try:
        response = await service.apply(session, request)
        return response
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to apply corner: {str(e)}"
        )


@router.get("/{reading_id}/trace", response_model=ReadingTraceResponse)
async def get_reading_trace(
    reading_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    """
    Get full reading trajectory.

    Returns all steps with POVM readings and metrics for visualization.

    Returns:
        ReadingTraceResponse with complete trajectory
    """
    service = ReadingService()

    try:
        response = await service.trace(session, reading_id)
        return response
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get trace: {str(e)}"
        )
