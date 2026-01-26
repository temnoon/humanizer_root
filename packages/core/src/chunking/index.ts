/**
 * Chunking Module
 *
 * Content chunking for the UCG system.
 * Breaks large content into smaller, semantically coherent pieces
 * suitable for embedding and retrieval.
 *
 * Usage:
 * ```typescript
 * import { ChunkingService, getChunkingService } from '@humanizer/core';
 *
 * const service = getChunkingService();
 * const result = service.chunk({
 *   content: 'Long document text...',
 *   format: 'markdown',
 * });
 *
 * console.log(`Produced ${result.chunks.length} chunks`);
 * ```
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type {
  BoundaryType,
  ChunkBoundary,
  ContentChunk,
  ChunkingResult,
  ChunkingStats,
  ChunkingConfig,
  ChunkingInput,
  ChunkEnrichedContent,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

export {
  CHUNKING_CONFIG_KEYS,
  TARGET_CHUNK_CHARS,
  MAX_CHUNK_CHARS,
  MIN_CHUNK_CHARS,
  OVERLAP_CHARS,
  DEFAULT_STRATEGY_CASCADE,
  DEFAULT_CHUNKING_CONFIG,
  CONVERSATION_TURN_PATTERN,
  PARAGRAPH_PATTERN,
  SENTENCE_PATTERN,
  CLAUSE_PATTERN,
  AVG_CHARS_PER_WORD,
  TARGET_WORDS_PER_CHUNK,
} from './constants.js';

// ═══════════════════════════════════════════════════════════════════
// BOUNDARY DETECTION UTILITIES
// ═══════════════════════════════════════════════════════════════════

export {
  countWords,
  splitByConversation,
  splitByParagraphs,
  splitBySentences,
  splitByClauses,
  splitHard,
  findParagraphBoundaries,
  findSentenceBoundaries,
  findBestSplitPoint,
} from './boundary-detector.js';

// ═══════════════════════════════════════════════════════════════════
// CHUNKING SERVICE
// ═══════════════════════════════════════════════════════════════════

export {
  ChunkingService,
  getChunkingService,
  initChunkingService,
} from './chunker.js';

// ═══════════════════════════════════════════════════════════════════
// CONTENT HASHING (FINE-GRAINED DEDUPLICATION)
// ═══════════════════════════════════════════════════════════════════

export type {
  ParagraphHash,
  LineHash,
  ContentHashResult,
  ContentHashOptions,
  MediaTextForHash,
  ContentHashWithMediaResult,
} from './content-hasher.js';

export {
  // Constants
  DEFAULT_MIN_PARAGRAPH_WORDS,
  DEFAULT_MIN_LINE_CHARS,
  DEFAULT_MAX_LINE_TEXT,
  // Text utilities
  normalizeForHash,
  sha256,
  hashText,
  // Splitting
  splitIntoParagraphs,
  splitIntoLines,
  countWords as countWordsForHash,
  // Hashing
  hashParagraphs,
  hashLines,
  hashContent,
  hashContentWithMedia,
  // Duplicate detection
  findCommonHashes,
  hashSetSimilarity,
  getUniqueHashes,
} from './content-hasher.js';
