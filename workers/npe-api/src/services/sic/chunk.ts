/**
 * Subjective Intentional Constraint (SIC) - Chunking Utilities
 *
 * Utilities for text segmentation, JSON parsing, and numeric clamping.
 * Designed to be fast and deterministic (no LLM calls).
 */

import type { TextChunk } from './types';

/**
 * Split text into chunks of approximately the target sentence count
 * Attempts to preserve paragraph boundaries where possible
 *
 * @param text - The text to chunk
 * @param targetSentences - Target sentences per chunk (default: 8-15)
 * @returns Array of TextChunk objects
 */
export function chunkText(
  text: string,
  targetSentences: number = 10
): TextChunk[] {
  const chunks: TextChunk[] = [];

  // Split into paragraphs first
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  let currentChunk: string[] = [];
  let currentSentenceCount = 0;
  let currentStartIndex = 0;
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const sentences = splitIntoSentences(paragraph);

    // If adding this paragraph would exceed target, flush current chunk
    if (
      currentSentenceCount > 0 &&
      currentSentenceCount + sentences.length > targetSentences * 1.5
    ) {
      const chunkText = currentChunk.join('\n\n');
      chunks.push({
        id: `chunk_${chunkIndex}`,
        text: chunkText,
        startIndex: currentStartIndex,
        endIndex: currentStartIndex + chunkText.length,
        sentenceCount: currentSentenceCount,
      });
      chunkIndex++;
      currentChunk = [];
      currentSentenceCount = 0;
      currentStartIndex = text.indexOf(paragraph);
    }

    currentChunk.push(paragraph);
    currentSentenceCount += sentences.length;

    // If we've hit the target, flush
    if (currentSentenceCount >= targetSentences) {
      const chunkText = currentChunk.join('\n\n');
      chunks.push({
        id: `chunk_${chunkIndex}`,
        text: chunkText,
        startIndex: currentStartIndex,
        endIndex: currentStartIndex + chunkText.length,
        sentenceCount: currentSentenceCount,
      });
      chunkIndex++;
      currentChunk = [];
      currentSentenceCount = 0;
      currentStartIndex = text.indexOf(paragraph) + paragraph.length;
    }
  }

  // Flush remaining
  if (currentChunk.length > 0) {
    const chunkText = currentChunk.join('\n\n');
    chunks.push({
      id: `chunk_${chunkIndex}`,
      text: chunkText,
      startIndex: currentStartIndex,
      endIndex: currentStartIndex + chunkText.length,
      sentenceCount: currentSentenceCount,
    });
  }

  // If we ended up with no chunks (very short text), treat whole text as one chunk
  if (chunks.length === 0) {
    const sentences = splitIntoSentences(text);
    chunks.push({
      id: 'chunk_0',
      text: text.trim(),
      startIndex: 0,
      endIndex: text.length,
      sentenceCount: sentences.length,
    });
  }

  return chunks;
}

/**
 * Split text into sentences
 * Handles common edge cases like abbreviations and decimal numbers
 *
 * @param text - The text to split
 * @returns Array of sentence strings
 */
export function splitIntoSentences(text: string): string[] {
  // Common abbreviations that shouldn't end sentences
  const abbreviations = [
    'Mr',
    'Mrs',
    'Ms',
    'Dr',
    'Prof',
    'Sr',
    'Jr',
    'vs',
    'etc',
    'e.g',
    'i.e',
    'cf',
    'al',
    'Inc',
    'Ltd',
    'Co',
    'Corp',
    'St',
    'Ave',
    'Blvd',
  ];

  // Protect abbreviations by temporarily replacing their periods
  let processedText = text;
  for (const abbr of abbreviations) {
    const regex = new RegExp(`\\b${abbr}\\.`, 'gi');
    processedText = processedText.replace(regex, `${abbr}<<DOT>>`);
  }

  // Protect decimal numbers
  processedText = processedText.replace(/(\d)\.(\d)/g, '$1<<DOT>>$2');

  // Protect ellipses
  processedText = processedText.replace(/\.{3}/g, '<<ELLIPSIS>>');

  // Split on sentence-ending punctuation followed by space and capital
  const sentences = processedText
    .split(/(?<=[.!?])\s+(?=[A-Z])/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Restore protected sequences
  return sentences.map((s) =>
    s.replace(/<<DOT>>/g, '.').replace(/<<ELLIPSIS>>/g, '...')
  );
}

/**
 * Clamp a number to a range
 *
 * @param value - The value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Safely parse JSON with fallback
 * Handles common LLM output issues like markdown fences and preambles
 *
 * @param text - The text to parse as JSON
 * @param fallback - Fallback value if parsing fails
 * @returns Parsed object or fallback
 */
export function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    // Try direct parse first
    return JSON.parse(text);
  } catch {
    // Try to extract JSON from markdown fences
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      try {
        return JSON.parse(fenceMatch[1].trim());
      } catch {
        // Continue to other strategies
      }
    }

    // Try to find JSON object in the text
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        // Continue
      }
    }

    // Try to find JSON array
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch {
        // Continue
      }
    }

    return fallback;
  }
}

