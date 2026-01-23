/**
 * Tests for AI detection engine
 */

import { describe, it, expect } from 'vitest';
import { detect, detectQuick, explainResult } from './detector.js';

describe('detect', () => {
  it('should return complete detection result', () => {
    const text = 'This is a test sentence. Here is another one. And one more.';
    const result = detect(text);

    expect(result.aiLikelihood).toBeGreaterThanOrEqual(0);
    expect(result.aiLikelihood).toBeLessThanOrEqual(100);
    expect(['low', 'medium', 'high']).toContain(result.confidence);
    expect(['human', 'mixed', 'ai']).toContain(result.verdict);
    expect(result.features).toBeDefined();
    expect(result.extractedFeatures).toBeDefined();
    expect(result.tellPhrases).toBeDefined();
    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.detectorVersion).toBeDefined();
    expect(result.method).toBe('statistical');
  });

  it('should detect AI-like text', () => {
    // AI-like features: uniform sentences, no semicolons, AI tell-phrases
    const aiText = `It is important to note that this demonstrates a key concept. Furthermore, we should consider the implications carefully. Moreover, the evidence suggests significant findings. Additionally, the data indicates clear patterns. Consequently, we can draw meaningful conclusions.`;

    const result = detect(aiText);
    expect(result.aiLikelihood).toBeGreaterThan(50);
    expect(result.verdict).not.toBe('human');
  });

  it('should detect human-like text', () => {
    // Human-like: varied sentences, semicolons, human tell-phrases
    const humanText = `I think this is interesting; honestly, it's kind of weird. Short! But then you get these really long sentences that just go on and on with all sorts of interesting details and tangents. You know what I mean? Pretty much sums it up.`;

    const result = detect(humanText);
    expect(result.aiLikelihood).toBeLessThan(60);
  });

  it('should return sentence analysis when requested', () => {
    const text = 'First sentence here. Second sentence follows.';
    const result = detect(text, { returnSentenceAnalysis: true });

    expect(result.sentenceAnalysis).toBeDefined();
    expect(result.sentenceAnalysis!.length).toBe(2);
    expect(result.sentenceAnalysis![0].text).toBe('First sentence here.');
    expect(result.sentenceAnalysis![0].wordCount).toBe(3);
    expect(result.sentenceAnalysis![0].aiLikelihood).toBeGreaterThanOrEqual(0);
  });

  it('should return humanization recommendations', () => {
    // Text with issues
    const text = `It is important to note that this is a test. Furthermore, we must consider the implications. Moreover, the data suggests patterns. Additionally, we observe trends.`;

    const result = detect(text, { returnHumanizationRecommendations: true });
    expect(result.humanizationRecommendations).toBeDefined();
    expect(result.humanizationRecommendations.length).toBeGreaterThan(0);

    const rec = result.humanizationRecommendations[0];
    expect(rec.type).toBeDefined();
    expect(rec.priority).toBeDefined();
    expect(rec.description).toBeDefined();
  });

  it('should set low confidence for short text', () => {
    const shortText = 'Very short text.';
    const result = detect(shortText, { minTextLength: 100 });

    expect(result.confidence).toBe('low');
  });

  it('should set high confidence for long text with many sentences', () => {
    // Need >500 chars and >=5 sentences for high confidence
    const longText = Array(10).fill('This is a longer test sentence with several additional words to make it longer.').join(' ');
    const result = detect(longText);

    // Verify we have enough content
    expect(longText.length).toBeGreaterThan(500);
    expect(result.extractedFeatures.burstiness.sentenceCount).toBeGreaterThanOrEqual(5);
    expect(result.confidence).toBe('high');
  });

  it('should include all feature scores', () => {
    const text = 'Sample text for testing; includes semicolons. Short! And longer sentences too.';
    const result = detect(text);

    expect(result.features.burstiness).toBeDefined();
    expect(result.features.semicolonRate).toBeDefined();
    expect(result.features.emDashRate).toBeDefined();
    expect(result.features.tellPhraseScore).toBeDefined();
    expect(result.features.ngramDiversity).toBeDefined();
  });
});

describe('detectQuick', () => {
  it('should return only likelihood and verdict', () => {
    const text = 'This is a quick test sentence.';
    const result = detectQuick(text);

    expect(result.aiLikelihood).toBeGreaterThanOrEqual(0);
    expect(result.aiLikelihood).toBeLessThanOrEqual(100);
    expect(['human', 'mixed', 'ai']).toContain(result.verdict);

    // Should not have extra properties
    expect(Object.keys(result)).toHaveLength(2);
  });

  it('should match full detect likelihood', () => {
    const text = 'Test text for comparison purposes here.';
    const quick = detectQuick(text);
    const full = detect(text);

    expect(quick.aiLikelihood).toBe(full.aiLikelihood);
    expect(quick.verdict).toBe(full.verdict);
  });
});

describe('explainResult', () => {
  it('should return human-readable explanation', () => {
    const text = 'This is a test. It is important to note that this matters.';
    const result = detect(text);
    const explanation = explainResult(result);

    expect(explanation).toContain('AI Likelihood');
    expect(explanation).toContain('Confidence');
    expect(explanation).toContain('Key Features');
  });

  it('should include verdict', () => {
    const text = 'Short text here.';
    const result = detect(text);
    const explanation = explainResult(result);

    expect(explanation).toMatch(/human|mixed|ai/);
  });

  it('should list tell-phrases if present', () => {
    const text = 'It is important to note that moreover we should consider this.';
    const result = detect(text);
    const explanation = explainResult(result);

    expect(explanation).toContain('Tell-Phrases');
  });
});

describe('detection thresholds', () => {
  it('should classify high AI likelihood as "ai"', () => {
    // Construct text that should score very high
    const aiText = Array(10).fill(
      'It is important to note that moreover this is crucial. Furthermore, we must consider this carefully.'
    ).join(' ');

    const result = detect(aiText);
    if (result.aiLikelihood >= 60) {
      expect(result.verdict).toBe('ai');
    }
  });

  it('should classify low AI likelihood as "human"', () => {
    // Construct varied, human-like text
    const humanText = `I think honestly this is pretty wild; you know what I mean? Super short! And then there's this massive long sentence that just keeps going with all sorts of asides and tangents and stuff that real people actually write when they're just typing freely without editing.`;

    const result = detect(humanText);
    if (result.aiLikelihood <= 35) {
      expect(result.verdict).toBe('human');
    }
  });

  it('should classify middle range as "mixed"', () => {
    // Text with some AI and some human characteristics
    const mixedText = `It is important to note some things. But honestly, I think this is kind of interesting? The patterns suggest trends. You know, maybe not.`;

    const result = detect(mixedText);
    if (result.aiLikelihood > 35 && result.aiLikelihood < 60) {
      expect(result.verdict).toBe('mixed');
    }
  });
});
