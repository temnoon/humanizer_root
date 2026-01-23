/**
 * Negative Semantic Filtering
 *
 * Filters search results by excluding items that are semantically
 * similar to "negative" examples. This is useful for:
 * - Removing off-topic results
 * - Excluding known irrelevant content
 * - Steering retrieval away from unwanted semantic regions
 */

import type { FusedResult, NegativeFilterOptions, NegativeFilterResult } from './types.js';
import { NEGATIVE_FILTER_THRESHOLD } from './constants.js';

// ═══════════════════════════════════════════════════════════════════
// VECTOR MATH
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimensions must match: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);

  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * Compute maximum similarity to any vector in a set
 */
export function maxSimilarityToSet(
  vector: number[],
  set: number[][]
): { maxSimilarity: number; closestIndex: number } {
  let maxSimilarity = -1;
  let closestIndex = -1;

  for (let i = 0; i < set.length; i++) {
    const similarity = cosineSimilarity(vector, set[i]);
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      closestIndex = i;
    }
  }

  return { maxSimilarity, closestIndex };
}

/**
 * Compute average similarity to vectors in a set
 */
export function avgSimilarityToSet(vector: number[], set: number[][]): number {
  if (set.length === 0) return 0;

  let sum = 0;
  for (const v of set) {
    sum += cosineSimilarity(vector, v);
  }

  return sum / set.length;
}

// ═══════════════════════════════════════════════════════════════════
// NEGATIVE FILTERING
// ═══════════════════════════════════════════════════════════════════

/**
 * Filter results by negative embeddings
 *
 * In 'exclude' mode: removes results similar to negative embeddings
 * In 'require_dissimilar' mode: only keeps results dissimilar to negatives
 */
export function filterByNegativeEmbeddings(
  results: FusedResult[],
  options: NegativeFilterOptions
): NegativeFilterResult {
  const { negativeEmbeddings, threshold = NEGATIVE_FILTER_THRESHOLD, mode = 'exclude' } = options;

  if (negativeEmbeddings.length === 0) {
    return { results, removedCount: 0 };
  }

  const filtered: FusedResult[] = [];
  let removedCount = 0;

  for (const result of results) {
    // We need the node's embedding to compare
    // If the node doesn't have an embedding stored, we can't filter it
    // In a real system, we'd get this from the store or compute it
    // For now, we'll assume results without embeddings pass the filter

    // Skip filtering if we don't have the embedding data
    // This is a limitation - in production, we'd fetch embeddings
    const nodeEmbedding = getNodeEmbedding(result);

    if (!nodeEmbedding) {
      // Can't filter without embedding - keep the result
      filtered.push(result);
      continue;
    }

    const { maxSimilarity } = maxSimilarityToSet(nodeEmbedding, negativeEmbeddings);

    if (mode === 'exclude') {
      // Exclude if too similar to any negative
      if (maxSimilarity >= threshold) {
        removedCount++;
      } else {
        filtered.push(result);
      }
    } else {
      // require_dissimilar: only keep if dissimilar to all negatives
      if (maxSimilarity < threshold) {
        filtered.push(result);
      } else {
        removedCount++;
      }
    }
  }

  return { results: filtered, removedCount };
}

/**
 * Get embedding for a node from a fused result
 * This is a placeholder - in production, embeddings would be fetched from storage
 */
function getNodeEmbedding(result: FusedResult): number[] | undefined {
  // The node's embedding would typically be stored or cached
  // For now, we return undefined to indicate embedding is not available inline
  // The caller should handle this case appropriately
  return undefined;
}

/**
 * Filter with provided embeddings lookup
 * Use this when you have a map of node IDs to embeddings
 */
export function filterWithEmbeddings(
  results: FusedResult[],
  embeddings: Map<string, number[]>,
  options: NegativeFilterOptions
): NegativeFilterResult {
  const { negativeEmbeddings, threshold = NEGATIVE_FILTER_THRESHOLD, mode = 'exclude' } = options;

  if (negativeEmbeddings.length === 0) {
    return { results, removedCount: 0 };
  }

  const filtered: FusedResult[] = [];
  let removedCount = 0;

  for (const result of results) {
    const nodeEmbedding = embeddings.get(result.node.id);

    if (!nodeEmbedding) {
      // Keep results without embeddings
      filtered.push(result);
      continue;
    }

    const { maxSimilarity } = maxSimilarityToSet(nodeEmbedding, negativeEmbeddings);

    if (mode === 'exclude') {
      if (maxSimilarity >= threshold) {
        removedCount++;
      } else {
        filtered.push(result);
      }
    } else {
      if (maxSimilarity < threshold) {
        filtered.push(result);
      } else {
        removedCount++;
      }
    }
  }

  return { results: filtered, removedCount };
}

/**
 * Boost or penalize results based on similarity to embeddings
 * Returns results with adjusted scores (non-destructive)
 */
export function adjustScoresByEmbeddings(
  results: FusedResult[],
  embeddings: Map<string, number[]>,
  positiveEmbeddings: number[][] = [],
  negativeEmbeddings: number[][] = [],
  positiveWeight: number = 0.3,
  negativeWeight: number = 0.3
): FusedResult[] {
  if (positiveEmbeddings.length === 0 && negativeEmbeddings.length === 0) {
    return results;
  }

  return results.map((result) => {
    const nodeEmbedding = embeddings.get(result.node.id);

    if (!nodeEmbedding) {
      return result;
    }

    let adjustment = 0;

    if (positiveEmbeddings.length > 0) {
      const posAvg = avgSimilarityToSet(nodeEmbedding, positiveEmbeddings);
      adjustment += posAvg * positiveWeight;
    }

    if (negativeEmbeddings.length > 0) {
      const negAvg = avgSimilarityToSet(nodeEmbedding, negativeEmbeddings);
      adjustment -= negAvg * negativeWeight;
    }

    return {
      ...result,
      fusedScore: result.fusedScore + adjustment,
    };
  }).sort((a, b) => b.fusedScore - a.fusedScore);
}
