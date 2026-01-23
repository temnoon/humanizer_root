/**
 * Configuration Management Types
 *
 * All literals (strings, numbers, prompts) should be stored in a managed
 * configuration system, NOT hardcoded in source files.
 *
 * This enables:
 * - Admin UI for configuration changes without code deploys
 * - Audit logging of configuration changes
 * - Encryption for sensitive values
 * - i18n support for user-facing strings
 * - A/B testing of prompts and thresholds
 */

// ═══════════════════════════════════════════════════════════════════
// CONFIG CATEGORIES
// ═══════════════════════════════════════════════════════════════════

/**
 * Configuration categories for organization
 */
export type ConfigCategory =
  | 'prompts'        // LLM system prompts
  | 'thresholds'     // Numeric thresholds (confidence, similarity, etc.)
  | 'limits'         // Rate limits, quotas, timeouts
  | 'labels'         // UI strings (i18n ready)
  | 'features'       // Feature flags
  | 'secrets'        // Encrypted sensitive values
  | 'agents';        // Agent-specific configuration

/**
 * Value types for configuration entries
 */
export type ConfigValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'json'
  | 'prompt'      // Multi-line prompt template
  | 'encrypted';  // Encrypted at rest

// ═══════════════════════════════════════════════════════════════════
// CONFIG ENTRY
// ═══════════════════════════════════════════════════════════════════

/**
 * A single configuration entry
 */
export interface ConfigEntry<T = unknown> {
  /** Unique key within category */
  key: string;

  /** Configuration category */
  category: ConfigCategory;

  /** The configuration value */
  value: T;

  /** Value type for validation/UI */
  valueType: ConfigValueType;

  /** Human-readable description */
  description?: string;

  /** Default value (used if not set) */
  defaultValue?: T;

  /** Is this entry encrypted? */
  encrypted?: boolean;

  /** Version for optimistic locking */
  version: number;

  /** When last modified */
  updatedAt: number;

  /** Who last modified (user ID or 'system') */
  updatedBy: string;

  /** Tags for filtering/grouping */
  tags?: string[];

  /** Validation rules */
  validation?: ConfigValidation;
}

/**
 * Validation rules for config entries
 */
export interface ConfigValidation {
  /** Required? */
  required?: boolean;

  /** Min value (for numbers) */
  min?: number;

  /** Max value (for numbers) */
  max?: number;

  /** Min length (for strings) */
  minLength?: number;

  /** Max length (for strings) */
  maxLength?: number;

  /** Regex pattern (for strings) */
  pattern?: string;

  /** Allowed values (enum) */
  enum?: unknown[];

  /** JSON schema (for json type) */
  jsonSchema?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════
// PROMPT TEMPLATES
// ═══════════════════════════════════════════════════════════════════

/**
 * A prompt template with variable substitution
 *
 * Variables use {{variableName}} syntax
 */
export interface PromptTemplate {
  /** Template ID */
  id: string;

  /** Human-readable name */
  name: string;

  /** The prompt template text */
  template: string;

  /** Description of what this prompt does */
  description?: string;

  /** Required variables that must be provided */
  requiredVariables: string[];

  /** Optional variables with defaults */
  optionalVariables?: Record<string, string>;

  /** Which agent/house uses this prompt */
  usedBy?: string[];

  /** Version for tracking changes */
  version: number;

  /** Tags for filtering */
  tags?: string[];
}

/**
 * Compiled prompt ready for use
 */
export interface CompiledPrompt {
  /** Original template ID */
  templateId: string;

  /** The compiled prompt text (variables substituted) */
  text: string;

  /** Variables that were used */
  variables: Record<string, string>;

  /** When compiled */
  compiledAt: number;
}

// ═══════════════════════════════════════════════════════════════════
// AUDIT LOGGING
// ═══════════════════════════════════════════════════════════════════

/**
 * Immutable audit log entry for config changes
 */
export interface ConfigAuditEntry {
  /** Unique audit entry ID */
  id: string;

  /** Category of config changed */
  category: ConfigCategory;

  /** Key of config changed */
  key: string;

  /** Previous value (null if created) */
  previousValue: unknown | null;

  /** New value (null if deleted) */
  newValue: unknown | null;

  /** Type of change */
  action: 'create' | 'update' | 'delete';

  /** Who made the change */
  changedBy: string;

  /** When the change was made */
  changedAt: number;

  /** Reason for change (optional) */
  reason?: string;

  /** Source of change */
  source: 'admin-ui' | 'api' | 'migration' | 'system';
}

// ═══════════════════════════════════════════════════════════════════
// CONFIG MANAGER INTERFACE
// ═══════════════════════════════════════════════════════════════════

/**
 * Configuration manager interface
 *
 * Implementations may be:
 * - InMemoryConfigManager (testing, standalone)
 * - DatabaseConfigManager (production with D1/SQLite)
 * - RemoteConfigManager (fetches from API)
 */
export interface ConfigManager {
  // ─────────────────────────────────────────────────────────────────
  // READ OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get a config value by category and key
   */
  get<T>(category: ConfigCategory, key: string): Promise<T | undefined>;

  /**
   * Get a config value with default
   */
  getOrDefault<T>(category: ConfigCategory, key: string, defaultValue: T): Promise<T>;

  /**
   * Get all entries in a category
   */
  getCategory(category: ConfigCategory): Promise<ConfigEntry[]>;

  /**
   * Get entries by tag
   */
  getByTag(tag: string): Promise<ConfigEntry[]>;

