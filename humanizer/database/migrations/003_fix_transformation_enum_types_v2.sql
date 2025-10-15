-- Migration 003: Fix Transformation Enum Types (v2)
-- Convert ENUM columns to VARCHAR with CHECK constraints
-- Handles views that depend on the enum columns

-- Step 1: Drop dependent views
DROP VIEW IF EXISTS recent_transformations CASCADE;
DROP VIEW IF EXISTS transformation_stats CASCADE;

-- Step 2: Alter source_type column
ALTER TABLE transformations
  ALTER COLUMN source_type TYPE VARCHAR
  USING source_type::text;

-- Step 3: Add check constraint for source_type
ALTER TABLE transformations
  ADD CONSTRAINT transformations_source_type_check
  CHECK (source_type IN ('chatgpt_message', 'custom'));

-- Step 4: Alter transformation_type column
ALTER TABLE transformations
  ALTER COLUMN transformation_type TYPE VARCHAR
  USING transformation_type::text;

-- Step 5: Add check constraint for transformation_type
ALTER TABLE transformations
  ADD CONSTRAINT transformations_transformation_type_check
  CHECK (transformation_type IN ('trm', 'llm', 'personify_trm', 'personify_llm', 'custom'));

-- Step 6: Drop the old enum types
DROP TYPE IF EXISTS source_type CASCADE;
DROP TYPE IF EXISTS transformation_type CASCADE;

-- Step 7: Recreate the views with new column types
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

-- Verification: Check the new column types
SELECT
    column_name,
    data_type,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'transformations'
  AND column_name IN ('source_type', 'transformation_type');

-- Show that the transformation count
SELECT COUNT(*) as transformation_count FROM transformations;
