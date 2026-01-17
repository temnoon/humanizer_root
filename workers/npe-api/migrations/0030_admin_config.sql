-- ═══════════════════════════════════════════════════════════════════════════
-- Admin Configuration System
--
-- Provides database-backed configuration for:
-- - Pricing (tiers, day pass, tax rates)
-- - Stripe integration (price IDs, webhook secrets)
-- - Feature flags (signups, maintenance mode)
-- - Rate limits and quotas
-- - Sensitive secrets (encrypted at application level)
--
-- Replaces hardcoded values in code with admin-configurable settings.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- CORE CONFIG TABLE (flexible key-value with metadata)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS admin_config (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,           -- 'pricing', 'stripe', 'features', 'limits', 'secrets', 'ui'
    key TEXT NOT NULL,                -- e.g., 'day_pass_price_cents'
    value TEXT NOT NULL,              -- JSON-encoded value (or encrypted blob)
    value_type TEXT NOT NULL DEFAULT 'string',  -- 'string', 'number', 'boolean', 'json'
    is_encrypted INTEGER DEFAULT 0,   -- 1 if value is AES-GCM encrypted
    is_secret INTEGER DEFAULT 0,      -- 1 if value should be masked in UI/logs
    description TEXT,                 -- Human-readable description for admin UI
    validation_rule TEXT,             -- Optional JSON schema or regex for validation
    updated_by TEXT,                  -- user_id of last editor
    updated_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(category, key)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- CONFIG AUDIT LOG (immutable history of all changes)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS admin_config_audit (
    id TEXT PRIMARY KEY,
    config_id TEXT NOT NULL,
    category TEXT NOT NULL,
    key TEXT NOT NULL,
    old_value TEXT,                   -- Previous value (redacted if secret)
    new_value TEXT,                   -- New value (redacted if secret)
    was_encrypted INTEGER DEFAULT 0,
    changed_by TEXT NOT NULL,         -- user_id
    changed_by_email TEXT,            -- denormalized for audit readability
    changed_at INTEGER NOT NULL,
    change_type TEXT NOT NULL,        -- 'create', 'update', 'delete'
    ip_address TEXT,
    user_agent TEXT,
    reason TEXT                       -- Optional change reason/ticket number
);

-- ═══════════════════════════════════════════════════════════════════════════
-- PRICING TIERS (structured table for tier configuration)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS pricing_tiers (
    id TEXT PRIMARY KEY,
    tier_key TEXT UNIQUE NOT NULL,    -- 'free', 'member', 'pro', 'premium', 'admin'
    display_name TEXT NOT NULL,       -- 'Member', 'Pro', 'Premium'
    description TEXT,                 -- Marketing description
    badge_text TEXT,                  -- Optional badge like 'Most Popular'

    -- Pricing (in cents, 0 = free)
    price_cents_monthly INTEGER DEFAULT 0,
    price_cents_annual INTEGER DEFAULT 0,

    -- Stripe Price IDs (test and live)
    stripe_price_id_monthly TEXT,
    stripe_price_id_annual TEXT,
    stripe_price_id_monthly_live TEXT,
    stripe_price_id_annual_live TEXT,

    -- Quotas (-1 = unlimited)
    transformations_per_month INTEGER DEFAULT 0,
    tokens_per_month INTEGER DEFAULT 0,
    max_cost_per_month_cents INTEGER DEFAULT 0,

    -- Cloud LLM Access
    can_use_cloud_providers INTEGER DEFAULT 0,
    can_use_frontier_models INTEGER DEFAULT 0,
    allowed_providers TEXT,           -- JSON array: ["together", "cloudflare", "openrouter"]

    -- Feature Access (JSON object)
    features TEXT NOT NULL DEFAULT '{}',  -- {"gptzero": false, "personalizer": false, ...}

    -- UI/Display
    is_active INTEGER DEFAULT 1,      -- 0 = hidden from pricing page
    is_default INTEGER DEFAULT 0,     -- 1 = default tier for new users
    sort_order INTEGER DEFAULT 0,     -- Display order on pricing page
    highlight_color TEXT,             -- Optional accent color for tier card

    -- Metadata
    updated_by TEXT,
    updated_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_admin_config_category ON admin_config(category);
CREATE INDEX IF NOT EXISTS idx_admin_config_category_key ON admin_config(category, key);
CREATE INDEX IF NOT EXISTS idx_admin_config_updated ON admin_config(updated_at);

CREATE INDEX IF NOT EXISTS idx_admin_config_audit_config ON admin_config_audit(config_id);
CREATE INDEX IF NOT EXISTS idx_admin_config_audit_category ON admin_config_audit(category, key);
CREATE INDEX IF NOT EXISTS idx_admin_config_audit_time ON admin_config_audit(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_config_audit_user ON admin_config_audit(changed_by);

CREATE INDEX IF NOT EXISTS idx_pricing_tiers_key ON pricing_tiers(tier_key);
CREATE INDEX IF NOT EXISTS idx_pricing_tiers_active ON pricing_tiers(is_active);
CREATE INDEX IF NOT EXISTS idx_pricing_tiers_order ON pricing_tiers(sort_order);

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DEFAULT PRICING TIERS
-- ═══════════════════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO pricing_tiers (
    id, tier_key, display_name, description,
    price_cents_monthly, price_cents_annual,
    stripe_price_id_monthly,
    transformations_per_month, tokens_per_month, max_cost_per_month_cents,
    can_use_cloud_providers, can_use_frontier_models, allowed_providers,
    features, is_active, is_default, sort_order,
    updated_at, created_at
) VALUES
-- Free tier
(
    'tier_free_001',
    'free',
    'Free',
    'Get started with basic features',
    0, 0,
    NULL,
    5, 10000, 0,
    0, 0, '[]',
    '{"gptzero": false, "personalizer": false, "quantumAnalysis": false, "sicAnalysis": false, "modelTier": "7B"}',
    1, 1, 0,
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
),
-- Member tier
(
    'tier_member_001',
    'member',
    'Member',
    '50 transformations/month with cloud AI access',
    999, 9990,
    'price_1SYxjbAan5JVY3W94tofsfOZ',
    50, 100000, 500,
    1, 0, '["together", "cloudflare", "openrouter"]',
    '{"gptzero": false, "personalizer": false, "quantumAnalysis": true, "sicAnalysis": false, "modelTier": "7B"}',
    1, 0, 1,
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
),
-- Pro tier
(
    'tier_pro_001',
    'pro',
    'Pro',
    '200 transformations/month with frontier models and GPTZero',
    2999, 29990,
    'price_1SYxllAan5JVY3W9TpguSxMZ',
    200, 1600000, 5000,
    1, 1, '["together", "cloudflare", "openrouter", "openai", "anthropic", "groq"]',
    '{"gptzero": true, "personalizer": true, "quantumAnalysis": true, "sicAnalysis": true, "modelTier": "70B"}',
    1, 0, 2,
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
),
-- Premium tier
(
    'tier_premium_001',
    'premium',
    'Premium',
    'Unlimited transformations with all features',
    9999, 99990,
    'price_1SYxo5Aan5JVY3W93wVtePwk',
    -1, -1, -1,
    1, 1, '["together", "cloudflare", "openrouter", "openai", "anthropic", "groq", "google"]',
    '{"gptzero": true, "personalizer": true, "quantumAnalysis": true, "sicAnalysis": true, "modelTier": "70B", "apiAccess": true}',
    1, 0, 3,
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
),
-- Admin tier (internal)
(
    'tier_admin_001',
    'admin',
    'Admin',
    'Full access for administrators',
    0, 0,
    NULL,
    -1, -1, -1,
    1, 1, '["together", "cloudflare", "openrouter", "openai", "anthropic", "groq", "google", "ollama"]',
    '{"gptzero": true, "personalizer": true, "quantumAnalysis": true, "sicAnalysis": true, "modelTier": "70B", "apiAccess": true, "adminPanel": true}',
    0, 0, 99,
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
);

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DEFAULT CONFIG VALUES
-- ═══════════════════════════════════════════════════════════════════════════

-- Pricing config
INSERT OR IGNORE INTO admin_config (id, category, key, value, value_type, description, updated_at, created_at)
VALUES
    ('cfg_day_pass_price', 'pricing', 'day_pass_price_cents', '100', 'number', 'Day pass price in cents ($1.00)', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('cfg_day_pass_duration', 'pricing', 'day_pass_duration_hours', '24', 'number', 'Day pass duration in hours', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('cfg_trial_days', 'pricing', 'trial_days', '7', 'number', 'Free trial period in days', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- Tax config
INSERT OR IGNORE INTO admin_config (id, category, key, value, value_type, description, updated_at, created_at)
VALUES
    ('cfg_tax_rate', 'pricing', 'tax_rate', '0.08625', 'number', 'Sales tax rate (8.625% for Nassau County, NY)', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('cfg_tax_jurisdiction', 'pricing', 'tax_jurisdiction', '"Lynbrook, NY (Nassau County)"', 'string', 'Tax jurisdiction for receipts', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('cfg_tax_breakdown', 'pricing', 'tax_breakdown', '{"nyState": "4.000%", "nassauCounty": "4.250%", "mtaSurcharge": "0.375%"}', 'json', 'Tax rate breakdown by component', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- Feature flags
INSERT OR IGNORE INTO admin_config (id, category, key, value, value_type, description, updated_at, created_at)
VALUES
    ('cfg_signups_enabled', 'features', 'signups_enabled', 'true', 'boolean', 'Allow new user registrations', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('cfg_maintenance_mode', 'features', 'maintenance_mode', 'false', 'boolean', 'Show maintenance page to non-admins', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('cfg_beta_features', 'features', 'beta_features_enabled', 'false', 'boolean', 'Enable beta features for all users', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('cfg_waitlist_mode', 'features', 'waitlist_mode', 'true', 'boolean', 'Require waitlist approval for new signups', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- Rate limits
INSERT OR IGNORE INTO admin_config (id, category, key, value, value_type, description, updated_at, created_at)
VALUES
    ('cfg_rate_limit_auth', 'limits', 'rate_limit_auth_per_minute', '10', 'number', 'Auth attempts per minute per IP', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('cfg_rate_limit_api', 'limits', 'rate_limit_api_per_minute', '60', 'number', 'API calls per minute per user', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('cfg_max_file_size', 'limits', 'max_file_size_mb', '50', 'number', 'Maximum upload file size in MB', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- UI config
INSERT OR IGNORE INTO admin_config (id, category, key, value, value_type, description, updated_at, created_at)
VALUES
    ('cfg_welcome_message', 'ui', 'welcome_message', '"Give Yourself Enough Respect to Humanize Yourself"', 'string', 'Home page welcome message', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('cfg_support_email', 'ui', 'support_email', '"support@humanizer.com"', 'string', 'Support contact email', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);
