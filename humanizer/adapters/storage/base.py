"""
Storage Backend Protocol

Defines interface that all storage adapters must implement.
Enables pluggable backends: PostgreSQL, SQLite, ephemeral, etc.

Vision: User owns their data, storage is their choice.
"""

from typing import Protocol, Optional, List, runtime_checkable
from uuid import UUID
from datetime import datetime


@runtime_checkable
class ConversationStorage(Protocol):
    """
    Protocol for conversation storage backends.

    Implementations:
    - PostgresStorage: Full-featured, for desktop/server
    - SQLiteStorage: Lightweight, for mobile/desktop
    - EphemeralStorage: In-memory only, for web service
    """

    async def save_conversation(
        self,
        user_id: UUID,
        title: str,
        messages: List[dict],
        metadata: Optional[dict] = None
    ) -> UUID:
        """
        Save conversation and return ID.

        Args:
            user_id: Owner of conversation
            title: Conversation title
            messages: List of messages (role + content)
            metadata: Optional metadata

        Returns:
            UUID of saved conversation
        """
        ...

    async def get_conversation(
        self,
        conversation_id: UUID
    ) -> Optional[dict]:
        """
        Retrieve conversation by ID.

        Returns:
            Conversation dict or None if not found
        """
        ...

    async def list_conversations(
        self,
        user_id: UUID,
        limit: int = 50,
        offset: int = 0
    ) -> List[dict]:
        """List user's conversations (paginated)"""
        ...

    async def search_conversations(
        self,
        user_id: UUID,
        query: str,
        limit: int = 10
    ) -> List[dict]:
        """Semantic search across user's conversations"""
        ...

    async def delete_conversation(
        self,
        conversation_id: UUID
    ) -> bool:
        """Delete conversation, return True if deleted"""
        ...


@runtime_checkable
class DocumentStorage(Protocol):
    """Protocol for document storage"""

    async def save_document(
        self,
        user_id: UUID,
        title: str,
        content: str,
        metadata: Optional[dict] = None
    ) -> UUID:
        """Save document and return ID"""
        ...

    async def get_document(
        self,
        document_id: UUID
    ) -> Optional[dict]:
        """Retrieve document by ID"""
        ...

    async def list_documents(
        self,
        user_id: UUID,
        limit: int = 50,
        offset: int = 0
    ) -> List[dict]:
        """List user's documents"""
        ...

    async def search_documents(
        self,
        user_id: UUID,
        query: str,
        limit: int = 10
    ) -> List[dict]:
        """Semantic search across user's documents"""
        ...

    async def delete_document(
        self,
        document_id: UUID
    ) -> bool:
        """Delete document, return True if deleted"""
        ...


@runtime_checkable
class TransformationStorage(Protocol):
    """Protocol for transformation history storage"""

    async def save_transformation(
        self,
        user_id: UUID,
        original_text: str,
        transformed_text: str,
        steps: List[dict],
        metadata: dict
    ) -> UUID:
        """Save transformation result"""
        ...

    async def get_transformation(
        self,
        transformation_id: UUID
    ) -> Optional[dict]:
        """Retrieve transformation by ID"""
        ...

    async def list_transformations(
        self,
        user_id: UUID,
        limit: int = 50
    ) -> List[dict]:
        """List user's transformation history"""
        ...

    async def delete_transformation(
        self,
        transformation_id: UUID
    ) -> bool:
        """Delete transformation, return True if deleted"""
        ...
