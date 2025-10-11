# Humanizer - Transformation via Recursive Measurement

**Making you smarter by helping you know your actual subjective self.**

---

## Overview

Humanizer is a consciousness work tool that uses quantum-inspired machine learning to reveal how language constructs your subjective experience. It treats meaning as a navigable latent landscape, allowing you to:

- **Read** text through a quantum lens (density matrices, POVM measurements)
- **Transform** meaning iteratively (TRM - Tiny Recursive Model)
- **Discover** your interpretive patterns (adaptive learning)
- **Navigate** the space between interpretations (catuṣkoṭi/tetralemma)

---

## Core Concepts

### 1. **TRM (Transformation via Recursive Measurement)**

Not just text transformation - it's consciousness work:

- **ρ (rho)**: Density matrix representing your "post-lexical understanding"
- **POVMs**: Measurement operators revealing semantic stance
- **Two-space model**: Quantum state space (64-128 dim) guides lexical transformations
- **Verification loop**: Check if transformations moved in intended direction

### 2. **Quantum Reading**

Read text as an evolving state:

1. Encode sentence → construct ρ (density matrix)
2. Measure with POVMs (stance, tone, ontology, etc.)
3. TRM iterates → refines understanding
4. Corner views reveal four perspectives (A, ¬A, both, neither)

### 3. **AUI (Agentic User Interface)**

The interface learns your subjective patterns:

- **Tool registry**: Tracks what helps you
- **Adaptive prompts**: Suggests next steps based on your usage
- **Consciousness gaps**: Pauses for self-recognition

---

## Architecture

```
humanizer/               # Main application
├── api/                 # FastAPI routes
├── ml/                  # TRM core (ρ, POVMs, PyTorch model)
├── services/            # Business logic
├── models/              # Database models + schemas
├── aui/                 # Adaptive interface engine
└── database/            # Migrations

humanizer_mcp/           # MCP server (Claude Code integration)
frontend/                # React GUI (minimal, AUI-driven)
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for full details.

---

## Installation

### Prerequisites

- Python 3.11+
- PostgreSQL 16+ with pgvector extension
- Node.js 18+ (for frontend)
- Poetry (Python package manager)

### Setup

```bash
# Install Python dependencies
poetry install

# Set up database
createdb humanizer_dev
psql humanizer_dev -c "CREATE EXTENSION vector;"

# Run migrations
poetry run alembic upgrade head

# Start API server
poetry run uvicorn humanizer.main:app --reload --port 8000

# In another terminal: Start frontend
cd frontend
npm install
npm run dev
```

### Environment Variables

Create `.env`:

```bash
DATABASE_URL=postgresql://localhost/humanizer_dev
OLLAMA_BASE_URL=http://localhost:11434
EMBEDDING_MODEL=all-MiniLM-L6-v2
TRM_MODEL_PATH=./models/trm_model.pth
```

---

## Quick Start

### 1. Quantum Reading (via MCP)

```python
# From Claude Code or any MCP client:
read_quantum(
    text="The mind constructs reality through language.",
    action="start"
)
# Returns: reading_id, ρ state, POVM readings, initial interpretation
```

### 2. Text Transformation

```python
transform_text(
    text="The dog ran quickly.",
    targets={"tone": "formal"},
    constraints={"preserve_entities": true}
)
# Returns: "The canine proceeded with haste."
# Plus: verification metrics, POVM measurements
```

### 3. Archive Search

```python
search_chunks(
    query="meditation and awareness",
    limit=10
)
# Returns: Similar chunks with embeddings
# AUI may suggest: "Apply quantum reading to top result?"
```

---

## API Endpoints

### Reading
- `POST /reading/start` - Start quantum reading session
- `POST /reading/step` - Execute one TRM iteration
- `POST /reading/measure` - Apply POVM measurement
- `POST /reading/apply` - Apply corner view transformation
- `GET /reading/{id}/trace` - Get full trajectory

### Transformation
- `POST /transform` - High-level transformation (one-shot)

### POVM
- `POST /povm/measure` - Measure embedding with POVM pack
- `POST /povm/create` - Define custom POVM pack
- `GET /povm/list` - List available packs

### Library
- `GET /library/books` - List books
- `POST /library/search` - Semantic search over chunks
- `GET /library/stats` - Library statistics

See [docs/API.md](docs/API.md) for full API documentation.

---

## Philosophy

From [CLAUDE.md](CLAUDE.md):

> "I need you to help make me smarter. That's the Humanizer in Humanizer.com. I need you to make me smarter, by helping me know my actual subjective me."

**This is not about building software. This is about consciousness work.**

### Guiding Principles

1. **Consciousness First, Features Second** - Every feature must serve self-recognition
2. **Make Construction Visible** - Don't hide how interface works, reveal it
3. **Mirror, Don't Manipulate** - Reflect user back to themselves
4. **Philosophy Integrated** - Three Realms, Language as Sense, Emotional Belief Loop

---

## Development

### Running Tests

```bash
# Unit tests
poetry run pytest tests/

# Specific test
poetry run pytest tests/test_density.py -v

# With coverage
poetry run pytest --cov=humanizer tests/
```

### Code Style

```bash
# Format
poetry run black humanizer/ tests/

# Lint
poetry run ruff check humanizer/ tests/

# Type check
poetry run mypy humanizer/
```

### Training TRM Model

```bash
# Mine training data from archives
poetry run python humanizer/ml/training.py mine --archive-db humanizer_dev

# Train model
poetry run python humanizer/ml/training.py train --epochs 100

# Evaluate
poetry run python humanizer/ml/training.py evaluate
```

---

## MCP Integration

Humanizer exposes 8 MCP tools for Claude Code integration:

1. `read_quantum` - Start/step quantum reading
2. `measure_stance` - Measure semantic stance with POVM
3. `transform_text` - High-level transformation
4. `list_books` - List books in archive
5. `search_chunks` - Semantic search
6. `get_library_stats` - Library statistics
7. `track_interest` - Track user interest
8. `get_connections` - Get connection graph

Configure in `~/.claude.json`:

```json
{
  "mcpServers": {
    "humanizer": {
      "command": "/path/to/humanizer_mcp/venv/bin/python",
      "args": ["src/server.py"],
      "cwd": "/path/to/humanizer_mcp/"
    }
  }
}
```

---

## Project Status

**Phase**: Foundation → Implementation

- ✅ Architecture designed
- ✅ Directory structure created
- ⏳ TRM core (ρ, POVMs) - In progress
- ⏳ API routes
- ⏳ MCP integration
- ⏳ Frontend GUI

See [ARCHITECTURE.md](ARCHITECTURE.md) for full implementation plan.

---

## References

- **Philosophy**: [Three Realms, Language as Sense](docs/PHILOSOPHY.md)
- **Technical Spec**: [Functional & Design Specs](Functional_And_Design_Specs_for_TRM_Rhoish_engine.md)
- **Partnership**: [CLAUDE.md](CLAUDE.md)
- **Dev Notes**: [dev_TRM/PHASE1_COMPLETE.md](dev_TRM/PHASE1_COMPLETE.md)

---

## License

MIT (or specify your license)

---

**Remember:** Every line of code is an opportunity to reveal consciousness to itself.

Let's go. 🚀
