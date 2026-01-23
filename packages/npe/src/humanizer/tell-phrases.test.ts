/**
 * Tests for tell-phrase detection
 */

import { describe, it, expect } from 'vitest';
import {
  AI_TELL_PHRASES,
  HUMAN_TELL_PHRASES,
  scoreTellPhrases,
  getTopMatches,
  getReplacementSuggestions,
} from './tell-phrases.js';

describe('AI_TELL_PHRASES', () => {
  it('should have valid structure', () => {
    expect(AI_TELL_PHRASES.length).toBeGreaterThan(20);

    for (const phrase of AI_TELL_PHRASES) {
      expect(phrase.phrase).toBeDefined();
      expect(phrase.category).toBeDefined();
      expect(phrase.weight).toBeGreaterThan(0);
      expect(phrase.weight).toBeLessThanOrEqual(1);
      expect(phrase.direction).toBe('ai');
    }
  });

  it('should include common AI phrases', () => {
    const phrases = AI_TELL_PHRASES.map(p => p.phrase);
    expect(phrases).toContain('it is important to note');
    expect(phrases).toContain('moreover');
    expect(phrases).toContain('delve into');
  });
});

describe('HUMAN_TELL_PHRASES', () => {
  it('should have valid structure', () => {
    expect(HUMAN_TELL_PHRASES.length).toBeGreaterThan(10);

    for (const phrase of HUMAN_TELL_PHRASES) {
      expect(phrase.phrase).toBeDefined();
      expect(phrase.category).toBeDefined();
      expect(phrase.weight).toBeGreaterThan(0);
      expect(phrase.direction).toBe('human');
    }
  });

  it('should include common human phrases', () => {
    const phrases = HUMAN_TELL_PHRASES.map(p => p.phrase);
    expect(phrases).toContain('i think');
    expect(phrases).toContain('honestly');
    expect(phrases).toContain('you know');
  });
});

describe('scoreTellPhrases', () => {
  it('should return positive score for AI-heavy text', () => {
    const text = 'It is important to note that moreover, we should delve into this topic. Furthermore, it is crucial to understand.';
    const result = scoreTellPhrases(text);

    expect(result.score).toBeGreaterThan(0);
    expect(result.aiTellWeight).toBeGreaterThan(0);
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it('should return negative score for human-heavy text', () => {
    const text = 'I think, honestly, that this is kind of interesting. I mean, you know, it\'s pretty much what I expected.';
    const result = scoreTellPhrases(text);

    expect(result.score).toBeLessThan(0);
    expect(result.humanTellWeight).toBeGreaterThan(0);
  });

  it('should return zero for neutral text', () => {
    const text = 'The quick brown fox jumps over the lazy dog.';
    const result = scoreTellPhrases(text);

    expect(result.score).toBe(0);
    expect(result.matches.length).toBe(0);
  });

  it('should count multiple occurrences', () => {
    const text = 'Moreover, this is true. Moreover, that is also true. Moreover, we see a pattern.';
    const result = scoreTellPhrases(text);

    const moreoverMatch = result.matches.find(m => m.phrase === 'moreover');
    expect(moreoverMatch).toBeDefined();
    expect(moreoverMatch!.count).toBe(3);
    expect(moreoverMatch!.positions).toHaveLength(3);
  });

  it('should be case-insensitive', () => {
    const text = 'IT IS IMPORTANT TO NOTE that this works.';
    const result = scoreTellPhrases(text);

    expect(result.matches.some(m => m.phrase === 'it is important to note')).toBe(true);
  });

  it('should sort matches by weighted impact', () => {
    const text = 'Moreover, it is important to note this. Delve into the details.';
    const result = scoreTellPhrases(text);

    // Higher weight phrases should come first
    expect(result.matches.length).toBeGreaterThan(1);
    const weights = result.matches.map(m => m.weight * m.count);
    for (let i = 1; i < weights.length; i++) {
      expect(weights[i - 1]).toBeGreaterThanOrEqual(weights[i]);
    }
  });
});

describe('getTopMatches', () => {
  it('should return top N matches', () => {
    const text = 'Moreover, furthermore, additionally, it is important to note, delve into this.';
    const result = scoreTellPhrases(text);
    const top3 = getTopMatches(result, 3);

    expect(top3).toHaveLength(3);
  });

  it('should return all if fewer than N', () => {
    const text = 'Moreover, this is simple.';
    const result = scoreTellPhrases(text);
    const top5 = getTopMatches(result, 5);

    expect(top5.length).toBeLessThanOrEqual(1);
  });
});

describe('getReplacementSuggestions', () => {
  it('should return suggestions for AI phrases', () => {
    const text = 'It is important to note that moreover we should delve into this.';
    const result = scoreTellPhrases(text);
    const suggestions = getReplacementSuggestions(result);

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].phrase).toBeDefined();
    expect(suggestions[0].replacements.length).toBeGreaterThan(0);
  });

  it('should include positions', () => {
    const text = 'Moreover, we see that moreover is repeated.';
    const result = scoreTellPhrases(text);
    const suggestions = getReplacementSuggestions(result);

    const moreoverSuggestion = suggestions.find(s => s.phrase === 'moreover');
    expect(moreoverSuggestion).toBeDefined();
    expect(moreoverSuggestion!.positions.length).toBe(2);
  });

  it('should not include human phrases', () => {
    const text = 'I think honestly that this is good.';
    const result = scoreTellPhrases(text);
    const suggestions = getReplacementSuggestions(result);

    // Should be empty since human phrases shouldn't be replaced
    expect(suggestions.length).toBe(0);
  });
});
