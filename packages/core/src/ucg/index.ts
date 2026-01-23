/**
 * UCG - Unified Content Graph
 *
 * Multi-resolution content representation system.
 *
 * MIGRATION NOTE: The InMemoryUCGProvider has been removed.
 * Use ContentStore from '../storage/index.js' for persistent storage.
 *
 * Pyramid features (L0 → L1 → L2 → L3 → Apex) will be implemented
 * in Phase 4 of the UCG Storage Implementation Plan.
 *
 * For now, this module provides type definitions only.
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES - Content Resolution Levels
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
// TYPES - Pyramid Structure
// ═══════════════════════════════════════════════════════════════════

/**
 * Pyramid configuration constants
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

/**
 * The apex (top) of the pyramid - single summary
 */
export interface ApexNode {
  /** Summary text */
  summary: string;

  /** Embedding */
  embedding?: number[];

  /** Key themes */
  themes: string[];

  /** Key entities */
  entities: string[];

  /** Total word count in pyramid */
  totalWords: number;

  /** Date range of content */
  dateRange?: { start: number; end: number };

  /** When generated */
  generatedAt: number;
}

/**
 * Statistics about a pyramid
 */
export interface PyramidStats {
  /** Node counts by level */
  nodeCounts: Record<ResolutionLevel, number>;

  /** Total nodes */
  totalNodes: number;

  /** Total words */
  totalWords: number;

  /** Average node size by level */
  avgNodeSize: Record<ResolutionLevel, number>;

  /** Embedding coverage (% of nodes with embeddings) */
  embeddingCoverage: number;

  /** Compression ratios achieved */
  compressionRatios?: {
    l0ToL1?: number;
    l1ToApex?: number;
  };
}

// ═══════════════════════════════════════════════════════════════════
// TYPES - Search
// ═══════════════════════════════════════════════════════════════════

/**
 * Options for pyramid search
 */
export interface PyramidSearchOptions {
  /** Which levels to search */
  levels?: ResolutionLevel[];

  /** Minimum similarity threshold */
  minSimilarity?: number;

  /** Maximum results */
  maxResults?: number;

  /** Include context */
  includeContext?: boolean;

  /** Filter by content type */
  contentType?: string;

  /** Filter by topic */
  topic?: string;

  /** Date range filter */
  dateRange?: { start: number; end: number };
}

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
