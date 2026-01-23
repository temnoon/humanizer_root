/**
 * UCG Storage Schema
 *
 * SQL DDL for the Universal Content Graph SQLite database.
 * Includes:
 * - content_nodes: Main content storage
 * - content_nodes_vec: vec0 virtual table for embeddings
 * - content_nodes_fts: FTS5 virtual table for full-text search
 * - content_links: Bidirectional relationships between nodes
 * - import_jobs: Import tracking and audit
 *
 * Schema versioning supports migrations for future updates.
 */

import type { StorageConfig } from './types.js';

// ═══════════════════════════════════════════════════════════════════
// SCHEMA VERSION
// ═══════════════════════════════════════════════════════════════════

/** Current schema version */
export const SCHEMA_VERSION = 1;

// ═══════════════════════════════════════════════════════════════════
// TABLE DDL
// ═══════════════════════════════════════════════════════════════════

/**
 * Main content_nodes table
 */
export const CREATE_CONTENT_NODES = `
CREATE TABLE IF NOT EXISTS content_nodes (
  -- Identity
  id TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  uri TEXT UNIQUE NOT NULL,

  -- Content
  text TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('text', 'markdown', 'html', 'code', 'conversation')),
  word_count INTEGER NOT NULL DEFAULT 0,

  -- Source tracking
  source_type TEXT NOT NULL,
  source_adapter TEXT NOT NULL,
  source_original_id TEXT,
  source_original_path TEXT,
  import_job_id TEXT,

  -- Hierarchy (chunking + pyramid)
  parent_node_id TEXT REFERENCES content_nodes(id) ON DELETE SET NULL,
  position INTEGER,
  chunk_index INTEGER,
  chunk_start_offset INTEGER,
  chunk_end_offset INTEGER,
  hierarchy_level INTEGER NOT NULL DEFAULT 0,
  thread_root_id TEXT,

  -- Embedding tracking
  embedding_model TEXT,
  embedding_at INTEGER,
  embedding_text_hash TEXT,

  -- Attribution
  title TEXT,
  author TEXT,
  author_role TEXT CHECK (author_role IN ('user', 'assistant', 'system', 'tool')),
  tags TEXT,  -- JSON array

  -- Media references (JSON array)
  media_refs TEXT,

  -- Source metadata (JSON object)
  source_metadata TEXT,

  -- Timestamps (epoch ms)
  source_created_at INTEGER,
  source_updated_at INTEGER,
  created_at INTEGER NOT NULL,
  imported_at INTEGER NOT NULL
);
`;

/**
 * vec0 virtual table for vector embeddings
 */
export function createVecTable(dimension: number): string {
  return `
CREATE VIRTUAL TABLE IF NOT EXISTS content_nodes_vec USING vec0(
  id TEXT PRIMARY KEY,
  content_hash TEXT,
  embedding float[${dimension}]
);
`;
}

/**
 * FTS5 virtual table for full-text search
 *
 * Note: We use content='' (contentless) mode because we manage
 * sync manually at the application layer for portability.
 */
export const CREATE_FTS_TABLE = `
CREATE VIRTUAL TABLE IF NOT EXISTS content_nodes_fts USING fts5(
  id,
  text,
  title,
  content=''
);
`;

/**
 * Links table for relationships between nodes
 */
export const CREATE_LINKS_TABLE = `
CREATE TABLE IF NOT EXISTS content_links (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES content_nodes(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES content_nodes(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL,
  metadata TEXT,  -- JSON
  created_at INTEGER NOT NULL
);
`;

/**
 * Import jobs table for tracking imports
 */
export const CREATE_JOBS_TABLE = `
CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY,
  adapter_id TEXT NOT NULL,
  source_path TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  nodes_imported INTEGER NOT NULL DEFAULT 0,
  nodes_skipped INTEGER NOT NULL DEFAULT 0,
  nodes_failed INTEGER NOT NULL DEFAULT 0,
  links_created INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER,
  completed_at INTEGER,
  error TEXT,
  stats TEXT  -- JSON
);
`;

