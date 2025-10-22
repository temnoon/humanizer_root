# Humanizer API - Comprehensive Code Review
## October 17, 2025

---

## Executive Summary

**Purpose**: Review the Humanizer API codebase to understand architecture patterns and prepare recommendations for implementing file ingestion (PDF, TXT, MD, and other general files).

**Status**: Production-ready FastAPI application with 14 routers, 62+ endpoints, PostgreSQL database with 32 tables, comprehensive TRM (Transformation via Recursive Measurement) implementation.

**Key Finding**: The codebase demonstrates excellent architectural patterns with clear separation of concerns, consistent use of modern Python/FastAPI practices, and a well-established ingestion pattern (ChatGPT archives) that can be extended for general file ingestion.

---

## 1. Architecture Overview

### 1.1 Project Structure

```
humanizer/
├── api/                # 14 router modules (342 lines avg)
├── services/           # Business logic layer (15 services)
├── models/             # SQLAlchemy ORM + Pydantic schemas
├── ml/                 # TRM core (density matrices, POVM, verification)
├── database/           # Connection management
├── config.py           # Pydantic Settings
└── main.py             # FastAPI app entry point
```

**Key Metrics**:
- **API Routers**: 14 (reading, povm, chatgpt, aui, media, interest, interest_list, transform, tools, personify, pipeline, capture, embedding_explorer, agent)
- **Services**: 15 service classes
- **Database Tables**: 32 (via SQLAlchemy models)
- **Endpoints**: 62+ API endpoints

### 1.2 Technology Stack

**Core Framework**:
- FastAPI (async/await throughout)
- Python 3.11+
- SQLAlchemy 2.0 (async patterns)
- Pydantic v2 (validation + schemas)

**Database**:
- PostgreSQL + pgvector extension
- Async driver: asyncpg
- Vector embeddings: 1024-dim (mxbai-embed-large)

**ML/AI**:
- Sentence transformers (all-MiniLM-L6-v2)
- Claude Haiku 4.5 (AUI agent)
- TRM quantum-inspired formalism

---

## 2. Core Architectural Patterns

### 2.1 Layered Architecture

**Router → Service → Model** (strict separation)

**Example**: ChatGPT Archive Ingestion
```
humanizer/api/chatgpt.py (API layer)
    ↓ calls
humanizer/services/chatgpt.py (Business logic)
    ↓ uses
humanizer/models/chatgpt.py (Data models)
```

**Benefits**:
- Clear separation of concerns
- Testable business logic
- Reusable service layer
- Type-safe interfaces

### 2.2 Pydantic Everywhere

**Request/Response Contracts**:
```python
# In schemas.py
class ChatGPTIngestRequest(BaseModel):
    home_dir: str = Field(..., description="Home directory")
    archive_pattern: str = Field(default="chat[2-8]")
    force_reimport: bool = Field(default=False)

class ChatGPTIngestResponse(BaseModel):
    total_conversations: int
    total_messages: int
    processing_time_ms: int
    errors: List[str]
```

**Used in**:
- API request validation
- Response serialization
- OpenAPI documentation
- Type safety

### 2.3 SQLAlchemy 2.0 Patterns

**Modern async/await style**:
```python
# ✅ CORRECT (2.0 style)
async def get_conversation(session: AsyncSession, uuid: UUID):
    stmt = select(ChatGPTConversation).where(ChatGPTConversation.uuid == uuid)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()

# ❌ WRONG (legacy style - NOT used in codebase)
conversation = session.query(ChatGPTConversation).filter(...).first()
```

**Key Patterns Found**:
- `select()` instead of `session.query()`
- `where()` instead of `filter()`
- `session.execute()` followed by `result.scalar_one()` or `result.all()`
- Async sessions via `Depends(get_session)`

### 2.4 Critical Naming Convention

**⚠️ CRITICAL**: Use `custom_metadata` NOT `metadata`

**Reason**: SQLAlchemy reserves `metadata` as a keyword

**Found in all models**:
```python
class ChatGPTConversation(Base):
    __tablename__ = "chatgpt_conversations"
    custom_metadata = Column(JSONB, nullable=False)  # ✅ CORRECT

# ❌ WRONG - Will cause errors:
# metadata = Column(JSONB)  # Reserved keyword!
```

