# Handoff: Three Threads Book + Vector Analysis System

**Date**: Dec 24, 2025
**Session**: Vector analyzer, notebook voice extraction, book synthesis

---

## What Was Built

### 1. Vector Analysis System (`packages/core/src/vector/`)

Replaced single-score SIC with 5D semantic position + trajectory:

```
vector/
├── position.ts     ← 5D position per sentence (epistemic, commitment, temporal, embodiment, stakes)
├── craft.ts        ← Craft metrics (compression, surprise, specificity, tension, velocity)
├── trajectory.ts   ← Passage analysis, inflection detection
└── index.ts
```

**New types** (`types/vector.ts`):
- `SemanticPosition` - 5 dimensions, each -1 to +1
- `SentenceVector` - Position + magnitude + dominant dimension
- `Inflection` - Where text pivots between regions
- `CraftMetrics` - Compression, surprise, specificity, tension, velocity
- `PassageRho` - Full passage analysis (the density matrix)

**CLI updated**:
```bash
humanizer analyze "text" --vector   # New vector analysis (default)
humanizer analyze "text" --legacy   # Old SIC analysis
```

---

### 2. Three Threads Book

**Output**: `~/humanizer_root/humanizer-app/three-threads-book/`

```
three-threads-book/
├── THE_BOOK.md           ← SYNTHESIZED BOOK (2,187 words)
├── gems.json             ← 50 top passages with movement
├── bridges.json          ← 322 connecting passages (78 triple)
├── handwritten-gems.json ← 972 notebook fragments
├── notebook-voice.json   ← Voice characteristics
├── narrative-prompt.md   ← Harvest prompt
├── SYNTHESIS_PROMPT.md   ← Synthesis guide
└── vector-analysis.json  ← Lifeworld corpus analysis
```

**The Book Structure**:
1. Opening: The Compulsion to Write (notebook poetry)
2. Part I: The Lifeworld (Husserl's crisis)
3. Part II: The Body That Writes (Merleau-Ponty)
4. Part III: The Letter That Remains (Derrida)
5. Part IV: The Weave (synthesis)
6. Coda: The Cutting Edge of Time

**Key notebook fragments used**:
- "I have resorted to a compulsion to write..."
- "I am the unity of my experiences..."
- "How can you ever make a pure fact?"
- "Centering yourself is getting in phase with the universe"

---

### 3. Scripts Created

```
scripts/
├── harvest-three-threads.ts    ← Extracts passages for 3 threads
├── extract-notebook-voice.ts   ← Captures transcriptions + echoes
├── extract-handwritten-gems.ts ← Code block transcriptions
└── analyze-lifeworld.ts        ← Vector analysis of lifeworld corpus
```

---

## Key Discoveries

### Vector Analysis Insights

**Lifeworld corpus** (83 passages):
- 99% neutral-expository (text ABOUT phenomenology, not enacting it)
- 0 inflections detected
- 6% average coverage
- 3% velocity (nearly stationary)

**Notebook voice**:
- 972 total fragments
- 168 philosophy gems
- Higher commitment than conversation text
- Distinctive temporal markers

### Gizmo IDs for Notebooks
- `g-T7bW2qVzx` = Journal Recognizer OCR (137 conversations)
- `g-FmQp1Tm1G` = Image Name Echo & Bounce (162 conversations)

---

## Next Session Priorities

### 1. MD Reader + CRUD for Books
- Add react-markdown to web app
- Book list view with create/edit/delete
- Workers-compatible (no fs, use KV or D1)
- Load books from JSON or API

### 2. Pipeline Operators
- Clear flow: Harvest → Cluster → Order → Compose → Export
- Each step visualized
- Hookable events between stages

### 3. Sentencing Viewer
- Sentence-by-sentence position display
- Visual trajectory through 5D space
- Click to expand sentence details
- Inflection point highlighting

### 4. Generalized Chunking
- Universal chunk schema
- Sentence → Chunk → Passage → Chapter → Book
- Consistent across all sources (ChatGPT, Facebook, notebooks)

### 5. Expose All APIs
- Every tool as endpoint
- `/api/vector/analyze`
- `/api/book/harvest`
- `/api/book/compose`
- Swagger/OpenAPI docs

---

## Commands Quick Reference

```bash
# Start the app
cd ~/humanizer_root/humanizer-app
npm run dev  # Runs web at localhost:5174

# CLI commands
humanizer analyze "text"              # Vector analysis
humanizer analyze "text" --legacy -v  # Old SIC with evidence
humanizer book build lifeworld epoché -a ./my-archive -t "Title"
humanizer curate -a ./my-archive

# Run scripts
npx tsx scripts/harvest-three-threads.ts
npx tsx scripts/extract-handwritten-gems.ts
```

---

## Architecture

```
humanizer-app/
├── packages/
│   ├── core/          ✅ SIC + Vector analysis, sentence tokenizer
│   ├── archive/       ✅ ChatGPT + Facebook parsers
│   ├── book/          ✅ Harvest → Cluster → Order → Compose
│   └── ui/            ✅ HSL design system tokens
├── apps/
│   ├── cli/           ✅ In PATH as `humanizer`
│   └── web/           ⏳ Needs MD reader, book CRUD
├── scripts/           ✅ Analysis scripts
└── three-threads-book/ ✅ THE_BOOK.md + all materials
```

---

## The Book Awaits

```bash
# View the book
cat ~/humanizer_root/humanizer-app/three-threads-book/THE_BOOK.md

# Or in your editor
open ~/humanizer_root/humanizer-app/three-threads-book/THE_BOOK.md
```

**"I am the unity of my experiences, all the experience of my unity."**

---

*Handoff complete. The three threads are woven.*
