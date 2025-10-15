-- Migration 001: Add pipeline_jobs table and embedding column to chatgpt_messages
-- Created: 2025-10-11
-- Description: Adds infrastructure for batch embedding pipeline

-- ===================================================================
-- 1. Create pipeline_jobs table
-- ===================================================================

CREATE TABLE IF NOT EXISTS pipeline_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    target_type VARCHAR(50) NOT NULL,
    target_filter JSONB,
    total_items INTEGER NOT NULL DEFAULT 0,
    processed_items INTEGER NOT NULL DEFAULT 0,
    successful_items INTEGER NOT NULL DEFAULT 0,
    failed_items INTEGER NOT NULL DEFAULT 0,
    progress_percent FLOAT NOT NULL DEFAULT 0.0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    job_config JSONB,
    result_summary JSONB,
    error_log JSONB
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_job_type ON pipeline_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_status ON pipeline_jobs(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_created_at ON pipeline_jobs(created_at DESC);

-- ===================================================================
-- 2. Add embedding column to chatgpt_messages
-- ===================================================================

-- Add the vector column (1024 dimensions for mxbai-embed-large)
ALTER TABLE chatgpt_messages
ADD COLUMN IF NOT EXISTS embedding vector(1024);

-- Add index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_chatgpt_messages_embedding
ON chatgpt_messages USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- ===================================================================
-- 3. Add helpful views and functions
-- ===================================================================

-- View to check embedding coverage
CREATE OR REPLACE VIEW embedding_coverage AS
SELECT
    COUNT(*) as total_messages,
    COUNT(embedding) as messages_with_embeddings,
    COUNT(*) - COUNT(embedding) as messages_without_embeddings,
    ROUND(100.0 * COUNT(embedding) / NULLIF(COUNT(*), 0), 2) as coverage_percent
FROM chatgpt_messages;

-- Function to find similar messages (semantic search)
CREATE OR REPLACE FUNCTION find_similar_messages(
    query_embedding vector(1024),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    uuid uuid,
    conversation_uuid uuid,
    content_text text,
    author_role varchar(20),
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.uuid,
        m.conversation_uuid,
        m.content_text,
        m.author_role,
        1 - (m.embedding <=> query_embedding) as similarity
    FROM chatgpt_messages m
    WHERE m.embedding IS NOT NULL
    ORDER BY m.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

COMMENT ON TABLE pipeline_jobs IS 'Tracks batch processing jobs (embedding, transformation, analysis)';
COMMENT ON COLUMN chatgpt_messages.embedding IS 'Semantic embedding vector (1024-dim from mxbai-embed-large)';
