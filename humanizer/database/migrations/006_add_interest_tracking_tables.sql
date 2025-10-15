-- Migration 006: Add Interest Tracking Tables
-- Created: 2025-10-12
-- Description: Adds tables for tracking user attention flow and curating interest lists
--
-- Philosophy: "Make me smarter by helping me know my actual subjective self."
--
-- Tables:
-- 1. interests - The Turing tape of attention (what you actually looked at)
-- 2. interest_tags - User-created tags for grouping interests
-- 3. interest_lists - User-managed collections (what you want to explore)
-- 4. interest_list_items - Items in interest lists
-- 5. interest_list_branches - Track when lists fork

-- ===================================================================
-- 1. Create interests table (The Turing Tape of Attention)
-- ===================================================================

CREATE TABLE IF NOT EXISTS interests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- What are we interested in?
    interest_type VARCHAR(50) NOT NULL,
    -- Types: 'conversation', 'message', 'reading', 'concept', 'question',
    --        'transformation', 'pattern', 'connection', 'media', 'custom'

    target_uuid UUID,
    target_metadata JSONB NOT NULL DEFAULT '{}',

    -- The subjective moment
    moment_text TEXT,
    stance JSONB,  -- TRM stance (tetralemma, tone, etc.)
    context_snapshot JSONB,

    -- The Turing tape structure
    previous_interest_id UUID REFERENCES interests(id),
    next_interest_id UUID REFERENCES interests(id),

    -- Initial assessment
    salience_score FLOAT NOT NULL DEFAULT 0.5,  -- How important did this seem? (0-1)
    predicted_value FLOAT,  -- How valuable did we think it would be? (0-1)

    -- Learning what we want (updated as we go)
    advantages JSONB NOT NULL DEFAULT '[]',  -- List of advantage strings
    disadvantages JSONB NOT NULL DEFAULT '[]',  -- List of disadvantage strings
    realized_value FLOAT,  -- Did it pay off? (0-1, null until resolved)
    value_notes TEXT,

    -- Temporal tracking
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    explored_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    duration_seconds INTEGER,

    -- Pruning (learning what not to attend to)
    pruned BOOLEAN NOT NULL DEFAULT false,
    prune_reason TEXT,
    pruned_at TIMESTAMPTZ
);

-- Indexes for interests
CREATE INDEX IF NOT EXISTS idx_interests_user_id ON interests(user_id);
CREATE INDEX IF NOT EXISTS idx_interests_type ON interests(interest_type);
CREATE INDEX IF NOT EXISTS idx_interests_target_uuid ON interests(target_uuid);
CREATE INDEX IF NOT EXISTS idx_interests_created_at ON interests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interests_pruned ON interests(pruned);
CREATE INDEX IF NOT EXISTS idx_interests_previous ON interests(previous_interest_id);

COMMENT ON TABLE interests IS 'Turing tape of attention - tracks what user+AI system finds interesting';
COMMENT ON COLUMN interests.salience_score IS 'Initial importance (0-1)';
COMMENT ON COLUMN interests.realized_value IS 'Retrospective value assessment (0-1)';
COMMENT ON COLUMN interests.previous_interest_id IS 'Previous moment on the Turing tape';
COMMENT ON COLUMN interests.next_interest_id IS 'Next moment on the Turing tape';

-- ===================================================================
-- 2. Create interest_tags table
-- ===================================================================

CREATE TABLE IF NOT EXISTS interest_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interest_id UUID NOT NULL REFERENCES interests(id) ON DELETE CASCADE,

    -- Tag data
    tag VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tag_salience FLOAT  -- Overall importance of this tag (0-1)
);

-- Indexes for interest_tags
CREATE INDEX IF NOT EXISTS idx_interest_tags_user_id ON interest_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_interest_tags_interest_id ON interest_tags(interest_id);
CREATE INDEX IF NOT EXISTS idx_interest_tags_tag ON interest_tags(tag);

