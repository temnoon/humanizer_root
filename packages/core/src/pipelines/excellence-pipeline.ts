/**
 * Excellence Pipeline
 *
 * Multi-stage batch processor for content excellence analysis.
 *
 * Pipeline Stages:
 * 1. Ingest - Load content from source
 * 2. Chunk - Break into L0 base nodes
 * 3. Embed L0 - Generate embeddings for chunks
 * 4. Summarize L1 - Create summary level
 * 5. Apex - Create document synthesis
 * 6. Score - Calculate excellence scores
 * 7. Index - Store in database
 *
 * Features:
 * - Progress tracking with callbacks
 * - Checkpoint support for resumable processing
 * - Parallel processing where applicable
 * - Configurable stages (skip embedding, scoring, etc.)
 *
 * @module @humanizer/core/pipelines
 */

import { randomUUID } from 'crypto';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import type {
  PipelineStage,
  PipelineConfig,
  PipelineInput,
  PipelineOutput,
  PipelineProgress,
  PipelineCheckpoint,
  PipelineEvent,
  PipelineEventListener,
  ProgressCallback,
  IngestResult,
  ChunkResult,
  EmbedResult,
  SummarizeResult,
  ApexResult,
  ScoreResult,
  IndexResult,
  ExcellenceScore,
  ExcellenceStats,
  RawGemDetection,
  ExcellenceTier,
} from './types.js';
import { DEFAULT_PIPELINE_CONFIG, STAGE_ORDER, STAGE_NAMES } from './types.js';
import type { ImportedNode } from '../adapters/types.js';
import type { PyramidNode, ApexNode, PyramidStats, Summarizer, Embedder } from '../pyramid/types.js';
import { PyramidBuilder, initPyramidBuilder } from '../pyramid/builder.js';
import { ChunkingService, countWords } from '../chunking/index.js';
import type { PostgresContentStore } from '../storage/postgres-content-store.js';
import { getContentStore } from '../storage/postgres-content-store.js';

// ═══════════════════════════════════════════════════════════════════
// EXCELLENCE PIPELINE
// ═══════════════════════════════════════════════════════════════════

/**
 * Options for the excellence pipeline
 */
export interface ExcellencePipelineOptions {
  /** Content store for persistence */
  store?: PostgresContentStore;

  /** Summarizer function for L1 and apex */
  summarizer?: Summarizer;

  /** Embedder function for vector generation */
  embedder?: Embedder;

  /** Excellence scorer function */
  scorer?: ExcellenceScorer;

  /** Progress callback */
  onProgress?: ProgressCallback;

  /** Event listener */
  onEvent?: PipelineEventListener;

  /** Checkpoint directory */
  checkpointDir?: string;
}

/**
 * Excellence scorer function signature
 */
export type ExcellenceScorer = (
  text: string,
  context?: { level: number; nodeId: string }
) => Promise<ExcellenceScore>;

/**
 * Excellence pipeline orchestrator
 */
export class ExcellencePipeline {
  private readonly config: PipelineConfig;
  private readonly store: PostgresContentStore | null;
  private readonly summarizer?: Summarizer;
  private readonly embedder?: Embedder;
  private readonly scorer?: ExcellenceScorer;
  private readonly onProgress?: ProgressCallback;
  private readonly onEvent?: PipelineEventListener;
  private readonly checkpointDir: string;
  private readonly chunkingService: ChunkingService;
  private readonly pyramidBuilder: PyramidBuilder;

  private currentJobId: string | null = null;
  private startTime: number = 0;
  private stageTiming: Partial<Record<PipelineStage, number>> = {};

  constructor(options: ExcellencePipelineOptions = {}) {
    this.config = DEFAULT_PIPELINE_CONFIG;
    this.store = options.store ?? null;
    this.summarizer = options.summarizer;
    this.embedder = options.embedder;
    this.scorer = options.scorer;
    this.onProgress = options.onProgress;
    this.onEvent = options.onEvent;
    this.checkpointDir = options.checkpointDir ?? '/tmp/excellence-checkpoints';

    this.chunkingService = new ChunkingService();
    this.pyramidBuilder = initPyramidBuilder({
      chunkingService: this.chunkingService,
      summarizer: this.summarizer,
      embedder: this.embedder,
    });
  }

