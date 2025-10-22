# Humanizer - Development Guide

**Last Updated**: Oct 19, 2025 - Phase 0/1/1.5 Complete: Core/Shell Architecture + Storage Adapters + Test Fixes
**Status**: ✅ Production Ready - Core Architecture Solid | 100% Test Pass Rate | 3 Storage Backends | Ready for Phase 2
**Next**: Phase 2 - Transformation Engine (14-18 hours: rules + local LLM + recursive TRM iteration)

---

## 🚨 SESSION START PROTOCOL (AUTOMATIC)

**CRITICAL**: At the start of EVERY new session, automatically execute:

```
Launch memory-agent and provide session start briefing:
- Recent work from last 24-48 hours
- Current in-progress items
- Open issues or blockers
- Next priorities
```

**Why**: This ensures continuity across sessions without requiring user to manually read handoff docs. Memory agent synthesizes recent context efficiently (~1,500-2,000 tokens) so main agent starts fully contextualized.

**When to skip**: Only skip if user explicitly says "start fresh" or "ignore previous context"

**After briefing**: Present summary to user and ask "What would you like to work on today?"

---

## 🔬 TRM/Quantum Reading System (Oct 19, 2025)

### Overview
**Purpose**: Transform text iteratively toward target POVM axes using real quantum measurements
**Status**: Phase 0/1/1.5 Complete ✅ | Core Architecture Solid | 100% Test Pass Rate | Phase 2 Ready

### Architecture (Phase 0 Complete ✅)

**Core/Shell Separation**:
1. **Stateless Core** (`humanizer/core/trm/`) - Zero DB dependencies ✅
   - `density.py` - Density matrix construction (ρ from embeddings)
   - `povm.py` - 5 POVM packs with **proper Cholesky normalization** (Oct 19 fix)
   - `verification.py` - Transformation verification with **consistent projection matrices** (Oct 19 fix)
   - `transformer.py` - StatelessTransformer with function injection

2. **Storage Adapters** (`humanizer/adapters/storage/`) - Pluggable backends ✅
   - `base.py` - Protocol definitions (ConversationStorage, DocumentStorage, TransformationStorage)
   - `ephemeral.py` - In-memory only (privacy-first for web service)
   - `postgres.py` - PostgreSQL implementation (551 lines, full-featured)
   - `sqlite.py` - SQLite implementation (631 lines, desktop/mobile)
   - `__init__.py` - Storage factory with automatic fallback

3. **Services** - Orchestration layer
   - `humanizer/services/sentence_embedding.py` - Real sentence-transformers (all-MiniLM-L6-v2, 384 dim)
   - `humanizer/services/reading.py` - Reading sessions (uses core.trm imports ✅)
   - `humanizer/services/reading_stateless.py` - Pattern demo for vision alignment

### Recent Fixes (Phase 1.5 - Oct 19) ✅

**POVM Normalization** (Major):
- **Problem**: Operators didn't sum to identity (Σ E_i ≠ I)
- **Cause**: Quadratic scaling bug (E = B @ B.T)
- **Fix**: Cholesky decomposition for exact normalization
- **Result**: Tests 13/15 → 15/15 passing ✅

**Verification Determinism** (Major):
- **Problem**: Same embedding gave different ρ (random projections)
- **Fix**: Consistent projection matrix for comparisons
- **Result**: Zero distance for identical embeddings ✅

### Test Results
```bash
$ poetry run pytest tests/test_trm_core.py -v
============================== 15 passed in 0.10s ==============================
✅ 100% PASS RATE (Oct 19, 2025)
```

### Phase 2: Transformation Engine (Next - 14-18 hours)

**Goal**: Replace `_simulate_trm_step` stub with real recursive TRM iteration

**Components**:
1. **TransformationEngine** (5-6h) - Strategy pattern, rules + local LLM
2. **TRMIterator** (3-4h) - Recursive loop: embed → measure → transform → verify
3. **Local LLM Integration** (3-4h) - Ollama/Llama 3.1 8B
4. **Evaluation** (2-3h) - Test corpus, benchmarks, quality metrics

**Success Criteria**: >70% convergence rate, >0.6 coherence, <7 steps avg

