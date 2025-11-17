-- Migration 0017: Expand transformation types constraint
-- Add support for new transformation types: persona, namespace, style, computer_humanizer

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
        'computer_humanizer'
    )),
    source_text TEXT NOT NULL,
    result_text TEXT,
    parameters TEXT, -- JSON blob
    trm_evaluation TEXT, -- JSON blob (optional TRM measurements)
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Copy existing data
INSERT INTO transformations_new
SELECT * FROM transformations;

-- Drop old table
DROP TABLE transformations;

-- Rename new table to transformations
ALTER TABLE transformations_new RENAME TO transformations;

-- Recreate indexes
CREATE INDEX idx_transformations_user ON transformations(user_id);
CREATE INDEX idx_transformations_type ON transformations(type);
CREATE INDEX idx_transformations_created ON transformations(created_at);
