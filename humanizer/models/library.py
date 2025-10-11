"""
Library models - Books and chunks from user's archive

Stores ingested texts with embeddings for semantic search.
"""

from datetime import datetime
from uuid import UUID, uuid4
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
try:
    from pgvector.sqlalchemy import Vector
except ImportError:
    Vector = lambda dim: Text  # type: ignore

from humanizer.database import Base


class Book(Base):
    """
    A book or document in the user's archive.

    Attributes:
        id: Unique book ID
        title: Book title
        author: Author name
        custom_metadata: Book metadata (NOT 'metadata' - SQLAlchemy reserved!)
        created_at: When book was added
        chunks: List of text chunks
    """
    __tablename__ = "books"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    title = Column(String(500), nullable=False, index=True)
    author = Column(String(200), nullable=True)

    # CRITICAL: Use custom_metadata NOT metadata (SQLAlchemy reserved)
    custom_metadata = Column(JSONB, nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    chunks = relationship("Chunk", back_populates="book", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Book id={self.id} title={self.title}>"


class Chunk(Base):
    """
    A text chunk from a book (paragraph, section, etc.).

    Attributes:
        id: Unique chunk ID
        book_id: Parent book
        content: The text content
        embedding: Sentence embedding (384-dim for all-MiniLM-L6-v2)
        custom_metadata: Chunk metadata (position, tags, etc.)
        created_at: When chunk was created
    """
    __tablename__ = "chunks"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    book_id = Column(PG_UUID(as_uuid=True), ForeignKey("books.id"), nullable=False, index=True)

    content = Column(Text, nullable=False)
    embedding = Column(Vector(384), nullable=True)  # all-MiniLM-L6-v2 dimension

    # CRITICAL: Use custom_metadata NOT metadata
    custom_metadata = Column(JSONB, nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    book = relationship("Book", back_populates="chunks")

    def __repr__(self) -> str:
        content_preview = self.content[:50] + "..." if len(self.content) > 50 else self.content
        return f"<Chunk id={self.id} content='{content_preview}'>"
