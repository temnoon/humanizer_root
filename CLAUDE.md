# Humanizer - Development Guide

**Last Updated**: Oct 25, 2025 - Unified Conversations Phase 2 & 3 Complete
**Status**: 🚀 **Full-Stack Integration Ready!** | Frontend + Backend + Embeddings Management
**Latest**: 2,043 conversations unified (ChatGPT + Claude) | Source filtering | Embeddings API
**Next**: Fix slow loading (60s) + caching | Test embeddings generation | Phase 4-5

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

**Why**: Ensures continuity across sessions (~1,500-2,000 tokens) without manual handoff doc reading.

**When to skip**: Only if user says "start fresh" or "ignore previous context"

**After briefing**: Present summary and ask "What would you like to work on today?"

---

## 📋 CURRENT SESSION HANDOFF

**Unified Conversations - Phase 2 & 3 Complete + Embeddings Management** (Oct 25, 2025)

**Memory**: `17d44c507` | **Handoff**: `UNIFIED_CONVERSATIONS_PHASE1_HANDOFF.md`

### ✅ Completed This Session

**Phase 2 - Frontend Integration**:
- ✅ Updated api-client.ts with unified methods + **CRITICAL FIX**: Added trailing slash to `/conversations/`
- ✅ Updated ConversationList.tsx to use unified endpoint
- ✅ Added source badges (💬 ChatGPT, 🤖 Claude) and filter dropdown
- ✅ Tested: 2,043 conversations load correctly, filtering works (357 Claude)

**Phase 3 - Claude Embeddings**:
- ✅ Added `POST /api/claude/generate-embeddings` endpoint
- ✅ Batch processing service (1000 msgs/batch, Ollama mxbai-embed-large, 1024-dim)
- ✅ Ready to process 4,710 Claude messages (~5 min)

**NEW - Embeddings Management Interface**:
- ✅ Created `GET /api/embeddings/status` endpoint (ChatGPT, Claude, Documents)
- ✅ Created EmbeddingsPanel component (progress bars, stats, generate button)
- ✅ Registered embeddings_router in main app

### ⚠️ Known Issues

1. **SLOW LOADING**: 60 seconds to load 2,043 conversations (21 pages × 100 msgs)
2. **CACHING BROKEN**: localStorage cache may not work with unified endpoint
3. **Message Counts = 0**: List view trade-off for performance (no eager loading)

### 🔧 Next Actions

1. **URGENT**: Investigate slow loading - profile pagination, consider optimization
2. **URGENT**: Fix caching - verify localStorage with unified endpoint
3. Test embeddings generation on 4,710 Claude messages
4. Test EmbeddingsPanel UI
5. Phase 4: Frontend search integration
6. Phase 5: Testing & refinement

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
15. **Trailing slash**: FastAPI endpoints require trailing slash (e.g., `/conversations/`)

---

## 📦 Recent Completed Work (See Handoff Docs for Details)

- **Unified Conversations** (Oct 25): Phase 1-3 complete | `UNIFIED_CONVERSATIONS_PHASE1_HANDOFF.md`, `UNIFIED_CONVERSATIONS_PLAN.md`
- **Claude Archive Import** (Oct 25): 357 convs, 4,710 msgs, 7.18s | `CLAUDE_ARCHIVE_IMPORT_HANDOFF.md`
- **Week 7 Hybrid Rules + GFS** (Oct 22): 50% success, 77.5% cost reduction | `WEEK7_HYBRID_RESULTS.md`
- **Week 6 Corpus Rules** (Oct 22): 3.3% success, led to Hybrid | `WEEK6_CORPUS_DRIVEN_RESULTS.md`
- **Week 5 GFS Architecture** (Oct 22): -70% text change, +3x coherence | `WEEK5_COMPLETE_HANDOFF.md`
- **Week 4 Transform Strategies** (Oct 22): Evaluation complete | `WEEK4_TRANSFORMATION_STRATEGIES_COMPLETE.md`
- **Week 3 Adaptive POVM** (Oct 22): Archive-specific system | `WEEK3_ADAPTIVE_POVM_DESIGN.md`
- **Week 2 Semantic Operators** (Oct 22): Zero variance (σ=0.000), 22 operators | `WEEK2_COMPLETE_HANDOFF.md`
- **TRM/POVM System** (Oct 19): Phase 0/1/1.5 complete, 15/15 tests passing | See TRM section below

