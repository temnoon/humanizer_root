/**
 * Retrieval Types
 *
 * Type definitions for the hybrid retrieval pipeline.
 * Combines dense (embedding) and sparse (keyword) search
 * with quality filtering and context expansion.
 */

import type { StoredNode, SearchResult } from '../storage/types.js';

// ═══════════════════════════════════════════════════════════════════
// RANKED RESULTS
// ═══════════════════════════════════════════════════════════════════

/**
 * A search result with rank information
 */
export interface RankedResult {
  /** The matched node */
  node: StoredNode;

  /** Original rank in the result set (1-indexed) */
  rank: number;

  /** Score from the original search */
  score: number;

  /** Source of this result */
  source: 'dense' | 'sparse';
}

/**
 * A result after RRF fusion
 */
export interface FusedResult {
  /** The matched node */
  node: StoredNode;

  /** Fused score from RRF */
  fusedScore: number;

  /** Original dense score (if present) */
  denseScore?: number;

  /** Original dense rank (if present) */
  denseRank?: number;

  /** Original sparse score (if present) */
  sparseScore?: number;

  /** Original sparse rank (if present) */
  sparseRank?: number;

  /** Whether this result appeared in both dense and sparse */
  inBoth: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// HYBRID SEARCH OPTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Options for hybrid search
 */
export interface HybridSearchOptions {
  /** Maximum results to return */
  limit?: number;

  /** Minimum similarity threshold for dense search (0-1) */
  denseThreshold?: number;

  /** Weight for dense results in RRF (0-1) */
  denseWeight?: number;

  /** Weight for sparse results in RRF (0-1) */
  sparseWeight?: number;

  /** RRF k parameter (typically 60) */
  rrfK?: number;

  /** Filter by source type(s) */
  sourceType?: string | string[];

  /** Filter by hierarchy level */
  hierarchyLevel?: number;

  /** Filter by thread root */
  threadRootId?: string;

  /** Include title in keyword search */
  searchTitle?: boolean;

  /** Skip dense search (keyword only) */
  sparseOnly?: boolean;

  /** Skip sparse search (embedding only) */
  denseOnly?: boolean;
}

/**
 * Result from hybrid search
 */
export interface HybridSearchResult {
  /** Fused results ordered by score */
  results: FusedResult[];

  /** Statistics about the search */
  stats: HybridSearchStats;
}

/**
 * Statistics from hybrid search
 */
export interface HybridSearchStats {
  /** Number of dense results before fusion */
  denseCount: number;

  /** Number of sparse results before fusion */
  sparseCount: number;

  /** Number of results after fusion */
  fusedCount: number;

  /** Number of results appearing in both */
  overlapCount: number;

  /** Dense search time (ms) */
  denseTimeMs: number;

  /** Sparse search time (ms) */
  sparseTimeMs: number;

  /** Fusion time (ms) */
  fusionTimeMs: number;

  /** Total time (ms) */
  totalTimeMs: number;
}

// ═══════════════════════════════════════════════════════════════════
// CROSS-LEVEL SEARCH (PYRAMID)
// ═══════════════════════════════════════════════════════════════════

/**
 * Options for cross-level pyramid search
 */
export interface CrossLevelSearchOptions extends HybridSearchOptions {
  /** Starting level for search (default: search all levels) */
  startLevel?: 0 | 1 | 2;

  /** Whether to expand results to child nodes */
  expandToChildren?: boolean;

  /** Maximum child nodes to return per result */
  maxChildrenPerResult?: number;

  /** Whether to include ancestor path for each result */
  includeAncestorPath?: boolean;
}

/**
 * A result from pyramid search with hierarchy information
 */
export interface PyramidSearchResultItem extends FusedResult {
  /** Hierarchy level of the matched node (0, 1, or 2) */
  hierarchyLevel: number;

  /** Child nodes (L0 chunks when matching L1/Apex) */
  children?: StoredNode[];

  /** Ancestor path (from apex to this node) */
  ancestorPath?: string[];
}

/**
 * Result from cross-level pyramid search
 */
export interface CrossLevelSearchResult {
  /** All results ordered by fused score */
  results: PyramidSearchResultItem[];

  /** Results grouped by hierarchy level */
  byLevel: {
    l0: PyramidSearchResultItem[];
    l1: PyramidSearchResultItem[];
    apex: PyramidSearchResultItem[];
  };

  /** Statistics about the search */
  stats: CrossLevelSearchStats;
}

/**
 * Statistics from cross-level search
 */
export interface CrossLevelSearchStats extends HybridSearchStats {
  /** Result counts by level */
  resultsByLevel: {
    l0: number;
    l1: number;
    apex: number;
  };

  /** Number of children expanded */
  childrenExpandedCount: number;

