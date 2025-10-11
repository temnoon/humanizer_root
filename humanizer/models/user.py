"""
User models - User preferences and AUI adaptive learning data

Tracks user patterns for adaptive interface.
"""

from datetime import datetime
from uuid import UUID, uuid4
from sqlalchemy import Column, DateTime, String, Float, Boolean, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from humanizer.database import Base


class ToolUsage(Base):
    """
    Individual tool usage event tracking.

    Records every tool call for adaptive learning.
    Used to build user patterns and preferences.

    Attributes:
        id: Event ID
        user_id: User who invoked the tool
        tool_name: Tool name (e.g., "read_quantum", "search_chunks")
        parameters: Tool parameters (JSONB)
        success: Whether tool succeeded
        execution_time_ms: Execution time in milliseconds
        error_message: Error message if failed
        context: Additional context (e.g., "from_mcp", "from_web")
        created_at: When tool was invoked
    """
    __tablename__ = "tool_usage"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("user_preferences.user_id"), nullable=False, index=True)
    tool_name = Column(String(100), nullable=False, index=True)
    parameters = Column(JSONB, nullable=True)
    success = Column(Boolean, nullable=False, default=True)
    execution_time_ms = Column(Float, nullable=True)
    error_message = Column(Text, nullable=True)
    context = Column(JSONB, nullable=True)  # {source: "mcp", session_id: "..."}
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    # Relationship
    user = relationship("UserPreferences", back_populates="usage_events")

    def __repr__(self) -> str:
        status = "✓" if self.success else "✗"
        return f"<ToolUsage {status} {self.tool_name} user={self.user_id}>"


class UserPreferences(Base):
    """
    User preferences and adaptive learning data.

    Tracks:
    - Tool usage statistics (which tools used, success rates)
    - Learned patterns (what helps this user)
    - UI preferences (dark mode, etc.)

    Attributes:
        user_id: User ID (primary key)
        tool_usage: Tool usage statistics
        patterns: Learned usage patterns
        preferences: UI/UX preferences
        updated_at: Last update time
    """
    __tablename__ = "user_preferences"

    user_id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Tool usage: {tool_name: {count: N, success_rate: 0.85, ...}}
    tool_usage = Column(JSONB, nullable=True)

    # Learned patterns: {frequent_povm: "tetralemma", prefers_corner: "both", ...}
    patterns = Column(JSONB, nullable=True)

    # UI preferences: {dark_mode: true, show_trajectories: true, ...}
    preferences = Column(JSONB, nullable=True)

    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    usage_events = relationship("ToolUsage", back_populates="user", cascade="all, delete-orphan")
    interests = relationship("Interest", back_populates="user", cascade="all, delete-orphan")
    interest_tags = relationship("InterestTag", back_populates="user", cascade="all, delete-orphan")
    interest_lists = relationship("InterestList", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<UserPreferences user_id={self.user_id}>"