### Quick Reference

**POVM Packs**:
- `tetralemma` - A, ¬A, both, neither
- `tone` - analytical, critical, empathic, playful, neutral
- `ontology` - corporeal, subjective, objective, mixed_frame
- `pragmatics` - clarity, coherence, evidence, charity
- `audience` - expert, general, student, policy, editorial

**Key Files** (⚠️ Updated Locations):
- **TRM Core**: `humanizer/core/trm/{density,povm,verification,transformer}.py`
- **Storage**: `humanizer/adapters/storage/{base,ephemeral,postgres,sqlite}.py`
- **Services**: `humanizer/services/{sentence_embedding,reading,reading_stateless}.py`
- **API**: `humanizer/api/reading.py`
- **Tests**: `tests/test_trm_core.py` (15/15 ✅)

**Phase Reports**:
- `PHASE_0_COMPLETE.md` - Core/shell architecture details
- `PHASE_1_COMPLETE.md` - Storage adapter implementation
- `PHASE_1.5_COMPLETE.md` - Test fixes (POVM normalization, verification)
- `SESSION_HANDOFF_OCT19_COMPLETE.md` - **START HERE for next session**

**Critical Note**: Two embedding services exist:
- `EmbeddingService` (Ollama, 1024 dim) → document ingestion
- `SentenceEmbeddingService` (transformers, 384 dim) → TRM/reading

---

## 🎯 Document Ingestion System (Oct 17-18, 2025)

### Complete ✅ - Production Ready (100%)
**Status**: Backend + Frontend operational, all bugs fixed, unified search with UX enhancements complete
**Lines of Code**: ~7,650 (29 new files, 38 modified including UX fixes)
**Memory ID**: `a4fe375ceb0576e93839d790cfd5932ff3eee67d27ceb304c0cf4f7da258867d` (Oct 18 evening session)

### What Was Built

**Phase 1: Database Models** ✅
- 4 PostgreSQL tables with pgvector (documents, document_chunks, document_media, ingestion_batches)
- SHA256 deduplication, both storage strategies (centralized/in_place)
- Embedding status tracking (pending/processing/completed/failed)

**Phase 2: File Parsers** ✅
- PDFParser (PyPDF2 + pdfplumber, text + image extraction)
- TextParser (chardet encoding detection)
- MarkdownParser (frontmatter + structure)
- ImageParser (PIL + EXIF metadata)
- Supports: PDF, TXT, MD, JPG, PNG, GIF, WebP, BMP, TIFF

**Phase 3: Core Services** ✅
- MediaStorageService (centralized: ~/humanizer_media/{type}/{year}/{month}/ OR in-place)
- DocumentChunker (intelligent: paragraphs → sentences → hard split, 1000 char chunks, 100 overlap)
- DocumentIngestionService (batch directory ingestion, duplicate detection, auto-chunking)

**Phase 4: Background Jobs** ✅
- EmbeddingJobQueue (PostgreSQL-based, 50 chunks/batch)
- Embedding Worker (async, polls every 5s, graceful shutdown)
- Run: `poetry run python -m humanizer.workers.embedding_worker`

**Phase 5: REST API** ✅
- 12 endpoints at `/api/documents/*`
- Ingestion: batch directory, single file
- Retrieval: list (paginated), get details, content, chunks, media
- Search: semantic/text search
- Management: update metadata, delete
- Batches: list batches, get batch details

### Key Files
- `humanizer/models/document.py` (4 models)
- `humanizer/services/parsers/*.py` (5 parsers)
- `humanizer/services/document_ingestion.py` (main orchestrator)
- `humanizer/services/embedding_queue.py` (job queue)
- `humanizer/workers/embedding_worker.py` (background processor)
- `humanizer/api/documents.py` (12 endpoints, ~700 lines)
- `humanizer/models/schemas.py` (+340 lines for 11 document schemas)

