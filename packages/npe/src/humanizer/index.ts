/**
 * Humanizer Module
 *
 * AI detection and text humanization services.
 *
 * @example
 * ```typescript
 * import { detect, HumanizerService } from '@humanizer/npe/humanizer';
 *
 * // Quick detection
 * const result = detect(text);
 * console.log(`AI Likelihood: ${result.aiLikelihood}%`);
 *
 * // Full humanization
 * const humanizer = new HumanizerService(llmAdapter);
 * const humanized = await humanizer.humanize(text, { intensity: 'moderate' });
 * ```
 */

// Types
export type {
  BurstinessMetrics,
  PunctuationProfile,
  VocabularyMetrics,
  ExtractedFeatures,
  TellPhrase,
  TellPhraseMatch,
  TellPhraseScore,
  SentenceAnalysis,
  HumanizationRecommendation,
  DetectionResult,
  DetectionOptions,
  HumanizationIntensity,
  HumanizationOptions,
  HumanizationResult,
  HumanizationAnalysis,
} from './types.js';

// Constants
export {
  FEATURE_WEIGHTS,
  HUMAN_BASELINES,
  AI_BASELINES,
  THRESHOLDS,
  DETECTOR_VERSION,
  FEATURE_WEIGHTS_STATISTICAL,
} from './types.js';

// Feature extraction
export {
  splitSentences,
  calculateBurstiness,
  analyzePunctuation,
  analyzeVocabulary,
  extractFeatures,
  featureSummary,
  compareToBaselines,
} from './feature-extractor.js';

// Tell-phrase analysis
export {
  AI_TELL_PHRASES,
  HUMAN_TELL_PHRASES,
  scoreTellPhrases,
  getTopMatches,
  getReplacementSuggestions,
} from './tell-phrases.js';

// Detection
export {
  detect,
  detectQuick,
  explainResult,
} from './detector.js';

// Humanization service
export {
  HumanizerService,
  createHumanizer,
} from './humanizer.js';
