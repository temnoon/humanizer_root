/**
 * Paste Detector
 *
 * Detects copy-pasted content within user messages using multiple heuristics:
 * 1. Sudden length jumps - Short segments followed by long blocks
 * 2. Structural patterns - Code blocks, lists, documentation-style formatting
 * 3. Writing style discontinuity - Formality/tone shifts
 * 4. Template patterns - Known boilerplate structures
 *
 * Used during import to flag content that was likely pasted vs typed.
 *
 * @module @humanizer/core/adapters/parsers/paste-detector
 */

import {
  splitIntoParagraphs,
  splitIntoLines,
  countWords,
  hashText,
} from '../../chunking/content-hasher.js';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * A detected paste segment within content
 */
export interface PasteSegment {
  /** Start character offset in the original text */
  start: number;

  /** End character offset in the original text */
  end: number;

  /** The text content of this segment */
  text: string;

  /** Confidence that this segment was pasted (0-1) */
  pasteConfidence: number;

  /** Reasons for the paste detection */
  reasons: PasteReason[];

  /** Hash of this segment (for deduplication) */
  hash: string;
}

/**
 * Reasons why content was flagged as pasted
 */
export type PasteReason =
  | 'length_jump' // Sudden increase in length vs prior segments
  | 'code_block' // Contains markdown code block
  | 'structured_list' // Contains numbered/bulleted list
  | 'documentation_style' // Formal documentation patterns
  | 'formality_shift' // Shift from casual to formal
  | 'template_pattern' // Known boilerplate structure
  | 'duplicate_hash' // Matches existing content hash
  | 'url_heavy' // High density of URLs
  | 'quote_block' // Markdown quote block
  | 'table_block'; // Markdown table

/**
 * Result from paste analysis
 */
export interface PasteAnalysisResult {
  /** Whether any pasted content was detected */
  hasPastedContent: boolean;

  /** Overall paste confidence for the entire content (0-1) */
  overallConfidence: number;

  /** Detected paste segments */
  segments: PasteSegment[];

  /** All reasons found across segments */
  allReasons: PasteReason[];

  /** Statistics */
  stats: {
    totalCharacters: number;
    pastedCharacters: number;
    pasteRatio: number;
    segmentsAnalyzed: number;
    segmentsFlagged: number;
    processingTimeMs: number;
  };
}

/**
 * Options for paste detection
 */
export interface PasteDetectorOptions {
  /** Minimum confidence threshold to flag as paste (default: 0.5) */
  minPasteConfidence?: number;

  /** Minimum word count for a segment to analyze (default: 10) */
  minSegmentWords?: number;

  /** Length multiplier to consider a "jump" (default: 3.0) */
  lengthJumpMultiplier?: number;

  /** Minimum words for length jump detection (default: 50) */
  lengthJumpMinWords?: number;

  /** Whether to detect code blocks (default: true) */
  detectCodeBlocks?: boolean;

  /** Whether to detect structured lists (default: true) */
  detectLists?: boolean;

  /** Whether to detect formality shifts (default: true) */
  detectFormalityShift?: boolean;

  /** Whether to detect URL-heavy sections (default: true) */
  detectUrlHeavy?: boolean;

  /** Minimum URLs to consider "URL-heavy" (default: 3) */
  urlHeavyThreshold?: number;
}

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

/** Default options */
export const DEFAULT_PASTE_OPTIONS: Required<PasteDetectorOptions> = {
  minPasteConfidence: 0.5,
  minSegmentWords: 10,
  lengthJumpMultiplier: 3.0,
  lengthJumpMinWords: 50,
  detectCodeBlocks: true,
  detectLists: true,
  detectFormalityShift: true,
  detectUrlHeavy: true,
  urlHeavyThreshold: 3,
};

