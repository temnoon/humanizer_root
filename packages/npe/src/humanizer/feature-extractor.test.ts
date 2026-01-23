/**
 * Tests for feature extraction
 */

import { describe, it, expect } from 'vitest';
import {
  splitSentences,
  calculateBurstiness,
  analyzePunctuation,
  analyzeVocabulary,
  extractFeatures,
  featureSummary,
  compareToBaselines,
} from './feature-extractor.js';

describe('splitSentences', () => {
  it('should split on periods', () => {
    const sentences = splitSentences('Hello world. How are you. Fine thanks.');
    expect(sentences).toHaveLength(3);
    expect(sentences[0]).toBe('Hello world.');
    expect(sentences[1]).toBe('How are you.');
    expect(sentences[2]).toBe('Fine thanks.');
  });

  it('should split on question marks and exclamations', () => {
    const sentences = splitSentences('What is this? It is amazing! Yes.');
    expect(sentences).toHaveLength(3);
    expect(sentences[0]).toBe('What is this?');
    expect(sentences[1]).toBe('It is amazing!');
    expect(sentences[2]).toBe('Yes.');
  });

  it('should handle abbreviations', () => {
    const sentences = splitSentences('Dr. Smith went to the store. Mr. Jones followed.');
    expect(sentences).toHaveLength(2);
    expect(sentences[0]).toBe('Dr. Smith went to the store.');
  });

  it('should handle empty text', () => {
    const sentences = splitSentences('');
    expect(sentences).toHaveLength(0);
  });

  it('should handle text without sentence endings', () => {
    const sentences = splitSentences('Just a fragment');
    expect(sentences).toHaveLength(1);
    expect(sentences[0]).toBe('Just a fragment');
  });
});

describe('calculateBurstiness', () => {
  it('should return 0 for empty text', () => {
    const result = calculateBurstiness('');
    expect(result.burstiness).toBe(0);
    expect(result.sentenceCount).toBe(0);
  });

  it('should calculate low burstiness for uniform sentences', () => {
    // 5 sentences of ~5 words each
    const text = 'This is a test. Here is another one. And one more here. Yet another sentence too. Final sentence here now.';
    const result = calculateBurstiness(text);
    expect(result.burstiness).toBeLessThan(0.5);
  });

  it('should calculate high burstiness for varied sentences', () => {
    // Mix of short and long sentences
    const text = 'Short. This is a much longer sentence with many words in it that goes on and on. Tiny. Another very long sentence that has lots of words and keeps going for quite a while longer.';
    const result = calculateBurstiness(text);
    expect(result.burstiness).toBeGreaterThan(0.5);
  });

  it('should return correct metrics', () => {
    const text = 'One two three. Four five six seven.';
    const result = calculateBurstiness(text);
    expect(result.sentenceCount).toBe(2);
    expect(result.sentenceLengths).toEqual([3, 4]);
    expect(result.meanSentenceLength).toBe(3.5);
  });
});

describe('analyzePunctuation', () => {
  it('should count semicolons', () => {
    const text = 'First clause; second clause; third clause.';
    const result = analyzePunctuation(text);
    expect(result.counts.semicolons).toBe(2);
    expect(result.semicolonRate).toBeGreaterThan(0);
  });

  it('should count em-dashes', () => {
    const text = 'This—is an em-dash. Another one—here.';
    const result = analyzePunctuation(text);
    expect(result.counts.emDashes).toBe(2);
  });

  it('should calculate comma density', () => {
    const text = 'one, two, three, four, five';
    const result = analyzePunctuation(text);
    expect(result.commaDensity).toBeGreaterThan(0);
    expect(result.counts.commas).toBe(4);
  });

  it('should handle text with no punctuation', () => {
    const text = 'just words no punctuation here';
    const result = analyzePunctuation(text);
    expect(result.totalPunctuation).toBe(0);
    expect(result.semicolonRate).toBe(0);
  });
});

describe('analyzeVocabulary', () => {
  it('should calculate type-token ratio', () => {
    const text = 'the cat sat on the mat the cat';
    const result = analyzeVocabulary(text);
    // 8 tokens, 4 unique (the, cat, sat, on, mat)
    expect(result.wordCount).toBe(8);
    expect(result.uniqueWordCount).toBe(5);
    expect(result.typeTokenRatio).toBeCloseTo(5 / 8);
  });

  it('should calculate hapax ratio', () => {
    const text = 'one two two three three three';
    const result = analyzeVocabulary(text);
    // 3 unique words, 1 hapax (one)
    expect(result.hapaxRatio).toBeCloseTo(1 / 3);
  });

  it('should calculate n-gram diversity', () => {
    const text = 'a b c d e f g h i j';
    const result = analyzeVocabulary(text);
    expect(result.bigramDiversity).toBeGreaterThan(0.9); // All unique
    expect(result.trigramDiversity).toBeGreaterThan(0.9);
  });

  it('should handle empty text', () => {
    const result = analyzeVocabulary('');
    expect(result.wordCount).toBe(0);
    expect(result.typeTokenRatio).toBe(0);
  });
});

describe('extractFeatures', () => {
  it('should extract all feature categories', () => {
    const text = 'This is a test sentence. Another one here; with semicolons. Very short. And a longer one that goes on.';
    const features = extractFeatures(text);

    expect(features.burstiness).toBeDefined();
    expect(features.burstiness.sentenceCount).toBeGreaterThan(0);

    expect(features.punctuation).toBeDefined();
    expect(features.punctuation.counts.semicolons).toBe(1);

    expect(features.vocabulary).toBeDefined();
    expect(features.vocabulary.wordCount).toBeGreaterThan(0);

    expect(features.processingTimeMs).toBeGreaterThanOrEqual(0);
  });
});

describe('featureSummary', () => {
  it('should return flat summary object', () => {
    const features = extractFeatures('Test sentence one. Test sentence two.');
    const summary = featureSummary(features);

    expect(summary).toHaveProperty('burstiness');
    expect(summary).toHaveProperty('meanSentenceLength');
    expect(summary).toHaveProperty('semicolonRate');
    expect(summary).toHaveProperty('typeTokenRatio');
    expect(summary).toHaveProperty('wordCount');
  });
});

describe('compareToBaselines', () => {
  it('should identify human-like features', () => {
    const features = extractFeatures(
      'Short. This is a much longer sentence with great variation; notice the semicolon use. Tiny!'
    );
    const comparison = compareToBaselines(features);

    expect(comparison.humanLike).toBeDefined();
    expect(comparison.aiLike).toBeDefined();
    expect(comparison.neutral).toBeDefined();
  });

  it('should identify AI-like uniform sentences', () => {
    // AI-like: uniform sentence lengths
    const text = Array(10).fill('This is a medium length sentence here.').join(' ');
    const features = extractFeatures(text);
    const comparison = compareToBaselines(features);

    // Should flag low burstiness as AI-like
    const hasLowBurstiness = comparison.aiLike.some(s => s.includes('burstiness'));
    expect(hasLowBurstiness).toBe(true);
  });
});
