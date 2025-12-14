/**
 * Computer Humanizer - Module Index
 * Re-exports all humanizer components
 */

// Types
export type {
  HumanizationIntensity,
  HumanizationOptions,
  HumanizationResult,
  HumanizationContext,
  SicAnalysisResult,
  StageFunction
} from './types';

// Prompts and configuration
export {
  INTENSITY_PROMPTS,
  FORBIDDEN_TELL_WORDS,
  TWO_PASS_CONFIG,
  TELL_WORD_REPLACEMENTS
} from './prompts';

// Stages
export {
  runSicPreAnalysisStage,
  canUseSicAnalysis,
  getSicAnalysisStatus,
  runAnalysisStage,
  analyzeForHumanization,
  runNaturalizerStage,
  runVoiceMatchStage,
  runPolishStage,
  runValidationStage,
  runSicPostValidation
} from './stages';
