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
from typing import Optional, Dict, List
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
