# Humanizer - Development Guide

**Last Updated**: Oct 15, 2025 (Afternoon - Theme Integration Complete)
**Status**: ✅ Transformation System (100% Backend, 100% Frontend UI, 100% Themed)
**Next**: Text chunking for large documents, tier-based limits, similar messages modal

---

## 🎉 LATEST (Oct 15, 2025 - Afternoon - Theme Integration)

**UI Bug Fixes & Theme Integration: ✅ 100% COMPLETE**
- ✅ **Critical crash fix**: Added `original_text` field to transformation results
- ✅ **LaTeX rendering fixed**: Simplified preprocessing, works in all contexts
- ✅ **Light/Dark theme complete**: All 11 CSS files properly themed
- ✅ **High contrast**: All buttons, inputs, text readable in both themes
- ✅ **Footer metrics fix**: Improved contrast in split view
- ✅ **No breaking changes**: All features preserved

**Previous Session (Oct 13 - Evening - UI Upgrade)**:
- ✅ Side-by-side transformation view in main pane
- ✅ Unified theme system with CSS variables
- ✅ Theme toggle in TopBar
- ✅ Professional layout with responsive design

**Recent Sessions**:
- Oct 13 PM: Transformation Parameter Interpretation (87% → 100%)
- Oct 13 AM: Frontend Testing & Bug Fixes
- Oct 12: Discovery Engine (interests, lists, semantic search)

---

## 🚨 CRITICAL RULES