### Phase 6 (Frontend + UX) - 100% Complete ✅
- ✅ **DocumentsPanel** (sidebar view) - List, search, filter documents + Import button
- ✅ **DocumentViewer** component - Display document content/chunks (header layout fixed)
- ✅ **IngestionPanel** (directory picker) - Upload UI with batch management
- ✅ **Interest Lists integration** - Add "document" item type with 📚 icon, navigation working
- ✅ **Unified search** - Conversations + documents in single sorted list by relevance
- ✅ **UX Fixes** (4/5 implemented):
  1. Result click navigation - auto-switches to appropriate view
  2. Search result ordering - unified sorted list (not grouped)
  3. Document viewer header - chunk navigation in separate row
  4. Search persistence - sessionStorage saves query/results

**Phase 6 Files Created**:
- `frontend/src/components/documents/DocumentsPanel.tsx` (197 lines)
- `frontend/src/components/documents/DocumentsPanel.css` (227 lines)
- `frontend/src/components/documents/DocumentViewer.tsx` (512 lines) - Oct 18
- `frontend/src/components/documents/DocumentViewer.css` (700 lines) - Oct 18
- `frontend/src/components/documents/IngestionPanel.tsx` (308 lines) - **NEW Oct 18**
- `frontend/src/components/documents/IngestionPanel.css` (327 lines) - **NEW Oct 18**
- `frontend/src/components/pipeline/CombinedPipelinePanel.tsx` (33 lines) - **NEW Oct 18**
- `frontend/src/components/pipeline/CombinedPipelinePanel.css` (41 lines) - **NEW Oct 18**
- `frontend/src/lib/api-client.ts` (+161 lines: types + 13 methods)
- `frontend/src/types/sidebar.ts` (added 'documents' view)
- `frontend/src/components/layout/Sidebar.tsx` (documents + CombinedPipelinePanel)
- `frontend/src/components/layout/MainPane.tsx` (DocumentViewer + CombinedPipelinePanel)
- `frontend/src/App.tsx` (selectedDocument state, SelectedContent extended, tab sync)
- `frontend/src/types/tabs.ts` (document fields in tab state)
- `frontend/src/components/tools/ToolPanel.tsx` + 4 child panels (SelectedContent type updates)

**DocumentViewer Features**:
- 4 view modes: Content (markdown/text), Chunks (navigate w/ page numbers), Media (grid), JSON
- Navigation: chunk previous/next, width toggle (narrow/medium/wide)
- Actions: star, add to interest list, use in transformation tools
- Golden ratio typography matching ConversationViewer

**IngestionPanel Features**:
- Directory path input with validation
- File type filters: PDF, TXT, MD, Image (multi-select)
- Storage strategy: centralized (~/humanizer_media) or in-place
- Options: recursive search, force reimport, generate embeddings
- Recent batches list with success/failed/skipped stats
- Error display with expandable details
- Integrated with CombinedPipelinePanel (tabs: Document Ingestion + Embedding Pipeline)

### Critical Bugs Fixed (Oct 18)
**Morning/Afternoon**:
- ✅ **Bug #1**: Document ingestion batch FK violation - Added `session.flush()` before file processing
- ✅ **Bug #2**: DocumentViewer crash - Created `DocumentChunksListResponse` schema, fixed API mismatch
- ✅ **Bug #3**: Backend search method - documents.py:466 `get_embedding()` → `embed_text()`
- ✅ **UX Issue**: Import button not discoverable - Added to Documents sidebar

**Evening (UX Fixes)**:
- ✅ **UX #1**: Search results didn't navigate - Added `onViewChange` prop to SemanticSearch
- ✅ **UX #2**: Results grouped by type not score - Created unified sorted list
- ✅ **UX #3**: Document header cramped - Moved chunk nav to separate row
- ✅ **UX #4**: Search state lost on navigate - Added sessionStorage persistence

**Servers**: Backend (port 8000) + Frontend (port 3001) both operational

**Memory IDs**:
- Oct 17-18 (document ingestion): `db40a27c05dc2e93371748e6c8d1d4091add297470e8cb213350d1c465f16b97`
- Oct 18 evening (unified search + UX): `a4fe375ceb0576e93839d790cfd5932ff3eee67d27ceb304c0cf4f7da258867d`

---

## 🎯 PREVIOUS: Multi-View Tabs System (Oct 17, 2025)

### Implementation Complete ✅
**Status**: Production Ready - 10/10 tests passed
**Lines of Code**: ~1,005 (4 new files, 1 modified)

