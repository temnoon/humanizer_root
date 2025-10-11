# 3-Database Architecture - Quick Reference

## ✅ Migration Complete

**Production DB**: 9 memories (pure dev content)
**Meta DB**: 2 memories (guides + tooling)
**Historical DB**: 547 memories (complete archive)

---

## When to Query Which Database

### 🔧 META DB - System & Guides
**Query**: `./run_operator.sh query meta "<search>"`

**Contains**:
- ✓ Pinned best practices guide
- ✓ Tracking system documentation
- ✓ Workflow procedures
- ✓ Operator usage guides

**Use When**:
- Starting new session (activation checklist)
- Learning system procedures
- Understanding tooling
- Checking best practices

**Example Queries**:
```bash
./run_operator.sh query meta "best practices"
./run_operator.sh query meta "tracking system"
./run_operator.sh query meta "activation checklist"
```

---

### 📊 PRODUCTION DB - Development
**Query**: `./run_operator.sh query prod "<search>"`

**Contains**:
- ✓ Project structure
- ✓ Files needing refactoring
- ✓ Missing features & TODOs
- ✓ Architecture decisions
- ✓ Tech stack info
- ✓ API endpoints
- ✓ Database schema

**Use When**:
- Daily development work
- Planning features
- Checking refactoring targets
- Understanding codebase

**Example Queries**:
```bash
./run_operator.sh query prod "publication pipeline"
./run_operator.sh query prod "files need refactoring"
./run_operator.sh query prod "madhyamaka service"
```

---

### 📚 HISTORICAL DB - Archive
**Query**: `./run_operator.sh query hist "<search>"`

**Contains**:
- All 547 development memories
- Failed experiments
- Debugging sessions
- Abandoned approaches

**Use When**:
- Stuck on problem >30 min
- Researching past attempts
- Learning from failures
- Ultra-think deep dive

**Example Queries**:
```bash
./run_operator.sh query hist "PDF generation debugging"
./run_operator.sh query hist "LaTeX experiments"
```

---

## Typical Session Workflow

### Morning (Activation)

```bash
cd /Users/tem/humanizer_root

# 1. Check changes
./track check

# 2. Get meta guidance
./run_operator.sh query meta "best practices"
./run_operator.sh query meta "activation checklist"

# 3. Get dev context
./run_operator.sh query prod "what we're working on"
./run_operator.sh query prod "critical todos"
```

### During Development (Stay on Production)

```bash
# Query for dev context
./run_operator.sh query prod "publication pipeline"
./run_operator.sh query prod "LaTeX implementation"
```

### When Stuck (Switch to Historical)

```bash
# Research past attempts
./run_operator.sh query hist "PDF generation"
./run_operator.sh query hist "cover image creation"
```

### System Maintenance (Use Meta)

```bash
# Check procedures
./run_operator.sh query meta "tracking usage"
./run_operator.sh query meta "database switching"
```

---

## MCP Database Selection

### For Claude Code Sessions

**Set environment variable before launching:**

```bash
# Normal development (default)
export CHROMA_DB_PATH="/Users/tem/archive/mcp-memory/mcp-memory-service/chroma_production_db"

# System/guides lookup
export CHROMA_DB_PATH="/Users/tem/archive/mcp-memory/mcp-memory-service/chroma_meta_db"

# Deep research
export CHROMA_DB_PATH="/Users/tem/archive/mcp-memory/mcp-memory-service/chroma_test_db"
```

**Restart Claude Code after changing.**

---

## Database Contents Summary

| Database | Memories | Purpose | Query Pattern |
|----------|----------|---------|---------------|
| **Meta** | 2 | Guides, tooling, procedures | How-to, procedural |
| **Production** | 9 | Active dev context | What to build, refactor |
| **Historical** | 547 | Complete archive | Learning, research |

---

## Benefits Achieved

### ✅ Clean Semantic Search
- **Before**: Mixed results (dev + meta noise)
- **After**: Pure, relevant results

### ✅ Faster Queries
- Production: 9 memories (fast)
- Meta: 2 memories (instant)
- Historical: 547 (comprehensive when needed)

### ✅ Better Organization
- Each DB has single purpose
- No pollution across spaces
- Easy to maintain

---

## Operator Commands (3-DB Support)

```bash
# Create databases
./run_operator.sh create         # Production
./run_operator.sh create-meta    # Meta

# Query
./run_operator.sh query prod <text>   # Production
./run_operator.sh query meta <text>   # Meta
./run_operator.sh query hist <text>   # Historical

# Status (all DBs)
./run_operator.sh status
```

---

## Quick Decision Tree

```
Need to...

├─ Understand HOW to use systems?
│  └─ Query META DB
│
├─ Know WHAT to build/fix/refactor?
│  └─ Query PRODUCTION DB
│
└─ Learn from PAST attempts/failures?
   └─ Query HISTORICAL DB
```

---

**Remember**: Meta = How, Production = What, Historical = Why it failed before
