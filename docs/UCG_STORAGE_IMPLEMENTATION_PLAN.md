# UCG Storage + Advanced Embedding System Implementation Plan

**Project**: humanizer-platinum  
**Branch**: blissful-rhodes  
**Created**: January 22, 2026 2:45 PM EST  
**Last Updated**: January 22, 2026 4:30 PM EST  
**Status**: PHASE 1 COMPLETE - Core Storage Implemented

---

## Executive Summary

This document defines the implementation plan for a production-ready Universal Content Graph (UCG) storage system with sophisticated 4-tier embedding and retrieval capabilities. The system replaces the current in-memory implementations with SQLite-backed persistent storage.

**Key Goals**:
1. SQLite-first persistent storage (no in-memory for production)
2. 4-tier retrieval: Base → Hybrid → Rerank → Pyramid
3. Advanced search: RRF fusion, negative filtering, anchor refinement
4. Large content handling via pyramid chunking (1K-100K+ tokens)
5. Semantic clustering for document assembly

**Total Estimated Lines**: ~2,550  
**Estimated Phases**: 6

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CONTENT STORE (SQLite + vec0)                   │
├─────────────────────────────────────────────────────────────────────┤
│  Tables:                                                            │
│  ├── content_nodes (all content, flat with hierarchy_level)        │
│  ├── content_nodes_vec (vec0 embeddings, 768-dim)                  │
│  ├── content_nodes_fts (FTS5 full-text search)                     │
│  ├── content_links (bidirectional relationships)                   │
│  └── import_jobs (adapter import tracking)                         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     CHUNKING SERVICE                                │
├─────────────────────────────────────────────────────────────────────┤
│  Strategies (cascade fallback):                                     │
│  ├── ConversationChunker (message boundaries)                      │
│  ├── ParagraphChunker (double newlines)                            │
│  ├── SentenceChunker (. ! ? endings)                               │
│  ├── ClauseChunker (, ; : boundaries)                              │
│  └── HardChunker (character limit fallback)                        │
│                                                                     │
│  Config: TARGET=2000 chars, MAX=4000, MIN=200                      │
│  Semantic boundary detection via embedding distance (optional)      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     RETRIEVAL PIPELINE                              │
├─────────────────────────────────────────────────────────────────────┤
│  Stage 1: Broad Retrieval (200 candidates)                         │
│  ├── BM25 via FTS5 (keyword/exact match, term frequency)           │
│  └── Dense via vec0 (semantic similarity, cosine distance)         │
│                                                                     │
│  Stage 2: Fusion + Filtering (100 candidates)                      │
│  ├── ReciprocalRankFusion (RRF, k=60)                              │
│  ├── NegativeFilter (semantic exclusion, hard negatives)           │
│  └── LengthMetadataWeighting (configurable boosts/penalties)       │
│                                                                     │
│  Stage 3: Reranking (50 candidates)                                │
│  ├── CrossEncoderReranker (ms-marco or API: Cohere/Jina)           │
│  └── AnchorRefinement (positive/negative user feedback)            │
│                                                                     │
│  Stage 4: Quality Gate (10-20 final results)                       │
│  └── QualityGatedPipeline (min scores, diversity penalty)          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     PYRAMID SERVICE (Large Content)                 │
├─────────────────────────────────────────────────────────────────────┤
│  Triggers: Content > 1000 tokens                                    │
│                                                                     │
│  Levels:                                                            │
│  ├── L0: Base chunks (hierarchy_level=0, ~400-500 words each)      │
│  ├── L1: Summary embeddings (hierarchy_level=1, groups 5-10 L0)    │
│  └── Apex: Document synthesis (hierarchy_level=2, single node)     │
│                                                                     │
│  Compression Ratios:                                                │
│  ├── L0→L1: ~10:1 (e.g., 5000 words → 500 words)                  │
│  ├── L1→Apex: ~10:1 (e.g., 500 words → 50 words)                  │
│  └── Total: ~100:1 for very large documents                        │
│                                                                     │
│  Enables: Coarse-to-fine retrieval, document-level similarity      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     SEMANTIC CLUSTERING                             │
├─────────────────────────────────────────────────────────────────────┤
│  Purpose: Document assembly, book creation, framework discovery     │
│                                                                     │
│  Pipeline:                                                          │
│  ├── UMAP dimensionality reduction (768-dim → 2D/3D)               │
│  ├── HDBSCAN density-based clustering (no K required)              │
│  ├── Soft membership (fractional cluster assignment)               │
│  └── Cluster summaries for user selection                          │
│                                                                     │
│  Output: Thematic groupings for content organization               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Research Foundation

