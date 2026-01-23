/**
 * Book Agent Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BookAgent, createBookAgent } from './book-agent.js';
import { MockLlmAdapter } from '../llm/mock-adapter.js';

describe('BookAgent', () => {
  let agent: BookAgent;
  let mockAdapter: MockLlmAdapter;
  let mockEmbedder: (text: string) => Promise<number[]>;

  beforeEach(() => {
    mockAdapter = new MockLlmAdapter();
    // Simple mock embedder that creates deterministic embeddings from text
    mockEmbedder = async (text: string) => {
      const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return Array(768).fill(0).map((_, i) => Math.sin(hash + i) * 0.5 + 0.5);
    };
    agent = createBookAgent(mockAdapter, mockEmbedder, { verbose: false });
  });

  describe('analyzeRho', () => {
    it('should analyze text and return Rho trajectory', async () => {
      const text = 'The quantum state evolves. Each measurement changes it. This is the nature of observation.';

      const analysis = await agent.analyzeRho(text);

      expect(analysis.initialState).toBeDefined();
      expect(analysis.finalState).toBeDefined();
      expect(analysis.steps.length).toBe(3); // 3 sentences
      expect(analysis.purityTrajectory.length).toBe(4); // initial + 3 steps
      expect(analysis.entropyTrajectory.length).toBe(4);
      expect(analysis.quality).toMatch(/^(high|medium|low)$/);
    });

    it('should identify load-bearing sentences', async () => {
      const text = 'First sentence. The crucial insight emerges here. Final thought.';

      const analysis = await agent.analyzeRho(text);

      expect(analysis.loadBearingSentences.length).toBeGreaterThan(0);
      expect(analysis.loadBearingSentences[0]).toHaveProperty('index');
      expect(analysis.loadBearingSentences[0]).toHaveProperty('sentence');
      expect(analysis.loadBearingSentences[0]).toHaveProperty('distance');
    });
  });

  describe('transformWithPersona', () => {
    it('should transform text with persona and track quality', async () => {
      const text = 'The data shows clear patterns. Analysis reveals important insights.';
      const persona = {
        name: 'Research Scientist',
        systemPrompt: 'An analytical mind focused on evidence and precision.',
      };

      const result = await agent.transformWithPersona(text, persona);

      expect(result.originalAnalysis).toBeDefined();
      expect(result.finalAnalysis).toBeDefined();
      expect(result.attempts.length).toBeGreaterThan(0);
      expect(result.totalDurationMs).toBeGreaterThan(0);
      expect(result.qualityDelta).toHaveProperty('purity');
      expect(result.qualityDelta).toHaveProperty('entropy');
    });
  });

  describe('transformWithStyle', () => {
    it('should transform text with style and track quality', async () => {
      const text = 'This is a simple statement. It conveys basic information.';
      const style = {
        name: 'Formal Academic',
        stylePrompt: 'Academic prose with complex sentences, passive voice, and hedging.',
      };

      const result = await agent.transformWithStyle(text, style);

      expect(result.originalAnalysis).toBeDefined();
      expect(result.attempts.length).toBeGreaterThan(0);
    });
  });

  describe('transformPipeline', () => {
    it('should apply multiple transformations with quality gates', async () => {
      const text = 'Original narrative content. It has multiple sentences. Each one matters.';

      const result = await agent.transformPipeline(text, [
        {
          type: 'persona',
          definition: {
            name: 'Storyteller',
            systemPrompt: 'An engaging narrative voice with vivid vocabulary.',
          },
        },
        {
          type: 'style',
          definition: {
            name: 'Literary',
            stylePrompt: 'Rich prose with metaphor and imagery.',
          },
        },
      ]);

      expect(result.stages.length).toBeGreaterThan(0);
      expect(result.totalDurationMs).toBeGreaterThan(0);
    });
  });

  describe('findLoadBearingSentences', () => {
    it('should find sentences with highest semantic weight', async () => {
      const text = 'Setup context. The key revelation changes everything. Conclusion follows.';

      const loadBearing = await agent.findLoadBearingSentences(text, 3);

      expect(loadBearing.length).toBeLessThanOrEqual(3);
      loadBearing.forEach((item) => {
        expect(item).toHaveProperty('index');
        expect(item).toHaveProperty('sentence');
        expect(item).toHaveProperty('weight');
        expect(item).toHaveProperty('fragility');
        expect(item.fragility).toMatch(/^(high|medium|low)$/);
      });

      // Should be sorted by weight descending
      for (let i = 1; i < loadBearing.length; i++) {
        expect(loadBearing[i - 1].weight).toBeGreaterThanOrEqual(loadBearing[i].weight);
      }
    });
  });

  describe('quality thresholds', () => {
    it('should respect custom thresholds', () => {
      const customAgent = createBookAgent(mockAdapter, mockEmbedder, {
        thresholds: {
          minPurity: 0.2,
          maxEntropy: 2.5,
          maxPurityDrop: 0.05,
          maxEntropyIncrease: 0.2,
        },
      });

      expect(customAgent).toBeInstanceOf(BookAgent);
    });

    it('should respect custom retry config', () => {
      const customAgent = createBookAgent(mockAdapter, mockEmbedder, {
        retry: {
          maxRetries: 5,
          temperatureAdjustment: -0.05,
          tryAlternatives: false,
        },
      });

      expect(customAgent).toBeInstanceOf(BookAgent);
    });
  });
});
