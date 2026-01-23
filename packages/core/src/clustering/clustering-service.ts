/**
 * Clustering Service
 *
 * High-level clustering service that wraps HDBSCAN and provides:
 * - Full cluster results with statistics
 * - Centroid computation
 * - Silhouette scoring
 * - Theme extraction (stub for LLM integration)
 */

import type {
  ClusterPoint,
  Cluster,
  ClusterStats,
  ClusteringResult,
  ClusteringStats,
  ClusteringConfig,
} from './types.js';
import { HDBSCAN } from './hdbscan.js';
import {
  cosineSimilarity,
  computeCentroid,
  getDistanceFunction,
} from './distance.js';
import {
  DEFAULT_CLUSTERING_CONFIG,
  CLUSTER_LABEL_PREFIX,
  NOISE_LABEL,
} from './constants.js';

// ═══════════════════════════════════════════════════════════════════
// CLUSTERING SERVICE
// ═══════════════════════════════════════════════════════════════════

/**
 * Clustering service for semantic content grouping
 */
export class ClusteringService {
  private config: ClusteringConfig;

  constructor(config: Partial<ClusteringConfig> = {}) {
    this.config = {
      ...DEFAULT_CLUSTERING_CONFIG,
      ...config,
      hdbscan: {
        ...DEFAULT_CLUSTERING_CONFIG.hdbscan,
        ...config.hdbscan,
      },
    };
  }

  /**
   * Cluster points and return full results
   *
   * @param points Points to cluster
   * @returns Clustering result with clusters, noise, and statistics
   */
  cluster(points: ClusterPoint[]): ClusteringResult {
    const startTime = Date.now();

    if (points.length === 0) {
      return this.emptyResult();
    }

    // Run HDBSCAN
    const hdbscan = new HDBSCAN(this.config.hdbscan);
    const labels = hdbscan.fit(points);

    // Group points by cluster
    const clusterMap = new Map<number, ClusterPoint[]>();
    const noise: ClusterPoint[] = [];

    for (let i = 0; i < points.length; i++) {
      const label = labels[i];
      if (label === -1) {
        noise.push(points[i]);
      } else {
        if (!clusterMap.has(label)) {
          clusterMap.set(label, []);
        }
        clusterMap.get(label)!.push(points[i]);
      }
    }

    // Build cluster objects
    const clusters: Cluster[] = [];
    for (const [clusterId, clusterPoints] of clusterMap) {
      const cluster = this.buildCluster(clusterId, clusterPoints);
      clusters.push(cluster);
    }

    // Sort by size (largest first)
    clusters.sort((a, b) => b.stats.size - a.stats.size);

    // Optionally limit clusters
    const limitedClusters = this.config.maxClusters && this.config.maxClusters > 0
      ? clusters.slice(0, this.config.maxClusters)
      : clusters;

    // If we limited clusters, move excess to noise
    if (limitedClusters.length < clusters.length) {
      for (let i = limitedClusters.length; i < clusters.length; i++) {
        noise.push(...clusters[i].points);
      }
    }

    // Build labels map
    const labelsMap = new Map<string, number>();
    for (let i = 0; i < points.length; i++) {
      labelsMap.set(points[i].id, labels[i]);
    }

    // Compute overall statistics
    const silhouetteScore = this.computeOverallSilhouette(
      limitedClusters,
      noise,
      points
    );

    const stats: ClusteringStats = {
      totalPoints: points.length,
      numClusters: limitedClusters.length,
      numNoise: noise.length,
      clusterCoverage: points.length > 0
        ? (points.length - noise.length) / points.length
        : 0,
      avgClusterSize: limitedClusters.length > 0
        ? limitedClusters.reduce((sum, c) => sum + c.stats.size, 0) / limitedClusters.length
        : 0,
      silhouetteScore,
      clusteringTimeMs: Date.now() - startTime,
    };

    return {
      clusters: limitedClusters,
      noise,
      labels: labelsMap,
      stats,
      config: this.config,
    };
  }

  /**
   * Build a single cluster object
   */
  private buildCluster(clusterId: number, points: ClusterPoint[]): Cluster {
    const pointIds = points.map((p) => p.id);

    // Compute centroid if requested
    const centroid = this.config.computeCentroids
      ? computeCentroid(points.map((p) => p.embedding))
      : undefined;

    // Compute statistics
    const stats = this.computeClusterStats(points);

    // Generate label
    const label = `${CLUSTER_LABEL_PREFIX} ${clusterId + 1}`;

    return {
      id: clusterId,
      label,
      points,
      pointIds,
      centroid,
      stats,
      themes: this.config.extractThemes ? this.extractThemes(points) : undefined,
    };
  }

