/**
 * Pyramid Service Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PyramidBuilder,
  getPyramidBuilder,
  initPyramidBuilder,
  resetPyramidBuilder,
  MIN_WORDS_FOR_PYRAMID,
  CHUNKS_PER_SUMMARY,
  TARGET_SUMMARY_WORDS,
  TARGET_APEX_WORDS,
  DEFAULT_PYRAMID_CONFIG,
  LEVEL_NAMES,
} from './index.js';
import type { PyramidBuildProgress, Summarizer } from './types.js';

// ═══════════════════════════════════════════════════════════════════
// MOCK SUMMARIZER
// ═══════════════════════════════════════════════════════════════════

/**
 * Simple mock summarizer that truncates text
 */
const mockSummarizer: Summarizer = async (text, targetWords) => {
  const words = text.split(/\s+/);
  const truncated = words.slice(0, targetWords).join(' ');
  return truncated + (words.length > targetWords ? '...' : '');
};

/**
 * Generate long content for testing
 */
function generateLongContent(words: number): string {
  const sentences = [];
  const wordsPerSentence = 15;
  const sentenceCount = Math.ceil(words / wordsPerSentence);

  for (let i = 0; i < sentenceCount; i++) {
    sentences.push(
      `This is sentence number ${i + 1} with some additional words to make it longer and more realistic.`
    );
  }

  return sentences.join(' ');
}

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Pyramid Constants', () => {
  it('has correct default configuration', () => {
    expect(DEFAULT_PYRAMID_CONFIG.minTokensForPyramid).toBe(1000);
    expect(DEFAULT_PYRAMID_CONFIG.chunksPerSummary).toBe(5);
    expect(DEFAULT_PYRAMID_CONFIG.targetSummaryWords).toBe(150);
    expect(DEFAULT_PYRAMID_CONFIG.targetApexWords).toBe(300);
  });

  it('has level names', () => {
    expect(LEVEL_NAMES[0]).toBe('L0 (Base Chunks)');
    expect(LEVEL_NAMES[1]).toBe('L1 (Summaries)');
    expect(LEVEL_NAMES[2]).toBe('Apex (Document)');
  });

  it('MIN_WORDS_FOR_PYRAMID is derived from tokens', () => {
    expect(MIN_WORDS_FOR_PYRAMID).toBeGreaterThan(0);
    expect(MIN_WORDS_FOR_PYRAMID).toBeLessThan(1000); // ~769 words
  });
});

// ═══════════════════════════════════════════════════════════════════
// PYRAMID BUILDER TESTS
// ═══════════════════════════════════════════════════════════════════

