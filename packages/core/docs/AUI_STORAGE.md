# AUI PostgreSQL Storage Architecture

**Version**: 1.0
**Schema Version**: 3
**Last Updated**: January 24, 2026
**Status**: Production

---

## Overview

The AUI (Agentic User Interface) PostgreSQL storage system provides persistent storage for user sessions, versioned buffers, books, cluster discovery results, and exportable artifacts. This enables data to survive server restarts and remain accessible weeks or months later.

### Design Principles

1. **Write-Through + Lazy Loading**: Mutations write immediately to PostgreSQL; reads lazy-load from DB when not found in memory cache.
2. **Git-Like Versioning**: Buffers support branches, commits (versions), and merge operations.
3. **TTL-Based Expiration**: Sessions, clusters, and artifacts have configurable expiration times with automatic cleanup.
4. **Vector Search Ready**: Cluster centroids stored as pgvector for similarity search.

---

## Entity Relationship Diagram

```
┌──────────────┐
│ aui_sessions │
└──────┬───────┘
       │ 1:N
       ▼
┌──────────────┐       ┌─────────────────────┐
│ aui_buffers  │──────▶│ aui_buffer_branches │
└──────┬───────┘  1:N  └─────────────────────┘
       │ 1:N                     │
       ▼                         │ head_version_id
┌──────────────────────┐         │
│ aui_buffer_versions  │◀────────┘
└──────────────────────┘

┌──────────────┐
│ aui_sessions │
└──────┬───────┘
       │ 1:N
       ▼
┌────────────┐
│ aui_tasks  │
└────────────┘

┌────────────┐       ┌───────────────────┐
│ aui_books  │──────▶│ aui_book_chapters │
└────────────┘  1:N  └───────────────────┘

┌──────────────┐ (standalone with TTL)
│ aui_clusters │
└──────────────┘

┌────────────────┐ (standalone with TTL)
│ aui_artifacts  │
└────────────────┘
```

---

## Schema Reference

### aui_sessions

Persists user session state including buffers, command history, and variables.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique session identifier |
| `user_id` | TEXT | | Optional user identifier |
| `name` | TEXT | | Human-readable session name |
| `active_buffer_name` | TEXT | | Currently focused buffer |
| `search_session_id` | TEXT | | Associated search session |
| `command_history` | TEXT[] | DEFAULT '{}' | Array of past commands |
| `variables` | JSONB | DEFAULT '{}' | Session variables map |
| `metadata` | JSONB | DEFAULT '{}' | Command/search/task counts |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |
| `expires_at` | TIMESTAMPTZ | | Optional expiration (default: 7 days) |
| `last_accessed_at` | TIMESTAMPTZ | DEFAULT NOW() | Last access timestamp |

**Indexes:**
- `idx_aui_sessions_user` - Lookup by user_id
- `idx_aui_sessions_updated` - Order by recent activity
- `idx_aui_sessions_expires` - TTL cleanup queries
- `idx_aui_sessions_last_accessed` - Access-based ordering

---

### aui_buffers

Buffer metadata for git-like versioned content collections.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Buffer identifier |
| `session_id` | UUID | FK → aui_sessions(id) ON DELETE CASCADE | Parent session |
| `name` | TEXT | NOT NULL | Buffer name (unique per session) |
| `current_branch` | TEXT | NOT NULL, DEFAULT 'main' | Active branch name |
| `working_content` | JSONB | DEFAULT '[]' | Uncommitted content array |
| `is_dirty` | BOOLEAN | NOT NULL, DEFAULT FALSE | Has uncommitted changes |
| `schema` | JSONB | | Optional content schema |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |

**Constraints:** UNIQUE(session_id, name)

**Indexes:**
- `idx_aui_buffers_session` - Lookup by session
- `idx_aui_buffers_name` - Lookup by session + name
- `idx_aui_buffers_updated` - Order by recent activity

---

### aui_buffer_branches

Git-like branches for buffer content.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Branch identifier |
| `buffer_id` | UUID | NOT NULL, FK → aui_buffers(id) ON DELETE CASCADE | Parent buffer |
| `name` | TEXT | NOT NULL | Branch name |
| `head_version_id` | TEXT | | Current head commit ID (7-char hash) |
| `parent_branch` | TEXT | | Branch forked from |
| `description` | TEXT | | Branch description |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |

**Constraints:** UNIQUE(buffer_id, name)

**Indexes:**
- `idx_aui_branches_buffer` - Lookup by buffer
- `idx_aui_branches_name` - Lookup by buffer + name