### Key Features
- ✅ Tab store with Zustand + localStorage persistence
- ✅ State isolation - each tab has independent app state
- ✅ Keyboard shortcuts: Cmd+T, Cmd+W, Cmd+1-9, Cmd+Shift+[ / ]
- ✅ Context menu - pin, close others, close to right
- ✅ Pin tabs to prevent accidental closing
- ✅ Max tabs limit (default: 10, configurable 1-20)
- ✅ Mobile responsive - 44px touch targets

### Files
- `frontend/src/types/tabs.ts` (177 lines)
- `frontend/src/store/tabs.ts` (230 lines)
- `frontend/src/components/layout/TabBar.tsx` (168 lines)
- `frontend/src/components/layout/TabBar.css` (345 lines)
- `frontend/src/App.tsx` (+85 lines) - Integration

### Quick Reference
```typescript
// Keyboard shortcuts
Cmd+T         → Create new tab
Cmd+W         → Close current tab
Cmd+1-9       → Switch to tab by index
Cmd+Shift+[   → Previous tab
Cmd+Shift+]   → Next tab

// Usage
import { useTabStore } from './store/tabs';
const createTab = useTabStore(state => state.createTab);
const updateTab = useTabStore(state => state.updateTab);
const getActiveTab = useTabStore(state => state.getActiveTab);
```

**Docs**: See `SESSION_OCT17_TABS_COMPLETE.md` for details

---

## 🏗️ Technical Debt Management

### Overview
The `debt-tracker` agent maintains systematic visibility into all temporary solutions, stubs, and workarounds across the multi-milestone production roadmap.

### Quick Start
**Invoke at session end or before milestones:**

```
Launch debt-tracker to audit current technical debt
```

### What It Does
- Scans for TODOs, stubs, fallbacks, and silent error handlers
- Categorizes by severity (🔴 blocking | 🟡 limiting | 🟢 cosmetic)
- Tracks by production milestone (local-dev, transformation-engine, cloud-archives, etc.)
- Maintains TECHNICAL_DEBT.md with complete inventory
- Flags old debt (>30 days) or recurring patterns

### Production Milestones
1. **Local Development** - Single-user MVP (current)
2. **Transformation Engine** - Core TRM/POVM functionality
3. **Cloud Archives** - Multi-user with persistence
4. **Discourse Plugin** - Forum integration
5. **Core ML** - Full quantum reading implementation

### Key Files
- **Agent**: `.claude/agents/debt-tracker.md`
- **Inventory**: `TECHNICAL_DEBT.md` (9 items tracked)
- **Guide**: See debt-tracker agent prompt for usage

### Philosophy
**Technical debt is not failure** - it's a conscious trade-off to ship faster. The tracker ensures:
- Know what shortcuts were taken
- Understand when they become blockers
- Clear path from prototype → production
- No surprise blockers at milestone time

---

## 🧪 Frontend Testing with Subagent

### Quick Start
**To test the frontend, always use the specialized testing subagent:**

```
Please launch the frontend-tester agent and test [feature name]
```

### What the Agent Does
- Automated browser testing via Chrome DevTools MCP
- Takes screenshots for visual verification
- Executes JavaScript to verify state
- Reports bugs with clear reproduction steps
- Comprehensive test reports with pass/fail status

### Example Test Requests
```
# Quick test
Test the tabs system

# Comprehensive test
Launch frontend-tester and thoroughly test:
1. Tab creation and switching
2. State isolation between tabs
3. Persistence after refresh

# Bug investigation
There's a bug where [describe issue]. Investigate using frontend-tester.

# Regression test
Run full frontend regression test
```

### Agent Location
- **File**: `.claude/agents/frontend-tester.md`
- **Guide**: `FRONTEND_TESTING_GUIDE.md`

### Why Use the Subagent?
- Specialized for frontend testing
- Has Chrome DevTools MCP tools in its context
- Knows app structure and test priorities
- Provides structured, actionable reports
- Takes comprehensive screenshots
- Main agent focuses on development, subagent handles testing

