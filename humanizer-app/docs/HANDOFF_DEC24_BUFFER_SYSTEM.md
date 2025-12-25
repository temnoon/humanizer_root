# Handoff: Buffer System + Studio Interface

**Date**: Dec 24, 2025 (~2:10 AM)
**Session**: Book Reader → Studio UI → Buffer Architecture
**Branch**: `feature/subjective-intentional-constraint`

---

## What Was Built

### 1. Book Reader (`/book` route)

Beautiful markdown reader with print-like typography:
- Sepia/Light/Dark themes
- Georgia serif font, justified text, drop caps
- Auto-hiding controls
- Font size adjustment
- THE_BOOK.md embedded (Three Threads)

**Files**:
- `apps/web/src/BookReader.tsx`

### 2. Studio Interface (`/` route - default)

Sepia workspace with hover panels:
- **Left panel**: Archive browser + Buffer list
- **Center**: Workspace (content display)
- **Right panel**: Tools (operators + pipelines)
- Auto-hiding top bar with undo/redo
- Mobile: panels become bottom sheets

**Files**:
- `apps/web/src/Studio.tsx`
- `apps/web/src/index.css` (studio styles)

### 3. Buffer System (`apps/web/src/lib/buffer/`)

Complete immutable content graph with pipelines:

```
lib/buffer/
├── ARCHITECTURE.md   ← READ THIS FIRST
├── types.ts          ← All TypeScript types
├── graph.ts          ← ContentGraph: immutable DAG
├── buffers.ts        ← BufferManager: named pointers + history
├── operators.ts      ← 15 operators registered
├── pipeline.ts       ← PipelineRunner + 5 built-in pipelines
├── archive.ts        ← ArchiveConnector (ChatGPT parser ready)
├── BufferContext.tsx ← React context
└── index.ts          ← Clean exports
```

**Key Concepts**:
- Content is **immutable** - operations create new nodes
- History is a **DAG** - fork anywhere, backtrack anywhere
- Buffers are **named pointers** with local undo/redo
- Operators are **composable** into pipelines

---

## Available Operators

| Category | Operators |
|----------|-----------|
| Split | `split:sentence`, `split:paragraph`, `split:chunk` |
| Filter | `filter:sic`, `filter:contains`, `filter:length` |
| Order | `order:sic`, `order:length`, `order:shuffle` |
| Select | `select:first`, `select:last`, `select:range` |
| Merge | `merge:join` |
| Annotate | `annotate:wordcount` |

## Built-in Pipelines

- **Split to Sentences** - Basic split
- **Split to Paragraphs** - By paragraph breaks
- **Prepare for Book** - Split → filter SIC>70 → order by SIC
- **Extract Gems** - Split → filter SIC>80 → first 20
- **Find Slop** - Split → filter SIC<30 → order asc

---

## Next Session: Wire Real Archive

### Archive Location

```
~/openai-export-parser/output_v13_final-save
```

This is the parsed ChatGPT archive with:
- 1,720 conversations
- 36,255 messages
- Structured JSON format

### Existing Embedding System

The narrative-studio already has embeddings for this archive:
- **72,510 embeddings** indexed
- SQLite + vec0 storage
- Located in: `narrative-studio/src/services/embeddings/`

**Key files**:
- `EmbeddingDatabase.ts` - SQLite + vec0 operations
- `ArchiveIndexer.ts` - Indexing orchestrator
- Archive server runs on port 3002

### Integration Plan

1. **Load Archive JSON** into `ArchiveConnector`
   - Parse `conversations.json` from output_v13_final-save
   - Or connect to archive-server API (port 3002)

2. **Connect to Existing Embeddings**
   - Reuse the 72K embeddings already built
   - No need to re-embed if same conversations

3. **Add SIC Scoring Operator**
   - Import `analyzeSIC` from `@humanizer/core`
   - Create `annotate:sic` operator
   - Filter operators already support SIC

4. **Semantic Search Integration**
   - Connect to embedding search API
   - Add search to Archive panel

### Archive Server Commands

```bash
# Start archive server (if needed)
cd ~/humanizer_root/narrative-studio
npx tsx archive-server.js  # Port 3002

# API endpoints
GET  /api/conversations
GET  /api/conversations/:id
POST /api/embeddings/search/messages
```

---

## Current State

### Running
```bash
cd ~/humanizer_root/humanizer-app
npm run dev  # Port 5174
```

### Routes
- `http://localhost:5174/` - Studio (default)
- `http://localhost:5174/book` - Book reader
- `http://localhost:5174/analyze` - Legacy SIC analyzer

### Demo Data
Currently using hardcoded `DEMO_CONVERSATIONS` in Studio.tsx. Replace with real archive loader.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    CONTENT GRAPH                            │
│  (Immutable DAG - all content versions)                    │
│                                                             │
│  [archive:conv-123]                                         │
│        │                                                    │
│        ├── split:sentence ──→ [45 sentences]               │
│        │                            │                       │
│        │                            └── filter:sic>70 ──→ [12 gems]
│        │                                                    │
│        └── chunk:paragraph ──→ [15 paragraphs]             │
└─────────────────────────────────────────────────────────────┘
                              ↑
┌─────────────────────────────────────────────────────────────┐
│                      BUFFERS                                │
│  (Named pointers with undo/redo history)                   │
│                                                             │
│  workspace ────→ [12 gems]                                 │
│  experiment-1 ──→ [15 paragraphs]                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Files Modified This Session

### New Files
- `apps/web/src/BookReader.tsx`
- `apps/web/src/Studio.tsx` (rewritten)
- `apps/web/src/lib/buffer/*` (entire directory)
- `three-threads-book/THE_BOOK.md` (from previous session)
- `docs/HANDOFF_DEC24_THREE_THREADS.md`

### Modified Files
- `apps/web/src/App.tsx` - Added routing
- `apps/web/src/index.css` - Added book + studio styles
- `apps/web/package.json` - Added react-markdown, remark-gfm

---

## Quick Start Next Session

```bash
# 1. Start the app
cd ~/humanizer_root/humanizer-app
npm run dev

# 2. (Optional) Start archive server for real data
cd ~/humanizer_root/narrative-studio
npx tsx archive-server.js &

# 3. Open in browser
open http://localhost:5174/
```

**Priority**: Wire `output_v13_final-save` archive into the Studio's Archive panel, replacing demo data with real conversations.

---

*"I am the unity of my experiences, all the experience of my unity."*
