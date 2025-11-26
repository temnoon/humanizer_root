-- Post-Social Node System - Phase 1: Core Tables
-- Created: 2025-11-25
-- Version: 0003

-- ==========================================
-- NODES (AI-curated topic archives)
-- ==========================================
-- Each Node is a thematic container with its own AI curator
-- personality. Nodes replace traditional "profiles" - identity
-- emerges from the archive, not from self-description.

CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    creator_user_id TEXT NOT NULL,  -- From NPE auth JWT
    
    -- AI curator configuration (JSON)
    -- {
    --   "personality": "Husserlian",
    --   "systemPrompt": "You are a phenomenologist...",
    --   "model": "claude-sonnet-4",
    --   "filterCriteria": {
    --     "minQuality": 0.7,
    --     "acceptedTopics": ["phenomenology"],
    --     "rejectedTopics": ["politics"]
    --   }
    -- }
    curator_config TEXT NOT NULL DEFAULT '{}',
    
    -- Archive statistics (JSON)
    -- {
    --   "narrativeCount": 12,
    --   "lastPublished": "2024-11-25T10:00:00Z",
    --   "totalVersions": 45
    -- }
    archive_metadata TEXT NOT NULL DEFAULT '{}',
    
    status TEXT NOT NULL DEFAULT 'active' 
        CHECK(status IN ('active', 'archived')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_nodes_creator ON nodes(creator_user_id);
CREATE INDEX idx_nodes_slug ON nodes(slug);
CREATE INDEX idx_nodes_status ON nodes(status);

-- ==========================================
-- NARRATIVES (Evolving essays within Nodes)
-- ==========================================
-- Narratives are the core content unit. Unlike posts, they
-- evolve through versioning as comments are synthesized.
-- "Refinement over accumulation" - each narrative grows
-- richer rather than being buried by newer content.

CREATE TABLE IF NOT EXISTS narratives (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    
    current_version INTEGER NOT NULL DEFAULT 1,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,  -- Unique within node
    content TEXT NOT NULL,  -- Markdown
    
    -- Metadata (JSON)
    -- {
    --   "tags": ["phenomenology", "husserl"],
    --   "wordCount": 2400,
    --   "readingTime": 12,
    --   "lexicalSignature": "sha256-hash"
    -- }
    metadata TEXT NOT NULL DEFAULT '{}',
    
    -- Synthesis status (JSON)
    -- {
    --   "status": "none" | "pending" | "in_progress" | "completed",
    --   "lastSynthesized": "2024-11-25T10:00:00Z",
    --   "pendingComments": 5
    -- }
    synthesis TEXT NOT NULL DEFAULT '{"status":"none","pendingComments":0}',
    
    subscriber_count INTEGER DEFAULT 0,
    visibility TEXT NOT NULL DEFAULT 'public'
        CHECK(visibility IN ('public', 'node-only', 'private')),
    
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
    UNIQUE(node_id, slug)
);

CREATE INDEX idx_narratives_node ON narratives(node_id);
CREATE INDEX idx_narratives_visibility ON narratives(visibility);
CREATE INDEX idx_narratives_updated ON narratives(updated_at DESC);

-- ==========================================
-- NARRATIVE VERSIONS (Full history)
-- ==========================================
-- Every change creates a new version. The diff between
-- versions shows how community input shaped the narrative.
-- This is the "refinement" made visible.

CREATE TABLE IF NOT EXISTS narrative_versions (
    id TEXT PRIMARY KEY,
    narrative_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    
    content TEXT NOT NULL,  -- Full markdown at this version
    
    -- Change summary (JSON)
    -- {
    --   "summary": "Refined intentionality section based on comments",
    --   "diff": "... git-style diff ...",
    --   "addedLines": 12,
    --   "removedLines": 8,
    --   "semanticShift": 0.23
    -- }
    changes TEXT NOT NULL DEFAULT '{}',
    
    -- What triggered this version (JSON)
    -- {
    --   "type": "manual" | "comment-synthesis" | "curator-refinement",
    --   "actor": "user-id or 'ai-curator'",
    --   "commentIds": ["comment-1", "comment-2"]
    -- }
    trigger_info TEXT NOT NULL DEFAULT '{}',
    
    created_at INTEGER NOT NULL,
    
    FOREIGN KEY (narrative_id) REFERENCES narratives(id) ON DELETE CASCADE,
    UNIQUE(narrative_id, version)
);

CREATE INDEX idx_narrative_versions_narrative ON narrative_versions(narrative_id);

-- ==========================================
-- NARRATIVE COMMENTS (Synthesis input)
-- ==========================================
-- Comments are not replies - they are synthesis input.
-- The AI curator evaluates each comment for quality and
-- relevance, then synthesizes approved comments into
-- new narrative versions.

CREATE TABLE IF NOT EXISTS narrative_comments (
    id TEXT PRIMARY KEY,
    narrative_id TEXT NOT NULL,
    version INTEGER NOT NULL,  -- Which version was commented on
    author_user_id TEXT NOT NULL,  -- From NPE auth JWT
    
    content TEXT NOT NULL,  -- Markdown
    
    -- Optional context for inline comments (JSON)
    -- {
    --   "quotedText": "Intentionality is always directed...",
    --   "startOffset": 523,
    --   "endOffset": 582
    -- }
    context TEXT,
    
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending', 'approved', 'synthesized', 'rejected')),
    
    -- Curator's evaluation (JSON)
    -- {
    --   "quality": 0.85,
    --   "relevance": 0.92,
    --   "perspective": "Offers important nuance",
    --   "synthesisNotes": "Incorporate empty intentionality concept"
    -- }
    curator_evaluation TEXT,
    
    synthesized_in_version INTEGER,  -- NULL if not yet synthesized
    
    created_at INTEGER NOT NULL,
    evaluated_at INTEGER,
    synthesized_at INTEGER,
    
    FOREIGN KEY (narrative_id) REFERENCES narratives(id) ON DELETE CASCADE
);

CREATE INDEX idx_narrative_comments_narrative ON narrative_comments(narrative_id);
CREATE INDEX idx_narrative_comments_status ON narrative_comments(status);
CREATE INDEX idx_narrative_comments_author ON narrative_comments(author_user_id);

-- ==========================================
-- NODE SUBSCRIPTIONS (VAX Notes dashboard)
-- ==========================================
-- Subscriptions power the VAX Notes-style dashboard.
-- Each subscription tracks unread count so the dashboard
-- can show "Phenomenology [5]" like VAX Notes of old.

CREATE TABLE IF NOT EXISTS node_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,  -- From NPE auth JWT
    node_id TEXT NOT NULL,
    
    -- Notification preferences (JSON)
    -- {
    --   "notifyOnNewNarrative": true,
    --   "notifyOnUpdate": true,
    --   "emailDigest": "daily" | "weekly" | "none"
    -- }
    preferences TEXT NOT NULL DEFAULT '{}',
    
    last_checked INTEGER NOT NULL,
    unread_count INTEGER DEFAULT 0,
    
    created_at INTEGER NOT NULL,
    
    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
    UNIQUE(user_id, node_id)
);

CREATE INDEX idx_node_subscriptions_user ON node_subscriptions(user_id);
CREATE INDEX idx_node_subscriptions_node ON node_subscriptions(node_id);
CREATE INDEX idx_node_subscriptions_unread ON node_subscriptions(user_id, unread_count);