1. **NEVER `metadata`** → use `custom_metadata` (SQLAlchemy reserved)
2. **Backend returns `transformed_text`** not `text` AND does NOT return `original_text` (must add in frontend)
3. **ALWAYS use selectinload for relationships** to avoid lazy-loading errors
4. **ALWAYS SQLAlchemy 2.0** (`select()`, async, no `query()`)
5. **ALWAYS Poetry** (`poetry run`, not global Python)
6. **Router prefixes need `/api`** (e.g., `/api/interests`)
7. **Use String + CheckConstraint for enums** (SQLAlchemy Enum uses NAME not VALUE)
8. **PostgreSQL for persistent data, ChromaDB for agent memory**
9. **POVM parameters MUST be interpreted semantically** (see AXIS_MEANINGS in transformation.py)
10. **Personifier mode = SIMPLIFY not ELABORATE** (shorter, simpler, more direct)
11. **LaTeX preprocessing = SIMPLE** (only convert `\[...\]` and `\(...\)`, no auto-detection)
12. **Always use CSS variables for colors** (never hardcode #hex colors in components)

---

## 📁 Project Structure

```
/Users/tem/humanizer_root/
├── humanizer/              # Backend (FastAPI + PostgreSQL)
│   ├── ml/                 # TRM core (density, POVM, verification)
│   ├── api/                # 62 endpoints (interest, transform, agent, etc.)
│   ├── services/           # Business logic (interest, transformation, agent)
│   ├── models/             # SQLAlchemy + Pydantic (32 tables)
│   ├── data/               # Training data (396 personify pairs)
│   └── main.py
├── frontend/               # GUI (React + TypeScript + Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/         # AppShell, TopBar, Sidebar, MainPane
│   │   │   ├── conversations/  # ConversationList (with semantic search!)
│   │   │   ├── tools/          # ToolPanel + transformation tools
│   │   │   ├── media/          # MediaGallery, MediaViewer
│   │   │   ├── agent/          # AgentPrompt (Cmd+K)
│   │   │   ├── search/         # SemanticSearch ⭐ NEW
│   │   │   └── interest/       # InterestListPanel ⭐ NEW
│   │   └── lib/
│   │       ├── api-client.ts   # 62 API methods
│   │       └── cache.ts
│   └── vite.config.ts
├── humanizer_mcp/          # MCP server (21 tools)
├── browser-extension/      # Chrome extension for live capture
└── tests/
```

---

## 🏃 Quick Start

```bash
# Backend
cd /Users/tem/humanizer_root
poetry run uvicorn humanizer.main:app --reload --port 8000

# Frontend
cd /Users/tem/humanizer_root/frontend
npm run dev  # http://localhost:3001

# Ollama (for transformations)
# Should already be running: http://localhost:11434
```

---

## 📊 Current Stats

### **Data**
- **Conversations**: 6,826 (ChatGPT archive)
- **Messages**: 193,661 total
  - **Embedded**: 99.99% (193K with 1024-dim vectors)
  - **Dimension**: 1024 (mxbai-embed-large)
- **Images**: 811 (all accessible via /media)
- **Agent Conversations**: 4 saved with full persistence
- **Transformations**: 4 saved in history
- **Training Pairs**: 396 (Personifier)

### **API Endpoints**: 62 operational ✅
- **16 interest/list endpoints** ⭐ NEW
  - POST /interests (mark interesting)
  - GET /interests/current (get Now)
  - GET /interests/trajectory (Turing tape)
  - POST /interest_lists (create list)
  - GET /interest_lists (get all)
  - POST /interest_lists/{id}/items (add item)
  - ... and 10 more
- 6 embedding explorer
- 5 agent/AUI endpoints
- 4 personify endpoints
- 3 transform endpoints
- 3 transform history endpoints
- 25 other endpoints

### **Database Tables**: 32 operational ✅
- **5 interest tables** ⭐ NEW
  - interests (Turing tape of attention)
  - interest_tags (user-created tags)
  - interest_lists (curated collections)
  - interest_list_items (items in lists)
  - interest_list_branches (fork tracking)
- collections, messages (ChatGPT archive)
- agent_conversations (agent chat persistence)
- transformations (transformation history)
- 22 other tables (readings, media, books, etc.)

### **Database Migrations**: 6 applied ✅
- 001: Pipeline + embeddings
- 002-003: (historical)
- 004: Transformation type columns
- 005: Agent conversations table
- 006: Interest tracking tables ⭐ NEW

### **Code Stats**
- ~24,000 lines total (~110 files)
- Frontend: 1,100 lines added (this session)
- Backend API: Already existed (from previous architecture)
- MCP Server: 21 tools registered

---

## ✅ What's Working (Oct 15, 2025 - Complete System)

### **Discovery Engine** ⭐ NEW
- ✅ **Semantic Search**: Search 193K messages by meaning
  - Toggle: "📝 Title" (fast) vs "🧠 Semantic" (deep)
  - Color-coded similarity scores
  - Click result → loads conversation
- ✅ **Message Actions**: 4 buttons on every message
  - ⭐ Star (marks as interesting)
  - 🔍 Similar (finds semantic neighbors)
  - 📝 Add to List (saves to collection)
  - ✏️ Edit (transforms message)
- ✅ **Interest Lists Panel**: 📋 Lists in sidebar
  - Create/view/navigate lists
  - Progress tracking
  - Collapsible UI with icons
  - Item status (pending/current/completed/skipped)

### **Backend API** (FastAPI)
- ✅ **62 endpoints operational** (all working!)
- ✅ **Interest Tracking**: 16 endpoints ⭐ NEW
- ✅ **Agent Persistence**: 5 endpoints
- ✅ **Transformation Save**: 3 history endpoints
- ✅ **Personifier**: TRM + LLM with 396 training pairs
- ✅ **Embedding Explorer**: 6 endpoints
- ✅ **ChatGPT Archive**: Full CRUD
- ✅ **Media Serving**: 811 images

### **Frontend GUI** (React)
- ✅ **Transformation Split View**: Side-by-side original vs transformed in main pane
- ✅ **LaTeX Rendering**: Simplified preprocessing, works in all contexts
- ✅ **Light/Dark Theme**: Fully integrated across all 11 CSS files ⭐ NEW
- ✅ **Theme Toggle**: Instant switching with localStorage persistence
- ✅ **Discovery Engine**: Complete workflow (semantic search, lists)
- ✅ **Agent Prompt**: Cmd+K with persistence
- ✅ **Transformation History**: Filters + pagination
- ✅ **localStorage Caching**: <50ms load times
- ✅ **ConversationViewer**: 4 view modes, themed navigation
- ✅ **Sidebar**: Resizable, 10 views, fully themed

### **Database** (PostgreSQL + pgvector)
- ✅ **32 tables** (all operational)
- ✅ **6 migrations** applied
- ✅ **193K messages** with embeddings (99.99% coverage)
- ✅ **Interest tracking** infrastructure complete ⭐ NEW
- ✅ **Foreign key integrity** across all tables

---

## 🎯 Next Session Priorities

### ✅ COMPLETED THIS SESSION (UI Upgrade)
1. ✅ Created TransformationSplitView component (side-by-side original vs transformed)
2. ✅ Added theme toggle component (dark/light with localStorage)
3. ✅ Unified theme system with CSS variables (light & dark modes)
4. ✅ Refactored TransformationPanel.css (30+ hardcoded colors → CSS variables)
5. ✅ Wired transformation flow to show in main pane
6. ✅ Responsive design (desktop side-by-side, mobile stacked)
7. ✅ Documented complete upgrade (TRANSFORMATION_UI_UPGRADE_COMPLETE.md)

### ✅ COMPLETED PREVIOUS SESSION (Backend)
1. ✅ Fixed Personifier to SIMPLIFY not ELABORATE
2. ✅ Enhanced AXIS_MEANINGS with concrete word substitutions
3. ✅ Improved transformation prompt with "use exact words" rule
4. ✅ Test suite: 4.35/5.0 average, 10/10 tests passing

### **High Priority (2-3 hours)** - Chunking & Tiers
3. **Implement Text Chunking** (1-2h)
   - Split large texts by paragraphs/sections
   - Transform each chunk with context
   - Reassemble maintaining coherence
   - Test with 10K+ word documents

4. **Add Tier-Based Limits** (1h)
   - Premium tier: 8K tokens max output
   - Standard tier: 4K tokens max output
   - Free tier: 1K tokens max output
   - Show tier limits in UI

### **Medium Priority (1-2 hours)** - UX Polish
5. **Similar Messages Modal** (1h)
   - Show results in overlay (not console.log)
   - Click result → navigate to message
   - Show similarity scores

6. **Agent Conversation History** (1h)
   - Dropdown in AgentPrompt header
   - Resume previous conversations
   - Delete conversations

---

## 🔧 Key Files

### **UI Theme Integration** ⭐ NEW (Oct 15)

**Critical Bug Fixes**:
- `frontend/src/components/tools/TransformationPanel.tsx` - Added `original_text` field (line 196-199)
- `frontend/src/components/tools/TransformationSplitView.tsx` - Defensive null checks, simplified LaTeX

**LaTeX Rendering** (Simplified Approach):
- `frontend/src/components/conversations/ConversationViewer.tsx` - preprocessLatex() function
- `frontend/src/components/tools/TransformationSplitView.tsx` - Same preprocessLatex() function

**Theme System** (11 Files Updated):
- `frontend/src/index.css` - Global theme variables (light/dark)
- `frontend/src/components/layout/TopBar.css` - TopBar themed
- `frontend/src/components/conversations/ConversationViewer.css` - Full theme integration
- `frontend/src/components/tools/TransformationSplitView.css` - Footer contrast
- `frontend/src/components/tools/TransformationPanel.css` - All inputs/buttons themed
- `frontend/src/components/tools/ToolPanel.css` - Sidebar themed
- `frontend/src/components/tools/AnalysisPanel.css` - Full theme integration
- `frontend/src/components/tools/ExtractionPanel.css` - Full theme integration
- `frontend/src/components/tools/ComparisonPanel.css` - Full theme integration

**Documentation**:
- `SESSION_OCT15_UI_THEME_COMPLETE.md` - Comprehensive session notes (10,000+ words)

### **Transformation System** (Oct 13)

**Backend**:
- `humanizer/services/transformation.py` - AXIS_MEANINGS mapping, contextualized prompts
- `humanizer/services/personifier.py` - Simplification-focused prompts
- `humanizer/api/transform.py` - Returns `transformed_text` (NOT `original_text`)
- `humanizer/ml/povm.py` - 5 POVM packs with semantic definitions

### **Discovery Engine** (Oct 12)

**Backend**:
- `humanizer/models/interest.py` - Interest & InterestTag models
- `humanizer/api/interest.py` - 9 endpoints
- `humanizer/services/interest.py` - InterestTrackingService

**Frontend**:
- `frontend/src/components/interest/InterestListPanel.tsx` - Lists UI
- `frontend/src/components/conversations/ConversationViewer.tsx` - Action buttons

### **Other Working Features**

**Agent Persistence**:
- `humanizer/models/agent.py`, `humanizer/api/agent.py`

**Embedding Explorer**:
- `humanizer/services/embedding_explorer.py` (6 tools)

**Personifier**:
- `humanizer/data/curated_style_pairs.jsonl` (396 training pairs)

---

## 🎓 Key Learnings

### **ChromaDB vs PostgreSQL** (See DATABASE_ARCHITECTURE_NOTES.md)

**ChromaDB** = Agent working memory (ephemeral)
- MCP tool state
- Session-specific caching
- Quick vector similarity

**PostgreSQL** = Application data (persistent)
- Interest tracking (THIS session)
- User-facing features
- Relational integrity
- Cross-session persistence

**Rule**: If the user expects it tomorrow, use PostgreSQL.

### **Discovery Engine Design Patterns**

1. **Polymorphic References** - One interest system for all content types
2. **Turing Tape Model** - Linked chain of attention (previous → next)
3. **Progress Tracking** - Know where you are in lists
4. **Semantic Search** - Meaning not keywords
5. **Action at Discovery** - Buttons where content is found

---

## Common Pitfalls

1. ❌ `async` on simple return methods → ✅ Remove `async`
2. ❌ React event handlers for drag → ✅ Global listeners
3. ❌ `metadata` column → ✅ `custom_metadata`
4. ❌ SQLAlchemy Enum for strings → ✅ String + CheckConstraint
5. ❌ ChromaDB for user data → ✅ PostgreSQL for persistence
6. ❌ Forgetting to register routes → ✅ Check main.py
7. ❌ Hardcoded hex colors in CSS → ✅ Use CSS variables ⚠️ **NEW**
8. ❌ Aggressive LaTeX auto-detection → ✅ Only convert explicit delimiters ⚠️ **NEW**
9. ❌ Assuming API fields exist → ✅ Add defensive null checks ⚠️ **NEW**

---

## Philosophy

> "Make me smarter by helping me know my actual subjective self."

**Discovery Engine embodies this**:
- Track what you find interesting (Turing tape)
- Learn what paid off (realized_value)
- Find your own forgotten insights (semantic search)
- Curate your best thinking (interest lists)
- Navigate your ideas fluidly (polymorphic references)

**The Learning Loop**:
1. You mark what's interesting
2. System finds similar
3. You curate the best
4. Patterns emerge
5. You get smarter about attention

---

**Latest session**: Oct 15, 2025, 12:30 PM - UI Theme Integration Complete (100% ✅)
**Servers**: Backend http://localhost:8000, Frontend http://localhost:3001
**Status**: All systems operational, production ready ✅

### **System Status**
- ✅ Transformation UI: Complete (side-by-side view, LaTeX rendering)
- ✅ Theme System: Complete (light/dark modes, 11 CSS files themed)
- ✅ Discovery Engine: Complete (semantic search, interest lists)
- ✅ Embeddings: 193,661 messages (99.99% coverage)
- ✅ Interest Tracking: 5 tables, 16 endpoints, full UI
- ✅ Agent Persistence: 4 conversations saved
- ✅ Transformation Save: Working with history
- ✅ TRM & Personification: Operational (87% → 100%)
- ✅ MCP: 21 tools registered

### **Next Priorities** (From TODO)
1. **Text Chunking** (1-2h) - Split large texts by paragraphs, transform with context
2. **Tier Limits** (1h) - Premium/Standard/Free token limits
3. **Similar Messages Modal** (1h) - Show results in overlay with navigation
4. **Agent History** (1h) - Resume previous conversations
