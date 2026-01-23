/**
 * Pyramid Service Constants
 *
 * Default configuration values for the pyramid system.
 * All values are config-managed following platinum conventions.
 */

import type { PyramidConfig } from './types.js';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION KEYS (for config manager integration)
// ═══════════════════════════════════════════════════════════════════

export const PYRAMID_CONFIG_KEYS = {
  MIN_TOKENS_FOR_PYRAMID: 'pyramid.minTokensForPyramid',
  CHUNKS_PER_SUMMARY: 'pyramid.chunksPerSummary',
  TARGET_SUMMARY_WORDS: 'pyramid.targetSummaryWords',
  TARGET_APEX_WORDS: 'pyramid.targetApexWords',
  EXTRACT_THEMES: 'pyramid.extractThemes',
  EXTRACT_ENTITIES: 'pyramid.extractEntities',
  TRACK_COMPRESSION: 'pyramid.trackCompressionRatios',
} as const;

// ═══════════════════════════════════════════════════════════════════
// PYRAMID THRESHOLDS
// ═══════════════════════════════════════════════════════════════════

/**
 * Minimum tokens to trigger pyramid building
 * Content below this threshold is stored as single L0 node
 */
export const MIN_TOKENS_FOR_PYRAMID = 1000;

/**
 * Approximate tokens per word (for estimation)
 */
export const TOKENS_PER_WORD = 1.3;

/**
 * Minimum words to trigger pyramid (derived)
 */
export const MIN_WORDS_FOR_PYRAMID = Math.round(MIN_TOKENS_FOR_PYRAMID / TOKENS_PER_WORD);

// ═══════════════════════════════════════════════════════════════════
// L1 SUMMARY CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Number of L0 chunks to group per L1 summary
 */
export const CHUNKS_PER_SUMMARY = 5;

/**
 * Maximum chunks per L1 summary (flexible grouping)
 */
export const MAX_CHUNKS_PER_SUMMARY = 10;

/**
 * Target word count for L1 summaries
 */
export const TARGET_SUMMARY_WORDS = 150;

/**
 * Minimum word count for L1 summaries
 */
export const MIN_SUMMARY_WORDS = 50;

/**
 * Maximum word count for L1 summaries
 */
export const MAX_SUMMARY_WORDS = 300;

// ═══════════════════════════════════════════════════════════════════
// APEX CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Target word count for apex synthesis
 */
export const TARGET_APEX_WORDS = 300;

/**
 * Minimum word count for apex
 */
export const MIN_APEX_WORDS = 100;

/**
 * Maximum word count for apex
 */
export const MAX_APEX_WORDS = 500;

/**
 * Maximum themes to extract
 */
export const MAX_THEMES = 5;

/**
 * Maximum entities to extract
 */
export const MAX_ENTITIES = 10;

// ═══════════════════════════════════════════════════════════════════
// COMPRESSION RATIOS
// ═══════════════════════════════════════════════════════════════════

/**
 * Target compression ratio for L0 → L1
 */
export const TARGET_L0_TO_L1_RATIO = 10;

/**
 * Target compression ratio for L1 → Apex
 */
export const TARGET_L1_TO_APEX_RATIO = 10;

/**
 * Target overall compression ratio
 */
export const TARGET_OVERALL_RATIO = 100;

// ═══════════════════════════════════════════════════════════════════
// DEFAULT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Default pyramid configuration
 */
export const DEFAULT_PYRAMID_CONFIG: PyramidConfig = {
  minTokensForPyramid: MIN_TOKENS_FOR_PYRAMID,
  chunksPerSummary: CHUNKS_PER_SUMMARY,
  targetSummaryWords: TARGET_SUMMARY_WORDS,
  targetApexWords: TARGET_APEX_WORDS,
  extractThemes: true,
  extractEntities: true,
  trackCompressionRatios: true,
};

// ═══════════════════════════════════════════════════════════════════
// FALLBACK SUMMARIZATION PROMPTS
// ═══════════════════════════════════════════════════════════════════

/**
 * Default prompt for L1 summarization
 */
export const L1_SUMMARY_PROMPT = `Summarize the following content in approximately {targetWords} words.
Focus on the key points and main ideas. Maintain factual accuracy.

Content:
{content}

Summary:`;

/**
 * Default prompt for apex synthesis
 */
export const APEX_SYNTHESIS_PROMPT = `Create a comprehensive synthesis of the following summaries in approximately {targetWords} words.
Identify the overarching themes and key takeaways.

Summaries:
{content}

Synthesis:`;

/**
 * Default prompt for theme extraction
 */
export const THEME_EXTRACTION_PROMPT = `Extract the {maxThemes} most important themes from the following text.
Return only the theme names, one per line.

Text:
{content}

Themes:`;

/**
 * Default prompt for entity extraction
 */
export const ENTITY_EXTRACTION_PROMPT = `Extract the {maxEntities} most important named entities (people, places, organizations, concepts) from the following text.
Return only the entity names, one per line.

Text:
{content}

Entities:`;
