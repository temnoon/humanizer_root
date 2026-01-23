# UCG PostgreSQL Migration Plan

**Project**: humanizer-platinum  
**Branch**: blissful-rhodes  
**Created**: January 22, 2026  
**Status**: PHASE 0 - Planning Complete

---

## Executive Summary

This document defines the migration from SQLite + sqlite-vec to PostgreSQL + pgvector for the UCG storage layer. This migration addresses security concerns with `sqlite-vec` (single maintainer, flagged during Shai-Hulud supply chain review) and enables the full humanizer vision:

1. **Local Studio** (Electron + Postgres.app) - Personal archive with privacy
2. **Post-Social Network** (Managed PostgreSQL) - Curator/Editor/MC Nodes
3. **Same schema scales** from laptop to federated network
4. **Books become nodes** in a networked content graph
5. **Mirror ρ** (subjective perspectives) preserved via multi-tenancy

---

## Current State Assessment

### What Exists (Phase 1 Complete - SQLite)

| File | Lines | Purpose |
|------|-------|---------|
| `packages/core/src/storage/types.ts` | ~450 | StoredNode, StoredLink, QueryOptions, ContentStoreStats |
| `packages/core/src/storage/schema.ts` | ~300 | SQLite DDL, migrations, indexes (vec0, FTS5) |
| `packages/core/src/storage/content-store.ts` | ~850 | ContentStore class with CRUD, search, embeddings |
| `packages/core/src/storage/index.ts` | ~40 | Barrel exports |

### Dependencies to Remove

```json
{
  "better-sqlite3": "^12.6.2",
  "sqlite-vec": "^0.1.7-alpha.2",
  "@types/better-sqlite3": "^7.6.13"
}
```

### Dependencies to Add

```json
{
  "pg": "^8.13.1",
  "pgvector": "^0.2.1",
  "@types/pg": "^8.11.10"
}
```

---

## Architecture Decisions

### Decision 1: Async API Migration

**Problem**: SQLite with better-sqlite3 is synchronous. PostgreSQL with `pg` is asynchronous.

**Decision**: Convert all ContentStore methods to async.

**Rationale**:
- PostgreSQL driver requires async
- Async is better for concurrent operations
- Adapters already use async patterns (ContentStoreAdapter wraps sync calls)

**Migration Path**:
- All ContentStore methods become `async` and return `Promise<T>`
- `ContentStoreAdapter` in `adapters/storage.ts` becomes a simple pass-through
- Consumers must await all calls (breaking change)

### Decision 2: Connection Pooling

**Problem**: How should ContentStore manage database connections?

**Decision**: Use a singleton Pool with lazy initialization.

**Configuration**:
```typescript
interface PostgresConfig {
  host: string;          // Default: 'localhost'
  port: number;          // Default: 5432
  database: string;      // Default: 'humanizer_archive'
  user: string;          // Default: current OS user
  password?: string;     // Default: none (trust auth for local)
  maxConnections: number; // Default: 10
  idleTimeoutMs: number;  // Default: 30000
}
```

**Pool Lifecycle**:
1. Create pool on first `initialize()` call
2. Reconnect automatically on connection errors
3. Close pool on `close()` or process exit
4. Health check via `SELECT 1` before operations

### Decision 3: HNSW Index Parameters

**Problem**: What parameters for pgvector HNSW index?

**Decision**: Use default parameters initially, configurable later.

```sql
CREATE INDEX idx_content_nodes_embedding 
  ON content_nodes 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

**Rationale**:
- `m = 16`: Default, good balance of recall vs memory
- `ef_construction = 64`: Default, good build time vs quality
- For 100K-1M vectors on local hardware, defaults are fine
- Can tune later based on actual usage patterns

### Decision 4: Full-Text Search

**Problem**: Replace SQLite FTS5 with PostgreSQL FTS.

**Decision**: Use generated `tsvector` column with GIN index.

```sql
-- Add tsvector column with automatic update
tsv tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', text), 'B')
) STORED;

