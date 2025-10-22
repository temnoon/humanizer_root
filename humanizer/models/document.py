"""
Document Ingestion Models - SQLAlchemy models for ingested files

These models track documents ingested into the system:
- Document: Primary entity for ingested files (PDF, TXT, MD, images, etc.)
- DocumentChunk: Chunked content for large documents (with embeddings)
- DocumentMedia: Media extracted from documents (images from PDFs, etc.)
- IngestionBatch: Tracks ingestion operations with statistics
"""

from datetime import datetime
from uuid import UUID, uuid4
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, Enum as SQLEnum, Boolean
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from enum import Enum

from humanizer.database import Base


class StorageStrategy(str, Enum):
    """Storage strategy for media files."""
    CENTRALIZED = "centralized"  # Copy to organized folder structure
    IN_PLACE = "in_place"  # Reference files in original location


class EmbeddingStatus(str, Enum):
    """Status of embedding generation."""
    PENDING = "pending"  # Not yet generated
    PROCESSING = "processing"  # Currently generating
    COMPLETED = "completed"  # Successfully generated
    FAILED = "failed"  # Generation failed


class Document(Base):
    """
    An ingested document file.

    Supports multiple file types:
    - Documents: PDF, TXT, MD, DOCX, HTML
    - Images: JPG, PNG, GIF, WebP
    - Videos: MP4, MOV, AVI (future)

    Uses SHA256 hash for duplicate detection.
    Supports both centralized storage and in-place referencing.

    Attributes:
        id: UUID primary key
        filename: Original filename
        file_path: Current file location (centralized or original)
        original_path: Original file location (before centralization)
        file_size: Size in bytes
        file_type: Type (pdf, txt, md, image, etc.)
        mime_type: MIME type
        file_hash: SHA256 hash for duplicate detection
        storage_strategy: How file is stored (centralized vs in_place)
        title: Extracted or derived title
        author: Extracted author (if available)
        raw_text: Full extracted text content
        created_at: When document record was created
        updated_at: When document record was last updated
        ingested_at: When document was ingested
        file_modified_at: File modification time from filesystem
        source_directory: Original directory where file was found
        ingestion_batch_id: Batch this document belongs to
        embedding_status: Status of embedding generation
        custom_metadata: File-specific metadata (JSONB)
        chunks: List of DocumentChunk
        media: List of DocumentMedia (extracted media)
    """
    __tablename__ = "documents"

    # Primary key
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    # File metadata
    filename = Column(String(500), nullable=False, index=True)
    file_path = Column(Text, nullable=False)  # Current location
    original_path = Column(Text, nullable=True)  # Original location (before centralization)
    file_size = Column(Integer, nullable=True)
    file_type = Column(String(50), nullable=False, index=True)  # 'pdf', 'txt', 'md', 'image', etc.
    mime_type = Column(String(100), nullable=True)
    file_hash = Column(String(64), nullable=False, unique=True, index=True)  # SHA256
    storage_strategy = Column(SQLEnum(StorageStrategy), nullable=False, default=StorageStrategy.IN_PLACE)

    # Content
    title = Column(Text, nullable=True)  # Extracted or filename
    author = Column(String(200), nullable=True)
    raw_text = Column(Text, nullable=True)  # Full extracted text

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    ingested_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    file_modified_at = Column(DateTime, nullable=True)  # From filesystem

    # Provenance
    source_directory = Column(Text, nullable=True)
    ingestion_batch_id = Column(PG_UUID(as_uuid=True), ForeignKey("ingestion_batches.id"), nullable=True, index=True)

    # Embedding status
    embedding_status = Column(SQLEnum(EmbeddingStatus), nullable=False, default=EmbeddingStatus.PENDING)

    # Metadata
    custom_metadata = Column(JSONB, nullable=True)  # File-specific metadata

    # Relationships
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")
    media = relationship("DocumentMedia", back_populates="document", cascade="all, delete-orphan")
    batch = relationship("IngestionBatch", back_populates="documents")

    def __repr__(self) -> str:
        return f"<Document id={self.id} file='{self.filename}' type={self.file_type}>"


