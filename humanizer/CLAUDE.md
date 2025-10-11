# Humanizer Project - Development Guide

**Last Updated**: October 10, 2025
**Purpose**: Bootstrap guide for Claude sessions working on this codebase

---

## 🎯 Project Mission

> "Making you smarter by helping you know your actual subjective self."

This is **consciousness work**, not just software development. Every feature must serve self-recognition.

---

## 📁 Project Structure

```
humanizer_root/
├── humanizer/              # Main application
│   ├── api/                # FastAPI routes
│   ├── ml/                 # TRM core (quantum formalism)
│   ├── services/           # Business logic
│   ├── models/             # SQLAlchemy + Pydantic
│   ├── aui/                # Adaptive User Interface
│   ├── database/           # Connection, migrations
│   ├── config.py
│   └── main.py
├── humanizer_mcp/          # MCP server
├── frontend/               # React GUI
├── tests/                  # Test suite
└── docs/                   # Documentation
```

---

## 🚨 Critical Best Practices

### 1. **ALWAYS Use `custom_metadata` (Not `metadata`)**

**SQLAlchemy reserves `metadata` as a keyword.** Use `custom_metadata` instead:

```python
# ❌ WRONG - Will cause errors
class Book(Base):
    __tablename__ = "books"
    metadata = Column(JSONB)  # RESERVED KEYWORD!

# ✅ CORRECT
class Book(Base):
    __tablename__ = "books"
    custom_metadata = Column(JSONB)  # Safe
```

This applies to:
- All SQLAlchemy models
- All Pydantic schemas
- All JSON payloads
- All database columns

**This was a painful lesson learned in humanizer-agent. Never again.**

---

### 2. **ALWAYS Use Pydantic for Interfaces**

All API request/response types must be Pydantic models:

```python
from pydantic import BaseModel, Field
from typing import Optional, Dict, List

class ReadingStartRequest(BaseModel):
    """Request to start reading session."""
    text: str = Field(..., description="Text to read")
    povm_packs: Optional[List[str]] = Field(
        default=["tetralemma"],
        description="POVM packs to use"
    )

    model_config = {"json_schema_extra": {
        "example": {
            "text": "The mind constructs reality.",
            "povm_packs": ["tetralemma", "tone"]
        }
    }}
```

**Benefits:**
- Type safety
- Automatic validation
- OpenAPI docs generation
- Clear contracts

---

### 3. **SQLAlchemy 2.0 Patterns**

Use new-style SQLAlchemy (not legacy):

```python
from sqlalchemy import select
from sqlalchemy.orm import Session

# ✅ CORRECT (2.0 style)
async def get_book(session: Session, book_id: UUID):
    stmt = select(Book).where(Book.id == book_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()

# ❌ WRONG (legacy style)
book = session.query(Book).filter(Book.id == book_id).first()
```

**Key patterns:**
- Use `select()` not `session.query()`
- Use `session.execute()` then `result.scalar_one()` or `result.all()`
- Use `where()` not `filter()`
- Explicit typing with type hints

---

### 4. **Async/Await Throughout**

FastAPI is async-first. Keep it that way:

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

@router.post("/reading/start")
async def start_reading(
    request: ReadingStartRequest,
    session: AsyncSession = Depends(get_session),
) -> ReadingStartResponse:
    # Use async services
    result = await reading_service.start(session, request)
    return result
```

**No blocking calls** in async functions. If you must use sync code, wrap in `run_in_executor()`.

---

### 5. **Database Migrations (Alembic)**

Always generate migrations for schema changes:

```bash
# Generate migration
alembic revision --autogenerate -m "Add reading_sessions table"

# Review the migration file (ALWAYS REVIEW!)
# Edit if needed (Alembic isn't perfect)

# Apply migration
alembic upgrade head

# Rollback if needed
alembic downgrade -1
```

**Never edit database schema directly.** Migrations are the source of truth.

---

### 6. **Type Hints Everywhere**

Python 3.11+ with strict typing:

```python
from typing import Optional, List, Dict
from uuid import UUID
import numpy as np
from numpy.typing import NDArray