**Important**: The main agent (me) does not directly use Chrome DevTools MCP tools. I delegate all browser testing to the frontend-tester subagent, which has those tools in its context.

---

## 🧠 Memory Agent - ChromaDB Operations

### Automatic Session Start Briefing
**At every session start, memory agent automatically provides context:**
- Recent work (last 24-48 hours)
- In-progress items
- Open issues/blockers
- Next priorities
- ~1,500-2,000 token briefing replaces manual handoff doc reading

### Quick Start
**For other memory operations, use the specialized memory agent:**

```
Launch memory-agent and [task]:
- Research [topic]
- Store session summary: [draft summary]
- Get all context for [debugging issue]
- Provide timeline of [feature evolution]
```

### What the Agent Does
- **Session start briefing** (automatic - no user request needed)
- Multi-query semantic searches with synthesis
- Session summary storage with timestamp tracking
- Historical research and pattern recognition
- Memory organization and cleanup
- Context retrieval without cluttering main agent

### Refined Workflow for Session Summaries
**Main agent drafts, memory agent stores:**
1. Main agent (me) drafts summary of session work
2. Memory agent enhances with:
   - Related memory checks
   - Consistent tag application
   - Timestamp for session tracking (ISO 8601)
   - Proper structure for retrieval
3. Memory agent stores and confirms

### Example Requests
```
# Session start (automatic - I do this without user asking)
Launch memory-agent and provide session start briefing

# Store session summary (refined workflow)
Launch memory-agent and store session summary:
Draft: "Implemented memory agent with 9 tools, validated context savings (72% avg),
updated session tracking with timestamps. Files: memory-agent.md, guides, CLAUDE.md."
Tags: memory-agent, architecture, complete

# Research past work
Launch memory-agent and research Interest Lists implementation history

# Debug context
Launch memory-agent and get all context for sidebar persistence bug

# Historical analysis
Launch memory-agent and provide timeline of tabs feature evolution
```

### Agent Capabilities
- **9 ChromaDB tools** (extended set - essential + useful)
- **72% average context savings** (~3,500 tokens per complex operation)
- Searches, synthesis, and storage in isolated context
- **Session continuity**: Automatic briefings at session start
- Only final reports impact main agent context

### Why Use Memory Agent?
- **Multi-search operations**: Multiple queries + synthesis = single report
- **Context efficiency**: Agent processes large results, returns relevant insights only
- **Pattern recognition**: Finds connections across memories
- **Proper organization**: Structured notes with consistent tags
- **Main agent stays focused**: Development work, not memory management

### When to Use
✅ **Use memory agent for**:
- Multi-search research (2+ queries needed)
- Session summaries (comprehensive notes)
- Historical context retrieval
- Pattern analysis across memories
- Memory organization tasks

❌ **Use direct tools for**:
- Single simple store ("Remember this URL")
- Single quick lookup ("What's stored about X?")
- Database health check

### Files
- **Agent**: `.claude/agents/memory-agent.md`
- **Guide**: `MEMORY_AGENT_GUIDE.md`
- **Analysis**: `CHROMADB_MEMORY_TOOLS_ANALYSIS.md`
- **Latest Summary**: Memory ID `db40a27c...` (Oct 18, 2025 evening)

### ChromaDB Database Architecture ✅ (Oct 17, 2025 - Migration Complete)

**Multi-Database Structure**:
```
chroma_production_db/    → Active development (150 recent memories, Oct 1+)
chroma_archive_db/       → Historical reference (684 total, all preserved)
```

**Default Behavior**:
- All operations use `production_db` automatically
- Clean, focused database for current humanizer_root work
- Archive available for historical reference if needed

**Configuration**: `~/.claude.json` - Uses `MCP_MEMORY_DB_NAME="chroma_production_db"`

**Migration**: Completed Oct 17, 2025
- 150 recent memories → production_db
- 534 historical memories → archive_db (preserved)
- All 684 memories safe and accessible

**Docs**: See `CHROMADB_INFRASTRUCTURE_PLAN.md` for complete architecture

---

### MCP Permissions Architecture ✅ Complete

**Status**: Experiment complete (Oct 17, 2025) - All hypotheses confirmed
**Current Config**: Chrome DevTools in "allow" list (active and working)

