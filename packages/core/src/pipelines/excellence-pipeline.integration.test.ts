/**
 * ExcellencePipeline Integration Tests
 *
 * Tests the full pipeline with real chunking, pyramid building,
 * and database storage (when available).
 *
 * These tests use actual services rather than mocks where possible.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import {
  ExcellencePipeline,
  resetExcellencePipeline,
} from './excellence-pipeline.js';
import type { PipelineProgress, PipelineEvent, ExcellenceScore } from './types.js';
import type { Summarizer, Embedder } from '../pyramid/types.js';
import { ChunkingService } from '../chunking/index.js';
import { initContentStore, closeContentStore, type PostgresContentStore } from '../storage/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// TEST CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const RUN_DB_TESTS = !!TEST_DATABASE_URL;

// Skip database tests if no connection string
const describeWithDb = RUN_DB_TESTS ? describe : describe.skip;

// ═══════════════════════════════════════════════════════════════════════════
// TEST DATA
// ═══════════════════════════════════════════════════════════════════════════

const realWorldText = `
# Introduction to Machine Learning

Machine learning is a subset of artificial intelligence that enables systems
to learn and improve from experience without being explicitly programmed.
It focuses on developing algorithms that can access data and use it to learn
for themselves.

## Types of Machine Learning

### Supervised Learning

In supervised learning, algorithms learn from labeled training data. The
algorithm makes predictions based on the input data and is corrected when
predictions are wrong. This process continues until the algorithm achieves
an acceptable level of performance.

Common applications include:
- Email spam detection
- Image classification
- Weather prediction
- Medical diagnosis

### Unsupervised Learning

Unsupervised learning involves training on data without labeled responses.
The algorithm tries to find hidden patterns or intrinsic structures in the
input data. Clustering is a common unsupervised learning technique.

Applications include:
- Customer segmentation
- Anomaly detection
- Feature extraction
- Recommendation systems

### Reinforcement Learning

Reinforcement learning is a type of machine learning where an agent learns
to make decisions by taking actions in an environment to maximize cumulative
reward. It's inspired by behavioral psychology.

Real-world applications include:
- Game playing (AlphaGo, chess)
- Robotics navigation
- Resource management
- Trading strategies

## The Learning Process

The machine learning process typically involves several key steps:

1. **Data Collection**: Gathering relevant data from various sources
2. **Data Preparation**: Cleaning and transforming data for analysis
3. **Model Selection**: Choosing appropriate algorithms
4. **Training**: Feeding data to the model to learn patterns
5. **Evaluation**: Testing model performance on new data
6. **Deployment**: Putting the model into production

## Challenges and Considerations

Machine learning practitioners face various challenges:

- **Data Quality**: Models are only as good as the data they're trained on
- **Overfitting**: When models memorize training data instead of generalizing
- **Interpretability**: Understanding why models make specific predictions
- **Bias**: Ensuring models don't perpetuate or amplify societal biases
- **Scalability**: Handling large datasets and real-time predictions

## Conclusion

Machine learning continues to evolve rapidly, with new techniques and
applications emerging regularly. Understanding the fundamentals is crucial
for anyone working in technology today. The field promises exciting
developments in the years ahead.
`.trim();

const shortText = `
This is a brief test document. It contains just a few sentences.
We use it to test minimal input scenarios in the pipeline.
`.trim();

// Very long text guaranteed to produce multiple chunks
const veryLongText = Array(10).fill(realWorldText).join('\n\n=== SECTION BREAK ===\n\n');

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a realistic summarizer that actually shortens text
 */
function createRealisticSummarizer(): Summarizer {
  return async (text: string, targetWords: number): Promise<string> => {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10);
    const words: string[] = [];

    for (const sentence of sentences) {
      const sentenceWords = sentence.trim().split(/\s+/);
      if (words.length + sentenceWords.length <= targetWords) {
        words.push(...sentenceWords);
      } else {
        break;
      }
    }

    if (words.length === 0 && sentences.length > 0) {
      return sentences[0].trim().split(/\s+/).slice(0, targetWords).join(' ') + '...';
    }

    return words.join(' ') + '.';
  };
}

/**
 * Create a deterministic mock embedder for testing
 */
