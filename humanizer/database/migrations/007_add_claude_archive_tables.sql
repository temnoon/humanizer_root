-- Migration 007: Add Claude Archive Tables
-- Created: 2025-10-25
-- Description: Adds tables for importing and managing Claude/Anthropic conversation archives
--
-- Philosophy: Support multiple AI conversation archives for comprehensive self-knowledge
--
-- Tables:
-- 1. claude_conversations - Full conversation records from Claude exports
-- 2. claude_messages - Individual messages within conversations
-- 3. claude_media - Media files (images, attachments) referenced in messages
-- 4. claude_projects - Projects with embedded documentation (Claude-specific feature)
-- 5. claude_provenance - Tracks which archives contributed to each conversation

-- ===================================================================
-- 1. Create claude_projects table (referenced by conversations)
-- ===================================================================

CREATE TABLE IF NOT EXISTS claude_projects (
    uuid UUID PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    is_private BOOLEAN NOT NULL DEFAULT true,
    is_starter_project BOOLEAN NOT NULL DEFAULT false,
    prompt_template TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    creator_uuid UUID,
    docs JSONB,  -- Array of project document objects
    custom_metadata JSONB NOT NULL DEFAULT '{}'
);

-- Indexes for claude_projects
CREATE INDEX IF NOT EXISTS idx_claude_projects_created_at ON claude_projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_claude_projects_creator_uuid ON claude_projects(creator_uuid);
CREATE INDEX IF NOT EXISTS idx_claude_projects_is_private ON claude_projects(is_private);

COMMENT ON TABLE claude_projects IS 'Claude Projects - organizational containers for conversations and documentation';
COMMENT ON COLUMN claude_projects.docs IS 'Array of embedded project documents';
COMMENT ON COLUMN claude_projects.custom_metadata IS 'Full original JSON from Claude export';

-- ===================================================================
-- 2. Create claude_conversations table
-- ===================================================================

CREATE TABLE IF NOT EXISTS claude_conversations (
    uuid UUID PRIMARY KEY,
    name TEXT,
    summary TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    account_uuid UUID,  -- User account UUID from Claude
    project_uuid UUID REFERENCES claude_projects(uuid) ON DELETE SET NULL,
    source_archive VARCHAR(100) NOT NULL,  -- e.g., "data-2025-10-25"
    custom_metadata JSONB NOT NULL DEFAULT '{}'
);

-- Indexes for claude_conversations
CREATE INDEX IF NOT EXISTS idx_claude_conversations_created_at ON claude_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_claude_conversations_updated_at ON claude_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_claude_conversations_account_uuid ON claude_conversations(account_uuid);
CREATE INDEX IF NOT EXISTS idx_claude_conversations_project_uuid ON claude_conversations(project_uuid);
CREATE INDEX IF NOT EXISTS idx_claude_conversations_source_archive ON claude_conversations(source_archive);
CREATE INDEX IF NOT EXISTS idx_claude_conversations_name ON claude_conversations USING gin(to_tsvector('english', name));

COMMENT ON TABLE claude_conversations IS 'Claude conversations from archive exports';
COMMENT ON COLUMN claude_conversations.uuid IS 'Claude conversation UUID (primary key)';
COMMENT ON COLUMN claude_conversations.account_uuid IS 'User account UUID from Claude export';
COMMENT ON COLUMN claude_conversations.project_uuid IS 'Associated project (Claude-specific feature)';
COMMENT ON COLUMN claude_conversations.source_archive IS 'Primary archive source (e.g., data-2025-10-25)';
COMMENT ON COLUMN claude_conversations.custom_metadata IS 'Full original JSON from Claude export';

-- ===================================================================
-- 3. Create claude_messages table
-- ===================================================================

CREATE TABLE IF NOT EXISTS claude_messages (
    uuid UUID PRIMARY KEY,
    conversation_uuid UUID NOT NULL REFERENCES claude_conversations(uuid) ON DELETE CASCADE,
    sender VARCHAR(20) NOT NULL,  -- 'human' or 'assistant'
    text TEXT,  -- Extracted text for search
    content_blocks JSONB,  -- Original content array structure
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    custom_metadata JSONB NOT NULL DEFAULT '{}',
    embedding vector(1024)  -- Semantic embedding for similarity search
);

-- Indexes for claude_messages
CREATE INDEX IF NOT EXISTS idx_claude_messages_conversation_uuid ON claude_messages(conversation_uuid);
CREATE INDEX IF NOT EXISTS idx_claude_messages_sender ON claude_messages(sender);
CREATE INDEX IF NOT EXISTS idx_claude_messages_created_at ON claude_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_claude_messages_text_search ON claude_messages USING gin(to_tsvector('english', text));

