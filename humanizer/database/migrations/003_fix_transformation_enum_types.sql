-- Migration 003: Fix Transformation Enum Types
-- Convert ENUM columns to VARCHAR with CHECK constraints
-- This fixes the SQLAlchemy enum bug where enum NAME was used instead of VALUE

-- Step 1: Alter source_type column
ALTER TABLE transformations
  ALTER COLUMN source_type TYPE VARCHAR
  USING source_type::text;

-- Step 2: Add check constraint for source_type
ALTER TABLE transformations
  ADD CONSTRAINT transformations_source_type_check
  CHECK (source_type IN ('chatgpt_message', 'custom'));

-- Step 3: Alter transformation_type column
ALTER TABLE transformations
  ALTER COLUMN transformation_type TYPE VARCHAR
  USING transformation_type::text;

-- Step 4: Add check constraint for transformation_type
ALTER TABLE transformations
  ADD CONSTRAINT transformations_transformation_type_check
  CHECK (transformation_type IN ('trm', 'llm', 'personify_trm', 'personify_llm', 'custom'));

-- Step 5: Drop the old enum types (they're no longer needed)
DROP TYPE IF EXISTS source_type CASCADE;
DROP TYPE IF EXISTS transformation_type CASCADE;

-- Verification: Check the new column types
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'transformations'
  AND column_name IN ('source_type', 'transformation_type');
