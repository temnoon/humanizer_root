-- Migration 002: Add transformations table
-- Created: 2025-10-12
-- Description: Adds transformations table for storing text transformation history

-- ===================================================================
-- 1. Create transformation_type enum
-- ===================================================================

DO $$ BEGIN
    CREATE TYPE transformation_type AS ENUM (
        'trm',
        'llm',
        'personify_trm',
        'personify_llm',
        'custom'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ===================================================================
-- 2. Create source_type enum
-- ===================================================================

DO $$ BEGIN
    CREATE TYPE source_type AS ENUM (
        'chatgpt_message',
        'custom'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ===================================================================
-- 3. Create transformations table
-- ===================================================================

CREATE TABLE IF NOT EXISTS transformations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_preferences(user_id) ON DELETE CASCADE,
    source_type source_type NOT NULL DEFAULT 'custom',
    source_uuid UUID,
    source_text TEXT NOT NULL,
    transformation_type transformation_type NOT NULL,
    user_prompt TEXT,
    parameters JSONB NOT NULL DEFAULT '{}',
    result_text TEXT NOT NULL,
    metrics JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ===================================================================
-- 4. Add indexes for common queries
-- ===================================================================

CREATE INDEX IF NOT EXISTS idx_transformations_user_id
    ON transformations(user_id);

CREATE INDEX IF NOT EXISTS idx_transformations_source_uuid
    ON transformations(source_uuid) WHERE source_uuid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transformations_type
    ON transformations(transformation_type);

CREATE INDEX IF NOT EXISTS idx_transformations_created_at
    ON transformations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transformations_source_type
    ON transformations(source_type);

-- ===================================================================
-- 5. Add helpful views
-- ===================================================================

-- View to see transformation summary statistics
CREATE OR REPLACE VIEW transformation_stats AS
SELECT
    user_id,
    transformation_type,
    COUNT(*) as total_transformations,
    COUNT(DISTINCT source_uuid) as unique_sources,
    AVG((metrics->>'processing_time_ms')::float) as avg_processing_time_ms,
    MIN(created_at) as first_transformation,
    MAX(created_at) as last_transformation
FROM transformations
GROUP BY user_id, transformation_type;

-- View to see recent transformations with source info
CREATE OR REPLACE VIEW recent_transformations AS
SELECT
    t.id,
    t.user_id,
    t.transformation_type,
    t.source_type,
    t.source_uuid,
    LEFT(t.source_text, 100) || '...' as source_preview,
    LEFT(t.result_text, 100) || '...' as result_preview,
    t.user_prompt,
    t.created_at,
    m.content_text as source_message_content,
    c.title as source_conversation_title
FROM transformations t
LEFT JOIN chatgpt_messages m ON t.source_uuid = m.uuid AND t.source_type = 'chatgpt_message'
LEFT JOIN chatgpt_conversations c ON m.conversation_uuid = c.uuid
ORDER BY t.created_at DESC;

-- ===================================================================
-- 6. Add trigger to update updated_at timestamp
-- ===================================================================

CREATE OR REPLACE FUNCTION update_transformations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_transformations_updated_at
    BEFORE UPDATE ON transformations
    FOR EACH ROW
    EXECUTE FUNCTION update_transformations_updated_at();

-- ===================================================================
-- 7. Add comments for documentation
-- ===================================================================

COMMENT ON TABLE transformations IS 'Stores history of text transformations (TRM, LLM, Personification)';
COMMENT ON COLUMN transformations.user_prompt IS 'User description of what the transformation should achieve';
COMMENT ON COLUMN transformations.source_uuid IS 'FK to chatgpt_messages.uuid if source is a ChatGPT message';
COMMENT ON COLUMN transformations.parameters IS 'Transformation configuration (povm_pack, iterations, strength, etc.)';
COMMENT ON COLUMN transformations.metrics IS 'Transformation metrics (processing_time, convergence_score, etc.)';
