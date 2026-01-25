/**
 * A/B Testing Framework
 *
 * Framework for testing prompt variants and model configurations.
 * Part of Phase 4: LLM Control Panel.
 *
 * Features:
 * - Create and manage A/B tests for prompts
 * - Traffic splitting between control and treatment
 * - Statistical analysis of results
 * - Automatic winner detection
 *
 * @module aui/ab-testing
 */

import { randomUUID } from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════
// A/B TEST TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Status of an A/B test
 */
export type ABTestStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';

/**
 * Winner determination
 */
export type ABTestWinner = 'control' | 'treatment' | 'inconclusive' | 'pending';

/**
 * Configuration for an A/B test
 */
export interface ABTestConfig {
  /** Unique test identifier */
  testId: string;

  /** Human-readable name */
  name: string;

  /** Description of what's being tested */
  description?: string;

  /** Prompt ID being tested */
  promptId: string;

  /** Variants */
  variants: {
    /** Current/baseline prompt template */
    control: string;
    /** New prompt template to test */
    treatment: string;
  };

  /** Portion of traffic getting treatment (0-1) */
  trafficSplit: number;

  /** Metrics to track (e.g., ['humanizationScore', 'styleScore']) */
  metrics: string[];

  /** Minimum samples per variant before declaring winner */
  minSampleSize: number;

  /** Start date */
  startDate: Date;

  /** End date (optional) */
  endDate?: Date;

  /** Current status */
  status: ABTestStatus;

  /** Statistical significance threshold (default 0.95) */
  significanceThreshold?: number;

  /** Tags for organization */
  tags?: string[];
}

/**
 * A single sample/observation in an A/B test
 */
export interface ABTestSample {
  /** Sample ID */
  id: string;

  /** Test ID this sample belongs to */
  testId: string;

  /** Which variant was used */
  variant: 'control' | 'treatment';

  /** Metric values observed */
  metrics: Record<string, number>;

  /** Input text (for debugging) */
  input?: string;

  /** Output text (for debugging) */
  output?: string;

  /** When the sample was collected */
  timestamp: Date;

  /** Any metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Statistical analysis of A/B test results
 */
export interface ABTestStatistics {
  /** Sample sizes */
  controlCount: number;
  treatmentCount: number;

  /** Per-metric analysis */
  metricAnalysis: Record<
    string,
    {
      controlMean: number;
      controlStdDev: number;
      treatmentMean: number;
      treatmentStdDev: number;
      difference: number;
      differencePercent: number;
      pValue: number;
      significant: boolean;
      winner: 'control' | 'treatment' | 'tie';
    }
  >;

  /** Overall confidence */
  overallConfidence: number;
}

/**
 * Complete result from an A/B test
 */
export interface ABTestResult {
  /** Test ID */
  testId: string;

  /** Test configuration */
  config: ABTestConfig;

  /** Sample counts */
  controlSamples: number;
  treatmentSamples: number;

  /** Aggregate metrics */
  controlMetrics: Record<string, number>;
  treatmentMetrics: Record<string, number>;

  /** Statistical analysis */
  statistics: ABTestStatistics;

  /** Winner determination */
  winner: ABTestWinner;

  /** Confidence in winner (0-1) */
  confidence: number;

  /** Recommendation text */
  recommendation: string;

  /** Whether test has enough samples */
  hasMinimumSamples: boolean;

  /** When results were calculated */
  calculatedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════
// A/B TEST MANAGER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Options for ABTestManager
 */
export interface ABTestManagerOptions {
  /** Default significance threshold */
  defaultSignificanceThreshold?: number;

  /** Default minimum sample size */
  defaultMinSampleSize?: number;

  /** Default traffic split */
  defaultTrafficSplit?: number;
}

/**
 * ABTestManager handles A/B test lifecycle
 */
export class ABTestManager {
  private tests: Map<string, ABTestConfig> = new Map();
  private samples: Map<string, ABTestSample[]> = new Map();
  private options: Required<ABTestManagerOptions>;

