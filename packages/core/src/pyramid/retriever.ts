/**
 * Pyramid Retriever
 *
 * Implements coarse-to-fine retrieval over pyramid structures:
 *
 * 1. Search apex nodes for document-level matching
 * 2. Expand to L1 summaries on match
 * 3. Drill down to L0 chunks for fine-grained results
 *
 * This approach is efficient for large document collections
 * because it quickly narrows the search space.
 */

import type { PostgresContentStore } from '../storage/postgres-content-store.js';
import type { StoredNode, EmbeddingSearchOptions } from '../storage/types.js';
import type {
  PyramidLevel,
  PyramidNode,
  PyramidSearchOptions,
  PyramidSearchResult,
  PyramidSearchResponse,
  Pyramid,
  PyramidStats,
  ApexNode,
} from './types.js';
import { cosineSimilarity } from '../retrieval/negative-filter.js';

// ═══════════════════════════════════════════════════════════════════
// PYRAMID RETRIEVER
// ═══════════════════════════════════════════════════════════════════

/**
 * Default search options
 */
const DEFAULT_SEARCH_OPTIONS: Required<PyramidSearchOptions> = {
  startLevel: 2,
  maxL0Results: 10,
  minSimilarity: 0.5,
  expandOnMatch: true,
  threadRootId: '',
};

/**
 * Pyramid retriever for coarse-to-fine search
 */
export class PyramidRetriever {
  private readonly store: PostgresContentStore;

  constructor(store: PostgresContentStore) {
    this.store = store;
  }

