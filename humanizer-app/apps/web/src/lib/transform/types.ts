/**
 * Transformation Types
 *
 * Type definitions for the NPE transformation API
 */

// ═══════════════════════════════════════════════════════════════════
// HUMANIZER TYPES
// ═══════════════════════════════════════════════════════════════════

export type HumanizationIntensity = 'light' | 'moderate' | 'aggressive';

export interface HumanizerRequest {
  text: string;
  intensity?: HumanizationIntensity;
  voiceSamples?: string[];
  enableLLMPolish?: boolean;
  targetBurstiness?: number;
  targetLexicalDiversity?: number;
  model?: string;
  enableSicAnalysis?: boolean;
}

export interface HumanizerResponse {
  transformation_id: string;
  humanizedText: string;
  baseline?: DetectionMetrics;
  final?: DetectionMetrics;
  improvement?: {
    confidence_delta: number;
    burstiness_delta: number;
  };
  stages?: TransformationStage[];
  voiceProfile?: VoiceProfile;
  model_used?: string;
  processing?: ProcessingInfo;
  sicAnalysis?: SICAnalysis;
}

export interface DetectionMetrics {
  detection?: {
    confidence: number;
    verdict?: 'human' | 'ai' | 'mixed';
  };
  burstiness?: number;
  lexicalDiversity?: number;
}

export interface TransformationStage {
  name: string;
  outputText?: string;
  changes?: number;
}

export interface VoiceProfile {
  avgSentenceLength?: number;
  vocabulary?: string[];
}

export interface ProcessingInfo {
  totalTimeMs: number;
  stageTimings?: Record<string, number>;
}

export interface SICAnalysis {
  score: number;
  sentences?: Array<{
    text: string;
    sicScore: number;
    trajectory?: number[];
  }>;
}

// ═══════════════════════════════════════════════════════════════════
// PERSONA TYPES
// ═══════════════════════════════════════════════════════════════════

export interface PersonaRequest {
  text: string;
  persona: string;
  preserveLength?: boolean;
  enableValidation?: boolean;
  model?: string;
}

export interface PersonaResponse {
  transformation_id: string;
  transformed_text: string;
  baseline?: DetectionMetrics;
  final?: DetectionMetrics;
  improvement?: {
    confidence_delta: number;
  };
  processing?: ProcessingInfo;
  model_used?: string;
}

// ═══════════════════════════════════════════════════════════════════
// STYLE TYPES
// ═══════════════════════════════════════════════════════════════════

export interface StyleRequest {
  text: string;
  style: string;
  preserveLength?: boolean;
  enableValidation?: boolean;
  model?: string;
}

export interface StyleResponse {
  transformation_id: string;
  transformed_text: string;
  baseline?: DetectionMetrics;
  final?: DetectionMetrics;
  improvement?: {
    confidence_delta: number;
  };
  processing?: ProcessingInfo;
  model_used?: string;
}

// ═══════════════════════════════════════════════════════════════════
// AI DETECTION TYPES
// ═══════════════════════════════════════════════════════════════════

export interface DetectionRequest {
  text: string;
}

export interface DetectionResponse {
  verdict: 'human' | 'ai' | 'mixed';
  confidence: number;
  explanation?: string;
  method: 'gptzero' | 'lite' | 'v2';
  details?: {
    completely_generated_prob?: number;
    average_generated_prob?: number;
    sentences?: Array<{
      sentence: string;
      generated_prob: number;
    }>;
  };
  processingTimeMs?: number;
}

// ═══════════════════════════════════════════════════════════════════
// QUANTUM ANALYSIS TYPES (Sentencing)
// ═══════════════════════════════════════════════════════════════════

export interface QuantumSessionStartRequest {
  text: string;
}

export interface QuantumSessionStartResponse {
  session_id: string;
  total_sentences: number;
  sentences: string[];
  initial_rho: {
    purity: number;
    entropy: number;
    top_eigenvalues: number[];
  };
}

export interface TetralemmaProbs {
  literal: { probability: number; evidence: string };
  metaphorical: { probability: number; evidence: string };
  both: { probability: number; evidence: string };
  neither: { probability: number; evidence: string };
}

export interface QuantumStepResponse {
  sentence_index: number;
  sentence: string;
  measurement: TetralemmaProbs;
  rho_before: {
    purity: number;
    entropy: number;
    top_eigenvalues: number[];
  };
  rho_after: {
    purity: number;
    entropy: number;
    top_eigenvalues: number[];
  };
  done: boolean;
  next_sentence_index: number | null;
}

export interface QuantumTraceResponse {
  session_id: string;
  total_sentences: number;
  trace: Array<{
    sentence_index: number;
    sentence: string;
    measurement: TetralemmaProbs;
    rho: {
      purity: number;
      entropy: number;
      top_eigenvalues: number[];
    };
  }>;
}

// Simplified all-at-once analysis result
export interface SentenceAnalysisResult {
  sentences: Array<{
    index: number;
    text: string;
    tetralemma: {
      literal: number;
      metaphorical: number;
      both: number;
      neither: number;
    };
    dominant: 'literal' | 'metaphorical' | 'both' | 'neither';
    entropy: number;
    purity: number;
  }>;
  overall: {
    totalSentences: number;
    avgEntropy: number;
    avgPurity: number;
    dominantStance: string;
  };
}

// ═══════════════════════════════════════════════════════════════════
// COMMON TYPES
// ═══════════════════════════════════════════════════════════════════

export interface TransformResult {
  transformationId: string;
  original: string;
  transformed: string;
  metadata?: {
    modelUsed?: string;
    processingTimeMs?: number;
    baseline?: DetectionMetrics;
    final?: DetectionMetrics;
    improvement?: {
      confidence_delta: number;
    };
  };
}

export interface ServiceError {
  error: string;
  code?: string;
  details?: unknown;
}

// Provider configuration
export type TransformProvider = 'cloud' | 'ollama';

export interface ProviderConfig {
  provider: TransformProvider;
  baseUrl: string;
  authToken?: string;
  timeout?: number;
}
