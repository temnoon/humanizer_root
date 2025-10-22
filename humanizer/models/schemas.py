"""
Pydantic schemas for API request/response validation

All API interfaces use Pydantic for:
- Type safety
- Automatic validation
- OpenAPI documentation
- Clear contracts
"""

from datetime import datetime
from uuid import UUID
from typing import Optional, Dict, List, Any
from pydantic import BaseModel, Field


# ========================================
# Reading Schemas
# ========================================

class ReadingStartRequest(BaseModel):
    """Request to start a reading session."""
    text: str = Field(..., description="Text to read", min_length=1)
    povm_packs: Optional[List[str]] = Field(
        default=["tetralemma"],
        description="POVM packs to use for measurements"
    )
    trm_rank: Optional[int] = Field(default=64, ge=16, le=128, description="ρ matrix rank")

    model_config = {"json_schema_extra": {
        "example": {
            "text": "The mind constructs reality through language.",
            "povm_packs": ["tetralemma", "tone"],
            "trm_rank": 64
        }
    }}


class ReadingStartResponse(BaseModel):
    """Response from starting a reading session."""
    reading_id: UUID
    step: int = 0
    y_text: str
    rho_meta: Dict  # {eigenvalues: [...], purity: 0.5, entropy: 1.2}
    povm_readings: Dict[str, Dict[str, float]]  # {tetralemma: {A: 0.4, ...}}
    stance: Optional[Dict[str, float]] = None
    halt_p: float

    model_config = {"json_schema_extra": {
        "example": {
            "reading_id": "550e8400-e29b-41d4-a716-446655440000",
            "step": 0,
            "y_text": "The mind constructs reality through language.",
            "rho_meta": {"purity": 0.85, "entropy": 0.5},
            "povm_readings": {
                "tetralemma": {"A": 0.4, "¬A": 0.3, "both": 0.2, "neither": 0.1}
            },
            "stance": {"A": 0.4, "¬A": 0.3, "both": 0.2, "neither": 0.1},
            "halt_p": 0.1
        }
    }}


class ReadingStepRequest(BaseModel):
    """Request to execute one TRM step."""
    reading_id: UUID
    max_steps: Optional[int] = Field(default=1, ge=1, le=10)

    model_config = {"json_schema_extra": {
        "example": {
            "reading_id": "550e8400-e29b-41d4-a716-446655440000",
            "max_steps": 1
        }
    }}


class ReadingStepResponse(BaseModel):
    """Response from executing a TRM step."""
    reading_id: UUID
    step: int
    y_text: str
    dy_summary: str  # What changed
    rho_delta: float  # Distance from previous ρ
    povm_readings: Dict[str, Dict[str, float]]
    corner_views: Optional[Dict[str, str]] = None  # {A: "...", ¬A: "...", ...}
    halt_p: float

    model_config = {"json_schema_extra": {
        "example": {
            "reading_id": "550e8400-e29b-41d4-a716-446655440000",
            "step": 1,
            "y_text": "Consciousness shapes experience via linguistic categories.",
            "dy_summary": "Refined 'mind' → 'consciousness', 'constructs' → 'shapes'",
            "rho_delta": 0.15,
            "povm_readings": {
                "tetralemma": {"A": 0.5, "¬A": 0.25, "both": 0.15, "neither": 0.1}
            },
            "corner_views": {
                "A": "Reality is fully linguistic...",
                "¬A": "Reality exists independently...",
                "both": "Language and reality co-arise...",
                "neither": "This transcends the dichotomy..."
            },
            "halt_p": 0.3
        }
    }}


class ReadingMeasureRequest(BaseModel):
    """Request to measure with additional POVM packs."""
    reading_id: UUID
    povm_pack: str = Field(..., description="POVM pack name")

    model_config = {"json_schema_extra": {
        "example": {
            "reading_id": "550e8400-e29b-41d4-a716-446655440000",
            "povm_pack": "ontology"
        }
    }}


class ReadingMeasureResponse(BaseModel):
    """Response from POVM measurement."""
    reading_id: UUID
    step: int
    povm_pack: str
    readings: Dict[str, float]

    model_config = {"json_schema_extra": {
        "example": {
            "reading_id": "550e8400-e29b-41d4-a716-446655440000",
            "step": 1,
            "povm_pack": "ontology",
            "readings": {
                "corporeal": 0.2,
                "subjective": 0.4,
                "objective": 0.3,
                "mixed_frame": 0.1
            }
        }
    }}


class ReadingApplyRequest(BaseModel):
    """Request to apply a corner view or transformation."""
    reading_id: UUID
    corner: str = Field(..., description="Which corner to apply: A, ¬A, both, neither")

    model_config = {"json_schema_extra": {
        "example": {
            "reading_id": "550e8400-e29b-41d4-a716-446655440000",
            "corner": "both"
        }
    }}


class ReadingApplyResponse(BaseModel):
    """Response from applying corner view."""
    reading_id: UUID
    step: int
    y_text: str  # Updated text
    provenance: Dict  # Audit trail

    model_config = {"json_schema_extra": {
        "example": {
            "reading_id": "550e8400-e29b-41d4-a716-446655440000",
            "step": 2,
            "y_text": "Language and reality co-arise in experience.",
            "provenance": {
                "action": "apply_corner",
                "corner": "both",
                "applied_at": "2025-10-10T22:30:00Z"
            }
        }
    }}


class ReadingTraceResponse(BaseModel):
    """Response with full reading trajectory."""
    reading_id: UUID
    original_text: str
    steps: List[Dict]  # All steps with full data
    metrics: Dict  # {rho_distances: [...], halt_curve: [...]}

    model_config = {"json_schema_extra": {
        "example": {
            "reading_id": "550e8400-e29b-41d4-a716-446655440000",
            "original_text": "The mind constructs reality.",
            "steps": [
                {"step": 0, "y_text": "...", "povm_readings": {...}},
                {"step": 1, "y_text": "...", "povm_readings": {...}}
            ],
            "metrics": {
                "rho_distances": [0, 0.15, 0.22],
                "halt_curve": [0.1, 0.3, 0.6]
            }
        }
    }}


# ========================================
# Transform Schemas (High-Level)
# ========================================

class TransformRequest(BaseModel):
    """High-level transformation request (one-shot)."""
    text: str = Field(..., description="Text to transform")
    targets: Dict[str, str] = Field(..., description="Target POVM axes", examples=[{"tone": "analytical"}])
    constraints: Optional[Dict] = Field(default=None, description="Transformation constraints")

    model_config = {"json_schema_extra": {
        "example": {
            "text": "The dog ran quickly.",
            "targets": {"tone": "formal"},
            "constraints": {"preserve_entities": True}
        }
    }}


