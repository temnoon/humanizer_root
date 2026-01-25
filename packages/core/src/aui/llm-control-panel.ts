/**
 * LLM Control Panel Service
 *
 * Single interface for model testing, vetting, and configuration.
 * Part of Phase 4: LLM Control Panel.
 *
 * Features:
 * - Model listing and status
 * - Benchmark execution
 * - A/B test management
 * - Vetting status updates
 * - Performance tracking
 *
 * @module aui/llm-control-panel
 */

import { randomUUID } from 'crypto';
import type {
  ModelRegistry,
  VettedModel,
  VettingStatus,
  BenchmarkResult,
  PerformanceProfile,
  ModelCapability,
} from '../models/model-registry.js';
import { getModelRegistry } from '../models/default-model-registry.js';
import {
  BenchmarkRunner,
  type BenchmarkSuite,
  type BenchmarkSuiteResult,
  type PassageCategory,
  type ModelInvoker,
  type EmbeddingGenerator,
  DEFAULT_BENCHMARK_SUITE,
} from './benchmark-suite.js';
import {
  ABTestManager,
  getABTestManager,
  type ABTestConfig,
  type ABTestResult,
  type ABTestStatus,
} from './ab-testing.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Options for LLMControlPanel
 */
export interface LLMControlPanelOptions {
  /** Custom model registry */
  registry?: ModelRegistry;

  /** Custom A/B test manager */
  abTestManager?: ABTestManager;

  /** Custom benchmark suite */
  benchmarkSuite?: BenchmarkSuite;

  /** Enable benchmark result caching */
  cacheBenchmarkResults?: boolean;

  /** Benchmark cache TTL in milliseconds */
  benchmarkCacheTtlMs?: number;
}

/**
 * Model summary for listing
 */
export interface ModelSummary {
  id: string;
  provider: string;
  capabilities: ModelCapability[];
  vettingStatus: VettingStatus;
  lastVetted?: Date;
  qualityScore?: number;
  avgLatencyMs?: number;
}

/**
 * Model test request
 */
export interface ModelTestRequest {
  /** Model ID to test */
  modelId: string;

  /** Categories to test (optional, defaults to all) */
  categories?: PassageCategory[];

  /** Skip semantic drift calculation */
  skipSemanticDrift?: boolean;

  /** Custom timeout per passage */
  passageTimeoutMs?: number;
}

/**
 * Vetting decision
 */
export interface VettingDecision {
  modelId: string;
  newStatus: VettingStatus;
  reason: string;
  decidedBy?: string;
  decidedAt: Date;
}

/**
 * Result of a model health check
 */
export interface ModelHealthCheck {
  modelId: string;
  healthy: boolean;
  latencyMs?: number;
  error?: string;
  checkedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════
// MCP HANDLER TYPES (for external consumption)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * MCP result wrapper
 */
export interface MCPResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Handler signatures for MCP tools
 */
export interface LLMControlPanelHandlers {
  // Model operations
  llm_list_models: (args?: { capability?: ModelCapability; status?: VettingStatus }) => Promise<MCPResult<ModelSummary[]>>;
  llm_get_model: (args: { modelId: string }) => Promise<MCPResult<VettedModel>>;
  llm_health_check: (args: { modelId: string }) => Promise<MCPResult<ModelHealthCheck>>;

  // Benchmark operations
  llm_test_model: (args: ModelTestRequest) => Promise<MCPResult<BenchmarkSuiteResult>>;
  llm_get_benchmark_results: (args: { modelId: string; limit?: number }) => Promise<MCPResult<BenchmarkSuiteResult[]>>;
  llm_compare_models: (args: { modelIds: string[] }) => Promise<MCPResult<Record<string, BenchmarkSuiteResult>>>;

  // Vetting operations
  llm_update_vetting_status: (args: VettingDecision) => Promise<MCPResult<VettedModel>>;
  llm_get_vetting_history: (args: { modelId: string }) => Promise<MCPResult<VettingDecision[]>>;