  /**
   * Compute statistics for a single cluster
   */
  private computeClusterStats(points: ClusterPoint[]): ClusterStats {
    const size = points.length;

    // Compute pairwise similarities
    const similarities: number[] = [];
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const sim = cosineSimilarity(
          points[i].embedding,
          points[j].embedding
        );
        similarities.push(sim);
      }
    }

    // Average similarity
    const avgInternalSimilarity = similarities.length > 0
      ? similarities.reduce((a, b) => a + b, 0) / similarities.length
      : 1; // Single point has perfect internal similarity

    // Standard deviation
    const variance = similarities.length > 0
      ? similarities.reduce((sum, s) => sum + (s - avgInternalSimilarity) ** 2, 0) / similarities.length
      : 0;
    const similarityStdDev = Math.sqrt(variance);

    // Total word count
    const totalWordCount = points.reduce((sum, p) => sum + (p.wordCount ?? 0), 0);

    // Density (higher avg similarity with lower std dev = denser)
    const density = avgInternalSimilarity * (1 - similarityStdDev);

    return {
      size,
      avgInternalSimilarity,
      similarityStdDev,
      totalWordCount,
      density,
    };
  }

  /**
   * Compute overall silhouette score
   *
   * Silhouette = (b - a) / max(a, b)
   * where a = avg distance to same cluster, b = avg distance to nearest other cluster
   */
  private computeOverallSilhouette(
    clusters: Cluster[],
    noise: ClusterPoint[],
    _allPoints: ClusterPoint[]
  ): number {
    if (clusters.length < 2) return 0;

    const distFn = getDistanceFunction(this.config.hdbscan.metric);
    const silhouettes: number[] = [];

    for (const cluster of clusters) {
      for (const point of cluster.points) {
        // a = average distance to points in same cluster
        let a = 0;
        if (cluster.points.length > 1) {
          for (const other of cluster.points) {
            if (other.id !== point.id) {
              a += distFn(point.embedding, other.embedding);
            }
          }
          a /= cluster.points.length - 1;
        }

        // b = minimum average distance to any other cluster
        let b = Infinity;
        for (const otherCluster of clusters) {
          if (otherCluster.id !== cluster.id) {
            let avgDist = 0;
            for (const other of otherCluster.points) {
              avgDist += distFn(point.embedding, other.embedding);
            }
            avgDist /= otherCluster.points.length;
            b = Math.min(b, avgDist);
          }
        }

        // Silhouette for this point
        const s = b === Infinity ? 0 : (b - a) / Math.max(a, b);
        silhouettes.push(s);
      }
    }

    // Average silhouette
    return silhouettes.length > 0
      ? silhouettes.reduce((sum, s) => sum + s, 0) / silhouettes.length
      : 0;
  }

  /**
   * Extract themes from cluster (stub for LLM integration)
   *
   * In production, this would call an LLM to identify themes.
   * For now, we return an empty array.
   */
  private extractThemes(_points: ClusterPoint[]): string[] {
    // TODO: Integrate with LLM for theme extraction
    // Could use the text content to identify common topics
    return [];
  }

  /**
   * Create empty result
   */
  private emptyResult(): ClusteringResult {
    return {
      clusters: [],
      noise: [],
      labels: new Map(),
      stats: {
        totalPoints: 0,
        numClusters: 0,
        numNoise: 0,
        clusterCoverage: 0,
        avgClusterSize: 0,
        silhouetteScore: 0,
        clusteringTimeMs: 0,
      },
      config: this.config,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

let _clusteringService: ClusteringService | null = null;

/**
 * Get the clustering service singleton
 */
export function getClusteringService(): ClusteringService {
  if (!_clusteringService) {
    _clusteringService = new ClusteringService();
  }
  return _clusteringService;
}

/**
 * Initialize clustering service with custom config
 */
export function initClusteringService(
  config: Partial<ClusteringConfig>
): ClusteringService {
  _clusteringService = new ClusteringService(config);
  return _clusteringService;
}

/**
 * Reset clustering service (for testing)
 */
export function resetClusteringService(): void {
  _clusteringService = null;
}

// ═══════════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Quick clustering with default settings
 *
 * @param points Points to cluster
 * @returns Clustering result
 */
export function quickCluster(points: ClusterPoint[]): ClusteringResult {
  const service = getClusteringService();
  return service.cluster(points);
}

/**
 * Cluster from embeddings and IDs
 *
 * @param data Array of {id, embedding} objects
 * @returns Clustering result
 */
export function clusterFromEmbeddings(
  data: Array<{ id: string; embedding: number[] }>
): ClusteringResult {
  const points: ClusterPoint[] = data.map((d) => ({
    id: d.id,
    embedding: d.embedding,
  }));
  return quickCluster(points);
}
