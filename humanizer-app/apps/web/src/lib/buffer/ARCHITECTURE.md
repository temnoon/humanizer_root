# Buffer Architecture

## Core Insight

Content is **immutable**. Every operation creates a new version. History is a **DAG** (directed acyclic graph), not a linear sequence. Buffers are **named pointers** into the graph. Backtracking is just moving the pointer.

## Data Model

```
┌─────────────────────────────────────────────────────────────────┐
│                       CONTENT GRAPH                             │
│  (Immutable DAG - content nodes connected by operations)        │
│                                                                 │
│  [archive:conv-123]                                             │
│        │                                                        │
│        ├── split:sentence ──→ [node-a: 45 sentences]           │
│        │                            │                           │
│        │                            ├── filter:sic>70 ──→ [node-b: 12 gems]
│        │                            │                           │
│        │                            └── filter:sic<30 ──→ [node-c: 8 slop]
│        │                                                        │
│        └── chunk:paragraph ──→ [node-d: 15 paragraphs]         │
│                                      │                          │
│                                      └── transform:humanize ──→ [node-e]
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         BUFFERS                                 │
│  (Named pointers - can point anywhere in the graph)            │
│                                                                 │
│  workspace ────────→ node-b (the 12 gems)                      │
│  experiment-1 ─────→ node-e (humanized paragraphs)             │
│  experiment-2 ─────→ node-d (same parent, different path)      │
│  pinned:gems ──────→ node-b (pinned = won't be garbage collected)
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        PIPELINES                                │
│  (Saved sequences of operations - reusable recipes)            │
│                                                                 │
│  "book-prep":  split:sentence → filter:sic>70 → order:semantic │
│  "analysis":   chunk:paragraph → vectorize → cluster:hdbscan   │
│  "humanize":   split:sentence → transform:humanize → join      │
└─────────────────────────────────────────────────────────────────┘
```

## Types

```typescript
// ═══════════════════════════════════════════════════════════════
// CONTENT NODE - A single immutable piece of content
// ═══════════════════════════════════════════════════════════════

interface ContentNode {
  id: string;                    // Unique ID (uuid or content-hash)

  // Content can be singular or plural
  content: ContentItem | ContentItem[];

  // Provenance
  parentId: string | null;       // null = root (imported from archive)
  operation: Operation | null;   // null = root

  // Metadata
  metadata: {
    title?: string;
    source?: ArchiveSource;
    createdAt: number;           // timestamp
    tags?: string[];
  };
}

interface ContentItem {
  id: string;
  text: string;
  metadata?: Record<string, any>;  // sentence index, vector position, etc.
}

// ═══════════════════════════════════════════════════════════════
// OPERATION - What transforms content from parent to child
// ═══════════════════════════════════════════════════════════════

interface Operation {
  type: OperationType;
  operator: string;              // Registered operator name
  params?: Record<string, any>;  // Operator-specific params
  timestamp: number;
}

type OperationType =
  | 'import'      // From archive
  | 'split'       // One → many (sentence, paragraph, chunk)
  | 'filter'      // Many → fewer (by predicate)
  | 'transform'   // One → one (humanize, summarize)
  | 'merge'       // Many → one (join, concatenate)
  | 'order'       // Many → many (reorder by criteria)
  | 'annotate'    // Add metadata without changing content
  | 'fork'        // Explicit branch point

// ═══════════════════════════════════════════════════════════════
// BUFFER - Named pointer into the graph
// ═══════════════════════════════════════════════════════════════

interface Buffer {
  id: string;
  name: string;                  // Display name
  nodeId: string;                // Points to a ContentNode

  // Buffer state
  pinned: boolean;               // Prevent garbage collection
  cursor?: number;               // For multi-item content, which item is focused

  // History within this buffer (for undo/redo)
  history: string[];             // Stack of nodeIds this buffer has pointed to
  historyIndex: number;          // Current position in history
}

// ═══════════════════════════════════════════════════════════════
// PIPELINE - Saved sequence of operations
// ═══════════════════════════════════════════════════════════════

interface Pipeline {
  id: string;
  name: string;
  description?: string;
  steps: Omit<Operation, 'timestamp'>[];
}

// ═══════════════════════════════════════════════════════════════
// ARCHIVE SOURCE - Where content came from
// ═══════════════════════════════════════════════════════════════

interface ArchiveSource {
  type: 'chatgpt' | 'facebook' | 'notebook' | 'manual';
  archiveId: string;
  conversationId?: string;
  messageId?: string;
  path: string[];                // Breadcrumb trail
}
```

## Operations

### Core Operations

