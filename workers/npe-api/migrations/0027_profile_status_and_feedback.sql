-- Add status field to profiles and create feedback table
-- Status allows admin to control profile visibility: active, draft, disabled

-- Add status to npe_personas
ALTER TABLE npe_personas ADD COLUMN status TEXT DEFAULT 'active' CHECK(status IN ('active', 'draft', 'disabled'));
ALTER TABLE npe_personas ADD COLUMN created_at INTEGER;
ALTER TABLE npe_personas ADD COLUMN updated_at INTEGER;
ALTER TABLE npe_personas ADD COLUMN created_by TEXT;  -- user_id of creator (null = system)

-- Add status to npe_styles
ALTER TABLE npe_styles ADD COLUMN status TEXT DEFAULT 'active' CHECK(status IN ('active', 'draft', 'disabled'));
ALTER TABLE npe_styles ADD COLUMN created_at INTEGER;
ALTER TABLE npe_styles ADD COLUMN updated_at INTEGER;
ALTER TABLE npe_styles ADD COLUMN created_by TEXT;  -- user_id of creator (null = system)

-- Add status to npe_namespaces for consistency
ALTER TABLE npe_namespaces ADD COLUMN status TEXT DEFAULT 'active' CHECK(status IN ('active', 'draft', 'disabled'));
ALTER TABLE npe_namespaces ADD COLUMN created_at INTEGER;
ALTER TABLE npe_namespaces ADD COLUMN updated_at INTEGER;
ALTER TABLE npe_namespaces ADD COLUMN created_by TEXT;

-- Transformation feedback table
-- Tracks thumbs up/down from users for each transformation
CREATE TABLE IF NOT EXISTS transformation_feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    transformation_id TEXT NOT NULL,
    transformation_type TEXT NOT NULL,  -- 'persona', 'style', 'humanizer', 'round-trip'
    profile_name TEXT,                  -- specific persona/style name used
    rating TEXT NOT NULL CHECK(rating IN ('good', 'bad')),
    feedback_text TEXT,                 -- optional user comment
    model_used TEXT,                    -- which LLM model was used
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_feedback_user ON transformation_feedback(user_id);
CREATE INDEX idx_feedback_profile ON transformation_feedback(profile_name);
CREATE INDEX idx_feedback_type ON transformation_feedback(transformation_type);
CREATE INDEX idx_feedback_rating ON transformation_feedback(rating);
CREATE INDEX idx_feedback_created ON transformation_feedback(created_at);

-- View for aggregating feedback per profile
CREATE VIEW profile_feedback_stats AS
SELECT
    profile_name,
    transformation_type,
    COUNT(*) as total_uses,
    SUM(CASE WHEN rating = 'good' THEN 1 ELSE 0 END) as thumbs_up,
    SUM(CASE WHEN rating = 'bad' THEN 1 ELSE 0 END) as thumbs_down,
    ROUND(100.0 * SUM(CASE WHEN rating = 'good' THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate
FROM transformation_feedback
WHERE profile_name IS NOT NULL
GROUP BY profile_name, transformation_type;
