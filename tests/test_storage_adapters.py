"""
Integration Tests for Storage Adapters

Tests all three storage backends (PostgreSQL, SQLite, Ephemeral)
to ensure they correctly implement the storage protocols.

Run with: poetry run pytest tests/test_storage_adapters.py -v
"""

import pytest
from uuid import uuid4, UUID
from typing import List, Dict

# Import storage implementations
from humanizer.adapters.storage.postgres import (
    PostgresConversationStorage,
    PostgresDocumentStorage,
    PostgresTransformationStorage
)
from humanizer.adapters.storage.sqlite import (
    SQLiteConversationStorage,
    SQLiteDocumentStorage,
    SQLiteTransformationStorage
)
from humanizer.adapters.storage.ephemeral import EphemeralStorage

# Import protocols for type checking
from humanizer.adapters.storage.base import (
    ConversationStorage,
    DocumentStorage,
    TransformationStorage
)


# Test fixtures for all backends
@pytest.fixture(params=[
    ("postgres", PostgresConversationStorage),
    ("sqlite", SQLiteConversationStorage),
    ("ephemeral", EphemeralStorage),
])
async def conversation_storage(request):
    """Fixture that provides all conversation storage implementations."""
    backend_name, storage_class = request.param

    if backend_name == "sqlite":
        storage = storage_class("/tmp/test_conversation.db")
        await storage.init_tables()
    elif backend_name == "ephemeral":
        storage = storage_class()
    else:  # postgres
        storage = storage_class()

    yield storage

    # Cleanup
    if backend_name == "ephemeral":
        storage.clear_all()


@pytest.fixture(params=[
    ("postgres", PostgresDocumentStorage),
    ("sqlite", SQLiteDocumentStorage),
    ("ephemeral", EphemeralStorage),
])
async def document_storage(request):
    """Fixture that provides all document storage implementations."""
    backend_name, storage_class = request.param

    if backend_name == "sqlite":
        storage = storage_class("/tmp/test_document.db")
        await storage.init_tables()
    elif backend_name == "ephemeral":
        storage = storage_class()
    else:  # postgres
        storage = storage_class()

    yield storage

    # Cleanup
    if backend_name == "ephemeral":
        storage.clear_all()


@pytest.fixture(params=[
    ("postgres", PostgresTransformationStorage),
    ("sqlite", SQLiteTransformationStorage),
    ("ephemeral", EphemeralStorage),
])
async def transformation_storage(request):
    """Fixture that provides all transformation storage implementations."""
    backend_name, storage_class = request.param

    if backend_name == "sqlite":
        storage = storage_class("/tmp/test_transformation.db")
        await storage.init_tables()
    elif backend_name == "ephemeral":
        storage = storage_class()
    else:  # postgres
        storage = storage_class()

    yield storage

    # Cleanup
    if backend_name == "ephemeral":
        storage.clear_all()


# ConversationStorage Tests
@pytest.mark.asyncio
async def test_conversation_save_and_get(conversation_storage):
    """Test saving and retrieving a conversation."""
    user_id = uuid4()
    title = "Test Conversation"
    messages = [
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hi there!"}
    ]
    metadata = {"test": "data"}

    # Save conversation
    conv_id = await conversation_storage.save_conversation(
        user_id=user_id,
        title=title,
        messages=messages,
        metadata=metadata
    )

    assert isinstance(conv_id, UUID)

    # Retrieve conversation
    result = await conversation_storage.get_conversation(conv_id)

    assert result is not None
    assert result["title"] == title
    assert len(result["messages"]) == 2
    assert result["messages"][0]["role"] == "user"


@pytest.mark.asyncio
async def test_conversation_list(conversation_storage):
    """Test listing conversations."""
    user_id = uuid4()

    # Create multiple conversations
    for i in range(3):
        await conversation_storage.save_conversation(
            user_id=user_id,
            title=f"Conversation {i}",
            messages=[{"role": "user", "content": f"Message {i}"}],
        )

    # List conversations
    conversations = await conversation_storage.list_conversations(
        user_id=user_id,
        limit=10
    )

    assert len(conversations) >= 3


@pytest.mark.asyncio
async def test_conversation_delete(conversation_storage):
    """Test deleting a conversation."""
    user_id = uuid4()

    # Create conversation
    conv_id = await conversation_storage.save_conversation(
        user_id=user_id,
        title="Delete Me",
        messages=[{"role": "user", "content": "Test"}],
    )

    # Delete conversation
    deleted = await conversation_storage.delete_conversation(conv_id)
    assert deleted is True

    # Verify deleted
    result = await conversation_storage.get_conversation(conv_id)
    assert result is None


@pytest.mark.asyncio
async def test_conversation_search(conversation_storage):
    """Test searching conversations."""
    user_id = uuid4()

    # Create conversation with searchable title
    await conversation_storage.save_conversation(
        user_id=user_id,
        title="Quantum mechanics discussion",
        messages=[{"role": "user", "content": "What is quantum?"}],
    )

    # Search
    results = await conversation_storage.search_conversations(
        user_id=user_id,
        query="quantum",
        limit=10
    )

    assert len(results) >= 1


