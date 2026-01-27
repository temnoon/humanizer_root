/**
 * PostgreSQL Schema for AUI Storage
 *
 * DDL for persisting AUI sessions, buffers, books, clusters, and artifacts
 * so they survive server restarts and can be accessed weeks/months later.
 *
 * @module @humanizer/core/storage/schema-aui
 */

import type { PoolClient } from 'pg';

// ═══════════════════════════════════════════════════════════════════
// AUI SESSION TABLE
// ═══════════════════════════════════════════════════════════════════

/**
 * Sessions table - persists user session state
 */
export const CREATE_AUI_SESSIONS_TABLE = `
CREATE TABLE IF NOT EXISTS aui_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  name TEXT,
  active_buffer_name TEXT,
  search_session_id TEXT,
  command_history TEXT[] DEFAULT '{}',
  variables JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ DEFAULT NOW()
);
`;

// ═══════════════════════════════════════════════════════════════════
// VERSIONED BUFFER TABLES
// ═══════════════════════════════════════════════════════════════════

/**
 * Buffers table - buffer metadata
 */
export const CREATE_AUI_BUFFERS_TABLE = `
CREATE TABLE IF NOT EXISTS aui_buffers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES aui_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  current_branch TEXT NOT NULL DEFAULT 'main',
  working_content JSONB DEFAULT '[]',
  is_dirty BOOLEAN NOT NULL DEFAULT FALSE,
  schema JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, name)
);
`;

/**
 * Buffer branches table - git-like branches
 */
export const CREATE_AUI_BUFFER_BRANCHES_TABLE = `
CREATE TABLE IF NOT EXISTS aui_buffer_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buffer_id UUID NOT NULL REFERENCES aui_buffers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  head_version_id TEXT,
  parent_branch TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(buffer_id, name)
);
`;

/**
 * Buffer versions table - git-like commits
 */
export const CREATE_AUI_BUFFER_VERSIONS_TABLE = `
CREATE TABLE IF NOT EXISTS aui_buffer_versions (
  id TEXT PRIMARY KEY,
  buffer_id UUID NOT NULL REFERENCES aui_buffers(id) ON DELETE CASCADE,
  content JSONB NOT NULL DEFAULT '[]',
  message TEXT NOT NULL,
  parent_id TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

// ═══════════════════════════════════════════════════════════════════
// AGENT TASK TABLE
// ═══════════════════════════════════════════════════════════════════

/**
 * Tasks table - agent task history
 */
export const CREATE_AUI_TASKS_TABLE = `
CREATE TABLE IF NOT EXISTS aui_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES aui_sessions(id) ON DELETE CASCADE,
  request TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'planning', 'executing', 'awaiting_input', 'paused', 'completed', 'failed', 'cancelled')),
  steps JSONB DEFAULT '[]',
  plan JSONB,
  result JSONB,
  error TEXT,
  priority INTEGER NOT NULL DEFAULT 3,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  total_cost_cents INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

// ═══════════════════════════════════════════════════════════════════
// BOOK TABLES
// ═══════════════════════════════════════════════════════════════════

/**
 * Books table - book metadata
 */
export const CREATE_AUI_BOOKS_TABLE = `
CREATE TABLE IF NOT EXISTS aui_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  arc JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  source_cluster_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

/**
 * Book chapters table - chapter content
 */
export const CREATE_AUI_BOOK_CHAPTERS_TABLE = `
CREATE TABLE IF NOT EXISTS aui_book_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES aui_books(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  passage_ids TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

// ═══════════════════════════════════════════════════════════════════
// CLUSTER CACHE TABLE
// ═══════════════════════════════════════════════════════════════════

/**
 * Clusters table - cached cluster discovery results
 */
export function createAuiClustersTable(dimension: number): string {
  return `
CREATE TABLE IF NOT EXISTS aui_clusters (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  label TEXT NOT NULL,
  description TEXT,
  passages JSONB DEFAULT '[]',
  total_passages INTEGER NOT NULL DEFAULT 0,
  coherence REAL,
  keywords TEXT[] DEFAULT '{}',
  source_distribution JSONB DEFAULT '{}',
  date_range JSONB,
  avg_word_count REAL,
  centroid vector(${dimension}),
  discovery_options JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);
`;
}

// ═══════════════════════════════════════════════════════════════════
// PERSONA PROFILE TABLE
// ═══════════════════════════════════════════════════════════════════

/**
 * Persona profiles table - stores voice and style configurations for books
 *
 * Used for persona-consistent book creation pipeline:
 * - Voice traits and tone markers for voice transformation
 * - Style guide with forbidden/preferred phrases
 * - Reference examples for voice fingerprinting
 */
export const CREATE_AUI_PERSONA_PROFILES_TABLE = `
CREATE TABLE IF NOT EXISTS aui_persona_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  voice_traits TEXT[] DEFAULT '{}',
  tone_markers TEXT[] DEFAULT '{}',
  formality_min REAL DEFAULT 0.3,
  formality_max REAL DEFAULT 0.7,
  style_guide JSONB DEFAULT '{}',
  reference_examples TEXT[] DEFAULT '{}',
  voice_fingerprint JSONB,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

// ═══════════════════════════════════════════════════════════════════
// STYLE PROFILE TABLE
// ═══════════════════════════════════════════════════════════════════

/**
 * Style profiles table - context-specific writing styles for personas
 *
 * Enables persona -> many styles relationship:
 * - One persona can have multiple styles (Academic, Casual, Newsletter, etc.)
 * - Each style has its own forbidden phrases, formality level, etc.
 * - Supports context-based style selection
 */
export const CREATE_AUI_STYLE_PROFILES_TABLE = `
CREATE TABLE IF NOT EXISTS aui_style_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES aui_persona_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  context TEXT,
  forbidden_phrases TEXT[] DEFAULT '{}',
  preferred_patterns TEXT[] DEFAULT '{}',
  sentence_variety TEXT DEFAULT 'medium' CHECK (sentence_variety IN ('low', 'medium', 'high')),
  paragraph_style TEXT DEFAULT 'medium' CHECK (paragraph_style IN ('short', 'medium', 'long')),
  use_contractions BOOLEAN DEFAULT TRUE,
  use_rhetorical_questions BOOLEAN DEFAULT FALSE,
  formality_level REAL DEFAULT 0.5 CHECK (formality_level >= 0 AND formality_level <= 1),
  is_default BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(persona_id, name)
);
`;

// ═══════════════════════════════════════════════════════════════════
// PATTERN DISCOVERY TABLES
// ═══════════════════════════════════════════════════════════════════

/**
 * Patterns table - saved pattern definitions (user-created and promoted)
 *
 * Stores both user-described patterns and validated discovered patterns.
 * Supports atomic patterns (with dimensions) and composed patterns (algebra).
 */
export function createAuiPatternsTable(dimension: number): string {
  return `
CREATE TABLE IF NOT EXISTS aui_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  definition JSONB NOT NULL,
  tags TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
  usage_count INTEGER NOT NULL DEFAULT 0,
  success_rate REAL,
  centroid vector(${dimension}),
  source_discovered_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  UNIQUE(user_id, name)
);
`;
}

/**
 * Pattern feedback table - immutable records of user judgments
 *
 * Each feedback entry teaches the system about pattern quality.
 * Content snapshots enable learning even after content changes.
 */
export const CREATE_AUI_PATTERN_FEEDBACK_TABLE = `
CREATE TABLE IF NOT EXISTS aui_pattern_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id UUID NOT NULL REFERENCES aui_patterns(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL,
  judgment TEXT NOT NULL CHECK (judgment IN ('correct', 'incorrect', 'partial')),
  explanation TEXT,
  content_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);
`;

/**
 * Pattern constraints table - learned refinements from feedback
 *
 * Stores rules the system learned to improve pattern matching.
 * Each constraint has a confidence score and source feedback trail.
 */
export const CREATE_AUI_PATTERN_CONSTRAINTS_TABLE = `
CREATE TABLE IF NOT EXISTS aui_pattern_constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id UUID NOT NULL REFERENCES aui_patterns(id) ON DELETE CASCADE,
  constraint_type TEXT NOT NULL CHECK (constraint_type IN ('content', 'semantic', 'metadata', 'structural')),
  constraint_definition JSONB NOT NULL,
  description TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  source_feedback_ids UUID[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);
`;

/**
 * Discovered patterns table - autonomous pattern discoveries with TTL
 *
 * Stores candidate patterns found by autonomous discovery.
 * Can be promoted to aui_patterns when validated by user.
 */
export function createAuiDiscoveredPatternsTable(dimension: number): string {
  return `
CREATE TABLE IF NOT EXISTS aui_discovered_patterns (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  observation TEXT NOT NULL,
  dimensions JSONB NOT NULL DEFAULT '[]',
  instance_count INTEGER NOT NULL DEFAULT 0,
  confidence REAL NOT NULL DEFAULT 0.5,
  discovery_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'validated', 'rejected', 'promoted')),
  promoted_to_pattern_id UUID REFERENCES aui_patterns(id) ON DELETE SET NULL,
  sample_content_ids TEXT[] DEFAULT '{}',
  centroid vector(${dimension}),
  discovery_options JSONB,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;
}

// ═══════════════════════════════════════════════════════════════════
// ARTIFACT TABLE
// ═══════════════════════════════════════════════════════════════════

/**
 * Artifacts table - exportable files
 */
export const CREATE_AUI_ARTIFACTS_TABLE = `
CREATE TABLE IF NOT EXISTS aui_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  name TEXT NOT NULL,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('markdown', 'pdf', 'epub', 'html', 'json', 'zip')),
  content TEXT,
  content_binary BYTEA,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER,
  source_type TEXT,
  source_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  download_count INTEGER NOT NULL DEFAULT 0,
  last_downloaded_at TIMESTAMPTZ
);
`;

// ═══════════════════════════════════════════════════════════════════
// CONTENT BUFFER TABLES (API-First Buffer System)
// ═══════════════════════════════════════════════════════════════════

/**
 * Content buffers table - immutable content wrappers with provenance
 *
 * Each transformation creates a NEW buffer; buffers are never mutated.
 * Content is addressed by SHA-256 hash for deduplication.
 */
export function createAuiContentBuffersTable(dimension: number): string {
  return `
CREATE TABLE IF NOT EXISTS aui_content_buffers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash TEXT NOT NULL,
  text TEXT NOT NULL,
  word_count INTEGER NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('text', 'markdown', 'html', 'code')),
  state TEXT NOT NULL CHECK (state IN ('transient', 'staged', 'committed', 'archived')),
  origin JSONB NOT NULL,
  quality_metrics JSONB,
  embedding vector(${dimension}),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for content deduplication
CREATE INDEX IF NOT EXISTS idx_aui_content_buffers_hash ON aui_content_buffers(content_hash);
`;
}

/**
 * Provenance chains table - linked list of transformations
 *
 * Tracks the full history of a buffer through all operations.
 */
