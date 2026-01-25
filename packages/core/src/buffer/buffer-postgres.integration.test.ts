/**
 * Buffer System PostgreSQL Integration Tests
 *
 * Tests end-to-end persistence of ContentBuffers and ProvenanceChains
 * using real PostgreSQL database connections.
 *
 * These tests require:
 * - PostgreSQL server running with AUI schema
 * - Environment variable: TEST_AUI_DATABASE_URL
 *
 * To run:
 *   TEST_AUI_DATABASE_URL=postgres://... npx vitest run src/buffer/buffer-postgres.integration.test.ts
 *
 * Skip with: npx vitest run --exclude "**\/buffer-postgres.integration.test.ts"
 *
 * @module @humanizer/core/buffer/buffer-postgres.integration.test
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import pg from 'pg';
import { AuiPostgresStore, resetAuiStore } from '../storage/aui-postgres-store.js';
import { BufferServiceImpl } from './buffer-service-impl.js';
import type { BufferService, AuiStoreAdapter } from './buffer-service.js';
import type { ContentBuffer, ProvenanceChain } from './types.js';

const { Pool } = pg;

// ═══════════════════════════════════════════════════════════════════════════
// TEST CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const TEST_DATABASE_URL = process.env.TEST_AUI_DATABASE_URL;
const RUN_POSTGRES_TESTS = !!TEST_DATABASE_URL;

// Skip tests if no database URL is provided
const describePostgres = RUN_POSTGRES_TESTS ? describe : describe.skip;

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function createAuiStoreAdapter(store: AuiPostgresStore): AuiStoreAdapter {
  return {
    saveContentBuffer: (buffer: ContentBuffer) => store.saveContentBuffer(buffer),
    loadContentBuffer: (id: string) => store.loadContentBuffer(id),
    findContentBuffersByHash: (hash: string) => store.findContentBuffersByHash(hash),
    deleteContentBuffer: (id: string) => store.deleteContentBuffer(id),
    saveProvenanceChain: (chain: ProvenanceChain) => store.saveProvenanceChain(chain),
    loadProvenanceChain: (id: string) => store.loadProvenanceChain(id),
    findDerivedBuffers: async (_rootBufferId: string) => [],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// POSTGRES INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describePostgres('Buffer PostgreSQL Integration', () => {
  let pool: pg.Pool;
  let store: AuiPostgresStore;
  let bufferService: BufferService;

  beforeAll(async () => {
    // Initialize pool with test database
    pool = new Pool({
      connectionString: TEST_DATABASE_URL,
    });

    // Verify connection works
    await pool.query('SELECT 1');

    // Create store and buffer service
    store = new AuiPostgresStore(pool);
    bufferService = new BufferServiceImpl({
      auiStore: createAuiStoreAdapter(store),
    });
  });

  afterAll(async () => {
    await pool.end();
    resetAuiStore();
  });

  // Clean up test data between tests
  afterEach(async () => {
    // Note: In a real implementation, we'd clean up test buffers
    // For now, tests use unique IDs and don't conflict
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BUFFER PERSISTENCE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Buffer Persistence', () => {
    it('saves and loads a buffer', async () => {
      const buffer = await bufferService.createFromText('Test content for persistence');
      const saved = await bufferService.save(buffer);

      expect(saved.id).toBe(buffer.id);

      const loaded = await bufferService.load(buffer.id);
      expect(loaded).toBeDefined();
      expect(loaded?.text).toBe(buffer.text);
      expect(loaded?.contentHash).toBe(buffer.contentHash);
    });

    it('finds buffers by content hash', async () => {
      const content = `Unique content ${Date.now()}`;
      const buffer = await bufferService.createFromText(content);
      await bufferService.save(buffer);

      const found = await bufferService.findByContentHash(buffer.contentHash);
      expect(found.length).toBeGreaterThan(0);
      expect(found[0].text).toBe(content);
    });

    it('deletes a buffer', async () => {
      const buffer = await bufferService.createFromText('Buffer to delete');
      await bufferService.save(buffer);

      const deleted = await bufferService.delete(buffer.id);
      expect(deleted).toBe(true);

      const loaded = await bufferService.load(buffer.id);
      expect(loaded).toBeUndefined();
    });

    it('preserves buffer metadata across save/load', async () => {
      const buffer = await bufferService.createFromText('Metadata test', {
        format: 'markdown',
        author: 'test-user',
        metadata: { customField: 'value' },
      });
      await bufferService.save(buffer);

      const loaded = await bufferService.load(buffer.id);
      expect(loaded?.format).toBe('markdown');
      expect(loaded?.origin.author).toBe('test-user');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PROVENANCE CHAIN PERSISTENCE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Provenance Chain Persistence', () => {
    it('saves and loads provenance chain', async () => {
      const buffer = await bufferService.createFromText('Provenance test');
      await bufferService.save(buffer);

      const provenance = bufferService.getProvenance(buffer);
      expect(provenance.operations.length).toBe(1);

      // Load from database
      const loaded = await bufferService.load(buffer.id);
      const loadedProvenance = bufferService.getProvenance(loaded!);

      expect(loadedProvenance.id).toBe(provenance.id);
      expect(loadedProvenance.operations.length).toBe(provenance.operations.length);
    });

    it('preserves transformation chain across save/load', async () => {
      let buffer = await bufferService.createFromText('Original text');

      // Apply transformations
      buffer = await bufferService.transform(buffer, {
        type: 'transform_custom',
        parameters: { step: 1 },
        description: 'First transform',
      });

      buffer = await bufferService.transform(buffer, {
        type: 'transform_custom',
        parameters: { step: 2 },
        description: 'Second transform',
      });

      // Save and reload
      await bufferService.save(buffer);
      const loaded = await bufferService.load(buffer.id);

      const provenance = bufferService.getProvenance(loaded!);
      expect(provenance.operations.length).toBe(3); // create + 2 transforms
      expect(provenance.transformationCount).toBe(3);
    });

    it('records operation details in provenance', async () => {
      const buffer = await bufferService.createFromText('Detailed provenance test');
      await bufferService.save(buffer);

      const loaded = await bufferService.load(buffer.id);
      const provenance = bufferService.getProvenance(loaded!);

      const createOp = provenance.operations[0];
      expect(createOp.type).toBe('create_manual');
      expect(createOp.timestamp).toBeDefined();
      expect(createOp.hashes.afterHash).toBe(buffer.contentHash);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FULL PIPELINE PERSISTENCE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Full Pipeline Persistence', () => {
    it('persists complete transformation pipeline', async () => {
      // Create buffer
      let buffer = await bufferService.createFromText('Pipeline source content');

      // Analyze quality
      buffer = await bufferService.analyzeQuality(buffer);

      // Save intermediate state
      await bufferService.save(buffer);

      // Reload and continue
      const reloaded = await bufferService.load(buffer.id);
      expect(reloaded).toBeDefined();
      expect(reloaded?.qualityMetrics).toBeDefined();

      // Transform the reloaded buffer
      const transformed = await bufferService.transform(reloaded!, {
        type: 'transform_custom',
        parameters: { action: 'continue' },
        description: 'Post-reload transform',
      });

      await bufferService.save(transformed);

      // Verify full chain
      const final = await bufferService.load(transformed.id);
      const provenance = bufferService.getProvenance(final!);
      expect(provenance.operations.length).toBe(3); // create + analyze + transform
    });

    it('handles branching with persistence', async () => {
      const buffer = await bufferService.createFromText('Branch source');
      await bufferService.save(buffer);

      // Create branch
      const branched = await bufferService.branch(buffer, 'experiment', 'Testing branch');
      await bufferService.save(branched);

      // Verify branch persisted correctly
      const loaded = await bufferService.load(branched.id);
      expect(loaded?.provenanceChain.branch.name).toBe('experiment');
      expect(loaded?.provenanceChain.branch.isMain).toBe(false);
    });

    it('persists split results independently', async () => {
      const buffer = await bufferService.createFromText('Part one.\n\nPart two.');
      const splits = await bufferService.split(buffer, { strategy: 'paragraphs' });

      // Save all splits
      for (const split of splits) {
        await bufferService.save(split);
      }

      // Verify each split can be loaded independently
      for (const split of splits) {
        const loaded = await bufferService.load(split.id);
        expect(loaded).toBeDefined();
        expect(loaded?.origin.sourceType).toBe('generated');
      }
    });

    it('persists merged buffer with source tracking', async () => {
      const buffer1 = await bufferService.createFromText('First part');
      const buffer2 = await bufferService.createFromText('Second part');
      await bufferService.save(buffer1);
      await bufferService.save(buffer2);

      const merged = await bufferService.merge([buffer1, buffer2]);
      await bufferService.save(merged);

      const loaded = await bufferService.load(merged.id);
      expect(loaded?.text).toContain('First part');
      expect(loaded?.text).toContain('Second part');

      const provenance = bufferService.getProvenance(loaded!);
      const mergeOp = provenance.operations.find(op => op.type === 'merge');
      expect(mergeOp).toBeDefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MOCK TESTS (Run always)
// ═══════════════════════════════════════════════════════════════════════════

describe('Buffer Persistence (Mock)', () => {
  it('shows test configuration', () => {
    if (RUN_POSTGRES_TESTS) {
      console.log('PostgreSQL tests ENABLED - using:', TEST_DATABASE_URL?.replace(/:[^:]*@/, ':****@'));
    } else {
      console.log('PostgreSQL tests SKIPPED - set TEST_AUI_DATABASE_URL to enable');
    }
    expect(true).toBe(true);
  });
});
