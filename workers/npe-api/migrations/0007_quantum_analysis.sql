-- Migration 0007: Quantum Reading Analysis
-- Created: Nov 3, 2025
-- Purpose: Enable quantum reading analysis feature with density matrix tracking

-- Quantum analysis sessions
CREATE TABLE IF NOT EXISTS quantum_analysis_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  text TEXT NOT NULL,
  total_sentences INTEGER NOT NULL,
  current_sentence INTEGER DEFAULT 0,
  initial_rho_json TEXT,  -- Serialized initial density matrix state
  current_rho_json TEXT,   -- Current density matrix state
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Quantum measurements (one per sentence per session)
CREATE TABLE IF NOT EXISTS quantum_measurements (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  sentence_index INTEGER NOT NULL,
  sentence TEXT NOT NULL,

  -- Tetralemma probabilities (must sum to 1.0)
  prob_literal REAL NOT NULL,
  prob_metaphorical REAL NOT NULL,
  prob_both REAL NOT NULL,
  prob_neither REAL NOT NULL,

  -- Evidence for each corner
  evidence_literal TEXT,
  evidence_metaphorical TEXT,
  evidence_both TEXT,
  evidence_neither TEXT,

  -- Density matrix state after this measurement
  rho_purity REAL NOT NULL,           -- Tr(ρ²), range [1/32, 1]
  rho_entropy REAL NOT NULL,          -- -Tr(ρ log ρ), range [0, ln(32)]
  rho_top_eigenvalues TEXT NOT NULL,  -- JSON array of top 5 eigenvalues

  -- Metadata
  embedding_vector TEXT,  -- Optional: store sentence embedding
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (session_id) REFERENCES quantum_analysis_sessions(id) ON DELETE CASCADE,
  UNIQUE(session_id, sentence_index)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quantum_sessions_user ON quantum_analysis_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_quantum_sessions_created ON quantum_analysis_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_quantum_measurements_session ON quantum_measurements(session_id);
CREATE INDEX IF NOT EXISTS idx_quantum_measurements_sentence_idx ON quantum_measurements(session_id, sentence_index);
