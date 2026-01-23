/**
 * Clustering Types
 *
 * Type definitions for density-based clustering using HDBSCAN algorithm.
 *
 * Key concepts:
 * - Cluster: A group of semantically similar content nodes
 * - Noise: Points that don't belong to any cluster (-1 label)
 * - Core distance: Distance to min_samples nearest neighbor
 * - Mutual reachability: max(core_a, core_b, dist(a,b))
 */

// ═══════════════════════════════════════════════════════════════════
// CLUSTERING CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Configuration for HDBSCAN clustering
 */
export interface HDBSCANConfig {
  /** Minimum cluster size (default: 3) */
  minClusterSize: number;

  /** Minimum samples for core point (default: minClusterSize) */
  minSamples?: number;

  /** Cluster selection epsilon - how much noise to allow (default: 0.0) */
  clusterSelectionEpsilon?: number;

  /** Distance metric to use */
  metric: DistanceMetric;

  /** Whether to allow single-point clusters (default: false) */
  allowSingleCluster?: boolean;
}

/**
 * General clustering configuration
 */
export interface ClusteringConfig {
  /** HDBSCAN-specific config */
  hdbscan: HDBSCANConfig;

  /** Similarity threshold for pre-filtering (0-1) */
  similarityThreshold: number;

  /** Maximum number of clusters to return */
  maxClusters?: number;

  /** Whether to compute cluster centroids */
  computeCentroids: boolean;

  /** Whether to extract themes from clusters */
  extractThemes: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// DISTANCE METRICS
// ═══════════════════════════════════════════════════════════════════

/**
 * Supported distance metrics
 */
export type DistanceMetric = 'cosine' | 'euclidean' | 'manhattan';

/**
 * Distance function signature
 */
export type DistanceFunction = (a: number[], b: number[]) => number;

// ═══════════════════════════════════════════════════════════════════
// CLUSTERING INPUT/OUTPUT
// ═══════════════════════════════════════════════════════════════════

/**
 * Input point for clustering
 */
export interface ClusterPoint {
  /** Unique identifier */
  id: string;

  /** Embedding vector (required for clustering) */
  embedding: number[];

  /** Original text content */
  text?: string;

  /** Word count */
  wordCount?: number;

  /** Source metadata */
  metadata?: Record<string, unknown>;
}

/**
 * A clustered group of points
 */
export interface Cluster {
  /** Cluster ID (0-indexed, -1 for noise) */
  id: number;

  /** Human-readable label */
  label?: string;

  /** Points in this cluster */
  points: ClusterPoint[];

  /** Point IDs for quick lookup */
  pointIds: string[];

  /** Centroid embedding (average of all points) */
  centroid?: number[];

  /** Cluster statistics */
  stats: ClusterStats;

  /** Extracted themes (if enabled) */
  themes?: string[];

  /** Silhouette score for this cluster (-1 to 1) */
  silhouetteScore?: number;
}

/**
 * Statistics for a single cluster
 */
export interface ClusterStats {
  /** Number of points in cluster */
  size: number;

  /** Average pairwise similarity within cluster */
  avgInternalSimilarity: number;

  /** Standard deviation of similarities */
  similarityStdDev: number;

  /** Total word count across all points */
  totalWordCount: number;

  /** Density score (higher = tighter cluster) */
  density: number;
}

/**
 * Result of clustering operation
 */
export interface ClusteringResult {
  /** All discovered clusters (excluding noise) */
  clusters: Cluster[];

  /** Noise points (didn't fit any cluster) */
  noise: ClusterPoint[];

  /** Mapping from point ID to cluster ID */
  labels: Map<string, number>;

  /** Overall clustering statistics */
  stats: ClusteringStats;

  /** Configuration used */
  config: ClusteringConfig;
}

/**
 * Overall clustering statistics
 */
export interface ClusteringStats {
  /** Total points processed */
  totalPoints: number;

  /** Number of clusters found */
  numClusters: number;

  /** Number of noise points */
  numNoise: number;

  /** Percentage of points in clusters */
  clusterCoverage: number;

  /** Average cluster size */
  avgClusterSize: number;

  /** Silhouette score (-1 to 1, higher is better) */
  silhouetteScore: number;

  /** Time taken for clustering (ms) */
  clusteringTimeMs: number;
}

// ═══════════════════════════════════════════════════════════════════
// HDBSCAN INTERNALS
// ═══════════════════════════════════════════════════════════════════

/**
 * Minimum spanning tree edge
 */
export interface MSTEdge {
  /** First point index */
  from: number;

  /** Second point index */
  to: number;

  /** Edge weight (mutual reachability distance) */
  weight: number;
}

/**
 * Cluster hierarchy node for dendrogram
 */
export interface HierarchyNode {
  /** Node ID */
  id: number;

  /** Left child (point index or child node) */
  left: number;

  /** Right child (point index or child node) */
  right: number;

  /** Distance at which merge occurred */
  distance: number;

  /** Size of subtree */
  size: number;

  /** Lambda value (1/distance) */
  lambda: number;

  /** Stability score */
  stability?: number;

  /** Children node IDs */
  children: number[];

  /** Parent node ID */
  parent?: number;
}

/**
 * Condensed tree node for cluster extraction
 */
export interface CondensedNode {
  /** Cluster ID */
  clusterId: number;

  /** Parent cluster ID */
  parent: number;

  /** Child cluster ID (or point index if leaf) */
  child: number;

  /** Lambda value at which child joined */
  lambdaVal: number;

  /** Size of child (1 if leaf point) */
  childSize: number;
}

// ═══════════════════════════════════════════════════════════════════
// CLUSTER OPERATIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Options for merging clusters
 */
export interface MergeOptions {
  /** IDs of clusters to merge */
  clusterIds: number[];

  /** New label for merged cluster */
  newLabel?: string;

  /** Whether to recompute centroid */
  recomputeCentroid: boolean;
}

/**
 * Options for splitting a cluster
 */
export interface SplitOptions {
  /** ID of cluster to split */
  clusterId: number;

  /** Number of sub-clusters to create */
  numSplits: number;

  /** Method for splitting */
  method: 'kmeans' | 'hierarchical';
}

/**
 * Options for finding similar clusters
 */
export interface SimilarClusterOptions {
  /** Query embedding or cluster ID */
  query: number[] | number;

  /** Maximum number of similar clusters to return */
  limit: number;

  /** Minimum similarity threshold */
  minSimilarity: number;
}
