# Next Features Architecture
**Date**: October 11, 2025
**Status**: 🟡 DESIGN PROPOSAL
**Estimated**: 12-15 development days

---

## 📋 Overview

This document proposes the architecture for the next phase of Humanizer features:
1. **LaTeX Rendering** (verification & fixes)
2. **Interest List Management UI** (navigation, branching, persistence)
3. **Transformation System** (create, save, apply at multiple scales)
4. **Multi-Scale Chunking** (hierarchical embeddings with 3 model tiers)

---

## 1️⃣ LaTeX Rendering Status

### ✅ Current Implementation
- **Message View**: Using `ReactMarkdown` + `remark-math` + `rehype-katex`
- **HTML Export**: Backend renders to HTML with MathJax support
- **CSS**: KaTeX styles imported (`katex/dist/katex.min.css`)

### ✅ Verification Needed
- [ ] Test inline math: `$E = mc^2$`
- [ ] Test block math: `$$\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}$$`
- [ ] Verify in all view modes (Messages, Markdown, HTML)
- [ ] Check escaping edge cases

### 🔧 Fixes Required (if any)
```typescript
// frontend/src/components/conversations/ConversationViewer.tsx
// Already has correct setup:
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// Applied to ReactMarkdown:
<ReactMarkdown
  remarkPlugins={[remarkMath]}
  rehypePlugins={[rehypeKatex]}
>
  {content}
</ReactMarkdown>
```

**Action Items**:
1. Create test conversation with LaTeX examples
2. Verify rendering in all view modes
3. Fix any escaping issues if found

---

## 2️⃣ Interest List Management UI

### Conceptual Foundation

**Interest as Turing Tape**: An interest list represents a trajectory through attention space. Each item is a moment where attention crystallized around content.

```
Interest List = Turing Tape of Attention
┌────────────────────────────────────────────────────┐
│  Item 0: Conversation "Narrative Scope" (selected) │
│  Item 1: Message #42 from that conversation        │◄─── Current position
│  Item 2: Artifact "density_matrix_v3.py"           │
│  Item 3: Book "Madhyamaka & Quantum"               │
│           └── Branch A: Related conversation       │
│           └── Branch B: Referenced paper           │
└────────────────────────────────────────────────────┘
```

### Database Schema

```sql
-- Interest tracks (the tapes)
CREATE TABLE interests (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  title TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Turing tape state
  current_position INTEGER DEFAULT 0,

  -- Metadata
  custom_metadata JSONB,  -- tags, color, icon, etc.

  -- Attention metrics (from existing Interest model)
  attention_weight FLOAT DEFAULT 1.0,
  realized_value FLOAT,
  resolution_status VARCHAR(50)
);

-- Items on the tape
CREATE TABLE interest_items (
  id UUID PRIMARY KEY,
  interest_id UUID REFERENCES interests(id) ON DELETE CASCADE,

  -- Position on tape
  position INTEGER NOT NULL,
  parent_item_id UUID REFERENCES interest_items(id),  -- For branching

  -- Content reference (polymorphic)
  content_type VARCHAR(50),  -- 'conversation', 'message', 'artifact', 'book', etc.
  content_id UUID,           -- ID in respective table

  -- Display
  title TEXT,
  preview TEXT,

  -- TRM measurements (if taken)
  povm_readings JSONB,
  density_state VECTOR(256),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(interest_id, position)
);

-- Branches (alternative paths from a tape position)
CREATE TABLE interest_branches (
  id UUID PRIMARY KEY,
  source_item_id UUID REFERENCES interest_items(id) ON DELETE CASCADE,
  branch_interest_id UUID REFERENCES interests(id) ON DELETE CASCADE,

  label TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### UI Component: `InterestNavigator`

```typescript
interface InterestNavigator {
  interest: Interest;
  currentPosition: number;

  // Navigation
  onStepForward: () => void;
  onStepBackward: () => void;
  onJumpTo: (position: number) => void;

  // Modification
  onInsertItem: (item: InterestItem, position?: number) => void;
  onRemoveItem: (position: number) => void;
  onReorderItems: (from: number, to: number) => void;

  // Branching
  onCreateBranch: (fromPosition: number, label: string) => void;
  onFollowBranch: (branchId: string) => void;