  constructor(options?: ABTestManagerOptions) {
    this.options = {
      defaultSignificanceThreshold: options?.defaultSignificanceThreshold ?? 0.95,
      defaultMinSampleSize: options?.defaultMinSampleSize ?? 100,
      defaultTrafficSplit: options?.defaultTrafficSplit ?? 0.5,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Test Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a new A/B test
   */
  createTest(params: {
    name: string;
    description?: string;
    promptId: string;
    controlTemplate: string;
    treatmentTemplate: string;
    metrics: string[];
    trafficSplit?: number;
    minSampleSize?: number;
    significanceThreshold?: number;
    tags?: string[];
  }): ABTestConfig {
    const testId = `ab-${randomUUID().slice(0, 8)}`;

    const config: ABTestConfig = {
      testId,
      name: params.name,
      description: params.description,
      promptId: params.promptId,
      variants: {
        control: params.controlTemplate,
        treatment: params.treatmentTemplate,
      },
      trafficSplit: params.trafficSplit ?? this.options.defaultTrafficSplit,
      metrics: params.metrics,
      minSampleSize: params.minSampleSize ?? this.options.defaultMinSampleSize,
      startDate: new Date(),
      status: 'draft',
      significanceThreshold:
        params.significanceThreshold ?? this.options.defaultSignificanceThreshold,
      tags: params.tags,
    };

    this.tests.set(testId, config);
    this.samples.set(testId, []);

    return config;
  }

  /**
   * Start a test
   */
  startTest(testId: string): void {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }
    if (test.status !== 'draft' && test.status !== 'paused') {
      throw new Error(`Cannot start test in status: ${test.status}`);
    }

    test.status = 'running';
    test.startDate = new Date();
  }

  /**
   * Pause a test
   */
  pauseTest(testId: string): void {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }
    if (test.status !== 'running') {
      throw new Error(`Cannot pause test in status: ${test.status}`);
    }

    test.status = 'paused';
  }

  /**
   * Complete a test
   */
  completeTest(testId: string): ABTestResult {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }

    test.status = 'completed';
    test.endDate = new Date();

    return this.getResults(testId);
  }

  /**
   * Cancel a test
   */
  cancelTest(testId: string): void {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }

    test.status = 'cancelled';
    test.endDate = new Date();
  }

  /**
   * Get a test by ID
   */
  getTest(testId: string): ABTestConfig | undefined {
    return this.tests.get(testId);
  }

