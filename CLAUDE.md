# Humanizer - Development Guide

**Last Updated**: Oct 11, 2025, 11:30PM
**Status**: ✅ Transformation Tools COMPLETE (all 4 tools operational)
**Next**: Train POVMs on corpus, test on real content

---

## 🚨 CRITICAL RULES

1. **NEVER `metadata`** → use `custom_metadata` (SQLAlchemy reserved)
2. **ALWAYS Pydantic** for interfaces
3. **ALWAYS SQLAlchemy 2.0** (`select()`, async, no `query()`)
4. **ALWAYS Poetry** (`poetry run`, not global Python)
5. **JSONB from `sqlalchemy.dialects.postgresql`** (not core)
6. **ALWAYS flush before FK insert** (user_preferences before tool_usage)
7. **NEVER mark simple return methods as `async`** (causes Promise bugs)
8. **Use global event listeners for drag operations** (not React handlers)
9. **NEVER access lazy-loaded relationships in async context** → Query explicitly

---

## 📁 Project Structure

```
/Users/tem/humanizer_root/
├── humanizer/              # Backend (FastAPI + PostgreSQL)
│   ├── ml/                 # TRM core (density, POVM, verification)
│   ├── api/                # 33 endpoints (7 new: transform + tools)
│   ├── services/           # Business logic (transformation NEW)
│   ├── models/             # SQLAlchemy + Pydantic (17 tables)
│   └── main.py
├── frontend/               # GUI (React + TypeScript + Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/         # AppShell, TopBar, Sidebar, MainPane
│   │   │   ├── conversations/  # ConversationList, ConversationViewer
│   │   │   ├── tools/          # ToolPanel + 4 tool panels (NEW)
│   │   │   └── media/          # MediaGallery
│   │   └── lib/
│   │       └── api-client.ts
│   └── vite.config.ts      # Proxy: /api → localhost:8000
├── humanizer_mcp/          # MCP server
└── tests/
```

---

## 🏃 Quick Start

```bash
# Backend
poetry run uvicorn humanizer.main:app --reload --port 8000

# Frontend
cd frontend && npm run dev
# Opens on http://localhost:3001

# Ollama (for transformations)
# Should already be running: http://localhost:11434
```

---

## ✅ What's Working (Oct 11, 2025 - 11:30PM)

### Backend API (FastAPI)
- ✅ **33 endpoints operational** (7 new: Transformation Tools)
- ✅ **Transformation Tools**: TRM iterative, LLM baseline, A/B comparison
- ✅ **Analysis Tools**: POVM measurements, density matrix properties
- ✅ **Extraction Tools**: Semantic search, entities, summary, keywords
- ✅ **Comparison Tools**: Text diff, embedding similarity, POVM delta
- ✅ **Ollama Integration**: mistral:7b for real transformations
- ✅ **Interest List System**: Complete CRUD, navigation, branching
- ✅ ChatGPT archive: 1,685 conversations, 46,355 messages
- ✅ Media serving: 811 images (Unicode filenames work!)
- ✅ Conversation rendering (markdown, HTML, PDF-ready)
- ✅ AUI tracking and recommendations

### Frontend GUI (React)
- ✅ **ToolPanel**: Right-side toolbar with 4 complete tools ⭐ NEW
- ✅ **Transform Tool**: TRM vs LLM comparison with Ollama ⭐ NEW
- ✅ **Analyze Tool**: Multi-pack POVM measurements ⭐ NEW
- ✅ **Extract Tool**: 4 extraction modes (semantic, entities, summary, keywords) ⭐ NEW
- ✅ **Compare Tool**: Side-by-side text comparison ⭐ NEW
- ✅ **Content Selection**: "Use in Tools" buttons throughout ⭐ NEW
- ✅ **ConversationViewer**: 4 view modes, message navigation, width controls
- ✅ **ConversationViewer CSS**: Golden ratio typography, 18px base, 700px width
- ✅ **LaTeX Rendering**: Full delimiter conversion + subscripts
- ✅ **Image Gallery**: 811 images, pagination, lightbox
- ✅ **Sidebar Resize**: Bidirectional drag working

### Database
- PostgreSQL + pgvector
- **17 tables operational**
- All 1,685 conversations with real titles
- Default user: `00000000-0000-0000-0000-000000000001`

---

## 🎯 Next Session Priorities

### High Priority (Testing & Enhancement - 4-6 hours)

1. **Test Transformation Tools on Real Content** (~1 hour)
   - Open "Hilbert space evaluation" conversation
   - Test analyze tool with multiple POVMs
   - Test transform tool (make more analytical)
   - Verify LaTeX preservation through transformation
   - Test extract tool (semantic search, summarization)
   - Test compare tool (before/after versions)

2. **Train POVMs on Labeled Corpus** (~3-4 hours)
   - Collect 100+ labeled examples per axis
   - Implement POVM training loop
   - Fit PSD operators to maximize discrimination
   - Replace random initialization with trained operators
   - **Impact**: Much better convergence in transformations

3. **Enhance Extraction Tool** (~1-2 hours)
   - Add spaCy for real entity extraction
   - Integrate pgvector for semantic search
   - Improve keyword extraction (TF-IDF/RAKE)

### Medium Priority (Future Features)

4. **Visualization** (~2-3 hours)
   - Radar charts for POVM readings
   - Trajectory plots for transformations
   - Convergence graphs with iteration history

5. **InterestNavigator UI** (~3-4 hours)
   - List selection dropdown
   - Item display with drag-to-reorder
   - Navigation controls
   - Branch management UI

---

## 📊 Current Stats