  /**
   * Check if a config exists
   */
  has(category: ConfigCategory, key: string): Promise<boolean>;

  // ─────────────────────────────────────────────────────────────────
  // WRITE OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Set a config value
   */
  set<T>(
    category: ConfigCategory,
    key: string,
    value: T,
    options?: SetConfigOptions
  ): Promise<void>;

  /**
   * Delete a config entry
   */
  delete(category: ConfigCategory, key: string, reason?: string): Promise<void>;

  /**
   * Bulk set multiple configs
   */
  setBulk(entries: Array<{
    category: ConfigCategory;
    key: string;
    value: unknown;
  }>): Promise<void>;

  // ─────────────────────────────────────────────────────────────────
  // PROMPT OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get a prompt template
   */
  getPrompt(id: string): Promise<PromptTemplate | undefined>;

  /**
   * Compile a prompt with variables
   */
  compilePrompt(id: string, variables: Record<string, string>): Promise<CompiledPrompt>;

  /**
   * List all prompt templates
   */
  listPrompts(filter?: { tag?: string; usedBy?: string }): Promise<PromptTemplate[]>;

  /**
   * Save a prompt template
   */
  savePrompt(template: Omit<PromptTemplate, 'version'>): Promise<void>;

  // ─────────────────────────────────────────────────────────────────
  // AUDIT OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get audit history for a config
   */
  getAuditHistory(
    category: ConfigCategory,
    key: string,
    limit?: number
  ): Promise<ConfigAuditEntry[]>;

  /**
   * Get recent audit entries
   */
  getRecentAudit(limit?: number): Promise<ConfigAuditEntry[]>;

  // ─────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────

  /**
   * Initialize the config manager
   */
  initialize(): Promise<void>;

  /**
   * Refresh config from source (for remote configs)
   */
  refresh(): Promise<void>;

  /**
   * Subscribe to config changes
   */
  onConfigChange(
    callback: (entry: ConfigEntry, action: 'update' | 'delete') => void
  ): () => void;
}

export interface SetConfigOptions {
  /** Description of what this config does */
  description?: string;

  /** Value type for validation */
  valueType?: ConfigValueType;

  /** Tags for organization */
  tags?: string[];

  /** Validation rules */
  validation?: ConfigValidation;

  /** Reason for change (for audit) */
  reason?: string;

  /** Should this be encrypted? */
  encrypt?: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// WELL-KNOWN CONFIG KEYS
// ═══════════════════════════════════════════════════════════════════

/**
 * Well-known threshold keys
 *
 * Using constants prevents typos and enables autocomplete
 */
export const THRESHOLD_KEYS = {
  // Confidence thresholds
  CONFIDENCE_MIN: 'confidence.min',
  CONFIDENCE_HIGH: 'confidence.high',

  // Similarity thresholds
  SIMILARITY_MATCH: 'similarity.match',
  SIMILARITY_CLOSE: 'similarity.close',

  // Quality thresholds
  QUALITY_MIN: 'quality.min',
  QUALITY_TARGET: 'quality.target',

  // Clustering
  CLUSTER_MIN_SIZE: 'cluster.minSize',
  CLUSTER_SIMILARITY: 'cluster.similarity',
} as const;

/**
 * Well-known limit keys
 */
export const LIMIT_KEYS = {
  // Timeouts (in ms)
  TIMEOUT_DEFAULT: 'timeout.default',
  TIMEOUT_LLM: 'timeout.llm',
  TIMEOUT_SEARCH: 'timeout.search',

  // Rate limits
  RATE_REQUESTS_PER_MINUTE: 'rate.requestsPerMinute',
  RATE_TOKENS_PER_MINUTE: 'rate.tokensPerMinute',

  // Batch sizes
  BATCH_SIZE_DEFAULT: 'batch.default',
  BATCH_SIZE_EMBEDDING: 'batch.embedding',

  // Retries
  RETRY_MAX_ATTEMPTS: 'retry.maxAttempts',
  RETRY_INITIAL_DELAY: 'retry.initialDelay',
} as const;

/**
 * Well-known prompt template IDs
 */
export const PROMPT_IDS = {
  // Vimalakirti boundary checks
  VIMALAKIRTI_INQUIRY_LEVEL: 'vimalakirti.inquiryLevel',
  VIMALAKIRTI_PROFESSIONAL_DISTANCE: 'vimalakirti.professionalDistance',
  VIMALAKIRTI_SHADOW_CHECK: 'vimalakirti.shadowCheck',

  // Agent system prompts
  AGENT_CURATOR: 'agent.curator',
  AGENT_HARVESTER: 'agent.harvester',
  AGENT_BUILDER: 'agent.builder',
  AGENT_REVIEWER: 'agent.reviewer',

  // Task prompts
  TASK_SEARCH: 'task.search',
  TASK_SUMMARIZE: 'task.summarize',
  TASK_EVALUATE: 'task.evaluate',
} as const;

/**
 * Well-known feature flag keys
 */
export const FEATURE_KEYS = {
  // Agent features
  AGENT_AUTO_APPROVE: 'agent.autoApprove',
  AGENT_PARALLEL_TASKS: 'agent.parallelTasks',

  // UI features
  UI_DARK_MODE: 'ui.darkMode',
  UI_ADVANCED_OPTIONS: 'ui.advancedOptions',

  // System features
  SYSTEM_AUDIT_LOGGING: 'system.auditLogging',
  SYSTEM_ENCRYPTION: 'system.encryption',
} as const;