This implementation is based on extensive research documented in ChromaDB memory nodes:

| Topic | Hash (first 8) | Key Insight |
|-------|----------------|-------------|
| Agentic Multi-Stage Search | 82afaffe | Query decomposition, self-grading retrieval loops |
| Hybrid Retrieval + RRF | 71614db3 | BM25 + Dense fusion via rank-based scoring, 20-48% improvement |
| Negative Filtering | 2ce6827a | Semantic exclusion, hard negative awareness |
| Semantic Clustering | 1a5a433f | UMAP + HDBSCAN for document assembly |
| Length/Metadata Weighting | 3972ff0e | Configurable boosts, log-scaling, exponential decay |
| Iterative Refinement UI | 917ff137 | FIND → REFINE → HARVEST pattern with anchors |
| Cross-Encoder Reranking | 35a64422 | +28% NDCG@10, ColBERT late-interaction |
| UCG Implementation (gm) | 03a8835a | Reference implementation with HybridSearch, QualityGatedPipeline |

---

## Reference Implementation: humanizer-gm

The humanizer-gm codebase provides a working reference (NOT a dependency):

**Key Files**:
- `electron/archive-server/services/content-graph/schema.ts` - Database schema
- `electron/archive-server/services/content-graph/ContentGraphDatabase.ts` - CRUD operations
- `electron/archive-server/services/content-graph/ChunkingService.ts` - Chunking strategies
- `electron/archive-server/services/embeddings/PyramidService.ts` - L0→L1→Apex builder
- `electron/archive-server/services/retrieval/HybridSearch.ts` - BM25 + Dense fusion
- `electron/archive-server/services/retrieval/ReciprocalRankFusion.ts` - RRF algorithm

**What humanizer-gm has**:
- ✅ content_nodes table with hierarchy_level
- ✅ vec0 for embeddings
- ✅ FTS5 for keyword search
- ✅ HybridSearch with RRF
- ✅ Basic pyramid (L0 → L1 → Apex)
- ✅ SemanticChunker with boundary detection

**What humanizer-gm lacks** (we will add):
- ❌ Cross-encoder reranking layer
- ❌ Anchor-based refinement (positive/negative marking)
- ❌ Semantic clustering for document assembly
- ❌ Query decomposition (agentic multi-hop)
- ❌ Negative filtering with hard negatives
- ❌ Configurable length/metadata weighting

---

## Phase Implementation Details

### Phase 1: Core Storage
**Target**: ~600 lines  
**Status**: NOT STARTED  
**Start Time**: TBD  
**Completion Time**: TBD

**Directory**: `packages/core/src/storage/`

**Files to Create**:

| File | Lines | Purpose |
|------|-------|---------|
| `index.ts` | ~30 | Barrel exports |
| `types.ts` | ~150 | ContentNode, StoredNode, QueryOptions types |
| `schema.ts` | ~150 | SQL DDL, migrations, indexes |
| `content-store.ts` | ~270 | ContentStore class with CRUD operations |

