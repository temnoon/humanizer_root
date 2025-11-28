-- Post-Social Curator Pyramid System
-- Created: 2025-11-26
-- Version: 0005
--
-- This migration adds the hierarchical chunk pyramid for literary nodes.
-- Enables curators to have deep knowledge of their source text with
-- the ability to quote specific passages with citations.
--
-- Architecture:
--   APEX (1 per node) - ~500 word overview, curator's "consciousness"
--     └── L2 summaries (~250 words each)
--         └── L1 summaries (~250 words each)
--             └── L0 chunks (~1000 tokens each) - quotable source text

-- ==========================================
-- NODE CHUNKS (Level 0 - Source Text)
-- ==========================================
-- The base layer of the pyramid. These are the actual text chunks
-- that can be quoted with full citations. Each chunk is embedded
-- in Vectorize for semantic search.

CREATE TABLE IF NOT EXISTS node_chunks (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,

    -- Source reference (for Gutenberg books)
    source_type TEXT NOT NULL DEFAULT 'gutenberg'
        CHECK(source_type IN ('gutenberg', 'user_upload', 'url_import')),
    source_id TEXT,              -- Gutenberg ID or external reference

    -- Pyramid position
    pyramid_level INTEGER NOT NULL DEFAULT 0,  -- Always 0 for base chunks
    chunk_index INTEGER NOT NULL,              -- Order within the text
    parent_summary_id TEXT,                    -- Links to L1 summary

    -- The actual text
    content TEXT NOT NULL,
    token_count INTEGER NOT NULL,
    char_start INTEGER NOT NULL,               -- Position in original text
    char_end INTEGER NOT NULL,

    -- Structural metadata
    chapter_number INTEGER,
    chapter_title TEXT,
    part_number INTEGER,
    structural_position TEXT DEFAULT 'middle'
        CHECK(structural_position IN ('opening', 'early', 'middle', 'late', 'closing')),

    -- Content classification
    chunk_type TEXT DEFAULT 'mixed'
        CHECK(chunk_type IN ('narration', 'dialogue', 'exposition',
                             'description', 'action', 'interior', 'mixed')),
    contains_dialogue INTEGER DEFAULT 0,       -- Boolean
    dialogue_speakers TEXT,                    -- JSON array of speaker names

    -- Embedding reference (stored in Vectorize)
    embedding_id TEXT,                         -- ID in Vectorize index
    embedded_at INTEGER,

    created_at INTEGER NOT NULL,

    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_summary_id) REFERENCES node_summaries(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_node_chunks_node ON node_chunks(node_id);
CREATE INDEX IF NOT EXISTS idx_node_chunks_chapter ON node_chunks(node_id, chapter_number);
CREATE INDEX IF NOT EXISTS idx_node_chunks_position ON node_chunks(node_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_node_chunks_type ON node_chunks(chunk_type);

-- ==========================================
-- NODE SUMMARIES (Levels 1-N)
-- ==========================================
-- Higher levels of the pyramid. Each summary condenses ~4 chunks
-- or summaries from the level below. Preserves key events, themes,
-- and narrative flow.

CREATE TABLE IF NOT EXISTS node_summaries (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,

    -- Pyramid position
    pyramid_level INTEGER NOT NULL,            -- 1, 2, 3, etc.
    summary_index INTEGER NOT NULL,            -- Order within level
    parent_summary_id TEXT,                    -- Links to next level up

    -- The summary text
    content TEXT NOT NULL,
    token_count INTEGER NOT NULL,

    -- What this summarizes (JSON array of child IDs)
    child_ids TEXT NOT NULL DEFAULT '[]',
    child_type TEXT NOT NULL                   -- 'chunk' or 'summary'
        CHECK(child_type IN ('chunk', 'summary')),

    -- Span in source text
    chapter_start INTEGER,
    chapter_end INTEGER,

    -- Key elements preserved (JSON)
    -- {
    --   "events": ["Ahab first appears", "Ishmael joins crew"],
    --   "characters": ["Ishmael", "Queequeg", "Ahab"],
    --   "themes": ["obsession", "fate"],
    --   "tone": "foreboding"
    -- }
    preserved_elements TEXT DEFAULT '{}',

    -- Embedding reference
    embedding_id TEXT,
    embedded_at INTEGER,

    created_at INTEGER NOT NULL,

    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_summary_id) REFERENCES node_summaries(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_node_summaries_node ON node_summaries(node_id);
CREATE INDEX IF NOT EXISTS idx_node_summaries_level ON node_summaries(node_id, pyramid_level);
CREATE INDEX IF NOT EXISTS idx_node_summaries_parent ON node_summaries(parent_summary_id);

-- ==========================================
-- NODE APEXES (Top of Pyramid)
-- ==========================================
-- The apex is the curator's "consciousness" of the text. This is
-- what's loaded into context for every conversation. Contains the
-- essential understanding that lets the curator speak authentically
-- about the work.

CREATE TABLE IF NOT EXISTS node_apexes (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL UNIQUE,              -- One apex per node

    -- Core understanding (~500 words total)
    narrative_arc TEXT NOT NULL,               -- Beginning-middle-end
    core_themes TEXT NOT NULL,                 -- JSON array, 3-5 themes
    character_essences TEXT,                   -- JSON: key characters
    voice_characteristics TEXT,                -- JSON: style, tone, diction

    -- What the text asks of readers
    the_question TEXT NOT NULL,                -- Central question/tension

    -- Cross-node discovery hooks (JSON array)
    -- ["obsession and its costs", "man vs nature", "American identity"]
    resonance_hooks TEXT DEFAULT '[]',

    -- Lifecycle state
    lifecycle_state TEXT NOT NULL DEFAULT 'awakened'
        CHECK(lifecycle_state IN ('dormant', 'awakened', 'active', 'mature', 'canonical')),

    -- Stats
    total_chunks INTEGER DEFAULT 0,
    total_summaries INTEGER DEFAULT 0,
    pyramid_depth INTEGER DEFAULT 0,           -- How many levels

    -- Source metadata
    source_title TEXT,
    source_author TEXT,
    source_year INTEGER,
    source_gutenberg_id TEXT,

    -- Embedding for cross-node search
    embedding_id TEXT,
    embedded_at INTEGER,

    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_node_apexes_state ON node_apexes(lifecycle_state);
CREATE INDEX IF NOT EXISTS idx_node_apexes_source ON node_apexes(source_gutenberg_id);

-- ==========================================
-- DISCOURSE ARTIFACTS (Inter-Curator Conversations)
-- ==========================================
-- When curators visit each other, they generate synthesis.
-- This table stores the outputs: transcripts, cross-references,
-- and discoveries that emerge from dialogue.

CREATE TABLE IF NOT EXISTS discourse_artifacts (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,             -- Groups artifacts from one visit

    -- Participants
    visitor_node_id TEXT NOT NULL,             -- Who visited
    host_node_id TEXT NOT NULL,                -- Who was visited

    -- Discourse structure
    discourse_type TEXT NOT NULL DEFAULT 'visitation'
        CHECK(discourse_type IN ('visitation', 'debate', 'synthesis', 'discovery')),
    discourse_role TEXT NOT NULL
        CHECK(discourse_role IN ('visitor_opening', 'host_response',
                                  'visitor_synthesis', 'host_synthesis',
                                  'joint_discovery')),

    -- The content
    content TEXT NOT NULL,

    -- Cross-reference created (if any)
    reference_type TEXT
        CHECK(reference_type IN ('thematic', 'contrast', 'influence',
                                  'dialogue', 'expansion')),
    reference_strength REAL,                   -- 0-1 confidence
    discovery_hook TEXT,                       -- What was discovered

    -- For display
    sequence_number INTEGER NOT NULL,          -- Order in conversation

    -- Embedding for semantic search
    embedding_id TEXT,

    created_at INTEGER NOT NULL,

    FOREIGN KEY (visitor_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (host_node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_discourse_artifacts_conversation ON discourse_artifacts(conversation_id);
CREATE INDEX IF NOT EXISTS idx_discourse_artifacts_visitor ON discourse_artifacts(visitor_node_id);
CREATE INDEX IF NOT EXISTS idx_discourse_artifacts_host ON discourse_artifacts(host_node_id);
CREATE INDEX IF NOT EXISTS idx_discourse_artifacts_type ON discourse_artifacts(discourse_type);

-- ==========================================
-- CURATOR SYNTHESIS (Accumulated Wisdom)
-- ==========================================
-- As curators interact with users and other curators, they
-- develop synthesis: refined understanding that gets integrated
-- back into their perspective.

CREATE TABLE IF NOT EXISTS curator_synthesis (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,

    -- What kind of synthesis
    synthesis_type TEXT NOT NULL
        CHECK(synthesis_type IN ('user_interaction', 'inter_curator',
                                  'editorial', 'discovery')),

    -- The synthesis content
    theme TEXT NOT NULL,                       -- What this is about
    content TEXT NOT NULL,                     -- The synthesis itself

    -- Source tracking (JSON array of source IDs)
    source_interaction_ids TEXT DEFAULT '[]',
    source_discourse_ids TEXT DEFAULT '[]',

    -- Version management
    version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK(status IN ('draft', 'integrated', 'superseded')),
    superseded_by TEXT,                        -- ID of newer version

    -- Embedding
    embedding_id TEXT,

    created_at INTEGER NOT NULL,
    integrated_at INTEGER,

    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (superseded_by) REFERENCES curator_synthesis(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_curator_synthesis_node ON curator_synthesis(node_id);
CREATE INDEX IF NOT EXISTS idx_curator_synthesis_theme ON curator_synthesis(theme);
CREATE INDEX IF NOT EXISTS idx_curator_synthesis_status ON curator_synthesis(status);
