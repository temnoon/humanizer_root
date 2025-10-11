# Claude Code Memory Best Practices - Production DB

## ALWAYS START: Check Memory First
Before coding ANY feature, query production DB:
- `recall_memory "what we're working on"`
- `recall_memory "publication pipeline status"`
- `recall_memory "files need refactoring"`

## Core Principles

### 1. Write When Necessary, Reuse Until You Must
- Check memories for existing solutions
- Reuse code from `/Users/tem/humanizer-agent/backend/`
- Only create new files when truly needed
- Target: 200-300 lines per file

### 2. Query Before, Store After
**Before Work:**
```
Query: "LaTeX template implementation"
Query: "PDF generation past attempts"
```

**After Work:**
```
Store: What was accomplished, decisions made, next steps
Tags: publication, feature, completed, [module-name]
```

### 3. Refactoring Triggers
Mark files for refactoring when:
- File exceeds 500 lines
- File has >3 distinct concerns
- Logic is duplicated across modules

Store note: `"File X needs refactoring: 789 lines, handles Y and Z"`

### 4. Tag Consistently
**Required tags per memory:**
- **Status**: `todo`, `in-progress`, `completed`, `blocked`
- **Type**: `feature`, `bug-fix`, `refactoring`, `research`, `decision`
- **Module**: `api`, `webgui`, `publication`, `latex`, `pdf`, `covers`
- **Priority**: `critical`, `high`, `medium`, `low`

**Examples:**
- `["publication", "latex", "feature", "completed"]`
- `["refactoring", "madhyamaka_service", "todo", "high"]`
- `["publication", "covers", "research", "in-progress"]`

### 5. Memory Structure Template
```
Content: [What] + [Why] + [How] + [Next]

What: Implemented LaTeX academic paper template
Why: Required for publication pipeline MVP
How: Used Jinja2 templates + XeLaTeX renderer
Next: Add bibliography generation, test with real archive

File: backend/services/latex_service.py (245 lines)
```

### 6. Metadata Best Practices
Always include:
- `file`: Path to code (`backend/services/latex_service.py`)
- `lines`: File size (`245`)
- `priority`: `critical|high|medium|low`
- `pr`: Pull request number if applicable

### 7. When to Store Memories

**ALWAYS Store:**
- New feature completed
- Architecture decision made
- File refactored (split, renamed, reorganized)
- Blockers encountered
- Critical bugs fixed
- Research findings (especially from historical DB)

**NEVER Store:**
- Trivial changes (typo fixes, formatting)
- Standard dependency updates
- Daily status updates without progress
- Duplicate information already in DB

### 8. Ultra-Think Mode (Historical DB)

When stuck for >30 minutes:
1. Switch to historical DB (547 memories)
2. Query broadly: `"PDF generation attempts"`, `"LaTeX debugging"`
3. Extract lessons from past failures
4. Return to production DB
5. **Store what you learned** with tag `learned-from-history`

### 9. Production DB Health

Keep production DB focused:
- Target: <100 memories for velocity
- When >100: Archive completed items to historical
- When >150: Major cleanup/reorganization
- Monthly: Review and consolidate similar memories

### 10. Query Strategies

**Broad Discovery:**
- `"what files need refactoring"`
- `"what's missing from publication pipeline"`
- `"critical priority todos"`

**Specific Lookup:**
- `"LaTeX template implementation details"`
- `"madhyamaka_service refactoring plan"`
- `"cover generator image dimensions"`

**Progress Tracking:**
- `"completed features this week"`
- `"blocked items"`
- `"next steps publication pipeline"`

## Quick Reference: Memory Lifecycle

```
1. QUERY: Check for existing knowledge
2. CODE: Implement/refactor based on context
3. TEST: Verify changes work
4. STORE: Document what/why/how/next with proper tags
5. QUERY: Verify memory stored correctly
```

## Project-Specific Context

**Target Application:** `/Users/tem/humanizer-agent/`
**Goal:** Complete publication pipeline for Academic Papers, Books, Picture Books
**Output:** Publication-ready PDFs + 5-part covers (front outside/inside, spine, back inside/outside)

**Current State (Oct 2025):**
- ✅ Transformation engine (PERSONA/NAMESPACE/STYLE)
- ✅ PostgreSQL + pgvector
- ✅ Philosophical features
- ❌ LaTeX typesetting
- ❌ PDF generation
- ❌ Cover creation
- ❌ Publication pipeline

**Large Files to Refactor:**
- `madhyamaka_service.py` (1003 lines) → 3-4 modules
- `routes.py` (567 lines) → extract chunking logic
- `chunk_models.py` (558 lines) → split by concern

**DEC Jupiter Lesson:**
Don't abandon working architecture for next shiny thing.
Extend `/Users/tem/humanizer-agent/` (the VAX), don't rewrite.

## Error Recovery

If production DB becomes cluttered:
1. Export important memories to text
2. Recreate DB: `./run_operator.sh create`
3. Re-seed: `./run_operator.sh seed`
4. Re-import key memories manually

## This Guide

**Tags:** `pinned`, `guide`, `best-practice`, `meta`
**Purpose:** First memory to check in every Claude Code session
**Update:** When workflow changes or new patterns emerge