class TransformResponse(BaseModel):
    """Response from transformation."""
    original_text: str
    transformed_text: str
    verification: Dict  # VerificationResult
    povm_readings_before: Dict
    povm_readings_after: Dict

    model_config = {"json_schema_extra": {
        "example": {
            "original_text": "The dog ran quickly.",
            "transformed_text": "The canine proceeded with haste.",
            "verification": {
                "success": True,
                "alignment": 0.85,
                "magnitude": 0.12
            },
            "povm_readings_before": {"tone": {"formal": 0.2, "casual": 0.5}},
            "povm_readings_after": {"tone": {"formal": 0.7, "casual": 0.1}}
        }
    }}


# ========================================
# POVM Schemas
# ========================================

class POVMMeasureRequest(BaseModel):
    """Request to measure an embedding with a POVM pack."""
    embedding: List[float] = Field(..., description="Embedding vector (384-dim)")
    povm_pack: str = Field(..., description="POVM pack name")

    model_config = {"json_schema_extra": {
        "example": {
            "embedding": [0.1, -0.2, 0.3],  # Abbreviated for example
            "povm_pack": "tetralemma"
        }
    }}


class POVMMeasureResponse(BaseModel):
    """Response from POVM measurement."""
    povm_pack: str
    readings: Dict[str, float]

    model_config = {"json_schema_extra": {
        "example": {
            "povm_pack": "tetralemma",
            "readings": {"A": 0.4, "¬A": 0.3, "both": 0.2, "neither": 0.1}
        }
    }}


class POVMListResponse(BaseModel):
    """Response listing all available POVM packs."""
    packs: List[Dict]  # [{name: "tetralemma", axes: [...], ...}]

    model_config = {"json_schema_extra": {
        "example": {
            "packs": [
                {"name": "tetralemma", "axes": ["A", "¬A", "both", "neither"]},
                {"name": "tone", "axes": ["analytical", "critical", "empathic", "playful", "neutral"]}
            ]
        }
    }}


# ========================================
# Library Schemas
# ========================================

class BookResponse(BaseModel):
    """Response with book information."""
    id: UUID
    title: str
    author: Optional[str]
    custom_metadata: Optional[Dict]  # NOT metadata!
    created_at: datetime
    chunk_count: Optional[int] = None

    model_config = {"from_attributes": True, "json_schema_extra": {
        "example": {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "title": "Phenomenology of Spirit",
            "author": "Hegel",
            "custom_metadata": {"tags": ["philosophy", "german"]},
            "created_at": "2025-01-01T00:00:00Z",
            "chunk_count": 245
        }
    }}


class ChunkResponse(BaseModel):
    """Response with chunk information."""
    id: UUID
    book_id: UUID
    content: str
    custom_metadata: Optional[Dict]  # NOT metadata!
    created_at: datetime

    model_config = {"from_attributes": True, "json_schema_extra": {
        "example": {
            "id": "660e8400-e29b-41d4-a716-446655440000",
            "book_id": "550e8400-e29b-41d4-a716-446655440000",
            "content": "Consciousness is self-mediating.",
            "custom_metadata": {"page": 42, "chapter": 3},
            "created_at": "2025-01-01T00:00:00Z"
        }
    }}


class LibrarySearchRequest(BaseModel):
    """Request to search library semantically."""
    query: str = Field(..., description="Search query")
    limit: Optional[int] = Field(default=10, ge=1, le=100)

    model_config = {"json_schema_extra": {
        "example": {
            "query": "meditation and awareness",
            "limit": 10
        }
    }}


class LibrarySearchResponse(BaseModel):
    """Response from library search."""
    results: List[ChunkResponse]
    count: int

    model_config = {"json_schema_extra": {
        "example": {
            "results": [
                {
                    "id": "660e8400-e29b-41d4-a716-446655440000",
                    "book_id": "550e8400-e29b-41d4-a716-446655440000",
                    "content": "Mindfulness reveals the constructed nature of experience.",
                    "custom_metadata": {},
                    "created_at": "2025-01-01T00:00:00Z"
                }
            ],
            "count": 1
        }
    }}


class LibraryStatsResponse(BaseModel):
    """Response with library statistics."""
    books_count: int
    chunks_count: int
    embeddings_count: int
    coverage: float  # Percentage of chunks with embeddings

    model_config = {"json_schema_extra": {
        "example": {
            "books_count": 42,
            "chunks_count": 5234,
            "embeddings_count": 4987,
            "coverage": 0.95
        }
    }}


# ========================================
# User Schemas
# ========================================

class UserPreferencesResponse(BaseModel):
    """Response with user preferences."""
    user_id: UUID
    tool_usage: Optional[Dict]
    patterns: Optional[Dict]
    preferences: Optional[Dict]
    updated_at: datetime

    model_config = {"from_attributes": True, "json_schema_extra": {
        "example": {
            "user_id": "770e8400-e29b-41d4-a716-446655440000",
            "tool_usage": {"read_quantum": {"count": 42, "success_rate": 0.85}},
            "patterns": {"frequent_povm": "tetralemma", "prefers_corner": "both"},
            "preferences": {"dark_mode": True, "show_trajectories": True},
            "updated_at": "2025-10-10T22:30:00Z"
        }
    }}


# ========================================
# ChatGPT Archive Schemas
# ========================================

class ChatGPTIngestRequest(BaseModel):
    """Request to ingest ChatGPT archives."""
    home_dir: str = Field(..., description="Home directory to search for chat2-chat8 folders")
    archive_pattern: Optional[str] = Field(
        default="chat[2-8]",
        description="Pattern to match archive folders"
    )
    force_reimport: Optional[bool] = Field(
        default=False,
        description="Force re-import even if conversation exists"
    )

    model_config = {"json_schema_extra": {
        "example": {
            "home_dir": "/Users/tem",
            "archive_pattern": "chat[2-8]",
            "force_reimport": False
        }
    }}


class ChatGPTIngestResponse(BaseModel):
    """Response from ChatGPT archive ingestion."""
    archives_found: int
    conversations_processed: int
    messages_imported: int
    media_files_found: int
    media_files_matched: int
    errors: List[str] = Field(default_factory=list)
    processing_time_seconds: float

    model_config = {"json_schema_extra": {
        "example": {
            "archives_found": 7,
            "conversations_processed": 423,
            "messages_imported": 8765,
            "media_files_found": 234,
            "media_files_matched": 198,
            "errors": [],
            "processing_time_seconds": 12.5
        }
    }}


class ChatGPTConversationResponse(BaseModel):
    """Response with conversation details."""
    uuid: UUID
    title: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    source_archive: str
    message_count: int
    media_count: int
    custom_metadata: Dict

    model_config = {"from_attributes": True, "json_schema_extra": {
        "example": {
            "uuid": "880e8400-e29b-41d4-a716-446655440000",
            "title": "Discussion about quantum consciousness",
            "created_at": "2024-05-15T10:30:00Z",
            "updated_at": "2024-05-15T12:45:00Z",
            "source_archive": "chat5",
            "message_count": 24,
            "media_count": 3,
            "custom_metadata": {"create_time": 1715771400.0}
        }
    }}


