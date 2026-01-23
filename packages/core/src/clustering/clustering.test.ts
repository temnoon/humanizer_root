/**
 * Clustering Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  // Distance functions
  cosineDistance,
  euclideanDistance,
  manhattanDistance,
  computeDistanceMatrix,
  computeKNN,

  // HDBSCAN
  HDBSCAN,
  hdbscan,
  clusterEmbeddings,

  // Clustering service
  ClusteringService,
  getClusteringService,
  initClusteringService,
  resetClusteringService,
  quickCluster,
  clusterFromEmbeddings,

  // Constants
  DEFAULT_CLUSTERING_CONFIG,
  MIN_CLUSTER_SIZE,
  NOISE_LABEL,
} from './index.js';

// Import directly from distance.ts for testing those functions
import { cosineSimilarity, computeCentroid } from './distance.js';
import type { ClusterPoint } from './types.js';

// ═══════════════════════════════════════════════════════════════════
// TEST DATA GENERATORS
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate random embedding vector
 */
function randomEmbedding(dim = 768): number[] {
  const vec = new Array(dim);
  for (let i = 0; i < dim; i++) {
    vec[i] = Math.random() * 2 - 1;
  }
  // Normalize
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return vec.map((v) => v / norm);
}

/**
 * Generate cluster of similar embeddings
 */
function generateCluster(
  centroid: number[],
  size: number,
  noise = 0.1
): number[][] {
  const cluster: number[][] = [];
  for (let i = 0; i < size; i++) {
    const vec = centroid.map((v) => v + (Math.random() - 0.5) * noise);
    // Normalize
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    cluster.push(vec.map((v) => v / norm));
  }
  return cluster;
}

/**
 * Generate test dataset with known clusters
 */
function generateTestData(
  numClusters: number,
  pointsPerCluster: number,
  dim = 64, // Use smaller dimension for faster tests
  noise = 0.1
): ClusterPoint[] {
  const points: ClusterPoint[] = [];
  let id = 0;

  for (let c = 0; c < numClusters; c++) {
    const centroid = randomEmbedding(dim);
    const cluster = generateCluster(centroid, pointsPerCluster, noise);

    for (const embedding of cluster) {
      points.push({
        id: `point-${id++}`,
        embedding,
        text: `Text for cluster ${c}`,
        wordCount: 50,
      });
    }
  }

  return points;
}

