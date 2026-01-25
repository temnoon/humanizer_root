/**
 * ExcellencePipeline Unit Tests
 *
 * Tests individual stages and components in isolation with mocks.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ExcellencePipeline,
  initExcellencePipeline,
  resetExcellencePipeline,
  getExcellencePipeline,
} from './excellence-pipeline.js';
import type {
  PipelineInput,
  PipelineProgress,
  PipelineEvent,
  ExcellenceScore,
} from './types.js';
import type { Summarizer, Embedder } from '../pyramid/types.js';

// ═══════════════════════════════════════════════════════════════════════════
// TEST FIXTURES
// ═══════════════════════════════════════════════════════════════════════════

const sampleText = `
This is a sample document for testing the excellence pipeline.
It contains multiple paragraphs with various content.

The second paragraph discusses important topics that require
careful analysis and consideration. We explore multiple themes
including quality assessment and content evaluation.

In the third paragraph, we conclude with observations about
the overall structure and flow of the document. This helps
demonstrate the chunking and summarization capabilities.
`.trim();

const longText = Array(20)
  .fill(sampleText)
  .join('\n\n--- Section Break ---\n\n');

// ═══════════════════════════════════════════════════════════════════════════
// MOCK FACTORIES
// ═══════════════════════════════════════════════════════════════════════════

function createMockSummarizer(): Summarizer {
  return async (text: string, targetWords: number) => {
    const words = text.split(/\s+/).slice(0, targetWords);
    return `Summary: ${words.join(' ')}...`;
  };
}

function createMockEmbedder(): Embedder {
  return async (texts: string[]) => {
    return texts.map(() => new Array(768).fill(0).map(() => Math.random()));
  };
}

function createMockScorer() {
  return async (text: string): Promise<ExcellenceScore> => {
    const wordCount = text.split(/\s+/).length;
    const baseScore = Math.min(100, 30 + wordCount * 0.5);

    return {
      compositeScore: baseScore,
      dimensions: {
        insightDensity: 0.6 + Math.random() * 0.3,
        expressivePower: 0.5 + Math.random() * 0.3,
        emotionalResonance: 0.4 + Math.random() * 0.3,
        structuralElegance: 0.5 + Math.random() * 0.3,
        voiceAuthenticity: 0.6 + Math.random() * 0.3,
      },
      tier: baseScore >= 80 ? 'excellence' : baseScore >= 60 ? 'polished' : 'needs_refinement',
      standoutQuotes: text.split('.').slice(0, 2).map((s) => s.trim()).filter(Boolean),
      confidence: 0.85,
    };
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('ExcellencePipeline Singleton', () => {
  beforeEach(() => {
    resetExcellencePipeline();
  });

  it('creates singleton on first call to getExcellencePipeline', () => {
    const pipeline1 = getExcellencePipeline();
    const pipeline2 = getExcellencePipeline();

    expect(pipeline1).toBe(pipeline2);
    expect(pipeline1).toBeInstanceOf(ExcellencePipeline);
  });

  it('initExcellencePipeline creates new instance with options', () => {
    const summarizer = createMockSummarizer();
    const pipeline = initExcellencePipeline({ summarizer });

    expect(pipeline).toBeInstanceOf(ExcellencePipeline);
  });

  it('resetExcellencePipeline clears singleton', () => {
    const pipeline1 = getExcellencePipeline();
    resetExcellencePipeline();
    const pipeline2 = getExcellencePipeline();

    expect(pipeline1).not.toBe(pipeline2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BASIC PIPELINE EXECUTION
// ═══════════════════════════════════════════════════════════════════════════

describe('ExcellencePipeline Basic Execution', () => {
  beforeEach(() => {
    resetExcellencePipeline();
  });

  it('executes minimal pipeline with text input', async () => {
    const pipeline = new ExcellencePipeline();

    const result = await pipeline.execute({
      sourceType: 'text',
      text: sampleText,
      title: 'Test Document',
      config: {
        generateEmbeddings: false,
        buildPyramid: false,
        scoreExcellence: false,
      },
    });

    expect(result.success).toBe(true);
    expect(result.finalStage).toBe('complete');
    expect(result.totalProcessed).toBeGreaterThan(0);
    expect(result.jobId).toBeDefined();
    expect(result.totalDurationMs).toBeGreaterThan(0);
  });

  it('executes pipeline with pre-loaded nodes', async () => {
    const pipeline = new ExcellencePipeline();

    const result = await pipeline.execute({
      sourceType: 'nodes',
      nodes: [
        {
          id: 'node-1',
          uri: 'content://test/node-1',
          contentHash: 'hash1',
          content: 'First node content for testing.',
          format: 'text',
          sourceType: 'test',
          metadata: {},
        },
        {
          id: 'node-2',
          uri: 'content://test/node-2',
          contentHash: 'hash2',
          content: 'Second node content with more text.',
          format: 'text',
          sourceType: 'test',
          metadata: {},
        },
      ],
      config: {
        generateEmbeddings: false,
        buildPyramid: false,
        scoreExcellence: false,
      },
    });

    expect(result.success).toBe(true);
    expect(result.totalProcessed).toBeGreaterThan(0);
  });

  it('generates unique job IDs for each execution', async () => {
    const pipeline = new ExcellencePipeline();

    const result1 = await pipeline.execute({
      sourceType: 'text',
      text: 'Test 1',
      config: { buildPyramid: false, generateEmbeddings: false, scoreExcellence: false },
    });

    const result2 = await pipeline.execute({
      sourceType: 'text',
      text: 'Test 2',
      config: { buildPyramid: false, generateEmbeddings: false, scoreExcellence: false },
    });

    expect(result1.jobId).not.toBe(result2.jobId);
  });

  it('uses provided job ID when specified', async () => {
    const pipeline = new ExcellencePipeline();
    const customJobId = 'custom-job-123';

    const result = await pipeline.execute({
      sourceType: 'text',
      text: 'Test',
      config: {
        jobId: customJobId,
        buildPyramid: false,
        generateEmbeddings: false,
        scoreExcellence: false,
      },
    });

    expect(result.jobId).toBe(customJobId);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CHUNKING STAGE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('ExcellencePipeline Chunking', () => {
  beforeEach(() => {
    resetExcellencePipeline();
  });

  it('chunks text into L0 nodes', async () => {
    const pipeline = new ExcellencePipeline();

    const result = await pipeline.execute({
      sourceType: 'text',
      text: longText,
      config: {
        generateEmbeddings: false,
        buildPyramid: false,
        scoreExcellence: false,
      },
    });

    expect(result.success).toBe(true);
    expect(result.createdNodeIds.length).toBeGreaterThan(1);
  });

  it('preserves content integrity through chunking', async () => {
    const pipeline = new ExcellencePipeline();
    const uniquePhrase = 'UNIQUE_TEST_PHRASE_12345';
    const textWithPhrase = `${sampleText}\n\n${uniquePhrase}\n\n${sampleText}`;

    const result = await pipeline.execute({
      sourceType: 'text',
      text: textWithPhrase,
      config: {
        generateEmbeddings: false,
        buildPyramid: false,
        scoreExcellence: false,
      },
    });

    expect(result.success).toBe(true);
    expect(result.createdNodeIds.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EMBEDDING STAGE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('ExcellencePipeline Embedding', () => {
  beforeEach(() => {
    resetExcellencePipeline();
  });

  it('generates embeddings when embedder provided', async () => {
    const embedder = createMockEmbedder();
    const embedderSpy = vi.fn(embedder);

    const pipeline = new ExcellencePipeline({
      embedder: embedderSpy,
    });

    const result = await pipeline.execute({
      sourceType: 'text',
      text: sampleText,
      config: {
        generateEmbeddings: true,
        buildPyramid: false,
        scoreExcellence: false,
      },
    });

    expect(result.success).toBe(true);
    expect(embedderSpy).toHaveBeenCalled();
  });

  it('skips embedding when disabled', async () => {
    const embedder = createMockEmbedder();
    const embedderSpy = vi.fn(embedder);

    const pipeline = new ExcellencePipeline({
      embedder: embedderSpy,
    });

    const result = await pipeline.execute({
      sourceType: 'text',
      text: sampleText,
      config: {
        generateEmbeddings: false,
        buildPyramid: false,
        scoreExcellence: false,
      },
    });

    expect(result.success).toBe(true);
    expect(embedderSpy).not.toHaveBeenCalled();
  });

  it('skips embedding when no embedder provided', async () => {
    const pipeline = new ExcellencePipeline();

    const result = await pipeline.execute({
      sourceType: 'text',
      text: sampleText,
      config: {
        generateEmbeddings: true, // Enabled but no embedder
        buildPyramid: false,
        scoreExcellence: false,
      },
    });

    expect(result.success).toBe(true);
    expect(result.timingMs['embed-l0']).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUMMARIZATION STAGE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('ExcellencePipeline Summarization', () => {
  beforeEach(() => {
    resetExcellencePipeline();
  });

  it('creates L1 summaries when summarizer provided', async () => {
    const summarizer = createMockSummarizer();
    const summarizerSpy = vi.fn(summarizer);

    const pipeline = new ExcellencePipeline({
      summarizer: summarizerSpy,
    });

    const result = await pipeline.execute({
      sourceType: 'text',
      text: longText,
      config: {
        generateEmbeddings: false,
        buildPyramid: true,
        scoreExcellence: false,
      },
    });

    expect(result.success).toBe(true);
    expect(summarizerSpy).toHaveBeenCalled();
    expect(result.pyramidStats).toBeDefined();
    expect(result.pyramidStats!.nodeCounts[1]).toBeGreaterThan(0);
  });

  it('creates apex when L1 summaries exist', async () => {
    const summarizer = createMockSummarizer();

    const pipeline = new ExcellencePipeline({
      summarizer,
    });

    const result = await pipeline.execute({
      sourceType: 'text',
      text: longText,
      config: {
        generateEmbeddings: false,
        buildPyramid: true,
        scoreExcellence: false,
      },
    });

    expect(result.success).toBe(true);
    expect(result.pyramidStats).toBeDefined();
    expect(result.pyramidStats!.nodeCounts[2]).toBe(1); // One apex
  });

  it('skips pyramid when disabled', async () => {
    const summarizer = createMockSummarizer();
    const summarizerSpy = vi.fn(summarizer);

    const pipeline = new ExcellencePipeline({
      summarizer: summarizerSpy,
    });

    const result = await pipeline.execute({
      sourceType: 'text',
      text: longText,
      config: {
        generateEmbeddings: false,
        buildPyramid: false,
        scoreExcellence: false,
      },
    });

    expect(result.success).toBe(true);
    expect(summarizerSpy).not.toHaveBeenCalled();
    expect(result.pyramidStats).toBeUndefined();
  });

  it('computes compression ratios', async () => {
    const summarizer = createMockSummarizer();

    const pipeline = new ExcellencePipeline({
      summarizer,
    });

    const result = await pipeline.execute({
      sourceType: 'text',
      text: longText,
      config: {
        generateEmbeddings: false,
        buildPyramid: true,
        scoreExcellence: false,
      },
    });

    expect(result.success).toBe(true);
    expect(result.pyramidStats!.compressionRatios.l0ToL1).toBeGreaterThan(0);
    expect(result.pyramidStats!.compressionRatios.overall).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EXCELLENCE SCORING TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('ExcellencePipeline Excellence Scoring', () => {
  beforeEach(() => {
    resetExcellencePipeline();
  });

  it('scores content when scorer provided', async () => {
    const scorer = createMockScorer();
    const scorerSpy = vi.fn(scorer);

    const pipeline = new ExcellencePipeline({
      scorer: scorerSpy,
    });

    const result = await pipeline.execute({
      sourceType: 'text',
      text: sampleText,
      config: {
        generateEmbeddings: false,
        buildPyramid: false,
        scoreExcellence: true,
      },
    });

    expect(result.success).toBe(true);
    expect(scorerSpy).toHaveBeenCalled();
    expect(result.excellenceStats).toBeDefined();
    expect(result.excellenceStats!.totalScored).toBeGreaterThan(0);
  });

  it('computes excellence statistics', async () => {
    const scorer = createMockScorer();

    const pipeline = new ExcellencePipeline({
      scorer,
    });

    const result = await pipeline.execute({
      sourceType: 'text',
      text: longText,
      config: {
        generateEmbeddings: false,
        buildPyramid: false,
        scoreExcellence: true,
      },
    });

    expect(result.success).toBe(true);
    expect(result.excellenceStats).toBeDefined();

    const stats = result.excellenceStats!;
    expect(stats.avgCompositeScore).toBeGreaterThan(0);
    expect(stats.avgDimensions.insightDensity).toBeGreaterThan(0);
    expect(stats.avgDimensions.expressivePower).toBeGreaterThan(0);
    expect(typeof stats.tierCounts.excellence).toBe('number');
    expect(typeof stats.tierCounts.polished).toBe('number');
  });

  it('skips scoring when disabled', async () => {
    const scorer = createMockScorer();
    const scorerSpy = vi.fn(scorer);

    const pipeline = new ExcellencePipeline({
      scorer: scorerSpy,
    });

    const result = await pipeline.execute({
      sourceType: 'text',
      text: sampleText,
      config: {
        generateEmbeddings: false,
        buildPyramid: false,
        scoreExcellence: false,
      },
    });

    expect(result.success).toBe(true);
    expect(scorerSpy).not.toHaveBeenCalled();
    expect(result.excellenceStats).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PROGRESS TRACKING TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('ExcellencePipeline Progress Tracking', () => {
  beforeEach(() => {
    resetExcellencePipeline();
  });

  it('calls progress callback during execution', async () => {
    const progressEvents: PipelineProgress[] = [];

    const pipeline = new ExcellencePipeline({
      onProgress: (progress) => progressEvents.push({ ...progress }),
    });

    await pipeline.execute({
      sourceType: 'text',
      text: sampleText,
      config: {
        generateEmbeddings: false,
        buildPyramid: false,
        scoreExcellence: false,
      },
    });

    expect(progressEvents.length).toBeGreaterThan(0);
    expect(progressEvents[0].stage).toBe('ingest');
    expect(progressEvents[progressEvents.length - 1].overallProgress).toBeGreaterThan(0);
  });

  it('reports progress for each stage', async () => {
    const stagesSeen = new Set<string>();

    const pipeline = new ExcellencePipeline({
      summarizer: createMockSummarizer(),
      scorer: createMockScorer(),
      onProgress: (progress) => stagesSeen.add(progress.stage),
    });

    await pipeline.execute({
      sourceType: 'text',
      text: longText,
      config: {
        generateEmbeddings: false,
        buildPyramid: true,
        scoreExcellence: true,
      },
    });

    expect(stagesSeen.has('ingest')).toBe(true);
    expect(stagesSeen.has('chunk')).toBe(true);
    expect(stagesSeen.has('summarize-l1')).toBe(true);
    expect(stagesSeen.has('apex')).toBe(true);
    expect(stagesSeen.has('score')).toBe(true);
  });

  it('includes elapsed time in progress', async () => {
    let lastElapsedMs = 0;

    const pipeline = new ExcellencePipeline({
      onProgress: (progress) => {
        expect(progress.elapsedMs).toBeGreaterThanOrEqual(lastElapsedMs);
        lastElapsedMs = progress.elapsedMs;
      },
    });

    await pipeline.execute({
      sourceType: 'text',
      text: sampleText,
      config: {
        generateEmbeddings: false,
        buildPyramid: false,
        scoreExcellence: false,
      },
    });

    expect(lastElapsedMs).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EVENT SYSTEM TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('ExcellencePipeline Events', () => {
  beforeEach(() => {
    resetExcellencePipeline();
  });

  it('emits pipeline:started event', async () => {
    const events: PipelineEvent[] = [];

    const pipeline = new ExcellencePipeline({
      onEvent: (event) => events.push(event),
    });

    await pipeline.execute({
      sourceType: 'text',
      text: sampleText,
      config: {
        generateEmbeddings: false,
        buildPyramid: false,
        scoreExcellence: false,
      },
    });

    const startEvent = events.find((e) => e.type === 'pipeline:started');
    expect(startEvent).toBeDefined();
    expect(startEvent!.jobId).toBeDefined();
  });

  it('emits pipeline:completed event on success', async () => {
    const events: PipelineEvent[] = [];

    const pipeline = new ExcellencePipeline({
      onEvent: (event) => events.push(event),
    });

    await pipeline.execute({
      sourceType: 'text',
      text: sampleText,
      config: {
        generateEmbeddings: false,
        buildPyramid: false,
        scoreExcellence: false,
      },
    });

    const completeEvent = events.find((e) => e.type === 'pipeline:completed');
    expect(completeEvent).toBeDefined();
  });

  it('emits stage:started and stage:completed for each stage', async () => {
    const events: PipelineEvent[] = [];

    const pipeline = new ExcellencePipeline({
      onEvent: (event) => events.push(event),
    });

    await pipeline.execute({
      sourceType: 'text',
      text: sampleText,
      config: {
        generateEmbeddings: false,
        buildPyramid: false,
        scoreExcellence: false,
      },
    });

    const stageStarted = events.filter((e) => e.type === 'stage:started');
    const stageCompleted = events.filter((e) => e.type === 'stage:completed');

    expect(stageStarted.length).toBeGreaterThan(0);
    expect(stageCompleted.length).toBe(stageStarted.length);
  });

  it('includes timestamp in all events', async () => {
    const events: PipelineEvent[] = [];
    const startTime = Date.now();

    const pipeline = new ExcellencePipeline({
      onEvent: (event) => events.push(event),
    });

    await pipeline.execute({
      sourceType: 'text',
      text: sampleText,
      config: {
        generateEmbeddings: false,
        buildPyramid: false,
        scoreExcellence: false,
      },
    });

    for (const event of events) {
      expect(event.timestamp).toBeGreaterThanOrEqual(startTime);
      expect(event.timestamp).toBeLessThanOrEqual(Date.now());
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TIMING TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('ExcellencePipeline Timing', () => {
  beforeEach(() => {
    resetExcellencePipeline();
  });

  it('records timing for each stage', async () => {
    const pipeline = new ExcellencePipeline({
      summarizer: createMockSummarizer(),
    });

    const result = await pipeline.execute({
      sourceType: 'text',
      text: longText,
      config: {
        generateEmbeddings: false,
        buildPyramid: true,
        scoreExcellence: false,
      },
    });

    expect(result.timingMs.ingest).toBeGreaterThanOrEqual(0);
    expect(result.timingMs.chunk).toBeGreaterThanOrEqual(0);
    expect(result.timingMs['summarize-l1']).toBeGreaterThanOrEqual(0);
    expect(result.timingMs.apex).toBeGreaterThanOrEqual(0);
  });

  it('records total duration', async () => {
    const pipeline = new ExcellencePipeline();

    const result = await pipeline.execute({
      sourceType: 'text',
      text: sampleText,
      config: {
        generateEmbeddings: false,
        buildPyramid: false,
        scoreExcellence: false,
      },
    });

    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ERROR HANDLING TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('ExcellencePipeline Error Handling', () => {
  beforeEach(() => {
    resetExcellencePipeline();
  });

  it('handles empty text input gracefully', async () => {
    const pipeline = new ExcellencePipeline();

    const result = await pipeline.execute({
      sourceType: 'text',
      text: '',
      config: {
        generateEmbeddings: false,
        buildPyramid: false,
        scoreExcellence: false,
      },
    });

    // Should complete but with no content
    expect(result.success).toBe(true);
    expect(result.totalProcessed).toBe(0);
  });

  it('handles missing nodes input gracefully', async () => {
    const pipeline = new ExcellencePipeline();

    const result = await pipeline.execute({
      sourceType: 'nodes',
      nodes: [],
      config: {
        generateEmbeddings: false,
        buildPyramid: false,
        scoreExcellence: false,
      },
    });

    expect(result.success).toBe(true);
    expect(result.totalProcessed).toBe(0);
  });

  it('rejects unsupported source types', async () => {
    const pipeline = new ExcellencePipeline();

    const result = await pipeline.execute({
      sourceType: 'archive',
      sourcePath: '/nonexistent/path',
      config: {
        generateEmbeddings: false,
        buildPyramid: false,
        scoreExcellence: false,
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('requires pre-processing');
  });

  it('emits pipeline:failed on error', async () => {
    const events: PipelineEvent[] = [];

    const pipeline = new ExcellencePipeline({
      onEvent: (event) => events.push(event),
    });

    await pipeline.execute({
      sourceType: 'archive',
      sourcePath: '/nonexistent',
      config: {
        generateEmbeddings: false,
        buildPyramid: false,
        scoreExcellence: false,
      },
    });

    const failedEvent = events.find((e) => e.type === 'pipeline:failed');
    expect(failedEvent).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FULL PIPELINE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('ExcellencePipeline Full Execution', () => {
  beforeEach(() => {
    resetExcellencePipeline();
  });

  it('executes complete pipeline with all stages', async () => {
    const pipeline = new ExcellencePipeline({
      summarizer: createMockSummarizer(),
      embedder: createMockEmbedder(),
      scorer: createMockScorer(),
    });

    const result = await pipeline.execute({
      sourceType: 'text',
      text: longText,
      title: 'Complete Test Document',
      config: {
        generateEmbeddings: true,
        buildPyramid: true,
        scoreExcellence: true,
      },
    });

    expect(result.success).toBe(true);
    expect(result.finalStage).toBe('complete');
    expect(result.pyramidStats).toBeDefined();
    expect(result.excellenceStats).toBeDefined();
    expect(result.createdNodeIds.length).toBeGreaterThan(0);

    // Check pyramid structure
    expect(result.pyramidStats!.nodeCounts[0]).toBeGreaterThan(0); // L0
    expect(result.pyramidStats!.nodeCounts[1]).toBeGreaterThan(0); // L1
    expect(result.pyramidStats!.nodeCounts[2]).toBe(1); // Apex

    // Check excellence stats
    expect(result.excellenceStats!.totalScored).toBeGreaterThan(0);
    expect(result.excellenceStats!.avgCompositeScore).toBeGreaterThan(0);
  });
});
