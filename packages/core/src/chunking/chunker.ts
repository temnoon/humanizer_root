/**
 * ChunkingService
 *
 * Breaks large content into smaller, semantically coherent chunks
 * suitable for embedding and retrieval.
 *
 * Uses a cascade strategy:
 * 1. Conversation - Split on message turns (for chat exports)
 * 2. Paragraph - Split on double newlines (for documents)
 * 3. Sentence - Split on sentence boundaries
 * 4. Clause - Split on clause boundaries
 * 5. Hard - Character limit fallback
 */

import type {
  ChunkingConfig,
  ChunkingInput,
  ChunkingResult,
  ContentChunk,
  ChunkingStats,
  BoundaryType,
} from './types.js';
import { DEFAULT_CHUNKING_CONFIG } from './constants.js';
import {
  countWords,
  splitByConversation,
  splitByParagraphs,
  splitBySentences,
  splitByClauses,
  splitHard,
  findBestSplitPoint,
} from './boundary-detector.js';

// ═══════════════════════════════════════════════════════════════════
// CHUNKING SERVICE
// ═══════════════════════════════════════════════════════════════════

/**
 * Service for chunking content into smaller pieces
 */
export class ChunkingService {
  private readonly config: ChunkingConfig;

  constructor(config: Partial<ChunkingConfig> = {}) {
    this.config = { ...DEFAULT_CHUNKING_CONFIG, ...config };
  }

  /**
   * Chunk content into smaller pieces
   */
  chunk(input: ChunkingInput): ChunkingResult {
    const startTime = Date.now();
    const config = { ...this.config, ...input.config };

    const content = input.content.trim();
    if (content.length === 0) {
      return this.emptyResult(startTime);
    }

    // If content is small enough, return as single chunk
    if (content.length <= config.targetChunkChars) {
      return this.singleChunkResult(content, input.parentId, startTime);
    }

    // Apply cascade strategy
    const { chunks, strategiesUsed } = this.applyCascade(
      content,
      config,
      input.parentId,
      input.format
    );

    // Compute statistics
    const stats = this.computeStats(content, chunks, strategiesUsed, startTime);

    return { chunks, stats };
  }