export const CREATE_AUI_PROVENANCE_CHAINS_TABLE = `
CREATE TABLE IF NOT EXISTS aui_provenance_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  root_buffer_id UUID NOT NULL,
  current_buffer_id UUID NOT NULL REFERENCES aui_content_buffers(id) ON DELETE SET NULL,
  branch_name TEXT NOT NULL DEFAULT 'main',
  branch_description TEXT,
  is_main BOOLEAN DEFAULT TRUE,
  parent_chain_id UUID REFERENCES aui_provenance_chains(id) ON DELETE SET NULL,
  child_chain_ids UUID[] DEFAULT '{}',
  transformation_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

/**
 * Buffer operations table - records what happened to buffers
 *
 * Each operation is an immutable record in the provenance chain.
 */
export const CREATE_AUI_BUFFER_OPERATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS aui_buffer_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id UUID NOT NULL REFERENCES aui_provenance_chains(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  operation_type TEXT NOT NULL,
  performer JSONB NOT NULL,
  parameters JSONB DEFAULT '{}',
  before_hash TEXT NOT NULL,
  after_hash TEXT NOT NULL,
  delta_hash TEXT,
  quality_impact JSONB,
  description TEXT NOT NULL,
  duration_ms INTEGER,
  cost_cents INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(chain_id, sequence_number)
);
`;

// ═══════════════════════════════════════════════════════════════════
// USER ACCOUNTING TABLES
// ═══════════════════════════════════════════════════════════════════

/**
 * Usage events table - granular audit log of all LLM operations
 *
 * Each LLM call creates a single usage_event record with token counts,
 * costs, and performance metrics. Used for billing, analytics, and debugging.
 */
export const CREATE_AUI_USAGE_EVENTS_TABLE = `
CREATE TABLE IF NOT EXISTS aui_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'humanizer',
  user_id TEXT NOT NULL,

  -- Operation details
  operation_type TEXT NOT NULL,
  model_id TEXT NOT NULL,
  model_provider TEXT NOT NULL,

  -- Token usage
  tokens_input INTEGER NOT NULL DEFAULT 0,
  tokens_output INTEGER NOT NULL DEFAULT 0,
  tokens_total INTEGER GENERATED ALWAYS AS (tokens_input + tokens_output) STORED,

  -- Cost tracking (millicents: 1 USD = 100,000 millicents for precision)
  provider_cost_millicents INTEGER NOT NULL DEFAULT 0,
  user_charge_millicents INTEGER NOT NULL DEFAULT 0,

  -- Performance metrics
  latency_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'timeout', 'rate_limited')),
  error TEXT,

  -- Context
  session_id UUID,
  request_id TEXT,
  api_key_id UUID,

  -- Billing period (YYYY-MM format for efficient aggregation)
  billing_period TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

/**
 * User usage snapshots table - aggregated usage per billing period
 *
 * Pre-aggregated usage data for fast quota checks and billing.
 * Updated incrementally as usage_events are recorded.
 */
export const CREATE_AUI_USER_USAGE_SNAPSHOTS_TABLE = `
CREATE TABLE IF NOT EXISTS aui_user_usage_snapshots (
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'humanizer',
  billing_period TEXT NOT NULL,

  -- Usage totals
  tokens_used INTEGER NOT NULL DEFAULT 0,
  requests_count INTEGER NOT NULL DEFAULT 0,
  cost_millicents INTEGER NOT NULL DEFAULT 0,

  -- Limits (cached from tier at period start)
  tokens_limit INTEGER NOT NULL,
  requests_limit INTEGER NOT NULL,
  cost_limit_millicents INTEGER NOT NULL,

  -- Breakdown by model (JSONB for flexibility)
  by_model JSONB DEFAULT '{}',
  -- Breakdown by operation type
  by_operation JSONB DEFAULT '{}',

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (user_id, tenant_id, billing_period)
);
`;

/**
 * API keys table - user-owned API keys for programmatic access
 *
 * Keys are hashed using SHA-256; only the prefix is stored for identification.
 * Full key is shown only once at creation time.
 */
export const CREATE_AUI_API_KEYS_TABLE = `
CREATE TABLE IF NOT EXISTS aui_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'humanizer',

  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,

  scopes TEXT[] DEFAULT '{}',
  rate_limit_rpm INTEGER DEFAULT 60,

  last_used_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,

  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(tenant_id, key_prefix)
);
`;

/**
 * Tier defaults table - configuration for each subscription tier
 *
 * Defines limits and quotas for each tier. Used as the source of truth
 * for quota enforcement. Admin-editable via admin interface.
 */
export const CREATE_AUI_TIER_DEFAULTS_TABLE = `
CREATE TABLE IF NOT EXISTS aui_tier_defaults (
  tenant_id TEXT NOT NULL DEFAULT 'humanizer',
  tier TEXT NOT NULL,

  -- Monthly limits
  tokens_per_month INTEGER NOT NULL,
  requests_per_month INTEGER NOT NULL,
  cost_cents_per_month INTEGER NOT NULL,

  -- Rate limits
  requests_per_minute INTEGER NOT NULL,

  -- API key limits
  max_api_keys INTEGER NOT NULL,

  -- Feature flags (JSONB for flexibility)
  features JSONB DEFAULT '{}',

  -- Display
  display_name TEXT NOT NULL,
  description TEXT,
  price_monthly_cents INTEGER DEFAULT 0,
  price_annual_cents INTEGER DEFAULT 0,
  priority INTEGER DEFAULT 100,
  is_public BOOLEAN DEFAULT TRUE,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (tenant_id, tier)
);
`;

/**
 * User quota overrides table - per-user limit adjustments
 *
 * Allows admins to grant specific users different limits than their tier.
 * Used for special cases, promotions, or enterprise custom deals.
 */
export const CREATE_AUI_USER_QUOTA_OVERRIDES_TABLE = `
CREATE TABLE IF NOT EXISTS aui_user_quota_overrides (
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'humanizer',

  -- Override values (NULL means use tier default)
  tokens_per_month INTEGER,
  requests_per_month INTEGER,
  cost_cents_per_month INTEGER,

  -- Audit trail
  reason TEXT NOT NULL,
  granted_by TEXT,

  effective_until TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (user_id, tenant_id)
);
`;

/**
 * User preferences table - per-user settings and customizations
 *
 * Stores user preferences for models, prompts, UI settings, etc.
 * All values are JSONB for flexibility as preferences evolve.
 */
export const CREATE_AUI_USER_PREFERENCES_TABLE = `
CREATE TABLE IF NOT EXISTS aui_user_preferences (
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'humanizer',

  -- Model preferences (default model, temperature, etc.)
  model_preferences JSONB DEFAULT '{}',

  -- Custom prompt templates (for PRO+ users)
  prompt_customizations JSONB DEFAULT '{}',

  -- Default transformation settings
  transformation_defaults JSONB DEFAULT '{}',

  -- UI preferences (theme, layout, etc.)
  ui_preferences JSONB DEFAULT '{}',

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (user_id, tenant_id)
);
`;

/**
 * Provider cost rates table - tracks provider pricing over time
 *
 * Stores historical pricing for accurate cost calculation.
 * New rates are added as rows; effective_until marks when a rate expires.
 */
export const CREATE_AUI_PROVIDER_COST_RATES_TABLE = `
CREATE TABLE IF NOT EXISTS aui_provider_cost_rates (
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,

  -- Cost per million tokens (in millicents for precision)
  input_cost_per_mtok INTEGER NOT NULL,
  output_cost_per_mtok INTEGER NOT NULL,

  effective_from TIMESTAMPTZ NOT NULL,
  effective_until TIMESTAMPTZ,

  PRIMARY KEY (provider, model_id, effective_from)
);
`;

/**
 * Seed tier defaults with initial values
 */
export const SEED_AUI_TIER_DEFAULTS = `
INSERT INTO aui_tier_defaults (tenant_id, tier, tokens_per_month, requests_per_month, cost_cents_per_month, requests_per_minute, max_api_keys, display_name, description, price_monthly_cents, priority, is_public)
VALUES
  ('humanizer', 'free', 10000, 20, 0, 5, 0, 'Free', 'Basic access with limited usage', 0, 100, true),
  ('humanizer', 'member', 100000, 500, 500, 20, 2, 'Member', 'For active community members', 999, 90, true),
  ('humanizer', 'pro', 500000, 2000, 2000, 60, 10, 'Pro', 'Full access for creators', 1999, 80, true),
  ('humanizer', 'premium', -1, -1, 10000, 120, 50, 'Premium', 'Unlimited access for power users', 4999, 70, true),
  ('humanizer', 'admin', -1, -1, -1, -1, -1, 'Admin', 'System administrators', 0, 0, false)
ON CONFLICT (tenant_id, tier) DO NOTHING;
`;

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE FLAGS TABLE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Feature flags table - system-wide and tier-specific feature toggles
 *
 * Enables A/B testing, gradual rollouts, and tier-based feature gating.
 */
export const CREATE_AUI_FEATURE_FLAGS_TABLE = `
CREATE TABLE IF NOT EXISTS aui_feature_flags (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'humanizer',
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'core' CHECK (category IN ('core', 'premium', 'beta', 'experimental')),

  -- Global toggle
  enabled BOOLEAN NOT NULL DEFAULT TRUE,

  -- Gradual rollout (0-100)
  rollout_percentage INTEGER DEFAULT 100,

  -- Tier-specific overrides (JSONB array of {tier, enabled})
  tier_overrides JSONB DEFAULT '[]',

  -- Metadata
  created_by TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(tenant_id, id)
);
`;

/**
 * Seed default feature flags
 */
export const SEED_AUI_FEATURE_FLAGS = `
INSERT INTO aui_feature_flags (id, tenant_id, name, description, category, enabled, tier_overrides)
VALUES
  ('semantic_search', 'humanizer', 'Semantic Search', 'Enable semantic search powered by embeddings', 'core', true, '[]'),
  ('custom_prompts', 'humanizer', 'Custom Prompts', 'Allow users to create custom prompt templates', 'premium', true, '[{"tier":"free","enabled":false},{"tier":"member","enabled":false},{"tier":"pro","enabled":true},{"tier":"premium","enabled":true}]'),
  ('api_access', 'humanizer', 'API Access', 'Enable API key creation and external API access', 'premium', true, '[{"tier":"free","enabled":false},{"tier":"member","enabled":true},{"tier":"pro","enabled":true},{"tier":"premium","enabled":true}]'),
  ('book_export', 'humanizer', 'Book Export', 'Export books to various formats (EPUB, PDF, etc)', 'core', true, '[]'),
  ('advanced_analytics', 'humanizer', 'Advanced Analytics', 'Detailed usage analytics and insights', 'beta', false, '[]')
