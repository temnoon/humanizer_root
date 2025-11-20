-- Migration 0018: GPTZero Detection & Native Humanizer Schema
-- Created: 2025-11-19
-- Purpose: Add tables for GPTZero detection, Lite detector, and Native humanizer

-- ============================================================================
-- STYLE PROFILES
-- ============================================================================
-- User writing style profiles extracted from samples

CREATE TABLE IF NOT EXISTS style_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  label TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Style card (JSON): tone, rhythm, quirks, avoid
  style_card TEXT NOT NULL,

  -- Computed metrics (JSON): avgSentenceLength, typeTokenRatio, etc.
  metrics_json TEXT NOT NULL,

  -- Embedding metadata
  embedding_dim INTEGER NOT NULL DEFAULT 0,
  embedding_key TEXT,  -- KV key for vector storage

  sample_count INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_style_profiles_user_slug
  ON style_profiles(user_id, slug);

CREATE INDEX IF NOT EXISTS idx_style_profiles_user_id
  ON style_profiles(user_id);

-- ============================================================================
-- STYLE SAMPLES
-- ============================================================================
-- User writing samples used to train style profiles

CREATE TABLE IF NOT EXISTS style_samples (
  id TEXT PRIMARY KEY,
  style_profile_id TEXT NOT NULL,

  text_hash TEXT NOT NULL,  -- SHA-256 hash for deduplication
  source_doc_id TEXT,       -- Optional reference to conversation/doc
  role TEXT NOT NULL,       -- 'user' | 'assistant' | 'system'

  created_at INTEGER NOT NULL,

  FOREIGN KEY (style_profile_id) REFERENCES style_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (text_hash) REFERENCES texts(hash) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_style_samples_profile
  ON style_samples(style_profile_id);

CREATE INDEX IF NOT EXISTS idx_style_samples_text_hash
  ON style_samples(text_hash);

-- ============================================================================
-- DETECTOR RUNS
-- ============================================================================
-- Audit log for all AI detection runs (GPTZero and Lite)

CREATE TABLE IF NOT EXISTS detector_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT,             -- NULL for anonymous
  detector_type TEXT NOT NULL,  -- 'lite' | 'gptzero'

  origin TEXT NOT NULL,     -- 'canvas' | 'archive' | 'api'
  source_doc_id TEXT,       -- Optional reference
  text_hash TEXT NOT NULL,

  -- Detection results
  ai_likelihood REAL NOT NULL,      -- 0-1 scale
  confidence TEXT NOT NULL,         -- 'low' | 'medium' | 'high'
  label TEXT NOT NULL,              -- 'likely_human' | 'mixed' | 'likely_ai'

  -- Detailed metrics (JSON)
  metrics_json TEXT NOT NULL,

  -- Tell-phrases found (JSON array)
  phrase_json TEXT NOT NULL,

  -- Burstiness data (JSON)
  burstiness_json TEXT NOT NULL,

  -- Model/version info
  model_version TEXT NOT NULL,

  -- Text storage (KV reference)
  original_text_key TEXT NOT NULL,  -- KV key for full text

  -- Quota tracking (GPTZero only)
  quota_used INTEGER,          -- Words consumed
  quota_remaining INTEGER,     -- Words left after this run

  created_at INTEGER NOT NULL,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (text_hash) REFERENCES texts(hash) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_detector_runs_user_time
  ON detector_runs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_detector_runs_type
  ON detector_runs(detector_type);

CREATE INDEX IF NOT EXISTS idx_detector_runs_text_hash
  ON detector_runs(text_hash);

-- ============================================================================
-- HUMANIZER SESSIONS
-- ============================================================================
-- Native humanizer transformation sessions

CREATE TABLE IF NOT EXISTS humanizer_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  style_profile_id TEXT,  -- NULL for default/no style

  -- Humanization parameters
  goal TEXT NOT NULL,       -- 'personalize' | 'de-template' | 'concretize' | 'simplify'
  max_changes TEXT NOT NULL,  -- 'light' | 'medium' | 'heavy'

  origin TEXT NOT NULL,     -- 'canvas' | 'archive' | 'api'
  source_doc_id TEXT,

  -- Text references
  original_text_hash TEXT NOT NULL,
  rewritten_text_hash TEXT,

  -- Transformation plan (JSON): what changes were planned
  plan_json TEXT NOT NULL,

  -- Metrics comparison (JSON)
  before_metrics_json TEXT NOT NULL,
  after_metrics_json TEXT,

  -- Related detector run
  detector_run_id TEXT,

  -- Text storage (KV references)
  original_text_key TEXT NOT NULL,
  rewritten_text_key TEXT,

  -- Status tracking
  status TEXT NOT NULL,  -- 'pending' | 'processing' | 'completed' | 'failed'
  error_message TEXT,

  -- Model/version info
  model_version TEXT NOT NULL,

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (style_profile_id) REFERENCES style_profiles(id) ON DELETE SET NULL,
  FOREIGN KEY (detector_run_id) REFERENCES detector_runs(id) ON DELETE SET NULL,
  FOREIGN KEY (original_text_hash) REFERENCES texts(hash) ON DELETE CASCADE,
  FOREIGN KEY (rewritten_text_hash) REFERENCES texts(hash) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_humanizer_sessions_user_time
  ON humanizer_sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_humanizer_sessions_style_profile
  ON humanizer_sessions(style_profile_id);

CREATE INDEX IF NOT EXISTS idx_humanizer_sessions_status
  ON humanizer_sessions(status);

-- ============================================================================
-- TEXTS (Shared Blob Storage)
-- ============================================================================
-- Deduplicated text blobs referenced by hash

CREATE TABLE IF NOT EXISTS texts (
  hash TEXT PRIMARY KEY,      -- SHA-256 hash
  length INTEGER NOT NULL,    -- Character count
  kv_key TEXT NOT NULL,       -- KV storage key: text:<hash>
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_texts_length
  ON texts(length);

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- No initial data for this migration (users will create their own style profiles)

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Tables created:
-- - style_profiles: User writing style profiles
-- - style_samples: Training data for style profiles
-- - detector_runs: AI detection audit log (both GPTZero and Lite)
-- - humanizer_sessions: Native humanizer transformation sessions
-- - texts: Deduplicated text blob storage