/** Confidence weights for each reason */
export const REASON_WEIGHTS: Record<PasteReason, number> = {
  length_jump: 0.6,
  code_block: 0.9,
  structured_list: 0.4,
  documentation_style: 0.7,
  formality_shift: 0.5,
  template_pattern: 0.8,
  duplicate_hash: 1.0,
  url_heavy: 0.6,
  quote_block: 0.7,
  table_block: 0.8,
};

/** Formal language indicators */
const FORMAL_INDICATORS = [
  /\b(pursuant|herein|hereby|thereof|whereas|notwithstanding)\b/i,
  /\b(shall|must|require[sd]?|mandatory|compliance)\b/i,
  /\b(documentation|specification|implementation|configuration)\b/i,
  /\b(please note|important:|warning:|note:)\b/i,
  /^#+\s/, // Markdown headers
  /^\s*[-*]\s.*:/, // Bullet points with colons
];

/** Casual language indicators */
const CASUAL_INDICATORS = [
  /\b(hey|hi|yo|sup|gonna|wanna|gotta|kinda|sorta)\b/i,
  /\b(lol|haha|omg|btw|tbh|imo|idk|nvm)\b/i,
  /!{2,}/, // Multiple exclamation marks
  /\?{2,}/, // Multiple question marks
  /\.{3,}/, // Ellipsis
];

// ═══════════════════════════════════════════════════════════════════
// STRUCTURAL PATTERN DETECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Detect code blocks in text
 */
export function detectCodeBlocks(text: string): Array<{ start: number; end: number }> {
  const blocks: Array<{ start: number; end: number }> = [];
  const codeBlockRegex = /```[\s\S]*?```|`[^`\n]+`/g;

  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Only flag multi-line code blocks as paste (single backticks are often typed)
    if (match[0].startsWith('```')) {
      blocks.push({
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  return blocks;
}

/**
 * Detect markdown quote blocks
 */
export function detectQuoteBlocks(text: string): Array<{ start: number; end: number }> {
  const blocks: Array<{ start: number; end: number }> = [];
  const lines = text.split('\n');
  let inQuote = false;
  let quoteStart = 0;
  let offset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isQuoteLine = line.trimStart().startsWith('>');

    if (isQuoteLine && !inQuote) {
      inQuote = true;
      quoteStart = offset;
    } else if (!isQuoteLine && inQuote) {
      // End of quote block (only flag multi-line quotes)
      if (offset - quoteStart > 50) {
        blocks.push({ start: quoteStart, end: offset });
      }
      inQuote = false;
    }

    offset += line.length + 1; // +1 for newline
  }

  // Handle quote at end of content
  if (inQuote && offset - quoteStart > 50) {
    blocks.push({ start: quoteStart, end: offset });
  }

  return blocks;
}

/**
 * Detect markdown tables
 */
export function detectTableBlocks(text: string): Array<{ start: number; end: number }> {
  const blocks: Array<{ start: number; end: number }> = [];
  // Match markdown tables: | col | col | followed by | --- | --- |
  const tableRegex = /(\|[^\n]+\|\n)+\|[-:\s|]+\|(\n\|[^\n]+\|)*/g;

  let match;
  while ((match = tableRegex.exec(text)) !== null) {
    blocks.push({
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return blocks;
}

/**
 * Detect structured lists (numbered or bulleted)
 */
export function detectStructuredLists(text: string): Array<{ start: number; end: number }> {
  const blocks: Array<{ start: number; end: number }> = [];
  const lines = text.split('\n');
  let inList = false;
  let listStart = 0;
  let listLength = 0;
  let offset = 0;

  const listItemRegex = /^\s*(?:\d+\.|[-*+])\s+/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isListItem = listItemRegex.test(line);

    if (isListItem && !inList) {
      inList = true;
      listStart = offset;
      listLength = 1;
    } else if (isListItem && inList) {
      listLength++;
    } else if (!isListItem && inList) {
      // End of list - only flag if 3+ items
      if (listLength >= 3) {
        blocks.push({ start: listStart, end: offset });
      }
      inList = false;
      listLength = 0;
    }

    offset += line.length + 1;
  }

  // Handle list at end
  if (inList && listLength >= 3) {
    blocks.push({ start: listStart, end: offset });
  }

  return blocks;
}

/**
 * Detect URL-heavy sections
 */
export function detectUrlHeavySections(
  text: string,
  threshold: number = 3
): Array<{ start: number; end: number }> {
  const paragraphs = splitIntoParagraphs(text);
  const blocks: Array<{ start: number; end: number }> = [];
  let offset = 0;

  const urlRegex = /https?:\/\/[^\s)>\]]+/g;

  for (const para of paragraphs) {
    const urls = para.match(urlRegex) || [];
    if (urls.length >= threshold) {
      const paraStart = text.indexOf(para, offset);
      if (paraStart !== -1) {
        blocks.push({
          start: paraStart,
          end: paraStart + para.length,
        });
      }
    }
    offset += para.length + 2; // Account for paragraph separator
  }

  return blocks;
}