**Applies to**:
- All SQLAlchemy models
- All Pydantic schemas
- All API payloads
- All database columns

---

## 3. Existing Ingestion Pattern: ChatGPT Archives

### 3.1 Ingestion Flow

**Location**: `humanizer/services/chatgpt.py`

**Process**:
1. **Discovery**: Find archive folders (chat2-chat8)
2. **Parsing**: Parse conversations.json files
3. **Merging**: UUID-based temporal merge (latest wins)
4. **Media Matching**: Link file references to actual files
5. **Persistence**: Save to PostgreSQL with full provenance

### 3.2 Key Functions

**Archive Discovery**:
```python
def find_archives(home_dir: str, pattern: str = "chat[2-8]") -> List[Path]:
    """Find all ChatGPT archive folders matching pattern."""
    # Uses glob pattern matching
    # Validates presence of conversations.json
```

**JSON Parsing**:
```python
def parse_conversations_json(json_path: Path) -> List[Dict]:
    """Parse ChatGPT's conversations.json file."""
    # Handles both list and dict formats
    # Sanitizes null bytes (PostgreSQL JSONB incompatible)
```

**Data Sanitization**:
```python
def sanitize_json(obj):
    """Recursively remove null bytes from JSON."""
    # PostgreSQL JSONB doesn't support \u0000
    # Recursively processes dicts, lists, strings
```

**Content Extraction**:
```python
def extract_content_text(message: Dict) -> Optional[str]:
    """Extract text from various content structures."""
    # Handles content.parts (list of strings)
    # Handles direct string content
    # Handles text field
```

**Media Reference Extraction**:
```python
def extract_media_references(messages: List[Dict]) -> List[Dict]:
    """Find media file references in messages."""
    # Markdown images: ![alt](file-xxx.png)
    # Protocol refs: sediment://file_HASH
    # JSON attachments in metadata
```

**Media File Matching**:
```python
def find_media_file(archives: List[Path], file_id: str) -> Optional[Tuple[Path, str]]:
    """Find media file across all archives."""
    # Handles multiple ChatGPT archive formats:
    # - Top-level uploads: file-{ID}-{original}.ext
    # - files/ subdirectory
    # - dalle-generations/: file-{ID}-{UUID}.webp
    # - user-{alphanumeric}/: file_{HASH}-{UUID}.png
    # - {UUID}/audio/: file_{HASH}-{UUID}.wav
```

**Temporal Merging**:
```python
def merge_conversation_versions(versions: List[Dict]) -> Dict:
    """Merge multiple versions of same conversation."""
    # Latest update_time wins for metadata
    # Collect all unique messages
    # Keep latest version of each message
```

### 3.3 Database Models

**File**: `humanizer/models/chatgpt.py`

**ChatGPTConversation** (Primary entity):
```python
class ChatGPTConversation(Base):
    __tablename__ = "chatgpt_conversations"

    uuid = Column(PG_UUID(as_uuid=True), primary_key=True)
    title = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)
    source_archive = Column(String(100), nullable=False)
    custom_metadata = Column(JSONB, nullable=False)  # Full original JSON

    # Relationships
    messages = relationship("ChatGPTMessage", back_populates="conversation", cascade="all, delete-orphan")
    media = relationship("ChatGPTMedia", back_populates="conversation", cascade="all, delete-orphan")
    provenance = relationship("ChatGPTProvenance", back_populates="conversation", cascade="all, delete-orphan")
```

**ChatGPTMessage** (Content):
```python
class ChatGPTMessage(Base):
    __tablename__ = "chatgpt_messages"

    uuid = Column(PG_UUID(as_uuid=True), primary_key=True)
    conversation_uuid = Column(PG_UUID(as_uuid=True), ForeignKey("chatgpt_conversations.uuid"))
    created_at = Column(DateTime, nullable=True)
    author_role = Column(String(20), nullable=False)
    content_text = Column(Text, nullable=True)
    content_parts = Column(JSONB, nullable=True)
    custom_metadata = Column(JSONB, nullable=False)
    embedding = Column(Vector(1024), nullable=True)  # pgvector

    conversation = relationship("ChatGPTConversation", back_populates="messages")
```

