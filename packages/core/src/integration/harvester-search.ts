/**
 * Harvester Search Integration
 *
 * Wires the Harvester agent to use the hybrid search pipeline.
 * This integration layer connects:
 * - HybridSearchService (dense + sparse search)
 * - QualityGatedPipeline (filtering and context expansion)
 * - ClusteringService (for discovery operations)
 *
 * Usage:
 * ```typescript
 * import { createHarvesterSearchAdapter, HarvesterSearchAdapter } from '@humanizer/core';
 *
 * const adapter = createHarvesterSearchAdapter(store, embedder);
 * const results = await adapter.search('my query', { limit: 10 });
 * ```
 */

import type { PostgresContentStore } from '../storage/postgres-content-store.js';
import type { StoredNode } from '../storage/types.js';
import { HybridSearchService } from '../retrieval/hybrid-search.js';
import { QualityGatedPipeline } from '../retrieval/quality-gate.js';
import { ClusteringService } from '../clustering/clustering-service.js';
import type { ClusterPoint, ClusteringResult } from '../clustering/types.js';
import type { FusedResult, QualityGatedResult } from '../retrieval/types.js';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Embedder function signature
 */
export type EmbedderFn = (text: string) => Promise<number[]>;

/**
 * Search options for harvester
 */
export interface HarvesterSearchOptions {
  /** Maximum results to return */
  limit?: number;

  /** Minimum similarity threshold (0-1) */
  minSimilarity?: number;

  /** Thread ID for context */
  threadRootId?: string;

  /** IDs to exclude from results */
  excludeIds?: string[];

  /** Whether to apply quality gate filtering */
  applyQualityGate?: boolean;

  /** Whether to expand context for short results */
  expandContext?: boolean;
}

/**
 * Search result from harvester adapter
 */
export interface HarvesterSearchResult {
  id: string;
  text: string;
  similarity: number;
  conversationId?: string;
  messageId?: string;
  timestamp?: number;
  wordCount: number;
  hierarchyLevel: number;
}

/**
 * Discovery options
 */
export interface DiscoveryOptions {
  /** Seed texts to find connections from */
  seedTexts: string[];

  /** Minimum cluster size */
  minClusterSize?: number;

  /** Similarity threshold for clustering */
  similarityThreshold?: number;
}

/**
 * Discovery result
 */
export interface DiscoveredCluster {
  theme: string;
  nodes: HarvesterSearchResult[];
  centroid?: number[];
  avgSimilarity: number;
}

// ═══════════════════════════════════════════════════════════════════
// HARVESTER SEARCH ADAPTER
// ═══════════════════════════════════════════════════════════════════

/**
 * Adapter that integrates search infrastructure with Harvester agent
 */
export class HarvesterSearchAdapter {
  private readonly store: PostgresContentStore;
  private readonly embedder: EmbedderFn;
  private readonly hybridSearch: HybridSearchService;
  private readonly qualityGate: QualityGatedPipeline;
  private readonly clustering: ClusteringService;

  constructor(store: PostgresContentStore, embedder: EmbedderFn) {
    this.store = store;
    this.embedder = embedder;
    this.hybridSearch = new HybridSearchService(store);
    this.qualityGate = new QualityGatedPipeline(store);
    this.clustering = new ClusteringService();
  }

  /**
   * Search for relevant content
   */
  async search(
    query: string,
    options: HarvesterSearchOptions = {}
  ): Promise<HarvesterSearchResult[]> {
    const {
      limit = 20,
      minSimilarity = 0.5,
      threadRootId,
      excludeIds = [],
      applyQualityGate = true,
      expandContext = true,
    } = options;

    // Embed the query
    const embedding = await this.embedder(query);

    // Run hybrid search
    const searchResult = await this.hybridSearch.search(embedding, query, {
      limit: limit * 2, // Fetch more for filtering
      denseThreshold: minSimilarity,
      threadRootId,
    });

    let results = searchResult.results;

    // Filter excluded IDs
    if (excludeIds.length > 0) {
      const excludeSet = new Set(excludeIds);
      results = results.filter((r) => !excludeSet.has(r.node.id));
    }

    // Apply quality gate
    if (applyQualityGate) {
      const gated = await this.qualityGate.process(results);
      // EnrichedResult extends FusedResult, so we can use it directly
      results = gated.results as FusedResult[];
    }

    // Transform to harvester format
    const transformed = results
      .slice(0, limit)
      .map((r) => this.toHarvesterResult(r));

    return transformed;
  }

