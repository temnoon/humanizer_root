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
import type { SearchResult } from '../storage/types.js';
import type {
  HybridSearchOptions,
  HybridSearchResult,
  HybridSearchStats,
  RankedResult,
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
