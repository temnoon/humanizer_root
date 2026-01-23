/**
 * Anchor-Based Refinement
 *
 * Implements the FIND→REFINE→HARVEST pattern for semantic navigation:
 *
 * 1. FIND: Initial hybrid search to get candidates
 * 2. REFINE: Filter and adjust scores using semantic anchors
 * 3. HARVEST: Group results by nearest positive anchor
 *
 * Anchors are reference points in embedding space that guide retrieval:
 * - Positive anchors: "Find content like this"
 * - Negative anchors: "Avoid content like this"
 */

import type {
  FusedResult,
  AnchorSet,
  SemanticAnchor,
  AnchorRefinementOptions,
  AnchorRefinementResult,
} from './types.js';
import {
  cosineSimilarity,
  maxSimilarityToSet,
  avgSimilarityToSet,
} from './negative-filter.js';
import {
  POSITIVE_ANCHOR_WEIGHT,
  NEGATIVE_ANCHOR_WEIGHT,
  NEGATIVE_FILTER_THRESHOLD,
} from './constants.js';

// ═══════════════════════════════════════════════════════════════════
// ANCHOR REFINEMENT
// ═══════════════════════════════════════════════════════════════════

/**
 * Refine search results using semantic anchors
 *
 * @param results - Initial search results
 * @param embeddings - Map of node IDs to their embeddings
 * @param options - Anchor refinement options
 * @returns Refined results grouped by anchor
 */
export function refineByAnchors(
  results: FusedResult[],
  embeddings: Map<string, number[]>,
  options: AnchorRefinementOptions
): AnchorRefinementResult {
  const {
    anchors,
    positiveWeight = POSITIVE_ANCHOR_WEIGHT,
    negativeWeight = NEGATIVE_ANCHOR_WEIGHT,
    minResults = 1,
  } = options;

  if (anchors.positive.length === 0 && anchors.negative.length === 0) {
    // No anchors - return original results
    return {
      results,
      byAnchor: new Map(),
      stats: {
        inputCount: results.length,
        outputCount: results.length,
        removedByNegative: 0,
        averagePositiveSimilarity: 0,
      },
    };
  }

  const positiveEmbeddings = anchors.positive.map((a) => a.embedding);
  const negativeEmbeddings = anchors.negative.map((a) => a.embedding);

  let refined: FusedResult[] = [];
  let removedByNegative = 0;
  const positiveSimSum: number[] = [];

  // Process each result
  for (const result of results) {
    const embedding = embeddings.get(result.node.id);

    if (!embedding) {
      // Keep results without embeddings
      refined.push(result);
      continue;
    }

    // Check negative anchors first (filter)
    if (negativeEmbeddings.length > 0) {
      const { maxSimilarity } = maxSimilarityToSet(embedding, negativeEmbeddings);

      if (maxSimilarity >= NEGATIVE_FILTER_THRESHOLD) {
        removedByNegative++;
        continue;
      }
    }

    // Compute positive anchor similarity (boost)
    let positiveBoost = 0;
    if (positiveEmbeddings.length > 0) {
      const avgPositive = avgSimilarityToSet(embedding, positiveEmbeddings);
      positiveBoost = avgPositive * positiveWeight;
      positiveSimSum.push(avgPositive);
    }

    // Compute negative anchor penalty
    let negativePenalty = 0;
    if (negativeEmbeddings.length > 0) {
      const avgNegative = avgSimilarityToSet(embedding, negativeEmbeddings);
      negativePenalty = avgNegative * negativeWeight;
    }

    // Adjust score
    refined.push({
      ...result,
      fusedScore: result.fusedScore + positiveBoost - negativePenalty,
    });
  }

  // Ensure minimum results
  if (refined.length < minResults && results.length > refined.length) {
    // Add back some filtered results if we're under minimum
    const needed = minResults - refined.length;
    const filtered = results.filter(
      (r) => !refined.some((ref) => ref.node.id === r.node.id)
    );
    refined.push(...filtered.slice(0, needed));
  }

  // Re-sort by adjusted score
  refined.sort((a, b) => b.fusedScore - a.fusedScore);

  // Group by nearest positive anchor (HARVEST step)
  const byAnchor = groupByNearestAnchor(refined, embeddings, anchors.positive);

  // Compute stats
  const avgPositiveSim =
    positiveSimSum.length > 0
      ? positiveSimSum.reduce((a, b) => a + b, 0) / positiveSimSum.length
      : 0;

  return {
    results: refined,
    byAnchor,
    stats: {
      inputCount: results.length,
      outputCount: refined.length,
      removedByNegative,
      averagePositiveSimilarity: avgPositiveSim,
    },
  };
}

