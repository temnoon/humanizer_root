/**
 * Agentic Search Types
 *
 * Type definitions for the unified agentic search service that:
 * - Searches across archive (content_nodes) and books (book_nodes)
 * - Supports pyramid-aware retrieval (L0/L1/Apex)
 * - Provides quality gating and enrichment
 * - Enables iterative refinement with sessions
 *
 * Reuses and extends types from ../retrieval/types.ts and ../storage/types.ts
 */

import type { StoredNode, AuthorRole } from '../storage/types.js';
import type {
  SemanticAnchor,
  QualityIndicators,
  FusedResult,
} from '../retrieval/types.js';

// Re-export core types for convenience
export type { SemanticAnchor, QualityIndicators };

// ═══════════════════════════════════════════════════════════════════
// SEARCH TARGETS & FILTERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Which store(s) to search
 */
export type SearchTarget = 'archive' | 'books' | 'all';

/**
 * Pyramid hierarchy level filter
 */
export type HierarchyFilter = 'L0' | 'L1' | 'apex' | 'all';

/**
 * Search mode: hybrid (default), dense-only, or sparse-only
 */
export type SearchMode = 'hybrid' | 'dense' | 'sparse';

/**
 * Reranker strategy
 */
export type RerankerType = 'identity' | 'score' | 'diversity';

// ═══════════════════════════════════════════════════════════════════
// BOOK NODE (from books store)
// ═══════════════════════════════════════════════════════════════════

/**
 * A content node from the books database.
 * Similar to StoredNode but with book-specific fields.
 */
export interface BookNode {
  /** Primary key - UUID */
  id: string;

  /** Content hash for deduplication */
  contentHash: string;

  /** The book this node belongs to */
  bookId: string;

  /** The chapter this node belongs to (optional) */
  chapterId?: string;

  /** The actual text content */
  text: string;

  /** Content format */
  format: 'text' | 'markdown' | 'html' | 'code';

  /** Word count */
  wordCount: number;

  /** Position within chapter or book */
  position: number;

  /**
   * Hierarchy level for pyramid structure:
   * - 0: Base content (chunks)
   * - 1: Summary level (grouped chunks)
   * - 2: Apex level (document summary)
   */
  hierarchyLevel: number;

  /** Parent node ID (for hierarchy) */
  parentNodeId?: string;

  /** Chunk boundaries for L0 nodes */
  chunkIndex?: number;
  chunkStartOffset?: number;
  chunkEndOffset?: number;

  /** Source tracking (if extracted from archive) */
  sourceArchiveId?: string;
  sourceType?: 'original' | 'extracted' | 'synthesized';

  /** Timestamps */
  createdAt: number;
  updatedAt?: number;
}

// ═══════════════════════════════════════════════════════════════════
// RESULT PROVENANCE
// ═══════════════════════════════════════════════════════════════════

/**
 * Full provenance chain for a search result.
 * Tracks where content came from and its context.
 */
export interface ResultProvenance {
  /** Source store: 'archive' or 'books' */
  sourceStore: 'archive' | 'books';

  /** Source platform: 'chatgpt', 'claude', 'facebook', etc. */
  sourceType: string;

  /** Original ID in the source system */
  sourceOriginalId?: string;

  /** Thread/conversation root ID */
  threadRootId?: string;

  /** Thread/conversation title */
  threadTitle?: string;

  /** Parent node ID (structural parent) */
  parentNodeId?: string;

  /** Book context (if from books store) */
  bookContext?: {
    bookId: string;
    bookTitle?: string;
    bookSlug?: string;
    chapterId?: string;
    chapterTitle?: string;
    chapterPosition?: number;
  };

  /** When created in source system (epoch ms) */
  sourceCreatedAt?: number;

  /** Author identifier */
  author?: string;

  /** Author role: 'user', 'assistant', 'system' */
  authorRole?: AuthorRole;

  /** Canonical URI for this content */
  uri: string;
}

