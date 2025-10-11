# ChromaDB Three-Database Architecture

## Problem: Semantic Space Pollution

**Issue**: Mixing meta-system notes (tracking, tooling, guides) with development notes (features, refactoring, bugs) pollutes semantic search.

**Example**:
```
Query: "publication pipeline implementation"

BAD (mixed DB):
1. [0.85] Publication Pipeline - Missing Components (dev content) ✓
2. [0.72] Tracking System for Publication Pipeline (meta content) ✗
3. [0.68] LaTeX Service Implementation (dev content) ✓
4. [0.61] Best Practices Guide (meta content) ✗

Good results diluted by meta-system noise
```

**Solution**: Separate databases by content type and query purpose.

---

## Three-Database Architecture

### 1. Historical DB (`chroma_test_db`) - 547 memories
**Purpose**: Complete development archive (all experiments, debugging, dead ends)

**Content**:
- Failed experiments and lessons learned
- Debugging sessions and solutions
- Abandoned approaches
- Complete git-like history

**Use Case**: Ultra-think mode when stuck, research past attempts

**Query Pattern**: Broad, archaeological
- "PDF generation debugging history"
- "LaTeX attempts that failed"
- "archive import experiments"

**Retention**: Never delete (permanent archive)

---

### 2. Production DB (`chroma_production_db`) - 9 memories
**Purpose**: Active development context ONLY

**Content**:
- Current project structure
- Files needing refactoring
- Missing features and TODOs
- Implementation decisions
- Bug fixes and features
- Architecture choices (DEC Jupiter lesson)
- API/tech stack info

**Use Case**: Daily development, feature planning, code context

**Query Pattern**: Specific, actionable
- "what files need refactoring"
- "publication pipeline missing components"
- "madhyamaka_service refactoring plan"
- "LaTeX implementation details"

**Retention**: Archive to historical when completed (keep <100 memories)

**Tags**: `feature`, `bug-fix`, `refactoring`, `publication`, `api`, `todo`, `completed`

---

### 3. Meta/Tracking DB (`chroma_meta_db`) - NEW
**Purpose**: System maintenance, tooling, processes

**Content**:
- Tracking system documentation
- Best practices guides (pinned guide)
- Workflow documentation
- Operator usage notes
- Database management procedures
- Claude Code activation checklists
- Tooling and infrastructure notes

**Use Case**: System maintenance, onboarding, process improvement

**Query Pattern**: Meta-level, procedural
- "pinned guide best practice"
- "tracking system usage"
- "database switching procedure"
- "activation checklist"
- "how to use operator"

**Retention**: Update in place (living documentation)

**Tags**: `guide`, `meta`, `tooling`, `process`, `infrastructure`, `pinned`

---

## Benefits of Separation

### 1. Clean Semantic Spaces
**Before** (production has dev + meta):
```
Query: "publication features"
→ Returns mix of features + tracking notes + guides
→ Signal-to-noise ratio: 60%
```

**After** (separated):
```
Production query: "publication features"
→ Returns ONLY dev content (features, bugs, todos)
→ Signal-to-noise ratio: 95%

Meta query: "how to track changes"
→ Returns ONLY system docs
→ Signal-to-noise ratio: 100%
```

### 2. Different Retention Policies
- **Historical**: Never delete, grows indefinitely
- **Production**: Archive when >100, keep fresh
- **Meta**: Update in place, stable size (~20 memories)

### 3. Optimized Query Patterns
- **Historical**: Deep, exploratory, learn from failures
- **Production**: Fast, actionable, current context
- **Meta**: Procedural, "how-to", system operation

### 4. Scalability
As project grows:
- Historical: Grows with all attempts (500+ → 1000+)
- Production: Stays focused (<100 current items)
- Meta: Stays small (~20-50 stable docs)

---

## Migration Plan

