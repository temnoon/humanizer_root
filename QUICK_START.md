# ChromaDB Production Operator - Quick Start

## What You Now Have

✅ **Production ChromaDB** - Clean database for completing publication pipeline
✅ **9 Seeded Memories** - Project structure, refactoring targets, missing features
✅ **Operator Script** - Manage, query, and update production database
✅ **Documentation** - Complete guides for usage and MCP switching

## File Structure

```
/Users/tem/humanizer_root/
├── production_chromadb_operator.py    ← Main operator (Python class)
├── run_operator.sh                    ← Convenient wrapper script
├── CHROMADB_OPERATOR_README.md        ← Full documentation
├── MCP_DATABASE_SWITCHING_GUIDE.md    ← Switch Claude Code between DBs
└── QUICK_START.md                     ← This file

/Users/tem/archive/mcp-memory/mcp-memory-service/
├── chroma_production_db/              ← NEW: Production database (9 memories)
└── chroma_test_db/                    ← EXISTING: Historical (547 memories)

/Users/tem/humanizer-agent/            ← Target application
├── backend/                           ← FastAPI + PostgreSQL
└── frontend/                          ← React + Vite
```

## Immediate Next Steps

### 1. Query Production Database

```bash
cd /Users/tem/humanizer_root

# What's missing from publication pipeline?
./run_operator.sh query "publication pipeline"

# What files need refactoring?
./run_operator.sh query "files refactoring"

# What's the tech stack?
./run_operator.sh query "technology stack"
```

### 2. Configure Claude Code to Use Production DB

**Option A: Environment Variable (Quick)**

```bash
export CHROMA_DB_PATH="/Users/tem/archive/mcp-memory/mcp-memory-service/chroma_production_db"
# Restart Claude Code
```

**Option B: Verify Current Database**

In Claude Code session:
```
Check ChromaDB health and tell me how many memories are stored
```

- **9 memories** = Production DB ✓
- **547 memories** = Historical DB (switch to production)

### 3. Start Building Publication Features

The production DB tells you what's missing:

**Required Components** (from memory query):
1. Archive-to-structure converter
2. LaTeX template engine
3. Cover image generator (5-part: front outside/inside, spine, back inside/outside)
4. PDF compositor
5. Image processor (for picture books)
6. Bibliography generator
7. Format detector

**Large Files to Refactor** (from memory query):
- `madhyamaka_service.py` - 1003 lines → split into 3-4 modules
- `routes.py` - 567 lines → consider extraction
- `chunk_models.py` - 558 lines → split by concern

## Common Workflows

### Daily Development Session

```bash
# 1. Check what's next
./run_operator.sh query "todo next steps"

# 2. Work in humanizer-agent
cd /Users/tem/humanizer-agent
./start.sh  # Starts backend + frontend

# 3. At end of day, store progress (using Python API or via Claude Code)
# Claude will use mcp__chromadb-memory__store_memory
```

### When Stuck (Ultra-Think Mode)

```bash
# Switch Claude Code to historical DB
export CHROMA_DB_PATH="/Users/tem/archive/mcp-memory/mcp-memory-service/chroma_test_db"
# Restart Claude Code

# Query all 547 memories for insights
# "Search historical memories for PDF generation attempts"

# Switch back to production
export CHROMA_DB_PATH="/Users/tem/archive/mcp-memory/mcp-memory-service/chroma_production_db"
```

### Add New Production Memory

```python
from production_chromadb_operator import ChromaDBOperator

op = ChromaDBOperator()
op.switch_to_production()

op.store_memory(
    content="Implemented LaTeX academic paper template using Jinja2...",
    tags=["publication", "latex", "feature", "completed"],
    metadata={"file": "services/latex_service.py", "pr": "123"}
)
```

## Key Memories Already Stored

Run `./run_operator.sh query "<topic>"` to find:

| Topic | Tags | Content |
|-------|------|---------|
| Project structure | `architecture,structure` | File layout, key components |
| Refactoring targets | `refactoring,tech-debt` | Files >500 lines to split |
| Current features | `features,capabilities` | What's working now |
| Missing pipeline | `publication,todo,priority` | What needs building |
| Architecture lesson | `architecture,philosophy,dec` | DEC Jupiter story |
| Workflow | `workflow,best-practice` | Development process |
| Tech stack | `tech-stack,dependencies` | Python 3.11, FastAPI, etc. |
| Database schema | `database,schema` | PostgreSQL tables |
| API endpoints | `api,endpoints` | All routes |

## Understanding the Philosophy

### The DEC Jupiter Lesson

> "The beginning of the end was the cancellation of Jupiter, the follow-on to the 36-bit architecture."

**Translation**: Don't abandon `/Users/tem/humanizer-agent/` for Cloudflare Workers or the next shiny framework. Extend what works.

### One Basket, One Egg

- **Basket**: `/Users/tem/humanizer-agent/` (current FastAPI/PostgreSQL stack)
- **Egg**: Working transformation engine with philosophy integration
- **Strategy**: Nurture and extend, don't rewrite

### Write When Necessary, Reuse Until You Must

- Check production DB memories BEFORE coding
- Reuse existing services, models, routes
- Only create new files when truly needed
- Refactor large files (>500 lines) into focused modules

## Production Database Schema

Each memory has:
```python
{
    "content": "Detailed note content...",
    "metadata": {
        "tags": "comma,separated,tags",
        "timestamp": "2025-10-05T...",
        "db_type": "production",
        # ... custom fields
    }
}
```

**Good Tags**: `publication`, `refactoring`, `api`, `webgui`, `latex`, `pdf`, `todo`, `completed`, `bug-fix`, `feature`

## Verification Commands

```bash
# Database exists?
ls -la /Users/tem/archive/mcp-memory/mcp-memory-service/chroma_production_db/

# Query works?
./run_operator.sh query test

# How many memories?
./run_operator.sh status  # Shows both DBs

# Which DB is Claude Code using?
echo $CHROMA_DB_PATH
```

## Next Development Goals (from Production DB)

Based on seeded memories, prioritize:

1. **LaTeX Template Engine** - Academic paper, book, picture book templates
2. **Cover Generator** - 5-part cover images (Pillow/ImageMagick)
3. **PDF Compositor** - Combine typeset content + covers
4. **Archive Converter** - Extract structure from ChatGPT/Claude archives
5. **Format Detector** - Auto-map archive type → best output format

**Files to Create** (examples):
- `backend/services/latex_service.py` - Template rendering
- `backend/services/cover_generator.py` - Image composition
- `backend/services/pdf_compositor.py` - Final PDF assembly
- `backend/api/publication_routes.py` - New endpoints
- `backend/models/publication_models.py` - Schemas

## Getting Help

**Full Documentation**:
- `CHROMADB_OPERATOR_README.md` - Complete operator guide
- `MCP_DATABASE_SWITCHING_GUIDE.md` - Switch between production/historical

**Query the Database**:
```bash
./run_operator.sh query "your question"
```

**Ask Claude Code** (if MCP configured):
```
Recall memories about publication pipeline
Store a note about today's work on LaTeX templates
```

## Philosophy Reminder

This operator embodies:
- **Phenomenology**: Document what IS, not what should be
- **Pragmatism**: Extend proven architecture, don't rewrite
- **Memory**: Future self needs context to maintain velocity
- **Separation**: Clean production notes vs complete historical archive

---

**You're ready.** The production DB knows what needs building. The historical DB has 547 lessons. The humanizer-agent is your proven VAX. Time to complete the publication pipeline.

*"Don't be Jupiter. Be the VAX that ships."*
