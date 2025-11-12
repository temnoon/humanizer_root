-- Migration 0014: Encrypted Archive Storage
-- Created: 2025-11-12
-- Purpose: Store user-uploaded encrypted files for secure archive

-- Encrypted files table
CREATE TABLE IF NOT EXISTS encrypted_files (
  id TEXT PRIMARY KEY,                -- UUID for file
  user_id TEXT NOT NULL,              -- Owner of the file
  filename TEXT NOT NULL,             -- Original filename
  content_type TEXT NOT NULL,         -- MIME type (text/plain, application/json, etc.)
  size INTEGER NOT NULL,              -- File size in bytes (encrypted)
  iv TEXT NOT NULL,                   -- Initialization vector for AES-GCM (JSON array)
  r2_key TEXT NOT NULL,               -- R2 storage key (user_id/file_id)
  folder TEXT,                        -- Optional folder/category (e.g., "ChatGPT Export 2024-11-12")
  created_at INTEGER NOT NULL,        -- Unix timestamp
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_encrypted_files_user ON encrypted_files(user_id);
CREATE INDEX IF NOT EXISTS idx_encrypted_files_user_folder ON encrypted_files(user_id, folder);
CREATE INDEX IF NOT EXISTS idx_encrypted_files_created ON encrypted_files(created_at DESC);

-- User encryption settings table
-- Stores salt for key derivation (per user, not per file)
CREATE TABLE IF NOT EXISTS user_encryption_settings (
  user_id TEXT PRIMARY KEY,
  salt TEXT NOT NULL,                 -- Base64-encoded salt for PBKDF2
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
