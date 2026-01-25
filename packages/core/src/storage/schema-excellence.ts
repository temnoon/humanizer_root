/**
 * PostgreSQL Schema for Content Excellence System
 *
 * DDL for persisting excellence scores, expression indexes, and expression anchors
 * to support the Content Excellence System pipelines.
 *
 * Tables:
 * - content_excellence: Multi-dimensional excellence scores for content nodes
 * - expression_index: Indexed expressions organized by category
 * - expression_anchors: Semantic anchors for navigation and clustering
 *
 * @module @humanizer/core/storage/schema-excellence
 */

// ═══════════════════════════════════════════════════════════════════
// CONTENT EXCELLENCE TABLE
// ═══════════════════════════════════════════════════════════════════

/**
 * Excellence scores table - stores multi-dimensional quality assessments
 */
export const CREATE_CONTENT_EXCELLENCE_TABLE = `
CREATE TABLE IF NOT EXISTS content_excellence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to content node (flexible, can be any content system)
  node_id TEXT NOT NULL,
  node_type TEXT DEFAULT 'message',

  -- User/project context
  user_id TEXT,
  project_id UUID,

  -- Composite score (0-100)
  excellence_score INTEGER NOT NULL CHECK (excellence_score >= 0 AND excellence_score <= 100),

  -- Individual dimension scores (0-1 scale, stored as REAL)
  insight_density REAL NOT NULL CHECK (insight_density >= 0 AND insight_density <= 1),
  expressive_power REAL NOT NULL CHECK (expressive_power >= 0 AND expressive_power <= 1),
  emotional_resonance REAL NOT NULL CHECK (emotional_resonance >= 0 AND emotional_resonance <= 1),
  structural_elegance REAL NOT NULL CHECK (structural_elegance >= 0 AND structural_elegance <= 1),
  voice_authenticity REAL NOT NULL CHECK (voice_authenticity >= 0 AND voice_authenticity <= 1),

  -- Quality tier classification
  tier TEXT NOT NULL CHECK (tier IN ('excellence', 'polished', 'needs_refinement', 'raw_gem', 'noise')),

  -- Raw gem detection
  quality_gap REAL,
  is_raw_gem BOOLEAN NOT NULL DEFAULT FALSE,

  -- Notable quotes extracted
  standout_quotes TEXT[] DEFAULT '{}',

  -- Reasoning/explanation
  reasoning TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one score per node
  UNIQUE(node_id, node_type)
);

-- Index for querying by tier
CREATE INDEX IF NOT EXISTS idx_content_excellence_tier ON content_excellence(tier);

-- Index for querying by score
CREATE INDEX IF NOT EXISTS idx_content_excellence_score ON content_excellence(excellence_score DESC);

-- Index for raw gems
CREATE INDEX IF NOT EXISTS idx_content_excellence_raw_gems ON content_excellence(is_raw_gem) WHERE is_raw_gem = TRUE;

-- Index for user/project queries
CREATE INDEX IF NOT EXISTS idx_content_excellence_user_project ON content_excellence(user_id, project_id);
`;

// ═══════════════════════════════════════════════════════════════════
// EXPRESSION INDEX TABLE
// ═══════════════════════════════════════════════════════════════════

/**
 * Expression index table - stores canonical and variant expressions by category
 *
 * @param dimension - Embedding vector dimension (e.g., 768, 1536)
 */
export function createExpressionIndexTable(dimension: number): string {
  return `
CREATE TABLE IF NOT EXISTS expression_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The expression text
  text TEXT NOT NULL,

  -- Category classification
  concept_category TEXT NOT NULL,

  -- Quality metrics
  excellence_score INTEGER NOT NULL CHECK (excellence_score >= 0 AND excellence_score <= 100),
  is_canonical BOOLEAN NOT NULL DEFAULT FALSE,

  -- Usage tracking
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Provenance
  source_node_id TEXT,
  source_type TEXT,
  user_id TEXT,

  -- Embedding for semantic search
  embedding vector(${dimension}),

  -- Variant tracking (for expressions that are variations of the same concept)
  canonical_id UUID REFERENCES expression_index(id) ON DELETE SET NULL,
  variant_count INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for category queries
CREATE INDEX IF NOT EXISTS idx_expression_index_category ON expression_index(concept_category);

-- Index for canonical expressions per category
CREATE INDEX IF NOT EXISTS idx_expression_index_canonical ON expression_index(concept_category, is_canonical) WHERE is_canonical = TRUE;

-- Index for high-quality expressions
CREATE INDEX IF NOT EXISTS idx_expression_index_quality ON expression_index(excellence_score DESC);

-- Index for semantic search (requires pgvector extension)
CREATE INDEX IF NOT EXISTS idx_expression_index_embedding ON expression_index USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_expression_index_user ON expression_index(user_id);
`;
}

// ═══════════════════════════════════════════════════════════════════
// EXPRESSION CATEGORIES TABLE
// ═══════════════════════════════════════════════════════════════════

/**
 * Expression categories table - category metadata and statistics
 *
 * @param dimension - Embedding vector dimension for centroid
 */