// ═══════════════════════════════════════════════════════════════════
// ENRICHMENT
// ═══════════════════════════════════════════════════════════════════

/**
 * AI-generated enrichment for a result.
 * Generated on-demand, not at index time.
 */
export interface ResultEnrichment {
  /** Generated title (if not present) */
  title?: string;

  /** Generated summary */
  summary?: string;

  /** Quality rating 0-5 */
  rating?: number;

  /** Suggested categories */
  categories?: string[];

  /** Key terms/entities */
  keyTerms?: string[];

  /** When enrichment was generated */
  enrichedAt?: number;
}

// ═══════════════════════════════════════════════════════════════════
// UNIFIED SEARCH RESULT
// ═══════════════════════════════════════════════════════════════════

/**
 * Score breakdown for a search result.
 * Shows how the final score was computed.
 */
export interface ScoreBreakdown {
  /** Dense (embedding) search score */
  denseScore?: number;

  /** Dense search rank */
  denseRank?: number;

  /** Sparse (keyword) search score */
  sparseScore?: number;

  /** Sparse search rank */
  sparseRank?: number;

  /** Fused score from RRF */
  fusedScore: number;

  /** Anchor boost/penalty applied */
  anchorBoost?: number;

  /** Final score after all adjustments */
  finalScore: number;
}

/**
 * A unified search result with full context.
 * Can come from either archive or books store.
 */
export interface AgenticSearchResult {
  /** Unique result ID */
  id: string;

  /** Source store */
  source: 'archive' | 'books';

  /** The content text */
  text: string;

  /** Word count */
  wordCount: number;

  /** Pyramid hierarchy level (0=L0, 1=L1, 2=apex) */
  hierarchyLevel: number;

  /** Final relevance score (0-1, higher = more relevant) */
  score: number;

  /** Detailed score breakdown */
  scoreBreakdown: ScoreBreakdown;

  /** Full provenance chain */
  provenance: ResultProvenance;

  /** Quality indicators */
  quality: QualityIndicators;

  /** AI-generated enrichment (if requested) */
  enrichment?: ResultEnrichment;

  /** Embedding vector (if includeEmbeddings requested) */
  embedding?: number[];

  /** Title (from source or enriched) */
  title?: string;

  /** Tags/labels */
  tags?: string[];

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════
// SEARCH OPTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Date range filter
 */
export interface DateRange {
  /** Start date (inclusive) */
  start?: Date;

  /** End date (inclusive) */
  end?: Date;
}

/**
 * Options for agentic search
 */
export interface AgenticSearchOptions {
  /** Which store(s) to search (default: 'all') */
  target?: SearchTarget;

  /** Maximum results to return (default: 20) */
  limit?: number;

  /** Minimum relevance threshold 0-1 (default: 0.3) */
  threshold?: number;

  /** Pyramid level filter (default: 'all') */
  hierarchyLevel?: HierarchyFilter;

  /** Filter by source type(s) */
  sourceTypes?: string[];

  /** Filter by author role */
  authorRole?: AuthorRole;

  /** Filter by date range */
  dateRange?: DateRange;

  /** Search mode (default: 'hybrid') */
  mode?: SearchMode;

  /** Weight for dense search in hybrid mode (default: 0.6) */
  denseWeight?: number;

  /** Weight for sparse search in hybrid mode (default: 0.4) */
  sparseWeight?: number;

  /** Include embedding vectors in results */
  includeEmbeddings?: boolean;

  /** Auto-enrich results with titles/summaries */
  autoEnrich?: boolean;

  /** Reranker to apply (default: 'identity') */
  reranker?: RerankerType;

  /** For books: filter by book ID */
  bookId?: string;

  /** For books: filter by chapter ID */
  chapterId?: string;

  /** Exclude these result IDs */
  excludeIds?: string[];
}

// ═══════════════════════════════════════════════════════════════════
// REFINEMENT OPTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Options for refining search results
 */
export interface RefineOptions {
  /** New query to apply within results */
  query?: string;

