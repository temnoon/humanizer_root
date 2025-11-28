-- Curator Conversations
-- Stores conversation history between users and node curators

-- Conversation sessions
CREATE TABLE IF NOT EXISTS curator_conversations (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    user_id TEXT,                    -- NULL for anonymous
    session_id TEXT NOT NULL,        -- For grouping turns
    status TEXT DEFAULT 'active',    -- active, archived, flagged
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    -- Metadata
    turn_count INTEGER DEFAULT 0,
    last_search_query TEXT,          -- Last semantic search performed

    FOREIGN KEY (node_id) REFERENCES nodes(id)
);

-- Individual conversation turns
CREATE TABLE IF NOT EXISTS curator_conversation_turns (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    turn_number INTEGER NOT NULL,

    -- The exchange
    role TEXT NOT NULL,              -- 'user' or 'curator'
    content TEXT NOT NULL,

    -- Context used (for curator turns)
    passages_used TEXT,              -- JSON array of chunk IDs cited
    search_query TEXT,               -- Query used to find passages

    -- Timestamps
    created_at INTEGER NOT NULL,

    FOREIGN KEY (conversation_id) REFERENCES curator_conversations(id)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_curator_conversations_node
    ON curator_conversations(node_id, status);
CREATE INDEX IF NOT EXISTS idx_curator_conversations_session
    ON curator_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_curator_conversation_turns_conv
    ON curator_conversation_turns(conversation_id, turn_number);
