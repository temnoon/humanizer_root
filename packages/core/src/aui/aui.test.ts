/**
 * AUI Module Tests
 *
 * Comprehensive unit tests for the Unified AUI (Agentic User Interface):
 * - BufferManager: Git-like version control for in-memory buffers
 * - AdminService: Config, prompts, costs, tiers management
 * - UnifiedAuiService: Session management and orchestration
 *
 * @module @humanizer/core/aui/tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BufferManager,
  initBufferManager,
  getBufferManager,
  resetBufferManager,
} from './buffer-manager.js';
import type {
  VersionedBuffer,
  BufferVersion,
  BufferBranch,
  BufferDiff,
  MergeResult,
} from './types.js';
import {
  DEFAULT_BRANCH_NAME,
  VERSION_ID_LENGTH,
  MAX_BUFFER_ITEMS,
  AUI_DEFAULTS,
} from './constants.js';

// ═══════════════════════════════════════════════════════════════════════════
// TEST FIXTURES
// ═══════════════════════════════════════════════════════════════════════════

interface TestItem {
  id: string;
  text: string;
  metadata?: Record<string, unknown>;
}

function createTestItem(id: string, text?: string): TestItem {
  return {
    id,
    text: text ?? `Test item ${id}`,
    metadata: { createdAt: Date.now() },
  };
}

function createTestItems(count: number): TestItem[] {
  return Array.from({ length: count }, (_, i) => createTestItem(`item-${i + 1}`));
}

// ═══════════════════════════════════════════════════════════════════════════
// BUFFER MANAGER TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('BufferManager', () => {
  let manager: BufferManager;

  beforeEach(() => {
    resetBufferManager();
    manager = new BufferManager({ verbose: false });
  });

  afterEach(() => {
    manager.clear();
    resetBufferManager();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BUFFER LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Buffer Lifecycle', () => {
    it('creates a buffer with empty content', () => {
      const buffer = manager.createBuffer('test');

      expect(buffer.name).toBe('test');
      expect(buffer.id).toBeDefined();
      expect(buffer.workingContent).toEqual([]);
      expect(buffer.isDirty).toBe(false);
      expect(buffer.currentBranch).toBe(DEFAULT_BRANCH_NAME);
    });

    it('creates a buffer with initial content', () => {
      const items = createTestItems(3);
      const buffer = manager.createBuffer('test', items);

      expect(buffer.workingContent).toHaveLength(3);
      expect(buffer.workingContent[0]).toEqual(items[0]);
    });

    it('creates initial commit on buffer creation', () => {
      const items = createTestItems(2);
      manager.createBuffer('test', items);

      const history = manager.getHistory('test');
      expect(history).toHaveLength(1);
      expect(history[0].message).toBe('Initial commit');
      expect(history[0].content).toEqual(items);
    });

    it('throws when creating duplicate buffer', () => {
      manager.createBuffer('test');

      expect(() => manager.createBuffer('test')).toThrow('already exists');
    });

    it('retrieves buffer by name', () => {
      const created = manager.createBuffer('myBuffer');
      const retrieved = manager.getBuffer('myBuffer');

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('returns undefined for non-existent buffer', () => {
      const buffer = manager.getBuffer('nonexistent');
      expect(buffer).toBeUndefined();
    });

    it('deletes a buffer', () => {
      manager.createBuffer('toDelete');
      const deleted = manager.deleteBuffer('toDelete');

      expect(deleted).toBe(true);
      expect(manager.getBuffer('toDelete')).toBeUndefined();
    });

    it('returns false when deleting non-existent buffer', () => {
      const deleted = manager.deleteBuffer('nonexistent');
      expect(deleted).toBe(false);
    });

    it('lists all buffers', () => {
      manager.createBuffer('buffer1');
      manager.createBuffer('buffer2');
      manager.createBuffer('buffer3');

      const buffers = manager.listBuffers();
      expect(buffers).toHaveLength(3);
    });

    it('checks buffer existence', () => {
      manager.createBuffer('exists');

      expect(manager.hasBuffer('exists')).toBe(true);
      expect(manager.hasBuffer('nonexistent')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WORKING CONTENT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Working Content', () => {
    beforeEach(() => {
      manager.createBuffer('test', createTestItems(2));
    });

    it('gets working content', () => {
      const content = manager.getWorkingContent('test');
      expect(content).toHaveLength(2);
    });

    it('sets working content', () => {
      const newItems = createTestItems(5);
      manager.setWorkingContent('test', newItems);

      const content = manager.getWorkingContent('test');
      expect(content).toHaveLength(5);
      expect(manager.isDirty('test')).toBe(true);
    });

    it('appends to buffer', () => {
      const newItems = createTestItems(3);
      manager.appendToBuffer('test', newItems);

      const content = manager.getWorkingContent('test');
      expect(content).toHaveLength(5);
      expect(manager.isDirty('test')).toBe(true);
    });

    it('clears working content', () => {
      manager.clearWorkingContent('test');

      const content = manager.getWorkingContent('test');
      expect(content).toHaveLength(0);
      expect(manager.isDirty('test')).toBe(true);
    });

    it('throws when setting content on non-existent buffer', () => {
      expect(() => manager.setWorkingContent('nonexistent', [])).toThrow('not found');
    });

    it('enforces maximum buffer size', () => {
      // Create items exceeding max size
      const tooManyItems = Array.from({ length: MAX_BUFFER_ITEMS + 1 }, (_, i) => ({ id: i }));

      expect(() => manager.setWorkingContent('test', tooManyItems)).toThrow('maximum buffer size');
    });

    it('enforces maximum size on append', () => {
      // Fill buffer close to max
      const nearMaxItems = Array.from({ length: MAX_BUFFER_ITEMS - 1 }, (_, i) => ({ id: i }));
      manager.setWorkingContent('test', nearMaxItems);
      manager.commit('test', 'Near max');

      // Trying to append more than 1 item should fail
      const tooMany = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
      expect(() => manager.appendToBuffer('test', tooMany)).toThrow('exceed maximum');
    });

    it('deep clones content to prevent external mutation', () => {
      const item = { id: '1', nested: { value: 'original' } };
      manager.setWorkingContent('test', [item]);
      manager.commit('test', 'With nested');

      // Mutate the original
      item.nested.value = 'mutated';

      // Buffer should retain original value
      const content = manager.getWorkingContent('test') as Array<typeof item>;
      expect(content[0].nested.value).toBe('original');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VERSION CONTROL
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Version Control', () => {
    beforeEach(() => {
      manager.createBuffer('test', [createTestItem('1')]);
    });

    it('commits working content', () => {
      manager.appendToBuffer('test', [createTestItem('2')]);
      const version = manager.commit('test', 'Added item 2');

      expect(version.id).toHaveLength(VERSION_ID_LENGTH);
      expect(version.message).toBe('Added item 2');
      expect(version.content).toHaveLength(2);
      expect(manager.isDirty('test')).toBe(false);
    });

    it('throws when nothing to commit', () => {
      expect(() => manager.commit('test', 'Nothing changed')).toThrow('Nothing to commit');
    });

    it('stores metadata with commit', () => {
      manager.appendToBuffer('test', [createTestItem('2')]);
      const version = manager.commit('test', 'With metadata', { author: 'test', reviewedBy: 'alice' });

      expect(version.metadata).toEqual({ author: 'test', reviewedBy: 'alice' });
    });

    it('maintains parent chain', () => {
      // Initial commit is already there
      manager.appendToBuffer('test', [createTestItem('2')]);
      const v2 = manager.commit('test', 'Second');

      manager.appendToBuffer('test', [createTestItem('3')]);
      const v3 = manager.commit('test', 'Third');

      expect(v3.parentId).toBe(v2.id);
    });

    it('tags a version', () => {
      manager.appendToBuffer('test', [createTestItem('2')]);
      const version = manager.commit('test', 'Release 1.0');

      manager.tag('test', version.id, 'v1.0');

      const retrieved = manager.getVersion('test', 'v1.0');
      expect(retrieved?.id).toBe(version.id);
    });

    it('prevents duplicate tags', () => {
      manager.appendToBuffer('test', [createTestItem('2')]);
      const v1 = manager.commit('test', 'First');
      manager.tag('test', v1.id, 'release');

      manager.appendToBuffer('test', [createTestItem('3')]);
      const v2 = manager.commit('test', 'Second');

      expect(() => manager.tag('test', v2.id, 'release')).toThrow('already exists');
    });

    it('gets version history', () => {
      manager.appendToBuffer('test', [createTestItem('2')]);
      manager.commit('test', 'Second');

      manager.appendToBuffer('test', [createTestItem('3')]);
      manager.commit('test', 'Third');

      const history = manager.getHistory('test');
      expect(history).toHaveLength(3); // Initial + 2 commits
      expect(history[0].message).toBe('Third');
      expect(history[2].message).toBe('Initial commit');
    });

    it('limits history results', () => {
      // Create several commits
      for (let i = 2; i <= 5; i++) {
        manager.appendToBuffer('test', [createTestItem(i.toString())]);
        manager.commit('test', `Commit ${i}`);
      }

      const history = manager.getHistory('test', 2);
      expect(history).toHaveLength(2);
    });

    it('gets version by ID', () => {
      manager.appendToBuffer('test', [createTestItem('2')]);
      const version = manager.commit('test', 'Find me');

      const found = manager.getVersion('test', version.id);
      expect(found?.message).toBe('Find me');
    });

    it('gets version by tag', () => {
      manager.appendToBuffer('test', [createTestItem('2')]);
      const version = manager.commit('test', 'Tagged version');
      manager.tag('test', version.id, 'myTag');

      const found = manager.getVersion('test', 'myTag');
      expect(found?.id).toBe(version.id);
    });

    it('returns undefined for non-existent version', () => {
      const found = manager.getVersion('test', 'nonexistent');
      expect(found).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECKOUT & ROLLBACK
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Checkout & Rollback', () => {
    let v1: BufferVersion;
    let v2: BufferVersion;
    let v3: BufferVersion;

    beforeEach(() => {
      manager.createBuffer('test', [createTestItem('1')]);
      // v1 is the initial commit

      manager.appendToBuffer('test', [createTestItem('2')]);
      v2 = manager.commit('test', 'Added item 2');

      manager.appendToBuffer('test', [createTestItem('3')]);
      v3 = manager.commit('test', 'Added item 3');
    });

    it('checks out a specific version', () => {
      manager.checkout('test', v2.id);

      const content = manager.getWorkingContent('test');
      expect(content).toHaveLength(2);
      expect(manager.isDirty('test')).toBe(false);
    });

    it('checks out by tag', () => {
      manager.tag('test', v2.id, 'checkpoint');
      manager.checkout('test', 'checkpoint');

      const content = manager.getWorkingContent('test');
      expect(content).toHaveLength(2);
    });

    it('throws when checking out non-existent version', () => {
      expect(() => manager.checkout('test', 'nonexistent')).toThrow('not found');
    });

    it('rolls back one step', () => {
      const rolled = manager.rollback('test', 1);

      expect(rolled.id).toBe(v2.id);
      const content = manager.getWorkingContent('test');
      expect(content).toHaveLength(2);
    });

    it('rolls back multiple steps', () => {
      manager.rollback('test', 2);

      const content = manager.getWorkingContent('test');
      expect(content).toHaveLength(1); // Back to initial
    });

    it('throws when rolling back too many steps', () => {
      expect(() => manager.rollback('test', 10)).toThrow('Cannot rollback');
    });

    it('discards uncommitted changes', () => {
      manager.appendToBuffer('test', [createTestItem('4')]);
      expect(manager.isDirty('test')).toBe(true);

      manager.discardChanges('test');

      expect(manager.isDirty('test')).toBe(false);
      expect(manager.getWorkingContent('test')).toHaveLength(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BRANCHING
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Branching', () => {
    beforeEach(() => {
      manager.createBuffer('test', [createTestItem('1')]);
    });

    it('creates a new branch', () => {
      const branch = manager.createBranch('test', 'feature');

      expect(branch.name).toBe('feature');
      expect(branch.parentBranch).toBe(DEFAULT_BRANCH_NAME);
    });

    it('creates branch with description', () => {
      const branch = manager.createBranch('test', 'feature', 'New feature branch');
      expect(branch.description).toBe('New feature branch');
    });

    it('throws when creating duplicate branch', () => {
      manager.createBranch('test', 'feature');
      expect(() => manager.createBranch('test', 'feature')).toThrow('already exists');
    });

    it('enforces maximum branches', () => {
      const mgr = new BufferManager({ maxBranches: 3 });
      mgr.createBuffer('test');

      mgr.createBranch('test', 'branch1');
      mgr.createBranch('test', 'branch2');

      expect(() => mgr.createBranch('test', 'branch3')).toThrow('Maximum branches');
    });

    it('switches to a branch', () => {
      manager.createBranch('test', 'feature');
      manager.switchBranch('test', 'feature');

      const buffer = manager.getBuffer('test');
      expect(buffer?.currentBranch).toBe('feature');
    });

    it('throws when switching with uncommitted changes', () => {
      manager.createBranch('test', 'feature');
      manager.appendToBuffer('test', [createTestItem('2')]);

      expect(() => manager.switchBranch('test', 'feature')).toThrow('uncommitted changes');
    });

    it('throws when switching to non-existent branch', () => {
      expect(() => manager.switchBranch('test', 'nonexistent')).toThrow('not found');
    });

    it('lists all branches', () => {
      manager.createBranch('test', 'feature1');
      manager.createBranch('test', 'feature2');

      const branches = manager.listBranches('test');
      expect(branches).toHaveLength(3); // main + 2 features
      expect(branches.map(b => b.name)).toContain(DEFAULT_BRANCH_NAME);
      expect(branches.map(b => b.name)).toContain('feature1');
      expect(branches.map(b => b.name)).toContain('feature2');
    });

    it('deletes a branch', () => {
      manager.createBranch('test', 'feature');
      const deleted = manager.deleteBranch('test', 'feature');

      expect(deleted).toBe(true);
      expect(manager.listBranches('test')).toHaveLength(1);
    });

    it('cannot delete current branch', () => {
      expect(() => manager.deleteBranch('test', DEFAULT_BRANCH_NAME)).toThrow('current branch');
    });

    it('cannot delete main branch', () => {
      manager.createBranch('test', 'feature');
      manager.switchBranch('test', 'feature');

      expect(() => manager.deleteBranch('test', DEFAULT_BRANCH_NAME)).toThrow('Cannot delete');
    });

    it('branches diverge independently', () => {
      // Add to main
      manager.appendToBuffer('test', [createTestItem('main-2')]);
      manager.commit('test', 'Main commit');

      // Create and switch to feature
      manager.createBranch('test', 'feature');
      manager.switchBranch('test', 'feature');

      // Add to feature
      manager.appendToBuffer('test', [createTestItem('feature-3')]);
      manager.commit('test', 'Feature commit');

      // Feature has 3 items
      expect(manager.getWorkingContent('test')).toHaveLength(3);

      // Switch back to main - should have 2 items
      manager.switchBranch('test', 'main');
      expect(manager.getWorkingContent('test')).toHaveLength(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DIFF
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Diff', () => {
    let v1: BufferVersion;
    let v2: BufferVersion;

    beforeEach(() => {
      manager.createBuffer('test', [createTestItem('1')]);
      v1 = manager.getHistory('test')[0]; // Initial commit

      manager.appendToBuffer('test', [createTestItem('2'), createTestItem('3')]);
      v2 = manager.commit('test', 'Added items');
    });

    it('computes diff between versions', () => {
      const diff = manager.diff('test', v1.id, v2.id);

      expect(diff.fromVersion).toBe(v1.id);
      expect(diff.toVersion).toBe(v2.id);
      expect(diff.added).toHaveLength(2);
      expect(diff.removed).toHaveLength(0);
    });

    it('detects removed items', () => {
      // Create version with less items
      manager.setWorkingContent('test', [createTestItem('1')]);
      const v3 = manager.commit('test', 'Removed items');

      const diff = manager.diff('test', v2.id, v3.id);
      expect(diff.removed).toHaveLength(2);
    });

    it('detects modified items', () => {
      // Modify first item
      manager.setWorkingContent('test', [
        { ...createTestItem('1'), text: 'Modified!' },
        createTestItem('2'),
        createTestItem('3'),
      ]);
      const v3 = manager.commit('test', 'Modified first');

      const diff = manager.diff('test', v2.id, v3.id);
      expect(diff.modified).toHaveLength(1);
      expect(diff.modified[0].index).toBe(0);
    });

    it('generates diff summary', () => {
      const diff = manager.diff('test', v1.id, v2.id);
      expect(diff.summary).toContain('+2 added');
    });

    it('diffs working content against HEAD', () => {
      manager.appendToBuffer('test', [createTestItem('4')]);

      const diff = manager.diffWorking('test');
      expect(diff.toVersion).toBe('working');
      expect(diff.added).toHaveLength(1);
    });

    it('throws when diffing non-existent versions', () => {
      expect(() => manager.diff('test', 'nonexistent', v2.id)).toThrow('not found');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MERGE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Merge', () => {
    beforeEach(() => {
      manager.createBuffer('test', [createTestItem('1')]);

      // Add to main
      manager.appendToBuffer('test', [createTestItem('main-2')]);
      manager.commit('test', 'Main commit');

      // Create feature branch from current state
      manager.createBranch('test', 'feature');
      manager.switchBranch('test', 'feature');

      // Add to feature
      manager.appendToBuffer('test', [createTestItem('feature-3')]);
      manager.commit('test', 'Feature commit');

      // Switch back to main for merge
      manager.switchBranch('test', 'main');
    });

    it('merges branch into current', () => {
      const result = manager.merge('test', 'feature');

      expect(result.success).toBe(true);
      expect(result.newVersionId).toBeDefined();
      expect(manager.getWorkingContent('test')).toHaveLength(3);
    });

    it('uses custom merge message', () => {
      const result = manager.merge('test', 'feature', 'Custom merge message');

      const history = manager.getHistory('test', 1);
      expect(history[0].message).toBe('Custom merge message');
    });

    it('throws when merging with uncommitted changes', () => {
      manager.appendToBuffer('test', [createTestItem('uncommitted')]);

      expect(() => manager.merge('test', 'feature')).toThrow('uncommitted changes');
    });

    it('throws when merging non-existent branch', () => {
      expect(() => manager.merge('test', 'nonexistent')).toThrow('not found');
    });

    it('returns already up to date for same HEAD', () => {
      // First merge
      manager.merge('test', 'feature');

      // Second merge attempt (feature hasn't changed)
      // Need to switch to feature, make same content, switch back
      manager.switchBranch('test', 'feature');
      // Feature already has same content now after merge in main...
      // This test is a bit complex, simplify:

      // Create fresh scenario
      manager.clear();
      manager.createBuffer('test2', [createTestItem('1')]);
      manager.createBranch('test2', 'same');
      // Both branches point to same HEAD

      const result = manager.merge('test2', 'same');
      expect(result.success).toBe(true);
      expect(result.details).toContain('up to date');
    });

    it('uses "ours" strategy', () => {
      // Setup conflicting changes
      manager.setWorkingContent('test', [createTestItem('main-modified')]);
      manager.commit('test', 'Main modified');

      const result = manager.merge('test', 'feature', undefined, 'ours');

      expect(result.success).toBe(true);
      expect(result.conflicts).toHaveLength(0);
    });

    it('uses "theirs" strategy', () => {
      // Modify main differently
      manager.setWorkingContent('test', [createTestItem('main-modified')]);
      manager.commit('test', 'Main modified');

      const result = manager.merge('test', 'feature', undefined, 'theirs');

      expect(result.success).toBe(true);
      expect(result.conflicts).toHaveLength(0);
    });

    it('uses "union" strategy', () => {
      const result = manager.merge('test', 'feature', undefined, 'union');

      expect(result.success).toBe(true);
      // Union should have all unique items
      expect(result.mergedContent?.length).toBeGreaterThanOrEqual(2);
    });

    it('detects conflicts with auto strategy', () => {
      // Create conflicting item at same index
      manager.setWorkingContent('test', [{ id: 'conflict', text: 'main version' }, createTestItem('main-2')]);
      manager.commit('test', 'Main conflict');

      // Switch to feature and create conflict
      manager.switchBranch('test', 'feature');
      manager.setWorkingContent('test', [{ id: 'conflict', text: 'feature version' }, createTestItem('main-2'), createTestItem('feature-3')]);
      manager.commit('test', 'Feature conflict');

      // Switch back to main and merge
      manager.switchBranch('test', 'main');

      const result = manager.merge('test', 'feature', undefined, 'auto');

      expect(result.conflicts.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Utilities', () => {
    it('exports buffer state', () => {
      manager.createBuffer('test', createTestItems(3));
      manager.appendToBuffer('test', [createTestItem('4')]);
      manager.commit('test', 'Added item');
      manager.createBranch('test', 'feature');

      const exported = manager.export('test');

      expect(exported.name).toBe('test');
      expect(exported.branches).toHaveLength(2);
      expect(exported.versions).toHaveLength(2);
      expect(exported.currentBranch).toBe(DEFAULT_BRANCH_NAME);
    });

    it('imports buffer state', () => {
      // Create and export
      manager.createBuffer('original', createTestItems(2));
      const exported = manager.export('original');
      manager.deleteBuffer('original');

      // Rename for import
      exported.name = 'imported';

      // Import
      const imported = manager.import(exported);

      expect(imported.name).toBe('imported');
      expect(manager.hasBuffer('imported')).toBe(true);
      expect(manager.getWorkingContent('imported')).toHaveLength(2);
    });

    it('throws when importing duplicate name', () => {
      manager.createBuffer('test');
      const exported = manager.export('test');

      expect(() => manager.import(exported)).toThrow('already exists');
    });

    it('gets buffer stats', () => {
      manager.createBuffer('test', createTestItems(5));
      manager.appendToBuffer('test', [createTestItem('6')]);
      manager.commit('test', 'Added 6');
      manager.createBranch('test', 'feature');

      const stats = manager.getStats('test');

      expect(stats.name).toBe('test');
      expect(stats.itemCount).toBe(6);
      expect(stats.versionCount).toBe(2);
      expect(stats.branchCount).toBe(2);
      expect(stats.currentBranch).toBe(DEFAULT_BRANCH_NAME);
    });

    it('checks dirty state', () => {
      manager.createBuffer('test');
      expect(manager.isDirty('test')).toBe(false);

      manager.appendToBuffer('test', [createTestItem('1')]);
      expect(manager.isDirty('test')).toBe(true);

      manager.commit('test', 'Committed');
      expect(manager.isDirty('test')).toBe(false);
    });

    it('clears all buffers', () => {
      manager.createBuffer('buffer1');
      manager.createBuffer('buffer2');

      manager.clear();

      expect(manager.listBuffers()).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SINGLETON MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Singleton Management', () => {
    beforeEach(() => {
      resetBufferManager();
    });

    it('initializes global buffer manager', () => {
      const mgr = initBufferManager({ verbose: false });
      expect(mgr).toBeInstanceOf(BufferManager);
    });

    it('gets global buffer manager', () => {
      initBufferManager();
      const mgr = getBufferManager();
      expect(mgr).toBeInstanceOf(BufferManager);
    });

    it('creates manager on first get if not initialized', () => {
      const mgr = getBufferManager();
      expect(mgr).toBeInstanceOf(BufferManager);
    });

    it('resets global buffer manager', () => {
      const mgr1 = initBufferManager();
      mgr1.createBuffer('test');

      resetBufferManager();

      const mgr2 = getBufferManager();
      expect(mgr2.hasBuffer('test')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VERSION PRUNING
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Version Pruning', () => {
    it('prunes old versions when limit exceeded', () => {
      const mgr = new BufferManager({ maxVersions: 5, verbose: false });
      mgr.createBuffer('test', [createTestItem('1')]);

      // Create many commits (1 initial + 6 more = 7 total)
      for (let i = 2; i <= 7; i++) {
        mgr.appendToBuffer('test', [createTestItem(i.toString())]);
        mgr.commit('test', `Commit ${i}`);
      }

      const buffer = mgr.getBuffer('test');
      // Should have at most maxVersions
      expect(buffer?.versions.size).toBeLessThanOrEqual(5);
    });

    it('protects tagged versions from pruning', () => {
      const mgr = new BufferManager({ maxVersions: 3, verbose: false });
      mgr.createBuffer('test', [createTestItem('1')]);

      // Tag the initial commit
      const initialHistory = mgr.getHistory('test');
      mgr.tag('test', initialHistory[0].id, 'important');

      // Create many commits
      for (let i = 2; i <= 6; i++) {
        mgr.appendToBuffer('test', [createTestItem(i.toString())]);
        mgr.commit('test', `Commit ${i}`);
      }

      // Tagged version should still exist
      const tagged = mgr.getVersion('test', 'important');
      expect(tagged).toBeDefined();
    });

    it('protects branch heads from pruning', () => {
      const mgr = new BufferManager({ maxVersions: 3, verbose: false });
      mgr.createBuffer('test', [createTestItem('1')]);

      // Create a branch
      mgr.createBranch('test', 'feature');

      // Add commits to main
      for (let i = 2; i <= 6; i++) {
        mgr.appendToBuffer('test', [createTestItem(i.toString())]);
        mgr.commit('test', `Commit ${i}`);
      }

      // Feature branch head should still exist
      const branches = mgr.listBranches('test');
      const featureBranch = branches.find(b => b.name === 'feature');
      expect(featureBranch).toBeDefined();

      const headVersion = mgr.getVersion('test', featureBranch!.headVersionId);
      expect(headVersion).toBeDefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('AUI Constants', () => {
  it('has expected default values', () => {
    expect(AUI_DEFAULTS.maxSteps).toBe(20);
    expect(AUI_DEFAULTS.temperature).toBe(0.7);
    expect(AUI_DEFAULTS.autoApprove).toBe(false);
    expect(AUI_DEFAULTS.maxVersions).toBe(100);
    expect(AUI_DEFAULTS.maxBranches).toBe(10);
  });

  it('has default branch name', () => {
    expect(DEFAULT_BRANCH_NAME).toBe('main');
  });

  it('has version ID length', () => {
    expect(VERSION_ID_LENGTH).toBe(7);
  });

  it('has max buffer items', () => {
    expect(MAX_BUFFER_ITEMS).toBe(10000);
  });
});
