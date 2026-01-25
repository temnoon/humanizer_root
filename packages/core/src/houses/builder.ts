/**
 * Builder Agent
 *
 * Re-exports from the modular implementation for backward compatibility.
 *
 * Implementation files:
 * - ./builder/types.ts - Type definitions
 * - ./builder/config.ts - Configuration keys
 * - ./builder/persona-utils.ts - Persona/style merging and prompt building
 * - ./builder/rewriting-utils.ts - Change detection and validation
 * - ./builder/revision-utils.ts - Revision helpers
 * - ./builder/index.ts - Main BuilderAgent class and singleton
 *
 * @module @humanizer/core/houses/builder
 */

// Re-export everything from the modular implementation
export * from './builder/index.js';
