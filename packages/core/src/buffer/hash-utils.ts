/**
 * Hash Utilities
 *
 * Content hashing and utility functions for the buffer system.
 *
 * @module @humanizer/core/buffer/hash-utils
 */

import { createHash } from 'crypto';
import type { BufferContentFormat } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT HASHING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute SHA-256 hash of content for deduplication.
 *
 * The hash is computed on normalized text:
 * - Trimmed whitespace
 * - Normalized line endings (CRLF -> LF)
 * - Consistent encoding (UTF-8)
 */
export function computeContentHash(text: string): string {
  const normalized = normalizeText(text);
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Compute a short hash for display purposes.
 * Returns first 12 characters of the full hash.
 */
export function computeShortHash(text: string): string {
  return computeContentHash(text).slice(0, 12);
}

/**
 * Normalize text for consistent hashing.
 */
function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\r\n/g, '\n')  // Normalize line endings
    .replace(/\r/g, '\n');   // Handle standalone CR
}

// ═══════════════════════════════════════════════════════════════════════════
// WORD COUNT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute word count for content.
 *
 * Handles multiple languages and whitespace patterns.
 */
export function computeWordCount(text: string): number {
  if (!text || text.trim().length === 0) {
    return 0;
  }

  // Split on whitespace and filter out empty strings
  const words = text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  return words.length;
}

/**
 * Compute character count (excluding whitespace).
 */
export function computeCharCount(text: string): number {
  return text.replace(/\s/g, '').length;
}

/**
 * Compute sentence count.
 */
export function computeSentenceCount(text: string): number {
  if (!text || text.trim().length === 0) {
    return 0;
  }

  // Split on sentence-ending punctuation followed by space or end
  const sentences = text
    .trim()
    .split(/[.!?]+(?:\s|$)/)
    .filter((s) => s.trim().length > 0);

  return sentences.length;
}

/**
 * Compute paragraph count.
 */
export function computeParagraphCount(text: string): number {
  if (!text || text.trim().length === 0) {
    return 0;
  }

  // Split on double newlines (paragraph breaks)
  const paragraphs = text
    .trim()
    .split(/\n\s*\n/)
    .filter((p) => p.trim().length > 0);

  return paragraphs.length;
}

// ═══════════════════════════════════════════════════════════════════════════
// FORMAT DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect content format from text.
 */
export function detectContentFormat(text: string): BufferContentFormat {
  // Check for HTML
  if (hasHtmlTags(text)) {
    return 'html';
  }

  // Check for Markdown
  if (hasMarkdownSyntax(text)) {
    return 'markdown';
  }

  // Check for code
  if (looksLikeCode(text)) {
    return 'code';
  }

  return 'text';
}

/**
 * Check if text contains HTML tags.
 */
function hasHtmlTags(text: string): boolean {
  // Look for common HTML patterns
  const htmlPatterns = [
    /<\/?[a-z][\s\S]*>/i,           // Any HTML tag
    /<!DOCTYPE\s+html/i,             // DOCTYPE
    /<html[\s>]/i,                   // <html>
    /<body[\s>]/i,                   // <body>
    /<div[\s>]/i,                    // <div>
    /<span[\s>]/i,                   // <span>
    /<p[\s>]/i,                      // <p>
  ];

  return htmlPatterns.some((pattern) => pattern.test(text));
}

/**
 * Check if text contains Markdown syntax.
 */
function hasMarkdownSyntax(text: string): boolean {
  const markdownPatterns = [
    /^#{1,6}\s+/m,                   // Headers
    /\[.+?\]\(.+?\)/,                // Links
    /!\[.+?\]\(.+?\)/,               // Images
    /^[-*+]\s+/m,                    // Unordered lists
    /^\d+\.\s+/m,                    // Ordered lists
    /^>\s+/m,                        // Blockquotes
    /`[^`]+`/,                       // Inline code
    /^```/m,                         // Code blocks
    /\*\*[^*]+\*\*/,                 // Bold
    /\*[^*]+\*/,                     // Italic
    /~~[^~]+~~/,                     // Strikethrough
    /^\|.+\|$/m,                     // Tables
  ];

  // Count how many patterns match
  const matches = markdownPatterns.filter((pattern) => pattern.test(text));

  // If 2 or more markdown patterns, consider it markdown
  return matches.length >= 2;
}

/**
 * Check if text looks like code.
 */
function looksLikeCode(text: string): boolean {
  const codePatterns = [
    /^(function|const|let|var|class|import|export)\s+/m,  // JavaScript
    /^(def|class|import|from)\s+/m,                       // Python
    /^(public|private|protected|class|interface)\s+/m,    // Java/C#
    /^(fn|let|mut|struct|impl|use)\s+/m,                  // Rust
    /^(func|package|import|type)\s+/m,                    // Go
    /^\s*(if|for|while|switch)\s*\(/m,                    // Control flow
    /[{};]\s*$/m,                                         // Braces/semicolons at line end
    /^\s*\/\/|^\s*\/\*|^\s*#/m,                           // Comments
    /=>\s*{/,                                             // Arrow functions
    /\(\s*\)\s*=>/,                                       // Arrow function syntax
  ];

  // Count matches
  const matches = codePatterns.filter((pattern) => pattern.test(text));

  // If 3+ code patterns OR significant indentation, consider it code
  const hasSignificantIndentation = (text.match(/^(  |\t)/gm)?.length ?? 0) > 5;

  return matches.length >= 3 || (matches.length >= 1 && hasSignificantIndentation);
}

// ═══════════════════════════════════════════════════════════════════════════
// DELTA COMPUTATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute a simple delta hash between two texts.
 * This is a hash of the diff, not the diff itself.
 */
export function computeDeltaHash(before: string, after: string): string {
  // Simple approach: hash the concatenation of both hashes with a separator
  const beforeHash = computeContentHash(before);
  const afterHash = computeContentHash(after);
  return computeContentHash(`${beforeHash}:${afterHash}`);
}

/**
 * Compute similarity between two texts (0-1).
 * Uses Jaccard similarity on word sets.
 */
export function computeTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(
    text1.toLowerCase().split(/\s+/).filter((w) => w.length > 0)
  );
  const words2 = new Set(
    text2.toLowerCase().split(/\s+/).filter((w) => w.length > 0)
  );

  if (words1.size === 0 && words2.size === 0) {
    return 1; // Both empty = identical
  }

  if (words1.size === 0 || words2.size === 0) {
    return 0; // One empty = no similarity
  }

  // Jaccard similarity: |intersection| / |union|
  let intersection = 0;
  for (const word of words1) {
    if (words2.has(word)) {
      intersection++;
    }
  }

  const union = words1.size + words2.size - intersection;
  return intersection / union;
}

// ═══════════════════════════════════════════════════════════════════════════
// UUID GENERATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a UUID v4.
 */
export function generateUUID(): string {
  // Use crypto.randomUUID if available (Node 14.17+)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
