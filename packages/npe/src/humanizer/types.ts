/**
 * Humanizer Types
 *
 * Types for AI detection and text humanization.
 */

// ═══════════════════════════════════════════════════════════════════════════
// Feature Extraction Types
// ═══════════════════════════════════════════════════════════════════════════

export interface BurstinessMetrics {
  burstiness: number;
  meanSentenceLength: number;
  stdSentenceLength: number;
  sentenceCount: number;
  sentenceLengths: number[];
}

export interface PunctuationProfile {
  semicolonRate: number;
  emDashRate: number;
  enDashRate: number;
  questionRate: number;
  exclamationRate: number;
  commaDensity: number;
  totalPunctuation: number;
  counts: {
    semicolons: number;
    emDashes: number;
    enDashes: number;
    questions: number;
    exclamations: number;
    commas: number;
    periods: number;
  };
}

export interface VocabularyMetrics {
  typeTokenRatio: number;
  hapaxRatio: number;
  bigramDiversity: number;
  trigramDiversity: number;
  wordCount: number;
  uniqueWordCount: number;
}

export interface ExtractedFeatures {
  burstiness: BurstinessMetrics;
  punctuation: PunctuationProfile;
  vocabulary: VocabularyMetrics;
  processingTimeMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tell-Phrase Types
// ═══════════════════════════════════════════════════════════════════════════

export interface TellPhrase {
  phrase: string;
  category: 'ai-filler' | 'ai-transition' | 'ai-hedge' | 'ai-emphasis' | 'human-specific' | 'human-hedge';
  weight: number;
  direction: 'ai' | 'human';
  replacements?: string[];
}

export interface TellPhraseMatch {
  phrase: string;
  category: string;
  count: number;
  weight: number;
  direction: 'ai' | 'human';
  positions: number[];
}

export interface TellPhraseScore {
  score: number;
  matches: TellPhraseMatch[];
  aiTellWeight: number;
  humanTellWeight: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Detection Result Types
// ═══════════════════════════════════════════════════════════════════════════

export interface SentenceAnalysis {
  text: string;
  startOffset: number;
  wordCount: number;
  aiLikelihood: number;
  flags: string[];
  isSuspect: boolean;
}

export interface HumanizationRecommendation {
  type: 'burstiness' | 'semicolons' | 'tell-words' | 'em-dashes' | 'vocabulary';
  priority: 'high' | 'medium' | 'low';
  description: string;
  currentValue: number;
  targetValue: number;
  suggestedFix?: string;
}

export interface DetectionResult {
  aiLikelihood: number;
  confidence: 'low' | 'medium' | 'high';
  verdict: 'human' | 'mixed' | 'ai';
  features: {
    burstiness: number;
    semicolonRate: number;
    emDashRate: number;
    tellPhraseScore: number;
    ngramDiversity: number;
    sentenceComplexity?: number;
    punctuationContrast?: number;
  };
  extractedFeatures: ExtractedFeatures;
  tellPhrases: TellPhraseScore;
  sentenceAnalysis?: SentenceAnalysis[];
  humanizationRecommendations: HumanizationRecommendation[];
  processingTimeMs: number;
  detectorVersion: string;
  method: 'statistical' | 'llm-enhanced';
}

export interface DetectionOptions {
  returnSentenceAnalysis?: boolean;
  returnHumanizationRecommendations?: boolean;
  minTextLength?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Humanization Types
// ═══════════════════════════════════════════════════════════════════════════

export type HumanizationIntensity = 'light' | 'moderate' | 'aggressive';

export interface HumanizationOptions {
  intensity?: HumanizationIntensity;
  preserveFormatting?: boolean;
  model?: string;
  /** Skip humanization if already human-like */
  skipIfHuman?: boolean;
  /** Minimum AI likelihood threshold to trigger humanization */
  minAiLikelihood?: number;
}

export interface HumanizationResult {
  humanizedText: string;
  baseline: { detection: DetectionResult };
  final: { detection: DetectionResult };
  improvement: {
    aiConfidenceDrop: number;
    burstinessIncrease: number;
    tellWordsRemoved: number;
  };
  modelUsed?: string;
  processing: {
    totalDurationMs: number;
  };
  skipped?: boolean;
  skipReason?: string;
}

export interface HumanizationAnalysis {
  detection: DetectionResult;
  recommendedIntensity: HumanizationIntensity;
  estimatedImprovement: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

export const FEATURE_WEIGHTS = {
  semicolonRate: 0.30,
  burstiness: 0.25,
  emDashRate: 0.15,
  enDashRate: 0.10,
  tellPhraseScore: 0.15,
  ngramDiversity: 0.05,
} as const;

export const HUMAN_BASELINES = {
  burstiness: 0.874,
  semicolonRate: 1.447,
  emDashRate: 0.5,
  questionRate: 6.1,
  exclamationRate: 5.5,
  typeTokenRatio: 0.459,
  hapaxRatio: 0.329,
} as const;

export const AI_BASELINES = {
  burstiness: { min: 0.37, max: 0.69, typical: 0.45 },
  semicolonRate: { min: 0.0, max: 0.36, typical: 0.1 },
  emDashRate: { min: 0.5, max: 2.0, typical: 1.2 },
} as const;

export const THRESHOLDS = {
  aiLikely: 60,
  humanLikely: 35,
  minConfidence: 0.5,
} as const;

export const DETECTOR_VERSION = '2.1.0-npe';

export const FEATURE_WEIGHTS_STATISTICAL = {
  burstiness: 0.35,
  sentenceComplexity: 0.15,
  punctuationContrast: 0.15,
  tellPhraseScore: 0.20,
  llamaSignature: 0.08,
  vocabularyRichness: 0.07,
} as const;