**Database Schema** (content_nodes):
```sql
CREATE TABLE content_nodes (
  -- Identity
  id TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  uri TEXT UNIQUE NOT NULL,
  
  -- Content
  text TEXT NOT NULL,
  format TEXT NOT NULL,  -- 'text', 'markdown', 'html', 'code', 'conversation'
  word_count INTEGER NOT NULL DEFAULT 0,
  
  -- Source tracking
  source_type TEXT NOT NULL,  -- 'chatgpt', 'claude', 'facebook', etc.
  source_adapter TEXT NOT NULL,
  source_original_id TEXT,
  source_original_path TEXT,
  import_job_id TEXT,
  
  -- Hierarchy (chunking + pyramid)
  parent_node_id TEXT REFERENCES content_nodes(id) ON DELETE CASCADE,
  chunk_index INTEGER,
  chunk_start_offset INTEGER,
  chunk_end_offset INTEGER,
  hierarchy_level INTEGER DEFAULT 0,  -- 0=chunk, 1=summary, 2=apex
  thread_root_id TEXT,  -- Original document for grouping
  
  -- Embedding tracking
  embedding_model TEXT,
  embedding_at INTEGER,
  embedding_text_hash TEXT,  -- For staleness detection
  
  -- Metadata (JSON)
  title TEXT,
  author TEXT,
  author_role TEXT,  -- 'user', 'assistant', 'system'
  tags TEXT,  -- JSON array
  source_metadata TEXT,  -- JSON object
  
  -- Timestamps
  source_created_at INTEGER,
  source_updated_at INTEGER,
  created_at INTEGER NOT NULL,
  imported_at INTEGER NOT NULL
);

-- vec0 for embeddings
CREATE VIRTUAL TABLE content_nodes_vec USING vec0(
  id TEXT PRIMARY KEY,
  content_hash TEXT,
  embedding float[768]
);

-- FTS5 for full-text search
CREATE VIRTUAL TABLE content_nodes_fts USING fts5(
  id,
  text,
  title,
  content='content_nodes',
  content_rowid='rowid'
);

-- Relationships
CREATE TABLE content_links (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES content_nodes(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES content_nodes(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL,  -- 'parent', 'child', 'reference', 'reply', 'version'
  metadata TEXT,  -- JSON
  created_at INTEGER NOT NULL
);

-- Import tracking
CREATE TABLE import_jobs (
  id TEXT PRIMARY KEY,
  adapter_id TEXT NOT NULL,
  source_path TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'pending', 'running', 'completed', 'failed'
  nodes_imported INTEGER DEFAULT 0,
  nodes_skipped INTEGER DEFAULT 0,
  nodes_failed INTEGER DEFAULT 0,
  links_created INTEGER DEFAULT 0,
  started_at INTEGER,
  completed_at INTEGER,
  error TEXT,
  stats TEXT  -- JSON
);
```

**Indexes**:
```sql
CREATE INDEX idx_content_nodes_hash ON content_nodes(content_hash);
CREATE INDEX idx_content_nodes_uri ON content_nodes(uri);
CREATE INDEX idx_content_nodes_source ON content_nodes(source_type, source_original_id);
CREATE INDEX idx_content_nodes_parent ON content_nodes(parent_node_id);
CREATE INDEX idx_content_nodes_hierarchy ON content_nodes(hierarchy_level);
CREATE INDEX idx_content_nodes_thread ON content_nodes(thread_root_id);
CREATE INDEX idx_content_nodes_embedding ON content_nodes(embedding_model) WHERE embedding_model IS NOT NULL;
CREATE INDEX idx_content_nodes_embedding_hash ON content_nodes(embedding_text_hash);
CREATE INDEX idx_content_nodes_import ON content_nodes(import_job_id);
CREATE INDEX idx_content_links_source ON content_links(source_id);
CREATE INDEX idx_content_links_target ON content_links(target_id);
CREATE INDEX idx_content_links_type ON content_links(link_type);
```

