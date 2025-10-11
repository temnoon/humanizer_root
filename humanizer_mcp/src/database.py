"""SQLite database schema and operations for Humanizer MCP."""

from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Text,
    func
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime
import json

from src.config import SQLITE_PATH, SQLITE_ECHO

Base = declarative_base()


class InterestItem(Base):
    """Items marked as interesting (breadcrumbs + wishlist)."""
    __tablename__ = "interest_list"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    item_type = Column(String, nullable=False)  # 'narrative', 'chunk', 'phrase', etc.
    item_id = Column(String, nullable=False)
    title = Column(String)
    marked_at = Column(DateTime, default=datetime.utcnow)
    context = Column(Text)  # What were you doing when you marked this?
    connection_from_id = Column(Integer, ForeignKey("interest_list.id"), nullable=True)

    # Note: metadata_ not metadata (reserved word in SQLAlchemy)
    metadata_ = Column(Text)  # JSON for flexible data

    # Relationship for breadcrumb chain
    previous_item = relationship("InterestItem", remote_side=[id], backref="next_items")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "item_type": self.item_type,
            "item_id": self.item_id,
            "title": self.title,
            "marked_at": self.marked_at.isoformat(),
            "context": self.context,
            "connection_from_id": self.connection_from_id,
            "metadata": json.loads(self.metadata_) if self.metadata_ else {}
        }


class Connection(Base):
    """Graph of transformations between entities (functors)."""
    __tablename__ = "connections"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    source_type = Column(String, nullable=False)
    source_id = Column(String, nullable=False)
    target_type = Column(String, nullable=False)
    target_id = Column(String, nullable=False)
    transformation = Column(String, nullable=False)  # 'quantum_read', 'search_similar', etc.
    created_at = Column(DateTime, default=datetime.utcnow)

    # Note: metadata_ not metadata (SQLAlchemy reserved)
    metadata_ = Column(Text)  # JSON

    def to_dict(self):
        return {
            "id": self.id,
            "source": f"{self.source_type}:{self.source_id}",
            "target": f"{self.target_type}:{self.target_id}",
            "transformation": self.transformation,
            "created_at": self.created_at.isoformat(),
            "metadata": json.loads(self.metadata_) if self.metadata_ else {}
        }


class UsagePattern(Base):
    """Track tool usage for teaching/adaptive learning."""
    __tablename__ = "usage_patterns"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    tool_name = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    success = Column(Integer, default=1)  # 1 = success, 0 = error
    context = Column(Text)  # What was happening

    # Note: metadata_ not metadata
    metadata_ = Column(Text)  # JSON

    def to_dict(self):
        return {
            "id": self.id,
            "tool_name": self.tool_name,
            "timestamp": self.timestamp.isoformat(),
            "success": bool(self.success),
            "metadata": json.loads(self.metadata_) if self.metadata_ else {}
        }


# Database engine and session
engine = create_engine(f"sqlite:///{SQLITE_PATH}", echo=SQLITE_ECHO)
SessionLocal = sessionmaker(bind=engine)


def init_database():
    """Initialize database (create tables)."""
    Base.metadata.create_all(engine)
    print(f"✓ Database initialized: {SQLITE_PATH}")


def get_session():
    """Get database session."""
    return SessionLocal()


# Helper functions

def add_interest_item(
    user_id: str,
    item_type: str,
    item_id: str,
    title: str = None,
    context: str = None,
    connection_from_id: int = None,
    metadata: dict = None
):
    """Add item to interest list."""
    session = get_session()
    try:
        item = InterestItem(
            user_id=user_id,
            item_type=item_type,
            item_id=item_id,
            title=title,
            context=context,
            connection_from_id=connection_from_id,
            metadata_=json.dumps(metadata) if metadata else None
        )
        session.add(item)
        session.commit()
        result = item.to_dict()
        return result
    finally:
        session.close()


def get_interest_list(user_id: str, limit: int = 50):
    """Get user's interest list."""
    session = get_session()
    try:
        items = session.query(InterestItem).filter_by(
            user_id=user_id
        ).order_by(
            InterestItem.marked_at.desc()
        ).limit(limit).all()

        return [item.to_dict() for item in items]
    finally:
        session.close()


def add_connection(
    user_id: str,
    source_type: str,
    source_id: str,
    target_type: str,
    target_id: str,
    transformation: str,
    metadata: dict = None
):
    """Record a connection (transformation between entities)."""
    session = get_session()
    try:
        conn = Connection(
            user_id=user_id,
            source_type=source_type,
            source_id=source_id,
            target_type=target_type,
            target_id=target_id,
            transformation=transformation,
            metadata_=json.dumps(metadata) if metadata else None
        )
        session.add(conn)
        session.commit()
        return conn.to_dict()
    finally:
        session.close()


def get_connections(user_id: str, item_type: str = None, item_id: str = None, limit: int = 100):
    """Get connections, optionally filtered by source or target."""
    session = get_session()
    try:
        query = session.query(Connection).filter_by(user_id=user_id)

        if item_type and item_id:
            # Get all connections involving this item (as source or target)
            query = query.filter(
                ((Connection.source_type == item_type) & (Connection.source_id == item_id)) |
                ((Connection.target_type == item_type) & (Connection.target_id == item_id))
            )

        connections = query.order_by(Connection.created_at.desc()).limit(limit).all()
        return [conn.to_dict() for conn in connections]
    finally:
        session.close()


def record_usage(
    user_id: str,
    tool_name: str,
    success: bool = True,
    context: str = None,
    metadata: dict = None
):
    """Record tool usage for teaching/adaptive learning."""
    session = get_session()
    try:
        usage = UsagePattern(
            user_id=user_id,
            tool_name=tool_name,
            success=1 if success else 0,
            context=context,
            metadata_=json.dumps(metadata) if metadata else None
        )
        session.add(usage)
        session.commit()
    finally:
        session.close()


def get_usage_stats(user_id: str, tool_name: str = None):
    """Get usage statistics for teaching."""
    session = get_session()
    try:
        query = session.query(
            UsagePattern.tool_name,
            func.count(UsagePattern.id).label('count'),
            func.sum(UsagePattern.success).label('successes')
        ).filter_by(user_id=user_id)

        if tool_name:
            query = query.filter_by(tool_name=tool_name)

        stats = query.group_by(UsagePattern.tool_name).all()

        return [
            {
                "tool": stat.tool_name,
                "uses": stat.count,
                "successes": stat.successes,
                "success_rate": stat.successes / stat.count if stat.count > 0 else 0
            }
            for stat in stats
        ]
    finally:
        session.close()
