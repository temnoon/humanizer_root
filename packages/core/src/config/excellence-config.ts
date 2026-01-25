/**
 * Excellence Configuration
 *
 * Centralizes all excellence-scoring and content quality configuration keys and defaults.
 * Part of the Content Excellence System.
 *
 * Usage:
 * ```typescript
 * import { EXCELLENCE_CONFIG_KEYS, EXCELLENCE_DEFAULTS } from './excellence-config';
 * import { getConfigManager } from './in-memory-config';
 *
 * const config = getConfigManager();
 * const threshold = await config.get('thresholds', EXCELLENCE_CONFIG_KEYS.EXCELLENCE_THRESHOLD)
 *   ?? EXCELLENCE_DEFAULTS[EXCELLENCE_CONFIG_KEYS.EXCELLENCE_THRESHOLD];
 * ```
 *
 * @module config/excellence-config
 */

import type { ConfigCategory } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG KEYS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuration keys for excellence-related settings.
 * Use these with ConfigManager instead of hardcoding strings.
 */
export const EXCELLENCE_CONFIG_KEYS = {
  // ─────────────────────────────────────────────────────────────────
  // Scoring Weights (sum to 1.0)
  // ─────────────────────────────────────────────────────────────────

  /** Weight for insight density dimension (novel ideas per paragraph) */
  INSIGHT_DENSITY_WEIGHT: 'excellence.insightDensityWeight',

  /** Weight for expressive power dimension (clarity, memorability) */
  EXPRESSION_POWER_WEIGHT: 'excellence.expressionPowerWeight',

  /** Weight for emotional resonance dimension (reader connection) */
  RESONANCE_WEIGHT: 'excellence.resonanceWeight',

  /** Weight for structural elegance dimension (flow, pacing) */
  ELEGANCE_WEIGHT: 'excellence.eleganceWeight',

  /** Weight for voice authenticity dimension (distinct, genuine) */
  AUTHENTICITY_WEIGHT: 'excellence.authenticityWeight',

  // ─────────────────────────────────────────────────────────────────
  // Tier Thresholds (0-100 scale)
  // ─────────────────────────────────────────────────────────────────

  /** Minimum score for 'excellence' tier */
  EXCELLENCE_THRESHOLD: 'excellence.excellenceThreshold',

  /** Minimum score for 'polished' tier */
  POLISHED_THRESHOLD: 'excellence.polishedThreshold',

  /** Minimum score for 'needs_refinement' tier */
  REFINEMENT_THRESHOLD: 'excellence.refinementThreshold',

  /** Gap between insight quality and writing quality to detect raw gems */
  RAW_GEM_QUALITY_GAP: 'excellence.rawGemQualityGap',

  // ─────────────────────────────────────────────────────────────────
  // Refinement Settings
  // ─────────────────────────────────────────────────────────────────

  /** Minimum insight preservation ratio after refinement (0-1) */
  MIN_INSIGHT_PRESERVATION: 'excellence.minInsightPreservation',

  /** Maximum number of refinement passes */
  MAX_REFINEMENT_PASSES: 'excellence.maxRefinementPasses',

  /** Timeout for refinement operations in milliseconds */
  REFINEMENT_TIMEOUT_MS: 'excellence.refinementTimeoutMs',

  // ─────────────────────────────────────────────────────────────────
  // Indexing Settings
  // ─────────────────────────────────────────────────────────────────

  /** Minimum excellence score to include in expression index */
  INDEX_MIN_SCORE: 'excellence.indexMinScore',

  /** Similarity threshold for expression deduplication (0-1) */
  INDEX_SIMILARITY_THRESHOLD: 'excellence.indexSimilarityThreshold',

  /** Maximum expressions per category in index */
  INDEX_MAX_PER_CATEGORY: 'excellence.indexMaxPerCategory',

  // ─────────────────────────────────────────────────────────────────
  // Prospector Settings
  // ─────────────────────────────────────────────────────────────────

  /** Batch size for prospector scanning */
  PROSPECTOR_BATCH_SIZE: 'excellence.prospectorBatchSize',

  /** Minimum content length for excellence scoring (characters) */
  MIN_CONTENT_LENGTH: 'excellence.minContentLength',

  /** Maximum content length for single-pass scoring (characters) */
  MAX_CONTENT_LENGTH: 'excellence.maxContentLength',
} as const;