**CONFIRMED DISCOVERY**: MCP permissions are **session-scoped**
- Configuration loaded at session initialization
- Changes during session don't take effect until NEW session
- Subagents inherit permissions from main agent's session start
- This is intended architecture, not a bug

**All Tests Completed** ✅:
1. ✅ "deny" blocks both main agent and subagent (confirmed)
2. ✅ "ask" blocks subagent (no interactive UI for prompts)
3. ✅ "allow" grants immediate access to both main agent AND subagent (confirmed)

**Test Evidence**:
- Main agent: Can see all 7 Chrome DevTools MCP tools
- Subagent: Successfully navigated to localhost:3001 and captured screenshot
- Zero errors, no permission prompts

**Recommendation for Frontend Testing**:
- Use `"allow"` configuration for Chrome DevTools MCP
- Enables both manual testing (main agent) and automated testing (subagents)
- No interruptions from permission prompts

**Configuration File**: `.claude/settings.local.json`
```json
{
  "mcpServers": {
    "chrome-devtools": {
      "permissions": {
        "tools": "allow"
      }
    }
  }
}
```

**Full Documentation**: See `MCP_PERMISSIONS_COMPLETE.md` for detailed findings

---

## 📋 Recent Implementations (Oct 2025)

### Working Memory Widget (Oct 16-17)
- Auto-tracks conversations when enabled
- SessionStorage persistence
- Fixed: Button overflow, duplicate titles
- Click items to navigate
- Save to interest lists

### Mobile Responsiveness (Oct 17)
- Breakpoints: 320px, 375px, 768px, 1024px+
- Touch-friendly 44px targets
- Mobile drawer sidebar
- Bottom sheet widgets
- Full-screen modals

### Settings System (Oct 16)
- Zustand + localStorage
- Working Memory settings
- UI preferences
- Feature toggles

---

## 🚨 CRITICAL RULES

1. **NEVER `metadata`** → use `custom_metadata` (SQLAlchemy reserved)
2. **ALWAYS SQLAlchemy 2.0** (`select()`, async, no `query()`)
3. **ALWAYS Poetry** (`poetry run`, not global Python)
4. **Router prefixes need `/api`** (e.g., `/api/interest-lists`)
5. **PostgreSQL for persistent data, ChromaDB for agent memory**
6. **Always use CSS variables** - Use --bg-*, --text-*, --accent-* (never --color-*)
7. **Claude model**: `claude-haiku-4-5-20251001` (Haiku 4.5 for AUI)
8. **Anthropic tools**: Use `input_schema` not `parameters`
9. **204 No Content**: Don't parse JSON from DELETE responses
10. **useEffect cleanup**: Add `cancelled` flag for async operations
11. **Frontend testing**: Use frontend-tester subagent (Chrome DevTools in "allow")
12. **MCP permissions**: Session-scoped (changes require new session)
13. **Technical debt**: Document in TECHNICAL_DEBT.md, reference #DEBT-XXX in code
14. **User auth stub**: Use `get_default_user_id()` - documented as DEBT-001

---

## 📁 Project Structure

```
/Users/tem/humanizer_root/
├── humanizer/              # Backend (FastAPI + PostgreSQL)
│   ├── ml/                 # TRM core (density, POVM, verification)
│   ├── api/                # 62 endpoints (interest_list, agent, chatgpt, explore)
│   ├── services/           # Business logic
│   ├── models/             # SQLAlchemy + Pydantic (32 tables)
│   └── main.py
├── frontend/               # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/        # Sidebar, TopBar, TabBar, MainPane
│   │   │   ├── agent/         # AgentPrompt (Cmd+K)
│   │   │   ├── interest/      # InterestListPanel
│   │   │   ├── ephemeral/     # WorkingMemoryWidget
│   │   │   ├── settings/      # SettingsPanel
│   │   │   └── conversations/ # ConversationList, ConversationViewer
│   │   ├── store/
│   │   │   ├── tabs.ts        # Multi-view tabs (NEW)
│   │   │   ├── ephemeral.ts   # Working Memory
│   │   │   └── settings.ts    # User settings
│   │   ├── types/
│   │   │   ├── tabs.ts        # Tab types (NEW)
│   │   │   ├── sidebar.ts
│   │   │   ├── ephemeral.ts
│   │   │   └── settings.ts
│   │   └── lib/
│   │       ├── api-client.ts  # 62 API methods
│   │       └── gui-actions.ts # GUIActionExecutor
│   └── vite.config.ts
├── .claude/
│   └── agents/
│       └── frontend-tester.md # Testing subagent (NEW)
└── .env                   # CLAUDE_API_KEY
```

