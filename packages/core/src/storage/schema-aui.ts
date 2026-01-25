/**
 * PostgreSQL Schema for AUI Storage
 *
 * DDL for persisting AUI sessions, buffers, books, clusters, and artifacts
 * so they survive server restarts and can be accessed weeks/months later.
 *
 * @module @humanizer/core/storage/schema-aui
 */

import type { PoolClient } from 'pg';

// ═══════════════════════════════════════════════════════════════════
// AUI SESSION TABLE
// ═══════════════════════════════════════════════════════════════════

/**
 * Sessions table - persists user session state
 */
export const CREATE_AUI_SESSIONS_TABLE = `
CREATE TABLE IF NOT EXISTS aui_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  name TEXT,
  active_buffer_name TEXT,
  search_session_id TEXT,
  command_history TEXT[] DEFAULT '{}',
  variables JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ DEFAULT NOW()
);
`;

// ═══════════════════════════════════════════════════════════════════
// VERSIONED BUFFER TABLES
// ═══════════════════════════════════════════════════════════════════

/**
 * Buffers table - buffer metadata
 */
export const CREATE_AUI_BUFFERS_TABLE = `
CREATE TABLE IF NOT EXISTS aui_buffers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES aui_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  current_branch TEXT NOT NULL DEFAULT 'main',
  working_content JSONB DEFAULT '[]',
  is_dirty BOOLEAN NOT NULL DEFAULT FALSE,
  schema JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, name)
);
`;

/**
 * Buffer branches table - git-like branches
 */
export const CREATE_AUI_BUFFER_BRANCHES_TABLE = `
CREATE TABLE IF NOT EXISTS aui_buffer_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buffer_id UUID NOT NULL REFERENCES aui_buffers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  head_version_id TEXT,
  parent_branch TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(buffer_id, name)
);
`;

/**
 * Buffer versions table - git-like commits
 */
export const CREATE_AUI_BUFFER_VERSIONS_TABLE = `
CREATE TABLE IF NOT EXISTS aui_buffer_versions (
  id TEXT PRIMARY KEY,
  buffer_id UUID NOT NULL REFERENCES aui_buffers(id) ON DELETE CASCADE,
  content JSONB NOT NULL DEFAULT '[]',
  message TEXT NOT NULL,
  parent_id TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

// ═══════════════════════════════════════════════════════════════════
// AGENT TASK TABLE
// ═══════════════════════════════════════════════════════════════════

/**
 * Tasks table - agent task history
 */
export const CREATE_AUI_TASKS_TABLE = `
CREATE TABLE IF NOT EXISTS aui_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES aui_sessions(id) ON DELETE CASCADE,
  request TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'planning', 'executing', 'awaiting_input', 'paused', 'completed', 'failed', 'cancelled')),
  steps JSONB DEFAULT '[]',
  plan JSONB,
  result JSONB,
  error TEXT,
  priority INTEGER NOT NULL DEFAULT 3,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  total_cost_cents INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

// ═══════════════════════════════════════════════════════════════════
// BOOK TABLES
// ═══════════════════════════════════════════════════════════════════

/**
 * Books table - book metadata
 */