  // Display
  viewMode: 'linear' | 'graph' | 'timeline';
}
```

### UI Layout

```
┌──────────────────────────────────────────────────────────┐
│ Interest: "Exploring Narrative Scope" [⚙️ Settings]      │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ◀️ Back    [0 / 42]    Next ▶️    [+ Add] [⋮ Menu]      │
│                                                           │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  📍 Current Item (Position 23)                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 💬 Conversation: "Introducing Narrative Scope"  │    │
│  │ 129 messages • Aug 23, 2025                      │    │
│  │                                                   │    │
│  │ [View Full] [Remove] [Branch]                    │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  🔀 Branches from this point:                            │
│  ├─ 📖 "Related Book: Madhyamaka Philosophy"             │
│  └─ 🎯 "Transformation Session: Clarify Intent"          │
│                                                           │
├──────────────────────────────────────────────────────────┤
│  Timeline View                                            │
│  ════════════════════════════════════════════════        │
│  0────10────20────●23──30────40────42                   │
│                    ↑                                      │
│                 Current                                   │
└──────────────────────────────────────────────────────────┘
```

### Key Features

1. **Linear Navigation**
   - Step forward/backward through items
   - Jump to specific position
   - Visual timeline with position indicator

2. **List Management**
   - Drag-and-drop reordering
   - Insert items at any position
   - Remove items (with undo)
   - Bulk operations

3. **Branching**
   - Create named branches from any position
   - View available branches at current position
   - Follow branch to new interest list
   - Visual branch indicators

4. **View Modes**
   - **Linear**: Simple list view
   - **Graph**: D3.js visualization of branches
   - **Timeline**: Temporal visualization with dates

5. **Persistence**
   - Auto-save on every change
   - Named save points
   - Export as JSON
   - Import from JSON

---

## 3️⃣ Transformation System

### Conceptual Model

**Transformation = Deliberate Trajectory Through Measurement Space**

A transformation is:
- **Source**: What text to transform (message, conversation, book, etc.)
- **Intention**: POVM measurements + target stance
- **Process**: Iterative refinement with verification
- **Result**: New text + transformation artifact

### Should Transformations BE Interest Lists?

**Answer: NO, but they should CREATE interest lists**

**Reasoning**:
- **Interest List** = Trajectory of **attention** (where you looked)
- **Transformation** = Trajectory of **construction** (what you made)

These are different but related:
- A transformation **generates** an interest list as provenance
- An interest list can **spawn** a transformation
- They share the Turing tape metaphor but serve different purposes

### Architecture

```
Transformation Session
├── Source Selection
│   ├── Single Message
│   ├── Conversation (all messages)
│   ├── Book (all chunks)
│   └── Custom Selection (arbitrary items)
│
├── Configuration
│   ├── POVM Pack Selection
│   ├── Target Stance Definition
│   ├── Iteration Limit
│   └── Verification Threshold
│
├── Execution (iterative)
│   ├── Step 1: Measure current state (ρ)
│   ├── Step 2: Apply POVM (get readings)
│   ├── Step 3: Generate transformation
│   ├── Step 4: Measure new state (ρ')
│   ├── Step 5: Verify alignment
│   └── Repeat or Accept
│
├── Provenance (auto-generated interest list)
│   ├── Item 0: Original text
│   ├── Item 1: First transformation attempt
│   ├── Item 2: Verification failure diagnosis
│   ├── Item 3: Second transformation attempt
│   └── Item N: Final accepted transformation
│
└── Result
    ├── Transformed Text
    ├── Transformation Artifact (stored)
    ├── Provenance Interest List
    └── Metrics (purity change, alignment scores)
```

### Database Schema

```sql
-- Transformation sessions
CREATE TABLE transformation_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),

  -- Source
  source_type VARCHAR(50),  -- 'message', 'conversation', 'book', 'custom'
  source_id UUID,           -- ID of source content

  -- Configuration
  povm_pack_name VARCHAR(100),
  target_stance JSONB,
  max_iterations INTEGER DEFAULT 5,
  verification_threshold FLOAT DEFAULT 0.1,

  -- Status
  status VARCHAR(50),  -- 'running', 'completed', 'failed'
  current_iteration INTEGER DEFAULT 0,

  -- Result
  result_text TEXT,
  result_artifact_id UUID REFERENCES artifacts(id),
  provenance_interest_id UUID REFERENCES interests(id),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Transformation steps (each iteration)
