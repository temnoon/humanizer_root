"""
Custom SQLAlchemy Types for Cross-Database Compatibility

Provides type decorators that work across PostgreSQL, SQLite, and other databases.
"""

import json
from typing import Any
from sqlalchemy import TypeDecorator, Text
from sqlalchemy.dialects.postgresql import JSONB as PostgresJSONB


class JSONBCompat(TypeDecorator):
    """
    Cross-database JSON type that uses JSONB for PostgreSQL and JSON/TEXT for others.

    This allows models to use a single type that works across:
    - PostgreSQL: Uses JSONB for efficient querying
    - SQLite: Uses TEXT with JSON serialization
    - Other databases: Falls back to TEXT with JSON

    Usage:
        from humanizer.database.custom_types import JSONBCompat

        class MyModel(Base):
            data = Column(JSONBCompat, nullable=True)
    """

    impl = Text  # Fallback implementation (for SQLite and others)
    cache_ok = True  # Enable caching for this type

    def load_dialect_impl(self, dialect):
        """
        Return the appropriate implementation for the dialect.

        For PostgreSQL, use JSONB. For others, use Text.
        """
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PostgresJSONB())
        else:
            return dialect.type_descriptor(Text())

    def process_bind_param(self, value: Any, dialect) -> str:
        """
        Convert Python dict/list to database format.

        For PostgreSQL (JSONB), SQLAlchemy handles this.
        For SQLite/others, we need to serialize to JSON string.
        """
        if value is None:
            return value

        if dialect.name != "postgresql":
            # For non-PostgreSQL, serialize to JSON string
            return json.dumps(value)

        # For PostgreSQL, return as-is (JSONB type handles it)
        return value

    def process_result_value(self, value: Any, dialect) -> Any:
        """
        Convert database format to Python dict/list.

        For PostgreSQL (JSONB), SQLAlchemy handles this.
        For SQLite/others, we need to deserialize from JSON string.
        """
        if value is None:
            return value

        if dialect.name != "postgresql":
            # For non-PostgreSQL, deserialize from JSON string
            if isinstance(value, str):
                return json.loads(value)
            return value

        # For PostgreSQL, return as-is (JSONB type handles it)
        return value