  /**
   * List all tests
   */
  listTests(filter?: { status?: ABTestStatus; promptId?: string }): ABTestConfig[] {
    let tests = Array.from(this.tests.values());

    if (filter?.status) {
      tests = tests.filter((t) => t.status === filter.status);
    }
    if (filter?.promptId) {
      tests = tests.filter((t) => t.promptId === filter.promptId);
    }

    return tests;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Sample Collection
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Determine which variant to use for a request
   */
  getVariant(testId: string): 'control' | 'treatment' {
    const test = this.tests.get(testId);
    if (!test || test.status !== 'running') {
      return 'control';
    }

    return Math.random() < test.trafficSplit ? 'treatment' : 'control';
  }

  /**
   * Get the template for a variant
   */
  getTemplate(testId: string, variant: 'control' | 'treatment'): string | undefined {
    const test = this.tests.get(testId);
    if (!test) return undefined;

    return variant === 'control' ? test.variants.control : test.variants.treatment;
  }

  /**
   * Record a sample observation
   */
  recordSample(params: {
    testId: string;
    variant: 'control' | 'treatment';
    metrics: Record<string, number>;
    input?: string;
    output?: string;
    metadata?: Record<string, unknown>;
  }): ABTestSample {
    const test = this.tests.get(params.testId);
    if (!test) {
      throw new Error(`Test not found: ${params.testId}`);
    }

    const sample: ABTestSample = {
      id: randomUUID(),
      testId: params.testId,
      variant: params.variant,
      metrics: params.metrics,
      input: params.input,
      output: params.output,
      timestamp: new Date(),
      metadata: params.metadata,
    };

    const samples = this.samples.get(params.testId) ?? [];
    samples.push(sample);
    this.samples.set(params.testId, samples);

    return sample;
  }

  /**
   * Get samples for a test
   */
  getSamples(
    testId: string,
    variant?: 'control' | 'treatment'
  ): ABTestSample[] {
    const samples = this.samples.get(testId) ?? [];
    if (variant) {
      return samples.filter((s) => s.variant === variant);
    }
    return samples;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Results & Analysis
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get results for a test
   */
  getResults(testId: string): ABTestResult {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }

    const samples = this.samples.get(testId) ?? [];
    const controlSamples = samples.filter((s) => s.variant === 'control');
    const treatmentSamples = samples.filter((s) => s.variant === 'treatment');

    // Calculate aggregate metrics
    const controlMetrics = this.aggregateMetrics(controlSamples, test.metrics);
    const treatmentMetrics = this.aggregateMetrics(treatmentSamples, test.metrics);

    // Statistical analysis
    const statistics = this.calculateStatistics(
      controlSamples,
      treatmentSamples,
      test.metrics,
      test.significanceThreshold ?? this.options.defaultSignificanceThreshold
    );

    // Determine winner
    const hasMinimumSamples =
      controlSamples.length >= test.minSampleSize &&
      treatmentSamples.length >= test.minSampleSize;

    const { winner, confidence, recommendation } = this.determineWinner(
      statistics,
      hasMinimumSamples,
      test.significanceThreshold ?? this.options.defaultSignificanceThreshold
    );

    return {
      testId,
      config: test,
      controlSamples: controlSamples.length,
      treatmentSamples: treatmentSamples.length,
      controlMetrics,
      treatmentMetrics,
      statistics,
      winner,
      confidence,
      recommendation,
      hasMinimumSamples,
      calculatedAt: new Date(),
    };
  }

  /**
   * Calculate aggregate metrics from samples
   */
  private aggregateMetrics(
    samples: ABTestSample[],
    metricNames: string[]
  ): Record<string, number> {
    if (samples.length === 0) {
      return Object.fromEntries(metricNames.map((m) => [m, 0]));
    }

    const result: Record<string, number> = {};
    for (const metric of metricNames) {
      const values = samples.map((s) => s.metrics[metric] ?? 0);
      result[metric] = values.reduce((a, b) => a + b, 0) / values.length;
    }
    return result;
  }

  /**
   * Calculate statistical analysis
   */
  private calculateStatistics(
    controlSamples: ABTestSample[],
    treatmentSamples: ABTestSample[],
    metricNames: string[],
    significanceThreshold: number
  ): ABTestStatistics {
    const metricAnalysis: ABTestStatistics['metricAnalysis'] = {};

    for (const metric of metricNames) {
      const controlValues = controlSamples.map((s) => s.metrics[metric] ?? 0);
      const treatmentValues = treatmentSamples.map((s) => s.metrics[metric] ?? 0);

      const controlMean = this.mean(controlValues);
      const controlStdDev = this.stdDev(controlValues, controlMean);
      const treatmentMean = this.mean(treatmentValues);
      const treatmentStdDev = this.stdDev(treatmentValues, treatmentMean);

      const difference = treatmentMean - controlMean;
      const differencePercent = controlMean !== 0 ? (difference / controlMean) * 100 : 0;

      // Simple t-test approximation (Welch's t-test)
      const pValue = this.welchTTest(
        controlValues,
        treatmentValues,
        controlMean,
        treatmentMean,
        controlStdDev,
        treatmentStdDev
      );

      const significant = pValue < (1 - significanceThreshold);
      const winner: 'control' | 'treatment' | 'tie' =
        !significant ? 'tie' : difference > 0 ? 'treatment' : 'control';

      metricAnalysis[metric] = {
        controlMean,
        controlStdDev,
        treatmentMean,
        treatmentStdDev,
        difference,
        differencePercent,
        pValue,
        significant,
        winner,
      };
    }

    // Overall confidence based on metric agreement
    const significantMetrics = Object.values(metricAnalysis).filter((m) => m.significant);
    const overallConfidence =
      significantMetrics.length > 0
        ? 1 - significantMetrics.reduce((min, m) => Math.min(min, m.pValue), 1)
        : 0;

    return {
      controlCount: controlSamples.length,
      treatmentCount: treatmentSamples.length,
      metricAnalysis,
      overallConfidence,
    };
  }

  /**
   * Determine winner from statistics
   */
  private determineWinner(
    statistics: ABTestStatistics,
    hasMinimumSamples: boolean,
    significanceThreshold: number
  ): { winner: ABTestWinner; confidence: number; recommendation: string } {
    if (!hasMinimumSamples) {
      return {
        winner: 'pending',
        confidence: 0,
        recommendation: 'Collect more samples before determining winner.',
      };
    }

    const metricResults = Object.values(statistics.metricAnalysis);
    const significantResults = metricResults.filter((m) => m.significant);

    if (significantResults.length === 0) {
      return {
        winner: 'inconclusive',
        confidence: statistics.overallConfidence,
        recommendation: 'No statistically significant differences found. Consider running longer or with different variations.',
      };
    }

    // Count wins
    const treatmentWins = significantResults.filter((m) => m.winner === 'treatment').length;
    const controlWins = significantResults.filter((m) => m.winner === 'control').length;

    if (treatmentWins > controlWins) {
      return {
        winner: 'treatment',
        confidence: statistics.overallConfidence,
        recommendation: `Treatment variant shows improvement in ${treatmentWins}/${metricResults.length} metrics. Consider promoting to production.`,
      };
    } else if (controlWins > treatmentWins) {
      return {
        winner: 'control',
        confidence: statistics.overallConfidence,
        recommendation: `Control variant performs better in ${controlWins}/${metricResults.length} metrics. Keep current version.`,
      };
    } else {
      return {
        winner: 'inconclusive',
        confidence: statistics.overallConfidence,
        recommendation: 'Mixed results across metrics. Review individual metric results for decision.',
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Statistical Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private stdDev(values: number[], mean?: number): number {
    if (values.length < 2) return 0;
    const m = mean ?? this.mean(values);
    const squaredDiffs = values.map((v) => Math.pow(v - m, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / (values.length - 1));
  }

  /**
   * Welch's t-test for unequal variances
   * Returns approximate p-value
   */
  private welchTTest(
    control: number[],
    treatment: number[],
    controlMean: number,
    treatmentMean: number,
    controlStdDev: number,
    treatmentStdDev: number
  ): number {
    if (control.length < 2 || treatment.length < 2) return 1;

    const n1 = control.length;
    const n2 = treatment.length;

    // Standard error
    const se1 = (controlStdDev * controlStdDev) / n1;
    const se2 = (treatmentStdDev * treatmentStdDev) / n2;
    const se = Math.sqrt(se1 + se2);

    if (se === 0) return 1;

    // t-statistic
    const t = Math.abs(treatmentMean - controlMean) / se;

    // Welch-Satterthwaite degrees of freedom
    const df =
      Math.pow(se1 + se2, 2) /
      (Math.pow(se1, 2) / (n1 - 1) + Math.pow(se2, 2) / (n2 - 1));

    // Approximate p-value using normal approximation for large df
    // For small df, this underestimates p-value (conservative)
    const pValue = 2 * (1 - this.normalCDF(t));

    return Math.max(0, Math.min(1, pValue));
  }

  /**
   * Standard normal CDF approximation
   */
  private normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y =
      1.0 -
      ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

let _abTestManager: ABTestManager | null = null;

/**
 * Get the global ABTestManager instance
 */
export function getABTestManager(): ABTestManager {
  if (!_abTestManager) {
    _abTestManager = new ABTestManager();
  }
  return _abTestManager;
}

/**
 * Reset the global ABTestManager (for testing)
 */
export function resetABTestManager(): void {
  _abTestManager = null;
}