-- GIN index for fast search
CREATE INDEX idx_content_nodes_tsv ON content_nodes USING gin(tsv);
```

**Benefits**:
- No manual FTS sync (generated column)
- Title gets higher weight ('A') than body ('B')
- Built-in stemming and stop words
- Optional: add `pg_trgm` for fuzzy matching later

### Decision 5: Foreign Key Behavior

**Problem**: SQLite has `ON DELETE SET NULL` for parent_node_id.

**Decision**: Change to `ON DELETE CASCADE` in PostgreSQL.

**Rationale**:
- Orphaned chunks are useless without their parent
- CASCADE ensures consistency
- Matches content_links behavior already

### Decision 6: Postgres.app Detection

**Problem**: How to detect if Postgres.app is installed and running?

**Decision**: Multi-layered detection:

```typescript
interface PostgresDetectionResult {
  installed: boolean;           // Postgres.app exists
  running: boolean;             // PostgreSQL server responding
  version?: string;             // Server version
  pgvectorAvailable: boolean;   // Extension can be created
  databaseExists: boolean;      // humanizer_archive exists
  schemaValid: boolean;         // Tables exist and match version
}
```

**Detection Steps**:
1. Check `/Applications/Postgres.app/Contents/Versions/*/bin/psql`
2. Try TCP connect to `localhost:5432`
3. Connect with `pg` and `SELECT version()`
4. Check `pg_extension` for vector availability
5. Check `pg_database` for humanizer_archive
6. Check `schema_meta` table for version

### Decision 7: Onboarding Flow

**Problem**: What happens on first run without PostgreSQL?

**Decision**: Graceful degradation with setup guidance.

**Flow**:
```
1. Check PostgreSQL status
   ├── Not installed → Show download link, instructions
   ├── Not running → Prompt to start Postgres.app
   ├── No database → Offer to create it
   ├── No pgvector → Offer to enable extension
   └── Ready → Continue to app
   
2. Auto-setup option:
   - "Set up PostgreSQL automatically" button
   - Creates database, extension, schema
   - Shows progress spinner
   - Reports success/failure
```

### Decision 8: Migration Path for Existing Data

**Problem**: Users may have SQLite data from Phase 1.

**Decision**: Provide optional migration script.

**Approach**:
- Detect SQLite database at `~/.humanizer/content.db`
- Offer one-time migration to PostgreSQL
- Stream data in batches (1000 nodes at a time)
- Verify content hashes match after migration
- Keep SQLite as backup until user confirms
- Delete SQLite after successful migration

---

## PostgreSQL Schema

### Main Tables

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Main content table
CREATE TABLE IF NOT EXISTS content_nodes (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash TEXT NOT NULL,
  uri TEXT UNIQUE NOT NULL,
  
  -- Content
  text TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('text', 'markdown', 'html', 'code', 'conversation')),
  word_count INTEGER NOT NULL DEFAULT 0,
  
  -- Vector embedding (768-dim for nomic-embed-text)
  embedding vector(768),
  embedding_model TEXT,
  embedding_at TIMESTAMPTZ,
  embedding_text_hash TEXT,
  
  -- Hierarchy (pyramid)
  parent_node_id UUID REFERENCES content_nodes(id) ON DELETE CASCADE,
  position INTEGER,
  chunk_index INTEGER,
  chunk_start_offset INTEGER,
  chunk_end_offset INTEGER,
  hierarchy_level INTEGER NOT NULL DEFAULT 0,
  thread_root_id UUID,
  
  -- Source tracking
  source_type TEXT NOT NULL,
  source_adapter TEXT NOT NULL,
  source_original_id TEXT,
  source_original_path TEXT,
  import_job_id UUID,
  
  -- Attribution
  title TEXT,
  author TEXT,
  author_role TEXT CHECK (author_role IN ('user', 'assistant', 'system', 'tool')),
  tags JSONB DEFAULT '[]',
  
  -- Media references
  media_refs JSONB DEFAULT '[]',
  
  -- Source metadata
  source_metadata JSONB,
  
  -- Full-text search (generated)
  tsv tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', text), 'B')
  ) STORED,
  
  -- Timestamps
  source_created_at TIMESTAMPTZ,
  source_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Links table
CREATE TABLE IF NOT EXISTS content_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES content_nodes(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES content_nodes(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Import jobs table
CREATE TABLE IF NOT EXISTS import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adapter_id TEXT NOT NULL,
  source_path TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  nodes_imported INTEGER NOT NULL DEFAULT 0,
  nodes_skipped INTEGER NOT NULL DEFAULT 0,
  nodes_failed INTEGER NOT NULL DEFAULT 0,
  links_created INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT,
  stats JSONB
);
```

### Indexes

```sql
-- Content nodes indexes
CREATE INDEX idx_content_nodes_hash ON content_nodes(content_hash);
CREATE INDEX idx_content_nodes_source ON content_nodes(source_type, source_original_id);
CREATE INDEX idx_content_nodes_source_type ON content_nodes(source_type);
CREATE INDEX idx_content_nodes_adapter ON content_nodes(source_adapter);
CREATE INDEX idx_content_nodes_parent ON content_nodes(parent_node_id);
CREATE INDEX idx_content_nodes_hierarchy ON content_nodes(hierarchy_level);
CREATE INDEX idx_content_nodes_thread ON content_nodes(thread_root_id);
CREATE INDEX idx_content_nodes_embedding_model ON content_nodes(embedding_model) WHERE embedding_model IS NOT NULL;
CREATE INDEX idx_content_nodes_embedding_hash ON content_nodes(embedding_text_hash);
CREATE INDEX idx_content_nodes_import_job ON content_nodes(import_job_id);
CREATE INDEX idx_content_nodes_created ON content_nodes(created_at DESC);
CREATE INDEX idx_content_nodes_source_created ON content_nodes(source_created_at DESC);
CREATE INDEX idx_content_nodes_author_role ON content_nodes(author_role);

-- Full-text search index
CREATE INDEX idx_content_nodes_tsv ON content_nodes USING gin(tsv);

-- Vector similarity search index (HNSW)
CREATE INDEX idx_content_nodes_embedding ON content_nodes 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Links indexes
CREATE INDEX idx_content_links_source ON content_links(source_id);
CREATE INDEX idx_content_links_target ON content_links(target_id);
CREATE INDEX idx_content_links_type ON content_links(link_type);

-- Jobs indexes
CREATE INDEX idx_import_jobs_adapter ON import_jobs(adapter_id);
CREATE INDEX idx_import_jobs_status ON import_jobs(status);
```

---

## API Changes

### ContentStore Interface (Async)

```typescript
interface ContentStore {
  // Lifecycle
  initialize(): Promise<void>;
  close(): Promise<void>;
  healthCheck(): Promise<boolean>;
  
  // Node operations (all async now)
  storeNode(node: ImportedNode, jobId?: string): Promise<StoredNode>;
  storeNodes(nodes: ImportedNode[], jobId?: string): Promise<BatchStoreResult>;
  getNode(id: string): Promise<StoredNode | undefined>;
  getNodeByUri(uri: string): Promise<StoredNode | undefined>;
  getNodeByHash(hash: string): Promise<StoredNode | undefined>;
  queryNodes(options: QueryOptions): Promise<QueryResult>;
  deleteNode(id: string): Promise<boolean>;
  deleteByJob(jobId: string): Promise<number>;
  
  // Embedding operations (all async now)
  storeEmbedding(nodeId: string, embedding: number[], model: string): Promise<void>;
  storeEmbeddings(items: EmbeddingItem[], model: string): Promise<BatchEmbeddingResult>;
  getEmbedding(nodeId: string): Promise<number[] | undefined>;
  isEmbeddingStale(nodeId: string): Promise<boolean>;
  getNodesNeedingEmbeddings(limit: number): Promise<StoredNode[]>;
  
  // Search operations (all async now)
  searchByEmbedding(embedding: number[], options?: EmbeddingSearchOptions): Promise<SearchResult[]>;
  searchByKeyword(query: string, options?: KeywordSearchOptions): Promise<SearchResult[]>;
  
  // Link operations (all async now)
  createLink(sourceId: string, link: ContentLink): Promise<StoredLink>;
  getLinksFrom(nodeId: string): Promise<StoredLink[]>;
  getLinksTo(nodeId: string): Promise<StoredLink[]>;
  
  // Job operations (all async now)
  createJob(adapterId: string, sourcePath: string): Promise<ImportJob>;
  updateJob(jobId: string, update: Partial<ImportJob>): Promise<void>;
  getJob(jobId: string): Promise<ImportJob | undefined>;
  getJobs(status?: ImportJobStatus): Promise<ImportJob[]>;
  
  // Stats (all async now)
  getStats(): Promise<ContentStoreStats>;
}
```

### Configuration Changes

```typescript
// Old SQLite config
interface StorageConfig {
  dbPath: string;
  embeddingDimension: number;
  enableFTS: boolean;
  enableVec: boolean;
  enableWAL: boolean;
}

// New PostgreSQL config
interface PostgresStorageConfig {
  // Connection
  host: string;              // Default: 'localhost'
  port: number;              // Default: 5432
  database: string;          // Default: 'humanizer_archive'
  user: string;              // Default: process.env.USER
  password?: string;         // Default: none (trust auth)
  
  // Pool settings
  maxConnections: number;    // Default: 10
  idleTimeoutMs: number;     // Default: 30000
  connectionTimeoutMs: number; // Default: 10000
  
  // Feature flags
  embeddingDimension: number; // Default: 768
  enableFTS: boolean;         // Default: true (tsvector)
  enableVec: boolean;         // Default: true (pgvector)
}
```

---

## Implementation Plan

### Phase 0: PostgreSQL Foundation

| Task | File | Lines | Notes |
|------|------|-------|-------|
| 1. Update package.json | `packages/core/package.json` | ~10 | Swap deps |
| 2. Create PostgreSQL schema | `packages/core/src/storage/schema-postgres.ts` | ~200 | DDL, indexes |
| 3. Create connection manager | `packages/core/src/storage/connection.ts` | ~150 | Pool, health check |
| 4. Implement PostgresContentStore | `packages/core/src/storage/postgres-content-store.ts` | ~900 | Full async impl |
| 5. Create Postgres detection | `packages/core/src/storage/postgres-detection.ts` | ~150 | Install/run checks |
| 6. Create onboarding utilities | `packages/core/src/storage/postgres-setup.ts` | ~200 | DB/extension setup |
| 7. Create migration script | `packages/core/src/storage/sqlite-migration.ts` | ~300 | SQLite → PG |
| 8. Update types | `packages/core/src/storage/types.ts` | ~50 | Config changes |
| 9. Update exports | `packages/core/src/storage/index.ts` | ~20 | New exports |
| 10. Update adapters | `packages/core/src/adapters/storage.ts` | ~50 | Async pass-through |

**Total**: ~2,030 lines (refactor ~850, new ~1,180)

### File Structure After Migration

```
packages/core/src/storage/
├── index.ts                    # Barrel exports
├── types.ts                    # Updated with PostgresStorageConfig
├── schema-postgres.ts          # PostgreSQL DDL
├── connection.ts               # Pool management
├── postgres-content-store.ts   # Main ContentStore implementation
├── postgres-detection.ts       # Postgres.app detection
├── postgres-setup.ts           # Onboarding/setup utilities
├── sqlite-migration.ts         # One-time migration script
└── content-store.ts            # DEPRECATED - keep for reference
```

---

## Testing Strategy

### Unit Tests

| Test File | Tests | Purpose |
|-----------|-------|---------|
| `postgres-content-store.test.ts` | ~40 | CRUD, batch ops, transactions |
| `connection.test.ts` | ~15 | Pool lifecycle, reconnection |
| `postgres-detection.test.ts` | ~10 | Detection logic |
| `sqlite-migration.test.ts` | ~10 | Migration verification |

### Integration Tests

Requires local PostgreSQL:

```bash
# Setup test database
createdb humanizer_test
psql humanizer_test -c "CREATE EXTENSION vector"

# Run tests
npm test -- --grep "postgres"
```

### Test Database Isolation

```typescript
// Use separate database for tests
const testConfig: PostgresStorageConfig = {
  host: 'localhost',
  port: 5432,
  database: 'humanizer_test',
  user: process.env.USER,
  maxConnections: 5,
  // ...
};

// Clean up after each test
afterEach(async () => {
  await pool.query('TRUNCATE content_nodes, content_links, import_jobs CASCADE');
});
```

---

## Rollout Strategy

### Phase 0a: Development (This PR)

1. Implement PostgresContentStore
2. Test locally against Postgres.app
3. Verify all existing adapter tests pass
4. Document Postgres.app setup

### Phase 0b: Alpha Testing

1. Deploy to internal testers
2. Gather feedback on onboarding flow
3. Identify edge cases
4. Refine detection logic

### Phase 0c: Migration Support

1. Finalize SQLite migration script
2. Test with real user data (anonymized)
3. Add rollback capability
4. Document migration process

### Phase 1+: Continue UCG Implementation

After PostgreSQL foundation is stable:
- Phase 2: Chunking Service
- Phase 3: Retrieval Pipeline
- Phase 4: Pyramid Service
- Phase 5: Clustering Service
- Phase 6: Integration

---

## Answers to Open Questions

### Architecture Questions

**Q1: Connection Management**
> Should ContentStore use a singleton Pool?

**A**: Yes, singleton Pool created on `initialize()`, closed on `close()` or process exit. Pool handles reconnection automatically via `pg` driver.

**Q2: Schema Initialization**
> How should first-run setup work?

**A**: Multi-step detection → setup flow:
1. Detect Postgres.app status
2. Prompt user if not installed/running
3. Auto-create database if missing
4. Enable pgvector extension
5. Run migrations idempotently

**Q3: Async vs Sync API**
> The current ContentStore has sync methods.

**A**: All methods become async. Breaking change, but adapters already async (ContentStoreAdapter). Update consumers to await.

**Q4: HNSW Index Tuning**
> What values for m and ef_construction?

**A**: Use defaults (m=16, ef_construction=64). Tune later based on actual data volume and query patterns.

**Q5: Full-Text Search**
> PostgreSQL options?

**A**: Generated `tsvector` column with GIN index. Title weighted 'A', body weighted 'B'. Can add `pg_trgm` for fuzzy later.

### Onboarding Questions

**Q6: Postgres.app Detection**
> How to detect installation status?

**A**: Check filesystem for app bundle, TCP connect to 5432, query server version, check extensions.

**Q7: Setup Automation**
> Should we auto-create?

**A**: Yes, with user consent. "Set up PostgreSQL" button runs CREATE DATABASE + CREATE EXTENSION + schema.

**Q8: Fallback Behavior**
> If PostgreSQL unavailable?

**A**: Show blocking error with setup instructions. No read-only mode (too complex for initial release).

### Migration Questions

**Q9: Existing SQLite Data**
> Migration path?

**A**: Optional one-time migration script. Detect SQLite, offer migration, stream in batches, verify hashes, keep backup.

**Q10: Backward Compatibility**
> Keep same interface?

**A**: Interface stays same, methods become async. ContentStoreAdapter becomes pass-through.

### Future-Proofing Questions

**Q11: Multi-Database Topology**
> Local vs cloud?

**A**: Same ContentStore interface, different config. Factory pattern selects backend based on config.

**Q12: Mirror ρ Implementation**
> Subjective views?

**A**: Add `user_id` column to content_nodes. Filter via `WHERE user_id = ?` or `user_id IS NULL` (shared).

**Q13: Federation Prep**
> Node-to-node sync?

**A**: UUID primary keys (already have). Add `updated_at` for conflict resolution. Schema supports logical replication.

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Postgres.app not installed | Clear installation instructions, link to download |
| pgvector extension missing | Auto-enable if superuser, guide if not |
| Connection failures | Retry with exponential backoff, clear error messages |
| Migration data loss | Verify hashes, keep SQLite backup until confirmed |
| Performance regression | Benchmark before/after, optimize queries |
| Breaking API changes | Document clearly, provide migration guide |

---

## Success Criteria

Phase 0 is complete when:

- [ ] PostgreSQL schema creates correctly via `ContentStore.initialize()`
- [ ] All existing ContentStore methods work with PostgreSQL (async)
- [ ] HNSW vector search returns results with cosine similarity
- [ ] Full-text search works via tsvector
- [ ] Electron app detects Postgres.app status
- [ ] First-run onboarding creates database and extension
- [ ] Existing adapter tests pass against new backend
- [ ] SQLite migration script works correctly
- [ ] Documentation updated with Postgres.app setup instructions

---

## References

- [pgvector documentation](https://github.com/pgvector/pgvector)
- [Postgres.app](https://postgresapp.com/)
- [node-postgres (pg)](https://node-postgres.com/)
- [pgvector npm](https://github.com/pgvector/pgvector-node)
- ChromaDB: `ucg-postgres-migration`, `phase-0`, `jan-2026`

---

*Document created: January 22, 2026*  
*Last updated: January 22, 2026*  
*Status: Planning Complete - Ready for Implementation*
