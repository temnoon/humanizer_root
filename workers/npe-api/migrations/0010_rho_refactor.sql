-- Migration 0010: ρ-Centric Schema Refactor
-- Philosophy: "Agent in Field of Agency" - ρ as first-class persistent object
-- Date: 2025-11-09
--
-- Core Ontology:
-- - Narrative = text + metadata (mortal, mutable)
-- - ρ (Narrative State) = quantum state (persistent, versioned, immortal)
-- - Lineage = genealogical graph (transformations create descendants, not versions)
--
-- Breaking Change: Complete schema redesign, V1 tables will be dropped after migration

-- ============================================================================
-- TABLE 1: Narratives (Text + Embeddings + Metadata)
-- ============================================================================
-- Narratives are the "bodies" that carry meaning. They are mutable, searchable,
-- and soft-deletable. Each narrative has one or more ρ states across its lifetime.

CREATE TABLE IF NOT EXISTS narratives (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  text TEXT NOT NULL,
  embedding_vector TEXT, -- JSON array: 768-dimensional BGE embedding
  source TEXT NOT NULL CHECK (source IN ('user_upload', 'transformation', 'import')),
  title TEXT,
  created_at INTEGER NOT NULL, -- Unix timestamp (milliseconds)
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER, -- Soft delete: NULL = active, timestamp = deleted
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_narratives_user ON narratives(user_id);
CREATE INDEX IF NOT EXISTS idx_narratives_source ON narratives(source);
CREATE INDEX IF NOT EXISTS idx_narratives_deleted ON narratives(deleted_at);
CREATE INDEX IF NOT EXISTS idx_narratives_created ON narratives(created_at DESC);

-- ============================================================================
-- TABLE 2: Narrative States (ρ - Density Matrices)
-- ============================================================================
-- The quantum state of a narrative. This is the phenomenological heart of the system.
-- Each ρ encodes the distribution of interpretive possibilities (eigenvalue spectrum).
--
-- Scope: ρ can exist at multiple granularities:
--   'narrative' - whole narrative has single ρ
--   'sentence'  - each sentence has its own ρ
--   'paragraph' - each paragraph has its own ρ
--
-- Key Insight: ρ is PERSISTENT and VERSIONED. Transformations and measurements
-- create NEW ρ records, never overwrite. This enables lineage tracking.

CREATE TABLE IF NOT EXISTS narrative_states (
  id TEXT PRIMARY KEY,
  narrative_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('narrative', 'sentence', 'paragraph')),
  scope_index INTEGER, -- NULL for narrative-level, sentence# for sentence/paragraph-level
  eigenvalues TEXT NOT NULL, -- JSON array: 32 eigenvalues (diagonal of ρ)
  purity REAL NOT NULL, -- Tr(ρ²) ∈ [1/32, 1], measures "mixedness"
  entropy REAL NOT NULL, -- -Tr(ρ log ρ), von Neumann entropy
  trace REAL NOT NULL DEFAULT 1.0, -- Should always be 1.0 (normalization check)
  coherence REAL, -- Optional: POVM measurement coherence if from measurement
  full_matrix_blob BLOB, -- Optional: full 32×32 matrix for high-fidelity operations
  created_at INTEGER NOT NULL,
  FOREIGN KEY (narrative_id) REFERENCES narratives(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_narrative_states_narrative ON narrative_states(narrative_id);
CREATE INDEX IF NOT EXISTS idx_narrative_states_scope ON narrative_states(narrative_id, scope, scope_index);
CREATE INDEX IF NOT EXISTS idx_narrative_states_created ON narrative_states(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_narrative_states_purity ON narrative_states(purity); -- For filtering by mixedness

-- ============================================================================
-- TABLE 3: Narrative Lineages (Genealogical Graph)
-- ============================================================================
-- Lineages track how narratives beget other narratives through transformations.
-- Unlike version control (which tracks mutations), lineages track BIRTHS.
--
-- Key Metaphor: "Genetic influence fades, but organizational legacy remains"
-- - Allegorical projection: parent "Romeo and Juliet" → child "Star-crossed lovers in quantum universe"
-- - Round-trip translation: parent (English) → child (English via Japanese)
-- - Measurement collapse: parent ρ → child ρ' (post-measurement)
--
-- influence_strength: Models how strongly parent affects child (1.0 = direct, decays over generations)

CREATE TABLE IF NOT EXISTS narrative_lineages (
  id TEXT PRIMARY KEY,
  parent_narrative_id TEXT NOT NULL,
  child_narrative_id TEXT NOT NULL,
  parent_rho_id TEXT, -- Which ρ state of parent was used
  child_rho_id TEXT, -- Which ρ state resulted in child
  operation_type TEXT NOT NULL CHECK (operation_type IN ('transform', 'measure', 'edit')),
  operation_id TEXT, -- FK to transformation_operations.id (audit trail)
  transformation_type TEXT, -- 'allegorical' | 'round_trip' | 'personalizer' | 'maieutic' | 'ai_detect'
  params TEXT, -- JSON: transformation parameters (persona, namespace, style, etc.)
  influence_strength REAL NOT NULL DEFAULT 1.0, -- Genetic influence decay [0.0, 1.0]
  created_at INTEGER NOT NULL,
  FOREIGN KEY (parent_narrative_id) REFERENCES narratives(id) ON DELETE CASCADE,
  FOREIGN KEY (child_narrative_id) REFERENCES narratives(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_rho_id) REFERENCES narrative_states(id) ON DELETE SET NULL,
  FOREIGN KEY (child_rho_id) REFERENCES narrative_states(id) ON DELETE SET NULL,
  FOREIGN KEY (operation_id) REFERENCES transformation_operations(id) ON DELETE SET NULL,
  CHECK (parent_narrative_id != child_narrative_id) -- No self-loops
);

CREATE INDEX IF NOT EXISTS idx_lineages_parent ON narrative_lineages(parent_narrative_id);
CREATE INDEX IF NOT EXISTS idx_lineages_child ON narrative_lineages(child_narrative_id);
CREATE INDEX IF NOT EXISTS idx_lineages_operation ON narrative_lineages(operation_id);
CREATE INDEX IF NOT EXISTS idx_lineages_type ON narrative_lineages(transformation_type);

-- ============================================================================
-- TABLE 4: Transformation Operations (Audit Log)
-- ============================================================================
-- Every transformation (allegorical, round-trip, etc.) creates a record here.
-- This provides audit trail and links to lineage graph.
--
-- Status: 'pending' | 'running' | 'completed' | 'failed'

CREATE TABLE IF NOT EXISTS transformation_operations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('transform', 'measure')),
  transformation_type TEXT, -- Specific transform: 'allegorical' | 'round_trip' | etc.
  input_narrative_id TEXT NOT NULL,
  output_narrative_id TEXT, -- NULL if operation failed
  input_rho_id TEXT NOT NULL,
  output_rho_id TEXT, -- NULL if operation failed or in progress
  params TEXT, -- JSON: full transformation config
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message TEXT,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (input_narrative_id) REFERENCES narratives(id) ON DELETE CASCADE,
  FOREIGN KEY (output_narrative_id) REFERENCES narratives(id) ON DELETE SET NULL,
  FOREIGN KEY (input_rho_id) REFERENCES narrative_states(id) ON DELETE CASCADE,
  FOREIGN KEY (output_rho_id) REFERENCES narrative_states(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_operations_user ON transformation_operations(user_id);
CREATE INDEX IF NOT EXISTS idx_operations_status ON transformation_operations(status);
CREATE INDEX IF NOT EXISTS idx_operations_type ON transformation_operations(transformation_type);
CREATE INDEX IF NOT EXISTS idx_operations_created ON transformation_operations(created_at DESC);

-- ============================================================================
-- TABLE 5: POVM Packs (Measurement Axis Definitions)
-- ============================================================================
-- POVMs are measurement bases. Each pack defines a set of aspects to measure.
-- Example: Tetralemma pack has 4 aspects (literal, metaphorical, both, neither)
--
-- This replaces the static npe_personas/namespaces/styles config tables.

CREATE TABLE IF NOT EXISTS povm_packs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  pack_type TEXT NOT NULL CHECK (pack_type IN ('tetralemma', 'tone', 'ontology', 'pragmatics', 'custom')),
  axes TEXT NOT NULL, -- JSON array of axis definitions: [{name, description, corners: []}]
  is_system INTEGER NOT NULL DEFAULT 0, -- 1 = system-defined, 0 = user-defined
  user_id TEXT, -- NULL for system packs, set for custom user packs
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_povm_packs_type ON povm_packs(pack_type);
CREATE INDEX IF NOT EXISTS idx_povm_packs_user ON povm_packs(user_id);

-- ============================================================================
-- TABLE 6: Quantum Sessions (Multi-Step Measurements)
-- ============================================================================
-- For operations that unfold over time (quantum reading, maieutic dialogue).
-- Each session tracks a sequence of ρ states evolving through measurements.

CREATE TABLE IF NOT EXISTS quantum_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_type TEXT NOT NULL CHECK (session_type IN ('quantum_reading', 'maieutic_dialogue')),
  root_narrative_id TEXT NOT NULL, -- Starting narrative
  current_narrative_id TEXT, -- Current narrative (may change during session)
  current_rho_id TEXT, -- Current ρ state
  total_steps INTEGER NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  metadata TEXT, -- JSON: session-specific data (maieutic depth, reading progress, etc.)
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (root_narrative_id) REFERENCES narratives(id) ON DELETE CASCADE,
  FOREIGN KEY (current_narrative_id) REFERENCES narratives(id) ON DELETE SET NULL,
  FOREIGN KEY (current_rho_id) REFERENCES narrative_states(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_quantum_sessions_user ON quantum_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_quantum_sessions_status ON quantum_sessions(status);
CREATE INDEX IF NOT EXISTS idx_quantum_sessions_type ON quantum_sessions(session_type);

-- ============================================================================
-- SEED DATA: Default POVM Packs
-- ============================================================================

INSERT OR IGNORE INTO povm_packs (id, name, description, pack_type, axes, is_system, created_at) VALUES
(
  'default_tetralemma',
  'Tetralemma (Literalness)',
  'Four-corner Buddhist logic: literal, metaphorical, both, neither',
  'tetralemma',
  '[{"name":"literalness","description":"Measures literal vs metaphorical interpretation","corners":["literal","metaphorical","both","neither"]}]',
  1,
  unixepoch() * 1000
),
(
  'tone_analysis',
  'Tone Analysis',
  'Emotional and stylistic tone measurement',
  'tone',
  '[{"name":"affect","description":"Emotional valence","corners":["positive","negative","neutral","mixed"]},{"name":"formality","description":"Formal vs casual tone","corners":["formal","casual","technical","conversational"]}]',
  1,
  unixepoch() * 1000
);

-- ============================================================================
-- NOTES FOR MIGRATION
-- ============================================================================
-- After this migration:
-- 1. Run data migration script to populate narratives/narrative_states from old tables
-- 2. Verify data integrity
-- 3. Drop old tables in migration 0011
-- 4. Update all API routes to use new schema
