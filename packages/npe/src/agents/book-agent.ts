/**
 * Book Agent - Autonomous Book Making with Rho-Based Quality Control
 *
 * This agent combines:
 * - Quantum reading analysis (ρ density matrix evolution)
 * - Text transformation (persona, style)
 * - Self-iteration based on purity/entropy thresholds
 *
 * The key insight: If transformation DILUTES meaning (purity drops, entropy spikes),
 * the agent retries with adjusted parameters. This is the "Subjective Intentional
 * Constraint" made operational - good text has CONCENTRATED meaning.
 *
 * Architecture inspired by QBism's Born Rule reformulation:
 * - LLM text = classical probability (smooth averaging)
 * - Human text = Born Rule with constraint (the (d+1) term)
 * - This agent enforces the constraint via Rho measurements
 */

import type { LlmAdapter } from '../llm/types.js';
import type {
  DensityMatrixState,
  POVMMeasurement,
  QuantumSession,
} from '../types.js';
import type {
  PersonaDefinition,
  StyleDefinition,
  TransformResult,
} from '../transformations/types.js';
import { ReadingSessionManager, type ReadingStep } from '../quantum/reading-session.js';
import { TransformerService } from '../transformations/transformer.js';
import {
  createMaximallyMixedState,
  densityMatrixDistance,
} from '../quantum/density-matrix.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Quality thresholds for self-iteration
 */
export interface QualityThresholds {
  /** Minimum purity to maintain (default: 0.15) */
  minPurity: number;
  /** Maximum entropy allowed (default: 2.8) */
  maxEntropy: number;
  /** Maximum purity drop per transformation (default: 0.1) */
  maxPurityDrop: number;
  /** Maximum entropy increase per transformation (default: 0.3) */
  maxEntropyIncrease: number;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum retry attempts (default: 3) */
  maxRetries: number;
  /** Temperature adjustment per retry (default: -0.1) */
  temperatureAdjustment: number;
  /** Whether to try alternative transformations (default: true) */
  tryAlternatives: boolean;
}

/**
 * Book agent options
 */
export interface BookAgentOptions {
  /** Quality thresholds */
  thresholds?: Partial<QualityThresholds>;
  /** Retry configuration */
  retry?: Partial<RetryConfig>;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Rho analysis result
 */
export interface RhoAnalysis {
  /** Initial state (maximally mixed) */
  initialState: DensityMatrixState;
  /** Final state after reading all sentences */
  finalState: DensityMatrixState;
  /** All reading steps */
  steps: ReadingStep[];
  /** Purity trajectory (per sentence) */
  purityTrajectory: number[];
  /** Entropy trajectory (per sentence) */
  entropyTrajectory: number[];
  /** Sentences with highest semantic weight (load-bearing) */
  loadBearingSentences: Array<{ index: number; sentence: string; distance: number }>;
  /** Overall quality assessment */
  quality: 'high' | 'medium' | 'low';
}

/**
 * Transformation attempt result
 */
export interface TransformAttempt {
  /** Attempt number */
  attempt: number;
  /** Transformed text */
  text: string;
  /** Rho analysis of transformed text */
  analysis: RhoAnalysis;
  /** Whether quality thresholds were met */
  passed: boolean;
  /** Reason for failure (if any) */
  failureReason?: string;
  /** Duration in ms */
  durationMs: number;
}

/**
 * Book agent result
 */
export interface BookAgentResult {
  /** Final transformed text */
  text: string;
  /** Original text analysis */
  originalAnalysis: RhoAnalysis;
  /** Final text analysis */
  finalAnalysis: RhoAnalysis;
  /** All transformation attempts */
  attempts: TransformAttempt[];
  /** Whether transformation succeeded */
  success: boolean;
  /** Total duration in ms */
  totalDurationMs: number;
  /** Quality delta (positive = improvement) */
  qualityDelta: {
    purity: number;
    entropy: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_THRESHOLDS: QualityThresholds = {
  minPurity: 0.15,
  maxEntropy: 2.8,
  maxPurityDrop: 0.1,
  maxEntropyIncrease: 0.3,
};

const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 3,
  temperatureAdjustment: -0.1,
  tryAlternatives: true,
};

// ═══════════════════════════════════════════════════════════════════════════
// BOOK AGENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Book Agent - Autonomous transformation with Rho quality control
 */
export class BookAgent {
  private readingManager: ReadingSessionManager;
  private transformer: TransformerService;
  private thresholds: QualityThresholds;
  private retryConfig: RetryConfig;
  private verbose: boolean;
  private embedder: (text: string) => Promise<number[]>;

  constructor(
    adapter: LlmAdapter,
    embedder: (text: string) => Promise<number[]>,
    options: BookAgentOptions = {}
  ) {
    this.readingManager = new ReadingSessionManager(adapter, embedder);
    this.transformer = new TransformerService(adapter);
    this.embedder = embedder;
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...options.thresholds };
    this.retryConfig = { ...DEFAULT_RETRY, ...options.retry };
    this.verbose = options.verbose ?? false;
  }

