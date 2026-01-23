/**
 * Book Studio Database Schema
 * 
 * Separate database for authored works that graduate toward NetworkNode autonomy.
 * 
 * Architecture Philosophy:
 * - Books are NOT just stored content - they are proto-agents
 * - A book has identity, voice, coherence, and eventually agency
 * - The schema supports the graduation path: ContentNode → NetworkNode
 * 
 * Graduation Model:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  Archive (humanizer_archive)                                    │
 * │    └─ Raw imported content (sediment)                          │
 * │         ↓ extraction/curation                                  │
 * │  Book Studio (humanizer_books)                                 │
 * │    └─ ContentNode (authored, structured)                       │
 * │         ↓ coherence/voice development                          │
 * │    └─ Book (collection with identity)                          │
 * │         ↓ agency/autonomy                                      │
 * │  Network (federated)                                           │
 * │    └─ NetworkNode (serves its own canon)                       │
 * └─────────────────────────────────────────────────────────────────┘
 */

import type { Pool } from 'pg';

// ═══════════════════════════════════════════════════════════════════
// SCHEMA VERSION
// ═══════════════════════════════════════════════════════════════════

export const BOOKS_SCHEMA_VERSION = 1;

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

export interface BooksStorageConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
  maxConnections: number;
  idleTimeoutMs: number;
  connectionTimeoutMs: number;
  embeddingDimension: number;
}

export const DEFAULT_BOOKS_CONFIG: BooksStorageConfig = {
  host: 'localhost',
  port: 5432,
  database: 'humanizer_books',
  user: process.env.PGUSER || 'ed',
  maxConnections: 10,
  idleTimeoutMs: 30000,
  connectionTimeoutMs: 10000,
  embeddingDimension: 768,
};

// ═══════════════════════════════════════════════════════════════════
// EXTENSION SETUP
// ═══════════════════════════════════════════════════════════════════

export const ENABLE_EXTENSIONS = `
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
`;

// ═══════════════════════════════════════════════════════════════════
// SCHEMA METADATA
// ═══════════════════════════════════════════════════════════════════

export const CREATE_SCHEMA_META = `
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

// ═══════════════════════════════════════════════════════════════════
// BOOKS TABLE
// ═══════════════════════════════════════════════════════════════════

/**
 * Books - The primary entity representing an authored work
 * 
 * A book has:
 * - Identity (id, slug, title)
 * - Voice (voice_profile, persona)
 * - Structure (chapters, sections)
 * - Agency readiness (graduation_status)
 */
export const CREATE_BOOKS_TABLE = `
CREATE TABLE IF NOT EXISTS books (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  
  -- Authorship
  author_name TEXT,
  author_id UUID,  -- Links to user/agent in main system
  
  -- Voice & Persona (for graduation to NetworkNode)
  voice_profile JSONB DEFAULT '{}',
  persona_embedding vector(768),  -- Book's "voice" as embedding
  
  -- Structure
  description TEXT,
  structure JSONB DEFAULT '{"type": "linear"}',  -- linear, nonlinear, networked
  
  -- Content Stats
  word_count INTEGER DEFAULT 0,
  chapter_count INTEGER DEFAULT 0,
  chunk_count INTEGER DEFAULT 0,
  
  -- Graduation Status
  graduation_status TEXT DEFAULT 'draft' 
    CHECK (graduation_status IN (
      'draft',           -- Being written
      'structured',      -- Has chapters/sections
      'coherent',        -- Voice is consistent
      'indexed',         -- Full embeddings + pyramid
      'autonomous',      -- Ready for NetworkNode graduation
      'networked'        -- Active as NetworkNode
    )),
  
  -- Coherence Metrics (for graduation readiness)
  coherence_score FLOAT,          -- 0-1, voice consistency
  completeness_score FLOAT,       -- 0-1, structural completeness
  autonomy_readiness FLOAT,       -- 0-1, ready for network
  
  -- Network Identity (populated at graduation)
  network_node_id UUID,           -- ID in federated network
  network_endpoint TEXT,          -- URL when serving as NetworkNode
  
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  graduated_at TIMESTAMPTZ        -- When became NetworkNode
);
`;

// ═══════════════════════════════════════════════════════════════════
// CHAPTERS TABLE
// ═══════════════════════════════════════════════════════════════════

/**
 * Chapters - Structural divisions within a book
 * 
 * Chapters provide:
 * - Navigational structure
 * - Thematic grouping
 * - Summary hierarchy (L1 in pyramid)
 */
export const CREATE_CHAPTERS_TABLE = `
CREATE TABLE IF NOT EXISTS chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  
  -- Identity
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  
  -- Position
  position INTEGER NOT NULL,
  parent_chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  depth INTEGER DEFAULT 0,  -- 0 = top-level, 1 = sub-chapter, etc.
  
  -- Content
  synopsis TEXT,            -- Brief chapter summary
  
  -- Pyramid Integration
  summary_node_id UUID,     -- L1 summary node
  apex_contribution TEXT,   -- This chapter's contribution to book apex
  
  -- Stats
  word_count INTEGER DEFAULT 0,
  chunk_count INTEGER DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(book_id, slug),
  UNIQUE(book_id, position, parent_chapter_id)
);
`;

// ═══════════════════════════════════════════════════════════════════
// CONTENT NODES TABLE (Book-specific)
// ═══════════════════════════════════════════════════════════════════

/**
 * Book Content Nodes - The actual content within books
 * 
 * Similar to archive content_nodes but with:
 * - Book/chapter relationships
 * - Pyramid hierarchy levels
 * - Source tracking (from archive)
 */
export function createBookNodesTable(dimension: number): string {
  return `
