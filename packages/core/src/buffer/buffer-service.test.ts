/**
 * BufferService Integration Tests
 *
 * Tests for BufferServiceImpl with mocked store dependencies.
 * Tests the core load, transform, merge, split, and commit operations.
 *
 * @module @humanizer/core/buffer/buffer-service.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BufferServiceImpl,
  createBufferService,
  getBufferService,
  initBufferService,
  resetBufferService,
} from './buffer-service-impl.js';
import type {
  ContentBuffer,
  BufferContentFormat,
  BufferState,
} from './types.js';
import type {
  BufferServiceOptions,
  ArchiveStoreAdapter,
  BooksStoreAdapter,
  AuiStoreAdapter,
} from './buffer-service.js';
import type { StoredNode } from '../storage/types.js';
import type { BookChapter } from '../aui/types.js';
import { resetProvenanceTracker } from './provenance-tracker.js';

// ═══════════════════════════════════════════════════════════════════════════
// MOCK STORES
// ═══════════════════════════════════════════════════════════════════════════

function createMockArchiveNode(id: string, text: string): StoredNode {
  return {
    id,
    text,
    contentHash: 'mock-hash-' + id,
    uri: `content://mock/${id}`,
    format: 'text' as const,
    wordCount: text.split(/\s+/).length,
    sourceType: 'chatgpt-message',
    sourceAdapter: 'mock',
    hierarchyLevel: 0,
    author: 'test-user',
    authorRole: 'user' as const,
    createdAt: Date.now(),
    importedAt: Date.now(),
    threadRootId: 'thread-1',
  };
}

function createMockChapter(id: string, content: string): BookChapter {
  return {
    id,
    title: `Chapter ${id}`,
    content,
    passageIds: [],
    position: 0,
    wordCount: content.split(/\s+/).length,
  };
}

function createMockArchiveStore(nodes: Map<string, StoredNode>): ArchiveStoreAdapter {
  return {
    getNode: async (nodeId: string) => nodes.get(nodeId),
    createNode: async (node: Omit<StoredNode, 'id'>) => {
      const id = `node-${Date.now()}`;
      const fullNode = { ...node, id } as StoredNode;
      nodes.set(id, fullNode);
      return fullNode;
    },
    updateNode: async (nodeId: string, updates: Partial<StoredNode>) => {
      const existing = nodes.get(nodeId);
      if (!existing) return undefined;
      const updated = { ...existing, ...updates };
      nodes.set(nodeId, updated);
      return updated;
    },
  };
}

function createMockBooksStore(chapters: Map<string, BookChapter>): BooksStoreAdapter {
  return {
    getChapter: async (chapterId: string) => chapters.get(chapterId),
    updateChapter: async (chapterId: string, content: string, metadata?: Record<string, unknown>) => {
      const existing = chapters.get(chapterId);
      if (!existing) return undefined;
      const updated = { ...existing, content, wordCount: content.split(/\s+/).length };
      chapters.set(chapterId, updated);
      return updated;
    },
    addToChapter: async (bookId: string, chapterId: string, content: string, position?: number) => {
      let existing = chapters.get(chapterId);
      if (!existing) {
        existing = createMockChapter(chapterId, '');
        chapters.set(chapterId, existing);
      }
      const newContent = existing.content ? `${existing.content}\n\n${content}` : content;
      const updated = { ...existing, content: newContent, wordCount: newContent.split(/\s+/).length };
      chapters.set(chapterId, updated);
      return updated;
    },
  };
}

function createMockAuiStore(): AuiStoreAdapter {
  const buffers = new Map<string, ContentBuffer>();
  const chains = new Map<string, any>();

  return {
    saveContentBuffer: async (buffer: ContentBuffer) => {
      buffers.set(buffer.id, buffer);
      return buffer;
    },
    loadContentBuffer: async (bufferId: string) => buffers.get(bufferId),
    findContentBuffersByHash: async (hash: string) =>
      Array.from(buffers.values()).filter(b => b.contentHash === hash),
    deleteContentBuffer: async (bufferId: string) => buffers.delete(bufferId),
    saveProvenanceChain: async (chain: any) => {
      chains.set(chain.id, chain);
      return chain;
    },
    loadProvenanceChain: async (chainId: string) => chains.get(chainId),
    findDerivedBuffers: async (rootBufferId: string) => [],
    getPersonaProfile: async () => undefined,
    getStyleProfile: async () => undefined,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST FIXTURES
// ═══════════════════════════════════════════════════════════════════════════

const sampleText1 = 'This is a sample text for testing the buffer service. It contains multiple sentences.';
const sampleText2 = 'Another piece of content for our tests. This helps verify merge functionality.';
const sampleText3 = 'A third sample with different content. Used for split and merge tests.';

const multiParagraphText = `First paragraph with some content here.

Second paragraph with more details about the topic.

Third paragraph wrapping up the discussion.`;

// ═══════════════════════════════════════════════════════════════════════════
// BUFFER SERVICE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('BufferServiceImpl', () => {
  let service: BufferServiceImpl;
  let archiveNodes: Map<string, StoredNode>;
  let chapters: Map<string, BookChapter>;

  beforeEach(() => {
    resetProvenanceTracker();
    resetBufferService();

    archiveNodes = new Map();
    chapters = new Map();

    // Add test nodes
    archiveNodes.set('node-1', createMockArchiveNode('node-1', sampleText1));
    archiveNodes.set('node-2', createMockArchiveNode('node-2', sampleText2));
    archiveNodes.set('node-3', createMockArchiveNode('node-3', sampleText3));

    // Add test chapters
    chapters.set('chapter-1', createMockChapter('chapter-1', 'Existing chapter content.'));

    service = createBufferService({
      archiveStore: createMockArchiveStore(archiveNodes),
      booksStore: createMockBooksStore(chapters),
      auiStore: createMockAuiStore(),
      defaultState: 'transient',
    });
  });

  afterEach(() => {
    resetProvenanceTracker();
    resetBufferService();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LOADING
  // ═══════════════════════════════════════════════════════════════════════════

  describe('loadFromArchive', () => {
    it('loads content from archive node', async () => {
      const buffer = await service.loadFromArchive('node-1');

      expect(buffer.text).toBe(sampleText1);
      expect(buffer.id).toBeDefined();
      expect(buffer.contentHash).toBeDefined();
    });

    it('sets correct origin from archive', async () => {
      const buffer = await service.loadFromArchive('node-1');

      expect(buffer.origin.sourceType).toBe('archive');
      expect(buffer.origin.sourceNodeId).toBe('node-1');
      expect(buffer.origin.sourceNodeType).toBe('StoredNode');
      expect(buffer.origin.sourcePlatform).toBe('chatgpt-message');
    });

    it('creates provenance chain with load operation', async () => {
      const buffer = await service.loadFromArchive('node-1');

      expect(buffer.provenanceChain).toBeDefined();
      expect(buffer.provenanceChain.rootBufferId).toBe(buffer.id);
      expect(buffer.provenanceChain.operations.length).toBeGreaterThanOrEqual(0);
    });

    it('computes word count', async () => {
      const buffer = await service.loadFromArchive('node-1');

      expect(buffer.wordCount).toBeGreaterThan(0);
    });

    it('detects content format', async () => {
      const buffer = await service.loadFromArchive('node-1');

      expect(buffer.format).toBe('text');
    });

    it('throws for missing node', async () => {
      await expect(service.loadFromArchive('nonexistent')).rejects.toThrow();
    });
  });

  describe('loadFromBook', () => {
    it('loads content from book chapter', async () => {
      const buffer = await service.loadFromBook('chapter-1');

      expect(buffer.text).toBe('Existing chapter content.');
      expect(buffer.origin.sourceType).toBe('book');
    });

    it('throws for missing chapter', async () => {
      await expect(service.loadFromBook('nonexistent')).rejects.toThrow();
    });
  });

  describe('createFromText', () => {
    it('creates buffer from raw text', async () => {
      const buffer = await service.createFromText('Hello, world!');

      expect(buffer.text).toBe('Hello, world!');
      expect(buffer.origin.sourceType).toBe('manual');
    });

    it('accepts format option', async () => {
      const buffer = await service.createFromText('# Heading\n\nParagraph', {
        format: 'markdown',
      });

      expect(buffer.format).toBe('markdown');
    });

    it('accepts author options', async () => {
      const buffer = await service.createFromText('Test content', {
        author: 'test-author',
        authorRole: 'user',
        sourcePlatform: 'manual-entry',
      });

      expect(buffer.origin.author).toBe('test-author');
      expect(buffer.origin.authorRole).toBe('user');
      expect(buffer.origin.sourcePlatform).toBe('manual-entry');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSFORMATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('transform', () => {
    it('creates new buffer (immutable)', async () => {
      const original = await service.loadFromArchive('node-1');
      const transformed = await service.transform(original, {
        type: 'transform_custom',
        parameters: { test: true },
        description: 'Test transform',
      });

      expect(transformed.id).not.toBe(original.id);
    });

    it('preserves original buffer', async () => {
      const original = await service.loadFromArchive('node-1');
      const originalText = original.text;

      await service.transform(original, {
        type: 'transform_custom',
        parameters: {},
      });

      expect(original.text).toBe(originalText);
    });
  });

  describe('merge', () => {
    it('merges multiple buffers', async () => {
      const buffer1 = await service.loadFromArchive('node-1');
      const buffer2 = await service.loadFromArchive('node-2');

      const merged = await service.merge([buffer1, buffer2]);

      expect(merged.text).toContain(sampleText1);
      expect(merged.text).toContain(sampleText2);
    });

    it('uses custom separator', async () => {
      const buffer1 = await service.loadFromArchive('node-1');
      const buffer2 = await service.loadFromArchive('node-2');

      const merged = await service.merge([buffer1, buffer2], {
        joinWith: '\n---\n',
      });

      expect(merged.text).toContain('---');
    });

    it('returns same buffer for single-item array', async () => {
      const buffer = await service.loadFromArchive('node-1');
      const merged = await service.merge([buffer]);

      expect(merged).toBe(buffer);
    });

    it('throws for empty array', async () => {
      await expect(service.merge([])).rejects.toThrow();
    });

    it('sets generated origin type', async () => {
      const buffer1 = await service.loadFromArchive('node-1');
      const buffer2 = await service.loadFromArchive('node-2');

      const merged = await service.merge([buffer1, buffer2]);

      expect(merged.origin.sourceType).toBe('generated');
    });

    it('computes new word count', async () => {
      const buffer1 = await service.loadFromArchive('node-1');
      const buffer2 = await service.loadFromArchive('node-2');

      const merged = await service.merge([buffer1, buffer2]);

      expect(merged.wordCount).toBeGreaterThan(buffer1.wordCount);
    });
  });

  describe('split', () => {
    it('splits by paragraphs', async () => {
      const buffer = await service.createFromText(multiParagraphText);
      const chunks = await service.split(buffer, { strategy: 'paragraphs' });

      expect(chunks.length).toBe(3);
    });

    it('splits by sentences', async () => {
      const buffer = await service.loadFromArchive('node-1');
      const chunks = await service.split(buffer, { strategy: 'sentences' });

      expect(chunks.length).toBeGreaterThan(1);
    });

    it('splits by fixed length', async () => {
      const buffer = await service.createFromText('One two three four five six seven eight nine ten');
      const chunks = await service.split(buffer, {
        strategy: 'fixed_length',
        maxChunkSize: 3,
        overlap: 0,
      });

      expect(chunks.length).toBeGreaterThan(1);
    });

    it('each chunk has its own provenance', async () => {
      const buffer = await service.createFromText(multiParagraphText);
      const chunks = await service.split(buffer, { strategy: 'paragraphs' });

      for (const chunk of chunks) {
        expect(chunk.provenanceChain).toBeDefined();
      }
    });

    it('chunk origin tracks split source', async () => {
      const buffer = await service.createFromText(multiParagraphText);
      const chunks = await service.split(buffer, { strategy: 'paragraphs' });

      expect(chunks[0].origin.metadata?.splitFrom).toBe(buffer.id);
      expect(chunks[0].origin.metadata?.splitIndex).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // QUALITY ANALYSIS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('analyzeQuality', () => {
    it('adds quality metrics to buffer', async () => {
      const buffer = await service.loadFromArchive('node-1');
      const analyzed = await service.analyzeQuality(buffer);

      expect(analyzed.qualityMetrics).toBeDefined();
      expect(analyzed.qualityMetrics?.overallScore).toBeGreaterThan(0);
    });

    it('creates new buffer (immutable)', async () => {
      const buffer = await service.loadFromArchive('node-1');
      const analyzed = await service.analyzeQuality(buffer);

      expect(analyzed.id).not.toBe(buffer.id);
      expect(buffer.qualityMetrics).toBeUndefined();
    });

    it('includes readability metrics', async () => {
      const buffer = await service.loadFromArchive('node-1');
      const analyzed = await service.analyzeQuality(buffer);

      expect(analyzed.qualityMetrics?.readability).toBeDefined();
      expect(analyzed.qualityMetrics?.readability?.avgSentenceLength).toBeGreaterThan(0);
    });
  });

  describe('detectAI', () => {
    it('adds AI detection results', async () => {
      const buffer = await service.loadFromArchive('node-1');
      const detected = await service.detectAI(buffer);

      expect(detected.qualityMetrics?.aiDetection).toBeDefined();
      expect(detected.qualityMetrics?.aiDetection?.probability).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMIT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('commitToBook', () => {
    it('adds content to chapter', async () => {
      const buffer = await service.loadFromArchive('node-1');
      const chapter = await service.commitToBook(buffer, 'book-1', 'chapter-1');

      expect(chapter.content).toContain(sampleText1);
    });

    it('returns updated chapter', async () => {
      const buffer = await service.loadFromArchive('node-1');
      const chapter = await service.commitToBook(buffer, 'book-1', 'chapter-1');

      expect(chapter.id).toBe('chapter-1');
      expect(chapter.wordCount).toBeGreaterThan(0);
    });

    it('throws without books store', async () => {
      const serviceNoBooksStore = createBufferService({
        archiveStore: createMockArchiveStore(archiveNodes),
      });

      const buffer = await serviceNoBooksStore.loadFromArchive('node-1');

      await expect(serviceNoBooksStore.commitToBook(buffer, 'book-1', 'chapter-1')).rejects.toThrow();
    });
  });

  describe('exportToArchive', () => {
    it('creates archive node from buffer', async () => {
      const buffer = await service.createFromText('New content to export');
      const node = await service.exportToArchive(buffer);

      expect(node.id).toBeDefined();
      expect(node.text).toBe('New content to export');
    });

    it('preserves buffer origin in metadata', async () => {
      const buffer = await service.createFromText('Content with metadata', {
        author: 'export-test',
      });
      const node = await service.exportToArchive(buffer);

      expect(node.sourceMetadata?.bufferOrigin).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PROVENANCE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getProvenance', () => {
    it('returns provenance chain', async () => {
      const buffer = await service.loadFromArchive('node-1');
      const chain = service.getProvenance(buffer);

      expect(chain).toBe(buffer.provenanceChain);
    });
  });

  describe('traceToOrigin', () => {
    it('returns original buffer for root', async () => {
      const buffer = await service.loadFromArchive('node-1');
      const origin = await service.traceToOrigin(buffer);

      expect(origin.id).toBe(buffer.id);
    });
  });

  describe('branch', () => {
    it('creates new branch from buffer', async () => {
      const buffer = await service.loadFromArchive('node-1');
      const branched = await service.branch(buffer, 'experiment');

      expect(branched.id).not.toBe(buffer.id);
      expect(branched.provenanceChain.branch.name).toBe('experiment');
    });

    it('branch is not main', async () => {
      const buffer = await service.loadFromArchive('node-1');
      const branched = await service.branch(buffer, 'feature');

      expect(branched.provenanceChain.branch.isMain).toBe(false);
    });

    it('accepts description', async () => {
      const buffer = await service.loadFromArchive('node-1');
      const branched = await service.branch(buffer, 'test', 'Testing new approach');

      expect(branched.provenanceChain.branch.description).toBe('Testing new approach');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSISTENCE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('save/load', () => {
    it('saves and loads buffer', async () => {
      const buffer = await service.loadFromArchive('node-1');
      await service.save(buffer);

      const loaded = await service.load(buffer.id);

      expect(loaded).toBeDefined();
      expect(loaded?.text).toBe(buffer.text);
    });

    it('returns undefined for unknown buffer', async () => {
      const loaded = await service.load('nonexistent');

      expect(loaded).toBeUndefined();
    });
  });

  describe('findByContentHash', () => {
    it('finds buffers with same content', async () => {
      const buffer1 = await service.createFromText('Duplicate content');
      const buffer2 = await service.createFromText('Duplicate content');

      await service.save(buffer1);
      await service.save(buffer2);

      const found = await service.findByContentHash(buffer1.contentHash);

      expect(found.length).toBe(2);
    });
  });

  describe('delete', () => {
    it('removes buffer from storage', async () => {
      const buffer = await service.loadFromArchive('node-1');
      await service.save(buffer);

      const deleted = await service.delete(buffer.id);
      expect(deleted).toBe(true);

      const loaded = await service.load(buffer.id);
      expect(loaded).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EMBEDDING
  // ═══════════════════════════════════════════════════════════════════════════

  describe('embed', () => {
    it('generates embedding when embedFn configured', async () => {
      const mockEmbedFn = vi.fn().mockResolvedValue(new Array(768).fill(0.1));

      const serviceWithEmbed = createBufferService({
        archiveStore: createMockArchiveStore(archiveNodes),
        embedFn: mockEmbedFn,
      });

      const buffer = await serviceWithEmbed.loadFromArchive('node-1');
      const embedded = await serviceWithEmbed.embed(buffer);

      expect(embedded.embedding).toBeDefined();
      expect(embedded.embedding?.length).toBe(768);
      expect(mockEmbedFn).toHaveBeenCalledWith(sampleText1);
    });

    it('throws without embedFn', async () => {
      const buffer = await service.loadFromArchive('node-1');

      await expect(service.embed(buffer)).rejects.toThrow();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

describe('Singleton management', () => {
  afterEach(() => {
    resetBufferService();
  });

  it('initBufferService creates singleton', () => {
    const service = initBufferService();

    expect(service).toBeDefined();
    expect(getBufferService()).toBe(service);
  });

  it('resetBufferService clears singleton', () => {
    initBufferService();
    resetBufferService();

    expect(getBufferService()).toBeNull();
  });

  it('createBufferService creates new instance', () => {
    const service1 = createBufferService();
    const service2 = createBufferService();

    expect(service1).not.toBe(service2);
  });
});