  /**
   * Find similar content to a given passage
   */
  async findSimilar(
    text: string,
    options: Omit<HarvesterSearchOptions, 'applyQualityGate'> = {}
  ): Promise<HarvesterSearchResult[]> {
    return this.search(text, {
      ...options,
      applyQualityGate: false, // Don't filter for similarity search
    });
  }

  /**
   * Discover semantic clusters from seed texts
   */
  async discoverConnections(
    options: DiscoveryOptions
  ): Promise<DiscoveredCluster[]> {
    const {
      seedTexts,
      minClusterSize = 3,
      similarityThreshold = 0.55,
    } = options;

    // Search for each seed
    const allResults: HarvesterSearchResult[] = [];
    const seenIds = new Set<string>();

    for (const seed of seedTexts) {
      const results = await this.search(seed, {
        limit: 20,
        minSimilarity: similarityThreshold * 0.7, // Lower threshold for discovery
        applyQualityGate: false,
      });

      for (const r of results) {
        if (!seenIds.has(r.id)) {
          seenIds.add(r.id);
          allResults.push(r);
        }
      }
    }

    if (allResults.length < minClusterSize) {
      return [];
    }

    // Get embeddings for clustering
    const embeddings = await Promise.all(
      allResults.map((r) => this.embedder(r.text))
    );

    // Convert to cluster points
    const points: ClusterPoint[] = allResults.map((r, i) => ({
      id: r.id,
      embedding: embeddings[i],
      text: r.text,
      wordCount: r.wordCount,
    }));

    // Cluster
    const clusterResult = this.clustering.cluster(points);

    // Convert to discovered clusters
    return this.toDiscoveredClusters(clusterResult, allResults);
  }

  /**
   * Get content store for direct access
   */
  getStore(): PostgresContentStore {
    return this.store;
  }

  // ─────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────

  private toHarvesterResult(result: FusedResult): HarvesterSearchResult {
    const node = result.node;
    return {
      id: node.id,
      text: node.text,
      similarity: result.fusedScore,
      conversationId: node.threadRootId ?? undefined,
      messageId: node.sourceOriginalId ?? undefined,
      timestamp: node.createdAt,
      wordCount: node.wordCount,
      hierarchyLevel: node.hierarchyLevel,
    };
  }

  private toDiscoveredClusters(
    result: ClusteringResult,
    originalResults: HarvesterSearchResult[]
  ): DiscoveredCluster[] {
    const resultMap = new Map(originalResults.map((r) => [r.id, r]));

    return result.clusters.map((cluster, idx) => {
      const nodes = cluster.pointIds
        .map((id) => resultMap.get(id))
        .filter((n): n is HarvesterSearchResult => n !== undefined);

      return {
        theme: cluster.label || `Cluster ${idx + 1}`,
        nodes,
        centroid: cluster.centroid,
        avgSimilarity: cluster.stats.avgInternalSimilarity,
      };
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a new harvester search adapter
 */
export function createHarvesterSearchAdapter(
  store: PostgresContentStore,
  embedder: EmbedderFn
): HarvesterSearchAdapter {
  return new HarvesterSearchAdapter(store, embedder);
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

let _harvesterAdapter: HarvesterSearchAdapter | null = null;

/**
 * Get the global harvester search adapter
 */
export function getHarvesterSearchAdapter(): HarvesterSearchAdapter | null {
  return _harvesterAdapter;
}

/**
 * Initialize the global harvester search adapter
 */
export function initHarvesterSearchAdapter(
  store: PostgresContentStore,
  embedder: EmbedderFn
): HarvesterSearchAdapter {
  _harvesterAdapter = new HarvesterSearchAdapter(store, embedder);
  return _harvesterAdapter;
}

/**
 * Reset harvester search adapter (for testing)
 */
export function resetHarvesterSearchAdapter(): void {
  _harvesterAdapter = null;
}