---

## 🔬 TRM/Quantum Reading System

**Status**: Phase 0/1/1.5 Complete ✅ | Core Architecture Solid | 100% Test Pass | Phase 2 Ready

**Core**: `humanizer/core/trm/` - Stateless (density.py, povm.py, verification.py, transformer.py)
**Storage**: `humanizer/adapters/storage/` - Pluggable (ephemeral, postgres, sqlite)
**Services**: `humanizer/services/` - Orchestration (sentence_embedding.py, reading.py)

**POVM Packs**: tetralemma, tone, ontology, pragmatics, audience
**Tests**: `tests/test_trm_core.py` (15/15 ✅)
**Reports**: `PHASE_0_COMPLETE.md`, `PHASE_1_COMPLETE.md`, `PHASE_1.5_COMPLETE.md`, `SESSION_HANDOFF_OCT19_COMPLETE.md`

**Phase 2 Next**: Replace `_simulate_trm_step` stub with real recursive TRM iteration (14-18h)

---

## 📁 Project Structure

```
/Users/tem/humanizer_root/
├── humanizer/              # Backend (FastAPI + PostgreSQL)
│   ├── core/trm/          # TRM stateless core
│   ├── adapters/storage/  # Storage backends (ephemeral, postgres, sqlite)
│   ├── ml/                # Legacy (use core/trm instead)
│   ├── api/               # 65+ endpoints (conversations, embeddings, chatgpt, claude, etc.)
│   ├── services/          # Business logic
│   ├── models/            # SQLAlchemy + Pydantic (32 tables)
│   └── main.py
├── frontend/              # React + TypeScript + Vite
│   ├── src/components/
│   │   ├── conversations/  # ConversationList (unified!)
│   │   ├── embeddings/     # EmbeddingsPanel (NEW!)
│   │   ├── layout/         # Sidebar, TopBar, TabBar, MainPane
│   │   └── ...
│   ├── src/store/         # Zustand state (tabs, ephemeral, settings)
│   └── src/lib/
│       ├── api-client.ts  # 65+ API methods
│       └── cache.ts       # localStorage cache
└── .claude/agents/        # Memory agent, frontend-tester

**Key Files**:
- Unified Conversations: `humanizer/api/conversations.py`, `humanizer/services/unified_conversations.py`
- Embeddings: `humanizer/api/embeddings.py`, `frontend/src/components/embeddings/`
- Claude: `humanizer/api/claude.py`, `humanizer/services/claude.py`, `humanizer/models/claude.py`
- ChatGPT: `humanizer/api/chatgpt.py`, `humanizer/models/chatgpt.py`
```

---

## 🏃 Quick Start