---

### aui_buffer_versions

Git-like commits (versions) for buffer content.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | 7-character hash (like git short SHA) |
| `buffer_id` | UUID | NOT NULL, FK → aui_buffers(id) ON DELETE CASCADE | Parent buffer |
| `content` | JSONB | NOT NULL, DEFAULT '[]' | Committed content snapshot |
| `message` | TEXT | NOT NULL | Commit message |
| `parent_id` | TEXT | | Parent version ID (null for first commit) |
| `tags` | TEXT[] | DEFAULT '{}' | Version tags (e.g., "v1.0") |
| `metadata` | JSONB | DEFAULT '{}' | Additional version metadata |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |

**Indexes:**
- `idx_aui_versions_buffer` - Lookup by buffer
- `idx_aui_versions_parent` - DAG traversal
- `idx_aui_versions_created` - Order by recency

---

### aui_tasks

Agent task execution history.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Task identifier |
| `session_id` | UUID | FK → aui_sessions(id) ON DELETE CASCADE | Parent session |
| `request` | TEXT | NOT NULL | Original user request |
| `status` | TEXT | NOT NULL, CHECK constraint | Task status (see below) |
| `steps` | JSONB | DEFAULT '[]' | Array of AgentStep objects |
| `plan` | JSONB | | Generated plan steps |
| `result` | JSONB | | Final result |
| `error` | TEXT | | Error message if failed |
| `priority` | INTEGER | NOT NULL, DEFAULT 3 | Task priority (1-5) |
| `total_tokens` | INTEGER | NOT NULL, DEFAULT 0 | Token usage |
| `total_cost_cents` | INTEGER | NOT NULL, DEFAULT 0 | Cost in cents |
| `started_at` | TIMESTAMPTZ | NOT NULL | Execution start time |
| `completed_at` | TIMESTAMPTZ | | Completion time |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |

**Status Values:** `pending`, `planning`, `executing`, `awaiting_input`, `paused`, `completed`, `failed`, `cancelled`

**Indexes:**
- `idx_aui_tasks_session` - Lookup by session
- `idx_aui_tasks_status` - Filter by status
- `idx_aui_tasks_created` - Order by recency

---

### aui_books

Book metadata for generated narratives.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Book identifier |
| `user_id` | TEXT | | Owner user ID |
| `title` | TEXT | NOT NULL | Book title |
| `description` | TEXT | | Book description |
| `arc` | JSONB | | NarrativeArc structure |
| `status` | TEXT | NOT NULL, DEFAULT 'draft', CHECK constraint | Book status |
| `source_cluster_id` | TEXT | | Source cluster if generated from cluster |
| `metadata` | JSONB | DEFAULT '{}' | Additional book metadata |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |

**Status Values:** `draft`, `published`, `archived`

**Indexes:**
- `idx_aui_books_user` - Lookup by user
- `idx_aui_books_status` - Filter by status
- `idx_aui_books_cluster` - Lookup by source cluster
- `idx_aui_books_created` - Order by recency

---

### aui_book_chapters

Chapter content for books.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Chapter identifier |
| `book_id` | UUID | NOT NULL, FK → aui_books(id) ON DELETE CASCADE | Parent book |
| `title` | TEXT | NOT NULL | Chapter title |
| `content` | TEXT | NOT NULL, DEFAULT '' | Chapter prose content |
| `position` | INTEGER | NOT NULL | Order position (0-indexed) |
| `word_count` | INTEGER | NOT NULL, DEFAULT 0 | Word count |
| `passage_ids` | TEXT[] | DEFAULT '{}' | Source passage IDs |
| `metadata` | JSONB | DEFAULT '{}' | Chapter metadata |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |

**Indexes:**
- `idx_aui_chapters_book` - Lookup by book
- `idx_aui_chapters_position` - Order chapters

---

### aui_clusters

Cached cluster discovery results with optional vector centroids.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Cluster identifier |
| `user_id` | TEXT | | Owner user ID |
| `label` | TEXT | NOT NULL | Cluster label/name |
| `description` | TEXT | | Cluster description |
| `passages` | JSONB | DEFAULT '[]' | Array of ClusterPassage objects |
| `total_passages` | INTEGER | NOT NULL, DEFAULT 0 | Total passage count |
| `coherence` | REAL | | Cluster coherence score (0-1) |
| `keywords` | TEXT[] | DEFAULT '{}' | Extracted keywords |
| `source_distribution` | JSONB | DEFAULT '{}' | Map of source → count |
| `date_range` | JSONB | | {earliest, latest} timestamps |
| `avg_word_count` | REAL | | Average passage word count |
| `centroid` | vector(768) | | Cluster centroid for similarity search |
| `discovery_options` | JSONB | | Options used for discovery |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| `expires_at` | TIMESTAMPTZ | DEFAULT NOW() + 30 days | TTL expiration |