/**
 * Type for excellence config keys
 */
export type ExcellenceConfigKey = typeof EXCELLENCE_CONFIG_KEYS[keyof typeof EXCELLENCE_CONFIG_KEYS];

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT VALUES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default values for excellence configuration.
 * Used when config is not set or as initialization values.
 */
export const EXCELLENCE_DEFAULTS: Record<ExcellenceConfigKey, unknown> = {
  // Scoring weights (sum to 1.0)
  [EXCELLENCE_CONFIG_KEYS.INSIGHT_DENSITY_WEIGHT]: 0.25,
  [EXCELLENCE_CONFIG_KEYS.EXPRESSION_POWER_WEIGHT]: 0.20,
  [EXCELLENCE_CONFIG_KEYS.RESONANCE_WEIGHT]: 0.20,
  [EXCELLENCE_CONFIG_KEYS.ELEGANCE_WEIGHT]: 0.15,
  [EXCELLENCE_CONFIG_KEYS.AUTHENTICITY_WEIGHT]: 0.20,

  // Tier thresholds
  [EXCELLENCE_CONFIG_KEYS.EXCELLENCE_THRESHOLD]: 80,
  [EXCELLENCE_CONFIG_KEYS.POLISHED_THRESHOLD]: 60,
  [EXCELLENCE_CONFIG_KEYS.REFINEMENT_THRESHOLD]: 40,
  [EXCELLENCE_CONFIG_KEYS.RAW_GEM_QUALITY_GAP]: 0.3,

  // Refinement settings
  [EXCELLENCE_CONFIG_KEYS.MIN_INSIGHT_PRESERVATION]: 0.85,
  [EXCELLENCE_CONFIG_KEYS.MAX_REFINEMENT_PASSES]: 3,
  [EXCELLENCE_CONFIG_KEYS.REFINEMENT_TIMEOUT_MS]: 60000,

  // Indexing settings
  [EXCELLENCE_CONFIG_KEYS.INDEX_MIN_SCORE]: 70,
  [EXCELLENCE_CONFIG_KEYS.INDEX_SIMILARITY_THRESHOLD]: 0.85,
  [EXCELLENCE_CONFIG_KEYS.INDEX_MAX_PER_CATEGORY]: 100,

  // Prospector settings
  [EXCELLENCE_CONFIG_KEYS.PROSPECTOR_BATCH_SIZE]: 10,
  [EXCELLENCE_CONFIG_KEYS.MIN_CONTENT_LENGTH]: 100,
  [EXCELLENCE_CONFIG_KEYS.MAX_CONTENT_LENGTH]: 10000,
};

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG CATEGORY MAPPING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Maps excellence config keys to their ConfigManager categories.
 */
