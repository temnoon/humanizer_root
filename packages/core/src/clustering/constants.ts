/**
 * Clustering Constants
 *
 * Configuration constants for HDBSCAN clustering algorithm.
 * These follow the config-management pattern used throughout the codebase.
 */

import type { ClusteringConfig, HDBSCANConfig } from './types.js';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION KEYS (for config management system)
// ═══════════════════════════════════════════════════════════════════

/**
 * Configuration key constants for clustering
 */
export const CLUSTERING_CONFIG_KEYS = {
  /** Minimum cluster size */
  MIN_CLUSTER_SIZE: 'clustering.minClusterSize',

  /** Minimum samples for core point */
  MIN_SAMPLES: 'clustering.minSamples',

  /** Cluster selection epsilon */
  CLUSTER_SELECTION_EPSILON: 'clustering.clusterSelectionEpsilon',

  /** Distance metric */
  DISTANCE_METRIC: 'clustering.distanceMetric',

  /** Similarity threshold for pre-filtering */
  SIMILARITY_THRESHOLD: 'clustering.similarityThreshold',

  /** Maximum clusters to return */
  MAX_CLUSTERS: 'clustering.maxClusters',

  /** Whether to compute centroids */
  COMPUTE_CENTROIDS: 'clustering.computeCentroids',

  /** Whether to extract themes */
  EXTRACT_THEMES: 'clustering.extractThemes',
} as const;

// ═══════════════════════════════════════════════════════════════════
// HDBSCAN DEFAULTS
// ═══════════════════════════════════════════════════════════════════

/**
 * Minimum cluster size
 * Smaller values find more clusters but may include noise
 */
export const MIN_CLUSTER_SIZE = 3;

/**
 * Minimum samples for a point to be considered core
 * Affects density estimation; higher = more conservative
 */
export const MIN_SAMPLES = 3;

/**
 * Cluster selection epsilon
 * Higher values merge small clusters; 0 = default HDBSCAN behavior
 */
export const CLUSTER_SELECTION_EPSILON = 0.0;

/**
 * Default distance metric
 * Cosine is best for normalized embedding vectors
 */
export const DEFAULT_DISTANCE_METRIC = 'cosine' as const;

/**
 * Allow single cluster output
 */
export const ALLOW_SINGLE_CLUSTER = false;

// ═══════════════════════════════════════════════════════════════════
// GENERAL CLUSTERING DEFAULTS
// ═══════════════════════════════════════════════════════════════════

/**
 * Similarity threshold for pre-filtering candidates
 * Points below this similarity to any other point are likely noise
 */
export const SIMILARITY_THRESHOLD = 0.55;

/**
 * Maximum clusters to return (0 = unlimited)
 */
export const MAX_CLUSTERS = 0;

/**
 * Whether to compute cluster centroids by default
 */
export const COMPUTE_CENTROIDS = true;

/**
 * Whether to extract themes from clusters by default
 */
export const EXTRACT_THEMES = false;

// ═══════════════════════════════════════════════════════════════════
// PERFORMANCE LIMITS
// ═══════════════════════════════════════════════════════════════════

/**
 * Maximum points for O(n²) distance matrix
 * Above this, we use approximate methods
 */
export const MAX_POINTS_EXACT = 5000;

/**
 * Sample size for approximate clustering of large datasets
 */
export const LARGE_DATASET_SAMPLE_SIZE = 2000;

/**
 * Chunk size for parallel distance computation
 */
export const DISTANCE_CHUNK_SIZE = 1000;

// ═══════════════════════════════════════════════════════════════════
// QUALITY THRESHOLDS
// ═══════════════════════════════════════════════════════════════════

/**
 * Minimum silhouette score to consider clustering valid
 */
export const MIN_SILHOUETTE_SCORE = 0.1;

/**
 * Minimum cluster density score
 */
export const MIN_CLUSTER_DENSITY = 0.3;

/**
 * Minimum internal similarity for a valid cluster
 */
export const MIN_INTERNAL_SIMILARITY = 0.4;

// ═══════════════════════════════════════════════════════════════════
// DEFAULT CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Default HDBSCAN configuration
 */
export const DEFAULT_HDBSCAN_CONFIG: HDBSCANConfig = {
  minClusterSize: MIN_CLUSTER_SIZE,
  minSamples: MIN_SAMPLES,
  clusterSelectionEpsilon: CLUSTER_SELECTION_EPSILON,
  metric: DEFAULT_DISTANCE_METRIC,
  allowSingleCluster: ALLOW_SINGLE_CLUSTER,
};

/**
 * Default clustering configuration
 */
export const DEFAULT_CLUSTERING_CONFIG: ClusteringConfig = {
  hdbscan: DEFAULT_HDBSCAN_CONFIG,
  similarityThreshold: SIMILARITY_THRESHOLD,
  maxClusters: MAX_CLUSTERS,
  computeCentroids: COMPUTE_CENTROIDS,
  extractThemes: EXTRACT_THEMES,
};

// ═══════════════════════════════════════════════════════════════════
// CLUSTER NAMING
// ═══════════════════════════════════════════════════════════════════

/**
 * Default cluster label prefix
 */
export const CLUSTER_LABEL_PREFIX = 'Cluster';

/**
 * Noise cluster label
 */
export const NOISE_LABEL = 'Noise';