**Indexes:**
- `idx_aui_clusters_user` - Lookup by user
- `idx_aui_clusters_expires` - TTL cleanup
- `idx_aui_clusters_created` - Order by recency
- `idx_aui_clusters_centroid` - HNSW vector index for similarity search

---

### aui_artifacts

Exportable files (markdown, PDF, EPUB, etc.) with download tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Artifact identifier |
| `user_id` | TEXT | | Owner user ID |
| `name` | TEXT | NOT NULL | Filename |
| `artifact_type` | TEXT | NOT NULL, CHECK constraint | File type |
| `content` | TEXT | | Text content (for text types) |
| `content_binary` | BYTEA | | Binary content (for binary types) |
| `mime_type` | TEXT | NOT NULL | MIME type |
| `size_bytes` | INTEGER | | File size |
| `source_type` | TEXT | | Source entity type (e.g., 'book') |
| `source_id` | TEXT | | Source entity ID |
| `metadata` | JSONB | DEFAULT '{}' | Additional metadata |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| `expires_at` | TIMESTAMPTZ | DEFAULT NOW() + 7 days | TTL expiration |
| `download_count` | INTEGER | NOT NULL, DEFAULT 0 | Download counter |
| `last_downloaded_at` | TIMESTAMPTZ | | Last download timestamp |

**Artifact Types:** `markdown`, `pdf`, `epub`, `html`, `json`, `zip`

**Indexes:**
- `idx_aui_artifacts_user` - Lookup by user
- `idx_aui_artifacts_type` - Filter by type
- `idx_aui_artifacts_source` - Lookup by source entity
- `idx_aui_artifacts_expires` - TTL cleanup
- `idx_aui_artifacts_created` - Order by recency

---

## Store API Reference

The `AuiPostgresStore` class provides CRUD operations for all entities.

### Initialization

```typescript
import { initAuiStore, getAuiStore } from '@humanizer/core/aui';
import { Pool } from 'pg';

// Initialize with existing pool
const pool = new Pool({ /* connection config */ });
const store = initAuiStore(pool, {
  defaultSessionTtl: 7 * 24 * 60 * 60 * 1000,  // 7 days
  defaultClusterTtl: 30 * 24 * 60 * 60 * 1000, // 30 days
  defaultArtifactTtl: 7 * 24 * 60 * 60 * 1000, // 7 days
});

// Later access via singleton
const store = getAuiStore();
```

### Session Operations

```typescript
// Create session
const session = await store.createSession({
  userId: 'user-123',
  name: 'My Session',
});

// Get session (returns undefined if expired)
const session = await store.getSession(sessionId);

// Update session
await store.updateSession(sessionId, {
  name: 'Updated Name',
  variables: { key: 'value' },
});

// Touch session (update timestamps)
await store.touchSession(sessionId);

// List sessions
const sessions = await store.listSessions({
  userId: 'user-123',
  limit: 20,
  offset: 0,
});

// Delete session
await store.deleteSession(sessionId);

// Cleanup expired
const count = await store.cleanupExpiredSessions();
```

### Buffer Operations

```typescript
// Create buffer
const buffer = await store.createBuffer(
  sessionId,
  'search-results',
  [{ id: 1, text: 'Result 1' }]
);

// Get buffer
const buffer = await store.getBuffer(bufferId);
const buffer = await store.getBufferByName(sessionId, 'search-results');

// Update buffer
await store.updateBuffer(bufferId, {
  workingContent: updatedItems,
  isDirty: true,
});

// List buffers
const buffers = await store.listBuffers(sessionId);
```

### Version Operations (Git-like)

```typescript
// Create version (commit)
const version = await store.createVersion(bufferId, {
  id: 'abc1234',  // 7-char hash
  content: currentItems,
  message: 'Add search results',
  parentId: previousVersionId,
  tags: ['checkpoint'],
});

// Get version
const version = await store.getVersion('abc1234');

// Get history
const history = await store.getVersionHistory(bufferId, 50);

// Prune old versions (keep last N)
await store.pruneVersions(bufferId, 100);
```

### Branch Operations

