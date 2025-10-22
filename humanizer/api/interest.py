"""
Interest API routes

Endpoints for tracking attention flow - the Turing tape of what we find interesting.

Philosophy: "Make me smarter by helping me know my actual subjective self."

Endpoints:
- POST /interests - Mark something as interesting
- GET /interests/current - Get current interest (Now)
- GET /interests/{interest_id} - Get specific interest
- PATCH /interests/{interest_id} - Update with discoveries
- POST /interests/{interest_id}/resolve - Mark as resolved
- POST /interests/{interest_id}/prune - Prune interest
- GET /interests/trajectory - Get Turing tape
- POST /interests/search - Search interests
- GET /interests/insights - Get learning insights
- POST /interests/{interest_id}/tags - Add tags
"""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from humanizer.database import get_session
from humanizer.services.interest import InterestTrackingService
from humanizer.models.schemas import (
    MarkInterestingRequest,
    UpdateInterestRequest,
    ResolveInterestRequest,
    PruneInterestRequest,
    AddTagsRequest,
    SearchInterestsRequest,
    InterestResponse,
    InterestTrajectoryResponse,
    InterestInsightsResponse,
    InterestListResponse,
)

router = APIRouter(prefix="/api/interests", tags=["interests"])


# SINGLE-USER MODE: User authentication stub
# TECHNICAL DEBT: See TECHNICAL_DEBT.md #DEBT-001
def get_default_user_id() -> UUID:
    """
    Get default user ID for single-user local development mode.

    TECHNICAL DEBT:
    - Type: fallback
    - Severity: 🔴 blocking for Cloud Archives
    - This hardcoded UUID blocks multi-user support
    - Acceptable for: Local Development MVP
    - Must fix before: Cloud Archives deployment

    Production TODO: Replace with actual authentication (JWT/session-based)
    when implementing multi-user cloud deployment.

    Returns:
        UUID: Hardcoded default user UUID
    """
    return UUID("00000000-0000-0000-0000-000000000001")


@router.post("", response_model=InterestResponse)
async def mark_interesting(
    request: MarkInterestingRequest,
    session: AsyncSession = Depends(get_session),
    user_id: UUID = Depends(get_default_user_id),
):
    """
    Mark something as interesting - create a new moment (Now).

    If there's a current interest, automatically links it as previous.
    This builds the Turing tape: previous → new (current).

    Args:
        request: Interest details
        session: Database session
        user_id: Current user

    Returns:
        The newly created Interest
    """
    service = InterestTrackingService()

    try:
        interest = await service.mark_interesting(
            session=session,
            user_id=user_id,
            interest_type=request.interest_type,
            target_uuid=request.target_uuid,
            moment_text=request.moment_text,
            salience_score=request.salience_score,
            target_metadata=request.target_metadata,
            context=request.context,
            predicted_value=request.predicted_value,
            tags=request.tags,
        )

        return InterestResponse.model_validate(interest)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create interest: {str(e)}"
        )


@router.get("/current", response_model=InterestResponse)
async def get_current_interest(
    session: AsyncSession = Depends(get_session),
    user_id: UUID = Depends(get_default_user_id),
):
    """
    Get the current interest (the "Now" moment).

    Returns the most recent interest that:
    - Has no next_interest_id (end of chain)
    - Is not pruned
    - Is not resolved (or was resolved recently)

    Args:
        session: Database session
        user_id: Current user

    Returns:
        Current Interest or 404 if none
    """
    service = InterestTrackingService()

    interest = await service.get_current_interest(session, user_id)

    if not interest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No current interest found"
        )

    return InterestResponse.model_validate(interest)


@router.get("/{interest_id}", response_model=InterestResponse)
async def get_interest(
    interest_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    """
    Get specific interest by ID.

    Args:
        interest_id: Interest ID
        session: Database session

    Returns:
        Interest details
    """
    service = InterestTrackingService()

    interest = await service.get_interest(session, interest_id)

    if not interest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Interest {interest_id} not found"
        )

    return InterestResponse.model_validate(interest)


@router.patch("/{interest_id}", response_model=InterestResponse)
async def update_interest(
    interest_id: UUID,
    request: UpdateInterestRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Update interest with discoveries.

    Called as we explore - not just at the end.
    Advantages and disadvantages accumulate over time.

    Args:
        interest_id: Interest to update
        request: Update details (advantages, disadvantages, value)
        session: Database session

    Returns:
        Updated Interest
    """
    service = InterestTrackingService()

    try:
        interest = await service.update_with_discoveries(
            session=session,
            interest_id=interest_id,
            advantages=request.advantages if request.advantages else None,
            disadvantages=request.disadvantages if request.disadvantages else None,
            realized_value=request.realized_value,
            value_notes=request.value_notes,
        )

        return InterestResponse.model_validate(interest)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update interest: {str(e)}"
        )


@router.post("/{interest_id}/resolve", response_model=InterestResponse)
async def resolve_interest(
    interest_id: UUID,
    request: ResolveInterestRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Mark interest as resolved - we've learned its value.

    Args:
        interest_id: Interest to resolve
        request: Resolution details (realized value, notes)
        session: Database session

    Returns:
        Resolved Interest
    """
    service = InterestTrackingService()

    try:
        interest = await service.resolve_interest(
            session=session,
            interest_id=interest_id,
            realized_value=request.realized_value,
            value_notes=request.value_notes,
            next_interest_id=request.next_interest_id,
        )

        return InterestResponse.model_validate(interest)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to resolve interest: {str(e)}"
        )