---

## 🏃 Quick Start

```bash
# Backend
cd /Users/tem/humanizer_root
poetry run uvicorn humanizer.main:app --reload --port 8000

# Frontend
cd frontend
npm run dev  # http://localhost:3001
npm run build  # Production build

# Frontend Testing
# Use subagent, not direct commands
Ask Claude: "Launch frontend-tester and test the tabs"
```

---

## 📊 Current Stats

### Data
- **Conversations**: 1,659 (ChatGPT archive)
- **Messages**: 46,355 with embeddings
- **Media**: 811 images
- **Agent Conversations**: Persistent with history

### API Endpoints (62)
- 16 interest list endpoints
- 6 embedding explorer
- 5 agent/AUI
- 4 transformation
- Plus ChatGPT archive, media, stats

### Database Tables (32)
- interest_lists, interest_list_items
- chatgpt_conversations, chatgpt_messages
- agent_conversations
- transformations, reading_sessions

---

## 🗂️ Multi-View Tabs System

### Overview
**Purpose**: Work with multiple contexts simultaneously
**Storage**: localStorage (persists across refresh)

### Architecture
- **Zustand Store**: Single source of truth (`store/tabs.ts`)
- **Bi-directional Sync**: App ↔ Active Tab
  - Tab switch → Load tab state into app
  - App state change → Save to active tab
- **Type Safety**: Complete TypeScript coverage (`types/tabs.ts`)
- **Persistence**: localStorage via Zustand middleware

### Tab Data Structure
Each tab stores complete app state:
- Sidebar: view, collapsed, selected conversation, title
- Main pane: content type, data
- Tool panel: collapsed, selected content, transformation
- Metadata: created/accessed dates, pinned status

### Usage
```typescript
import { useTabStore } from '@/store/tabs';

// Create new tab
const createTab = useTabStore(state => state.createTab);
createTab({ title: 'My Tab', icon: '🔥' });

// Get active tab
const getActiveTab = useTabStore(state => state.getActiveTab);
const activeTab = getActiveTab();

// Update tab
const updateTab = useTabStore(state => state.updateTab);
updateTab(activeTab.id, { title: 'New Title' });

// Switch/close tabs
const switchTab = useTabStore(state => state.switchTab);
const closeTab = useTabStore(state => state.closeTab);
```

### Code Locations
- **State sync**: `App.tsx:154-197` (two useEffect hooks)
- **Tab store**: `store/tabs.ts` (230 lines)
- **Tab types**: `types/tabs.ts` (177 lines)
- **Tab UI**: `components/layout/TabBar.tsx` (168 lines)

---

## 🧠 Working Memory System

### Overview
**Purpose**: Track user activity automatically, save to interest lists
**Storage**: sessionStorage (clears on tab close, persists on refresh)

### Key Files
- `store/ephemeral.ts` (135 lines) - Zustand store
- `hooks/useActivityTracker.ts` (56 lines) - Auto-tracking hook
- `components/ephemeral/WorkingMemoryWidget.tsx` (87 lines)

### Usage
```typescript
// Enable tracking
useEphemeralListStore.getState().setAutoSave(true);

// Save to interest list
await useEphemeralListStore.getState().save('Session Name', 'Description');

// Clear
useEphemeralListStore.getState().clear();
```

### Tracked Items
- Conversations: UUID, title
- Transformations: ID, method, excerpt, convergence
- Search: Query, result count
- Media: File ID, filename

---

## ⚙️ Settings System

### Storage
- **Location**: localStorage
- **Key**: `humanizer-settings`
- **Store**: `store/settings.ts` (86 lines)

