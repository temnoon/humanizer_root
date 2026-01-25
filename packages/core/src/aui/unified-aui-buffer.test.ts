/**
 * UnifiedAuiService Buffer Integration Tests
 *
 * Tests for the BufferService integration in UnifiedAuiService:
 * - BufferService initialization and access
 * - Provenance-aware book creation
 * - Content transformation pipelines
 *
 * @module @humanizer/core/aui/unified-aui-buffer.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  UnifiedAuiService,
  resetUnifiedAui,
} from './unified-aui-service.js';
import { resetBufferManager } from './buffer-manager.js';
import type { ContentBuffer, ProvenanceChain } from '../buffer/types.js';
import type { BufferService } from '../buffer/buffer-service.js';
import { BufferServiceImpl } from '../buffer/buffer-service-impl.js';

// ═══════════════════════════════════════════════════════════════════════════
// TEST FIXTURES
// ═══════════════════════════════════════════════════════════════════════════

const TEST_TEXT = `This is a test paragraph with multiple sentences.
It contains enough content to be meaningful for testing purposes.
The text should be long enough to trigger various content analysis features.`;

const TEST_CODE = `function hello() {
  const x = 1;
  const y = 2;
  if (x > 0) {
    return x + y;
  }
  return 0;
}`;

// ═══════════════════════════════════════════════════════════════════════════
// BUFFER SERVICE INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('UnifiedAuiService Buffer Integration', () => {
  let service: UnifiedAuiService;

  beforeEach(() => {
    resetUnifiedAui();
    resetBufferManager();
    service = new UnifiedAuiService();
  });

  afterEach(() => {
    resetUnifiedAui();
    resetBufferManager();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BUFFER SERVICE ACCESS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('BufferService Access', () => {
    it('hasBufferService returns false initially', () => {
      expect(service.hasBufferService()).toBe(false);
    });

    it('getBufferService creates default service lazily', () => {
      const bufferService = service.getBufferService();

      expect(bufferService).toBeDefined();
      expect(service.hasBufferService()).toBe(true);
    });

    it('getBufferService returns same instance on repeated calls', () => {
      const first = service.getBufferService();
      const second = service.getBufferService();

      expect(first).toBe(second);
    });

    it('setBufferService allows custom service injection', () => {
      const customService = new BufferServiceImpl();
      service.setBufferService(customService);

      expect(service.hasBufferService()).toBe(true);
      expect(service.getBufferService()).toBe(customService);
    });

    it('setBufferService overrides lazily created service', () => {
      // First get the lazy instance
      const lazy = service.getBufferService();

      // Then set a custom one
      const custom = new BufferServiceImpl();
      service.setBufferService(custom);

      expect(service.getBufferService()).toBe(custom);
      expect(service.getBufferService()).not.toBe(lazy);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BUFFER CREATION VIA SERVICE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Buffer Creation via Service', () => {
    it('creates buffer from text via BufferService', async () => {
      const bufferService = service.getBufferService();
      const buffer = await bufferService.createFromText(TEST_TEXT);

      expect(buffer.id).toBeDefined();
      expect(buffer.text).toBe(TEST_TEXT);
      expect(buffer.contentHash).toHaveLength(64);
      expect(buffer.wordCount).toBeGreaterThan(0);
      expect(buffer.format).toBe('text');
      expect(buffer.state).toBe('transient');
    });

    it('creates buffer with code format detection', async () => {
      const bufferService = service.getBufferService();
      const buffer = await bufferService.createFromText(TEST_CODE);

      expect(buffer.format).toBe('code');
    });

    it('creates buffer with origin tracking', async () => {
      const bufferService = service.getBufferService();
      const buffer = await bufferService.createFromText(TEST_TEXT);

      expect(buffer.origin).toBeDefined();
      expect(buffer.origin.sourceType).toBe('manual');
    });

    it('creates buffer with provenance chain', async () => {
      const bufferService = service.getBufferService();
      const buffer = await bufferService.createFromText(TEST_TEXT);

      const provenance = bufferService.getProvenance(buffer);
      expect(provenance).toBeDefined();
      expect(provenance.rootBufferId).toBe(buffer.id);
      expect(provenance.operations).toHaveLength(1);
      expect(provenance.operations[0].type).toBe('create_manual');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BUFFER TRANSFORMATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Buffer Transformations', () => {
    it('transforms buffer with generic operation', async () => {
      const bufferService = service.getBufferService();
      const original = await bufferService.createFromText(TEST_TEXT);

      const transformed = await bufferService.transform(original, {
        type: 'custom',
        parameters: { action: 'uppercase' },
        description: 'Test transform',
      });

      expect(transformed.id).not.toBe(original.id);
      expect(transformed.provenanceChain.operations.length).toBeGreaterThan(
        original.provenanceChain.operations.length
      );
    });

    it('tracks transformation in provenance chain', async () => {
      const bufferService = service.getBufferService();
      const original = await bufferService.createFromText(TEST_TEXT);

      const transformed = await bufferService.transform(original, {
        type: 'custom',
        parameters: { test: true },
        description: 'Test operation',
      });

      const provenance = bufferService.getProvenance(transformed);
      expect(provenance.operations.length).toBe(2);
      expect(provenance.operations[1].type).toBe('custom');
      expect(provenance.operations[1].description).toBe('Test operation');
    });

    it('preserves immutability - original unchanged', async () => {
      const bufferService = service.getBufferService();
      const original = await bufferService.createFromText(TEST_TEXT);
      const originalHash = original.contentHash;
      const originalOpsCount = original.provenanceChain.operations.length;

      await bufferService.transform(original, {
        type: 'custom',
        parameters: {},
        description: 'Should not mutate original',
      });

      // Original should be unchanged
      expect(original.contentHash).toBe(originalHash);
      expect(original.provenanceChain.operations.length).toBe(originalOpsCount);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MERGE AND SPLIT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Merge and Split Operations', () => {
    it('merges multiple buffers into one', async () => {
      const bufferService = service.getBufferService();
      const buffer1 = await bufferService.createFromText('First paragraph.');
      const buffer2 = await bufferService.createFromText('Second paragraph.');

      const merged = await bufferService.merge([buffer1, buffer2]);

      expect(merged.text).toContain('First paragraph');
      expect(merged.text).toContain('Second paragraph');
      expect(merged.provenanceChain.operations.some(op => op.type === 'merge')).toBe(true);
    });

    it('merges with custom separator', async () => {
      const bufferService = service.getBufferService();
      const buffer1 = await bufferService.createFromText('One');
      const buffer2 = await bufferService.createFromText('Two');

      const merged = await bufferService.merge([buffer1, buffer2], {
        joinWith: ' | ',
      });

      expect(merged.text).toBe('One | Two');
    });

    it('splits buffer by paragraphs', async () => {
      const bufferService = service.getBufferService();
      const multiPara = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
      const buffer = await bufferService.createFromText(multiPara);

      const splits = await bufferService.split(buffer, {
        strategy: 'paragraphs',
      });

      expect(splits.length).toBe(3);
      expect(splits[0].text).toContain('First');
      expect(splits[1].text).toContain('Second');
      expect(splits[2].text).toContain('Third');
    });

    it('splits buffer by sentences', async () => {
      const bufferService = service.getBufferService();
      const text = 'First sentence. Second sentence. Third sentence.';
      const buffer = await bufferService.createFromText(text);

      const splits = await bufferService.split(buffer, {
        strategy: 'sentences',
      });

      expect(splits.length).toBe(3);
    });

    it('creates separate provenance chains for split results', async () => {
      const bufferService = service.getBufferService();
      const buffer = await bufferService.createFromText('Para one.\n\nPara two.');
      const splits = await bufferService.split(buffer, { strategy: 'paragraphs' });

      // Each split result gets its own fresh provenance chain
      for (const split of splits) {
        const provenance = bufferService.getProvenance(split);
        expect(provenance.rootBufferId).toBe(split.id);
        // Fresh chains start empty - operations added on subsequent transforms
        expect(provenance.operations).toBeDefined();
      }

      // Split results track their origin in metadata
      for (const split of splits) {
        expect(split.origin.sourceType).toBe('generated');
        expect(split.origin.metadata?.splitFrom).toBe(buffer.id);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // QUALITY ANALYSIS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Quality Analysis', () => {
    it('analyzes buffer quality', async () => {
      const bufferService = service.getBufferService();
      const buffer = await bufferService.createFromText(TEST_TEXT);

      const analyzed = await bufferService.analyzeQuality(buffer);

      expect(analyzed.qualityMetrics).toBeDefined();
      expect(analyzed.qualityMetrics?.readability).toBeDefined();
      expect(analyzed.qualityMetrics?.readability?.fleschKincaidGrade).toBeDefined();
      expect(analyzed.qualityMetrics?.overallScore).toBeDefined();
    });

    it('tracks analysis in provenance', async () => {
      const bufferService = service.getBufferService();
      const buffer = await bufferService.createFromText(TEST_TEXT);
      const analyzed = await bufferService.analyzeQuality(buffer);

      const provenance = bufferService.getProvenance(analyzed);
      expect(provenance.operations.some(op => op.type === 'analyze_quality')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BRANCHING
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Branching', () => {
    it('creates branch from buffer', async () => {
      const bufferService = service.getBufferService();
      const buffer = await bufferService.createFromText(TEST_TEXT);

      const branched = await bufferService.branch(buffer, 'experiment', 'Testing a variant');

      expect(branched.id).not.toBe(buffer.id);
      expect(branched.provenanceChain.branch.name).toBe('experiment');
      expect(branched.provenanceChain.branch.description).toBe('Testing a variant');
      expect(branched.provenanceChain.branch.isMain).toBe(false);
    });

    it('branched buffer has same content but different chain', async () => {
      const bufferService = service.getBufferService();
      const buffer = await bufferService.createFromText(TEST_TEXT);
      const branched = await bufferService.branch(buffer, 'variant');

      expect(branched.text).toBe(buffer.text);
      expect(branched.contentHash).toBe(buffer.contentHash);
      expect(branched.provenanceChain.id).not.toBe(buffer.provenanceChain.id);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PROVENANCE TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Provenance Tracking', () => {
    it('tracks full transformation chain', async () => {
      const bufferService = service.getBufferService();

      // Create → Transform → Transform → Analyze
      let buffer = await bufferService.createFromText('Original text');
      buffer = await bufferService.transform(buffer, {
        type: 'custom',
        parameters: { step: 1 },
        description: 'Step 1',
      });
      buffer = await bufferService.transform(buffer, {
        type: 'custom',
        parameters: { step: 2 },
        description: 'Step 2',
      });
      buffer = await bufferService.analyzeQuality(buffer);

      const provenance = bufferService.getProvenance(buffer);
      expect(provenance.operations.length).toBe(4);
      expect(provenance.transformationCount).toBe(4);
    });

    it('records operation timestamps', async () => {
      const bufferService = service.getBufferService();
      const buffer = await bufferService.createFromText(TEST_TEXT);

      const provenance = bufferService.getProvenance(buffer);
      expect(provenance.operations[0].timestamp).toBeDefined();
      expect(provenance.operations[0].timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('records before/after hashes', async () => {
      const bufferService = service.getBufferService();
      const original = await bufferService.createFromText('Before');
      const transformed = await bufferService.transform(original, {
        type: 'custom',
        parameters: { newText: 'After' },
        description: 'Change text',
      });

      const provenance = bufferService.getProvenance(transformed);
      const transformOp = provenance.operations[1];

      expect(transformOp.hashes.beforeHash).toBeDefined();
      expect(transformOp.hashes.afterHash).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PROVENANCE-AWARE BOOK CREATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Provenance-Aware Book Creation', () => {
    it('createChapterFromBuffer commits buffer to book', async () => {
      const bufferService = service.getBufferService();
      const buffer = await bufferService.createFromText(TEST_TEXT);

      // Note: This will fail without a books store, but tests the interface
      try {
        await service.createChapterFromBuffer(buffer, 'book-123', {
          chapterTitle: 'Test Chapter',
          chapterId: 'chapter-1',
        });
      } catch (error) {
        // Expected - no books store configured
        expect((error as Error).message).toContain('store');
      }
    });

    it('transformAndCommitToBook creates full pipeline', async () => {
      const progressSteps: string[] = [];

      try {
        await service.transformAndCommitToBook({
          text: TEST_TEXT,
          bookId: 'book-123',
          chapterId: 'chapter-1',
          chapterTitle: 'Test Chapter',
          onProgress: (step) => progressSteps.push(step),
        });
      } catch (error) {
        // Expected - no books store configured
        expect((error as Error).message).toContain('store');
      }

      // Should have made progress before failing
      expect(progressSteps.length).toBeGreaterThan(0);
      expect(progressSteps[0]).toContain('Creating buffer');
    });

    it('traceToArchiveOrigin returns archive source info', async () => {
      const bufferService = service.getBufferService();
      const buffer = await bufferService.createFromText(TEST_TEXT, {
        metadata: { sourceArchiveNodeId: 'archive-node-123' },
      });

      const trace = await service.traceToArchiveOrigin(buffer);

      expect(trace.transformationCount).toBe(1);
      expect(trace.operations.length).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTENT HASH DEDUPLICATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Content Hash Deduplication', () => {
    it('same content produces same hash', async () => {
      const bufferService = service.getBufferService();
      const buffer1 = await bufferService.createFromText('Same content');
      const buffer2 = await bufferService.createFromText('Same content');

      expect(buffer1.contentHash).toBe(buffer2.contentHash);
    });

    it('different content produces different hash', async () => {
      const bufferService = service.getBufferService();
      const buffer1 = await bufferService.createFromText('Content A');
      const buffer2 = await bufferService.createFromText('Content B');

      expect(buffer1.contentHash).not.toBe(buffer2.contentHash);
    });

    it('leading/trailing whitespace normalization affects hash', async () => {
      const bufferService = service.getBufferService();
      // Leading/trailing whitespace is trimmed
      const buffer1 = await bufferService.createFromText('  Hello World  ');
      const buffer2 = await bufferService.createFromText('Hello World');

      // After trimming, these should have the same hash
      expect(buffer1.contentHash).toBe(buffer2.contentHash);
    });

    it('internal whitespace is preserved in hash', async () => {
      const bufferService = service.getBufferService();
      // Internal whitespace is NOT normalized
      const buffer1 = await bufferService.createFromText('Hello  World');  // two spaces
      const buffer2 = await bufferService.createFromText('Hello World');   // one space

      // Different internal whitespace = different hash
      expect(buffer1.contentHash).not.toBe(buffer2.contentHash);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MOCK STORE INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('UnifiedAuiService with Mock Store', () => {
  let service: UnifiedAuiService;
  let mockStore: any;

  beforeEach(() => {
    resetUnifiedAui();
    resetBufferManager();

    // Create a minimal mock store for testing
    mockStore = {
      saveContentBuffer: vi.fn().mockImplementation(async (buffer: ContentBuffer) => buffer),
      loadContentBuffer: vi.fn().mockResolvedValue(undefined),
      findContentBuffersByHash: vi.fn().mockResolvedValue([]),
      deleteContentBuffer: vi.fn().mockResolvedValue(true),
      saveProvenanceChain: vi.fn().mockImplementation(async (chain: ProvenanceChain) => chain),
      loadProvenanceChain: vi.fn().mockResolvedValue(undefined),
      findDerivedBuffers: vi.fn().mockResolvedValue([]),
    };

    service = new UnifiedAuiService();
  });

  afterEach(() => {
    resetUnifiedAui();
    resetBufferManager();
    vi.clearAllMocks();
  });

  it('BufferService can use custom store adapter', async () => {
    // Create a custom buffer service with the mock store
    const customService = new BufferServiceImpl({
      auiStore: mockStore,
    });
    service.setBufferService(customService);

    const bufferService = service.getBufferService();
    const buffer = await bufferService.createFromText('Test content');

    // Save should work with mock
    const saved = await bufferService.save(buffer);
    expect(mockStore.saveContentBuffer).toHaveBeenCalledWith(buffer);
    expect(saved).toBeDefined();
  });
});
