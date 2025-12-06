/**
 * Model Vetting System
 *
 * Unified output filtering with model-specific vetting profiles.
 * Replaces the fragmented strip-preambles approach with a single,
 * model-aware filtering system.
 *
 * Usage:
 *
 * ```typescript
 * import { filterModelOutput, UnvettedModelError } from './model-vetting';
 *
 * try {
 *   const result = filterModelOutput(rawLLMOutput, modelId);
 *   console.log(result.content);  // Clean output
 * } catch (e) {
 *   if (e instanceof UnvettedModelError) {
 *     // Model not in registry - cannot guarantee output quality
 *     throw e;  // DO NOT fallback, error is intentional
 *   }
 * }
 * ```
 *
 * To add a new vetted model:
 * 1. Run deriveVettingProfile() with test prompts
 * 2. Review the suggested patterns
 * 3. Add to MODEL_VETTING_PROFILES in profiles.ts
 * 4. Set vetted: true after manual verification
 */

// Main filter function
export {
  filterModelOutput,
  likelyNeedsFiltering,
  UnvettedModelError,
  type FilterResult,
} from './output-filter';

// Profile registry
export {
  MODEL_VETTING_PROFILES,
  getVettingProfile,
  isModelVetted,
  getVettedModelsForProvider,
  listVettedModelIds,
  type ModelVettingProfile,
} from './profiles';

// Derivation tools (for adding new models)
export {
  deriveVettingProfile,
  formatDerivationResult,
  VETTING_TEST_CASES,
  type DerivationResult,
  type VettingTestCase,
} from './derive-profile';
