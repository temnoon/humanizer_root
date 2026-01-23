/**
 * Reranker Interface and Implementations
 *
 * Rerankers refine the order of retrieval results using more sophisticated
 * scoring methods. This module provides:
 * - Reranker interface for pluggable implementations
 * - IdentityReranker (passthrough, useful for testing)
 * - ScoreBasedReranker (simple score threshold filtering)
 *
 * Future implementations could include:
 * - Cross-encoder reranker (BERT-based)
 * - LLM-based reranker
 * - Learning-to-rank reranker
 */

import type { FusedResult, Reranker, RerankerOptions } from './types.js';

// ═══════════════════════════════════════════════════════════════════
// IDENTITY RERANKER (PASSTHROUGH)
// ═══════════════════════════════════════════════════════════════════

/**
 * Identity reranker that returns results unchanged
 * Useful as a default or for testing
 */
export class IdentityReranker implements Reranker {
  async rerank(
    _query: string,
    results: FusedResult[],
    options: RerankerOptions = {}
  ): Promise<FusedResult[]> {
    let output = [...results];

    // Apply score threshold if specified
    if (options.minScore !== undefined) {
      output = output.filter((r) => r.fusedScore >= options.minScore!);
    }

    // Apply limit if specified
    if (options.limit !== undefined) {
      output = output.slice(0, options.limit);
    }

    return output;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SCORE-BASED RERANKER
// ═══════════════════════════════════════════════════════════════════

/**
 * Options for score-based reranking
 */
export interface ScoreRerankerOptions {
  /** Boost factor for results in both dense and sparse */
  overlapBoost?: number;

  /** Penalty for results in only one source */
  singleSourcePenalty?: number;

  /** Boost for higher word counts */
  wordCountBoost?: number;

  /** Target word count for boost */
  targetWordCount?: number;
}

/**
 * Score-based reranker that adjusts scores based on result properties
 */
export class ScoreBasedReranker implements Reranker {
  private readonly options: ScoreRerankerOptions;

  constructor(options: ScoreRerankerOptions = {}) {
    this.options = {
      overlapBoost: options.overlapBoost ?? 0.1,
      singleSourcePenalty: options.singleSourcePenalty ?? 0,
      wordCountBoost: options.wordCountBoost ?? 0.05,
      targetWordCount: options.targetWordCount ?? 300,
    };
  }

  async rerank(
    _query: string,
    results: FusedResult[],
    options: RerankerOptions = {}
  ): Promise<FusedResult[]> {
    // Adjust scores
    let output = results.map((result) => {
      let adjustment = 0;

      // Boost results that appear in both dense and sparse
      if (result.inBoth) {
        adjustment += this.options.overlapBoost!;
      } else {
        adjustment -= this.options.singleSourcePenalty!;
      }

      // Boost based on word count (favor more substantial content)
      const wordCount = result.node.wordCount;
      const targetWords = this.options.targetWordCount!;

      if (wordCount > 0) {
        // Diminishing returns boost for word count
        const wordRatio = Math.min(wordCount / targetWords, 1.5);
        adjustment += this.options.wordCountBoost! * wordRatio;
      }

      return {
        ...result,
        fusedScore: result.fusedScore + adjustment,
      };
    });

    // Re-sort by adjusted score
    output.sort((a, b) => b.fusedScore - a.fusedScore);

    // Apply filters
    if (options.minScore !== undefined) {
      output = output.filter((r) => r.fusedScore >= options.minScore!);
    }

    if (options.limit !== undefined) {
      output = output.slice(0, options.limit);
    }

    return output;
  }
}

// ═══════════════════════════════════════════════════════════════════
// DIVERSITY RERANKER
// ═══════════════════════════════════════════════════════════════════

/**
 * Options for diversity-aware reranking
 */
export interface DiversityRerankerOptions {
  /** Lambda for MMR (0 = pure relevance, 1 = pure diversity) */
  diversityLambda?: number;

  /** Source type diversity weight */
  sourceTypeDiversity?: number;
}

/**
 * Diversity-aware reranker using Maximal Marginal Relevance (MMR)
 * Balances relevance with result diversity
 */
export class DiversityReranker implements Reranker {
  private readonly lambda: number;
  private readonly sourceTypeDiversity: number;

  constructor(options: DiversityRerankerOptions = {}) {
    this.lambda = options.diversityLambda ?? 0.3;
    this.sourceTypeDiversity = options.sourceTypeDiversity ?? 0.1;
  }

  async rerank(
    _query: string,
    results: FusedResult[],
    options: RerankerOptions = {}
  ): Promise<FusedResult[]> {
    if (results.length <= 1) {
      return results;
    }

    const selected: FusedResult[] = [];
    const candidates = [...results];
    const sourceTypeCounts = new Map<string, number>();

    // MMR-style selection
    while (candidates.length > 0 && selected.length < (options.limit ?? results.length)) {
      let bestIndex = 0;
      let bestScore = -Infinity;

      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        const relevance = candidate.fusedScore;

        // Penalize if source type is over-represented
        const sourceType = candidate.node.sourceType;
        const sourceCount = sourceTypeCounts.get(sourceType) ?? 0;
        const diversityPenalty = sourceCount * this.sourceTypeDiversity;

        // MMR score: λ * relevance - (1-λ) * max_similarity + diversity adjustment
        // Simplified: we use source type diversity instead of embedding similarity
        const mmrScore = this.lambda * relevance - diversityPenalty;

        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIndex = i;
        }
      }

      // Select best candidate
      const selected_result = candidates.splice(bestIndex, 1)[0];
      selected.push(selected_result);

      // Update source type count
      const sourceType = selected_result.node.sourceType;
      sourceTypeCounts.set(sourceType, (sourceTypeCounts.get(sourceType) ?? 0) + 1);
    }

    // Apply score threshold
    if (options.minScore !== undefined) {
      return selected.filter((r) => r.fusedScore >= options.minScore!);
    }

    return selected;
  }
}

// ═══════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a reranker by type
 */
export function createReranker(
  type: 'identity' | 'score' | 'diversity' = 'identity',
  options: ScoreRerankerOptions & DiversityRerankerOptions = {}
): Reranker {
  switch (type) {
    case 'score':
      return new ScoreBasedReranker(options);
    case 'diversity':
      return new DiversityReranker(options);
    case 'identity':
    default:
      return new IdentityReranker();
  }
}