/**
 * Normalize LLM response by stripping common artifacts
 *
 * @param response - The raw LLM response
 * @returns Cleaned response
 */
export function normalizeResponse(response: string): string {
  let cleaned = response;

  // Remove XML-style thinking tags
  cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  cleaned = cleaned.replace(/<reflection>[\s\S]*?<\/reflection>/gi, '');
  cleaned = cleaned.replace(/<analysis>[\s\S]*?<\/analysis>/gi, '');

  // Remove markdown code fences if wrapping JSON
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/i, '');

  // Remove common preambles
  const preambles = [
    /^(?:Here(?:'s| is) (?:the|my|an?) (?:response|answer|analysis|output|result)[:\.]?\s*)/i,
    /^(?:I'll |Let me |I will |I would )/i,
    /^(?:Sure[,!]? |Certainly[,!]? |Of course[,!]? )/i,
    /^(?:Based on (?:the |my |your )?(?:text|analysis|input)[,:]?\s*)/i,
  ];

  for (const preamble of preambles) {
    cleaned = cleaned.replace(preamble, '');
  }

  return cleaned.trim();
}

/**
 * Extract a short quote from text, truncating if necessary
 *
 * @param text - The source text
 * @param maxWords - Maximum words in the quote (default: 25)
 * @returns Truncated quote
 */
export function extractShortQuote(text: string, maxWords: number = 25): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) {
    return text.trim();
  }
  return words.slice(0, maxWords).join(' ') + '...';
}

/**
 * Calculate basic text statistics
 *
 * @param text - The text to analyze
 * @returns Statistics object
 */
export function calculateTextStats(text: string): {
  wordCount: number;
  sentenceCount: number;
  avgWordsPerSentence: number;
  paragraphCount: number;
} {
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
  const sentences = splitIntoSentences(text);
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    avgWordsPerSentence:
      sentences.length > 0 ? words.length / sentences.length : 0,
    paragraphCount: paragraphs.length,
  };
}

/**
 * Quick heuristic checks for SIC signals
 * These can run without LLM calls for fast screening
 */
export const QUICK_HEURISTICS = {
  /**
   * Lexicon suggesting irreversibility/commitment
   */
  irreversibilityLexicon: [
    'commit',
    'decide',
    'cannot undo',
    'regret',
    'cost',
    'consequence',
    'irreversible',
    'never again',
    'point of no return',
    'sealed',
    'final',
    'permanent',
  ],

  /**
   * Temporal markers suggesting lived time
   */
  temporalMarkers: [
    'suddenly',
    'before I could',
    'too late',
    'in that moment',
    'afterward',
    'just then',
    'at that instant',
    'before I knew it',
  ],

  /**
   * Epistemic reversal patterns
   */
  epistemicReversals: [
    /I thought .+ but/i,
    /I assumed/i,
    /turns out/i,
    /I was wrong/i,
    /I didn't realize/i,
    /I had no idea/i,
    /it never occurred to me/i,
  ],

  /**
   * Tradeoff markers
   */
  tradeoffMarkers: [
    'rather than',
    'instead of',
    'had to choose',
    'at the expense of',
    'sacrifice',
    'give up',
    'couldn\'t have both',
  ],

  /**
   * Manager voice indicators (negative signal)
   */
  managerVoice: [
    'in conclusion',
    'it is important to note',
    'overall',
    'this suggests',
    'key takeaway',
    'to summarize',
    'in summary',
    'the main point',
  ],

  /**
   * Symmetry obsession (negative signal)
   */
  symmetryPatterns: [
    /on (?:the )?one hand.*on (?:the )?other hand/i,
    /balanced/i,
    /nuanced/i,
    /various perspectives/i,
    /pros and cons/i,
    /advantages and disadvantages/i,
  ],
};

/**
 * Run quick heuristic analysis on text
 * Returns preliminary signals before LLM analysis
 *
 * @param text - The text to analyze
 * @returns Heuristic scores
 */
export function runQuickHeuristics(text: string): {
  irreversibilitySignals: number;
  temporalSignals: number;
  epistemicReversalSignals: number;
  tradeoffSignals: number;
  managerVoiceSignals: number;
  symmetrySignals: number;
} {
  const textLower = text.toLowerCase();

  const countMatches = (patterns: (string | RegExp)[]): number => {
    let count = 0;
    for (const pattern of patterns) {
      if (typeof pattern === 'string') {
        const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const matches = text.match(regex);
        count += matches ? matches.length : 0;
      } else {
        const matches = text.match(pattern);
        count += matches ? matches.length : 0;
      }
    }
    return count;
  };

  return {
    irreversibilitySignals: countMatches(QUICK_HEURISTICS.irreversibilityLexicon),
    temporalSignals: countMatches(QUICK_HEURISTICS.temporalMarkers),
    epistemicReversalSignals: countMatches(QUICK_HEURISTICS.epistemicReversals),
    tradeoffSignals: countMatches(QUICK_HEURISTICS.tradeoffMarkers),
    managerVoiceSignals: countMatches(QUICK_HEURISTICS.managerVoice),
    symmetrySignals: countMatches(QUICK_HEURISTICS.symmetryPatterns),
  };
}
