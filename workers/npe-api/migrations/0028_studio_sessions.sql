-- Migration 0028: Studio Sessions
-- Created: Dec 6, 2025
-- Purpose: Cloud-compatible session storage for Narrative Studio
-- Context: Replaces local-only archive-server session storage
--          Works with D1 in cloud, emulated D1 locally, and SQLite in Electron

-- ============================================================================
-- STUDIO_SESSIONS: Workspace state with buffers
-- ============================================================================
-- Stores the full session state including all buffers as a JSON blob.
-- This matches the frontend Session interface from sessionStorage.ts

CREATE TABLE IF NOT EXISTS studio_sessions (
  -- Primary key (matches frontend sessionId format: "session-{timestamp}")
  id TEXT PRIMARY KEY,

  -- User ownership (foreign key to users table)
  user_id TEXT NOT NULL,

  -- Session metadata
  name TEXT NOT NULL,
  source_archive TEXT DEFAULT 'main',
  source_message_id TEXT,

  -- View state
  view_mode TEXT DEFAULT 'single-original' CHECK (view_mode IN ('split', 'single-original', 'single-transformed')),
  active_buffer_id TEXT,

  -- Buffers stored as JSON array
  -- Each buffer: {bufferId, type, displayName, sourceBufferId, sourceRef,
  --               sourceSelection, tool, settings, text, resultText,
  --               analysisResult, metadata, userEdits, isEdited, created}
  buffers TEXT NOT NULL DEFAULT '[]',

  -- Timestamps (ISO 8601 strings to match frontend format)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  -- Foreign key constraint
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_studio_sessions_user ON studio_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_studio_sessions_updated ON studio_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_sessions_user_updated ON studio_sessions(user_id, updated_at DESC);

-- ============================================================================
-- Notes on Schema Design:
-- ============================================================================
--
-- 1. Buffers as JSON: We store buffers as a JSON blob rather than normalized
--    tables because:
--    - Frontend expects this structure
--    - Buffer count per session is small (typically 2-10)
--    - Avoids complex joins for session load
--    - Matches archive-server's file-based storage
--
-- 2. Timestamps as TEXT: Using ISO 8601 strings instead of INTEGER unix
--    timestamps because:
--    - Frontend uses Date.toISOString()
--    - Easier to debug/read
--    - SQLite handles TEXT dates well
--
-- 3. Future: Could add encrypted_buffers column for zero-trust mode
--    where buffers are encrypted client-side before storage
