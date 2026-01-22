/**
 * Configuration module exports
 *
 * This module provides a managed configuration system for all literals.
 * NO hardcoded values should appear in code files - use this system instead.
 */

// Types
export * from './types.js';

// Implementation
export {
  InMemoryConfigManager,
  getConfigManager,
  setConfigManager,
  resetConfigManager,
  type InMemoryConfigOptions,
} from './in-memory-config.js';

// Default seed data
export { DEFAULT_PROMPTS } from './default-prompts.js';
export {
  DEFAULT_THRESHOLDS,
  DEFAULT_LIMITS,
  DEFAULT_FEATURES,
  ALL_DEFAULT_CONFIGS,
  type DefaultConfigEntry,
} from './default-thresholds.js';

// Re-export individual prompts for convenience
export {
  INQUIRY_LEVEL_PROMPT,
  PROFESSIONAL_DISTANCE_PROMPT,
  SHADOW_CHECK_PROMPT,
  CURATOR_SYSTEM_PROMPT,
  HARVESTER_SYSTEM_PROMPT,
  BUILDER_SYSTEM_PROMPT,
  REVIEWER_SYSTEM_PROMPT,
  SEARCH_TASK_PROMPT,
  SUMMARIZE_TASK_PROMPT,
  EVALUATE_TASK_PROMPT,
} from './default-prompts.js';
