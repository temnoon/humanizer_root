# UCG + Books Integration Plan

**Created**: January 22, 2026  
**Status**: Phase 0 Complete - Ready for Implementation  
**Databases**: `humanizer_archive` (content), `humanizer_books` (authored works)

---

## Architecture Overview

### Two-Database Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                        HUMANIZER STORAGE                            │
├─────────────────────────────┬───────────────────────────────────────┤
│   humanizer_archive         │   humanizer_books                     │
│   (Sediment)                │   (Canon)                             │
├─────────────────────────────┼───────────────────────────────────────┤
│ • Imported content          │ • Authored works                      │
│ • ChatGPT, social, etc.     │ • Books, essays, collections          │
│ • High volume, append-only  │ • Lower volume, curated               │
│ • Search/retrieval focused  │ • Structure/coherence focused         │
│ • Raw material              │ • Proto-agents → NetworkNodes         │
└─────────────────────────────┴───────────────────────────────────────┘
```

### Why Separate Databases?

1. **Different Lifecycles**
   - Archives: imported once, indexed, searched
   - Books: authored, revised, graduated to autonomy

2. **Different Access Patterns**
   - Archives: semantic search, temporal queries
   - Books: structural navigation, coherent traversal

3. **Clean Graduation Path**
   - Books don't "live in" archives—they *draw from* them
   - NetworkNode graduation requires identity boundary

4. **Operational Isolation**
   - Archive can grow indefinitely
   - Books database stays lean, high-coherence

---

## The Graduation Model

### ContentNode → NetworkNode Journey

```
┌─────────────────────────────────────────────────────────────────────┐
│                        GRADUATION PATH                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Archive (humanizer_archive)                                        │
│    └─ Raw imported content (sediment)                              │
│         │                                                           │
│         ▼ extraction/curation                                       │
│                                                                     │
│  Book Studio (humanizer_books)                                      │
│    ├─ draft        → Being written, unstructured                   │
│    ├─ structured   → Has chapters/sections                         │
│    ├─ coherent     → Voice is consistent                           │
│    ├─ indexed      → Full embeddings + pyramid                     │
│    ├─ autonomous   → Ready for NetworkNode                         │
│    └─ networked    → Active as NetworkNode                         │
│         │                                                           │
│         ▼ federation                                                │
│                                                                     │
│  Network (federated)                                                │
│    └─ NetworkNode serves its own canon                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Graduation Status Definitions

| Status | Description | Requirements |
|--------|-------------|--------------|
| `draft` | Being written | Has title, at least one node |
| `structured` | Has chapters/sections | chapter_count > 0, hierarchy defined |
| `coherent` | Voice is consistent | coherence_score > 0.7 |
| `indexed` | Full embeddings + pyramid | All nodes embedded, L0→L1→apex complete |
| `autonomous` | Ready for NetworkNode | autonomy_readiness > 0.8, all metrics pass |
| `networked` | Active as NetworkNode | Has network_node_id, serves queries |

### Coherence Assessment

Books are assessed for graduation readiness via:

```typescript
interface GraduationMetrics {
  coherenceScore: number;      // 0-1, voice consistency across chunks
  completenessScore: number;   // 0-1, structural completeness
  autonomyReadiness: number;   // 0-1, ready for independent operation
}
```

**Coherence Score** measures:
- Voice consistency (persona embedding variance)
- Thematic unity (cluster cohesion)
- Structural integrity (chapter flow)

**Completeness Score** measures:
- All chapters have content
- Pyramid is complete (L0→L1→apex)
- Cross-references resolved

**Autonomy Readiness** measures:
- Can answer queries about its content
- Has clear identity/voice
- Boundary is well-defined

---

## Database Schemas

### humanizer_archive (Content/Sediment)

```sql
-- Main content storage
content_nodes (
  id, content_hash, uri, text, format, word_count,
  embedding, hierarchy_level, parent_node_id,
  source_type, source_adapter, import_job_id,
  tsv (FTS), created_at, imported_at
)

-- Relationships
content_links (source_id, target_id, link_type)

-- Import tracking
import_jobs (id, adapter_id, status, stats)
```

