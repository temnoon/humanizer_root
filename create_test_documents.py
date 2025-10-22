"""
Quick script to create test documents in the database for testing.
Works around the document ingestion batch bug.
"""
import asyncio
from uuid import uuid4
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from humanizer.models.document import (
    Document,
    DocumentChunk,
    IngestionBatch,
    StorageStrategy,
    EmbeddingStatus,
)
from humanizer.config import settings


async def create_test_documents():
    """Create test documents directly in the database."""
    engine = create_async_engine(settings.database_url, echo=True)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        # Create batch first
        batch = IngestionBatch(
            id=uuid4(),
            source_directory="/Users/tem/humanizer_root/tem_tests",
            batch_type="txt,md",
            total_files=2,
            successful=2,
            failed=0,
            skipped=0,
            storage_strategy=StorageStrategy.IN_PLACE,
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
            processing_time_ms=100,
            errors=[],
            config_snapshot={},
        )
        session.add(batch)
        await session.flush()  # Flush batch first!

        # Document 1: TXT file
        doc1 = Document(
            id=uuid4(),
            filename="test_document.txt",
            file_path="/Users/tem/humanizer_root/tem_tests/test_document.txt",
            original_path="/Users/tem/humanizer_root/tem_tests/test_document.txt",
            file_size=950,
            file_type="txt",
            mime_type="text/plain",
            file_hash="test_hash_1",
            storage_strategy=StorageStrategy.IN_PLACE,
            title="Quantum Consciousness and the TRM Framework",
            raw_text="""Quantum Consciousness and the TRM Framework

This is a test document for the Humanizer application. It explores how quantum mechanics can be applied to understanding consciousness and subjective experience.

The Tetralemma Reading Method (TRM) uses density matrices and POVM operators to represent the measurement of semantic states. When we read text, we construct a quantum-like representation that captures the inherent ambiguity and mixed states present in language.

Key concepts:
- Density matrices (ρ) represent mixed quantum states
- POVM operators allow for generalized measurements
- The tetralemma provides four-fold logic: A, ¬A, both, neither
- Verification loops ensure transformations move in the intended direction

This framework bridges the gap between formal mathematical structures and lived subjective experience, making consciousness work computationally tractable while respecting its irreducible complexity.""",
            ingestion_batch_id=batch.id,
            embedding_status=EmbeddingStatus.PENDING,
            source_directory="/Users/tem/humanizer_root/tem_tests",
            file_modified_at=datetime.utcnow(),
            custom_metadata={"test": True},
        )

        # Document 2: MD file
        doc2 = Document(
            id=uuid4(),
            filename="another_test.md",
            file_path="/Users/tem/humanizer_root/tem_tests/another_test.md",
            original_path="/Users/tem/humanizer_root/tem_tests/another_test.md",
            file_size=836,
            file_type="md",
            mime_type="text/markdown",
            file_hash="test_hash_2",
            storage_strategy=StorageStrategy.IN_PLACE,
            title="Interest Lists and Document Integration",
            raw_text="""# Interest Lists and Document Integration

This markdown document tests the document ingestion system with a different file format.

## Features

The Interest Lists feature allows users to:
- Create custom collections of items
- Add documents, conversations, and transformations
- Navigate directly to items from lists
- Track working memory automatically

## Implementation

The DocumentViewer component provides:
1. Multiple view modes (Content, Chunks, Media, JSON)
2. Action bar with star, add to list, and use in tools
3. Golden ratio typography for optimal reading
4. Responsive layout with width toggle

## Testing

This document will be used to verify that:
- Markdown files can be ingested
- Documents appear in the DocumentsPanel
- The "Add to List" functionality works correctly
- Documents can be viewed from Interest Lists""",
            ingestion_batch_id=batch.id,
            embedding_status=EmbeddingStatus.PENDING,
            source_directory="/Users/tem/humanizer_root/tem_tests",
            file_modified_at=datetime.utcnow(),
            custom_metadata={"test": True, "frontmatter": {}, "headings": []},
        )

        session.add(doc1)
        session.add(doc2)

        # Add chunks for doc1
        chunk1 = DocumentChunk(
            id=uuid4(),
            document_id=doc1.id,
            chunk_index=0,
            chunk_text="Quantum Consciousness and the TRM Framework\n\nThis is a test document for the Humanizer application. It explores how quantum mechanics can be applied to understanding consciousness and subjective experience.",
            start_offset=0,
            end_offset=200,
            chunk_size=200,
            embedding_status=EmbeddingStatus.PENDING,
            custom_metadata={},
        )

        chunk2 = DocumentChunk(
            id=uuid4(),
            document_id=doc1.id,
            chunk_index=1,
            chunk_text="The Tetralemma Reading Method (TRM) uses density matrices and POVM operators to represent the measurement of semantic states. When we read text, we construct a quantum-like representation that captures the inherent ambiguity and mixed states present in language.",
            start_offset=200,
            end_offset=450,
            chunk_size=250,
            embedding_status=EmbeddingStatus.PENDING,
            custom_metadata={},
        )

        session.add(chunk1)
        session.add(chunk2)

        # Commit all
        await session.commit()

        print(f"✅ Created batch: {batch.id}")
        print(f"✅ Created document 1: {doc1.id} - {doc1.title}")
        print(f"✅ Created document 2: {doc2.id} - {doc2.title}")
        print(f"✅ Created 2 chunks for doc1")


if __name__ == "__main__":
    asyncio.run(create_test_documents())
