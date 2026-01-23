/**
 * Pyramid Builder
 *
 * Builds multi-resolution pyramids from large content:
 *
 * 1. Chunk content into L0 base nodes
 * 2. Group L0 chunks and summarize into L1 nodes
 * 3. Synthesize L1 summaries into Apex node
 *
 * The pyramid enables efficient coarse-to-fine retrieval
 * over large documents.
 */

import { randomUUID } from 'crypto';
import type {
  PyramidConfig,
  PyramidBuildInput,
  PyramidBuildResult,
  PyramidBuildProgress,
  Pyramid,
  PyramidNode,
  ApexNode,
  PyramidStats,
  PyramidLevel,
  Summarizer,
  Embedder,
} from './types.js';
import {
  DEFAULT_PYRAMID_CONFIG,
  MIN_WORDS_FOR_PYRAMID,
  CHUNKS_PER_SUMMARY,
  MAX_CHUNKS_PER_SUMMARY,
  TARGET_SUMMARY_WORDS,
  TARGET_APEX_WORDS,
  MAX_THEMES,
  MAX_ENTITIES,
} from './constants.js';
import { ChunkingService, countWords } from '../chunking/index.js';
import type { ContentChunk } from '../chunking/types.js';

// ═══════════════════════════════════════════════════════════════════
// PYRAMID BUILDER
// ═══════════════════════════════════════════════════════════════════

/**
 * Options for the pyramid builder
 */
export interface PyramidBuilderOptions {
  /** Custom chunking service */
  chunkingService?: ChunkingService;

  /** Summarizer function (required for L1 and Apex) */
  summarizer?: Summarizer;

  /** Embedder function (optional) */
  embedder?: Embedder;

  /** Progress callback */
  onProgress?: (progress: PyramidBuildProgress) => void;
}

/**
 * Pyramid builder service
 */
export class PyramidBuilder {
  private readonly config: PyramidConfig;
  private readonly chunkingService: ChunkingService;
  private readonly summarizer?: Summarizer;
  private readonly embedder?: Embedder;
  private readonly onProgress?: (progress: PyramidBuildProgress) => void;

  constructor(options: PyramidBuilderOptions = {}) {
    this.config = DEFAULT_PYRAMID_CONFIG;
    this.chunkingService = options.chunkingService ?? new ChunkingService();
    this.summarizer = options.summarizer;
    this.embedder = options.embedder;
    this.onProgress = options.onProgress;
  }

  /**
   * Build a pyramid from content
   */
  async build(input: PyramidBuildInput): Promise<PyramidBuildResult> {
    const startTime = Date.now();
    const config = { ...this.config, ...input.config };
    const createdNodeIds: string[] = [];

    let chunkingTimeMs = 0;
    let l1BuildTimeMs = 0;
    let apexBuildTimeMs = 0;
    let usedSummarization = false;

    // Report progress
    this.reportProgress('chunking', 0, 'Starting content chunking...');

    // Step 1: Chunk content into L0 nodes
    const chunkStart = Date.now();
    const { chunks } = this.chunkingService.chunk({
      content: input.content,
      parentId: input.threadRootId,
      format: 'text',
    });
    chunkingTimeMs = Date.now() - chunkStart;

    this.reportProgress('chunking', 1, `Created ${chunks.length} chunks`);

    // Create L0 nodes
    const l0Nodes = this.chunksToL0Nodes(chunks, input.threadRootId);
    createdNodeIds.push(...l0Nodes.map((n) => n.id));

    // Check if pyramid is needed
    const totalWords = l0Nodes.reduce((sum, n) => sum + n.wordCount, 0);
    const needsPyramid = totalWords >= MIN_WORDS_FOR_PYRAMID && l0Nodes.length > 1;

    let l1Nodes: PyramidNode[] = [];
    let apex: ApexNode | undefined;

    if (needsPyramid && this.summarizer) {
      // Step 2: Build L1 summaries
      this.reportProgress('l1-summaries', 0, 'Building L1 summaries...');
      const l1Start = Date.now();

      l1Nodes = await this.buildL1Nodes(l0Nodes, input.threadRootId, config);
      createdNodeIds.push(...l1Nodes.map((n) => n.id));
      usedSummarization = true;

      l1BuildTimeMs = Date.now() - l1Start;
      this.reportProgress('l1-summaries', 1, `Created ${l1Nodes.length} L1 summaries`);

      // Step 3: Build Apex
      this.reportProgress('apex', 0, 'Building apex synthesis...');
      const apexStart = Date.now();

      apex = await this.buildApex(l0Nodes, l1Nodes, input, config);
      createdNodeIds.push(apex.id);

      apexBuildTimeMs = Date.now() - apexStart;
      this.reportProgress('apex', 1, 'Apex synthesis complete');
    }

    // Step 4: Generate embeddings if embedder provided
    if (this.embedder) {
      this.reportProgress('embeddings', 0, 'Generating embeddings...');
      await this.generateEmbeddings(l0Nodes, l1Nodes, apex);
      this.reportProgress('embeddings', 1, 'Embeddings complete');
    }

    // Compute statistics
    const stats = this.computeStats(l0Nodes, l1Nodes, apex);

    this.reportProgress('complete', 1, 'Pyramid build complete');

    const pyramid: Pyramid = {
      threadRootId: input.threadRootId,
      l0Nodes,
      l1Nodes,
      apex,
      stats,
    };

    return {
      pyramid,
      createdNodeIds,
      buildStats: {
        chunkingTimeMs,
        l1BuildTimeMs,
        apexBuildTimeMs,
        totalTimeMs: Date.now() - startTime,
        usedSummarization,
      },
    };
  }

