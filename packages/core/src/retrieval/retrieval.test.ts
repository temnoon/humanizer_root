/**
 * Retrieval Pipeline Tests
 */

import { describe, it, expect } from 'vitest';
import type { StoredNode } from '../storage/types.js';
import type { RankedResult, FusedResult } from './types.js';
import {
  computeRRFScore,
  fuseResults,
  toRankedResults,
  computeOverlapStats,
  normalizeScores,
  cosineSimilarity,
  maxSimilarityToSet,
  avgSimilarityToSet,
  filterWithEmbeddings,
  adjustScoresByEmbeddings,
  IdentityReranker,
  ScoreBasedReranker,
  DiversityReranker,
  createReranker,
  createAnchor,
  createAnchorSet,
  mergeAnchorSets,
  computeCentroid,
  passesQualityGate,
  filterByQuality,
} from './index.js';

// ═══════════════════════════════════════════════════════════════════
// TEST FIXTURES
// ═══════════════════════════════════════════════════════════════════

function createMockNode(id: string, overrides: Partial<StoredNode> = {}): StoredNode {
  return {
    id,
    contentHash: `hash-${id}`,
    uri: `content://test/message/${id}`,
    text: `Test content for ${id}`,
    format: 'text',
    wordCount: 50,
    sourceType: 'test',
    sourceAdapter: 'test',
    hierarchyLevel: 0,
    createdAt: Date.now(),
    importedAt: Date.now(),
    ...overrides,
  };
}

function createMockRankedResult(
  id: string,
  rank: number,
  score: number,
  source: 'dense' | 'sparse'
): RankedResult {
  return {
    node: createMockNode(id),
    rank,
    score,
    source,
  };
}

// ═══════════════════════════════════════════════════════════════════
// RRF TESTS
// ═══════════════════════════════════════════════════════════════════

