/**
 * Boundary Detection Utilities
 *
 * Functions for detecting content boundaries at various granularities:
 * - Conversation turns
 * - Paragraphs
 * - Sentences
 * - Clauses
 */

import {
  CONVERSATION_TURN_PATTERN,
  PARAGRAPH_PATTERN,
  SENTENCE_PATTERN,
  CLAUSE_PATTERN,
} from './constants.js';

// ═══════════════════════════════════════════════════════════════════
// WORD COUNTING
// ═══════════════════════════════════════════════════════════════════

/**
 * Count words in text
 * Splits on whitespace and filters empty strings
 */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

// ═══════════════════════════════════════════════════════════════════
// BOUNDARY DETECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Split content by conversation turns
 * For chat exports where each turn starts with "Human:", "Assistant:", etc.
 */
export function splitByConversation(text: string): string[] {
  // Find all turn markers and their positions
  const matches = [...text.matchAll(new RegExp(CONVERSATION_TURN_PATTERN.source, 'gi'))];

  if (matches.length === 0) {
    return [text];
  }

  const segments: string[] = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const startIdx = match.index!;
    const endIdx = i + 1 < matches.length ? matches[i + 1].index! : text.length;

    const segment = text.slice(startIdx, endIdx).trim();
    if (segment.length > 0) {
      segments.push(segment);
    }
  }

  // Handle text before first turn marker
  if (matches[0].index! > 0) {
    const preamble = text.slice(0, matches[0].index!).trim();
    if (preamble.length > 0) {
      segments.unshift(preamble);
    }
  }

  return segments.filter((s) => s.length > 0);
}

/**
 * Split content by paragraphs (double newline)
 */
export function splitByParagraphs(text: string): string[] {
  return text
    .split(PARAGRAPH_PATTERN)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Split content by sentences
 * Handles common abbreviations and edge cases
 */
export function splitBySentences(text: string): string[] {
  // First try regex-based splitting
  const parts = text.split(SENTENCE_PATTERN);

  // If no splits found, fall back to simple period splitting
  if (parts.length === 1) {
    // Simple fallback: split on period followed by space
    return text
      .split(/\.\s+/)
      .map((s, i, arr) => i < arr.length - 1 ? s + '.' : s)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  return parts.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Split content by clauses (comma, semicolon, colon)
 */
export function splitByClauses(text: string): string[] {
  return text
    .split(CLAUSE_PATTERN)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

/**
 * Hard split at character boundary
 * Used as last resort when other strategies don't fit
 */
export function splitHard(text: string, maxChars: number): string[] {
  const segments: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      segments.push(remaining);
      break;
    }

    // Try to find a word boundary near maxChars
    let splitPoint = maxChars;

    // Look backwards for a space
    while (splitPoint > 0 && remaining[splitPoint] !== ' ') {
      splitPoint--;
    }

    // If no space found, just split at maxChars
    if (splitPoint === 0) {
      splitPoint = maxChars;
    }

    segments.push(remaining.slice(0, splitPoint).trim());
    remaining = remaining.slice(splitPoint).trim();
  }

  return segments.filter((s) => s.length > 0);
}

// ═══════════════════════════════════════════════════════════════════
// BOUNDARY POSITION DETECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Find paragraph boundary positions in text
 */
export function findParagraphBoundaries(text: string): number[] {
  const positions: number[] = [];
  const matches = text.matchAll(new RegExp(PARAGRAPH_PATTERN.source, 'g'));

  for (const match of matches) {
    if (match.index !== undefined) {
      positions.push(match.index);
    }
  }

  return positions;
}

/**
 * Find sentence boundary positions in text
 */
export function findSentenceBoundaries(text: string): number[] {
  const positions: number[] = [];
  const pattern = /[.!?]\s+/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    positions.push(match.index + match[0].length);
  }

  return positions;
}

/**
 * Find the best split point near a target position
 * Prefers natural boundaries (paragraphs > sentences > words)
 */
export function findBestSplitPoint(
  text: string,
  targetPos: number,
  tolerance: number = 200
): { position: number; type: 'paragraph' | 'sentence' | 'word' | 'exact' } {
  const minPos = Math.max(0, targetPos - tolerance);
  const maxPos = Math.min(text.length, targetPos + tolerance);

  // Look for paragraph boundary
  const paragraphs = findParagraphBoundaries(text);
  for (const pos of paragraphs) {
    if (pos >= minPos && pos <= maxPos) {
      return { position: pos, type: 'paragraph' };
    }
  }

  // Look for sentence boundary
  const sentences = findSentenceBoundaries(text);
  for (const pos of sentences) {
    if (pos >= minPos && pos <= maxPos) {
      return { position: pos, type: 'sentence' };
    }
  }

  // Look for word boundary (space)
  let wordPos = targetPos;
  while (wordPos > minPos && text[wordPos] !== ' ') {
    wordPos--;
  }
  if (wordPos > minPos) {
    return { position: wordPos + 1, type: 'word' };
  }

  // Fall back to exact position
  return { position: targetPos, type: 'exact' };
}