  /**
   * Chunk with overlap between segments
   * Useful for maintaining context across chunk boundaries
   */
  chunkWithOverlap(input: ChunkingInput): ChunkingResult {
    const config = { ...this.config, ...input.config };
    const baseResult = this.chunk(input);

    if (config.overlapChars <= 0 || baseResult.chunks.length <= 1) {
      return baseResult;
    }

    const overlappedChunks = this.addOverlap(
      baseResult.chunks,
      input.content,
      config.overlapChars
    );

    return {
      chunks: overlappedChunks,
      stats: {
        ...baseResult.stats,
        avgChunkChars: this.average(overlappedChunks.map((c) => c.charCount)),
        avgChunkWords: this.average(overlappedChunks.map((c) => c.wordCount)),
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // PRIVATE METHODS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Apply cascade strategy to split content
   */
  private applyCascade(
    content: string,
    config: ChunkingConfig,
    parentId?: string,
    format?: string
  ): { chunks: ContentChunk[]; strategiesUsed: BoundaryType[] } {
    const strategiesUsed: BoundaryType[] = [];
    let segments = [content];
    let currentStrategy: BoundaryType = 'paragraph';

    // Determine initial strategy based on format
    const cascade = this.getCascadeForFormat(config.strategyCascade, format);

    // Apply strategies until all segments fit
    for (const strategy of cascade) {
      const needsSplitting = segments.some((s) => s.length > config.maxChunkChars);

      if (!needsSplitting) {
        break;
      }

      currentStrategy = strategy;
      strategiesUsed.push(strategy);
      segments = this.applySplitStrategy(segments, strategy, config);
    }

    // Convert segments to chunks
    const chunks = this.segmentsToChunks(
      segments,
      content,
      currentStrategy,
      parentId
    );

    // Merge small chunks if needed
    const mergedChunks = this.mergeSmallChunks(chunks, config.minChunkChars);

    return { chunks: mergedChunks, strategiesUsed };
  }

  /**
   * Get cascade order for content format
   */
  private getCascadeForFormat(
    cascade: BoundaryType[],
    format?: string
  ): BoundaryType[] {
    if (format === 'conversation') {
      // Prioritize conversation splitting
      return ['conversation', ...cascade.filter((s) => s !== 'conversation')];
    }
    return cascade;
  }

  /**
   * Apply a specific split strategy to segments
   */
  private applySplitStrategy(
    segments: string[],
    strategy: BoundaryType,
    config: ChunkingConfig
  ): string[] {
    const result: string[] = [];

    for (const segment of segments) {
      if (segment.length <= config.maxChunkChars) {
        result.push(segment);
        continue;
      }

      const split = this.splitByStrategy(segment, strategy, config);
      result.push(...split);
    }

    return result;
  }

  /**
   * Split a single segment using specified strategy
   */
  private splitByStrategy(
    text: string,
    strategy: BoundaryType,
    config: ChunkingConfig
  ): string[] {
    switch (strategy) {
      case 'conversation':
        return splitByConversation(text);

      case 'paragraph':
        return splitByParagraphs(text);

      case 'sentence':
        return splitBySentences(text);

      case 'clause':
        return splitByClauses(text);

      case 'hard':
        return splitHard(text, config.maxChunkChars);

      default:
        return [text];
    }
  }

  /**
   * Convert segments to ContentChunk objects
   */
  private segmentsToChunks(
    segments: string[],
    originalContent: string,
    boundaryType: BoundaryType,
    parentId?: string
  ): ContentChunk[] {
    const chunks: ContentChunk[] = [];
    let currentOffset = 0;

    for (let i = 0; i < segments.length; i++) {
      const text = segments[i];

      // Find actual position in original content
      const startOffset = originalContent.indexOf(text, currentOffset);
      const endOffset = startOffset + text.length;

      chunks.push({
        index: i,
        text,
        startOffset: startOffset >= 0 ? startOffset : currentOffset,
        endOffset: startOffset >= 0 ? endOffset : currentOffset + text.length,
        wordCount: countWords(text),
        charCount: text.length,
        boundaryType,
        parentId,
      });

      currentOffset = startOffset >= 0 ? endOffset : currentOffset + text.length;
    }

    return chunks;
  }

  /**
   * Merge chunks that are too small
   */
  private mergeSmallChunks(
    chunks: ContentChunk[],
    minChars: number
  ): ContentChunk[] {
    if (chunks.length <= 1) {
      return chunks;
    }

    const merged: ContentChunk[] = [];
    let accumulator: ContentChunk | null = null;

    for (const chunk of chunks) {
      if (accumulator === null) {
        accumulator = { ...chunk };
        continue;
      }

      if (accumulator.charCount < minChars) {
        // Merge with current chunk
        accumulator = {
          ...accumulator,
          text: accumulator.text + '\n\n' + chunk.text,
          endOffset: chunk.endOffset,
          wordCount: accumulator.wordCount + chunk.wordCount,
          charCount: accumulator.charCount + chunk.charCount + 2,
        };
      } else {
        merged.push(accumulator);
        accumulator = { ...chunk };
      }
    }

    if (accumulator !== null) {
      merged.push(accumulator);
    }

    // Re-index merged chunks
    return merged.map((chunk, index) => ({ ...chunk, index }));
  }

  /**
   * Add overlap between chunks
   */
  private addOverlap(
    chunks: ContentChunk[],
    originalContent: string,
    overlapChars: number
  ): ContentChunk[] {
    if (chunks.length <= 1) {
      return chunks;
    }

    return chunks.map((chunk, index) => {
      if (index === 0) {
        // First chunk: add overlap from start of next chunk
        const nextChunk = chunks[index + 1];
        const overlapText = nextChunk.text.slice(0, overlapChars);
        return {
          ...chunk,
          text: chunk.text + '\n...' + overlapText,
          charCount: chunk.text.length + 4 + overlapText.length,
          wordCount: countWords(chunk.text + ' ' + overlapText),
        };
      }

      if (index === chunks.length - 1) {
        // Last chunk: add overlap from end of previous chunk
        const prevChunk = chunks[index - 1];
        const overlapText = prevChunk.text.slice(-overlapChars);
        return {
          ...chunk,
          text: overlapText + '...\n' + chunk.text,
          startOffset: Math.max(0, chunk.startOffset - overlapChars),
          charCount: overlapText.length + 4 + chunk.text.length,
          wordCount: countWords(overlapText + ' ' + chunk.text),
        };
      }

      // Middle chunks: add overlap from both sides
      const prevChunk = chunks[index - 1];
      const nextChunk = chunks[index + 1];
      const prevOverlap = prevChunk.text.slice(-overlapChars / 2);
      const nextOverlap = nextChunk.text.slice(0, overlapChars / 2);

      return {
        ...chunk,
        text: prevOverlap + '...\n' + chunk.text + '\n...' + nextOverlap,
        startOffset: Math.max(0, chunk.startOffset - overlapChars / 2),
        charCount: prevOverlap.length + nextOverlap.length + chunk.text.length + 8,
        wordCount: countWords(prevOverlap + ' ' + chunk.text + ' ' + nextOverlap),
      };
    });
  }

  /**
   * Compute statistics for chunking result
   */
  private computeStats(
    originalContent: string,
    chunks: ContentChunk[],
    strategiesUsed: BoundaryType[],
    startTime: number
  ): ChunkingStats {
    const charCounts = chunks.map((c) => c.charCount);
    const wordCounts = chunks.map((c) => c.wordCount);

    return {
      originalCharCount: originalContent.length,
      originalWordCount: countWords(originalContent),
      chunkCount: chunks.length,
      avgChunkChars: this.average(charCounts),
      avgChunkWords: this.average(wordCounts),
      minChunkChars: charCounts.length > 0 ? Math.min(...charCounts) : 0,
      maxChunkChars: charCounts.length > 0 ? Math.max(...charCounts) : 0,
      strategiesUsed,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Create empty result for empty input
   */
  private emptyResult(startTime: number): ChunkingResult {
    return {
      chunks: [],
      stats: {
        originalCharCount: 0,
        originalWordCount: 0,
        chunkCount: 0,
        avgChunkChars: 0,
        avgChunkWords: 0,
        minChunkChars: 0,
        maxChunkChars: 0,
        strategiesUsed: [],
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Create single chunk result for small content
   */
  private singleChunkResult(
    content: string,
    parentId: string | undefined,
    startTime: number
  ): ChunkingResult {
    const chunk: ContentChunk = {
      index: 0,
      text: content,
      startOffset: 0,
      endOffset: content.length,
      wordCount: countWords(content),
      charCount: content.length,
      boundaryType: 'paragraph',
      parentId,
    };

    return {
      chunks: [chunk],
      stats: {
        originalCharCount: content.length,
        originalWordCount: chunk.wordCount,
        chunkCount: 1,
        avgChunkChars: content.length,
        avgChunkWords: chunk.wordCount,
        minChunkChars: content.length,
        maxChunkChars: content.length,
        strategiesUsed: [],
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Calculate average of numbers
   */
  private average(nums: number[]): number {
    if (nums.length === 0) return 0;
    return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

let _chunkingService: ChunkingService | null = null;

/**
 * Get the chunking service singleton
 */
export function getChunkingService(): ChunkingService {
  if (!_chunkingService) {
    _chunkingService = new ChunkingService();
  }
  return _chunkingService;
}

/**
 * Initialize chunking service with custom config
 */
export function initChunkingService(
  config: Partial<ChunkingConfig> = {}
): ChunkingService {
  _chunkingService = new ChunkingService(config);
  return _chunkingService;
}