  // A/B test operations
  llm_start_ab_test: (args: {
    name: string;
    promptId: string;
    treatmentTemplate: string;
    trafficSplit?: number;
    minSampleSize?: number;
  }) => Promise<MCPResult<ABTestConfig>>;
  llm_get_ab_test_results: (args: { testId: string }) => Promise<MCPResult<ABTestResult>>;
  llm_list_ab_tests: (args?: { status?: ABTestStatus; promptId?: string }) => Promise<MCPResult<ABTestConfig[]>>;
  llm_stop_ab_test: (args: { testId: string }) => Promise<MCPResult<ABTestResult>>;
}

// ═══════════════════════════════════════════════════════════════════════════
// LLM CONTROL PANEL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * LLMControlPanel provides a unified interface for LLM management.
 */
export class LLMControlPanel implements LLMControlPanelHandlers {
  private registry: ModelRegistry;
  private abTestManager: ABTestManager;
  private benchmarkRunner: BenchmarkRunner;
  private benchmarkResults: Map<string, BenchmarkSuiteResult[]> = new Map();
  private vettingHistory: Map<string, VettingDecision[]> = new Map();
  private options: Required<LLMControlPanelOptions>;

  /** Model invoker callback - must be set before running tests */
  private modelInvoker?: (modelId: string) => ModelInvoker;

  /** Embedding generator callback - optional for semantic drift */
  private embeddingGenerator?: EmbeddingGenerator;