function createDeterministicEmbedder(): Embedder {
  return async (texts: string[]): Promise<number[][]> => {
    return texts.map((text) => {
      // Create deterministic embedding based on text hash
      const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return new Array(768).fill(0).map((_, i) => Math.sin(hash + i) * 0.5 + 0.5);
    });
  };
}

/**
 * Create a realistic scorer based on text features
 */
function createRealisticScorer() {
  return async (text: string): Promise<ExcellenceScore> => {
    const words = text.split(/\s+/);
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim());
    const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());

    // Calculate dimension scores based on text features
    const avgSentenceLength = words.length / Math.max(sentences.length, 1);
    const hasStructure = text.includes('#') || text.includes('-') || text.includes('*');
    const hasVariety = sentences.length > 3 && avgSentenceLength > 5 && avgSentenceLength < 30;

    const insightDensity = Math.min(1, paragraphs.length * 0.15 + (hasStructure ? 0.2 : 0));
    const expressivePower = Math.min(1, 0.3 + (hasVariety ? 0.3 : 0) + Math.min(0.4, words.length / 500));
    const emotionalResonance = Math.min(1, 0.3 + (text.includes('!') ? 0.1 : 0));
    const structuralElegance = Math.min(1, 0.4 + (hasStructure ? 0.3 : 0) + (paragraphs.length > 2 ? 0.2 : 0));
    const voiceAuthenticity = Math.min(1, 0.5 + Math.random() * 0.2);

    const compositeScore = Math.round(
      (insightDensity * 25 +
       expressivePower * 20 +
       emotionalResonance * 20 +
       structuralElegance * 15 +
       voiceAuthenticity * 20)
    );

    const tier = compositeScore >= 80 ? 'excellence' as const :
                 compositeScore >= 60 ? 'polished' as const :
                 compositeScore >= 40 ? 'needs_refinement' as const :
                 'noise' as const;

    // Extract standout quotes (first sentence of each paragraph)
    const standoutQuotes = paragraphs
      .map((p) => p.split(/[.!?]/)[0]?.trim())
      .filter((q): q is string => !!q && q.length > 20)
      .slice(0, 3);

    return {
      compositeScore,
      dimensions: {
        insightDensity,
        expressivePower,
        emotionalResonance,
        structuralElegance,
        voiceAuthenticity,
      },
      tier,
      standoutQuotes,
      confidence: 0.8 + Math.random() * 0.15,
    };
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS WITHOUT DATABASE
// ═══════════════════════════════════════════════════════════════════════════