ON CONFLICT (tenant_id, id) DO NOTHING;
`;

// ═══════════════════════════════════════════════════════════════════════════
// AUDIT EVENTS TABLE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Audit events table - immutable log of all significant system events
 *
 * Records user actions, admin operations, API usage, and system events
 * for security auditing, debugging, and compliance.
 */
export const CREATE_AUI_AUDIT_EVENTS_TABLE = `
CREATE TABLE IF NOT EXISTS aui_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'humanizer',

  -- What happened
  action TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('auth', 'admin', 'billing', 'api', 'system')),

  -- Who did it
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system', 'api_key')),
  actor_id TEXT NOT NULL,
  actor_email TEXT,

  -- What it affected (optional)
  target_type TEXT,
  target_id TEXT,
  target_name TEXT,

  -- Context
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,

  -- Result
  success BOOLEAN NOT NULL DEFAULT TRUE,
  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

/**
 * Seed provider cost rates with current pricing
 */
export const SEED_AUI_PROVIDER_COST_RATES = `
INSERT INTO aui_provider_cost_rates (provider, model_id, input_cost_per_mtok, output_cost_per_mtok, effective_from)
VALUES
  -- Ollama (local) - no API cost
  ('ollama', 'llama3.2:3b', 0, 0, NOW()),
  ('ollama', 'llama3.3:70b', 0, 0, NOW()),
  ('ollama', 'nomic-embed-text:latest', 0, 0, NOW()),

  -- Anthropic Claude (costs in millicents per million tokens)
  ('anthropic', 'claude-haiku-4-5-20251001', 100000, 500000, NOW()),
  ('anthropic', 'claude-sonnet-4-20250514', 300000, 1500000, NOW()),
  ('anthropic', 'claude-opus-4-5-20251101', 1500000, 7500000, NOW()),

  -- OpenAI
  ('openai', 'gpt-4o', 250000, 1000000, NOW()),
  ('openai', 'gpt-4o-mini', 15000, 60000, NOW())
ON CONFLICT (provider, model_id, effective_from) DO NOTHING;
`;

// ═══════════════════════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════════════════════

/**
 * Create all AUI indexes
 */
export const CREATE_AUI_INDEXES = `
-- Sessions indexes
CREATE INDEX IF NOT EXISTS idx_aui_sessions_user ON aui_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_aui_sessions_updated ON aui_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_aui_sessions_expires ON aui_sessions(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_aui_sessions_last_accessed ON aui_sessions(last_accessed_at DESC);

-- Buffers indexes
CREATE INDEX IF NOT EXISTS idx_aui_buffers_session ON aui_buffers(session_id);
CREATE INDEX IF NOT EXISTS idx_aui_buffers_name ON aui_buffers(session_id, name);
CREATE INDEX IF NOT EXISTS idx_aui_buffers_updated ON aui_buffers(updated_at DESC);

-- Branches indexes
CREATE INDEX IF NOT EXISTS idx_aui_branches_buffer ON aui_buffer_branches(buffer_id);
CREATE INDEX IF NOT EXISTS idx_aui_branches_name ON aui_buffer_branches(buffer_id, name);

-- Versions indexes
CREATE INDEX IF NOT EXISTS idx_aui_versions_buffer ON aui_buffer_versions(buffer_id);
CREATE INDEX IF NOT EXISTS idx_aui_versions_parent ON aui_buffer_versions(parent_id);
CREATE INDEX IF NOT EXISTS idx_aui_versions_created ON aui_buffer_versions(created_at DESC);

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_aui_tasks_session ON aui_tasks(session_id);
CREATE INDEX IF NOT EXISTS idx_aui_tasks_status ON aui_tasks(status);
CREATE INDEX IF NOT EXISTS idx_aui_tasks_created ON aui_tasks(created_at DESC);

-- Books indexes
CREATE INDEX IF NOT EXISTS idx_aui_books_user ON aui_books(user_id);
CREATE INDEX IF NOT EXISTS idx_aui_books_status ON aui_books(status);
CREATE INDEX IF NOT EXISTS idx_aui_books_cluster ON aui_books(source_cluster_id);
CREATE INDEX IF NOT EXISTS idx_aui_books_created ON aui_books(created_at DESC);

-- Chapters indexes
CREATE INDEX IF NOT EXISTS idx_aui_chapters_book ON aui_book_chapters(book_id);
CREATE INDEX IF NOT EXISTS idx_aui_chapters_position ON aui_book_chapters(book_id, position);

-- Clusters indexes
CREATE INDEX IF NOT EXISTS idx_aui_clusters_user ON aui_clusters(user_id);
CREATE INDEX IF NOT EXISTS idx_aui_clusters_expires ON aui_clusters(expires_at);
CREATE INDEX IF NOT EXISTS idx_aui_clusters_created ON aui_clusters(created_at DESC);

-- Artifacts indexes
CREATE INDEX IF NOT EXISTS idx_aui_artifacts_user ON aui_artifacts(user_id);
CREATE INDEX IF NOT EXISTS idx_aui_artifacts_type ON aui_artifacts(artifact_type);
CREATE INDEX IF NOT EXISTS idx_aui_artifacts_source ON aui_artifacts(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_aui_artifacts_expires ON aui_artifacts(expires_at);
CREATE INDEX IF NOT EXISTS idx_aui_artifacts_created ON aui_artifacts(created_at DESC);

-- Persona profiles indexes
CREATE INDEX IF NOT EXISTS idx_aui_personas_user ON aui_persona_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_aui_personas_name ON aui_persona_profiles(user_id, name);
CREATE INDEX IF NOT EXISTS idx_aui_personas_default ON aui_persona_profiles(user_id, is_default) WHERE is_default = TRUE;
CREATE INDEX IF NOT EXISTS idx_aui_personas_updated ON aui_persona_profiles(updated_at DESC);

-- Style profiles indexes
CREATE INDEX IF NOT EXISTS idx_aui_styles_persona ON aui_style_profiles(persona_id);
CREATE INDEX IF NOT EXISTS idx_aui_styles_name ON aui_style_profiles(persona_id, name);
CREATE INDEX IF NOT EXISTS idx_aui_styles_default ON aui_style_profiles(persona_id, is_default) WHERE is_default = TRUE;
CREATE INDEX IF NOT EXISTS idx_aui_styles_updated ON aui_style_profiles(updated_at DESC);

-- Content buffers indexes
CREATE INDEX IF NOT EXISTS idx_aui_content_buffers_state ON aui_content_buffers(state);
CREATE INDEX IF NOT EXISTS idx_aui_content_buffers_format ON aui_content_buffers(format);
CREATE INDEX IF NOT EXISTS idx_aui_content_buffers_created ON aui_content_buffers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aui_content_buffers_updated ON aui_content_buffers(updated_at DESC);

-- Provenance chains indexes
CREATE INDEX IF NOT EXISTS idx_aui_provenance_root ON aui_provenance_chains(root_buffer_id);
CREATE INDEX IF NOT EXISTS idx_aui_provenance_current ON aui_provenance_chains(current_buffer_id);
CREATE INDEX IF NOT EXISTS idx_aui_provenance_parent ON aui_provenance_chains(parent_chain_id);
CREATE INDEX IF NOT EXISTS idx_aui_provenance_branch ON aui_provenance_chains(branch_name);
CREATE INDEX IF NOT EXISTS idx_aui_provenance_created ON aui_provenance_chains(created_at DESC);

-- Buffer operations indexes
CREATE INDEX IF NOT EXISTS idx_aui_operations_chain ON aui_buffer_operations(chain_id);
CREATE INDEX IF NOT EXISTS idx_aui_operations_type ON aui_buffer_operations(operation_type);
CREATE INDEX IF NOT EXISTS idx_aui_operations_before ON aui_buffer_operations(before_hash);
CREATE INDEX IF NOT EXISTS idx_aui_operations_after ON aui_buffer_operations(after_hash);
CREATE INDEX IF NOT EXISTS idx_aui_operations_created ON aui_buffer_operations(created_at DESC);

-- Patterns indexes
CREATE INDEX IF NOT EXISTS idx_aui_patterns_user ON aui_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_aui_patterns_name ON aui_patterns(user_id, name);
CREATE INDEX IF NOT EXISTS idx_aui_patterns_status ON aui_patterns(status);
CREATE INDEX IF NOT EXISTS idx_aui_patterns_tags ON aui_patterns USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_aui_patterns_updated ON aui_patterns(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_aui_patterns_last_used ON aui_patterns(last_used_at DESC NULLS LAST);

-- Pattern feedback indexes
CREATE INDEX IF NOT EXISTS idx_aui_pattern_feedback_pattern ON aui_pattern_feedback(pattern_id);
CREATE INDEX IF NOT EXISTS idx_aui_pattern_feedback_content ON aui_pattern_feedback(content_id);
CREATE INDEX IF NOT EXISTS idx_aui_pattern_feedback_judgment ON aui_pattern_feedback(pattern_id, judgment);
CREATE INDEX IF NOT EXISTS idx_aui_pattern_feedback_created ON aui_pattern_feedback(created_at DESC);

-- Pattern constraints indexes
CREATE INDEX IF NOT EXISTS idx_aui_pattern_constraints_pattern ON aui_pattern_constraints(pattern_id);
CREATE INDEX IF NOT EXISTS idx_aui_pattern_constraints_type ON aui_pattern_constraints(constraint_type);
CREATE INDEX IF NOT EXISTS idx_aui_pattern_constraints_active ON aui_pattern_constraints(pattern_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_aui_pattern_constraints_created ON aui_pattern_constraints(created_at DESC);

-- Discovered patterns indexes
CREATE INDEX IF NOT EXISTS idx_aui_discovered_patterns_user ON aui_discovered_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_aui_discovered_patterns_status ON aui_discovered_patterns(status);
CREATE INDEX IF NOT EXISTS idx_aui_discovered_patterns_method ON aui_discovered_patterns(discovery_method);
CREATE INDEX IF NOT EXISTS idx_aui_discovered_patterns_expires ON aui_discovered_patterns(expires_at);
CREATE INDEX IF NOT EXISTS idx_aui_discovered_patterns_created ON aui_discovered_patterns(created_at DESC);

-- Usage events indexes
CREATE INDEX IF NOT EXISTS idx_aui_usage_events_user_period ON aui_usage_events(user_id, billing_period);
CREATE INDEX IF NOT EXISTS idx_aui_usage_events_tenant_period ON aui_usage_events(tenant_id, billing_period);
CREATE INDEX IF NOT EXISTS idx_aui_usage_events_created ON aui_usage_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aui_usage_events_session ON aui_usage_events(session_id);
CREATE INDEX IF NOT EXISTS idx_aui_usage_events_api_key ON aui_usage_events(api_key_id);
CREATE INDEX IF NOT EXISTS idx_aui_usage_events_model ON aui_usage_events(model_id);
CREATE INDEX IF NOT EXISTS idx_aui_usage_events_operation ON aui_usage_events(operation_type);

-- User usage snapshots indexes
CREATE INDEX IF NOT EXISTS idx_aui_user_usage_snapshots_tenant ON aui_user_usage_snapshots(tenant_id, billing_period);
CREATE INDEX IF NOT EXISTS idx_aui_user_usage_snapshots_updated ON aui_user_usage_snapshots(updated_at DESC);

-- API keys indexes
CREATE INDEX IF NOT EXISTS idx_aui_api_keys_user ON aui_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_aui_api_keys_tenant ON aui_api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_aui_api_keys_hash ON aui_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_aui_api_keys_prefix ON aui_api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_aui_api_keys_not_revoked ON aui_api_keys(user_id, tenant_id) WHERE revoked_at IS NULL;

-- Tier defaults indexes
CREATE INDEX IF NOT EXISTS idx_aui_tier_defaults_public ON aui_tier_defaults(tenant_id, is_public, priority);

-- User quota overrides indexes
CREATE INDEX IF NOT EXISTS idx_aui_user_quota_overrides_tenant ON aui_user_quota_overrides(tenant_id);

-- User preferences indexes
CREATE INDEX IF NOT EXISTS idx_aui_user_preferences_tenant ON aui_user_preferences(tenant_id);

-- Provider cost rates indexes
CREATE INDEX IF NOT EXISTS idx_aui_provider_cost_rates_active ON aui_provider_cost_rates(provider, model_id) WHERE effective_until IS NULL;

-- Feature flags indexes
CREATE INDEX IF NOT EXISTS idx_aui_feature_flags_tenant ON aui_feature_flags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_aui_feature_flags_category ON aui_feature_flags(category);
CREATE INDEX IF NOT EXISTS idx_aui_feature_flags_enabled ON aui_feature_flags(tenant_id, enabled);

-- Audit events indexes
CREATE INDEX IF NOT EXISTS idx_aui_audit_events_tenant ON aui_audit_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_aui_audit_events_action ON aui_audit_events(action);
CREATE INDEX IF NOT EXISTS idx_aui_audit_events_category ON aui_audit_events(category);
CREATE INDEX IF NOT EXISTS idx_aui_audit_events_actor ON aui_audit_events(actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_aui_audit_events_target ON aui_audit_events(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_aui_audit_events_created ON aui_audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aui_audit_events_success ON aui_audit_events(success);
`;