  /**
   * Analyze text using Rho density matrix evolution
   */
  async analyzeRho(text: string): Promise<RhoAnalysis> {
    const session = await this.readingManager.startSession(text);
    const initialState = createMaximallyMixedState();
    const steps: ReadingStep[] = [];
    const purityTrajectory: number[] = [initialState.purity];
    const entropyTrajectory: number[] = [initialState.entropy];

    // Process all sentences
    while (!this.readingManager.isComplete(session.id)) {
      const step = await this.readingManager.stepSession(session.id);
      if (step) {
        steps.push(step);
        purityTrajectory.push(step.rhoAfter.purity);
        entropyTrajectory.push(step.rhoAfter.entropy);
      }
    }

    const finalState = this.readingManager.getSession(session.id)?.rhoState ?? initialState;

    // Find load-bearing sentences (highest distance = most meaning shift)
    const loadBearingSentences = steps
      .map((step, i) => ({
        index: i,
        sentence: step.sentence,
        distance: step.rhoDistance,
      }))
      .sort((a, b) => b.distance - a.distance)
      .slice(0, 3);

    // Assess quality
    const quality = this.assessQuality(finalState);

    // Cleanup
    this.readingManager.clearSession(session.id);

    return {
      initialState,
      finalState,
      steps,
      purityTrajectory,
      entropyTrajectory,
      loadBearingSentences,
      quality,
    };
  }

  /**
   * Transform text with persona, using Rho-based quality control
   */
  async transformWithPersona(
    text: string,
    persona: PersonaDefinition
  ): Promise<BookAgentResult> {
    const startTime = Date.now();

    // Analyze original
    this.log('Analyzing original text...');
    const originalAnalysis = await this.analyzeRho(text);
    this.log(`Original: purity=${originalAnalysis.finalState.purity.toFixed(3)}, entropy=${originalAnalysis.finalState.entropy.toFixed(3)}`);

    const attempts: TransformAttempt[] = [];
    let currentText = text;
    let currentTemperature = 0.7;
    let success = false;
    let finalAnalysis = originalAnalysis;

    // Retry loop
    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      this.log(`\nAttempt ${attempt}/${this.retryConfig.maxRetries} (temp=${currentTemperature.toFixed(2)})...`);
      const attemptStart = Date.now();

      // Transform
      const result = await this.transformer.transformPersona(currentText, persona, {
        temperature: currentTemperature,
      });

      // Analyze result
      const analysis = await this.analyzeRho(result.text);
      this.log(`Result: purity=${analysis.finalState.purity.toFixed(3)}, entropy=${analysis.finalState.entropy.toFixed(3)}`);

      // Check quality
      const { passed, reason } = this.checkQuality(originalAnalysis, analysis);

      attempts.push({
        attempt,
        text: result.text,
        analysis,
        passed,
        failureReason: reason,
        durationMs: Date.now() - attemptStart,
      });

      if (passed) {
        this.log(`Attempt ${attempt} PASSED`);
        currentText = result.text;
        finalAnalysis = analysis;
        success = true;
        break;
      } else {
        this.log(`Attempt ${attempt} FAILED: ${reason}`);
        // Adjust temperature for retry (lower = more conservative)
        currentTemperature = Math.max(0.3, currentTemperature + this.retryConfig.temperatureAdjustment);
      }
    }

    return {
      text: success ? currentText : text, // Return original if all attempts failed
      originalAnalysis,
      finalAnalysis,
      attempts,
      success,
      totalDurationMs: Date.now() - startTime,
      qualityDelta: {
        purity: finalAnalysis.finalState.purity - originalAnalysis.finalState.purity,
        entropy: finalAnalysis.finalState.entropy - originalAnalysis.finalState.entropy,
      },
    };
  }

  /**
   * Transform text with style, using Rho-based quality control
   */
  async transformWithStyle(
    text: string,
    style: StyleDefinition
  ): Promise<BookAgentResult> {
    const startTime = Date.now();

    // Analyze original
    this.log('Analyzing original text...');
    const originalAnalysis = await this.analyzeRho(text);
    this.log(`Original: purity=${originalAnalysis.finalState.purity.toFixed(3)}, entropy=${originalAnalysis.finalState.entropy.toFixed(3)}`);

    const attempts: TransformAttempt[] = [];
    let currentText = text;
    let currentTemperature = 0.7;
    let success = false;
    let finalAnalysis = originalAnalysis;

    // Retry loop
    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      this.log(`\nAttempt ${attempt}/${this.retryConfig.maxRetries} (temp=${currentTemperature.toFixed(2)})...`);
      const attemptStart = Date.now();

      // Transform
      const result = await this.transformer.transformStyle(currentText, style, {
        temperature: currentTemperature,
      });

      // Analyze result
      const analysis = await this.analyzeRho(result.text);
      this.log(`Result: purity=${analysis.finalState.purity.toFixed(3)}, entropy=${analysis.finalState.entropy.toFixed(3)}`);

      // Check quality
      const { passed, reason } = this.checkQuality(originalAnalysis, analysis);

      attempts.push({
        attempt,
        text: result.text,
        analysis,
        passed,
        failureReason: reason,
        durationMs: Date.now() - attemptStart,
      });

      if (passed) {
        this.log(`Attempt ${attempt} PASSED`);
        currentText = result.text;
        finalAnalysis = analysis;
        success = true;
        break;
      } else {
        this.log(`Attempt ${attempt} FAILED: ${reason}`);
        currentTemperature = Math.max(0.3, currentTemperature + this.retryConfig.temperatureAdjustment);
      }
    }

