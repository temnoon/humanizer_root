-- Migration 0013: Narrative Session Architecture
-- Created: Nov 12, 2025
-- Purpose: Add persistence for narratives, operations, and narrative-linked quantum sessions
-- Context: Enables Canvas-as-pipeline workflow, fixes Sessions panel 404

-- ============================================================================
-- NARRATIVES: Root validated narrative texts
-- ============================================================================
CREATE TABLE IF NOT EXISTS narratives (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  source_text TEXT NOT NULL,
  validation_score REAL,  -- 0.0-1.0, from 6-criteria validation
  word_count INTEGER,
  created_at INTEGER NOT NULL,  -- Unix timestamp (ms)
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_narratives_user ON narratives(user_id);
CREATE INDEX IF NOT EXISTS idx_narratives_created ON narratives(created_at);
CREATE INDEX IF NOT EXISTS idx_narratives_user_created ON narratives(user_id, created_at);


-- ============================================================================
-- OPERATIONS: Linear session history (transformation pipeline)
-- ============================================================================
CREATE TABLE IF NOT EXISTS operations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  narrative_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,  -- 'allegorical', 'round_trip', 'maieutic', etc.
  input_text TEXT NOT NULL,
  output_text TEXT,  -- NULL if operation failed
  params TEXT NOT NULL,  -- JSON string of operation parameters (for reproducibility)
  status TEXT DEFAULT 'completed',  -- 'pending', 'in_progress', 'completed', 'failed'
  duration_ms INTEGER,
  created_at INTEGER NOT NULL,  -- Unix timestamp (ms)
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (narrative_id) REFERENCES narratives(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_operations_user ON operations(user_id);
CREATE INDEX IF NOT EXISTS idx_operations_narrative ON operations(narrative_id);
CREATE INDEX IF NOT EXISTS idx_operations_created ON operations(created_at);
CREATE INDEX IF NOT EXISTS idx_operations_status ON operations(status);
CREATE INDEX IF NOT EXISTS idx_operations_narrative_created ON operations(narrative_id, created_at);
CREATE INDEX IF NOT EXISTS idx_operations_user_created ON operations(user_id, created_at);


-- ============================================================================
-- QUANTUM_SESSIONS: Narrative-linked quantum reading sessions
-- ============================================================================
-- Note: This coexists with quantum_analysis_sessions (migration 0007) for backward compat
-- quantum_analysis_sessions: standalone quantum reading (text embedded in session)
-- quantum_sessions: narrative-linked quantum reading (references narratives table)
CREATE TABLE IF NOT EXISTS quantum_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  narrative_id TEXT NOT NULL,
  title TEXT,
  sentence_count INTEGER,
  current_position INTEGER DEFAULT 0,
  status TEXT DEFAULT 'in_progress',  -- 'in_progress', 'completed', 'abandoned'
  created_at INTEGER NOT NULL,  -- Unix timestamp (ms)
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (narrative_id) REFERENCES narratives(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_quantum_sessions_user ON quantum_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_quantum_sessions_narrative ON quantum_sessions(narrative_id);
CREATE INDEX IF NOT EXISTS idx_quantum_sessions_created ON quantum_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_quantum_sessions_status ON quantum_sessions(status);


-- ============================================================================
-- QUANTUM_SESSION_MEASUREMENTS: Sentence-level measurements for narrative sessions
-- ============================================================================
-- Note: Named quantum_session_measurements to distinguish from quantum_measurements (migration 0007)
-- quantum_measurements: linked to quantum_analysis_sessions (standalone)
-- quantum_session_measurements: linked to quantum_sessions (narrative-based)
CREATE TABLE IF NOT EXISTS quantum_session_measurements (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  sentence_index INTEGER NOT NULL,
  sentence_text TEXT NOT NULL,
  rho_before TEXT NOT NULL,  -- JSON string of density matrix state before measurement
  rho_after TEXT NOT NULL,   -- JSON string of density matrix state after measurement
  povm_result TEXT NOT NULL, -- JSON string of POVM measurement result (Tetralemma + evidence)
  coherence REAL,             -- Measurement coherence score (0.0-1.0)
  created_at INTEGER NOT NULL,  -- Unix timestamp (ms)
  FOREIGN KEY (session_id) REFERENCES quantum_sessions(id) ON DELETE CASCADE,
  UNIQUE(session_id, sentence_index)
);

CREATE INDEX IF NOT EXISTS idx_quantum_session_measurements_session ON quantum_session_measurements(session_id);
CREATE INDEX IF NOT EXISTS idx_quantum_session_measurements_sentence_idx ON quantum_session_measurements(session_id, sentence_index);
CREATE INDEX IF NOT EXISTS idx_quantum_session_measurements_created ON quantum_session_measurements(created_at);
