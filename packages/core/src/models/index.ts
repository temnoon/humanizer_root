/**
 * Model Registry Module
 *
 * Centralizes all model configuration and vetting.
 * Part of Phase 1: Model Registry & Vetting Enforcement.
 *
 * Usage:
 * ```typescript
 * import { getModelRegistry, getEmbeddingVersionManager } from '@humanizer/core';
 *
 * // Get default embedding model
 * const registry = getModelRegistry();
 * const embedModel = await registry.getDefault('embedding');
 * console.log(embedModel.id, embedModel.dimensions);
 *
 * // Get embedding dimensions (no hardcoded 768!)
 * const dims = await registry.getEmbeddingDimensions();
 *
 * // Validate embedding compatibility
 * const versionMgr = getEmbeddingVersionManager();
 * versionMgr.validateCompatibility(embedding1, embedding2);
 * ```
 *
 * @module models
 */

// ═══════════════════════════════════════════════════════════════════
// MODEL REGISTRY
// ═══════════════════════════════════════════════════════════════════

export {
  // Types
  type VettedModel,
  type VettingStatus,
  type PerformanceProfile,
  type BenchmarkResult,
  type ModelCapability,
  type ModelProvider,
  type ModelRegistry,

  // Fallback chains
  type FallbackChain,
  type FallbackConditions,
  DEFAULT_FALLBACK_CHAINS,

  // Capability mappings
  CAPABILITY_MAPPINGS,
  CAPABILITY_SATISFIES,

  // Prompt requirements
  type PromptRequirements,
  type CompatibilityResult,
  type ScoredModel,

  // Errors
  ModelNotFoundError,
  ModelVettingError,
} from './model-registry.js';

// ═══════════════════════════════════════════════════════════════════
// DEFAULT REGISTRY IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

export {
  DefaultModelRegistry,
  DEFAULT_MODELS,
  getModelRegistry,
  setModelRegistry,
  resetModelRegistry,
} from './default-model-registry.js';

// ═══════════════════════════════════════════════════════════════════
// EMBEDDING VERSIONING
// ═══════════════════════════════════════════════════════════════════

export {
  // Types
  type EmbeddingVersionConfig,
  type StoredEmbedding,
  type EmbeddingStatus,
  type EmbeddingVersionSummary,
  type ReembeddingProgress,

  // Defaults
  DEFAULT_EMBEDDING_VERSION_CONFIG,

  // Errors
  EmbeddingIncompatibilityError,
  StaleEmbeddingError,

  // Manager
  EmbeddingVersionManager,
  getEmbeddingVersionManager,
  resetEmbeddingVersionManager,
} from './embedding-versioning.js';
