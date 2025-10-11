"""
AUI (Adaptive User Interface) Service

Handles tool usage tracking, pattern learning, and adaptive recommendations.
Enables the system to learn from user behavior and provide personalized suggestions.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional
from uuid import UUID
from collections import Counter

from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from humanizer.models.user import UserPreferences, ToolUsage
from humanizer.models.schemas import (
    TrackToolUsageRequest,
    TrackToolUsageResponse,
    GetUserPreferencesResponse,
    UpdateUserPreferencesRequest,
    GetRecommendationsRequest,
    GetRecommendationsResponse,
    ToolUsageStatsResponse,
)


# ========================================
# Tool Usage Tracking
# ========================================

async def track_tool_usage(
    session: AsyncSession,
    request: TrackToolUsageRequest
) -> TrackToolUsageResponse:
    """
    Track tool usage event.

    Records the event and updates user patterns.

    Args:
        session: Database session
        request: Tool usage tracking request

    Returns:
        Tracking response with updated patterns
    """
    # Get or create user preferences FIRST (required for foreign key)
    stmt = select(UserPreferences).where(UserPreferences.user_id == request.user_id)
    result = await session.execute(stmt)
    user_prefs = result.scalar_one_or_none()

    if not user_prefs:
        user_prefs = UserPreferences(
            user_id=request.user_id,
            tool_usage={},
            patterns={},
            preferences={}
        )
        session.add(user_prefs)
        await session.flush()  # Ensure user exists before creating tool_usage

    # Now create tool usage event
    usage_event = ToolUsage(
        user_id=request.user_id,
        tool_name=request.tool_name,
        parameters=request.parameters,
        success=request.success,
        execution_time_ms=request.execution_time_ms,
        error_message=request.error_message,
        context=request.context,
    )
    session.add(usage_event)

    # Update tool usage statistics
    tool_usage = user_prefs.tool_usage or {}
    if request.tool_name not in tool_usage:
        tool_usage[request.tool_name] = {
            "count": 0,
            "success_count": 0,
            "failure_count": 0,
            "total_execution_time_ms": 0.0,
            "avg_execution_time_ms": 0.0,
        }

    tool_stats = tool_usage[request.tool_name]
    tool_stats["count"] += 1

    if request.success:
        tool_stats["success_count"] += 1
    else:
        tool_stats["failure_count"] += 1

    if request.execution_time_ms:
        tool_stats["total_execution_time_ms"] += request.execution_time_ms
        tool_stats["avg_execution_time_ms"] = (
            tool_stats["total_execution_time_ms"] / tool_stats["count"]
        )

    tool_stats["success_rate"] = tool_stats["success_count"] / tool_stats["count"]

    user_prefs.tool_usage = tool_usage
    user_prefs.updated_at = datetime.utcnow()

    # Update patterns
    patterns = await _update_patterns(session, request.user_id, user_prefs)

    await session.flush()

    return TrackToolUsageResponse(
        tracked=True,
        usage_id=usage_event.id,
        updated_patterns=patterns
    )


async def _update_patterns(
    session: AsyncSession,
    user_id: UUID,
    user_prefs: UserPreferences
) -> Dict:
    """
    Update learned patterns based on usage history.

    Args:
        session: Database session
        user_id: User ID
        user_prefs: User preferences object

    Returns:
        Updated patterns dict
    """
    patterns = user_prefs.patterns or {}

    # Find most frequently used tool
    tool_usage = user_prefs.tool_usage or {}
    if tool_usage:
        most_used = max(tool_usage.items(), key=lambda x: x[1]["count"])
        patterns["frequent_tool"] = most_used[0]
        patterns["frequent_tool_count"] = most_used[1]["count"]

    # Analyze parameter preferences (requires recent usage events)
    stmt = select(ToolUsage).where(
        ToolUsage.user_id == user_id
    ).order_by(desc(ToolUsage.created_at)).limit(50)
    result = await session.execute(stmt)
    recent_events = result.scalars().all()

    if recent_events:
        # Extract common parameters
        param_counts = {}
        for event in recent_events:
            if event.parameters:
                for key, value in event.parameters.items():
                    if key not in param_counts:
                        param_counts[key] = Counter()
                    # Only track simple values (strings, numbers, bools)
                    if isinstance(value, (str, int, float, bool)):
                        param_counts[key][str(value)] += 1

        # Record most common parameter values
        for param_key, counter in param_counts.items():
            if counter:
                most_common = counter.most_common(1)[0]
                patterns[f"typical_{param_key}"] = most_common[0]

    # Calculate overall success rate
    total_success = sum(t.get("success_count", 0) for t in tool_usage.values())
    total_count = sum(t.get("count", 0) for t in tool_usage.values())
    if total_count > 0:
        patterns["overall_success_rate"] = total_success / total_count

    user_prefs.patterns = patterns
    return patterns


# ========================================
# User Preferences
# ========================================

async def get_user_preferences(
    session: AsyncSession,
    user_id: UUID
) -> Optional[GetUserPreferencesResponse]:
    """
    Get user preferences and patterns.

    Args:
        session: Database session
        user_id: User ID

    Returns:
        User preferences or None
    """
    stmt = select(UserPreferences).where(UserPreferences.user_id == user_id)
    result = await session.execute(stmt)
    user_prefs = result.scalar_one_or_none()

    if not user_prefs:
        return None

    return GetUserPreferencesResponse(
        user_id=user_prefs.user_id,
        tool_usage=user_prefs.tool_usage,
        patterns=user_prefs.patterns,
        preferences=user_prefs.preferences,
        updated_at=user_prefs.updated_at
    )


async def update_user_preferences(
    session: AsyncSession,
    request: UpdateUserPreferencesRequest
) -> GetUserPreferencesResponse:
    """
    Update user UI/UX preferences.

    Args:
        session: Database session
        request: Update request

    Returns:
        Updated preferences
    """
    # Get or create user preferences
    stmt = select(UserPreferences).where(UserPreferences.user_id == request.user_id)
    result = await session.execute(stmt)
    user_prefs = result.scalar_one_or_none()

    if not user_prefs:
        user_prefs = UserPreferences(
            user_id=request.user_id,
            tool_usage={},
            patterns={},
            preferences=request.preferences
        )
        session.add(user_prefs)
    else:
        # Merge preferences
        existing_prefs = user_prefs.preferences or {}
        existing_prefs.update(request.preferences)
        user_prefs.preferences = existing_prefs
        user_prefs.updated_at = datetime.utcnow()

    await session.flush()

    return GetUserPreferencesResponse(
        user_id=user_prefs.user_id,
        tool_usage=user_prefs.tool_usage,
        patterns=user_prefs.patterns,
        preferences=user_prefs.preferences,
        updated_at=user_prefs.updated_at
    )


# ========================================
# Adaptive Recommendations
# ========================================

async def get_recommendations(
    session: AsyncSession,
    request: GetRecommendationsRequest
) -> GetRecommendationsResponse:
    """
    Generate adaptive recommendations based on user patterns.

    Suggests:
    - Tools to use based on context
    - Parameter values based on history
    - Workflow optimizations

    Args:
        session: Database session
        request: Recommendations request

    Returns:
        Recommendations response
    """
    # Get user preferences
    stmt = select(UserPreferences).where(UserPreferences.user_id == request.user_id)
    result = await session.execute(stmt)
    user_prefs = result.scalar_one_or_none()

    if not user_prefs:
        return GetRecommendationsResponse(
            user_id=request.user_id,
            recommendations=[],
            based_on={}
        )

    recommendations = []
    tool_usage = user_prefs.tool_usage or {}
    patterns = user_prefs.patterns or {}

    # Recommend frequently used tools
    if tool_usage:
        sorted_tools = sorted(
            tool_usage.items(),
            key=lambda x: x[1].get("count", 0),
            reverse=True
        )

        for tool_name, stats in sorted_tools[:3]:
            if stats.get("success_rate", 0) > 0.8:
                recommendations.append({
                    "type": "tool",
                    "tool_name": tool_name,
                    "reason": f"You frequently use this tool with {stats['success_rate']:.0%} success",
                    "confidence": min(0.5 + (stats["count"] / 100), 0.95),
                    "usage_count": stats["count"]
                })

    # Recommend parameter values based on patterns
    for key, value in patterns.items():
        if key.startswith("typical_"):
            param_name = key.replace("typical_", "")
            recommendations.append({
                "type": "parameter",
                "parameter": param_name,
                "suggested_value": value,
                "reason": "Your most common choice",
                "confidence": 0.85
            })

    # Context-specific recommendations
    if request.context:
        context_recommendations = _get_context_recommendations(
            request.context,
            tool_usage,
            patterns
        )
        recommendations.extend(context_recommendations)

    # Get usage statistics for "based_on"
    stmt = select(func.count(ToolUsage.id)).where(ToolUsage.user_id == request.user_id)
    result = await session.execute(stmt)
    total_events = result.scalar() or 0

    # Calculate days active
    stmt = select(
        func.min(ToolUsage.created_at),
        func.max(ToolUsage.created_at)
    ).where(ToolUsage.user_id == request.user_id)
    result = await session.execute(stmt)
    date_row = result.first()

    days_active = 0
    if date_row and date_row[0] and date_row[1]:
        days_active = (date_row[1] - date_row[0]).days + 1

    based_on = {
        "tool_usage_events": total_events,
        "success_rate": patterns.get("overall_success_rate", 0),
        "days_active": days_active,
        "unique_tools_used": len(tool_usage)
    }

    return GetRecommendationsResponse(
        user_id=request.user_id,
        recommendations=recommendations,
        based_on=based_on
    )


def _get_context_recommendations(
    context: str,
    tool_usage: Dict,
    patterns: Dict
) -> List[Dict]:
    """
    Get context-specific recommendations.

    Args:
        context: Current context ("reading", "searching", etc.)
        tool_usage: Tool usage statistics
        patterns: Learned patterns

    Returns:
        List of recommendations
    """
    recommendations = []

    # Context-based tool suggestions
    context_tools = {
        "reading": ["read_quantum", "measure_povm"],
        "searching": ["search_chunks", "search_chatgpt"],
        "analyzing": ["get_connections", "get_archive_stats"],
    }

    if context in context_tools:
        for tool_name in context_tools[context]:
            if tool_name in tool_usage:
                stats = tool_usage[tool_name]
                if stats.get("success_rate", 0) > 0.7:
                    recommendations.append({
                        "type": "contextual_tool",
                        "tool_name": tool_name,
                        "reason": f"Commonly used during {context}",
                        "confidence": 0.75,
                        "context": context
                    })

    return recommendations


# ========================================
# Tool Usage Statistics
# ========================================

async def get_tool_usage_stats(
    session: AsyncSession,
    user_id: UUID,
    limit: int = 10
) -> ToolUsageStatsResponse:
    """
    Get comprehensive tool usage statistics.

    Args:
        session: Database session
        user_id: User ID
        limit: Number of recent events to include

    Returns:
        Tool usage statistics
    """
    # Get user preferences (aggregated stats)
    stmt = select(UserPreferences).where(UserPreferences.user_id == user_id)
    result = await session.execute(stmt)
    user_prefs = result.scalar_one_or_none()

    if not user_prefs:
        return ToolUsageStatsResponse(
            user_id=user_id,
            total_tool_calls=0,
            success_rate=0.0,
            most_used_tools=[],
            recent_activity=[]
        )

    tool_usage = user_prefs.tool_usage or {}

    # Calculate totals
    total_tool_calls = sum(t.get("count", 0) for t in tool_usage.values())
    total_success = sum(t.get("success_count", 0) for t in tool_usage.values())
    success_rate = total_success / total_tool_calls if total_tool_calls > 0 else 0.0

    # Sort tools by usage
    most_used_tools = [
        {
            "tool_name": tool_name,
            "count": stats["count"],
            "success_rate": stats.get("success_rate", 0),
            "avg_execution_time_ms": stats.get("avg_execution_time_ms", 0)
        }
        for tool_name, stats in sorted(
            tool_usage.items(),
            key=lambda x: x[1].get("count", 0),
            reverse=True
        )[:5]
    ]

    # Get recent activity
    stmt = select(ToolUsage).where(
        ToolUsage.user_id == user_id
    ).order_by(desc(ToolUsage.created_at)).limit(limit)
    result = await session.execute(stmt)
    recent_events = result.scalars().all()

    recent_activity = [
        {
            "tool_name": event.tool_name,
            "success": event.success,
            "execution_time_ms": event.execution_time_ms,
            "created_at": event.created_at,
            "context": event.context
        }
        for event in recent_events
    ]

    return ToolUsageStatsResponse(
        user_id=user_id,
        total_tool_calls=total_tool_calls,
        success_rate=success_rate,
        most_used_tools=most_used_tools,
        recent_activity=recent_activity
    )
