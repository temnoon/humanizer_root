-- Migration: Curation fields for AI processing
-- Created: 2025-11-24
-- Phase 3: Curation Queue

-- Add curation status to posts
-- pending = awaiting safety check
-- approved = passed safety, awaiting curation
-- rejected = failed safety check
-- curated = fully processed with summary, tags, embedding
ALTER TABLE posts ADD COLUMN status TEXT DEFAULT 'pending' 
  CHECK(status IN ('pending', 'approved', 'rejected', 'curated'));

-- Safety check result (JSON)
-- {safe: boolean, category: string|null, reason: string|null, model: string}
ALTER TABLE posts ADD COLUMN safety_check TEXT;

-- AI-generated summary (max 280 chars)
ALTER TABLE posts ADD COLUMN summary TEXT;

-- AI-extracted tags (JSON array)
-- ["tag-one", "tag-two", ...]
ALTER TABLE posts ADD COLUMN tags TEXT;

-- Reference to vector in Vectorize index
ALTER TABLE posts ADD COLUMN embedding_id TEXT;

-- Model used for curation (for debugging/auditing)
ALTER TABLE posts ADD COLUMN curation_model TEXT;

-- When curation completed
ALTER TABLE posts ADD COLUMN curated_at INTEGER;

-- Version number for synthesis (starts at 1)
ALTER TABLE posts ADD COLUMN version INTEGER DEFAULT 1;

-- Parent version (for tracking synthesis history)
ALTER TABLE posts ADD COLUMN parent_version_id TEXT;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_curated ON posts(curated_at);
CREATE INDEX IF NOT EXISTS idx_posts_version ON posts(version);

-- ==========================================
-- Curator responses table
-- ==========================================
-- AI responses to comments in discussions

CREATE TABLE IF NOT EXISTS curator_responses (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    comment_id TEXT,  -- NULL if responding to post itself
    response_content TEXT NOT NULL,
    model_used TEXT NOT NULL,
    prompt_id TEXT NOT NULL,
    tokens_used INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_curator_responses_post ON curator_responses(post_id);
CREATE INDEX IF NOT EXISTS idx_curator_responses_comment ON curator_responses(comment_id);

-- ==========================================
-- Curation queue tracking
-- ==========================================
-- Track posts in the curation pipeline

CREATE TABLE IF NOT EXISTS curation_queue (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'queued' CHECK(status IN ('queued', 'processing', 'completed', 'failed')),
    stage TEXT CHECK(stage IN ('safety', 'summarize', 'tags', 'embed')),
    error_message TEXT,
    attempts INTEGER DEFAULT 0,
    queued_at INTEGER NOT NULL,
    started_at INTEGER,
    completed_at INTEGER,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_curation_queue_status ON curation_queue(status);
CREATE INDEX IF NOT EXISTS idx_curation_queue_queued ON curation_queue(queued_at);

-- ==========================================
-- Post synthesis history
-- ==========================================
-- Track how posts evolve through synthesis

CREATE TABLE IF NOT EXISTS post_versions (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    tags TEXT,
    synthesis_model TEXT,
    synthesis_prompt_id TEXT,
    comment_count_at_synthesis INTEGER,
    author_approved INTEGER DEFAULT 0,  -- Boolean
    approved_at INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    UNIQUE(post_id, version)
);

CREATE INDEX IF NOT EXISTS idx_post_versions_post ON post_versions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_versions_approved ON post_versions(author_approved);

-- ==========================================
-- Tag aggregation table
-- ==========================================
-- For browsing/filtering by tag

CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    post_count INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_tags_count ON tags(post_count DESC);

-- Post-tag relationship (many-to-many)
CREATE TABLE IF NOT EXISTS post_tags (
    post_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (post_id, tag_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag_id);