### humanizer_books (Canon/Authored)

```sql
-- Books (proto-agents)
books (
  id, slug, title, author_name,
  voice_profile, persona_embedding,
  graduation_status, coherence_score,
  network_node_id, network_endpoint
)

-- Structure
chapters (book_id, slug, title, position, depth)

-- Content
book_nodes (
  book_id, chapter_id, text, embedding,
  hierarchy_level, source_archive_id
)

-- Relationships
book_links (source_node_id, target_node_id, link_type)

-- Versioning
book_versions (book_id, version, version_type, content_snapshot)

-- Graduation tracking
graduation_events (book_id, from_status, to_status, metrics)
```

---

## UCG Phases - Integrated Roadmap

### Phase 0: PostgreSQL Foundation ✅ COMPLETE

**Archive Database** (`humanizer_archive`):
- [x] Schema created with pgvector
- [x] HNSW indexes configured
- [x] User `ed` with permissions
- [x] ContentStore async API

**Books Database** (`humanizer_books`):
- [x] Schema created with pgvector
- [x] Graduation model tables
- [x] Voice/persona embedding support
- [x] User `ed` with permissions

### Phase 1: Core Storage ✅ COMPLETE

- [x] StoredNode types (~450 lines)
- [x] PostgresContentStore (~1,050 lines)
- [x] Async CRUD operations
- [x] Embedding storage/retrieval

### Phase 2: Chunking Service 🔜 NEXT

**Purpose**: Break content into semantic chunks for embedding

**Implementation** (~400 lines):
```typescript
interface ChunkingService {
  // Strategies
  chunkByTokens(text: string, maxTokens: number): Chunk[];
  chunkBySentences(text: string, maxSentences: number): Chunk[];
  chunkByParagraphs(text: string): Chunk[];
  chunkBySemantic(text: string, model: string): Chunk[];  // LLM-assisted
  
  // Cascade (smart selection)
  chunkCascade(text: string, options: CascadeOptions): Chunk[];
}
```

**Cascade Strategies**:
1. **Paragraph** - Natural boundaries
2. **Sentence** - Fine-grained
3. **Token window** - Fixed size with overlap
4. **Semantic** - LLM-detected boundaries
5. **Hybrid** - Combine based on content type

**For Books**:
- Books use semantic chunking by default
- Chapters are natural chunk boundaries
- Sub-chapter chunks for long sections

### Phase 3: Retrieval Pipeline

**Purpose**: Multi-modal search with fusion

**Implementation** (~700 lines):
```typescript
interface RetrievalPipeline {
  // Search modes
  semanticSearch(query: string, options: SearchOptions): SearchResult[];
  keywordSearch(query: string, options: SearchOptions): SearchResult[];
  hybridSearch(query: string, options: HybridOptions): SearchResult[];
  
  // Fusion
  reciprocalRankFusion(results: SearchResult[][]): SearchResult[];
  
  // Reranking
  rerank(query: string, results: SearchResult[]): SearchResult[];
}
```

**For Books**:
- Scoped search within book/chapter
- Cross-book thematic search
- Archive provenance lookup

### Phase 4: Pyramid Service

**Purpose**: Hierarchical content summarization

**Implementation** (~350 lines):
```typescript
interface PyramidService {
  // Build hierarchy
  buildPyramid(nodeIds: string[], options: PyramidOptions): PyramidResult;
  
  // Levels
  generateL1Summaries(l0Chunks: StoredNode[]): StoredNode[];
  generateApex(l1Summaries: StoredNode[]): StoredNode;
  
  // Queries
  getApex(rootId: string): StoredNode;
  getL1Summaries(rootId: string): StoredNode[];
}
```

