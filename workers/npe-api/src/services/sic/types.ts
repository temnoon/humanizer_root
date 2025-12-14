/**
 * Subjective Intentional Constraint (SIC) - Core Types
 *
 * This module defines the core types for the SIC framework, which measures
 * not statistical patterns but the cost of authorship: whether text bears
 * traces of commitment, tradeoff, irreversibility, and accountable specificity.
 *
 * TERMINOLOGY:
 * - "sic" = Subjective Intentional Constraint (novel contribution)
 * - "style_check" = traditional stylometry (supporting tool)
 * - NEVER use SIC1/SIC2 terminology
 */

/**
 * Adapter interface for LLM providers
 * Abstracts away provider-specific quirks
 */
export interface LlmAdapter {
  /**
   * Complete a prompt and return the response
   * @param prompt - The system prompt
   * @param input - The user input text
   * @param options - Additional options (temperature, max_tokens)
   */
  complete(
    prompt: string,
    input: string,
    options?: {
      temperature?: number;
      max_tokens?: number;
      model?: string;
    }
  ): Promise<string>;

  /**
   * Normalize the response to clean JSON
   * Strips XML tags, markdown fences, preambles, etc.
   */
  normalize?(response: string): string;

  /**
   * Get the provider name for logging
   */
  getProviderName(): string;
}

/**
 * A chunk of text for analysis
 */
export interface TextChunk {
  id: string;
  text: string;
  startIndex: number;
  endIndex: number;
  sentenceCount: number;
}

/**
 * A quote extracted as evidence for a feature
 */
export interface EvidenceQuote {
  /** Short quote from the text (max 25 words) */
  quote: string;
  /** Why this quote supports the feature score */
  rationale: string;
  /** Which chunk this came from */
  chunkId?: string;
}

/**
 * Feature categories for SIC analysis
 *
 * These operationalize Subjective Intentional Constraint:
 * - 6 positive features (raise score)
 * - 2 negative features (lower score)
 */
export type SicFeatureKey =
  // Positive features (indicators of human authorship)
  | 'commitment_irreversibility'      // P1: Concrete decisions with consequences
  | 'epistemic_risk_uncertainty'      // P2: Being wrong, surprises, ignorance that matters
  | 'time_pressure_tradeoffs'         // P3: Urgency, deadlines, asymmetric time awareness
  | 'situatedness_body_social'        // P4: Embodied risk, social cost, friction
  | 'scar_tissue_specificity'         // P5: Defensiveness, regret, persistent awkwardness
  | 'bounded_viewpoint'               // P6: Non-omniscient narration
  // Negative features (indicators of AI generation)
  | 'anti_smoothing'                  // N1: Resistance to hedging/balancing (inverse: smoothing)
  | 'meta_contamination';             // N2: Preambles, "EDIT:", roleplay wrappers

/**
 * Score for a single feature with evidence
 */
export interface FeatureScore {
  /** Score from 0-100 */
  score: number;
  /** Brief notes explaining the score */
  notes: string;
  /** Evidence quotes supporting this score */
  evidence: EvidenceQuote[];
}

/**
 * Inflection point / collapse point in the text
 * A sentence where interpretive degrees of freedom reduce
 */
export interface InflectionPoint {
  /** Which chunk this came from */
  chunkId: string;
  /** Type of collapse */
  kind: 'commitment' | 'reversal' | 'reframe' | 'stakes' | 'constraint-reveal';
  /** The sentence or phrase */
  quote: string;
  /** Why this moment matters for constraint transmission */
  whyItMatters: string;
}

/**
 * Detected genre of the text
 */
export type Genre =
  | 'narrative'    // Personal essays, stories, memoirs
  | 'argument'     // Opinion pieces, persuasive writing
  | 'technical'    // Documentation, manuals, specifications
  | 'legal'        // Contracts, legal briefs, terms
  | 'marketing'    // Promotional, sales copy
  | 'unknown';

/**
 * Diagnostic flags for edge cases
 */
export interface SicDiagnostics {
  /** Whether genre baseline was applied to calibrate scores */
  genreBaselineUsed: boolean;
  /** True if low SIC might be intentional professional suppression of subjectivity */
  corporateBureaucratRisk: boolean;
  /** Primary AI signal: high fluency with low commitment */
  highFluencyLowCommitmentPattern: boolean;
}

