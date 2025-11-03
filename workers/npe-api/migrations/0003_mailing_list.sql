-- Migration: Add mailing_list table for email signups
-- Created: 2025-11-03

CREATE TABLE IF NOT EXISTS mailing_list (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  interest_comment TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_mailing_list_email ON mailing_list(email);

-- Index for sorting by creation date
CREATE INDEX IF NOT EXISTS idx_mailing_list_created_at ON mailing_list(created_at DESC);
