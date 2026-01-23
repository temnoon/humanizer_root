/**
 * PostgreSQL Schema for UCG Storage
 *
 * DDL for the Universal Content Graph using PostgreSQL + pgvector.
 * Includes:
 * - content_nodes: Main content storage with embedded vectors
 * - content_links: Bidirectional relationships between nodes
 * - import_jobs: Import tracking and audit
 *
 * Key differences from SQLite:
 * - Uses pgvector for HNSW-indexed vector search
 * - Uses generated tsvector column for FTS
 * - Uses JSONB for structured metadata
 * - Uses TIMESTAMPTZ for timestamps
 * - Uses UUID for primary keys
 */

import type { Pool, PoolClient } from 'pg';

// ═══════════════════════════════════════════════════════════════════
// SCHEMA VERSION
// ═══════════════════════════════════════════════════════════════════

/** Current schema version */
export const SCHEMA_VERSION = 1;

// ═══════════════════════════════════════════════════════════════════
// EXTENSION SETUP
// ═══════════════════════════════════════════════════════════════════

/**
 * Enable required PostgreSQL extensions
 */
export const ENABLE_EXTENSIONS = `
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
`;

// ═══════════════════════════════════════════════════════════════════
// TABLE DDL
// ═══════════════════════════════════════════════════════════════════

/**
 * Schema metadata table for version tracking
 */
export const CREATE_SCHEMA_META = `
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

/**
 * Main content_nodes table
 */
export function createContentNodesTable(dimension: number): string {
  return `
CREATE TABLE IF NOT EXISTS content_nodes (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash TEXT NOT NULL,
  uri TEXT UNIQUE NOT NULL,

  -- Content
  text TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('text', 'markdown', 'html', 'code', 'conversation')),
  word_count INTEGER NOT NULL DEFAULT 0,

  -- Vector embedding (integrated, not separate table)
  embedding vector(${dimension}),
  embedding_model TEXT,
  embedding_at TIMESTAMPTZ,
  embedding_text_hash TEXT,

  -- Hierarchy (chunking + pyramid)
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
  tags JSONB DEFAULT '[]'::jsonb,

  -- Media references (JSONB array)
  media_refs JSONB DEFAULT '[]'::jsonb,

  -- Source metadata (JSONB object)
  source_metadata JSONB,

  -- Full-text search (generated column)
  tsv tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', text), 'B')
  ) STORED,

  -- Timestamps (with timezone)
  source_created_at TIMESTAMPTZ,
  source_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;
}

/**
 * Links table for relationships between nodes
 */
