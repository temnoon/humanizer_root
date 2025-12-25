/**
 * Sentence Tokenizer
 *
 * The sentence is the atom of narrative - the quantum of semantic exchange.
 * This module splits text into sentences while preserving context.
 */

import type { Sentence, SentenceSource } from '../types/index.js';

export interface TokenizeOptions {
  /** Preserve paragraph boundaries in output */
  preserveParagraphs?: boolean;

  /** Source metadata to attach */
  source?: Omit<SentenceSource, 'id'>;

  /** Minimum sentence length to include */
  minLength?: number;
}

/**
 * Split text into sentences
 *
 * Uses a robust approach that handles:
 * - Standard punctuation (. ! ?)
 * - Abbreviations (Mr., Dr., etc.)
 * - Quoted speech
 * - Ellipses
 */
export function tokenize(
  text: string,
  options: TokenizeOptions = {}
): Sentence[] {
  const { minLength = 3 } = options;

  const sentences: Sentence[] = [];

  // Preprocessing: normalize whitespace
  const normalized = text.replace(/\s+/g, ' ').trim();

  // Split on sentence boundaries
  // This regex looks for:
  // - Period, exclamation, or question mark
  // - Followed by space and capital letter (or end of string)
  // But NOT after common abbreviations

  const abbrevPatterns = [
    'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sr', 'Jr',
    'vs', 'etc', 'e\\.g', 'i\\.e', 'cf',
    'Inc', 'Ltd', 'Co', 'Corp',
    'Jan', 'Feb', 'Mar', 'Apr', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ].join('|');

  const abbrevRegex = new RegExp(`\\b(${abbrevPatterns})\\.`, 'g');

  // Protect abbreviations by replacing them temporarily
  const protected_ = normalized.replace(
    abbrevRegex,
    (match) => match.replace('.', '<<<DOT>>>')
  );

  // Split on sentence-ending punctuation
  const parts = protected_.split(/(?<=[.!?])\s+(?=[A-Z])/);

  let currentOffset = 0;

  for (let i = 0; i < parts.length; i++) {
    // Restore protected dots
    const sentenceText = parts[i].replace(/<<<DOT>>>/g, '.').trim();

    if (sentenceText.length >= minLength) {
      // Find the actual offset in the original text
      const offset = text.indexOf(sentenceText, currentOffset);
      currentOffset = offset + sentenceText.length;

      const sentence: Sentence = {
        text: sentenceText,
        index: sentences.length,
        offset: offset >= 0 ? offset : currentOffset,
        length: sentenceText.length,
      };

      if (options.source) {
        sentence.source = {
          ...options.source,
          id: `${options.source.archiveType}-${sentences.length}`,
        };
      }

      sentences.push(sentence);
    }
  }

  return sentences;
}

/**
 * Join sentences back into text
 */
export function join(sentences: Sentence[]): string {
  return sentences.map((s) => s.text).join(' ');
}

/**
 * Group sentences into chunks of approximately N sentences
 */
export function chunk(
  sentences: Sentence[],
  targetSize: number = 10
): Sentence[][] {
  const chunks: Sentence[][] = [];
  let current: Sentence[] = [];

  for (const sentence of sentences) {
    current.push(sentence);

    if (current.length >= targetSize) {
      chunks.push(current);
      current = [];
    }
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

/**
 * Get statistics about tokenized sentences
 */
export function stats(sentences: Sentence[]): SentenceStats {
  if (sentences.length === 0) {
    return {
      count: 0,
      totalWords: 0,
      totalChars: 0,
      avgWords: 0,
      avgChars: 0,
      minWords: 0,
      maxWords: 0,
    };
  }

  const wordCounts = sentences.map(
    (s) => s.text.split(/\s+/).filter((w) => w.length > 0).length
  );
  const charCounts = sentences.map((s) => s.text.length);

  const totalWords = wordCounts.reduce((a, b) => a + b, 0);
  const totalChars = charCounts.reduce((a, b) => a + b, 0);

  return {
    count: sentences.length,
    totalWords,
    totalChars,
    avgWords: totalWords / sentences.length,
    avgChars: totalChars / sentences.length,
    minWords: Math.min(...wordCounts),
    maxWords: Math.max(...wordCounts),
  };
}

export interface SentenceStats {
  count: number;
  totalWords: number;
  totalChars: number;
  avgWords: number;
  avgChars: number;
  minWords: number;
  maxWords: number;
}