// ═══════════════════════════════════════════════════════════════════
// STYLE ANALYSIS
// ═══════════════════════════════════════════════════════════════════

/**
 * Calculate formality score for text (0 = casual, 1 = formal)
 */
export function calculateFormalityScore(text: string): number {
  const normalizedText = text.toLowerCase();
  const words = countWords(text);

  if (words < 5) return 0.5; // Not enough text to analyze

  let formalCount = 0;
  let casualCount = 0;

  for (const pattern of FORMAL_INDICATORS) {
    const matches = normalizedText.match(pattern);
    if (matches) formalCount += matches.length;
  }

  for (const pattern of CASUAL_INDICATORS) {
    const matches = normalizedText.match(pattern);
    if (matches) casualCount += matches.length;
  }

  // Normalize by word count
  const formalScore = Math.min(formalCount / (words / 20), 1);
  const casualScore = Math.min(casualCount / (words / 20), 1);

  // Return formality score (0 = casual, 1 = formal)
  if (formalCount === 0 && casualCount === 0) return 0.5;
  return formalScore / (formalScore + casualScore + 0.01);
}

/**
 * Detect formality shifts between segments
 */
export function detectFormalityShifts(
  segments: string[]
): Array<{ index: number; shift: number }> {
  const shifts: Array<{ index: number; shift: number }> = [];
  const scores = segments.map((s) => calculateFormalityScore(s));

  for (let i = 1; i < scores.length; i++) {
    const shift = Math.abs(scores[i] - scores[i - 1]);
    if (shift > 0.4) {
      shifts.push({ index: i, shift });
    }
  }

  return shifts;
}

// ═══════════════════════════════════════════════════════════════════
// LENGTH ANALYSIS
// ═══════════════════════════════════════════════════════════════════

/**
 * Detect sudden length jumps in content segments
 */
export function detectLengthJumps(
  paragraphs: string[],
  multiplier: number = 3.0,
  minWords: number = 50
): number[] {
  const jumpIndices: number[] = [];

  if (paragraphs.length < 2) return jumpIndices;

  const wordCounts = paragraphs.map((p) => countWords(p));

  // Calculate running average of word counts
  let runningSum = 0;
  let count = 0;

  for (let i = 0; i < wordCounts.length; i++) {
    const currentWords = wordCounts[i];
    const avgSoFar = count > 0 ? runningSum / count : currentWords;

    // Check if this paragraph is significantly longer than average
    if (
      currentWords >= minWords &&
      currentWords > avgSoFar * multiplier &&
      avgSoFar > 0
    ) {
      jumpIndices.push(i);
    }

    // Update running average (weighted toward recent)
    runningSum += currentWords;
    count++;
  }

  return jumpIndices;
}

// ═══════════════════════════════════════════════════════════════════
// TEMPLATE DETECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Common boilerplate/template patterns
 */