- **Conversations**: 1,685 (all with real titles)
- **Messages**: 46,355 (all renderable)
- **Images**: 811 (all accessible via /media endpoint)
- **API Endpoints**: 33 operational (7 new: transformation tools)
- **Database Tables**: 17 tables
- **Code**: ~14,000 lines (~65 files)
- **Tools**: 4 complete (Transform, Analyze, Extract, Compare)

---

## 🔧 Key Files

### Backend - Transformation Tools (NEW)
- `humanizer/services/transformation.py` - TRM iterative service (480 lines)
- `humanizer/api/transform.py` - Transform endpoints (235 lines)
- `humanizer/api/tools.py` - Analyze, Extract, Compare endpoints (350 lines)

### Backend - TRM Core
- `humanizer/ml/density.py` - Density matrix construction
- `humanizer/ml/povm.py` - POVM operators (5 packs)
- `humanizer/ml/verification.py` - Transformation verification

### Frontend - Tools (NEW)
- `frontend/src/components/tools/ToolPanel.tsx` - Right sidebar (85 lines)
- `frontend/src/components/tools/TransformationPanel.tsx` - Transform UI (350 lines)
- `frontend/src/components/tools/AnalysisPanel.tsx` - Analysis UI (220 lines)
- `frontend/src/components/tools/ExtractionPanel.tsx` - Extraction UI (260 lines)
- `frontend/src/components/tools/ComparisonPanel.tsx` - Comparison UI (280 lines)
- Plus 5 CSS files (~1,200 lines total styling)

### Frontend - Conversations
- `frontend/src/components/conversations/ConversationViewer.tsx` - 4 view modes, navigation
- `frontend/src/components/conversations/ConversationViewer.css` - Golden ratio typography
- `frontend/src/components/conversations/ConversationList.tsx` - Flat list with metadata

### Documentation
- `SESSION_NOTE_OCT11_TOOLS.md` - **START HERE** for tools session summary
- `ALL_TOOLS_COMPLETE.md` - Complete tools documentation
- `TRANSFORMATION_TOOLS_COMPLETE.md` - Transform tool details
- `LLM_INTEGRATION_COMPLETE.md` - Ollama integration guide

---

## 🔄 Transformation Tools (NEW)

### Architecture

**TRM Iterative Method**: Instead of direct text optimization, we:
1. Embed text → density matrix ρ
2. Measure with POVM → get semantic coordinates
3. Compute distance to target ρ
4. Use LLM to transform toward target
5. Re-embed and measure → check convergence
6. Repeat until converged

This creates a **closed-loop feedback system** where measurements guide transformation.

### Quick Test

```bash
# Transform (TRM iterative)
curl -X POST http://localhost:8000/transform/trm \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "Quantum mechanics describes reality.",
    "povm_pack": "tone",
    "target_stance": {"analytical": 0.8, "critical": 0.1, "empathic": 0.05, "playful": 0.03, "neutral": 0.02},
    "max_iterations": 3
  }'

# Analyze (POVM measurements)
curl -X POST http://localhost:8000/api/analyze \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "Quantum mechanics describes reality.",
    "povm_packs": ["tetralemma", "tone"]
  }'

# Extract (summarization)
curl -X POST http://localhost:8000/api/extract \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "Long text here...",
    "mode": "summary"
  }'

# Compare (text diff)
curl -X POST http://localhost:8000/api/compare \
  -H 'Content-Type: application/json' \
  -d '{
    "text_a": "Original version.",
    "text_b": "Modified version.",
    "povm_pack": "tone"
  }'
```

### Features
- **4 Tools**: Transform, Analyze, Extract, Compare
- **Real LLM**: Ollama mistral:7b integration
- **Iterative Refinement**: Up to 10 iterations
- **Convergence Tracking**: Drift metrics per step
- **5 POVM Packs**: tetralemma, tone, ontology, pragmatics, audience
- **Content Selection**: Click "Use in Tools" anywhere

---

## Common Pitfalls

1. ❌ `async` on methods that return plain values → ✅ Remove `async`
2. ❌ React event handlers for drag → ✅ Global `document.addEventListener`
3. ❌ `metadata` column → ✅ `custom_metadata`
4. ❌ Accessing `model.items` in async → ✅ Query with `select(func.count())`
5. ❌ **Placeholder LLM calls** → ✅ Now using real Ollama (mistral:7b)
6. ❌ **Random POVMs** → ⚠️ Still need training on labeled corpus

---

## Reading Experience CSS

### Golden Ratio Typography
```css
--phi: 1.618

/* Typography (base 18px - comfortable for 40+ eyes) */
--text-base: 18px
--text-xl: 29px
--text-2xl: 47px

/* Spacing (base 24px) */
--space-base: 24px
--space-lg: 39px
--space-xl: 63px

/* Reading Width (65-75 characters) */
--reading-width: 700px
```

### Design Principles
1. **Large text** - 18px base (40+ eyes)
2. **Optimal line length** - 700px (65-75 chars)
3. **Golden ratio spacing** - All measurements from φ
4. **Serif body** - Georgia for long-form reading
5. **Warm colors** - #fafaf8 bg, #2a2a2a text, #8b7355 accent

---

## Philosophy

> "Make me smarter by helping me know my actual subjective self."

- TRM-first (not bolted on)
- Make construction visible
- Mirror, don't manipulate
- Bottleneck is clarity, not code
- Beautiful interfaces disappear

---

**Latest session**: Oct 11, 2025 - Complete transformation tools suite (~4 hours)
**Servers**: Backend http://localhost:8000, Frontend http://localhost:3001
**Status**: All 4 tools operational ✅, Ready for testing on real content ✅
**Ollama**: mistral:7b integrated and working ✅