**ChatGPTMedia** (File tracking):
```python
class ChatGPTMedia(Base):
    __tablename__ = "chatgpt_media"

    file_id = Column(String(200), primary_key=True)
    conversation_uuid = Column(PG_UUID(as_uuid=True), ForeignKey("chatgpt_conversations.uuid"))
    message_uuid = Column(PG_UUID(as_uuid=True), ForeignKey("chatgpt_messages.uuid"), nullable=True)
    file_path = Column(Text, nullable=True)  # Actual path on disk
    source_archive = Column(String(100), nullable=True)
    mime_type = Column(String(100), nullable=True)
    file_metadata = Column(JSONB, nullable=True)

    conversation = relationship("ChatGPTConversation", back_populates="media")
```

**ChatGPTProvenance** (Audit trail):
```python
class ChatGPTProvenance(Base):
    __tablename__ = "chatgpt_provenance"

    conversation_uuid = Column(PG_UUID(as_uuid=True), ForeignKey("chatgpt_conversations.uuid"), primary_key=True)
    archive_name = Column(String(100), primary_key=True)
    archive_date = Column(DateTime, nullable=True)
    message_count = Column(Integer, nullable=False, default=0)

    conversation = relationship("ChatGPTConversation", back_populates="provenance")
```

---

## 4. API Endpoint Patterns

### 4.1 Standard Router Structure

**File**: `humanizer/api/chatgpt.py` (342 lines)

**Pattern**:
```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from humanizer.database import get_session
from humanizer.services.chatgpt import service_function
from humanizer.models.schemas import RequestSchema, ResponseSchema

router = APIRouter(prefix="/api/chatgpt", tags=["chatgpt"])

@router.post("/ingest", response_model=ChatGPTIngestResponse)
async def ingest_chatgpt_archives(
    request: ChatGPTIngestRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Ingest ChatGPT conversation archives.

    Process: [detailed description]

    Args:
        request: Ingestion request

    Returns:
        ChatGPTIngestResponse with statistics
    """
    try:
        response = await ingest_archives(session, request)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ingest: {str(e)}"
        )
```

**Consistent Elements**:
1. Router prefix (`/api/...`)
2. Pydantic request/response models
3. Async session dependency
4. Comprehensive docstrings
5. Try/except with HTTPException
6. Delegation to service layer

### 4.2 Pagination Pattern

**Example**: `GET /api/chatgpt/conversations`

```python
@router.get("/conversations", response_model=ChatGPTConversationListResponse)
async def get_conversations_list(
    page: int = 1,
    page_size: int = 50,
    search: str = None,
    sort_by: str = "created_at",
    order: str = "desc",
    has_images: bool = None,
    has_latex: bool = None,
    gizmo_id: str = None,
    session: AsyncSession = Depends(get_session),
):
    """List all conversations with pagination, search, filtering."""

    # Validate parameters
    if page < 1:
        raise HTTPException(status_code=400, detail="Page must be >= 1")
    if page_size < 1 or page_size > 100:
        raise HTTPException(status_code=400, detail="Page size: 1-100")

    # Delegate to service
    response = await list_conversations(
        session, page, page_size, search, sort_by, order, ...
    )
    return response
```

**Pagination Response Schema**:
```python
class ChatGPTConversationListResponse(BaseModel):
    conversations: List[ChatGPTConversationListItem]
    total: int
    page: int
    page_size: int
    total_pages: int
```

### 4.3 Error Handling

**Consistent Pattern**:
```python
try:
    result = await service_function(session, request)
    return result
except HTTPException:
    raise  # Re-raise HTTP exceptions
except ValueError as e:
    raise HTTPException(status_code=404, detail=str(e))
except Exception as e:
    raise HTTPException(status_code=500, detail=f"Failed: {str(e)}")
```

---

## 5. Service Layer Patterns

### 5.1 Service Class Structure

**Example**: `humanizer/services/interest_list.py`

```python
class InterestListService:
    """Service for managing interest lists."""

    def __init__(self):
        """Initialize service (could inject dependencies)."""
        pass

    async def create_list(
        self,
        session: AsyncSession,
        user_id: UUID,
        name: str,
        description: Optional[str] = None,
        **kwargs
    ) -> InterestList:
        """Create a new interest list."""
        # Business logic here
        # Database operations
        # Return ORM model

    async def add_item(
        self,
        session: AsyncSession,
        list_id: UUID,
        item_type: str,
        item_uuid: UUID,
        **kwargs
    ) -> InterestListItem:
        """Add item to list."""
        # Validation
        # Position management
        # Persistence
```

