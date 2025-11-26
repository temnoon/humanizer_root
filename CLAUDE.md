# Humanizer - Development Guide

**Updated**: Nov 25, 2025 (Explore UI Phase 1 Complete!)
**Status**: Explore Tab Working | Enhancement Features Pending
**Active Branch**: `feature/archive-import-parser`
**Signups**: 239 waiting

---

## 🎯 NEXT: Explore Tab Enhancements

**Handoff**: `/tmp/HANDOFF_NOV25_EXPLORE_UI_COMPLETE.md` **← START HERE**

### Pending Features (User Requested)
1. **Click Navigation** - Click result → highlight text in message, scroll to position
2. **2D/3D Visualization** - t-SNE/UMAP projection with Three.js renderer
3. **Save Search Results** - Export query + hits to session buffer
4. **Async Jobs** - Background clustering with progress indicator

---

## ✅ Explore Tab UI (Phase 1 Complete)

**Added**: Nov 25, 2025

### Components Created
| File | Purpose |
|------|---------|
| `src/services/embeddingService.ts` | API wrapper |
| `src/contexts/ExploreContext.tsx` | Persistent state |
| `src/components/archive/ExploreView.tsx` | Tab container |
| `src/components/archive/SemanticSearchView.tsx` | Semantic search |
| `src/components/archive/ClusterBrowserView.tsx` | Cluster browser + params UI |
| `src/components/archive/AnchorManagerView.tsx` | Anchor management |

### Features Working
- Semantic search with 300ms debounce
- Similarity color-coding (green > 70%, yellow > 40%)
- Clustering with adjustable parameters
- State persistence across tab switches
- Pin results for anchor creation

---

## ✅ Archive Embedding System (Complete)

**Branch**: `feature/archive-import-parser`
**Status**: Backend Complete - 72K embeddings indexed
**Added**: Nov 25, 2025

### Stats
- Archive: `output_v13_final`
- Conversations: 1,720
- Messages: 36,255
- Embeddings: 72,510
- Clusters: 7 discovered

### Backend Files (`src/services/embeddings/`)

| File | Lines | Purpose |
|------|-------|---------|
| `EmbeddingDatabase.ts` | ~950 | SQLite + vec0 + CRUD |
| `ConversationWalker.ts` | ~200 | Extract from OpenAI tree |
| `EmbeddingGenerator.ts` | ~180 | transformers.js embeddings |
| `ArchiveIndexer.ts` | ~280 | Indexing orchestrator |
| `ClusteringService.ts` | ~320 | HDBSCAN + anchors (sampled) |

### API Endpoints (All Working)

```bash
# Embedding
POST /api/embeddings/build          # Start indexing
GET  /api/embeddings/status         # Check progress
POST /api/embeddings/search/messages  # Semantic search

# Clustering (use maxSampleSize: 1500 to avoid OOM)
POST /api/clustering/discover       # Run HDBSCAN
POST /api/anchors/create           # Create anchor
POST /api/anchors/between          # Find between anchors
```

### Earlier Handoffs
- `/tmp/HANDOFF_NOV25_EMBEDDINGS.md` - Embedding system details
- ChromaDB: `d9a70728...` (tag: `embeddings,clustering`)

---

## ✅ Archive Import Parser (Phase 6 Complete)

- ✅ TypeScript parser module - 9 files, ~1,800 lines
- ✅ 7-strategy media matching (hash, file-ID, filename+size, conv-dir, size+meta, size-only, filename-only)
- ✅ Audio file matching bug fixed
- ✅ Media folder creation bug fixed
- See: `/tmp/HANDOFF_NOV25_MEDIA_COMPLETE.md`

---

## 📁 OpenAI Export Media Structure

**Critical Knowledge** (documented in ChromaDB):

| Location | Pattern | Reference Format |
|----------|---------|------------------|
| Top-level | `file-{ID}_{name}.ext` | `file-service://file-{ID}` |
| `dalle-generations/` | `file-{ID}-{uuid}.webp` | `file-service://file-{ID}` |
| `user-{userID}/` | `file_{hash}-{uuid}.ext` | `sediment://file_{hash}` |
| `{uuid}/audio/` | `file_{hash}-{uuid}.wav` | Matched by conversation_dir |

---

## 🔧 QUICK COMMANDS

### Start Archive Server + Frontend
```bash
cd /Users/tem/humanizer_root/narrative-studio
npx tsx archive-server.js &  # Port 3002
npm run dev                   # Port 5173
```

### Import Archive via API
```bash
# Parse folder
curl -X POST http://localhost:3002/api/import/archive/folder \
  -H "Content-Type: application/json" \
  -d '{"folderPath": "/path/to/openai-export"}'

# Check status
curl http://localhost:3002/api/import/archive/status/{jobId}

# Apply to archive
curl -X POST http://localhost:3002/api/import/archive/apply/{jobId} \
  -H "Content-Type: application/json" \
  -d '{"archivePath": "/path/to/target/archive"}'
```

### Start Backend (Local with Ollama)
```bash
cd /Users/tem/humanizer_root/workers/npe-api
source ~/.nvm/nvm.sh && nvm use 22
npx wrangler dev --local
```

---

## 📊 CURRENT STATE

**Working**:
- ✅ Archive server (port 3002)
- ✅ Frontend (localhost:5173)
- ✅ Import Archive flow (upload → parse → preview → apply)
- ✅ 7-strategy media matching
- ✅ Merge with existing archives
- ✅ Backend (wrangler dev --local on :8787)
- ✅ AI Detection, Persona, Style transformations

**Test Archives**:
- Nov 8 2025 export: `/Users/tem/Downloads/6b7599...`
- Target archive: `test_media_import_nov25`
- Reference: `/Users/tem/openai-export-parser/output_v13_final`

---

## 🎯 Studio-First Architecture

**Pattern**: The Studio is THE interface paradigm. 3-panel layout: Find | Focus | Transform.

```
┌─────────────────┬──────────────────────────┬─────────────────┐
│  FIND           │  FOCUS                   │  TRANSFORM      │
│  (Left Panel)   │  (Center Panel)          │  (Right Panel)  │
└─────────────────┴──────────────────────────┴─────────────────┘
```

See `/workers/post-social-ui/` for reference implementation.

---

## ✅ COMPLETED FEATURES

- Session History & Buffer System (Phases 1-9)
- Markdown Preservation (Phase 1)
- AI Detection with highlights (Phase 2 backend)
- Post-Social Node System (Phases 1-3)

---

## 📝 TEST ACCOUNT

- Email: demo@humanizer.com
- Password: testpass123
- Role: admin

---

## 🚀 PRODUCTION

- API: https://npe-api.tem-527.workers.dev
- Frontend: https://humanizer.com
- Signups: 239 waiting

---

## ⚠️ CRITICAL RULES

1. **NO mock data** without explicit disclosure
2. **Node 22.21.1** (`nvm use 22`)
3. **Archive**: Always local (port 3002) for privacy
4. **Brand**: "humanizer.com" (with .com)

---

**End of Guide** | Next: Test with additional OpenAI exports
