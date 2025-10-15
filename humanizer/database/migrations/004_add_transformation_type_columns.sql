-- Migration 004: Add Transformation Type Columns as VARCHAR
-- Recreate the columns that were dropped when enum types were cascaded

-- Add source_type column as VARCHAR
ALTER TABLE transformations
  ADD COLUMN source_type VARCHAR NOT NULL DEFAULT 'custom'
  CHECK (source_type IN ('chatgpt_message', 'custom'));

-- Add transformation_type column as VARCHAR with index
ALTER TABLE transformations
  ADD COLUMN transformation_type VARCHAR NOT NULL
  CHECK (transformation_type IN ('trm', 'llm', 'personify_trm', 'personify_llm', 'custom'));

-- Create index on transformation_type
CREATE INDEX idx_transformations_transformation_type ON transformations(transformation_type);

-- Recreate the views
CREATE OR REPLACE VIEW recent_transformations AS
SELECT
    id,
    user_id,
    transformation_type,
    source_type,
    user_prompt,
    LENGTH(source_text) as source_length,
    LENGTH(result_text) as result_length,
    created_at
FROM transformations
ORDER BY created_at DESC
LIMIT 100;

CREATE OR REPLACE VIEW transformation_stats AS
SELECT
    transformation_type,
    COUNT(*) as total_count,
    AVG(LENGTH(source_text)) as avg_source_length,
    AVG(LENGTH(result_text)) as avg_result_length,
    AVG((metrics->>'processing_time_ms')::numeric) as avg_processing_time_ms
FROM transformations
GROUP BY transformation_type;

-- Verification
SELECT
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'transformations'
  AND column_name IN ('source_type', 'transformation_type')
ORDER BY column_name;

-- Check constraints
SELECT
    con.conname as constraint_name,
    pg_get_constraintdef(con.oid) as constraint_definition
FROM pg_catalog.pg_constraint con
INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'transformations'
  AND con.contype = 'c';
