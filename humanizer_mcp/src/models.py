"""Pydantic models for Humanizer MCP."""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class AxesType(str, Enum):
    """Quantum reading axes types."""
    UNIVERSAL = "universal"
    CONTEXT = "context"
    ALL = "all"


class ItemType(str, Enum):
    """Types of trackable items."""
    NARRATIVE = "narrative"
    CHUNK = "chunk"
    PHRASE = "phrase"
    CONCEPT = "concept"
    IMAGE = "image"
    BOOK = "book"


# Request models

class ReadQuantumRequest(BaseModel):
    """Request for quantum reading."""
    text_id: str = Field(..., description="ID of text to read")
    start_sentence: int = Field(0, description="Starting sentence index")
    num_sentences: int = Field(10, description="Number of sentences to read")
    axes: AxesType = Field(AxesType.ALL, description="Which axes to use")


class SearchRequest(BaseModel):
    """Request for search operations."""
    query: str = Field(..., description="Search query")
    limit: int = Field(10, ge=1, le=100, description="Maximum results")


class TrackInterestRequest(BaseModel):
    """Request to track an interest."""
    item_type: ItemType = Field(..., description="Type of item")
    item_id: str = Field(..., description="ID of the item")
    title: Optional[str] = Field(None, description="Human-readable title")
    context: Optional[str] = Field(None, description="Context when marked")
    connection_from_id: Optional[int] = Field(None, description="Previous item ID")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class GetConnectionsRequest(BaseModel):
    """Request to get connections."""
    item_type: Optional[str] = Field(None, description="Filter by item type")
    item_id: Optional[str] = Field(None, description="Filter by item ID")
    limit: int = Field(50, ge=1, le=200, description="Maximum connections")


class GetInterestListRequest(BaseModel):
    """Request to get interest list."""
    limit: int = Field(50, ge=1, le=200, description="Maximum items")


# Response models

class InterestItemModel(BaseModel):
    """Interest list item."""
    id: int
    user_id: str
    item_type: str
    item_id: str
    title: Optional[str] = None
    marked_at: str  # ISO datetime
    context: Optional[str] = None
    connection_from_id: Optional[int] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        from_attributes = True


class ConnectionModel(BaseModel):
    """Connection between entities."""
    id: int
    source: str  # "type:id"
    target: str  # "type:id"
    transformation: str
    created_at: str  # ISO datetime
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        from_attributes = True


class UsageStatModel(BaseModel):
    """Usage statistics."""
    tool: str
    uses: int
    successes: int
    success_rate: float


class TrackInterestResponse(BaseModel):
    """Response from tracking interest."""
    success: bool
    item: InterestItemModel


class GetConnectionsResponse(BaseModel):
    """Response with connections."""
    connections: List[ConnectionModel]
    count: int


class GetInterestListResponse(BaseModel):
    """Response with interest list."""
    items: List[InterestItemModel]
    count: int


# Quantum reading response models (from Humanizer API)

class POVMCorner(BaseModel):
    """Single corner of POVM measurement."""
    probability: float = Field(..., ge=0.0, le=1.0)
    evidence: str
    reasoning: str


class POVMMeasurement(BaseModel):
    """Complete POVM measurement."""
    axis: str
    sentence: str
    corners: Dict[str, POVMCorner]
    dominant_corner: str
    reader_state_update: Optional[Dict[str, Any]] = None


class QuantumReadingResult(BaseModel):
    """Single sentence quantum reading result."""
    sentence_index: int
    sentence: str
    measurements: List[POVMMeasurement]
    imbalance_alert: Optional[Dict[str, Any]] = None


class ReadQuantumResponse(BaseModel):
    """Response from read_quantum."""
    text_id: str
    reader_state: Dict[str, Any]
    sentences_read: int
    results: List[QuantumReadingResult]


# Search response models

class ChunkSearchResult(BaseModel):
    """Search result for chunk."""
    id: str
    content: str
    token_count: int
    has_embedding: bool
    chunk_level: str
    chunk_sequence: int
    created_at: str
    source: Dict[str, Any]


class SearchChunksResponse(BaseModel):
    """Response from search_chunks."""
    chunks: List[ChunkSearchResult]
    total: int
    limit: int
    offset: int


# Book models

class BookModel(BaseModel):
    """Book metadata."""
    id: str
    title: str
    author: Optional[str] = None
    chunk_count: int = 0
    embedding_count: int = 0
    coverage: float = 0.0
    created_at: Optional[str] = None


