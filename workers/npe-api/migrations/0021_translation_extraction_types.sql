-- Migration 0021: Add translation and extraction transformation types
-- Adds support for: translation, persona_extraction, style_extraction

-- SQLite doesn't support ALTER CONSTRAINT, so we need to recreate the table
-- Create new table with expanded type constraint
CREATE TABLE IF NOT EXISTS transformations_new (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN (
        'allegorical',
        'round_trip',
        'maieutic',
        'persona',
        'namespace',
        'style',
        'computer_humanizer',
        'translation',
        'persona_extraction',
        'style_extraction'
    )),
    source_text TEXT NOT NULL,
    result_text TEXT,
    parameters TEXT, -- JSON blob
    trm_evaluation TEXT, -- JSON blob (optional TRM measurements)
    created_at INTEGER NOT NULL
);

-- Copy existing data
INSERT INTO transformations_new
SELECT * FROM transformations;

-- Drop old table
DROP TABLE transformations;

-- Rename new table to transformations
ALTER TABLE transformations_new RENAME TO transformations;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_transformations_user ON transformations(user_id);
CREATE INDEX IF NOT EXISTS idx_transformations_type ON transformations(type);
CREATE INDEX IF NOT EXISTS idx_transformations_created ON transformations(created_at);
