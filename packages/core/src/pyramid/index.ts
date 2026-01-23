/**
 * Pyramid Module
 *
 * Multi-resolution content representation for large documents.
 * Builds hierarchical summaries for efficient coarse-to-fine retrieval.
 *
 * Structure:
 * - L0: Base chunks (~400-500 words each)
 * - L1: Summary embeddings (groups 5-10 L0 chunks)
 * - Apex: Document synthesis (single top-level summary)
 *
 * Usage:
 * ```typescript
 * import { PyramidBuilder, PyramidRetriever, getContentStore } from '@humanizer/core';
 *
 * // Build a pyramid
 * const builder = new PyramidBuilder({
 *   summarizer: async (text, targetWords) => {
 *     // Call LLM to summarize
 *     return summarizedText;
 *   },
 * });
 *
 * const result = await builder.build({
 *   content: longDocumentText,
 *   threadRootId: 'doc-123',
 *   sourceType: 'document',
 * });
 *
 * // Search the pyramid
 * const store = getContentStore();
 * const retriever = new PyramidRetriever(store);
 * const { results } = await retriever.search(queryEmbedding, {
 *   maxL0Results: 10,
 * });
 * ```
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type {
  PyramidLevel,
  PyramidNode,
  ApexNode,
  Pyramid,
  PyramidStats,
  PyramidConfig,
  PyramidBuildInput,
  PyramidBuildResult,
  PyramidBuildProgress,
  Summarizer,
  Embedder,
  PyramidSearchOptions,
  PyramidSearchResult,
  PyramidSearchResponse,
} from './types.js';

export { LEVEL_NAMES } from './types.js';

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

export {
  PYRAMID_CONFIG_KEYS,
  MIN_TOKENS_FOR_PYRAMID,
  TOKENS_PER_WORD,
  MIN_WORDS_FOR_PYRAMID,
  CHUNKS_PER_SUMMARY,
  MAX_CHUNKS_PER_SUMMARY,
  TARGET_SUMMARY_WORDS,
  MIN_SUMMARY_WORDS,
  MAX_SUMMARY_WORDS,
  TARGET_APEX_WORDS,
  MIN_APEX_WORDS,
  MAX_APEX_WORDS,
  MAX_THEMES,
  MAX_ENTITIES,
  TARGET_L0_TO_L1_RATIO,
  TARGET_L1_TO_APEX_RATIO,
  TARGET_OVERALL_RATIO,
  DEFAULT_PYRAMID_CONFIG,
  L1_SUMMARY_PROMPT,
  APEX_SYNTHESIS_PROMPT,
  THEME_EXTRACTION_PROMPT,
  ENTITY_EXTRACTION_PROMPT,
} from './constants.js';

// ═══════════════════════════════════════════════════════════════════
// PYRAMID BUILDER
// ═══════════════════════════════════════════════════════════════════

export {
  PyramidBuilder,
  getPyramidBuilder,
  initPyramidBuilder,
  resetPyramidBuilder,
} from './builder.js';

export type { PyramidBuilderOptions } from './builder.js';

// ═══════════════════════════════════════════════════════════════════
// PYRAMID RETRIEVER
// ═══════════════════════════════════════════════════════════════════

export {
  PyramidRetriever,
  getPyramidRetriever,
  initPyramidRetriever,
  resetPyramidRetriever,
} from './retriever.js';