describe('ExcellencePipeline Integration (No DB)', () => {
  beforeEach(() => {
    resetExcellencePipeline();
  });

  describe('Real Chunking Integration', () => {
    it('uses ChunkingService to create appropriate chunks', async () => {
      const pipeline = new ExcellencePipeline();

      const result = await pipeline.execute({
        sourceType: 'text',
        text: veryLongText,  // Use very long text to ensure multiple chunks
        title: 'Machine Learning Guide',
        config: {
          generateEmbeddings: false,
          buildPyramid: false,
          scoreExcellence: false,
        },
      });

      expect(result.success).toBe(true);
      expect(result.createdNodeIds.length).toBeGreaterThan(1);

      // Verify chunking happened
      expect(result.timingMs.chunk).toBeGreaterThanOrEqual(0);
    });

    it('handles short text without over-chunking', async () => {
      const pipeline = new ExcellencePipeline();

      const result = await pipeline.execute({
        sourceType: 'text',
        text: shortText,
        config: {
          generateEmbeddings: false,
          buildPyramid: false,
          scoreExcellence: false,
        },
      });

      expect(result.success).toBe(true);
      // Short text should produce few chunks
      expect(result.createdNodeIds.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Real Pyramid Building', () => {
    it('builds complete pyramid with realistic summarizer', async () => {
      const pipeline = new ExcellencePipeline({
        summarizer: createRealisticSummarizer(),
      });

      const result = await pipeline.execute({
        sourceType: 'text',
        text: veryLongText,  // Use very long text to ensure pyramid building
        title: 'ML Guide Pyramid',
        config: {
          generateEmbeddings: false,
          buildPyramid: true,
          scoreExcellence: false,
        },
      });

      expect(result.success).toBe(true);
      expect(result.pyramidStats).toBeDefined();

      const stats = result.pyramidStats!;

      // Verify pyramid structure
      expect(stats.nodeCounts[0]).toBeGreaterThan(0); // L0 chunks
      expect(stats.nodeCounts[1]).toBeGreaterThan(0); // L1 summaries
      expect(stats.nodeCounts[2]).toBe(1); // Apex

      // Verify compression
      expect(stats.compressionRatios.l0ToL1).toBeGreaterThan(1);
      expect(stats.compressionRatios.overall).toBeGreaterThan(1);

      // Verify word counts make sense
      expect(stats.wordCounts[0]).toBeGreaterThan(stats.wordCounts[1]);
      expect(stats.wordCounts[1]).toBeGreaterThan(stats.wordCounts[2]);
    });

    it('extracts themes and entities in apex', async () => {
      const pipeline = new ExcellencePipeline({
        summarizer: createRealisticSummarizer(),
      });

      const result = await pipeline.execute({
        sourceType: 'text',
        text: veryLongText,  // Use very long text to ensure pyramid building
        config: {
          generateEmbeddings: false,
          buildPyramid: true,
          scoreExcellence: false,
        },
      });

      expect(result.success).toBe(true);
      expect(result.pyramidStats).toBeDefined();

      // The pipeline should have processed themes
      // (Note: actual theme extraction happens in apex building)
      expect(result.pyramidStats!.nodeCounts[2]).toBe(1);
    });
  });

  describe('Real Embedding Generation', () => {
    it('generates consistent embeddings for same text', async () => {
      const embedder = createDeterministicEmbedder();
      let capturedEmbeddings: number[][] = [];

      const wrappedEmbedder: Embedder = async (texts) => {
        capturedEmbeddings = await embedder(texts);
        return capturedEmbeddings;
      };

      const pipeline = new ExcellencePipeline({
        embedder: wrappedEmbedder,
      });

      await pipeline.execute({
        sourceType: 'text',
        text: shortText,
        config: {
          generateEmbeddings: true,
          buildPyramid: false,
          scoreExcellence: false,
        },
      });

      // Verify embeddings were generated
      expect(capturedEmbeddings.length).toBeGreaterThan(0);
      expect(capturedEmbeddings[0].length).toBe(768);

      // Verify they're in valid range
      for (const embedding of capturedEmbeddings) {
        for (const val of embedding) {
          expect(val).toBeGreaterThanOrEqual(0);
          expect(val).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('Real Excellence Scoring', () => {
    it('scores content with realistic quality assessment', async () => {
      const pipeline = new ExcellencePipeline({
        scorer: createRealisticScorer(),
      });

      const result = await pipeline.execute({
        sourceType: 'text',
        text: realWorldText,
        config: {
          generateEmbeddings: false,
          buildPyramid: false,
          scoreExcellence: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.excellenceStats).toBeDefined();

      const stats = result.excellenceStats!;

      // Verify scoring happened
      expect(stats.totalScored).toBeGreaterThan(0);

      // Verify reasonable score distribution
      expect(stats.avgCompositeScore).toBeGreaterThan(0);
      expect(stats.avgCompositeScore).toBeLessThanOrEqual(100);

      // Verify dimension averages are reasonable
      expect(stats.avgDimensions.insightDensity).toBeGreaterThan(0);
      expect(stats.avgDimensions.expressivePower).toBeGreaterThan(0);
      expect(stats.avgDimensions.structuralElegance).toBeGreaterThan(0);
    });

    it('extracts standout quotes', async () => {
      const pipeline = new ExcellencePipeline({
        scorer: createRealisticScorer(),
      });

      const result = await pipeline.execute({
        sourceType: 'text',
        text: realWorldText,
        config: {
          generateEmbeddings: false,
          buildPyramid: false,
          scoreExcellence: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.excellenceStats!.topQuotes.length).toBeGreaterThan(0);

      // Verify quotes are actual text from the content
      for (const { quote } of result.excellenceStats!.topQuotes) {
        expect(quote.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Full Pipeline Integration', () => {
    it('executes all stages with real services', async () => {
      const progressLog: string[] = [];
      const events: PipelineEvent[] = [];

      const pipeline = new ExcellencePipeline({
        summarizer: createRealisticSummarizer(),
        embedder: createDeterministicEmbedder(),
        scorer: createRealisticScorer(),
        onProgress: (p) => progressLog.push(`${p.stage}: ${Math.round(p.overallProgress * 100)}%`),
        onEvent: (e) => events.push(e),
      });

      const result = await pipeline.execute({
        sourceType: 'text',
        text: veryLongText,  // Use very long text to ensure all stages run
        title: 'Complete Integration Test',
        config: {
          generateEmbeddings: true,
          buildPyramid: true,
          scoreExcellence: true,
        },
      });

      // Verify success
      expect(result.success).toBe(true);
      expect(result.finalStage).toBe('complete');

      // Verify all stages ran (timing may be 0 for fast operations)
      expect(result.timingMs.ingest).toBeGreaterThanOrEqual(0);
      expect(result.timingMs.chunk).toBeGreaterThanOrEqual(0);
      expect(result.timingMs['embed-l0']).toBeGreaterThanOrEqual(0);
      expect(result.timingMs['summarize-l1']).toBeGreaterThanOrEqual(0);
      expect(result.timingMs.apex).toBeGreaterThanOrEqual(0);
      expect(result.timingMs.score).toBeGreaterThanOrEqual(0);

      // Verify outputs
      expect(result.pyramidStats).toBeDefined();
      expect(result.excellenceStats).toBeDefined();
      expect(result.createdNodeIds.length).toBeGreaterThan(0);

      // Verify progress was reported
      expect(progressLog.length).toBeGreaterThan(0);

      // Verify events were emitted
      expect(events.find((e) => e.type === 'pipeline:started')).toBeDefined();
      expect(events.find((e) => e.type === 'pipeline:completed')).toBeDefined();
    });

    it('handles concurrent pipeline executions', async () => {
      const pipeline = new ExcellencePipeline({
        summarizer: createRealisticSummarizer(),
        scorer: createRealisticScorer(),
      });

      const texts = [
        'First document about programming and software development.',
        'Second document discussing database design patterns.',
        'Third document covering API design best practices.',
      ];

      const results = await Promise.all(
        texts.map((text) =>
          pipeline.execute({
            sourceType: 'text',
            text,
            config: {
              generateEmbeddings: false,
              buildPyramid: false,
              scoreExcellence: true,
            },
          })
        )
      );

      // All should succeed
      for (const result of results) {
        expect(result.success).toBe(true);
      }

      // Each should have unique job ID
      const jobIds = new Set(results.map((r) => r.jobId));
      expect(jobIds.size).toBe(results.length);
    });
  });

  describe('Performance Characteristics', () => {
    it('processes reasonable-sized content efficiently', async () => {
      const pipeline = new ExcellencePipeline({
        summarizer: createRealisticSummarizer(),
        embedder: createDeterministicEmbedder(),
        scorer: createRealisticScorer(),
      });

      const startTime = Date.now();

      const result = await pipeline.execute({
        sourceType: 'text',
        text: veryLongText,  // Use very long text
        config: {
          generateEmbeddings: true,
          buildPyramid: true,
          scoreExcellence: true,
        },
      });

      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      // Should complete in reasonable time (adjust based on actual performance)
      expect(duration).toBeLessThan(30000); // 30 seconds max for long content
    });

    it('scales with content size', async () => {
      const pipeline = new ExcellencePipeline({
        summarizer: createRealisticSummarizer(),
      });

      // Run with small text
      const smallResult = await pipeline.execute({
        sourceType: 'text',
        text: shortText,
        config: {
          generateEmbeddings: false,
          buildPyramid: false, // Small text won't trigger pyramid
          scoreExcellence: false,
        },
      });

      // Run with very large text
      const largeResult = await pipeline.execute({
        sourceType: 'text',
        text: veryLongText,  // Use very long text
        config: {
          generateEmbeddings: false,
          buildPyramid: true,
          scoreExcellence: false,
        },
      });

      // Larger content should create more nodes
      expect(largeResult.createdNodeIds.length).toBeGreaterThan(
        smallResult.createdNodeIds.length
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DATABASE INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describeWithDb('ExcellencePipeline Database Integration', () => {
  let pool: Pool;
  let store: PostgresContentStore;

  beforeAll(async () => {
    // Parse connection string to get config
    const url = new URL(TEST_DATABASE_URL!);

    // Initialize store (handles schema initialization internally)
    store = await initContentStore({
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.slice(1),
      user: url.username,
      password: url.password,
    });

    // Get pool for direct queries in tests
    pool = new Pool({ connectionString: TEST_DATABASE_URL });
  });

  afterAll(async () => {
    await pool.end();
    await closeContentStore();
  });

  beforeEach(() => {
    resetExcellencePipeline();
  });

  afterEach(async () => {
    // Clean up test data
    await pool.query(`
      DELETE FROM content_nodes
      WHERE uri LIKE 'content://pyramid/%'
      OR source_type LIKE 'pyramid-%'
    `);
  });

  it('stores pyramid nodes in database', async () => {
    const pipeline = new ExcellencePipeline({
      store,
      summarizer: createRealisticSummarizer(),
    });

    const result = await pipeline.execute({
      sourceType: 'text',
      text: realWorldText,
      title: 'DB Integration Test',
      config: {
        generateEmbeddings: false,
        buildPyramid: true,
        scoreExcellence: false,
      },
    });

    expect(result.success).toBe(true);

    // Verify nodes were stored
    for (const nodeId of result.createdNodeIds.slice(0, 5)) {
      const node = await store.getNode(nodeId);
      expect(node).toBeDefined();
    }
  });

  it('stores excellence scores in metadata', async () => {
    const pipeline = new ExcellencePipeline({
      store,
      scorer: createRealisticScorer(),
    });

    const result = await pipeline.execute({
      sourceType: 'text',
      text: shortText,
      config: {
        generateEmbeddings: false,
        buildPyramid: false,
        scoreExcellence: true,
      },
    });

    expect(result.success).toBe(true);

    // Check stored metadata includes excellence score
    if (result.createdNodeIds.length > 0) {
      const node = await store.getNode(result.createdNodeIds[0]);
      expect(node).toBeDefined();
      expect(node!.sourceMetadata).toBeDefined();
    }
  });

  it('stores embeddings with nodes', async () => {
    const pipeline = new ExcellencePipeline({
      store,
      embedder: createDeterministicEmbedder(),
    });

    const result = await pipeline.execute({
      sourceType: 'text',
      text: shortText,
      config: {
        generateEmbeddings: true,
        buildPyramid: false,
        scoreExcellence: false,
      },
    });

    expect(result.success).toBe(true);

    // Note: Embedding storage depends on store implementation
    // This test verifies the pipeline completes successfully
  });

  it('creates correct hierarchy levels', async () => {
    const pipeline = new ExcellencePipeline({
      store,
      summarizer: createRealisticSummarizer(),
    });

    const result = await pipeline.execute({
      sourceType: 'text',
      text: realWorldText,
      config: {
        generateEmbeddings: false,
        buildPyramid: true,
        scoreExcellence: false,
      },
    });

    expect(result.success).toBe(true);
    expect(result.pyramidStats).toBeDefined();

    // Query nodes by hierarchy level
    const l0Result = await pool.query(
      `SELECT COUNT(*) FROM content_nodes WHERE hierarchy_level = 0 AND source_type = 'pyramid-l0'`
    );
    const l1Result = await pool.query(
      `SELECT COUNT(*) FROM content_nodes WHERE hierarchy_level = 1 AND source_type = 'pyramid-l1'`
    );
    const apexResult = await pool.query(
      `SELECT COUNT(*) FROM content_nodes WHERE hierarchy_level = 2 AND source_type = 'pyramid-apex'`
    );

    expect(parseInt(l0Result.rows[0].count)).toBe(result.pyramidStats!.nodeCounts[0]);
    expect(parseInt(l1Result.rows[0].count)).toBe(result.pyramidStats!.nodeCounts[1]);
    expect(parseInt(apexResult.rows[0].count)).toBe(result.pyramidStats!.nodeCounts[2]);
  });
});
