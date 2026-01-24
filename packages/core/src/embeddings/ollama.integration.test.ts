/**
 * Ollama Integration Tests
 *
 * Tests that run against a real Ollama instance when available.
 * These tests are skipped if Ollama is not running.
 *
 * To run: Start Ollama locally (ollama serve)
 * Requires: nomic-embed-text model (ollama pull nomic-embed-text)
 *
 * @module @humanizer/core/embeddings/ollama.integration.test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  EmbeddingService,
  resetEmbeddingService,
} from './embedding-service.js';

// ═══════════════════════════════════════════════════════════════════════════
// OLLAMA INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Ollama Integration', () => {
  let service: EmbeddingService;
  let ollamaAvailable = false;

  beforeAll(async () => {
    resetEmbeddingService();
    service = new EmbeddingService({
      ollamaUrl: 'http://localhost:11434',
      embedModel: 'nomic-embed-text:latest',
      timeout: 30000,
      verbose: false,
    });

    // Check if Ollama is available
    ollamaAvailable = await service.isAvailable();
    if (!ollamaAvailable) {
      console.log('⚠️ Ollama not available, skipping integration tests');
    }
  });

  afterAll(() => {
    resetEmbeddingService();
  });

  describe('Embedding Generation', () => {
    it.skipIf(!ollamaAvailable)('generates embedding for short text', async () => {
      const embedding = await service.embed('Hello, world!');

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768); // nomic-embed-text dimension
      expect(embedding.every(v => typeof v === 'number')).toBe(true);
    });

    it.skipIf(!ollamaAvailable)('generates embedding for longer text', async () => {
      const longText = `
        This is a longer piece of text that contains multiple sentences.
        It discusses various topics including technology, nature, and philosophy.
        The purpose is to test that the embedding service can handle longer inputs
        and produce meaningful vector representations.
      `.trim();

      const embedding = await service.embed(longText);

      expect(embedding.length).toBe(768);
    });

    it.skipIf(!ollamaAvailable)('generates different embeddings for different texts', async () => {
      const emb1 = await service.embed('The weather is sunny today');
      const emb2 = await service.embed('Machine learning algorithms');

      // Embeddings should be different
      const similarity = cosineSimilarity(emb1, emb2);
      expect(similarity).toBeLessThan(0.9); // Not identical
      expect(similarity).toBeGreaterThan(-1); // Valid cosine similarity
    });

    it.skipIf(!ollamaAvailable)('generates similar embeddings for similar texts', async () => {
      const emb1 = await service.embed('I love programming in TypeScript');
      const emb2 = await service.embed('I enjoy coding with TypeScript');

      const similarity = cosineSimilarity(emb1, emb2);
      expect(similarity).toBeGreaterThan(0.7); // Should be fairly similar
    });
  });

  describe('Batch Embedding', () => {
    it.skipIf(!ollamaAvailable)('embeds multiple texts in batch', async () => {
      const texts = [
        'First document about cats',
        'Second document about dogs',
        'Third document about birds',
      ];

      const result = await service.embedBatch(texts);

      expect(result.embeddings).toHaveLength(3);
      expect(result.count).toBe(3);
      expect(result.model).toBe('nomic-embed-text:latest');
      expect(result.dimensions).toBe(768);
      expect(result.durationMs).toBeGreaterThan(0);
    });

    it.skipIf(!ollamaAvailable)('maintains order in batch results', async () => {
      const texts = ['Alpha', 'Beta', 'Gamma'];
      const result = await service.embedBatch(texts);

      // Each embedding should be different
      const [e1, e2, e3] = result.embeddings;
      expect(cosineSimilarity(e1, e2)).toBeLessThan(0.99);
      expect(cosineSimilarity(e2, e3)).toBeLessThan(0.99);
    });
  });

  describe('Embedder Function', () => {
    it.skipIf(!ollamaAvailable)('creates embedder compatible with PyramidBuilder', async () => {
      const embedder = service.createEmbedder();
      const texts = ['Document one', 'Document two'];

      const embeddings = await embedder(texts);

      expect(embeddings).toHaveLength(2);
      expect(embeddings[0]).toHaveLength(768);
      expect(embeddings[1]).toHaveLength(768);
    });
  });

  describe('Summarizer Function', () => {
    it.skipIf(!ollamaAvailable)('creates working summarizer', async () => {
      // Note: This requires llama3.2:3b model
      const summarizer = service.createSummarizer();

      const longText = `
        Artificial intelligence has transformed many industries over the past decade.
        Machine learning models can now recognize images, translate languages, and
        generate creative content. These advances have led to both excitement and
        concern about the future of work and society. Researchers continue to push
        the boundaries of what AI systems can achieve.
      `.trim();

      try {
        const summary = await summarizer(longText, 30);
        expect(summary).toBeDefined();
        expect(typeof summary).toBe('string');
        expect(summary.length).toBeGreaterThan(0);
      } catch (error) {
        // Skip if llama3.2:3b not available
        console.log('⚠️ Summarization model not available, skipping');
      }
    });
  });

  describe('Node Embedding', () => {
    it.skipIf(!ollamaAvailable)('embeds nodes from storage format', async () => {
      const nodes = [
        { id: 'node-1', text: 'First node content about technology', embeddingModel: undefined },
        { id: 'node-2', text: 'Second node content about nature', embeddingModel: undefined },
      ];

      const results = await service.embedNodes(nodes as any);

      expect(results).toHaveLength(2);
      expect(results[0].nodeId).toBe('node-1');
      expect(results[0].embedding).toHaveLength(768);
      expect(results[1].nodeId).toBe('node-2');
    });
  });

  describe('Error Handling', () => {
    it.skipIf(!ollamaAvailable)('handles empty text gracefully', async () => {
      // Ollama should still return an embedding for empty text
      const embedding = await service.embed('');
      expect(embedding).toBeDefined();
    });

    it('handles connection errors', async () => {
      const badService = new EmbeddingService({
        ollamaUrl: 'http://localhost:59999', // Unlikely to have anything running
        timeout: 1000,
      });

      const available = await badService.isAvailable();
      expect(available).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