describe('RRF (Reciprocal Rank Fusion)', () => {
  describe('computeRRFScore', () => {
    it('computes score for dense-only result', () => {
      const score = computeRRFScore(1, undefined, 60, 0.7, 0.3);
      expect(score).toBeCloseTo(0.7 / 61, 5);
    });

    it('computes score for sparse-only result', () => {
      const score = computeRRFScore(undefined, 1, 60, 0.7, 0.3);
      expect(score).toBeCloseTo(0.3 / 61, 5);
    });

    it('computes combined score for result in both', () => {
      const score = computeRRFScore(1, 2, 60, 0.7, 0.3);
      const expected = 0.7 / 61 + 0.3 / 62;
      expect(score).toBeCloseTo(expected, 5);
    });

    it('higher rank gives lower score', () => {
      const rank1 = computeRRFScore(1, undefined);
      const rank10 = computeRRFScore(10, undefined);
      expect(rank1).toBeGreaterThan(rank10);
    });
  });

  describe('fuseResults', () => {
    it('fuses dense and sparse results', () => {
      const denseResults: RankedResult[] = [
        createMockRankedResult('a', 1, 0.9, 'dense'),
        createMockRankedResult('b', 2, 0.8, 'dense'),
      ];
      const sparseResults: RankedResult[] = [
        createMockRankedResult('b', 1, 0.7, 'sparse'),
        createMockRankedResult('c', 2, 0.6, 'sparse'),
      ];

      const fused = fuseResults(denseResults, sparseResults);

      expect(fused.length).toBe(3); // a, b, c
      expect(fused.find((r) => r.node.id === 'b')?.inBoth).toBe(true);
      expect(fused.find((r) => r.node.id === 'a')?.inBoth).toBe(false);
    });

    it('respects limit option', () => {
      const denseResults = Array(10)
        .fill(null)
        .map((_, i) => createMockRankedResult(`d${i}`, i + 1, 1 - i * 0.1, 'dense'));
      const sparseResults = Array(10)
        .fill(null)
        .map((_, i) => createMockRankedResult(`s${i}`, i + 1, 1 - i * 0.1, 'sparse'));

      const fused = fuseResults(denseResults, sparseResults, { limit: 5 });

      expect(fused.length).toBe(5);
    });

    it('preserves original scores and ranks', () => {
      const denseResults = [createMockRankedResult('a', 1, 0.95, 'dense')];
      const sparseResults = [createMockRankedResult('a', 3, 0.75, 'sparse')];

      const fused = fuseResults(denseResults, sparseResults);

      expect(fused[0].denseScore).toBe(0.95);
      expect(fused[0].denseRank).toBe(1);
      expect(fused[0].sparseScore).toBe(0.75);
      expect(fused[0].sparseRank).toBe(3);
    });
  });

  describe('toRankedResults', () => {
    it('converts search results with 1-indexed ranks', () => {
      const results = [
        { node: createMockNode('a'), score: 0.9 },
        { node: createMockNode('b'), score: 0.8 },
      ];

      const ranked = toRankedResults(results, 'dense');

      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].rank).toBe(2);
      expect(ranked[0].source).toBe('dense');
    });
  });

  describe('computeOverlapStats', () => {
    it('computes overlap statistics', () => {
      const denseResults = [
        createMockRankedResult('a', 1, 0.9, 'dense'),
        createMockRankedResult('b', 2, 0.8, 'dense'),
      ];
      const sparseResults = [
        createMockRankedResult('b', 1, 0.7, 'sparse'),
        createMockRankedResult('c', 2, 0.6, 'sparse'),
      ];

      const stats = computeOverlapStats(denseResults, sparseResults);

      expect(stats.overlap).toBe(1); // 'b' in both
      expect(stats.denseOnly).toBe(1); // 'a'
      expect(stats.sparseOnly).toBe(1); // 'c'
      expect(stats.total).toBe(3);
    });
  });

  describe('normalizeScores', () => {
    it('normalizes scores to 0-1 range', () => {
      const results: FusedResult[] = [
        { node: createMockNode('a'), fusedScore: 0.5, inBoth: false },
        { node: createMockNode('b'), fusedScore: 0.3, inBoth: false },
        { node: createMockNode('c'), fusedScore: 0.1, inBoth: false },
      ];

      const normalized = normalizeScores(results);

      expect(normalized[0].fusedScore).toBe(1); // Max
      expect(normalized[2].fusedScore).toBe(0); // Min
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// NEGATIVE FILTERING TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Negative Filtering', () => {
  describe('cosineSimilarity', () => {
    it('returns 1 for identical vectors', () => {
      const vec = [1, 0, 0];
      expect(cosineSimilarity(vec, vec)).toBeCloseTo(1, 5);
    });

    it('returns 0 for orthogonal vectors', () => {
      expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
    });

    it('returns -1 for opposite vectors', () => {
      expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 5);
    });

    it('throws for mismatched dimensions', () => {
      expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow();
    });
  });

  describe('maxSimilarityToSet', () => {
    it('finds maximum similarity', () => {
      const vec = [1, 0, 0];
      const set = [
        [0.9, 0.1, 0],
        [0.5, 0.5, 0],
        [0, 1, 0],
      ];

      const { maxSimilarity, closestIndex } = maxSimilarityToSet(vec, set);

      expect(closestIndex).toBe(0);
      expect(maxSimilarity).toBeGreaterThan(0.9);
    });
  });

  describe('avgSimilarityToSet', () => {
    it('computes average similarity', () => {
      const vec = [1, 0];
      const set = [[1, 0], [0, 1]]; // One identical, one orthogonal

      const avg = avgSimilarityToSet(vec, set);

      expect(avg).toBeCloseTo(0.5, 5);
    });
  });

  describe('filterWithEmbeddings', () => {
    it('excludes results similar to negatives', () => {
      const results: FusedResult[] = [
        { node: createMockNode('a'), fusedScore: 0.9, inBoth: false },
        { node: createMockNode('b'), fusedScore: 0.8, inBoth: false },
      ];

      const embeddings = new Map([
        ['a', [1, 0, 0]],
        ['b', [0, 1, 0]],
      ]);

      const { results: filtered, removedCount } = filterWithEmbeddings(
        results,
        embeddings,
        {
          negativeEmbeddings: [[1, 0, 0]], // Matches 'a'
          threshold: 0.9,
        }
      );

      expect(removedCount).toBe(1);
      expect(filtered.length).toBe(1);
      expect(filtered[0].node.id).toBe('b');
    });
  });

  describe('adjustScoresByEmbeddings', () => {
    it('boosts scores for positive embeddings', () => {
      const results: FusedResult[] = [
        { node: createMockNode('a'), fusedScore: 0.5, inBoth: false },
      ];

      const embeddings = new Map([['a', [1, 0, 0]]]);

      const adjusted = adjustScoresByEmbeddings(
        results,
        embeddings,
        [[1, 0, 0]], // Positive: matches 'a'
        [],
        0.3,
        0.3
      );

      expect(adjusted[0].fusedScore).toBeGreaterThan(0.5);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// RERANKER TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Rerankers', () => {
  describe('IdentityReranker', () => {
    it('returns results unchanged', async () => {
      const reranker = new IdentityReranker();
      const results: FusedResult[] = [
        { node: createMockNode('a'), fusedScore: 0.9, inBoth: false },
        { node: createMockNode('b'), fusedScore: 0.8, inBoth: false },
      ];

      const reranked = await reranker.rerank('query', results);

      expect(reranked).toEqual(results);
    });

    it('applies limit', async () => {
      const reranker = new IdentityReranker();
      const results = Array(10)
        .fill(null)
        .map((_, i) => ({
          node: createMockNode(`n${i}`),
          fusedScore: 1 - i * 0.1,
          inBoth: false,
        }));

      const reranked = await reranker.rerank('query', results, { limit: 5 });

      expect(reranked.length).toBe(5);
    });

    it('applies minScore filter', async () => {
      const reranker = new IdentityReranker();
      const results: FusedResult[] = [
        { node: createMockNode('a'), fusedScore: 0.9, inBoth: false },
        { node: createMockNode('b'), fusedScore: 0.3, inBoth: false },
      ];

      const reranked = await reranker.rerank('query', results, { minScore: 0.5 });

      expect(reranked.length).toBe(1);
      expect(reranked[0].node.id).toBe('a');
    });
  });

  describe('ScoreBasedReranker', () => {
    it('boosts results in both dense and sparse', async () => {
      const reranker = new ScoreBasedReranker({ overlapBoost: 0.1 });
      const results: FusedResult[] = [
        { node: createMockNode('a'), fusedScore: 0.5, inBoth: true },
        { node: createMockNode('b'), fusedScore: 0.5, inBoth: false },
      ];

      const reranked = await reranker.rerank('query', results);

      expect(reranked[0].node.id).toBe('a'); // Boosted for overlap
    });
  });

  describe('DiversityReranker', () => {
    it('diversifies by source type', async () => {
      const reranker = new DiversityReranker({ sourceTypeDiversity: 0.2 });
      const results: FusedResult[] = [
        { node: createMockNode('a', { sourceType: 'chatgpt' }), fusedScore: 0.9, inBoth: false },
        { node: createMockNode('b', { sourceType: 'chatgpt' }), fusedScore: 0.85, inBoth: false },
        { node: createMockNode('c', { sourceType: 'claude' }), fusedScore: 0.8, inBoth: false },
      ];

      const reranked = await reranker.rerank('query', results, { limit: 3 });

      // 'c' should be promoted due to diversity
      const cIndex = reranked.findIndex((r) => r.node.id === 'c');
      expect(cIndex).toBeLessThan(2);
    });
  });

  describe('createReranker', () => {
    it('creates identity reranker by default', () => {
      const reranker = createReranker();
      expect(reranker).toBeInstanceOf(IdentityReranker);
    });

    it('creates specified reranker type', () => {
      expect(createReranker('score')).toBeInstanceOf(ScoreBasedReranker);
      expect(createReranker('diversity')).toBeInstanceOf(DiversityReranker);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// ANCHOR TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Anchor Utilities', () => {
  describe('createAnchor', () => {
    it('creates anchor with correct properties', () => {
      const anchor = createAnchor('id-1', 'Test Anchor', [1, 0, 0]);

      expect(anchor.id).toBe('id-1');
      expect(anchor.name).toBe('Test Anchor');
      expect(anchor.embedding).toEqual([1, 0, 0]);
      expect(anchor.createdAt).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('createAnchorSet', () => {
    it('creates empty anchor set', () => {
      const set = createAnchorSet();
      expect(set.positive).toEqual([]);
      expect(set.negative).toEqual([]);
    });

    it('creates anchor set with provided anchors', () => {
      const pos = [createAnchor('p1', 'Positive', [1, 0])];
      const neg = [createAnchor('n1', 'Negative', [0, 1])];
      const set = createAnchorSet(pos, neg);

      expect(set.positive).toEqual(pos);
      expect(set.negative).toEqual(neg);
    });
  });

  describe('mergeAnchorSets', () => {
    it('merges two anchor sets', () => {
      const set1 = createAnchorSet(
        [createAnchor('p1', 'P1', [1, 0])],
        [createAnchor('n1', 'N1', [0, 1])]
      );
      const set2 = createAnchorSet(
        [createAnchor('p2', 'P2', [0, 1])],
        []
      );

      const merged = mergeAnchorSets(set1, set2);

      expect(merged.positive.length).toBe(2);
      expect(merged.negative.length).toBe(1);
    });
  });

  describe('computeCentroid', () => {
    it('computes centroid of embeddings', () => {
      const embeddings = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];

      const centroid = computeCentroid(embeddings);

      expect(centroid[0]).toBeCloseTo(1 / 3, 5);
      expect(centroid[1]).toBeCloseTo(1 / 3, 5);
      expect(centroid[2]).toBeCloseTo(1 / 3, 5);
    });

    it('throws for empty set', () => {
      expect(() => computeCentroid([])).toThrow();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// QUALITY GATE TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Quality Gate', () => {
  describe('passesQualityGate', () => {
    it('passes nodes with sufficient word count', () => {
      const node = createMockNode('a', { wordCount: 100 });
      expect(passesQualityGate(node)).toBe(true);
    });

    it('fails nodes with low word count', () => {
      const node = createMockNode('a', { wordCount: 10 });
      expect(passesQualityGate(node)).toBe(false);
    });

    it('respects custom options', () => {
      const node = createMockNode('a', { wordCount: 20 });
      expect(passesQualityGate(node, { minWordCount: 15 })).toBe(true);
      expect(passesQualityGate(node, { minWordCount: 25 })).toBe(false);
    });
  });

  describe('filterByQuality', () => {
    it('filters results by quality gate', () => {
      const results: FusedResult[] = [
        { node: createMockNode('a', { wordCount: 100 }), fusedScore: 0.9, inBoth: false },
        { node: createMockNode('b', { wordCount: 10 }), fusedScore: 0.8, inBoth: false },
        { node: createMockNode('c', { wordCount: 50 }), fusedScore: 0.7, inBoth: false },
      ];

      const filtered = filterByQuality(results);

      expect(filtered.length).toBe(2);
      expect(filtered.map((r) => r.node.id)).toContain('a');
      expect(filtered.map((r) => r.node.id)).toContain('c');
    });
  });
});
