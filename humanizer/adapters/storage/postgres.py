"""
PostgreSQL Storage Adapters

Implements storage protocols using PostgreSQL + SQLAlchemy async.

This module provides the production storage backend for:
- Conversations (AgentConversation model)
- Documents (Document model)
- Transformations (Transformation model)
"""

from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4
from datetime import datetime
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from humanizer.database.connection import async_session_maker
from humanizer.models.agent import AgentConversation
from humanizer.models.document import Document
from humanizer.models.transformation import Transformation


class PostgresConversationStorage:
    """
    PostgreSQL implementation of ConversationStorage protocol.

    Uses AgentConversation model for storage.
    """

    def __init__(self):
        """Initialize PostgreSQL conversation storage."""
        self.session_maker = async_session_maker

    async def save_conversation(
        self,
        user_id: UUID,
        title: str,
        messages: List[dict],
        metadata: Optional[dict] = None
    ) -> UUID:
        """
        Save conversation to PostgreSQL.

        Args:
            user_id: User who owns the conversation
            title: Conversation title
            messages: List of message dicts with role + content
            metadata: Optional metadata

        Returns:
            UUID of saved conversation
        """
        async with self.session_maker() as session:
            try:
                # Determine model_name from metadata if present
                model_name = "mistral:7b"
                if metadata and "model_name" in metadata:
                    model_name = metadata["model_name"]

                # Create conversation
                conversation = AgentConversation(
                    id=uuid4(),
                    user_id=user_id,
                    title=title,
                    model_name=model_name,
                    messages=messages,
                    custom_metadata=metadata or {}
                )

                session.add(conversation)
                await session.commit()
                await session.refresh(conversation)

                return conversation.id
            except Exception:
                await session.rollback()
                raise

    async def get_conversation(self, conversation_id: UUID) -> Optional[dict]:
        """
        Retrieve conversation by ID.

        Args:
            conversation_id: Conversation UUID

        Returns:
            Conversation dict or None if not found
        """
        async with self.session_maker() as session:
            stmt = select(AgentConversation).where(AgentConversation.id == conversation_id)
            result = await session.execute(stmt)
            conversation = result.scalar_one_or_none()

            if conversation is None:
                return None

            return conversation.to_dict(include_messages=True)

    async def list_conversations(
        self,
        user_id: UUID,
        limit: int = 50,
        offset: int = 0
    ) -> List[dict]:
        """
        List user's conversations (paginated).

        Args:
            user_id: User UUID
            limit: Maximum results to return
            offset: Number of results to skip

        Returns:
            List of conversation dicts
        """
        async with self.session_maker() as session:
            stmt = (
                select(AgentConversation)
                .where(AgentConversation.user_id == user_id)
                .order_by(AgentConversation.updated_at.desc())
                .limit(limit)
                .offset(offset)
            )
            result = await session.execute(stmt)
            conversations = result.scalars().all()

            return [conv.to_dict(include_messages=False) for conv in conversations]

    async def search_conversations(
        self,
        user_id: UUID,
        query: str,
        limit: int = 10
    ) -> List[dict]:
        """
        Search conversations by text (simple ILIKE search).

        Note: This is a basic text search. For semantic search,
        use the embedding explorer service.

        Args:
            user_id: User UUID
            query: Search query
            limit: Maximum results

        Returns:
            List of matching conversation dicts
        """
        async with self.session_maker() as session:
            # Search in title and messages (JSONB text search)
            search_pattern = f"%{query}%"

            stmt = (
                select(AgentConversation)
                .where(AgentConversation.user_id == user_id)
                .where(
                    (AgentConversation.title.ilike(search_pattern))
                )
                .order_by(AgentConversation.updated_at.desc())
                .limit(limit)
            )
            result = await session.execute(stmt)
            conversations = result.scalars().all()

            return [conv.to_dict(include_messages=False) for conv in conversations]

    async def delete_conversation(self, conversation_id: UUID) -> bool:
        """
        Delete conversation.

        Args:
            conversation_id: Conversation UUID

        Returns:
            True if deleted, False if not found
        """
        async with self.session_maker() as session:
            try:
                stmt = select(AgentConversation).where(AgentConversation.id == conversation_id)
                result = await session.execute(stmt)
                conversation = result.scalar_one_or_none()

                if conversation is None:
                    return False

                await session.delete(conversation)
                await session.commit()
                return True
            except Exception:
                await session.rollback()
                raise


