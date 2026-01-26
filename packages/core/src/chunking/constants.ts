/**
 * Chunking Constants
 *
 * Default configuration values for the chunking system.
 * All values are config-managed following platinum conventions.
 */

import type { ChunkingConfig, BoundaryType } from './types.js';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION KEYS (for config manager integration)
// ═══════════════════════════════════════════════════════════════════

export const CHUNKING_CONFIG_KEYS = {
  TARGET_CHUNK_CHARS: 'chunking.targetChunkChars',
  MAX_CHUNK_CHARS: 'chunking.maxChunkChars',
  MIN_CHUNK_CHARS: 'chunking.minChunkChars',
  OVERLAP_CHARS: 'chunking.overlapChars',
  PRESERVE_PARAGRAPHS: 'chunking.preserveParagraphs',
  PRESERVE_SENTENCES: 'chunking.preserveSentences',
} as const;

// ═══════════════════════════════════════════════════════════════════
// DEFAULT VALUES
// ═══════════════════════════════════════════════════════════════════

/**
 * Target chunk size in characters (~300-400 words)
 * Based on optimal embedding performance for nomic-embed-text
 * Conservative to handle mixed content (code + prose + URLs)
 */
export const TARGET_CHUNK_CHARS = 1500;

/**
 * Maximum chunk size in characters (hard limit)
 * Very conservative to handle worst-case tokenization (URLs, code)
 * ~1000 tokens at 2 chars/token average for mixed content
 */
export const MAX_CHUNK_CHARS = 2000;

/**
 * Minimum chunk size in characters
 * Avoids tiny chunks that lack semantic content
 */
export const MIN_CHUNK_CHARS = 200;

/**
 * Default overlap between chunks
 * Helps maintain context across chunk boundaries
 */
export const OVERLAP_CHARS = 100;

/**
 * Default strategy cascade order
 * Tried in sequence until content fits within limits
 */
export const DEFAULT_STRATEGY_CASCADE: BoundaryType[] = [
  'conversation',
  'paragraph',
  'sentence',
  'clause',
  'hard',
];

// ═══════════════════════════════════════════════════════════════════
// DEFAULT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Default chunking configuration
 */
export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  targetChunkChars: TARGET_CHUNK_CHARS,
  maxChunkChars: MAX_CHUNK_CHARS,
  minChunkChars: MIN_CHUNK_CHARS,
  overlapChars: OVERLAP_CHARS,
  preserveParagraphs: true,
  preserveSentences: true,
  strategyCascade: DEFAULT_STRATEGY_CASCADE,
};

// ═══════════════════════════════════════════════════════════════════
// BOUNDARY PATTERNS
// ═══════════════════════════════════════════════════════════════════

/**
 * Pattern for conversation turn markers
 * Matches common chat transcript formats
 */
export const CONVERSATION_TURN_PATTERN = /(?:^|\n)(?:Human|User|Assistant|AI|System|Bot|You|Me):\s*/gi;

/**
 * Pattern for paragraph boundaries (double newline)
 */
export const PARAGRAPH_PATTERN = /\n\n+/g;

/**
 * Pattern for sentence boundaries
 * Handles common abbreviations and edge cases
 */
export const SENTENCE_PATTERN = /(?<=[.!?])\s+(?=[A-Z])/g;

/**
 * Pattern for clause boundaries
 */
export const CLAUSE_PATTERN = /(?<=[,;:])\s+/g;

// ═══════════════════════════════════════════════════════════════════
// WORD COUNTING
// ═══════════════════════════════════════════════════════════════════

/**
 * Average characters per word (including space)
 * Used for word count estimation
 */
export const AVG_CHARS_PER_WORD = 5;

/**
 * Target words per chunk (derived from chars)
 */
export const TARGET_WORDS_PER_CHUNK = Math.round(TARGET_CHUNK_CHARS / AVG_CHARS_PER_WORD);
