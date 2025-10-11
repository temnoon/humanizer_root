# Codebase Tracking & Change Documentation System

## Overview

Hash-based tracking system that monitors `/Users/tem/humanizer-agent/` and cross-references changes with ChromaDB production notes.

**Purpose**: Ensure all codebase changes are documented in ChromaDB for future context.

## How It Works

1. **Snapshot**: Hash all tracked files, create tree hash of entire codebase
2. **Check**: Compare current state with last snapshot
3. **Verify**: Query ChromaDB for notes about changed files
4. **Flag**: Mark undocumented changes for review
5. **Document**: Add notes to ChromaDB production DB
6. **Clear**: Remove flags once documented

## Quick Commands

```bash
cd /Users/tem/humanizer_root

# Take snapshot of current state
./track snapshot "optional note about this snapshot"

# Check for changes since last snapshot
./track check

# Verify changes are documented in ChromaDB
./track verify-notes

# Show detailed file-level diff
./track diff

# Show tracker status (snapshots, flags)
./track status

# Clear undocumented flags (after documenting)
./track clear-flags
```

## Tracked Files

**Includes:**
- `.py` - Python source
- `.js`, `.jsx` - JavaScript/React
- `.json` - Config files
- `.sh` - Shell scripts
- `.md`, `.txt` - Documentation

**Excludes:**
- `__pycache__`, `node_modules`, `.git`
- `venv`, virtual environments
- `.env`, secrets
- `.DS_Store`, OS files
- `*.pyc`, `*.swp`, `*.log`
- `chroma_*_db` - ChromaDB data

**Project**: `/Users/tem/humanizer-agent/`
**Current baseline**: 112 files tracked

## Workflow: Daily Development

### 1. Start of Session (Claude Code Activation)

```bash
cd /Users/tem/humanizer_root

# Check what changed since last session
./track check

# If changes detected, verify documentation
./track verify-notes
```

**Expected Output:**
- **No changes**: Continue with planned work
- **Changes detected**: Review diff, check if documented
- **Undocumented changes**: Create ChromaDB notes immediately

### 2. During Work

Code normally. The tracker runs passively - no action needed during development.

### 3. After Significant Work

```bash
# Take new snapshot
./track snapshot "Implemented LaTeX template service"
```

**Document in ChromaDB** (via Claude Code MCP):
```
store_memory:
  content: "Implemented LaTeX academic paper template service
           - Created backend/services/latex_service.py (245 lines)
           - Uses Jinja2 templates + XeLaTeX renderer
           - Supports academic, book, picture book formats
           Next: Add bibliography generation"
  tags: ["publication", "latex", "feature", "completed"]
  metadata: {"file": "backend/services/latex_service.py", "lines": "245"}
```

### 4. End of Session

```bash
# Final snapshot
./track snapshot "End of session - $(date +%Y-%m-%d)"

# Check status
./track status
```

## Workflow: Handling Undocumented Changes

### Scenario: Changes detected without ChromaDB notes

```bash
$ ./track verify-notes

🔍 Checking ChromaDB for change documentation...

📝 Documentation check:
  Documented: 2 files
  Undocumented: 5 files

⚠️  Undocumented changes:
    [modified] backend/api/routes.py
    [modified] backend/services/madhyamaka_service.py
    [added] backend/services/latex_service.py
    [added] backend/models/publication_models.py
    [modified] frontend/src/App.jsx

🚩 Undocumented changes flagged: /Users/tem/humanizer_root/.codebase_tracking/undocumented_flags.json
   Run 'clear-flags' after documenting changes in ChromaDB
```

### Action Required:

1. **Review the changes**:
   ```bash
   ./track diff
   ```

2. **Document each change in ChromaDB**:
   ```
   Claude, store a note about the LaTeX service implementation:
   - File: backend/services/latex_service.py
   - What: Created LaTeX template service
   - Why: Required for publication pipeline
   - How: Jinja2 + XeLaTeX
   - Next: Bibliography generation
   Tags: publication, latex, feature, completed
   ```

3. **Clear flags**:
   ```bash
   ./track clear-flags
   ```

4. **Verify clean state**:
   ```bash
   ./track status  # Should show no active flags
   ```

## Integration with ChromaDB

### Automatic Cross-Reference

The tracker queries ChromaDB production DB for each changed file:

1. **File modified**: `backend/services/latex_service.py`
2. **Query**: `"latex_service.py backend/services/latex_service.py"`
3. **Check**: Notes created after last snapshot timestamp
4. **Result**: Documented ✓ or Undocumented ⚠️

### Manual Documentation Template

When documenting changes in ChromaDB:

```python
# Via Python operator
from production_chromadb_operator import ChromaDBOperator

op = ChromaDBOperator()
op.switch_to_production()

op.store_memory(
    content="""
    [What]: Split madhyamaka_service.py into 3 focused modules
    [Why]: File exceeded 1003 lines, had >3 concerns
    [How]: Extracted to madhyamaka_core.py (285 lines),
           madhyamaka_transformations.py (412 lines),
           madhyamaka_contemplation.py (306 lines)
    [Next]: Update imports, test all endpoints, update docs

    Files:
    - backend/services/madhyamaka_service.py (deleted)
    - backend/services/madhyamaka_core.py (new, 285 lines)
    - backend/services/madhyamaka_transformations.py (new, 412 lines)
    - backend/services/madhyamaka_contemplation.py (new, 306 lines)
    """,
    tags=["refactoring", "madhyamaka", "completed", "architecture"],
    metadata={
        "files_affected": "4",
        "lines_before": "1003",
        "lines_after": "1003",
        "priority": "high"
    }
)
```

