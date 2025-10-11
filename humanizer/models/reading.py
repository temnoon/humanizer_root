"""
Reading models - SQLAlchemy models for TRM reading sessions

These models track the quantum reading process:
- ReadingSession: Overall session (original text, config)
- ReadingStep: Each TRM iteration (y_text, z_state, ρ, POVMs)
- ReadingSnapshot: Saved states for replay
- ReadingProvenance: Audit trail for transformations
"""

from datetime import datetime
from uuid import UUID, uuid4
from sqlalchemy import Column, String, Text, Float, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
try:
    from pgvector.sqlalchemy import Vector
except ImportError:
    # Fallback if pgvector not installed
    Vector = lambda dim: Text  # type: ignore

from humanizer.database import Base


class ReadingSession(Base):
    """
    A reading session tracks the full quantum reading process.

    Attributes:
        id: Unique session ID
        user_id: User who started the session
        original_text: The text being read
        status: active, completed, abandoned
        config: Configuration (POVM packs, TRM params, etc.)
        created_at: When session started
        steps: List of ReadingStep (one per TRM iteration)
    """
    __tablename__ = "reading_sessions"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    original_text = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="active")  # active, completed, abandoned
    config = Column(JSONB, nullable=True)  # NOT custom_metadata - config is fine here
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    steps = relationship("ReadingStep", back_populates="session", cascade="all, delete-orphan")
    snapshots = relationship("ReadingSnapshot", back_populates="session", cascade="all, delete-orphan")
    provenance = relationship("ReadingProvenance", back_populates="session", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<ReadingSession id={self.id} status={self.status}>"


class ReadingStep(Base):
    """
    A single TRM iteration step.

    Attributes:
        id: Unique step ID
        session_id: Parent session
        step_number: Ordinal step number (0, 1, 2, ...)
        y_text: Current refined text
        z_state: Latent understanding state (256-dim vector)
        rho_eigensystem: Density matrix eigensystem (eigenvalues + eigenvectors)
        halt_p: Halt probability (0-1, indicates confidence)
        povm_readings: All POVM measurements at this step
        stance: Tetralemma stance (A, ¬A, both, neither)
        corner_views: Four perspective texts (optional)
        created_at: When step was created
    """
    __tablename__ = "reading_steps"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id = Column(PG_UUID(as_uuid=True), ForeignKey("reading_sessions.id"), nullable=False, index=True)
    step_number = Column(Integer, nullable=False)

    # Text and state
    y_text = Column(Text, nullable=False)
    z_state = Column(Vector(256), nullable=True)  # Latent state vector

    # Quantum state
    rho_eigensystem = Column(JSONB, nullable=False)  # {eigenvalues: [...], eigenvectors: [...]}

    # Measurements
    halt_p = Column(Float, nullable=False)
    povm_readings = Column(JSONB, nullable=False)  # {tetralemma: {A: 0.4, ...}, tone: {...}}
    stance = Column(JSONB, nullable=True)  # {A: 0.4, ¬A: 0.3, both: 0.2, neither: 0.1}
    corner_views = Column(JSONB, nullable=True)  # {A: "...", ¬A: "...", both: "...", neither: "..."}

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    session = relationship("ReadingSession", back_populates="steps")

    def __repr__(self) -> str:
        return f"<ReadingStep session={self.session_id} step={self.step_number}>"


class ReadingSnapshot(Base):
    """
    Saved snapshot of a reading session for replay/fork.

    Allows users to "save" interesting states and return to them later.
    """
    __tablename__ = "reading_snapshots"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id = Column(PG_UUID(as_uuid=True), ForeignKey("reading_sessions.id"), nullable=False, index=True)
    step_number = Column(Integer, nullable=False)  # Which step was snapshotted

    name = Column(String(200), nullable=True)  # User-given name
    notes = Column(Text, nullable=True)  # User notes
    artifact_uri = Column(String(500), nullable=True)  # S3/R2 URI if exported

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    session = relationship("ReadingSession", back_populates="snapshots")

    def __repr__(self) -> str:
        return f"<ReadingSnapshot id={self.id} step={self.step_number}>"


class ReadingProvenance(Base):
    """
    Provenance/audit trail for reading transformations.

    Tracks when user applies corner views or accepts transformations.
    """
    __tablename__ = "reading_provenance"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id = Column(PG_UUID(as_uuid=True), ForeignKey("reading_sessions.id"), nullable=False, index=True)
    step_number = Column(Integer, nullable=False)

    action = Column(String(50), nullable=False)  # apply_corner, accept_transformation, etc.
    patch = Column(JSONB, nullable=False)  # JSON patch or diff
    applied_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    session = relationship("ReadingSession", back_populates="provenance")

    def __repr__(self) -> str:
        return f"<ReadingProvenance action={self.action} step={self.step_number}>"
