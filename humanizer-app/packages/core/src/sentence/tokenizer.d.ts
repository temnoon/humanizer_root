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
export declare function tokenize(text: string, options?: TokenizeOptions): Sentence[];
/**
 * Join sentences back into text
 */
export declare function join(sentences: Sentence[]): string;
/**
 * Group sentences into chunks of approximately N sentences
 */
export declare function chunk(sentences: Sentence[], targetSize?: number): Sentence[][];
/**
 * Get statistics about tokenized sentences
 */
export declare function stats(sentences: Sentence[]): SentenceStats;
export interface SentenceStats {
    count: number;
    totalWords: number;
    totalChars: number;
    avgWords: number;
    avgChars: number;
    minWords: number;
    maxWords: number;
}
//# sourceMappingURL=tokenizer.d.ts.map