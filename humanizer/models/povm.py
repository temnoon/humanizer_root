"""
POVM models - Storage for POVM pack configurations

Allows dynamic creation and management of POVM packs.
"""

from datetime import datetime
from uuid import uuid4
from sqlalchemy import Column, String, Text, DateTime, JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from humanizer.database import Base


class POVMPack(Base):
    """
    POVM pack configuration.

    Stores the definition of a POVM measurement pack (tetralemma, tone, etc.).

    Attributes:
        id: Unique pack ID
        name: Pack name (e.g., "tetralemma", "tone")
        description: Human-readable description
        axes: List of axis definitions with parameters
        created_at: When pack was created
    """
    __tablename__ = "povm_packs"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)

    # Axes configuration
    # Example: [
    #   {"name": "A", "kind": "psd", "params": {...}},
    #   {"name": "¬A", "kind": "psd", "params": {...}},
    #   ...
    # ]
    axes = Column(JSONB, nullable=False)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<POVMPack name={self.name}>"
