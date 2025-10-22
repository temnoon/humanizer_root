"""
Ephemeral Storage Adapter

In-memory only, no persistence. For web service (humanizer.com).

Vision: Web service is stateless, user data never persisted on our servers.
"""

from typing import Optional, List, Dict
from uuid import UUID, uuid4
from datetime import datetime


class EphemeralStorage:
    """
    In-memory storage that expires after request completes.

    Use case: humanizer.com web service
    - User pastes text
    - Transformation happens
    - Result returned
    - Nothing persisted

    Vision: "If you must upload your soul to use it, it's not yours"
    """

    def __init__(self):
        # Simple dict storage (will be garbage collected)
        self._conversations: Dict[UUID, dict] = {}
        self._documents: Dict[UUID, dict] = {}
        self._transformations: Dict[UUID, dict] = {}

    # ========================================
    # Conversation Storage
    # ========================================

    async def save_conversation(
        self,
        user_id: UUID,
        title: str,
        messages: List[dict],
        metadata: Optional[dict] = None
    ) -> UUID:
        conv_id = uuid4()
        self._conversations[conv_id] = {
            "id": conv_id,
            "user_id": user_id,
            "title": title,
            "messages": messages,
            "metadata": metadata or {},
            "created_at": datetime.utcnow()
        }
        return conv_id

    async def get_conversation(self, conversation_id: UUID) -> Optional[dict]:
        return self._conversations.get(conversation_id)

    async def list_conversations(
        self,
        user_id: UUID,
        limit: int = 50,
        offset: int = 0
    ) -> List[dict]:
        # Filter by user_id
        user_convs = [
            c for c in self._conversations.values()
            if c["user_id"] == user_id
        ]
        return user_convs[offset:offset + limit]

    async def search_conversations(
        self,
        user_id: UUID,
        query: str,
        limit: int = 10
    ) -> List[dict]:
        # Simple text search (no embeddings in ephemeral)
        results = []
        for conv in self._conversations.values():
            if conv["user_id"] != user_id:
                continue
            # Search in title and messages
            text = conv["title"] + " " + " ".join(
                m.get("content", "") for m in conv["messages"]
            )
            if query.lower() in text.lower():
                results.append(conv)
            if len(results) >= limit:
                break
        return results

    async def delete_conversation(self, conversation_id: UUID) -> bool:
        if conversation_id in self._conversations:
            del self._conversations[conversation_id]
            return True
        return False

    # ========================================
    # Document Storage
    # ========================================

    async def save_document(
        self,
        user_id: UUID,
        title: str,
        content: str,
        metadata: Optional[dict] = None
    ) -> UUID:
        doc_id = uuid4()
        self._documents[doc_id] = {
            "id": doc_id,
            "user_id": user_id,
            "title": title,
            "content": content,
            "metadata": metadata or {},
            "created_at": datetime.utcnow()
        }
        return doc_id

    async def get_document(self, document_id: UUID) -> Optional[dict]:
        return self._documents.get(document_id)

    async def list_documents(
        self,
        user_id: UUID,
        limit: int = 50,
        offset: int = 0
    ) -> List[dict]:
        user_docs = [
            d for d in self._documents.values()
            if d["user_id"] == user_id
        ]
        return user_docs[offset:offset + limit]

    async def search_documents(
        self,
        user_id: UUID,
        query: str,
        limit: int = 10
    ) -> List[dict]:
        # Simple text search
        results = []
        for doc in self._documents.values():
            if doc["user_id"] != user_id:
                continue
            text = doc["title"] + " " + doc["content"]
            if query.lower() in text.lower():
                results.append(doc)
            if len(results) >= limit:
                break
        return results

    async def delete_document(self, document_id: UUID) -> bool:
        if document_id in self._documents:
            del self._documents[document_id]
            return True
        return False

    # ========================================
    # Transformation Storage
    # ========================================

    async def save_transformation(
        self,
        user_id: UUID,
        original_text: str,
        transformed_text: str,
        steps: List[dict],
        metadata: dict
    ) -> UUID:
        trans_id = uuid4()
        self._transformations[trans_id] = {
            "id": trans_id,
            "user_id": user_id,
            "original_text": original_text,
            "transformed_text": transformed_text,
            "steps": steps,
            "metadata": metadata,
            "created_at": datetime.utcnow()
        }
        return trans_id

    async def get_transformation(self, transformation_id: UUID) -> Optional[dict]:
        return self._transformations.get(transformation_id)

    async def list_transformations(
        self,
        user_id: UUID,
        limit: int = 50
    ) -> List[dict]:
        user_trans = [
            t for t in self._transformations.values()
            if t["user_id"] == user_id
        ]
        return user_trans[:limit]

    async def delete_transformation(self, transformation_id: UUID) -> bool:
        if transformation_id in self._transformations:
            del self._transformations[transformation_id]
            return True
        return False

    # ========================================
    # Cleanup
    # ========================================

    def clear_all(self):
        """Clear all data (called after request)"""
        self._conversations.clear()
        self._documents.clear()
        self._transformations.clear()