  /**
   * Search pyramid with coarse-to-fine strategy
   */
  async search(
    queryEmbedding: number[],
    options: PyramidSearchOptions = {}
  ): Promise<PyramidSearchResponse> {
    const startTime = Date.now();
    const opts = { ...DEFAULT_SEARCH_OPTIONS, ...options };

    const results: PyramidSearchResult[] = [];
    const matchesByLevel: Record<PyramidLevel, number> = { 0: 0, 1: 0, 2: 0 };
    let nodesSearched = 0;

    // Step 1: Search apex level (hierarchy_level = 2)
    if (opts.startLevel >= 2) {
      const apexResults = await this.searchLevel(queryEmbedding, 2, opts);
      nodesSearched += apexResults.nodesSearched;

      for (const result of apexResults.matches) {
        matchesByLevel[2]++;

        if (opts.expandOnMatch) {
          // Expand to L1 children
          const l1Results = await this.expandToChildren(
            result.node,
            queryEmbedding,
            opts
          );
          nodesSearched += l1Results.length;

          for (const l1Result of l1Results) {
            matchesByLevel[1]++;

            // Expand to L0 children
            const l0Results = await this.expandToChildren(
              l1Result.node,
              queryEmbedding,
              opts
            );
            nodesSearched += l0Results.length;

            for (const l0Result of l0Results) {
              matchesByLevel[0]++;
              results.push({
                ...l0Result,
                ancestorPath: [result.node.id, l1Result.node.id, l0Result.node.id],
              });
            }
          }
        }

        results.push(result);
      }
    }

    // Step 2: If not enough results, search L1 directly
    if (results.length < opts.maxL0Results && opts.startLevel >= 1) {
      const l1Results = await this.searchLevel(queryEmbedding, 1, opts);
      nodesSearched += l1Results.nodesSearched;

      for (const result of l1Results.matches) {
        if (!results.some((r) => r.node.id === result.node.id)) {
          matchesByLevel[1]++;

          if (opts.expandOnMatch) {
            // Expand to L0 children
            const l0Results = await this.expandToChildren(
              result.node,
              queryEmbedding,
              opts
            );
            nodesSearched += l0Results.length;

            for (const l0Result of l0Results) {
              matchesByLevel[0]++;
              results.push({
                ...l0Result,
                ancestorPath: [result.node.id, l0Result.node.id],
              });
            }
          }

          results.push(result);
        }
      }
    }

    // Step 3: If still not enough, search L0 directly
    if (results.length < opts.maxL0Results) {
      const l0Results = await this.searchLevel(queryEmbedding, 0, opts);
      nodesSearched += l0Results.nodesSearched;

      for (const result of l0Results.matches) {
        if (!results.some((r) => r.node.id === result.node.id)) {
          matchesByLevel[0]++;
          results.push(result);
        }
      }
    }

    // Sort by score and limit
    results.sort((a, b) => b.score - a.score);
    const limitedResults = results.slice(0, opts.maxL0Results);

    // Group by thread
    const byThread = new Map<string, PyramidSearchResult[]>();
    for (const result of limitedResults) {
      const threadId = result.node.threadRootId;
      if (!byThread.has(threadId)) {
        byThread.set(threadId, []);
      }
      byThread.get(threadId)!.push(result);
    }

    return {
      results: limitedResults,
      byThread,
      stats: {
        nodesSearched,
        matchesByLevel,
        searchTimeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Get complete pyramid for a thread
   */
  async getPyramid(threadRootId: string): Promise<Pyramid | null> {
    const l0Query = await this.store.queryNodes({
      threadRootId,
      hierarchyLevel: 0,
      orderBy: 'sourceCreatedAt',
      orderDir: 'asc',
    });

    if (l0Query.nodes.length === 0) {
      return null;
    }

    const l1Query = await this.store.queryNodes({
      threadRootId,
      hierarchyLevel: 1,
      orderBy: 'sourceCreatedAt',
      orderDir: 'asc',
    });

    const apexQuery = await this.store.queryNodes({
      threadRootId,
      hierarchyLevel: 2,
      limit: 1,
    });

    const l0Nodes = l0Query.nodes.map((n) => this.storedToPyramidNode(n, 0));
    const l1Nodes = l1Query.nodes.map((n) => this.storedToPyramidNode(n, 1));
    const apex = apexQuery.nodes[0]
      ? this.storedToApexNode(apexQuery.nodes[0])
      : undefined;

    // Compute stats
    const stats = this.computeStats(l0Nodes, l1Nodes, apex);

    return {
      threadRootId,
      l0Nodes,
      l1Nodes,
      apex,
      stats,
    };
  }

  /**
   * Get pyramid levels for a thread
   */
  async getPyramidLevels(threadRootId: string): Promise<{
    l0: StoredNode[];
    l1: StoredNode[];
    apex: StoredNode | undefined;
  }> {
    const [l0Query, l1Query, apexQuery] = await Promise.all([
      this.store.queryNodes({
        threadRootId,
        hierarchyLevel: 0,
        orderBy: 'sourceCreatedAt',
        orderDir: 'asc',
      }),
      this.store.queryNodes({
        threadRootId,
        hierarchyLevel: 1,
        orderBy: 'sourceCreatedAt',
        orderDir: 'asc',
      }),
      this.store.queryNodes({
        threadRootId,
        hierarchyLevel: 2,
        limit: 1,
      }),
    ]);

    return {
      l0: l0Query.nodes,
      l1: l1Query.nodes,
      apex: apexQuery.nodes[0],
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // PRIVATE METHODS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Search a specific hierarchy level
   */
  private async searchLevel(
    queryEmbedding: number[],
    level: PyramidLevel,
    opts: Required<PyramidSearchOptions>
  ): Promise<{ matches: PyramidSearchResult[]; nodesSearched: number }> {
    const searchOpts: EmbeddingSearchOptions = {
      limit: opts.maxL0Results * 2,
      threshold: opts.minSimilarity,
      hierarchyLevel: level,
    };

    if (opts.threadRootId) {
      searchOpts.threadRootId = opts.threadRootId;
    }

    const results = await this.store.searchByEmbedding(queryEmbedding, searchOpts);

    const matches: PyramidSearchResult[] = results.map((r) => ({
      node: this.storedToPyramidNode(r.node, level),
      score: r.score,
      matchLevel: level,
      ancestorPath: [r.node.id],
    }));

    return {
      matches,
      nodesSearched: results.length,
    };
  }

  /**
   * Expand to children of a matched node
   */
  private async expandToChildren(
    parentNode: PyramidNode,
    queryEmbedding: number[],
    opts: Required<PyramidSearchOptions>
  ): Promise<PyramidSearchResult[]> {
    // Query children
    const childQuery = await this.store.queryNodes({
      parentNodeId: parentNode.id,
      orderBy: 'sourceCreatedAt',
      orderDir: 'asc',
    });

    if (childQuery.nodes.length === 0) {
      return [];
    }

    // Score each child by similarity
    const results: PyramidSearchResult[] = [];

    for (const child of childQuery.nodes) {
      const childLevel = (parentNode.level - 1) as PyramidLevel;
      const embedding = await this.store.getEmbedding(child.id);

      let score = opts.minSimilarity;
      if (embedding) {
        score = cosineSimilarity(queryEmbedding, embedding);
      }

      if (score >= opts.minSimilarity) {
        results.push({
          node: this.storedToPyramidNode(child, childLevel),
          score,
          matchLevel: childLevel,
          ancestorPath: [parentNode.id, child.id],
        });
      }
    }

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * Convert StoredNode to PyramidNode
   */
  private storedToPyramidNode(node: StoredNode, level: PyramidLevel): PyramidNode {
    return {
      id: node.id,
      level,
      text: node.text,
      wordCount: node.wordCount,
      childIds: [], // Would need to query for this
      parentId: node.parentNodeId,
      threadRootId: node.threadRootId ?? node.id,
      position: node.position ?? 0,
      sourceChunk: node.chunkIndex !== undefined
        ? {
            index: node.chunkIndex,
            startOffset: node.chunkStartOffset ?? 0,
            endOffset: node.chunkEndOffset ?? 0,
          }
        : undefined,
    };
  }

  /**
   * Convert StoredNode to ApexNode
   */
  private storedToApexNode(node: StoredNode): ApexNode {
    const metadata = node.sourceMetadata as Record<string, unknown> | undefined;

    return {
      id: node.id,
      level: 2,
      text: node.text,
      wordCount: node.wordCount,
      childIds: [],
      threadRootId: node.threadRootId ?? node.id,
      position: 0,
      themes: (metadata?.themes as string[]) ?? [],
      entities: (metadata?.entities as string[]) ?? [],
      totalSourceWords: (metadata?.totalSourceWords as number) ?? 0,
      compressionRatio: (metadata?.compressionRatio as number) ?? 0,
      generatedAt: node.createdAt,
    };
  }

  /**
   * Compute pyramid statistics
   */
  private computeStats(
    l0Nodes: PyramidNode[],
    l1Nodes: PyramidNode[],
    apex?: PyramidNode
  ): PyramidStats {
    const l0Words = l0Nodes.reduce((sum, n) => sum + n.wordCount, 0);
    const l1Words = l1Nodes.reduce((sum, n) => sum + n.wordCount, 0);
    const apexWords = apex?.wordCount ?? 0;

    const l0ToL1 = l1Words > 0 ? l0Words / l1Words : 0;
    const l1ToApex = apexWords > 0 ? l1Words / apexWords : 0;
    const overall = apexWords > 0 ? l0Words / apexWords : 0;

    const allNodes = [...l0Nodes, ...l1Nodes, ...(apex ? [apex] : [])];
    const withEmbeddings = allNodes.filter((n) => n.embedding !== undefined).length;

    return {
      nodeCounts: {
        0: l0Nodes.length,
        1: l1Nodes.length,
        2: apex ? 1 : 0,
      },
      totalNodes: allNodes.length,
      wordCounts: {
        0: l0Words,
        1: l1Words,
        2: apexWords,
      },
      totalSourceWords: l0Words,
      compressionRatios: {
        l0ToL1,
        l1ToApex,
        overall,
      },
      embeddingCoverage: allNodes.length > 0 ? withEmbeddings / allNodes.length : 0,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

let _pyramidRetriever: PyramidRetriever | null = null;

/**
 * Get the pyramid retriever singleton
 */
export function getPyramidRetriever(store: PostgresContentStore): PyramidRetriever {
  if (!_pyramidRetriever) {
    _pyramidRetriever = new PyramidRetriever(store);
  }
  return _pyramidRetriever;
}

/**
 * Initialize pyramid retriever
 */
export function initPyramidRetriever(store: PostgresContentStore): PyramidRetriever {
  _pyramidRetriever = new PyramidRetriever(store);
  return _pyramidRetriever;
}

/**
 * Reset pyramid retriever (for testing)
 */
export function resetPyramidRetriever(): void {
  _pyramidRetriever = null;
}
