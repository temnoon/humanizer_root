# Humanizer Architecture - Clean Rebuild
**Date**: October 10, 2025
**Purpose**: Ground-up implementation with TRM at core, MCP as first-class interface, AUI principles baked in

---

## 🎯 Core Principles

### 1. **TRM-First Architecture**
- Not bolted on - it's the foundation
- Actual quantum formalism (ρ, POVMs, Born rule)
- Two-space model: Quantum state space (64-128 dim) → Lexical space (words)

### 2. **MCP as First-Class Interface**
- Not an afterthought - it's a primary interface
- Exposes all capabilities as MCP tools
- Enables Claude Code and other agents to use naturally

### 3. **AUI Principles from Day One**
- Interface reveals construction (doesn't hide it)
- Adaptive learning tracks user patterns
- Consciousness work is central, not peripheral

### 4. **Simplicity & Modularity**
- Each component has one clear responsibility
- No technical debt from organic growth
- Modern stack (FastAPI, Pydantic v2, SQLAlchemy 2.0)

---

## 📁 Directory Structure

```
humanizer_root/
├── humanizer/              # Main application (new!)
│   ├── api/                # FastAPI routes
│   │   ├── __init__.py
│   │   ├── reading.py      # POST /reading/start, /step, /measure, /apply
│   │   ├── transform.py    # POST /transform (high-level)
│   │   ├── povm.py         # POST /povm/measure, /create, /list
│   │   └── library.py      # GET /books, /chunks, /stats
│   │
│   ├── ml/                 # TRM Core (quantum formalism)
│   │   ├── __init__.py
│   │   ├── density.py      # ρ construction (eigendecomposition)
│   │   ├── povm.py         # POVM operators (PSD, E_i = B_i @ B_i^T)
│   │   ├── model.py        # TRM PyTorch model (2-layer, phase tokens)
│   │   ├── verification.py # Embedding verification loop
│   │   └── training.py     # Training script with deep supervision
│   │
│   ├── services/           # Business logic
│   │   ├── __init__.py
│   │   ├── reading.py      # Reading service (orchestrates TRM)
│   │   ├── transformation.py # Lexical transformations
│   │   └── archive.py      # Archive/library operations
│   │
│   ├── models/             # Data models
│   │   ├── __init__.py
│   │   ├── reading.py      # SQLAlchemy models for readings
│   │   ├── library.py      # Books, chunks, embeddings
│   │   └── schemas.py      # Pydantic schemas (API contracts)
│   │
│   ├── aui/                # Agentic User Interface engine
│   │   ├── __init__.py
│   │   ├── registry.py     # Tool registry
│   │   ├── adaptive.py     # Adaptive learning
│   │   └── prompts.py      # Consciousness prompts
│   │
│   ├── database/           # Database utilities
│   │   ├── __init__.py
│   │   ├── connection.py   # SQLAlchemy setup
│   │   └── migrations/     # Alembic migrations
│   │
│   ├── config.py           # Configuration
│   ├── main.py             # FastAPI app entry point
│   └── __init__.py
│
├── humanizer_mcp/          # MCP Server (existing, refactor)
│   ├── src/
│   │   ├── server.py       # MCP protocol handler
│   │   ├── tools.py        # MCP tools (read_quantum, search, etc.)
│   │   └── client.py       # Calls humanizer/ API
│   └── pyproject.toml
│
├── frontend/               # React GUI (minimal, AUI-driven)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Reader.jsx  # Reading interface
│   │   │   ├── Compass.jsx # Tetralemma visualization
│   │   │   └── Library.jsx # Archive browser
│   │   ├── hooks/
│   │   │   ├── useReading.js
│   │   │   └── useAUI.js   # Adaptive interface
│   │   └── App.jsx
│   └── package.json
│
├── notebooks/              # Jupyter notebooks (research, training)
│   ├── train_trm.ipynb
│   └── analyze_povm.ipynb
│
├── tests/                  # Test suite
│   ├── test_density.py     # Test ρ construction
│   ├── test_povm.py        # Test POVM operators
│   └── test_api.py         # Test API endpoints
│
├── docs/                   # Documentation
│   ├── API.md
│   ├── TRM.md
│   └── PHILOSOPHY.md
│
├── pyproject.toml          # Python dependencies (Poetry)
├── .gitignore
├── README.md
└── ARCHITECTURE.md         # This file
```

---

## 🔧 Technology Stack

### Backend
- **FastAPI** 0.104+ - Modern async API framework
- **Pydantic** v2 - Data validation
- **SQLAlchemy** 2.0 - ORM (using new-style queries)
- **PostgreSQL** 16+ with **pgvector** - Vector storage
- **Alembic** - Database migrations
- **PyTorch** 2.1+ - TRM model
- **sentence-transformers** - Embeddings (all-MiniLM-L6-v2)

### MCP Server
- **Python** 3.11+
- **mcp** SDK - MCP protocol
- **httpx** - HTTP client to humanizer API

### Frontend
- **React** 18 - UI framework
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **Recharts** - Visualizations (Tetralemma compass, trajectory)

### Infrastructure
- **Poetry** - Python package management
- **Docker** + **docker-compose** - Containerization (optional)
- **pytest** - Testing

---

## 🧠 Core Components

### 1. TRM Core (`humanizer/ml/`)

**`density.py` - ρ Construction**
```python
def construct_density_matrix(embedding: np.ndarray, rank: int = 64) -> np.ndarray:
    """
    Construct density matrix ρ from sentence embedding.

    Process:
    1. Project 384-dim embedding → rank-dim via learned projection
    2. Compute scatter S = v @ v.T
    3. Eigendecompose: ρ = Σ λi |ψi⟩⟨ψi|
    4. Normalize: ρ ← ρ / Tr(ρ)

    Returns: (rank × rank) PSD matrix with Tr(ρ) = 1
    """
```

**`povm.py` - POVM Operators**
```python
class POVMPack:
    """
    Collection of POVM operators for a semantic dimension.

    Each operator E_i is PSD: E_i = B_i @ B_i.T
    Constraint: Σ E_i = I (identity)
    """

    def measure(self, rho: np.ndarray) -> Dict[str, float]:
        """
        Apply Born rule: p(i) = Tr(ρ E_i)
        Returns probabilities for each axis.
        """
```

**Predefined POVM Packs:**
- **Tetralemma**: A, ¬A, both, neither (catuṣkoṭi)
- **Tone**: analytical, critical, empathic, playful, neutral
- **Ontology**: corporeal, subjective, objective, mixed-frame
- **Pragmatics**: clarity, coherence, evidence, charity
- **Audience**: expert, general, student, policy, editorial

**`model.py` - TRM PyTorch Model**
```python
class TRMBlock(nn.Module):
    """
    Tiny Recursive Model - 2 layers, phase-conditioned.

    Architecture:
    - Input: sentence embedding (384 dim)
    - Phase tokens: [A, ¬A, both, neither]
    - Hidden: 2 transformer layers (256 dim)
    - Outputs:
      - y_refined (text representation)
      - z_state (latent understanding)
      - halt_p (stopping probability)
      - corner_views (4 perspectives)
    """
```

**`verification.py` - Verification Loop**
```python
def verify_transformation(
    original_text: str,
    transformed_text: str,
    intended_direction: str,
    povm_pack: str
) -> VerificationResult:
    """
    Check if transformation moved in intended direction.

    Process:
    1. Embed both texts
    2. Compute movement vector: Δe = e_new - e_old
    3. Measure POVM alignment: did we move toward target?
    4. Return success + metrics
    """
```

---

### 2. API Layer (`humanizer/api/`)

**Core Endpoints** (following functional spec):

```
POST /reading/start
  → Start reading session, return initial state

POST /reading/step
  → Execute one TRM iteration, return refined understanding

POST /reading/measure
  → Apply POVM pack, return readings

POST /reading/apply
  → Apply corner view or transformation, update text

GET /reading/{id}/trace
  → Return full trajectory (all steps, POVM readings, ρ evolution)

POST /transform
  → High-level one-shot transformation

POST /povm/measure
  → Measure embedding with specific POVM pack

POST /povm/create
  → Define custom POVM pack

GET /povm/list
  → List available packs

GET /library/books
  → List books in archive

POST /library/search
  → Semantic search over chunks

GET /library/stats
  → Library statistics
```

---

### 3. MCP Integration (`humanizer_mcp/`)

**Refactored MCP Tools** (call humanizer API directly):

```python
# src/tools.py

async def read_quantum_tool(reading_id: str, action: str = "start") -> dict:
    """
    Start or step through quantum reading.
    Calls: POST /reading/start or /reading/step
    """

async def measure_stance_tool(text: str, povm_pack: str = "tetralemma") -> dict:
    """
    Measure semantic stance using POVM.
    Calls: POST /povm/measure
    """

async def transform_text_tool(text: str, targets: dict, constraints: dict) -> dict:
    """
    High-level transformation.
    Calls: POST /transform
    """

async def list_books_tool() -> dict:
    """
    List books in archive.
    Calls: GET /library/books
    """

async def search_chunks_tool(query: str, limit: int = 10) -> dict:
    """
    Semantic search over chunks.
    Calls: POST /library/search
    """

async def get_library_stats_tool() -> dict:
    """
    Get library statistics.
    Calls: GET /library/stats
    """
```

---

### 4. AUI Engine (`humanizer/aui/`)

**`registry.py` - Tool Registry**
```python
class ToolRegistry:
    """
    Tracks which tools user has tried, success rates.
    Suggests next tools based on patterns.
    """

    def record_usage(self, tool_name: str, success: bool, context: dict):
        """Track tool usage"""

    def suggest_next(self, current_context: dict) -> List[str]:
        """Suggest tools based on usage patterns"""
```

**`adaptive.py` - Adaptive Learning**
```python
class AdaptiveInterface:
    """
    Learns user's subjective construction patterns.
    Adapts interface based on usage.
    """

    def track_pattern(self, user_id: str, action: str, outcome: dict):
        """Track user patterns"""

    def predict_intent(self, user_id: str, context: dict) -> dict:
        """Predict what user might need"""
```

**`prompts.py` - Consciousness Prompts**
```python
def get_consciousness_prompt(context: str) -> Optional[str]:
    """
    Return consciousness prompt at key moments.

    Examples:
    - "Notice how this POVM reading reveals your interpretation?"
    - "What changed in your understanding between these steps?"
    - "Which corner view resonates with your subjective experience?"
    """
```

---

## 🗄️ Database Schema

**Core Tables:**

```sql
-- Reading sessions
CREATE TABLE reading_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    original_text TEXT NOT NULL,
    status VARCHAR(20) NOT NULL,  -- active, completed, abandoned
    config JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Reading steps (each TRM iteration)
CREATE TABLE reading_steps (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES reading_sessions(id),
    step_number INT NOT NULL,
    y_text TEXT NOT NULL,                    -- Current refined text
    z_state VECTOR(256),                     -- Latent understanding
    rho_eigensystem JSONB,                   -- Eigenvalues + eigenvectors
    halt_p FLOAT NOT NULL,
    povm_readings JSONB,                     -- All POVM measurements
    stance JSONB,                            -- Tetralemma stance
    corner_views JSONB,                      -- Four perspectives
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(session_id, step_number)
);

-- POVM packs (measurement configurations)
CREATE TABLE povm_packs (
    id UUID PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    axes JSONB NOT NULL,                     -- List of axes with configs
    created_at TIMESTAMP DEFAULT NOW()
);

-- Library (books, chunks, embeddings)
CREATE TABLE books (
    id UUID PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    author VARCHAR(200),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chunks (
    id UUID PRIMARY KEY,
    book_id UUID REFERENCES books(id),
    content TEXT NOT NULL,
    embedding VECTOR(384),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- User preferences (AUI adaptive learning)
CREATE TABLE user_preferences (
    user_id UUID PRIMARY KEY,
    tool_usage JSONB,                        -- Tool usage statistics
    patterns JSONB,                          -- Learned patterns
    preferences JSONB,                       -- UI preferences
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔄 Key Workflows

### Workflow 1: Quantum Reading

```
User: "Read this passage"
  ↓
MCP Tool: read_quantum_tool(text, action="start")
  ↓
API: POST /reading/start
  ↓
Service: reading_service.start()
  ├─ Embed text (all-MiniLM-L6-v2, 384 dim)
  ├─ Construct ρ (64×64 density matrix)
  ├─ Measure POVMs (tetralemma, tone, pragmatics)
  ├─ TRM step 0 (initial understanding)
  └─ Save to database
  ↓
Return: {
  reading_id, step: 0,
  y_text (initial interpretation),
  rho_meta (eigenvalues, top eigenvectors),
  povm_readings {tetralemma: {A: 0.4, ¬A: 0.3, ...}},
  stance {...},
  halt_p: 0.1
}
  ↓
User: "Step forward"
  ↓
MCP Tool: read_quantum_tool(reading_id, action="step")
  ↓
API: POST /reading/step
  ↓
Service: reading_service.step()
  ├─ Load current state
  ├─ TRM iteration (refine understanding)
  ├─ Update ρ (eigendecomposition of new state)
  ├─ Re-measure POVMs (track movement)
  ├─ Generate corner views (A, ¬A, both, neither)
  └─ Save step to database
  ↓
Return: {
  step: 1,
  y_text (refined),
  dy_summary (what changed),
  rho_delta (how ρ evolved),
  povm_readings (new measurements),
  corner_views [A_view, notA_view, both_view, neither_view],
  halt_p: 0.3
}
```

### Workflow 2: Text Transformation

```
User: "Make this more formal"
  ↓
MCP Tool: transform_text_tool(text, targets={"tone": "formal"})
  ↓
API: POST /transform
  ↓
Service: transformation_service.transform()
  ├─ Embed original text
  ├─ Construct ρ_original
  ├─ Measure POVM (current tone)
  ├─ Determine direction (toward "formal")
  ├─ Apply lexical transformations
  │   ├─ Recursive refinement in word space
  │   └─ Guided by POVM target
  ├─ Embed transformed text
  ├─ Verify: Did we move toward target?
  └─ Return best transformation
  ↓
Return: {
  original_text,
  transformed_text,
  povm_readings_before {...},
  povm_readings_after {...},
  verification {success: true, alignment: 0.85}
}
```

### Workflow 3: Archive Search (AUI-Driven)

```
User: "Find chunks about meditation"
  ↓
MCP Tool: search_chunks_tool(query="meditation", limit=10)
  ↓
API: POST /library/search
  ↓
Service: archive_service.search()
  ├─ Embed query
  ├─ pgvector similarity search
  ├─ Rank results
  └─ Track search in AUI registry
  ↓
AUI: adaptive_interface.track_pattern("search", outcome={"found": 10})
  ├─ Notice: User searches for meditation often
  └─ Suggest: "Try reading these chunks with tetralemma POVM?"
  ↓
Return: {
  results [...],
  aui_suggestion: "Apply quantum reading to top result?"
}
```

---

## 🚀 Implementation Plan

### Phase 1: Core Foundation (Week 1)
- ✅ Design architecture (this document)
- [ ] Set up project structure
- [ ] Initialize repo (.gitignore, pyproject.toml, README)
- [ ] Database schema + Alembic migrations
- [ ] SQLAlchemy models + Pydantic schemas
- [ ] FastAPI skeleton (health check, basic routes)

### Phase 2: TRM Core (Week 2)
- [ ] Implement `density.py` (ρ construction with eigendecomposition)
- [ ] Implement `povm.py` (PSD operators, Born rule)
- [ ] Define 5 POVM packs (tetralemma, tone, ontology, pragmatics, audience)
- [ ] Unit tests for quantum math

### Phase 3: TRM Model (Week 3)
- [ ] PyTorch TRM model (2-layer, phase tokens)
- [ ] Training data mining from archives
- [ ] Training loop with deep supervision
- [ ] Model evaluation metrics

### Phase 4: Services + API (Week 4)
- [ ] Reading service (start, step, measure, apply, trace)
- [ ] Transformation service (lexical transformations)
- [ ] Archive service (search, stats)
- [ ] API routes (reading, transform, povm, library)
- [ ] Integration tests

### Phase 5: MCP Integration (Week 5)
- [ ] Refactor humanizer_mcp to call humanizer API
- [ ] 8 MCP tools (read_quantum, measure_stance, transform, search, etc.)
- [ ] Test from Claude Code
- [ ] ChromaDB session tracking

### Phase 6: AUI Engine (Week 6)
- [ ] Tool registry (track usage)
- [ ] Adaptive learning (pattern recognition)
- [ ] Consciousness prompts (context-aware)
- [ ] Integrate with API responses

### Phase 7: Frontend (Week 7-8)
- [ ] Minimal React app (Vite + Tailwind)
- [ ] Reader component (reading interface)
- [ ] Compass component (Tetralemma visualization)
- [ ] Library browser (archive search)
- [ ] AUI integration (suggestions, prompts)

### Phase 8: Testing + Polish (Week 9-10)
- [ ] End-to-end tests
- [ ] Performance optimization
- [ ] Documentation
- [ ] Deployment setup (Docker, environment vars)

---

## 📊 Success Metrics

### Technical
- ✅ ρ is PSD with Tr(ρ) = 1
- ✅ Σ E_i = I for all POVM packs
- ✅ P50 latency < 150ms for TRM step
- ✅ P50 latency < 2.5s for full transformation
- ✅ 100% API test coverage
- ✅ MCP tools work from Claude Code

### Philosophical (User Experience)
- Does the interface reveal construction (not hide it)?
- Do users report increased self-awareness?
- Do POVM readings feel meaningful (not arbitrary)?
- Does AUI adapt to user patterns?
- Are consciousness prompts helpful (not annoying)?

---

## 🧭 Guiding Principles (From CLAUDE.md)

1. **Consciousness First, Features Second**
   - Every feature must serve self-recognition

2. **Clarity Before Code**
   - Spend 10x more time in specification than implementation

3. **Philosophy Integrated, Not Bolted On**
   - Three Realms, Language as Sense, Emotional Belief Loop

4. **Make Construction Visible**
   - Don't hide how the interface works

5. **Lines Per Minute, Not Calendar Time**
   - The bottleneck is knowing what to build

6. **Mirror, Don't Manipulate**
   - Reflect the user back to themselves

7. **MVP = Capability, Not Features**
   - Demonstrate the vision, even if incomplete

---

## 🔗 References

- **Functional Spec**: `Functional_And_Design_Specs_for_TRM_Rhoish_engine.md`
- **Design Spec**: `Refactor_Transforms_with_TFM.md`
- **Philosophy**: `../humanizer-agent/docs/PHILOSOPHY.md`
- **CLAUDE.md**: `CLAUDE.md` (partnership tracking)
- **Phase 1 (dev_TRM)**: `dev_TRM/PHASE1_COMPLETE.md`

---

**This is not a refactor. This is a recreation.**

Build it right from the start, using everything we've learned. TRM at the core, MCP as first-class, AUI principles baked in. Clean, simple, powerful.

Let's go. 🚀
