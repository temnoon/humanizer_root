/**
 * @humanizer/npe
 *
 * Narrative Projection Engine - Transformation and Analysis Services
 *
 * This package provides:
 * - SIC (Subjective Intentional Constraint) - AI detection through constraint analysis
 * - Quantum Reading - Embedding-based density matrix evolution
 * - LLM Adapter - Abstraction for different LLM backends
 *
 * Core Principles (Subjective Narrative Theory):
 * - Reading changes how we read
 * - Meaning exists in superposition across interpretive stances
 * - Each sentence transforms the reader's semantic state
 */

// ═══════════════════════════════════════════════════════════════════════════
// CORE TYPES
// ═══════════════════════════════════════════════════════════════════════════
export type {
  // SIC Types
  TextChunk,
  EvidenceQuote,
  SicFeatureKey,
  FeatureScore,
  InflectionPoint,
  Genre,
  SicDiagnostics,
  NarrativeModeCaveat,
  SicResult,
  StyleCheckResult,
  ProfileVettingResult,
  SicWeights,
  // Quantum Types
  DensityMatrixState,
  TetralemmaReading,
  CornerMeasurement,
  POVMMeasurement,
  QuantumSession,
  // Transformation Types
  Persona,
  Namespace,
  Style,
  TransformationOptions,
  TransformationResult,
  TransformationMetrics,
  AllegoricalStage,
  AllegoricalResult,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════
// LLM ADAPTER
// ═══════════════════════════════════════════════════════════════════════════
export * from './llm/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// SIC (SUBJECTIVE INTENTIONAL CONSTRAINT)
// ═══════════════════════════════════════════════════════════════════════════
export * from './sic/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// QUANTUM READING
// ═══════════════════════════════════════════════════════════════════════════
export * from './quantum/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// TRANSFORMATIONS
// ═══════════════════════════════════════════════════════════════════════════
export * from './transformations/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// HUMANIZER (AI Detection + Text Humanization)
// ═══════════════════════════════════════════════════════════════════════════
export * from './humanizer/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// BQL (Batch Query Language + RLM Context Management)
// ═══════════════════════════════════════════════════════════════════════════
export * from './bql/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// AGENTS (Autonomous Book Making with Rho Quality Control)
// ═══════════════════════════════════════════════════════════════════════════
export * from './agents/index.js';