    return {
      text: success ? currentText : text,
      originalAnalysis,
      finalAnalysis,
      attempts,
      success,
      totalDurationMs: Date.now() - startTime,
      qualityDelta: {
        purity: finalAnalysis.finalState.purity - originalAnalysis.finalState.purity,
        entropy: finalAnalysis.finalState.entropy - originalAnalysis.finalState.entropy,
      },
    };
  }

  /**
   * Pipeline: Apply multiple transformations with quality gates between each
   */
  async transformPipeline(
    text: string,
    transforms: Array<
      | { type: 'persona'; definition: PersonaDefinition }
      | { type: 'style'; definition: StyleDefinition }
    >
  ): Promise<{
    text: string;
    stages: BookAgentResult[];
    totalDurationMs: number;
    success: boolean;
  }> {
    const startTime = Date.now();
    const stages: BookAgentResult[] = [];
    let currentText = text;
    let allSuccess = true;

    for (const transform of transforms) {
      let result: BookAgentResult;

      if (transform.type === 'persona') {
        result = await this.transformWithPersona(currentText, transform.definition);
      } else {
        result = await this.transformWithStyle(currentText, transform.definition);
      }

      stages.push(result);

      if (result.success) {
        currentText = result.text;
      } else {
        allSuccess = false;
        this.log(`Pipeline halted: ${transform.type} transformation failed`);
        break;
      }
    }

    return {
      text: currentText,
      stages,
      totalDurationMs: Date.now() - startTime,
      success: allSuccess,
    };
  }

  /**
   * Identify load-bearing sentences in text
   * (High SIC = concentrated meaning = fragile if removed)
   */
  async findLoadBearingSentences(
    text: string,
    topN: number = 5
  ): Promise<Array<{ index: number; sentence: string; weight: number; fragility: 'high' | 'medium' | 'low' }>> {
    const analysis = await this.analyzeRho(text);

    return analysis.steps
      .map((step, i) => {
        const weight = step.rhoDistance;
        // Fragility based on distance threshold
        const fragility: 'high' | 'medium' | 'low' =
          weight > 0.15 ? 'high' : weight > 0.08 ? 'medium' : 'low';

        return {
          index: i,
          sentence: step.sentence,
          weight,
          fragility,
        };
      })
      .sort((a, b) => b.weight - a.weight)
      .slice(0, topN);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Assess overall quality from final state
   */
  private assessQuality(state: DensityMatrixState): 'high' | 'medium' | 'low' {
    // High purity + low entropy = concentrated meaning = good
    if (state.purity >= 0.25 && state.entropy <= 2.5) return 'high';
    if (state.purity >= 0.15 && state.entropy <= 3.0) return 'medium';
    return 'low';
  }

  /**
   * Check if transformation maintained quality
   */
  private checkQuality(
    original: RhoAnalysis,
    transformed: RhoAnalysis
  ): { passed: boolean; reason?: string } {
    const purityDrop = original.finalState.purity - transformed.finalState.purity;
    const entropyIncrease = transformed.finalState.entropy - original.finalState.entropy;

    // Check absolute thresholds
    if (transformed.finalState.purity < this.thresholds.minPurity) {
      return { passed: false, reason: `Purity too low: ${transformed.finalState.purity.toFixed(3)} < ${this.thresholds.minPurity}` };
    }

    if (transformed.finalState.entropy > this.thresholds.maxEntropy) {
      return { passed: false, reason: `Entropy too high: ${transformed.finalState.entropy.toFixed(3)} > ${this.thresholds.maxEntropy}` };
    }

    // Check relative changes
    if (purityDrop > this.thresholds.maxPurityDrop) {
      return { passed: false, reason: `Purity dropped too much: -${purityDrop.toFixed(3)} > ${this.thresholds.maxPurityDrop}` };
    }

    if (entropyIncrease > this.thresholds.maxEntropyIncrease) {
      return { passed: false, reason: `Entropy increased too much: +${entropyIncrease.toFixed(3)} > ${this.thresholds.maxEntropyIncrease}` };
    }

    return { passed: true };
  }

  /**
   * Log message if verbose
   */
  private log(message: string): void {
    if (this.verbose) {
      console.log(`[BookAgent] ${message}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a book agent with default configuration
 */
export function createBookAgent(
  adapter: LlmAdapter,
  embedder: (text: string) => Promise<number[]>,
  options?: BookAgentOptions
): BookAgent {
  return new BookAgent(adapter, embedder, options);
}