```typescript
// Create branch
const branch = await store.createBranch(bufferId, 'feature-x', {
  headVersionId: 'abc1234',
  parentBranch: 'main',
  description: 'Experimental changes',
});

// Get branch
const branch = await store.getBranch(bufferId, 'feature-x');

// Update branch head
await store.updateBranch(bufferId, 'feature-x', {
  headVersionId: 'def5678',
});

// List branches
const branches = await store.listBranches(bufferId);
```

### Book Operations

```typescript
// Create book with chapters
const book = await store.createBook({
  title: 'My Narrative',
  description: 'A collection of thoughts',
  arc: narrativeArc,
  chapters: [
    { id: chapterId, title: 'Chapter 1', content: '...', position: 0 },
  ],
  sourceClusterId: 'cluster-123',
});

// Get book with chapters
const book = await store.getBook(bookId);
console.log(book.chapters); // Includes all chapters

// Update book
await store.updateBook(bookId, { status: 'published' });

// List books
const books = await store.listBooks({ userId: 'user-123' });
```

### Cluster Operations

```typescript
// Save cluster (upsert)
const cluster = await store.saveCluster({
  id: 'cluster-123',
  label: 'AI Discussions',
  description: 'Conversations about AI',
  passages: clusterPassages,
  coherence: 0.85,
  keywords: ['AI', 'machine learning'],
  centroid: embeddingVector,
});

// Find similar clusters
const similar = await store.findSimilarClusters(
  queryVector,
  5  // limit
);

// Cleanup expired
const count = await store.cleanupExpiredClusters();
```

### Artifact Operations

```typescript
// Create artifact
const artifact = await store.createArtifact({
  userId: 'user-123',
  name: 'my-book.md',
  artifactType: 'markdown',
  content: markdownContent,
  mimeType: 'text/markdown',
  sourceType: 'book',
  sourceId: bookId,
});

// Export (download) artifact - increments download count
const artifact = await store.exportArtifact(artifactId);
console.log(artifact.content);
console.log(artifact.downloadCount); // Incremented

// List artifacts
const artifacts = await store.listArtifacts({ userId: 'user-123' });

// Cleanup expired
const count = await store.cleanupExpiredArtifacts();
```

### Cleanup

```typescript
// Run all cleanup tasks
const result = await store.runCleanup();
console.log(result);
// { sessions: 3, clusters: 1, artifacts: 5 }
```

---

## Service Integration

The `UnifiedAuiService` integrates with the store via write-through caching.

### Initialization with Storage

```typescript
import { initUnifiedAuiWithStorage } from '@humanizer/core/aui';

const service = await initUnifiedAuiWithStorage({
  host: 'localhost',
  port: 5432,
  database: 'humanizer_archive',
  user: 'postgres',
  maxConnections: 10,
  embeddingDimension: 768,
  enableVec: true,
});

// Session operations now persist automatically
const session = await service.createSession({ name: 'New Session' });

// Commits persist automatically
const version = await service.commit(sessionId, 'buffer-name', 'Save changes');
```

### Artifact Export

```typescript
// Export book to artifact
const artifactId = await service.exportBook(bookId, 'markdown');

// Download artifact
const artifact = await service.downloadArtifact(artifactId);

// List user artifacts
const artifacts = await service.listArtifacts(userId);
```

---

## Migration

The AUI schema is part of schema version 3. Migration runs automatically on `initContentStore()`:

```typescript
import { initContentStore } from '@humanizer/core/storage';

await initContentStore({
  host: 'localhost',
  port: 5432,
  database: 'humanizer_archive',
  user: 'postgres',
  embeddingDimension: 768,
  enableVec: true,
});
// Schema v3 migration creates all AUI tables if not present
```

### Manual Migration Verification

```sql
-- Check schema version
SELECT value FROM schema_meta WHERE key = 'schema_version';
-- Should return '3'

-- List AUI tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'aui_%'
ORDER BY table_name;

-- Count indexes
SELECT COUNT(*) FROM pg_indexes WHERE tablename LIKE 'aui_%';
-- Should return 41
```

---

## File Reference

| File | Purpose |
|------|---------|
| `src/storage/schema-aui.ts` | DDL definitions, migration function |
| `src/storage/aui-postgres-store.ts` | Store class with CRUD operations |
| `src/storage/schema-postgres.ts` | Schema versioning, v3 migration trigger |
| `src/aui/unified-aui-service.ts` | Service integration, write-through caching |
| `src/aui/index.ts` | Module exports |

---

## Testing

