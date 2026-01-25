/**
 * Embedding Configuration
 *
 * Centralizes all embedding-related configuration keys and defaults.
 * Part of Phase 2: Configuration Centralization.
 *
 * Usage:
 * ```typescript
 * import { EMBEDDING_CONFIG_KEYS, EMBEDDING_DEFAULTS } from './embedding-config';
 * import { getConfigManager } from './in-memory-config';
 *
 * const config = getConfigManager();
 * const timeout = await config.get('limits', EMBEDDING_CONFIG_KEYS.TIMEOUT_MS)
 *   ?? EMBEDDING_DEFAULTS[EMBEDDING_CONFIG_KEYS.TIMEOUT_MS];
 * ```
 *
 * @module config/embedding-config
 */

import type { ConfigCategory } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG KEYS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuration keys for embedding-related settings.
 * Use these with ConfigManager instead of hardcoding strings.
 */
export const EMBEDDING_CONFIG_KEYS = {
  // ─────────────────────────────────────────────────────────────────
  // Model Selection
  // ─────────────────────────────────────────────────────────────────

  /** Default embedding model ID (e.g., 'nomic-embed-text:latest') */
  DEFAULT_MODEL: 'embedding.defaultModel',

  /** Fallback model when default is unavailable */
  FALLBACK_MODEL: 'embedding.fallbackModel',

  // ─────────────────────────────────────────────────────────────────
  // Model Properties (derived from model, but overridable)
  // ─────────────────────────────────────────────────────────────────

  /** Embedding vector dimensions (e.g., 768, 1536) */
  DIMENSIONS: 'embedding.dimensions',

  /** Maximum tokens the model can process */
  MAX_TOKENS: 'embedding.maxTokens',

  // ─────────────────────────────────────────────────────────────────
  // Service Configuration
  // ─────────────────────────────────────────────────────────────────

  /** Ollama API base URL */
  OLLAMA_URL: 'embedding.ollamaUrl',

  /** Request timeout in milliseconds */
  TIMEOUT_MS: 'embedding.timeoutMs',

  /** Batch size for bulk embedding operations */
  BATCH_SIZE: 'embedding.batchSize',

  /** Maximum retry attempts for failed requests */
  MAX_RETRIES: 'embedding.maxRetries',

  /** Delay between retries in milliseconds */
  RETRY_DELAY_MS: 'embedding.retryDelayMs',

  // ─────────────────────────────────────────────────────────────────
  // Quality Thresholds
  // ─────────────────────────────────────────────────────────────────

  /** Minimum similarity score for search results (0-1) */
  MIN_SIMILARITY: 'embedding.minSimilarity',

  /** High similarity threshold for "exact match" (0-1) */
  HIGH_SIMILARITY: 'embedding.highSimilarity',

  /** Cache TTL for embeddings in milliseconds */
  CACHE_TTL_MS: 'embedding.cacheTtlMs',

  // ─────────────────────────────────────────────────────────────────
  // Chunking Configuration
  // ─────────────────────────────────────────────────────────────────

  /** Target chunk size in characters */
  TARGET_CHUNK_CHARS: 'embedding.targetChunkChars',

  /** Maximum chunk size in characters */
  MAX_CHUNK_CHARS: 'embedding.maxChunkChars',

  /** Minimum words before pyramid building */
  MIN_WORDS_FOR_PYRAMID: 'embedding.minWordsForPyramid',
} as const;

/**
 * Type for embedding config keys
 */
export type EmbeddingConfigKey = typeof EMBEDDING_CONFIG_KEYS[keyof typeof EMBEDDING_CONFIG_KEYS];

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT VALUES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default values for embedding configuration.
 * Used when config is not set or as initialization values.
 */
