/**
 * Provenance Tracker Unit Tests
 *
 * Tests for provenance chain management and operation tracking.
 *
 * @module @humanizer/core/buffer/provenance-tracker.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ProvenanceTracker,
  createProvenanceChain,
  createBranch,
  createOperation,
  addOperation,
  createLoadOperation,
  createRewriteOperation,
  createMergeOperation,
  createSplitOperation,
  createAnalyzeOperation,
  createCommitOperation,
  createExportOperation,
  createEmbedOperation,
  getProvenanceTracker,
  resetProvenanceTracker,
} from './provenance-tracker.js';
import type { ProvenanceChain, BufferOperation } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════
// TEST FIXTURES
// ═══════════════════════════════════════════════════════════════════════════

const testPerformer = { type: 'system' as const, id: 'test' };
const testHash1 = 'abc123def456';
const testHash2 = 'xyz789uvw012';

// ═══════════════════════════════════════════════════════════════════════════
// CHAIN CREATION
// ═══════════════════════════════════════════════════════════════════════════

describe('createProvenanceChain', () => {
  it('creates a chain with correct root buffer', () => {
    const chain = createProvenanceChain('buffer-123');

    expect(chain.rootBufferId).toBe('buffer-123');
    expect(chain.currentBufferId).toBe('buffer-123');
    expect(chain.id).toBeDefined();
  });

  it('defaults to main branch', () => {
    const chain = createProvenanceChain('buffer-123');

    expect(chain.branch.name).toBe('main');
    expect(chain.branch.isMain).toBe(true);
  });

  it('accepts custom branch name', () => {
    const chain = createProvenanceChain('buffer-123', 'experiment');

    expect(chain.branch.name).toBe('experiment');
    expect(chain.branch.isMain).toBe(false);
  });

  it('initializes with empty operations', () => {
    const chain = createProvenanceChain('buffer-123');

    expect(chain.operations).toEqual([]);
    expect(chain.transformationCount).toBe(0);
  });

  it('initializes with empty child chains', () => {
    const chain = createProvenanceChain('buffer-123');

    expect(chain.childChainIds).toEqual([]);
    expect(chain.parentChainId).toBeUndefined();
  });
});

describe('createBranch', () => {
  it('creates branch from parent chain', () => {
    const parent = createProvenanceChain('buffer-123');
    const branch = createBranch(parent, 'feature');

    expect(branch.branch.name).toBe('feature');
    expect(branch.branch.isMain).toBe(false);
    expect(branch.parentChainId).toBe(parent.id);
  });

  it('starts from parent current buffer', () => {
    const parent = createProvenanceChain('buffer-123');
    const branch = createBranch(parent, 'feature');

    expect(branch.rootBufferId).toBe(parent.currentBufferId);
  });

  it('accepts optional description', () => {
    const parent = createProvenanceChain('buffer-123');
    const branch = createBranch(parent, 'feature', 'Testing a new approach');

    expect(branch.branch.description).toBe('Testing a new approach');
  });

  it('starts with empty operations', () => {
    const parent = createProvenanceChain('buffer-123');
    const branch = createBranch(parent, 'feature');

    expect(branch.operations).toEqual([]);
    expect(branch.transformationCount).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// OPERATION CREATION
// ═══════════════════════════════════════════════════════════════════════════

describe('createOperation', () => {
  it('creates operation with all required fields', () => {
    const op = createOperation(
      'rewrite_persona',
      testPerformer,
      testHash1,
      testHash2,
      'Test operation'
    );

    expect(op.id).toBeDefined();
    expect(op.type).toBe('rewrite_persona');
    expect(op.performer).toEqual(testPerformer);
    expect(op.hashes.beforeHash).toBe(testHash1);
    expect(op.hashes.afterHash).toBe(testHash2);
    expect(op.description).toBe('Test operation');
    expect(op.timestamp).toBeDefined();
  });

  it('computes delta hash', () => {
    const op = createOperation(
      'rewrite_persona',
      testPerformer,
      testHash1,
      testHash2,
      'Test operation'
    );

    expect(op.hashes.deltaHash).toBeDefined();
    expect(op.hashes.deltaHash).toHaveLength(64);
  });

  it('accepts optional parameters', () => {
    const op = createOperation(
      'rewrite_persona',
      testPerformer,
      testHash1,
      testHash2,
      'Test operation',
      { personaId: 'persona-123', styleId: 'style-456' }
    );

    expect(op.parameters.personaId).toBe('persona-123');
    expect(op.parameters.styleId).toBe('style-456');
  });

  it('accepts optional quality impact', () => {
    const qualityImpact = {
      scoreChange: 0.1,
      metricsAffected: ['readability'],
      issuesFixed: ['ai_tell_1'],
      issuesIntroduced: [],
    };

    const op = createOperation(
      'analyze_quality',
      testPerformer,
      testHash1,
      testHash1,
      'Quality analysis',
      {},
      { qualityImpact }
    );

    expect(op.qualityImpact).toEqual(qualityImpact);
  });

  it('accepts optional duration and cost', () => {
    const op = createOperation(
      'rewrite_persona',
      testPerformer,
      testHash1,
      testHash2,
      'Test operation',
      {},
      { durationMs: 500, costCents: 10 }
    );

    expect(op.durationMs).toBe(500);
    expect(op.costCents).toBe(10);
  });
});

describe('addOperation', () => {
  it('adds operation to chain immutably', () => {
    const chain = createProvenanceChain('buffer-1');
    const op = createOperation('load_archive', testPerformer, '', testHash1, 'Load');

    const newChain = addOperation(chain, op, 'buffer-2');

    expect(newChain).not.toBe(chain);
    expect(newChain.operations).toHaveLength(1);
    expect(chain.operations).toHaveLength(0); // Original unchanged
  });

  it('updates current buffer ID', () => {
    const chain = createProvenanceChain('buffer-1');
    const op = createOperation('load_archive', testPerformer, '', testHash1, 'Load');

    const newChain = addOperation(chain, op, 'buffer-2');

    expect(newChain.currentBufferId).toBe('buffer-2');
    expect(chain.currentBufferId).toBe('buffer-1'); // Original unchanged
  });

  it('increments transformation count', () => {
    const chain = createProvenanceChain('buffer-1');
    const op = createOperation('load_archive', testPerformer, '', testHash1, 'Load');

    const newChain = addOperation(chain, op, 'buffer-2');

    expect(newChain.transformationCount).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// OPERATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

describe('createLoadOperation', () => {
  it('creates archive load operation', () => {
    const op = createLoadOperation('archive', 'node-123', testHash1, testPerformer);

    expect(op.type).toBe('load_archive');
    expect(op.hashes.beforeHash).toBe('');
    expect(op.hashes.afterHash).toBe(testHash1);
    expect(op.description).toContain('archive');
    expect(op.parameters.sourceNodeId).toBe('node-123');
  });

  it('creates book load operation', () => {
    const op = createLoadOperation('book', 'chapter-456', testHash1, testPerformer);

    expect(op.type).toBe('load_book');
    expect(op.description).toContain('book');
  });
});

describe('createRewriteOperation', () => {
  it('creates rewrite operation with persona details', () => {
    const op = createRewriteOperation(
      testHash1,
      testHash2,
      'persona-123',
      'style-456',
      ['removed cliches', 'improved flow'],
      testPerformer
    );

    expect(op.type).toBe('rewrite_persona');
    expect(op.parameters.personaId).toBe('persona-123');
    expect(op.parameters.styleId).toBe('style-456');
    expect(op.parameters.changesApplied).toEqual(['removed cliches', 'improved flow']);
  });

  it('handles undefined style', () => {
    const op = createRewriteOperation(
      testHash1,
      testHash2,
      'persona-123',
      undefined,
      [],
      testPerformer
    );

    expect(op.parameters.styleId).toBeUndefined();
  });
});

describe('createMergeOperation', () => {
  it('creates merge operation with source buffers', () => {
    const op = createMergeOperation(
      ['buffer-1', 'buffer-2', 'buffer-3'],
      testHash1,
      testPerformer
    );

    expect(op.type).toBe('merge');
    expect(op.parameters.sourceBufferIds).toEqual(['buffer-1', 'buffer-2', 'buffer-3']);
    expect(op.description).toContain('3');
  });
});

describe('createSplitOperation', () => {
  it('creates split operation with result hashes', () => {
    const op = createSplitOperation(
      testHash1,
      ['hash-1', 'hash-2'],
      'paragraphs',
      testPerformer
    );

    expect(op.type).toBe('split');
    expect(op.parameters.resultHashes).toEqual(['hash-1', 'hash-2']);
    expect(op.parameters.strategy).toBe('paragraphs');
  });
});

describe('createAnalyzeOperation', () => {
  it('creates analyze operation with quality impact', () => {
    const qualityImpact = {
      scoreChange: 0.05,
      metricsAffected: ['readability', 'voice'],
      issuesFixed: [],
      issuesIntroduced: [],
    };

    const op = createAnalyzeOperation(testHash1, qualityImpact, testPerformer, 100);

    expect(op.type).toBe('analyze_quality');
    expect(op.hashes.beforeHash).toBe(testHash1);
    expect(op.hashes.afterHash).toBe(testHash1); // Analysis doesn't change content
    expect(op.qualityImpact).toEqual(qualityImpact);
    expect(op.durationMs).toBe(100);
  });
});

describe('createCommitOperation', () => {
  it('creates commit operation with book details', () => {
    const op = createCommitOperation(testHash1, 'book-123', 'chapter-456', testPerformer);

    expect(op.type).toBe('commit_book');
    expect(op.parameters.bookId).toBe('book-123');
    expect(op.parameters.chapterId).toBe('chapter-456');
  });
});

describe('createExportOperation', () => {
  it('creates export operation with archive node ID', () => {
    const op = createExportOperation(testHash1, 'node-789', testPerformer);

    expect(op.type).toBe('export_archive');
    expect(op.parameters.archiveNodeId).toBe('node-789');
  });
});

describe('createEmbedOperation', () => {
  it('creates embed operation with dimension', () => {
    const op = createEmbedOperation(testHash1, 768, testPerformer, 250);

    expect(op.type).toBe('embed');
    expect(op.parameters.embeddingDimension).toBe(768);
    expect(op.durationMs).toBe(250);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PROVENANCE TRACKER CLASS
// ═══════════════════════════════════════════════════════════════════════════

describe('ProvenanceTracker', () => {
  let tracker: ProvenanceTracker;

  beforeEach(() => {
    resetProvenanceTracker();
    tracker = new ProvenanceTracker();
  });

  afterEach(() => {
    tracker.clear();
  });

  describe('createChain', () => {
    it('creates and stores a new chain', () => {
      const chain = tracker.createChain('buffer-1');

      expect(chain.rootBufferId).toBe('buffer-1');
      expect(tracker.getChain(chain.id)).toBe(chain);
    });

    it('links buffer to chain', () => {
      const chain = tracker.createChain('buffer-1');
      const found = tracker.getChainForBuffer('buffer-1');

      expect(found).toBe(chain);
    });
  });

  describe('recordOperation', () => {
    it('records operation and updates chain', () => {
      const chain = tracker.createChain('buffer-1');
      const op = createOperation('load_archive', testPerformer, '', testHash1, 'Load');

      const updated = tracker.recordOperation(chain.id, op, 'buffer-2');

      expect(updated.operations).toHaveLength(1);
      expect(updated.currentBufferId).toBe('buffer-2');
    });

    it('links new buffer to chain', () => {
      const chain = tracker.createChain('buffer-1');
      const op = createOperation('load_archive', testPerformer, '', testHash1, 'Load');

      tracker.recordOperation(chain.id, op, 'buffer-2');
      const found = tracker.getChainForBuffer('buffer-2');

      expect(found?.id).toBe(chain.id);
    });

    it('throws for unknown chain', () => {
      const op = createOperation('load_archive', testPerformer, '', testHash1, 'Load');

      expect(() => tracker.recordOperation('unknown', op, 'buffer-2')).toThrow();
    });
  });

  describe('createBranch', () => {
    it('creates branch and links to parent', () => {
      const parent = tracker.createChain('buffer-1');
      const branch = tracker.createBranch(parent.id, 'feature');

      expect(branch.parentChainId).toBe(parent.id);
    });

    it('updates parent child chain IDs', () => {
      const parent = tracker.createChain('buffer-1');
      const branch = tracker.createBranch(parent.id, 'feature');

      const updatedParent = tracker.getChain(parent.id);
      expect(updatedParent?.childChainIds).toContain(branch.id);
    });

    it('throws for unknown parent chain', () => {
      expect(() => tracker.createBranch('unknown', 'feature')).toThrow();
    });
  });

  describe('traceToRoot', () => {
    it('returns root buffer for chain without parent', () => {
      const chain = tracker.createChain('buffer-1');
      const op = createOperation('load_archive', testPerformer, '', testHash1, 'Load');
      tracker.recordOperation(chain.id, op, 'buffer-2');

      const root = tracker.traceToRoot(chain.id);

      expect(root).toBe('buffer-1');
    });

    it('follows parent chain to find root', () => {
      const parent = tracker.createChain('buffer-1');
      const op = createOperation('load_archive', testPerformer, '', testHash1, 'Load');
      tracker.recordOperation(parent.id, op, 'buffer-2');

      const branch = tracker.createBranch(parent.id, 'feature');
      const root = tracker.traceToRoot(branch.id);

      expect(root).toBe('buffer-1');
    });
  });

  describe('getFullHistory', () => {
    it('returns operations from chain', () => {
      const chain = tracker.createChain('buffer-1');
      const op1 = createOperation('load_archive', testPerformer, '', testHash1, 'Load');
      const op2 = createOperation('rewrite_persona', testPerformer, testHash1, testHash2, 'Rewrite');

      tracker.recordOperation(chain.id, op1, 'buffer-2');
      tracker.recordOperation(chain.id, op2, 'buffer-3');

      const history = tracker.getFullHistory(chain.id);

      expect(history).toHaveLength(2);
    });

    it('includes parent chain operations', () => {
      const parent = tracker.createChain('buffer-1');
      const op1 = createOperation('load_archive', testPerformer, '', testHash1, 'Load');
      tracker.recordOperation(parent.id, op1, 'buffer-2');

      const branch = tracker.createBranch(parent.id, 'feature');
      const op2 = createOperation('rewrite_persona', testPerformer, testHash1, testHash2, 'Rewrite');
      tracker.recordOperation(branch.id, op2, 'buffer-3');

      const history = tracker.getFullHistory(branch.id);

      expect(history).toHaveLength(2);
    });
  });

  describe('export/import', () => {
    it('exports all chains', () => {
      tracker.createChain('buffer-1');
      tracker.createChain('buffer-2');

      const exported = tracker.export();

      expect(exported).toHaveLength(2);
    });

    it('imports chains', () => {
      const chain1 = createProvenanceChain('buffer-1');
      const chain2 = createProvenanceChain('buffer-2');

      tracker.import([chain1, chain2]);

      expect(tracker.getChain(chain1.id)).toEqual(chain1);
      expect(tracker.getChain(chain2.id)).toEqual(chain2);
    });
  });

  describe('clear', () => {
    it('removes all chains', () => {
      const chain = tracker.createChain('buffer-1');
      tracker.clear();

      expect(tracker.getChain(chain.id)).toBeUndefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

describe('Singleton management', () => {
  afterEach(() => {
    resetProvenanceTracker();
  });

  it('getProvenanceTracker returns same instance', () => {
    const tracker1 = getProvenanceTracker();
    const tracker2 = getProvenanceTracker();

    expect(tracker1).toBe(tracker2);
  });

  it('resetProvenanceTracker clears singleton', () => {
    const tracker1 = getProvenanceTracker();
    tracker1.createChain('buffer-1');

    resetProvenanceTracker();
    const tracker2 = getProvenanceTracker();

    expect(tracker2.export()).toHaveLength(0);
  });
});