### Unit Tests

```bash
npx vitest run src/storage/aui-postgres-store.test.ts
```

### Integration Tests (requires PostgreSQL)

```bash
TEST_WITH_DB=1 npx vitest run src/storage/schema-migration.integration.test.ts
```

---

## Performance Considerations

1. **Index Coverage**: 41 indexes cover common query patterns
2. **HNSW Vector Index**: Cluster similarity uses approximate nearest neighbor
3. **TTL Cleanup**: Run `store.runCleanup()` periodically (e.g., daily cron)
4. **Session Cache**: In-memory cache reduces DB reads for active sessions
5. **JSONB for Flexibility**: Content columns use JSONB for schema-free storage

---

## Integrated Search Architecture

The AUI storage system integrates with the `AgenticSearchService` to provide unified search across both archive and books.

### Dual Database Architecture

```
┌─────────────────────────┐     ┌─────────────────────────┐
│   humanizer_archive     │     │   humanizer_books       │
│                         │     │                         │
│  content_nodes          │     │  book_nodes             │
│  embeddings             │     │  embeddings             │
│  (PostgresContentStore) │     │  (BooksPostgresStore)   │
└───────────┬─────────────┘     └───────────┬─────────────┘
            │                               │
            └───────────┬───────────────────┘
                        ▼
              ┌─────────────────────┐
              │    UnifiedStore     │
              │  (search across     │
              │   both databases)   │
              └─────────┬───────────┘
                        ▼
              ┌─────────────────────┐
              │ AgenticSearchService│
              │  - Hybrid search    │
              │  - RRF fusion       │
              │  - Quality gating   │
              └─────────────────────┘
```

### BooksPostgresStore

The `BooksPostgresStore` implements `BooksStoreInterface` for the `humanizer_books` database.

**Location:** `src/storage/books-postgres-store.ts`

**Key Methods:**

```typescript
// Search by embedding vector
searchByEmbedding(embedding: number[], options?: {
  limit?: number;
  threshold?: number;
  bookId?: string;
  hierarchyLevel?: number;
}): Promise<Array<{ node: BookNode; score: number }>>

// Search by keyword (full-text)
searchByKeyword(query: string, options?: {
  limit?: number;
  bookId?: string;
  hierarchyLevel?: number;
}): Promise<Array<{ node: BookNode; score: number }>>

// Create book node with content
createNode(options: CreateBookNodeOptions): Promise<BookNode>

// Update node embedding
updateNodeEmbedding(nodeId: string, embedding: number[], model: string, textHash: string): Promise<void>
```

### Initialization with Integrated Search

```typescript
import { initUnifiedAuiWithStorage } from '@humanizer/core/aui';

const service = await initUnifiedAuiWithStorage({
  // Archive database (humanizer_archive)
  storageConfig: {
    host: 'localhost',
    port: 5432,
    database: 'humanizer_archive',
    user: 'postgres',
    embeddingDimension: 768,
    enableVec: true,
  },

  // Books database (humanizer_books) - optional
  booksConfig: {
    database: 'humanizer_books',
    // inherits host, port, user from storageConfig
  },

  // Embedding function (enables integrated search)
  embedFn: async (text: string) => {
    // Your embedding implementation
    return embedding768d;
  },
});

// Now searches will query both archive AND books
const results = await service.search('consciousness');
```

### Book Content Indexing

When books are created, their content is automatically chunked and embedded into `book_nodes`:

```typescript
const book = await service.createBookFromCluster(clusterId, {
  title: 'My Book',
  embedFn: myEmbeddingFunction, // Enables indexing
});

// Creates:
// - L0 nodes (chapter content)
// - Apex node (book introduction/summary)
// - Embeddings for all nodes
```

### Search Modes

The integrated search supports:

| Mode | Description |
|------|-------------|
| `hybrid` | Dense + Sparse with RRF fusion (default) |
| `dense` | Embedding-only search |
| `sparse` | Keyword-only search |

### Search Targets

| Target | Searches |
|--------|----------|
| `archive` | Only humanizer_archive |
| `books` | Only humanizer_books |
| `all` | Both databases (default) |

---

## Future Enhancements

- [ ] Distributed caching (Redis) for multi-node deployments
- [ ] Streaming artifact downloads for large files
- [ ] Version pruning policies per buffer
- [ ] Cluster centroid updates on passage changes
- [x] Full-text search on book content (implemented via BooksPostgresStore)
- [x] Unified search across archive and books (implemented via UnifiedStore)

---

*End of Document*
