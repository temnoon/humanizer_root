-- Migration 0011: User Attributes and Dialogue Sessions
-- Purpose: Support for LLM-assisted attribute builder
-- Date: 2025-11-10

-- ============================================================================
-- User Attributes - Custom personas, namespaces, styles, voices
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_attributes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('persona', 'namespace', 'style', 'voice')),
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT,    -- For personas/voices: how they should speak
  context_prompt TEXT,   -- For namespaces: conceptual framework
  style_prompt TEXT,     -- For styles: writing patterns
  examples TEXT,         -- JSON array of example outputs
  tags TEXT,            -- JSON array of tags for organization
  category TEXT,        -- Category for grouping (e.g., 'Historical', 'Scientific')
  usage_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_user_attributes_user ON user_attributes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_attributes_type ON user_attributes(type);
CREATE INDEX IF NOT EXISTS idx_user_attributes_user_type ON user_attributes(user_id, type);

-- ============================================================================
-- Attribute Dialogues - Multi-turn extraction conversations
-- ============================================================================

CREATE TABLE IF NOT EXISTS attribute_dialogues (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('persona', 'namespace', 'style', 'voice')),
  messages TEXT NOT NULL,        -- JSON array of dialogue messages [{role, content, timestamp}]
  current_definition TEXT,        -- JSON of current AttributeDefinition
  status TEXT NOT NULL CHECK(status IN ('in_progress', 'completed', 'abandoned')),
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for dialogue management
CREATE INDEX IF NOT EXISTS idx_attribute_dialogues_user ON attribute_dialogues(user_id);
CREATE INDEX IF NOT EXISTS idx_attribute_dialogues_status ON attribute_dialogues(status);
CREATE INDEX IF NOT EXISTS idx_attribute_dialogues_user_status ON attribute_dialogues(user_id, status);

-- ============================================================================
-- Seed Data - Example attributes for demonstration
-- ============================================================================

-- Insert a few example personas for the test user
INSERT OR IGNORE INTO user_attributes (
  id, user_id, type, name, description,
  system_prompt, context_prompt, style_prompt, examples,
  tags, category, usage_count, created_at, updated_at
) VALUES
(
  'example-persona-victorian',
  'test-user-local',
  'persona',
  'Victorian Naturalist',
  'A curious explorer documenting discoveries with wonder and scientific precision',
  'You are a Victorian-era naturalist, deeply curious about the natural world. Speak with childlike wonder balanced by precise scientific observation. Use period-appropriate language and reference the tools and methods of 19th-century natural philosophy.',
  NULL,
  NULL,
  '["The specimen exhibits most remarkable characteristics!", "Upon closer examination with my magnifying glass..."]',
  '["historical", "scientific", "curious"]',
  'Historical',
  0,
  1731200000000,
  1731200000000
),
(
  'example-namespace-quantum',
  'test-user-local',
  'namespace',
  'Quantum Mechanics',
  'Concepts from quantum physics like superposition, entanglement, and observation',
  NULL,
  'Frame everything through quantum mechanical concepts: superposition (multiple states simultaneously), entanglement (spooky action at a distance), wave function collapse (observation changes reality), uncertainty principle (complementary properties cannot be precisely known), quantum tunneling (passing through barriers).',
  NULL,
  '["Like particles in superposition...", "The observer effect suggests..."]',
  '["scientific", "physics", "abstract"]',
  'Scientific',
  0,
  1731200000000,
  1731200000000
),
(
  'example-style-hemingway',
  'test-user-local',
  'style',
  'Hemingway Brevity',
  'Short, declarative sentences with no unnecessary words',
  NULL,
  NULL,
  'Write in the style of Ernest Hemingway: short, declarative sentences. No unnecessary adjectives. Direct and powerful. Show, don''t tell. Use simple words. Trust the reader.',
  '["The man walked. It was hot.", "She knew. Nothing more was needed."]',
  '["literary", "minimalist", "direct"]',
  'Literary',
  0,
  1731200000000,
  1731200000000
);

-- Add example dialogue for demonstration
INSERT OR IGNORE INTO attribute_dialogues (
  id, user_id, type, messages, current_definition, status, created_at, completed_at
) VALUES
(
  'example-dialogue-1',
  'test-user-local',
  'persona',
  '[{"role":"user","content":"I want a persona that sounds like a wise old tree","timestamp":1731200000000},{"role":"assistant","content":"I''d be happy to help you create a tree persona! To make this really compelling, could you tell me more about:\n\n1. What kind of wisdom does this tree possess? Is it ancient forest wisdom, or more about observing human life?\n\n2. How does the tree communicate - through rustling leaves, creaking wood, or a more mystical voice?","timestamp":1731200001000}]',
  NULL,
  'in_progress',
  1731200000000,
  NULL
);

-- Migration tracking (create table if it doesn't exist)
CREATE TABLE IF NOT EXISTS _migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO _migrations (version, applied_at) VALUES (11, CURRENT_TIMESTAMP);