/**
 * Retrieval Module
 *
 * Hybrid retrieval pipeline for the UCG system.
 * Combines dense (embedding) and sparse (keyword) search
 * using Reciprocal Rank Fusion (RRF).
 *
 * Key Components:
 * - HybridSearchService: Combines dense + sparse with RRF
 * - Negative filtering: Semantic exclusion
 * - Rerankers: Score adjustment and diversity
 * - Anchor refinement: FIND→REFINE→HARVEST pattern
 * - Quality gate: Filtering and context expansion
 *
 * Usage:
 * ```typescript
 * import {
 *   HybridSearchService,
 *   QualityGatedPipeline,
 *   getContentStore
 * } from '@humanizer/core';
 *
 * const store = getContentStore();
 * const search = new HybridSearchService(store);
 * const quality = new QualityGatedPipeline(store);
 *
 * // Hybrid search
 * const { results } = await search.search(embedding, 'query text');
 *
 * // Quality filter
 * const { results: filtered } = await quality.process(results);
 * ```
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type {
  RankedResult,
  FusedResult,
  HybridSearchOptions,
  HybridSearchResult,
  HybridSearchStats,
  NegativeFilterOptions,
  NegativeFilterResult,
  SemanticAnchor,
  AnchorSet,
  AnchorRefinementOptions,
  AnchorRefinementResult,
  Reranker,
  RerankerOptions,
  QualityGateOptions,
  QualityGatedResult,
  EnrichedResult,
  QualityIndicators,
  QualityGateStats,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

export {
  RETRIEVAL_CONFIG_KEYS,
  RRF_K,
  DENSE_WEIGHT,
  SPARSE_WEIGHT,
  DEFAULT_LIMIT,
  DENSE_THRESHOLD,
  CANDIDATE_MULTIPLIER,
  MIN_WORD_COUNT,
  MIN_QUALITY_SCORE,
  MAX_CONTEXT_EXPANSION,
  POSITIVE_ANCHOR_WEIGHT,
  NEGATIVE_ANCHOR_WEIGHT,
  NEGATIVE_FILTER_THRESHOLD,
  DEFAULT_HYBRID_SEARCH_OPTIONS,
  DEFAULT_QUALITY_GATE_OPTIONS,
} from './constants.js';

// ═══════════════════════════════════════════════════════════════════
// RRF (RECIPROCAL RANK FUSION)
// ═══════════════════════════════════════════════════════════════════

export {
  computeRRFScore,
  fuseResults,
  toRankedResults,
  computeOverlapStats,
  normalizeScores,
} from './rrf.js';

// ═══════════════════════════════════════════════════════════════════
// HYBRID SEARCH
// ═══════════════════════════════════════════════════════════════════

export {
  HybridSearchService,
  getHybridSearchService,
  initHybridSearchService,
  resetHybridSearchService,
} from './hybrid-search.js';

// ═══════════════════════════════════════════════════════════════════
// NEGATIVE FILTERING
// ═══════════════════════════════════════════════════════════════════

export {
  cosineSimilarity,
  maxSimilarityToSet,
  avgSimilarityToSet,
  filterByNegativeEmbeddings,
  filterWithEmbeddings,
  adjustScoresByEmbeddings,
} from './negative-filter.js';

// ═══════════════════════════════════════════════════════════════════
// RERANKING
// ═══════════════════════════════════════════════════════════════════

export {
  IdentityReranker,
  ScoreBasedReranker,
  DiversityReranker,
  createReranker,
} from './reranker.js';

export type {
  ScoreRerankerOptions,
  DiversityRerankerOptions,
} from './reranker.js';

// ═══════════════════════════════════════════════════════════════════
// ANCHOR REFINEMENT
// ═══════════════════════════════════════════════════════════════════

export {
  refineByAnchors,
  createAnchor,
  createAnchorSet,
  mergeAnchorSets,
  findBetweenAnchors,
  computeCentroid,
} from './anchor-refinement.js';

// ═══════════════════════════════════════════════════════════════════
// QUALITY GATE
// ═══════════════════════════════════════════════════════════════════

export {
  QualityGatedPipeline,
  passesQualityGate,
  filterByQuality,
  getNeedingExpansion,
  getQualityPipeline,
  initQualityPipeline,
  resetQualityPipeline,
} from './quality-gate.js';