class ChatGPTMessageResponse(BaseModel):
    """Response with message details."""
    uuid: UUID
    conversation_uuid: UUID
    created_at: Optional[datetime]
    author_role: str
    content_text: Optional[str]
    content_parts: Optional[List]
    custom_metadata: Dict

    model_config = {"from_attributes": True, "json_schema_extra": {
        "example": {
            "uuid": "990e8400-e29b-41d4-a716-446655440000",
            "conversation_uuid": "880e8400-e29b-41d4-a716-446655440000",
            "created_at": "2024-05-15T10:31:00Z",
            "author_role": "user",
            "content_text": "Can you explain quantum consciousness?",
            "content_parts": ["Can you explain quantum consciousness?"],
            "custom_metadata": {"create_time": 1715771460.0}
        }
    }}


class ChatGPTSearchRequest(BaseModel):
    """Request to search ChatGPT messages."""
    query: str = Field(..., description="Search query text")
    limit: Optional[int] = Field(default=20, ge=1, le=100)
    conversation_uuid: Optional[UUID] = Field(
        default=None,
        description="Limit search to specific conversation"
    )
    author_role: Optional[str] = Field(
        default=None,
        description="Filter by author role (user, assistant, system)"
    )
    date_from: Optional[datetime] = Field(
        default=None,
        description="Filter messages from this date"
    )
    date_to: Optional[datetime] = Field(
        default=None,
        description="Filter messages to this date"
    )

    model_config = {"json_schema_extra": {
        "example": {
            "query": "quantum consciousness",
            "limit": 20,
            "author_role": "user",
            "date_from": "2024-01-01T00:00:00Z",
            "date_to": "2024-12-31T23:59:59Z"
        }
    }}


class ChatGPTSearchResponse(BaseModel):
    """Response from ChatGPT message search."""
    results: List[ChatGPTMessageResponse]
    count: int
    query: str

    model_config = {"json_schema_extra": {
        "example": {
            "results": [
                {
                    "uuid": "990e8400-e29b-41d4-a716-446655440000",
                    "conversation_uuid": "880e8400-e29b-41d4-a716-446655440000",
                    "created_at": "2024-05-15T10:31:00Z",
                    "author_role": "user",
                    "content_text": "Can you explain quantum consciousness?",
                    "content_parts": ["Can you explain quantum consciousness?"],
                    "custom_metadata": {}
                }
            ],
            "count": 1,
            "query": "quantum consciousness"
        }
    }}


class ChatGPTConversationListItem(BaseModel):
    """Single conversation item for list view."""
    uuid: UUID
    title: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    source_archive: str
    message_count: int
    media_count: int

    model_config = {"from_attributes": True, "json_schema_extra": {
        "example": {
            "uuid": "880e8400-e29b-41d4-a716-446655440000",
            "title": "Introducing Narrative Scope",
            "created_at": "2024-05-15T10:30:00Z",
            "updated_at": "2024-05-15T12:45:00Z",
            "source_archive": "chat7",
            "message_count": 24,
            "media_count": 3
        }
    }}


class ChatGPTConversationListResponse(BaseModel):
    """Response with list of conversations."""
    conversations: List[ChatGPTConversationListItem]
    total: int
    page: int
    page_size: int
    total_pages: int

    model_config = {"json_schema_extra": {
        "example": {
            "conversations": [
                {
                    "uuid": "880e8400-e29b-41d4-a716-446655440000",
                    "title": "Introducing Narrative Scope",
                    "created_at": "2024-05-15T10:30:00Z",
                    "updated_at": "2024-05-15T12:45:00Z",
                    "source_archive": "chat7",
                    "message_count": 24,
                    "media_count": 3
                }
            ],
            "total": 1659,
            "page": 1,
            "page_size": 50,
            "total_pages": 34
        }
    }}


class ChatGPTArchiveStatsResponse(BaseModel):
    """Response with ChatGPT archive statistics."""
    total_conversations: int
    total_messages: int
    total_media: int
    archives_ingested: List[str]
    date_range: Optional[Dict] = None  # {earliest: datetime, latest: datetime}
    top_conversations: List[Dict] = Field(default_factory=list)  # [{title, message_count}]

    model_config = {"json_schema_extra": {
        "example": {
            "total_conversations": 423,
            "total_messages": 8765,
            "total_media": 234,
            "archives_ingested": ["chat2", "chat3", "chat4", "chat5", "chat6", "chat7", "chat8"],
            "date_range": {
                "earliest": "2023-01-15T08:30:00Z",
                "latest": "2024-10-10T22:00:00Z"
            },
            "top_conversations": [
                {"title": "Quantum TRM Development", "message_count": 156},
                {"title": "Philosophy of Mind", "message_count": 94}
            ]
        }
    }}


class ChatGPTRenderRequest(BaseModel):
    """Request to render a conversation."""
    pagination: Optional[bool] = Field(default=False, description="Enable pagination")
    messages_per_page: Optional[int] = Field(default=50, description="Messages per page (if pagination enabled)")
    include_media: Optional[bool] = Field(default=True, description="Include embedded media in output")

    model_config = {"json_schema_extra": {
        "example": {
            "pagination": False,
            "messages_per_page": 50,
            "include_media": True
        }
    }}


class ChatGPTRenderResponse(BaseModel):
    """Response with rendered conversation."""
    conversation_uuid: UUID
    title: Optional[str]
    total_messages: int
    total_pages: int
    current_page: int
    markdown: str  # Rendered markdown content
    media_refs: List[Dict] = Field(default_factory=list)  # [{file_id, url, mime_type}]

    model_config = {"json_schema_extra": {
        "example": {
            "conversation_uuid": "880e8400-e29b-41d4-a716-446655440000",
            "title": "Discussion about quantum consciousness",
            "total_messages": 24,
            "total_pages": 1,
            "current_page": 1,
            "markdown": "# Discussion about quantum consciousness\n\n**User**: Can you explain...",
            "media_refs": [{"file_id": "file-abc123", "url": "/chatgpt/media/file-abc123", "mime_type": "image/png"}]
        }
    }}


