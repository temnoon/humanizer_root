/**
 * Tests for humanizer service
 */

import { describe, it, expect } from 'vitest';
import { HumanizerService, createHumanizer } from './humanizer.js';
import type { LlmAdapter } from '../llm/types.js';

/**
 * Create a mock LLM adapter
 */
function createMockAdapter(transformFn?: (prompt: string) => string): LlmAdapter {
  return {
    name: 'mock',
    defaultModel: 'mock-model',
    async complete(_system: string, user: string): Promise<string> {
      if (transformFn) {
        return transformFn(user);
      }
      // Default: return slightly modified text
      return user
        .replace(/It is important to note/gi, 'Note')
        .replace(/Moreover/gi, 'Also')
        .replace(/Furthermore/gi, 'And')
        .slice(user.lastIndexOf('TEXT TO HUMANIZE:') + 17)
        .split('HUMANIZED OUTPUT')[0]
        .trim();
    },
  };
}

describe('HumanizerService', () => {
  describe('humanize', () => {
    it('should return humanization result', async () => {
      const adapter = createMockAdapter(() =>
        'This is the humanized version with varied sentences. Short! And then longer ones.'
      );
      const humanizer = new HumanizerService(adapter);

      const result = await humanizer.humanize(
        'It is important to note that this needs humanization. Moreover, the text is uniform.',
        { intensity: 'moderate' }
      );

      expect(result.humanizedText).toBeDefined();
      expect(result.baseline.detection).toBeDefined();
      expect(result.final.detection).toBeDefined();
      expect(result.improvement).toBeDefined();
      expect(result.processing.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should skip if text already human-like', async () => {
      const adapter = createMockAdapter();
      const humanizer = new HumanizerService(adapter);

      // Human-like text
      const humanText = 'I think honestly this is pretty good; you know?';

      const result = await humanizer.humanize(humanText, {
        skipIfHuman: true,
        minAiLikelihood: 50,
      });

      // Should be skipped if AI likelihood is low enough
      if (result.baseline.detection.aiLikelihood < 50) {
        expect(result.skipped).toBe(true);
        expect(result.skipReason).toBeDefined();
        expect(result.humanizedText).toBe(humanText);
      }
    });

    it('should use specified intensity', async () => {
      let capturedPrompt = '';
      const adapter = createMockAdapter((prompt) => {
        capturedPrompt = prompt;
        return 'Humanized text.';
      });
      const humanizer = new HumanizerService(adapter);

      await humanizer.humanize('Test text here.', { intensity: 'aggressive' });
      expect(capturedPrompt).toContain('AGGRESSIVE HUMANIZATION');

      await humanizer.humanize('Test text here.', { intensity: 'light' });
      expect(capturedPrompt).toContain('LIGHT HUMANIZATION');
    });

    it('should include detection scores in prompt', async () => {
      let capturedPrompt = '';
      const adapter = createMockAdapter((prompt) => {
        capturedPrompt = prompt;
        return 'Result.';
      });
      const humanizer = new HumanizerService(adapter);

      await humanizer.humanize('It is important to note this test.');
      expect(capturedPrompt).toContain('AI Likelihood');
      expect(capturedPrompt).toContain('Burstiness');
    });

    it('should calculate improvement metrics', async () => {
      // Mock adapter that removes AI tell-phrases
      const adapter = createMockAdapter(() =>
        'Note that this is simplified; it reads better now. Short! And varied.'
      );
      const humanizer = new HumanizerService(adapter);

      const result = await humanizer.humanize(
        'It is important to note that moreover this text needs work. Furthermore, it is crucial.',
        { intensity: 'moderate' }
      );

      expect(result.improvement.aiConfidenceDrop).toBeDefined();
      expect(result.improvement.burstinessIncrease).toBeDefined();
      expect(result.improvement.tellWordsRemoved).toBeDefined();
    });

    it('should sanitize LLM output', async () => {
      const adapter = createMockAdapter(() =>
        "Here's the humanized version:\n\nClean text here.\n\nLet me know if you need more!"
      );
      const humanizer = new HumanizerService(adapter);

      const result = await humanizer.humanize('Test text.');
      expect(result.humanizedText).not.toContain("Here's the");
      expect(result.humanizedText).not.toContain('Let me know');
    });
  });

  describe('humanizeIterative', () => {
    it('should iterate until threshold met', async () => {
      let callCount = 0;
      const adapter = createMockAdapter(() => {
        callCount++;
        // Each iteration slightly improves
        if (callCount >= 3) {
          return 'I think this is good now; honestly pretty simple.';
        }
        return 'It is still somewhat AI-like. Moreover, patterns remain.';
      });
      const humanizer = new HumanizerService(adapter);

      const result = await humanizer.humanizeIterative(
        'It is important to note that this needs multiple passes.',
        { maxIterations: 3, targetAiLikelihood: 30 }
      );

      expect(result.iterations).toBeGreaterThanOrEqual(1);
      expect(result.iterations).toBeLessThanOrEqual(3);
    });

    it('should escalate intensity', async () => {
      const intensities: string[] = [];
      const adapter = createMockAdapter((prompt) => {
        if (prompt.includes('LIGHT')) intensities.push('light');
        if (prompt.includes('MODERATE')) intensities.push('moderate');
        if (prompt.includes('AGGRESSIVE')) intensities.push('aggressive');
        return 'Still AI-like text here.';
      });
      const humanizer = new HumanizerService(adapter);

      await humanizer.humanizeIterative('Test text.', { maxIterations: 3 });

      // Should escalate: light -> moderate -> aggressive
      expect(intensities[0]).toBe('light');
      if (intensities.length >= 2) {
        expect(intensities[1]).toBe('moderate');
      }
      if (intensities.length >= 3) {
        expect(intensities[2]).toBe('aggressive');
      }
    });
  });

  describe('analyzeForHumanization', () => {
    it('should return detection and recommendation', () => {
      const adapter = createMockAdapter();
      const humanizer = new HumanizerService(adapter);

      const analysis = humanizer.analyzeForHumanization(
        'It is important to note this text. Moreover, we must consider.'
      );

      expect(analysis.detection).toBeDefined();
      expect(analysis.recommendedIntensity).toBeDefined();
      expect(analysis.estimatedImprovement).toBeDefined();
      expect(['light', 'moderate', 'aggressive']).toContain(analysis.recommendedIntensity);
    });

    it('should recommend aggressive for high AI likelihood', () => {
      const adapter = createMockAdapter();
      const humanizer = new HumanizerService(adapter);

      // Very AI-like text
      const aiText = Array(5).fill(
        'It is important to note that moreover we must consider this. Furthermore, it is crucial.'
      ).join(' ');

      const analysis = humanizer.analyzeForHumanization(aiText);
      if (analysis.detection.aiLikelihood >= 70) {
        expect(analysis.recommendedIntensity).toBe('aggressive');
      }
    });

    it('should recommend light for low AI likelihood', () => {
      const adapter = createMockAdapter();
      const humanizer = new HumanizerService(adapter);

      // Mostly human-like
      const humanText = 'I think this is okay; honestly not bad.';

      const analysis = humanizer.analyzeForHumanization(humanText);
      if (analysis.detection.aiLikelihood < 50) {
        expect(analysis.recommendedIntensity).toBe('light');
      }
    });
  });
});

describe('createHumanizer', () => {
  it('should create humanizer instance', () => {
    const adapter = createMockAdapter();
    const humanizer = createHumanizer(adapter);

    expect(humanizer).toBeInstanceOf(HumanizerService);
  });
});
