/**
 * LLM Control Panel Tests
 *
 * Unit tests for the LLM control panel:
 * - Model listing and management
 * - Benchmark execution
 * - A/B test integration
 * - MCP handler responses
 *
 * @module @humanizer/core/aui/llm-control-panel.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LLMControlPanel,
  getLLMControlPanel,
  setLLMControlPanel,
  resetLLMControlPanel,
  type ModelTestRequest,
  type VettingDecision,
} from './llm-control-panel.js';
import { resetABTestManager } from './ab-testing.js';
import {
  resetModelRegistry,
  getModelRegistry,
  type VettedModel,
  type ModelRegistry,
} from '../models/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// MOCK SETUP
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a mock model invoker factory
 */
function createMockInvokerFactory() {
  return (modelId: string) => async (input: string) => {
    // Simple transformation that removes some AI tells
    return input
      .replace(/\bdelve\b/gi, 'explore')
      .replace(/\bleverage\b/gi, 'use');
  };
}

/**
 * Create a mock embedding generator
 */
function createMockEmbedder() {
  return async (text: string) => {
    const hash = text.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return Array.from({ length: 768 }, (_, i) => Math.sin(hash + i) * 0.5 + 0.5);
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// LLM CONTROL PANEL TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('LLMControlPanel', () => {
  let panel: LLMControlPanel;

  beforeEach(async () => {
    resetLLMControlPanel();
    resetABTestManager();
    resetModelRegistry();

    panel = new LLMControlPanel();
  });

  afterEach(() => {
    resetLLMControlPanel();
    resetABTestManager();
    resetModelRegistry();
  });

  describe('Constructor', () => {
    it('should create with default options', () => {
      const p = new LLMControlPanel();
      expect(p).toBeDefined();
    });

    it('should accept custom options', () => {
      const p = new LLMControlPanel({
        cacheBenchmarkResults: false,
        benchmarkCacheTtlMs: 3600000,
      });
      expect(p).toBeDefined();
    });
  });

  describe('Configuration', () => {
    it('should set model invoker', () => {
      const invoker = createMockInvokerFactory();
      panel.setModelInvoker(invoker);
      // No error means success
      expect(true).toBe(true);
    });

    it('should set embedding generator', () => {
      const embedder = createMockEmbedder();
      panel.setEmbeddingGenerator(embedder);
      expect(true).toBe(true);
    });
  });

  describe('Model Operations', () => {
    describe('llm_list_models()', () => {
      it('should list all models', async () => {
        const result = await panel.llm_list_models();

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
      });

      it('should filter by capability', async () => {
        const result = await panel.llm_list_models({ capability: 'embedding' });

        expect(result.success).toBe(true);
        if (result.data && result.data.length > 0) {
          for (const model of result.data) {
            expect(model.capabilities).toContain('embedding');
          }
        }
      });

      it('should filter by vetting status', async () => {
        const result = await panel.llm_list_models({ status: 'approved' });

        expect(result.success).toBe(true);
        if (result.data && result.data.length > 0) {
          for (const model of result.data) {
            expect(model.vettingStatus).toBe('approved');
          }
        }
      });

      it('should return model summaries with expected fields', async () => {
        const result = await panel.llm_list_models();

        expect(result.success).toBe(true);
        if (result.data && result.data.length > 0) {
          const model = result.data[0];
          expect(model.id).toBeDefined();
          expect(model.provider).toBeDefined();
          expect(model.capabilities).toBeDefined();
          expect(model.vettingStatus).toBeDefined();
        }
      });
    });

    describe('llm_get_model()', () => {
      it('should get model by ID', async () => {
        const listResult = await panel.llm_list_models();
        if (listResult.data && listResult.data.length > 0) {
          const modelId = listResult.data[0].id;
          const result = await panel.llm_get_model({ modelId });

          expect(result.success).toBe(true);
          expect(result.data?.id).toBe(modelId);
        }
      });

      it('should return error for non-existent model', async () => {
        const result = await panel.llm_get_model({ modelId: 'non-existent-model' });

        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
      });
    });

    describe('llm_health_check()', () => {
      it('should return unhealthy when no invoker configured', async () => {
        const listResult = await panel.llm_list_models();
        if (listResult.data && listResult.data.length > 0) {
          const modelId = listResult.data[0].id;
          const result = await panel.llm_health_check({ modelId });

          expect(result.success).toBe(true);
          expect(result.data?.healthy).toBe(false);
          expect(result.data?.error).toContain('invoker not configured');
        }
      });

      it('should check health when invoker configured', async () => {
        panel.setModelInvoker(createMockInvokerFactory());

        const listResult = await panel.llm_list_models();
        if (listResult.data && listResult.data.length > 0) {
          const modelId = listResult.data[0].id;
          const result = await panel.llm_health_check({ modelId });

          expect(result.success).toBe(true);
          expect(result.data?.healthy).toBe(true);
          expect(result.data?.latencyMs).toBeGreaterThanOrEqual(0);
        }
      });

      it('should return unhealthy for non-existent model', async () => {
        const result = await panel.llm_health_check({ modelId: 'non-existent' });

        expect(result.success).toBe(true);
        expect(result.data?.healthy).toBe(false);
        expect(result.data?.error).toContain('not found');
      });
    });
  });

  describe('Benchmark Operations', () => {
    describe('llm_test_model()', () => {
      it('should return error when no invoker configured', async () => {
        const result = await panel.llm_test_model({ modelId: 'test-model' });

        expect(result.success).toBe(false);
        expect(result.error).toContain('invoker not configured');
      });

      it('should run benchmarks when invoker configured', async () => {
        panel.setModelInvoker(createMockInvokerFactory());

        const listResult = await panel.llm_list_models();
        if (listResult.data && listResult.data.length > 0) {
          const modelId = listResult.data[0].id;
          const result = await panel.llm_test_model({ modelId });

          expect(result.success).toBe(true);
          expect(result.data?.modelId).toBe(modelId);
          expect(result.data?.passageResults).toBeDefined();
          expect(result.data?.scores).toBeDefined();
          expect(result.data?.stats).toBeDefined();
        }
      }, 30000);

      it('should filter by category', async () => {
        panel.setModelInvoker(createMockInvokerFactory());

        const listResult = await panel.llm_list_models();
        if (listResult.data && listResult.data.length > 0) {
          const modelId = listResult.data[0].id;
          const result = await panel.llm_test_model({
            modelId,
            categories: ['philosophical'],
          });

          expect(result.success).toBe(true);
          // Should have fewer passages than full suite
          if (result.data) {
            expect(result.data.passageResults.length).toBeLessThan(10);
          }
        }
      }, 30000);

      it('should return error for non-existent model', async () => {
        panel.setModelInvoker(createMockInvokerFactory());

        const result = await panel.llm_test_model({ modelId: 'non-existent' });

        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
      });
    });

    describe('llm_get_benchmark_results()', () => {
      it('should return empty array when no results', async () => {
        const result = await panel.llm_get_benchmark_results({ modelId: 'test-model' });

        expect(result.success).toBe(true);
        expect(result.data).toEqual([]);
      });

      it('should return cached results after benchmark run', async () => {
        panel.setModelInvoker(createMockInvokerFactory());

        const listResult = await panel.llm_list_models();
        if (listResult.data && listResult.data.length > 0) {
          const modelId = listResult.data[0].id;

          // Run benchmark
          await panel.llm_test_model({ modelId });

          // Get cached results
          const result = await panel.llm_get_benchmark_results({ modelId });

          expect(result.success).toBe(true);
          expect(result.data?.length).toBeGreaterThan(0);
        }
      }, 30000);

      it('should respect limit parameter', async () => {
        panel.setModelInvoker(createMockInvokerFactory());

        const listResult = await panel.llm_list_models();
        if (listResult.data && listResult.data.length > 0) {
          const modelId = listResult.data[0].id;

          // Run benchmark twice
          await panel.llm_test_model({ modelId });
          await panel.llm_test_model({ modelId });

          // Get with limit
          const result = await panel.llm_get_benchmark_results({ modelId, limit: 1 });

          expect(result.success).toBe(true);
          expect(result.data?.length).toBe(1);
        }
      }, 60000);
    });

    describe('llm_compare_models()', () => {
      it('should return error when no invoker configured', async () => {
        const result = await panel.llm_compare_models({ modelIds: ['model1', 'model2'] });

        expect(result.success).toBe(false);
        expect(result.error).toContain('invoker not configured');
      });

      it('should compare multiple models', async () => {
        panel.setModelInvoker(createMockInvokerFactory());

        const listResult = await panel.llm_list_models();
        if (listResult.data && listResult.data.length >= 2) {
          const modelIds = listResult.data.slice(0, 2).map(m => m.id);
          const result = await panel.llm_compare_models({ modelIds });

          expect(result.success).toBe(true);
          expect(Object.keys(result.data ?? {}).length).toBeGreaterThan(0);
        }
      }, 60000);
    });
  });

  describe('Vetting Operations', () => {
    describe('llm_update_vetting_status()', () => {
      it('should update vetting status', async () => {
        const listResult = await panel.llm_list_models();
        if (listResult.data && listResult.data.length > 0) {
          const modelId = listResult.data[0].id;

          const decision: VettingDecision = {
            modelId,
            newStatus: 'testing',
            reason: 'Starting new benchmark run',
            decidedAt: new Date(),
          };

          const result = await panel.llm_update_vetting_status(decision);

          expect(result.success).toBe(true);
          expect(result.data?.vettingStatus).toBe('testing');
        }
      });

      it('should record decision in history', async () => {
        const listResult = await panel.llm_list_models();
        if (listResult.data && listResult.data.length > 0) {
          const modelId = listResult.data[0].id;

          await panel.llm_update_vetting_status({
            modelId,
            newStatus: 'testing',
            reason: 'Test 1',
            decidedAt: new Date(),
          });

          await panel.llm_update_vetting_status({
            modelId,
            newStatus: 'approved',
            reason: 'Test 2',
            decidedAt: new Date(),
          });

          const historyResult = await panel.llm_get_vetting_history({ modelId });

          expect(historyResult.success).toBe(true);
          expect(historyResult.data?.length).toBe(2);
        }
      });
    });

    describe('llm_get_vetting_history()', () => {
      it('should return empty array when no history', async () => {
        const result = await panel.llm_get_vetting_history({ modelId: 'test-model' });

        expect(result.success).toBe(true);
        expect(result.data).toEqual([]);
      });
    });
  });

  describe('A/B Test Operations', () => {
    describe('llm_start_ab_test()', () => {
      it('should start an A/B test', async () => {
        const result = await panel.llm_start_ab_test({
          name: 'Test Prompt Variation',
          promptId: 'BUILDER_OUTLINE_CREATION',
          treatmentTemplate: 'New template {{var}}',
        });

        expect(result.success).toBe(true);
        expect(result.data?.testId).toBeDefined();
        expect(result.data?.status).toBe('running');
      });

      it('should return error for non-existent prompt', async () => {
        const result = await panel.llm_start_ab_test({
          name: 'Test',
          promptId: 'NON_EXISTENT_PROMPT',
          treatmentTemplate: 'template',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
      });
    });

    describe('llm_list_ab_tests()', () => {
      it('should list all A/B tests', async () => {
        await panel.llm_start_ab_test({
          name: 'Test 1',
          promptId: 'BUILDER_OUTLINE_CREATION',
          treatmentTemplate: 'template 1',
        });

        await panel.llm_start_ab_test({
          name: 'Test 2',
          promptId: 'BUILDER_SECTION_COMPOSITION',
          treatmentTemplate: 'template 2',
        });

        const result = await panel.llm_list_ab_tests();

        expect(result.success).toBe(true);
        expect(result.data?.length).toBe(2);
      });

      it('should filter by status', async () => {
        const test1 = await panel.llm_start_ab_test({
          name: 'Test 1',
          promptId: 'BUILDER_OUTLINE_CREATION',
          treatmentTemplate: 'template 1',
        });

        const result = await panel.llm_list_ab_tests({ status: 'running' });

        expect(result.success).toBe(true);
        expect(result.data?.length).toBe(1);
      });
    });

    describe('llm_get_ab_test_results()', () => {
      it('should get results for a test', async () => {
        const createResult = await panel.llm_start_ab_test({
          name: 'Test',
          promptId: 'BUILDER_OUTLINE_CREATION',
          treatmentTemplate: 'template',
        });

        if (createResult.data) {
          const result = await panel.llm_get_ab_test_results({
            testId: createResult.data.testId,
          });

          expect(result.success).toBe(true);
          expect(result.data?.testId).toBe(createResult.data.testId);
        }
      });

      it('should return error for non-existent test', async () => {
        const result = await panel.llm_get_ab_test_results({ testId: 'non-existent' });

        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
      });
    });

    describe('llm_stop_ab_test()', () => {
      it('should stop a test and return final results', async () => {
        const createResult = await panel.llm_start_ab_test({
          name: 'Test',
          promptId: 'BUILDER_OUTLINE_CREATION',
          treatmentTemplate: 'template',
        });

        if (createResult.data) {
          const result = await panel.llm_stop_ab_test({
            testId: createResult.data.testId,
          });

          expect(result.success).toBe(true);
          expect(result.data?.config.status).toBe('completed');
        }
      });
    });
  });

  describe('Utility Methods', () => {
    it('should return ABTestManager', () => {
      const abManager = panel.getABTestManager();
      expect(abManager).toBeDefined();
    });

    it('should return ModelRegistry', () => {
      const registry = panel.getModelRegistry();
      expect(registry).toBeDefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Singleton', () => {
  afterEach(() => {
    resetLLMControlPanel();
    resetABTestManager();
    resetModelRegistry();
  });

  it('should return same instance from getLLMControlPanel()', () => {
    const panel1 = getLLMControlPanel();
    const panel2 = getLLMControlPanel();

    expect(panel1).toBe(panel2);
  });

  it('should allow setting custom instance', () => {
    const customPanel = new LLMControlPanel();
    setLLMControlPanel(customPanel);

    expect(getLLMControlPanel()).toBe(customPanel);
  });

  it('should reset with resetLLMControlPanel()', () => {
    const panel1 = getLLMControlPanel();
    resetLLMControlPanel();
    const panel2 = getLLMControlPanel();

    expect(panel1).not.toBe(panel2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MCP RESPONSE FORMAT TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('MCP Response Format', () => {
  let panel: LLMControlPanel;

  beforeEach(() => {
    resetLLMControlPanel();
    resetABTestManager();
    resetModelRegistry();
    panel = new LLMControlPanel();
  });

  afterEach(() => {
    resetLLMControlPanel();
    resetABTestManager();
    resetModelRegistry();
  });

  it('should return success: true for successful operations', async () => {
    const result = await panel.llm_list_models();

    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('data');
    expect(result).not.toHaveProperty('error');
  });

  it('should return success: false for failed operations', async () => {
    const result = await panel.llm_get_model({ modelId: 'non-existent' });

    expect(result).toHaveProperty('success', false);
    expect(result).toHaveProperty('error');
  });

  it('should have consistent response structure', async () => {
    // Success case
    const successResult = await panel.llm_list_models();
    expect(typeof successResult.success).toBe('boolean');
    if (successResult.success) {
      expect(successResult.data).toBeDefined();
    }

    // Error case
    const errorResult = await panel.llm_get_model({ modelId: 'non-existent' });
    expect(typeof errorResult.success).toBe('boolean');
    if (!errorResult.success) {
      expect(typeof errorResult.error).toBe('string');
    }
  });
});