class ChatGPTExportRequest(BaseModel):
    """Request to export a conversation."""
    format: str = Field(..., description="Export format: raw_markdown, rendered_html, pdf")
    include_media: Optional[bool] = Field(default=True, description="Include media in export")
    pagination: Optional[bool] = Field(default=False, description="Enable pagination (for HTML/PDF)")
    messages_per_page: Optional[int] = Field(default=50, description="Messages per page")

    # PDF-specific options
    pdf_page_size: Optional[str] = Field(
        default="A4",
        description="PDF page size: A4, Letter, Legal, A3, A5, Tabloid, or custom (e.g., '8.5x11in')"
    )
    pdf_margins: Optional[Dict[str, str]] = Field(
        default=None,
        description="PDF margins: {top, right, bottom, left} in CSS units (e.g., '1in', '2.5cm')"
    )
    pdf_include_toc: Optional[bool] = Field(
        default=True,
        description="Include table of contents in PDF"
    )

    model_config = {"json_schema_extra": {
        "example": {
            "format": "rendered_html",
            "include_media": True,
            "pagination": False,
            "messages_per_page": 50,
            "pdf_page_size": "Letter",
            "pdf_margins": {"top": "1in", "right": "0.75in", "bottom": "1in", "left": "0.75in"}
        }
    }}


class ChatGPTExportResponse(BaseModel):
    """Response with exported conversation."""
    conversation_uuid: UUID
    title: Optional[str]
    format: str
    content: str  # Exported content (markdown/HTML) or base64 (PDF)
    media_count: int

    model_config = {"json_schema_extra": {
        "example": {
            "conversation_uuid": "880e8400-e29b-41d4-a716-446655440000",
            "title": "Discussion about quantum consciousness",
            "format": "rendered_html",
            "content": "<!DOCTYPE html><html>...",
            "media_count": 3
        }
    }}


# ========================================
# AUI (Adaptive User Interface) Schemas
# ========================================

class TrackToolUsageRequest(BaseModel):
    """Request to track tool usage."""
    user_id: UUID
    tool_name: str = Field(..., description="Tool name (e.g., 'read_quantum')")
    parameters: Optional[Dict] = Field(default=None, description="Tool parameters")
    success: bool = Field(default=True, description="Whether tool succeeded")
    execution_time_ms: Optional[float] = Field(default=None, description="Execution time in milliseconds")
    error_message: Optional[str] = Field(default=None, description="Error message if failed")
    context: Optional[Dict] = Field(default=None, description="Additional context")

    model_config = {"json_schema_extra": {
        "example": {
            "user_id": "c7a31f8e-91e3-47e6-bea5-e33d0f35072d",
            "tool_name": "read_quantum",
            "parameters": {"text_id": "123", "axes": "all"},
            "success": True,
            "execution_time_ms": 1250.5,
            "context": {"source": "mcp", "session_id": "abc123"}
        }
    }}


class TrackToolUsageResponse(BaseModel):
    """Response from tracking tool usage."""
    tracked: bool
    usage_id: UUID
    updated_patterns: Optional[Dict] = None

    model_config = {"json_schema_extra": {
        "example": {
            "tracked": True,
            "usage_id": "d8b41f9f-a2e4-48f7-c6d6-f44e1f46183e",
            "updated_patterns": {"frequent_tool": "read_quantum", "success_rate": 0.92}
        }
    }}


class GetUserPreferencesResponse(BaseModel):
    """Response with user preferences."""
    user_id: UUID
    tool_usage: Optional[Dict] = None
    patterns: Optional[Dict] = None
    preferences: Optional[Dict] = None
    updated_at: datetime

    model_config = {"from_attributes": True, "json_schema_extra": {
        "example": {
            "user_id": "c7a31f8e-91e3-47e6-bea5-e33d0f35072d",
            "tool_usage": {
                "read_quantum": {"count": 42, "success_rate": 0.92},
                "search_chunks": {"count": 28, "success_rate": 0.98}
            },
            "patterns": {
                "frequent_povm": "tetralemma",
                "prefers_corner": "both",
                "typical_chunk_count": 10
            },
            "preferences": {
                "dark_mode": True,
                "show_trajectories": True
            },
            "updated_at": "2025-10-10T23:30:00Z"
        }
    }}


class UpdateUserPreferencesRequest(BaseModel):
    """Request to update user preferences."""
    user_id: UUID
    preferences: Dict = Field(..., description="UI/UX preferences")

    model_config = {"json_schema_extra": {
        "example": {
            "user_id": "c7a31f8e-91e3-47e6-bea5-e33d0f35072d",
            "preferences": {"dark_mode": True, "show_trajectories": False}
        }
    }}


class GetRecommendationsRequest(BaseModel):
    """Request for adaptive recommendations."""
    user_id: UUID
    context: Optional[str] = Field(default=None, description="Current context (e.g., 'reading', 'searching')")

    model_config = {"json_schema_extra": {
        "example": {
            "user_id": "c7a31f8e-91e3-47e6-bea5-e33d0f35072d",
            "context": "reading"
        }
    }}


class GetRecommendationsResponse(BaseModel):
    """Response with adaptive recommendations."""
    user_id: UUID
    recommendations: List[Dict] = Field(default_factory=list)
    based_on: Dict = Field(default_factory=dict)

    model_config = {"json_schema_extra": {
        "example": {
            "user_id": "c7a31f8e-91e3-47e6-bea5-e33d0f35072d",
            "recommendations": [
                {
                    "type": "tool",
                    "tool_name": "read_quantum",
                    "reason": "You frequently use this tool with high success",
                    "confidence": 0.85
                },
                {
                    "type": "parameter",
                    "tool_name": "read_quantum",
                    "parameter": "axes",
                    "suggested_value": "tetralemma",
                    "reason": "Your most common choice",
                    "confidence": 0.92
                }
            ],
            "based_on": {
                "tool_usage_events": 70,
                "success_rate": 0.92,
                "days_active": 14
            }
        }
    }}


class ToolUsageStatsResponse(BaseModel):
    """Response with tool usage statistics."""
    user_id: UUID
    total_tool_calls: int
    success_rate: float
    most_used_tools: List[Dict] = Field(default_factory=list)
    recent_activity: List[Dict] = Field(default_factory=list)

    model_config = {"json_schema_extra": {
        "example": {
            "user_id": "c7a31f8e-91e3-47e6-bea5-e33d0f35072d",
            "total_tool_calls": 150,
            "success_rate": 0.94,
            "most_used_tools": [
                {"tool_name": "read_quantum", "count": 42, "success_rate": 0.92},
                {"tool_name": "search_chunks", "count": 28, "success_rate": 0.98}
            ],
            "recent_activity": [
                {
                    "tool_name": "read_quantum",
                    "success": True,
                    "execution_time_ms": 1250.5,
                    "created_at": "2025-10-10T23:30:00Z"
                }
            ]
        }
    }}


# ========================================
# Media Schemas (Universal)
# ========================================