**ContentStore API**:
```typescript
interface ContentStore {
  // Lifecycle
  initialize(): Promise<void>;
  close(): Promise<void>;
  
  // Node operations
  storeNode(node: ImportedNode, jobId?: string): Promise<StoredNode>;
  storeNodes(nodes: ImportedNode[], jobId?: string): Promise<BatchResult>;
  getNode(id: string): Promise<StoredNode | undefined>;
  getNodeByUri(uri: string): Promise<StoredNode | undefined>;
  getNodeByHash(hash: string): Promise<StoredNode | undefined>;
  queryNodes(options: QueryOptions): Promise<QueryResult>;
  deleteNode(id: string): Promise<boolean>;
  
  // Embedding operations
  storeEmbedding(nodeId: string, embedding: number[], model: string): Promise<void>;
  getEmbedding(nodeId: string): Promise<number[] | undefined>;
  isEmbeddingStale(nodeId: string): Promise<boolean>;
  getNodesNeedingEmbeddings(limit: number): Promise<StoredNode[]>;
  
  // Search operations
  searchByKeyword(query: string, limit: number): Promise<SearchResult[]>;
  searchByEmbedding(embedding: number[], limit: number, threshold?: number): Promise<SearchResult[]>;
  
  // Link operations
  createLink(sourceId: string, targetId: string, type: string, metadata?: unknown): Promise<string>;
  getLinksFrom(id: string): Promise<StoredLink[]>;
  getLinksTo(id: string): Promise<StoredLink[]>;
  
  // Job operations
  createJob(adapterId: string, sourcePath: string): Promise<ImportJob>;
  updateJob(jobId: string, update: Partial<ImportJob>): Promise<void>;
  getJob(jobId: string): Promise<ImportJob | undefined>;
  
  // Stats
  getStats(): Promise<StoreStats>;
}
```

**Dependencies**:
- `better-sqlite3` - Synchronous SQLite driver
- `sqlite-vec` - vec0 extension for vector search

---

### Phase 2: Chunking Service
**Target**: ~400 lines  
**Status**: NOT STARTED  
**Start Time**: TBD  
**Completion Time**: TBD

**Directory**: `packages/core/src/chunking/`

**Files to Create**:

| File | Lines | Purpose |
|------|-------|---------|
| `index.ts` | ~20 | Barrel exports |
| `types.ts` | ~80 | ChunkingStrategy, ContentChunk, ChunkingResult |
| `boundary-detector.ts` | ~100 | Embedding-based topic boundary detection |
| `chunker.ts` | ~200 | Main ChunkingService with cascade strategies |

**Configuration Constants**:
```typescript
const CHUNK_CONFIG = {
  TARGET_CHARS: 2000,    // ~400-500 words
  MAX_CHARS: 4000,       // Hard limit
  MIN_CHARS: 200,        // Avoid tiny chunks
  BOUNDARY_THRESHOLD: 0.3,  // Cosine distance for topic shift
};
```

**Chunking Strategies** (cascade fallback):
1. **Conversation** - Split on message boundaries (for chat exports)
2. **Paragraph** - Split on `\n\n` (for documents)
3. **Sentence** - Split on `. ! ?` (for long paragraphs)
4. **Clause** - Split on `, ; :` (for long sentences)
5. **Hard** - Character limit split (last resort)

**Semantic Boundary Detection**:
```typescript
interface BoundaryDetector {
  detectBoundaries(
    sentences: string[],
    embedder: (texts: string[]) => Promise<number[][]>
  ): Promise<number[]>;  // Returns indices where topics shift
}
```

Uses sliding window cosine distance to find topic shifts before splitting.

---

### Phase 3: Retrieval Pipeline
**Target**: ~700 lines  
**Status**: NOT STARTED  
**Start Time**: TBD  
**Completion Time**: TBD

**Directory**: `packages/core/src/retrieval/`

**Files to Create**:

| File | Lines | Purpose |
|------|-------|---------|
| `index.ts` | ~30 | Barrel exports |
| `types.ts` | ~100 | SearchOptions, SearchResult, Anchor, WeightConfig |
| `hybrid-search.ts` | ~150 | BM25 + Dense combination |
| `rrf.ts` | ~80 | Reciprocal Rank Fusion algorithm |
| `negative-filter.ts` | ~100 | Semantic exclusion, hard negatives |
| `reranker.ts` | ~120 | Cross-encoder interface (stub + implementations) |
| `anchor-refinement.ts` | ~100 | Positive/negative feedback refinement |
| `quality-gate.ts` | ~50 | Final filtering with diversity penalty |

**Reciprocal Rank Fusion**:
```typescript
// RRF score = sum(1 / (k + rank_i)) where k=60
function fuseResults(
  bm25Results: RankedResult[],
  denseResults: RankedResult[],
  k: number = 60
): FusedResult[];
```

