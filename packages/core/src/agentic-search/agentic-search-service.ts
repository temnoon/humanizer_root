/**
 * Agentic Search Service
 *
 * Main service class for unified search across archive and books.
 * Provides:
 * - Search operations (stateless and session-based)
 * - Refinement with anchors
 * - Quality gating and enrichment
 * - Navigation (parent context, children, threads)
 *
 * Follows the FIND → REFINE → HARVEST pattern.
 */

import { randomUUID } from 'crypto';
import type { StoredNode } from '../storage/types.js';
import type { SemanticAnchor } from '../retrieval/types.js';
import type {
  AgenticSearchResult,
  AgenticSearchOptions,
  AgenticSearchResponse,
  RefineOptions,
  SearchStats,
  QualityGateOptions,
  ClusterOptions,
  ClusterDiscoveryResult,
  ContentCluster,
  BookNode,
  EmbeddingFunction,
  AgenticSearchServiceOptions,
  ResultProvenance,
  ScoreBreakdown,
  SearchHistoryEntry,
} from './types.js';
import { UnifiedStore } from './unified-store.js';
import { SessionManager, getSessionManager } from './session-manager.js';
import {
  DEFAULT_LIMIT,
  DEFAULT_THRESHOLD,
  DEFAULT_DENSE_WEIGHT,
  DEFAULT_SPARSE_WEIGHT,
  DEFAULT_MIN_WORD_COUNT,
  DEFAULT_POSITIVE_ANCHOR_WEIGHT,
  DEFAULT_NEGATIVE_ANCHOR_WEIGHT,
  NEGATIVE_ANCHOR_THRESHOLD,
  HIERARCHY_LEVEL_MAP,
  TRIVIAL_CONTENT_THRESHOLD,
  RRF_K,
} from './constants.js';

// ═══════════════════════════════════════════════════════════════════
// AGENTIC SEARCH SERVICE
// ═══════════════════════════════════════════════════════════════════

export class AgenticSearchService {
  private unifiedStore: UnifiedStore;
  private embedFn: EmbeddingFunction;
  private sessionManager: SessionManager;
  private options: AgenticSearchServiceOptions;

  constructor(
    unifiedStore: UnifiedStore,
    embedFn: EmbeddingFunction,
    sessionManager?: SessionManager,
    options?: AgenticSearchServiceOptions
  ) {
    this.unifiedStore = unifiedStore;
    this.embedFn = embedFn;
    this.sessionManager = sessionManager ?? getSessionManager();
    this.options = options ?? {};
  }

  // ═══════════════════════════════════════════════════════════════════
  // SEARCH OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Primary search operation (stateless).
   */
  async search(
    query: string,
    options?: AgenticSearchOptions
  ): Promise<AgenticSearchResponse> {
    const startTime = Date.now();
    const opts = this.mergeOptions(options);

    // Generate embedding for query
    const embedding = await this.embedFn(query);

    // Perform search
    const { results, stats } = await this.performSearch(query, embedding, opts);

    return {
      results,
      stats: {
        ...stats,
        totalTimeMs: Date.now() - startTime,
      },
      query,
      options: opts,
      hasMore: results.length >= (opts.limit ?? DEFAULT_LIMIT),
    };
  }

  /**
   * Search and store results in a session.
   */
  async searchInSession(
    sessionId: string,
    query: string,
    options?: AgenticSearchOptions
  ): Promise<AgenticSearchResponse> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Merge session exclusions with options
    const opts = this.mergeOptions({
      ...options,
      excludeIds: [
        ...(options?.excludeIds ?? []),
        ...Array.from(session.excludedIds),
      ],
    });

    const response = await this.search(query, opts);

    // Store results in session
    this.sessionManager.addResults(sessionId, response.results);

    // Add history entry
    const historyEntry: SearchHistoryEntry = {
      id: randomUUID(),
      query,
      options: opts,
      resultCount: response.results.length,
      timestamp: Date.now(),
    };
    this.sessionManager.addHistoryEntry(sessionId, historyEntry);