class MediaItemResponse(BaseModel):
    """Universal media item response - works for any source."""
    file_id: str
    file_path: Optional[str] = None
    filename: Optional[str] = None
    content_type: Optional[str] = None
    size_bytes: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    source_archive: Optional[str] = None
    conversation_uuid: Optional[UUID] = None
    created_at: Optional[datetime] = None  # May not exist for all sources

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                "file_id": "file-abc123xyz",
                "file_path": "/archive/chat7/files/file-abc123xyz.png",
                "filename": "diagram.png",
                "content_type": "image/png",
                "size_bytes": 45678,
                "width": 800,
                "height": 600,
                "source_archive": "chat7",
                "conversation_uuid": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
                "created_at": "2024-10-11T10:30:00Z"
            }
        }
    }


class MediaListResponse(BaseModel):
    """Paginated list of media items."""
    items: List[MediaItemResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

    model_config = {"json_schema_extra": {
        "example": {
            "items": [],
            "total": 811,
            "page": 1,
            "page_size": 50,
            "total_pages": 17
        }
    }}


# ========================================
# Interest Schemas (Turing Tape)
# ========================================

class InterestTagResponse(BaseModel):
    """Interest tag response."""
    id: UUID
    tag: str
    created_at: datetime
    tag_salience: Optional[float] = None

    model_config = {"from_attributes": True}


class InterestResponse(BaseModel):
    """Interest response - a moment on the Turing tape."""
    id: UUID
    user_id: UUID
    interest_type: str
    target_uuid: Optional[UUID] = None
    target_metadata: Dict
    moment_text: Optional[str] = None
    stance: Optional[Dict] = None
    context_snapshot: Optional[Dict] = None
    previous_interest_id: Optional[UUID] = None
    next_interest_id: Optional[UUID] = None
    salience_score: float
    predicted_value: Optional[float] = None
    advantages: List[str]
    disadvantages: List[str]
    realized_value: Optional[float] = None
    value_notes: Optional[str] = None
    created_at: datetime
    explored_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    pruned: bool
    prune_reason: Optional[str] = None
    pruned_at: Optional[datetime] = None
    tags: List[InterestTagResponse] = []

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "user_id": "user-123",
                "interest_type": "conversation",
                "target_uuid": "conv-456",
                "target_metadata": {"title": "Noether's Theorem Overview"},
                "moment_text": "This connects to my work on transformation verification",
                "salience_score": 0.8,
                "advantages": ["Found 3 relevant equations", "Confirmed symmetry pattern"],
                "disadvantages": ["Took 2 hours"],
                "realized_value": 0.9,
                "created_at": "2025-10-11T14:30:00Z",
                "pruned": False,
                "tags": []
            }
        }
    }


class MarkInterestingRequest(BaseModel):
    """Request to mark something as interesting."""
    interest_type: str = Field(..., description="Type of interest (conversation, message, etc.)")
    target_uuid: Optional[UUID] = Field(None, description="UUID of the thing we're interested in")
    moment_text: Optional[str] = Field(None, description="Why is this interesting?")
    salience_score: float = Field(0.5, ge=0.0, le=1.0, description="How important does this seem?")
    target_metadata: Optional[Dict] = Field(default_factory=dict, description="Metadata about target")
    context: Optional[Dict] = Field(None, description="Current context")
    predicted_value: Optional[float] = Field(None, ge=0.0, le=1.0, description="Expected value")
    tags: Optional[List[str]] = Field(default_factory=list, description="Tags for this interest")

    model_config = {"json_schema_extra": {
        "example": {
            "interest_type": "conversation",
            "target_uuid": "conv-123",
            "moment_text": "This conversation about Noether's theorem might connect to my work",
            "salience_score": 0.8,
            "target_metadata": {"title": "Noether's Theorem Overview", "message_count": 34},
            "tags": ["physics", "mathematics", "symmetry"]
        }
    }}


class UpdateInterestRequest(BaseModel):
    """Request to update interest with discoveries."""
    advantages: Optional[List[str]] = Field(default_factory=list, description="New advantages discovered")
    disadvantages: Optional[List[str]] = Field(default_factory=list, description="New disadvantages discovered")
    realized_value: Optional[float] = Field(None, ge=0.0, le=1.0, description="Final value assessment")
    value_notes: Optional[str] = Field(None, description="Why was it valuable/not valuable?")

    model_config = {"json_schema_extra": {
        "example": {
            "advantages": ["Learned about continuous symmetry", "Connected to previous work"],
            "disadvantages": ["Took 2 hours", "Led down rabbit hole"],
            "realized_value": 0.7,
            "value_notes": "Worth it - deepened understanding significantly"
        }
    }}


class ResolveInterestRequest(BaseModel):
    """Request to resolve interest."""
    realized_value: float = Field(..., ge=0.0, le=1.0, description="Was it worth it?")
    value_notes: Optional[str] = Field(None, description="Why was it valuable/not valuable?")
    next_interest_id: Optional[UUID] = Field(None, description="What are we moving to next?")

    model_config = {"json_schema_extra": {
        "example": {
            "realized_value": 0.9,
            "value_notes": "Highly valuable - led to breakthrough on transformation algebra"
        }
    }}


class PruneInterestRequest(BaseModel):
    """Request to prune interest."""
    prune_reason: str = Field(..., description="Why are we pruning this?")

    model_config = {"json_schema_extra": {
        "example": {
            "prune_reason": "Too abstract, doesn't connect to concrete work"
        }
    }}


class InterestTrajectoryResponse(BaseModel):
    """Response with Turing tape trajectory."""
    trajectory: List[InterestResponse]
    current_index: int  # Index of current interest in trajectory

    model_config = {"json_schema_extra": {
        "example": {
            "trajectory": [],
            "current_index": 5
        }
    }}


class InterestInsightsResponse(BaseModel):
    """Response with learning insights."""
    total_interests: int
    total_resolved: int
    avg_realized_value: Optional[float]
    by_type: Dict[str, Dict]  # Type → stats
    best_interest_types: List[Dict[str, Any]]
    worst_interest_types: List[Dict[str, Any]]

    model_config = {"json_schema_extra": {
        "example": {
            "total_interests": 42,
            "total_resolved": 30,
            "avg_realized_value": 0.65,
            "by_type": {
                "conversation": {
                    "count": 20,
                    "avg_value": 0.75,
                    "avg_duration": 3600
                }
            },
            "best_interest_types": [
                {"type": "conversation", "avg_value": 0.75}
            ],
            "worst_interest_types": [
                {"type": "message", "avg_value": 0.3}
            ]
        }
    }}


class InterestListResponse(BaseModel):
    """Paginated list of interests."""
    interests: List[InterestResponse]
    total: int
    page: int
    page_size: int

    model_config = {"json_schema_extra": {
        "example": {
            "interests": [],
            "total": 42,
            "page": 1,
            "page_size": 50
        }
    }}