**Negative Filtering**:
```typescript
interface NegativeFilter {
  // Exclude by embedding distance
  excludeSimilarTo(results: SearchResult[], excludeEmbeddings: number[][], threshold: number): SearchResult[];
  
  // Exclude by source type
  excludeSources(results: SearchResult[], sources: string[]): SearchResult[];
  
  // Exclude by pattern
  excludePatterns(results: SearchResult[], patterns: RegExp[]): SearchResult[];
}
```

**Anchor Refinement** (FIND → REFINE → HARVEST):
```typescript
interface AnchorRefinement {
  // User marks results as positive/negative
  addPositiveAnchor(embedding: number[]): void;
  addNegativeAnchor(embedding: number[]): void;
  
  // Apply anchors to rerank results
  refineResults(results: SearchResult[]): SearchResult[];
  
  // Clear session anchors
  clearAnchors(): void;
}
```

**Cross-Encoder Reranker** (interface + stub):
```typescript
interface CrossEncoderReranker {
  rerank(query: string, documents: string[]): Promise<RerankResult[]>;
}

// Implementations:
// - LocalCrossEncoder (transformers.js / Ollama)
// - CohereCrossEncoder (API)
// - JinaCrossEncoder (API)
// - StubCrossEncoder (pass-through for initial development)
```

**Length/Metadata Weighting**:
```typescript
interface WeightConfig {
  // Content weights
  minWords: number;
  preferredWordRange: [number, number];
  lengthPenaltyFactor: number;  // Log-scaled
  
  // Metadata boosts
  dateRecency: 'none' | 'slight' | 'strong';
  dateHalfLife: number;  // Days for exponential decay
  sourceWeights: Record<string, number>;  // e.g., { chatgpt: 1.2, facebook: 0.8 }
  
  // Quality gates
  minQualityScore?: number;
  requireEmbedding: boolean;
  diversityPenalty: number;  // Penalize too-similar results in top-k
}
```

---

### Phase 4: Pyramid Service
**Target**: ~350 lines  
**Status**: NOT STARTED  
**Start Time**: TBD  
**Completion Time**: TBD

**Directory**: `packages/core/src/pyramid/`

**Files to Create**:

| File | Lines | Purpose |
|------|-------|---------|
| `index.ts` | ~20 | Barrel exports |
| `types.ts` | ~80 | PyramidLevel, ApexNode, PyramidConfig |
| `builder.ts` | ~200 | L0→L1→Apex construction |
| `retriever.ts` | ~50 | Coarse-to-fine search |

**Pyramid Configuration**:
```typescript
const PYRAMID_CONFIG = {
  // Trigger pyramid for content > 1000 tokens
  MIN_TOKENS_FOR_PYRAMID: 1000,
  
  // L1 configuration
  CHUNKS_PER_SUMMARY: 5,      // Group 5-10 L0 chunks per L1
  TARGET_SUMMARY_WORDS: 150,  // Target words for L1 summaries
  
  // Apex configuration
  TARGET_APEX_WORDS: 300,     // Target words for apex synthesis
  
  // Compression tracking
  trackCompressionRatios: true,
};
```

**PyramidBuilder API**:
```typescript
interface PyramidBuilder {
  buildPyramid(
    content: string,
    threadId: string,
    options?: {
      summarizer?: (text: string, targetWords: number) => Promise<string>;
      embedder?: (texts: string[]) => Promise<number[][]>;
      onProgress?: (phase: string, progress: number) => void;
    }
  ): Promise<PyramidBuildResult>;
  
  getPyramidLevels(threadId: string): Promise<{
    l0: StoredNode[];
    l1: StoredNode[];
    apex: StoredNode | undefined;
  }>;
}
```

**Coarse-to-Fine Retrieval**:
```typescript
interface PyramidRetriever {
  // Search apex first, then drill down
  searchCoarseToFine(
    query: string,
    embedding: number[],
    options?: { maxL0Results?: number }
  ): Promise<SearchResult[]>;
}
```

---

### Phase 5: Clustering Service
**Target**: ~300 lines  
**Status**: NOT STARTED  
**Start Time**: TBD  
**Completion Time**: TBD

**Directory**: `packages/core/src/clustering/`

**Files to Create**:

