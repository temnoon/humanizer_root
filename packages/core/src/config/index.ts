/**
 * Configuration module exports
 *
 * This module provides a managed configuration system for all literals.
 * NO hardcoded values should appear in code files - use this system instead.
 *
 * ## Phase 0 Components (Configuration Remediation)
 *
 * - **ConfigValidator**: Validates all configs on startup
 * - **BaselineCapture**: Captures quality metrics before migrations
 * - **RollbackManager**: Snapshot/restore with auto-rollback on regression
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

// ═══════════════════════════════════════════════════════════════════
// PHASE 0: Configuration Remediation Pre-Requisites
// ═══════════════════════════════════════════════════════════════════

// Config Validator
export {
  ConfigValidator,
  validateConfigOnStartup,
  type ValidationReport,
  type ConfigValidationError,
  type ConfigValidationWarning,
  type ValidationIssue,
  type ValidationSeverity,
  type ThresholdDefinition,
  type PromptRequirement,
  type ModelRegistryValidator,
  type ConfigValidatorOptions,
  KNOWN_THRESHOLDS,
  KNOWN_PROMPT_REQUIREMENTS,
} from './config-validator.js';

// Baseline Capture
export {
  type BaselineMetrics,
  type BaselineCapture,
  type BaselineComparison,
  type MetricDelta,
  type RegressionThresholds,
  REGRESSION_THRESHOLDS,
  createEmptyMetrics,
  aggregateMetrics,
  createBaseline,
  compareToBaseline,
  saveBaseline,
  loadBaseline,
  listBaselines,
  getLatestBaseline,
  formatComparisonReport,
} from './baseline-capture.js';

// Rollback Manager
export {
  RollbackManager,
  getRollbackManager,
  createPreMigrationSnapshot,
  rollbackToLatest,
  type ConfigSnapshot,
  type RollbackResult,
  type RollbackTrigger,
} from './rollback.js';

// ═══════════════════════════════════════════════════════════════════
// PHASE 2: Configuration Centralization
// ═══════════════════════════════════════════════════════════════════

// Embedding Configuration
export {
  EMBEDDING_CONFIG_KEYS,
  EMBEDDING_DEFAULTS,
  EMBEDDING_CONFIG_CATEGORIES,
  type EmbeddingConfigKey,
  getEmbeddingConfigCategory,
  getEmbeddingDefault,
  seedEmbeddingDefaults,
} from './embedding-config.js';

// Storage Configuration
export {
  STORAGE_CONFIG_KEYS,
  STORAGE_ENV_VARS,
  STORAGE_STATIC_DEFAULTS,
  STORAGE_CONFIG_CATEGORIES,
  type StorageConfigKey,
  getStorageDefaults,
  getStorageConfigCategory,
  getStorageDefault,
  buildConnectionUrl,
  seedStorageDefaults,
} from './storage-config.js';

// Prompt Output Schema (Threshold-Prompt Coupling)
export {
  type PromptOutputSchema,
  type FieldDefinition,
  type OutputRange,
  type OutputValidationResult,
  // Pre-defined schemas
  CURATOR_ASSESSMENT_SCHEMA,
  VIMALAKIRTI_INQUIRY_SCHEMA,
  VIMALAKIRTI_DISTANCE_SCHEMA,
  VIMALAKIRTI_SHADOW_SCHEMA,
  SEARCH_RANKING_SCHEMA,
  BUILDER_REWRITE_SCHEMA,
  HARVESTER_EXTRACT_SCHEMA,
  PROMPT_OUTPUT_SCHEMAS,
  // Validation functions
  validatePromptOutput,
  getThresholdDependencies,
  findPromptsUsingThreshold,
  getPromptOutputSchema,
} from './prompt-output-schema.js';

// ═══════════════════════════════════════════════════════════════════
// PHASE 3: LLM Prompt Centralization
// ═══════════════════════════════════════════════════════════════════

// Prompt Types
export {
  type PromptCapability,
  type PromptLlmRequirements,
  type PromptTestCase,
  type PromptTestResult,
  type PromptDefinition,
  type PromptCategory,
  type PromptCategoryMapping,
  type PromptRegistry,
  type PromptLookupOptions,
  type CompiledPromptResult,
  createPromptDefinition,
  promptRequiresCapability,
  getRequiredCapabilities,
  isPromptDeprecated,
  getReplacementPromptId,
} from './prompt-types.js';

// Prompt Engine (Template Compilation)
export {
  compilePromptWithConditionals,
  extractTemplateVariables,
  validateTemplateVariables,
  compilePrompt,
  compilePromptSimple,
  escapeTemplateValue,
  unescapeTemplateValue,
} from './prompt-engine.js';

// Prompt Registry
export {
  // Agent Loop
  AGENT_LOOP_SYSTEM,
  AGENT_LOOP_REASONING,
  AGENT_LOOP_PROMPTS,
  // Builder
  BUILDER_OUTLINE_CREATION,
  BUILDER_SECTION_COMPOSITION,
  BUILDER_TRANSITION_GENERATION,
  BUILDER_STRUCTURE_ANALYSIS,
  BUILDER_DRAFT_REVISION,
  BUILDER_IMPROVEMENT_SUGGESTIONS,
  BUILDER_STYLE_ANALYSIS,
  BUILDER_ISSUE_FIX,
  BUILDER_FOCUSED_REVISION,
  BUILDER_PROMPTS,
  // Curator
  CURATOR_PASSAGE_ASSESSMENT,
  CURATOR_THREAD_COHERENCE,
  CURATOR_CLUSTER_SUGGESTION,
  CURATOR_CARD_ASSIGNMENT,
  CURATOR_PROMPTS,
  // Harvester
  HARVESTER_PASSAGE_EXTRACTION,
  HARVESTER_THEME_IDENTIFICATION,
  HARVESTER_PROMPTS,
  // Reviewer
  REVIEWER_STYLE_CHECK,
  REVIEWER_STRUCTURE_CHECK,
  REVIEWER_FACT_EXTRACTION,
  REVIEWER_PROMPTS,
  // Vimalakirti
  VIMALAKIRTI_INQUIRY_LEVEL,
  VIMALAKIRTI_PROFESSIONAL_DISTANCE,
  VIMALAKIRTI_SHADOW_CHECK,
  VIMALAKIRTI_PROMPTS,
  // Transformation
  TRANSFORMATION_SYSTEM,
  TRANSFORMATION_PERSONA,
  TRANSFORMATION_STYLE,
  TRANSFORMATION_NAMESPACE_EXTRACT,
  TRANSFORMATION_NAMESPACE_MAP,
  TRANSFORMATION_NAMESPACE_RECONSTRUCT,
  TRANSFORMATION_PROMPTS,
  // SIC (Subjective Intentional Constraint)
  SIC_GUARDRAILS,
  SIC_GENRE_DETECTION,
  SIC_EXTRACTOR,
  SIC_JUDGE,
  SIC_STYLE_CHECK_EXTRACTOR,
  SIC_STYLE_CHECK_JUDGE,
  SIC_PROFILE_VETTING,
  SIC_PROMPTS,
  // Model-Master Utility
  MODEL_MASTER_TRANSLATE,
  MODEL_MASTER_ANALYZE,
  MODEL_MASTER_SUMMARIZE,
  MODEL_MASTER_DETECT_AI,
  MODEL_MASTER_HUMANIZE,
  MODEL_MASTER_PROMPTS,
  // Prospector (Content Excellence System)
  PROSPECTOR_EXCELLENCE_SCORE,
  PROSPECTOR_RAW_GEM_DETECTION,
  PROSPECTOR_PROMPTS,
  // Refiner (Content Excellence System)
  REFINER_EXTRACT_INSIGHT,
  REFINER_VERIFY_PRESERVATION,
  REFINER_POLISH_EXPRESSION,
  REFINER_PROMPTS,
  // Archivist (Content Excellence System)
  ARCHIVIST_CATEGORIZE_EXPRESSION,
  ARCHIVIST_FIND_CANONICAL,
  ARCHIVIST_PROMPTS,
  // Combined
  ALL_PROMPTS,
  PROMPT_REGISTRY,
  PROMPT_CATEGORIES,
  // Helpers
  getPrompt,
  getPromptsForAgent,
  getPromptsInCategory,
  getPromptsRequiringCapability,
  listPromptIds,
  hasPrompt,
} from './prompt-registry.js';

// AI Detection Configuration
export {
  AI_DETECTION_CONFIG_KEYS,
  AI_DETECTION_DEFAULTS,
  AI_DETECTION_CONFIG_CATEGORIES,
  type AIDetectionConfigKey,
  type AITellSeverity,
  type AITellCategory,
  type AITellPattern,
  type SeverityWeights,
  type AIDetectionResult,
  type AITellMatch,
  DEFAULT_AI_TELLS,
  DEFAULT_SEVERITY_WEIGHTS,
  DEFAULT_DETECTION_THRESHOLD,
  DEFAULT_MIN_MATCHES,
  compilePattern,
  matchPattern,
  detectAIPatterns,
  getPatternsBySeverity,
  getPatternsByCategory,
  createPattern,
} from './ai-detection-config.js';

// Excellence Configuration (Content Excellence System)
export {
  EXCELLENCE_CONFIG_KEYS,
  EXCELLENCE_DEFAULTS,
  EXCELLENCE_CONFIG_CATEGORIES,
  type ExcellenceConfigKey,
  type ExcellenceTier,
  getExcellenceConfigCategory,
  getExcellenceDefault,
  seedExcellenceDefaults,
  getExcellenceTier,
} from './excellence-config.js';

// Import Configuration (Archive Import with Enrichment)
export {
  IMPORT_CONFIG_KEYS,
  IMPORT_DEFAULTS,
  VALID_EXCELLENCE_TIERS,
  getImportDefault,
  isValidExcellenceTier,
} from './import-config.js';

// Service Configuration (Tenant, Auth, Usage, API Keys)
export {
  SERVICE_CONFIG_KEYS,
  SERVICE_DEFAULTS,
  SERVICE_CONFIG_CATEGORIES,
  type ServiceConfigKey,
  getServiceConfigCategory,
  getServiceDefault,
  seedServiceDefaults,
} from './service-config.js';
