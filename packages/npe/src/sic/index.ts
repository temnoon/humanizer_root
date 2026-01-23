/**
 * SIC Module
 *
 * Subjective Intentional Constraint analysis.
 */

export { SicEngine } from './engine.js';
export type { SicOptions, StyleCheckOptions } from './engine.js';

export {
  DEFAULT_SIC_WEIGHTS,
  GENRE_BASELINES,
  SIC_FEATURE_KEYS,
  FEATURE_DESCRIPTIONS,
} from './constants.js';

export {
  chunkText,
  splitIntoSentences,
  clamp,
  calculateTextStats,
  runQuickHeuristics,
  detectNarrativeMode,
  QUICK_HEURISTICS,
} from './chunk.js';

export {
  PROMPT_GUARDRAILS,
  GENRE_DETECTION_PROMPT,
  SIC_EXTRACTOR_PROMPT,
  getSicJudgePrompt,
  STYLE_CHECK_EXTRACTOR_PROMPT,
  STYLE_CHECK_JUDGE_PROMPT,
  VET_PROFILE_TEXT_PROMPT,
} from './prompts.js';