/**
 * Schema metadata table for version tracking
 */
export const CREATE_SCHEMA_META = `
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

// ═══════════════════════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════════════════════

export const CREATE_INDEXES = `
-- Content nodes indexes
CREATE INDEX IF NOT EXISTS idx_content_nodes_hash ON content_nodes(content_hash);
CREATE INDEX IF NOT EXISTS idx_content_nodes_uri ON content_nodes(uri);
CREATE INDEX IF NOT EXISTS idx_content_nodes_source ON content_nodes(source_type, source_original_id);
CREATE INDEX IF NOT EXISTS idx_content_nodes_source_type ON content_nodes(source_type);
CREATE INDEX IF NOT EXISTS idx_content_nodes_adapter ON content_nodes(source_adapter);
CREATE INDEX IF NOT EXISTS idx_content_nodes_parent ON content_nodes(parent_node_id);
CREATE INDEX IF NOT EXISTS idx_content_nodes_hierarchy ON content_nodes(hierarchy_level);
CREATE INDEX IF NOT EXISTS idx_content_nodes_thread ON content_nodes(thread_root_id);
CREATE INDEX IF NOT EXISTS idx_content_nodes_embedding_model ON content_nodes(embedding_model);
CREATE INDEX IF NOT EXISTS idx_content_nodes_embedding_hash ON content_nodes(embedding_text_hash);
CREATE INDEX IF NOT EXISTS idx_content_nodes_import_job ON content_nodes(import_job_id);
CREATE INDEX IF NOT EXISTS idx_content_nodes_created ON content_nodes(created_at);
CREATE INDEX IF NOT EXISTS idx_content_nodes_source_created ON content_nodes(source_created_at);
CREATE INDEX IF NOT EXISTS idx_content_nodes_author_role ON content_nodes(author_role);

-- Links indexes
CREATE INDEX IF NOT EXISTS idx_content_links_source ON content_links(source_id);
CREATE INDEX IF NOT EXISTS idx_content_links_target ON content_links(target_id);
CREATE INDEX IF NOT EXISTS idx_content_links_type ON content_links(link_type);