  /** Total unique threads found */
  uniqueThreads: number;
}

// ═══════════════════════════════════════════════════════════════════
// NEGATIVE FILTERING
// ═══════════════════════════════════════════════════════════════════

/**
 * Options for negative semantic filtering
 */
export interface NegativeFilterOptions {
  /** Embeddings to filter against */
  negativeEmbeddings: number[][];

  /** Similarity threshold for exclusion (0-1) */
  threshold?: number;

  /** Mode: exclude similar or include dissimilar */
  mode?: 'exclude' | 'require_dissimilar';
}

/**
 * Result from negative filtering
 */
export interface NegativeFilterResult {
  /** Filtered results */
  results: FusedResult[];

  /** Number of results removed */
  removedCount: number;
}

// ═══════════════════════════════════════════════════════════════════
// ANCHOR REFINEMENT
// ═══════════════════════════════════════════════════════════════════

/**
 * An anchor point for semantic navigation
 */
export interface SemanticAnchor {
  /** Anchor ID */
  id: string;

  /** Anchor name */
  name: string;

  /** Anchor embedding */
  embedding: number[];

  /** Creation timestamp */
  createdAt: number;
}

/**
 * A set of anchors for navigation
 */
export interface AnchorSet {
  /** Positive anchors (find similar) */
  positive: SemanticAnchor[];

  /** Negative anchors (avoid similar) */
  negative: SemanticAnchor[];
}

/**
 * Options for anchor-based refinement
 */
export interface AnchorRefinementOptions {
  /** Anchor set to use */
  anchors: AnchorSet;

  /** Weight for positive anchor similarity */
  positiveWeight?: number;

  /** Weight for negative anchor dissimilarity */
  negativeWeight?: number;

  /** Minimum results to keep */
  minResults?: number;
}

/**
 * Result from anchor refinement (FIND→REFINE→HARVEST pattern)
 */
export interface AnchorRefinementResult {
  /** Refined results */
  results: FusedResult[];

  /** Results grouped by nearest positive anchor */
  byAnchor: Map<string, FusedResult[]>;

  /** Statistics */
  stats: {
    inputCount: number;
    outputCount: number;
    removedByNegative: number;
    averagePositiveSimilarity: number;
  };
}

// ═══════════════════════════════════════════════════════════════════
// RERANKING
// ═══════════════════════════════════════════════════════════════════

/**
 * Reranker interface
 */
export interface Reranker {
  /** Rerank results based on query */
  rerank(
    query: string,
    results: FusedResult[],
    options?: RerankerOptions
  ): Promise<FusedResult[]>;
}

/**
 * Options for reranking
 */
export interface RerankerOptions {
  /** Maximum results after reranking */
  limit?: number;

  /** Minimum score after reranking */
  minScore?: number;
}

// ═══════════════════════════════════════════════════════════════════
// QUALITY GATING
// ═══════════════════════════════════════════════════════════════════

/**
 * Options for quality-gated retrieval
 */
export interface QualityGateOptions {
  /** Minimum word count for chunks */
  minWordCount?: number;

  /** Minimum quality score (0-1) */
  minQualityScore?: number;

  /** Expand context for short chunks */
  expandContext?: boolean;

  /** Maximum context expansion (in parent levels) */
  maxContextExpansion?: number;

  /** Filter by author role */
  authorRole?: string;
}

/**
 * Result from quality-gated retrieval
 */
export interface QualityGatedResult {
  /** Quality-filtered results */
  results: EnrichedResult[];

  /** Pipeline statistics */
  stats: QualityGateStats;
}

/**
 * A result with expanded context
 */
export interface EnrichedResult extends FusedResult {
  /** Parent node (if expanded) */
  parentNode?: StoredNode;

  /** Context text (combined with parent if expanded) */
  contextText?: string;

  /** Whether context was expanded */
  contextExpanded: boolean;

  /** Quality indicators */
  qualityIndicators: QualityIndicators;
}

/**
 * Quality indicators for a result
 */
export interface QualityIndicators {
  /** Word count sufficient */
  hasMinWords: boolean;

  /** Has good quality score */
  hasMinQuality: boolean;

  /** Is complete (not truncated) */
  isComplete: boolean;

  /** Overall quality passed */
  passedGate: boolean;
}

/**
 * Statistics from quality-gated pipeline
 */
export interface QualityGateStats {
  /** Input result count */
  inputCount: number;

  /** Results passing quality gate */
  passedCount: number;

  /** Results filtered by word count */
  filteredByWords: number;

  /** Results filtered by quality score */
  filteredByQuality: number;

  /** Results with context expanded */
  contextExpandedCount: number;

  /** Processing time (ms) */
  processingTimeMs: number;
}