  constructor(options?: LLMControlPanelOptions) {
    this.registry = options?.registry ?? getModelRegistry();
    this.abTestManager = options?.abTestManager ?? getABTestManager();
    this.benchmarkRunner = new BenchmarkRunner({
      suite: options?.benchmarkSuite ?? DEFAULT_BENCHMARK_SUITE,
    });
    this.options = {
      registry: this.registry,
      abTestManager: this.abTestManager,
      benchmarkSuite: options?.benchmarkSuite ?? DEFAULT_BENCHMARK_SUITE,
      cacheBenchmarkResults: options?.cacheBenchmarkResults ?? true,
      benchmarkCacheTtlMs: options?.benchmarkCacheTtlMs ?? 24 * 60 * 60 * 1000, // 24 hours
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Set the model invoker callback.
   * Required for running benchmarks.
   */
  setModelInvoker(invoker: (modelId: string) => ModelInvoker): void {
    this.modelInvoker = invoker;
  }

  /**
   * Set the embedding generator callback.
   * Optional, enables semantic drift calculation.
   */
  setEmbeddingGenerator(generator: EmbeddingGenerator): void {
    this.embeddingGenerator = generator;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Model Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * List all models with optional filtering
   */
  async llm_list_models(args?: {
    capability?: ModelCapability;
    status?: VettingStatus;
  }): Promise<MCPResult<ModelSummary[]>> {
    try {
      let models: VettedModel[];

      if (args?.capability) {
        models = await this.registry.getForCapability(args.capability);
      } else {
        models = await this.registry.listAllModels();
      }

      if (args?.status) {
        models = models.filter((m) => m.vettingStatus === args.status);
      }

      const summaries: ModelSummary[] = models.map((m) => ({
        id: m.id,
        provider: m.provider,
        capabilities: m.capabilities,
        vettingStatus: m.vettingStatus,
        lastVetted: m.performanceProfile.lastVetted,
        qualityScore: m.performanceProfile.qualityScore,
        avgLatencyMs: m.performanceProfile.avgLatencyMs,
      }));

      return { success: true, data: summaries };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get a specific model by ID
   */
  async llm_get_model(args: { modelId: string }): Promise<MCPResult<VettedModel>> {
    try {
      const model = await this.registry.get(args.modelId);
      if (!model) {
        return { success: false, error: `Model not found: ${args.modelId}` };
      }
      return { success: true, data: model };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Check model health (connectivity and basic responsiveness)
   */
  async llm_health_check(args: { modelId: string }): Promise<MCPResult<ModelHealthCheck>> {
    try {
      const model = await this.registry.get(args.modelId);
      if (!model) {
        return {
          success: true,
          data: {
            modelId: args.modelId,
            healthy: false,
            error: 'Model not found in registry',
            checkedAt: new Date(),
          },
        };
      }

      if (!this.modelInvoker) {
        return {
          success: true,
          data: {
            modelId: args.modelId,
            healthy: false,
            error: 'Model invoker not configured',
            checkedAt: new Date(),
          },
        };
      }

      const startTime = Date.now();
      try {
        const invoker = this.modelInvoker(args.modelId);
        await invoker('Hello, respond with a single word.');
        const latencyMs = Date.now() - startTime;

        return {
          success: true,
          data: {
            modelId: args.modelId,
            healthy: true,
            latencyMs,
            checkedAt: new Date(),
          },
        };
      } catch (invokeError) {
        return {
          success: true,
          data: {
            modelId: args.modelId,
            healthy: false,
            latencyMs: Date.now() - startTime,
            error: String(invokeError),
            checkedAt: new Date(),
          },
        };
      }
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Benchmark Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Run benchmark suite against a model
   */
  async llm_test_model(args: ModelTestRequest): Promise<MCPResult<BenchmarkSuiteResult>> {
    try {
      if (!this.modelInvoker) {
        return { success: false, error: 'Model invoker not configured. Call setModelInvoker first.' };
      }

      const model = await this.registry.get(args.modelId);
      if (!model) {
        return { success: false, error: `Model not found: ${args.modelId}` };
      }

      // Create invoker for this model
      const invoker = this.modelInvoker(args.modelId);

      // Create custom runner if options provided
      const runner = new BenchmarkRunner({
        skipSemanticDrift: args.skipSemanticDrift,
        passageTimeoutMs: args.passageTimeoutMs,
      });

      // Run benchmarks
      const result = await runner.run(
        args.modelId,
        invoker,
        this.embeddingGenerator,
        args.categories
      );

      // Cache result
      if (this.options.cacheBenchmarkResults) {
        const results = this.benchmarkResults.get(args.modelId) ?? [];
        results.unshift(result);
        // Keep only last 10 results
        if (results.length > 10) {
          results.pop();
        }
        this.benchmarkResults.set(args.modelId, results);
      }

      // Update model performance profile
      await this.updatePerformanceFromBenchmark(args.modelId, result);

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get cached benchmark results for a model
   */
  async llm_get_benchmark_results(args: {
    modelId: string;
    limit?: number;
  }): Promise<MCPResult<BenchmarkSuiteResult[]>> {
    try {
      const results = this.benchmarkResults.get(args.modelId) ?? [];
      const limited = args.limit ? results.slice(0, args.limit) : results;
      return { success: true, data: limited };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Compare multiple models by running benchmarks
   */
  async llm_compare_models(args: {
    modelIds: string[];
  }): Promise<MCPResult<Record<string, BenchmarkSuiteResult>>> {
    try {
      if (!this.modelInvoker) {
        return { success: false, error: 'Model invoker not configured' };
      }

      const results: Record<string, BenchmarkSuiteResult> = {};

      for (const modelId of args.modelIds) {
        const result = await this.llm_test_model({ modelId });
        if (result.success && result.data) {
          results[modelId] = result.data;
        }
      }

      return { success: true, data: results };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Update model performance profile from benchmark results
   */
  private async updatePerformanceFromBenchmark(
    modelId: string,
    result: BenchmarkSuiteResult
  ): Promise<void> {
    const benchmarkResult: BenchmarkResult = {
      name: result.suiteId,
      score: result.scores.overall,
      runAt: result.runAt,
      avgLatencyMs: result.stats.avgLatencyMs,
      metrics: {
        patternCompliance: result.scores.patternCompliance,
        semanticPreservation: result.scores.semanticPreservation,
        fluency: result.scores.fluency,
        style: result.scores.style,
      },
    };

    await this.registry.updatePerformanceProfile(modelId, {
      avgLatencyMs: result.stats.avgLatencyMs,
      qualityScore: result.scores.overall,
      lastVetted: result.runAt,
      benchmarkResults: [benchmarkResult],
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Vetting Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Update a model's vetting status
   */
  async llm_update_vetting_status(args: VettingDecision): Promise<MCPResult<VettedModel>> {
    try {
      await this.registry.updateVettingStatus(args.modelId, args.newStatus);

      // Record decision in history
      const history = this.vettingHistory.get(args.modelId) ?? [];
      history.unshift({
        ...args,
        decidedAt: args.decidedAt ?? new Date(),
      });
      this.vettingHistory.set(args.modelId, history);

      const model = await this.registry.get(args.modelId);
      if (!model) {
        return { success: false, error: `Model not found: ${args.modelId}` };
      }

      return { success: true, data: model };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get vetting history for a model
   */
  async llm_get_vetting_history(args: {
    modelId: string;
  }): Promise<MCPResult<VettingDecision[]>> {
    try {
      const history = this.vettingHistory.get(args.modelId) ?? [];
      return { success: true, data: history };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // A/B Test Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Start a new A/B test
   */
  async llm_start_ab_test(args: {
    name: string;
    promptId: string;
    treatmentTemplate: string;
    trafficSplit?: number;
    minSampleSize?: number;
  }): Promise<MCPResult<ABTestConfig>> {
    try {
      // Get the current prompt template as control
      const { getPrompt } = await import('../config/prompt-registry.js');
      const currentPrompt = getPrompt(args.promptId);
      if (!currentPrompt) {
        return { success: false, error: `Prompt not found: ${args.promptId}` };
      }

      const test = this.abTestManager.createTest({
        name: args.name,
        promptId: args.promptId,
        controlTemplate: currentPrompt.template,
        treatmentTemplate: args.treatmentTemplate,
        metrics: ['humanizationScore', 'styleScore', 'qualityScore'],
        trafficSplit: args.trafficSplit,
        minSampleSize: args.minSampleSize,
      });

      this.abTestManager.startTest(test.testId);

      return { success: true, data: test };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get A/B test results
   */
  async llm_get_ab_test_results(args: { testId: string }): Promise<MCPResult<ABTestResult>> {
    try {
      const results = this.abTestManager.getResults(args.testId);
      return { success: true, data: results };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * List A/B tests
   */
  async llm_list_ab_tests(args?: {
    status?: ABTestStatus;
    promptId?: string;
  }): Promise<MCPResult<ABTestConfig[]>> {
    try {
      const tests = this.abTestManager.listTests(args);
      return { success: true, data: tests };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Stop an A/B test and get final results
   */
  async llm_stop_ab_test(args: { testId: string }): Promise<MCPResult<ABTestResult>> {
    try {
      const results = this.abTestManager.completeTest(args.testId);
      return { success: true, data: results };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Utility Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the A/B test manager for direct access
   */
  getABTestManager(): ABTestManager {
    return this.abTestManager;
  }

  /**
   * Get the model registry for direct access
   */
  getModelRegistry(): ModelRegistry {
    return this.registry;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

let _controlPanel: LLMControlPanel | null = null;

/**
 * Get the global LLMControlPanel instance
 */
export function getLLMControlPanel(): LLMControlPanel {
  if (!_controlPanel) {
    _controlPanel = new LLMControlPanel();
  }
  return _controlPanel;
}

/**
 * Set a custom LLMControlPanel instance
 */
export function setLLMControlPanel(panel: LLMControlPanel): void {
  _controlPanel = panel;
}

/**
 * Reset the global LLMControlPanel (for testing)
 */
export function resetLLMControlPanel(): void {
  _controlPanel = null;
}