export function createExpressionCategoriesTable(dimension: number): string {
  return `
CREATE TABLE IF NOT EXISTS expression_categories (
  id TEXT PRIMARY KEY,

  -- Human-readable info
  name TEXT NOT NULL,
  description TEXT,

  -- Statistics
  expression_count INTEGER NOT NULL DEFAULT 0,
  avg_excellence_score REAL,

  -- Canonical expression reference
  canonical_expression_id UUID REFERENCES expression_index(id) ON DELETE SET NULL,

  -- Centroid embedding (average of all expressions)
  centroid vector(${dimension}),

  -- Parent category for hierarchical organization
  parent_category_id TEXT REFERENCES expression_categories(id) ON DELETE SET NULL,

  -- User context
  user_id TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for parent category queries
CREATE INDEX IF NOT EXISTS idx_expression_categories_parent ON expression_categories(parent_category_id);

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_expression_categories_user ON expression_categories(user_id);

-- Index for semantic search on centroids
CREATE INDEX IF NOT EXISTS idx_expression_categories_centroid ON expression_categories USING ivfflat (centroid vector_cosine_ops) WITH (lists = 50);
`;
}

// ═══════════════════════════════════════════════════════════════════
// EXPRESSION ANCHORS TABLE
// ═══════════════════════════════════════════════════════════════════

/**
 * Expression anchors table - semantic navigation points
 *
 * @param dimension - Embedding vector dimension
 */
export function createExpressionAnchorsTable(dimension: number): string {
  return `
CREATE TABLE IF NOT EXISTS expression_anchors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Anchor classification
  anchor_type TEXT NOT NULL CHECK (anchor_type IN ('expression', 'category', 'concept', 'quality_gate')),

  -- Anchor text/label
  label TEXT NOT NULL,
  description TEXT,

  -- Embedding for semantic positioning
  embedding vector(${dimension}) NOT NULL,

  -- Quality threshold for this anchor (minimum score to be included)
  quality_threshold INTEGER NOT NULL DEFAULT 60 CHECK (quality_threshold >= 0 AND quality_threshold <= 100),

  -- Linked expressions
  linked_expression_ids UUID[] DEFAULT '{}',
  linked_category_ids TEXT[] DEFAULT '{}',

  -- Anchor strength/prominence
  prominence REAL NOT NULL DEFAULT 1.0 CHECK (prominence >= 0),

  -- User context
  user_id TEXT,
  project_id UUID,

  -- Auto-generated vs user-created
  is_auto_generated BOOLEAN NOT NULL DEFAULT TRUE,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for anchor type queries
CREATE INDEX IF NOT EXISTS idx_expression_anchors_type ON expression_anchors(anchor_type);

-- Index for semantic search
CREATE INDEX IF NOT EXISTS idx_expression_anchors_embedding ON expression_anchors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- Index for user/project queries
CREATE INDEX IF NOT EXISTS idx_expression_anchors_user_project ON expression_anchors(user_id, project_id);

-- Index for quality threshold filtering
CREATE INDEX IF NOT EXISTS idx_expression_anchors_quality ON expression_anchors(quality_threshold);
`;
}

// ═══════════════════════════════════════════════════════════════════
// REFINEMENT HISTORY TABLE
// ═══════════════════════════════════════════════════════════════════

/**
 * Refinement history table - tracks refinement operations on content
 */
export const CREATE_REFINEMENT_HISTORY_TABLE = `
CREATE TABLE IF NOT EXISTS refinement_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source content
  source_node_id TEXT NOT NULL,
  source_text TEXT NOT NULL,

  -- Refined output
  refined_text TEXT NOT NULL,

  -- Quality metrics
  original_score INTEGER,
  refined_score INTEGER,
  quality_improvement INTEGER,

  -- Preservation metrics
  preservation_score REAL NOT NULL CHECK (preservation_score >= 0 AND preservation_score <= 1),
  preservation_acceptable BOOLEAN NOT NULL DEFAULT TRUE,

  -- Extracted insights (JSON array of insight objects)
  extracted_insights JSONB DEFAULT '[]',

  -- Refinement details
  total_passes INTEGER NOT NULL DEFAULT 1,
  refiner_agent_version TEXT,

  -- User context
  user_id TEXT,
  project_id UUID,

  -- Success tracking
  success BOOLEAN NOT NULL DEFAULT FALSE,
  applied BOOLEAN NOT NULL DEFAULT FALSE,
  applied_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for source node queries
CREATE INDEX IF NOT EXISTS idx_refinement_history_source ON refinement_history(source_node_id);

-- Index for successful refinements
CREATE INDEX IF NOT EXISTS idx_refinement_history_success ON refinement_history(success) WHERE success = TRUE;

-- Index for applied refinements
CREATE INDEX IF NOT EXISTS idx_refinement_history_applied ON refinement_history(applied) WHERE applied = TRUE;

-- Index for user/project queries
CREATE INDEX IF NOT EXISTS idx_refinement_history_user_project ON refinement_history(user_id, project_id);
`;

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Get all excellence schema DDL statements
 *
 * @param dimension - Embedding vector dimension (default: 768)
 */
export function getExcellenceSchemaDDL(dimension: number = 768): string[] {
  return [
    CREATE_CONTENT_EXCELLENCE_TABLE,
    createExpressionIndexTable(dimension),
    createExpressionCategoriesTable(dimension),
    createExpressionAnchorsTable(dimension),
    CREATE_REFINEMENT_HISTORY_TABLE,
  ];
}

/**
 * Get table names for the excellence schema
 */
export function getExcellenceTableNames(): string[] {
  return [
    'content_excellence',
    'expression_index',
    'expression_categories',
    'expression_anchors',
    'refinement_history',
  ];
}