## Claude Code Activation Checklist

**Added to `/Users/tem/humanizer-agent/CLAUDE.md`**

Every new Claude Code session MUST:

1. ✓ Check codebase changes: `./track check`
2. ✓ Verify ChromaDB notes: `./track verify-notes`
3. ✓ Review pinned guide: Query `"pinned guide best practice"`
4. ✓ Check flags: `./track status`
5. ✓ Query context: `recall_memory "what we were working on"`
6. ✓ Take snapshot after work: `./track snapshot`

## Snapshot History

Snapshots stored in: `/Users/tem/humanizer_root/.codebase_tracking/snapshots.json`

**Structure:**
```json
{
  "timestamp": "2025-10-05T11:15:54.037330",
  "tree_hash": "79468d785bdbee7a...",
  "file_count": 112,
  "file_hashes": {
    "backend/main.py": "a1b2c3d4e5f6...",
    "backend/api/routes.py": "f6e5d4c3b2a1...",
    ...
  },
  "note": "Initial baseline before tracking system"
}
```

**Retention**: Last 50 snapshots kept automatically

## Flag Management

Flags stored in: `/Users/tem/humanizer_root/.codebase_tracking/undocumented_flags.json`

**Structure:**
```json
{
  "timestamp": "2025-10-05T12:00:00",
  "last_snapshot": "2025-10-05T11:15:54.037330",
  "undocumented_files": [
    "backend/services/latex_service.py",
    "backend/models/publication_models.py"
  ],
  "change_summary": {
    "added": 2,
    "modified": 3,
    "removed": 0
  },
  "status": "needs_documentation"
}
```

**Actions:**
- **Active flags**: Undocumented changes need ChromaDB notes
- **Clear flags**: Run `./track clear-flags` after documenting

## Troubleshooting

### No previous snapshot
```
⚠️  No previous snapshot found. Run 'snapshot' first.
```
**Fix**: `./track snapshot "Initial baseline"`

### ChromaDB query fails
```
❌ Error checking ChromaDB: ...
```
**Fix**: Ensure MCP memory service venv is accessible:
```bash
source /Users/tem/archive/mcp-memory/mcp-memory-service/venv/bin/activate
python -c "from production_chromadb_operator import ChromaDBOperator; print('OK')"
```

### Too many undocumented changes
```
⚠️  Undocumented changes: 47 files
```
**Fix**: Document in batches, using broader notes:
```
store_memory:
  content: "Refactored publication module - split 5 large files
           into focused modules averaging 250 lines each"
  tags: ["refactoring", "publication", "batch-update"]
```

## Advanced Usage

### Custom snapshot frequency

**Conservative** (snapshot after every feature):
```bash
# After each completed feature
./track snapshot "Completed feature X"
```

**Balanced** (snapshot daily):
```bash
# End of each coding session
./track snapshot "EOD $(date +%Y-%m-%d)"
```

**Minimal** (snapshot before major changes):
```bash
# Before refactoring
./track snapshot "Before madhyamaka_service refactor"
```

### Batch documentation

For multiple related changes:
```python
op.store_memory(
    content="Publication pipeline sprint - Oct 5:
    - Created latex_service.py (245 lines)
    - Created cover_generator.py (189 lines)
    - Created pdf_compositor.py (212 lines)
    - Added publication_routes.py (156 lines)
    - Updated main.py to include publication routes

    All files follow 200-300 line target, well-documented.
    Next: Integration testing, UI for publication options",

    tags=["publication", "sprint", "batch-feature", "completed"],
    metadata={"files_added": "4", "files_modified": "1", "sprint": "oct-5"}
)
```

### Git integration

Track aligns with git workflow:
```bash
# Before committing
./track snapshot "Pre-commit: feature X"

git add .
git commit -m "Add feature X"

# After committing
./track check  # Should show no changes if all committed
```

## Best Practices

1. **Snapshot frequency**: Daily minimum, after each feature ideally
2. **Documentation timing**: Immediately after `verify-notes` flags changes
3. **Note quality**: Follow [What/Why/How/Next] template from pinned guide
4. **Tag consistency**: Use standard tags (publication, refactoring, feature, etc.)
5. **Flag discipline**: Never ignore flags - document or investigate
6. **Activation discipline**: ALWAYS run checklist at session start

## File Locations

```
/Users/tem/humanizer_root/
├── codebase_tracker.py         ← Main tracker script
├── track                        ← Convenient wrapper
├── .codebase_tracking/          ← Tracking data
│   ├── snapshots.json           ← Snapshot history
│   └── undocumented_flags.json  ← Active flags
└── TRACKING_GUIDE.md            ← This file

/Users/tem/humanizer-agent/
└── CLAUDE.md                    ← Updated with activation checklist
```

## Philosophy

This system embodies:
- **Accountability**: All changes tracked, none forgotten
- **Context preservation**: Future Claude Code instances understand what changed
- **Discipline**: Mandatory documentation prevents knowledge loss
- **Velocity**: Quick checks prevent "what was I doing?" delays
- **Integration**: Tracking + ChromaDB = complete project memory

---

**The tracker watches. ChromaDB remembers. You build confidently.**