/**
 * Narrative mode signals detected in fiction/narrative text
 * Exposes reasoning about how narrative technique affects SIC interpretation
 */
export interface NarrativeModeCaveat {
  /** Detected narrative mode (may be uncertain) */
  mode: 'first_person_confessional' | 'first_person_observer' | 'third_person_limited'
      | 'third_person_omniscient' | 'stream_of_consciousness' | 'uncertain';

  /** Confidence in mode detection (0-1) */
  confidence: number;

  /** Specific signals detected that informed this assessment */
  signals: string[];

  /** How this mode affects SIC interpretation */
  interpretationNote: string;

  /** Whether standard SIC scoring applies cleanly to this text */
  standardScoringApplies: boolean;
}

/**
 * The core SIC result
 * This is the main output of the sic() analysis
 */
export interface SicResult {
  /** API version */
  version: 'sic.v1';

  /** Overall SIC score (0-100) */
  sicScore: number;

  /** Probability text is AI-generated (0-1), genre-aware */
  aiProbability: number;

  /** Detected genre */
  genre: Genre;

  /** Per-feature scores with evidence */
  features: Record<SicFeatureKey, FeatureScore>;

  /** Key inflection/collapse points in the text */
  inflectionPoints: InflectionPoint[];

  /** Edge case diagnostics */
  diagnostics: SicDiagnostics;

  /** Human-readable summary */
  notes: string;

  /** Narrative mode caveat for fiction/narrative (when applicable) */
  narrativeModeCaveat?: NarrativeModeCaveat;

  /** Raw LLM call count for this analysis */
  llmCallCount?: number;
}

/**
 * Style check result (traditional stylometry)
 * This is a supporting tool, NOT the novel contribution
 */
export interface StyleCheckResult {
  /** API version */
  version: 'style_check.v1';

  /** Consistency score (0-100) */
  consistencyScore: number;

  /** Profile match score (0-100) */
  profileMatchScore: number;

  /** Notes on style deviations */
  deviations: string[];

  /** Raw metrics */
  metrics: {
    perplexity?: number;
    burstiness?: number;
    avgSentenceLength?: number;
    typeTokenRatio?: number;
  };
}

/**
 * Result of vetting a text sample for profile extraction
 */
export interface ProfileVettingResult {
  /** API version */
  version: 'profile_vet.v1';

  /** Whether this text is suitable for profile extraction */
  suitable: boolean;

  /** Overall quality score (0-100) */
  qualityScore: number;

  /** SIC score of the sample */
  sicScore: number;

  /** Reasons this sample may be unsuitable */
  concerns: string[];

  /** Recommendations for better samples */
  recommendations: string[];
}

/**
 * Weight configuration for SIC feature scoring
 */
export interface SicWeights {
  // Positive feature weights (sum should be ~1.0)
  commitment_irreversibility: number;      // Suggested: 0.22
  epistemic_risk_uncertainty: number;      // Suggested: 0.16
  time_pressure_tradeoffs: number;         // Suggested: 0.14
  situatedness_body_social: number;        // Suggested: 0.12
  scar_tissue_specificity: number;         // Suggested: 0.18
  bounded_viewpoint: number;               // Suggested: 0.18

  // Negative feature penalties (applied as subtraction)
  anti_smoothing_penalty: number;          // Suggested: 0.30
  meta_contamination_penalty: number;      // Suggested: 0.25
}

/**
 * Default weights based on framework design
 */
export const DEFAULT_SIC_WEIGHTS: SicWeights = {
  commitment_irreversibility: 0.22,
  epistemic_risk_uncertainty: 0.16,
  time_pressure_tradeoffs: 0.14,
  situatedness_body_social: 0.12,
  scar_tissue_specificity: 0.18,
  bounded_viewpoint: 0.18,
  anti_smoothing_penalty: 0.30,
  meta_contamination_penalty: 0.25,
};

/**
 * Genre baseline adjustments
 * Low SIC in technical/legal writing is appropriate, not a false positive
 */
export const GENRE_BASELINES: Record<Genre, number> = {
  narrative: 0,      // No adjustment - high SIC expected
  argument: -5,      // Slight adjustment - some formality expected
  technical: -25,    // Significant adjustment - professional suppression expected
  legal: -30,        // Major adjustment - intentional objectivity
  marketing: -10,    // Some adjustment - promotional voice expected
  unknown: 0,        // No adjustment
};