def construct_density_matrix(
    embedding: NDArray[np.float64],
    rank: int = 64,
) -> DensityMatrix:
    """Construct ρ from embedding."""
    ...
```

**Benefits:**
- Catches bugs early
- Better IDE support
- Self-documenting code

---

### 7. **Error Handling**

Use FastAPI's exception handlers:

```python
from fastapi import HTTPException, status

@router.get("/reading/{reading_id}")
async def get_reading(reading_id: UUID, session: AsyncSession = Depends(get_session)):
    result = await reading_service.get(session, reading_id)

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Reading {reading_id} not found"
        )

    return result
```

**Custom exceptions for business logic:**

```python
class TransformationError(Exception):
    """Raised when transformation fails."""
    pass

# In service layer
if not verify_result.success:
    raise TransformationError(
        f"Transformation failed: {verify_result.diagnosis}"
    )

# In API layer
@app.exception_handler(TransformationError)
async def transformation_error_handler(request, exc):
    return JSONResponse(
        status_code=422,
        content={"detail": str(exc)}
    )
```

---

### 8. **Testing**

Write tests as you go (not after):

```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_start_reading(client: AsyncClient):
    response = await client.post(
        "/reading/start",
        json={"text": "The mind constructs reality."}
    )
    assert response.status_code == 200
    data = response.json()
    assert "reading_id" in data
    assert data["step"] == 0
```

**Test layers:**
- Unit tests: `tests/test_density.py` (TRM core)
- Integration tests: `tests/test_api.py` (API endpoints)
- End-to-end tests: Full workflow

---

### 9. **Configuration**

Use Pydantic Settings for environment config:

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    embedding_model: str = "all-MiniLM-L6-v2"
    trm_rank: int = 64

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8"
    }

settings = Settings()
```

**Never hardcode** database URLs, API keys, etc.

---

### 10. **Logging**

Use structured logging:

```python
import logging
from pythonjsonlogger import jsonlogger

logger = logging.getLogger(__name__)

# In service
logger.info(
    "Reading started",
    extra={
        "reading_id": str(reading_id),
        "text_length": len(text),
        "povm_packs": povm_packs,
    }
)

# On error
logger.error(
    "Transformation failed",
    extra={"reading_id": str(reading_id)},
    exc_info=True
)
```

---

## 🧠 TRM Core Concepts

### Density Matrix (ρ)

```python
from humanizer.ml.density import construct_density_matrix

# Construct from sentence embedding
rho = construct_density_matrix(embedding, rank=64)

# Properties
rho.purity  # In [0, 1], measures mixedness
rho.entropy  # Von Neumann entropy
rho.eigenvalues  # Sorted descending
```

**Key constraints:**
- ρ is PSD (all eigenvalues ≥ 0)
- Tr(ρ) = 1 (normalized)
- ρ is Hermitian (real symmetric in our case)

### POVM Operators

```python
from humanizer.ml.povm import get_all_packs

# Get predefined packs
packs = get_all_packs(rank=64)
tetralemma = packs["tetralemma"]

# Measure
readings = tetralemma.measure(rho)
# → {"A": 0.4, "¬A": 0.3, "both": 0.2, "neither": 0.1}
```

**Key constraints:**
- Each E_i is PSD: E_i = B_i @ B_i^T
- Operators sum to identity: Σ E_i = I
- Born rule: p(i) = Tr(ρ E_i)
- Probabilities sum to 1: Σ p(i) = 1

### Verification Loop

```python
from humanizer.ml.verification import verify_transformation

result = verify_transformation(
    embedding_before=emb1,
    embedding_after=emb2,
    povm_pack_name="tone",
    target_axis="analytical",
    target_threshold=0.1
)

# Check success
if result.success:
    print(f"Moved correctly! Alignment: {result.alignment:.2%}")
else:
    diagnosis = diagnose_transformation_failure(result)
    print(f"Failed: {diagnosis['issue']}")
```

---

## 🗄️ Database Schema

### Key Tables