export const CREATE_AUI_BOOKS_TABLE = `
CREATE TABLE IF NOT EXISTS aui_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  arc JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  source_cluster_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

/**
 * Book chapters table - chapter content
 */
export const CREATE_AUI_BOOK_CHAPTERS_TABLE = `
CREATE TABLE IF NOT EXISTS aui_book_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES aui_books(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  passage_ids TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

// ═══════════════════════════════════════════════════════════════════
// CLUSTER CACHE TABLE
// ═══════════════════════════════════════════════════════════════════

/**
 * Clusters table - cached cluster discovery results
 */
export function createAuiClustersTable(dimension: number): string {
  return `
CREATE TABLE IF NOT EXISTS aui_clusters (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  label TEXT NOT NULL,
  description TEXT,
  passages JSONB DEFAULT '[]',
  total_passages INTEGER NOT NULL DEFAULT 0,
  coherence REAL,
  keywords TEXT[] DEFAULT '{}',
  source_distribution JSONB DEFAULT '{}',
  date_range JSONB,
  avg_word_count REAL,
  centroid vector(${dimension}),
  discovery_options JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);
`;
}

// ═══════════════════════════════════════════════════════════════════
// PERSONA PROFILE TABLE
// ═══════════════════════════════════════════════════════════════════

/**
 * Persona profiles table - stores voice and style configurations for books
 *
 * Used for persona-consistent book creation pipeline:
 * - Voice traits and tone markers for voice transformation
 * - Style guide with forbidden/preferred phrases
 * - Reference examples for voice fingerprinting
 */
export const CREATE_AUI_PERSONA_PROFILES_TABLE = `
CREATE TABLE IF NOT EXISTS aui_persona_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  voice_traits TEXT[] DEFAULT '{}',
  tone_markers TEXT[] DEFAULT '{}',
  formality_min REAL DEFAULT 0.3,
  formality_max REAL DEFAULT 0.7,
  style_guide JSONB DEFAULT '{}',
  reference_examples TEXT[] DEFAULT '{}',
  voice_fingerprint JSONB,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

// ═══════════════════════════════════════════════════════════════════
// STYLE PROFILE TABLE
// ═══════════════════════════════════════════════════════════════════

/**
 * Style profiles table - context-specific writing styles for personas
 *
 * Enables persona -> many styles relationship:
 * - One persona can have multiple styles (Academic, Casual, Newsletter, etc.)
 * - Each style has its own forbidden phrases, formality level, etc.
 * - Supports context-based style selection
 */
export const CREATE_AUI_STYLE_PROFILES_TABLE = `
CREATE TABLE IF NOT EXISTS aui_style_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES aui_persona_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  context TEXT,
  forbidden_phrases TEXT[] DEFAULT '{}',
  preferred_patterns TEXT[] DEFAULT '{}',
  sentence_variety TEXT DEFAULT 'medium' CHECK (sentence_variety IN ('low', 'medium', 'high')),
  paragraph_style TEXT DEFAULT 'medium' CHECK (paragraph_style IN ('short', 'medium', 'long')),
  use_contractions BOOLEAN DEFAULT TRUE,
  use_rhetorical_questions BOOLEAN DEFAULT FALSE,
  formality_level REAL DEFAULT 0.5 CHECK (formality_level >= 0 AND formality_level <= 1),
  is_default BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(persona_id, name)
);
`;

// ═══════════════════════════════════════════════════════════════════
// ARTIFACT TABLE
// ═══════════════════════════════════════════════════════════════════

/**
 * Artifacts table - exportable files
 */
export const CREATE_AUI_ARTIFACTS_TABLE = `
CREATE TABLE IF NOT EXISTS aui_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  name TEXT NOT NULL,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('markdown', 'pdf', 'epub', 'html', 'json', 'zip')),
  content TEXT,
  content_binary BYTEA,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER,
  source_type TEXT,
  source_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  download_count INTEGER NOT NULL DEFAULT 0,
  last_downloaded_at TIMESTAMPTZ
);
`;

// ═══════════════════════════════════════════════════════════════════
// CONTENT BUFFER TABLES (API-First Buffer System)
// ═══════════════════════════════════════════════════════════════════

/**
 * Content buffers table - immutable content wrappers with provenance
 *
 * Each transformation creates a NEW buffer; buffers are never mutated.
 * Content is addressed by SHA-256 hash for deduplication.
 */
export function createAuiContentBuffersTable(dimension: number): string {
  return `
CREATE TABLE IF NOT EXISTS aui_content_buffers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash TEXT NOT NULL,
  text TEXT NOT NULL,
  word_count INTEGER NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('text', 'markdown', 'html', 'code')),
  state TEXT NOT NULL CHECK (state IN ('transient', 'staged', 'committed', 'archived')),
  origin JSONB NOT NULL,
  quality_metrics JSONB,
  embedding vector(${dimension}),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for content deduplication
CREATE INDEX IF NOT EXISTS idx_aui_content_buffers_hash ON aui_content_buffers(content_hash);
`;
}

/**
 * Provenance chains table - linked list of transformations
 *
 * Tracks the full history of a buffer through all operations.
 */
export const CREATE_AUI_PROVENANCE_CHAINS_TABLE = `
CREATE TABLE IF NOT EXISTS aui_provenance_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  root_buffer_id UUID NOT NULL,
  current_buffer_id UUID NOT NULL REFERENCES aui_content_buffers(id) ON DELETE SET NULL,
  branch_name TEXT NOT NULL DEFAULT 'main',
  branch_description TEXT,
  is_main BOOLEAN DEFAULT TRUE,
  parent_chain_id UUID REFERENCES aui_provenance_chains(id) ON DELETE SET NULL,
  child_chain_ids UUID[] DEFAULT '{}',
  transformation_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

/**
 * Buffer operations table - records what happened to buffers
 *
 * Each operation is an immutable record in the provenance chain.
 */