**Pyramid Structure**:
```
        ┌─────┐
        │Apex │  ← Book summary (1 node)
        └──┬──┘
     ┌─────┴─────┐
   ┌─┴─┐       ┌─┴─┐
   │L1 │  ...  │L1 │  ← Chapter summaries (N nodes)
   └─┬─┘       └─┬─┘
  ┌──┴──┐     ┌──┴──┐
  │L0│L0│     │L0│L0│  ← Chunks (M nodes)
  └──┴──┘     └──┴──┘
```

**For Books**:
- Each chapter gets L1 summary
- Book gets apex summary
- Summaries update on content change

### Phase 5: Clustering Service

**Purpose**: Discover thematic structure

**Implementation** (~300 lines):
```typescript
interface ClusteringService {
  // Clustering
  discoverClusters(embeddings: number[][], options: ClusterOptions): Cluster[];
  
  // Dimensionality reduction
  reduceUMAP(embeddings: number[][], dimensions: number): number[][];
  
  // Cluster operations
  labelCluster(cluster: Cluster): string;
  mergeCluster(clusterIds: string[]): Cluster;
}
```

**For Books**:
- Discover themes across chapters
- Find coherence issues (disparate clusters)
- Suggest structural reorganization

### Phase 6: Integration & Wiring

**Purpose**: Connect all services

**Implementation** (~200 lines):
- MCP tools for UCG operations
- Adapter → ContentStore flow
- Book creation/editing API
- Graduation assessment pipeline

---

## Book Studio Services

### BookStore (New)

```typescript
class BookStore {
  // CRUD
  async createBook(data: CreateBookData): Promise<Book>;
  async getBook(id: string): Promise<Book>;
  async updateBook(id: string, data: UpdateBookData): Promise<Book>;
  async deleteBook(id: string): Promise<void>;
  
  // Chapters
  async addChapter(bookId: string, data: ChapterData): Promise<Chapter>;
  async reorderChapters(bookId: string, order: string[]): Promise<void>;
  
  // Content
  async addContent(bookId: string, chapterId: string, content: string): Promise<BookNode>;
  async importFromArchive(bookId: string, archiveNodeIds: string[]): Promise<BookNode[]>;
  
  // Search
  async searchBook(bookId: string, query: string): Promise<SearchResult[]>;
  async searchAllBooks(query: string): Promise<SearchResult[]>;
  
  // Graduation
  async assessGraduation(bookId: string): Promise<GraduationMetrics>;
  async graduate(bookId: string, toStatus: GraduationStatus): Promise<GraduationEvent>;
}
```

### GraduationService (New)

```typescript
class GraduationService {
  // Assessment
  async assessCoherence(bookId: string): Promise<number>;
  async assessCompleteness(bookId: string): Promise<number>;
  async assessAutonomyReadiness(bookId: string): Promise<number>;
  
  // Graduation
  async canGraduate(bookId: string, toStatus: GraduationStatus): Promise<boolean>;
  async graduate(bookId: string, toStatus: GraduationStatus): Promise<GraduationEvent>;
  
  // NetworkNode
  async prepareNetworkNode(bookId: string): Promise<NetworkNodeConfig>;
  async deployNetworkNode(bookId: string, config: NetworkNodeConfig): Promise<string>;
}
```

---

## Implementation Order

### Immediate (This Week)

1. **Phase 2: Chunking Service**
   - Implement 5 chunking strategies
   - Add semantic boundary detection
   - Integrate with ContentStore

2. **BookStore Foundation**
   - Basic CRUD operations
   - Chapter management
   - Content import from archive

### Short-term (Next 2 Weeks)

3. **Phase 3: Retrieval Pipeline**
   - Hybrid search implementation
   - RRF fusion
   - Book-scoped search

4. **Phase 4: Pyramid Service**
   - L0→L1→apex generation
   - Automatic summary updates
   - Chapter/book summaries

### Medium-term (Month)

5. **Phase 5: Clustering**
   - UMAP + HDBSCAN
   - Theme discovery
   - Coherence analysis

6. **GraduationService**
   - Assessment metrics
   - Status transitions
   - Event logging