COMMENT ON TABLE interest_tags IS 'User-created tags for organizing interests by theme/category';

-- ===================================================================
-- 3. Create interest_lists table
-- ===================================================================

CREATE TABLE IF NOT EXISTS interest_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- List properties
    name VARCHAR(200) NOT NULL,
    description TEXT,
    list_type VARCHAR(50) NOT NULL DEFAULT 'custom',
    -- Types: 'reading', 'research', 'media', 'transformation', 'custom'

    status VARCHAR(20) NOT NULL DEFAULT 'active',
    -- Status: 'active', 'archived', 'completed'

    custom_metadata JSONB NOT NULL DEFAULT '{}',

    -- Navigation
    current_position INTEGER NOT NULL DEFAULT 0,

    -- Temporal tracking
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    -- Sharing
    is_public BOOLEAN NOT NULL DEFAULT false,

    -- Branching
    parent_list_id UUID REFERENCES interest_lists(id),
    branched_at_position INTEGER
);

-- Indexes for interest_lists
CREATE INDEX IF NOT EXISTS idx_interest_lists_user_id ON interest_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_interest_lists_type ON interest_lists(list_type);
CREATE INDEX IF NOT EXISTS idx_interest_lists_status ON interest_lists(status);
CREATE INDEX IF NOT EXISTS idx_interest_lists_created_at ON interest_lists(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interest_lists_parent ON interest_lists(parent_list_id);

COMMENT ON TABLE interest_lists IS 'User-managed collections for organizing what to explore next';
COMMENT ON COLUMN interest_lists.current_position IS 'Index of current item in the list';

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_interest_list_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_interest_list_timestamp
    BEFORE UPDATE ON interest_lists
    FOR EACH ROW
    EXECUTE FUNCTION update_interest_list_timestamp();

-- ===================================================================
-- 4. Create interest_list_items table
-- ===================================================================

CREATE TABLE IF NOT EXISTS interest_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES interest_lists(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Ordering
    position INTEGER NOT NULL,

    -- Polymorphic reference
    item_type VARCHAR(50) NOT NULL,
    -- Types: 'conversation', 'message', 'reading', 'media', 'transformation',
    --        'book', 'chunk', 'interest', 'custom'

    item_uuid UUID,
    item_metadata JSONB NOT NULL DEFAULT '{}',

    -- User annotation
    notes TEXT,

    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- Status: 'pending', 'current', 'completed', 'skipped'

    completed_at TIMESTAMPTZ,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Flexible metadata
    custom_metadata JSONB NOT NULL DEFAULT '{}'
);

-- Indexes for interest_list_items
CREATE INDEX IF NOT EXISTS idx_interest_list_items_list_id ON interest_list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_interest_list_items_user_id ON interest_list_items(user_id);
CREATE INDEX IF NOT EXISTS idx_interest_list_items_position ON interest_list_items(list_id, position);
CREATE INDEX IF NOT EXISTS idx_interest_list_items_type ON interest_list_items(item_type);
CREATE INDEX IF NOT EXISTS idx_interest_list_items_uuid ON interest_list_items(item_uuid);
CREATE INDEX IF NOT EXISTS idx_interest_list_items_status ON interest_list_items(status);

COMMENT ON TABLE interest_list_items IS 'Items in interest lists - polymorphic references to any content';
COMMENT ON COLUMN interest_list_items.position IS 'Order in the list (0-indexed)';

-- ===================================================================
-- 5. Create interest_list_branches table
-- ===================================================================

CREATE TABLE IF NOT EXISTS interest_list_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Branch relationship
    source_list_id UUID NOT NULL REFERENCES interest_lists(id) ON DELETE CASCADE,
    branch_list_id UUID NOT NULL REFERENCES interest_lists(id) ON DELETE CASCADE,

    -- Branch metadata
    branch_position INTEGER NOT NULL,
    branch_reason TEXT,

    -- Temporal
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Flexible metadata
    custom_metadata JSONB NOT NULL DEFAULT '{}'
);