CREATE TABLE IF NOT EXISTS book_nodes (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash TEXT NOT NULL,
  
  -- Book Structure
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
  
  -- Content
  text TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'markdown'
    CHECK (format IN ('text', 'markdown', 'html', 'code')),
  word_count INTEGER NOT NULL DEFAULT 0,
  
  -- Position & Hierarchy
  position INTEGER NOT NULL,  -- Within chapter or book
  hierarchy_level INTEGER NOT NULL DEFAULT 0,  -- 0=chunk, 1=summary, 2=apex
  parent_node_id UUID REFERENCES book_nodes(id) ON DELETE CASCADE,
  
  -- Chunk Boundaries (for L0 nodes)
  chunk_index INTEGER,
  chunk_start_offset INTEGER,
  chunk_end_offset INTEGER,
  
  -- Embedding
  embedding vector(${dimension}),
  embedding_model TEXT,
  embedding_at TIMESTAMPTZ,
  embedding_text_hash TEXT,
  
  -- Full-Text Search
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
  
  -- Source Tracking (if extracted from archive)
  source_archive_id UUID,     -- ID in humanizer_archive.content_nodes
  source_type TEXT,           -- 'original', 'extracted', 'synthesized'
  
  -- Metadata
  annotations JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
`;
}

// ═══════════════════════════════════════════════════════════════════
// BOOK LINKS TABLE
// ═══════════════════════════════════════════════════════════════════

/**
 * Book Links - Relationships between book nodes
 * 
 * Supports:
 * - Internal cross-references
 * - Archive provenance
 * - Thematic connections
 */
export const CREATE_BOOK_LINKS_TABLE = `
CREATE TABLE IF NOT EXISTS book_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source & Target
  source_node_id UUID NOT NULL REFERENCES book_nodes(id) ON DELETE CASCADE,
  target_node_id UUID REFERENCES book_nodes(id) ON DELETE CASCADE,
  target_archive_id UUID,  -- If linking to archive content
  
  -- Link Type
  link_type TEXT NOT NULL CHECK (link_type IN (
    'reference',      -- Cross-reference within book
    'continuation',   -- Sequential flow
    'elaboration',    -- Expands on concept
    'contradiction',  -- Contrasts with
    'provenance',     -- Source in archive
    'inspiration',    -- Influenced by archive content
    'pyramid_parent', -- L0→L1 or L1→apex relationship
    'thematic'        -- Shared theme/concept
  )),
  
  -- Metadata
  strength FLOAT DEFAULT 1.0,  -- Link weight for graph traversal
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

// ═══════════════════════════════════════════════════════════════════
// BOOK VERSIONS TABLE
// ═══════════════════════════════════════════════════════════════════

/**
 * Book Versions - Versioning for books as they evolve
 * 
 * Captures snapshots for:
 * - Publication points
 * - Major revisions
 * - Pre/post graduation states
 */
export const CREATE_BOOK_VERSIONS_TABLE = `
CREATE TABLE IF NOT EXISTS book_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  
  -- Version Info
  version TEXT NOT NULL,       -- Semantic version: "1.0.0"
  version_type TEXT NOT NULL CHECK (version_type IN (
    'draft',      -- Working version
    'snapshot',   -- Point-in-time save
    'release',    -- Published version
    'graduation'  -- NetworkNode graduation snapshot
  )),
  
  -- Content Snapshot
  content_snapshot JSONB,      -- Full book structure at this version
  word_count INTEGER,
  chapter_count INTEGER,
  
  -- Metrics at Version
  coherence_score FLOAT,
  completeness_score FLOAT,
  
  -- Notes
  changelog TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(book_id, version)
);
`;

// ═══════════════════════════════════════════════════════════════════
// GRADUATION EVENTS TABLE
// ═══════════════════════════════════════════════════════════════════

/**
 * Graduation Events - Tracks the book's journey to NetworkNode
 * 
 * Records milestones in the graduation process:
 * draft → structured → coherent → indexed → autonomous → networked
 */
export const CREATE_GRADUATION_EVENTS_TABLE = `
CREATE TABLE IF NOT EXISTS graduation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  
  -- Event Info
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  
  -- Metrics at Transition
  coherence_score FLOAT,
  completeness_score FLOAT,
  autonomy_readiness FLOAT,
  
  -- Assessment
  assessment_notes TEXT,
  assessed_by TEXT,  -- 'system', 'human', 'agent'
  
  -- Network Info (for networked transition)
  network_node_id UUID,
  network_endpoint TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

// ═══════════════════════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════════════════════

export const CREATE_INDEXES = `
-- Books indexes
CREATE INDEX IF NOT EXISTS idx_books_slug ON books(slug);
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author_id);
CREATE INDEX IF NOT EXISTS idx_books_status ON books(graduation_status);
CREATE INDEX IF NOT EXISTS idx_books_tags ON books USING GIN(tags);