class ListBooksResponse(BaseModel):
    """Response from list_books."""
    books: List[BookModel]
    count: int


class LibraryStatsResponse(BaseModel):
    """Response from get_library_stats."""
    collections: int
    messages: int
    chunks: int
    chunks_with_embeddings: int
    embedding_coverage: float
    media_files: int
    platforms: Dict[str, int]


# Image search models

class ImageSearchResult(BaseModel):
    """Image search result."""
    id: str
    filename: str
    mime_type: str
    storage_path: Optional[str] = None
    collection_id: str
    message_id: str
    created_at: str
    custom_metadata: Dict[str, Any] = Field(default_factory=dict)


class SearchImagesResponse(BaseModel):
    """Response from search_images."""
    media: List[ImageSearchResult]
    count: int
    total: int
    offset: int
    limit: int


# ============================================================================
# ARTIFACT MODELS
# ============================================================================

class SaveArtifactRequest(BaseModel):
    """Request to save an artifact."""
    artifact_type: str = Field(..., description="Type: report, extraction, transformation, etc.")
    operation: str = Field(..., description="Operation that created this")
    content: str = Field(..., description="The actual content")
    content_format: str = Field("markdown", description="Format: markdown, json, html, plaintext")

    # Provenance
    source_chunk_ids: Optional[List[str]] = Field(None, description="Source chunk UUIDs")
    source_artifact_ids: Optional[List[str]] = Field(None, description="Source artifact UUIDs")
    source_operation_params: Optional[Dict[str, Any]] = Field(None, description="Operation parameters")

    # Lineage
    parent_artifact_id: Optional[str] = Field(None, description="Parent artifact if refinement")

    # Metadata
    generation_model: Optional[str] = Field(None, description="Model used")
    generation_prompt: Optional[str] = Field(None, description="Prompt used")
    topics: Optional[List[str]] = Field(None, description="Topics/tags")
    frameworks: Optional[List[str]] = Field(None, description="Frameworks applied")
    custom_metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")

    # Options
    auto_embed: bool = Field(True, description="Auto-generate embedding")


class SearchArtifactsRequest(BaseModel):
    """Request to search artifacts."""
    query: str = Field(..., description="Search query")
    artifact_type: Optional[str] = Field(None, description="Filter by type")
    limit: int = Field(20, ge=1, le=100, description="Maximum results")


class ListArtifactsRequest(BaseModel):
    """Request to list artifacts."""
    artifact_type: Optional[str] = Field(None, description="Filter by type")
    operation: Optional[str] = Field(None, description="Filter by operation")
    limit: int = Field(50, ge=1, le=200, description="Maximum results")
    offset: int = Field(0, ge=0, description="Pagination offset")


class GetArtifactRequest(BaseModel):
    """Request to get artifact details."""
    artifact_id: str = Field(..., description="Artifact UUID")


class ArtifactModel(BaseModel):
    """Artifact data model."""
    id: str
    user_id: str
    artifact_type: str
    operation: str
    content: str
    content_format: str
    token_count: Optional[int] = None
    generation_model: Optional[str] = None
    topics: List[str] = Field(default_factory=list)
    frameworks: List[str] = Field(default_factory=list)
    sentiment: Optional[float] = None
    complexity_score: Optional[float] = None
    is_approved: bool = False
    user_rating: Optional[int] = None
    parent_artifact_id: Optional[str] = None
    lineage_depth: int = 0
    source_chunk_ids: List[str] = Field(default_factory=list)
    source_artifact_ids: List[str] = Field(default_factory=list)
    source_operation_params: Dict[str, Any] = Field(default_factory=dict)
    created_at: str
    updated_at: str
    custom_metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        from_attributes = True


class SaveArtifactResponse(BaseModel):
    """Response from save_artifact."""
    success: bool
    artifact: ArtifactModel


class SearchArtifactsResponse(BaseModel):
    """Response from search_artifacts."""
    artifacts: List[Dict[str, Any]]  # Includes similarity scores
    query: str
    total: int


class ListArtifactsResponse(BaseModel):
    """Response from list_artifacts."""
    artifacts: List[ArtifactModel]
    total: int
    limit: int
    offset: int


class GetArtifactResponse(BaseModel):
    """Response from get_artifact."""
    artifact: ArtifactModel
