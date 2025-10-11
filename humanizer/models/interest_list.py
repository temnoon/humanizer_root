"""
Interest List models - User-managed collections of attention

These models let users organize and plan what they want to explore:
- InterestList: Named collections ("Reading Queue", "Research Ideas", etc.)
- InterestListItem: Items in a list with ordering
- InterestListBranch: Track when lists fork from other lists

Philosophy: "Make me smarter by helping me know my actual subjective self."

Key differences from Interest (activity log):
- Interest = Immutable history (what you actually looked at)
- InterestList = Mutable planning (what you want to explore)

The Interest system tracks what happened.
The InterestList system organizes what's next.
"""

from datetime import datetime
from uuid import UUID, uuid4
from sqlalchemy import Column, String, Text, Integer, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import relationship

from humanizer.database import Base


class InterestList(Base):
    """
    A user-managed collection of things to explore.

    Lists are like playlists for attention - user can:
    - Add/remove items
    - Reorder items
    - Branch lists in different directions
    - Share lists
    - Track progress through lists

    Examples:
    - "Reading Queue" - conversations/messages to read
    - "Research Ideas" - topics to explore
    - "Media Gallery" - images to examine
    - "Transformation Pipeline" - changes to apply

    Attributes:
        id: Unique identifier
        user_id: Who owns this list
        name: List name
        description: What is this list for?
        list_type: Category ('reading', 'research', 'media', 'transformation', 'custom')
        status: Current state ('active', 'archived', 'completed')
        custom_metadata: Flexible metadata (JSONB)
        current_position: Where are we in the list? (index)
        created_at: When was this list created
        updated_at: Last modification
        completed_at: When was this list finished?
        is_public: Can others see this list?
        parent_list_id: If branched from another list
        branched_at_position: Position in parent where branch occurred
    """
    __tablename__ = "interest_lists"

    # Identity
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("user_preferences.user_id"), nullable=False, index=True)

    # List properties
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    list_type = Column(String(50), nullable=False, default='custom', index=True)
    # Types: 'reading', 'research', 'media', 'transformation', 'custom'

    status = Column(String(20), nullable=False, default='active', index=True)
    # Status: 'active', 'archived', 'completed'

    custom_metadata = Column(JSONB, nullable=False, default=dict)

    # Navigation
    current_position = Column(Integer, nullable=False, default=0)  # Index of current item

    # Temporal tracking
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Sharing
    is_public = Column(Boolean, nullable=False, default=False)

    # Branching
    parent_list_id = Column(PG_UUID(as_uuid=True), ForeignKey("interest_lists.id"), nullable=True, index=True)
    branched_at_position = Column(Integer, nullable=True)  # Position in parent where branch occurred

    # Relationships
    user = relationship("UserPreferences", back_populates="interest_lists")
    items = relationship("InterestListItem", back_populates="interest_list", cascade="all, delete-orphan", order_by="InterestListItem.position")
    branches = relationship("InterestListBranch", foreign_keys="InterestListBranch.source_list_id", back_populates="source_list", cascade="all, delete-orphan")

    # Self-referential for parent
    parent_list = relationship(
        "InterestList",
        remote_side=[id],
        foreign_keys=[parent_list_id],
        backref="child_lists",
        uselist=False
    )

    def __repr__(self) -> str:
        return f"<InterestList id={self.id} name='{self.name}' items={len(self.items)}>"

    @property
    def current_item(self) -> 'InterestListItem | None':
        """Get the current item (at current_position)."""
        if not self.items or self.current_position >= len(self.items):
            return None
        return self.items[self.current_position]

    @property
    def progress_pct(self) -> float:
        """Progress through the list (0-100%)."""
        if not self.items:
            return 100.0
        return (self.current_position / len(self.items)) * 100.0

    @property
    def is_complete(self) -> bool:
        """Has user finished this list?"""
        return self.current_position >= len(self.items) or self.status == 'completed'


class InterestListItem(Base):
    """
    An item in an interest list - polymorphic reference to any object.

    Items can point to:
    - Conversations
    - Messages
    - Readings
    - Media files
    - Transformations
    - Custom content
    - Anything with a UUID!

    Attributes:
        id: Unique identifier
        list_id: Which list does this belong to
        user_id: Who added this item
        position: Order in the list (0-indexed, user can reorder)
        item_type: Type of thing ('conversation', 'message', 'reading', 'media', etc.)
        item_uuid: UUID of the actual object
        item_metadata: Cached metadata (title, preview, etc.) for quick display
        notes: User's notes about this item
        status: Item state ('pending', 'current', 'completed', 'skipped')
        completed_at: When was this item finished?
        added_at: When was this added to the list
        custom_metadata: Flexible metadata (JSONB)
    """
    __tablename__ = "interest_list_items"

    # Identity
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    list_id = Column(PG_UUID(as_uuid=True), ForeignKey("interest_lists.id"), nullable=False, index=True)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("user_preferences.user_id"), nullable=False, index=True)

    # Ordering
    position = Column(Integer, nullable=False, index=True)

    # Polymorphic reference
    item_type = Column(String(50), nullable=False, index=True)
    # Types: 'conversation', 'message', 'reading', 'media', 'transformation',
    #        'book', 'chunk', 'interest', 'custom'

    item_uuid = Column(PG_UUID(as_uuid=True), nullable=True, index=True)
    item_metadata = Column(JSONB, nullable=False, default=dict)

    # User annotation
    notes = Column(Text, nullable=True)

    # Status tracking
    status = Column(String(20), nullable=False, default='pending', index=True)
    # Status: 'pending', 'current', 'completed', 'skipped'

    completed_at = Column(DateTime, nullable=True)
    added_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Flexible metadata
    custom_metadata = Column(JSONB, nullable=False, default=dict)

    # Relationships
    interest_list = relationship("InterestList", back_populates="items")
    user = relationship("UserPreferences")

    def __repr__(self) -> str:
        return f"<InterestListItem id={self.id} type={self.item_type} pos={self.position}>"

    @property
    def is_completed(self) -> bool:
        """Has this item been completed?"""
        return self.status == 'completed'


class InterestListBranch(Base):
    """
    Track when an interest list branches from another.

    Branching allows exploring alternative paths:
    - Try different reading orders
    - Explore alternative interpretations
    - A/B test different approaches

    Attributes:
        id: Unique identifier
        user_id: Who created this branch
        source_list_id: Original list
        branch_list_id: New branched list
        branch_position: Position in source where branch occurred
        branch_reason: Why did we branch?
        created_at: When was this branch created
        custom_metadata: Flexible metadata (JSONB)
    """
    __tablename__ = "interest_list_branches"

    # Identity
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("user_preferences.user_id"), nullable=False, index=True)

    # Branch relationship
    source_list_id = Column(PG_UUID(as_uuid=True), ForeignKey("interest_lists.id"), nullable=False, index=True)
    branch_list_id = Column(PG_UUID(as_uuid=True), ForeignKey("interest_lists.id"), nullable=False, index=True)

    # Branch metadata
    branch_position = Column(Integer, nullable=False)  # Position in source where branch occurred
    branch_reason = Column(Text, nullable=True)

    # Temporal
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Flexible metadata
    custom_metadata = Column(JSONB, nullable=False, default=dict)

    # Relationships
    user = relationship("UserPreferences")
    source_list = relationship("InterestList", foreign_keys=[source_list_id], back_populates="branches")
    branch_list = relationship("InterestList", foreign_keys=[branch_list_id])

    def __repr__(self) -> str:
        return f"<InterestListBranch source={self.source_list_id} branch={self.branch_list_id} pos={self.branch_position}>"