### Structure
```typescript
{
  ephemeralLists: {
    autoSaveEnabled: false,
    maxItems: 50,
    autoClearOnSave: true,
    defaultListType: 'ephemeral'
  },
  ui: {
    theme: 'auto',
    sidebarCollapsed: false,
    toolPanelCollapsed: false
  },
  features: {
    enableTransformationTracking: true,
    enableSearchTracking: true,
    enableMediaTracking: true
  }
}
```

---

## 🎯 Interest List System

### Features
- Create/delete lists (manual or via AUI)
- Add items (conversations, transformations, media)
- View lists with item count
- Click to open items
- Ephemeral lists from Working Memory
- Delete with confirmation

### Files
- Backend: `humanizer/api/interest_list.py` (587 lines)
- Frontend: `frontend/src/components/interest/InterestListPanel.tsx` (260 lines)
- API Client: `frontend/src/lib/api-client.ts:344-402`

---

## 🤖 AUI (Agentic UI) System

### What Works
- Modal UI (Cmd+K)
- Conversation history
- Tool calling (21 tools: 9 API + 12 MCP)
- GUI actions (creates interest lists, navigates views)
- Persistence

### Tools
**API**: semantic_search, list_conversations, get_conversation, get_media, list_media, create_transformation, create_interest_list, add_to_interest_list

**MCP**: read_quantum, search_chatgpt, get_chatgpt_stats, retrieve_memory, store_memory

---

## 🚀 Next Implementation Priority

### Immediate (Phase 6 Completion)
**Unified Search Enhancement** (2-3 hours) - Include documents in global search alongside conversations

### Quick Wins from Technical Debt
1. **Database connection pooling** (2-3 hours) - Small effort, enables cloud deployment
2. **Context-aware lists** (5-8 hours) - Show interest list conversations in sidebar

### Before Cloud Archives Deployment
**Must Fix** (blocking):
1. User authentication system (6-8 hours) - Replace `get_default_user_id()` stubs
2. Database pooling (2-3 hours) - Connection management for concurrent users

Total blocking effort: ~10 hours to clear path to multi-user cloud deployment

---

## 🐛 Common Pitfalls

1. ❌ DELETE returns 204, not JSON → Check `response.status === 204`
2. ❌ Using undefined CSS variables → Only use vars in index.css
3. ❌ Race conditions in useEffect → Add cleanup with `cancelled` flag
4. ❌ Forgetting view switching → Always call `onViewChange()`
5. ❌ Testing frontend directly → Use frontend-tester subagent

---

## 💡 Development Tips

### Fast Iteration
```bash
# Terminal 1: Backend
poetry run uvicorn humanizer.main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: Testing
Ask Claude: "Launch frontend-tester and test [feature]"
```

### Debugging
```typescript
// Check tab state
const activeTab = useTabStore.getState().getActiveTab();

// Check working memory
const list = useEphemeralListStore.getState().list;

// Check settings
const settings = useSettingsStore.getState().settings;

// Check localStorage
localStorage.getItem('humanizer-tabs');
localStorage.getItem('humanizer-settings');
sessionStorage.getItem('ephemeral-list-storage');
```

---

## 📖 Key Documentation

### Implementation Records
- `SESSION_OCT17_TABS_COMPLETE.md` - Tabs implementation
- `HANDOFF_OCT17_TABS.md` - Next session handoff
- `FRONTEND_TESTING_GUIDE.md` - How to use testing subagent

### Planning
- `ADVANCED_FEATURES_PLAN.md` - Context-aware lists, tabs, mobile
- `AUI_HANDOFF.md` - AUI implementation status

---

## 🔧 Troubleshooting

### Tabs not restoring
1. Check localStorage: `localStorage.getItem('humanizer-tabs')`
2. Verify Zustand persist middleware
3. Check browser console for errors

### Working Memory not tracking
1. Check if tracking enabled (widget shows 🧠)
2. Verify settings: `settings.ephemeralLists.autoSaveEnabled`
3. Check sessionStorage available

### Frontend testing not working
1. Ensure dev server running: http://localhost:3001
2. Launch subagent: "Launch frontend-tester and test..."
3. Don't use Chrome DevTools MCP directly from main agent

---

**End of Guide**
