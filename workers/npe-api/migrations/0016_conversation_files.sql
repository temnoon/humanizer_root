-- Migration 0016: Conversation File Relationships
-- Created: 2025-11-12
-- Purpose: Link conversation JSON files with their media files (images, etc.)

-- Add parent_file_id to track file relationships
ALTER TABLE encrypted_files ADD COLUMN parent_file_id TEXT;
ALTER TABLE encrypted_files ADD COLUMN file_role TEXT; -- 'conversation', 'image', 'attachment', etc.
ALTER TABLE encrypted_files ADD COLUMN relative_path TEXT; -- Path within original folder (e.g., "images/screenshot.png")

-- Foreign key to link media files to their parent conversation
CREATE INDEX IF NOT EXISTS idx_encrypted_files_parent ON encrypted_files(parent_file_id) WHERE parent_file_id IS NOT NULL;

-- Index for finding conversation files
CREATE INDEX IF NOT EXISTS idx_encrypted_files_role ON encrypted_files(file_role) WHERE file_role IS NOT NULL;