**Service Responsibilities**:
- Business logic
- Data validation
- Database transactions
- ORM operations
- Return domain models (not Pydantic)

### 5.2 Async/Await Consistency

**ALL service functions are async**:
```python
async def ingest_archives(
    session: AsyncSession,
    request: ChatGPTIngestRequest
) -> ChatGPTIngestResponse:
    """Ingest archives."""

    # Async DB operations
    stmt = select(ChatGPTConversation).where(...)
    result = await session.execute(stmt)

    # Async commits
    await session.commit()

    return response
```

**No blocking calls** in async functions.

---

## 6. Database & Migration Patterns

### 6.1 Database Connection

**File**: `humanizer/database/connection.py`

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

DATABASE_URL = "postgresql+asyncpg://localhost/humanizer_dev"

engine = create_async_engine(DATABASE_URL, echo=True, poolclass=NullPool)
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for database sessions."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

**Key Features**:
- Async engine
- Async session factory
- Auto-commit on success
- Auto-rollback on error
- Session cleanup in finally

### 6.2 Model Definition Pattern

**Standard Structure**:
```python
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from humanizer.database import Base

class MyModel(Base):
    __tablename__ = "my_table"

    # Primary key (UUID recommended)
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Standard columns
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # JSON data (NOT metadata!)
    custom_metadata = Column(JSONB, nullable=True)

    # Vector embeddings
    embedding = Column(Vector(1024), nullable=True)

    # Foreign keys
    parent_id = Column(PG_UUID(as_uuid=True), ForeignKey("parent_table.id"))

    # Relationships
    parent = relationship("ParentModel", back_populates="children")
    children = relationship("ChildModel", back_populates="parent", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<MyModel id={self.id} name='{self.name}'>"
```

### 6.3 Migration Pattern (Alembic)

**Used throughout project**:
```bash
# Generate migration
alembic revision --autogenerate -m "Add file ingestion tables"

# Review migration (ALWAYS!)
# Edit if Alembic got it wrong

# Apply migration
alembic upgrade head

# Rollback if needed
alembic downgrade -1
```

**Never edit schema directly** - migrations are source of truth.

---

## 7. Configuration Management

### 7.1 Pydantic Settings

