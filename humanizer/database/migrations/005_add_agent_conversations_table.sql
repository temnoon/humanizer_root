-- Migration 005: Add agent_conversations table
-- Purpose: Store agent conversation history with messages in JSONB
-- Author: Claude Code
-- Date: October 12, 2025

-- ========================================
-- Create agent_conversations table
-- ========================================

CREATE TABLE IF NOT EXISTS agent_conversations (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- User reference
    user_id UUID NOT NULL,

    -- Conversation metadata
    title TEXT NOT NULL,

    -- Message history stored as JSONB array
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Example structure:
    -- [
    --   {
    --     "role": "user",
    --     "content": "Find conversations about quantum mechanics",
    --     "timestamp": "2025-10-12T14:30:00Z"
    --   },
    --   {
    --     "role": "assistant",
    --     "content": "Found 23 conversations...",
    --     "timestamp": "2025-10-12T14:30:05Z",
    --     "tool_call": {"tool": "semantic_search", "parameters": {...}},
    --     "tool_result": {...},
    --     "gui_action": "open_search_results",
    --     "gui_data": {...}
    --   }
    -- ]

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraint
    CONSTRAINT fk_agent_conversation_user
        FOREIGN KEY (user_id)
        REFERENCES user_preferences(user_id)
        ON DELETE CASCADE
);

-- ========================================
-- Indexes
-- ========================================

-- Index for user_id lookups
CREATE INDEX idx_agent_conversations_user_id
    ON agent_conversations(user_id);

-- Index for sorting by most recent
CREATE INDEX idx_agent_conversations_updated_at
    ON agent_conversations(updated_at DESC);

-- Index for full-text search on title
CREATE INDEX idx_agent_conversations_title
    ON agent_conversations USING gin(to_tsvector('english', title));

-- GIN index for JSONB queries on messages
CREATE INDEX idx_agent_conversations_messages
    ON agent_conversations USING gin(messages);

-- ========================================
-- Trigger for auto-updating updated_at
-- ========================================

CREATE OR REPLACE FUNCTION update_agent_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_agent_conversation_timestamp
    BEFORE UPDATE ON agent_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_conversation_updated_at();

-- ========================================
-- Comments
-- ========================================

COMMENT ON TABLE agent_conversations IS
    'Agent conversations with full message history for Agentic User Interface (AUI)';

COMMENT ON COLUMN agent_conversations.messages IS
    'JSONB array of message objects with role, content, timestamps, tool calls, and GUI actions';

COMMENT ON INDEX idx_agent_conversations_messages IS
    'GIN index for efficient JSONB queries on message content and tool calls';

-- ========================================
-- Verification
-- ========================================

-- Verify table was created
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'agent_conversations'
ORDER BY ordinal_position;

-- Verify indexes
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'agent_conversations';

-- Migration complete
SELECT 'Migration 005: agent_conversations table created successfully' AS status;
