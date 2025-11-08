-- Migration: Personalizer - Personal Personas, Styles, and Writing Samples
-- Created: 2025-01-08
-- Purpose: Enable users to create personalized transformations based on their authentic writing

-- Writing samples provided by users for voice discovery
CREATE TABLE IF NOT EXISTS writing_samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  source_type TEXT NOT NULL CHECK(source_type IN ('manual', 'chatgpt', 'claude', 'other')),
  content TEXT NOT NULL,
  word_count INTEGER NOT NULL,
  custom_metadata TEXT, -- JSON: {date, context, title, etc.}
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_writing_samples_user ON writing_samples(user_id);
CREATE INDEX idx_writing_samples_source ON writing_samples(source_type);

-- Personal personas discovered from user's writing or created manually
CREATE TABLE IF NOT EXISTS personal_personas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  auto_discovered INTEGER NOT NULL DEFAULT 0, -- Boolean: 1 = AI discovered, 0 = user created
  embedding_signature TEXT, -- JSON: representative embedding vector
  example_texts TEXT, -- JSON array: representative text examples
  custom_metadata TEXT, -- JSON: additional user-defined properties
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, name) -- User can't have duplicate persona names
);

CREATE INDEX idx_personal_personas_user ON personal_personas(user_id);
CREATE INDEX idx_personal_personas_auto ON personal_personas(auto_discovered);

-- Personal styles discovered from user's writing or created manually
CREATE TABLE IF NOT EXISTS personal_styles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  auto_discovered INTEGER NOT NULL DEFAULT 0, -- Boolean: 1 = AI discovered, 0 = user created
  formality_score REAL, -- 0.0-1.0: informal to formal
  complexity_score REAL, -- 0.0-1.0: simple to complex
  avg_sentence_length REAL, -- Average words per sentence
  vocab_diversity REAL, -- Type-token ratio
  tone_markers TEXT, -- JSON array: characteristic words/phrases
  example_texts TEXT, -- JSON array: representative text examples
  custom_metadata TEXT, -- JSON: additional user-defined properties
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, name) -- User can't have duplicate style names
);

CREATE INDEX idx_personal_styles_user ON personal_styles(user_id);
CREATE INDEX idx_personal_styles_auto ON personal_styles(auto_discovered);

-- Personalizer transformation history
CREATE TABLE IF NOT EXISTS personalizer_transformations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  persona_id INTEGER,
  style_id INTEGER,
  input_text TEXT NOT NULL,
  output_text TEXT NOT NULL,
  model_used TEXT NOT NULL,
  tokens_used INTEGER NOT NULL,
  semantic_similarity REAL, -- Cosine similarity between input/output embeddings
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (persona_id) REFERENCES personal_personas(id) ON DELETE SET NULL,
  FOREIGN KEY (style_id) REFERENCES personal_styles(id) ON DELETE SET NULL
);

CREATE INDEX idx_personalizer_transformations_user ON personalizer_transformations(user_id);
CREATE INDEX idx_personalizer_transformations_created ON personalizer_transformations(created_at);
