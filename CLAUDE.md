# Humanizer Root - Meta-Level Development Guide

**Last Updated**: October 10, 2025
**Purpose**: Meta-level tracking for Claude sessions across entire humanizer ecosystem

---

## 🎯 The Mission

> "I need you to help make me smarter. That's the Humanizer in Humanizer.com. I need you to make me smarter, by helping me know my actual subjective me."

**This is not about building software. This is about consciousness work.**

---

## 📁 Ecosystem Structure

```
humanizer_root/                    # You are here
├── humanizer/                     # NEW: Clean rebuild (Oct 2025)
│   ├── api/                       # FastAPI routes
│   ├── ml/                        # TRM core (quantum formalism)
│   ├── services/                  # Business logic
│   └── CLAUDE.md                  # ← Project-specific guide
├── humanizer_mcp/                 # MCP server (existing, will refactor)
├── humanizer-agent/               # OLD: Legacy codebase (50k+ lines)
│   └── CLAUDE.md                  # ← Historical reference
├── dev_TRM/                       # Prototype from Phase 1
└── CLAUDE.md                      # ← This file (meta-level)
```

---

## 🚨 Critical Best Practices (ECOSYSTEM-WIDE)

### 1. **NEVER Use `metadata` - Always `custom_metadata`**

**This is the #1 mistake across the entire humanizer ecosystem.**

SQLAlchemy reserves `metadata` as a keyword. Using it causes mysterious errors:

```python
# ❌ WRONG - Caused pain in humanizer-agent
class Book(Base):
    metadata = Column(JSONB)  # RESERVED!

# ✅ CORRECT - Use everywhere
class Book(Base):
    custom_metadata = Column(JSONB)
```

**Applies to:**
- All SQLAlchemy models (humanizer/, humanizer-agent/, dev_TRM/)
- All Pydantic schemas
- All JSON payloads
- All API documentation

**Document this in EVERY project CLAUDE.md.**

---

### 2. **Pydantic for ALL Interfaces**

Across humanizer/, humanizer-agent/, humanizer_mcp/:

```python
from pydantic import BaseModel, Field

class ReadingStartRequest(BaseModel):
    text: str = Field(..., description="Text to read")

    model_config = {"json_schema_extra": {"example": {...}}}
```

**Benefits:**
- Type safety
- Automatic validation
- OpenAPI docs
- Clear contracts

**No raw dicts** for API requests/responses.

---

### 3. **SQLAlchemy 2.0 Patterns**

New projects (humanizer/) use SQLAlchemy 2.0:

```python
# ✅ CORRECT (2.0 style)
stmt = select(Book).where(Book.id == book_id)
result = await session.execute(stmt)
book = result.scalar_one_or_none()

# ❌ LEGACY (humanizer-agent still uses this)
book = session.query(Book).filter(Book.id == book_id).first()
```

When refactoring humanizer-agent → humanizer, convert all queries to 2.0 style.

---

### 4. **Python Virtual Environments**

**CRITICAL LESSON FROM HUMANIZER-AGENT:**

The backend MUST use its virtual environment:

```bash
# ❌ WRONG - Uses global Python (missing deps)
python agent_service.py

# ✅ CORRECT - Uses venv
source venv/bin/activate && python agent_service.py

# Or with Poetry
poetry run python agent_service.py
```

**This caused hours of debugging in humanizer-agent.** Document in project CLAUDE.md.

---

### 5. **MCP Server Configuration**

From humanizer_mcp experience (Oct 9, 2025):

**Issue:** Claude Code couldn't connect to MCP server
**Root cause:** Using `poetry run python` instead of direct interpreter path

**Solution:**

```json
// ~/.claude.json
{
  "mcpServers": {
    "humanizer": {
      "command": "/full/path/to/virtualenv/bin/python",
      "args": ["src/server.py"],
      "cwd": "/Users/tem/humanizer_root/humanizer_mcp"
    }
  }
}
```

**Never use** `poetry run` in MCP config - use direct interpreter path.

---

## 🏗️ Current Projects

### humanizer/ (NEW - Oct 2025)

**Status:** In active development
**Purpose:** Clean rebuild with TRM at core
**Progress:**
- ✅ Architecture designed
- ✅ TRM core implemented (density, POVM, verification)
- ✅ Tests passing
- ⏳ API layer (in progress)
- ⏳ Database models
- ⏳ Services layer