describe('PyramidBuilder', () => {
  let builder: PyramidBuilder;

  beforeEach(() => {
    resetPyramidBuilder();
    builder = new PyramidBuilder({
      summarizer: mockSummarizer,
    });
  });

  describe('needsPyramid', () => {
    it('returns false for short content', () => {
      const shortContent = 'This is a short piece of content.';
      expect(builder.needsPyramid(shortContent)).toBe(false);
    });

    it('returns true for long content', () => {
      const longContent = generateLongContent(MIN_WORDS_FOR_PYRAMID + 100);
      expect(builder.needsPyramid(longContent)).toBe(true);
    });

    it('returns false below threshold', () => {
      // Generate well below threshold to account for word counting differences
      const shortContent = generateLongContent(MIN_WORDS_FOR_PYRAMID / 2);
      expect(builder.needsPyramid(shortContent)).toBe(false);
    });
  });

  describe('build', () => {
    it('builds pyramid from short content without summarization', async () => {
      const content = 'This is short content that does not need a pyramid.';

      const result = await builder.build({
        content,
        threadRootId: 'thread-1',
        sourceType: 'test',
      });

      expect(result.pyramid.l0Nodes.length).toBeGreaterThanOrEqual(1);
      expect(result.pyramid.l1Nodes.length).toBe(0);
      expect(result.pyramid.apex).toBeUndefined();
      expect(result.buildStats.usedSummarization).toBe(false);
    });

    it('builds full pyramid from long content', async () => {
      const content = generateLongContent(MIN_WORDS_FOR_PYRAMID + 500);

      const result = await builder.build({
        content,
        threadRootId: 'thread-2',
        sourceType: 'test',
      });

      expect(result.pyramid.l0Nodes.length).toBeGreaterThan(1);
      expect(result.pyramid.l1Nodes.length).toBeGreaterThan(0);
      expect(result.pyramid.apex).toBeDefined();
      expect(result.buildStats.usedSummarization).toBe(true);
    });

    it('sets correct thread root on all nodes', async () => {
      const content = generateLongContent(MIN_WORDS_FOR_PYRAMID + 200);
      const threadId = 'thread-3';

      const result = await builder.build({
        content,
        threadRootId: threadId,
        sourceType: 'test',
      });

      for (const node of result.pyramid.l0Nodes) {
        expect(node.threadRootId).toBe(threadId);
      }

      for (const node of result.pyramid.l1Nodes) {
        expect(node.threadRootId).toBe(threadId);
      }

      if (result.pyramid.apex) {
        expect(result.pyramid.apex.threadRootId).toBe(threadId);
      }
    });

    it('creates parent-child relationships', async () => {
      const content = generateLongContent(MIN_WORDS_FOR_PYRAMID + 500);

      const result = await builder.build({
        content,
        threadRootId: 'thread-4',
        sourceType: 'test',
      });

      // L0 nodes should have parentId pointing to L1
      for (const l0 of result.pyramid.l0Nodes) {
        if (result.pyramid.l1Nodes.length > 0) {
          expect(l0.parentId).toBeDefined();
        }
      }

      // L1 nodes should have childIds
      for (const l1 of result.pyramid.l1Nodes) {
        expect(l1.childIds.length).toBeGreaterThan(0);
      }

      // Apex should have childIds pointing to L1
      if (result.pyramid.apex) {
        expect(result.pyramid.apex.childIds.length).toBe(result.pyramid.l1Nodes.length);
      }
    });

    it('computes statistics correctly', async () => {
      const content = generateLongContent(MIN_WORDS_FOR_PYRAMID + 300);

      const result = await builder.build({
        content,
        threadRootId: 'thread-5',
        sourceType: 'test',
      });

      const stats = result.pyramid.stats;

      expect(stats.nodeCounts[0]).toBe(result.pyramid.l0Nodes.length);
      expect(stats.nodeCounts[1]).toBe(result.pyramid.l1Nodes.length);
      expect(stats.nodeCounts[2]).toBe(result.pyramid.apex ? 1 : 0);

      expect(stats.totalNodes).toBe(
        stats.nodeCounts[0] + stats.nodeCounts[1] + stats.nodeCounts[2]
      );

      expect(stats.totalSourceWords).toBeGreaterThan(0);
    });

    it('extracts themes from apex', async () => {
      const content = generateLongContent(MIN_WORDS_FOR_PYRAMID + 500);

      const result = await builder.build({
        content,
        threadRootId: 'thread-6',
        sourceType: 'test',
      });

      if (result.pyramid.apex) {
        expect(Array.isArray(result.pyramid.apex.themes)).toBe(true);
      }
    });

    it('reports progress callbacks', async () => {
      const progressEvents: PyramidBuildProgress[] = [];

      const builderWithProgress = new PyramidBuilder({
        summarizer: mockSummarizer,
        onProgress: (progress) => progressEvents.push(progress),
      });

      const content = generateLongContent(MIN_WORDS_FOR_PYRAMID + 200);

      await builderWithProgress.build({
        content,
        threadRootId: 'thread-7',
        sourceType: 'test',
      });

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents.some((p) => p.phase === 'chunking')).toBe(true);
      expect(progressEvents.some((p) => p.phase === 'complete')).toBe(true);
    });

    it('tracks build timing', async () => {
      const content = generateLongContent(MIN_WORDS_FOR_PYRAMID + 200);

      const result = await builder.build({
        content,
        threadRootId: 'thread-8',
        sourceType: 'test',
      });

      expect(result.buildStats.chunkingTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.buildStats.totalTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.buildStats.totalTimeMs).toBeGreaterThanOrEqual(
        result.buildStats.chunkingTimeMs
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// SINGLETON TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Singleton Management', () => {
  beforeEach(() => {
    resetPyramidBuilder();
  });

  it('returns same instance from getPyramidBuilder', () => {
    const builder1 = getPyramidBuilder();
    const builder2 = getPyramidBuilder();

    expect(builder1).toBe(builder2);
  });

  it('creates new instance with initPyramidBuilder', () => {
    const builder1 = getPyramidBuilder();
    const builder2 = initPyramidBuilder({ summarizer: mockSummarizer });

    // After init, getPyramidBuilder returns new instance
    const builder3 = getPyramidBuilder();
    expect(builder2).toBe(builder3);
  });

  it('resetPyramidBuilder clears singleton', () => {
    const builder1 = getPyramidBuilder();
    resetPyramidBuilder();
    const builder2 = getPyramidBuilder();

    expect(builder1).not.toBe(builder2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// EDGE CASES
// ═══════════════════════════════════════════════════════════════════

describe('Edge Cases', () => {
  let builder: PyramidBuilder;

  beforeEach(() => {
    builder = new PyramidBuilder({ summarizer: mockSummarizer });
  });

  it('handles empty content', async () => {
    const result = await builder.build({
      content: '',
      threadRootId: 'empty-thread',
      sourceType: 'test',
    });

    expect(result.pyramid.l0Nodes.length).toBe(0);
    expect(result.pyramid.l1Nodes.length).toBe(0);
    expect(result.pyramid.apex).toBeUndefined();
  });

  it('handles whitespace-only content', async () => {
    const result = await builder.build({
      content: '   \n\n   \t\t   ',
      threadRootId: 'whitespace-thread',
      sourceType: 'test',
    });

    expect(result.pyramid.l0Nodes.length).toBe(0);
  });

  it('handles single sentence content', async () => {
    const result = await builder.build({
      content: 'Just one sentence.',
      threadRootId: 'single-thread',
      sourceType: 'test',
    });

    expect(result.pyramid.l0Nodes.length).toBe(1);
    expect(result.pyramid.l0Nodes[0].text).toBe('Just one sentence.');
  });

  it('builds without summarizer (no L1/Apex)', async () => {
    const builderNoSummarizer = new PyramidBuilder();

    const content = generateLongContent(MIN_WORDS_FOR_PYRAMID + 200);

    const result = await builderNoSummarizer.build({
      content,
      threadRootId: 'no-summarizer-thread',
      sourceType: 'test',
    });

    // Should have L0 but no L1 or Apex without summarizer
    expect(result.pyramid.l0Nodes.length).toBeGreaterThan(0);
    expect(result.pyramid.l1Nodes.length).toBe(0);
    expect(result.pyramid.apex).toBeUndefined();
  });
});
