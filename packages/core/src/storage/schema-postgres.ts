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
export const SCHEMA_VERSION = 3;

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
// RELATIONSHIP TABLES (Facebook/Instagram Social Graph)
// ═══════════════════════════════════════════════════════════════════

/**
 * Facebook friends table
 */
export const CREATE_FB_FRIENDS_TABLE = `
CREATE TABLE IF NOT EXISTS fb_friends (
  id TEXT PRIMARY KEY,
  import_job_id UUID REFERENCES import_jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  friendship_date TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('friend', 'removed', 'sent_request', 'rejected_request')),
  removed_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

/**
 * Facebook advertisers table
 */
export const CREATE_FB_ADVERTISERS_TABLE = `
CREATE TABLE IF NOT EXISTS fb_advertisers (
  id TEXT PRIMARY KEY,
  import_job_id UUID REFERENCES import_jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  targeting_type TEXT NOT NULL,
  interaction_count INTEGER NOT NULL DEFAULT 1,
  first_seen TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,
  is_data_broker BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

/**
 * Facebook pages table
 */
export const CREATE_FB_PAGES_TABLE = `
CREATE TABLE IF NOT EXISTS fb_pages (
  id TEXT PRIMARY KEY,
  import_job_id UUID REFERENCES import_jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  facebook_id TEXT,
  url TEXT,
  is_liked BOOLEAN NOT NULL DEFAULT FALSE,
  liked_at TIMESTAMPTZ,
  is_following BOOLEAN NOT NULL DEFAULT FALSE,
  followed_at TIMESTAMPTZ,
  unfollowed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

/**
 * Facebook reactions table
 */
export const CREATE_FB_REACTIONS_TABLE = `
CREATE TABLE IF NOT EXISTS fb_reactions (
  id TEXT PRIMARY KEY,
  import_job_id UUID REFERENCES import_jobs(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'love', 'haha', 'wow', 'sad', 'angry')),
  reactor_name TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('link', 'post', 'photo', 'video', 'comment', 'unknown')),
  target_author TEXT,
  title TEXT,
  reacted_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

/**
 * Facebook groups table
 */
export const CREATE_FB_GROUPS_TABLE = `
CREATE TABLE IF NOT EXISTS fb_groups (
  id TEXT PRIMARY KEY,
  import_job_id UUID REFERENCES import_jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  joined_at TIMESTAMPTZ,
  post_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  last_activity TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

/**
 * Facebook group content table (posts and comments in groups)
 */
export const CREATE_FB_GROUP_CONTENT_TABLE = `
CREATE TABLE IF NOT EXISTS fb_group_content (
  id TEXT PRIMARY KEY,
  import_job_id UUID REFERENCES import_jobs(id) ON DELETE CASCADE,
  group_id TEXT REFERENCES fb_groups(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'comment')),
  text TEXT NOT NULL,
  author TEXT,
  original_post_author TEXT,
  external_urls JSONB DEFAULT '[]'::jsonb,
  has_attachments BOOLEAN NOT NULL DEFAULT FALSE,
  title TEXT,
  posted_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
 * Indexes for relationship tables
 */
export const CREATE_RELATIONSHIP_INDEXES = `
-- Friends indexes
CREATE INDEX IF NOT EXISTS idx_fb_friends_name ON fb_friends(name);
CREATE INDEX IF NOT EXISTS idx_fb_friends_status ON fb_friends(status);
CREATE INDEX IF NOT EXISTS idx_fb_friends_date ON fb_friends(friendship_date DESC);
CREATE INDEX IF NOT EXISTS idx_fb_friends_job ON fb_friends(import_job_id);

-- Advertisers indexes
CREATE INDEX IF NOT EXISTS idx_fb_advertisers_name ON fb_advertisers(name);
CREATE INDEX IF NOT EXISTS idx_fb_advertisers_type ON fb_advertisers(targeting_type);
CREATE INDEX IF NOT EXISTS idx_fb_advertisers_broker ON fb_advertisers(is_data_broker) WHERE is_data_broker = TRUE;
CREATE INDEX IF NOT EXISTS idx_fb_advertisers_job ON fb_advertisers(import_job_id);

-- Pages indexes
CREATE INDEX IF NOT EXISTS idx_fb_pages_name ON fb_pages(name);
CREATE INDEX IF NOT EXISTS idx_fb_pages_liked ON fb_pages(is_liked) WHERE is_liked = TRUE;
CREATE INDEX IF NOT EXISTS idx_fb_pages_following ON fb_pages(is_following) WHERE is_following = TRUE;
CREATE INDEX IF NOT EXISTS idx_fb_pages_job ON fb_pages(import_job_id);

-- Reactions indexes
CREATE INDEX IF NOT EXISTS idx_fb_reactions_type ON fb_reactions(reaction_type);
CREATE INDEX IF NOT EXISTS idx_fb_reactions_target ON fb_reactions(target_type);
CREATE INDEX IF NOT EXISTS idx_fb_reactions_target_author ON fb_reactions(target_author);
CREATE INDEX IF NOT EXISTS idx_fb_reactions_date ON fb_reactions(reacted_at DESC);
CREATE INDEX IF NOT EXISTS idx_fb_reactions_job ON fb_reactions(import_job_id);

-- Groups indexes
CREATE INDEX IF NOT EXISTS idx_fb_groups_name ON fb_groups(name);
CREATE INDEX IF NOT EXISTS idx_fb_groups_activity ON fb_groups(last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_fb_groups_job ON fb_groups(import_job_id);

-- Group content indexes
CREATE INDEX IF NOT EXISTS idx_fb_group_content_group ON fb_group_content(group_id);
CREATE INDEX IF NOT EXISTS idx_fb_group_content_type ON fb_group_content(content_type);
CREATE INDEX IF NOT EXISTS idx_fb_group_content_date ON fb_group_content(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_fb_group_content_job ON fb_group_content(import_job_id);
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

  // Migration to version 2: Add relationship tables
  if (fromVersion < 2) {
    // Create relationship tables
    await client.query(CREATE_FB_FRIENDS_TABLE);
    await client.query(CREATE_FB_ADVERTISERS_TABLE);
    await client.query(CREATE_FB_PAGES_TABLE);
    await client.query(CREATE_FB_REACTIONS_TABLE);
    await client.query(CREATE_FB_GROUPS_TABLE);
    await client.query(CREATE_FB_GROUP_CONTENT_TABLE);

    // Create relationship indexes
    await client.query(CREATE_RELATIONSHIP_INDEXES);

    // Update schema version to 2
    await client.query(
      "INSERT INTO schema_meta (key, value) VALUES ('schema_version', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
      ['2']
    );
  }

  // Migration to version 3: Add AUI tables (sessions, buffers, books, clusters, artifacts)
  if (fromVersion < 3) {
    const { runAuiMigration } = await import('./schema-aui.js');
    await runAuiMigration(client, config.embeddingDimension, config.enableVec);

    // Update schema version to 3
    await client.query(
      "INSERT INTO schema_meta (key, value) VALUES ('schema_version', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
      [SCHEMA_VERSION.toString()]
    );
  }

  // Future migrations would go here:
  // if (fromVersion < 4) { ... }
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
 * Get random nodes with embeddings (for clustering seed selection)
 */
export const GET_RANDOM_EMBEDDED_NODES = `
SELECT id FROM content_nodes
WHERE embedding IS NOT NULL
ORDER BY RANDOM()
LIMIT $1
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