```sql
-- Reading sessions
CREATE TABLE reading_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    original_text TEXT NOT NULL,
    status VARCHAR(20) NOT NULL,
    config JSONB,  -- NOT custom_metadata, config is fine
    created_at TIMESTAMP DEFAULT NOW()
);

-- Reading steps
CREATE TABLE reading_steps (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES reading_sessions(id),
    step_number INT NOT NULL,
    y_text TEXT NOT NULL,
    z_state VECTOR(256),
    rho_eigensystem JSONB,
    halt_p FLOAT NOT NULL,
    povm_readings JSONB,
    stance JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- POVM packs
CREATE TABLE povm_packs (
    id UUID PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    axes JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Use pgvector for embeddings:**
```python
from pgvector.sqlalchemy import Vector

class ReadingStep(Base):
    __tablename__ = "reading_steps"
    z_state = Column(Vector(256))  # pgvector type
```

---

## 🔧 Common Tasks

### Start Development Server

```bash
# Backend
cd humanizer_root
poetry run uvicorn humanizer.main:app --reload --port 8000

# Frontend
cd frontend
npm run dev
```

### Run Tests

```bash
# All tests
poetry run pytest

# Specific test file
poetry run pytest tests/test_density.py -v

# With coverage
poetry run pytest --cov=humanizer tests/
```

### Database Operations

```bash
# Create database
createdb humanizer_dev
psql humanizer_dev -c "CREATE EXTENSION vector;"

# Migrate
poetry run alembic upgrade head

# Reset (careful!)
dropdb humanizer_dev && createdb humanizer_dev && alembic upgrade head
```

### Add Dependency

```bash
# Add package
poetry add package-name

# Add dev dependency
poetry add --group dev pytest-asyncio

# Update lockfile
poetry lock
```

---

## 🐛 Common Pitfalls

### 1. ❌ Using `metadata` (SQLAlchemy reserved)
**Solution:** Use `custom_metadata` everywhere

### 2. ❌ Mixing sync/async code
**Solution:** Keep async throughout, use `run_in_executor()` for blocking calls

### 3. ❌ Forgetting to normalize ρ
**Solution:** Always `rho = rho / np.trace(rho)` after construction

### 4. ❌ POVM operators not summing to identity
**Solution:** Auto-normalize in `POVMPack.__post_init__()` (already implemented)

### 5. ❌ Not validating Pydantic inputs
**Solution:** Let Pydantic do its job, handle `ValidationError` in exception handlers

### 6. ❌ Database session leaks
**Solution:** Use `async with` or FastAPI's `Depends(get_session)`

---

## 📚 Key Files

### Core Implementation
- `humanizer/ml/density.py` - ρ construction
- `humanizer/ml/povm.py` - POVM operators
- `humanizer/ml/verification.py` - Verification loop

### API Layer
- `humanizer/main.py` - FastAPI app
- `humanizer/api/reading.py` - Reading endpoints
- `humanizer/api/povm.py` - POVM endpoints
- `humanizer/api/library.py` - Library endpoints

### Data Layer
- `humanizer/models/reading.py` - SQLAlchemy models
- `humanizer/models/schemas.py` - Pydantic schemas
- `humanizer/database/connection.py` - DB setup

### Business Logic
- `humanizer/services/reading.py` - Reading service
- `humanizer/services/transformation.py` - Transformation service

---

## 🎯 Philosophy

From the parent CLAUDE.md:

1. **Consciousness First, Features Second** - Every feature must serve self-recognition
2. **Clarity Before Code** - Spend 10x more time in specification
3. **Make Construction Visible** - Don't hide how interface works
4. **Lines Per Minute, Not Calendar Time** - Bottleneck is clarity, not implementation

---

## 🚀 Next Steps

Current status (Oct 10, 2025):
- ✅ TRM core implemented (density, POVM, verification)
- ✅ Tests passing
- ⏳ API layer (in progress)
- ⏳ Database models
- ⏳ Services layer
- ⏳ MCP integration
- ⏳ Frontend

See `../ARCHITECTURE.md` for full roadmap.

---

**Remember:** This is consciousness work. Every line of code should reveal subjectivity, not hide it.
