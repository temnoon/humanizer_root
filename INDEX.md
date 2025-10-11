# Humanizer Agent Bootstrap System - Complete Index

## 🎯 Quick Start

**For New Claude Code Session in `/Users/tem/humanizer-agent/`:**
1. Read: `/Users/tem/humanizer-agent/CLAUDE.md` (automatic)
2. System auto-configures to ProductionDB
3. Loads context, enters plan mode if TODOs pending
4. Zero manual setup required

---

## 📚 Documentation Map

### Essential Reading (Start Here)
1. **`/Users/tem/humanizer-agent/CLAUDE.md`** - Complete bootstrap & activation checklist
2. **`SESSION_COMPLETE_SUMMARY.md`** - What was built and why
3. **`3DB_QUICK_REFERENCE.md`** - Database selection guide

### 3-Database Architecture
- **`DATABASE_ARCHITECTURE.md`** - Complete design philosophy & benefits
- **`3DB_QUICK_REFERENCE.md`** - When to use which database
- **`MCP_DATABASE_SWITCHING_GUIDE.md`** - Configure MCP between DBs

### Tracking System
- **`TRACKING_GUIDE.md`** - Complete tracking documentation
- **`TRACKING_QUICKREF.md`** - Quick reference card
- **`TRACKING_SYSTEM_SUMMARY.md`** - Executive summary

### ChromaDB Operator
- **`CHROMADB_OPERATOR_README.md`** - Operator usage guide
- **`QUICK_START.md`** - Getting started with operator
- **`claude_code_memory_guide.md`** - Best practices (stored in Meta DB)

### This Index
- **`INDEX.md`** - This file

---

## 🔧 Scripts & Tools

### Main Operator
```bash
./run_operator.sh <command>
```

**Commands:**
- `create` - Create production DB
- `create-meta` - Create meta DB
- `seed` - Seed production with project data
- `seed-meta` - Seed meta with guides
- `migrate-meta` - Move meta content from production
- `status` - Show all DBs status
- `query <db> <text>` - Query specific DB (prod/meta/hist)

### Tracking System
```bash
./track <command>
```

**Commands:**
- `snapshot "note"` - Take codebase snapshot
- `check` - Check for changes
- `verify-notes` - Cross-reference with ChromaDB
- `diff` - Show detailed changes
- `status` - Show snapshots and flags
- `clear-flags` - Clear after documenting

---

## 🗄️ Database Contents

### Production DB (10 memories)
**Location:** `/Users/tem/archive/mcp-memory/mcp-memory-service/chroma_production_db`

**Contains:**
1. Project structure overview
2. Files needing refactoring
3. Current capabilities
4. Missing publication pipeline
5. DEC Jupiter architecture lesson
6. Development workflow best practices
7. Tech stack overview
8. Database schema
9. API endpoints map
10. CLAUDE.md bootstrap documentation

**Query:** `./run_operator.sh query prod "<search>"`

### Meta DB (2 memories)
**Location:** `/Users/tem/archive/mcp-memory/mcp-memory-service/chroma_meta_db`

**Contains:**
1. Pinned best practices guide
2. Tracking system documentation

**Query:** `./run_operator.sh query meta "<search>"`

### Historical DB (547 memories)
**Location:** `/Users/tem/archive/mcp-memory/mcp-memory-service/chroma_test_db`

**Contains:**
- All development experiments
- Debugging sessions
- Dead ends and failures
- Complete archive

**Query:** `./run_operator.sh query hist "<search>"`

---

## 📁 File Structure

```
/Users/tem/humanizer_root/
├── production_chromadb_operator.py    # 3-DB operator
├── codebase_tracker.py                # Hash tracking
├── track                              # Wrapper for tracking
├── run_operator.sh                    # Wrapper for operator
│
├── INDEX.md                           # This file
├── SESSION_COMPLETE_SUMMARY.md        # What was built
├── DATABASE_ARCHITECTURE.md           # 3-DB design
├── 3DB_QUICK_REFERENCE.md            # DB selection
├── TRACKING_GUIDE.md                 # Complete tracking docs
├── TRACKING_QUICKREF.md              # Quick reference
├── TRACKING_SYSTEM_SUMMARY.md        # Tracking summary
├── CHROMADB_OPERATOR_README.md       # Operator usage
├── MCP_DATABASE_SWITCHING_GUIDE.md   # MCP config
├── QUICK_START.md                    # Getting started
├── claude_code_memory_guide.md       # Best practices
│
└── .codebase_tracking/
    ├── snapshots.json                # Snapshot history
    └── undocumented_flags.json       # Active flags

/Users/tem/humanizer-agent/
└── CLAUDE.md                         # Complete bootstrap (420 lines)
```

