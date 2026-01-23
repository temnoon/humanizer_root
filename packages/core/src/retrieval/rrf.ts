/**
 * Reciprocal Rank Fusion (RRF)
 *
 * Combines results from multiple retrieval methods using the RRF algorithm.
 * RRF is robust to score normalization issues and works well for combining
 * heterogeneous retrieval signals (dense + sparse).
 *
 * Formula: RRF(d) = Σ w_i / (k + rank_i)
 *
 * Reference:
 * Cormack, G. V., Clarke, C. L., & Buettcher, S. (2009).
 * "Reciprocal rank fusion outperforms condorcet and individual rank learning methods"
 */

import type { StoredNode } from '../storage/types.js';
import type { RankedResult, FusedResult } from './types.js';
import { RRF_K, DENSE_WEIGHT, SPARSE_WEIGHT } from './constants.js';

// ═══════════════════════════════════════════════════════════════════
// RRF ALGORITHM
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute RRF score for a single result across sources
 */
export function computeRRFScore(
  denseRank: number | undefined,
  sparseRank: number | undefined,
  k: number = RRF_K,
  denseWeight: number = DENSE_WEIGHT,
  sparseWeight: number = SPARSE_WEIGHT
): number {
  let score = 0;

  if (denseRank !== undefined) {
    score += denseWeight / (k + denseRank);
  }

  if (sparseRank !== undefined) {
    score += sparseWeight / (k + sparseRank);
  }

  return score;
}

/**
 * Fuse dense and sparse results using RRF
 */
export function fuseResults(
  denseResults: RankedResult[],
  sparseResults: RankedResult[],
  options: {
    k?: number;
    denseWeight?: number;
    sparseWeight?: number;
    limit?: number;
  } = {}
): FusedResult[] {
  const k = options.k ?? RRF_K;
  const denseWeight = options.denseWeight ?? DENSE_WEIGHT;
  const sparseWeight = options.sparseWeight ?? SPARSE_WEIGHT;
  const limit = options.limit ?? 20;

  // Build maps for quick lookup
  const denseMap = new Map<string, RankedResult>();
  const sparseMap = new Map<string, RankedResult>();

  for (const result of denseResults) {
    denseMap.set(result.node.id, result);
  }

  for (const result of sparseResults) {
    sparseMap.set(result.node.id, result);
  }

  // Collect all unique node IDs
  const allIds = new Set<string>([
    ...denseResults.map((r) => r.node.id),
    ...sparseResults.map((r) => r.node.id),
  ]);

  // Compute fused scores
  const fusedResults: FusedResult[] = [];

  for (const nodeId of allIds) {
    const denseResult = denseMap.get(nodeId);
    const sparseResult = sparseMap.get(nodeId);

    // Use the node from whichever result we have
    const node = denseResult?.node ?? sparseResult!.node;

    const fusedScore = computeRRFScore(
      denseResult?.rank,
      sparseResult?.rank,
      k,
      denseWeight,
      sparseWeight
    );

    fusedResults.push({
      node,
      fusedScore,
      denseScore: denseResult?.score,
      denseRank: denseResult?.rank,
      sparseScore: sparseResult?.score,
      sparseRank: sparseResult?.rank,
      inBoth: denseResult !== undefined && sparseResult !== undefined,
    });
  }

  // Sort by fused score (descending) and limit
  fusedResults.sort((a, b) => b.fusedScore - a.fusedScore);

  return fusedResults.slice(0, limit);
}

/**
 * Convert search results to ranked results with 1-indexed ranks
 */
export function toRankedResults(
  results: Array<{ node: StoredNode; score: number }>,
  source: 'dense' | 'sparse'
): RankedResult[] {
  return results.map((result, index) => ({
    node: result.node,
    rank: index + 1, // 1-indexed rank
    score: result.score,
    source,
  }));
}

/**
 * Compute overlap statistics between two result sets
 */
export function computeOverlapStats(
  denseResults: RankedResult[],
  sparseResults: RankedResult[]
): {
  denseOnly: number;
  sparseOnly: number;
  overlap: number;
  total: number;
} {
  const denseIds = new Set(denseResults.map((r) => r.node.id));
  const sparseIds = new Set(sparseResults.map((r) => r.node.id));

  let overlap = 0;
  let denseOnly = 0;

  for (const id of denseIds) {
    if (sparseIds.has(id)) {
      overlap++;
    } else {
      denseOnly++;
    }
  }

  const sparseOnly = sparseIds.size - overlap;

  return {
    denseOnly,
    sparseOnly,
    overlap,
    total: denseIds.size + sparseOnly,
  };
}

/**
 * Normalize scores to 0-1 range
 * Useful when comparing scores from different sources
 */
export function normalizeScores(results: FusedResult[]): FusedResult[] {
  if (results.length === 0) return results;

  const maxScore = Math.max(...results.map((r) => r.fusedScore));
  const minScore = Math.min(...results.map((r) => r.fusedScore));
  const range = maxScore - minScore;

  if (range === 0) {
    return results.map((r) => ({ ...r, fusedScore: 1 }));
  }

  return results.map((r) => ({
    ...r,
    fusedScore: (r.fusedScore - minScore) / range,
  }));
}
