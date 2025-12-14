/**
 * Subjective Intentional Constraint (SIC) - Service Exports
 *
 * This module provides AI detection through constraint analysis,
 * measuring the cost of authorship rather than statistical patterns.
 *
 * TERMINOLOGY:
 * - "sic" = Subjective Intentional Constraint (novel contribution)
 * - "style_check" = traditional stylometry (supporting tool)
 */

// Core types
export type {
  LlmAdapter,
  TextChunk,
  EvidenceQuote,
  SicFeatureKey,
  FeatureScore,
  InflectionPoint,
  Genre,
  SicDiagnostics,
  SicResult,
  StyleCheckResult,
  ProfileVettingResult,
  SicWeights,
} from './types';

export {
  DEFAULT_SIC_WEIGHTS,
  GENRE_BASELINES,
} from './types';

// Utilities
export {
  chunkText,
  splitIntoSentences,
  clamp,
  safeJsonParse,
  normalizeResponse,
  extractShortQuote,
  calculateTextStats,
  runQuickHeuristics,
  QUICK_HEURISTICS,
} from './chunk';

// Prompts
export {
  PROMPT_GUARDRAILS,
  GENRE_DETECTION_PROMPT,
  SIC_EXTRACTOR_PROMPT,
  getSicJudgePrompt,
  STYLE_CHECK_EXTRACTOR_PROMPT,
  STYLE_CHECK_JUDGE_PROMPT,
  VET_PROFILE_TEXT_PROMPT,
  AI_PROBABILITY_PROMPT,
  SIC_FEATURE_KEYS,
  FEATURE_DESCRIPTIONS,
} from './prompts';

// Engine
export {
  SicEngine,
  type SicOptions,
  type StyleCheckOptions,
} from './engine';

// Adapters
export {
  NpeLlmAdapter,
  DEFAULT_MODELS,
  createExtractorAdapter,
  createJudgeAdapter,
  getAdapterConfigForTier,
  type AdapterConfig,
} from './npeLlmAdapter';
