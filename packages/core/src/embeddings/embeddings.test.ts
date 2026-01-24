/**
 * Embedding Service Tests
 *
 * Unit tests for the embedding service that bridges Ollama with core services.
 * Tests embedding generation, batch processing, pyramid building, and singleton management.
 *
 * @module @humanizer/core/embeddings/tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EmbeddingService,
  initEmbeddingService,
  getEmbeddingService,
  resetEmbeddingService,
  type EmbeddingServiceConfig,
  type EmbeddingBatchResult,
  type ContentEmbeddingResult,
} from './embedding-service.js';

// ═══════════════════════════════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════════════════════════════

// Mock fetch for Ollama API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

function createMockEmbeddingResponse(dimensions: number = 768): { embeddings: number[][] } {
  return {
    embeddings: [Array.from({ length: dimensions }, () => Math.random())],
  };
}

function createMockGenerateResponse(text: string): { response: string } {
  return { response: text };
}

// ═══════════════════════════════════════════════════════════════════════════
// EMBEDDING SERVICE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(() => {
    resetEmbeddingService();
    mockFetch.mockReset();
    service = new EmbeddingService({ verbose: false });
  });

  afterEach(() => {
    resetEmbeddingService();
    mockFetch.mockReset();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Configuration', () => {
    it('uses default configuration', () => {
      const svc = new EmbeddingService();
      expect(svc.getEmbedModel()).toBe('nomic-embed-text:latest');
      expect(svc.getEmbedDimensions()).toBe(768);
    });

    it('accepts custom configuration', () => {
      const svc = new EmbeddingService({
        ollamaUrl: 'http://custom:11434',
        embedModel: 'custom-model',
        timeout: 30000,
      });
      expect(svc.getEmbedModel()).toBe('custom-model');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AVAILABILITY CHECK
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Availability Check', () => {
    it('returns true when Ollama is available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [] }),
      });

      const available = await service.isAvailable();
      expect(available).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('returns false when Ollama is not available', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const available = await service.isAvailable();
      expect(available).toBe(false);
    });

    it('returns false on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const available = await service.isAvailable();
      expect(available).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SINGLE EMBEDDING
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Single Embedding', () => {
    it('generates embedding for text', async () => {
      const mockEmbedding = Array.from({ length: 768 }, () => Math.random());
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embeddings: [mockEmbedding] }),
      });

      const embedding = await service.embed('Test text');

      expect(embedding).toHaveLength(768);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/embed',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('nomic-embed-text'),
        })
      );
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad request',
      });

      await expect(service.embed('Test')).rejects.toThrow('Ollama embed error');
    });

    it('sends correct request body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockEmbeddingResponse(),
      });

      await service.embed('My test text');

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.model).toBe('nomic-embed-text:latest');
      expect(body.input).toBe('My test text');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BATCH EMBEDDING
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Batch Embedding', () => {
    it('embeds multiple texts', async () => {
      const texts = ['Text 1', 'Text 2', 'Text 3'];

      // Mock each embed call
      for (let i = 0; i < texts.length; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => createMockEmbeddingResponse(),
        });
      }

      const result = await service.embedBatch(texts);

      expect(result.embeddings).toHaveLength(3);
      expect(result.count).toBe(3);
      expect(result.model).toBe('nomic-embed-text:latest');
      expect(result.dimensions).toBe(768);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('processes in batches', async () => {
      const svc = new EmbeddingService({ batchSize: 2, verbose: false });
      const texts = ['Text 1', 'Text 2', 'Text 3', 'Text 4', 'Text 5'];

      // Mock all embed calls
      for (let i = 0; i < texts.length; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => createMockEmbeddingResponse(),
        });
      }

      const result = await svc.embedBatch(texts);

      expect(result.embeddings).toHaveLength(5);
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });

    it('returns empty result for empty input', async () => {
      const result = await service.embedBatch([]);

      expect(result.embeddings).toHaveLength(0);
      expect(result.count).toBe(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EMBEDDER FUNCTION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Embedder Function', () => {
    it('creates embedder function for PyramidBuilder', async () => {
      const texts = ['Text 1', 'Text 2'];

      for (let i = 0; i < texts.length; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => createMockEmbeddingResponse(),
        });
      }

      const embedder = service.createEmbedder();
      const embeddings = await embedder(texts);

      expect(embeddings).toHaveLength(2);
      expect(embeddings[0]).toHaveLength(768);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARIZER FUNCTION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Summarizer Function', () => {
    it('creates summarizer function', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockGenerateResponse('This is a summary.'),
      });

      const summarizer = service.createSummarizer();
      const summary = await summarizer('Long text to summarize...', 50, { level: 1, position: 0 });

      expect(summary).toBe('This is a summary.');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('uses appropriate prompt for different levels', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockGenerateResponse('Apex summary.'),
      });

      const summarizer = service.createSummarizer();
      await summarizer('Content', 100, { level: 2, position: 0 });

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.system).toContain('document apex');
    });

    it('throws on summarization error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal error',
      });

      const summarizer = service.createSummarizer();
      await expect(summarizer('Text', 50)).rejects.toThrow('Ollama summarize error');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PYRAMID BUILDER
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Pyramid Builder', () => {
    it('creates and caches PyramidBuilder', () => {
      const builder1 = service.getPyramidBuilder();
      const builder2 = service.getPyramidBuilder();

      expect(builder1).toBe(builder2); // Same instance
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTENT PROCESSING
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Content Processing', () => {
    it('returns early when Ollama not available', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await service.processContent(
        'Short content',
        'thread-1',
        'chatgpt'
      );

      expect(result.ollamaAvailable).toBe(false);
      expect(result.totalEmbeddings).toBe(0);
      expect(result.embeddedNodeIds).toHaveLength(0);
    });

    it('generates single embedding for short content', async () => {
      // Mock availability check
      mockFetch.mockResolvedValueOnce({ ok: true });

      // Mock embed call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockEmbeddingResponse(),
      });

      const shortContent = 'This is a short piece of content.';
      const result = await service.processContent(shortContent, 'thread-1', 'chatgpt');

      expect(result.ollamaAvailable).toBe(true);
      expect(result.totalEmbeddings).toBe(1);
      expect(result.embeddedNodeIds).toContain('thread-1');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // NODE EMBEDDING
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Node Embedding', () => {
    it('embeds nodes without existing embeddings', async () => {
      const nodes = [
        { id: 'node-1', text: 'First text', embeddingModel: undefined },
        { id: 'node-2', text: 'Second text', embeddingModel: undefined },
      ];

      // Mock embed calls
      for (let i = 0; i < nodes.length; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => createMockEmbeddingResponse(),
        });
      }

      const results = await service.embedNodes(nodes as any);

      expect(results).toHaveLength(2);
      expect(results[0].nodeId).toBe('node-1');
      expect(results[0].embedding).toHaveLength(768);
    });

    it('skips nodes with existing embeddings', async () => {
      const nodes = [
        { id: 'node-1', text: 'First text', embeddingModel: 'nomic-embed-text' },
        { id: 'node-2', text: 'Second text', embeddingModel: undefined },
      ];

      // Only one embed call expected
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockEmbeddingResponse(),
      });

      const results = await service.embedNodes(nodes as any);

      expect(results).toHaveLength(1);
      expect(results[0].nodeId).toBe('node-2');
    });

    it('returns empty array when all nodes have embeddings', async () => {
      const nodes = [
        { id: 'node-1', text: 'First text', embeddingModel: 'nomic-embed-text' },
      ];

      const results = await service.embedNodes(nodes as any);

      expect(results).toHaveLength(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SINGLETON MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Singleton Management', () => {
    beforeEach(() => {
      resetEmbeddingService();
    });

    it('initializes embedding service', () => {
      const svc = initEmbeddingService({ verbose: false });
      expect(svc).toBeInstanceOf(EmbeddingService);
    });

    it('gets embedding service', () => {
      initEmbeddingService();
      const svc = getEmbeddingService();
      expect(svc).toBeInstanceOf(EmbeddingService);
    });

    it('creates service on first get if not initialized', () => {
      const svc = getEmbeddingService();
      expect(svc).toBeInstanceOf(EmbeddingService);
    });

    it('returns same instance on subsequent gets', () => {
      const svc1 = getEmbeddingService();
      const svc2 = getEmbeddingService();
      expect(svc1).toBe(svc2);
    });

    it('resets embedding service', () => {
      const svc1 = initEmbeddingService({ embedModel: 'model-1' });
      resetEmbeddingService();
      const svc2 = getEmbeddingService({ embedModel: 'model-2' });

      expect(svc1.getEmbedModel()).toBe('model-1');
      expect(svc2.getEmbedModel()).toBe('model-2');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════

describe('Embedding Service Integration', () => {
  let service: EmbeddingService;

  beforeEach(() => {
    resetEmbeddingService();
    mockFetch.mockReset();
    service = new EmbeddingService({ verbose: false });
  });

  afterEach(() => {
    resetEmbeddingService();
  });

  it('handles typical embedding workflow', async () => {
    // Simulate: check availability, then embed multiple texts
    mockFetch.mockResolvedValueOnce({ ok: true }); // availability

    const texts = ['First document', 'Second document'];
    for (let i = 0; i < texts.length; i++) {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockEmbeddingResponse(),
      });
    }

    const available = await service.isAvailable();
    expect(available).toBe(true);

    const embedder = service.createEmbedder();
    const embeddings = await embedder(texts);

    expect(embeddings).toHaveLength(2);
    expect(embeddings[0]).toHaveLength(768);
    expect(embeddings[1]).toHaveLength(768);
  });

  it('handles network failures gracefully', async () => {
    // Simulate network failure
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const available = await service.isAvailable();
    expect(available).toBe(false);

    // Attempting to embed should throw
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    await expect(service.embed('Test')).rejects.toThrow();
  });

  it('handles partial batch failure', async () => {
    const texts = ['Text 1', 'Text 2', 'Text 3'];

    // All three calls happen in parallel via Promise.all
    // First succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createMockEmbeddingResponse(),
    });

    // Second fails with timeout
    mockFetch.mockRejectedValueOnce(new Error('Request timed out'));

    // Third needs to be mocked too since Promise.all runs in parallel
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createMockEmbeddingResponse(),
    });

    // The batch should fail when any promise in Promise.all rejects
    await expect(service.embedBatch(texts)).rejects.toThrow();
  });
});