  /**
   * Execute the full pipeline
   */
  async execute(input: PipelineInput): Promise<PipelineOutput> {
    const config = { ...this.config, ...input.config };
    const jobId = input.config?.jobId ?? randomUUID();
    this.currentJobId = jobId;
    this.startTime = Date.now();
    this.stageTiming = {};

    const createdNodeIds: string[] = [];
    let finalStage: PipelineStage = 'ingest';
    let error: string | undefined;
    let pyramidStats: PyramidStats | undefined;
    let excellenceStats: ExcellenceStats | undefined;
    let checkpoint: PipelineCheckpoint | undefined;

    // Check for checkpoint resumption
    if (config.resumeFromCheckpoint && input.checkpointFile) {
      checkpoint = await this.loadCheckpoint(input.checkpointFile);
      if (checkpoint) {
        createdNodeIds.push(...checkpoint.accumulatedResults.createdNodeIds);
        this.stageTiming = { ...checkpoint.timingMs };
        this.emitEvent('checkpoint:loaded', { checkpoint });
      }
    }

    this.emitEvent('pipeline:started', { input, config });

    try {
      // Stage 1: Ingest
      const startStageIndex = checkpoint
        ? STAGE_ORDER.indexOf(checkpoint.lastCompletedStage) + 1
        : 0;

      let nodes: ImportedNode[] = [];
      let l0Nodes: PyramidNode[] = [];
      let l1Nodes: PyramidNode[] = [];
      let apex: ApexNode | undefined;
      const scores = new Map<string, ExcellenceScore>();
      const rawGems: RawGemDetection[] = [];

      // Process stages
      for (let i = startStageIndex; i < STAGE_ORDER.length - 1; i++) {
        const stage = STAGE_ORDER[i];
        finalStage = stage;
        const stageStart = Date.now();

        this.emitEvent('stage:started', { stage });
        this.reportProgress(stage, i, STAGE_ORDER.length - 1, 0, 0, 0, 'Starting...');

        switch (stage) {
          case 'ingest': {
            const result = await this.executeIngest(input);
            nodes = result.nodes;
            this.reportProgress(stage, i, STAGE_ORDER.length - 1, 1, result.count, result.count);
            break;
          }

          case 'chunk': {
            const result = await this.executeChunk(nodes, input.threadRootId ?? randomUUID());
            l0Nodes = result.l0Nodes;
            createdNodeIds.push(...l0Nodes.map((n) => n.id));
            this.reportProgress(stage, i, STAGE_ORDER.length - 1, 1, result.count, result.count);
            break;
          }

          case 'embed-l0': {
            if (config.generateEmbeddings && this.embedder) {
              const result = await this.executeEmbed(l0Nodes);
              this.reportProgress(stage, i, STAGE_ORDER.length - 1, 1, result.count, result.count);
            } else {
              this.reportProgress(stage, i, STAGE_ORDER.length - 1, 1, 0, 0, 'Skipped');
            }
            break;
          }

          case 'summarize-l1': {
            if (config.buildPyramid && this.summarizer && l0Nodes.length > 1) {
              const result = await this.executeSummarize(l0Nodes, input.threadRootId ?? randomUUID());
              l1Nodes = result.l1Nodes;
              createdNodeIds.push(...l1Nodes.map((n) => n.id));
              this.reportProgress(stage, i, STAGE_ORDER.length - 1, 1, result.count, result.count);
            } else {
              this.reportProgress(stage, i, STAGE_ORDER.length - 1, 1, 0, 0, 'Skipped');
            }
            break;
          }

          case 'apex': {
            if (config.buildPyramid && this.summarizer && l1Nodes.length > 0) {
              const result = await this.executeApex(l0Nodes, l1Nodes, input);
              apex = result.apex;
              createdNodeIds.push(apex.id);
              pyramidStats = this.computePyramidStats(l0Nodes, l1Nodes, apex);
              this.reportProgress(stage, i, STAGE_ORDER.length - 1, 1, 1, 1);
            } else {
              this.reportProgress(stage, i, STAGE_ORDER.length - 1, 1, 0, 0, 'Skipped');
            }
            break;
          }

          case 'score': {
            if (config.scoreExcellence && this.scorer) {
              const result = await this.executeScore(l0Nodes, l1Nodes, apex);
              result.scores.forEach((score, nodeId) => scores.set(nodeId, score));
              rawGems.push(...result.rawGems);
              excellenceStats = this.computeExcellenceStats(scores, rawGems);
              this.reportProgress(stage, i, STAGE_ORDER.length - 1, 1, result.count, result.count);
            } else {
              this.reportProgress(stage, i, STAGE_ORDER.length - 1, 1, 0, 0, 'Skipped');
            }
            break;
          }

          case 'index': {
            if (this.store) {
              const result = await this.executeIndex(l0Nodes, l1Nodes, apex, scores);
              this.reportProgress(stage, i, STAGE_ORDER.length - 1, 1, result.count, result.count);
            } else {
              this.reportProgress(stage, i, STAGE_ORDER.length - 1, 1, 0, 0, 'Skipped (no store)');
            }
            break;
          }
        }

        this.stageTiming[stage] = Date.now() - stageStart;
        this.emitEvent('stage:completed', { stage });

        // Save checkpoint if enabled
        if (config.enableCheckpoints && createdNodeIds.length % config.checkpointInterval === 0) {
          await this.saveCheckpoint(jobId, stage, createdNodeIds.length, {
            createdNodeIds,
            l0NodeIds: l0Nodes.map((n) => n.id),
            l1NodeIds: l1Nodes.map((n) => n.id),
            apexNodeId: apex?.id,
            scoredCount: scores.size,
            indexedCount: createdNodeIds.length,
          }, input);
        }
      }

      finalStage = 'complete';
      this.emitEvent('pipeline:completed', { createdNodeIds: createdNodeIds.length });

    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      this.emitEvent('pipeline:failed', { error: err });
    }

    const totalDurationMs = Date.now() - this.startTime;

    // Ensure all stages have timing (even if 0)
    const timingMs: Record<PipelineStage, number> = {
      ingest: this.stageTiming.ingest ?? 0,
      chunk: this.stageTiming.chunk ?? 0,
      'embed-l0': this.stageTiming['embed-l0'] ?? 0,
      'summarize-l1': this.stageTiming['summarize-l1'] ?? 0,
      apex: this.stageTiming.apex ?? 0,
      score: this.stageTiming.score ?? 0,
      index: this.stageTiming.index ?? 0,
      complete: 0,
      error: 0,
    };

    return {
      jobId,
      success: !error,
      error,
      finalStage,
      totalProcessed: createdNodeIds.length,
      createdNodeIds,
      pyramidStats,
      excellenceStats,
      timingMs,
      totalDurationMs,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // STAGE IMPLEMENTATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Ingest stage: Load content from source
   */
  private async executeIngest(input: PipelineInput): Promise<IngestResult> {
    const nodes: ImportedNode[] = [];

    switch (input.sourceType) {
      case 'nodes':
        // Pre-loaded nodes
        if (input.nodes) {
          nodes.push(...input.nodes);
        }
        break;

      case 'text':
        // Single text input
        if (input.text) {
          nodes.push({
            id: randomUUID(),
            uri: `content://${input.threadRootId ?? randomUUID()}`,
            contentHash: this.hashText(input.text),
            content: input.text,
            format: 'text',
            sourceType: 'document',
            metadata: { title: input.title },
          });
        }
        break;

      case 'archive':
      case 'import':
        // These would use the import-to-db machinery
        // For now, they should be pre-processed
        throw new Error(`Source type '${input.sourceType}' requires pre-processing. Use 'nodes' or 'text'.`);
    }

    return {
      count: nodes.length,
      nodes,
      sourceMetadata: { sourceType: input.sourceType },
    };
  }

  /**
   * Chunk stage: Break content into L0 base nodes
   */
  private async executeChunk(nodes: ImportedNode[], threadRootId: string): Promise<ChunkResult> {
    const allL0Nodes: PyramidNode[] = [];
    let totalWords = 0;

    for (const node of nodes) {
      const { chunks } = this.chunkingService.chunk({
        content: node.content,
        parentId: threadRootId,
        format: 'text',
      });

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        allL0Nodes.push({
          id: randomUUID(),
          level: 0,
          text: chunk.text,
          wordCount: chunk.wordCount,
          childIds: [],
          threadRootId,
          position: allL0Nodes.length,
          sourceChunk: {
            index: chunk.index,
            startOffset: chunk.startOffset,
            endOffset: chunk.endOffset,
          },
        });
        totalWords += chunk.wordCount;
      }
    }

    return {
      count: allL0Nodes.length,
      l0Nodes: allL0Nodes,
      totalWords,
    };
  }

  /**
   * Embed stage: Generate embeddings for L0 nodes
   */
  private async executeEmbed(l0Nodes: PyramidNode[]): Promise<EmbedResult> {
    if (!this.embedder) {
      return { count: 0, embeddedNodeIds: [], model: 'none', dimensions: 0 };
    }

    const texts = l0Nodes.map((n) => n.text);
    const embeddings = await this.embedder(texts);

    for (let i = 0; i < l0Nodes.length; i++) {
      l0Nodes[i].embedding = embeddings[i];
    }

    return {
      count: l0Nodes.length,
      embeddedNodeIds: l0Nodes.map((n) => n.id),
      model: 'configured-embedder',
      dimensions: embeddings[0]?.length ?? 0,
    };
  }

  /**
   * Summarize stage: Create L1 summary nodes
   */
  private async executeSummarize(l0Nodes: PyramidNode[], threadRootId: string): Promise<SummarizeResult> {
    if (!this.summarizer) {
      return { count: 0, l1Nodes: [], compressionRatio: 0 };
    }

    const l1Nodes: PyramidNode[] = [];
    const chunksPerSummary = 5;
    const targetSummaryWords = 150;

    // Group L0 nodes
    const groups = this.groupNodes(l0Nodes, chunksPerSummary);

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const combinedText = group.map((n) => n.text).join('\n\n');

      const summaryText = await this.summarizer(
        combinedText,
        targetSummaryWords,
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
    }

    const l0Words = l0Nodes.reduce((sum, n) => sum + n.wordCount, 0);
    const l1Words = l1Nodes.reduce((sum, n) => sum + n.wordCount, 0);
    const compressionRatio = l1Words > 0 ? l0Words / l1Words : 0;

    return {
      count: l1Nodes.length,
      l1Nodes,
      compressionRatio,
    };
  }

  /**
   * Apex stage: Create document synthesis
   */
  private async executeApex(
    l0Nodes: PyramidNode[],
    l1Nodes: PyramidNode[],
    input: PipelineInput
  ): Promise<ApexResult> {
    if (!this.summarizer) {
      throw new Error('Summarizer required for apex stage');
    }

    const threadRootId = input.threadRootId ?? randomUUID();
    const targetApexWords = 300;

    // Combine L1 summaries
    const combinedSummaries = l1Nodes.map((n) => n.text).join('\n\n');

    const apexText = await this.summarizer(
      combinedSummaries,
      targetApexWords,
      { level: 2, position: 0 }
    );

    // Extract themes and entities (simple implementation)
    const themes = this.extractThemes(apexText);
    const entities = this.extractEntities(apexText);

    const totalSourceWords = l0Nodes.reduce((sum, n) => sum + n.wordCount, 0);
    const apexWords = countWords(apexText);
    const compressionRatio = totalSourceWords / Math.max(apexWords, 1);

    const apex: ApexNode = {
      id: randomUUID(),
      level: 2,
      text: apexText,
      wordCount: apexWords,
      childIds: l1Nodes.map((n) => n.id),
      threadRootId,
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

    return { apex, themes, entities, compressionRatio };
  }

  /**
   * Score stage: Calculate excellence scores
   */
  private async executeScore(
    l0Nodes: PyramidNode[],
    l1Nodes: PyramidNode[],
    apex?: ApexNode
  ): Promise<ScoreResult> {
    if (!this.scorer) {
      return { count: 0, scores: new Map(), rawGems: [] };
    }

    const scores = new Map<string, ExcellenceScore>();
    const rawGems: RawGemDetection[] = [];
    const allNodes = [...l0Nodes, ...l1Nodes, ...(apex ? [apex] : [])];

    // Process in parallel batches
    const batchSize = this.config.parallelism;

    for (let i = 0; i < allNodes.length; i += batchSize) {
      const batch = allNodes.slice(i, i + batchSize);

      const results = await Promise.all(
        batch.map(async (node) => {
          const score = await this.scorer!(node.text, { level: node.level, nodeId: node.id });
          return { nodeId: node.id, score, node };
        })
      );

      for (const { nodeId, score, node } of results) {
        scores.set(nodeId, score);

        // Detect raw gems (high insight, low expression)
        if (score.tier === 'raw_gem' || this.isRawGem(score)) {
          rawGems.push({
            nodeId,
            gemProbability: this.calculateGemProbability(score),
            writingQualityScore: score.dimensions.expressivePower,
            insightQualityScore: score.dimensions.insightDensity,
            qualityGap: score.dimensions.insightDensity - score.dimensions.expressivePower,
            extractableInsights: [], // Would be populated by deeper analysis
            noiseToRemove: [],
          });
        }
      }

      // Report progress
      this.reportProgress(
        'score',
        STAGE_ORDER.indexOf('score'),
        STAGE_ORDER.length - 1,
        (i + batch.length) / allNodes.length,
        i + batch.length,
        allNodes.length
      );
    }

    return { count: scores.size, scores, rawGems };
  }

  /**
   * Index stage: Store nodes in database
   */
  private async executeIndex(
    l0Nodes: PyramidNode[],
    l1Nodes: PyramidNode[],
    apex: ApexNode | undefined,
    scores: Map<string, ExcellenceScore>
  ): Promise<IndexResult> {
    if (!this.store) {
      return { count: 0, storedNodeIds: [], linksCreated: 0 };
    }

    const storedNodeIds: string[] = [];
    let linksCreated = 0;

    // Store L0 nodes
    for (const node of l0Nodes) {
      const score = scores.get(node.id);
      await this.store.storeNode({
        id: node.id,
        uri: `content://pyramid/${node.threadRootId}/l0/${node.id}`,
        contentHash: this.hashText(node.text),
        content: node.text,
        format: 'text',
        sourceType: 'pyramid-l0',
        hierarchyLevel: 0,
        chunkIndex: node.sourceChunk?.index,
        chunkStartOffset: node.sourceChunk?.startOffset,
        chunkEndOffset: node.sourceChunk?.endOffset,
        metadata: {
          wordCount: node.wordCount,
          position: node.position,
          excellenceScore: score?.compositeScore,
          excellenceTier: score?.tier,
        },
      });
      storedNodeIds.push(node.id);
    }

    // Store L1 nodes
    for (const node of l1Nodes) {
      const score = scores.get(node.id);
      await this.store.storeNode({
        id: node.id,
        uri: `content://pyramid/${node.threadRootId}/l1/${node.id}`,
        contentHash: this.hashText(node.text),
        content: node.text,
        format: 'text',
        sourceType: 'pyramid-l1',
        hierarchyLevel: 1,
        metadata: {
          wordCount: node.wordCount,
          position: node.position,
          childIds: node.childIds,
          excellenceScore: score?.compositeScore,
          excellenceTier: score?.tier,
        },
      });
      storedNodeIds.push(node.id);
    }

    // Store apex
    if (apex) {
      const score = scores.get(apex.id);
      await this.store.storeNode({
        id: apex.id,
        uri: `content://pyramid/${apex.threadRootId}/apex`,
        contentHash: this.hashText(apex.text),
        content: apex.text,
        format: 'text',
        sourceType: 'pyramid-apex',
        hierarchyLevel: 2,
        metadata: {
          wordCount: apex.wordCount,
          themes: apex.themes,
          entities: apex.entities,
          totalSourceWords: apex.totalSourceWords,
          compressionRatio: apex.compressionRatio,
          childIds: apex.childIds,
          excellenceScore: score?.compositeScore,
          excellenceTier: score?.tier,
        },
      });
      storedNodeIds.push(apex.id);
    }

    return {
      count: storedNodeIds.length,
      storedNodeIds,
      linksCreated,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPER METHODS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Group nodes into batches
   */
  private groupNodes(nodes: PyramidNode[], targetSize: number): PyramidNode[][] {
    const groups: PyramidNode[][] = [];
    const numGroups = Math.ceil(nodes.length / targetSize);
    const baseSize = Math.floor(nodes.length / numGroups);
    const remainder = nodes.length % numGroups;

    let index = 0;
    for (let i = 0; i < numGroups; i++) {
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
   * Extract themes from text
   */
  private extractThemes(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/);
    const wordFreq = new Map<string, number>();
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    ]);

    for (const word of words) {
      const clean = word.replace(/[^a-z]/g, '');
      if (clean.length > 3 && !stopWords.has(clean)) {
        wordFreq.set(clean, (wordFreq.get(clean) || 0) + 1);
      }
    }

    return [...wordFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * Extract entities from text
   */
  private extractEntities(text: string): string[] {
    const words = text.split(/\s+/);
    const entities = new Set<string>();

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      if (/^[A-Z][a-z]+$/.test(word)) {
        entities.add(word);
      }
    }

    return [...entities].slice(0, 10);
  }

  /**
   * Check if score indicates a raw gem
   */
  private isRawGem(score: ExcellenceScore): boolean {
    const qualityGap = score.dimensions.insightDensity - score.dimensions.expressivePower;
    return qualityGap > 0.3 && score.dimensions.insightDensity > 0.6;
  }

  /**
   * Calculate gem probability from score
   */
  private calculateGemProbability(score: ExcellenceScore): number {
    const qualityGap = score.dimensions.insightDensity - score.dimensions.expressivePower;
    return Math.min(1, Math.max(0, qualityGap + score.dimensions.insightDensity) / 2);
  }

  /**
   * Compute pyramid statistics
   */
  private computePyramidStats(
    l0Nodes: PyramidNode[],
    l1Nodes: PyramidNode[],
    apex?: ApexNode
  ): PyramidStats {
    const l0Words = l0Nodes.reduce((sum, n) => sum + n.wordCount, 0);
    const l1Words = l1Nodes.reduce((sum, n) => sum + n.wordCount, 0);
    const apexWords = apex?.wordCount ?? 0;

    return {
      nodeCounts: { 0: l0Nodes.length, 1: l1Nodes.length, 2: apex ? 1 : 0 },
      totalNodes: l0Nodes.length + l1Nodes.length + (apex ? 1 : 0),
      wordCounts: { 0: l0Words, 1: l1Words, 2: apexWords },
      totalSourceWords: l0Words,
      compressionRatios: {
        l0ToL1: l1Words > 0 ? l0Words / l1Words : 0,
        l1ToApex: apexWords > 0 ? l1Words / apexWords : 0,
        overall: apexWords > 0 ? l0Words / apexWords : 0,
      },
      embeddingCoverage: l0Nodes.filter((n) => n.embedding).length / Math.max(l0Nodes.length, 1),
    };
  }

  /**
   * Compute excellence statistics
   */
  private computeExcellenceStats(
    scores: Map<string, ExcellenceScore>,
    rawGems: RawGemDetection[]
  ): ExcellenceStats {
    const tierCounts: Record<ExcellenceTier, number> = {
      excellence: 0,
      polished: 0,
      needs_refinement: 0,
      raw_gem: 0,
      noise: 0,
    };

    let totalScore = 0;
    const dimensions = {
      insightDensity: 0,
      expressivePower: 0,
      emotionalResonance: 0,
      structuralElegance: 0,
      voiceAuthenticity: 0,
    };

    const allQuotes: Array<{ quote: string; nodeId: string; score: number }> = [];

    for (const [nodeId, score] of scores) {
      tierCounts[score.tier]++;
      totalScore += score.compositeScore;

      dimensions.insightDensity += score.dimensions.insightDensity;
      dimensions.expressivePower += score.dimensions.expressivePower;
      dimensions.emotionalResonance += score.dimensions.emotionalResonance;
      dimensions.structuralElegance += score.dimensions.structuralElegance;
      dimensions.voiceAuthenticity += score.dimensions.voiceAuthenticity;

      for (const quote of score.standoutQuotes) {
        allQuotes.push({ quote, nodeId, score: score.compositeScore });
      }
    }

    const count = scores.size || 1;

    return {
      totalScored: scores.size,
      avgCompositeScore: totalScore / count,
      tierCounts,
      rawGemsDetected: rawGems.length,
      avgDimensions: {
        insightDensity: dimensions.insightDensity / count,
        expressivePower: dimensions.expressivePower / count,
        emotionalResonance: dimensions.emotionalResonance / count,
        structuralElegance: dimensions.structuralElegance / count,
        voiceAuthenticity: dimensions.voiceAuthenticity / count,
      },
      topQuotes: allQuotes.sort((a, b) => b.score - a.score).slice(0, 10),
    };
  }

  /**
   * Simple text hashing
   */
  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  // ─────────────────────────────────────────────────────────────────
  // CHECKPOINTS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Save checkpoint
   */
  private async saveCheckpoint(
    jobId: string,
    stage: PipelineStage,
    processedIndex: number,
    results: PipelineCheckpoint['accumulatedResults'],
    input: PipelineInput
  ): Promise<void> {
    const checkpoint: PipelineCheckpoint = {
      jobId,
      timestamp: Date.now(),
      lastCompletedStage: stage,
      lastProcessedIndex: processedIndex,
      accumulatedResults: results,
      timingMs: this.stageTiming,
      input,
    };

    const filePath = join(this.checkpointDir, `${jobId}.checkpoint.json`);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(checkpoint, null, 2));

    this.emitEvent('checkpoint:saved', { filePath });
  }

  /**
   * Load checkpoint
   */
  private async loadCheckpoint(filePath: string): Promise<PipelineCheckpoint | undefined> {
    try {
      const data = await readFile(filePath, 'utf-8');
      return JSON.parse(data) as PipelineCheckpoint;
    } catch {
      return undefined;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // PROGRESS & EVENTS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Report progress
   */
  private reportProgress(
    stage: PipelineStage,
    stageIndex: number,
    totalStages: number,
    stageProgress: number,
    itemsProcessed: number,
    totalItems: number,
    message?: string
  ): void {
    if (!this.onProgress) return;

    const elapsedMs = Date.now() - this.startTime;
    const overallProgress = (stageIndex + stageProgress) / totalStages;

    const progress: PipelineProgress = {
      stage,
      stageIndex,
      totalStages,
      stageProgress,
      overallProgress,
      itemsProcessed,
      totalItems,
      message: message ?? `${STAGE_NAMES[stage]}: ${itemsProcessed}/${totalItems}`,
      elapsedMs,
      estimatedRemainingMs: overallProgress > 0
        ? (elapsedMs / overallProgress) * (1 - overallProgress)
        : undefined,
    };

    this.onProgress(progress);
    this.emitEvent('progress:updated', { progress });
  }

  /**
   * Emit pipeline event
   */
  private emitEvent(
    type: PipelineEvent['type'],
    data?: Record<string, unknown>
  ): void {
    if (!this.onEvent || !this.currentJobId) return;

    this.onEvent({
      type,
      jobId: this.currentJobId,
      timestamp: Date.now(),
      data,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

let _excellencePipeline: ExcellencePipeline | null = null;

/**
 * Get excellence pipeline singleton
 */
export function getExcellencePipeline(): ExcellencePipeline {
  if (!_excellencePipeline) {
    _excellencePipeline = new ExcellencePipeline();
  }
  return _excellencePipeline;
}

/**
 * Initialize excellence pipeline with options
 */
export function initExcellencePipeline(options: ExcellencePipelineOptions = {}): ExcellencePipeline {
  _excellencePipeline = new ExcellencePipeline(options);
  return _excellencePipeline;
}

/**
 * Reset excellence pipeline (for testing)
 */
export function resetExcellencePipeline(): void {
  _excellencePipeline = null;
}
