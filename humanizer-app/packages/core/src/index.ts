/**
 * @humanizer/core
 *
 * Core computational primitives for Humanizer
 *
 * - Sentence: The atom of narrative, the quantum of semantic exchange
 * - Vector: Position in semantic space, trajectory, inflection points
 * - Craft: Compression, surprise, specificity, tension, velocity
 * - Types: Shared type definitions
 *
 * (Legacy SIC module still available but being phased out)
 */

// Re-export all types
export * from './types/index.js';

// Vector analysis module (new approach)
export * as vector from './vector/index.js';

// Sentence module
export * as sentence from './sentence/index.js';

// SIC analysis module (legacy - being replaced by vector)
export * as sic from './sic/index.js';

// Convenience re-exports - vector (preferred)
export { analyzePassage, formatTrajectory } from './vector/index.js';
export { tokenize } from './sentence/index.js';

// Legacy convenience re-exports (still available)
export { analyzeSIC, quickSIC } from './sic/index.js';
