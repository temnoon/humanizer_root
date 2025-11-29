-- Comment Conversation Threading
-- Created: 2025-11-28
-- Version: 0007
--
-- Extends curator_responses to support bidirectional conversation
-- Users can reply to curator responses, creating an ongoing dialogue

-- Link curator responses to conversation sessions
ALTER TABLE curator_responses ADD COLUMN conversation_id TEXT;

-- Create foreign key to curator_conversations
-- (curator_conversations already exists from 0006_curator_conversations.sql)

-- Index for efficient conversation lookups
CREATE INDEX IF NOT EXISTS idx_curator_responses_conversation
    ON curator_responses(conversation_id);

-- Comment conversation turns (replies within a comment thread)
-- Reusing curator_conversation_turns table but linking through curator_responses
--
-- Flow:
-- 1. User posts comment on narrative
-- 2. Curator auto-responds → creates curator_response + curator_conversation + first turn (curator)
-- 3. User replies to curator → adds turn (user)
-- 4. Curator responds → adds turn (curator)
-- ... continues

-- Add comment_id to curator_conversations for easier lookup
ALTER TABLE curator_conversations ADD COLUMN comment_id TEXT;

CREATE INDEX IF NOT EXISTS idx_curator_conversations_comment
    ON curator_conversations(comment_id);

-- Metadata to track if conversation is comment-based vs. node-based
-- comment_id NOT NULL = comment conversation
-- comment_id NULL = literary node conversation