/**
 * Group results by their nearest positive anchor
 */
function groupByNearestAnchor(
  results: FusedResult[],
  embeddings: Map<string, number[]>,
  positiveAnchors: SemanticAnchor[]
): Map<string, FusedResult[]> {
  const groups = new Map<string, FusedResult[]>();

  if (positiveAnchors.length === 0) {
    return groups;
  }

  // Initialize groups
  for (const anchor of positiveAnchors) {
    groups.set(anchor.id, []);
  }

  // Assign each result to nearest anchor
  for (const result of results) {
    const embedding = embeddings.get(result.node.id);

    if (!embedding) {
      // Assign to first anchor if no embedding
      const firstAnchor = positiveAnchors[0];
      groups.get(firstAnchor.id)!.push(result);
      continue;
    }

    let nearestAnchor = positiveAnchors[0];
    let nearestSimilarity = -1;

    for (const anchor of positiveAnchors) {
      const similarity = cosineSimilarity(embedding, anchor.embedding);
      if (similarity > nearestSimilarity) {
        nearestSimilarity = similarity;
        nearestAnchor = anchor;
      }
    }

    groups.get(nearestAnchor.id)!.push(result);
  }

  return groups;
}

// ═══════════════════════════════════════════════════════════════════
// ANCHOR UTILITIES
// ═══════════════════════════════════════════════════════════════════

/**
 * Create an anchor from an embedding
 */
export function createAnchor(
  id: string,
  name: string,
  embedding: number[]
): SemanticAnchor {
  return {
    id,
    name,
    embedding,
    createdAt: Date.now(),
  };
}

/**
 * Create an anchor set
 */
export function createAnchorSet(
  positive: SemanticAnchor[] = [],
  negative: SemanticAnchor[] = []
): AnchorSet {
  return { positive, negative };
}

/**
 * Merge two anchor sets
 */
export function mergeAnchorSets(a: AnchorSet, b: AnchorSet): AnchorSet {
  return {
    positive: [...a.positive, ...b.positive],
    negative: [...a.negative, ...b.negative],
  };
}

/**
 * Find results between two anchors (semantic interpolation)
 * Returns results that are similar to both anchors
 */
export function findBetweenAnchors(
  results: FusedResult[],
  embeddings: Map<string, number[]>,
  anchorA: SemanticAnchor,
  anchorB: SemanticAnchor,
  balanceThreshold: number = 0.2
): FusedResult[] {
  return results.filter((result) => {
    const embedding = embeddings.get(result.node.id);
    if (!embedding) return false;

    const simA = cosineSimilarity(embedding, anchorA.embedding);
    const simB = cosineSimilarity(embedding, anchorB.embedding);

    // Check if result is roughly equidistant from both anchors
    const balance = Math.abs(simA - simB);
    return balance <= balanceThreshold;
  });
}

/**
 * Compute centroid of multiple embeddings
 * Useful for creating synthetic anchors
 */
export function computeCentroid(embeddings: number[][]): number[] {
  if (embeddings.length === 0) {
    throw new Error('Cannot compute centroid of empty set');
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