| Type | Operator | Description |
|------|----------|-------------|
| `split` | `sentence` | Split text into sentences |
| `split` | `paragraph` | Split by paragraph breaks |
| `split` | `chunk:n` | Split into n-word chunks |
| `filter` | `sic:>N` | Keep items with SIC score > N |
| `filter` | `contains:term` | Keep items containing term |
| `filter` | `predicate:fn` | Custom filter function |
| `transform` | `humanize` | Run through humanizer |
| `transform` | `summarize` | Condense content |
| `transform` | `vectorize` | Add vector embeddings |
| `merge` | `join` | Concatenate items |
| `merge` | `weave` | Interleave items |
| `order` | `semantic` | Order by semantic similarity |
| `order` | `chronological` | Order by timestamp |
| `order` | `sic:desc` | Order by SIC score |
| `annotate` | `tag:name` | Add tag to metadata |
| `annotate` | `sic` | Calculate and attach SIC scores |

### Pipeline Examples

```typescript
// Book preparation pipeline
const bookPrepPipeline: Pipeline = {
  id: 'book-prep',
  name: 'Prepare for Book',
  steps: [
    { type: 'split', operator: 'sentence' },
    { type: 'annotate', operator: 'sic' },
    { type: 'filter', operator: 'sic:>70' },
    { type: 'order', operator: 'semantic' },
  ]
};

// Analysis pipeline
const analysisPipeline: Pipeline = {
  id: 'analysis',
  name: 'Deep Analysis',
  steps: [
    { type: 'split', operator: 'paragraph' },
    { type: 'annotate', operator: 'vectorize' },
    { type: 'annotate', operator: 'sic' },
  ]
};
```

## Buffer Operations

```typescript
interface BufferManager {
  // Buffer CRUD
  createBuffer(name: string, nodeId: string): Buffer;
  deleteBuffer(bufferId: string): void;
  renameBuffer(bufferId: string, name: string): void;

  // Navigation
  setBufferNode(bufferId: string, nodeId: string): void;

  // History (within buffer)
  canUndo(bufferId: string): boolean;
  canRedo(bufferId: string): boolean;
  undo(bufferId: string): void;
  redo(bufferId: string): void;

  // Forking
  forkBuffer(bufferId: string, newName: string): Buffer;

  // Apply operations
  applyOperation(bufferId: string, operation: Operation): string;  // Returns new nodeId
  applyPipeline(bufferId: string, pipelineId: string): string;
}
```

## Graph Operations

```typescript
interface ContentGraph {
  // Node access
  getNode(nodeId: string): ContentNode | null;
  getRootNodes(): ContentNode[];
  getChildren(nodeId: string): ContentNode[];
  getParent(nodeId: string): ContentNode | null;
  getAncestors(nodeId: string): ContentNode[];  // Path to root

  // Node creation (always creates new, never mutates)
  createNode(content: ContentItem | ContentItem[], parent: string | null, operation: Operation | null): ContentNode;

  // Import
  importFromArchive(source: ArchiveSource, content: string): ContentNode;

  // Garbage collection
  collectGarbage(pinnedNodeIds: string[]): void;
}
```

## UI Integration

The Studio workspace shows the **current buffer's content**. Panels show:

- **Archive Panel**: Browse and import → creates root nodes
- **Buffer Panel**: List buffers, switch between them, create/fork
- **History Panel**: Show graph visualization, click to navigate
- **Tools Panel**: Apply operations, run pipelines

```
┌─────────────────────────────────────────────────────────────┐
│  ☰ Archive    workspace ▾   ←  →  ↩  ↪    Tools ⚙         │
│              [buffer selector]  [undo][redo]                │
├───────────────┬─────────────────────────────┬───────────────┤
│               │                             │               │
│  Archives     │     WORKSPACE               │    Tools      │
│               │                             │               │
│  ChatGPT      │  [Content from current      │  ┌─────────┐ │
│  → Conv 1     │   buffer's node]            │  │ Split   │ │
│  → Conv 2     │                             │  │ Filter  │ │
│               │  12 sentences               │  │ Order   │ │
│  Facebook     │  SIC: 72 avg                │  │ Export  │ │
│  → Posts      │                             │  └─────────┘ │
│               │                             │               │
│  Buffers      │                             │  Pipelines   │
│  • workspace* │                             │  • book-prep │
│  • exp-1      │                             │  • analysis  │
│  • exp-2      │                             │               │
│               │                             │               │
└───────────────┴─────────────────────────────┴───────────────┘
```

## Implementation Order

1. **Types** (`types.ts`) - All interfaces
2. **ContentGraph** (`graph.ts`) - DAG storage and operations
3. **BufferManager** (`buffers.ts`) - Buffer CRUD and history
4. **Operators** (`operators/`) - Individual operation implementations
5. **PipelineRunner** (`pipeline.ts`) - Execute operation sequences
6. **ArchiveConnector** (`archive.ts`) - Import from ChatGPT/Facebook
7. **Context** (`BufferContext.tsx`) - React integration
8. **UI** - Studio integration
