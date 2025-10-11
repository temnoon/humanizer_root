"""
User models - User preferences and AUI adaptive learning data

Tracks user patterns for adaptive interface.
"""

from datetime import datetime
from uuid import uuid4
from sqlalchemy import Column, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from humanizer.database import Base


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

    def __repr__(self) -> str:
        return f"<UserPreferences user_id={self.user_id}>"