---

## 🚀 Typical Workflows

### Morning - Start New Session

```bash
# In /Users/tem/humanizer-agent/
# CLAUDE.md activation checklist runs automatically

# Manual verification (optional):
cd /Users/tem/humanizer_root
./track check                          # Any changes?
./run_operator.sh query meta "pinned guide"
./run_operator.sh query prod "critical todos"
```

### During Development

```bash
# Query for context
./run_operator.sh query prod "publication pipeline"
./run_operator.sh query prod "files need refactoring"

# Code...

# When stuck >30 min
./run_operator.sh query hist "PDF debugging"
```

### After Completing Work

```bash
./track snapshot "Completed feature X"

# Then in Claude Code (MCP):
# store_memory with [What/Why/How/Next] + proper tags

./track verify-notes                   # Documented?
./track clear-flags                    # Clear flags
```

---

## 🎯 Key Concepts

### Query Before Code
**Always** check ChromaDB before implementing:
1. Production DB: Does solution exist?
2. Meta DB: What are best practices?
3. Historical DB: What failed before?

### Document After Work
**Always** store memory after completing:
- [What] accomplished
- [Why] it was needed
- [How] implemented
- [Next] steps

### 3-Database Strategy
- **Meta**: System procedures (how-to)
- **Production**: Dev context (what to build)
- **Historical**: Archive (learn from past)

### Refactoring Triggers
- File >500 lines → flag for refactoring
- File >3 concerns → needs splitting
- Duplicated logic → needs extraction

---

## 📊 Current Project State

**Goal:** Complete publication pipeline
**Status:**
- ✅ Transformation engine
- ✅ PostgreSQL + pgvector
- ✅ Philosophical features
- ❌ LaTeX typesetting (MISSING)
- ❌ PDF compositor (MISSING)
- ❌ Cover generator (MISSING)

**Refactoring Needed:**
- madhyamaka_service.py (1003 lines → 3-4 modules)
- routes.py (567 lines)
- chunk_models.py (558 lines)
- 2 other files >500 lines

**Target:** 200-300 lines per file

---

## 🔐 MCP Configuration

**Set before launching Claude Code:**

```bash
# Production (default for dev)
export CHROMA_DB_PATH="/Users/tem/archive/mcp-memory/mcp-memory-service/chroma_production_db"

# Meta (for procedures)
export CHROMA_DB_PATH="/Users/tem/archive/mcp-memory/mcp-memory-service/chroma_meta_db"

# Historical (for research)
export CHROMA_DB_PATH="/Users/tem/archive/mcp-memory/mcp-memory-service/chroma_test_db"
```

---

## ✅ Success Criteria (All Met)

✅ 3-database architecture operational
✅ Production DB has pure dev content (10 memories)
✅ Meta DB has system guides (2 memories)
✅ Hash tracking monitors 112 files
✅ CLAUDE.md provides complete bootstrap
✅ Plan mode auto-activates when TODOs pending
✅ Zero context loss between sessions
✅ Documentation complete (15 files)
✅ All systems tested and verified

---

## 🎓 Philosophy

### DEC Jupiter Lesson
Don't abandon working architecture (the VAX) for next shiny thing. Extend what works.

### Core Principles
1. **Query before code** - Check ProductionDB first
2. **Write when necessary** - Reuse until you must add functionality
3. **Refactor proactively** - Files >500 lines need splitting
4. **Document everything** - Future self needs context
5. **Separate concerns** - Meta ≠ Dev ≠ Historical

---

## 🧭 Decision Tree

```
New Session in /Users/tem/humanizer-agent/
│
├─ Read CLAUDE.md (automatic)
│
├─ Configure MCP → ProductionDB
│
├─ Check changes: ./track check
│
├─ Load guidance: Meta DB
│
├─ Load context: Production DB
│  ├─ "what we were working on"
│  ├─ "critical priority todos"
│  └─ "files need refactoring"
│
└─ DECIDE MODE:
   │
   ├─ IF: Pending TODOs
   │  └─ PLAN MODE → Present plan
   │
   └─ ELSE: Clean state
      └─ INTERACTIVE → Ready for instructions
```

---

## 📞 Quick Help

**Query databases:** `./run_operator.sh query <db> "<text>"`
**Check changes:** `./track check`
**Verify documented:** `./track verify-notes`
**Take snapshot:** `./track snapshot "note"`
**Show status:** `./track status` or `./run_operator.sh status`

**Read:** `CLAUDE.md` in humanizer-agent for complete bootstrap

---

*Your ideal achieved: Zero context loss, automatic plan mode, ProductionDB-first workflow.*