class PostgresDocumentStorage:
    """
    PostgreSQL implementation of DocumentStorage protocol.

    Uses Document model for storage.
    """

    def __init__(self):
        """Initialize PostgreSQL document storage."""
        self.session_maker = async_session_maker

    async def save_document(
        self,
        user_id: UUID,
        title: str,
        content: str,
        metadata: Optional[dict] = None
    ) -> UUID:
        """
        Save document to PostgreSQL.

        Args:
            user_id: User who owns the document (stored in metadata)
            title: Document title (stored as filename)
            content: Document content (stored as raw_text)
            metadata: Optional metadata

        Returns:
            UUID of saved document
        """
        async with self.session_maker() as session:
            try:
                # Extract file type from metadata or default to 'txt'
                file_type = metadata.get("file_type", "txt") if metadata else "txt"

                # Create simple hash from content
                import hashlib
                file_hash = hashlib.sha256(content.encode()).hexdigest()

                # Create document
                document = Document(
                    id=uuid4(),
                    filename=title,
                    file_path=f"/ephemeral/{uuid4()}.{file_type}",  # Ephemeral path
                    file_hash=file_hash,
                    file_type=file_type,
                    title=title,
                    raw_text=content,
                    custom_metadata={
                        **(metadata or {}),
                        "user_id": str(user_id),  # Store user_id in metadata
                    }
                )

                session.add(document)
                await session.commit()
                await session.refresh(document)

                return document.id
            except Exception:
                await session.rollback()
                raise

    async def get_document(self, document_id: UUID) -> Optional[dict]:
        """
        Retrieve document by ID.

        Args:
            document_id: Document UUID

        Returns:
            Document dict or None if not found
        """
        async with self.session_maker() as session:
            stmt = select(Document).where(Document.id == document_id)
            result = await session.execute(stmt)
            document = result.scalar_one_or_none()

            if document is None:
                return None

            return {
                "id": str(document.id),
                "title": document.title,
                "content": document.raw_text,
                "metadata": document.custom_metadata or {},
                "created_at": document.created_at.isoformat() if document.created_at else None,
                "updated_at": document.updated_at.isoformat() if document.updated_at else None,
            }

    async def list_documents(
        self,
        user_id: UUID,
        limit: int = 50,
        offset: int = 0
    ) -> List[dict]:
        """
        List user's documents (paginated).

        Note: Filters by user_id stored in custom_metadata.

        Args:
            user_id: User UUID
            limit: Maximum results to return
            offset: Number of results to skip

        Returns:
            List of document dicts
        """
        async with self.session_maker() as session:
            # Filter by user_id in JSONB metadata
            stmt = (
                select(Document)
                .where(Document.custom_metadata["user_id"].astext == str(user_id))
                .order_by(Document.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
            result = await session.execute(stmt)
            documents = result.scalars().all()

            return [
                {
                    "id": str(doc.id),
                    "title": doc.title,
                    "content": doc.raw_text[:500] if doc.raw_text else None,  # Preview only
                    "metadata": doc.custom_metadata or {},
                    "created_at": doc.created_at.isoformat() if doc.created_at else None,
                }
                for doc in documents
            ]

    async def search_documents(
        self,
        user_id: UUID,
        query: str,
        limit: int = 10
    ) -> List[dict]:
        """
        Search documents by text (simple ILIKE search).

        Note: This is a basic text search. For semantic search,
        use the document embedding service.

        Args:
            user_id: User UUID
            query: Search query
            limit: Maximum results

        Returns:
            List of matching document dicts
        """
        async with self.session_maker() as session:
            search_pattern = f"%{query}%"

            stmt = (
                select(Document)
                .where(Document.custom_metadata["user_id"].astext == str(user_id))
                .where(
                    (Document.title.ilike(search_pattern)) |
                    (Document.raw_text.ilike(search_pattern))
                )
                .order_by(Document.created_at.desc())
                .limit(limit)
            )
            result = await session.execute(stmt)
            documents = result.scalars().all()

            return [
                {
                    "id": str(doc.id),
                    "title": doc.title,
                    "content": doc.raw_text[:500] if doc.raw_text else None,  # Preview only
                    "metadata": doc.custom_metadata or {},
                    "created_at": doc.created_at.isoformat() if doc.created_at else None,
                }
                for doc in documents
            ]

    async def delete_document(self, document_id: UUID) -> bool:
        """
        Delete document.

        Args:
            document_id: Document UUID

        Returns:
            True if deleted, False if not found
        """
        async with self.session_maker() as session:
            try:
                stmt = select(Document).where(Document.id == document_id)
                result = await session.execute(stmt)
                document = result.scalar_one_or_none()

                if document is None:
                    return False

                await session.delete(document)
                await session.commit()
                return True
            except Exception:
                await session.rollback()
                raise


class PostgresTransformationStorage:
    """
    PostgreSQL implementation of TransformationStorage protocol.

    Uses Transformation model for storage.
    """

    def __init__(self):
        """Initialize PostgreSQL transformation storage."""
        self.session_maker = async_session_maker

    async def save_transformation(
        self,
        user_id: UUID,
        original_text: str,
        transformed_text: str,
        steps: List[dict],
        metadata: dict
    ) -> UUID:
        """
        Save transformation to PostgreSQL.

        Args:
            user_id: User who created the transformation
            original_text: Original text (stored as source_text)
            transformed_text: Transformed text (stored as result_text)
            steps: Transformation steps (stored in metrics)
            metadata: Transformation metadata (target_stance, converged, etc.)

        Returns:
            UUID of saved transformation
        """
        async with self.session_maker() as session:
            try:
                # Extract parameters from metadata
                transformation_type = metadata.get("transformation_type", "custom")
                user_prompt = metadata.get("user_prompt")
                parameters = metadata.get("parameters", {})

                # Build metrics from steps and metadata
                metrics = {
                    "steps": steps,
                    "target_stance": metadata.get("target_stance", {}),
                    "converged": metadata.get("converged", False),
                    "total_iterations": metadata.get("total_iterations", len(steps)),
                }

                # Create transformation
                transformation = Transformation(
                    id=uuid4(),
                    user_id=user_id,
                    source_type="custom",
                    source_uuid=metadata.get("source_uuid"),
                    source_text=original_text,
                    transformation_type=transformation_type,
                    user_prompt=user_prompt,
                    parameters=parameters,
                    result_text=transformed_text,
                    metrics=metrics
                )

                session.add(transformation)
                await session.commit()
                await session.refresh(transformation)

                return transformation.id
            except Exception:
                await session.rollback()
                raise

    async def get_transformation(self, transformation_id: UUID) -> Optional[dict]:
        """
        Retrieve transformation by ID.

        Args:
            transformation_id: Transformation UUID

        Returns:
            Transformation dict or None if not found
        """
        async with self.session_maker() as session:
            stmt = select(Transformation).where(Transformation.id == transformation_id)
            result = await session.execute(stmt)
            transformation = result.scalar_one_or_none()

            if transformation is None:
                return None

            return transformation.to_dict(include_metrics=True, include_full_text=True)

    async def list_transformations(
        self,
        user_id: UUID,
        limit: int = 50
    ) -> List[dict]:
        """
        List user's transformations.

        Args:
            user_id: User UUID
            limit: Maximum results

        Returns:
            List of transformation dicts
        """
        async with self.session_maker() as session:
            stmt = (
                select(Transformation)
                .where(Transformation.user_id == user_id)
                .order_by(Transformation.created_at.desc())
                .limit(limit)
            )
            result = await session.execute(stmt)
            transformations = result.scalars().all()

            return [
                trans.to_dict(include_metrics=False, include_full_text=False)
                for trans in transformations
            ]

    async def delete_transformation(self, transformation_id: UUID) -> bool:
        """
        Delete transformation.

        Args:
            transformation_id: Transformation UUID

        Returns:
            True if deleted, False if not found
        """
        async with self.session_maker() as session:
            try:
                stmt = select(Transformation).where(Transformation.id == transformation_id)
                result = await session.execute(stmt)
                transformation = result.scalar_one_or_none()

                if transformation is None:
                    return False

                await session.delete(transformation)
                await session.commit()
                return True
            except Exception:
                await session.rollback()
                raise