    return {
      ...response,
      sessionId,
    };
  }

  /**
   * Search within previous results (drill-down).
   */
  async searchWithinResults(
    sessionId: string,
    query: string,
    options?: Omit<AgenticSearchOptions, 'target'>
  ): Promise<AgenticSearchResponse> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const startTime = Date.now();

    // Get current result IDs
    const resultIds = session.results.map(r => r.id);
    if (resultIds.length === 0) {
      return {
        results: [],
        stats: this.emptyStats(),
        query,
        options: options ?? {},
        sessionId,
        hasMore: false,
      };
    }

    // Generate embedding for query
    const embedding = await this.embedFn(query);

    // Re-rank current results by similarity to new query
    const rerankedResults: AgenticSearchResult[] = [];
    const embeddings = await this.unifiedStore.getEmbeddings(resultIds);

    for (const result of session.results) {
      const resultEmbedding = embeddings.get(result.id);
      if (resultEmbedding) {
        const similarity = this.cosineSimilarity(embedding, resultEmbedding);
        rerankedResults.push({
          ...result,
          score: similarity,
          scoreBreakdown: {
            ...result.scoreBreakdown,
            finalScore: similarity,
          },
        });
      }
    }

    // Sort by new scores and apply threshold
    const threshold = options?.threshold ?? DEFAULT_THRESHOLD;
    const limit = options?.limit ?? DEFAULT_LIMIT;

    const filteredResults = rerankedResults
      .filter(r => r.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Update session with refined results
    this.sessionManager.addResults(sessionId, filteredResults);

    // Add history entry
    const historyEntry: SearchHistoryEntry = {
      id: randomUUID(),
      query,
      options: options ?? {},
      resultCount: filteredResults.length,
      timestamp: Date.now(),
      refinement: { query },
    };
    this.sessionManager.addHistoryEntry(sessionId, historyEntry);

    return {
      results: filteredResults,
      stats: {
        ...this.emptyStats(),
        totalCandidates: session.results.length,
        totalTimeMs: Date.now() - startTime,
      },
      query,
      options: options ?? {},
      sessionId,
      hasMore: filteredResults.length >= limit,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // REFINEMENT OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Refine results with criteria.
   */
  async refineResults(
    sessionId: string,
    refineOptions: RefineOptions
  ): Promise<AgenticSearchResponse> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const startTime = Date.now();
    let results = [...session.results];

    // Apply query filter if provided
    if (refineOptions.query) {
      const queryEmbedding = await this.embedFn(refineOptions.query);
      const embeddings = await this.unifiedStore.getEmbeddings(results.map(r => r.id));

      results = results.map(result => {
        const resultEmbedding = embeddings.get(result.id);
        if (resultEmbedding) {
          const similarity = this.cosineSimilarity(queryEmbedding, resultEmbedding);
          return {
            ...result,
            score: similarity,
          };
        }
        return result;
      });
    }

    // Apply positive anchors (like these)
    if (refineOptions.likeThese && refineOptions.likeThese.length > 0) {
      const anchorEmbeddings = await this.unifiedStore.getEmbeddings(refineOptions.likeThese);
      results = this.boostByAnchors(results, Array.from(anchorEmbeddings.values()), 'positive');
    }

    // Apply negative anchors (unlike these)
    if (refineOptions.unlikeThese && refineOptions.unlikeThese.length > 0) {
      const anchorEmbeddings = await this.unifiedStore.getEmbeddings(refineOptions.unlikeThese);
      results = this.filterByAnchors(results, Array.from(anchorEmbeddings.values()));
    }

    // Apply score filter
    if (refineOptions.minScore !== undefined) {
      results = results.filter(r => r.score >= refineOptions.minScore!);
    }

    // Apply word count filter
    if (refineOptions.minWordCount !== undefined) {
      results = results.filter(r => r.wordCount >= refineOptions.minWordCount!);
    }

    // Sort and limit
    results.sort((a, b) => b.score - a.score);
    if (refineOptions.limit !== undefined) {
      results = results.slice(0, refineOptions.limit);
    }

    // Update session
    this.sessionManager.addResults(sessionId, results);

    return {
      results,
      stats: {
        ...this.emptyStats(),
        totalCandidates: session.results.length,
        totalTimeMs: Date.now() - startTime,
      },
      query: refineOptions.query ?? session.metadata.lastQuery ?? '',
      options: {},
      sessionId,
      hasMore: false,
    };
  }

  /**
   * Add a positive anchor (find more like this).
   */
  async addPositiveAnchor(
    sessionId: string,
    resultId: string,
    name?: string
  ): Promise<SemanticAnchor> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Get embedding for the result
    const embedding = await this.unifiedStore.getEmbedding(resultId);
    if (!embedding) {
      throw new Error(`No embedding found for result: ${resultId}`);
    }

    const anchor: SemanticAnchor = {
      id: randomUUID(),
      name: name ?? `Anchor from ${resultId.substring(0, 8)}`,
      embedding,
      createdAt: Date.now(),
    };

    this.sessionManager.addPositiveAnchor(sessionId, anchor);
    return anchor;
  }

  /**
   * Add a negative anchor (exclude similar).
   */
  async addNegativeAnchor(
    sessionId: string,
    resultId: string,
    name?: string
  ): Promise<SemanticAnchor> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Get embedding for the result
    const embedding = await this.unifiedStore.getEmbedding(resultId);
    if (!embedding) {
      throw new Error(`No embedding found for result: ${resultId}`);
    }

    const anchor: SemanticAnchor = {
      id: randomUUID(),
      name: name ?? `Negative anchor from ${resultId.substring(0, 8)}`,
      embedding,
      createdAt: Date.now(),
    };

    this.sessionManager.addNegativeAnchor(sessionId, anchor);
    return anchor;
  }

  /**
   * Apply all session anchors to re-score results.
   */
  async applyAnchors(sessionId: string): Promise<AgenticSearchResponse> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const startTime = Date.now();
    let results = [...session.results];

    // Get embeddings for all results
    const embeddings = await this.unifiedStore.getEmbeddings(results.map(r => r.id));

    // Apply positive anchors
    if (session.positiveAnchors.length > 0) {
      const positiveEmbeddings = session.positiveAnchors.map(a => a.embedding);
      results = this.boostByAnchors(
        results,
        positiveEmbeddings,
        'positive',
        embeddings
      );
    }

    // Apply negative anchors
    if (session.negativeAnchors.length > 0) {
      const negativeEmbeddings = session.negativeAnchors.map(a => a.embedding);
      results = this.filterByAnchors(results, negativeEmbeddings, embeddings);
    }

    // Sort by adjusted scores
    results.sort((a, b) => b.score - a.score);

    // Update session
    this.sessionManager.addResults(sessionId, results);

    return {
      results,
      stats: {
        ...this.emptyStats(),
        totalCandidates: session.results.length,
        filteredByAnchors: session.results.length - results.length,
        totalTimeMs: Date.now() - startTime,
      },
      query: session.metadata.lastQuery ?? '',
      options: {},
      sessionId,
      hasMore: false,
    };
  }

  /**
   * Exclude specific results from a session.
   */
  excludeResults(sessionId: string, resultIds: string[]): void {
    this.sessionManager.excludeResults(sessionId, resultIds);
  }

  // ═══════════════════════════════════════════════════════════════════
  // QUALITY & ENRICHMENT
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Scrub junk from session results.
   */
  async scrubResults(
    sessionId: string,
    options?: QualityGateOptions
  ): Promise<AgenticSearchResponse> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const startTime = Date.now();
    const minWordCount = options?.minWordCount ?? DEFAULT_MIN_WORD_COUNT;
    let filteredCount = 0;

    let results = session.results.filter(result => {
      // Filter by word count
      if (result.wordCount < minWordCount) {
        filteredCount++;
        return false;
      }

      // Scrub trivial content
      if (options?.scrubTrivialContent && result.wordCount < TRIVIAL_CONTENT_THRESHOLD) {
        filteredCount++;
        return false;
      }

      // Scrub system messages
      if (options?.scrubSystemMessages && result.provenance.authorRole === 'system') {
        filteredCount++;
        return false;
      }

      // Filter by quality score
      if (options?.minQualityScore !== undefined) {
        const qualityPassed = result.quality.passedGate;
        if (!qualityPassed) {
          filteredCount++;
          return false;
        }
      }

      // Filter by author role
      if (options?.authorRole && result.provenance.authorRole !== options.authorRole) {
        filteredCount++;
        return false;
      }

      return true;
    });

    // Update session
    this.sessionManager.addResults(sessionId, results);

    return {
      results,
      stats: {
        ...this.emptyStats(),
        totalCandidates: session.results.length,
        filteredByQuality: filteredCount,
        totalTimeMs: Date.now() - startTime,
      },
      query: session.metadata.lastQuery ?? '',
      options: {},
      sessionId,
      hasMore: false,
    };
  }

  /**
   * Discover clusters in session results.
   */
  async discoverClusters(
    sessionId: string,
    options?: ClusterOptions
  ): Promise<ClusterDiscoveryResult> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Get embeddings for all results
    const embeddings = await this.unifiedStore.getEmbeddings(
      session.results.map(r => r.id)
    );

    // Simple k-means-like clustering (for now)
    // TODO: Integrate with ClusteringService from retrieval
    const maxClusters = options?.maxClusters ?? 5;
    const minClusterSize = options?.minClusterSize ?? 2;

    // Placeholder implementation - returns results grouped by hierarchy level
    const clusters: ContentCluster[] = [];
    const byLevel = new Map<number, AgenticSearchResult[]>();

    for (const result of session.results) {
      const level = result.hierarchyLevel;
      if (!byLevel.has(level)) {
        byLevel.set(level, []);
      }
      byLevel.get(level)!.push(result);
    }

    let clusterId = 0;
    for (const [level, members] of byLevel) {
      if (members.length >= minClusterSize) {
        // Compute centroid
        const memberEmbeddings = members
          .map(m => embeddings.get(m.id))
          .filter((e): e is number[] => e !== undefined);

        const centroid = memberEmbeddings.length > 0
          ? this.computeCentroid(memberEmbeddings)
          : [];

        clusters.push({
          id: `cluster-${clusterId++}`,
          label: `Level ${level} content`,
          centroid,
          members,
          cohesion: 0.8, // Placeholder
          representative: members[0],
        });
      }
    }

    return {
      clusters: clusters.slice(0, maxClusters),
      noise: [],
      stats: {
        totalPoints: session.results.length,
        clusterCount: clusters.length,
        noiseCount: 0,
        silhouetteScore: 0.7, // Placeholder
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // NAVIGATION
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get parent context for a result.
   */
  async getParentContext(resultId: string): Promise<AgenticSearchResult | null> {
    const node = await this.unifiedStore.getNode(resultId);
    if (!node) {
      return null;
    }

    // Check for parent node
    const parentId = 'parentNodeId' in node ? node.parentNodeId : undefined;
    if (!parentId) {
      return null;
    }

    const parentNode = await this.unifiedStore.getNode(parentId);
    if (!parentNode) {
      return null;
    }

    return this.nodeToResult(parentNode, 1.0, await this.unifiedStore.getNodeSource(parentId) ?? 'archive');
  }

  /**
   * Get children (sub-chunks) for a result.
   */
  async getChildren(resultId: string): Promise<AgenticSearchResult[]> {
    const source = await this.unifiedStore.getNodeSource(resultId);
    if (!source) {
      return [];
    }

    // Query nodes with this as parent
    const queryResult = await this.unifiedStore.queryNodes({
      target: source,
      limit: 100,
    });

    const children: AgenticSearchResult[] = [];
    const allNodes = [...queryResult.archiveNodes, ...queryResult.bookNodes];

    for (const node of allNodes) {
      const parentId = 'parentNodeId' in node ? node.parentNodeId : undefined;
      if (parentId === resultId) {
        children.push(this.nodeToResult(node, 1.0, source));
      }
    }

    return children;
  }

  /**
   * Get full thread for a result.
   */
  async getThread(resultId: string): Promise<AgenticSearchResult[]> {
    const node = await this.unifiedStore.getNode(resultId);
    if (!node) {
      return [];
    }

    // Get thread root
    const threadRootId = 'threadRootId' in node ? node.threadRootId : undefined;
    if (!threadRootId) {
      return [this.nodeToResult(node, 1.0, 'archive')];
    }

    // Query all nodes in thread
    const queryResult = await this.unifiedStore.queryNodes({
      target: 'archive',
      limit: 1000,
    });

    const threadNodes: AgenticSearchResult[] = [];
    for (const n of queryResult.archiveNodes) {
      if (n.threadRootId === threadRootId) {
        threadNodes.push(this.nodeToResult(n, 1.0, 'archive'));
      }
    }

    // Sort by position or creation time
    threadNodes.sort((a, b) => {
      return (a.provenance.sourceCreatedAt ?? 0) - (b.provenance.sourceCreatedAt ?? 0);
    });

    return threadNodes;
  }

  /**
   * Get apex (top-level summary) for a result.
   */
  async getApex(resultId: string): Promise<AgenticSearchResult | null> {
    let currentId = resultId;
    let current = await this.unifiedStore.getNode(currentId);

    if (!current) {
      return null;
    }

    // Walk up the hierarchy
    while (current) {
      const parentId = 'parentNodeId' in current ? current.parentNodeId : undefined;
      if (!parentId) {
        break;
      }

      const parent = await this.unifiedStore.getNode(parentId);
      if (!parent) {
        break;
      }

      current = parent;
      currentId = parentId;
    }

    const source = await this.unifiedStore.getNodeSource(currentId);
    return this.nodeToResult(current, 1.0, source ?? 'archive');
  }

  // ═══════════════════════════════════════════════════════════════════
  // INTERNAL HELPERS
  // ═══════════════════════════════════════════════════════════════════

  private mergeOptions(options?: AgenticSearchOptions): AgenticSearchOptions {
    return {
      target: options?.target ?? 'all',
      limit: options?.limit ?? DEFAULT_LIMIT,
      threshold: options?.threshold ?? DEFAULT_THRESHOLD,
      hierarchyLevel: options?.hierarchyLevel ?? 'all',
      mode: options?.mode ?? 'hybrid',
      denseWeight: options?.denseWeight ?? DEFAULT_DENSE_WEIGHT,
      sparseWeight: options?.sparseWeight ?? DEFAULT_SPARSE_WEIGHT,
      reranker: options?.reranker ?? 'identity',
      ...options,
    };
  }

  private async performSearch(
    query: string,
    embedding: number[],
    options: AgenticSearchOptions
  ): Promise<{ results: AgenticSearchResult[]; stats: SearchStats }> {
    const stats: SearchStats = {
      totalCandidates: 0,
      archiveCount: 0,
      booksCount: 0,
      filteredByQuality: 0,
      filteredByAnchors: 0,
      excludedManually: 0,
      denseTimeMs: 0,
      sparseTimeMs: 0,
      fusionTimeMs: 0,
      qualityTimeMs: 0,
      totalTimeMs: 0,
    };

    // Convert hierarchy filter to numeric
    const hierarchyLevel = options.hierarchyLevel === 'all'
      ? undefined
      : HIERARCHY_LEVEL_MAP[options.hierarchyLevel!];

    const searchOpts = {
      target: options.target ?? 'all' as const,
      limit: (options.limit ?? DEFAULT_LIMIT) * 2, // Over-fetch for filtering
      threshold: options.threshold,
      hierarchyLevel,
      sourceType: options.sourceTypes,
      bookId: options.bookId,
    };

    // Perform dense search
    const denseStart = Date.now();
    const denseResults = options.mode !== 'sparse'
      ? await this.unifiedStore.searchByEmbedding(embedding, searchOpts)
      : [];
    stats.denseTimeMs = Date.now() - denseStart;

    // Perform sparse search
    const sparseStart = Date.now();
    const sparseResults = options.mode !== 'dense'
      ? await this.unifiedStore.searchByKeyword(query, searchOpts)
      : [];
    stats.sparseTimeMs = Date.now() - sparseStart;

    // Fuse results using RRF
    const fusionStart = Date.now();
    const fusedResults = this.fuseResults(
      denseResults,
      sparseResults,
      options.denseWeight ?? DEFAULT_DENSE_WEIGHT,
      options.sparseWeight ?? DEFAULT_SPARSE_WEIGHT
    );
    stats.fusionTimeMs = Date.now() - fusionStart;

    stats.totalCandidates = fusedResults.length;

    // Convert to AgenticSearchResult
    const results: AgenticSearchResult[] = [];
    for (const fused of fusedResults) {
      // Apply exclusions
      if (options.excludeIds?.includes(fused.id)) {
        stats.excludedManually++;
        continue;
      }

      const result = this.nodeToResult(fused.node, fused.score, fused.source as 'archive' | 'books', {
        denseScore: fused.denseScore,
        sparseScore: fused.sparseScore,
        denseRank: fused.denseRank,
        sparseRank: fused.sparseRank,
      });

      // Track source counts
      if (fused.source === 'archive') {
        stats.archiveCount++;
      } else {
        stats.booksCount++;
      }

      results.push(result);
    }

    // Apply limit
    const limited = results.slice(0, options.limit ?? DEFAULT_LIMIT);

    return { results: limited, stats };
  }

  private fuseResults(
    denseResults: Array<{ id: string; source: string; node: StoredNode | BookNode; score: number }>,
    sparseResults: Array<{ id: string; source: string; node: StoredNode | BookNode; score: number }>,
    denseWeight: number,
    sparseWeight: number
  ): Array<{
    id: string;
    source: string;
    node: StoredNode | BookNode;
    score: number;
    denseScore?: number;
    sparseScore?: number;
    denseRank?: number;
    sparseRank?: number;
  }> {
    const resultMap = new Map<string, {
      id: string;
      source: string;
      node: StoredNode | BookNode;
      denseScore?: number;
      sparseScore?: number;
      denseRank?: number;
      sparseRank?: number;
    }>();

    // Add dense results
    denseResults.forEach((result, index) => {
      resultMap.set(result.id, {
        id: result.id,
        source: result.source,
        node: result.node,
        denseScore: result.score,
        denseRank: index + 1,
      });
    });

    // Merge sparse results
    sparseResults.forEach((result, index) => {
      const existing = resultMap.get(result.id);
      if (existing) {
        existing.sparseScore = result.score;
        existing.sparseRank = index + 1;
      } else {
        resultMap.set(result.id, {
          id: result.id,
          source: result.source,
          node: result.node,
          sparseScore: result.score,
          sparseRank: index + 1,
        });
      }
    });

    // Compute RRF scores
    const fused: Array<{
      id: string;
      source: string;
      node: StoredNode | BookNode;
      score: number;
      denseScore?: number;
      sparseScore?: number;
      denseRank?: number;
      sparseRank?: number;
    }> = [];

    for (const result of resultMap.values()) {
      let rrfScore = 0;

      if (result.denseRank !== undefined) {
        rrfScore += denseWeight / (RRF_K + result.denseRank);
      }

      if (result.sparseRank !== undefined) {
        rrfScore += sparseWeight / (RRF_K + result.sparseRank);
      }

      fused.push({
        ...result,
        score: rrfScore,
      });
    }

    // Sort by fused score
    fused.sort((a, b) => b.score - a.score);

    return fused;
  }

  private nodeToResult(
    node: StoredNode | BookNode,
    score: number,
    source: 'archive' | 'books',
    scoreInfo?: {
      denseScore?: number;
      sparseScore?: number;
      denseRank?: number;
      sparseRank?: number;
    }
  ): AgenticSearchResult {
    const isArchive = source === 'archive';
    const storedNode = isArchive ? (node as StoredNode) : undefined;
    const bookNode = !isArchive ? (node as BookNode) : undefined;

    const provenance: ResultProvenance = {
      sourceStore: source,
      sourceType: storedNode?.sourceType ?? 'book',
      sourceOriginalId: storedNode?.sourceOriginalId,
      threadRootId: storedNode?.threadRootId,
      threadTitle: storedNode?.title,
      parentNodeId: storedNode?.parentNodeId ?? bookNode?.parentNodeId,
      bookContext: bookNode
        ? {
            bookId: bookNode.bookId,
            chapterId: bookNode.chapterId,
          }
        : undefined,
      sourceCreatedAt: storedNode?.sourceCreatedAt ?? (bookNode?.createdAt ? bookNode.createdAt.getTime() : undefined),
      author: storedNode?.author,
      authorRole: storedNode?.authorRole,
      uri: storedNode?.uri ?? `book://${bookNode?.bookId}/${bookNode?.id}`,
    };

    const scoreBreakdown: ScoreBreakdown = {
      denseScore: scoreInfo?.denseScore,
      denseRank: scoreInfo?.denseRank,
      sparseScore: scoreInfo?.sparseScore,
      sparseRank: scoreInfo?.sparseRank,
      fusedScore: score,
      finalScore: score,
    };

    return {
      id: node.id,
      source,
      text: node.text,
      wordCount: node.wordCount,
      hierarchyLevel: node.hierarchyLevel,
      score,
      scoreBreakdown,
      provenance,
      quality: {
        hasMinWords: node.wordCount >= DEFAULT_MIN_WORD_COUNT,
        hasMinQuality: true,
        isComplete: true,
        passedGate: node.wordCount >= DEFAULT_MIN_WORD_COUNT,
      },
      title: storedNode?.title,
      tags: storedNode?.tags,
    };
  }

  private boostByAnchors(
    results: AgenticSearchResult[],
    anchorEmbeddings: number[][],
    type: 'positive',
    existingEmbeddings?: Map<string, number[]>
  ): AgenticSearchResult[] {
    return results.map(result => {
      let maxSimilarity = 0;
      const embedding = existingEmbeddings?.get(result.id) ?? result.embedding;

      if (embedding) {
        for (const anchor of anchorEmbeddings) {
          const similarity = this.cosineSimilarity(embedding, anchor);
          maxSimilarity = Math.max(maxSimilarity, similarity);
        }
      }

      const boost = maxSimilarity * DEFAULT_POSITIVE_ANCHOR_WEIGHT;
      return {
        ...result,
        score: result.score + boost,
        scoreBreakdown: {
          ...result.scoreBreakdown,
          anchorBoost: boost,
          finalScore: result.score + boost,
        },
      };
    });
  }

  private filterByAnchors(
    results: AgenticSearchResult[],
    anchorEmbeddings: number[][],
    existingEmbeddings?: Map<string, number[]>
  ): AgenticSearchResult[] {
    return results.filter(result => {
      const embedding = existingEmbeddings?.get(result.id) ?? result.embedding;

      if (!embedding) {
        return true; // Keep results without embeddings
      }

      for (const anchor of anchorEmbeddings) {
        const similarity = this.cosineSimilarity(embedding, anchor);
        if (similarity > NEGATIVE_ANCHOR_THRESHOLD) {
          return false; // Filter out similar results
        }
      }

      return true;
    });
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private computeCentroid(embeddings: number[][]): number[] {
    if (embeddings.length === 0) {
      return [];
    }

    const dim = embeddings[0].length;
    const centroid = new Array(dim).fill(0);

    for (const embedding of embeddings) {
      for (let i = 0; i < dim; i++) {
        centroid[i] += embedding[i];
      }
    }

    for (let i = 0; i < dim; i++) {
      centroid[i] /= embeddings.length;
    }

    return centroid;
  }

  private emptyStats(): SearchStats {
    return {
      totalCandidates: 0,
      archiveCount: 0,
      booksCount: 0,
      filteredByQuality: 0,
      filteredByAnchors: 0,
      excludedManually: 0,
      denseTimeMs: 0,
      sparseTimeMs: 0,
      fusionTimeMs: 0,
      qualityTimeMs: 0,
      totalTimeMs: 0,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Create an AgenticSearchService with the given stores and embedding function.
 */
export function createAgenticSearchService(
  unifiedStore: UnifiedStore,
  embedFn: EmbeddingFunction,
  options?: AgenticSearchServiceOptions
): AgenticSearchService {
  return new AgenticSearchService(unifiedStore, embedFn, undefined, options);
}