# DocumentStorage Tests
@pytest.mark.asyncio
async def test_document_save_and_get(document_storage):
    """Test saving and retrieving a document."""
    user_id = uuid4()
    title = "Test Document"
    content = "This is test content for the document."
    metadata = {"file_type": "txt"}

    # Save document
    doc_id = await document_storage.save_document(
        user_id=user_id,
        title=title,
        content=content,
        metadata=metadata
    )

    assert isinstance(doc_id, UUID)

    # Retrieve document
    result = await document_storage.get_document(doc_id)

    assert result is not None
    assert result["title"] == title
    assert result["content"] == content


@pytest.mark.asyncio
async def test_document_list(document_storage):
    """Test listing documents."""
    user_id = uuid4()

    # Create multiple documents
    for i in range(3):
        await document_storage.save_document(
            user_id=user_id,
            title=f"Document {i}",
            content=f"Content {i}",
        )

    # List documents
    documents = await document_storage.list_documents(
        user_id=user_id,
        limit=10
    )

    assert len(documents) >= 3


@pytest.mark.asyncio
async def test_document_delete(document_storage):
    """Test deleting a document."""
    user_id = uuid4()

    # Create document
    doc_id = await document_storage.save_document(
        user_id=user_id,
        title="Delete Me",
        content="Test content",
    )

    # Delete document
    deleted = await document_storage.delete_document(doc_id)
    assert deleted is True

    # Verify deleted
    result = await document_storage.get_document(doc_id)
    assert result is None


@pytest.mark.asyncio
async def test_document_search(document_storage):
    """Test searching documents."""
    user_id = uuid4()

    # Create document with searchable content
    await document_storage.save_document(
        user_id=user_id,
        title="Machine Learning Paper",
        content="This paper discusses deep learning and neural networks.",
    )

    # Search
    results = await document_storage.search_documents(
        user_id=user_id,
        query="learning",
        limit=10
    )

    assert len(results) >= 1


# TransformationStorage Tests
@pytest.mark.asyncio
async def test_transformation_save_and_get(transformation_storage):
    """Test saving and retrieving a transformation."""
    user_id = uuid4()
    original_text = "The cat sat on the mat."
    transformed_text = "The feline rested upon the rug."
    steps = [
        {"iteration": 0, "text": original_text, "convergence_score": 0.5},
        {"iteration": 1, "text": transformed_text, "convergence_score": 0.9}
    ]
    metadata = {
        "target_stance": {"tone": "analytical"},
        "converged": True,
        "total_iterations": 2
    }

    # Save transformation
    trans_id = await transformation_storage.save_transformation(
        user_id=user_id,
        original_text=original_text,
        transformed_text=transformed_text,
        steps=steps,
        metadata=metadata
    )

    assert isinstance(trans_id, UUID)

    # Retrieve transformation
    result = await transformation_storage.get_transformation(trans_id)

    assert result is not None
    assert result["source_text"] == original_text
    assert result["result_text"] == transformed_text
    assert "metrics" in result
    assert result["metrics"]["steps"] == steps


@pytest.mark.asyncio
async def test_transformation_list(transformation_storage):
    """Test listing transformations."""
    user_id = uuid4()

    # Create multiple transformations
    for i in range(3):
        await transformation_storage.save_transformation(
            user_id=user_id,
            original_text=f"Original {i}",
            transformed_text=f"Transformed {i}",
            steps=[],
            metadata={}
        )

    # List transformations
    transformations = await transformation_storage.list_transformations(
        user_id=user_id,
        limit=10
    )

    assert len(transformations) >= 3


@pytest.mark.asyncio
async def test_transformation_delete(transformation_storage):
    """Test deleting a transformation."""
    user_id = uuid4()

    # Create transformation
    trans_id = await transformation_storage.save_transformation(
        user_id=user_id,
        original_text="Original",
        transformed_text="Transformed",
        steps=[],
        metadata={}
    )

    # Delete transformation
    deleted = await transformation_storage.delete_transformation(trans_id)
    assert deleted is True

    # Verify deleted
    result = await transformation_storage.get_transformation(trans_id)
    assert result is None


# Protocol Compliance Tests
def test_protocol_compliance():
    """Test that all implementations comply with protocols."""
    # PostgreSQL
    assert isinstance(PostgresConversationStorage(), ConversationStorage)
    assert isinstance(PostgresDocumentStorage(), DocumentStorage)
    assert isinstance(PostgresTransformationStorage(), TransformationStorage)

    # SQLite
    assert isinstance(SQLiteConversationStorage(), ConversationStorage)
    assert isinstance(SQLiteDocumentStorage(), DocumentStorage)
    assert isinstance(SQLiteTransformationStorage(), TransformationStorage)

    # Ephemeral
    ephemeral = EphemeralStorage()
    assert isinstance(ephemeral, ConversationStorage)
    assert isinstance(ephemeral, DocumentStorage)
    assert isinstance(ephemeral, TransformationStorage)
