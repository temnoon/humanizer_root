"""
Transformation Models - Store transformation history and results

This module tracks all text transformations (TRM, LLM, Personification) with:
- Source text and result
- User prompt (what they wanted to achieve)
- Parameters and metrics
- Link back to source message
"""

from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Enum, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from datetime import datetime
from typing import Dict, Any, Optional
import enum

from humanizer.database.connection import Base


class TransformationType(str, enum.Enum):
    """Types of transformations."""
    TRM = "trm"  # TRM iterative method
    LLM = "llm"  # LLM only method
    PERSONIFY_TRM = "personify_trm"  # Personification using TRM
    PERSONIFY_LLM = "personify_llm"  # Personification using LLM
    CUSTOM = "custom"  # Custom transformation


class SourceType(str, enum.Enum):
    """Source of the text being transformed."""
    CHATGPT_MESSAGE = "chatgpt_message"
    CUSTOM = "custom"


class Transformation(Base):
    """
    Record of a text transformation operation.

    Stores the complete context of a transformation:
    - What was transformed (source)
    - What the user wanted to achieve (user_prompt)
    - How it was transformed (type, parameters)
    - What resulted (result_text, metrics)
    """

    __tablename__ = "transformations"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # User reference
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("user_preferences.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Source information
    source_type = Column(
        String,
        CheckConstraint("source_type IN ('chatgpt_message', 'custom')"),
        nullable=False,
        default='custom'
    )

    source_uuid = Column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
        comment="UUID of source ChatGPT message if applicable"
    )

    source_text = Column(
        Text,
        nullable=False,
        comment="Original text that was transformed"
    )

    # Transformation configuration
    transformation_type = Column(
        String,
        CheckConstraint("transformation_type IN ('trm', 'llm', 'personify_trm', 'personify_llm', 'custom')"),
        nullable=False,
        index=True
    )

    user_prompt = Column(
        Text,
        nullable=True,
        comment="User's description of what the transformation should do"
    )

    parameters = Column(
        JSONB,
        nullable=False,
        default={},
        comment="Transformation parameters (povm_pack, max_iterations, strength, etc.)"
    )
    # Example parameters:
    # {
    #   "povm_pack": "tone",
    #   "max_iterations": 5,
    #   "convergence_threshold": 0.05,
    #   "strength": 1.0,
    #   "use_examples": true
    # }

    # Transformation result
    result_text = Column(
        Text,
        nullable=False,
        comment="Transformed text output"
    )

    metrics = Column(
        JSONB,
        nullable=False,
        default={},
        comment="Transformation metrics and metadata"
    )
    # Example metrics:
    # {
    #   "processing_time_ms": 4235,
    #   "iterations": 3,
    #   "convergence_score": 0.042,
    #   "embedding_drift": [0.15, 0.08, 0.04],
    #   "alignment_with_target": 0.92,
    #   "ai_patterns": {...},
    #   "povm_readings_before": {...},
    #   "povm_readings_after": {...}
    # }

    # Timestamps
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    # Relationships
    # user = relationship("User", backref="transformations")

    def to_dict(self, include_metrics: bool = True, include_full_text: bool = True) -> Dict[str, Any]:
        """
        Convert transformation to dictionary.

        Args:
            include_metrics: Include full metrics object
            include_full_text: Include full source and result text

        Returns:
            Dictionary representation
        """
        result = {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "source_type": self.source_type,
            "source_uuid": str(self.source_uuid) if self.source_uuid else None,
            "transformation_type": self.transformation_type,
            "user_prompt": self.user_prompt,
            "parameters": self.parameters or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

        if include_full_text:
            result["source_text"] = self.source_text
            result["result_text"] = self.result_text
        else:
            # Include previews only
            result["source_preview"] = self.source_text[:200] + "..." if len(self.source_text) > 200 else self.source_text
            result["result_preview"] = self.result_text[:200] + "..." if len(self.result_text) > 200 else self.result_text

        if include_metrics:
            result["metrics"] = self.metrics or {}

        return result

    def __repr__(self) -> str:
        return f"<Transformation(id={self.id}, type={self.transformation_type}, created={self.created_at})>"