// ═══════════════════════════════════════════════════════════════════
// RELATIONSHIP INSERT/QUERY TEMPLATES
// ═══════════════════════════════════════════════════════════════════

export const INSERT_FB_FRIEND = `
INSERT INTO fb_friends (id, import_job_id, name, friendship_date, status, removed_date)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  friendship_date = COALESCE(EXCLUDED.friendship_date, fb_friends.friendship_date),
  status = EXCLUDED.status,
  removed_date = COALESCE(EXCLUDED.removed_date, fb_friends.removed_date)
`;

export const INSERT_FB_ADVERTISER = `
INSERT INTO fb_advertisers (id, import_job_id, name, targeting_type, interaction_count, first_seen, last_seen, is_data_broker)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (id) DO UPDATE SET
  interaction_count = fb_advertisers.interaction_count + EXCLUDED.interaction_count,
  first_seen = LEAST(fb_advertisers.first_seen, EXCLUDED.first_seen),
  last_seen = GREATEST(fb_advertisers.last_seen, EXCLUDED.last_seen)
`;

export const INSERT_FB_PAGE = `
INSERT INTO fb_pages (id, import_job_id, name, facebook_id, url, is_liked, liked_at, is_following, followed_at, unfollowed_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
ON CONFLICT (id) DO UPDATE SET
  is_liked = EXCLUDED.is_liked OR fb_pages.is_liked,
  liked_at = COALESCE(EXCLUDED.liked_at, fb_pages.liked_at),
  is_following = EXCLUDED.is_following OR fb_pages.is_following,
  followed_at = COALESCE(EXCLUDED.followed_at, fb_pages.followed_at),
  unfollowed_at = COALESCE(EXCLUDED.unfollowed_at, fb_pages.unfollowed_at)
`;

export const INSERT_FB_REACTION = `
INSERT INTO fb_reactions (id, import_job_id, reaction_type, reactor_name, target_type, target_author, title, reacted_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (id) DO NOTHING
`;

export const INSERT_FB_GROUP = `
INSERT INTO fb_groups (id, import_job_id, name, joined_at, post_count, comment_count, last_activity)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (id) DO UPDATE SET
  joined_at = COALESCE(EXCLUDED.joined_at, fb_groups.joined_at),
  post_count = EXCLUDED.post_count,
  comment_count = EXCLUDED.comment_count,
  last_activity = GREATEST(fb_groups.last_activity, EXCLUDED.last_activity)
`;

export const INSERT_FB_GROUP_CONTENT = `
INSERT INTO fb_group_content (id, import_job_id, group_id, content_type, text, author, original_post_author, external_urls, has_attachments, title, posted_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
ON CONFLICT (id) DO NOTHING
`;

export const GET_RELATIONSHIP_STATS = `
SELECT
  (SELECT COUNT(*) FROM fb_friends WHERE status = 'friend') as friends_count,
  (SELECT COUNT(*) FROM fb_friends WHERE status = 'removed') as removed_friends_count,
  (SELECT COUNT(*) FROM fb_advertisers) as advertisers_count,
  (SELECT COUNT(*) FROM fb_advertisers WHERE is_data_broker = TRUE) as data_brokers_count,
  (SELECT COUNT(*) FROM fb_pages WHERE is_liked = TRUE) as pages_liked_count,
  (SELECT COUNT(*) FROM fb_pages WHERE is_following = TRUE) as pages_following_count,
  (SELECT COUNT(*) FROM fb_reactions) as reactions_count,
  (SELECT COUNT(*) FROM fb_groups) as groups_count,
  (SELECT COUNT(*) FROM fb_group_content WHERE content_type = 'post') as group_posts_count,
  (SELECT COUNT(*) FROM fb_group_content WHERE content_type = 'comment') as group_comments_count
`;
