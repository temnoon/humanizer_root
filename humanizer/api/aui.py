"""
AUI (Adaptive User Interface) API routes

Endpoints:
- POST /aui/track - Track tool usage
- GET /aui/preferences/{user_id} - Get user preferences
- PUT /aui/preferences - Update user preferences
- POST /aui/recommendations - Get adaptive recommendations
- GET /aui/stats/{user_id} - Get tool usage statistics
"""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from humanizer.database import get_session
from humanizer.services.aui import (
    track_tool_usage,
    get_user_preferences,
    update_user_preferences,
    get_recommendations,
    get_tool_usage_stats,
)
from humanizer.models.schemas import (
    TrackToolUsageRequest,
    TrackToolUsageResponse,
    GetUserPreferencesResponse,
    UpdateUserPreferencesRequest,
    GetRecommendationsRequest,
    GetRecommendationsResponse,
    ToolUsageStatsResponse,
)

router = APIRouter(prefix="/aui", tags=["aui"])


@router.post("/track", response_model=TrackToolUsageResponse)
async def track_tool_usage_endpoint(
    request: TrackToolUsageRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Track tool usage event.

    Records tool invocation and updates user patterns for adaptive learning.

    **Usage:**
    - Called by MCP server after each tool execution
    - Records success/failure, execution time, parameters
    - Updates user preferences automatically

    Args:
        request: Tool usage tracking request

    Returns:
        Tracking confirmation with updated patterns
    """
    try:
        response = await track_tool_usage(session, request)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to track tool usage: {str(e)}"
        )


@router.get("/preferences/{user_id}", response_model=GetUserPreferencesResponse)
async def get_user_preferences_endpoint(
    user_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    """
    Get user preferences and learned patterns.

    Returns:
    - Tool usage statistics
    - Learned patterns (frequently used tools, typical parameters)
    - UI/UX preferences (dark mode, etc.)

    Args:
        user_id: User UUID

    Returns:
        User preferences and patterns
    """
    try:
        response = await get_user_preferences(session, user_id)

        if response is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User preferences not found for {user_id}"
            )

        return response
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user preferences: {str(e)}"
        )


@router.put("/preferences", response_model=GetUserPreferencesResponse)
async def update_user_preferences_endpoint(
    request: UpdateUserPreferencesRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Update user UI/UX preferences.

    Updates preferences like:
    - dark_mode: bool
    - show_trajectories: bool
    - default_povm_packs: list
    - etc.

    Args:
        request: Update preferences request

    Returns:
        Updated user preferences
    """
    try:
        response = await update_user_preferences(session, request)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user preferences: {str(e)}"
        )


@router.post("/recommendations", response_model=GetRecommendationsResponse)
async def get_recommendations_endpoint(
    request: GetRecommendationsRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Get adaptive recommendations based on user patterns.

    Suggests:
    - Tools to use based on context and history
    - Parameter values based on past choices
    - Workflow optimizations

    **Recommendation types:**
    - `tool`: Frequently used tool suggestion
    - `parameter`: Common parameter value suggestion
    - `contextual_tool`: Context-appropriate tool suggestion

    Args:
        request: Recommendations request (user_id + optional context)

    Returns:
        List of recommendations with confidence scores
    """
    try:
        response = await get_recommendations(session, request)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get recommendations: {str(e)}"
        )


@router.get("/stats/{user_id}", response_model=ToolUsageStatsResponse)
async def get_tool_usage_stats_endpoint(
    user_id: UUID,
    limit: int = Query(default=10, ge=1, le=100, description="Number of recent events"),
    session: AsyncSession = Depends(get_session),
):
    """
    Get comprehensive tool usage statistics.

    Returns:
    - Total tool calls
    - Overall success rate
    - Most used tools (with individual stats)
    - Recent activity

    Args:
        user_id: User UUID
        limit: Number of recent events to include

    Returns:
        Tool usage statistics
    """
    try:
        response = await get_tool_usage_stats(session, user_id, limit)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get tool usage stats: {str(e)}"
        )