/**
 * User accounting specific indexes (for migration)
 */
export const CREATE_AUI_USER_ACCOUNTING_INDEXES = `
-- Usage events indexes
CREATE INDEX IF NOT EXISTS idx_aui_usage_events_user_period ON aui_usage_events(user_id, billing_period);
CREATE INDEX IF NOT EXISTS idx_aui_usage_events_tenant_period ON aui_usage_events(tenant_id, billing_period);
CREATE INDEX IF NOT EXISTS idx_aui_usage_events_created ON aui_usage_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aui_usage_events_session ON aui_usage_events(session_id);
CREATE INDEX IF NOT EXISTS idx_aui_usage_events_api_key ON aui_usage_events(api_key_id);
CREATE INDEX IF NOT EXISTS idx_aui_usage_events_model ON aui_usage_events(model_id);
CREATE INDEX IF NOT EXISTS idx_aui_usage_events_operation ON aui_usage_events(operation_type);

-- User usage snapshots indexes
CREATE INDEX IF NOT EXISTS idx_aui_user_usage_snapshots_tenant ON aui_user_usage_snapshots(tenant_id, billing_period);
CREATE INDEX IF NOT EXISTS idx_aui_user_usage_snapshots_updated ON aui_user_usage_snapshots(updated_at DESC);

-- API keys indexes
CREATE INDEX IF NOT EXISTS idx_aui_api_keys_user ON aui_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_aui_api_keys_tenant ON aui_api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_aui_api_keys_hash ON aui_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_aui_api_keys_prefix ON aui_api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_aui_api_keys_not_revoked ON aui_api_keys(user_id, tenant_id) WHERE revoked_at IS NULL;

-- Tier defaults indexes
CREATE INDEX IF NOT EXISTS idx_aui_tier_defaults_public ON aui_tier_defaults(tenant_id, is_public, priority);

-- User quota overrides indexes
CREATE INDEX IF NOT EXISTS idx_aui_user_quota_overrides_tenant ON aui_user_quota_overrides(tenant_id);

-- User preferences indexes
CREATE INDEX IF NOT EXISTS idx_aui_user_preferences_tenant ON aui_user_preferences(tenant_id);

-- Provider cost rates indexes
CREATE INDEX IF NOT EXISTS idx_aui_provider_cost_rates_active ON aui_provider_cost_rates(provider, model_id) WHERE effective_until IS NULL;
`;

/**
 * Create HNSW vector index for cluster centroids (optional)
 */
export const CREATE_AUI_CLUSTER_VECTOR_INDEX = `
CREATE INDEX IF NOT EXISTS idx_aui_clusters_centroid
  ON aui_clusters
  USING hnsw (centroid vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
`;

/**
 * Create HNSW vector index for content buffer embeddings (optional)
 */
export const CREATE_AUI_CONTENT_BUFFER_VECTOR_INDEX = `
CREATE INDEX IF NOT EXISTS idx_aui_content_buffers_embedding
  ON aui_content_buffers
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
`;

/**
 * Create HNSW vector index for pattern centroids (optional)
 */
export const CREATE_AUI_PATTERNS_VECTOR_INDEX = `
CREATE INDEX IF NOT EXISTS idx_aui_patterns_centroid
  ON aui_patterns
  USING hnsw (centroid vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
`;

/**
 * Create HNSW vector index for discovered pattern centroids (optional)
 */
export const CREATE_AUI_DISCOVERED_PATTERNS_VECTOR_INDEX = `
CREATE INDEX IF NOT EXISTS idx_aui_discovered_patterns_centroid
  ON aui_discovered_patterns
  USING hnsw (centroid vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
`;

// ═══════════════════════════════════════════════════════════════════
// MIGRATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Run AUI schema migration to version 5
 *
 * Version 5 adds: User accounting system (usage events, API keys, tier defaults, preferences)
 */
