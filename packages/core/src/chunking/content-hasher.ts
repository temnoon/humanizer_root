/**
 * Content Hasher
 *
 * Fine-grained content hashing for deduplication detection.
 * Generates paragraph and line-level hashes for detecting:
 * - Copy-pasted content across nodes
 * - Duplicate paragraphs/quotes
 * - First-seen provenance tracking
 *
 * Uses SHA-256 with text normalization to handle formatting variations.
 */

import { createHash } from 'crypto';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * A hash record for a paragraph
 */
export interface ParagraphHash {
  /** SHA-256 hash of normalized paragraph text */
  hash: string;

  /** Zero-based position of this paragraph in the content */
  position: number;

  /** Character length of the original paragraph */
  length: number;

  /** Word count for filtering short paragraphs */
  wordCount: number;
}

/**
 * A hash record for a line
 */
export interface LineHash {
  /** SHA-256 hash of normalized line text */
  hash: string;

  /** Zero-based position of this line in the content */
  position: number;

  /** The original line text (for debugging/display) */
  text: string;

  /** Character length of the original line */
  length: number;
}

/**
 * Result from content hashing operation
 */
export interface ContentHashResult {
  /** Paragraph-level hashes */
  paragraphHashes: ParagraphHash[];

  /** Line-level hashes */
  lineHashes: LineHash[];

  /** Statistics */
  stats: {
    totalParagraphs: number;
    hashableParagraphs: number;
    totalLines: number;
    hashableLines: number;
    processingTimeMs: number;
  };
}

/**
 * Options for content hashing
 */
export interface ContentHashOptions {
  /** Minimum word count for a paragraph to be hashed (default: 5) */
  minParagraphWords?: number;

  /** Minimum character count for a line to be hashed (default: 10) */
  minLineChars?: number;

  /** Whether to hash lines (can be expensive, default: true) */
  hashLines?: boolean;

  /** Maximum line text to store (truncated for very long lines, default: 100) */
  maxLineTextLength?: number;
}

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

/** Default minimum words for paragraph hashing */
export const DEFAULT_MIN_PARAGRAPH_WORDS = 5;

/** Default minimum chars for line hashing */
export const DEFAULT_MIN_LINE_CHARS = 10;

/** Default max line text length to store */
export const DEFAULT_MAX_LINE_TEXT = 100;

// ═══════════════════════════════════════════════════════════════════
// TEXT NORMALIZATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Normalize text for consistent hashing.
 * Handles common formatting variations that shouldn't affect identity.
 *
 * - Trim whitespace
 * - Lowercase
 * - Collapse multiple spaces to single space
 * - Normalize Unicode (NFC form)
 * - Remove zero-width characters
 * - Normalize line endings
 */
export function normalizeForHash(text: string): string {
  return (
    text
      // Normalize Unicode to composed form
      .normalize('NFC')
      // Remove zero-width characters
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      // Normalize line endings to \n
      .replace(/\r\n?/g, '\n')
      // Trim leading/trailing whitespace
      .trim()
      // Lowercase for case-insensitive matching
      .toLowerCase()
      // Collapse multiple spaces to single
      .replace(/\s+/g, ' ')
  );
}

/**
 * Generate SHA-256 hash of text
 */
export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Hash text after normalization
 */
export function hashText(text: string): string {
  return sha256(normalizeForHash(text));
}

// ═══════════════════════════════════════════════════════════════════
// PARAGRAPH HASHING
// ═══════════════════════════════════════════════════════════════════

/**
 * Split content into paragraphs.
 * Paragraphs are separated by two or more newlines.
 */
