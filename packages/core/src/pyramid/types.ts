/**
 * Pyramid Service Types
 *
 * Type definitions for the multi-resolution pyramid system.
 * The pyramid enables efficient retrieval over large documents by
 * creating hierarchical summaries:
 *
 * - L0: Base chunks (~400-500 words each)
 * - L1: Summary embeddings (groups 5-10 L0 chunks)
 * - Apex: Document synthesis (single top-level summary)
 */

import type { StoredNode } from '../storage/types.js';
import type { ContentChunk } from '../chunking/types.js';

// ═══════════════════════════════════════════════════════════════════
// PYRAMID LEVELS
// ═══════════════════════════════════════════════════════════════════

/**
 * Pyramid hierarchy levels
 */
export type PyramidLevel = 0 | 1 | 2;

/**
 * Level names for display
 */
export const LEVEL_NAMES: Record<PyramidLevel, string> = {
  0: 'L0 (Base Chunks)',
  1: 'L1 (Summaries)',
  2: 'Apex (Document)',
};

// ═══════════════════════════════════════════════════════════════════
// PYRAMID NODES
// ═══════════════════════════════════════════════════════════════════

/**
 * A node in the pyramid structure
 */
export interface PyramidNode {
  /** Node ID */
  id: string;

  /** Hierarchy level (0, 1, or 2) */
  level: PyramidLevel;

  /** Text content */
  text: string;

  /** Word count */
  wordCount: number;

  /** Embedding vector (if computed) */
  embedding?: number[];

  /** IDs of child nodes (for L1 and Apex) */
  childIds: string[];

  /** ID of parent node (for L0 and L1) */
  parentId?: string;

  /** Thread/document root ID */
  threadRootId: string;

  /** Position within level (for ordering) */
  position: number;

  /** Source chunk info (for L0 only) */
  sourceChunk?: {
    index: number;
    startOffset: number;
    endOffset: number;
  };
}

/**
 * The apex (top) node of a pyramid
 */
export interface ApexNode extends PyramidNode {
  level: 2;

  /** Key themes extracted from content */
  themes: string[];

  /** Key entities mentioned */
  entities: string[];

  /** Total word count across all L0 chunks */
  totalSourceWords: number;

  /** Compression ratio achieved */
  compressionRatio: number;

  /** Date range of source content */
  dateRange?: {
    start: number;
    end: number;
  };

  /** When the apex was generated */
  generatedAt: number;
}

// ═══════════════════════════════════════════════════════════════════
// PYRAMID STRUCTURE
// ═══════════════════════════════════════════════════════════════════

/**
 * Complete pyramid structure for a document
 */
export interface Pyramid {
  /** Thread/document root ID */
  threadRootId: string;

  /** L0 base chunks */
  l0Nodes: PyramidNode[];

  /** L1 summary nodes */
  l1Nodes: PyramidNode[];

  /** Apex node (may be undefined if not yet built) */
  apex?: ApexNode;

  /** Pyramid statistics */
  stats: PyramidStats;
}

/**
 * Statistics about a pyramid
 */
export interface PyramidStats {
  /** Node counts by level */
  nodeCounts: Record<PyramidLevel, number>;

  /** Total nodes */
  totalNodes: number;

  /** Word counts by level */
  wordCounts: Record<PyramidLevel, number>;

  /** Total source words (L0) */
  totalSourceWords: number;

  /** Compression ratios */
  compressionRatios: {
    l0ToL1: number;
    l1ToApex: number;
    overall: number;
  };

  /** Embedding coverage (% of nodes with embeddings) */
  embeddingCoverage: number;
}

// ═══════════════════════════════════════════════════════════════════
// PYRAMID CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Configuration for pyramid building
 */
export interface PyramidConfig {
  /** Minimum tokens to trigger pyramid building */
  minTokensForPyramid: number;

  /** Number of L0 chunks per L1 summary */
  chunksPerSummary: number;

  /** Target word count for L1 summaries */
  targetSummaryWords: number;

  /** Target word count for apex synthesis */
  targetApexWords: number;

  /** Whether to extract themes from apex */
  extractThemes: boolean;

  /** Whether to extract entities from apex */
  extractEntities: boolean;

  /** Whether to track compression ratios */
  trackCompressionRatios: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// BUILD OPERATIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Input for pyramid building
 */
export interface PyramidBuildInput {
  /** Content to build pyramid from */
  content: string;

  /** Thread/document root ID */
  threadRootId: string;

  /** Optional title for the document */
  title?: string;

  /** Source type for attribution */
  sourceType: string;

  /** Custom configuration overrides */
  config?: Partial<PyramidConfig>;
}

/**
 * Result from pyramid building
 */
export interface PyramidBuildResult {
  /** The built pyramid */
  pyramid: Pyramid;

  /** IDs of created nodes (for storage) */
  createdNodeIds: string[];

  /** Build statistics */
  buildStats: {
    /** Time to chunk content (ms) */
    chunkingTimeMs: number;

    /** Time to build L1 summaries (ms) */
    l1BuildTimeMs: number;

    /** Time to build apex (ms) */
    apexBuildTimeMs: number;

    /** Total build time (ms) */
    totalTimeMs: number;

    /** Whether summarization was used */
    usedSummarization: boolean;
  };
}

/**
 * Progress callback for pyramid building
 */
export interface PyramidBuildProgress {
  /** Current phase */
  phase: 'chunking' | 'l1-summaries' | 'apex' | 'embeddings' | 'complete';

  /** Progress within phase (0-1) */
  progress: number;

  /** Human-readable message */
  message: string;
}

// ═══════════════════════════════════════════════════════════════════
// SUMMARIZER INTERFACE
// ═══════════════════════════════════════════════════════════════════

/**
 * Summarizer function signature
 */
export type Summarizer = (
  text: string,
  targetWords: number,
  context?: { level: PyramidLevel; position: number }
) => Promise<string>;

/**
 * Embedder function signature
 */
export type Embedder = (texts: string[]) => Promise<number[][]>;

// ═══════════════════════════════════════════════════════════════════
// RETRIEVAL TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Options for pyramid search
 */
export interface PyramidSearchOptions {
  /** Starting level for search (default: apex) */
  startLevel?: PyramidLevel;

  /** Maximum L0 results to return */
  maxL0Results?: number;

  /** Minimum similarity threshold */
  minSimilarity?: number;

  /** Whether to expand to children on match */
  expandOnMatch?: boolean;

  /** Filter by thread root */
  threadRootId?: string;
}

/**
 * Result from pyramid search
 */
export interface PyramidSearchResult {
  /** Matched node */
  node: PyramidNode;

  /** Similarity score */
  score: number;

  /** Level where match occurred */
  matchLevel: PyramidLevel;

  /** Path from apex to this node */
  ancestorPath: string[];

  /** Expanded children (if expandOnMatch) */
  expandedChildren?: PyramidSearchResult[];
}

/**
 * Aggregated pyramid search results
 */
export interface PyramidSearchResponse {
  /** All matched results */
  results: PyramidSearchResult[];

  /** Results grouped by thread/document */
  byThread: Map<string, PyramidSearchResult[]>;

  /** Search statistics */
  stats: {
    /** Total nodes searched */
    nodesSearched: number;

    /** Nodes matched at each level */
    matchesByLevel: Record<PyramidLevel, number>;

    /** Search time (ms) */
    searchTimeMs: number;
  };
}