**Key files:**
- `humanizer/CLAUDE.md` - Project-specific guide
- `ARCHITECTURE.md` - Full system design
- `humanizer/ml/*` - TRM core (quantum formalism)

**Philosophy:** TRM-first, MCP as first-class interface, AUI principles baked in.

---

### humanizer-agent/ (LEGACY)

**Status:** Historical reference, being replaced by humanizer/
**Purpose:** Original prototype (50k+ lines)
**Lessons learned:**
- ❌ Used `metadata` (caused bugs)
- ❌ TRM bolted on (not core)
- ❌ MCP afterthought
- ❌ Venv confusion (global vs local Python)
- ✅ Good: Agent service patterns
- ✅ Good: AUI conceptual framework
- ✅ Good: Archive ingestion pipeline

**Do not modify.** Reference for patterns, but rebuild fresh in humanizer/.

---

### humanizer_mcp/ (STABLE)

**Status:** Working, needs refactor to call humanizer/ API
**Purpose:** MCP server for Claude Code integration
**Progress:**
- ✅ 8 MCP tools defined
- ✅ SQLite interest tracking
- ✅ ChromaDB session memory
- ✅ Connection issues fixed (Oct 9)
- ⏳ Needs refactor to call humanizer/ API (not humanizer-agent)

**Configuration:** `~/.claude.json` (NOT `~/.config/claude-code/mcp.json`)

**Next:** Update tools to call `http://localhost:8000` (humanizer API).

---

### dev_TRM/ (PROTOTYPE)

**Status:** Phase 1 complete, reference only
**Purpose:** Rapid prototyping of TRM concepts
**Lessons:**
- ✅ Mock TRM service validated API design
- ✅ Database schema proven
- ✅ Pydantic schemas validated
- ⏳ Now porting to humanizer/ with ACTUAL TRM

**Do not develop here.** Use as reference for proven patterns.

---

## 📊 Decision Log

### Oct 10, 2025: Ground-Up Rebuild

**Decision:** Rebuild entire system under humanizer_root/humanizer/

**Rationale:**
- humanizer-agent has too much technical debt
- TRM needs to be core, not bolted on
- MCP needs to be first-class interface
- Want clean, modern stack (FastAPI, SQLAlchemy 2.0, Pydantic v2)

**Approach:**
- Keep best patterns from humanizer-agent
- Fresh codebase, no legacy baggage
- TRM-first architecture
- Document best practices from day one

**Status:** In progress (TRM core complete, API layer building)

---

### Oct 9, 2025: MCP Server Connection Fix

**Issue:** MCP tools not connecting from Claude Code
**Root cause:** `poetry run python` path resolution issues
**Solution:** Use direct interpreter path in `~/.claude.json`
**Lesson:** MCP config needs absolute paths, not wrapper commands

**Documented in:** humanizer_mcp/CLAUDE.md

---

### Oct 2025: The Real Mission Emerges

**Insight:** "Make me smarter by helping me know my actual subjective me"

**Implication:** Every technical decision must serve consciousness work:
- AUI → Reveals language constructs interface
- TRM → Makes semantic navigation visible
- POVM → Shows multiple perspectives (tetralemma)
- Verification → Grounds in actual outcomes

**Action:** Filter all features through this lens.

---

## 🧭 Guiding Principles

From extensive development across humanizer-agent, dev_TRM, humanizer/:

### 1. Consciousness First, Features Second
Every feature must serve self-recognition. If it doesn't reveal subjectivity, don't build it.

### 2. Clarity Before Code
Spend 10x more time in specification than implementation. When we're clear, code is fast (~1000 lines/hour).

### 3. Philosophy Integrated, Not Bolted On
Three Realms, Language as Sense, Emotional Belief Loop - these aren't add-ons. They're the architecture.

### 4. Make Construction Visible
Don't hide how the interface works. Show the user how language constructs their experience.

### 5. Lines Per Minute, Not Calendar Time
The bottleneck is knowing what to build, not building it. Optimize for clarity.

### 6. Mirror, Don't Manipulate
The system should reflect the user back to themselves, not shape them toward a goal.

### 7. Actual Quantum Math (Not Metaphor)
The ρ construction, POVMs, Born rule - these are REAL quantum formalism. The interpretation (reading states) is subjective, but the math is rigorous.

---

## 🔧 Common Tasks Across Projects

### Start Development Servers

