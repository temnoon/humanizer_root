-- Migration 0015: Add Conversation Metadata
-- Created: 2025-11-12
-- Purpose: Store parsed conversation metadata for archive files

-- Add conversation metadata columns to encrypted_files
ALTER TABLE encrypted_files ADD COLUMN conversation_title TEXT;
ALTER TABLE encrypted_files ADD COLUMN conversation_provider TEXT; -- 'chatgpt', 'claude', or NULL for non-conversations
ALTER TABLE encrypted_files ADD COLUMN conversation_id TEXT;
ALTER TABLE encrypted_files ADD COLUMN conversation_created_at INTEGER;
ALTER TABLE encrypted_files ADD COLUMN conversation_updated_at INTEGER;
ALTER TABLE encrypted_files ADD COLUMN message_count INTEGER;
ALTER TABLE encrypted_files ADD COLUMN has_images INTEGER DEFAULT 0; -- SQLite boolean (0/1)
ALTER TABLE encrypted_files ADD COLUMN has_code INTEGER DEFAULT 0;
ALTER TABLE encrypted_files ADD COLUMN first_message TEXT; -- Preview (first 200 chars)

-- Index for finding conversations
CREATE INDEX IF NOT EXISTS idx_encrypted_files_provider ON encrypted_files(conversation_provider) WHERE conversation_provider IS NOT NULL;
