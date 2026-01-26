/**
 * Agentic Search Constants
 *
 * Configuration keys and default values for the agentic search service.
 * Uses the same pattern as ../retrieval/constants.ts
 */

// ═══════════════════════════════════════════════════════════════════
// SEARCH DEFAULTS
// ═══════════════════════════════════════════════════════════════════

/** Default maximum results to return (storage layer fetches 2x for filtering) */
export const DEFAULT_LIMIT = 60;

/** Default relevance threshold (0-1) */
export const DEFAULT_THRESHOLD = 0.3;

/** Default weight for dense search in hybrid mode */
export const DEFAULT_DENSE_WEIGHT = 0.6;

/** Default weight for sparse search in hybrid mode */
export const DEFAULT_SPARSE_WEIGHT = 0.4;

/** RRF k parameter for rank fusion */
export const RRF_K = 60;

// ═══════════════════════════════════════════════════════════════════
// QUALITY GATE DEFAULTS
// ═══════════════════════════════════════════════════════════════════

/** Default minimum word count for results */
export const DEFAULT_MIN_WORD_COUNT = 20;

/** Default minimum quality score */
export const DEFAULT_MIN_QUALITY_SCORE = 0.3;

/** Default max context expansion levels */
export const DEFAULT_MAX_CONTEXT_EXPANSION = 2;

/** Minimum word count to consider content non-trivial */
export const TRIVIAL_CONTENT_THRESHOLD = 5;

// ═══════════════════════════════════════════════════════════════════
// ANCHOR DEFAULTS
// ═══════════════════════════════════════════════════════════════════

/** Default weight for positive anchor similarity */
export const DEFAULT_POSITIVE_ANCHOR_WEIGHT = 0.5;

/** Default weight for negative anchor dissimilarity */
export const DEFAULT_NEGATIVE_ANCHOR_WEIGHT = 0.3;

/** Threshold for negative anchor filtering (0-1) */
export const NEGATIVE_ANCHOR_THRESHOLD = 0.7;

// ═══════════════════════════════════════════════════════════════════
// CLUSTERING DEFAULTS
// ═══════════════════════════════════════════════════════════════════

/** Default minimum cluster size */
export const DEFAULT_MIN_CLUSTER_SIZE = 3;

/** Default maximum clusters to return */
export const DEFAULT_MAX_CLUSTERS = 10;

// ═══════════════════════════════════════════════════════════════════
// SESSION DEFAULTS
// ═══════════════════════════════════════════════════════════════════

/** Maximum sessions to keep in memory */
export const DEFAULT_MAX_SESSIONS = 100;

/** Session timeout (1 hour) */
export const DEFAULT_SESSION_TIMEOUT_MS = 60 * 60 * 1000;

/** Maximum history entries per session */
export const MAX_HISTORY_ENTRIES = 50;

// ═══════════════════════════════════════════════════════════════════
// CACHE DEFAULTS
// ═══════════════════════════════════════════════════════════════════

/** Default cache TTL (5 minutes) */
export const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

/** Maximum cache entries */
export const MAX_CACHE_ENTRIES = 1000;

// ═══════════════════════════════════════════════════════════════════
// ENRICHMENT DEFAULTS
// ═══════════════════════════════════════════════════════════════════

/** Maximum text length to send for title generation */
export const TITLE_GENERATION_MAX_CHARS = 500;

/** Maximum text length to send for summary generation */
export const SUMMARY_GENERATION_MAX_CHARS = 2000;

/** Default summary target word count */
export const DEFAULT_SUMMARY_WORDS = 50;

// ═══════════════════════════════════════════════════════════════════
// HIERARCHY LEVEL MAPPING
// ═══════════════════════════════════════════════════════════════════

/** Map hierarchy filter to numeric level */
export const HIERARCHY_LEVEL_MAP = {
  L0: 0,
  L1: 1,
  apex: 2,
  all: -1, // -1 means no filter
} as const;

// ═══════════════════════════════════════════════════════════════════
// SOURCE TYPE CONSTANTS
// ═══════════════════════════════════════════════════════════════════

/** Known source types for filtering */
export const KNOWN_SOURCE_TYPES = [
  'chatgpt',
  'claude',
  'facebook',
  'twitter',
  'email',
  'notes',
  'journal',
  'book',
  'article',
  'web',
] as const;

// ═══════════════════════════════════════════════════════════════════
// CONFIG KEYS (for external configuration)
// ═══════════════════════════════════════════════════════════════════

/** Config key prefix for agentic search */
export const CONFIG_PREFIX = 'agenticSearch';

/** Config keys */
export const CONFIG_KEYS = {
  /** Default search limit */
  DEFAULT_LIMIT: `${CONFIG_PREFIX}.defaultLimit`,

  /** Default relevance threshold */
  DEFAULT_THRESHOLD: `${CONFIG_PREFIX}.defaultThreshold`,

  /** Default dense weight */
  DENSE_WEIGHT: `${CONFIG_PREFIX}.denseWeight`,

  /** Default sparse weight */
  SPARSE_WEIGHT: `${CONFIG_PREFIX}.sparseWeight`,

  /** Enable verbose logging */
  VERBOSE: `${CONFIG_PREFIX}.verbose`,

  /** Enable caching */
  CACHE_ENABLED: `${CONFIG_PREFIX}.cacheEnabled`,

  /** Cache TTL */
  CACHE_TTL_MS: `${CONFIG_PREFIX}.cacheTtlMs`,

  /** Session timeout */
  SESSION_TIMEOUT_MS: `${CONFIG_PREFIX}.sessionTimeoutMs`,

  /** Max sessions */
  MAX_SESSIONS: `${CONFIG_PREFIX}.maxSessions`,
} as const;