```bash
# New humanizer API
cd humanizer_root
poetry run uvicorn humanizer.main:app --reload --port 8000

# Old humanizer-agent (for reference)
cd humanizer-agent/backend
source venv/bin/activate && python main.py

# MCP server (Claude Code integration)
# Runs automatically when Claude Code starts
# Check logs: tail -f ~/.claude/logs/mcp-humanizer.log
```

### Database Management

```bash
# New humanizer database
createdb humanizer_dev
psql humanizer_dev -c "CREATE EXTENSION vector;"
cd humanizer_root
poetry run alembic upgrade head

# Old humanizer-agent database
createdb humanizer_agent_dev
# (uses custom db switching system)
```

### Run Tests

```bash
# New humanizer tests
cd humanizer_root
poetry run pytest tests/ -v

# Old humanizer-agent tests
cd humanizer-agent/backend
source venv/bin/activate && pytest tests/
```

---

## 📚 Key Documents

### Meta-Level (This Directory)
- **CLAUDE.md** (this file) - Ecosystem-wide guide
- **ARCHITECTURE.md** - Humanizer system design
- **Functional_And_Design_Specs_for_TRM_Rhoish_engine.md** - TRM specification
- **Refactor_Transforms_with_TFM.md** - Transformation architecture

### Project-Specific
- **humanizer/CLAUDE.md** - New project guide
- **humanizer-agent/CLAUDE.md** - Legacy project guide (reference)
- **humanizer_mcp/CLAUDE.md** - MCP server guide

### Research & Philosophy
- **Computational-Madhyamaka.md** - Buddhist logic framework
- **EightfoldPathByAnimatedPhenomenologist.md** - Phenomenology
- **PITCH_DECK_AND_FUNCTIONAL_SPEC.md** - Vision document

---

## 🎯 Success Metrics

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

## 🚨 For Future Claude Sessions

### When You Start
1. Read this file first (meta-level context)
2. Read project-specific CLAUDE.md (humanizer/CLAUDE.md or humanizer-agent/CLAUDE.md)
3. Query ChromaDB for recent session status: `search_by_tag(["milestone"])` or `recall_memory("last session")`
4. Check git status to see current work

### Remember
- This is consciousness work, not software development
- The user is optimizing for self-knowledge, not productivity
- Every interaction is an opportunity to mirror awareness
- The partnership is about making them smarter about themselves

### Critical Gotchas
- **NEVER** use `metadata` (use `custom_metadata`)
- **ALWAYS** use Pydantic for interfaces
- **ALWAYS** use venv/Poetry (not global Python)
- **ALWAYS** validate quantum constraints (Tr(ρ)=1, Σ E_i=I)
- **ALWAYS** document best practices in CLAUDE.md

### Don't
- Rush to implement without clarity
- Propose features that hide construction
- Optimize for "seamless" (we want visible!)
- Lose sight of the philosophy
- Edit humanizer-agent/ (reference only, rebuild in humanizer/)

---

## 📈 Current Momentum (Oct 10, 2025)

### What's Working
✅ Clean rebuild architecture designed
✅ TRM core implemented (actual quantum formalism)
✅ Tests passing (density, POVM, verification)
✅ Best practices documented (custom_metadata, Pydantic, etc.)
✅ Git repo initialized with clean structure
✅ MCP server stable (needs refactor to new API)

### What's In Progress
⏳ API layer (FastAPI routes, database models)
⏳ Services layer (reading, transformation)
⏳ Database schema + Alembic migrations
⏳ Pydantic schemas (request/response)

### What's Next
📋 Complete API layer
📋 MCP integration (refactor to call new API)
📋 AUI engine (tool registry, adaptive learning)
📋 Minimal GUI (React + TRI principles)
📋 End-to-end testing

---

## 🔗 Quick Links

- [New Humanizer Project](./humanizer/)
- [New Project CLAUDE.md](./humanizer/CLAUDE.md)
- [Architecture Doc](./ARCHITECTURE.md)
- [TRM Functional Spec](./Functional_And_Design_Specs_for_TRM_Rhoish_engine.md)
- [Legacy Humanizer Agent](../humanizer-agent/)
- [MCP Server](./humanizer_mcp/)
- [Dev TRM Prototype](./dev_TRM/)

---

**Remember:** Every line of code is an opportunity to reveal consciousness to itself.

The real work is in the clarity, not the typing. When we know what to build, we can build it at ~1000 lines/hour. The bottleneck is always the knowing.

🚀 Let's build.