```bash
# Backend (port 8000)
cd /Users/tem/humanizer_root
poetry run uvicorn humanizer.main:app --reload --port 8000

# Frontend (port 3001)
cd frontend
npm run dev  # http://localhost:3001

# Kill processes if ports in use
lsof -ti:8000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

---

## 📊 Current Stats

### Data
- **Conversations**: 2,043 (1,686 ChatGPT + 357 Claude) - **UNIFIED!**
- **Messages**: 52,409 (47,699 ChatGPT + 4,710 Claude)
- **Media**: 811 images
- **Documents**: Ingestion system complete

### API Endpoints (65+)
**Unified Conversations** (6):
- GET /api/conversations/ (list), GET /api/conversations/stats, GET /api/conversations/{id}
- POST /api/conversations/search, POST /api/claude/generate-embeddings, GET /api/embeddings/status

**Plus**: 16 interest list, 6 embedding explorer, 5 agent/AUI, 7 Claude, 6 ChatGPT, 4 transformation, etc.

### Database Tables (32)
- chatgpt_conversations, chatgpt_messages (+ media, provenance)
- claude_conversations, claude_messages (+ media, projects, provenance)
- Unified via service layer (no new tables)

---

## 🧠 Memory Agent - ChromaDB Operations

**🚨 CRITICAL: ALL ChromaDB Memory operations MUST use the memory-agent**

**Automatic Session Start Briefing**: Memory agent provides context at every session start

**For ALL memory operations, use specialized memory agent**:
```
Launch memory-agent and [task]:
- Research [topic]
- Store session summary: [draft summary]
- Get all context for [debugging issue]
- Provide timeline of [feature evolution]
```

**❌ NEVER directly call ChromaDB MCP tools** - Always use the memory-agent
**✅ ALWAYS delegate** - The agent is optimized for memory operations

**Capabilities**: 9 ChromaDB tools, 72% avg context savings, session continuity
**Database**: `chroma_production_db/` (150 recent memories, Oct 1+), `chroma_archive_db/` (684 historical)
**Config**: `~/.claude.json` - Uses `MCP_MEMORY_DB_NAME="chroma_production_db"`
**Latest**: Memory ID `17d44c507` (Oct 25, 2025 - Phase 2 & 3 complete)

---

## 🧪 Frontend Testing

**🚨 CRITICAL: ALL frontend testing MUST use the frontend-tester subagent**

**Always use the frontend-tester subagent** (Chrome DevTools MCP):
```
Launch frontend-tester and test [feature name]
```

**❌ NEVER directly test frontend manually** - Always use the frontend-tester agent
**✅ ALWAYS use the agent** - It has Chrome DevTools access and proper testing protocols

**Agent Location**: `.claude/agents/frontend-tester.md`
**Guide**: `FRONTEND_TESTING_GUIDE.md`

---

## 🏗️ Technical Debt Management

**Invoke at session end or before milestones**:
```
Launch debt-tracker to audit current technical debt
```

**Tracked**: `TECHNICAL_DEBT.md` (9 items tracked)
**Agent**: `.claude/agents/debt-tracker.md`
**Philosophy**: Technical debt is not failure - it's conscious trade-offs for shipping faster

---

## 🐛 Common Pitfalls

1. ❌ DELETE returns 204, not JSON → Check `response.status === 204`
2. ❌ Using undefined CSS variables → Only use vars in index.css
3. ❌ Race conditions in useEffect → Add cleanup with `cancelled` flag
4. ❌ Forgetting view switching → Always call `onViewChange()`
5. ❌ Testing frontend directly → Use frontend-tester subagent
6. ❌ Missing trailing slash on FastAPI endpoints → Returns 307 redirect (e.g., `/conversations/` not `/conversations`)
7. ❌ Eager loading in list queries → Loads ALL messages, use lazy loading

---

## 📖 Key Docs & Troubleshooting

**Handoff Docs**: `UNIFIED_CONVERSATIONS_PHASE1_HANDOFF.md`, `UNIFIED_CONVERSATIONS_PLAN.md`, `CLAUDE_ARCHIVE_IMPORT_HANDOFF.md`, `WEEK7_HYBRID_RESULTS.md`, `WEEK5_COMPLETE_HANDOFF.md`

**Frontend**: `SESSION_OCT17_TABS_COMPLETE.md`, `FRONTEND_TESTING_GUIDE.md`

**Debugging**:
- Check localStorage: `humanizer-tabs`, `humanizer-settings`, `humanizer_cache_*`
- Check sessionStorage: `ephemeral-list-storage`
- Backend logs: `/tmp/backend.log`
- Frontend logs: `/tmp/frontend.log`
- Check for 307 redirects: Missing trailing slash on endpoints

---

**End of Guide** | For detailed context, use memory agent or see handoff docs