-- Indexes for interest_list_branches
CREATE INDEX IF NOT EXISTS idx_interest_list_branches_user_id ON interest_list_branches(user_id);
CREATE INDEX IF NOT EXISTS idx_interest_list_branches_source ON interest_list_branches(source_list_id);
CREATE INDEX IF NOT EXISTS idx_interest_list_branches_branch ON interest_list_branches(branch_list_id);

COMMENT ON TABLE interest_list_branches IS 'Track when interest lists fork - exploring alternative paths';

-- ===================================================================
-- 6. Helper Views
-- ===================================================================

-- View: Current interests (unresolved, unpruned)
CREATE OR REPLACE VIEW current_interests AS
SELECT
    i.*,
    COUNT(it.id) as tag_count
FROM interests i
LEFT JOIN interest_tags it ON i.id = it.interest_id
WHERE i.resolved_at IS NULL
  AND i.pruned = false
GROUP BY i.id
ORDER BY i.created_at DESC;

COMMENT ON VIEW current_interests IS 'Active interests that are still being explored';

-- View: Active interest lists
CREATE OR REPLACE VIEW active_interest_lists AS
SELECT
    il.*,
    COUNT(ili.id) as item_count,
    COUNT(CASE WHEN ili.status = 'completed' THEN 1 END) as completed_count,
    ROUND(100.0 * COUNT(CASE WHEN ili.status = 'completed' THEN 1 END) / NULLIF(COUNT(ili.id), 0), 1) as progress_pct
FROM interest_lists il
LEFT JOIN interest_list_items ili ON il.id = ili.list_id
WHERE il.status = 'active'
GROUP BY il.id
ORDER BY il.updated_at DESC;

COMMENT ON VIEW active_interest_lists IS 'Active interest lists with progress metrics';

-- ===================================================================
-- 7. Helper Functions
-- ===================================================================

-- Function: Get interest trajectory (Turing tape)
CREATE OR REPLACE FUNCTION get_interest_trajectory(start_interest_id UUID, max_depth INT DEFAULT 100)
RETURNS TABLE (
    depth INT,
    interest_id UUID,
    interest_type VARCHAR(50),
    moment_text TEXT,
    salience_score FLOAT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE trajectory AS (
        -- Base case: start interest
        SELECT
            0 as depth,
            i.id,
            i.interest_type,
            i.moment_text,
            i.salience_score,
            i.created_at,
            i.next_interest_id
        FROM interests i
        WHERE i.id = start_interest_id

        UNION ALL

        -- Recursive case: follow the chain
        SELECT
            t.depth + 1,
            i.id,
            i.interest_type,
            i.moment_text,
            i.salience_score,
            i.created_at,
            i.next_interest_id
        FROM interests i
        INNER JOIN trajectory t ON i.id = t.next_interest_id
        WHERE t.depth < max_depth
    )
    SELECT
        trajectory.depth,
        trajectory.id,
        trajectory.interest_type,
        trajectory.moment_text,
        trajectory.salience_score,
        trajectory.created_at
    FROM trajectory
    ORDER BY trajectory.depth;
END;
$$;

COMMENT ON FUNCTION get_interest_trajectory IS 'Follow the Turing tape of attention from a starting interest';

-- ===================================================================
-- Migration Complete
-- ===================================================================

-- Log migration
DO $$
BEGIN
    RAISE NOTICE 'Migration 006 complete: Interest tracking tables created';
    RAISE NOTICE '  - interests: Turing tape of attention';
    RAISE NOTICE '  - interest_tags: Tag system for organizing interests';
    RAISE NOTICE '  - interest_lists: User-managed collections';
    RAISE NOTICE '  - interest_list_items: Items in lists';
    RAISE NOTICE '  - interest_list_branches: List forking system';
    RAISE NOTICE '  - Views: current_interests, active_interest_lists';
    RAISE NOTICE '  - Function: get_interest_trajectory()';
END $$;
