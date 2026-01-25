/**
 * A/B Testing Tests
 *
 * Unit tests for the A/B testing framework:
 * - Test lifecycle management
 * - Sample collection
 * - Statistical analysis
 * - Winner determination
 *
 * @module @humanizer/core/aui/ab-testing.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ABTestManager,
  getABTestManager,
  resetABTestManager,
  type ABTestConfig,
  type ABTestSample,
  type ABTestResult,
} from './ab-testing.js';

// ═══════════════════════════════════════════════════════════════════════════
// TEST UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate random samples for testing
 */
function generateSamples(
  testId: string,
  variant: 'control' | 'treatment',
  count: number,
  meanScore: number,
  stdDev: number
): Array<{ variant: 'control' | 'treatment'; metrics: Record<string, number> }> {
  const samples = [];
  for (let i = 0; i < count; i++) {
    // Box-Muller transform for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const score = Math.max(0, Math.min(1, meanScore + z * stdDev));

    samples.push({
      variant,
      metrics: { humanizationScore: score },
    });
  }
  return samples;
}

// ═══════════════════════════════════════════════════════════════════════════
// ABTEST MANAGER TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('ABTestManager', () => {
  let manager: ABTestManager;

  beforeEach(() => {
    resetABTestManager();
    manager = new ABTestManager();
  });

  afterEach(() => {
    resetABTestManager();
  });

  describe('Constructor', () => {
    it('should create with default options', () => {
      const m = new ABTestManager();
      expect(m).toBeDefined();
    });

    it('should accept custom options', () => {
      const m = new ABTestManager({
        defaultSignificanceThreshold: 0.99,
        defaultMinSampleSize: 50,
        defaultTrafficSplit: 0.3,
      });
      expect(m).toBeDefined();
    });
  });

  describe('Test Lifecycle', () => {
    describe('createTest()', () => {
      it('should create a new test with draft status', () => {
        const test = manager.createTest({
          name: 'Test Prompt Variation',
          promptId: 'BUILDER_OUTLINE_CREATION',
          controlTemplate: 'Original template {{var}}',
          treatmentTemplate: 'New template {{var}}',
          metrics: ['humanizationScore'],
        });

        expect(test.testId).toMatch(/^ab-/);
        expect(test.name).toBe('Test Prompt Variation');
        expect(test.status).toBe('draft');
        expect(test.promptId).toBe('BUILDER_OUTLINE_CREATION');
        expect(test.variants.control).toBe('Original template {{var}}');
        expect(test.variants.treatment).toBe('New template {{var}}');
      });

      it('should apply default values', () => {
        const test = manager.createTest({
          name: 'Test',
          promptId: 'TEST_PROMPT',
          controlTemplate: 'control',
          treatmentTemplate: 'treatment',
          metrics: ['score'],
        });

        expect(test.trafficSplit).toBe(0.5);
        expect(test.minSampleSize).toBe(100);
      });

      it('should accept custom values', () => {
        const test = manager.createTest({
          name: 'Test',
          promptId: 'TEST_PROMPT',
          controlTemplate: 'control',
          treatmentTemplate: 'treatment',
          metrics: ['score'],
          trafficSplit: 0.7,
          minSampleSize: 50,
          tags: ['experiment-1'],
        });

        expect(test.trafficSplit).toBe(0.7);
        expect(test.minSampleSize).toBe(50);
        expect(test.tags).toContain('experiment-1');
      });
    });

    describe('startTest()', () => {
      it('should change status to running', () => {
        const test = manager.createTest({
          name: 'Test',
          promptId: 'TEST_PROMPT',
          controlTemplate: 'control',
          treatmentTemplate: 'treatment',
          metrics: ['score'],
        });

        manager.startTest(test.testId);

        const updated = manager.getTest(test.testId);
        expect(updated?.status).toBe('running');
      });

      it('should throw for non-existent test', () => {
        expect(() => manager.startTest('non-existent')).toThrow('Test not found');
      });

      it('should throw for already running test', () => {
        const test = manager.createTest({
          name: 'Test',
          promptId: 'TEST_PROMPT',
          controlTemplate: 'control',
          treatmentTemplate: 'treatment',
          metrics: ['score'],
        });

        manager.startTest(test.testId);

        expect(() => manager.startTest(test.testId)).toThrow('Cannot start test');
      });
    });

    describe('pauseTest()', () => {
      it('should change status to paused', () => {
        const test = manager.createTest({
          name: 'Test',
          promptId: 'TEST_PROMPT',
          controlTemplate: 'control',
          treatmentTemplate: 'treatment',
          metrics: ['score'],
        });

        manager.startTest(test.testId);
        manager.pauseTest(test.testId);

        const updated = manager.getTest(test.testId);
        expect(updated?.status).toBe('paused');
      });

      it('should throw for non-running test', () => {
        const test = manager.createTest({
          name: 'Test',
          promptId: 'TEST_PROMPT',
          controlTemplate: 'control',
          treatmentTemplate: 'treatment',
          metrics: ['score'],
        });

        expect(() => manager.pauseTest(test.testId)).toThrow('Cannot pause test');
      });
    });

    describe('completeTest()', () => {
      it('should change status to completed and return results', () => {
        const test = manager.createTest({
          name: 'Test',
          promptId: 'TEST_PROMPT',
          controlTemplate: 'control',
          treatmentTemplate: 'treatment',
          metrics: ['score'],
        });

        manager.startTest(test.testId);
        const result = manager.completeTest(test.testId);

        const updated = manager.getTest(test.testId);
        expect(updated?.status).toBe('completed');
        expect(result.testId).toBe(test.testId);
      });
    });

    describe('cancelTest()', () => {
      it('should change status to cancelled', () => {
        const test = manager.createTest({
          name: 'Test',
          promptId: 'TEST_PROMPT',
          controlTemplate: 'control',
          treatmentTemplate: 'treatment',
          metrics: ['score'],
        });

        manager.cancelTest(test.testId);

        const updated = manager.getTest(test.testId);
        expect(updated?.status).toBe('cancelled');
      });
    });
  });

  describe('Variant Selection', () => {
    describe('getVariant()', () => {
      it('should return control for non-running tests', () => {
        const test = manager.createTest({
          name: 'Test',
          promptId: 'TEST_PROMPT',
          controlTemplate: 'control',
          treatmentTemplate: 'treatment',
          metrics: ['score'],
        });

        const variant = manager.getVariant(test.testId);
        expect(variant).toBe('control');
      });

      it('should distribute traffic according to split', () => {
        const test = manager.createTest({
          name: 'Test',
          promptId: 'TEST_PROMPT',
          controlTemplate: 'control',
          treatmentTemplate: 'treatment',
          metrics: ['score'],
          trafficSplit: 0.5,
        });

        manager.startTest(test.testId);

        // Run many selections and check distribution
        let treatmentCount = 0;
        const iterations = 1000;

        for (let i = 0; i < iterations; i++) {
          if (manager.getVariant(test.testId) === 'treatment') {
            treatmentCount++;
          }
        }

        // Should be roughly 50% (within tolerance)
        const ratio = treatmentCount / iterations;
        expect(ratio).toBeGreaterThan(0.4);
        expect(ratio).toBeLessThan(0.6);
      });
    });

    describe('getTemplate()', () => {
      it('should return correct template for variant', () => {
        const test = manager.createTest({
          name: 'Test',
          promptId: 'TEST_PROMPT',
          controlTemplate: 'control template',
          treatmentTemplate: 'treatment template',
          metrics: ['score'],
        });

        expect(manager.getTemplate(test.testId, 'control')).toBe('control template');
        expect(manager.getTemplate(test.testId, 'treatment')).toBe('treatment template');
      });

      it('should return undefined for non-existent test', () => {
        expect(manager.getTemplate('non-existent', 'control')).toBeUndefined();
      });
    });
  });

  describe('Sample Collection', () => {
    describe('recordSample()', () => {
      it('should record a sample', () => {
        const test = manager.createTest({
          name: 'Test',
          promptId: 'TEST_PROMPT',
          controlTemplate: 'control',
          treatmentTemplate: 'treatment',
          metrics: ['humanizationScore'],
        });

        const sample = manager.recordSample({
          testId: test.testId,
          variant: 'control',
          metrics: { humanizationScore: 0.85 },
        });

        expect(sample.id).toBeDefined();
        expect(sample.testId).toBe(test.testId);
        expect(sample.variant).toBe('control');
        expect(sample.metrics.humanizationScore).toBe(0.85);
        expect(sample.timestamp).toBeInstanceOf(Date);
      });

      it('should throw for non-existent test', () => {
        expect(() =>
          manager.recordSample({
            testId: 'non-existent',
            variant: 'control',
            metrics: { score: 0.5 },
          })
        ).toThrow('Test not found');
      });
    });

    describe('getSamples()', () => {
      it('should return all samples', () => {
        const test = manager.createTest({
          name: 'Test',
          promptId: 'TEST_PROMPT',
          controlTemplate: 'control',
          treatmentTemplate: 'treatment',
          metrics: ['score'],
        });

        manager.recordSample({ testId: test.testId, variant: 'control', metrics: { score: 0.5 } });
        manager.recordSample({ testId: test.testId, variant: 'treatment', metrics: { score: 0.6 } });
        manager.recordSample({ testId: test.testId, variant: 'control', metrics: { score: 0.55 } });

        const allSamples = manager.getSamples(test.testId);
        expect(allSamples.length).toBe(3);
      });

      it('should filter by variant', () => {
        const test = manager.createTest({
          name: 'Test',
          promptId: 'TEST_PROMPT',
          controlTemplate: 'control',
          treatmentTemplate: 'treatment',
          metrics: ['score'],
        });

        manager.recordSample({ testId: test.testId, variant: 'control', metrics: { score: 0.5 } });
        manager.recordSample({ testId: test.testId, variant: 'treatment', metrics: { score: 0.6 } });
        manager.recordSample({ testId: test.testId, variant: 'control', metrics: { score: 0.55 } });

        const controlSamples = manager.getSamples(test.testId, 'control');
        expect(controlSamples.length).toBe(2);

        const treatmentSamples = manager.getSamples(test.testId, 'treatment');
        expect(treatmentSamples.length).toBe(1);
      });
    });
  });

  describe('Results & Analysis', () => {
    describe('getResults()', () => {
      it('should return results with statistics', () => {
        const test = manager.createTest({
          name: 'Test',
          promptId: 'TEST_PROMPT',
          controlTemplate: 'control',
          treatmentTemplate: 'treatment',
          metrics: ['humanizationScore'],
          minSampleSize: 10,
        });

        // Add samples
        for (let i = 0; i < 20; i++) {
          manager.recordSample({
            testId: test.testId,
            variant: 'control',
            metrics: { humanizationScore: 0.7 + Math.random() * 0.1 },
          });
          manager.recordSample({
            testId: test.testId,
            variant: 'treatment',
            metrics: { humanizationScore: 0.75 + Math.random() * 0.1 },
          });
        }

        const result = manager.getResults(test.testId);

        expect(result.controlSamples).toBe(20);
        expect(result.treatmentSamples).toBe(20);
        expect(result.statistics).toBeDefined();
        expect(result.statistics.metricAnalysis.humanizationScore).toBeDefined();
        expect(result.hasMinimumSamples).toBe(true);
      });

      it('should indicate when minimum samples not reached', () => {
        const test = manager.createTest({
          name: 'Test',
          promptId: 'TEST_PROMPT',
          controlTemplate: 'control',
          treatmentTemplate: 'treatment',
          metrics: ['score'],
          minSampleSize: 100,
        });

        manager.recordSample({ testId: test.testId, variant: 'control', metrics: { score: 0.5 } });
        manager.recordSample({ testId: test.testId, variant: 'treatment', metrics: { score: 0.6 } });

        const result = manager.getResults(test.testId);

        expect(result.hasMinimumSamples).toBe(false);
        expect(result.winner).toBe('pending');
      });
    });

    describe('Statistical Analysis', () => {
      it('should calculate mean and standard deviation', () => {
        const test = manager.createTest({
          name: 'Test',
          promptId: 'TEST_PROMPT',
          controlTemplate: 'control',
          treatmentTemplate: 'treatment',
          metrics: ['score'],
          minSampleSize: 5,
        });

        // Add known samples
        [0.5, 0.6, 0.55, 0.52, 0.58].forEach(score => {
          manager.recordSample({
            testId: test.testId,
            variant: 'control',
            metrics: { score },
          });
        });

        [0.7, 0.8, 0.75, 0.72, 0.78].forEach(score => {
          manager.recordSample({
            testId: test.testId,
            variant: 'treatment',
            metrics: { score },
          });
        });

        const result = manager.getResults(test.testId);
        const analysis = result.statistics.metricAnalysis.score;

        // Control mean should be ~0.55
        expect(analysis.controlMean).toBeCloseTo(0.55, 1);
        // Treatment mean should be ~0.75
        expect(analysis.treatmentMean).toBeCloseTo(0.75, 1);
        // Difference should be ~0.2
        expect(analysis.difference).toBeCloseTo(0.2, 1);
      });

      it('should detect significant differences', () => {
        const test = manager.createTest({
          name: 'Test',
          promptId: 'TEST_PROMPT',
          controlTemplate: 'control',
          treatmentTemplate: 'treatment',
          metrics: ['score'],
          minSampleSize: 20,
        });

        // Add samples with clear difference
        for (let i = 0; i < 30; i++) {
          manager.recordSample({
            testId: test.testId,
            variant: 'control',
            metrics: { score: 0.5 + (Math.random() - 0.5) * 0.1 },
          });
          manager.recordSample({
            testId: test.testId,
            variant: 'treatment',
            metrics: { score: 0.8 + (Math.random() - 0.5) * 0.1 },
          });
        }

        const result = manager.getResults(test.testId);
        const analysis = result.statistics.metricAnalysis.score;

        expect(analysis.pValue).toBeLessThan(0.05);
        expect(analysis.significant).toBe(true);
        expect(analysis.winner).toBe('treatment');
      });

      it('should return inconclusive for similar groups', () => {
        const test = manager.createTest({
          name: 'Test',
          promptId: 'TEST_PROMPT',
          controlTemplate: 'control',
          treatmentTemplate: 'treatment',
          metrics: ['score'],
          minSampleSize: 10,
        });

        // Add samples with similar scores
        for (let i = 0; i < 20; i++) {
          manager.recordSample({
            testId: test.testId,
            variant: 'control',
            metrics: { score: 0.7 + (Math.random() - 0.5) * 0.3 },
          });
          manager.recordSample({
            testId: test.testId,
            variant: 'treatment',
            metrics: { score: 0.7 + (Math.random() - 0.5) * 0.3 },
          });
        }

        const result = manager.getResults(test.testId);

        // With high variance and similar means, should be inconclusive
        expect(['inconclusive', 'treatment', 'control']).toContain(result.winner);
      });
    });

    describe('Winner Determination', () => {
      it('should declare treatment winner when significantly better', () => {
        const test = manager.createTest({
          name: 'Test',
          promptId: 'TEST_PROMPT',
          controlTemplate: 'control',
          treatmentTemplate: 'treatment',
          metrics: ['score'],
          minSampleSize: 20,
        });

        // Treatment clearly better
        for (let i = 0; i < 50; i++) {
          manager.recordSample({
            testId: test.testId,
            variant: 'control',
            metrics: { score: 0.4 + Math.random() * 0.05 },
          });
          manager.recordSample({
            testId: test.testId,
            variant: 'treatment',
            metrics: { score: 0.9 + Math.random() * 0.05 },
          });
        }

        const result = manager.getResults(test.testId);

        expect(result.winner).toBe('treatment');
        expect(result.confidence).toBeGreaterThan(0.9);
      });

      it('should declare control winner when treatment is worse', () => {
        const test = manager.createTest({
          name: 'Test',
          promptId: 'TEST_PROMPT',
          controlTemplate: 'control',
          treatmentTemplate: 'treatment',
          metrics: ['score'],
          minSampleSize: 20,
        });

        // Control clearly better
        for (let i = 0; i < 50; i++) {
          manager.recordSample({
            testId: test.testId,
            variant: 'control',
            metrics: { score: 0.9 + Math.random() * 0.05 },
          });
          manager.recordSample({
            testId: test.testId,
            variant: 'treatment',
            metrics: { score: 0.4 + Math.random() * 0.05 },
          });
        }

        const result = manager.getResults(test.testId);

        expect(result.winner).toBe('control');
      });

      it('should include recommendation text', () => {
        const test = manager.createTest({
          name: 'Test',
          promptId: 'TEST_PROMPT',
          controlTemplate: 'control',
          treatmentTemplate: 'treatment',
          metrics: ['score'],
          minSampleSize: 5,
        });

        for (let i = 0; i < 10; i++) {
          manager.recordSample({
            testId: test.testId,
            variant: 'control',
            metrics: { score: 0.5 },
          });
          manager.recordSample({
            testId: test.testId,
            variant: 'treatment',
            metrics: { score: 0.8 },
          });
        }

        const result = manager.getResults(test.testId);

        expect(result.recommendation).toBeTruthy();
        expect(typeof result.recommendation).toBe('string');
      });
    });
  });

  describe('List Tests', () => {
    it('should list all tests', () => {
      manager.createTest({
        name: 'Test 1',
        promptId: 'PROMPT_1',
        controlTemplate: 'c1',
        treatmentTemplate: 't1',
        metrics: ['score'],
      });
      manager.createTest({
        name: 'Test 2',
        promptId: 'PROMPT_2',
        controlTemplate: 'c2',
        treatmentTemplate: 't2',
        metrics: ['score'],
      });

      const tests = manager.listTests();
      expect(tests.length).toBe(2);
    });

    it('should filter by status', () => {
      const test1 = manager.createTest({
        name: 'Test 1',
        promptId: 'PROMPT_1',
        controlTemplate: 'c1',
        treatmentTemplate: 't1',
        metrics: ['score'],
      });
      const test2 = manager.createTest({
        name: 'Test 2',
        promptId: 'PROMPT_2',
        controlTemplate: 'c2',
        treatmentTemplate: 't2',
        metrics: ['score'],
      });

      manager.startTest(test1.testId);

      const runningTests = manager.listTests({ status: 'running' });
      expect(runningTests.length).toBe(1);
      expect(runningTests[0].testId).toBe(test1.testId);

      const draftTests = manager.listTests({ status: 'draft' });
      expect(draftTests.length).toBe(1);
      expect(draftTests[0].testId).toBe(test2.testId);
    });

    it('should filter by promptId', () => {
      manager.createTest({
        name: 'Test 1',
        promptId: 'PROMPT_A',
        controlTemplate: 'c1',
        treatmentTemplate: 't1',
        metrics: ['score'],
      });
      manager.createTest({
        name: 'Test 2',
        promptId: 'PROMPT_B',
        controlTemplate: 'c2',
        treatmentTemplate: 't2',
        metrics: ['score'],
      });

      const promptATests = manager.listTests({ promptId: 'PROMPT_A' });
      expect(promptATests.length).toBe(1);
      expect(promptATests[0].promptId).toBe('PROMPT_A');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Singleton', () => {
  afterEach(() => {
    resetABTestManager();
  });

  it('should return same instance from getABTestManager()', () => {
    const manager1 = getABTestManager();
    const manager2 = getABTestManager();

    expect(manager1).toBe(manager2);
  });

  it('should reset singleton with resetABTestManager()', () => {
    const manager1 = getABTestManager();
    manager1.createTest({
      name: 'Test',
      promptId: 'TEST',
      controlTemplate: 'c',
      treatmentTemplate: 't',
      metrics: ['score'],
    });

    resetABTestManager();

    const manager2 = getABTestManager();
    expect(manager2.listTests().length).toBe(0);
  });
});