-- Chapters indexes
CREATE INDEX IF NOT EXISTS idx_chapters_book ON chapters(book_id);
CREATE INDEX IF NOT EXISTS idx_chapters_parent ON chapters(parent_chapter_id);
CREATE INDEX IF NOT EXISTS idx_chapters_position ON chapters(book_id, position);

-- Book nodes indexes
CREATE INDEX IF NOT EXISTS idx_book_nodes_book ON book_nodes(book_id);
CREATE INDEX IF NOT EXISTS idx_book_nodes_chapter ON book_nodes(chapter_id);
CREATE INDEX IF NOT EXISTS idx_book_nodes_hierarchy ON book_nodes(hierarchy_level);
CREATE INDEX IF NOT EXISTS idx_book_nodes_parent ON book_nodes(parent_node_id);
CREATE INDEX IF NOT EXISTS idx_book_nodes_hash ON book_nodes(content_hash);
CREATE INDEX IF NOT EXISTS idx_book_nodes_source ON book_nodes(source_archive_id);
CREATE INDEX IF NOT EXISTS idx_book_nodes_tsv ON book_nodes USING GIN(tsv);

-- Book links indexes
CREATE INDEX IF NOT EXISTS idx_book_links_source ON book_links(source_node_id);
CREATE INDEX IF NOT EXISTS idx_book_links_target ON book_links(target_node_id);
CREATE INDEX IF NOT EXISTS idx_book_links_type ON book_links(link_type);
CREATE INDEX IF NOT EXISTS idx_book_links_archive ON book_links(target_archive_id);

-- Versions indexes
CREATE INDEX IF NOT EXISTS idx_book_versions_book ON book_versions(book_id);
CREATE INDEX IF NOT EXISTS idx_book_versions_type ON book_versions(version_type);