class DocumentChunk(Base):
    """
    A chunk of a document (for large files).

    Enables:
    - Semantic search on document sections
    - Manageable embedding sizes
    - Context-aware retrieval

    Chunks are created with intelligent boundaries:
    - Respect paragraphs when possible
    - Respect sentences when paragraphs too large
    - Include overlap for context preservation

    Attributes:
        id: UUID primary key
        document_id: Parent document
        chunk_index: Order within document (0-indexed)
        chunk_text: Text content of chunk
        chunk_size: Character count
        start_page: Starting page number (for PDFs)
        end_page: Ending page number (for PDFs)
        start_offset: Character offset in document
        end_offset: Character offset in document
        embedding: Semantic embedding vector (1024-dim mxbai-embed-large)
        embedding_status: Status of embedding generation
        custom_metadata: Chunk-specific metadata
        created_at: When chunk was created
        document: Parent Document
    """
    __tablename__ = "document_chunks"

    # Primary key
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Parent document
    document_id = Column(PG_UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False, index=True)

    # Chunk metadata
    chunk_index = Column(Integer, nullable=False)  # Order within document
    chunk_text = Column(Text, nullable=False)
    chunk_size = Column(Integer, nullable=False)  # Character count

    # Position in document
    start_page = Column(Integer, nullable=True)  # For PDFs
    end_page = Column(Integer, nullable=True)
    start_offset = Column(Integer, nullable=True)  # Character offset
    end_offset = Column(Integer, nullable=True)

    # Semantic embedding
    embedding = Column(Vector(1024), nullable=True)  # mxbai-embed-large
    embedding_status = Column(SQLEnum(EmbeddingStatus), nullable=False, default=EmbeddingStatus.PENDING)

    # Chunk-specific metadata
    custom_metadata = Column(JSONB, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    document = relationship("Document", back_populates="chunks")

    def __repr__(self) -> str:
        return f"<DocumentChunk id={self.id} doc={self.document_id} idx={self.chunk_index}>"


class DocumentMedia(Base):
    """
    Media extracted from documents (images, diagrams, etc.).

    Handles:
    - PDF embedded images
    - Diagrams and charts
    - Screenshots
    - Standalone image files

    Attributes:
        id: UUID primary key
        document_id: Parent document
        media_type: Type (image, diagram, video, etc.)
        file_path: Path to media file
        mime_type: MIME type
        file_size: Size in bytes
        page_number: Page number (for PDFs)
        width: Image width in pixels (if applicable)
        height: Image height in pixels (if applicable)
        custom_metadata: Media-specific metadata
        extracted_at: When media was extracted
        document: Parent Document
    """
    __tablename__ = "document_media"

    # Primary key
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Parent document
    document_id = Column(PG_UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False, index=True)

    # Media metadata
    media_type = Column(String(50), nullable=False, index=True)  # 'image', 'diagram', 'video', etc.
    file_path = Column(Text, nullable=False)
    mime_type = Column(String(100), nullable=True)
    file_size = Column(Integer, nullable=True)

    # Position/dimensions
    page_number = Column(Integer, nullable=True)  # For PDFs
    width = Column(Integer, nullable=True)  # For images
    height = Column(Integer, nullable=True)  # For images

    # Metadata
    custom_metadata = Column(JSONB, nullable=True)

    # Timestamps
    extracted_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    document = relationship("Document", back_populates="media")

    def __repr__(self) -> str:
        return f"<DocumentMedia id={self.id} type={self.media_type}>"


class IngestionBatch(Base):
    """
    Track document ingestion batches.

    Enables:
    - Bulk operations tracking
    - Re-ingestion detection
    - Batch statistics
    - Provenance tracking
    - Error logging

    Attributes:
        id: UUID primary key
        source_directory: Directory ingested
        batch_type: Type of batch (pdf, mixed, txt, image, etc.)
        storage_strategy: Storage strategy used
        centralized_base_path: Base path for centralized storage (if used)
        total_files: Total files processed
        successful: Successfully ingested
        failed: Failed to ingest
        skipped: Skipped (duplicates, etc.)
        started_at: When batch started
        completed_at: When batch completed
        processing_time_ms: Total processing time
        errors: Error details (JSONB array)
        config_snapshot: Configuration used (JSONB)
        custom_metadata: Batch-specific metadata
        documents: List of Documents in this batch
    """
    __tablename__ = "ingestion_batches"

    # Primary key
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Batch metadata
    source_directory = Column(Text, nullable=False)
    batch_type = Column(String(50), nullable=False, index=True)  # 'pdf', 'mixed', 'txt', 'image', etc.
    storage_strategy = Column(SQLEnum(StorageStrategy), nullable=False)
    centralized_base_path = Column(Text, nullable=True)  # Base path for centralized storage

    # Statistics
    total_files = Column(Integer, nullable=False, default=0)
    successful = Column(Integer, nullable=False, default=0)
    failed = Column(Integer, nullable=False, default=0)
    skipped = Column(Integer, nullable=False, default=0)

    # Processing info
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    processing_time_ms = Column(Integer, nullable=True)

    # Errors
    errors = Column(JSONB, nullable=True)  # List of error dicts

    # Configuration used
    config_snapshot = Column(JSONB, nullable=True)

    # Metadata
    custom_metadata = Column(JSONB, nullable=True)

    # Relationships
    documents = relationship("Document", back_populates="batch")

    def __repr__(self) -> str:
        return f"<IngestionBatch id={self.id} files={self.total_files} strategy={self.storage_strategy.value}>"
