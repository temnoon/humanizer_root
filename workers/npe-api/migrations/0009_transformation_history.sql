-- Migration 0009: Transformation History & Persistence
-- Created: 2025-11-08
-- Purpose: Add transformation history for users with tier-based quotas

-- Transformation history table
CREATE TABLE IF NOT EXISTS transformation_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  transformation_type TEXT NOT NULL, -- 'allegorical', 'round-trip', 'maieutic', 'ai-detection'
  input_text TEXT NOT NULL,
  input_params TEXT, -- JSON with additional parameters (persona, namespace, language, etc.)
  output_data TEXT, -- JSON with full transformation results
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  error_message TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  is_favorite INTEGER DEFAULT 0, -- 0 or 1 for boolean
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transformation_history_user_id ON transformation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_transformation_history_created_at ON transformation_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transformation_history_status ON transformation_history(status);
CREATE INDEX IF NOT EXISTS idx_transformation_history_type ON transformation_history(transformation_type);
CREATE INDEX IF NOT EXISTS idx_transformation_history_user_type ON transformation_history(user_id, transformation_type);
CREATE INDEX IF NOT EXISTS idx_transformation_history_user_created ON transformation_history(user_id, created_at DESC);

-- Storage quotas (enforced in application code):
-- FREE: 10 transformations or 30 days retention
-- MEMBER: 50 transformations or 90 days retention
-- PRO: 200 transformations or 1 year retention
-- PREMIUM: Unlimited (permanent retention)
-- ADMIN: Unlimited (permanent retention)