  /** Result IDs to use as positive examples (find more like these) */
  likeThese?: string[];

  /** Result IDs to use as negative examples (exclude similar) */
  unlikeThese?: string[];

  /** Minimum score to keep */
  minScore?: number;

  /** Minimum word count to keep */
  minWordCount?: number;

  /** Maximum results after refinement */
  limit?: number;
}

// ═══════════════════════════════════════════════════════════════════
// SEARCH SESSION
// ═══════════════════════════════════════════════════════════════════

/**
 * An entry in the search history
 */
export interface SearchHistoryEntry {
  /** Entry ID */
  id: string;

  /** The query that was run */
  query: string;

  /** Options used */
  options: AgenticSearchOptions;

  /** Number of results returned */
  resultCount: number;

  /** When the search was run */
  timestamp: number;

  /** Refinement applied (if any) */
  refinement?: RefineOptions;
}

/**
 * Session metadata
 */
export interface SessionMetadata {
  /** When the session was created */
  createdAt: number;

  /** When the session was last updated */
  updatedAt: number;

  /** Total searches run in this session */
  searchCount: number;

  /** Last query run */
  lastQuery?: string;

  /** User-provided notes */
  notes?: string;
}

/**
 * A search session for iterative refinement.
 * Maintains state across multiple searches.
 */
export interface SearchSession {
  /** Session ID */
  id: string;

  /** Optional session name */
  name?: string;

  /** Current results */
  results: AgenticSearchResult[];

  /** Search history */
  history: SearchHistoryEntry[];

  /** Positive anchors (find similar) */
  positiveAnchors: SemanticAnchor[];

  /** Negative anchors (exclude similar) */
  negativeAnchors: SemanticAnchor[];

  /** Manually excluded result IDs */
  excludedIds: Set<string>;

  /** Pinned result IDs (protected from exclusion) */
  pinnedIds: Set<string>;

  /** Session metadata */
  metadata: SessionMetadata;
}

// ═══════════════════════════════════════════════════════════════════
// SEARCH RESPONSE
// ═══════════════════════════════════════════════════════════════════

/**
 * Statistics about a search operation
 */
export interface SearchStats {
  /** Total candidates considered */
  totalCandidates: number;

  /** Results from archive */
  archiveCount: number;

  /** Results from books */
  booksCount: number;

  /** Results filtered by quality gate */
  filteredByQuality: number;

  /** Results filtered by anchors */
  filteredByAnchors: number;

  /** Results excluded manually */
  excludedManually: number;

  /** Dense search time (ms) */
  denseTimeMs: number;

  /** Sparse search time (ms) */
  sparseTimeMs: number;

  /** Fusion time (ms) */
  fusionTimeMs: number;

  /** Quality gate time (ms) */
  qualityTimeMs: number;

  /** Total time (ms) */
  totalTimeMs: number;
}

/**
 * Response from a search operation
 */
export interface AgenticSearchResponse {
  /** The search results */
  results: AgenticSearchResult[];

  /** Search statistics */
  stats: SearchStats;

  /** The query that was run */
  query: string;

  /** Options used */
  options: AgenticSearchOptions;

  /** Session ID (if search was in a session) */
  sessionId?: string;

  /** Whether more results are available */
  hasMore: boolean;

  /** Cursor for pagination */
  cursor?: string;
}

// ═══════════════════════════════════════════════════════════════════
// QUALITY GATE OPTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Options for quality-gated retrieval
 */
export interface QualityGateOptions {
  /** Minimum word count for results */
  minWordCount?: number;

  /** Minimum quality score (0-1) */
  minQualityScore?: number;

  /** Expand context for short chunks */
  expandContext?: boolean;

  /** Maximum context expansion (in parent levels) */
  maxContextExpansion?: number;

  /** Filter by author role */
  authorRole?: AuthorRole;

  /** Scrub system messages */
  scrubSystemMessages?: boolean;

