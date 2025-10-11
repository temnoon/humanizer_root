"""
Interest tracking models - The Turing Tape of Attention

These models track what the user+AI system finds interesting:
- Interest: A moment of attention (Now → Next)
- InterestTag: User-created tags for grouping interests

Philosophy: "Make me smarter by helping me know my actual subjective self."

The Interest list is consciousness work - tracking attention flow,
learning what we really want, and becoming smarter about being interested.
"""

from datetime import datetime
from uuid import UUID, uuid4
from sqlalchemy import Column, String, Text, Integer, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import relationship

from humanizer.database import Base


class Interest(Base):
    """
    A moment of interest - what the user+AI system is attending to.

    The Interest list is our Turing tape of attention.
    Each interest is a moment (Now) that leads to Next.

    Structure: Interest₁ → Interest₂ → Interest₃ → ... → Interestₙ

    For each moment, we track:
    1. What caught our attention (target)
    2. Why it seemed interesting (moment_text, salience_score)
    3. What we discovered (advantages, disadvantages)
    4. Whether it was worth it (realized_value)
    5. Whether to prune similar interests (pruned, prune_reason)

    Over time, we learn what we really want vs. what initially seems interesting.

    Attributes:
        id: Unique identifier
        user_id: Who is interested
        interest_type: Type of thing we're interested in
        target_uuid: Points to the specific thing (conversation, message, etc.)
        target_metadata: Copy of key metadata about target
        moment_text: Why we found this interesting
        stance: TRM stance at this moment (if applicable)
        context_snapshot: What was going on when we got interested
        previous_interest_id: Previous moment on the tape
        next_interest_id: Next moment on the tape
        salience_score: How important did this seem initially? (0-1)
        predicted_value: How valuable did we think it would be?
        advantages: What benefits did exploring this yield?
        disadvantages: What costs did it impose?
        realized_value: Looking back, was it worth it? (0-1)
        value_notes: Why was it valuable/not valuable?
        created_at: When we got interested
        explored_at: When we started exploring
        resolved_at: When we finished/learned the value
        duration_seconds: How long did we spend on this?
        pruned: Should we ignore this type of interest?
        prune_reason: Why did we prune it?
        pruned_at: When did we prune it?
    """
    __tablename__ = "interests"

    # Identity
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("user_preferences.user_id"), nullable=False, index=True)

    # What are we interested in?
    interest_type = Column(String(50), nullable=False, index=True)
    # Types: 'conversation', 'message', 'reading', 'concept', 'question',
    #        'transformation', 'pattern', 'connection', 'media', 'custom'

    target_uuid = Column(PG_UUID(as_uuid=True), nullable=True, index=True)
    target_metadata = Column(JSONB, nullable=False, default=dict)

    # The subjective moment
    moment_text = Column(Text, nullable=True)
    stance = Column(JSONB, nullable=True)  # TRM stance (tetralemma, tone, etc.)
    context_snapshot = Column(JSONB, nullable=True)

    # The Turing tape structure
    previous_interest_id = Column(PG_UUID(as_uuid=True), ForeignKey("interests.id"), nullable=True, index=True)
    next_interest_id = Column(PG_UUID(as_uuid=True), ForeignKey("interests.id"), nullable=True, index=True)

    # Initial assessment
    salience_score = Column(Float, nullable=False, default=0.5)  # How important did this seem? (0-1)
    predicted_value = Column(Float, nullable=True)  # How valuable did we think it would be? (0-1)

    # Learning what we want (updated as we go)
    advantages = Column(JSONB, nullable=False, default=list)  # List of advantage strings
    disadvantages = Column(JSONB, nullable=False, default=list)  # List of disadvantage strings
    realized_value = Column(Float, nullable=True)  # Did it pay off? (0-1, null until resolved)
    value_notes = Column(Text, nullable=True)

    # Temporal tracking
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    explored_at = Column(DateTime, nullable=True)  # When did we start exploring?
    resolved_at = Column(DateTime, nullable=True)  # When did we finish?
    duration_seconds = Column(Integer, nullable=True)  # How long did we spend?

    # Pruning (learning what not to attend to)
    pruned = Column(Boolean, nullable=False, default=False, index=True)
    prune_reason = Column(Text, nullable=True)
    pruned_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("UserPreferences", back_populates="interests")
    tags = relationship("InterestTag", back_populates="interest", cascade="all, delete-orphan")

    # Self-referential relationships (Turing tape)
    previous_interest = relationship(
        "Interest",
        remote_side=[id],
        foreign_keys=[previous_interest_id],
        backref="following_interests",
        uselist=False
    )

    def __repr__(self) -> str:
        return f"<Interest id={self.id} type={self.interest_type} salience={self.salience_score:.2f}>"

    @property
    def is_current(self) -> bool:
        """Is this the current moment (Now)?"""
        return self.next_interest_id is None and not self.pruned and self.resolved_at is None

    @property
    def was_valuable(self) -> bool | None:
        """Was this interest worth pursuing? (None if not yet resolved)"""
        if self.realized_value is None:
            return None
        return self.realized_value > 0.5

    @property
    def net_value(self) -> float | None:
        """Net value: advantages - disadvantages"""
        if self.realized_value is None:
            return None

        adv_count = len(self.advantages) if self.advantages else 0
        dis_count = len(self.disadvantages) if self.disadvantages else 0

        # Weight by realized value
        return self.realized_value * adv_count - (1 - self.realized_value) * dis_count


class InterestTag(Base):
    """
    Tags for grouping interests by theme/category.

    User-created, evolving vocabulary for organizing attention patterns.

    Attributes:
        id: Unique identifier
        user_id: Who created this tag
        interest_id: Which interest this tags
        tag: The tag text (lowercase, normalized)
        created_at: When was this tagged
        tag_salience: How important is this tag overall?
    """
    __tablename__ = "interest_tags"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("user_preferences.user_id"), nullable=False, index=True)
    interest_id = Column(PG_UUID(as_uuid=True), ForeignKey("interests.id"), nullable=False, index=True)

    tag = Column(String(100), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Track tag evolution
    tag_salience = Column(Float, nullable=True)  # Overall importance of this tag (0-1)

    # Relationships
    user = relationship("UserPreferences", back_populates="interest_tags")
    interest = relationship("Interest", back_populates="tags")

    def __repr__(self) -> str:
        return f"<InterestTag tag='{self.tag}' interest={self.interest_id}>"