-- Graduation events indexes
CREATE INDEX IF NOT EXISTS idx_graduation_events_book ON graduation_events(book_id);
CREATE INDEX IF NOT EXISTS idx_graduation_events_status ON graduation_events(to_status);
`;

// ═══════════════════════════════════════════════════════════════════
// HNSW VECTOR INDEX
// ═══════════════════════════════════════════════════════════════════

export const CREATE_VECTOR_INDEX = `
-- HNSW index for semantic search within books
CREATE INDEX IF NOT EXISTS idx_book_nodes_embedding 
ON book_nodes USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Persona embedding index for book voice matching
CREATE INDEX IF NOT EXISTS idx_books_persona_embedding
ON books USING hnsw (persona_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
`;

// ═══════════════════════════════════════════════════════════════════
// SCHEMA INITIALIZATION
// ═══════════════════════════════════════════════════════════════════

export async function initializeBooksSchema(
  pool: Pool,
  config: BooksStorageConfig = DEFAULT_BOOKS_CONFIG
): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Enable extensions
    await client.query(ENABLE_EXTENSIONS);
    
    // Create schema meta
    await client.query(CREATE_SCHEMA_META);
    
    // Create tables
    await client.query(CREATE_BOOKS_TABLE);
    await client.query(CREATE_CHAPTERS_TABLE);
    await client.query(createBookNodesTable(config.embeddingDimension));
    await client.query(CREATE_BOOK_LINKS_TABLE);
    await client.query(CREATE_BOOK_VERSIONS_TABLE);
    await client.query(CREATE_GRADUATION_EVENTS_TABLE);
    
    // Create indexes
    await client.query(CREATE_INDEXES);
    await client.query(CREATE_VECTOR_INDEX);
    
    // Set schema version
    await client.query(`
      INSERT INTO schema_meta (key, value) 
      VALUES ('schema_version', $1)
      ON CONFLICT (key) DO UPDATE SET value = $1
    `, [String(BOOKS_SCHEMA_VERSION)]);
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ═══════════════════════════════════════════════════════════════════
// PREPARED STATEMENTS
// ═══════════════════════════════════════════════════════════════════

// Book CRUD
export const INSERT_BOOK = `
  INSERT INTO books (slug, title, subtitle, author_name, author_id, description, tags, metadata)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  RETURNING *
`;

export const GET_BOOK_BY_ID = `SELECT * FROM books WHERE id = $1`;
export const GET_BOOK_BY_SLUG = `SELECT * FROM books WHERE slug = $1`;
export const LIST_BOOKS = `SELECT * FROM books ORDER BY updated_at DESC LIMIT $1 OFFSET $2`;

export const UPDATE_BOOK_STATUS = `
  UPDATE books 
  SET graduation_status = $2, updated_at = NOW()
  WHERE id = $1
  RETURNING *
`;

// Chapter CRUD
export const INSERT_CHAPTER = `
  INSERT INTO chapters (book_id, slug, title, position, parent_chapter_id, synopsis)
  VALUES ($1, $2, $3, $4, $5, $6)
  RETURNING *
`;

export const GET_CHAPTERS_BY_BOOK = `
  SELECT * FROM chapters 
  WHERE book_id = $1 
  ORDER BY depth, position
`;

// Node CRUD
export const INSERT_BOOK_NODE = `
  INSERT INTO book_nodes (
    book_id, chapter_id, content_hash, text, format, word_count,
    position, hierarchy_level, parent_node_id,
    chunk_index, chunk_start_offset, chunk_end_offset,
    source_archive_id, source_type, annotations, metadata
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
  RETURNING *
`;

export const UPDATE_NODE_EMBEDDING = `
  UPDATE book_nodes
  SET embedding = $1, embedding_model = $2, embedding_at = NOW(), embedding_text_hash = $3
  WHERE id = $4
`;

// Search
export const SEMANTIC_SEARCH_BOOK = `
  SELECT id, 1 - (embedding <=> $1) as similarity
  FROM book_nodes
  WHERE book_id = $2 AND embedding IS NOT NULL
  ORDER BY embedding <=> $1
  LIMIT $3
`;

export const FTS_SEARCH_BOOK = `
  SELECT id, ts_rank(tsv, plainto_tsquery('english', $1)) as rank
  FROM book_nodes
  WHERE book_id = $2 AND tsv @@ plainto_tsquery('english', $1)
  ORDER BY rank DESC
  LIMIT $3
`;

// Graduation
export const INSERT_GRADUATION_EVENT = `
  INSERT INTO graduation_events (
    book_id, from_status, to_status,
    coherence_score, completeness_score, autonomy_readiness,
    assessment_notes, assessed_by, network_node_id, network_endpoint
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  RETURNING *
`;

// Stats
export const GET_BOOK_STATS = `
  SELECT 
    COUNT(*) as total_books,
    COUNT(*) FILTER (WHERE graduation_status = 'draft') as draft_count,
    COUNT(*) FILTER (WHERE graduation_status = 'structured') as structured_count,
    COUNT(*) FILTER (WHERE graduation_status = 'coherent') as coherent_count,
    COUNT(*) FILTER (WHERE graduation_status = 'indexed') as indexed_count,
    COUNT(*) FILTER (WHERE graduation_status = 'autonomous') as autonomous_count,
    COUNT(*) FILTER (WHERE graduation_status = 'networked') as networked_count
  FROM books
`;