-- Jobs indexes
CREATE INDEX IF NOT EXISTS idx_import_jobs_adapter ON import_jobs(adapter_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);
`;

// ═══════════════════════════════════════════════════════════════════
// SCHEMA INITIALIZATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Initialize the database schema
 */
/**
 * Minimal database interface for schema initialization
 * Compatible with better-sqlite3 Database type
 */
interface SchemaDatabase {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    run: (...args: unknown[]) => unknown;
    get: (...args: unknown[]) => unknown;
  };
}

export function initializeSchema(
  db: SchemaDatabase,
  config: StorageConfig
): void {
  // Enable WAL mode for better concurrency
  if (config.enableWAL) {
    db.exec('PRAGMA journal_mode = WAL;');
  }

  // Enable foreign keys
  db.exec('PRAGMA foreign_keys = ON;');

  // Create schema meta table
  db.exec(CREATE_SCHEMA_META);

  // Check existing schema version
  const versionRow = db.prepare(
    "SELECT value FROM schema_meta WHERE key = 'schema_version'"
  ).get() as { value: string } | undefined;

  const existingVersion = versionRow ? parseInt(versionRow.value, 10) : 0;

  if (existingVersion < SCHEMA_VERSION) {
    // Run migrations
    runMigrations(db, config, existingVersion);
  }
}

/**
 * Run schema migrations
 */
function runMigrations(
  db: SchemaDatabase,
  config: StorageConfig,
  fromVersion: number
): void {
  // Fresh install or migration from version 0
  if (fromVersion < 1) {
    // Create all tables
    db.exec(CREATE_CONTENT_NODES);

    if (config.enableVec) {
      db.exec(createVecTable(config.embeddingDimension));
    }

    if (config.enableFTS) {
      db.exec(CREATE_FTS_TABLE);
    }

    db.exec(CREATE_LINKS_TABLE);
    db.exec(CREATE_JOBS_TABLE);
    db.exec(CREATE_INDEXES);

    // Set schema version
    db.prepare(
      "INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', ?)"
    ).run(SCHEMA_VERSION.toString());
  }

  // Future migrations would go here:
  // if (fromVersion < 2) { ... }
}

// ═══════════════════════════════════════════════════════════════════
// SQL HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Column names for content_nodes table
 */
export const CONTENT_NODE_COLUMNS = [
  'id',
  'content_hash',
  'uri',
  'text',
  'format',
  'word_count',
  'source_type',
  'source_adapter',
  'source_original_id',
  'source_original_path',
  'import_job_id',
  'parent_node_id',
  'position',
  'chunk_index',
  'chunk_start_offset',
  'chunk_end_offset',
  'hierarchy_level',
  'thread_root_id',
  'embedding_model',
  'embedding_at',
  'embedding_text_hash',
  'title',
  'author',
  'author_role',
  'tags',
  'media_refs',
  'source_metadata',
  'source_created_at',
  'source_updated_at',
  'created_at',
  'imported_at',
] as const;

/**
 * Insert SQL for content_nodes
 */
export const INSERT_CONTENT_NODE = `
INSERT INTO content_nodes (
  id, content_hash, uri, text, format, word_count,
  source_type, source_adapter, source_original_id, source_original_path, import_job_id,
  parent_node_id, position, chunk_index, chunk_start_offset, chunk_end_offset,
  hierarchy_level, thread_root_id,
  embedding_model, embedding_at, embedding_text_hash,
  title, author, author_role, tags, media_refs, source_metadata,
  source_created_at, source_updated_at, created_at, imported_at
) VALUES (
  ?, ?, ?, ?, ?, ?,
  ?, ?, ?, ?, ?,
  ?, ?, ?, ?, ?,
  ?, ?,
  ?, ?, ?,
  ?, ?, ?, ?, ?, ?,
  ?, ?, ?, ?
)
`;

/**
 * Insert SQL for content_nodes_vec
 */
export const INSERT_EMBEDDING = `
INSERT INTO content_nodes_vec (id, content_hash, embedding)
VALUES (?, ?, ?)
`;

/**
 * Update SQL for embedding in vec table
 */
export const UPDATE_EMBEDDING = `
UPDATE content_nodes_vec SET embedding = ?, content_hash = ? WHERE id = ?
`;

/**
 * Insert SQL for FTS index
 */
export const INSERT_FTS = `
INSERT INTO content_nodes_fts (id, text, title)
VALUES (?, ?, ?)
`;

/**
 * Delete SQL for FTS index
 */
export const DELETE_FTS = `
DELETE FROM content_nodes_fts WHERE id = ?
`;

/**
 * Insert SQL for content_links
 */
export const INSERT_LINK = `
INSERT INTO content_links (id, source_id, target_id, link_type, metadata, created_at)
VALUES (?, ?, ?, ?, ?, ?)
`;

/**
 * Insert SQL for import_jobs
 */
export const INSERT_JOB = `
INSERT INTO import_jobs (id, adapter_id, source_path, status, started_at)
VALUES (?, ?, ?, 'pending', ?)
`;

/**
 * Vector search SQL
 */
export const VECTOR_SEARCH = `
SELECT id, distance
FROM content_nodes_vec
WHERE embedding MATCH ?
ORDER BY distance
LIMIT ?
`;

/**
 * FTS5 search SQL
 */
export const FTS_SEARCH = `
SELECT id, bm25(content_nodes_fts) as score
FROM content_nodes_fts
WHERE content_nodes_fts MATCH ?
ORDER BY score
LIMIT ?
`;