export const EXCELLENCE_CONFIG_CATEGORIES: Record<ExcellenceConfigKey, ConfigCategory> = {
  // Scoring weights in 'agents' (agent-specific configuration)
  [EXCELLENCE_CONFIG_KEYS.INSIGHT_DENSITY_WEIGHT]: 'agents',
  [EXCELLENCE_CONFIG_KEYS.EXPRESSION_POWER_WEIGHT]: 'agents',
  [EXCELLENCE_CONFIG_KEYS.RESONANCE_WEIGHT]: 'agents',
  [EXCELLENCE_CONFIG_KEYS.ELEGANCE_WEIGHT]: 'agents',
  [EXCELLENCE_CONFIG_KEYS.AUTHENTICITY_WEIGHT]: 'agents',

  // Tier thresholds
  [EXCELLENCE_CONFIG_KEYS.EXCELLENCE_THRESHOLD]: 'thresholds',
  [EXCELLENCE_CONFIG_KEYS.POLISHED_THRESHOLD]: 'thresholds',
  [EXCELLENCE_CONFIG_KEYS.REFINEMENT_THRESHOLD]: 'thresholds',
  [EXCELLENCE_CONFIG_KEYS.RAW_GEM_QUALITY_GAP]: 'thresholds',

  // Refinement settings in 'limits'
  [EXCELLENCE_CONFIG_KEYS.MIN_INSIGHT_PRESERVATION]: 'thresholds',
  [EXCELLENCE_CONFIG_KEYS.MAX_REFINEMENT_PASSES]: 'limits',
  [EXCELLENCE_CONFIG_KEYS.REFINEMENT_TIMEOUT_MS]: 'limits',

  // Indexing settings
  [EXCELLENCE_CONFIG_KEYS.INDEX_MIN_SCORE]: 'thresholds',
  [EXCELLENCE_CONFIG_KEYS.INDEX_SIMILARITY_THRESHOLD]: 'thresholds',
  [EXCELLENCE_CONFIG_KEYS.INDEX_MAX_PER_CATEGORY]: 'limits',

  // Prospector settings in 'limits'
  [EXCELLENCE_CONFIG_KEYS.PROSPECTOR_BATCH_SIZE]: 'limits',
  [EXCELLENCE_CONFIG_KEYS.MIN_CONTENT_LENGTH]: 'limits',
  [EXCELLENCE_CONFIG_KEYS.MAX_CONTENT_LENGTH]: 'limits',
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the category for an excellence config key
 */
export function getExcellenceConfigCategory(key: ExcellenceConfigKey): ConfigCategory {
  return EXCELLENCE_CONFIG_CATEGORIES[key];
}

/**
 * Get the default value for an excellence config key
 */
export function getExcellenceDefault<T>(key: ExcellenceConfigKey): T {
  return EXCELLENCE_DEFAULTS[key] as T;
}

/**
 * Seed excellence defaults into ConfigManager
 */
export async function seedExcellenceDefaults(
  configManager: { set: (category: ConfigCategory, key: string, value: unknown) => Promise<void> }
): Promise<void> {
  for (const [key, value] of Object.entries(EXCELLENCE_DEFAULTS)) {
    const category = EXCELLENCE_CONFIG_CATEGORIES[key as ExcellenceConfigKey];
    await configManager.set(category, key, value);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXCELLENCE TIER ENUM
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Content excellence tier classification
 */
export type ExcellenceTier =
  | 'excellence'       // Exceptional content, ready to publish
  | 'polished'         // High quality, minor refinements possible
  | 'needs_refinement' // Good ideas, needs editorial polish
  | 'raw_gem'          // Buried insight in poor writing
  | 'noise';           // Low value content

/**
 * Determine excellence tier from composite score
 */
export function getExcellenceTier(
  compositeScore: number,
  qualityGap?: number,
  thresholds?: {
    excellenceThreshold?: number;
    polishedThreshold?: number;
    refinementThreshold?: number;
    rawGemQualityGap?: number;
  }
): ExcellenceTier {
  const excellence = thresholds?.excellenceThreshold ?? EXCELLENCE_DEFAULTS[EXCELLENCE_CONFIG_KEYS.EXCELLENCE_THRESHOLD] as number;
  const polished = thresholds?.polishedThreshold ?? EXCELLENCE_DEFAULTS[EXCELLENCE_CONFIG_KEYS.POLISHED_THRESHOLD] as number;
  const refinement = thresholds?.refinementThreshold ?? EXCELLENCE_DEFAULTS[EXCELLENCE_CONFIG_KEYS.REFINEMENT_THRESHOLD] as number;
  const gemGap = thresholds?.rawGemQualityGap ?? EXCELLENCE_DEFAULTS[EXCELLENCE_CONFIG_KEYS.RAW_GEM_QUALITY_GAP] as number;

  // Check for raw gem: high insight gap with poor writing
  if (qualityGap !== undefined && qualityGap >= gemGap) {
    return 'raw_gem';
  }

  if (compositeScore >= excellence) {
    return 'excellence';
  }
  if (compositeScore >= polished) {
    return 'polished';
  }
  if (compositeScore >= refinement) {
    return 'needs_refinement';
  }
  return 'noise';
}
