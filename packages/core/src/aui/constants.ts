/**
 * Unified AUI Constants
 *
 * Configuration keys, defaults, and tool names for the AUI system.
 *
 * @module @humanizer/core/aui/constants
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG KEYS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuration keys for the AUI system.
 * All config values should be accessed through ConfigManager using these keys.
 */
export const AUI_CONFIG_KEYS = {
  // Agentic loop settings
  AGENT_MAX_STEPS: 'aui.agent.maxSteps',
  AGENT_DEFAULT_TEMPERATURE: 'aui.agent.temperature',
  AGENT_AUTO_APPROVE: 'aui.agent.autoApprove',
  AGENT_DEFAULT_MODEL: 'aui.agent.defaultModel',
  AGENT_TIMEOUT_MS: 'aui.agent.timeoutMs',

  // Buffer settings
  BUFFER_MAX_VERSIONS: 'aui.buffer.maxVersions',
  BUFFER_MAX_BRANCHES: 'aui.buffer.maxBranches',
  BUFFER_AUTO_COMMIT: 'aui.buffer.autoCommit',
  BUFFER_MAX_SIZE_MB: 'aui.buffer.maxSizeMb',

  // Session settings
  SESSION_MAX_COUNT: 'aui.session.maxCount',
  SESSION_TIMEOUT_MS: 'aui.session.timeoutMs',
  SESSION_CLEANUP_INTERVAL_MS: 'aui.session.cleanupIntervalMs',

  // Admin settings
  TIER_DEFAULT: 'aui.tier.default',
  COST_TRACKING_ENABLED: 'aui.cost.enabled',
  COST_RETENTION_DAYS: 'aui.cost.retentionDays',
  USAGE_RETENTION_DAYS: 'aui.usage.retentionDays',
  AUDIT_LOGGING_ENABLED: 'aui.audit.enabled',

  // Rate limiting
  RATE_LIMIT_REQUESTS_PER_MINUTE: 'aui.rateLimit.requestsPerMinute',
  RATE_LIMIT_TOKENS_PER_DAY: 'aui.rateLimit.tokensPerDay',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT VALUES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default values for AUI configuration.
 */
export const AUI_DEFAULTS = {
  // Agentic loop
  maxSteps: 20,
  temperature: 0.7,
  autoApprove: false,
  agentTimeoutMs: 300_000, // 5 minutes

  // Buffer
  maxVersions: 100,
  maxBranches: 10,
  autoCommit: false,
  maxBufferSizeMb: 50,

  // Session
  maxSessions: 100,
  sessionTimeoutMs: 3_600_000, // 1 hour
  cleanupIntervalMs: 300_000, // 5 minutes

  // Admin
  defaultTier: 'free',
  costRetentionDays: 365,
  usageRetentionDays: 90,

  // Rate limiting
  requestsPerMinute: 60,
  tokensPerDay: 100_000,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// MCP TOOL NAMES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * MCP tool names for the unified AUI system.
 */
export const TOOL_NAMES = {
  // Session management
  SESSION_CREATE: 'aui_session_create',
  SESSION_GET: 'aui_session_get',
  SESSION_LIST: 'aui_session_list',
  SESSION_DELETE: 'aui_session_delete',

  // Natural language & agent
  PROCESS: 'aui_process',
  AGENT_RUN: 'aui_agent_run',
  AGENT_STEP: 'aui_agent_step',
  AGENT_INTERRUPT: 'aui_agent_interrupt',
  AGENT_STATUS: 'aui_agent_status',
  AGENT_RESUME: 'aui_agent_resume',
  BQL_EXECUTE: 'aui_bql_execute',

  // Versioned buffers - lifecycle
  BUFFER_CREATE: 'aui_buffer_create',
  BUFFER_LIST: 'aui_buffer_list',
  BUFFER_GET: 'aui_buffer_get',
  BUFFER_SET: 'aui_buffer_set',
  BUFFER_APPEND: 'aui_buffer_append',
  BUFFER_DELETE: 'aui_buffer_delete',

  // Versioned buffers - version control
  BUFFER_COMMIT: 'aui_buffer_commit',
  BUFFER_ROLLBACK: 'aui_buffer_rollback',
  BUFFER_HISTORY: 'aui_buffer_history',
  BUFFER_TAG: 'aui_buffer_tag',
  BUFFER_CHECKOUT: 'aui_buffer_checkout',

  // Versioned buffers - branching
  BUFFER_BRANCH_CREATE: 'aui_buffer_branch_create',
  BUFFER_BRANCH_SWITCH: 'aui_buffer_branch_switch',
  BUFFER_BRANCH_LIST: 'aui_buffer_branch_list',
  BUFFER_BRANCH_DELETE: 'aui_buffer_branch_delete',
  BUFFER_MERGE: 'aui_buffer_merge',
  BUFFER_DIFF: 'aui_buffer_diff',

  // Search (delegates to agentic-search)
  SEARCH: 'aui_search',
  SEARCH_REFINE: 'aui_search_refine',
  SEARCH_ANCHOR_ADD: 'aui_search_anchor_add',
  SEARCH_ANCHOR_REMOVE: 'aui_search_anchor_remove',
  SEARCH_TO_BUFFER: 'aui_search_to_buffer',

  // Admin - config
  ADMIN_CONFIG_GET: 'aui_admin_config_get',
  ADMIN_CONFIG_SET: 'aui_admin_config_set',
  ADMIN_CONFIG_LIST: 'aui_admin_config_list',
  ADMIN_CONFIG_AUDIT: 'aui_admin_config_audit',

  // Admin - prompts
  ADMIN_PROMPT_LIST: 'aui_admin_prompt_list',
  ADMIN_PROMPT_GET: 'aui_admin_prompt_get',
  ADMIN_PROMPT_SET: 'aui_admin_prompt_set',
  ADMIN_PROMPT_TEST: 'aui_admin_prompt_test',

  // Admin - costs & usage
  ADMIN_COST_RECORD: 'aui_admin_cost_record',
  ADMIN_COST_REPORT: 'aui_admin_cost_report',
  ADMIN_USAGE_GET: 'aui_admin_usage_get',
  ADMIN_USAGE_CHECK: 'aui_admin_usage_check',
  ADMIN_USAGE_REPORT: 'aui_admin_usage_report',

  // Admin - tiers
  ADMIN_TIER_LIST: 'aui_admin_tier_list',
  ADMIN_TIER_GET: 'aui_admin_tier_get',
  ADMIN_TIER_SET: 'aui_admin_tier_set',
  ADMIN_USER_TIER_GET: 'aui_admin_user_tier_get',
  ADMIN_USER_TIER_SET: 'aui_admin_user_tier_set',

  // Archive - embedding & indexing
  ARCHIVE_STATS: 'aui_archive_stats',
  ARCHIVE_EMBED_ALL: 'aui_archive_embed_all',
  ARCHIVE_EMBED_BATCH: 'aui_archive_embed_batch',

  // Clustering
  CLUSTER_DISCOVER: 'aui_cluster_discover',
  CLUSTER_LIST: 'aui_cluster_list',
  CLUSTER_GET: 'aui_cluster_get',

  // Book creation
  BOOK_CREATE_FROM_CLUSTER: 'aui_book_create_from_cluster',
  BOOK_HARVEST: 'aui_book_harvest',
  BOOK_GENERATE_ARC: 'aui_book_generate_arc',
  BOOK_LIST: 'aui_book_list',
  BOOK_GET: 'aui_book_get',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// TIER DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default tier definitions.
 */
export const DEFAULT_TIERS: Record<string, {
  id: string;
  name: string;
  description: string;
  limits: {
    tokensPerDay: number;
    tokensPerMonth: number;
    requestsPerMinute: number;
    maxBufferSizeMb: number;
    maxBranches: number;
    maxHistoryDepth: number;
    maxConcurrentTasks: number;
    maxSearchResults: number;
    allowedModels: string[];
    maxUploadSizeMb: number;
  };
  features: string[];
  priceMonthly?: number;
  priceAnnual?: number;
  priority: number;
  isPublic: boolean;
}> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Basic access with limited usage',
    limits: {
      tokensPerDay: 10_000,
      tokensPerMonth: 100_000,
      requestsPerMinute: 10,
      maxBufferSizeMb: 10,
      maxBranches: 3,
      maxHistoryDepth: 20,
      maxConcurrentTasks: 1,
      maxSearchResults: 50,
      allowedModels: ['llama3.2:3b', 'gemma2:2b'],
      maxUploadSizeMb: 10,
    },
    features: ['basic_search', 'basic_transform'],
    priority: 3,
    isPublic: true,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'Full access for individual creators',
    limits: {
      tokensPerDay: 100_000,
      tokensPerMonth: 2_000_000,
      requestsPerMinute: 60,
      maxBufferSizeMb: 100,
      maxBranches: 20,
      maxHistoryDepth: 100,
      maxConcurrentTasks: 5,
      maxSearchResults: 200,
      allowedModels: ['llama3.2:3b', 'llama3.3:70b', 'gemma2:2b', 'gemma2:27b', 'claude-haiku', 'claude-sonnet'],
      maxUploadSizeMb: 100,
    },
    features: ['basic_search', 'advanced_search', 'basic_transform', 'advanced_transform', 'agent_tasks', 'priority_support'],
    priceMonthly: 1999, // $19.99
    priceAnnual: 19188, // $15.99/mo
    priority: 2,
    isPublic: true,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Custom solutions for organizations',
    limits: {
      tokensPerDay: 1_000_000,
      tokensPerMonth: 20_000_000,
      requestsPerMinute: 300,
      maxBufferSizeMb: 1000,
      maxBranches: 100,
      maxHistoryDepth: 1000,
      maxConcurrentTasks: 20,
      maxSearchResults: 1000,
      allowedModels: ['*'], // All models
      maxUploadSizeMb: 1000,
    },
    features: ['*'], // All features
    priceMonthly: 0, // Custom pricing
    priceAnnual: 0,
    priority: 1,
    isPublic: false,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// MODEL COST RATES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Cost rates per 1M tokens (in cents).
 * These are approximate and should be updated based on actual pricing.
 *
 * @deprecated Use ModelRegistry.getCost() or getCostSync() instead.
 * ModelRegistry stores costs in costPer1kTokens (dollars per 1K tokens).
 * This constant is kept for backwards compatibility and as a fallback.
 * @see packages/core/src/models/model-registry.ts
 */
export const MODEL_COST_RATES = {
  // Ollama (local) - no API cost, but compute cost
  'llama3.2:3b': { input: 0, output: 0 },
  'llama3.3:70b': { input: 0, output: 0 },
  'gemma2:2b': { input: 0, output: 0 },
  'gemma2:27b': { input: 0, output: 0 },

  // Anthropic Claude
  'claude-haiku-4-5-20251001': { input: 100, output: 500 }, // $1/$5 per 1M
  'claude-sonnet-4-20250514': { input: 300, output: 1500 }, // $3/$15 per 1M
  'claude-opus-4-5-20251101': { input: 1500, output: 7500 }, // $15/$75 per 1M

  // Aliases
  'claude-haiku': { input: 100, output: 500 },
  'claude-sonnet': { input: 300, output: 1500 },
  'claude-opus': { input: 1500, output: 7500 },

  // Default for unknown models
  default: { input: 100, output: 500 },
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// OPERATION TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Operation types for cost tracking.
 */
export const OPERATION_TYPES = {
  SEARCH: 'search',
  TRANSFORM: 'transform',
  ENRICH: 'enrich',
  HUMANIZE: 'humanize',
  DETECT: 'detect',
  SUMMARIZE: 'summarize',
  CLUSTER: 'cluster',
  AGENT_REASON: 'agent_reason',
  AGENT_ACT: 'agent_act',
  NL_PARSE: 'nl_parse',
  PROMPT_COMPILE: 'prompt_compile',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// BUFFER DEFAULTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default branch name for new buffers.
 */
export const DEFAULT_BRANCH_NAME = 'main';

/**
 * Length of version ID hash.
 */
export const VERSION_ID_LENGTH = 7;

/**
 * Maximum items per buffer (soft limit).
 */
export const MAX_BUFFER_ITEMS = 10_000;

// ═══════════════════════════════════════════════════════════════════════════
// AGENT DEFAULTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tools that are considered destructive and require approval.
 */
export const DESTRUCTIVE_TOOLS = [
  'buffer_delete',
  'buffer_rollback',
  'buffer_branch_delete',
  'buffer_merge',
  'admin_config_set',
  'admin_tier_set',
  'admin_user_tier_set',
  'admin_prompt_set',
] as const;

/**
 * Maximum size of tool result to include in context (characters).
 */
export const MAX_TOOL_RESULT_SIZE = 10_000;

/**
 * Maximum conversation history to include in reasoning context.
 */
export const MAX_HISTORY_IN_CONTEXT = 10;
