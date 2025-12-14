/**
 * Computer Humanizer - Types
 * Shared type definitions for the humanization pipeline
 */

import type { LocalDetectionResult } from '../../services/ai-detection/local-detector';
import type { VoiceProfile } from '../voice-profile';
import type { SicResult } from '../../services/sic/types';

/**
 * Humanization intensity levels
 */
export type HumanizationIntensity = 'light' | 'moderate' | 'aggressive';

/**
 * Humanization request options
 */
export interface HumanizationOptions {
  intensity: HumanizationIntensity;
  voiceSamples?: string[];           // Optional user writing samples
  enableLLMPolish?: boolean;         // Default: true
  targetBurstiness?: number;         // Default: 60
  targetLexicalDiversity?: number;   // Default: 60
  model?: string;                    // LLM choice for polish pass

  // SIC Integration (paid tiers only)
  enableSicAnalysis?: boolean;       // Enable constraint-guided humanization
}

/**
 * SIC analysis results for humanization
 */
export interface SicAnalysisResult {
  /** SIC analysis of input text */
  baseline: SicResult;
  /** SIC analysis of output text (post-validation) */
  final?: SicResult;
  /** Which constraint features scored low and were targeted */
  constraintGapsIdentified: string[];
  /** Improvement metrics */
  constraintImprovement?: {
    sicScoreChange: number;
    featuresImproved: string[];
    featuresDeclined: string[];
  };
}

/**
 * Humanization result with metrics and stages
 */
export interface HumanizationResult {
  // Final output
  humanizedText: string;

  // Before/after metrics
  baseline: {
    detection: LocalDetectionResult;
  };
  final: {
    detection: LocalDetectionResult;
  };

  // Improvement stats
  improvement: {
    aiConfidenceDrop: number;         // How much AI confidence decreased
    burstinessIncrease: number;       // How much burstiness increased
    tellWordsRemoved: number;         // Number of tell-words removed
    lexicalDiversityChange: number;   // Change in lexical diversity
  };

  // Stage outputs (for debugging/transparency)
  stages: {
    original: string;
    afterSicAnalysis?: string;        // Stage 0 (just stores input, analysis in sicAnalysis)
    afterNaturalizer: string;
    afterVoiceMatch?: string;
    afterLLMPolish?: string;
  };

  // Voice profile (if samples provided)
  voiceProfile?: VoiceProfile;

  // Model used for LLM polish
  modelUsed?: string;

  // SIC analysis (when enabled)
  sicAnalysis?: SicAnalysisResult;

  // Processing metadata
  processing: {
    totalDurationMs: number;
    stage0DurationMs?: number;  // SIC pre-analysis
    stage1DurationMs: number;   // Analysis
    stage2DurationMs: number;   // Naturalizer
    stage3DurationMs: number;   // Voice matching
    stage4DurationMs: number;   // LLM polish
    stage5DurationMs: number;   // Validation
  };
}

/**
 * Internal context passed between stages
 */
export interface HumanizationContext {
  env: unknown;  // Cloudflare Env
  userId: string;
  userTier?: string;
  options: HumanizationOptions;
  modelId: string;

  // Text at each stage
  originalText: string;
  currentText: string;
  hasMarkdownStructure: boolean;

  // SIC data (when enabled)
  sicPreAnalysis?: SicResult;
  constraintGaps?: string[];
  constraintGuidance?: string;

  // Voice data
  voiceProfile?: VoiceProfile;

  // Timing
  timings: {
    stage0?: number;
    stage1?: number;
    stage2?: number;
    stage3?: number;
    stage4?: number;
    stage5?: number;
  };
}

/**
 * Stage function signature
 */
export type StageFunction = (ctx: HumanizationContext) => Promise<HumanizationContext>;