  /**
   * Check if content needs a pyramid
   */
  needsPyramid(content: string): boolean {
    const wordCount = countWords(content);
    return wordCount >= MIN_WORDS_FOR_PYRAMID;
  }

  // ─────────────────────────────────────────────────────────────────
  // PRIVATE METHODS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Convert chunks to L0 pyramid nodes
   */
  private chunksToL0Nodes(chunks: ContentChunk[], threadRootId: string): PyramidNode[] {
    return chunks.map((chunk, index) => ({
      id: randomUUID(),
      level: 0 as PyramidLevel,
      text: chunk.text,
      wordCount: chunk.wordCount,
      childIds: [],
      threadRootId,
      position: index,
      sourceChunk: {
        index: chunk.index,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
      },
    }));
  }

  /**
   * Build L1 summary nodes from L0 chunks
   */
  private async buildL1Nodes(
    l0Nodes: PyramidNode[],
    threadRootId: string,
    config: PyramidConfig
  ): Promise<PyramidNode[]> {
    const l1Nodes: PyramidNode[] = [];

    // Group L0 nodes
    const groups = this.groupNodes(l0Nodes, config.chunksPerSummary);

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const combinedText = group.map((n) => n.text).join('\n\n');

      // Summarize the group
      const summaryText = await this.summarizer!(
        combinedText,
        config.targetSummaryWords,
        { level: 1, position: i }
      );

      const l1Node: PyramidNode = {
        id: randomUUID(),
        level: 1,
        text: summaryText,
        wordCount: countWords(summaryText),
        childIds: group.map((n) => n.id),
        threadRootId,
        position: i,
      };

      // Set parent reference on children
      for (const child of group) {
        child.parentId = l1Node.id;
      }

      l1Nodes.push(l1Node);

      // Report progress
      this.reportProgress(
        'l1-summaries',
        (i + 1) / groups.length,
        `Created L1 summary ${i + 1}/${groups.length}`
      );
    }