class AddTagsRequest(BaseModel):
    """Request to add tags to interest."""
    tags: List[str] = Field(..., description="Tags to add")

    model_config = {"json_schema_extra": {
        "example": {
            "tags": ["physics", "mathematics", "important"]
        }
    }}


# ============================================================================
# Interest List Schemas - User-managed collections of attention
# ============================================================================

class InterestListItemResponse(BaseModel):
    """Response model for an interest list item."""
    id: UUID
    list_id: UUID
    user_id: UUID
    position: int
    item_type: str
    item_uuid: Optional[UUID] = None
    item_metadata: Dict[str, Any]
    notes: Optional[str] = None
    status: str
    completed_at: Optional[datetime] = None
    added_at: datetime
    custom_metadata: Dict[str, Any]

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "list_id": "660e8400-e29b-41d4-a716-446655440000",
                "user_id": "00000000-0000-0000-0000-000000000001",
                "position": 0,
                "item_type": "conversation",
                "item_uuid": "68aa3588-f7f0-832c-a268-387dd238af2c",
                "item_metadata": {"title": "Discussion about quantum computing", "message_count": 42},
                "notes": "Important conversation about TRM formalism",
                "status": "pending",
                "completed_at": None,
                "added_at": "2025-10-11T20:00:00",
                "custom_metadata": {}
            }
        }
    }


class InterestListResponse(BaseModel):
    """Response model for an interest list."""
    id: UUID
    user_id: UUID
    name: str
    description: Optional[str] = None
    list_type: str
    status: str
    custom_metadata: Dict[str, Any]
    current_position: int
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    is_public: bool
    parent_list_id: Optional[UUID] = None
    branched_at_position: Optional[int] = None
    items: List[InterestListItemResponse] = []
    item_count: int = 0  # Computed field: len(items)
    progress_pct: float = 0.0

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": "660e8400-e29b-41d4-a716-446655440000",
                "user_id": "00000000-0000-0000-0000-000000000001",
                "name": "Reading Queue",
                "description": "Conversations to read this week",
                "list_type": "reading",
                "status": "active",
                "custom_metadata": {},
                "current_position": 2,
                "created_at": "2025-10-11T18:00:00",
                "updated_at": "2025-10-11T20:00:00",
                "completed_at": None,
                "is_public": False,
                "parent_list_id": None,
                "branched_at_position": None,
                "items": [],
                "progress_pct": 40.0
            }
        }
    }


class CreateInterestListRequest(BaseModel):
    """Request to create a new interest list."""
    name: str = Field(..., min_length=1, max_length=200, description="List name")
    description: Optional[str] = Field(None, description="What is this list for?")
    list_type: str = Field(default="custom", description="List category")
    is_public: bool = Field(default=False, description="Can others see this list?")
    custom_metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")

    model_config = {"json_schema_extra": {
        "example": {
            "name": "Research Ideas",
            "description": "Topics to explore for the paper",
            "list_type": "research",
            "is_public": False,
            "custom_metadata": {"priority": "high"}
        }
    }}