CREATE TABLE transformation_steps (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES transformation_sessions(id) ON DELETE CASCADE,
  step_number INTEGER,

  -- Input
  input_text TEXT,
  input_embedding VECTOR(256),
  input_density_state JSONB,

  -- POVM measurement
  povm_readings JSONB,

  -- Output
  output_text TEXT,
  output_embedding VECTOR(256),
  output_density_state JSONB,

  -- Verification
  verification_result JSONB,
  alignment_score FLOAT,
  passed BOOLEAN,

  created_at TIMESTAMP DEFAULT NOW()
);
```

### UI Component: `TransformationStudio`

```typescript
interface TransformationStudio {
  // Source selection
  sourceType: 'message' | 'conversation' | 'book' | 'custom';
  sourceIds: string[];

  // Configuration
  povmPack: string;
  targetStance: Stance;
  maxIterations: number;

  // Execution
  onStart: () => Promise<void>;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;

  // Results
  onAccept: (stepNumber: number) => void;
  onReject: () => void;
  onRegenerate: () => void;

  // Viewing
  currentStep: number;
  steps: TransformationStep[];
  viewMode: 'diff' | 'side-by-side' | 'provenance';
}
```

### UI Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Transformation Studio                         [✕ Close]      │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  📝 Source                                                    │
│  [●] Message  [ ] Conversation  [ ] Book  [ ] Custom         │
│  Selected: "The mind constructs reality..." (128 tokens)     │
│                                                               │
│  🎯 Target Stance                                            │
│  POVM Pack: [Tetralemma ▼]                                   │
│  Target: A: 0.7  ¬A: 0.1  Both: 0.1  Neither: 0.1           │
│                                                               │
│  [Start Transformation]                                       │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│  Progress: Step 2 / 5                                        │
│  ■■■■■■░░░░░░░░ 40%                                          │
│                                                               │
│  Current State:                                              │
│  Alignment: 0.23 (Target: 0.10) ❌ Below threshold           │
│                                                               │
│  [View Diff] [Side-by-Side] [Provenance Graph]              │
│                                                               │
│  ┌────────────────────┬────────────────────┐                │
│  │ Original           │ Transformed         │                │
│  ├────────────────────┼────────────────────┤                │
│  │ The mind constructs│ The mind actively   │                │
│  │ reality through... │ constructs reality..│                │
│  └────────────────────┴────────────────────┘                │
│                                                               │
│  [◀️ Prev Step] [Next Step ▶️] [Accept] [Regenerate]        │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Applying at Multiple Scales

```typescript
// Apply to single message
await transformationService.transform({
  source: { type: 'message', id: messageId },
  config: { povmPack: 'tetralemma', targetStance: {...} }
});

// Apply to entire conversation
await transformationService.transform({
  source: { type: 'conversation', id: conversationId },
  config: { povmPack: 'tone', targetStance: {...} },
  strategy: 'sequential'  // Transform each message in order
});

// Apply to deliberate book assembly
await transformationService.transform({
  source: {
    type: 'custom',
    items: [
      { type: 'conversation', id: conv1Id },
      { type: 'message', id: msg42Id },
      { type: 'artifact', id: art7Id }
    ]
  },
  config: { povmPack: 'narrative', targetStance: {...} },
  strategy: 'unified'  // Treat all content as one text
});
```

---

## 4️⃣ Multi-Scale Chunking Strategy

### Conceptual Model

**Hierarchical Semantic Representation**

Like wavelets decompose signals at multiple scales, we decompose text at multiple semantic scales:

```
Text Document
├── Coarse Level (Ollama 1024-dim)
│   └── Large chunks (1000-2000 tokens)
│       → Capture document-level themes
│       → Good for "what is this about?"
│
├── Mid Level (~512-dim)
│   └── Medium chunks (200-500 tokens)
│       → Capture section-level structure
│       → Good for hierarchical summaries
│       → Bridge between levels
│
└── Fine Level (~300-dim)
    └── Small chunks (sentences, 20-100 tokens)
        → Capture precise semantics
        → Good for exact retrieval
        → Find specific facts/quotes
