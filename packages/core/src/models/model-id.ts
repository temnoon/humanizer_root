/**
 * Opaque Model ID Type
 *
 * This module creates a branded type for model IDs that can ONLY be obtained
 * from the ModelRegistry. This makes it a compile-time error to use hardcoded
 * model strings where a ModelId is expected.
 *
 * Pattern: "Parse, don't validate"
 * Instead of validating strings at runtime, we make invalid states unrepresentable.
 *
 * @example
 * ```typescript
 * // ❌ COMPILE ERROR - string is not assignable to ModelId
 * const model: ModelId = 'llama3.2:3b';
 *
 * // ✅ CORRECT - get from registry
 * const model = await registry.getDefault('completion');
 * useModel(model.id); // model.id is ModelId
 * ```
 *
 * @module models/model-id
 */

/**
 * Branded type for model IDs.
 * Can only be created through the ModelRegistry.
 */
declare const ModelIdBrand: unique symbol;
export type ModelId = string & { readonly [ModelIdBrand]: typeof ModelIdBrand };

/**
 * Type guard to check if a value is a ModelId.
 * Note: At runtime this is just a string check, but TypeScript tracks the brand.
 */
export function isModelId(value: unknown): value is ModelId {
  return typeof value === 'string' && value.length > 0;
}

/**
 * INTERNAL ONLY: Create a ModelId from a string.
 * This should ONLY be called by ModelRegistry implementations.
 *
 * @internal
 */
export function _createModelId(id: string): ModelId {
  return id as ModelId;
}

/**
 * Branded type for prompt IDs.
 * Can only be created through the PromptRegistry.
 */
declare const PromptIdBrand: unique symbol;
export type PromptId = string & { readonly [PromptIdBrand]: typeof PromptIdBrand };

/**
 * INTERNAL ONLY: Create a PromptId from a string.
 * @internal
 */
export function _createPromptId(id: string): PromptId {
  return id as PromptId;
}

/**
 * Branded type for embedding dimensions.
 * Ensures dimensions come from the registry, not hardcoded.
 */
declare const EmbeddingDimensionBrand: unique symbol;
export type EmbeddingDimension = number & { readonly [EmbeddingDimensionBrand]: typeof EmbeddingDimensionBrand };

/**
 * INTERNAL ONLY: Create an EmbeddingDimension.
 * @internal
 */
export function _createEmbeddingDimension(dim: number): EmbeddingDimension {
  return dim as EmbeddingDimension;
}
