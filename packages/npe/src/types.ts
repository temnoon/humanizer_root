/**
 * NPE Core Types
 *
 * Central type definitions for the Narrative Projection Engine.
 *
 * Modules:
 * - SIC (Subjective Intentional Constraint) - AI detection through constraint analysis
 * - Quantum Reading - Density matrix evolution and POVM measurement
 * - Transformations - Persona, style, namespace transformations
 */

// ═══════════════════════════════════════════════════════════════════════════
// SIC (SUBJECTIVE INTENTIONAL CONSTRAINT) TYPES
// ═══════════════════════════════════════════════════════════════════════════

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
  | 'anti_smoothing'                  // N1: Resistance to hedging/balancing
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
 */
export interface InflectionPoint {
  chunkId: string;
  kind: 'commitment' | 'reversal' | 'reframe' | 'stakes' | 'constraint-reveal';
  quote: string;
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
  genreBaselineUsed: boolean;
  corporateBureaucratRisk: boolean;
  highFluencyLowCommitmentPattern: boolean;
}

/**
 * Narrative mode signals for fiction
 */
export interface NarrativeModeCaveat {
  mode: 'first_person_confessional' | 'first_person_observer' | 'third_person_limited'
      | 'third_person_omniscient' | 'stream_of_consciousness' | 'uncertain';
  confidence: number;
  signals: string[];
  interpretationNote: string;
  standardScoringApplies: boolean;
}

/**
 * The core SIC result
 */
export interface SicResult {
  version: 'sic.v1';
  sicScore: number;
  aiProbability: number;
  genre: Genre;
  features: Record<SicFeatureKey, FeatureScore>;
  inflectionPoints: InflectionPoint[];
  diagnostics: SicDiagnostics;
  notes: string;
  narrativeModeCaveat?: NarrativeModeCaveat;
  llmCallCount?: number;
}

/**
 * Style check result (traditional stylometry)
 */
export interface StyleCheckResult {
  version: 'style_check.v1';
  consistencyScore: number;
  profileMatchScore: number;
  deviations: string[];
  metrics: {
    perplexity?: number;
    burstiness?: number;
    avgSentenceLength?: number;
    typeTokenRatio?: number;
  };
}

/**
 * Profile vetting result
 */
export interface ProfileVettingResult {
  version: 'profile_vet.v1';
  suitable: boolean;
  qualityScore: number;
  sicScore: number;
  concerns: string[];
  recommendations: string[];
}

/**
 * SIC feature weights
 */
export interface SicWeights {
  commitment_irreversibility: number;
  epistemic_risk_uncertainty: number;
  time_pressure_tradeoffs: number;
  situatedness_body_social: number;
  scar_tissue_specificity: number;
  bounded_viewpoint: number;
  anti_smoothing_penalty: number;
  meta_contamination_penalty: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// QUANTUM READING TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Density matrix state
 * Represents the reader's semantic state as a 32×32 density matrix
 */
export interface DensityMatrixState {
  /** Diagonal elements (sorted descending) */
  eigenvalues: number[];
  /** Tr(ρ²) ∈ [1/32, 1] - measures state purity */
  purity: number;
  /** -Tr(ρ log ρ) ∈ [0, ln(32)] - measures uncertainty */
  entropy: number;
  /** Sum of eigenvalues (should be 1.0) */
  trace: number;
  /** ISO timestamp */
  timestamp: string;
}

/**
 * Tetralemma measurement result (four corners)
 */
export interface TetralemmaReading {
  literal: CornerMeasurement;
  metaphorical: CornerMeasurement;
  both: CornerMeasurement;
  neither: CornerMeasurement;
}

/**
 * Single corner measurement
 */
export interface CornerMeasurement {
  probability: number;
  evidence: string;
}

/**
 * POVM measurement result
 */
export interface POVMMeasurement {
  sentence: string;
  sentenceIndex: number;
  reading: TetralemmaReading;
  isValid: boolean;
  probSum: number;
}

/**
 * Quantum reading session state
 */
export interface QuantumSession {
  id: string;
  text: string;
  sentences: string[];
  currentSentenceIndex: number;
  rhoState: DensityMatrixState;
  measurements: POVMMeasurement[];
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// TRANSFORMATION TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Persona definition
 */
export interface Persona {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  attributes?: Record<string, string>;
}

/**
 * Namespace (conceptual universe) definition
 */
export interface Namespace {
  id: string;
  name: string;
  description: string;
  contextPrompt: string;
}

/**
 * Style definition
 */
export interface Style {
  id: string;
  name: string;
  stylePrompt: string;
  attributes?: Record<string, string>;
}

/**
 * Transformation options
 */
export interface TransformationOptions {
  /** Preserve approximate length */
  preserveLength?: boolean;
  /** Enable validation loop */
  enableValidation?: boolean;
  /** Target model */
  model?: string;
  /** Temperature for generation */
  temperature?: number;
}

/**
 * Transformation result
 */
export interface TransformationResult {
  transformationId: string;
  inputText: string;
  outputText: string;
  /** Metrics before transformation */
  baseline?: TransformationMetrics;
  /** Metrics after transformation */
  final?: TransformationMetrics;
  /** Processing info */
  processing: {
    model: string;
    latencyMs: number;
    tokensUsed?: number;
  };
}

/**
 * Metrics for transformation quality
 */
export interface TransformationMetrics {
  wordCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
  lexicalDiversity?: number;
  burstiness?: number;
}

/**
 * Allegorical projection stage
 */
export interface AllegoricalStage {
  name: string;
  input: string;
  output: string;
  prompt?: string;
}

/**
 * Allegorical projection result
 */
export interface AllegoricalResult {
  transformationId: string;
  finalProjection: string;
  reflection: string;
  stages: AllegoricalStage[];
  processing: {
    totalLatencyMs: number;
    model: string;
  };
}