export async function runAuiMigration(
  client: PoolClient,
  embeddingDimension: number,
  enableVec: boolean
): Promise<void> {
  // Create sessions table
  await client.query(CREATE_AUI_SESSIONS_TABLE);

  // Create buffer tables (legacy versioned buffers)
  await client.query(CREATE_AUI_BUFFERS_TABLE);
  await client.query(CREATE_AUI_BUFFER_BRANCHES_TABLE);
  await client.query(CREATE_AUI_BUFFER_VERSIONS_TABLE);

  // Create tasks table
  await client.query(CREATE_AUI_TASKS_TABLE);

  // Create books tables
  await client.query(CREATE_AUI_BOOKS_TABLE);
  await client.query(CREATE_AUI_BOOK_CHAPTERS_TABLE);

  // Create clusters table (with vector column)
  await client.query(createAuiClustersTable(embeddingDimension));

  // Create artifacts table
  await client.query(CREATE_AUI_ARTIFACTS_TABLE);

  // Create persona profiles table
  await client.query(CREATE_AUI_PERSONA_PROFILES_TABLE);

  // Create style profiles table
  await client.query(CREATE_AUI_STYLE_PROFILES_TABLE);

  // Create content buffer tables (API-first buffer system)
  await client.query(createAuiContentBuffersTable(embeddingDimension));
  await client.query(CREATE_AUI_PROVENANCE_CHAINS_TABLE);
  await client.query(CREATE_AUI_BUFFER_OPERATIONS_TABLE);

  // Create pattern discovery tables
  await client.query(createAuiPatternsTable(embeddingDimension));
  await client.query(CREATE_AUI_PATTERN_FEEDBACK_TABLE);
  await client.query(CREATE_AUI_PATTERN_CONSTRAINTS_TABLE);
  await client.query(createAuiDiscoveredPatternsTable(embeddingDimension));

  // Create user accounting tables (v5)
  await client.query(CREATE_AUI_USAGE_EVENTS_TABLE);
  await client.query(CREATE_AUI_USER_USAGE_SNAPSHOTS_TABLE);
  await client.query(CREATE_AUI_API_KEYS_TABLE);
  await client.query(CREATE_AUI_TIER_DEFAULTS_TABLE);
  await client.query(CREATE_AUI_USER_QUOTA_OVERRIDES_TABLE);
  await client.query(CREATE_AUI_USER_PREFERENCES_TABLE);
  await client.query(CREATE_AUI_PROVIDER_COST_RATES_TABLE);

  // Create feature flags and audit tables (v6)
  await client.query(CREATE_AUI_FEATURE_FLAGS_TABLE);
  await client.query(CREATE_AUI_AUDIT_EVENTS_TABLE);

  // Create indexes
  await client.query(CREATE_AUI_INDEXES);

  // Seed tier defaults, cost rates, and feature flags
  await client.query(SEED_AUI_TIER_DEFAULTS);
  await client.query(SEED_AUI_PROVIDER_COST_RATES);
  await client.query(SEED_AUI_FEATURE_FLAGS);

  // Create vector indexes if enabled
  if (enableVec) {
    try {
      await client.query(CREATE_AUI_CLUSTER_VECTOR_INDEX);
    } catch (error) {
      // Log but don't fail - vector extension might not be available
      console.warn('Could not create cluster vector index:', error);
    }
    try {
      await client.query(CREATE_AUI_CONTENT_BUFFER_VECTOR_INDEX);
    } catch (error) {
      console.warn('Could not create content buffer vector index:', error);
    }
    try {
      await client.query(CREATE_AUI_PATTERNS_VECTOR_INDEX);
    } catch (error) {
      console.warn('Could not create patterns vector index:', error);
    }
    try {
      await client.query(CREATE_AUI_DISCOVERED_PATTERNS_VECTOR_INDEX);
    } catch (error) {
      console.warn('Could not create discovered patterns vector index:', error);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// SQL QUERY TEMPLATES
// ═══════════════════════════════════════════════════════════════════

// Sessions
export const INSERT_AUI_SESSION = `
INSERT INTO aui_sessions (id, user_id, name, active_buffer_name, search_session_id, command_history, variables, metadata, created_at, updated_at, expires_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING *
`;

export const GET_AUI_SESSION = `SELECT * FROM aui_sessions WHERE id = $1`;

export const UPDATE_AUI_SESSION = `
UPDATE aui_sessions SET
  name = COALESCE($2, name),
  active_buffer_name = COALESCE($3, active_buffer_name),
  search_session_id = COALESCE($4, search_session_id),
  command_history = COALESCE($5, command_history),
  variables = COALESCE($6, variables),
  metadata = COALESCE($7, metadata),
  updated_at = NOW(),
  expires_at = COALESCE($8, expires_at),
  last_accessed_at = NOW()
WHERE id = $1
RETURNING *
`;

export const DELETE_AUI_SESSION = `DELETE FROM aui_sessions WHERE id = $1`;

export const LIST_AUI_SESSIONS = `
SELECT * FROM aui_sessions
WHERE ($1::text IS NULL OR user_id = $1)
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY updated_at DESC
LIMIT $2 OFFSET $3
`;

export const TOUCH_AUI_SESSION = `
UPDATE aui_sessions SET
  updated_at = NOW(),
  last_accessed_at = NOW()
WHERE id = $1
`;

export const CLEANUP_EXPIRED_SESSIONS = `
DELETE FROM aui_sessions WHERE expires_at IS NOT NULL AND expires_at < NOW()
`;

// Buffers
export const INSERT_AUI_BUFFER = `
INSERT INTO aui_buffers (id, session_id, name, current_branch, working_content, is_dirty, schema, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *
`;

export const GET_AUI_BUFFER = `SELECT * FROM aui_buffers WHERE id = $1`;

export const GET_AUI_BUFFER_BY_NAME = `SELECT * FROM aui_buffers WHERE session_id = $1 AND name = $2`;

export const UPDATE_AUI_BUFFER = `
UPDATE aui_buffers SET
  current_branch = COALESCE($2, current_branch),
  working_content = COALESCE($3, working_content),
  is_dirty = COALESCE($4, is_dirty),
  schema = COALESCE($5, schema),
  updated_at = NOW()
WHERE id = $1
RETURNING *
`;

export const DELETE_AUI_BUFFER = `DELETE FROM aui_buffers WHERE id = $1`;

export const LIST_AUI_BUFFERS = `
SELECT * FROM aui_buffers WHERE session_id = $1 ORDER BY updated_at DESC
`;

// Branches
export const INSERT_AUI_BRANCH = `
INSERT INTO aui_buffer_branches (id, buffer_id, name, head_version_id, parent_branch, description, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *
`;

export const GET_AUI_BRANCH = `SELECT * FROM aui_buffer_branches WHERE buffer_id = $1 AND name = $2`;

export const UPDATE_AUI_BRANCH = `
UPDATE aui_buffer_branches SET
  head_version_id = COALESCE($3, head_version_id),
  description = COALESCE($4, description)
WHERE buffer_id = $1 AND name = $2
RETURNING *
`;

export const DELETE_AUI_BRANCH = `DELETE FROM aui_buffer_branches WHERE buffer_id = $1 AND name = $2`;

export const LIST_AUI_BRANCHES = `
SELECT * FROM aui_buffer_branches WHERE buffer_id = $1 ORDER BY created_at DESC
`;

// Versions
export const INSERT_AUI_VERSION = `
INSERT INTO aui_buffer_versions (id, buffer_id, content, message, parent_id, tags, metadata, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *
`;

export const GET_AUI_VERSION = `SELECT * FROM aui_buffer_versions WHERE id = $1`;

export const GET_AUI_VERSION_HISTORY = `
SELECT * FROM aui_buffer_versions
WHERE buffer_id = $1
ORDER BY created_at DESC
LIMIT $2
`;

export const PRUNE_AUI_VERSIONS = `
DELETE FROM aui_buffer_versions
WHERE buffer_id = $1
  AND id NOT IN (
    SELECT id FROM aui_buffer_versions
    WHERE buffer_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  )
`;

// Tasks
export const INSERT_AUI_TASK = `
INSERT INTO aui_tasks (id, session_id, request, status, steps, plan, result, error, priority, total_tokens, total_cost_cents, started_at, completed_at, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
RETURNING *
`;

export const GET_AUI_TASK = `SELECT * FROM aui_tasks WHERE id = $1`;

export const UPDATE_AUI_TASK = `
UPDATE aui_tasks SET
  status = COALESCE($2, status),
  steps = COALESCE($3, steps),
  plan = COALESCE($4, plan),
  result = COALESCE($5, result),
  error = COALESCE($6, error),
  total_tokens = COALESCE($7, total_tokens),
  total_cost_cents = COALESCE($8, total_cost_cents),
  completed_at = COALESCE($9, completed_at)
WHERE id = $1
RETURNING *
`;

export const GET_AUI_TASK_HISTORY = `
SELECT * FROM aui_tasks
WHERE session_id = $1
ORDER BY created_at DESC
LIMIT $2
`;

// Books
export const INSERT_AUI_BOOK = `
INSERT INTO aui_books (id, user_id, title, description, arc, status, source_cluster_id, metadata, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *
`;

export const GET_AUI_BOOK = `SELECT * FROM aui_books WHERE id = $1`;

export const UPDATE_AUI_BOOK = `
UPDATE aui_books SET
  title = COALESCE($2, title),
  description = COALESCE($3, description),
  arc = COALESCE($4, arc),
  status = COALESCE($5, status),
  metadata = COALESCE($6, metadata),
  updated_at = NOW()
WHERE id = $1
RETURNING *
`;

export const DELETE_AUI_BOOK = `DELETE FROM aui_books WHERE id = $1`;

export const LIST_AUI_BOOKS = `
SELECT * FROM aui_books
WHERE ($1::text IS NULL OR user_id = $1)
ORDER BY updated_at DESC
LIMIT $2 OFFSET $3
`;

// Chapters
export const INSERT_AUI_CHAPTER = `
INSERT INTO aui_book_chapters (id, book_id, title, content, position, word_count, passage_ids, metadata, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *
`;

export const GET_AUI_CHAPTERS = `
SELECT * FROM aui_book_chapters WHERE book_id = $1 ORDER BY position ASC
`;

export const UPDATE_AUI_CHAPTER = `
UPDATE aui_book_chapters SET
  title = COALESCE($2, title),
  content = COALESCE($3, content),
  position = COALESCE($4, position),
  word_count = COALESCE($5, word_count),
  passage_ids = COALESCE($6, passage_ids),
  metadata = COALESCE($7, metadata),
  updated_at = NOW()
WHERE id = $1
RETURNING *
`;

export const DELETE_AUI_CHAPTER = `DELETE FROM aui_book_chapters WHERE id = $1`;

// Clusters
export const INSERT_AUI_CLUSTER = `
INSERT INTO aui_clusters (id, user_id, label, description, passages, total_passages, coherence, keywords, source_distribution, date_range, avg_word_count, centroid, discovery_options, created_at, expires_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  passages = EXCLUDED.passages,
  total_passages = EXCLUDED.total_passages,
  coherence = EXCLUDED.coherence,
  keywords = EXCLUDED.keywords,
  source_distribution = EXCLUDED.source_distribution,
  date_range = EXCLUDED.date_range,
  avg_word_count = EXCLUDED.avg_word_count,
  centroid = EXCLUDED.centroid,
  discovery_options = EXCLUDED.discovery_options,
  expires_at = EXCLUDED.expires_at
RETURNING *
`;

export const GET_AUI_CLUSTER = `SELECT * FROM aui_clusters WHERE id = $1`;

export const LIST_AUI_CLUSTERS = `
SELECT * FROM aui_clusters
WHERE ($1::text IS NULL OR user_id = $1)
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY created_at DESC
LIMIT $2 OFFSET $3
`;

export const FIND_SIMILAR_CLUSTERS = `
SELECT *, 1 - (centroid <=> $1::vector) as similarity
FROM aui_clusters
WHERE centroid IS NOT NULL
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY centroid <=> $1::vector
LIMIT $2
`;

export const DELETE_AUI_CLUSTER = `DELETE FROM aui_clusters WHERE id = $1`;

export const CLEANUP_EXPIRED_CLUSTERS = `
DELETE FROM aui_clusters WHERE expires_at IS NOT NULL AND expires_at < NOW()
`;

// Artifacts
export const INSERT_AUI_ARTIFACT = `
INSERT INTO aui_artifacts (id, user_id, name, artifact_type, content, content_binary, mime_type, size_bytes, source_type, source_id, metadata, created_at, expires_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
RETURNING *
`;

export const GET_AUI_ARTIFACT = `SELECT * FROM aui_artifacts WHERE id = $1`;

export const LIST_AUI_ARTIFACTS = `
SELECT id, user_id, name, artifact_type, mime_type, size_bytes, source_type, source_id, metadata, created_at, expires_at, download_count, last_downloaded_at
FROM aui_artifacts
WHERE ($1::text IS NULL OR user_id = $1)
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY created_at DESC
LIMIT $2 OFFSET $3
`;

export const UPDATE_AUI_ARTIFACT_DOWNLOAD = `
UPDATE aui_artifacts SET
  download_count = download_count + 1,
  last_downloaded_at = NOW()
WHERE id = $1
`;

export const DELETE_AUI_ARTIFACT = `DELETE FROM aui_artifacts WHERE id = $1`;

export const CLEANUP_EXPIRED_ARTIFACTS = `
DELETE FROM aui_artifacts WHERE expires_at IS NOT NULL AND expires_at < NOW()
`;

// Persona Profiles
export const INSERT_AUI_PERSONA_PROFILE = `
INSERT INTO aui_persona_profiles (id, user_id, name, description, voice_traits, tone_markers, formality_min, formality_max, style_guide, reference_examples, voice_fingerprint, is_default, metadata, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
RETURNING *
`;

export const GET_AUI_PERSONA_PROFILE = `SELECT * FROM aui_persona_profiles WHERE id = $1`;

export const GET_AUI_PERSONA_PROFILE_BY_NAME = `SELECT * FROM aui_persona_profiles WHERE user_id = $1 AND name = $2`;

export const GET_AUI_DEFAULT_PERSONA_PROFILE = `SELECT * FROM aui_persona_profiles WHERE user_id = $1 AND is_default = TRUE LIMIT 1`;

export const UPDATE_AUI_PERSONA_PROFILE = `
UPDATE aui_persona_profiles SET
  name = COALESCE($2, name),
  description = COALESCE($3, description),
  voice_traits = COALESCE($4, voice_traits),
  tone_markers = COALESCE($5, tone_markers),
  formality_min = COALESCE($6, formality_min),
  formality_max = COALESCE($7, formality_max),
  style_guide = COALESCE($8, style_guide),
  reference_examples = COALESCE($9, reference_examples),
  voice_fingerprint = COALESCE($10, voice_fingerprint),
  is_default = COALESCE($11, is_default),
  metadata = COALESCE($12, metadata),
  updated_at = NOW()
WHERE id = $1
RETURNING *
`;

export const DELETE_AUI_PERSONA_PROFILE = `DELETE FROM aui_persona_profiles WHERE id = $1`;

export const LIST_AUI_PERSONA_PROFILES = `
SELECT * FROM aui_persona_profiles
WHERE ($1::text IS NULL OR user_id = $1)
ORDER BY is_default DESC, updated_at DESC
LIMIT $2 OFFSET $3
`;

export const CLEAR_DEFAULT_PERSONA_PROFILE = `
UPDATE aui_persona_profiles SET is_default = FALSE WHERE user_id = $1 AND is_default = TRUE
`;

// Style Profiles
export const INSERT_AUI_STYLE_PROFILE = `
INSERT INTO aui_style_profiles (id, persona_id, name, description, context, forbidden_phrases, preferred_patterns, sentence_variety, paragraph_style, use_contractions, use_rhetorical_questions, formality_level, is_default, metadata, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
RETURNING *
`;

export const GET_AUI_STYLE_PROFILE = `SELECT * FROM aui_style_profiles WHERE id = $1`;

export const GET_AUI_STYLE_PROFILE_BY_NAME = `SELECT * FROM aui_style_profiles WHERE persona_id = $1 AND name = $2`;

export const GET_AUI_DEFAULT_STYLE_PROFILE = `SELECT * FROM aui_style_profiles WHERE persona_id = $1 AND is_default = TRUE LIMIT 1`;

export const UPDATE_AUI_STYLE_PROFILE = `
UPDATE aui_style_profiles SET
  name = COALESCE($2, name),
  description = COALESCE($3, description),
  context = COALESCE($4, context),
  forbidden_phrases = COALESCE($5, forbidden_phrases),
  preferred_patterns = COALESCE($6, preferred_patterns),
  sentence_variety = COALESCE($7, sentence_variety),
  paragraph_style = COALESCE($8, paragraph_style),
  use_contractions = COALESCE($9, use_contractions),
  use_rhetorical_questions = COALESCE($10, use_rhetorical_questions),
  formality_level = COALESCE($11, formality_level),
  is_default = COALESCE($12, is_default),
  metadata = COALESCE($13, metadata),
  updated_at = NOW()
WHERE id = $1
RETURNING *
`;

export const DELETE_AUI_STYLE_PROFILE = `DELETE FROM aui_style_profiles WHERE id = $1`;

export const LIST_AUI_STYLE_PROFILES = `
SELECT * FROM aui_style_profiles
WHERE persona_id = $1
ORDER BY is_default DESC, updated_at DESC
`;

export const CLEAR_DEFAULT_STYLE_PROFILE = `
UPDATE aui_style_profiles SET is_default = FALSE WHERE persona_id = $1 AND is_default = TRUE
`;

// ═══════════════════════════════════════════════════════════════════
// CONTENT BUFFER SQL TEMPLATES
// ═══════════════════════════════════════════════════════════════════

// Content Buffers
export const INSERT_AUI_CONTENT_BUFFER = `
INSERT INTO aui_content_buffers (id, content_hash, text, word_count, format, state, origin, quality_metrics, embedding, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING *
`;

export const GET_AUI_CONTENT_BUFFER = `SELECT * FROM aui_content_buffers WHERE id = $1`;

export const GET_AUI_CONTENT_BUFFERS_BY_HASH = `SELECT * FROM aui_content_buffers WHERE content_hash = $1`;

export const UPDATE_AUI_CONTENT_BUFFER = `
UPDATE aui_content_buffers SET
  state = COALESCE($2, state),
  quality_metrics = COALESCE($3, quality_metrics),
  embedding = COALESCE($4, embedding),
  updated_at = NOW()
WHERE id = $1
RETURNING *
`;

export const DELETE_AUI_CONTENT_BUFFER = `DELETE FROM aui_content_buffers WHERE id = $1`;

export const LIST_AUI_CONTENT_BUFFERS = `
SELECT * FROM aui_content_buffers
WHERE ($1::text IS NULL OR state = $1)
ORDER BY updated_at DESC
LIMIT $2 OFFSET $3
`;

export const FIND_SIMILAR_CONTENT_BUFFERS = `
SELECT *, 1 - (embedding <=> $1::vector) as similarity
FROM aui_content_buffers
WHERE embedding IS NOT NULL
ORDER BY embedding <=> $1::vector
LIMIT $2
`;

// Provenance Chains
export const INSERT_AUI_PROVENANCE_CHAIN = `
INSERT INTO aui_provenance_chains (id, root_buffer_id, current_buffer_id, branch_name, branch_description, is_main, parent_chain_id, child_chain_ids, transformation_count, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *
`;

export const GET_AUI_PROVENANCE_CHAIN = `SELECT * FROM aui_provenance_chains WHERE id = $1`;

export const GET_AUI_PROVENANCE_CHAIN_BY_BUFFER = `
SELECT * FROM aui_provenance_chains
WHERE current_buffer_id = $1 OR root_buffer_id = $1
ORDER BY created_at DESC
LIMIT 1
`;

export const UPDATE_AUI_PROVENANCE_CHAIN = `
UPDATE aui_provenance_chains SET
  current_buffer_id = COALESCE($2, current_buffer_id),
  child_chain_ids = COALESCE($3, child_chain_ids),
  transformation_count = COALESCE($4, transformation_count)
WHERE id = $1
RETURNING *
`;

export const DELETE_AUI_PROVENANCE_CHAIN = `DELETE FROM aui_provenance_chains WHERE id = $1`;

export const LIST_AUI_PROVENANCE_CHAINS = `
SELECT * FROM aui_provenance_chains
WHERE ($1::uuid IS NULL OR root_buffer_id = $1)
ORDER BY created_at DESC
LIMIT $2 OFFSET $3
`;

export const FIND_DERIVED_CHAINS = `
SELECT * FROM aui_provenance_chains
WHERE root_buffer_id = $1 OR parent_chain_id IN (
  SELECT id FROM aui_provenance_chains WHERE root_buffer_id = $1
)
ORDER BY created_at ASC
`;

// Buffer Operations
export const INSERT_AUI_BUFFER_OPERATION = `
INSERT INTO aui_buffer_operations (id, chain_id, sequence_number, operation_type, performer, parameters, before_hash, after_hash, delta_hash, quality_impact, description, duration_ms, cost_cents, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
RETURNING *
`;

export const GET_AUI_BUFFER_OPERATION = `SELECT * FROM aui_buffer_operations WHERE id = $1`;

export const GET_AUI_BUFFER_OPERATIONS_BY_CHAIN = `
SELECT * FROM aui_buffer_operations
WHERE chain_id = $1
ORDER BY sequence_number ASC
`;

export const GET_AUI_BUFFER_OPERATIONS_BY_HASH = `
SELECT * FROM aui_buffer_operations
WHERE before_hash = $1 OR after_hash = $1
ORDER BY created_at DESC
`;

export const DELETE_AUI_BUFFER_OPERATION = `DELETE FROM aui_buffer_operations WHERE id = $1`;

export const GET_NEXT_OPERATION_SEQUENCE = `
SELECT COALESCE(MAX(sequence_number), 0) + 1 as next_seq
FROM aui_buffer_operations
WHERE chain_id = $1
`;

// ═══════════════════════════════════════════════════════════════════
// PATTERN DISCOVERY SQL TEMPLATES
// ═══════════════════════════════════════════════════════════════════

// Patterns
export const INSERT_AUI_PATTERN = `
INSERT INTO aui_patterns (id, user_id, name, description, definition, tags, status, usage_count, success_rate, centroid, source_discovered_id, metadata, created_at, updated_at, last_used_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
ON CONFLICT (user_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  definition = EXCLUDED.definition,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  usage_count = EXCLUDED.usage_count,
  success_rate = EXCLUDED.success_rate,
  centroid = EXCLUDED.centroid,
  metadata = EXCLUDED.metadata,
  updated_at = NOW()
RETURNING *
`;

export const GET_AUI_PATTERN = `SELECT * FROM aui_patterns WHERE id = $1`;

export const GET_AUI_PATTERN_BY_NAME = `SELECT * FROM aui_patterns WHERE user_id = $1 AND name = $2`;

export const UPDATE_AUI_PATTERN = `
UPDATE aui_patterns SET
  name = COALESCE($2, name),
  description = COALESCE($3, description),
  definition = COALESCE($4, definition),
  tags = COALESCE($5, tags),
  status = COALESCE($6, status),
  usage_count = COALESCE($7, usage_count),
  success_rate = COALESCE($8, success_rate),
  centroid = COALESCE($9, centroid),
  metadata = COALESCE($10, metadata),
  updated_at = NOW(),
  last_used_at = COALESCE($11, last_used_at)
WHERE id = $1
RETURNING *
`;

export const INCREMENT_AUI_PATTERN_USAGE = `
UPDATE aui_patterns SET
  usage_count = usage_count + 1,
  last_used_at = NOW(),
  updated_at = NOW()
WHERE id = $1
RETURNING *
`;

export const DELETE_AUI_PATTERN = `DELETE FROM aui_patterns WHERE id = $1`;

export const LIST_AUI_PATTERNS = `
SELECT * FROM aui_patterns
WHERE ($1::text IS NULL OR user_id = $1)
  AND ($2::text IS NULL OR status = $2)
ORDER BY usage_count DESC, updated_at DESC
LIMIT $3 OFFSET $4
`;

export const LIST_AUI_PATTERNS_BY_TAGS = `
SELECT * FROM aui_patterns
WHERE ($1::text IS NULL OR user_id = $1)
  AND tags && $2::text[]
ORDER BY usage_count DESC, updated_at DESC
LIMIT $3 OFFSET $4
`;

export const FIND_SIMILAR_PATTERNS = `
SELECT *, 1 - (centroid <=> $1::vector) as similarity
FROM aui_patterns
WHERE centroid IS NOT NULL
  AND ($2::text IS NULL OR user_id = $2)
ORDER BY centroid <=> $1::vector
LIMIT $3
`;

// Pattern Feedback
export const INSERT_AUI_PATTERN_FEEDBACK = `
INSERT INTO aui_pattern_feedback (id, pattern_id, content_id, judgment, explanation, content_snapshot, created_at, metadata)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *
`;

export const GET_AUI_PATTERN_FEEDBACK = `SELECT * FROM aui_pattern_feedback WHERE id = $1`;

export const LIST_AUI_PATTERN_FEEDBACK = `
SELECT * FROM aui_pattern_feedback
WHERE pattern_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3
`;

export const LIST_AUI_PATTERN_FEEDBACK_BY_JUDGMENT = `
SELECT * FROM aui_pattern_feedback
WHERE pattern_id = $1 AND judgment = $2
ORDER BY created_at DESC
LIMIT $3 OFFSET $4
`;

export const COUNT_AUI_PATTERN_FEEDBACK = `
SELECT judgment, COUNT(*) as count
FROM aui_pattern_feedback
WHERE pattern_id = $1
GROUP BY judgment
`;

export const DELETE_AUI_PATTERN_FEEDBACK = `DELETE FROM aui_pattern_feedback WHERE id = $1`;

// Pattern Constraints
export const INSERT_AUI_PATTERN_CONSTRAINT = `
INSERT INTO aui_pattern_constraints (id, pattern_id, constraint_type, constraint_definition, description, confidence, source_feedback_ids, is_active, created_at, metadata)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *
`;

export const GET_AUI_PATTERN_CONSTRAINT = `SELECT * FROM aui_pattern_constraints WHERE id = $1`;

export const LIST_AUI_PATTERN_CONSTRAINTS = `
SELECT * FROM aui_pattern_constraints
WHERE pattern_id = $1
  AND ($2::boolean IS NULL OR is_active = $2)
ORDER BY confidence DESC, created_at DESC
`;

export const UPDATE_AUI_PATTERN_CONSTRAINT = `
UPDATE aui_pattern_constraints SET
  confidence = COALESCE($2, confidence),
  source_feedback_ids = COALESCE($3, source_feedback_ids),
  is_active = COALESCE($4, is_active),
  metadata = COALESCE($5, metadata)
WHERE id = $1
RETURNING *
`;

export const DELETE_AUI_PATTERN_CONSTRAINT = `DELETE FROM aui_pattern_constraints WHERE id = $1`;

export const DEACTIVATE_AUI_PATTERN_CONSTRAINTS = `
UPDATE aui_pattern_constraints SET is_active = FALSE WHERE pattern_id = $1
`;

// Discovered Patterns
export const INSERT_AUI_DISCOVERED_PATTERN = `
INSERT INTO aui_discovered_patterns (id, user_id, observation, dimensions, instance_count, confidence, discovery_method, status, promoted_to_pattern_id, sample_content_ids, centroid, discovery_options, expires_at, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
ON CONFLICT (id) DO UPDATE SET
  observation = EXCLUDED.observation,
  dimensions = EXCLUDED.dimensions,
  instance_count = EXCLUDED.instance_count,
  confidence = EXCLUDED.confidence,
  status = EXCLUDED.status,
  promoted_to_pattern_id = EXCLUDED.promoted_to_pattern_id,
  sample_content_ids = EXCLUDED.sample_content_ids,
  centroid = EXCLUDED.centroid,
  expires_at = EXCLUDED.expires_at
RETURNING *
`;

export const GET_AUI_DISCOVERED_PATTERN = `SELECT * FROM aui_discovered_patterns WHERE id = $1`;

export const LIST_AUI_DISCOVERED_PATTERNS = `
SELECT * FROM aui_discovered_patterns
WHERE ($1::text IS NULL OR user_id = $1)
  AND ($2::text IS NULL OR status = $2)
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY confidence DESC, created_at DESC
LIMIT $3 OFFSET $4
`;

export const UPDATE_AUI_DISCOVERED_PATTERN_STATUS = `
UPDATE aui_discovered_patterns SET
  status = $2,
  promoted_to_pattern_id = $3
WHERE id = $1
RETURNING *
`;

export const DELETE_AUI_DISCOVERED_PATTERN = `DELETE FROM aui_discovered_patterns WHERE id = $1`;

export const CLEANUP_EXPIRED_DISCOVERED_PATTERNS = `
DELETE FROM aui_discovered_patterns WHERE expires_at IS NOT NULL AND expires_at < NOW()
`;

export const FIND_SIMILAR_DISCOVERED_PATTERNS = `
SELECT *, 1 - (centroid <=> $1::vector) as similarity
FROM aui_discovered_patterns
WHERE centroid IS NOT NULL
  AND ($2::text IS NULL OR user_id = $2)
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY centroid <=> $1::vector
LIMIT $3
`;

// ═══════════════════════════════════════════════════════════════════════════
// USER ACCOUNTING SQL TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

// Usage Events
export const INSERT_AUI_USAGE_EVENT = `
INSERT INTO aui_usage_events (
  id, tenant_id, user_id, operation_type, model_id, model_provider,
  tokens_input, tokens_output, provider_cost_millicents, user_charge_millicents,
  latency_ms, status, error, session_id, request_id, api_key_id, billing_period, created_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
RETURNING *
`;

export const GET_AUI_USAGE_EVENTS = `
SELECT * FROM aui_usage_events
WHERE user_id = $1 AND billing_period = $2
ORDER BY created_at DESC
LIMIT $3 OFFSET $4
`;

export const GET_AUI_USAGE_EVENTS_BY_SESSION = `
SELECT * FROM aui_usage_events
WHERE session_id = $1
ORDER BY created_at DESC
`;

export const GET_AUI_USAGE_EVENTS_AGGREGATE = `
SELECT
  billing_period,
  COUNT(*) as request_count,
  SUM(tokens_input) as total_input_tokens,
  SUM(tokens_output) as total_output_tokens,
  SUM(tokens_total) as total_tokens,
  SUM(provider_cost_millicents) as total_provider_cost,
  SUM(user_charge_millicents) as total_user_charge,
  AVG(latency_ms)::integer as avg_latency_ms,
  model_id,
  operation_type
FROM aui_usage_events
WHERE user_id = $1
  AND ($2::text IS NULL OR billing_period = $2)
  AND created_at >= $3
  AND created_at <= $4
GROUP BY billing_period, model_id, operation_type
ORDER BY billing_period DESC
`;

export const GET_AUI_USAGE_EVENTS_BY_TENANT = `
SELECT
  user_id,
  billing_period,
  COUNT(*) as request_count,
  SUM(tokens_total) as total_tokens,
  SUM(provider_cost_millicents) as total_provider_cost,
  SUM(user_charge_millicents) as total_user_charge
FROM aui_usage_events
WHERE tenant_id = $1 AND billing_period = $2
GROUP BY user_id, billing_period
ORDER BY total_tokens DESC
`;

// User Usage Snapshots
export const UPSERT_AUI_USER_USAGE_SNAPSHOT = `
INSERT INTO aui_user_usage_snapshots (
  user_id, tenant_id, billing_period,
  tokens_used, requests_count, cost_millicents,
  tokens_limit, requests_limit, cost_limit_millicents,
  by_model, by_operation, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
ON CONFLICT (user_id, tenant_id, billing_period)
DO UPDATE SET
  tokens_used = aui_user_usage_snapshots.tokens_used + EXCLUDED.tokens_used,
  requests_count = aui_user_usage_snapshots.requests_count + EXCLUDED.requests_count,
  cost_millicents = aui_user_usage_snapshots.cost_millicents + EXCLUDED.cost_millicents,
  by_model = aui_user_usage_snapshots.by_model || EXCLUDED.by_model,
  by_operation = aui_user_usage_snapshots.by_operation || EXCLUDED.by_operation,
  updated_at = NOW()
RETURNING *
`;

export const GET_AUI_USER_USAGE_SNAPSHOT = `
SELECT * FROM aui_user_usage_snapshots
WHERE user_id = $1 AND tenant_id = $2 AND billing_period = $3
`;

export const GET_AUI_USER_USAGE_HISTORY = `
SELECT * FROM aui_user_usage_snapshots
WHERE user_id = $1 AND tenant_id = $2
ORDER BY billing_period DESC
LIMIT $3
`;

export const INCREMENT_AUI_USER_USAGE = `
UPDATE aui_user_usage_snapshots SET
  tokens_used = tokens_used + $4,
  requests_count = requests_count + 1,
  cost_millicents = cost_millicents + $5,
  updated_at = NOW()
WHERE user_id = $1 AND tenant_id = $2 AND billing_period = $3
RETURNING *
`;

// API Keys
export const INSERT_AUI_API_KEY = `
INSERT INTO aui_api_keys (
  id, user_id, tenant_id, name, key_prefix, key_hash,
  scopes, rate_limit_rpm, expires_at, created_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING id, user_id, tenant_id, name, key_prefix, scopes, rate_limit_rpm, expires_at, created_at
`;

export const GET_AUI_API_KEY_BY_HASH = `
SELECT * FROM aui_api_keys
WHERE key_hash = $1
  AND revoked_at IS NULL
  AND (expires_at IS NULL OR expires_at > NOW())
`;

export const GET_AUI_API_KEY_BY_PREFIX = `
SELECT * FROM aui_api_keys
WHERE tenant_id = $1 AND key_prefix = $2
`;

export const LIST_AUI_API_KEYS = `
SELECT id, user_id, tenant_id, name, key_prefix, scopes, rate_limit_rpm,
       last_used_at, usage_count, expires_at, revoked_at, created_at
FROM aui_api_keys
WHERE user_id = $1 AND tenant_id = $2
ORDER BY created_at DESC
`;

export const REVOKE_AUI_API_KEY = `
UPDATE aui_api_keys SET revoked_at = NOW()
WHERE id = $1 AND user_id = $2 AND tenant_id = $3
RETURNING *
`;

export const UPDATE_AUI_API_KEY_USAGE = `
UPDATE aui_api_keys SET
  last_used_at = NOW(),
  usage_count = usage_count + 1
WHERE id = $1
`;

export const DELETE_AUI_API_KEY = `DELETE FROM aui_api_keys WHERE id = $1 AND user_id = $2`;

export const COUNT_AUI_API_KEYS = `
SELECT COUNT(*) as count FROM aui_api_keys
WHERE user_id = $1 AND tenant_id = $2 AND revoked_at IS NULL
`;

// Admin: List all API keys with optional filters
export const LIST_AUI_API_KEYS_ADMIN = `
SELECT id, user_id, tenant_id, name, key_prefix, scopes, rate_limit_rpm,
       last_used_at, usage_count, expires_at, revoked_at, created_at
FROM aui_api_keys
WHERE tenant_id = $1
  AND ($2::text IS NULL OR user_id = $2)
  AND (
    $3::text IS NULL
    OR ($3 = 'active' AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW()))
    OR ($3 = 'revoked' AND revoked_at IS NOT NULL)
    OR ($3 = 'expired' AND revoked_at IS NULL AND expires_at IS NOT NULL AND expires_at <= NOW())
  )
ORDER BY created_at DESC
LIMIT $4 OFFSET $5
`;

export const COUNT_AUI_API_KEYS_ADMIN = `
SELECT COUNT(*) as count FROM aui_api_keys
WHERE tenant_id = $1
  AND ($2::text IS NULL OR user_id = $2)
  AND (
    $3::text IS NULL
    OR ($3 = 'active' AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW()))
    OR ($3 = 'revoked' AND revoked_at IS NOT NULL)
    OR ($3 = 'expired' AND revoked_at IS NULL AND expires_at IS NOT NULL AND expires_at <= NOW())
  )
`;

// Admin: Revoke any API key by ID (without user_id check)
export const ADMIN_REVOKE_AUI_API_KEY = `
UPDATE aui_api_keys SET revoked_at = NOW()
WHERE id = $1 AND tenant_id = $2
RETURNING *
`;

// Tier Defaults
export const GET_AUI_TIER_DEFAULT = `
SELECT * FROM aui_tier_defaults
WHERE tenant_id = $1 AND tier = $2
`;

export const LIST_AUI_TIER_DEFAULTS = `
SELECT * FROM aui_tier_defaults
WHERE tenant_id = $1
  AND ($2::boolean IS NULL OR is_public = $2)
ORDER BY priority ASC
`;

export const UPSERT_AUI_TIER_DEFAULT = `
INSERT INTO aui_tier_defaults (
  tenant_id, tier, tokens_per_month, requests_per_month, cost_cents_per_month,
  requests_per_minute, max_api_keys, features, display_name, description,
  price_monthly_cents, price_annual_cents, priority, is_public, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
ON CONFLICT (tenant_id, tier)
DO UPDATE SET
  tokens_per_month = EXCLUDED.tokens_per_month,
  requests_per_month = EXCLUDED.requests_per_month,
  cost_cents_per_month = EXCLUDED.cost_cents_per_month,
  requests_per_minute = EXCLUDED.requests_per_minute,
  max_api_keys = EXCLUDED.max_api_keys,
  features = EXCLUDED.features,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  price_annual_cents = EXCLUDED.price_annual_cents,
  priority = EXCLUDED.priority,
  is_public = EXCLUDED.is_public,
  updated_at = NOW()
RETURNING *
`;

export const DELETE_AUI_TIER_DEFAULT = `
DELETE FROM aui_tier_defaults WHERE tenant_id = $1 AND tier = $2
`;

// User Quota Overrides
export const GET_AUI_USER_QUOTA_OVERRIDE = `
SELECT * FROM aui_user_quota_overrides
WHERE user_id = $1 AND tenant_id = $2
  AND (effective_until IS NULL OR effective_until > NOW())
`;

export const UPSERT_AUI_USER_QUOTA_OVERRIDE = `
INSERT INTO aui_user_quota_overrides (
  user_id, tenant_id, tokens_per_month, requests_per_month, cost_cents_per_month,
  reason, granted_by, effective_until, created_at, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
ON CONFLICT (user_id, tenant_id)
DO UPDATE SET
  tokens_per_month = EXCLUDED.tokens_per_month,
  requests_per_month = EXCLUDED.requests_per_month,
  cost_cents_per_month = EXCLUDED.cost_cents_per_month,
  reason = EXCLUDED.reason,
  granted_by = EXCLUDED.granted_by,
  effective_until = EXCLUDED.effective_until,
  updated_at = NOW()
RETURNING *
`;

export const DELETE_AUI_USER_QUOTA_OVERRIDE = `
DELETE FROM aui_user_quota_overrides WHERE user_id = $1 AND tenant_id = $2
`;

export const LIST_AUI_USER_QUOTA_OVERRIDES = `
SELECT * FROM aui_user_quota_overrides
WHERE tenant_id = $1
  AND (effective_until IS NULL OR effective_until > NOW())
ORDER BY created_at DESC
LIMIT $2 OFFSET $3
`;

// User Preferences
export const GET_AUI_USER_PREFERENCES = `
SELECT * FROM aui_user_preferences
WHERE user_id = $1 AND tenant_id = $2
`;

export const UPSERT_AUI_USER_PREFERENCES = `
INSERT INTO aui_user_preferences (
  user_id, tenant_id, model_preferences, prompt_customizations,
  transformation_defaults, ui_preferences, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, NOW())
ON CONFLICT (user_id, tenant_id)
DO UPDATE SET
  model_preferences = COALESCE(EXCLUDED.model_preferences, aui_user_preferences.model_preferences),
  prompt_customizations = COALESCE(EXCLUDED.prompt_customizations, aui_user_preferences.prompt_customizations),
  transformation_defaults = COALESCE(EXCLUDED.transformation_defaults, aui_user_preferences.transformation_defaults),
  ui_preferences = COALESCE(EXCLUDED.ui_preferences, aui_user_preferences.ui_preferences),
  updated_at = NOW()
RETURNING *
`;

export const DELETE_AUI_USER_PREFERENCES = `
DELETE FROM aui_user_preferences WHERE user_id = $1 AND tenant_id = $2
`;

// Provider Cost Rates
export const GET_AUI_PROVIDER_COST_RATE = `
SELECT * FROM aui_provider_cost_rates
WHERE provider = $1 AND model_id = $2
  AND effective_from <= NOW()
  AND (effective_until IS NULL OR effective_until > NOW())
ORDER BY effective_from DESC
LIMIT 1
`;

export const LIST_AUI_PROVIDER_COST_RATES = `
SELECT * FROM aui_provider_cost_rates
WHERE ($1::text IS NULL OR provider = $1)
  AND (effective_until IS NULL OR effective_until > NOW())
ORDER BY provider, model_id, effective_from DESC
`;

export const INSERT_AUI_PROVIDER_COST_RATE = `
INSERT INTO aui_provider_cost_rates (
  provider, model_id, input_cost_per_mtok, output_cost_per_mtok, effective_from, effective_until
) VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *
`;

export const UPDATE_AUI_PROVIDER_COST_RATE_END = `
UPDATE aui_provider_cost_rates SET effective_until = $3
WHERE provider = $1 AND model_id = $2 AND effective_until IS NULL
`;

// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS SQL TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get cost analytics grouped by provider and model
 */
export const GET_AUI_COST_ANALYTICS = `
SELECT
  model_provider,
  model_id,
  COUNT(*) as request_count,
  SUM(tokens_input) as total_input_tokens,
  SUM(tokens_output) as total_output_tokens,
  SUM(tokens_total) as total_tokens,
  SUM(provider_cost_millicents) as total_provider_cost,
  AVG(latency_ms)::integer as avg_latency_ms
FROM aui_usage_events
WHERE tenant_id = $1
  AND created_at >= $2
  AND created_at <= $3
GROUP BY model_provider, model_id
ORDER BY total_provider_cost DESC
`;

/**
 * Get revenue analytics with margin calculation
 */
export const GET_AUI_REVENUE_ANALYTICS = `
SELECT
  SUM(user_charge_millicents) as total_revenue,
  SUM(provider_cost_millicents) as total_cost,
  SUM(user_charge_millicents) - SUM(provider_cost_millicents) as total_margin,
  COUNT(*) as total_requests,
  SUM(tokens_total) as total_tokens
FROM aui_usage_events
WHERE tenant_id = $1
  AND created_at >= $2
  AND created_at <= $3
`;

/**
 * Get revenue analytics grouped by user tier
 * Note: Requires joining with user tier information
 */
export const GET_AUI_REVENUE_BY_PERIOD = `
SELECT
  billing_period,
  SUM(user_charge_millicents) as revenue,
  SUM(provider_cost_millicents) as cost,
  SUM(user_charge_millicents) - SUM(provider_cost_millicents) as margin,
  COUNT(*) as requests,
  COUNT(DISTINCT user_id) as unique_users
FROM aui_usage_events
WHERE tenant_id = $1
  AND created_at >= $2
  AND created_at <= $3
GROUP BY billing_period
ORDER BY billing_period DESC
`;

/**
 * Get cost analytics grouped by day for charting
 */
export const GET_AUI_COST_BY_DAY = `
SELECT
  DATE(created_at) as date,
  model_provider,
  SUM(provider_cost_millicents) as provider_cost,
  SUM(user_charge_millicents) as user_charge,
  COUNT(*) as requests,
  SUM(tokens_total) as tokens
FROM aui_usage_events
WHERE tenant_id = $1
  AND created_at >= $2
  AND created_at <= $3
GROUP BY DATE(created_at), model_provider
ORDER BY date DESC, provider_cost DESC
`;

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE FLAGS SQL TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

export const GET_AUI_FEATURE_FLAG = `
SELECT * FROM aui_feature_flags
WHERE tenant_id = $1 AND id = $2
`;

export const LIST_AUI_FEATURE_FLAGS = `
SELECT * FROM aui_feature_flags
WHERE tenant_id = $1
ORDER BY category, id
`;

export const UPSERT_AUI_FEATURE_FLAG = `
INSERT INTO aui_feature_flags (
  id, tenant_id, name, description, category, enabled, rollout_percentage,
  tier_overrides, created_by, metadata, created_at, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
ON CONFLICT (tenant_id, id)
DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  enabled = EXCLUDED.enabled,
  rollout_percentage = EXCLUDED.rollout_percentage,
  tier_overrides = EXCLUDED.tier_overrides,
  metadata = EXCLUDED.metadata,
  updated_at = NOW()
RETURNING *
`;

export const DELETE_AUI_FEATURE_FLAG = `
DELETE FROM aui_feature_flags WHERE tenant_id = $1 AND id = $2
`;

export const CHECK_AUI_FEATURE_ENABLED = `
SELECT
  f.id,
  f.enabled,
  f.rollout_percentage,
  f.tier_overrides
FROM aui_feature_flags f
WHERE f.tenant_id = $1 AND f.id = $2
`;

// ═══════════════════════════════════════════════════════════════════════════
// AUDIT EVENTS SQL TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

export const INSERT_AUI_AUDIT_EVENT = `
INSERT INTO aui_audit_events (
  id, tenant_id, action, category, actor_type, actor_id, actor_email,
  target_type, target_id, target_name, metadata, ip_address, user_agent,
  success, error_message, created_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
RETURNING *
`;

export const GET_AUI_AUDIT_EVENT = `
SELECT * FROM aui_audit_events
WHERE id = $1 AND tenant_id = $2
`;

export const LIST_AUI_AUDIT_EVENTS = `
SELECT * FROM aui_audit_events
WHERE tenant_id = $1
  AND ($2::text IS NULL OR category = $2)
  AND ($3::boolean IS NULL OR success = $3)
  AND ($4::timestamptz IS NULL OR created_at >= $4)
  AND ($5::timestamptz IS NULL OR created_at <= $5)
ORDER BY created_at DESC
LIMIT $6 OFFSET $7
`;

export const COUNT_AUI_AUDIT_EVENTS = `
SELECT COUNT(*) as count FROM aui_audit_events
WHERE tenant_id = $1
  AND ($2::text IS NULL OR category = $2)
  AND ($3::boolean IS NULL OR success = $3)
`;

export const SEARCH_AUI_AUDIT_EVENTS = `
SELECT * FROM aui_audit_events
WHERE tenant_id = $1
  AND (
    action ILIKE '%' || $2 || '%'
    OR actor_email ILIKE '%' || $2 || '%'
    OR target_name ILIKE '%' || $2 || '%'
  )
ORDER BY created_at DESC
LIMIT $3 OFFSET $4
`;

export const LIST_AUI_AUDIT_EVENTS_BY_ACTOR = `
SELECT * FROM aui_audit_events
WHERE tenant_id = $1 AND actor_type = $2 AND actor_id = $3
ORDER BY created_at DESC
LIMIT $4 OFFSET $5
`;

export const LIST_AUI_AUDIT_EVENTS_BY_TARGET = `
SELECT * FROM aui_audit_events
WHERE tenant_id = $1 AND target_type = $2 AND target_id = $3
ORDER BY created_at DESC
LIMIT $4 OFFSET $5
`;

export const CLEANUP_OLD_AUDIT_EVENTS = `
DELETE FROM aui_audit_events
WHERE tenant_id = $1 AND created_at < $2
`;