  /** Scrub empty/trivial content */
  scrubTrivialContent?: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// CLUSTERING
// ═══════════════════════════════════════════════════════════════════

/**
 * A discovered cluster of related content
 */
export interface ContentCluster {
  /** Cluster ID */
  id: string;

  /** Cluster label (auto-generated) */
  label: string;

  /** Cluster centroid embedding */
  centroid: number[];

  /** Results in this cluster */
  members: AgenticSearchResult[];

  /** Cluster cohesion score (0-1) */
  cohesion: number;

  /** Representative result (closest to centroid) */
  representative: AgenticSearchResult;
}

/**
 * Options for cluster discovery
 */
export interface ClusterOptions {
  /** Minimum cluster size */
  minClusterSize?: number;

  /** Maximum clusters to return */
  maxClusters?: number;

  /** Compute and return centroids */
  computeCentroids?: boolean;

  /** Generate cluster labels */
  generateLabels?: boolean;
}

/**
 * Result from cluster discovery
 */
export interface ClusterDiscoveryResult {
  /** Discovered clusters */
  clusters: ContentCluster[];

  /** Noise points (not in any cluster) */
  noise: AgenticSearchResult[];

  /** Clustering statistics */
  stats: {
    totalPoints: number;
    clusterCount: number;
    noiseCount: number;
    silhouetteScore: number;
  };
}

// ═══════════════════════════════════════════════════════════════════
// UNIFIED STORE TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Options for unified store search
 */
export interface UnifiedSearchOptions {
  /** Which store(s) to search */
  target: SearchTarget;

  /** Maximum results per store */
  limit: number;

  /** Minimum similarity threshold */
  threshold?: number;

  /** Hierarchy level filter */
  hierarchyLevel?: number;

  /** Source type filter */
  sourceType?: string | string[];

  /** Book ID filter (books only) */
  bookId?: string;
}

/**
 * Raw result from unified store before enrichment
 */
export interface UnifiedStoreResult {
  /** Node ID */
  id: string;

  /** Source store */
  source: 'archive' | 'books';

  /** The node data */
  node: StoredNode | BookNode;

  /** Similarity/relevance score */
  score: number;
}

/**
 * Options for querying nodes (no search)
 */
export interface UnifiedQueryOptions {
  /** Which store(s) to query */
  target: SearchTarget;

  /** Filter by IDs */
  ids?: string[];

  /** Filter by source type */
  sourceType?: string | string[];

  /** Filter by hierarchy level */
  hierarchyLevel?: number;

  /** Filter by book ID (books only) */
  bookId?: string;

  /** Limit results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

/**
 * Result from unified query
 */
export interface UnifiedQueryResult {
  /** Nodes from archive */
  archiveNodes: StoredNode[];

  /** Nodes from books */
  bookNodes: BookNode[];

  /** Total count (before limit) */
  total: number;

  /** Whether more results exist */
  hasMore: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// SERVICE OPTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Embedding function interface
 */
export type EmbeddingFunction = (text: string) => Promise<number[]>;

/**
 * Batch embedding function interface
 */
export type BatchEmbeddingFunction = (texts: string[]) => Promise<number[][]>;

/**
 * LLM adapter interface for enrichment
 */
export interface LlmAdapter {
  /** Generate text completion */
  complete(prompt: string, options?: { maxTokens?: number }): Promise<string>;
}

/**
 * Options for AgenticSearchService constructor
 */
export interface AgenticSearchServiceOptions {
  /** Default search options */
  defaultSearchOptions?: Partial<AgenticSearchOptions>;

  /** Default quality gate options */
  defaultQualityOptions?: Partial<QualityGateOptions>;

  /** Enable session persistence */
  persistSessions?: boolean;

  /** Maximum sessions to keep */
  maxSessions?: number;

  /** Session timeout (ms) */
  sessionTimeoutMs?: number;

  /** Enable caching */
  enableCache?: boolean;

  /** Cache TTL (ms) */
  cacheTtlMs?: number;

  /** Verbose logging */
  verbose?: boolean;
}