export const CREATE_AUI_BUFFER_OPERATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS aui_buffer_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id UUID NOT NULL REFERENCES aui_provenance_chains(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  operation_type TEXT NOT NULL,
  performer JSONB NOT NULL,
  parameters JSONB DEFAULT '{}',
  before_hash TEXT NOT NULL,
  after_hash TEXT NOT NULL,
  delta_hash TEXT,
  quality_impact JSONB,
  description TEXT NOT NULL,
  duration_ms INTEGER,
  cost_cents INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(chain_id, sequence_number)
);
`;

// ═══════════════════════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════════════════════

/**
 * Create all AUI indexes
 */
export const CREATE_AUI_INDEXES = `
-- Sessions indexes
CREATE INDEX IF NOT EXISTS idx_aui_sessions_user ON aui_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_aui_sessions_updated ON aui_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_aui_sessions_expires ON aui_sessions(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_aui_sessions_last_accessed ON aui_sessions(last_accessed_at DESC);

-- Buffers indexes
CREATE INDEX IF NOT EXISTS idx_aui_buffers_session ON aui_buffers(session_id);
CREATE INDEX IF NOT EXISTS idx_aui_buffers_name ON aui_buffers(session_id, name);
CREATE INDEX IF NOT EXISTS idx_aui_buffers_updated ON aui_buffers(updated_at DESC);

-- Branches indexes
CREATE INDEX IF NOT EXISTS idx_aui_branches_buffer ON aui_buffer_branches(buffer_id);
CREATE INDEX IF NOT EXISTS idx_aui_branches_name ON aui_buffer_branches(buffer_id, name);

-- Versions indexes
CREATE INDEX IF NOT EXISTS idx_aui_versions_buffer ON aui_buffer_versions(buffer_id);
CREATE INDEX IF NOT EXISTS idx_aui_versions_parent ON aui_buffer_versions(parent_id);
CREATE INDEX IF NOT EXISTS idx_aui_versions_created ON aui_buffer_versions(created_at DESC);

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_aui_tasks_session ON aui_tasks(session_id);
CREATE INDEX IF NOT EXISTS idx_aui_tasks_status ON aui_tasks(status);
CREATE INDEX IF NOT EXISTS idx_aui_tasks_created ON aui_tasks(created_at DESC);

-- Books indexes
CREATE INDEX IF NOT EXISTS idx_aui_books_user ON aui_books(user_id);
CREATE INDEX IF NOT EXISTS idx_aui_books_status ON aui_books(status);
CREATE INDEX IF NOT EXISTS idx_aui_books_cluster ON aui_books(source_cluster_id);
CREATE INDEX IF NOT EXISTS idx_aui_books_created ON aui_books(created_at DESC);

-- Chapters indexes
CREATE INDEX IF NOT EXISTS idx_aui_chapters_book ON aui_book_chapters(book_id);
CREATE INDEX IF NOT EXISTS idx_aui_chapters_position ON aui_book_chapters(book_id, position);

-- Clusters indexes
CREATE INDEX IF NOT EXISTS idx_aui_clusters_user ON aui_clusters(user_id);
CREATE INDEX IF NOT EXISTS idx_aui_clusters_expires ON aui_clusters(expires_at);
CREATE INDEX IF NOT EXISTS idx_aui_clusters_created ON aui_clusters(created_at DESC);

-- Artifacts indexes
CREATE INDEX IF NOT EXISTS idx_aui_artifacts_user ON aui_artifacts(user_id);
CREATE INDEX IF NOT EXISTS idx_aui_artifacts_type ON aui_artifacts(artifact_type);
CREATE INDEX IF NOT EXISTS idx_aui_artifacts_source ON aui_artifacts(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_aui_artifacts_expires ON aui_artifacts(expires_at);
CREATE INDEX IF NOT EXISTS idx_aui_artifacts_created ON aui_artifacts(created_at DESC);

-- Persona profiles indexes
CREATE INDEX IF NOT EXISTS idx_aui_personas_user ON aui_persona_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_aui_personas_name ON aui_persona_profiles(user_id, name);
CREATE INDEX IF NOT EXISTS idx_aui_personas_default ON aui_persona_profiles(user_id, is_default) WHERE is_default = TRUE;
CREATE INDEX IF NOT EXISTS idx_aui_personas_updated ON aui_persona_profiles(updated_at DESC);

-- Style profiles indexes
CREATE INDEX IF NOT EXISTS idx_aui_styles_persona ON aui_style_profiles(persona_id);
CREATE INDEX IF NOT EXISTS idx_aui_styles_name ON aui_style_profiles(persona_id, name);
CREATE INDEX IF NOT EXISTS idx_aui_styles_default ON aui_style_profiles(persona_id, is_default) WHERE is_default = TRUE;
CREATE INDEX IF NOT EXISTS idx_aui_styles_updated ON aui_style_profiles(updated_at DESC);

-- Content buffers indexes
CREATE INDEX IF NOT EXISTS idx_aui_content_buffers_state ON aui_content_buffers(state);
CREATE INDEX IF NOT EXISTS idx_aui_content_buffers_format ON aui_content_buffers(format);
CREATE INDEX IF NOT EXISTS idx_aui_content_buffers_created ON aui_content_buffers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aui_content_buffers_updated ON aui_content_buffers(updated_at DESC);

-- Provenance chains indexes
CREATE INDEX IF NOT EXISTS idx_aui_provenance_root ON aui_provenance_chains(root_buffer_id);
CREATE INDEX IF NOT EXISTS idx_aui_provenance_current ON aui_provenance_chains(current_buffer_id);
CREATE INDEX IF NOT EXISTS idx_aui_provenance_parent ON aui_provenance_chains(parent_chain_id);
CREATE INDEX IF NOT EXISTS idx_aui_provenance_branch ON aui_provenance_chains(branch_name);
CREATE INDEX IF NOT EXISTS idx_aui_provenance_created ON aui_provenance_chains(created_at DESC);

-- Buffer operations indexes
CREATE INDEX IF NOT EXISTS idx_aui_operations_chain ON aui_buffer_operations(chain_id);
CREATE INDEX IF NOT EXISTS idx_aui_operations_type ON aui_buffer_operations(operation_type);
CREATE INDEX IF NOT EXISTS idx_aui_operations_before ON aui_buffer_operations(before_hash);
CREATE INDEX IF NOT EXISTS idx_aui_operations_after ON aui_buffer_operations(after_hash);
CREATE INDEX IF NOT EXISTS idx_aui_operations_created ON aui_buffer_operations(created_at DESC);
`;

/**
 * Create HNSW vector index for cluster centroids (optional)
 */
export const CREATE_AUI_CLUSTER_VECTOR_INDEX = `
CREATE INDEX IF NOT EXISTS idx_aui_clusters_centroid
  ON aui_clusters
  USING hnsw (centroid vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
`;

/**
 * Create HNSW vector index for content buffer embeddings (optional)
 */
export const CREATE_AUI_CONTENT_BUFFER_VECTOR_INDEX = `
CREATE INDEX IF NOT EXISTS idx_aui_content_buffers_embedding
  ON aui_content_buffers
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
`;

// ═══════════════════════════════════════════════════════════════════
// MIGRATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Run AUI schema migration to version 4
 *
 * Version 4 adds: Content buffer system with provenance tracking
 */
export async function runAuiMigration(
  client: PoolClient,
  embeddingDimension: number,
  enableVec: boolean
): Promise<void> {
  // Create sessions table
  await client.query(CREATE_AUI_SESSIONS_TABLE);

  // Create buffer tables (legacy versioned buffers)
  await client.query(CREATE_AUI_BUFFERS_TABLE);
  await client.query(CREATE_AUI_BUFFER_BRANCHES_TABLE);
  await client.query(CREATE_AUI_BUFFER_VERSIONS_TABLE);

  // Create tasks table
  await client.query(CREATE_AUI_TASKS_TABLE);

  // Create books tables
  await client.query(CREATE_AUI_BOOKS_TABLE);
  await client.query(CREATE_AUI_BOOK_CHAPTERS_TABLE);

  // Create clusters table (with vector column)
  await client.query(createAuiClustersTable(embeddingDimension));

  // Create artifacts table
  await client.query(CREATE_AUI_ARTIFACTS_TABLE);

  // Create persona profiles table
  await client.query(CREATE_AUI_PERSONA_PROFILES_TABLE);

  // Create style profiles table
  await client.query(CREATE_AUI_STYLE_PROFILES_TABLE);

  // Create content buffer tables (API-first buffer system)
  await client.query(createAuiContentBuffersTable(embeddingDimension));
  await client.query(CREATE_AUI_PROVENANCE_CHAINS_TABLE);
  await client.query(CREATE_AUI_BUFFER_OPERATIONS_TABLE);

  // Create indexes
  await client.query(CREATE_AUI_INDEXES);

  // Create vector indexes if enabled
  if (enableVec) {
    try {
      await client.query(CREATE_AUI_CLUSTER_VECTOR_INDEX);
    } catch (error) {
      // Log but don't fail - vector extension might not be available
      console.warn('Could not create cluster vector index:', error);
    }
    try {
      await client.query(CREATE_AUI_CONTENT_BUFFER_VECTOR_INDEX);
    } catch (error) {
      console.warn('Could not create content buffer vector index:', error);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// SQL QUERY TEMPLATES
// ═══════════════════════════════════════════════════════════════════

// Sessions
export const INSERT_AUI_SESSION = `
INSERT INTO aui_sessions (id, user_id, name, active_buffer_name, search_session_id, command_history, variables, metadata, created_at, updated_at, expires_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING *
`;

export const GET_AUI_SESSION = `SELECT * FROM aui_sessions WHERE id = $1`;

export const UPDATE_AUI_SESSION = `
UPDATE aui_sessions SET
  name = COALESCE($2, name),
  active_buffer_name = COALESCE($3, active_buffer_name),
  search_session_id = COALESCE($4, search_session_id),
  command_history = COALESCE($5, command_history),
  variables = COALESCE($6, variables),
  metadata = COALESCE($7, metadata),
  updated_at = NOW(),
  expires_at = COALESCE($8, expires_at),
  last_accessed_at = NOW()
WHERE id = $1
RETURNING *
`;

export const DELETE_AUI_SESSION = `DELETE FROM aui_sessions WHERE id = $1`;

export const LIST_AUI_SESSIONS = `
SELECT * FROM aui_sessions
WHERE ($1::text IS NULL OR user_id = $1)
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY updated_at DESC
LIMIT $2 OFFSET $3
`;

export const TOUCH_AUI_SESSION = `
UPDATE aui_sessions SET
  updated_at = NOW(),
  last_accessed_at = NOW()
WHERE id = $1
`;

export const CLEANUP_EXPIRED_SESSIONS = `
DELETE FROM aui_sessions WHERE expires_at IS NOT NULL AND expires_at < NOW()
`;

// Buffers
export const INSERT_AUI_BUFFER = `
INSERT INTO aui_buffers (id, session_id, name, current_branch, working_content, is_dirty, schema, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *
`;

export const GET_AUI_BUFFER = `SELECT * FROM aui_buffers WHERE id = $1`;

export const GET_AUI_BUFFER_BY_NAME = `SELECT * FROM aui_buffers WHERE session_id = $1 AND name = $2`;

export const UPDATE_AUI_BUFFER = `
UPDATE aui_buffers SET
  current_branch = COALESCE($2, current_branch),
  working_content = COALESCE($3, working_content),
  is_dirty = COALESCE($4, is_dirty),
  schema = COALESCE($5, schema),
  updated_at = NOW()
WHERE id = $1
RETURNING *
`;

export const DELETE_AUI_BUFFER = `DELETE FROM aui_buffers WHERE id = $1`;

export const LIST_AUI_BUFFERS = `
SELECT * FROM aui_buffers WHERE session_id = $1 ORDER BY updated_at DESC
`;

// Branches
export const INSERT_AUI_BRANCH = `
INSERT INTO aui_buffer_branches (id, buffer_id, name, head_version_id, parent_branch, description, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *
`;

export const GET_AUI_BRANCH = `SELECT * FROM aui_buffer_branches WHERE buffer_id = $1 AND name = $2`;

export const UPDATE_AUI_BRANCH = `
UPDATE aui_buffer_branches SET
  head_version_id = COALESCE($3, head_version_id),
  description = COALESCE($4, description)
WHERE buffer_id = $1 AND name = $2
RETURNING *
`;

export const DELETE_AUI_BRANCH = `DELETE FROM aui_buffer_branches WHERE buffer_id = $1 AND name = $2`;

export const LIST_AUI_BRANCHES = `
SELECT * FROM aui_buffer_branches WHERE buffer_id = $1 ORDER BY created_at DESC
`;

// Versions
export const INSERT_AUI_VERSION = `
INSERT INTO aui_buffer_versions (id, buffer_id, content, message, parent_id, tags, metadata, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *
`;

export const GET_AUI_VERSION = `SELECT * FROM aui_buffer_versions WHERE id = $1`;

export const GET_AUI_VERSION_HISTORY = `
SELECT * FROM aui_buffer_versions
WHERE buffer_id = $1
ORDER BY created_at DESC
LIMIT $2
`;

export const PRUNE_AUI_VERSIONS = `
DELETE FROM aui_buffer_versions
WHERE buffer_id = $1
  AND id NOT IN (
    SELECT id FROM aui_buffer_versions
    WHERE buffer_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  )
`;

// Tasks
export const INSERT_AUI_TASK = `
INSERT INTO aui_tasks (id, session_id, request, status, steps, plan, result, error, priority, total_tokens, total_cost_cents, started_at, completed_at, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
RETURNING *
`;

export const GET_AUI_TASK = `SELECT * FROM aui_tasks WHERE id = $1`;

export const UPDATE_AUI_TASK = `
UPDATE aui_tasks SET
  status = COALESCE($2, status),
  steps = COALESCE($3, steps),
  plan = COALESCE($4, plan),
  result = COALESCE($5, result),
  error = COALESCE($6, error),
  total_tokens = COALESCE($7, total_tokens),
  total_cost_cents = COALESCE($8, total_cost_cents),
  completed_at = COALESCE($9, completed_at)
WHERE id = $1
RETURNING *
`;

export const GET_AUI_TASK_HISTORY = `
SELECT * FROM aui_tasks
WHERE session_id = $1
ORDER BY created_at DESC
LIMIT $2
`;

// Books
export const INSERT_AUI_BOOK = `
INSERT INTO aui_books (id, user_id, title, description, arc, status, source_cluster_id, metadata, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *
`;

export const GET_AUI_BOOK = `SELECT * FROM aui_books WHERE id = $1`;

export const UPDATE_AUI_BOOK = `
UPDATE aui_books SET
  title = COALESCE($2, title),
  description = COALESCE($3, description),
  arc = COALESCE($4, arc),
  status = COALESCE($5, status),
  metadata = COALESCE($6, metadata),
  updated_at = NOW()
WHERE id = $1
RETURNING *
`;

export const DELETE_AUI_BOOK = `DELETE FROM aui_books WHERE id = $1`;

export const LIST_AUI_BOOKS = `
SELECT * FROM aui_books
WHERE ($1::text IS NULL OR user_id = $1)
ORDER BY updated_at DESC
LIMIT $2 OFFSET $3
`;

// Chapters
export const INSERT_AUI_CHAPTER = `
INSERT INTO aui_book_chapters (id, book_id, title, content, position, word_count, passage_ids, metadata, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *
`;

export const GET_AUI_CHAPTERS = `
SELECT * FROM aui_book_chapters WHERE book_id = $1 ORDER BY position ASC
`;

export const UPDATE_AUI_CHAPTER = `
UPDATE aui_book_chapters SET
  title = COALESCE($2, title),
  content = COALESCE($3, content),
  position = COALESCE($4, position),
  word_count = COALESCE($5, word_count),
  passage_ids = COALESCE($6, passage_ids),
  metadata = COALESCE($7, metadata),
  updated_at = NOW()
WHERE id = $1
RETURNING *
`;

export const DELETE_AUI_CHAPTER = `DELETE FROM aui_book_chapters WHERE id = $1`;

// Clusters
export const INSERT_AUI_CLUSTER = `
INSERT INTO aui_clusters (id, user_id, label, description, passages, total_passages, coherence, keywords, source_distribution, date_range, avg_word_count, centroid, discovery_options, created_at, expires_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  passages = EXCLUDED.passages,
  total_passages = EXCLUDED.total_passages,
  coherence = EXCLUDED.coherence,
  keywords = EXCLUDED.keywords,
  source_distribution = EXCLUDED.source_distribution,
  date_range = EXCLUDED.date_range,
  avg_word_count = EXCLUDED.avg_word_count,
  centroid = EXCLUDED.centroid,
  discovery_options = EXCLUDED.discovery_options,
  expires_at = EXCLUDED.expires_at
RETURNING *
`;

export const GET_AUI_CLUSTER = `SELECT * FROM aui_clusters WHERE id = $1`;

export const LIST_AUI_CLUSTERS = `
SELECT * FROM aui_clusters
WHERE ($1::text IS NULL OR user_id = $1)
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY created_at DESC
LIMIT $2 OFFSET $3
`;

export const FIND_SIMILAR_CLUSTERS = `
SELECT *, 1 - (centroid <=> $1::vector) as similarity
FROM aui_clusters
WHERE centroid IS NOT NULL
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY centroid <=> $1::vector
LIMIT $2
`;

export const DELETE_AUI_CLUSTER = `DELETE FROM aui_clusters WHERE id = $1`;

export const CLEANUP_EXPIRED_CLUSTERS = `
DELETE FROM aui_clusters WHERE expires_at IS NOT NULL AND expires_at < NOW()
`;

// Artifacts
export const INSERT_AUI_ARTIFACT = `
INSERT INTO aui_artifacts (id, user_id, name, artifact_type, content, content_binary, mime_type, size_bytes, source_type, source_id, metadata, created_at, expires_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
RETURNING *
`;

export const GET_AUI_ARTIFACT = `SELECT * FROM aui_artifacts WHERE id = $1`;

export const LIST_AUI_ARTIFACTS = `
SELECT id, user_id, name, artifact_type, mime_type, size_bytes, source_type, source_id, metadata, created_at, expires_at, download_count, last_downloaded_at
FROM aui_artifacts
WHERE ($1::text IS NULL OR user_id = $1)
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY created_at DESC
LIMIT $2 OFFSET $3
`;

export const UPDATE_AUI_ARTIFACT_DOWNLOAD = `
UPDATE aui_artifacts SET
  download_count = download_count + 1,
  last_downloaded_at = NOW()
WHERE id = $1
`;

export const DELETE_AUI_ARTIFACT = `DELETE FROM aui_artifacts WHERE id = $1`;

export const CLEANUP_EXPIRED_ARTIFACTS = `
DELETE FROM aui_artifacts WHERE expires_at IS NOT NULL AND expires_at < NOW()
`;

// Persona Profiles
export const INSERT_AUI_PERSONA_PROFILE = `
INSERT INTO aui_persona_profiles (id, user_id, name, description, voice_traits, tone_markers, formality_min, formality_max, style_guide, reference_examples, voice_fingerprint, is_default, metadata, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
RETURNING *
`;

export const GET_AUI_PERSONA_PROFILE = `SELECT * FROM aui_persona_profiles WHERE id = $1`;

export const GET_AUI_PERSONA_PROFILE_BY_NAME = `SELECT * FROM aui_persona_profiles WHERE user_id = $1 AND name = $2`;

export const GET_AUI_DEFAULT_PERSONA_PROFILE = `SELECT * FROM aui_persona_profiles WHERE user_id = $1 AND is_default = TRUE LIMIT 1`;

export const UPDATE_AUI_PERSONA_PROFILE = `
UPDATE aui_persona_profiles SET
  name = COALESCE($2, name),
  description = COALESCE($3, description),
  voice_traits = COALESCE($4, voice_traits),
  tone_markers = COALESCE($5, tone_markers),
  formality_min = COALESCE($6, formality_min),
  formality_max = COALESCE($7, formality_max),
  style_guide = COALESCE($8, style_guide),
  reference_examples = COALESCE($9, reference_examples),
  voice_fingerprint = COALESCE($10, voice_fingerprint),
  is_default = COALESCE($11, is_default),
  metadata = COALESCE($12, metadata),
  updated_at = NOW()
WHERE id = $1
RETURNING *
`;

export const DELETE_AUI_PERSONA_PROFILE = `DELETE FROM aui_persona_profiles WHERE id = $1`;

export const LIST_AUI_PERSONA_PROFILES = `
SELECT * FROM aui_persona_profiles
WHERE ($1::text IS NULL OR user_id = $1)
ORDER BY is_default DESC, updated_at DESC
LIMIT $2 OFFSET $3
`;

export const CLEAR_DEFAULT_PERSONA_PROFILE = `
UPDATE aui_persona_profiles SET is_default = FALSE WHERE user_id = $1 AND is_default = TRUE
`;

// Style Profiles
export const INSERT_AUI_STYLE_PROFILE = `
INSERT INTO aui_style_profiles (id, persona_id, name, description, context, forbidden_phrases, preferred_patterns, sentence_variety, paragraph_style, use_contractions, use_rhetorical_questions, formality_level, is_default, metadata, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
RETURNING *
`;

export const GET_AUI_STYLE_PROFILE = `SELECT * FROM aui_style_profiles WHERE id = $1`;

export const GET_AUI_STYLE_PROFILE_BY_NAME = `SELECT * FROM aui_style_profiles WHERE persona_id = $1 AND name = $2`;

export const GET_AUI_DEFAULT_STYLE_PROFILE = `SELECT * FROM aui_style_profiles WHERE persona_id = $1 AND is_default = TRUE LIMIT 1`;

export const UPDATE_AUI_STYLE_PROFILE = `
UPDATE aui_style_profiles SET
  name = COALESCE($2, name),
  description = COALESCE($3, description),
  context = COALESCE($4, context),
  forbidden_phrases = COALESCE($5, forbidden_phrases),
  preferred_patterns = COALESCE($6, preferred_patterns),
  sentence_variety = COALESCE($7, sentence_variety),
  paragraph_style = COALESCE($8, paragraph_style),
  use_contractions = COALESCE($9, use_contractions),
  use_rhetorical_questions = COALESCE($10, use_rhetorical_questions),
  formality_level = COALESCE($11, formality_level),
  is_default = COALESCE($12, is_default),
  metadata = COALESCE($13, metadata),
  updated_at = NOW()
WHERE id = $1
RETURNING *
`;

export const DELETE_AUI_STYLE_PROFILE = `DELETE FROM aui_style_profiles WHERE id = $1`;

export const LIST_AUI_STYLE_PROFILES = `
SELECT * FROM aui_style_profiles
WHERE persona_id = $1
ORDER BY is_default DESC, updated_at DESC
`;

export const CLEAR_DEFAULT_STYLE_PROFILE = `
UPDATE aui_style_profiles SET is_default = FALSE WHERE persona_id = $1 AND is_default = TRUE
`;

// ═══════════════════════════════════════════════════════════════════
// CONTENT BUFFER SQL TEMPLATES
// ═══════════════════════════════════════════════════════════════════

// Content Buffers
export const INSERT_AUI_CONTENT_BUFFER = `
INSERT INTO aui_content_buffers (id, content_hash, text, word_count, format, state, origin, quality_metrics, embedding, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING *
`;

export const GET_AUI_CONTENT_BUFFER = `SELECT * FROM aui_content_buffers WHERE id = $1`;

export const GET_AUI_CONTENT_BUFFERS_BY_HASH = `SELECT * FROM aui_content_buffers WHERE content_hash = $1`;

export const UPDATE_AUI_CONTENT_BUFFER = `
UPDATE aui_content_buffers SET
  state = COALESCE($2, state),
  quality_metrics = COALESCE($3, quality_metrics),
  embedding = COALESCE($4, embedding),
  updated_at = NOW()
WHERE id = $1
RETURNING *
`;

export const DELETE_AUI_CONTENT_BUFFER = `DELETE FROM aui_content_buffers WHERE id = $1`;

export const LIST_AUI_CONTENT_BUFFERS = `
SELECT * FROM aui_content_buffers
WHERE ($1::text IS NULL OR state = $1)
ORDER BY updated_at DESC
LIMIT $2 OFFSET $3
`;

export const FIND_SIMILAR_CONTENT_BUFFERS = `
SELECT *, 1 - (embedding <=> $1::vector) as similarity
FROM aui_content_buffers
WHERE embedding IS NOT NULL
ORDER BY embedding <=> $1::vector
LIMIT $2
`;

// Provenance Chains
export const INSERT_AUI_PROVENANCE_CHAIN = `
INSERT INTO aui_provenance_chains (id, root_buffer_id, current_buffer_id, branch_name, branch_description, is_main, parent_chain_id, child_chain_ids, transformation_count, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *
`;

export const GET_AUI_PROVENANCE_CHAIN = `SELECT * FROM aui_provenance_chains WHERE id = $1`;

export const GET_AUI_PROVENANCE_CHAIN_BY_BUFFER = `
SELECT * FROM aui_provenance_chains
WHERE current_buffer_id = $1 OR root_buffer_id = $1
ORDER BY created_at DESC
LIMIT 1
`;

export const UPDATE_AUI_PROVENANCE_CHAIN = `
UPDATE aui_provenance_chains SET
  current_buffer_id = COALESCE($2, current_buffer_id),
  child_chain_ids = COALESCE($3, child_chain_ids),
  transformation_count = COALESCE($4, transformation_count)
WHERE id = $1
RETURNING *
`;

export const DELETE_AUI_PROVENANCE_CHAIN = `DELETE FROM aui_provenance_chains WHERE id = $1`;

export const LIST_AUI_PROVENANCE_CHAINS = `
SELECT * FROM aui_provenance_chains
WHERE ($1::uuid IS NULL OR root_buffer_id = $1)
ORDER BY created_at DESC
LIMIT $2 OFFSET $3
`;

export const FIND_DERIVED_CHAINS = `
SELECT * FROM aui_provenance_chains
WHERE root_buffer_id = $1 OR parent_chain_id IN (
  SELECT id FROM aui_provenance_chains WHERE root_buffer_id = $1
)
ORDER BY created_at ASC
`;

// Buffer Operations
export const INSERT_AUI_BUFFER_OPERATION = `
INSERT INTO aui_buffer_operations (id, chain_id, sequence_number, operation_type, performer, parameters, before_hash, after_hash, delta_hash, quality_impact, description, duration_ms, cost_cents, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
RETURNING *
`;

export const GET_AUI_BUFFER_OPERATION = `SELECT * FROM aui_buffer_operations WHERE id = $1`;

export const GET_AUI_BUFFER_OPERATIONS_BY_CHAIN = `
SELECT * FROM aui_buffer_operations
WHERE chain_id = $1
ORDER BY sequence_number ASC
`;

export const GET_AUI_BUFFER_OPERATIONS_BY_HASH = `
SELECT * FROM aui_buffer_operations
WHERE before_hash = $1 OR after_hash = $1
ORDER BY created_at DESC
`;

export const DELETE_AUI_BUFFER_OPERATION = `DELETE FROM aui_buffer_operations WHERE id = $1`;

export const GET_NEXT_OPERATION_SEQUENCE = `
SELECT COALESCE(MAX(sequence_number), 0) + 1 as next_seq
FROM aui_buffer_operations
WHERE chain_id = $1
`;
