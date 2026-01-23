/**
 * UCG - Unified Content Graph
 *
 * Multi-resolution content representation system.
 *
 * MIGRATION NOTE: The InMemoryUCGProvider has been removed.
 * Use ContentStore from '../storage/index.js' for persistent storage.
 *
 * Pyramid features are now implemented in '../pyramid/index.js'.
 * This module provides legacy type definitions and re-exports.
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES - Content Resolution Levels (Legacy)
// ═══════════════════════════════════════════════════════════════════

/**
 * Content resolution levels for pyramid structure
 *
 * @remarks
 * - L0: Sentences/chunks (finest grain, ~500 words)
 * - L1: Passages (summaries of L0 groups, ~150 words)
 * - L2: Apex (document summary, ~300 words)
 *
 * Note: L3 and higher levels may be added for very large documents.
 *
 * @deprecated Use PyramidLevel from '../pyramid/index.js' instead
 */
export type ResolutionLevel = 'L0' | 'L1' | 'L2' | 'apex';

/**
 * Content source reference
 */
export interface ContentSource {
  /** Source type */
  type: 'conversation' | 'document' | 'book' | 'import' | 'generated';

  /** Source ID */
  sourceId: string;

  /** Original message/paragraph/section ID */
  originalId?: string;

  /** Character offset in original */
  offset?: { start: number; end: number };

  /** Role if from conversation */
  role?: 'user' | 'assistant' | 'system';

  /** Timestamp of original */
  timestamp?: number;
}

/**
 * Metadata for content nodes
 */
export interface ContentMetadata {
  /** Content type */
  contentType?: 'prose' | 'code' | 'math' | 'list' | 'quote' | 'mixed';

  /** Language for code */
  language?: string;

  /** Topics/themes */
  topics?: string[];

  /** Named entities */
  entities?: string[];

  /** Sentiment score (-1 to 1) */
  sentiment?: number;

  /** Quality score (0 to 1) */
  qualityScore?: number;

  /** Custom metadata */
  custom?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════
// LEGACY PYRAMID CONFIG (for backwards compatibility)
// ═══════════════════════════════════════════════════════════════════

/**
 * Pyramid configuration constants
 * @deprecated Use constants from '../pyramid/index.js' instead
 */
export const PYRAMID_CONFIG = {
  /** Minimum tokens to trigger pyramid building */
  MIN_TOKENS_FOR_PYRAMID: 1000,

  /** Number of L0 chunks per L1 summary */
  CHUNKS_PER_SUMMARY: 5,

  /** Target word count for L1 summaries */
  TARGET_SUMMARY_WORDS: 150,

  /** Target word count for apex synthesis */
  TARGET_APEX_WORDS: 300,
} as const;

// ═══════════════════════════════════════════════════════════════════
// RE-EXPORTS from storage (canonical location for stored nodes)
// ═══════════════════════════════════════════════════════════════════

export type {
  StoredNode,
  StoredLink,
  QueryOptions,
  QueryResult,
  SearchResult,
  EmbeddingSearchOptions,
  KeywordSearchOptions,
} from '../storage/index.js';

export {
  PostgresContentStore,
  PostgresContentStore as ContentStore,  // Alias for backwards compatibility
  getContentStore,
  initContentStore,
  closeContentStore,
} from '../storage/index.js';

// ═══════════════════════════════════════════════════════════════════
// RE-EXPORTS from pyramid (canonical implementation)
// ═══════════════════════════════════════════════════════════════════

// Note: ApexNode, PyramidStats, PyramidSearchOptions are now in pyramid module
// Import them from '../pyramid/index.js' for new code