export const CREATE_LINKS_TABLE = `
CREATE TABLE IF NOT EXISTS content_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES content_nodes(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES content_nodes(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

/**
 * Import jobs table for tracking imports
 */
export const CREATE_JOBS_TABLE = `
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
`;

// ═══════════════════════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════════════════════

/**
 * Create all indexes
 */
export const CREATE_INDEXES = `
-- Content nodes indexes
CREATE INDEX IF NOT EXISTS idx_content_nodes_hash ON content_nodes(content_hash);
CREATE INDEX IF NOT EXISTS idx_content_nodes_source ON content_nodes(source_type, source_original_id);
CREATE INDEX IF NOT EXISTS idx_content_nodes_source_type ON content_nodes(source_type);
CREATE INDEX IF NOT EXISTS idx_content_nodes_adapter ON content_nodes(source_adapter);
CREATE INDEX IF NOT EXISTS idx_content_nodes_parent ON content_nodes(parent_node_id);
CREATE INDEX IF NOT EXISTS idx_content_nodes_hierarchy ON content_nodes(hierarchy_level);
CREATE INDEX IF NOT EXISTS idx_content_nodes_thread ON content_nodes(thread_root_id);
CREATE INDEX IF NOT EXISTS idx_content_nodes_embedding_model ON content_nodes(embedding_model) WHERE embedding_model IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_nodes_embedding_hash ON content_nodes(embedding_text_hash);
CREATE INDEX IF NOT EXISTS idx_content_nodes_import_job ON content_nodes(import_job_id);
CREATE INDEX IF NOT EXISTS idx_content_nodes_created ON content_nodes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_nodes_source_created ON content_nodes(source_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_nodes_author_role ON content_nodes(author_role);

-- Full-text search index (GIN)
CREATE INDEX IF NOT EXISTS idx_content_nodes_tsv ON content_nodes USING gin(tsv);

-- Links indexes
CREATE INDEX IF NOT EXISTS idx_content_links_source ON content_links(source_id);
CREATE INDEX IF NOT EXISTS idx_content_links_target ON content_links(target_id);
CREATE INDEX IF NOT EXISTS idx_content_links_type ON content_links(link_type);

-- Jobs indexes
CREATE INDEX IF NOT EXISTS idx_import_jobs_adapter ON import_jobs(adapter_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);
`;

/**
 * Create HNSW vector index
 * Separate because it can take time and may fail if pgvector not enabled
 */
export const CREATE_VECTOR_INDEX = `
CREATE INDEX IF NOT EXISTS idx_content_nodes_embedding 
  ON content_nodes 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
`;

// ═══════════════════════════════════════════════════════════════════
// SCHEMA INITIALIZATION
// ═══════════════════════════════════════════════════════════════════

export interface PostgresStorageConfig {
  /** PostgreSQL host */
  host: string;
  /** PostgreSQL port */
  port: number;
  /** Database name */
  database: string;
  /** Database user */
  user: string;
  /** Database password */
  password?: string;
  /** Maximum pool connections */
  maxConnections: number;
  /** Idle timeout in ms */
  idleTimeoutMs: number;
  /** Connection timeout in ms */
  connectionTimeoutMs: number;
  /** Embedding vector dimension */
  embeddingDimension: number;
  /** Enable full-text search */
  enableFTS: boolean;
  /** Enable vector search */
  enableVec: boolean;
}

export const DEFAULT_POSTGRES_CONFIG: PostgresStorageConfig = {
  host: 'localhost',
  port: 5432,
  database: 'humanizer_archive',
  user: process.env.PGUSER || 'ed',
  maxConnections: 10,
  idleTimeoutMs: 30000,
  connectionTimeoutMs: 10000,
  embeddingDimension: 768,
  enableFTS: true,
  enableVec: true,
};

/**
 * Initialize the database schema
 */
export async function initializeSchema(
  pool: Pool,
  config: PostgresStorageConfig
): Promise<void> {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');

    // Enable extensions
    await client.query(ENABLE_EXTENSIONS);

    // Create schema meta table
    await client.query(CREATE_SCHEMA_META);

    // Check existing schema version
    const versionResult = await client.query(
      "SELECT value FROM schema_meta WHERE key = 'schema_version'"
    );
    const existingVersion = versionResult.rows.length > 0
      ? parseInt(versionResult.rows[0].value, 10)
      : 0;

    if (existingVersion < SCHEMA_VERSION) {
      // Run migrations
      await runMigrations(client, config, existingVersion);
    }

    // Commit transaction
    await client.query('COMMIT');
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Run schema migrations
 */
async function runMigrations(
  client: PoolClient,
  config: PostgresStorageConfig,
  fromVersion: number
): Promise<void> {
  // Fresh install or migration from version 0
  if (fromVersion < 1) {
    // Create content_nodes table with embedded vector column
    await client.query(createContentNodesTable(config.embeddingDimension));
    
    // Create other tables
    await client.query(CREATE_LINKS_TABLE);
    await client.query(CREATE_JOBS_TABLE);
    
    // Create standard indexes
    await client.query(CREATE_INDEXES);
    
    // Create vector index if enabled
    if (config.enableVec) {
      try {
        await client.query(CREATE_VECTOR_INDEX);
      } catch (error) {
        // Log but don't fail - vector extension might not be available
        console.warn('Could not create vector index:', error);
      }
    }

    // Set schema version
    await client.query(
      "INSERT INTO schema_meta (key, value) VALUES ('schema_version', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
      [SCHEMA_VERSION.toString()]
    );
  }

  // Future migrations would go here:
  // if (fromVersion < 2) { ... }
}

// ═══════════════════════════════════════════════════════════════════
// SQL QUERY TEMPLATES
// ═══════════════════════════════════════════════════════════════════

/**
 * Insert SQL for content_nodes
 */
export const INSERT_CONTENT_NODE = `
INSERT INTO content_nodes (
  id, content_hash, uri, text, format, word_count,
  embedding, embedding_model, embedding_at, embedding_text_hash,
  parent_node_id, position, chunk_index, chunk_start_offset, chunk_end_offset,
  hierarchy_level, thread_root_id,
  source_type, source_adapter, source_original_id, source_original_path, import_job_id,
  title, author, author_role, tags, media_refs, source_metadata,
  source_created_at, source_updated_at, created_at, imported_at
) VALUES (
  $1, $2, $3, $4, $5, $6,
  $7, $8, $9, $10,
  $11, $12, $13, $14, $15,
  $16, $17,
  $18, $19, $20, $21, $22,
  $23, $24, $25, $26, $27, $28,
  $29, $30, $31, $32
)
RETURNING *
`;

/**
 * Update embedding for a node
 */
export const UPDATE_EMBEDDING = `
UPDATE content_nodes 
SET embedding = $1, embedding_model = $2, embedding_at = $3, embedding_text_hash = $4
WHERE id = $5
RETURNING id
`;

/**
 * Insert SQL for content_links
 */
export const INSERT_LINK = `
INSERT INTO content_links (id, source_id, target_id, link_type, metadata, created_at)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *
`;

/**
 * Insert SQL for import_jobs
 */
export const INSERT_JOB = `
INSERT INTO import_jobs (id, adapter_id, source_path, status, started_at)
VALUES ($1, $2, $3, 'pending', $4)
RETURNING *
`;

/**
 * Vector similarity search using pgvector
 * Uses cosine distance (<=> operator)
 */
export const VECTOR_SEARCH = `
SELECT id, 1 - (embedding <=> $1::vector) as similarity
FROM content_nodes
WHERE embedding IS NOT NULL
ORDER BY embedding <=> $1::vector
LIMIT $2
`;

/**
 * Full-text search using tsvector
 */
export const FTS_SEARCH = `
SELECT id, ts_rank_cd(tsv, plainto_tsquery('english', $1)) as rank
FROM content_nodes
WHERE tsv @@ plainto_tsquery('english', $1)
ORDER BY rank DESC
LIMIT $2
`;

/**
 * Get node by ID
 */
export const GET_NODE_BY_ID = `
SELECT * FROM content_nodes WHERE id = $1
`;

/**
 * Get node by URI
 */
export const GET_NODE_BY_URI = `
SELECT * FROM content_nodes WHERE uri = $1
`;

/**
 * Get node by content hash
 */
export const GET_NODE_BY_HASH = `
SELECT * FROM content_nodes WHERE content_hash = $1
`;

/**
 * Delete node by ID
 */
export const DELETE_NODE = `
DELETE FROM content_nodes WHERE id = $1
`;

/**
 * Get links from a node
 */
export const GET_LINKS_FROM = `
SELECT * FROM content_links WHERE source_id = $1
`;

/**
 * Get links to a node
 */
export const GET_LINKS_TO = `
SELECT * FROM content_links WHERE target_id = $1
`;

/**
 * Get job by ID
 */
export const GET_JOB = `
SELECT * FROM import_jobs WHERE id = $1
`;

/**
 * Get all jobs with optional status filter
 */
export const GET_JOBS = `
SELECT * FROM import_jobs 
WHERE ($1::text IS NULL OR status = $1)
ORDER BY started_at DESC
`;

/**
 * Get nodes needing embeddings
 */
export const GET_NODES_NEEDING_EMBEDDINGS = `
SELECT * FROM content_nodes
WHERE embedding IS NULL
LIMIT $1
`;

/**
 * Get embedding for a node
 */
export const GET_EMBEDDING = `
SELECT embedding FROM content_nodes WHERE id = $1 AND embedding IS NOT NULL
`;

/**
 * Get storage statistics
 */
export const GET_STATS = `
SELECT 
  (SELECT COUNT(*) FROM content_nodes) as total_nodes,
  (SELECT COUNT(*) FROM content_nodes WHERE embedding IS NOT NULL) as nodes_with_embeddings,
  (SELECT COUNT(*) FROM content_links) as total_links,
  (SELECT COUNT(*) FROM import_jobs) as total_jobs
`;

export const GET_NODES_BY_SOURCE_TYPE = `
SELECT source_type, COUNT(*) as count 
FROM content_nodes 
GROUP BY source_type
`;

export const GET_NODES_BY_ADAPTER = `
SELECT source_adapter, COUNT(*) as count 
FROM content_nodes 
GROUP BY source_adapter
`;
