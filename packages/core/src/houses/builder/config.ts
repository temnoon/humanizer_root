/**
 * Builder Agent - Configuration Keys
 *
 * Configuration keys for Builder-specific settings.
 *
 * @module @humanizer/core/houses/builder/config
 */

// ═══════════════════════════════════════════════════════════════════
// CONFIG KEYS FOR BUILDER
// ═══════════════════════════════════════════════════════════════════

/**
 * Builder specific config keys
 */
export const BUILDER_CONFIG = {
  // Chapter length limits
  MIN_CHAPTER_WORDS: 'builder.minChapterWords',
  MAX_CHAPTER_WORDS: 'builder.maxChapterWords',

  // Quality thresholds
  TARGET_PACING_SCORE: 'builder.targetPacingScore',
  VOICE_CONSISTENCY_THRESHOLD: 'builder.voiceConsistencyThreshold',

  // Bridge/transition limits
  MAX_BRIDGE_LENGTH: 'builder.maxBridgeLength',
} as const;
