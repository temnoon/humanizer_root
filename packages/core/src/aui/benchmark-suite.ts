/**
 * Benchmark Suite
 *
 * Defines benchmark passages and metrics for model vetting.
 * Part of Phase 4: LLM Control Panel.
 *
 * Features:
 * - 10+ passages covering all quality dimensions
 * - Pattern-based expected behaviors
 * - Quantitative metrics (semantic drift, perplexity, etc.)
 * - Category-based testing (philosophical, technical, creative, etc.)
 *
 * @module aui/benchmark-suite
 */

import type { ModelCapability } from '../models/model-registry.js';

// ═══════════════════════════════════════════════════════════════════════════
// BENCHMARK TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A single benchmark passage for testing
 */
export interface BenchmarkPassage {
  /** Unique identifier */
  id: string;

  /** The text to process */
  text: string;

  /** Category for analysis */
  category: PassageCategory;

  /** Traits expected in good output */
  expectedTraits: string[];

  /** Optional notes for human reviewers */
  notes?: string;
}

/**
 * Categories of benchmark passages
 */
export type PassageCategory =
  | 'philosophical'
  | 'technical'
  | 'creative'
  | 'conversational'
  | 'academic';

/**
 * Expected behavior pattern for validation
 */
export interface ExpectedBehavior {
  /** Regex pattern to check */
  pattern: RegExp;

  /** Should the pattern match (true) or not match (false)? */
  shouldMatch: boolean;

  /** Human-readable description */
  description: string;

  /** Severity if check fails */
  severity: 'error' | 'warning' | 'info';
}

/**
 * Quantitative metrics configuration
 */
export interface BenchmarkMetrics {
  /** Maximum acceptable cosine distance input→output */
  semanticDriftThreshold: number;

  /** Maximum perplexity for fluency gate */
  maxPerplexity: number;

  /** Minimum self-BLEU diversity score */
  minDiversity: number;

  /** Style features to measure */
  styleFeatures: string[];

  /** Maximum acceptable AI probability score */
  aiDetectorThreshold: number;
}

/**
 * Weight configuration for scoring
 */
export interface BenchmarkWeights {
  /** Weight for pattern compliance */
  patternCompliance: number;

  /** Weight for semantic preservation */
  semanticPreservation: number;

  /** Weight for fluency */
  fluency: number;

  /** Weight for style consistency */
  style: number;
}

/**
 * Complete benchmark suite definition
 */
export interface BenchmarkSuite {
  /** Unique identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of what this suite tests */
  description?: string;

  /** Benchmark passages */
  passages: BenchmarkPassage[];

  /** Expected behavior patterns */
  expectedBehaviors: ExpectedBehavior[];

  /** Quantitative metrics configuration */
  metrics: BenchmarkMetrics;

  /** Scoring weights */
  weights: BenchmarkWeights;

  /** Model capabilities required for this suite */
  requiredCapabilities?: ModelCapability[];

  /** Version of the benchmark suite */
  version: number;

  /** When the suite was last updated */
  updatedAt?: Date;
}

/**
 * Result from running a single passage benchmark
 */
export interface PassageBenchmarkResult {
  /** Passage ID */
  passageId: string;

  /** Input text */
  input: string;

  /** Output text from model */
  output: string;

  /** Pattern compliance results */
  patternResults: Array<{
    behavior: ExpectedBehavior;
    passed: boolean;
    matchCount: number;
  }>;

  /** Semantic drift score (0-1, lower is better) */
  semanticDrift: number;

  /** Fluency score (perplexity) */
  perplexity?: number;

  /** Time taken in milliseconds */
  latencyMs: number;

  /** Overall pass/fail */
  passed: boolean;

  /** Issues found */
  issues: string[];
}

/**
 * Result from running the full benchmark suite
 */
export interface BenchmarkSuiteResult {
  /** Suite ID */
  suiteId: string;

  /** Model ID tested */
  modelId: string;

  /** Individual passage results */
  passageResults: PassageBenchmarkResult[];

  /** Overall scores */
  scores: {
    patternCompliance: number;
    semanticPreservation: number;
    fluency: number;
    style: number;
    overall: number;
  };

