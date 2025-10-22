"""
Storage Factory

Creates appropriate storage backend based on configuration.

Vision: Pluggable storage = user controls their data.
"""

from humanizer.config import settings
from humanizer.adapters.storage.base import (
    ConversationStorage,
    DocumentStorage,
    TransformationStorage
)


def create_storage() -> tuple:
    """
    Create storage backends based on configuration.

    Returns:
        Tuple of (conversation_storage, document_storage, transformation_storage)
    """
    backend = settings.storage_backend

    if backend == "postgres":
        # Import only when needed (avoids circular imports)
        # Note: PostgreSQL implementation to be created in Phase 1
        try:
            from humanizer.adapters.storage.postgres import (
                PostgresConversationStorage,
                PostgresDocumentStorage,
                PostgresTransformationStorage
            )
            return (
                PostgresConversationStorage(),
                PostgresDocumentStorage(),
                PostgresTransformationStorage()
            )
        except ImportError:
            # Fallback to ephemeral if postgres adapter not yet implemented
            from humanizer.adapters.storage.ephemeral import EphemeralStorage
            storage = EphemeralStorage()
            return (storage, storage, storage)

    elif backend == "sqlite":
        # Note: SQLite implementation to be created in Phase 1
        try:
            from humanizer.adapters.storage.sqlite import (
                SQLiteConversationStorage,
                SQLiteDocumentStorage,
                SQLiteTransformationStorage
            )
            return (
                SQLiteConversationStorage(settings.sqlite_path),
                SQLiteDocumentStorage(settings.sqlite_path),
                SQLiteTransformationStorage(settings.sqlite_path)
            )
        except ImportError:
            # Fallback to ephemeral if sqlite adapter not yet implemented
            from humanizer.adapters.storage.ephemeral import EphemeralStorage
            storage = EphemeralStorage()
            return (storage, storage, storage)

    elif backend == "ephemeral":
        from humanizer.adapters.storage.ephemeral import EphemeralStorage
        storage = EphemeralStorage()
        return (storage, storage, storage)

    else:
        raise ValueError(f"Unknown storage backend: {backend}")


# Singleton instances
_conversation_storage = None
_document_storage = None
_transformation_storage = None


def get_conversation_storage() -> ConversationStorage:
    """Get conversation storage singleton"""
    global _conversation_storage
    if _conversation_storage is None:
        _conversation_storage, _, _ = create_storage()
    return _conversation_storage


def get_document_storage() -> DocumentStorage:
    """Get document storage singleton"""
    global _document_storage
    if _document_storage is None:
        _, _document_storage, _ = create_storage()
    return _document_storage


def get_transformation_storage() -> TransformationStorage:
    """Get transformation storage singleton"""
    global _transformation_storage
    if _transformation_storage is None:
        _, _, _transformation_storage = create_storage()
    return _transformation_storage


def reset_storage():
    """Reset storage singletons (for testing)"""
    global _conversation_storage, _document_storage, _transformation_storage
    _conversation_storage = None
    _document_storage = None
    _transformation_storage = None


__all__ = [
    "ConversationStorage",
    "DocumentStorage",
    "TransformationStorage",
    "create_storage",
    "get_conversation_storage",
    "get_document_storage",
    "get_transformation_storage",
    "reset_storage",
]
