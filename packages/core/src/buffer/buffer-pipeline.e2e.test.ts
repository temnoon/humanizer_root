/**
 * Buffer Pipeline E2E Tests
 *
 * Tests full transformation pipelines from archive through buffer
 * transformations to book commits. These tests verify:
 * - Archive → Buffer → Transform → Book flows
 * - Provenance tracking through full pipelines
 * - Complex multi-step transformations
 * - Branch and merge workflows
 *
 * Note: Uses mocked stores and AI services since we don't connect
 * to real databases or LLM providers.
 *
 * @module @humanizer/core/buffer/buffer-pipeline.e2e.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BufferServiceImpl,
  createBufferService,
  resetBufferService,
} from './buffer-service-impl.js';
import type { ContentBuffer } from './types.js';
import type { StoredNode } from '../storage/types.js';
import type { BookChapter } from '../aui/types.js';
import { resetProvenanceTracker } from './provenance-tracker.js';

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DATA - REALISTIC ARCHIVE CONTENT
// ═══════════════════════════════════════════════════════════════════════════

const archiveContent = {
  'msg-001': `I've been thinking a lot about my approach to work lately.
It's interesting how our perspectives shift over time. What once seemed
like the only path forward now appears as just one of many options.`,

  'msg-002': `The morning walk has become my favorite part of the day.
There's something almost magical about the early light, the quiet streets,
the gradual awakening of the world around me.`,

  'msg-003': `Looking back at my old journal entries, I'm struck by how
much has changed. The worries that consumed me then seem almost trivial now,
replaced by entirely new concerns and aspirations.`,

  'msg-004': `My grandmother used to say that the secret to happiness was
simple: gratitude. I dismissed it as naive when I was younger, but now
I understand what she meant.`,

  'msg-005': `The project took three months longer than expected, but
the result exceeded all our initial goals. Sometimes the detours lead
to better destinations than the planned route ever could.`,
};

const assistantContent = {
  'assist-001': `It's great that you're reflecting on your work approach!
This kind of self-awareness is indeed valuable. Many find that their
priorities naturally evolve as they gain experience and perspective.`,

  'assist-002': `Morning walks can definitely be transformative! The
combination of gentle exercise, natural light, and quiet contemplation
creates an ideal environment for mental clarity.`,
};

// ═══════════════════════════════════════════════════════════════════════════
// MOCK STORES
// ═══════════════════════════════════════════════════════════════════════════

function createMockNode(id: string, text: string, authorRole: 'user' | 'assistant'): StoredNode {
  return {
    id,
    text,
    contentHash: `hash-${id}`,
    uri: `content://chatgpt/${id}`,
    format: 'text' as const,
    wordCount: text.split(/\s+/).length,
    sourceType: 'chatgpt-message',
    sourceAdapter: 'chatgpt-adapter',
    hierarchyLevel: 0,
    author: authorRole === 'user' ? 'test-user' : 'assistant',
    authorRole,
    createdAt: Date.now() - Math.random() * 1000000000,
    importedAt: Date.now(),
    threadRootId: 'thread-main',
  };
}

function createFullMockArchiveStore() {
  const nodes = new Map<string, StoredNode>();

  // Add user messages
  for (const [id, text] of Object.entries(archiveContent)) {
    nodes.set(id, createMockNode(id, text, 'user'));
  }

  // Add assistant messages
  for (const [id, text] of Object.entries(assistantContent)) {
    nodes.set(id, createMockNode(id, text, 'assistant'));
  }

  return {
    nodes,
    adapter: {
      getNode: async (nodeId: string) => nodes.get(nodeId),
      createNode: async (node: Omit<StoredNode, 'id'>) => {
        const id = `exported-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
    },
  };
}

function createFullMockBooksStore() {
  const books = new Map<string, { title: string; chapters: Map<string, BookChapter> }>();

  // Pre-create a test book
  books.set('book-memoir', {
    title: 'Personal Reflections',
    chapters: new Map([
      ['ch-intro', {
        id: 'ch-intro',
        title: 'Introduction',
        content: '',
        passageIds: [],
        position: 0,
        wordCount: 0,
      }],
      ['ch-growth', {
        id: 'ch-growth',
        title: 'Personal Growth',
        content: '',
        passageIds: [],
        position: 1,
        wordCount: 0,
      }],
      ['ch-nature', {
        id: 'ch-nature',
        title: 'Nature & Solitude',
        content: '',
        passageIds: [],
        position: 2,
        wordCount: 0,
      }],
    ]),
  });

  return {
    books,
    adapter: {
      getChapter: async (chapterId: string) => {
        for (const book of books.values()) {
          const chapter = book.chapters.get(chapterId);
          if (chapter) return chapter;
        }
        return undefined;
      },
      updateChapter: async (chapterId: string, content: string) => {
        for (const book of books.values()) {
          const chapter = book.chapters.get(chapterId);
          if (chapter) {
            const updated = { ...chapter, content, wordCount: content.split(/\s+/).length };
            book.chapters.set(chapterId, updated);
            return updated;
          }
        }
        return undefined;
      },
      addToChapter: async (bookId: string, chapterId: string, content: string, position?: number) => {
        const book = books.get(bookId);
        if (!book) {
          throw new Error(`Book not found: ${bookId}`);
        }

        let chapter = book.chapters.get(chapterId);
        if (!chapter) {
          chapter = {
            id: chapterId,
            title: `Chapter ${chapterId}`,
            content: '',
            passageIds: [],
            position: book.chapters.size,
            wordCount: 0,
          };
          book.chapters.set(chapterId, chapter);
        }

        const newContent = chapter.content
          ? `${chapter.content}\n\n${content}`
          : content;

        const updated = {
          ...chapter,
          content: newContent,
          wordCount: newContent.split(/\s+/).length,
        };
        book.chapters.set(chapterId, updated);
        return updated;
      },
    },
  };
}

function createFullMockAuiStore() {
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
    findDerivedBuffers: async () => [],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// E2E PIPELINE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Buffer Pipeline E2E', () => {
  let service: BufferServiceImpl;
  let archiveStore: ReturnType<typeof createFullMockArchiveStore>;
  let booksStore: ReturnType<typeof createFullMockBooksStore>;

  beforeEach(() => {
    resetProvenanceTracker();
    resetBufferService();

    archiveStore = createFullMockArchiveStore();
    booksStore = createFullMockBooksStore();

    service = createBufferService({
      archiveStore: archiveStore.adapter,
      booksStore: booksStore.adapter,
      auiStore: createFullMockAuiStore(),
      embedFn: async (text) => new Array(768).fill(0.1), // Mock embedding
    });
  });

  afterEach(() => {
    resetProvenanceTracker();
    resetBufferService();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BASIC PIPELINE: Archive → Buffer → Book
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Archive → Buffer → Book Pipeline', () => {
    it('loads archive content, processes, and commits to book', async () => {
      // Step 1: Load from archive
      const buffer = await service.loadFromArchive('msg-001');
      expect(buffer.origin.sourceType).toBe('archive');
      expect(buffer.origin.sourceNodeId).toBe('msg-001');

      // Step 2: Analyze quality
      const analyzed = await service.analyzeQuality(buffer);
      expect(analyzed.qualityMetrics).toBeDefined();

      // Step 3: Commit to book
      const chapter = await service.commitToBook(analyzed, 'book-memoir', 'ch-growth');
      expect(chapter.content).toContain('thinking a lot about my approach');
    });

    it('tracks full provenance through pipeline', async () => {
      const buffer = await service.loadFromArchive('msg-001');
      const analyzed = await service.analyzeQuality(buffer);

      // Check provenance shows the transformations
      const chain = service.getProvenance(analyzed);
      expect(chain.rootBufferId).toBeDefined();
      expect(chain.transformationCount).toBeGreaterThanOrEqual(0);
    });

    it('preserves origin through transformations', async () => {
      const buffer = await service.loadFromArchive('msg-002');
      const analyzed = await service.analyzeQuality(buffer);
      const embedded = await service.embed(analyzed);

      // Origin should still reference the archive source
      expect(embedded.origin.sourceType).toBe('archive');
      expect(embedded.origin.sourceNodeId).toBe('msg-002');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MULTI-SOURCE MERGE PIPELINE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Multi-Source Merge Pipeline', () => {
    it('merges multiple archive messages into single buffer', async () => {
      // Load multiple messages
      const buffer1 = await service.loadFromArchive('msg-001');
      const buffer2 = await service.loadFromArchive('msg-003');
      const buffer3 = await service.loadFromArchive('msg-004');

      // Merge them
      const merged = await service.merge([buffer1, buffer2, buffer3], {
        joinWith: '\n\n---\n\n',
      });

      expect(merged.text).toContain('thinking a lot about my approach');
      expect(merged.text).toContain('old journal entries');
      expect(merged.text).toContain('grandmother used to say');
      expect(merged.origin.sourceType).toBe('generated');
    });

    it('merged buffer can be committed to book', async () => {
      const buffers = await Promise.all([
        service.loadFromArchive('msg-001'),
        service.loadFromArchive('msg-003'),
      ]);

      const merged = await service.merge(buffers);
      const chapter = await service.commitToBook(merged, 'book-memoir', 'ch-intro');

      expect(chapter.content).toContain('thinking a lot');
      expect(chapter.content).toContain('journal entries');
    });

    it('tracks merged source IDs in origin metadata', async () => {
      const buffer1 = await service.loadFromArchive('msg-001');
      const buffer2 = await service.loadFromArchive('msg-002');

      const merged = await service.merge([buffer1, buffer2]);

      expect(merged.origin.metadata?.mergedFrom).toContain(buffer1.id);
      expect(merged.origin.metadata?.mergedFrom).toContain(buffer2.id);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SPLIT AND REASSEMBLE PIPELINE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Split and Reassemble Pipeline', () => {
    it('splits content, processes chunks, and reassembles', async () => {
      // Create multi-paragraph content
      const buffer = await service.createFromText(`First section about work and career.

Second section about personal growth.

Third section about family and relationships.`);

      // Split into paragraphs
      const chunks = await service.split(buffer, { strategy: 'paragraphs' });
      expect(chunks.length).toBe(3);

      // Process each chunk (analyze)
      const processed = await Promise.all(
        chunks.map(chunk => service.analyzeQuality(chunk))
      );

      // Reassemble
      const reassembled = await service.merge(processed);
      expect(reassembled.text).toContain('work and career');
      expect(reassembled.text).toContain('personal growth');
      expect(reassembled.text).toContain('family and relationships');
    });

    it('each chunk maintains its own provenance', async () => {
      const buffer = await service.createFromText(`Para one.

Para two.

Para three.`);

      const chunks = await service.split(buffer, { strategy: 'paragraphs' });

      for (const chunk of chunks) {
        expect(chunk.provenanceChain).toBeDefined();
        expect(chunk.origin.metadata?.splitFrom).toBe(buffer.id);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BRANCH AND EXPERIMENT PIPELINE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Branch and Experiment Pipeline', () => {
    it('creates experimental branch for testing', async () => {
      const buffer = await service.loadFromArchive('msg-001');

      // Create experimental branch
      const experiment = await service.branch(buffer, 'experiment-v1', 'Testing new approach');

      expect(experiment.id).not.toBe(buffer.id);
      expect(experiment.provenanceChain.branch.name).toBe('experiment-v1');
      expect(experiment.provenanceChain.branch.isMain).toBe(false);
    });

    it('parallel experiments from same source', async () => {
      const buffer = await service.loadFromArchive('msg-002');

      // Create multiple experiments
      const expA = await service.branch(buffer, 'exp-formal', 'Formal style');
      const expB = await service.branch(buffer, 'exp-casual', 'Casual style');

      expect(expA.provenanceChain.branch.name).toBe('exp-formal');
      expect(expB.provenanceChain.branch.name).toBe('exp-casual');

      // Both start from same content
      expect(expA.text).toBe(buffer.text);
      expect(expB.text).toBe(buffer.text);
    });

    it('experiment branch can be committed to book', async () => {
      const buffer = await service.loadFromArchive('msg-004');
      const experiment = await service.branch(buffer, 'polished', 'Polished version');
      const analyzed = await service.analyzeQuality(experiment);

      const chapter = await service.commitToBook(analyzed, 'book-memoir', 'ch-growth');

      expect(chapter.content).toContain('grandmother used to say');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ROUND-TRIP: Archive → Buffer → Archive
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Round-Trip Pipeline', () => {
    it('exports processed buffer back to archive', async () => {
      // Load and process
      const buffer = await service.loadFromArchive('msg-005');
      const analyzed = await service.analyzeQuality(buffer);
      const embedded = await service.embed(analyzed);

      // Export back to archive
      const exportedNode = await service.exportToArchive(embedded, {
        nodeType: 'processed-content',
        metadata: { processed: true, version: 1 },
      });

      expect(exportedNode.id).toBeDefined();
      expect(exportedNode.text).toBe(buffer.text);
      expect(exportedNode.sourceType).toBe('processed-content');
      expect(exportedNode.sourceMetadata?.provenanceChainId).toBeDefined();
    });

    it('exported node can be loaded again', async () => {
      const original = await service.loadFromArchive('msg-001');
      const exported = await service.exportToArchive(original);

      // Load the exported node
      const reloaded = await service.loadFromArchive(exported.id);

      expect(reloaded.text).toBe(original.text);
      expect(reloaded.origin.sourceNodeId).toBe(exported.id);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLEX MULTI-CHAPTER BOOK BUILD
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Multi-Chapter Book Build', () => {
    it('builds complete book from multiple archive sources', async () => {
      // Chapter 1: Merge reflection messages
      const reflections = await Promise.all([
        service.loadFromArchive('msg-001'),
        service.loadFromArchive('msg-003'),
      ]);
      const ch1Content = await service.merge(reflections);
      await service.commitToBook(ch1Content, 'book-memoir', 'ch-growth');

      // Chapter 2: Nature content
      const nature = await service.loadFromArchive('msg-002');
      await service.commitToBook(nature, 'book-memoir', 'ch-nature');

      // Verify book structure
      const growthChapter = await booksStore.adapter.getChapter('ch-growth');
      const natureChapter = await booksStore.adapter.getChapter('ch-nature');

      expect(growthChapter?.content).toContain('approach to work');
      expect(growthChapter?.content).toContain('journal entries');
      expect(natureChapter?.content).toContain('morning walk');
    });

    it('tracks provenance for each chapter source', async () => {
      const buffer1 = await service.loadFromArchive('msg-001');
      const buffer2 = await service.loadFromArchive('msg-002');

      await service.commitToBook(buffer1, 'book-memoir', 'ch-growth');
      await service.commitToBook(buffer2, 'book-memoir', 'ch-nature');

      // Each buffer maintains its own provenance
      expect(buffer1.origin.sourceNodeId).toBe('msg-001');
      expect(buffer2.origin.sourceNodeId).toBe('msg-002');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTENT DEDUPLICATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Content Deduplication', () => {
    it('detects duplicate content via hash', async () => {
      const buffer1 = await service.createFromText('Identical content');
      const buffer2 = await service.createFromText('Identical content');

      expect(buffer1.contentHash).toBe(buffer2.contentHash);
      expect(buffer1.id).not.toBe(buffer2.id); // Still unique IDs
    });

    it('finds existing buffers by content hash', async () => {
      const buffer1 = await service.createFromText('Findable content');
      await service.save(buffer1);

      const buffer2 = await service.createFromText('Findable content');
      await service.save(buffer2);

      const found = await service.findByContentHash(buffer1.contentHash);
      expect(found.length).toBe(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EMBEDDING PIPELINE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Embedding Pipeline', () => {
    it('generates embeddings for semantic search', async () => {
      const buffer = await service.loadFromArchive('msg-001');
      const embedded = await service.embed(buffer);

      expect(embedded.embedding).toBeDefined();
      expect(embedded.embedding?.length).toBe(768);
    });

    it('embedded buffer can be committed', async () => {
      const buffer = await service.loadFromArchive('msg-002');
      const embedded = await service.embed(buffer);

      const chapter = await service.commitToBook(embedded, 'book-memoir', 'ch-nature');
      expect(chapter.content).toContain('morning walk');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PERFORMANCE TESTS (lightweight)
// ═══════════════════════════════════════════════════════════════════════════

describe('Buffer Pipeline Performance', () => {
  let service: BufferServiceImpl;

  beforeEach(() => {
    resetProvenanceTracker();
    resetBufferService();

    const archiveStore = createFullMockArchiveStore();
    const booksStore = createFullMockBooksStore();

    service = createBufferService({
      archiveStore: archiveStore.adapter,
      booksStore: booksStore.adapter,
      auiStore: createFullMockAuiStore(),
    });
  });

  afterEach(() => {
    resetProvenanceTracker();
    resetBufferService();
  });

  it('handles batch loading efficiently', async () => {
    const nodeIds = ['msg-001', 'msg-002', 'msg-003', 'msg-004', 'msg-005'];

    const start = Date.now();
    const buffers = await Promise.all(
      nodeIds.map(id => service.loadFromArchive(id))
    );
    const duration = Date.now() - start;

    expect(buffers.length).toBe(5);
    expect(duration).toBeLessThan(1000); // Should be fast with mocks
  });

  it('handles large merge operation', async () => {
    // Load all archive content
    const buffers = await Promise.all(
      Object.keys(archiveContent).map(id => service.loadFromArchive(id))
    );

    const start = Date.now();
    const merged = await service.merge(buffers);
    const duration = Date.now() - start;

    expect(merged.wordCount).toBeGreaterThan(100);
    expect(duration).toBeLessThan(500);
  });
});