### Long-term (Quarter)

7. **NetworkNode Integration**
   - Federation protocol
   - Book-as-agent API
   - Cross-network queries

---

## Cross-Database Operations

### Archive → Book Import

```typescript
// Import archive content into a book
async function importToBook(
  archiveNodeIds: string[],
  bookId: string,
  chapterId?: string
): Promise<BookNode[]> {
  const archiveStore = getArchiveStore();
  const bookStore = getBookStore();
  
  const bookNodes: BookNode[] = [];
  
  for (const archiveId of archiveNodeIds) {
    const archiveNode = await archiveStore.getNode(archiveId);
    
    const bookNode = await bookStore.addNode({
      bookId,
      chapterId,
      text: archiveNode.text,
      format: archiveNode.format,
      sourceArchiveId: archiveId,  // Track provenance
      sourceType: 'extracted',
    });
    
    // Create provenance link
    await bookStore.createLink({
      sourceNodeId: bookNode.id,
      targetArchiveId: archiveId,
      linkType: 'provenance',
    });
    
    bookNodes.push(bookNode);
  }
  
  return bookNodes;
}
```

### Book → Archive Reference

```typescript
// Find archive content related to book content
async function findRelatedArchive(
  bookNodeId: string,
  limit: number = 10
): Promise<ArchiveNode[]> {
  const bookStore = getBookStore();
  const archiveStore = getArchiveStore();
  
  const bookNode = await bookStore.getNode(bookNodeId);
  const embedding = await bookStore.getEmbedding(bookNodeId);
  
  // Search archive by semantic similarity
  return archiveStore.searchByEmbedding(embedding, { limit });
}
```

---

## File Structure

```
packages/core/src/
├── storage/
│   ├── schema-postgres.ts      # Archive schema
│   ├── schema-books.ts         # Books schema ✅ NEW
│   ├── postgres-content-store.ts
│   ├── book-store.ts           # 🔜 NEW
│   └── types.ts
├── services/
│   ├── chunking/               # Phase 2
│   │   ├── index.ts
│   │   ├── strategies/
│   │   └── cascade.ts
│   ├── retrieval/              # Phase 3
│   │   ├── index.ts
│   │   ├── hybrid.ts
│   │   └── reranker.ts
│   ├── pyramid/                # Phase 4
│   │   ├── index.ts
│   │   └── summarizer.ts
│   ├── clustering/             # Phase 5
│   │   ├── index.ts
│   │   └── umap-hdbscan.ts
│   └── graduation/             # Book graduation
│       ├── index.ts
│       ├── assessment.ts
│       └── network-node.ts
└── ucg/
    └── index.ts                # Unified exports
```

---

## Testing Strategy

### Unit Tests
- Chunking strategies
- Search fusion algorithms
- Pyramid generation
- Graduation assessment

### Integration Tests
- Archive → Book import
- Cross-database queries
- Graduation workflow
- NetworkNode deployment

### E2E Tests
- Create book from archive content
- Full graduation pipeline
- Network queries to graduated book

---

## Success Metrics

### Phase Completion
- [ ] Chunking: 5 strategies working
- [ ] Retrieval: Hybrid search with <100ms latency
- [ ] Pyramid: Auto-summary on content change
- [ ] Clustering: Theme discovery accuracy >80%
- [ ] Graduation: Full pipeline working

### Book Studio
- [ ] Create book from scratch
- [ ] Import from archive
- [ ] Chapter management
- [ ] Coherence assessment
- [ ] NetworkNode graduation

---

## Next Steps

1. **Implement Phase 2 (Chunking)**
   - Start with token/sentence strategies
   - Add semantic detection
   - Integrate with both databases

2. **Build BookStore foundation**
   - Basic CRUD
   - Archive import
   - Embedding generation

3. **Connect to UI**
   - Book creation flow
   - Chapter editor
   - Archive browser with import

---

*Document maintained by UCG development team*
*Last updated: January 22, 2026*