```

### Why This Works

1. **Scale-Invariant Search**: Query at appropriate level for task
   - Broad exploration → Coarse level
   - Specific fact-finding → Fine level
   - Hierarchical understanding → Mid level

2. **Compression**: Store summary at coarse level, details at fine level

3. **Disambiguation**: Coarse context disambiguates fine-grained meanings

### Database Schema

```sql
-- Multi-scale chunks
CREATE TABLE chunks (
  id UUID PRIMARY KEY,

  -- Source
  source_type VARCHAR(50),
  source_id UUID,

  -- Hierarchy
  parent_chunk_id UUID REFERENCES chunks(id),
  child_chunk_ids UUID[],
  chunk_level INTEGER,  -- 0=coarse, 1=mid, 2=fine

  -- Position
  position_in_parent INTEGER,
  token_range_start INTEGER,
  token_range_end INTEGER,

  -- Content
  text TEXT,
  token_count INTEGER,

  -- Embeddings (one per scale)
  embedding_coarse VECTOR(1024),   -- Ollama model
  embedding_mid VECTOR(512),       -- Mid-range model
  embedding_fine VECTOR(300),      -- Sentence model

  -- Metadata
  custom_metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for hierarchical queries
CREATE INDEX idx_chunks_hierarchy ON chunks(parent_chunk_id, chunk_level);
CREATE INDEX idx_chunks_source ON chunks(source_type, source_id);

-- Vector indexes (one per scale)
CREATE INDEX idx_chunks_embedding_coarse ON chunks
  USING ivfflat (embedding_coarse vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_chunks_embedding_mid ON chunks
  USING ivfflat (embedding_mid vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_chunks_embedding_fine ON chunks
  USING ivfflat (embedding_fine vector_cosine_ops)
  WITH (lists = 100);
```

### Embedding Models

**Recommended Configuration**:

```python
# Coarse level (1024-dim) - Ollama
COARSE_MODEL = "ollama/mxbai-embed-large"  # 1024 dimensions
COARSE_CHUNK_SIZE = 1500  # tokens
COARSE_OVERLAP = 200

# Mid level (512-dim) - OpenAI or similar
MID_MODEL = "openai/text-embedding-3-small"  # 512 dimensions
MID_CHUNK_SIZE = 350  # tokens
MID_OVERLAP = 50

# Fine level (384-dim) - Sentence transformers
FINE_MODEL = "sentence-transformers/all-MiniLM-L6-v2"  # 384 dimensions
FINE_CHUNK_SIZE = 50  # tokens (roughly sentences)
FINE_OVERLAP = 10
```

### Chunking Service

```python
class MultiScaleChunkingService:
    async def chunk_document(
        self,
        text: str,
        source_type: str,
        source_id: UUID
    ) -> ChunkHierarchy:
        """
        Chunk text at multiple scales and embed each level.

        Returns hierarchical structure:
        - Coarse chunks contain mid chunks
        - Mid chunks contain fine chunks
        - All levels cross-reference
        """

        # Level 0: Coarse chunks
        coarse_chunks = self._chunk_text(
            text,
            size=COARSE_CHUNK_SIZE,
            overlap=COARSE_OVERLAP
        )
        coarse_embedded = await self._embed_batch(
            coarse_chunks,
            model=COARSE_MODEL
        )

        # Level 1: Mid chunks (within each coarse chunk)
        mid_chunks = []
        for coarse_chunk in coarse_chunks:
            mid_chunks_for_coarse = self._chunk_text(
                coarse_chunk.text,
                size=MID_CHUNK_SIZE,
                overlap=MID_OVERLAP
            )
            mid_embedded = await self._embed_batch(
                mid_chunks_for_coarse,
                model=MID_MODEL
            )
            mid_chunks.extend(mid_embedded)

        # Level 2: Fine chunks (sentences within each mid chunk)
        fine_chunks = []
        for mid_chunk in mid_chunks:
            sentences = self._split_sentences(mid_chunk.text)
            fine_embedded = await self._embed_batch(
                sentences,
                model=FINE_MODEL
            )
            fine_chunks.extend(fine_embedded)

        # Build hierarchy
        hierarchy = self._build_hierarchy(
            coarse_embedded,
            mid_chunks,
            fine_chunks
        )

        # Save to database
        await self._save_hierarchy(hierarchy, source_type, source_id)

        return hierarchy
```

### Query Interface

```python
# Coarse search (broad themes)
results = await chunk_service.search(
    query="quantum mechanics and consciousness",
    level="coarse",
    limit=10
)

# Fine search (specific facts)
results = await chunk_service.search(
    query="eigenvalues of density matrix",
    level="fine",
    limit=20
)

# Hierarchical search (start coarse, drill down)
coarse_results = await chunk_service.search(
    query="narrative theory",
    level="coarse",
    limit=5
)

# Get fine-grained children of top coarse result
fine_details = await chunk_service.get_children(
    chunk_id=coarse_results[0].id,
    level="fine"
)
```

### UI Component: `ChunkExplorer`

```
┌──────────────────────────────────────────────────────┐
│ Chunk Explorer: "Narrative Scope Conversation"       │
├──────────────────────────────────────────────────────┤
│                                                       │
│  View Level: [●] Coarse  [ ] Mid  [ ] Fine           │
│                                                       │
│  ┌────────────────────────────────────────────┐     │
│  │ Coarse Chunk 1 (1,200 tokens)              │     │
│  │ "This conversation explores the concept..." │     │
│  │                                             │     │
│  │ [Expand to Mid-Level] [View Details]       │     │
│  └────────────────────────────────────────────┘     │
│                                                       │
│  └─► Mid Chunks (5)                                  │
│      ├─ "Narrative scope refers to..." (250 tok)    │
│      ├─ "The relationship between..." (280 tok)     │
│      └─ ...                                          │
│                                                       │
│      └─► Fine Chunks (Sentences)                     │
│          ├─ "Narrative shapes perception."          │
│          ├─ "Identity emerges from stories."        │
│          └─ ...                                      │
│                                                       │
└──────────────────────────────────────────────────────┘
```

---

## 🗺️ Implementation Roadmap

### Phase 1: LaTeX & Interest Lists (3-4 days)
1. Verify LaTeX rendering (0.5 day)
2. Implement Interest database models (0.5 day)
3. Build InterestNavigator UI component (1 day)
4. Add Interest API endpoints (0.5 day)
5. Integrate with existing content views (0.5 day)
6. Testing & polish (1 day)

### Phase 2: Transformation System (4-5 days)
1. Design transformation database schema (0.5 day)
2. Implement transformation service layer (1.5 days)
3. Build TransformationStudio UI (1.5 days)
4. Add multi-scale application logic (1 day)
5. Testing & verification loops (1 day)

### Phase 3: Multi-Scale Chunking (4-5 days)
1. Set up embedding model infrastructure (1 day)
2. Implement chunking algorithms (1 day)
3. Build hierarchical storage & indexing (1 day)
4. Create ChunkExplorer UI (1 day)
5. Optimize query performance (1 day)

### Phase 4: Integration & Polish (1-2 days)
1. Connect all systems
2. End-to-end workflows
3. Performance optimization
4. Documentation

---

## 🔧 Technical Considerations

### Performance

1. **Embedding Generation**: Use batch processing + queues
2. **Vector Search**: pgvector with IVFFlat indexes
3. **Hierarchy Traversal**: Recursive CTEs in PostgreSQL
4. **UI Rendering**: Virtual scrolling for large lists

### Scalability

1. **Chunking**: Process in background tasks
2. **Embeddings**: Cache at all levels
3. **Interest Lists**: Paginate for lists >1000 items
4. **Transformations**: Queue-based processing

### Data Integrity

1. **Cascading Deletes**: Parent interest deletes all items
2. **Referential Integrity**: FK constraints on all relationships
3. **Atomic Operations**: Transactions for multi-step updates
4. **Versioning**: Keep transformation history

---

## 📊 Success Metrics

1. **LaTeX**: 100% of math expressions render correctly
2. **Interest Lists**: Navigate 1000+ items smoothly (<100ms)
3. **Transformations**: Average 3-5 iterations to convergence
4. **Chunking**: Process 100K tokens in <30 seconds
5. **Search**: Multi-scale queries return in <200ms

---

## 🎯 Next Steps

1. **Review this proposal** with team/user
2. **Prioritize phases** based on immediate needs
3. **Set up infrastructure** (embedding models, queues)
4. **Begin Phase 1** (LaTeX + Interest Lists)

---

**Questions for Discussion**:
1. Should transformation sessions auto-create interest lists, or manual trigger?
2. Which embedding models to use for mid-level (512-dim)?
3. UI preference: Single unified studio or separate tools?
4. Priority: Implement all 4 features, or deep-dive one at a time?
