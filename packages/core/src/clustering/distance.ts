/**
 * Distance Metrics
 *
 * Distance and similarity functions for clustering algorithms.
 * All functions work with embedding vectors (number arrays).
 */

import type { DistanceMetric, DistanceFunction } from './types.js';

// ═══════════════════════════════════════════════════════════════════
// DISTANCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Cosine distance (1 - cosine similarity)
 * Best for normalized embedding vectors
 *
 * @param a First vector
 * @param b Second vector
 * @returns Distance in range [0, 2]
 */
export function cosineDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 1; // Max distance for zero vectors

  const similarity = dotProduct / magnitude;
  // Clamp to [-1, 1] to handle floating point errors
  const clampedSimilarity = Math.max(-1, Math.min(1, similarity));

  return 1 - clampedSimilarity;
}

/**
 * Euclidean distance (L2 norm)
 *
 * @param a First vector
 * @param b Second vector
 * @returns Distance >= 0
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Manhattan distance (L1 norm)
 *
 * @param a First vector
 * @param b Second vector
 * @returns Distance >= 0
 */
export function manhattanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.abs(a[i] - b[i]);
  }

  return sum;
}

/**
 * Get distance function by metric name
 */
export function getDistanceFunction(metric: DistanceMetric): DistanceFunction {
  switch (metric) {
    case 'cosine':
      return cosineDistance;
    case 'euclidean':
      return euclideanDistance;
    case 'manhattan':
      return manhattanDistance;
    default:
      throw new Error(`Unknown distance metric: ${metric}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// SIMILARITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Cosine similarity
 *
 * @param a First vector
 * @param b Second vector
 * @returns Similarity in range [-1, 1]
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  return 1 - cosineDistance(a, b);
}

/**
 * Convert distance to similarity (for normalized distances)
 *
 * @param distance Distance value
 * @param maxDistance Maximum possible distance (default: 2 for cosine)
 * @returns Similarity in range [0, 1]
 */
export function distanceToSimilarity(distance: number, maxDistance = 2): number {
  return Math.max(0, 1 - distance / maxDistance);
}

/**
 * Convert similarity to distance
 *
 * @param similarity Similarity value in [0, 1]
 * @param maxDistance Maximum possible distance (default: 2 for cosine)
 * @returns Distance value
 */
export function similarityToDistance(similarity: number, maxDistance = 2): number {
  return (1 - similarity) * maxDistance;
}

// ═══════════════════════════════════════════════════════════════════
// DISTANCE MATRIX COMPUTATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute pairwise distance matrix
 *
 * @param embeddings Array of embedding vectors
 * @param metric Distance metric to use
 * @returns n x n distance matrix
 */
export function computeDistanceMatrix(
  embeddings: number[][],
  metric: DistanceMetric = 'cosine'
): number[][] {
  const n = embeddings.length;
  const distFn = getDistanceFunction(metric);

  // Initialize all rows first
  const matrix: number[][] = new Array(n);
  for (let i = 0; i < n; i++) {
    matrix[i] = new Array(n).fill(0);
  }

  // Fill in distances
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = distFn(embeddings[i], embeddings[j]);
      matrix[i][j] = dist;
      matrix[j][i] = dist; // Symmetric
    }
  }

  return matrix;
}

/**
 * Compute k-nearest neighbors for each point
 *
 * @param embeddings Array of embedding vectors
 * @param k Number of neighbors
 * @param metric Distance metric
 * @returns Array of {indices, distances} for each point
 */
export function computeKNN(
  embeddings: number[][],
  k: number,
  metric: DistanceMetric = 'cosine'
): Array<{ indices: number[]; distances: number[] }> {
  const n = embeddings.length;
  const distFn = getDistanceFunction(metric);
  const result: Array<{ indices: number[]; distances: number[] }> = new Array(n);

  for (let i = 0; i < n; i++) {
    // Compute distances to all other points
    const distances: Array<{ idx: number; dist: number }> = [];

    for (let j = 0; j < n; j++) {
      if (i !== j) {
        distances.push({
          idx: j,
          dist: distFn(embeddings[i], embeddings[j]),
        });
      }
    }

    // Sort by distance and take top k
    distances.sort((a, b) => a.dist - b.dist);
    const topK = distances.slice(0, k);

    result[i] = {
      indices: topK.map((d) => d.idx),
      distances: topK.map((d) => d.dist),
    };
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════
// CORE DISTANCE (for HDBSCAN)
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute core distances for all points
 *
 * Core distance is the distance to the k-th nearest neighbor,
 * where k = minSamples. This defines the local density.
 *
 * @param embeddings Array of embedding vectors
 * @param minSamples Number of samples for core distance
 * @param metric Distance metric
 * @returns Core distance for each point
 */
export function computeCoreDistances(
  embeddings: number[][],
  minSamples: number,
  metric: DistanceMetric = 'cosine'
): number[] {
  const knn = computeKNN(embeddings, minSamples, metric);
  return knn.map((neighbors) => {
    // Core distance is distance to k-th neighbor (last in sorted list)
    const lastIdx = Math.min(minSamples - 1, neighbors.distances.length - 1);
    return neighbors.distances[lastIdx] ?? Infinity;
  });
}

/**
 * Compute mutual reachability distance
 *
 * MRD(a, b) = max(core_a, core_b, distance(a, b))
 *
 * This ensures dense regions are well-connected while
 * sparse regions maintain separation.
 *
 * @param coreDistances Core distance for each point
 * @param distanceMatrix Pairwise distance matrix
 * @returns Mutual reachability distance matrix
 */
export function computeMutualReachabilityMatrix(
  coreDistances: number[],
  distanceMatrix: number[][]
): number[][] {
  const n = coreDistances.length;

  // Initialize all rows first
  const mrdMatrix: number[][] = new Array(n);
  for (let i = 0; i < n; i++) {
    mrdMatrix[i] = new Array(n).fill(0);
  }

  // Fill in mutual reachability distances
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const mrd = Math.max(
        coreDistances[i],
        coreDistances[j],
        distanceMatrix[i][j]
      );
      mrdMatrix[i][j] = mrd;
      mrdMatrix[j][i] = mrd;
    }
  }

  return mrdMatrix;
}

// ═══════════════════════════════════════════════════════════════════
// CENTROID COMPUTATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute centroid (mean) of embedding vectors
 *
 * @param embeddings Array of embedding vectors
 * @returns Centroid vector
 */
export function computeCentroid(embeddings: number[][]): number[] {
  if (embeddings.length === 0) {
    throw new Error('Cannot compute centroid of empty array');
  }

  const dim = embeddings[0].length;
  const centroid = new Array(dim).fill(0);

  for (const embedding of embeddings) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += embedding[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    centroid[i] /= embeddings.length;
  }

  return centroid;
}

/**
 * Normalize a vector to unit length
 *
 * @param vector Input vector
 * @returns Normalized vector
 */
export function normalizeVector(vector: number[]): number[] {
  let norm = 0;
  for (const v of vector) {
    norm += v * v;
  }
  norm = Math.sqrt(norm);

  if (norm === 0) return vector.slice();

  return vector.map((v) => v / norm);
}
