-- Post-Social Curator Agent System
-- Created: 2025-11-25
-- Version: 0004
-- 
-- This migration adds the infrastructure for the AI Curator
-- to act as an active agent that:
-- 1. Gates narrative publishing against node rules
-- 2. Responds to comments in conversation
-- 3. Compiles synthesis suggestions from approved comments

-- ==========================================
-- CURATOR RESPONSES (Conversation with commenters)
-- ==========================================
-- When users comment on narratives, the curator responds.
-- This creates a dialogue that helps commenters refine
-- their contributions before synthesis.

CREATE TABLE IF NOT EXISTS curator_responses (
    id TEXT PRIMARY KEY,
    comment_id TEXT NOT NULL,
    
    response TEXT NOT NULL,  -- The curator's response
    
    -- Response type guides the conversation
    response_type TEXT NOT NULL DEFAULT 'acknowledgment'
        CHECK(response_type IN (
            'acknowledgment',    -- Thanks, noted
            'clarification',     -- Can you explain more about...
            'pushback',          -- I see it differently because...
            'synthesis_note',    -- This will be incorporated as...
            'rejection'          -- This doesn't fit because...
        )),
    
    -- AI model info
    model TEXT,
    processing_time_ms INTEGER,
    
    created_at INTEGER NOT NULL,
    
    FOREIGN KEY (comment_id) REFERENCES narrative_comments(id) ON DELETE CASCADE
);

CREATE INDEX idx_curator_responses_comment ON curator_responses(comment_id);

-- ==========================================
-- SYNTHESIS TASKS (Queued narrative updates)
-- ==========================================
-- When enough approved comments accumulate, the curator
-- creates a synthesis task suggesting how to evolve
-- the narrative. Authors review and approve.

CREATE TABLE IF NOT EXISTS synthesis_tasks (
    id TEXT PRIMARY KEY,
    narrative_id TEXT NOT NULL,
    
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN (
            'pending',           -- Waiting for review
            'in_progress',       -- Author is reviewing
            'approved',          -- Author approved, ready to apply
            'applied',           -- Changes applied, new version created
            'rejected',          -- Author rejected the synthesis
            'expired'            -- Too old, superseded
        )),
    
    -- Which comments are included (JSON array of IDs)
    comment_ids TEXT NOT NULL DEFAULT '[]',
    
    -- The AI's synthesis suggestion
    suggestion TEXT,           -- Prose description of changes
    reasoning TEXT,            -- Why these changes improve the narrative
    proposed_changes TEXT,     -- JSON array of specific change points
    
    -- Proposed new content (full markdown)
    proposed_content TEXT,
    
    -- Diff from current version
    diff_summary TEXT,         -- JSON with addedLines, removedLines, etc.
    
    -- Review tracking
    created_at INTEGER NOT NULL,
    reviewed_at INTEGER,
    applied_at INTEGER,
    applied_version INTEGER,   -- Which version this became
    
    -- Author's feedback if rejected
    rejection_reason TEXT,
    
    FOREIGN KEY (narrative_id) REFERENCES narratives(id) ON DELETE CASCADE
);

CREATE INDEX idx_synthesis_tasks_narrative ON synthesis_tasks(narrative_id);
CREATE INDEX idx_synthesis_tasks_status ON synthesis_tasks(status);

-- ==========================================
-- PUBLISH REQUESTS (Pre-publish approval queue)
-- ==========================================
-- When a user tries to publish to a node, the curator
-- evaluates the content first. This table tracks the
-- approval workflow.

CREATE TABLE IF NOT EXISTS publish_requests (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    author_user_id TEXT NOT NULL,
    
    -- The content being submitted
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT,                 -- JSON array
    
    -- Curator's evaluation
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN (
            'pending',         -- Awaiting evaluation
            'approved',        -- Can be published
            'needs_revision',  -- Curator wants changes
            'rejected'         -- Not appropriate for this node
        )),
    
    -- Curator's feedback
    evaluation TEXT,           -- JSON with scores and reasoning
    feedback TEXT,             -- Human-readable feedback
    suggestions TEXT,          -- JSON array of specific suggestions
    
    -- If approved, the narrative that was created
    narrative_id TEXT,
    
    created_at INTEGER NOT NULL,
    evaluated_at INTEGER,
    published_at INTEGER,
    
    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (narrative_id) REFERENCES narratives(id) ON DELETE SET NULL
);

CREATE INDEX idx_publish_requests_node ON publish_requests(node_id);
CREATE INDEX idx_publish_requests_author ON publish_requests(author_user_id);
CREATE INDEX idx_publish_requests_status ON publish_requests(status);

-- ==========================================
-- Add curator_rules to nodes (more structured than curator_config)
-- ==========================================
-- This JSON field contains the explicit rules the curator enforces

ALTER TABLE nodes ADD COLUMN curator_rules TEXT DEFAULT '{}';

-- Example curator_rules structure:
-- {
--   "publishing": {
--     "requireApproval": true,
--     "autoApproveCreator": true,
--     "minWordCount": 200,
--     "maxWordCount": 10000,
--     "requiredElements": ["introduction", "conclusion"],
--     "acceptedTopics": ["phenomenology", "consciousness", "philosophy"],
--     "rejectedTopics": ["politics", "spam"],
--     "qualityThreshold": 0.7
--   },
--   "comments": {
--     "autoRespond": true,
--     "moderationLevel": "conversational", -- "strict", "conversational", "permissive"
--     "synthesisThreshold": 5,
--     "synthesisQualityMin": 0.6
--   },
--   "persona": {
--     "name": "The Phenomenologist",
--     "voice": "scholarly but accessible",
--     "expertise": ["Husserl", "intentionality", "consciousness studies"],
--     "systemPrompt": "You are a curator specializing in phenomenological inquiry..."
--   }
-- }
