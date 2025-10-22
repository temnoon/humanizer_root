"""
Models package - SQLAlchemy models and Pydantic schemas
"""

from .reading import (
    ReadingSession,
    ReadingStep,
    ReadingSnapshot,
    ReadingProvenance,
)
from .povm import POVMPack
from .library import Book, Chunk
from .user import UserPreferences, ToolUsage
from .chatgpt import (
    ChatGPTConversation,
    ChatGPTMessage,
    ChatGPTMedia,
    ChatGPTProvenance,
)
from .interest import (
    Interest,
    InterestTag,
)
from .interest_list import (
    InterestList,
    InterestListItem,
    InterestListBranch,
)
from .pipeline import PipelineJob
from .transformation import (
    Transformation,
    TransformationType,
    SourceType,
)
from .agent import AgentConversation
from .document import (
    Document,
    DocumentChunk,
    DocumentMedia,
    IngestionBatch,
    StorageStrategy,
    EmbeddingStatus,
)

__all__ = [
    # Reading models
    "ReadingSession",
    "ReadingStep",
    "ReadingSnapshot",
    "ReadingProvenance",
    # POVM models
    "POVMPack",
    # Library models
    "Book",
    "Chunk",
    # User models
    "UserPreferences",
    "ToolUsage",
    # ChatGPT models
    "ChatGPTConversation",
    "ChatGPTMessage",
    "ChatGPTMedia",
    "ChatGPTProvenance",
    # Interest models
    "Interest",
    "InterestTag",
    # Interest List models
    "InterestList",
    "InterestListItem",
    "InterestListBranch",
    # Pipeline models
    "PipelineJob",
    # Transformation models
    "Transformation",
    "TransformationType",
    "SourceType",
    # Agent models
    "AgentConversation",
    # Document models
    "Document",
    "DocumentChunk",
    "DocumentMedia",
    "IngestionBatch",
    "StorageStrategy",
    "EmbeddingStatus",
]