export const EMBEDDING_DEFAULTS: Record<EmbeddingConfigKey, unknown> = {
  // Model selection
  [EMBEDDING_CONFIG_KEYS.DEFAULT_MODEL]: 'nomic-embed-text:latest',
  [EMBEDDING_CONFIG_KEYS.FALLBACK_MODEL]: 'text-embedding-3-small',

  // Model properties
  [EMBEDDING_CONFIG_KEYS.DIMENSIONS]: 768,
  [EMBEDDING_CONFIG_KEYS.MAX_TOKENS]: 2048,

  // Service configuration
  [EMBEDDING_CONFIG_KEYS.OLLAMA_URL]: 'http://localhost:11434',
  [EMBEDDING_CONFIG_KEYS.TIMEOUT_MS]: 60000,
  [EMBEDDING_CONFIG_KEYS.BATCH_SIZE]: 10,
  [EMBEDDING_CONFIG_KEYS.MAX_RETRIES]: 3,
  [EMBEDDING_CONFIG_KEYS.RETRY_DELAY_MS]: 1000,

  // Quality thresholds
  [EMBEDDING_CONFIG_KEYS.MIN_SIMILARITY]: 0.5,
  [EMBEDDING_CONFIG_KEYS.HIGH_SIMILARITY]: 0.85,
  [EMBEDDING_CONFIG_KEYS.CACHE_TTL_MS]: 3600000, // 1 hour

  // Chunking configuration
  [EMBEDDING_CONFIG_KEYS.TARGET_CHUNK_CHARS]: 3000,
  [EMBEDDING_CONFIG_KEYS.MAX_CHUNK_CHARS]: 4000,
  [EMBEDDING_CONFIG_KEYS.MIN_WORDS_FOR_PYRAMID]: 1000,
};

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG CATEGORY MAPPING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Maps embedding config keys to their ConfigManager categories.
 * Most embedding configs go in 'limits' or 'thresholds'.
 */
export const EMBEDDING_CONFIG_CATEGORIES: Record<EmbeddingConfigKey, ConfigCategory> = {
  // Model selection goes in 'agents' (alongside other model configs)
  [EMBEDDING_CONFIG_KEYS.DEFAULT_MODEL]: 'agents',
  [EMBEDDING_CONFIG_KEYS.FALLBACK_MODEL]: 'agents',

  // Model properties in 'limits'
  [EMBEDDING_CONFIG_KEYS.DIMENSIONS]: 'limits',
  [EMBEDDING_CONFIG_KEYS.MAX_TOKENS]: 'limits',

  // Service config in 'limits'
  [EMBEDDING_CONFIG_KEYS.OLLAMA_URL]: 'limits',
  [EMBEDDING_CONFIG_KEYS.TIMEOUT_MS]: 'limits',
  [EMBEDDING_CONFIG_KEYS.BATCH_SIZE]: 'limits',
  [EMBEDDING_CONFIG_KEYS.MAX_RETRIES]: 'limits',
  [EMBEDDING_CONFIG_KEYS.RETRY_DELAY_MS]: 'limits',

  // Quality thresholds
  [EMBEDDING_CONFIG_KEYS.MIN_SIMILARITY]: 'thresholds',
  [EMBEDDING_CONFIG_KEYS.HIGH_SIMILARITY]: 'thresholds',
  [EMBEDDING_CONFIG_KEYS.CACHE_TTL_MS]: 'limits',

  // Chunking in 'limits'
  [EMBEDDING_CONFIG_KEYS.TARGET_CHUNK_CHARS]: 'limits',
  [EMBEDDING_CONFIG_KEYS.MAX_CHUNK_CHARS]: 'limits',
  [EMBEDDING_CONFIG_KEYS.MIN_WORDS_FOR_PYRAMID]: 'limits',
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the category for an embedding config key
 */
export function getEmbeddingConfigCategory(key: EmbeddingConfigKey): ConfigCategory {
  return EMBEDDING_CONFIG_CATEGORIES[key];
}

/**
 * Get the default value for an embedding config key
 */
export function getEmbeddingDefault<T>(key: EmbeddingConfigKey): T {
  return EMBEDDING_DEFAULTS[key] as T;
}

/**
 * Seed embedding defaults into ConfigManager
 */
export async function seedEmbeddingDefaults(
  configManager: { set: (category: ConfigCategory, key: string, value: unknown) => Promise<void> }
): Promise<void> {
  for (const [key, value] of Object.entries(EMBEDDING_DEFAULTS)) {
    const category = EMBEDDING_CONFIG_CATEGORIES[key as EmbeddingConfigKey];
    await configManager.set(category, key, value);
  }
}
