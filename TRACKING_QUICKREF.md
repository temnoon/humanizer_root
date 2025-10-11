# Codebase Tracking - Quick Reference Card

## Essential Commands

```bash
cd /Users/tem/humanizer_root

./track snapshot [note]      # Take snapshot of current state
./track check                # Check for changes
./track verify-notes         # Cross-reference with ChromaDB
./track diff                 # Show detailed changes
./track status               # Show tracker status + flags
./track clear-flags          # Clear undocumented flags
```

## Claude Code Activation (MANDATORY)

```bash
# 1. Check changes
./track check

# 2. Verify documentation
./track verify-notes

# 3. Check flags
./track status
```

Then in Claude Code:
```
recall_memory "pinned guide best practice"
recall_memory "what we were working on"
recall_memory "critical priority todos"
```

## Typical Workflow

### Morning (Start Session)
```bash
./track check               # Any changes overnight?
./track verify-notes        # All documented?
./track status              # Any flags?
```

### During Work
*Code normally - no action needed*

### After Feature Completion
```bash
./track snapshot "Completed feature X"
```

Then document in ChromaDB:
```
Claude, store note:
- Implemented feature X
- File: backend/services/X.py (245 lines)
- Tags: feature, completed, [module]
```

### Evening (End Session)
```bash
./track snapshot "EOD $(date +%Y-%m-%d)"
./track status              # Clean state for tomorrow
```

## Undocumented Changes Workflow

```bash
$ ./track verify-notes
⚠️  Undocumented changes:
    [modified] backend/api/routes.py
    [added] backend/services/latex_service.py
🚩 Undocumented changes flagged
```

**Fix:**
1. Review: `./track diff`
2. Document each file in ChromaDB (via Claude Code)
3. Clear flags: `./track clear-flags`
4. Verify: `./track status` (should show no flags)

## ChromaDB Documentation Template

```
store_memory:
  content: "[What] + [Why] + [How] + [Next]
           File: path/to/file.py (245 lines)"
  tags: ["module", "type", "status", "priority"]
  metadata: {"file": "path", "lines": "245", "priority": "high"}
```

**Required Tags:**
- **Status**: todo, in-progress, completed, blocked
- **Type**: feature, bug-fix, refactoring, research
- **Module**: api, webgui, publication, latex, pdf, covers

## Files Tracked

✓ `.py`, `.js`, `.jsx` - Source code
✓ `.json`, `.sh` - Config and scripts
✓ `.md`, `.txt` - Documentation
✗ `node_modules`, `venv`, `.git` - Ignored
✗ `__pycache__`, `*.pyc`, `.DS_Store` - Ignored

**Project**: `/Users/tem/humanizer-agent/` (112 files)

## Snapshot Info

**Location**: `/Users/tem/humanizer_root/.codebase_tracking/snapshots.json`
**Retention**: Last 50 snapshots
**Contains**: Tree hash + individual file hashes + timestamp

## Flags Info

**Location**: `/Users/tem/humanizer_root/.codebase_tracking/undocumented_flags.json`
**Meaning**: Changes detected but no ChromaDB note found
**Action**: Document in ChromaDB, then `./track clear-flags`

## Common Scenarios

### First Time Setup
```bash
./track snapshot "Initial baseline"
```

### After Git Pull
```bash
./track check               # See what changed
./track verify-notes        # Check teammate's changes documented
```

### Before Major Refactor
```bash
./track snapshot "Pre-refactor: madhyamaka_service"
# Do refactoring
./track snapshot "Post-refactor: madhyamaka split into 3 modules"
```

### Batch Changes (Multiple Files)
Document as single note with all files listed:
```
store_memory:
  content: "Publication sprint: Created 4 new services
           - latex_service.py (245 lines)
           - cover_generator.py (189 lines)
           - pdf_compositor.py (212 lines)
           - publication_routes.py (156 lines)"
  tags: ["publication", "batch-feature", "completed"]
```

## Troubleshooting

**No snapshot**: `./track snapshot "Initial"`
**ChromaDB error**: Check venv at `/Users/tem/archive/mcp-memory/mcp-memory-service/venv`
**Too many flags**: Document in batches with broader notes

## Philosophy

- **Every change matters** - Track everything
- **Future self needs context** - Document thoroughly
- **Discipline = velocity** - Checklist prevents delays
- **Tracking + ChromaDB** = Complete project memory

---

📋 **Keep this card handy** - Reference during every session