const TEMPLATE_PATTERNS = [
  // Legal/terms
  /\b(terms (of|and) (service|use)|privacy policy|all rights reserved)\b/i,
  // Error messages
  /^(error|exception|warning|fatal):\s/im,
  // Stack traces
  /^\s*at\s+[\w.$]+\([^)]+\)/m,
  // Log entries
  /^\[?\d{4}[-/]\d{2}[-/]\d{2}[T\s]\d{2}:\d{2}/m,
  // Configuration
  /^\s*[\w_]+\s*[=:]\s*["']?[\w/.:-]+["']?\s*$/m,
  // API responses
  /^\s*\{\s*"[\w]+"\s*:/,
  // Headers (email, HTTP)
  /^(From|To|Subject|Date|Content-Type|Authorization):\s/im,
];

/**
 * Detect template/boilerplate patterns
 */
export function detectTemplatePatterns(text: string): boolean {
  for (const pattern of TEMPLATE_PATTERNS) {
    if (pattern.test(text)) return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN ANALYSIS FUNCTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Analyze content for pasted sections
 *
 * @param text - The content to analyze
 * @param options - Detection options
 * @returns Analysis result with detected segments
 */
export function analyzePastedContent(
  text: string,
  options: PasteDetectorOptions = {}
): PasteAnalysisResult {
  const startTime = Date.now();
  const opts = { ...DEFAULT_PASTE_OPTIONS, ...options };

  const segments: PasteSegment[] = [];
  const allReasons = new Set<PasteReason>();

  // Track which ranges have been flagged (to avoid double-counting)
  const flaggedRanges: Array<{ start: number; end: number }> = [];

  const addSegment = (
    start: number,
    end: number,
    reasons: PasteReason[],
    baseConfidence: number
  ) => {
    // Check for overlap with existing segments
    const overlaps = flaggedRanges.some(
      (r) => !(end <= r.start || start >= r.end)
    );
    if (overlaps) return;

    const segmentText = text.slice(start, end);
    const words = countWords(segmentText);

    if (words < opts.minSegmentWords) return;

    // Calculate confidence based on reasons
    let confidence = 0;
    for (const reason of reasons) {
      confidence = Math.max(confidence, REASON_WEIGHTS[reason] * baseConfidence);
    }

    if (confidence >= opts.minPasteConfidence) {
      reasons.forEach((r) => allReasons.add(r));
      flaggedRanges.push({ start, end });

      segments.push({
        start,
        end,
        text: segmentText,
        pasteConfidence: Math.min(confidence, 1),
        reasons,
        hash: hashText(segmentText),
      });
    }
  };

  // Detect structural patterns
  if (opts.detectCodeBlocks) {
    for (const block of detectCodeBlocks(text)) {
      addSegment(block.start, block.end, ['code_block'], 1.0);
    }
  }

  const quoteBlocks = detectQuoteBlocks(text);
  for (const block of quoteBlocks) {
    addSegment(block.start, block.end, ['quote_block'], 1.0);
  }

  const tableBlocks = detectTableBlocks(text);
  for (const block of tableBlocks) {
    addSegment(block.start, block.end, ['table_block'], 1.0);
  }

  if (opts.detectLists) {
    for (const block of detectStructuredLists(text)) {
      addSegment(block.start, block.end, ['structured_list'], 0.8);
    }
  }

  if (opts.detectUrlHeavy) {
    for (const block of detectUrlHeavySections(text, opts.urlHeavyThreshold)) {
      addSegment(block.start, block.end, ['url_heavy'], 0.9);
    }
  }

  // Analyze paragraphs for length jumps and formality shifts
  const paragraphs = splitIntoParagraphs(text);
  const paragraphOffsets = getParagraphOffsets(text, paragraphs);

  // Length jumps
  const jumpIndices = detectLengthJumps(
    paragraphs,
    opts.lengthJumpMultiplier,
    opts.lengthJumpMinWords
  );

  for (const idx of jumpIndices) {
    const offset = paragraphOffsets[idx];
    if (offset) {
      const reasons: PasteReason[] = ['length_jump'];

      // Check for additional reasons
      if (detectTemplatePatterns(paragraphs[idx])) {
        reasons.push('template_pattern');
      }

      addSegment(offset.start, offset.end, reasons, 0.9);
    }
  }

  // Formality shifts
  if (opts.detectFormalityShift && paragraphs.length >= 2) {
    const shifts = detectFormalityShifts(paragraphs);

    for (const { index } of shifts) {
      const offset = paragraphOffsets[index];
      if (offset) {
        // Check if more formal than prior segment
        const priorFormality = calculateFormalityScore(paragraphs[index - 1]);
        const currentFormality = calculateFormalityScore(paragraphs[index]);

        // Only flag if becoming more formal (typical of pasting documentation)
        if (currentFormality > priorFormality) {
          const reasons: PasteReason[] = ['formality_shift'];

          if (
            currentFormality > 0.7 &&
            FORMAL_INDICATORS.some((p) => p.test(paragraphs[index]))
          ) {
            reasons.push('documentation_style');
          }

          addSegment(offset.start, offset.end, reasons, 0.7);
        }
      }
    }
  }

  // Sort segments by position
  segments.sort((a, b) => a.start - b.start);

  // Calculate stats
  const pastedCharacters = segments.reduce((sum, s) => sum + s.text.length, 0);
  const overallConfidence =
    segments.length > 0
      ? segments.reduce((sum, s) => sum + s.pasteConfidence, 0) / segments.length
      : 0;

  return {
    hasPastedContent: segments.length > 0,
    overallConfidence,
    segments,
    allReasons: [...allReasons],
    stats: {
      totalCharacters: text.length,
      pastedCharacters,
      pasteRatio: text.length > 0 ? pastedCharacters / text.length : 0,
      segmentsAnalyzed: paragraphs.length,
      segmentsFlagged: segments.length,
      processingTimeMs: Date.now() - startTime,
    },
  };
}

/**
 * Get character offsets for each paragraph
 */
function getParagraphOffsets(
  text: string,
  paragraphs: string[]
): Array<{ start: number; end: number }> {
  const offsets: Array<{ start: number; end: number }> = [];
  let searchStart = 0;

  for (const para of paragraphs) {
    const start = text.indexOf(para, searchStart);
    if (start !== -1) {
      offsets.push({ start, end: start + para.length });
      searchStart = start + para.length;
    } else {
      // Fallback - shouldn't happen but handle gracefully
      offsets.push({ start: searchStart, end: searchStart + para.length });
    }
  }

  return offsets;
}

// ═══════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Quick check if content likely has pasted sections
 * (cheaper than full analysis)
 */
export function quickPasteCheck(text: string): boolean {
  // Check for obvious structural indicators
  if (/```[\s\S]{20,}```/.test(text)) return true; // Code block
  if (/^\s*>\s.+\n\s*>\s/m.test(text)) return true; // Quote block
  if (/\|.+\|\n\|[-:\s|]+\|/m.test(text)) return true; // Table
  if (/^\s*\d+\.\s.+\n\s*\d+\.\s/m.test(text)) return true; // Numbered list

  return false;
}

/**
 * Merge overlapping paste segments
 */
export function mergeOverlappingSegments(
  segments: PasteSegment[]
): PasteSegment[] {
  if (segments.length <= 1) return segments;

  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const merged: PasteSegment[] = [];

  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    if (next.start <= current.end) {
      // Overlapping - merge
      const combinedReasons = [...new Set([...current.reasons, ...next.reasons])];
      current = {
        start: current.start,
        end: Math.max(current.end, next.end),
        text: '', // Will be recomputed
        pasteConfidence: Math.max(current.pasteConfidence, next.pasteConfidence),
        reasons: combinedReasons,
        hash: '', // Will be recomputed
      };
    } else {
      merged.push(current);
      current = next;
    }
  }

  merged.push(current);
  return merged;
}