export function splitIntoParagraphs(content: string): string[] {
  return content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Count words in text
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Hash all paragraphs in content
 *
 * @param content - The full content text
 * @param options - Hashing options
 * @returns Array of paragraph hashes
 */
export function hashParagraphs(
  content: string,
  options: ContentHashOptions = {}
): ParagraphHash[] {
  const minWords = options.minParagraphWords ?? DEFAULT_MIN_PARAGRAPH_WORDS;
  const paragraphs = splitIntoParagraphs(content);
  const hashes: ParagraphHash[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    const wordCount = countWords(paragraph);

    // Skip paragraphs that are too short
    if (wordCount < minWords) {
      continue;
    }

    hashes.push({
      hash: hashText(paragraph),
      position: i,
      length: paragraph.length,
      wordCount,
    });
  }

  return hashes;
}

// ═══════════════════════════════════════════════════════════════════
// LINE HASHING
// ═══════════════════════════════════════════════════════════════════

/**
 * Split content into lines
 */
export function splitIntoLines(content: string): string[] {
  return content.split(/\n/).map((line) => line.trim());
}

/**
 * Hash all significant lines in content
 *
 * @param content - The full content text
 * @param options - Hashing options
 * @returns Array of line hashes
 */
export function hashLines(
  content: string,
  options: ContentHashOptions = {}
): LineHash[] {
  const minChars = options.minLineChars ?? DEFAULT_MIN_LINE_CHARS;
  const maxTextLength = options.maxLineTextLength ?? DEFAULT_MAX_LINE_TEXT;
  const lines = splitIntoLines(content);
  const hashes: LineHash[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip lines that are too short
    if (line.length < minChars) {
      continue;
    }

    hashes.push({
      hash: hashText(line),
      position: i,
      text: line.length > maxTextLength ? line.slice(0, maxTextLength) + '...' : line,
      length: line.length,
    });
  }

  return hashes;
}

// ═══════════════════════════════════════════════════════════════════
// COMBINED HASHING
// ═══════════════════════════════════════════════════════════════════

/**
 * Hash content at both paragraph and line levels
 *
 * @param content - The full content text
 * @param options - Hashing options
 * @returns Complete hash result with stats
 */
export function hashContent(
  content: string,
  options: ContentHashOptions = {}
): ContentHashResult {
  const startTime = Date.now();
  const shouldHashLines = options.hashLines !== false;

  const paragraphs = splitIntoParagraphs(content);
  const paragraphHashes = hashParagraphs(content, options);

  let lineHashes: LineHash[] = [];
  let lines: string[] = [];

  if (shouldHashLines) {
    lines = splitIntoLines(content);
    lineHashes = hashLines(content, options);
  }

  return {
    paragraphHashes,
    lineHashes,
    stats: {
      totalParagraphs: paragraphs.length,
      hashableParagraphs: paragraphHashes.length,
      totalLines: lines.length,
      hashableLines: lineHashes.length,
      processingTimeMs: Date.now() - startTime,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// DUPLICATE DETECTION UTILITIES
// ═══════════════════════════════════════════════════════════════════

/**
 * Find common hashes between two hash sets
 *
 * @param set1 - First set of hashes
 * @param set2 - Second set of hashes
 * @returns Array of matching hash strings
 */
export function findCommonHashes(
  set1: Array<{ hash: string }>,
  set2: Array<{ hash: string }>
): string[] {
  const hashSet1 = new Set(set1.map((h) => h.hash));
  return set2.filter((h) => hashSet1.has(h.hash)).map((h) => h.hash);
}

/**
 * Calculate Jaccard similarity between two hash sets
 *
 * @param set1 - First set of hashes
 * @param set2 - Second set of hashes
 * @returns Similarity score 0-1
 */
export function hashSetSimilarity(
  set1: Array<{ hash: string }>,
  set2: Array<{ hash: string }>
): number {
  if (set1.length === 0 && set2.length === 0) return 1;
  if (set1.length === 0 || set2.length === 0) return 0;

  const hashSet1 = new Set(set1.map((h) => h.hash));
  const hashSet2 = new Set(set2.map((h) => h.hash));

  let intersection = 0;
  for (const hash of hashSet1) {
    if (hashSet2.has(hash)) intersection++;
  }

  const union = hashSet1.size + hashSet2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Get unique hashes from a set (for efficient batch lookup)
 *
 * @param hashes - Array of hash records
 * @returns Array of unique hash strings
 */
export function getUniqueHashes(hashes: Array<{ hash: string }>): string[] {
  return [...new Set(hashes.map((h) => h.hash))];
}