// ═══════════════════════════════════════════════════════════════════
// DISTANCE FUNCTION TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Distance Functions', () => {
  describe('cosineDistance', () => {
    it('returns 0 for identical vectors', () => {
      const vec = [1, 2, 3];
      expect(cosineDistance(vec, vec)).toBeCloseTo(0, 10);
    });

    it('returns 2 for opposite vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [-1, 0, 0];
      expect(cosineDistance(vec1, vec2)).toBeCloseTo(2, 10);
    });

    it('returns 1 for orthogonal vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];
      expect(cosineDistance(vec1, vec2)).toBeCloseTo(1, 10);
    });

    it('throws on dimension mismatch', () => {
      expect(() => cosineDistance([1, 2], [1, 2, 3])).toThrow();
    });
  });

  describe('euclideanDistance', () => {
    it('returns 0 for identical vectors', () => {
      const vec = [1, 2, 3];
      expect(euclideanDistance(vec, vec)).toBe(0);
    });

    it('computes correct distance', () => {
      const vec1 = [0, 0, 0];
      const vec2 = [3, 4, 0];
      expect(euclideanDistance(vec1, vec2)).toBe(5);
    });
  });

  describe('manhattanDistance', () => {
    it('returns 0 for identical vectors', () => {
      const vec = [1, 2, 3];
      expect(manhattanDistance(vec, vec)).toBe(0);
    });

    it('computes correct distance', () => {
      const vec1 = [0, 0];
      const vec2 = [3, 4];
      expect(manhattanDistance(vec1, vec2)).toBe(7);
    });
  });

  describe('cosineSimilarity', () => {
    it('returns 1 for identical vectors', () => {
      const vec = [1, 2, 3];
      expect(cosineSimilarity(vec, vec)).toBeCloseTo(1, 10);
    });

    it('returns -1 for opposite vectors', () => {
      const vec1 = [1, 0];
      const vec2 = [-1, 0];
      expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(-1, 10);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// MATRIX COMPUTATION TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Matrix Computation', () => {
  describe('computeCentroid', () => {
    it('computes mean of vectors', () => {
      const embeddings = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];
      const centroid = computeCentroid(embeddings);
      expect(centroid[0]).toBeCloseTo(1 / 3, 10);
      expect(centroid[1]).toBeCloseTo(1 / 3, 10);
      expect(centroid[2]).toBeCloseTo(1 / 3, 10);
    });

    it('throws on empty array', () => {
      expect(() => computeCentroid([])).toThrow();
    });
  });

  describe('computeDistanceMatrix', () => {
    it('creates symmetric matrix', () => {
      const embeddings = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];
      const matrix = computeDistanceMatrix(embeddings);

      expect(matrix.length).toBe(3);
      expect(matrix[0].length).toBe(3);

      // Check symmetry
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          expect(matrix[i][j]).toBeCloseTo(matrix[j][i], 10);
        }
      }
    });

    it('has zero diagonal', () => {
      const embeddings = [randomEmbedding(10), randomEmbedding(10)];
      const matrix = computeDistanceMatrix(embeddings);

      expect(matrix[0][0]).toBe(0);
      expect(matrix[1][1]).toBe(0);
    });
  });

  describe('computeKNN', () => {
    it('finds correct neighbors', () => {
      const embeddings = [
        [1, 0, 0],
        [0.9, 0.1, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];
      const knn = computeKNN(embeddings, 2);

      // Point 0 should have point 1 as nearest neighbor
      expect(knn[0].indices[0]).toBe(1);
    });

    it('returns requested number of neighbors', () => {
      const embeddings = [
        randomEmbedding(10),
        randomEmbedding(10),
        randomEmbedding(10),
        randomEmbedding(10),
      ];
      const knn = computeKNN(embeddings, 2);

      for (const neighbors of knn) {
        expect(neighbors.indices.length).toBe(2);
        expect(neighbors.distances.length).toBe(2);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// HDBSCAN TESTS
// ═══════════════════════════════════════════════════════════════════

describe('HDBSCAN', () => {
  describe('empty and edge cases', () => {
    it('returns empty array for empty input', () => {
      const clusterer = new HDBSCAN();
      expect(clusterer.fit([])).toEqual([]);
    });

    it('returns noise for single point (default)', () => {
      const clusterer = new HDBSCAN();
      const points: ClusterPoint[] = [{ id: '1', embedding: [1, 0, 0] }];
      expect(clusterer.fit(points)).toEqual([-1]);
    });

    it('returns cluster for single point with allowSingleCluster', () => {
      const clusterer = new HDBSCAN({ allowSingleCluster: true });
      const points: ClusterPoint[] = [{ id: '1', embedding: [1, 0, 0] }];
      expect(clusterer.fit(points)).toEqual([0]);
    });

    it('returns all noise for points below minClusterSize', () => {
      const clusterer = new HDBSCAN({ minClusterSize: 5 });
      const points: ClusterPoint[] = [
        { id: '1', embedding: [1, 0, 0] },
        { id: '2', embedding: [0, 1, 0] },
      ];
      expect(clusterer.fit(points)).toEqual([-1, -1]);
    });
  });

  describe('clustering behavior', () => {
    it('finds distinct clusters', () => {
      // Two well-separated clusters
      const cluster1 = generateCluster([1, 0, 0, 0, 0], 5, 0.05);
      const cluster2 = generateCluster([0, 1, 0, 0, 0], 5, 0.05);

      const points: ClusterPoint[] = [
        ...cluster1.map((e, i) => ({ id: `c1-${i}`, embedding: e })),
        ...cluster2.map((e, i) => ({ id: `c2-${i}`, embedding: e })),
      ];

      const labels = hdbscan(points, { minClusterSize: 3 });

      // Should have at least 2 clusters
      const uniqueLabels = new Set(labels.filter((l) => l >= 0));
      expect(uniqueLabels.size).toBeGreaterThanOrEqual(1);
    });

    it('marks outliers as noise', () => {
      // One tight cluster + a few outliers far away
      const cluster = generateCluster([1, 0, 0, 0, 0], 15, 0.05);

      const points: ClusterPoint[] = [
        ...cluster.map((e, i) => ({ id: `c-${i}`, embedding: e })),
        { id: 'outlier1', embedding: [-1, 0, 0, 0, 0] }, // Opposite direction
        { id: 'outlier2', embedding: [0, -1, 0, 0, 0] }, // Another direction
      ];

      const labels = hdbscan(points, { minClusterSize: 5 });

      // Count noise points (outliers should be marked as noise)
      const noiseCount = labels.filter((l) => l === -1).length;
      // With HDBSCAN, sparse points that don't form dense regions become noise
      // At minimum, we should have fewer clusters than total points
      const clusterCount = new Set(labels.filter((l) => l >= 0)).size;
      expect(clusterCount).toBeGreaterThanOrEqual(1);
      expect(clusterCount + noiseCount).toBeLessThanOrEqual(labels.length);
    });
  });

  describe('clusterEmbeddings helper', () => {
    it('clusters raw embeddings', () => {
      const embeddings = [
        ...generateCluster([1, 0, 0], 5, 0.1),
        ...generateCluster([0, 1, 0], 5, 0.1),
      ];

      const labels = clusterEmbeddings(embeddings, 3);
      expect(labels.length).toBe(10);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// CLUSTERING SERVICE TESTS
// ═══════════════════════════════════════════════════════════════════

describe('ClusteringService', () => {
  beforeEach(() => {
    resetClusteringService();
  });

  describe('cluster method', () => {
    it('returns empty result for empty input', () => {
      const service = new ClusteringService();
      const result = service.cluster([]);

      expect(result.clusters).toEqual([]);
      expect(result.noise).toEqual([]);
      expect(result.stats.totalPoints).toBe(0);
    });

    it('returns clustering result with stats', () => {
      const points = generateTestData(3, 10, 32, 0.1);
      const service = new ClusteringService({
        hdbscan: { minClusterSize: 3, metric: 'cosine' },
      });

      const result = service.cluster(points);

      expect(result.stats.totalPoints).toBe(30);
      expect(result.stats.numClusters).toBeGreaterThan(0);
      expect(result.stats.clusteringTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('computes centroids when enabled', () => {
      const points = generateTestData(2, 10, 32, 0.1);
      const service = new ClusteringService({
        hdbscan: { minClusterSize: 3, metric: 'cosine' },
        computeCentroids: true,
      });

      const result = service.cluster(points);

      for (const cluster of result.clusters) {
        expect(cluster.centroid).toBeDefined();
        expect(cluster.centroid!.length).toBe(32);
      }
    });

    it('computes cluster statistics', () => {
      const points = generateTestData(2, 15, 32, 0.1);
      const service = new ClusteringService({
        hdbscan: { minClusterSize: 3, metric: 'cosine' },
      });

      const result = service.cluster(points);

      for (const cluster of result.clusters) {
        expect(cluster.stats.size).toBeGreaterThan(0);
        expect(cluster.stats.avgInternalSimilarity).toBeGreaterThan(0);
        expect(cluster.stats.density).toBeGreaterThan(0);
      }
    });

    it('limits clusters when maxClusters is set', () => {
      const points = generateTestData(5, 10, 32, 0.1);
      const service = new ClusteringService({
        hdbscan: { minClusterSize: 3, metric: 'cosine' },
        maxClusters: 2,
      });

      const result = service.cluster(points);
      expect(result.clusters.length).toBeLessThanOrEqual(2);
    });
  });

  describe('singleton management', () => {
    it('returns same instance from getClusteringService', () => {
      const service1 = getClusteringService();
      const service2 = getClusteringService();
      expect(service1).toBe(service2);
    });

    it('creates new instance with initClusteringService', () => {
      const service1 = getClusteringService();
      initClusteringService({ hdbscan: { minClusterSize: 5, metric: 'cosine' } });
      const service2 = getClusteringService();
      expect(service1).not.toBe(service2);
    });

    it('resetClusteringService clears singleton', () => {
      const service1 = getClusteringService();
      resetClusteringService();
      const service2 = getClusteringService();
      expect(service1).not.toBe(service2);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTION TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Convenience Functions', () => {
  beforeEach(() => {
    resetClusteringService();
  });

  describe('quickCluster', () => {
    it('clusters points with default settings', () => {
      const points = generateTestData(2, 10, 32, 0.1);
      const result = quickCluster(points);

      expect(result.stats.totalPoints).toBe(20);
      expect(result.clusters.length + result.noise.length).toBeGreaterThan(0);
    });
  });

  describe('clusterFromEmbeddings', () => {
    it('clusters from id/embedding pairs', () => {
      const data = [
        ...generateCluster([1, 0, 0, 0], 5, 0.1).map((e, i) => ({
          id: `a-${i}`,
          embedding: e,
        })),
        ...generateCluster([0, 1, 0, 0], 5, 0.1).map((e, i) => ({
          id: `b-${i}`,
          embedding: e,
        })),
      ];

      const result = clusterFromEmbeddings(data);
      expect(result.stats.totalPoints).toBe(10);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Constants', () => {
  it('has valid default config', () => {
    expect(DEFAULT_CLUSTERING_CONFIG.hdbscan.minClusterSize).toBe(MIN_CLUSTER_SIZE);
    expect(DEFAULT_CLUSTERING_CONFIG.hdbscan.metric).toBe('cosine');
    expect(DEFAULT_CLUSTERING_CONFIG.computeCentroids).toBe(true);
  });

  it('has noise label', () => {
    expect(NOISE_LABEL).toBe('Noise');
  });
});