| File | Lines | Purpose |
|------|-------|---------|
| `index.ts` | ~20 | Barrel exports |
| `types.ts` | ~80 | Cluster, ClusterResult, ClusterConfig |
| `clustering.ts` | ~200 | UMAP + HDBSCAN wrapper |

**Note**: UMAP and HDBSCAN may require:
- JavaScript implementations (`umap-js`, custom HDBSCAN)
- Or Python subprocess for heavy lifting
- Can stub initially and implement fully later

**Clustering API**:
```typescript
interface ClusteringService {
  // Cluster embeddings
  clusterEmbeddings(
    embeddings: number[][],
    nodeIds: string[],
    options?: ClusterConfig
  ): Promise<ClusterResult>;
  
  // Get cluster summary
  getClusterSummary(clusterId: number): Promise<ClusterSummary>;
  
  // Find similar clusters
  findSimilarClusters(embedding: number[]): Promise<ClusterMatch[]>;
}

interface ClusterResult {
  clusters: Cluster[];
  noise: string[];  // Node IDs not assigned to any cluster
  coordinates2D?: Array<[number, number]>;  // UMAP projection
}

interface Cluster {
  id: number;
  nodeIds: string[];
  centroid: number[];
  topTerms: string[];
  representativeNodeId: string;
  membershipScores?: Record<string, number>;  // Soft membership
}
```

---

### Phase 6: Integration & Wiring
**Target**: ~200 lines  
**Status**: NOT STARTED  
**Start Time**: TBD  
**Completion Time**: TBD

**Tasks**:

1. **Connect Adapters to ContentStore** (~50 lines)
   - Update `adapters/storage.ts` to delegate to `storage/content-store.ts`
   - Ensure `ImportedNode` → `StoredNode` conversion works

2. **Add MCP Tools** (~100 lines)
   - `import_archive` - Run adapter + store nodes
   - `search_content` - Unified hybrid search
   - `get_pyramid` - Retrieve pyramid levels
   - `cluster_content` - Run clustering on results

3. **Update Harvester Agent** (~50 lines)
   - Wire Harvester to use new retrieval pipeline
   - Add anchor refinement to search workflow

**Files to Modify**:
- `packages/core/src/adapters/storage.ts` - Deprecate InMemory, delegate to SQLite
- `packages/core/src/mcp/tools/definitions.ts` - Add new tool definitions
- `packages/core/src/mcp/handlers/` - Add new tool handlers
- `packages/core/src/houses/harvester.ts` - Wire to new retrieval

**Files to Delete**:
- `packages/core/src/ucg/index.ts` - Replace entirely with new system

---

## Dependencies

**Required (Phase 1)**:
```json
{
  "better-sqlite3": "^9.4.0",
  "sqlite-vec": "^0.1.0"
}
```

**Optional (Phase 3 - Cross-Encoder)**:
```json
{
  "@xenova/transformers": "^2.17.0"
}
```
Or use API: Cohere (`cohere-ai`), Jina (REST)

**Optional (Phase 5 - Clustering)**:
```json
{
  "umap-js": "^1.4.0"
}
```
HDBSCAN: Custom implementation or Python subprocess

---

## Configuration

**Database Path**: Configurable, default `~/.humanizer/content.db`

```typescript
interface StorageConfig {
  dbPath: string;  // Default: ~/.humanizer/content.db
  embeddingDimension: number;  // Default: 768 (nomic-embed-text)
  enableFTS: boolean;  // Default: true
  enableVec: boolean;  // Default: true
}
```

**Environment Variables**:
```bash
HUMANIZER_DB_PATH=~/.humanizer/content.db
HUMANIZER_EMBEDDING_DIM=768
HUMANIZER_EMBEDDING_MODEL=nomic-embed-text
```

---

## Testing Strategy

Each phase includes tests:

| Phase | Test File | Test Count |
|-------|-----------|------------|
| 1. Storage | `storage/content-store.test.ts` | ~40 |
| 2. Chunking | `chunking/chunker.test.ts` | ~25 |
| 3. Retrieval | `retrieval/hybrid-search.test.ts` | ~35 |
| 4. Pyramid | `pyramid/builder.test.ts` | ~20 |
| 5. Clustering | `clustering/clustering.test.ts` | ~15 |
| 6. Integration | `integration/full-pipeline.test.ts` | ~15 |