class UpdateInterestListRequest(BaseModel):
    """Request to update an interest list."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    status: Optional[str] = None
    is_public: Optional[bool] = None
    custom_metadata: Optional[Dict[str, Any]] = None

    model_config = {"json_schema_extra": {
        "example": {
            "name": "Updated Reading Queue",
            "description": "Conversations to read this month",
            "status": "active"
        }
    }}


class AddItemToListRequest(BaseModel):
    """Request to add an item to an interest list."""
    item_type: str = Field(..., description="Type of object (conversation, message, reading, etc.)")
    item_uuid: Optional[UUID] = Field(None, description="UUID of the object")
    item_metadata: Dict[str, Any] = Field(default_factory=dict, description="Cached metadata for display")
    notes: Optional[str] = Field(None, description="User notes about this item")
    position: Optional[int] = Field(None, description="Position in list (default: end)")
    custom_metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")

    model_config = {"json_schema_extra": {
        "example": {
            "item_type": "conversation",
            "item_uuid": "68aa3588-f7f0-832c-a268-387dd238af2c",
            "item_metadata": {"title": "Discussion about quantum computing", "message_count": 42},
            "notes": "Read this first",
            "position": 0
        }
    }}


class UpdateListItemRequest(BaseModel):
    """Request to update an item in an interest list."""
    notes: Optional[str] = None
    status: Optional[str] = None
    custom_metadata: Optional[Dict[str, Any]] = None

    model_config = {"json_schema_extra": {
        "example": {
            "notes": "Very insightful conversation",
            "status": "completed"
        }
    }}


class ReorderListItemsRequest(BaseModel):
    """Request to reorder items in a list."""
    item_positions: Dict[str, int] = Field(
        ...,
        description="Map of item_id (UUID as string) to new position"
    )

    model_config = {"json_schema_extra": {
        "example": {
            "item_positions": {
                "550e8400-e29b-41d4-a716-446655440000": 0,
                "660e8400-e29b-41d4-a716-446655440001": 1,
                "770e8400-e29b-41d4-a716-446655440002": 2
            }
        }
    }}


class NavigateListRequest(BaseModel):
    """Request to navigate through a list."""
    direction: str = Field(..., description="Navigation direction: 'forward', 'back', or 'jump'")
    jump_to_position: Optional[int] = Field(None, description="Position to jump to (if direction='jump')")

    model_config = {"json_schema_extra": {
        "example": {
            "direction": "forward"
        }
    }}


class BranchListRequest(BaseModel):
    """Request to branch a list from a specific position."""
    branch_name: str = Field(..., min_length=1, max_length=200, description="Name for the new branch")
    branch_position: Optional[int] = Field(None, description="Position to branch from (default: current)")
    branch_reason: Optional[str] = Field(None, description="Why are we branching?")
    include_items: bool = Field(default=True, description="Copy items from source list?")

    model_config = {"json_schema_extra": {
        "example": {
            "branch_name": "Alternative Reading Order",
            "branch_position": 5,
            "branch_reason": "Try reading the theoretical papers first",
            "include_items": True
        }
    }}


class InterestListBranchResponse(BaseModel):
    """Response model for an interest list branch."""
    id: UUID
    user_id: UUID
    source_list_id: UUID
    branch_list_id: UUID
    branch_position: int
    branch_reason: Optional[str] = None
    created_at: datetime
    custom_metadata: Dict[str, Any]

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": "770e8400-e29b-41d4-a716-446655440000",
                "user_id": "00000000-0000-0000-0000-000000000001",
                "source_list_id": "660e8400-e29b-41d4-a716-446655440000",
                "branch_list_id": "880e8400-e29b-41d4-a716-446655440000",
                "branch_position": 5,
                "branch_reason": "Try different reading order",
                "created_at": "2025-10-11T20:30:00",
                "custom_metadata": {}
            }
        }
    }


class PaginatedInterestListsResponse(BaseModel):
    """Paginated response for interest lists."""
    lists: List[InterestListResponse]
    total: int
    page: int
    page_size: int

    model_config = {"json_schema_extra": {
        "example": {
            "lists": [],
            "total": 10,
            "page": 1,
            "page_size": 20
        }
    }}


class SearchInterestsRequest(BaseModel):
    """Request to search interests."""
    query: str = Field(..., description="Search query")
    interest_type: Optional[str] = Field(None, description="Filter by type")
    include_pruned: bool = Field(False, description="Include pruned interests?")
    min_realized_value: Optional[float] = Field(None, ge=0.0, le=1.0, description="Minimum realized value")
    tags: Optional[List[str]] = Field(default_factory=list, description="Filter by tags")
    limit: int = Field(50, ge=1, le=200, description="Maximum results")

    model_config = {"json_schema_extra": {
        "example": {
            "query": "symmetry",
            "interest_type": "conversation",
            "min_realized_value": 0.5,
            "limit": 50
        }
    }}


# ========================================
# Live Capture Schemas
# ========================================

class CaptureConversationRequest(BaseModel):
    """Request to capture a live ChatGPT conversation."""
    uuid: UUID = Field(..., description="ChatGPT conversation UUID")
    title: Optional[str] = Field(None, description="Conversation title")
    source_url: str = Field(..., description="ChatGPT conversation URL")
    model_slug: Optional[str] = Field(None, description="Model used (e.g., 'gpt-4')")
    created_at: Optional[datetime] = Field(None, description="When conversation was created")

    model_config = {"json_schema_extra": {
        "example": {
            "uuid": "550e8400-e29b-41d4-a716-446655440000",
            "title": "Discussion about TRM",
            "source_url": "https://chatgpt.com/c/550e8400-e29b-41d4-a716-446655440000",
            "model_slug": "gpt-4",
            "created_at": "2025-10-11T20:00:00Z"
        }
    }}


class CaptureConversationResponse(BaseModel):
    """Response from capturing a conversation."""
    conversation_id: str
    status: str  # "created" or "updated"
    message: str

    model_config = {"json_schema_extra": {
        "example": {
            "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
            "status": "created",
            "message": "Conversation created successfully"
        }
    }}


class CaptureMessageRequest(BaseModel):
    """Request to capture a message."""
    uuid: UUID = Field(..., description="ChatGPT message UUID")
    conversation_uuid: UUID = Field(..., description="Parent conversation UUID")
    author_role: str = Field(..., description="Message author role (user, assistant, system)")
    content_text: str = Field(..., description="Extracted text content")
    content_parts: Optional[List[Dict]] = Field(default_factory=list, description="Content parts structure")
    created_at: Optional[datetime] = Field(None, description="Message timestamp")

    model_config = {"json_schema_extra": {
        "example": {
            "uuid": "660e8400-e29b-41d4-a716-446655440000",
            "conversation_uuid": "550e8400-e29b-41d4-a716-446655440000",
            "author_role": "user",
            "content_text": "Can you explain TRM to me?",
            "content_parts": [{"content_type": "text", "parts": ["Can you explain TRM to me?"]}],
            "created_at": "2025-10-11T20:05:00Z"
        }
    }}


class CaptureMessageResponse(BaseModel):
    """Response from capturing a message."""
    message_id: str
    status: str  # "created" or "updated"
    message: str

    model_config = {"json_schema_extra": {
        "example": {
            "message_id": "660e8400-e29b-41d4-a716-446655440000",
            "status": "created",
            "message": "Message created successfully"
        }
    }}


class CaptureMediaResponse(BaseModel):
    """Response from capturing media."""
    file_id: str
    file_path: str
    mime_type: str
    status: str  # "uploaded"
    message: str

    model_config = {"json_schema_extra": {
        "example": {
            "file_id": "captured_20251011_200500_660e8400.png",
            "file_path": "/Users/tem/humanizer_root/humanizer/media/captured/captured_20251011_200500_660e8400.png",
            "mime_type": "image/png",
            "status": "uploaded",
            "message": "Media captured_20251011_200500_660e8400.png uploaded successfully"
        }
    }}


class CaptureStatusResponse(BaseModel):
    """Response with capture status for a conversation."""
    conversation_id: str
    exists: bool
    message_count: int
    media_count: int
    last_captured: Optional[str] = None

    model_config = {"json_schema_extra": {
        "example": {
            "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
            "exists": True,
            "message_count": 15,
            "media_count": 3,
            "last_captured": "2025-10-11T20:30:00Z"
        }
    }}


# ========================================
# Document Ingestion Schemas
# ========================================

class DocumentIngestRequest(BaseModel):
    """Request to ingest documents from directory."""
    source_directory: str = Field(..., description="Directory containing files to ingest")
    file_types: Optional[List[str]] = Field(
        default=None,
        description="Filter by file types: ['pdf', 'txt', 'md', 'image'] (None = all)"
    )
    storage_strategy: str = Field(
        default="in_place",
        description="Storage strategy: 'centralized' or 'in_place'"
    )
    centralized_base_path: Optional[str] = Field(
        default=None,
        description="Base path for centralized storage (e.g., ~/humanizer_media)"
    )
    recursive: bool = Field(
        default=True,
        description="Search subdirectories recursively"
    )
    force_reimport: bool = Field(
        default=False,
        description="Re-import files even if they already exist (by hash)"
    )
    generate_embeddings: bool = Field(
        default=True,
        description="Queue chunks for embedding generation"
    )

    model_config = {"json_schema_extra": {
        "example": {
            "source_directory": "/Users/tem/Documents/papers",
            "file_types": ["pdf", "md"],
            "storage_strategy": "in_place",
            "recursive": True,
            "force_reimport": False,
            "generate_embeddings": True
        }
    }}


class DocumentIngestResponse(BaseModel):
    """Response from document ingestion."""
    batch_id: str
    total_files: int
    successful: int
    failed: int
    skipped: int
    processing_time_ms: int
    errors: List[Dict[str, str]]

    model_config = {"json_schema_extra": {
        "example": {
            "batch_id": "770e8400-e29b-41d4-a716-446655440000",
            "total_files": 50,
            "successful": 48,
            "failed": 1,
            "skipped": 1,
            "processing_time_ms": 12500,
            "errors": [{"file": "/path/to/corrupted.pdf", "error": "Failed to parse PDF"}]
        }
    }}


class DocumentChunkResponse(BaseModel):
    """Response for a document chunk."""
    id: str
    chunk_index: int
    chunk_text: str
    chunk_size: int
    start_page: Optional[int] = None
    end_page: Optional[int] = None
    start_offset: Optional[int] = None
    end_offset: Optional[int] = None
    embedding_status: str
    has_embedding: bool

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": "880e8400-e29b-41d4-a716-446655440000",
                "chunk_index": 0,
                "chunk_text": "Quantum mechanics reveals the probabilistic nature of reality...",
                "chunk_size": 1024,
                "start_page": 1,
                "end_page": 2,
                "start_offset": 0,
                "end_offset": 1024,
                "embedding_status": "completed",
                "has_embedding": True
            }
        }
    }


class DocumentChunksListResponse(BaseModel):
    """Response containing list of document chunks."""
    chunks: List[DocumentChunkResponse]
    total: int

    model_config = {
        "json_schema_extra": {
            "example": {
                "chunks": [
                    {
                        "id": "880e8400-e29b-41d4-a716-446655440000",
                        "chunk_index": 0,
                        "chunk_text": "Quantum mechanics reveals...",
                        "chunk_size": 1024,
                        "start_page": 1,
                        "end_page": 2,
                        "start_offset": 0,
                        "end_offset": 1024,
                        "embedding_status": "completed",
                        "has_embedding": True
                    }
                ],
                "total": 1
            }
        }
    }


class DocumentMediaResponse(BaseModel):
    """Response for document media (images, etc.)."""
    id: str
    media_type: str
    file_path: str
    page_number: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": "990e8400-e29b-41d4-a716-446655440000",
                "media_type": "image",
                "file_path": "/path/to/image.png",
                "page_number": 3,
                "width": 800,
                "height": 600
            }
        }
    }


class DocumentResponse(BaseModel):
    """Response with full document details."""
    id: str
    filename: str
    file_path: str
    file_type: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    file_hash: str
    storage_strategy: str
    title: Optional[str] = None
    author: Optional[str] = None
    page_count: Optional[int] = None
    created_at: datetime
    ingested_at: datetime
    file_modified_at: Optional[datetime] = None
    source_directory: Optional[str] = None
    embedding_status: str
    custom_metadata: Optional[Dict] = None
    chunk_count: int = 0
    media_count: int = 0
    chunks: Optional[List[DocumentChunkResponse]] = None
    media: Optional[List[DocumentMediaResponse]] = None

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": "aa0e8400-e29b-41d4-a716-446655440000",
                "filename": "quantum_mechanics.pdf",
                "file_path": "/Users/tem/Documents/quantum_mechanics.pdf",
                "file_type": "pdf",
                "file_size": 2048576,
                "mime_type": "application/pdf",
                "file_hash": "a1b2c3d4e5f6...",
                "storage_strategy": "in_place",
                "title": "Introduction to Quantum Mechanics",
                "author": "Richard Feynman",
                "page_count": 150,
                "created_at": "2025-10-17T20:00:00Z",
                "ingested_at": "2025-10-17T20:00:00Z",
                "source_directory": "/Users/tem/Documents",
                "embedding_status": "completed",
                "chunk_count": 45,
                "media_count": 12,
                "chunks": [],
                "media": []
            }
        }
    }


class DocumentListResponse(BaseModel):
    """Paginated list of documents."""
    documents: List[DocumentResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

    model_config = {"json_schema_extra": {
        "example": {
            "documents": [],
            "total": 150,
            "page": 1,
            "page_size": 50,
            "total_pages": 3
        }
    }}


class DocumentSearchRequest(BaseModel):
    """Request to search documents."""
    query: str = Field(..., description="Search query (semantic or text)", min_length=1)
    file_types: Optional[List[str]] = Field(
        default=None,
        description="Filter by file types"
    )
    limit: int = Field(
        default=20,
        ge=1,
        le=100,
        description="Maximum results to return"
    )
    semantic: bool = Field(
        default=True,
        description="Use semantic search (vs text search)"
    )
    min_score: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Minimum similarity score (for semantic search)"
    )

    model_config = {"json_schema_extra": {
        "example": {
            "query": "quantum entanglement experiments",
            "file_types": ["pdf"],
            "limit": 20,
            "semantic": True,
            "min_score": 0.7
        }
    }}


class DocumentSearchResultItem(BaseModel):
    """Single search result item."""
    document_id: str
    document_title: str
    document_filename: str
    chunk_id: Optional[str] = None
    chunk_text: Optional[str] = None
    chunk_index: Optional[int] = None
    page_number: Optional[int] = None
    score: float
    highlight: Optional[str] = None

    model_config = {"json_schema_extra": {
        "example": {
            "document_id": "aa0e8400-e29b-41d4-a716-446655440000",
            "document_title": "Introduction to Quantum Mechanics",
            "document_filename": "quantum_mechanics.pdf",
            "chunk_id": "bb0e8400-e29b-41d4-a716-446655440000",
            "chunk_text": "Quantum entanglement is a phenomenon where...",
            "chunk_index": 12,
            "page_number": 45,
            "score": 0.89,
            "highlight": "...entanglement is a phenomenon..."
        }
    }}


class DocumentSearchResponse(BaseModel):
    """Response from document search."""
    results: List[DocumentSearchResultItem]
    total: int
    query: str
    processing_time_ms: int

    model_config = {"json_schema_extra": {
        "example": {
            "results": [],
            "total": 15,
            "query": "quantum entanglement",
            "processing_time_ms": 125
        }
    }}


class DocumentUpdateRequest(BaseModel):
    """Request to update document metadata."""
    title: Optional[str] = None
    author: Optional[str] = None
    custom_metadata: Optional[Dict] = None

    model_config = {"json_schema_extra": {
        "example": {
            "title": "Updated Title",
            "author": "Updated Author",
            "custom_metadata": {"category": "physics", "tags": ["quantum", "mechanics"]}
        }
    }}


class IngestionBatchResponse(BaseModel):
    """Response with batch details."""
    id: str
    source_directory: str
    batch_type: str
    storage_strategy: str
    total_files: int
    successful: int
    failed: int
    skipped: int
    started_at: datetime
    completed_at: Optional[datetime] = None
    processing_time_ms: Optional[int] = None
    errors: List[Dict[str, str]]

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": "cc0e8400-e29b-41d4-a716-446655440000",
                "source_directory": "/Users/tem/Documents",
                "batch_type": "pdf,md",
                "storage_strategy": "in_place",
                "total_files": 50,
                "successful": 48,
                "failed": 1,
                "skipped": 1,
                "started_at": "2025-10-17T20:00:00Z",
                "completed_at": "2025-10-17T20:05:30Z",
                "processing_time_ms": 330000,
                "errors": []
            }
        }
    }


class BatchListResponse(BaseModel):
    """Paginated list of ingestion batches."""
    batches: List[IngestionBatchResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

    model_config = {"json_schema_extra": {
        "example": {
            "batches": [],
            "total": 25,
            "page": 1,
            "page_size": 20,
            "total_pages": 2
        }
    }}
