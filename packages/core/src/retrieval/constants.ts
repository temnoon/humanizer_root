/**
 * Retrieval Constants
 *
 * Default configuration values for the retrieval pipeline.
 * All values are config-managed following platinum conventions.
 */

import type { HybridSearchOptions, QualityGateOptions } from './types.js';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION KEYS (for config manager integration)
// ═══════════════════════════════════════════════════════════════════

export const RETRIEVAL_CONFIG_KEYS = {
  // RRF Parameters
  RRF_K: 'retrieval.rrfK',
  DENSE_WEIGHT: 'retrieval.denseWeight',
  SPARSE_WEIGHT: 'retrieval.sparseWeight',

  // Search Parameters
  DEFAULT_LIMIT: 'retrieval.defaultLimit',
  DENSE_THRESHOLD: 'retrieval.denseThreshold',

  // Quality Gate Parameters
  MIN_WORD_COUNT: 'retrieval.minWordCount',
  MIN_QUALITY_SCORE: 'retrieval.minQualityScore',
  MAX_CONTEXT_EXPANSION: 'retrieval.maxContextExpansion',

  // Anchor Parameters
  POSITIVE_ANCHOR_WEIGHT: 'retrieval.positiveAnchorWeight',
  NEGATIVE_ANCHOR_WEIGHT: 'retrieval.negativeAnchorWeight',
  NEGATIVE_FILTER_THRESHOLD: 'retrieval.negativeFilterThreshold',
} as const;

// ═══════════════════════════════════════════════════════════════════
// RRF (RECIPROCAL RANK FUSION) DEFAULTS
// ═══════════════════════════════════════════════════════════════════

/**
 * RRF k parameter
 * Standard value from the original RRF paper
 * Higher k = more emphasis on lower ranks
 */
export const RRF_K = 60;

/**
 * Weight for dense (embedding) results in RRF
 * Dense search captures semantic similarity
 */
export const DENSE_WEIGHT = 0.7;

/**
 * Weight for sparse (keyword) results in RRF
 * Sparse search captures exact matches
 */
export const SPARSE_WEIGHT = 0.3;

// ═══════════════════════════════════════════════════════════════════
// SEARCH DEFAULTS
// ═══════════════════════════════════════════════════════════════════

/**
 * Default number of results to return
 */
export const DEFAULT_LIMIT = 20;

/**
 * Default similarity threshold for dense search
 * Results below this score are filtered out
 */
export const DENSE_THRESHOLD = 0.4;

/**
 * Number of candidates to fetch before fusion
 * Multiplier on final limit to ensure good coverage
 */
export const CANDIDATE_MULTIPLIER = 3;

// ═══════════════════════════════════════════════════════════════════
// QUALITY GATE DEFAULTS
// ═══════════════════════════════════════════════════════════════════

/**
 * Minimum word count for chunks
 * Chunks with fewer words may lack semantic content
 */
export const MIN_WORD_COUNT = 30;

/**
 * Minimum quality score (0-1)
 * Based on content metadata if available
 */
export const MIN_QUALITY_SCORE = 0.4;

/**
 * Maximum context expansion levels
 * How many parent levels to fetch for short chunks
 */
export const MAX_CONTEXT_EXPANSION = 2;

// ═══════════════════════════════════════════════════════════════════
// ANCHOR DEFAULTS
// ═══════════════════════════════════════════════════════════════════

/**
 * Weight for positive anchor similarity
 */
export const POSITIVE_ANCHOR_WEIGHT = 1.0;

/**
 * Weight for negative anchor dissimilarity
 */
export const NEGATIVE_ANCHOR_WEIGHT = 0.5;

/**
 * Similarity threshold for negative filtering
 * Results above this similarity to negative anchors are excluded
 */
export const NEGATIVE_FILTER_THRESHOLD = 0.7;

// ═══════════════════════════════════════════════════════════════════
// DEFAULT CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Default hybrid search options
 */
export const DEFAULT_HYBRID_SEARCH_OPTIONS: Required<HybridSearchOptions> = {
  limit: DEFAULT_LIMIT,
  denseThreshold: DENSE_THRESHOLD,
  denseWeight: DENSE_WEIGHT,
  sparseWeight: SPARSE_WEIGHT,
  rrfK: RRF_K,
  sourceType: [],
  hierarchyLevel: 0,
  threadRootId: '',
  searchTitle: true,
  sparseOnly: false,
  denseOnly: false,
};

/**
 * Default quality gate options
 */
export const DEFAULT_QUALITY_GATE_OPTIONS: Required<QualityGateOptions> = {
  minWordCount: MIN_WORD_COUNT,
  minQualityScore: MIN_QUALITY_SCORE,
  expandContext: true,
  maxContextExpansion: MAX_CONTEXT_EXPANSION,
  authorRole: '',
};
