/**
 * Agentic Search Module
 *
 * Unified search service for searching across archive and books stores.
 * Provides:
 * - Hybrid search (semantic + keyword)
 * - Session-based iterative refinement
 * - Quality gating and enrichment
 * - Pyramid-aware navigation
 *
 * Usage:
 * ```typescript
 * import {
 *   AgenticSearchService,
 *   UnifiedStore,
 *   SessionManager,
 * } from '@humanizer/core/agentic-search';
 *
 * // Create stores and service
 * const unifiedStore = new UnifiedStore(archiveStore);
 * const service = new AgenticSearchService(unifiedStore, embedFn);
 *
 * // Search
 * const response = await service.search('consciousness', {
 *   target: 'all',
 *   limit: 20,
 * });
 *
 * // Session-based refinement
 * const session = sessionManager.createSession();
 * await service.searchInSession(session.id, 'memory');
 * await service.addPositiveAnchor(session.id, resultId);
 * await service.applyAnchors(session.id);
 * ```
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type {
  // Search targets & filters
  SearchTarget,
  HierarchyFilter,
  SearchMode,
  RerankerType,

  // Book node
  BookNode,

  // Result types
  ResultProvenance,
  ResultEnrichment,
  ScoreBreakdown,
  AgenticSearchResult,

  // Search options
  DateRange,
  AgenticSearchOptions,
  RefineOptions,

  // Session types
  SearchHistoryEntry,
  SessionMetadata,
  SearchSession,

  // Response types
  SearchStats,
  AgenticSearchResponse,

  // Quality types
  QualityGateOptions,

  // Clustering
  ContentCluster,
  ClusterOptions,
  ClusterDiscoveryResult,

  // Unified store types
  UnifiedSearchOptions,
  UnifiedStoreResult,
  UnifiedQueryOptions,
  UnifiedQueryResult,

  // Service options
  EmbeddingFunction,
  BatchEmbeddingFunction,
  LlmAdapter,
  AgenticSearchServiceOptions,
} from './types.js';

// Re-export from retrieval for convenience
export type { SemanticAnchor, QualityIndicators } from '../retrieval/types.js';

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

export {
  // Search defaults
  DEFAULT_LIMIT,
  DEFAULT_THRESHOLD,
  DEFAULT_DENSE_WEIGHT,
  DEFAULT_SPARSE_WEIGHT,
  RRF_K,

  // Quality defaults
  DEFAULT_MIN_WORD_COUNT,
  DEFAULT_MIN_QUALITY_SCORE,
  DEFAULT_MAX_CONTEXT_EXPANSION,
  TRIVIAL_CONTENT_THRESHOLD,

  // Anchor defaults
  DEFAULT_POSITIVE_ANCHOR_WEIGHT,
  DEFAULT_NEGATIVE_ANCHOR_WEIGHT,
  NEGATIVE_ANCHOR_THRESHOLD,

  // Clustering defaults
  DEFAULT_MIN_CLUSTER_SIZE,
  DEFAULT_MAX_CLUSTERS,

  // Session defaults
  DEFAULT_MAX_SESSIONS,
  DEFAULT_SESSION_TIMEOUT_MS,
  MAX_HISTORY_ENTRIES,

  // Cache defaults
  DEFAULT_CACHE_TTL_MS,
  MAX_CACHE_ENTRIES,

  // Enrichment defaults
  TITLE_GENERATION_MAX_CHARS,
  SUMMARY_GENERATION_MAX_CHARS,
  DEFAULT_SUMMARY_WORDS,

  // Mappings
  HIERARCHY_LEVEL_MAP,
  KNOWN_SOURCE_TYPES,
  CONFIG_PREFIX,
  CONFIG_KEYS,
} from './constants.js';

// ═══════════════════════════════════════════════════════════════════
// UNIFIED STORE
// ═══════════════════════════════════════════════════════════════════

export {
  UnifiedStore,
  StubBooksStore,
  type BooksStoreInterface,
} from './unified-store.js';

// ═══════════════════════════════════════════════════════════════════
// SESSION MANAGER
// ═══════════════════════════════════════════════════════════════════

export {
  SessionManager,
  getSessionManager,
  initSessionManager,
  resetSessionManager,
  type SessionManagerOptions,
} from './session-manager.js';

// ═══════════════════════════════════════════════════════════════════
// AGENTIC SEARCH SERVICE
// ═══════════════════════════════════════════════════════════════════

export {
  AgenticSearchService,
  createAgenticSearchService,
} from './agentic-search-service.js';

// ═══════════════════════════════════════════════════════════════════
// ENRICHMENT SERVICE
// ═══════════════════════════════════════════════════════════════════

export {
  EnrichmentService,
  StubLlmAdapter,
  createEnrichmentService,
  type EnrichmentServiceOptions,
} from './enrichment-service.js';
