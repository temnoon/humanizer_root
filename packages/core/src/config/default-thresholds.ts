/**
 * Default Threshold and Limit Values
 *
 * These are the seed values for numeric configuration.
 * All values are stored in ConfigManager, NOT hardcoded in code.
 *
 * To modify values:
 * 1. Use the Admin UI to edit configuration
 * 2. Or call configManager.set() programmatically
 *
 * This file only provides INITIAL seed data.
 */

import type { ConfigCategory, ConfigValueType, ConfigValidation } from './types.js';
import { THRESHOLD_KEYS, LIMIT_KEYS } from './types.js';

// ═══════════════════════════════════════════════════════════════════
// THRESHOLD DEFAULTS
// ═══════════════════════════════════════════════════════════════════

export interface DefaultConfigEntry {
  category: ConfigCategory;
  key: string;
  value: unknown;
  description: string;
  valueType: ConfigValueType;
  tags: string[];
  validation?: ConfigValidation;
}

export const DEFAULT_THRESHOLDS: DefaultConfigEntry[] = [
  // Confidence thresholds
  {
    category: 'thresholds',
    key: THRESHOLD_KEYS.CONFIDENCE_MIN,
    value: 0.6,
    description: 'Minimum confidence score to accept a result',
    valueType: 'number',
    tags: ['confidence', 'quality'],
    validation: { min: 0, max: 1 },
  },
  {
    category: 'thresholds',
    key: THRESHOLD_KEYS.CONFIDENCE_HIGH,
    value: 0.85,
    description: 'Confidence score considered high quality',
    valueType: 'number',
    tags: ['confidence', 'quality'],
    validation: { min: 0, max: 1 },
  },

  // Similarity thresholds
  {
    category: 'thresholds',
    key: THRESHOLD_KEYS.SIMILARITY_MATCH,
    value: 0.8,
    description: 'Similarity score to consider a match',
    valueType: 'number',
    tags: ['similarity', 'search'],
    validation: { min: 0, max: 1 },
  },
  {
    category: 'thresholds',
    key: THRESHOLD_KEYS.SIMILARITY_CLOSE,
    value: 0.6,
    description: 'Similarity score to consider close/related',
    valueType: 'number',
    tags: ['similarity', 'search'],
    validation: { min: 0, max: 1 },
  },

  // Quality thresholds
  {
    category: 'thresholds',
    key: THRESHOLD_KEYS.QUALITY_MIN,
    value: 0.5,
    description: 'Minimum quality score to include content',
    valueType: 'number',
    tags: ['quality', 'curation'],
    validation: { min: 0, max: 1 },
  },
  {
    category: 'thresholds',
    key: THRESHOLD_KEYS.QUALITY_TARGET,
    value: 0.75,
    description: 'Target quality score for curated content',
    valueType: 'number',
    tags: ['quality', 'curation'],
    validation: { min: 0, max: 1 },
  },

  // Clustering thresholds
  {
    category: 'thresholds',
    key: THRESHOLD_KEYS.CLUSTER_MIN_SIZE,
    value: 3,
    description: 'Minimum items to form a cluster',
    valueType: 'number',
    tags: ['clustering'],
    validation: { min: 2, max: 100 },
  },
  {
    category: 'thresholds',
    key: THRESHOLD_KEYS.CLUSTER_SIMILARITY,
    value: 0.55,
    description: 'Similarity threshold for clustering',
    valueType: 'number',
    tags: ['clustering'],
    validation: { min: 0, max: 1 },
  },
];

// ═══════════════════════════════════════════════════════════════════
// LIMIT DEFAULTS
// ═══════════════════════════════════════════════════════════════════