    return l1Nodes;
  }

  /**
   * Build apex node from L1 summaries
   */
  private async buildApex(
    l0Nodes: PyramidNode[],
    l1Nodes: PyramidNode[],
    input: PyramidBuildInput,
    config: PyramidConfig
  ): Promise<ApexNode> {
    // Combine L1 summaries
    const combinedSummaries = l1Nodes.map((n) => n.text).join('\n\n');

    // Synthesize apex
    const apexText = await this.summarizer!(
      combinedSummaries,
      config.targetApexWords,
      { level: 2, position: 0 }
    );

    // Extract themes and entities if enabled
    let themes: string[] = [];
    let entities: string[] = [];

    if (config.extractThemes) {
      themes = this.extractThemes(apexText);
    }

    if (config.extractEntities) {
      entities = this.extractEntities(apexText);
    }

    // Compute compression ratio
    const totalSourceWords = l0Nodes.reduce((sum, n) => sum + n.wordCount, 0);
    const apexWords = countWords(apexText);
    const compressionRatio = totalSourceWords / Math.max(apexWords, 1);

    const apex: ApexNode = {
      id: randomUUID(),
      level: 2,
      text: apexText,
      wordCount: apexWords,
      childIds: l1Nodes.map((n) => n.id),
      threadRootId: input.threadRootId,
      position: 0,
      themes,
      entities,
      totalSourceWords,
      compressionRatio,
      generatedAt: Date.now(),
    };

    // Set parent reference on L1 nodes
    for (const l1 of l1Nodes) {
      l1.parentId = apex.id;
    }

    return apex;
  }

  /**
   * Group nodes into batches for summarization
   */
  private groupNodes(nodes: PyramidNode[], targetSize: number): PyramidNode[][] {
    const groups: PyramidNode[][] = [];

    // Use flexible grouping to avoid orphan chunks
    const numGroups = Math.ceil(nodes.length / targetSize);
    const baseSize = Math.floor(nodes.length / numGroups);
    const remainder = nodes.length % numGroups;

    let index = 0;
    for (let i = 0; i < numGroups; i++) {
      // Distribute remainder across first groups
      const groupSize = baseSize + (i < remainder ? 1 : 0);
      const group = nodes.slice(index, index + groupSize);
      if (group.length > 0) {
        groups.push(group);
      }
      index += groupSize;
    }

    return groups;
  }

  /**
   * Extract themes from text (simple implementation)
   */
  private extractThemes(text: string): string[] {
    // Simple keyword extraction based on frequency
    // In production, this would use NLP or LLM
    const words = text.toLowerCase().split(/\s+/);
    const wordFreq = new Map<string, number>();

    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'this',
      'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their',
    ]);

    for (const word of words) {
      const clean = word.replace(/[^a-z]/g, '');
      if (clean.length > 3 && !stopWords.has(clean)) {
        wordFreq.set(clean, (wordFreq.get(clean) || 0) + 1);
      }
    }

    // Get top themes
    const sorted = [...wordFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_THEMES)
      .map(([word]) => word);

    return sorted;
  }

  /**
   * Extract entities from text (simple implementation)
   */
  private extractEntities(text: string): string[] {
    // Simple capitalized word extraction
    // In production, this would use NER
    const words = text.split(/\s+/);
    const entities = new Set<string>();

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      // Check for capitalized words not at sentence start
      if (i > 0 && /^[A-Z][a-z]+$/.test(word)) {
        entities.add(word);
      }
    }

    return [...entities].slice(0, MAX_ENTITIES);
  }

  /**
   * Generate embeddings for all nodes
   */
  private async generateEmbeddings(
    l0Nodes: PyramidNode[],
    l1Nodes: PyramidNode[],
    apex?: ApexNode
  ): Promise<void> {
    if (!this.embedder) return;

    const allNodes = [...l0Nodes, ...l1Nodes];
    if (apex) allNodes.push(apex);

    const texts = allNodes.map((n) => n.text);
    const embeddings = await this.embedder(texts);

    for (let i = 0; i < allNodes.length; i++) {
      allNodes[i].embedding = embeddings[i];
    }
  }

  /**
   * Compute pyramid statistics
   */
  private computeStats(
    l0Nodes: PyramidNode[],
    l1Nodes: PyramidNode[],
    apex?: ApexNode
  ): PyramidStats {
    const l0Words = l0Nodes.reduce((sum, n) => sum + n.wordCount, 0);
    const l1Words = l1Nodes.reduce((sum, n) => sum + n.wordCount, 0);
    const apexWords = apex?.wordCount ?? 0;

    const l0Count = l0Nodes.length;
    const l1Count = l1Nodes.length;
    const apexCount = apex ? 1 : 0;

    // Compute compression ratios
    const l0ToL1 = l1Words > 0 ? l0Words / l1Words : 0;
    const l1ToApex = apexWords > 0 ? l1Words / apexWords : 0;
    const overall = apexWords > 0 ? l0Words / apexWords : 0;

    // Compute embedding coverage
    const allNodes = [...l0Nodes, ...l1Nodes, ...(apex ? [apex] : [])];
    const withEmbeddings = allNodes.filter((n) => n.embedding !== undefined).length;
    const embeddingCoverage = allNodes.length > 0 ? withEmbeddings / allNodes.length : 0;

    return {
      nodeCounts: {
        0: l0Count,
        1: l1Count,
        2: apexCount,
      },
      totalNodes: l0Count + l1Count + apexCount,
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
      embeddingCoverage,
    };
  }

  /**
   * Report progress
   */
  private reportProgress(
    phase: PyramidBuildProgress['phase'],
    progress: number,
    message: string
  ): void {
    if (this.onProgress) {
      this.onProgress({ phase, progress, message });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

let _pyramidBuilder: PyramidBuilder | null = null;

/**
 * Get the pyramid builder singleton
 */
export function getPyramidBuilder(): PyramidBuilder {
  if (!_pyramidBuilder) {
    _pyramidBuilder = new PyramidBuilder();
  }
  return _pyramidBuilder;
}

/**
 * Initialize pyramid builder with options
 */
export function initPyramidBuilder(options: PyramidBuilderOptions = {}): PyramidBuilder {
  _pyramidBuilder = new PyramidBuilder(options);
  return _pyramidBuilder;
}

/**
 * Reset pyramid builder (for testing)
 */
export function resetPyramidBuilder(): void {
  _pyramidBuilder = null;
}