@router.post("/{interest_id}/prune", response_model=InterestResponse)
async def prune_interest(
    interest_id: UUID,
    request: PruneInterestRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Prune interest - mark it as not valuable to track.

    This is how we learn what NOT to attend to.

    Args:
        interest_id: Interest to prune
        request: Prune reason
        session: Database session

    Returns:
        Pruned Interest
    """
    service = InterestTrackingService()

    try:
        interest = await service.prune_interest(
            session=session,
            interest_id=interest_id,
            prune_reason=request.prune_reason,
        )

        return InterestResponse.model_validate(interest)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to prune interest: {str(e)}"
        )


@router.get("/trajectory", response_model=InterestTrajectoryResponse)
async def get_trajectory(
    max_depth: int = Query(50, ge=1, le=200, description="Maximum past interests to retrieve"),
    include_pruned: bool = Query(False, description="Include pruned interests?"),
    session: AsyncSession = Depends(get_session),
    user_id: UUID = Depends(get_default_user_id),
):
    """
    Get the attention trajectory (Turing tape).

    Returns the chain: [past, past, past, Now, predicted_next]

    Args:
        max_depth: Maximum past interests
        include_pruned: Include pruned interests?
        session: Database session
        user_id: Current user

    Returns:
        Trajectory with current index
    """
    service = InterestTrackingService()

    trajectory = await service.get_trajectory(
        session=session,
        user_id=user_id,
        max_depth=max_depth,
        include_pruned=include_pruned,
    )

    # Find current interest index
    current_index = -1
    for i, interest in enumerate(trajectory):
        if interest.is_current:
            current_index = i
            break

    # If no current found, use last
    if current_index == -1 and trajectory:
        current_index = len(trajectory) - 1

    return InterestTrajectoryResponse(
        trajectory=[InterestResponse.model_validate(i) for i in trajectory],
        current_index=current_index
    )


@router.post("/search", response_model=InterestListResponse)
async def search_interests(
    request: SearchInterestsRequest,
    session: AsyncSession = Depends(get_session),
    user_id: UUID = Depends(get_default_user_id),
):
    """
    Search interests by text, type, value, tags.

    Args:
        request: Search parameters
        session: Database session
        user_id: Current user

    Returns:
        Matching interests
    """
    service = InterestTrackingService()

    if request.query:
        # Text search
        interests = await service.search_interests(
            session=session,
            user_id=user_id,
            query=request.query,
            limit=request.limit,
        )
    else:
        # List with filters
        interests = await service.list_interests(
            session=session,
            user_id=user_id,
            interest_type=request.interest_type,
            include_pruned=request.include_pruned,
            min_realized_value=request.min_realized_value,
            tags=request.tags if request.tags else None,
            limit=request.limit,
        )

    return InterestListResponse(
        interests=[InterestResponse.model_validate(i) for i in interests],
        total=len(interests),
        page=1,
        page_size=len(interests)
    )


@router.get("/insights", response_model=InterestInsightsResponse)
async def get_insights(
    session: AsyncSession = Depends(get_session),
    user_id: UUID = Depends(get_default_user_id),
):
    """
    Get learning insights from interest history.

    Analyzes patterns:
    - Which types of interests have highest realized value?
    - Which lead to dead ends (low value, high cost)?
    - Average time spent on each type
    - Prune recommendations

    Args:
        session: Database session
        user_id: Current user

    Returns:
        Insights dictionary
    """
    service = InterestTrackingService()

    insights = await service.get_insights(session, user_id)

    return InterestInsightsResponse(**insights)


@router.post("/{interest_id}/tags", response_model=InterestResponse)
async def add_tags(
    interest_id: UUID,
    request: AddTagsRequest,
    session: AsyncSession = Depends(get_session),
    user_id: UUID = Depends(get_default_user_id),
):
    """
    Add tags to an interest.

    Args:
        interest_id: Interest to tag
        request: Tags to add
        session: Database session
        user_id: Current user

    Returns:
        Updated Interest with new tags
    """
    service = InterestTrackingService()

    try:
        await service.add_tags(
            session=session,
            interest_id=interest_id,
            user_id=user_id,
            tags=request.tags,
        )

        # Reload interest with tags
        interest = await service.get_interest(session, interest_id)

        return InterestResponse.model_validate(interest)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add tags: {str(e)}"
        )