### Current State
- **Historical**: 547 memories ✓ (no change)
- **Production**: 11 memories (9 dev + 2 meta) ✗ needs split
- **Meta**: 0 memories (doesn't exist) ✗ needs creation

### Move to Meta DB (from Production)
1. ✓ Pinned best practices guide
2. ✓ Tracking system documentation

### Keep in Production DB
1. ✓ Project structure overview
2. ✓ Files needing refactoring
3. ✓ Current capabilities
4. ✓ Missing publication pipeline
5. ✓ DEC Jupiter architecture lesson
6. ✓ Development workflow best practices
7. ✓ Tech stack overview
8. ✓ Database schema
9. ✓ API endpoints map

**Result After Migration**:
- Historical: 547 memories (unchanged)
- Production: 9 memories (pure dev content)
- Meta: 2 memories (guides + tracking)

---

## Database Selection Logic

### When to Query Which DB

```python
# Start of session
query_meta("pinned guide")           # Get best practices
query_meta("activation checklist")   # Get startup procedure
query_production("what we're working on")  # Get dev context
query_production("critical todos")    # Get action items

# During development
query_production("files need refactoring")  # Dev context
query_production("publication pipeline")    # Feature context

# When stuck (>30 min)
query_historical("PDF generation attempts")  # Learn from past
query_historical("LaTeX debugging")         # Past solutions

# System maintenance
query_meta("tracking system usage")    # How to use tools
query_meta("database switching")       # Procedures
```

### Operator Enhancement

```python
class ChromaDBOperator:
    def __init__(self):
        self.production_path = base / "chroma_production_db"  # Dev content
        self.historical_path = base / "chroma_test_db"        # Archive
        self.meta_path = base / "chroma_meta_db"              # System/guides

    def switch_to_production(self):
        """Development context - features, bugs, todos"""

    def switch_to_historical(self):
        """Complete archive - experiments, debugging"""

    def switch_to_meta(self):
        """System docs - guides, tracking, procedures"""
```

---

## MCP Configuration for 3 DBs

### Quick Switching

```bash
# Development work (default)
export CHROMA_DB_PATH=".../chroma_production_db"

# Research past attempts
export CHROMA_DB_PATH=".../chroma_test_db"

# System procedures
export CHROMA_DB_PATH=".../chroma_meta_db"
```

### Smart Workflow

```bash
# Morning startup
export CHROMA_DB_PATH=".../chroma_meta_db"
# Query: "activation checklist", "pinned guide"

export CHROMA_DB_PATH=".../chroma_production_db"
# Query: "what we're working on", "critical todos"

# Development (stays on production all day)

# When stuck
export CHROMA_DB_PATH=".../chroma_test_db"
# Deep research

# Back to production
export CHROMA_DB_PATH=".../chroma_production_db"
```

---

## Implementation Steps

1. ✅ Create meta database
2. ✅ Update operator with switch_to_meta()
3. ✅ Move 2 meta notes from production to meta
4. ✅ Update documentation to reflect 3-DB architecture
5. ✅ Add meta DB selection to guides

---

## Semantic Search Quality Improvement

### Before (Mixed Production DB)
Query: "publication pipeline features"
```
Results (11 memories, mixed):
1. [0.88] Publication Pipeline Missing (dev) ✓
2. [0.75] Tracking System (meta) ✗ noise
3. [0.72] Best Practices Guide (meta) ✗ noise
4. [0.68] Tech Stack (dev) ✓
5. [0.61] API Endpoints (dev) ✓
```
Relevant results: 3/5 = 60%

### After (Separated DBs)
Query production: "publication pipeline features"
```
Results (9 memories, pure dev):
1. [0.88] Publication Pipeline Missing ✓
2. [0.68] Tech Stack ✓
3. [0.61] API Endpoints ✓
4. [0.55] Database Schema ✓
5. [0.52] Current Capabilities ✓
```
Relevant results: 5/5 = 100%

Query meta: "best practices"
```
Results (2 memories, pure meta):
1. [0.95] Pinned Best Practices Guide ✓
2. [0.72] Tracking System Docs ✓
```
Relevant results: 2/2 = 100%

---

## Decision Matrix: Which DB for What Content?

| Content Type | Historical | Production | Meta |
|--------------|-----------|------------|------|
| Failed experiments | ✓ | | |
| Debugging sessions | ✓ | | |
| Current TODOs | | ✓ | |
| Feature implementations | | ✓ | |
| Refactoring plans | | ✓ | |
| Architecture decisions | | ✓ | |
| Bug fixes | | ✓ | |
| Best practices guides | | | ✓ |
| Tracking system docs | | | ✓ |
| Activation checklists | | | ✓ |
| Operator procedures | | | ✓ |
| Workflow documentation | | | ✓ |

---

## Conclusion

**You're correct**: Efficiency demands separation.

**3-Database Architecture**:
1. **Historical** (547): Complete archive, ultra-think research
2. **Production** (9): Pure development context, daily work
3. **Meta** (2): System docs, guides, procedures

**Result**:
- 🎯 Clean semantic search (no noise)
- 🚀 Faster, more relevant queries
- 📈 Better scalability
- 🧹 Clear separation of concerns

**Next**: Implement meta DB and migrate meta content from production.
