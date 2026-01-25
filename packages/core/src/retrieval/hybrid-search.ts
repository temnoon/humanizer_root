/**
 * Hybrid Search Service
 *
 * Combines dense (embedding/vector) and sparse (keyword/BM25) search
 * using Reciprocal Rank Fusion (RRF) for optimal retrieval.
 *
 * Architecture:
 * 1. Run dense and sparse searches in parallel
 * 2. Fuse results using RRF
 * 3. Return top-k by fused score
 */

import type { PostgresContentStore } from '../storage/postgres-content-store.js';
import type { SearchResult, StoredNode } from '../storage/types.js';
import type {
  HybridSearchOptions,
  HybridSearchResult,
  HybridSearchStats,
  RankedResult,
  CrossLevelSearchOptions,
  PyramidSearchResultItem,
  CrossLevelSearchResult,
  CrossLevelSearchStats,
  FusedResult,
} from './types.js';
import {
  DEFAULT_LIMIT,
  CANDIDATE_MULTIPLIER,
  DEFAULT_HYBRID_SEARCH_OPTIONS,
} from './constants.js';
import { fuseResults, toRankedResults, computeOverlapStats } from './rrf.js';

// ═══════════════════════════════════════════════════════════════════
// HYBRID SEARCH SERVICE
// ═══════════════════════════════════════════════════════════════════

/**
 * Hybrid search service combining dense and sparse retrieval
 */
export class HybridSearchService {
  private readonly store: PostgresContentStore;

  constructor(store: PostgresContentStore) {
    this.store = store;
  }

  /**
   * Perform hybrid search with query embedding and text
   */
  async search(
    queryEmbedding: number[],
    queryText: string,
    options: HybridSearchOptions = {}
  ): Promise<HybridSearchResult> {
    const startTime = Date.now();
    const opts = { ...DEFAULT_HYBRID_SEARCH_OPTIONS, ...options };
    const candidateLimit = (opts.limit ?? DEFAULT_LIMIT) * CANDIDATE_MULTIPLIER;

    let denseResults: RankedResult[] = [];
    let sparseResults: RankedResult[] = [];
    let denseTimeMs = 0;
    let sparseTimeMs = 0;

    // Run searches in parallel (unless one is disabled)
    const searches: Promise<void>[] = [];

    if (!opts.sparseOnly) {
      searches.push(
        (async () => {
          const denseStart = Date.now();
          const results = await this.denseSearch(queryEmbedding, candidateLimit, opts);
          denseResults = toRankedResults(results, 'dense');
          denseTimeMs = Date.now() - denseStart;
        })()
      );
    }

    if (!opts.denseOnly && queryText.trim().length > 0) {
      searches.push(
        (async () => {
          const sparseStart = Date.now();
          const results = await this.sparseSearch(queryText, candidateLimit, opts);
          sparseResults = toRankedResults(results, 'sparse');
          sparseTimeMs = Date.now() - sparseStart;
        })()
      );
    }

    await Promise.all(searches);

    // Fuse results
    const fusionStart = Date.now();
    const fusedResults = fuseResults(denseResults, sparseResults, {
      k: opts.rrfK,
      denseWeight: opts.denseWeight,
      sparseWeight: opts.sparseWeight,
      limit: opts.limit,
    });
    const fusionTimeMs = Date.now() - fusionStart;

    // Compute overlap statistics
    const overlap = computeOverlapStats(denseResults, sparseResults);

    const stats: HybridSearchStats = {
      denseCount: denseResults.length,
      sparseCount: sparseResults.length,
      fusedCount: fusedResults.length,
      overlapCount: overlap.overlap,
      denseTimeMs,
      sparseTimeMs,
      fusionTimeMs,
      totalTimeMs: Date.now() - startTime,
    };

    return { results: fusedResults, stats };
  }

  /**
   * Perform dense-only search
   */
  async denseSearch(
    embedding: number[],
    limit: number,
    options: HybridSearchOptions = {}
  ): Promise<SearchResult[]> {
    return this.store.searchByEmbedding(embedding, {
      limit,
      threshold: options.denseThreshold,
      sourceType: options.sourceType,
      hierarchyLevel: options.hierarchyLevel,
      threadRootId: options.threadRootId,
    });
  }

  /**
   * Perform sparse-only search
   */
  async sparseSearch(
    query: string,
    limit: number,
    options: HybridSearchOptions = {}
  ): Promise<SearchResult[]> {
    return this.store.searchByKeyword(query, {
      limit,
      sourceType: options.sourceType,
      hierarchyLevel: options.hierarchyLevel,
      threadRootId: options.threadRootId,
      searchTitle: options.searchTitle,
    });
  }

  /**
   * Quick search with just embedding (useful when text is unavailable)
   */
  async quickDenseSearch(
    embedding: number[],
    limit: number = DEFAULT_LIMIT
  ): Promise<HybridSearchResult> {
    return this.search(embedding, '', { limit, denseOnly: true });
  }

  /**
   * Quick search with just text (useful when embedding is expensive)
   */
  async quickSparseSearch(
    text: string,
    limit: number = DEFAULT_LIMIT
  ): Promise<HybridSearchResult> {
    // Use empty embedding for sparse-only search
    return this.search([], text, { limit, sparseOnly: true });
  }

  // ─────────────────────────────────────────────────────────────────
  // CROSS-LEVEL PYRAMID SEARCH
  // ─────────────────────────────────────────────────────────────────