**File**: `humanizer/config.py`

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """Application settings."""

    # Database
    database_url: str = "postgresql+asyncpg://localhost/humanizer_dev"

    # TRM
    trm_rank: int = 64
    embedding_model: str = "all-MiniLM-L6-v2"

    # API
    api_title: str = "Humanizer API"
    api_version: str = "1.0.0"
    api_port: int = 8000

    # CORS
    cors_origins: str = "http://localhost:3000,http://localhost:3001,..."

    # AUI
    claude_model: str = "claude-haiku-4-5-20251001"
    claude_api_key: str = ""
    claude_enable_caching: bool = True
    aui_max_tokens: int = 4096

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse comma-separated origins."""
        return [o.strip() for o in self.cors_origins.split(",")]

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }

settings = Settings()
```

**Benefits**:
- Type-safe configuration
- Environment variable support
- Default values
- Validation
- No hardcoded values

---

## 8. File Ingestion: Design Recommendations

### 8.1 Proposed Architecture

**Pattern**: Follow ChatGPT archive model

**Components**:
1. **File Discovery Service** - Find files in specified directories
2. **File Parser Service** - Extract content (PDF, TXT, MD, DOCX, etc.)
3. **Content Chunking Service** - Split large documents
4. **Embedding Service** - Generate vector embeddings
5. **Persistence Service** - Save to database with provenance

### 8.2 Proposed Database Models

```python
# File: humanizer/models/document.py

class Document(Base):
    """
    An ingested document file.

    Supports: PDF, TXT, MD, DOCX, HTML, etc.
    """
    __tablename__ = "documents"

    # Primary key
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # File metadata
    filename = Column(String(500), nullable=False)
    file_path = Column(Text, nullable=False)  # Original file location
    file_size = Column(Integer, nullable=True)
    file_type = Column(String(50), nullable=False)  # 'pdf', 'txt', 'md', etc.
    mime_type = Column(String(100), nullable=True)
    file_hash = Column(String(64), nullable=False, unique=True, index=True)  # SHA256

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
    ingestion_batch_id = Column(PG_UUID(as_uuid=True), nullable=True)

    # Metadata
    custom_metadata = Column(JSONB, nullable=True)  # File-specific metadata

    # Relationships
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")
    media = relationship("DocumentMedia", back_populates="document", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Document id={self.id} file='{self.filename}'>"


class DocumentChunk(Base):
    """
    A chunk of a document (for large files).

    Enables:
    - Semantic search on document sections
    - Manageable embedding sizes
    - Context-aware retrieval
    """
    __tablename__ = "document_chunks"

    # Primary key
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

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
    - PDF images
    - Embedded diagrams
    - Screenshots
    - Charts/graphs
    """
    __tablename__ = "document_media"

    # Primary key
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Parent document
    document_id = Column(PG_UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False, index=True)

    # Media metadata
    media_type = Column(String(50), nullable=False)  # 'image', 'diagram', etc.
    file_path = Column(Text, nullable=False)
    mime_type = Column(String(100), nullable=True)
    file_size = Column(Integer, nullable=True)

    # Position in document
    page_number = Column(Integer, nullable=True)  # For PDFs

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
    - Bulk operations
    - Re-ingestion detection
    - Batch statistics
    - Provenance tracking
    """
    __tablename__ = "ingestion_batches"

    # Primary key
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Batch metadata
    source_directory = Column(Text, nullable=False)
    batch_type = Column(String(50), nullable=False)  # 'pdf', 'mixed', 'txt', etc.

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

    def __repr__(self) -> str:
        return f"<IngestionBatch id={self.id} files={self.total_files}>"
```

### 8.3 Proposed API Endpoints

```python
# File: humanizer/api/documents.py

router = APIRouter(prefix="/api/documents", tags=["documents"])

# Ingestion
POST   /api/documents/ingest           # Ingest files from directory
POST   /api/documents/ingest/file      # Ingest single file upload
GET    /api/documents/batches          # List ingestion batches
GET    /api/documents/batches/{id}     # Get batch details

# Retrieval
GET    /api/documents                  # List all documents (paginated)
GET    /api/documents/{id}             # Get document details
GET    /api/documents/{id}/content     # Get full text
GET    /api/documents/{id}/chunks      # Get chunks
GET    /api/documents/{id}/media       # Get extracted media

# Search
POST   /api/documents/search           # Semantic search across all docs
POST   /api/documents/{id}/search      # Search within document

# Export
GET    /api/documents/{id}/export      # Export document (various formats)

# Management
PATCH  /api/documents/{id}             # Update metadata
DELETE /api/documents/{id}             # Delete document
POST   /api/documents/{id}/re-ingest   # Re-process document
```

### 8.4 Proposed Service Layer

```python
# File: humanizer/services/document_ingestion.py

class DocumentIngestionService:
    """Service for ingesting various file types."""

    def __init__(self):
        self.parsers = {
            'pdf': PDFParser(),
            'txt': TextParser(),
            'md': MarkdownParser(),
            'docx': DocxParser(),
            'html': HTMLParser(),
        }
        self.embedding_service = EmbeddingService()
        self.chunker = DocumentChunker(chunk_size=1000, overlap=100)

    async def ingest_directory(
        self,
        session: AsyncSession,
        directory: str,
        file_types: List[str] = None,
        recursive: bool = True,
        force_reimport: bool = False,
    ) -> IngestionBatchResult:
        """
        Ingest all files from a directory.

        Process:
        1. Discover files matching types
        2. Check for duplicates (by file hash)
        3. Parse each file
        4. Extract metadata
        5. Chunk large documents
        6. Generate embeddings
        7. Save to database

        Args:
            session: Database session
            directory: Path to directory
            file_types: Filter by types (e.g., ['pdf', 'txt'])
            recursive: Search subdirectories
            force_reimport: Re-import existing files

        Returns:
            IngestionBatchResult with statistics
        """
        # Implementation follows ChatGPT archive pattern

    async def ingest_file(
        self,
        session: AsyncSession,
        file_path: str,
        force_reimport: bool = False,
    ) -> Document:
        """
        Ingest a single file.

        Process:
        1. Compute file hash
        2. Check if already ingested
        3. Detect file type
        4. Parse content
        5. Extract metadata
        6. Chunk if needed
        7. Generate embeddings
        8. Save to database

        Args:
            session: Database session
            file_path: Path to file
            force_reimport: Re-import if exists

        Returns:
            Document ORM model
        """
        # Implementation

    def _compute_file_hash(self, file_path: str) -> str:
        """Compute SHA256 hash of file."""
        # For duplicate detection

    def _detect_file_type(self, file_path: str) -> str:
        """Detect file type from extension/MIME."""
        # Returns: 'pdf', 'txt', 'md', 'docx', etc.

    async def _parse_file(self, file_path: str, file_type: str) -> ParsedDocument:
        """Parse file and extract content."""
        parser = self.parsers.get(file_type)
        return await parser.parse(file_path)

    async def _chunk_document(
        self,
        document: Document,
        content: str
    ) -> List[DocumentChunk]:
        """Chunk large document into manageable pieces."""
        # Uses DocumentChunker

    async def _generate_embeddings(
        self,
        chunks: List[DocumentChunk]
    ) -> None:
        """Generate embeddings for chunks."""
        # Uses EmbeddingService
```

### 8.5 File Parsers

```python
# File: humanizer/services/parsers/base.py

class BaseParser(ABC):
    """Base class for file parsers."""

    @abstractmethod
    async def parse(self, file_path: str) -> ParsedDocument:
        """Parse file and extract content."""
        pass


# File: humanizer/services/parsers/pdf.py

class PDFParser(BaseParser):
    """Parse PDF files using PyPDF2 or pdfplumber."""

    async def parse(self, file_path: str) -> ParsedDocument:
        """
        Extract text and metadata from PDF.

        Handles:
        - Text extraction
        - Metadata (title, author, etc.)
        - Images
        - Page numbers
        """
        # Implementation using PyPDF2 or pdfplumber


# File: humanizer/services/parsers/text.py

class TextParser(BaseParser):
    """Parse plain text files."""

    async def parse(self, file_path: str) -> ParsedDocument:
        """Simple text file parsing."""
        # Read file, detect encoding, extract content


# File: humanizer/services/parsers/markdown.py

class MarkdownParser(BaseParser):
    """Parse Markdown files."""

    async def parse(self, file_path: str) -> ParsedDocument:
        """
        Parse Markdown with structure preservation.

        Extracts:
        - Plain text content
        - Headings (for chunking)
        - Links
        - Images
        - Code blocks
        """
        # Implementation using markdown parser
```

### 8.6 Document Chunking Strategy

```python
# File: humanizer/services/document_chunker.py

class DocumentChunker:
    """Intelligent document chunking."""

    def __init__(
        self,
        chunk_size: int = 1000,
        overlap: int = 100,
        respect_paragraphs: bool = True,
        respect_sentences: bool = True,
    ):
        self.chunk_size = chunk_size
        self.overlap = overlap
        self.respect_paragraphs = respect_paragraphs
        self.respect_sentences = respect_sentences

    def chunk(self, text: str, document_metadata: Dict = None) -> List[ChunkData]:
        """
        Chunk document intelligently.

        Strategy:
        1. Split on paragraphs if possible
        2. Split on sentences if paragraph too large
        3. Hard split if sentence too large
        4. Add overlap between chunks for context

        Returns:
            List of ChunkData with text, position, metadata
        """
        # Implementation
```

### 8.7 Pydantic Schemas

```python
# File: humanizer/models/schemas.py (additions)

class DocumentIngestRequest(BaseModel):
    """Request to ingest documents from directory."""
    source_directory: str = Field(..., description="Directory containing files")
    file_types: Optional[List[str]] = Field(
        default=None,
        description="Filter by file types: ['pdf', 'txt', 'md']"
    )
    recursive: bool = Field(default=True, description="Search subdirectories")
    force_reimport: bool = Field(default=False, description="Re-import existing files")
    chunk_size: int = Field(default=1000, description="Chunk size for large documents")
    generate_embeddings: bool = Field(default=True, description="Generate embeddings")

class DocumentIngestResponse(BaseModel):
    """Response from document ingestion."""
    batch_id: UUID
    total_files: int
    successful: int
    failed: int
    skipped: int
    processing_time_ms: int
    errors: List[Dict]

class DocumentResponse(BaseModel):
    """Response with document details."""
    id: UUID
    filename: str
    file_type: str
    title: Optional[str]
    author: Optional[str]
    file_size: Optional[int]
    chunk_count: int
    media_count: int
    ingested_at: datetime
    custom_metadata: Optional[Dict]

class DocumentSearchRequest(BaseModel):
    """Request to search documents."""
    query: str = Field(..., description="Search query")
    limit: int = Field(default=20, description="Max results")
    file_types: Optional[List[str]] = Field(default=None)
    semantic: bool = Field(default=True, description="Use semantic search")

class DocumentSearchResponse(BaseModel):
    """Response from document search."""
    results: List[DocumentChunkResult]
    total: int
    processing_time_ms: int

class DocumentChunkResult(BaseModel):
    """Search result for a document chunk."""
    chunk_id: UUID
    document_id: UUID
    document_title: str
    chunk_text: str
    score: float
    page_number: Optional[int]
    chunk_index: int
```

---

## 9. Best Practices Summary

### 9.1 Critical Rules

1. **NEVER use `metadata`** → Always use `custom_metadata` (SQLAlchemy reserved)
2. **ALWAYS use SQLAlchemy 2.0** → `select()`, async, no `query()`
3. **ALWAYS use Pydantic** → Request/response schemas, validation
4. **ALWAYS use async/await** → No blocking calls in async functions
5. **ALWAYS add router prefix** → `/api/...` for consistency
6. **ALWAYS use type hints** → Full type coverage
7. **ALWAYS use Alembic** → Never edit DB schema directly
8. **ALWAYS sanitize JSON** → Remove null bytes for PostgreSQL JSONB
9. **ALWAYS compute file hashes** → For duplicate detection
10. **ALWAYS track provenance** → Source, batch, timestamps

### 9.2 Code Style

**Imports**:
```python
# Standard library
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict
from uuid import UUID

# Third-party
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

# Local
from humanizer.database import get_session
from humanizer.services.my_service import my_function
from humanizer.models.my_model import MyModel
from humanizer.models.schemas import MyRequest, MyResponse
```

**Docstrings**:
```python
def my_function(arg1: str, arg2: int) -> Dict:
    """
    One-line summary.

    Longer description with details about:
    - What this function does
    - Key behavior
    - Important constraints

    Args:
        arg1: Description
        arg2: Description

    Returns:
        Description of return value

    Raises:
        ValueError: When...
    """
```

**Type Hints**:
```python
# ✅ CORRECT - Full type coverage
async def process_file(
    file_path: str,
    options: Optional[Dict[str, Any]] = None
) -> ParsedDocument:
    """Process file."""
    result: ParsedDocument = await parser.parse(file_path)
    return result

# ❌ WRONG - No type hints
async def process_file(file_path, options=None):
    result = await parser.parse(file_path)
    return result
```

---

## 10. Implementation Roadmap

### Phase 1: Core Infrastructure (Week 1)
1. Create database models (Document, DocumentChunk, DocumentMedia, IngestionBatch)
2. Generate Alembic migration
3. Apply migration
4. Implement base parser interface

### Phase 2: File Parsers (Week 2)
1. Implement PDFParser (PyPDF2 or pdfplumber)
2. Implement TextParser
3. Implement MarkdownParser
4. Implement DocxParser (python-docx)
5. Test each parser

### Phase 3: Ingestion Service (Week 3)
1. Implement DocumentIngestionService
2. File discovery logic
3. Duplicate detection (file hash)
4. Content extraction pipeline
5. Error handling and logging

### Phase 4: Chunking & Embeddings (Week 4)
1. Implement DocumentChunker
2. Integrate EmbeddingService
3. Batch embedding generation
4. Optimize for large documents

### Phase 5: API Layer (Week 5)
1. Create documents router
2. Implement ingestion endpoints
3. Implement retrieval endpoints
4. Implement search endpoints
5. API documentation

### Phase 6: Testing & Optimization (Week 6)
1. Unit tests for parsers
2. Integration tests for ingestion
3. Performance testing
4. Error handling tests
5. Documentation

---

## 11. Key Insights

### 11.1 Architectural Strengths

1. **Clear Separation of Concerns** - Router → Service → Model pattern is consistent
2. **Type Safety** - Pydantic + SQLAlchemy 2.0 + type hints throughout
3. **Async Throughout** - No blocking calls, proper async/await usage
4. **Excellent Error Handling** - Consistent HTTPException usage
5. **Comprehensive Documentation** - Docstrings, OpenAPI, examples
6. **Provenance Tracking** - Full audit trail (ChatGPTProvenance model)
7. **Flexible Metadata** - JSONB for extensibility

### 11.2 Patterns to Replicate

1. **UUID-based Merging** - ChatGPT temporal merge (latest wins)
2. **File Discovery** - Glob patterns, validation
3. **Media Matching** - Reference extraction, path resolution
4. **Batch Processing** - Batch tracking, statistics, error logging
5. **Pagination** - Standard pattern with page, page_size, total_pages
6. **Relationship Cascades** - `cascade="all, delete-orphan"` for cleanup

### 11.3 Lessons from ChatGPT Ingestion

1. **Null Byte Sanitization** - PostgreSQL JSONB requires it
2. **Multiple File Locations** - Search multiple paths for media
3. **Format Variations** - Handle multiple JSON structures
4. **Temporal Merging** - Handle duplicate entities intelligently
5. **Provenance** - Track which sources contributed what
6. **Media Extraction** - Multiple detection methods (markdown, JSON, protocols)

---

## 12. Recommendations for File Ingestion

### 12.1 Follow Existing Patterns

✅ **DO**:
- Use same router → service → model architecture
- Use Pydantic for all request/response schemas
- Use async/await throughout
- Use SQLAlchemy 2.0 patterns
- Use `custom_metadata` column for extensibility
- Track provenance (batch ID, source directory, timestamps)
- Compute file hashes for duplicate detection
- Support pagination for large result sets
- Handle errors consistently (HTTPException)
- Document thoroughly (docstrings + OpenAPI examples)

❌ **DON'T**:
- Mix blocking/async code
- Use `metadata` column name (SQLAlchemy reserved!)
- Skip Alembic migrations
- Hardcode configuration values
- Forget type hints
- Skip input validation
- Return ORM models from API (use Pydantic)

### 12.2 Extend ChatGPT Pattern

**Similarities**:
- File discovery (glob patterns)
- Duplicate detection (hash-based)
- Batch processing (track statistics)
- Provenance tracking (source, timestamps)
- Media extraction (images, attachments)
- Metadata preservation (JSONB)

**Differences**:
- **Content Structure**: Documents have pages/sections (vs. messages)
- **Chunking**: Large documents need intelligent chunking
- **File Types**: Multiple parsers needed (vs. JSON only)
- **Embeddings**: Per-chunk (vs. per-message)

### 12.3 Key Design Decisions

**File Hash for Primary Key vs UUID**:
- **Recommendation**: UUID primary key, file_hash as unique index
- **Reason**: Allows re-ingestion with different metadata

**Chunking Strategy**:
- **Recommendation**: Respect document structure (paragraphs, sections)
- **Chunk Size**: 1000 chars default (configurable)
- **Overlap**: 100 chars for context preservation

**Embedding Scope**:
- **Recommendation**: Per-chunk embeddings (not per-document)
- **Reason**: Better semantic search granularity

**Media Extraction**:
- **Recommendation**: Extract during ingestion, store separately
- **Reason**: Enables media-specific operations

**Re-ingestion Strategy**:
- **Recommendation**: Check file_hash, optionally update metadata
- **Reason**: Avoid duplicate storage

---

## 13. Conclusion

**The Humanizer API demonstrates excellent software engineering practices:**
- Modern Python/FastAPI patterns
- Type-safe, async/await throughout
- Clear architectural boundaries
- Comprehensive error handling
- Excellent documentation

**The ChatGPT archive ingestion provides a solid template for file ingestion:**
- Discovery → Parsing → Merging → Media Matching → Persistence
- Provenance tracking
- Batch processing
- Error handling

**Recommendation**: Follow the established patterns closely. The architecture is sound and extensible. File ingestion can be implemented as a natural extension of the existing codebase with minimal friction.

**Estimated Effort**: 6 weeks for full implementation (parsers, chunking, embeddings, API, tests)

**Next Steps**:
1. Review and approve this plan
2. Create database models
3. Implement parsers incrementally
4. Build service layer
5. Create API endpoints
6. Test thoroughly

---

**Document Status**: Complete
**Date**: October 17, 2025
**Reviewed By**: Claude (Sonnet 4.5)
**Ready for**: Memory Agent Storage + User Review