**Total**: ~150 new tests

---

## Progress Log

### Phase 1: Core Storage
| Timestamp (EST) | Event | Notes |
|-----------------|-------|-------|
| 2026-01-22 2:45 PM | Plan created | Initial documentation |
| 2026-01-22 3:15 PM | Dependencies installed | better-sqlite3, sqlite-vec, @types/better-sqlite3 |
| 2026-01-22 3:20 PM | vec0 tested | sqlite-vec v0.1.7-alpha.2 works on macOS |
| 2026-01-22 3:30 PM | storage/types.ts created | ~450 lines - StoredNode, QueryOptions, etc. |
| 2026-01-22 3:45 PM | storage/schema.ts created | ~300 lines - DDL, migrations, indexes |
| 2026-01-22 4:00 PM | storage/content-store.ts created | ~1050 lines - Full ContentStore class |
| 2026-01-22 4:10 PM | In-memory implementations removed | ucg/index.ts, adapters/storage.ts updated |
| 2026-01-22 4:25 PM | Build passes, tests pass | TypeScript compilation clean |
| 2026-01-22 4:30 PM | **PHASE 1 COMPLETE** | ~1,800 lines total |

### Phase 2: Chunking Service
| Timestamp (EST) | Event | Notes |
|-----------------|-------|-------|
| | | |

### Phase 3: Retrieval Pipeline
| Timestamp (EST) | Event | Notes |
|-----------------|-------|-------|
| | | |

### Phase 4: Pyramid Service
| Timestamp (EST) | Event | Notes |
|-----------------|-------|-------|
| | | |

### Phase 5: Clustering Service
| Timestamp (EST) | Event | Notes |
|-----------------|-------|-------|
| | | |

### Phase 6: Integration & Wiring
| Timestamp (EST) | Event | Notes |
|-----------------|-------|-------|
| | | |

---

## ChromaDB Memory References

All progress updates stored with tag: `ucg-storage-platinum-jan2026`

| Phase | Memory Hash | Description |
|-------|-------------|-------------|
| Plan | TBD | Initial plan creation |
| | | |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| sqlite-vec compatibility | Test early, have fallback to raw BLOB storage |
| UMAP/HDBSCAN performance | Stub initially, implement in Python subprocess if needed |
| Cross-encoder latency | Start with stub, add real implementation incrementally |
| Large content OOM | Streaming chunking, batch embedding generation |

---

## Success Criteria

Phase 1 Complete When:
- [x] SQLite database creates and migrates correctly
- [x] ContentStore CRUD operations work
- [x] vec0 embeddings store and search
- [x] FTS5 keyword search works
- [x] All tests pass

Phase 2 Complete When:
- [ ] Chunking produces correct boundaries
- [ ] Cascade fallback works
- [ ] Semantic boundary detection optional but functional
- [ ] All tests pass

Phase 3 Complete When:
- [ ] Hybrid search returns fused results
- [ ] RRF scoring correct
- [ ] Negative filtering excludes properly
- [ ] Anchor refinement improves results
- [ ] All tests pass

Phase 4 Complete When:
- [ ] Pyramid builds L0→L1→Apex
- [ ] Compression ratios tracked
- [ ] Coarse-to-fine retrieval works
- [ ] All tests pass

Phase 5 Complete When:
- [ ] Clustering groups semantically similar content
- [ ] Cluster summaries useful for selection
- [ ] All tests pass

Phase 6 Complete When:
- [ ] Adapters store to SQLite
- [ ] MCP tools work end-to-end
- [ ] Harvester agent uses new pipeline
- [ ] Old UCG code removed
- [ ] All tests pass

---

## Appendix: Related Documentation

- `AGENT_ARCHITECTURE.md` - Agent council structure
- `packages/core/src/adapters/types.ts` - ImportedNode definition
- ChromaDB tags: `humanizer-search`, `future-development`, `2025-research`

---

*Document maintained by Claude Code sessions. Update timestamps in EST.*