  /**
   * Search across all hierarchy levels (L0, L1, Apex) with optional expansion
   *
   * This method:
   * 1. Searches all levels in parallel (or specific level if startLevel set)
   * 2. Groups results by hierarchy level
   * 3. Optionally expands L1/Apex results to their child nodes
   */
  async searchPyramid(
    queryEmbedding: number[],
    queryText: string,
    options: CrossLevelSearchOptions = {}
  ): Promise<CrossLevelSearchResult> {
    const startTime = Date.now();
    const { startLevel, expandToChildren = false, maxChildrenPerResult = 5 } = options;

    // Search all levels in parallel (or specific level)
    const searchPromises: Promise<HybridSearchResult>[] = [];
    const levels = startLevel !== undefined ? [startLevel] : [0, 1, 2];

    for (const level of levels) {
      searchPromises.push(
        this.search(queryEmbedding, queryText, {
          ...options,
          hierarchyLevel: level,
        })
      );
    }

    const levelResults = await Promise.all(searchPromises);

    // Map results to pyramid items with hierarchy info
    const allResults: PyramidSearchResultItem[] = [];
    const byLevel = {
      l0: [] as PyramidSearchResultItem[],
      l1: [] as PyramidSearchResultItem[],
      apex: [] as PyramidSearchResultItem[],
    };

    // Combine stats
    let totalDenseCount = 0;
    let totalSparseCount = 0;
    let totalDenseTimeMs = 0;
    let totalSparseTimeMs = 0;

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const result = levelResults[i];

      totalDenseCount += result.stats.denseCount;
      totalSparseCount += result.stats.sparseCount;
      totalDenseTimeMs += result.stats.denseTimeMs;
      totalSparseTimeMs += result.stats.sparseTimeMs;

      for (const fusedResult of result.results) {
        const pyramidItem: PyramidSearchResultItem = {
          ...fusedResult,
          hierarchyLevel: level,
        };

        allResults.push(pyramidItem);

        if (level === 0) byLevel.l0.push(pyramidItem);
        else if (level === 1) byLevel.l1.push(pyramidItem);
        else if (level === 2) byLevel.apex.push(pyramidItem);
      }
    }

    // Sort all results by fused score
    allResults.sort((a, b) => b.fusedScore - a.fusedScore);

    // Expand to children if requested
    let childrenExpandedCount = 0;
    if (expandToChildren) {
      for (const item of allResults) {
        if (item.hierarchyLevel > 0) {
          const children = await this.getChildNodes(
            item.node.id,
            maxChildrenPerResult
          );
          if (children.length > 0) {
            item.children = children;
            childrenExpandedCount += children.length;
          }
        }
      }
    }

    // Count unique threads
    const uniqueThreads = new Set(
      allResults.map((r) => r.node.threadRootId).filter(Boolean)
    ).size;

    const stats: CrossLevelSearchStats = {
      denseCount: totalDenseCount,
      sparseCount: totalSparseCount,
      fusedCount: allResults.length,
      overlapCount: 0, // Would need cross-level overlap tracking
      denseTimeMs: totalDenseTimeMs,
      sparseTimeMs: totalSparseTimeMs,
      fusionTimeMs: 0,
      totalTimeMs: Date.now() - startTime,
      resultsByLevel: {
        l0: byLevel.l0.length,
        l1: byLevel.l1.length,
        apex: byLevel.apex.length,
      },
      childrenExpandedCount,
      uniqueThreads,
    };

    return { results: allResults, byLevel, stats };
  }

  /**
   * Search at apex level and expand to full context
   *
   * Useful for finding relevant documents and then drilling down
   * to specific passages.
   */
  async searchApexWithExpansion(
    queryEmbedding: number[],
    queryText: string,
    options: Omit<CrossLevelSearchOptions, 'startLevel'> = {}
  ): Promise<CrossLevelSearchResult> {
    return this.searchPyramid(queryEmbedding, queryText, {
      ...options,
      startLevel: 2,
      expandToChildren: true,
    });
  }

  /**
   * Search at L1 summary level
   *
   * Good balance between context size and relevance.
   */
  async searchL1(
    queryEmbedding: number[],
    queryText: string,
    options: Omit<CrossLevelSearchOptions, 'startLevel'> = {}
  ): Promise<CrossLevelSearchResult> {
    return this.searchPyramid(queryEmbedding, queryText, {
      ...options,
      startLevel: 1,
    });
  }

  /**
   * Search at L0 base chunk level
   *
   * Most granular search - returns specific passages.
   */
  async searchL0(
    queryEmbedding: number[],
    queryText: string,
    options: Omit<CrossLevelSearchOptions, 'startLevel'> = {}
  ): Promise<CrossLevelSearchResult> {
    return this.searchPyramid(queryEmbedding, queryText, {
      ...options,
      startLevel: 0,
    });
  }

  /**
   * Get child nodes for a parent node (L1 -> L0, Apex -> L1)
   */
  private async getChildNodes(
    parentId: string,
    limit: number
  ): Promise<StoredNode[]> {
    // Query for nodes with this parent
    const result = await this.store.queryNodes({
      parentNodeId: parentId,
      limit,
      orderBy: 'createdAt',
      orderDir: 'asc',
    });
    return result.nodes;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

let _hybridSearchService: HybridSearchService | null = null;

/**
 * Get the hybrid search service singleton
 * Requires content store to be initialized first
 */
export function getHybridSearchService(
  store: PostgresContentStore
): HybridSearchService {
  if (!_hybridSearchService) {
    _hybridSearchService = new HybridSearchService(store);
  }
  return _hybridSearchService;
}

/**
 * Initialize hybrid search service
 */
export function initHybridSearchService(
  store: PostgresContentStore
): HybridSearchService {
  _hybridSearchService = new HybridSearchService(store);
  return _hybridSearchService;
}

/**
 * Reset hybrid search service (for testing)
 */
export function resetHybridSearchService(): void {
  _hybridSearchService = null;
}