-- Vector similarity search index (if using pgvector)
CREATE INDEX IF NOT EXISTS idx_claude_messages_embedding ON claude_messages USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

COMMENT ON TABLE claude_messages IS 'Individual messages within Claude conversations';
COMMENT ON COLUMN claude_messages.uuid IS 'Claude message UUID (primary key)';
COMMENT ON COLUMN claude_messages.sender IS 'Message author: human or assistant';
COMMENT ON COLUMN claude_messages.text IS 'Extracted text content for full-text search';
COMMENT ON COLUMN claude_messages.content_blocks IS 'Original content array from Claude (may include timestamps, citations)';
COMMENT ON COLUMN claude_messages.embedding IS '1024-dim semantic embedding for similarity search';
COMMENT ON COLUMN claude_messages.custom_metadata IS 'Full original JSON from Claude export';

-- ===================================================================
-- 4. Create claude_media table
-- ===================================================================

CREATE TABLE IF NOT EXISTS claude_media (
    id SERIAL PRIMARY KEY,
    conversation_uuid UUID NOT NULL REFERENCES claude_conversations(uuid) ON DELETE CASCADE,
    message_uuid UUID REFERENCES claude_messages(uuid) ON DELETE CASCADE,
    file_name VARCHAR(500) NOT NULL,
    file_path TEXT,  -- Actual file path on disk
    file_type VARCHAR(50),  -- txt, image, pdf, etc
    file_size INTEGER,  -- Bytes
    extracted_content TEXT,  -- For text attachments with extracted content
    source_archive VARCHAR(100),
    mime_type VARCHAR(100),
    file_metadata JSONB
);

-- Indexes for claude_media
CREATE INDEX IF NOT EXISTS idx_claude_media_conversation_uuid ON claude_media(conversation_uuid);
CREATE INDEX IF NOT EXISTS idx_claude_media_message_uuid ON claude_media(message_uuid);
CREATE INDEX IF NOT EXISTS idx_claude_media_file_name ON claude_media(file_name);
CREATE INDEX IF NOT EXISTS idx_claude_media_file_type ON claude_media(file_type);
CREATE INDEX IF NOT EXISTS idx_claude_media_source_archive ON claude_media(source_archive);

COMMENT ON TABLE claude_media IS 'Media files (images, attachments) referenced in Claude messages';
COMMENT ON COLUMN claude_media.file_name IS 'Original file name (e.g., image.jpg, paste.txt)';
COMMENT ON COLUMN claude_media.file_path IS 'Actual file path in archive (e.g., /tmp/UUID/image.jpg)';
COMMENT ON COLUMN claude_media.file_type IS 'File type: txt, image, pdf, etc';
COMMENT ON COLUMN claude_media.extracted_content IS 'For text attachments, the extracted text content from Claude';
COMMENT ON COLUMN claude_media.source_archive IS 'Which archive contains this file';

-- ===================================================================
-- 5. Create claude_provenance table
-- ===================================================================

CREATE TABLE IF NOT EXISTS claude_provenance (
    conversation_uuid UUID NOT NULL REFERENCES claude_conversations(uuid) ON DELETE CASCADE,
    archive_name VARCHAR(100) NOT NULL,  -- e.g., "data-2025-10-25"
    archive_date TIMESTAMPTZ,
    message_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (conversation_uuid, archive_name)
);

-- Indexes for claude_provenance
CREATE INDEX IF NOT EXISTS idx_claude_provenance_archive_name ON claude_provenance(archive_name);
CREATE INDEX IF NOT EXISTS idx_claude_provenance_archive_date ON claude_provenance(archive_date DESC);

COMMENT ON TABLE claude_provenance IS 'Tracks which archives contributed to each conversation';
COMMENT ON COLUMN claude_provenance.archive_name IS 'Archive identifier (e.g., data-2025-10-25)';
COMMENT ON COLUMN claude_provenance.archive_date IS 'When archive was created/exported';
COMMENT ON COLUMN claude_provenance.message_count IS 'Number of messages from this archive';

-- ===================================================================
-- Grant permissions (if needed for multi-user setup)
-- ===================================================================

-- GRANT SELECT, INSERT, UPDATE, DELETE ON claude_projects TO humanizer_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON claude_conversations TO humanizer_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON claude_messages TO humanizer_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON claude_media TO humanizer_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON claude_provenance TO humanizer_app;
-- GRANT USAGE, SELECT ON SEQUENCE claude_media_id_seq TO humanizer_app;

-- ===================================================================
-- Migration complete
-- ===================================================================

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration 007 complete: Claude archive tables created successfully';
    RAISE NOTICE 'Tables: claude_projects, claude_conversations, claude_messages, claude_media, claude_provenance';
    RAISE NOTICE 'Ready to import Claude/Anthropic conversation archives';
END $$;
