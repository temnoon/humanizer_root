/**
 * V3 AI Detection Module
 *
 * A local-first AI detection system that combines:
 * - Sentence-level perplexity analysis
 * - Narrative-level Chekhov ratio (specificity fulfillment)
 * - Actionable transformation suggestions
 *
 * Designed to reduce dependency on external APIs (GPTZero)
 * while providing deeper, more actionable insights.
 *
 * @example
 * ```typescript
 * import { analyzeText, getSummary, quickAnalyze } from './services/detection/v3';
 *
 * // Full analysis
 * const analysis = await analyzeText(myText);
 * console.log(getSummary(analysis));
 *
 * // Quick metrics only
 * const quick = await quickAnalyze(myText);
 * console.log(quick.classification, quick.chekhovRatio);
 * ```
 */

// Main analyzer
export {
  analyzeText,
  quickAnalyze,
  getSummary,
  getFlaggedSentences,
  getOrphanedEntities
} from './analyzer.js';

// Chekhov analysis
export {
  extractEntities,
  analyzeChekhovRatio,
  analyzeText as analyzeChekhovOnly,
  getChekhovSummary
} from './chekhov.js';

// Perplexity analysis
export {
  segmentSentences,
  analyzeDocument as analyzePerplexityOnly,
  estimatePerplexityHeuristic,
  getPerplexityStats,
  createOllamaProvider
} from './perplexity.js';

// Completeness classifier
export {
  analyzeCompleteness,
  getCompletenessSummary,
  isLikelyComplete,
  isLikelyExcerpt
} from './completeness.js';

export type { CompletenessAnalysis } from './completeness.js';

// Types
export type {
  V3Analysis,
  V3Config,
  SentenceAnalysis,
  SentenceFlag,
  Transformation,
  TransformationType,
  TrackedEntity,
  EntityType,
  EntityStatus,
  ChekhovAnalysis,
  ChekhovGrade,
  ChekhovSuggestion
} from './types.js';

// Config
export { DEFAULT_CONFIG } from './types.js';