export const DEFAULT_LIMITS: DefaultConfigEntry[] = [
  // Timeouts
  {
    category: 'limits',
    key: LIMIT_KEYS.TIMEOUT_DEFAULT,
    value: 30000,
    description: 'Default operation timeout in milliseconds',
    valueType: 'number',
    tags: ['timeout'],
    validation: { min: 1000, max: 300000 },
  },
  {
    category: 'limits',
    key: LIMIT_KEYS.TIMEOUT_LLM,
    value: 60000,
    description: 'LLM operation timeout in milliseconds',
    valueType: 'number',
    tags: ['timeout', 'llm'],
    validation: { min: 5000, max: 300000 },
  },
  {
    category: 'limits',
    key: LIMIT_KEYS.TIMEOUT_SEARCH,
    value: 15000,
    description: 'Search operation timeout in milliseconds',
    valueType: 'number',
    tags: ['timeout', 'search'],
    validation: { min: 1000, max: 60000 },
  },

  // Rate limits
  {
    category: 'limits',
    key: LIMIT_KEYS.RATE_REQUESTS_PER_MINUTE,
    value: 60,
    description: 'Maximum requests per minute',
    valueType: 'number',
    tags: ['rate-limit'],
    validation: { min: 1, max: 1000 },
  },
  {
    category: 'limits',
    key: LIMIT_KEYS.RATE_TOKENS_PER_MINUTE,
    value: 100000,
    description: 'Maximum tokens per minute for LLM calls',
    valueType: 'number',
    tags: ['rate-limit', 'llm'],
    validation: { min: 1000, max: 1000000 },
  },

  // Batch sizes
  {
    category: 'limits',
    key: LIMIT_KEYS.BATCH_SIZE_DEFAULT,
    value: 50,
    description: 'Default batch size for bulk operations',
    valueType: 'number',
    tags: ['batch'],
    validation: { min: 1, max: 1000 },
  },
  {
    category: 'limits',
    key: LIMIT_KEYS.BATCH_SIZE_EMBEDDING,
    value: 100,
    description: 'Batch size for embedding operations',
    valueType: 'number',
    tags: ['batch', 'embedding'],
    validation: { min: 1, max: 500 },
  },

  // Retries
  {
    category: 'limits',
    key: LIMIT_KEYS.RETRY_MAX_ATTEMPTS,
    value: 3,
    description: 'Maximum retry attempts for failed operations',
    valueType: 'number',
    tags: ['retry'],
    validation: { min: 0, max: 10 },
  },
  {
    category: 'limits',
    key: LIMIT_KEYS.RETRY_INITIAL_DELAY,
    value: 1000,
    description: 'Initial delay for exponential backoff in milliseconds',
    valueType: 'number',
    tags: ['retry'],
    validation: { min: 100, max: 30000 },
  },
];

// ═══════════════════════════════════════════════════════════════════
// FEATURE FLAG DEFAULTS
// ═══════════════════════════════════════════════════════════════════

import { FEATURE_KEYS } from './types.js';

export const DEFAULT_FEATURES: DefaultConfigEntry[] = [
  {
    category: 'features',
    key: FEATURE_KEYS.AGENT_AUTO_APPROVE,
    value: false,
    description: 'Auto-approve agent proposals without user confirmation',
    valueType: 'boolean',
    tags: ['agent', 'autonomy'],
  },
  {
    category: 'features',
    key: FEATURE_KEYS.AGENT_PARALLEL_TASKS,
    value: true,
    description: 'Allow agents to process multiple tasks in parallel',
    valueType: 'boolean',
    tags: ['agent', 'performance'],
  },
  {
    category: 'features',
    key: FEATURE_KEYS.SYSTEM_AUDIT_LOGGING,
    value: true,
    description: 'Enable audit logging for configuration changes',
    valueType: 'boolean',
    tags: ['system', 'audit'],
  },
  {
    category: 'features',
    key: FEATURE_KEYS.SYSTEM_ENCRYPTION,
    value: false,
    description: 'Enable encryption for sensitive configuration values',
    valueType: 'boolean',
    tags: ['system', 'security'],
  },
];

// ═══════════════════════════════════════════════════════════════════
// EXPORT ALL DEFAULTS
// ═══════════════════════════════════════════════════════════════════

export const ALL_DEFAULT_CONFIGS: DefaultConfigEntry[] = [
  ...DEFAULT_THRESHOLDS,
  ...DEFAULT_LIMITS,
  ...DEFAULT_FEATURES,
];