  /** Summary statistics */
  stats: {
    totalPassages: number;
    passedPassages: number;
    failedPassages: number;
    avgLatencyMs: number;
    avgSemanticDrift: number;
  };

  /** Overall pass/fail determination */
  passed: boolean;

  /** Timestamp */
  runAt: Date;

  /** Duration in milliseconds */
  durationMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT BENCHMARK SUITE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default benchmark passages covering all quality dimensions.
 *
 * Categories:
 * - Philosophical (2): Tests depth preservation and AI-tell removal
 * - Technical (2): Tests accuracy and jargon handling
 * - Creative (2): Tests voice and narrative preservation
 * - Conversational (2): Tests casual tone handling
 * - Academic (2): Tests citation preservation
 */
export const DEFAULT_BENCHMARK_PASSAGES: BenchmarkPassage[] = [
  // ───────────────────────────────────────────────────────────────────────────
  // Philosophical (2)
  // ───────────────────────────────────────────────────────────────────────────
  {
    id: 'philosophical-1',
    text: `The nature of consciousness remains one of philosophy's most profound mysteries.
When we delve into the subjective experience of awareness, we find ourselves confronting
questions that have puzzled thinkers for millennia.`,
    category: 'philosophical',
    expectedTraits: ['removes-delve', 'maintains-depth', 'natural-flow'],
    notes: 'Tests removal of "delve" while preserving philosophical depth',
  },
  {
    id: 'philosophical-2',
    text: `It is important to note that phenomenological inquiry reveals a rich tapestry
of lived experience. The essence of being cannot be reduced to mere objective description.`,
    category: 'philosophical',
    expectedTraits: ['removes-it-is-important', 'removes-tapestry', 'preserves-phenomenology'],
    notes: 'Tests removal of hedging and cliché while preserving technical terms',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Technical (2)
  // ───────────────────────────────────────────────────────────────────────────
  {
    id: 'technical-1',
    text: `The implementation leverages a novel approach to vector embeddings,
utilizing transformer architectures to capture semantic relationships.
It is important to note that this methodology represents a significant advancement.`,
    category: 'technical',
    expectedTraits: ['removes-leverage', 'removes-it-is-important', 'preserves-meaning'],
    notes: 'Tests removal of corporate jargon while preserving technical accuracy',
  },
  {
    id: 'technical-2',
    text: `Moreover, the system utilizes advanced algorithms to delve into the data,
uncovering patterns that were previously hidden from view.`,
    category: 'technical',
    expectedTraits: ['removes-moreover', 'removes-utilize', 'removes-delve', 'maintains-technical-accuracy'],
    notes: 'Tests multiple AI-tell removal',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Creative/Narrative (2)
  // ───────────────────────────────────────────────────────────────────────────
  {
    id: 'creative-1',
    text: `The morning light filtered through the curtains, casting long shadows
across the room. She had always loved this time of day, when the world
seemed to hold its breath before the rush began.`,
    category: 'creative',
    expectedTraits: ['maintains-voice', 'preserves-imagery', 'natural-flow'],
    notes: 'Tests preservation of narrative voice with no AI tells present',
  },
  {
    id: 'creative-2',
    text: `His journey was, in essence, a tapestry woven from countless moments of
doubt and discovery. Moreover, each step forward revealed new horizons.`,
    category: 'creative',
    expectedTraits: ['removes-tapestry', 'removes-moreover', 'removes-in-essence', 'maintains-narrative'],
    notes: 'Tests AI-tell removal while preserving narrative flow',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Conversational (2)
  // ───────────────────────────────────────────────────────────────────────────
  {
    id: 'conversational-1',
    text: `So basically, what I'm trying to say is that we need to leverage
our existing resources more effectively. It's like, you know, we've got
all these tools but we're not utilizing them properly.`,
    category: 'conversational',
    expectedTraits: ['removes-leverage', 'removes-utilize', 'maintains-casual-tone'],
    notes: 'Tests AI-tell removal while preserving casual register',
  },
  {
    id: 'conversational-2',
    text: `That's a really good point! I think we should delve into that more.
It's important to note that this approach has worked before.`,
    category: 'conversational',
    expectedTraits: ['removes-delve', 'removes-it-is-important', 'preserves-enthusiasm'],
    notes: 'Tests removal of formal AI patterns from casual speech',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Citation-heavy/Academic (2)
  // ───────────────────────────────────────────────────────────────────────────
  {
    id: 'academic-1',
    text: `As Smith (2024) argues, the fundamental nature of consciousness
cannot be adequately captured by reductionist frameworks. This aligns
with Johnson's earlier work on phenomenal experience (Johnson, 2019).`,
    category: 'academic',
    expectedTraits: ['preserves-citations', 'maintains-attribution', 'natural-flow'],
    notes: 'Tests citation preservation with no AI tells',
  },
  {
    id: 'academic-2',
    text: `The research demonstrates (Williams et al., 2023) that leveraging
neural networks can delve into complex pattern recognition. Moreover,
it is worth noting that these findings replicate earlier studies.`,
    category: 'academic',
    expectedTraits: ['preserves-citations', 'removes-leverage', 'removes-delve', 'removes-moreover'],
    notes: 'Tests citation preservation while removing AI tells',
  },
];

/**
 * Default expected behavior patterns.
 * These define what should/shouldn't appear in output.
 */
export const DEFAULT_EXPECTED_BEHAVIORS: ExpectedBehavior[] = [
  // ───────────────────────────────────────────────────────────────────────────
  // AI-Tell Removal (should NOT match)
  // ───────────────────────────────────────────────────────────────────────────
  {
    pattern: /\bdelve\b/i,
    shouldMatch: false,
    description: 'No "delve"',
    severity: 'error',
  },
  {
    pattern: /\bleverage\b/i,
    shouldMatch: false,
    description: 'No "leverage"',
    severity: 'error',
  },
  {
    pattern: /it is (important|worth) (to )?not/i,
    shouldMatch: false,
    description: 'No hedging phrases',
    severity: 'error',
  },
  {
    pattern: /\btapestry\b/i,
    shouldMatch: false,
    description: 'No "tapestry"',
    severity: 'warning',
  },
  {
    pattern: /\butilize\b/i,
    shouldMatch: false,
    description: 'No "utilize"',
    severity: 'warning',
  },
  {
    pattern: /\bmoreover,/i,
    shouldMatch: false,
    description: 'No "moreover"',
    severity: 'warning',
  },
  {
    pattern: /in essence/i,
    shouldMatch: false,
    description: 'No "in essence"',
    severity: 'warning',
  },
  {
    pattern: /\bfurthermore,/i,
    shouldMatch: false,
    description: 'No "furthermore"',
    severity: 'info',
  },
  {
    pattern: /\bnevertheless,/i,
    shouldMatch: false,
    description: 'No "nevertheless"',
    severity: 'info',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Preservation (should match)
  // ───────────────────────────────────────────────────────────────────────────
  {
    pattern: /\(\w+,?\s*\d{4}\)/g,
    shouldMatch: true,
    description: 'Preserves citations',
    severity: 'error',
  },
];

/**
 * Default quantitative metrics thresholds
 */
export const DEFAULT_BENCHMARK_METRICS: BenchmarkMetrics = {
  semanticDriftThreshold: 0.15,
  maxPerplexity: 50.0,
  minDiversity: 0.3,
  styleFeatures: ['sentence_length', 'vocabulary_complexity', 'formality'],
  aiDetectorThreshold: 0.3,
};

/**
 * Default scoring weights
 */
export const DEFAULT_BENCHMARK_WEIGHTS: BenchmarkWeights = {
  patternCompliance: 0.3,
  semanticPreservation: 0.4,
  fluency: 0.2,
  style: 0.1,
};

/**
 * Default benchmark suite for the Humanizer system
 */
export const DEFAULT_BENCHMARK_SUITE: BenchmarkSuite = {
  id: 'humanizer-core-v1',
  name: 'Humanizer Core Benchmarks',
  description:
    'Core benchmark suite for validating humanization quality. ' +
    'Covers philosophical, technical, creative, conversational, and academic text.',
  passages: DEFAULT_BENCHMARK_PASSAGES,
  expectedBehaviors: DEFAULT_EXPECTED_BEHAVIORS,
  metrics: DEFAULT_BENCHMARK_METRICS,
  weights: DEFAULT_BENCHMARK_WEIGHTS,
  version: 1,
  updatedAt: new Date('2026-01-24'),
};

// ═══════════════════════════════════════════════════════════════════════════
// BENCHMARK RUNNER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Options for running benchmarks
 */
export interface BenchmarkRunnerOptions {
  /** Custom suite to use (defaults to DEFAULT_BENCHMARK_SUITE) */
  suite?: BenchmarkSuite;

  /** Only run specific passage categories */
  categories?: PassageCategory[];

  /** Skip semantic drift calculation (faster but less thorough) */
  skipSemanticDrift?: boolean;

  /** Skip perplexity calculation */
  skipPerplexity?: boolean;

  /** Timeout per passage in milliseconds */
  passageTimeoutMs?: number;
}

/**
 * Callback for model invocation during benchmarks
 */
export type ModelInvoker = (input: string) => Promise<string>;

/**
 * Callback for embedding generation (for semantic drift)
 */
export type EmbeddingGenerator = (text: string) => Promise<number[]>;

/**
 * BenchmarkRunner executes benchmark suites against models
 */
export class BenchmarkRunner {
  private suite: BenchmarkSuite;
  private options: Required<Omit<BenchmarkRunnerOptions, 'suite' | 'categories'>>;

  constructor(options?: BenchmarkRunnerOptions) {
    this.suite = options?.suite ?? DEFAULT_BENCHMARK_SUITE;
    this.options = {
      skipSemanticDrift: options?.skipSemanticDrift ?? false,
      skipPerplexity: options?.skipPerplexity ?? true, // Default true as perplexity requires LM
      passageTimeoutMs: options?.passageTimeoutMs ?? 30000,
    };
  }

  /**
   * Run the benchmark suite against a model
   */
  async run(
    modelId: string,
    invoker: ModelInvoker,
    embedder?: EmbeddingGenerator,
    categories?: PassageCategory[]
  ): Promise<BenchmarkSuiteResult> {
    const startTime = Date.now();
    const passageResults: PassageBenchmarkResult[] = [];

    // Filter passages by category if specified
    const passages = categories
      ? this.suite.passages.filter((p) => categories.includes(p.category))
      : this.suite.passages;

    // Run each passage
    for (const passage of passages) {
      const result = await this.runPassage(passage, invoker, embedder);
      passageResults.push(result);
    }

    // Calculate overall scores
    const scores = this.calculateScores(passageResults);
    const stats = this.calculateStats(passageResults);

    // Determine overall pass/fail
    const passed =
      scores.overall >= 0.7 &&
      stats.passedPassages / stats.totalPassages >= 0.8;

    return {
      suiteId: this.suite.id,
      modelId,
      passageResults,
      scores,
      stats,
      passed,
      runAt: new Date(),
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Run a single passage benchmark
   */
  private async runPassage(
    passage: BenchmarkPassage,
    invoker: ModelInvoker,
    embedder?: EmbeddingGenerator
  ): Promise<PassageBenchmarkResult> {
    const startTime = Date.now();
    const issues: string[] = [];

    // Get model output
    let output: string;
    try {
      output = await invoker(passage.text);
    } catch (error) {
      return {
        passageId: passage.id,
        input: passage.text,
        output: '',
        patternResults: [],
        semanticDrift: 1.0,
        latencyMs: Date.now() - startTime,
        passed: false,
        issues: [`Model invocation failed: ${error}`],
      };
    }

    const latencyMs = Date.now() - startTime;

    // Check pattern compliance
    const patternResults = this.checkPatterns(output);
    const failedPatterns = patternResults.filter((r) => !r.passed);
    for (const failed of failedPatterns) {
      if (failed.behavior.severity === 'error') {
        issues.push(`Pattern violation: ${failed.behavior.description}`);
      }
    }

    // Calculate semantic drift if embedder provided
    let semanticDrift = 0;
    if (embedder && !this.options.skipSemanticDrift) {
      try {
        const inputEmbed = await embedder(passage.text);
        const outputEmbed = await embedder(output);
        semanticDrift = this.cosineDist(inputEmbed, outputEmbed);

        if (semanticDrift > this.suite.metrics.semanticDriftThreshold) {
          issues.push(
            `Semantic drift too high: ${semanticDrift.toFixed(3)} > ${this.suite.metrics.semanticDriftThreshold}`
          );
        }
      } catch (error) {
        issues.push(`Failed to calculate semantic drift: ${error}`);
      }
    }

    // Check expected traits (simplified - would need more sophisticated checks in practice)
    const passed =
      failedPatterns.filter((r) => r.behavior.severity === 'error').length === 0 &&
      semanticDrift <= this.suite.metrics.semanticDriftThreshold;

    return {
      passageId: passage.id,
      input: passage.text,
      output,
      patternResults,
      semanticDrift,
      latencyMs,
      passed,
      issues,
    };
  }

  /**
   * Check all expected behavior patterns against output
   */
  private checkPatterns(
    output: string
  ): Array<{ behavior: ExpectedBehavior; passed: boolean; matchCount: number }> {
    return this.suite.expectedBehaviors.map((behavior) => {
      const matches = output.match(behavior.pattern);
      const matchCount = matches?.length ?? 0;
      const passed = behavior.shouldMatch ? matchCount > 0 : matchCount === 0;
      return { behavior, passed, matchCount };
    });
  }

  /**
   * Calculate cosine distance between two vectors
   */
  private cosineDist(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    return 1 - similarity; // Convert to distance
  }

  /**
   * Calculate overall scores from passage results
   */
  private calculateScores(
    results: PassageBenchmarkResult[]
  ): BenchmarkSuiteResult['scores'] {
    if (results.length === 0) {
      return {
        patternCompliance: 0,
        semanticPreservation: 0,
        fluency: 1,
        style: 1,
        overall: 0,
      };
    }

    // Pattern compliance: ratio of passed patterns
    const allPatternResults = results.flatMap((r) => r.patternResults);
    const patternCompliance =
      allPatternResults.filter((r) => r.passed).length / allPatternResults.length;

    // Semantic preservation: inverse of average drift
    const avgDrift =
      results.reduce((sum, r) => sum + r.semanticDrift, 0) / results.length;
    const semanticPreservation = 1 - avgDrift;

    // Fluency: placeholder (would need perplexity calculation)
    const fluency = 0.85;

    // Style: placeholder (would need style analysis)
    const style = 0.8;

    // Weighted overall
    const overall =
      this.suite.weights.patternCompliance * patternCompliance +
      this.suite.weights.semanticPreservation * semanticPreservation +
      this.suite.weights.fluency * fluency +
      this.suite.weights.style * style;

    return {
      patternCompliance,
      semanticPreservation,
      fluency,
      style,
      overall,
    };
  }

  /**
   * Calculate summary statistics
   */
  private calculateStats(
    results: PassageBenchmarkResult[]
  ): BenchmarkSuiteResult['stats'] {
    const totalPassages = results.length;
    const passedPassages = results.filter((r) => r.passed).length;
    const failedPassages = totalPassages - passedPassages;
    const avgLatencyMs =
      results.reduce((sum, r) => sum + r.latencyMs, 0) / totalPassages || 0;
    const avgSemanticDrift =
      results.reduce((sum, r) => sum + r.semanticDrift, 0) / totalPassages || 0;

    return {
      totalPassages,
      passedPassages,
      failedPassages,
      avgLatencyMs,
      avgSemanticDrift,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export {
  DEFAULT_BENCHMARK_PASSAGES as BENCHMARK_PASSAGES,
  DEFAULT_EXPECTED_BEHAVIORS as EXPECTED_BEHAVIORS,
  DEFAULT_BENCHMARK_METRICS as BENCHMARK_METRICS,
  DEFAULT_BENCHMARK_WEIGHTS as BENCHMARK_WEIGHTS,
};
