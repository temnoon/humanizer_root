/**
 * Clustering Module
 *
 * Density-based clustering using HDBSCAN algorithm.
 * Groups semantically similar content for document assembly.
 *
 * Usage:
 * ```typescript
 * import { ClusteringService, quickCluster } from '@humanizer/core';
 *
 * // Simple clustering
 * const points = nodes.map(n => ({
 *   id: n.id,
 *   embedding: n.embedding,
 *   text: n.text,
 *   wordCount: n.wordCount,
 * }));
 *
 * const result = quickCluster(points);
 *
 * console.log(`Found ${result.stats.numClusters} clusters`);
 * console.log(`Coverage: ${(result.stats.clusterCoverage * 100).toFixed(1)}%`);
 *
 * for (const cluster of result.clusters) {
 *   console.log(`${cluster.label}: ${cluster.stats.size} points`);
 * }
 * ```
 *
 * Advanced usage with custom config:
 * ```typescript
 * const service = new ClusteringService({
 *   hdbscan: {
 *     minClusterSize: 5,
 *     metric: 'cosine',
 *   },
 *   computeCentroids: true,
 *   similarityThreshold: 0.6,
 * });
 *
 * const result = service.cluster(points);
 * ```
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type {
  // Configuration
  HDBSCANConfig,
  ClusteringConfig,

  // Distance
  DistanceMetric,
  DistanceFunction,

  // Input/Output
  ClusterPoint,
  Cluster,
  ClusterStats,
  ClusteringResult,
  ClusteringStats,

  // HDBSCAN internals (for advanced use)
  MSTEdge,
  HierarchyNode,
  CondensedNode,

  // Operations
  MergeOptions,
  SplitOptions,
  SimilarClusterOptions,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

export {
  // Config keys
  CLUSTERING_CONFIG_KEYS,

  // HDBSCAN defaults
  MIN_CLUSTER_SIZE,
  MIN_SAMPLES,
  CLUSTER_SELECTION_EPSILON,
  DEFAULT_DISTANCE_METRIC,
  ALLOW_SINGLE_CLUSTER,

  // General defaults
  SIMILARITY_THRESHOLD,
  MAX_CLUSTERS,
  COMPUTE_CENTROIDS,
  EXTRACT_THEMES,

  // Performance limits
  MAX_POINTS_EXACT,
  LARGE_DATASET_SAMPLE_SIZE,
  DISTANCE_CHUNK_SIZE,

  // Quality thresholds
  MIN_SILHOUETTE_SCORE,
  MIN_CLUSTER_DENSITY,
  MIN_INTERNAL_SIMILARITY,

  // Default configs
  DEFAULT_HDBSCAN_CONFIG,
  DEFAULT_CLUSTERING_CONFIG,

  // Labels
  CLUSTER_LABEL_PREFIX,
  NOISE_LABEL,
} from './constants.js';

// ═══════════════════════════════════════════════════════════════════
// DISTANCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

export {
  // Core distance functions
  cosineDistance,
  euclideanDistance,
  manhattanDistance,
  getDistanceFunction,

  // Similarity functions (cosineSimilarity exported from retrieval module)
  distanceToSimilarity,
  similarityToDistance,

  // Matrix computation
  computeDistanceMatrix,
  computeKNN,

  // HDBSCAN helpers
  computeCoreDistances,
  computeMutualReachabilityMatrix,

  // Centroid (computeCentroid exported from retrieval module)
  normalizeVector,
} from './distance.js';

// Re-export from distance.ts for internal module use (not at package level)
// Users should import cosineSimilarity and computeCentroid from retrieval module

// ═══════════════════════════════════════════════════════════════════
// HDBSCAN ALGORITHM
// ═══════════════════════════════════════════════════════════════════

export {
  HDBSCAN,
  hdbscan,
  clusterEmbeddings,
} from './hdbscan.js';

// ═══════════════════════════════════════════════════════════════════
// CLUSTERING SERVICE
// ═══════════════════════════════════════════════════════════════════

export {
  ClusteringService,
  getClusteringService,
  initClusteringService,
  resetClusteringService,
  quickCluster,
  clusterFromEmbeddings,
} from './clustering-service.js';
