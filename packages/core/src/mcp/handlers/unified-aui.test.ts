/**
 * Unified AUI MCP Handler Tests
 *
 * Unit tests for the MCP handler implementations for the AUI system.
 * Tests session management, buffer operations, and search/agent handlers.
 *
 * @module @humanizer/core/mcp/handlers/unified-aui.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  handleSessionCreate,
  handleSessionGet,
  handleSessionList,
  handleSessionDelete,
  handleBufferCreate,
  handleBufferList,
  handleBufferGet,
  handleBufferSet,
  handleBufferAppend,
  handleBufferCommit,
  handleBufferRollback,
  handleBufferHistory,
  handleBufferBranchCreate,
  handleBufferBranchSwitch,
  handleBufferBranchList,
  handleBufferMerge,
  handleBufferDiff,
  handleAdminConfigGet,
  handleAdminConfigSet,
  handleAdminTierList,
  handleAdminTierGet,
  handleAdminUsageGet,
  handleAdminCostReport,
} from './unified-aui.js';
import {
  initUnifiedAui,
  resetUnifiedAui,
} from '../../aui/index.js';
import { resetBufferManager } from '../../aui/buffer-manager.js';
import { resetAdminService } from '../../aui/admin-service.js';

// ═══════════════════════════════════════════════════════════════════════════
// MOCK CONFIG MANAGER
// ═══════════════════════════════════════════════════════════════════════════

function createMockConfigManager() {
  const storage = new Map<string, unknown>();

  return {
    get: vi.fn(async <T>(category: string, key: string): Promise<T | undefined> => {
      return storage.get(`${category}:${key}`) as T | undefined;
    }),
    getOrDefault: vi.fn(async <T>(category: string, key: string, defaultValue: T): Promise<T> => {
      return (storage.get(`${category}:${key}`) as T) ?? defaultValue;
    }),
    set: vi.fn(async <T>(category: string, key: string, value: T) => {
      storage.set(`${category}:${key}`, value);
    }),
    getCategory: vi.fn(async () => []),
    getAuditHistory: vi.fn(async () => []),
    getRecentAudit: vi.fn(async () => []),
    listPrompts: vi.fn(async () => []),
    getPrompt: vi.fn(async () => undefined),
    savePrompt: vi.fn(async () => {}),
    compilePrompt: vi.fn(async (id: string, vars: Record<string, string>) => ({
      text: 'compiled',
      promptId: id,
      variables: vars,
    })),
    _storage: storage,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST SETUP
// ═══════════════════════════════════════════════════════════════════════════

describe('Unified AUI MCP Handlers', () => {
  let mockConfig: ReturnType<typeof createMockConfigManager>;

  beforeEach(async () => {
    resetUnifiedAui();
    resetBufferManager();
    resetAdminService();
    mockConfig = createMockConfigManager();

    // Initialize the service
    await initUnifiedAui({
      configManager: mockConfig as any,
    });
  });

  afterEach(() => {
    resetUnifiedAui();
    resetBufferManager();
    resetAdminService();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Session Handlers', () => {
    it('creates a session', async () => {
      const result = await handleSessionCreate({ name: 'Test Session' });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.sessionId).toBeDefined();
      expect(data.createdAt).toBeDefined();
    });

    it('creates a session with userId', async () => {
      const result = await handleSessionCreate({
        name: 'User Session',
        userId: 'user-123',
      });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.sessionId).toBeDefined();
    });

    it('gets a session by ID', async () => {
      // Create first
      const createResult = await handleSessionCreate({ name: 'Get Me' });
      const { sessionId } = JSON.parse(createResult.content[0].text);

      // Get it
      const result = await handleSessionGet({ sessionId });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.id).toBe(sessionId);
    });

    it('returns error for non-existent session', async () => {
      const result = await handleSessionGet({ sessionId: 'nonexistent' });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toContain('not found');
    });

    it('lists all sessions', async () => {
      await handleSessionCreate({ name: 'Session 1' });
      await handleSessionCreate({ name: 'Session 2' });

      const result = await handleSessionList();

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(2);
      expect(data.sessions).toHaveLength(2);
    });

    it('deletes a session', async () => {
      const createResult = await handleSessionCreate({ name: 'Delete Me' });
      const { sessionId } = JSON.parse(createResult.content[0].text);

      const result = await handleSessionDelete({ sessionId });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);

      // Verify deleted
      const getResult = await handleSessionGet({ sessionId });
      expect(getResult.isError).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BUFFER HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Buffer Handlers', () => {
    let sessionId: string;

    beforeEach(async () => {
      const result = await handleSessionCreate({ name: 'Buffer Test' });
      sessionId = JSON.parse(result.content[0].text).sessionId;
    });

    it('creates a buffer', async () => {
      const result = await handleBufferCreate({
        sessionId,
        name: 'testBuffer',
        content: [{ id: 1, text: 'item 1' }],
      });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.name).toBe('testBuffer');
      expect(data.itemCount).toBe(1);
    });

    it('lists buffers in session', async () => {
      await handleBufferCreate({ sessionId, name: 'buffer1' });
      await handleBufferCreate({ sessionId, name: 'buffer2' });

      const result = await handleBufferList({ sessionId });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.buffers).toHaveLength(2);
    });

    it('gets buffer content', async () => {
      await handleBufferCreate({
        sessionId,
        name: 'getTest',
        content: [{ id: 1 }, { id: 2 }, { id: 3 }],
      });

      const result = await handleBufferGet({ sessionId, name: 'getTest' });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      // Handler returns 'items' not 'content'
      expect(data.items).toHaveLength(3);
    });

    it('gets buffer content with limit', async () => {
      await handleBufferCreate({
        sessionId,
        name: 'limitTest',
        content: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
      });

      const result = await handleBufferGet({ sessionId, name: 'limitTest', limit: 2 });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      // Handler returns 'items' not 'content'
      expect(data.items).toHaveLength(2);
      expect(data.total).toBe(5);
    });

    it('sets buffer content', async () => {
      await handleBufferCreate({ sessionId, name: 'setTest' });

      const result = await handleBufferSet({
        sessionId,
        name: 'setTest',
        content: [{ text: 'new content' }],
      });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.itemCount).toBe(1);
      expect(data.success).toBe(true);
    });

    it('appends to buffer', async () => {
      await handleBufferCreate({
        sessionId,
        name: 'appendTest',
        content: [{ id: 1 }],
      });

      const result = await handleBufferAppend({
        sessionId,
        name: 'appendTest',
        items: [{ id: 2 }, { id: 3 }],
      });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      // Handler returns 'itemCount' (total) and 'appended' (count added)
      expect(data.itemCount).toBe(3);
      expect(data.appended).toBe(2);
    });

    it('commits buffer changes', async () => {
      await handleBufferCreate({ sessionId, name: 'commitTest' });
      await handleBufferAppend({
        sessionId,
        name: 'commitTest',
        items: [{ id: 1 }],
      });

      const result = await handleBufferCommit({
        sessionId,
        name: 'commitTest',
        message: 'Added item',
      });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.versionId).toBeDefined();
      expect(data.message).toBe('Added item');
    });

    it('gets buffer history', async () => {
      await handleBufferCreate({ sessionId, name: 'historyTest' });
      await handleBufferAppend({ sessionId, name: 'historyTest', items: [{ id: 1 }] });
      await handleBufferCommit({ sessionId, name: 'historyTest', message: 'Commit 1' });
      await handleBufferAppend({ sessionId, name: 'historyTest', items: [{ id: 2 }] });
      await handleBufferCommit({ sessionId, name: 'historyTest', message: 'Commit 2' });

      const result = await handleBufferHistory({ sessionId, name: 'historyTest' });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.history.length).toBe(3); // Initial + 2 commits
    });

    it('rolls back buffer', async () => {
      await handleBufferCreate({
        sessionId,
        name: 'rollbackTest',
        content: [{ id: 1 }],
      });
      await handleBufferAppend({ sessionId, name: 'rollbackTest', items: [{ id: 2 }] });
      await handleBufferCommit({ sessionId, name: 'rollbackTest', message: 'Added 2' });
      await handleBufferAppend({ sessionId, name: 'rollbackTest', items: [{ id: 3 }] });
      await handleBufferCommit({ sessionId, name: 'rollbackTest', message: 'Added 3' });

      const result = await handleBufferRollback({
        sessionId,
        name: 'rollbackTest',
        steps: 1,
      });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.message).toBe('Added 2');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BRANCH HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Branch Handlers', () => {
    let sessionId: string;

    beforeEach(async () => {
      const result = await handleSessionCreate({ name: 'Branch Test' });
      sessionId = JSON.parse(result.content[0].text).sessionId;
      await handleBufferCreate({ sessionId, name: 'branchBuffer' });
    });

    it('creates a branch', async () => {
      const result = await handleBufferBranchCreate({
        sessionId,
        bufferName: 'branchBuffer',
        branchName: 'feature',
      });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.branch).toBe('feature');
    });

    it('lists branches', async () => {
      await handleBufferBranchCreate({
        sessionId,
        bufferName: 'branchBuffer',
        branchName: 'feature',
      });

      const result = await handleBufferBranchList({
        sessionId,
        bufferName: 'branchBuffer',
      });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.branches).toHaveLength(2); // main + feature
    });

    it('switches branch', async () => {
      await handleBufferBranchCreate({
        sessionId,
        bufferName: 'branchBuffer',
        branchName: 'feature',
      });

      const result = await handleBufferBranchSwitch({
        sessionId,
        bufferName: 'branchBuffer',
        branchName: 'feature',
      });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.branch).toBe('feature');
    });

    it('merges branches', async () => {
      // Create feature branch
      await handleBufferBranchCreate({
        sessionId,
        bufferName: 'branchBuffer',
        branchName: 'feature',
      });

      // Switch to feature and add content
      await handleBufferBranchSwitch({
        sessionId,
        bufferName: 'branchBuffer',
        branchName: 'feature',
      });
      await handleBufferAppend({
        sessionId,
        name: 'branchBuffer',
        items: [{ id: 'feature-item' }],
      });
      await handleBufferCommit({
        sessionId,
        name: 'branchBuffer',
        message: 'Feature commit',
      });

      // Switch back to main and merge
      await handleBufferBranchSwitch({
        sessionId,
        bufferName: 'branchBuffer',
        branchName: 'main',
      });

      const result = await handleBufferMerge({
        sessionId,
        bufferName: 'branchBuffer',
        sourceBranch: 'feature',
      });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
    });

    it('computes diff between versions', async () => {
      await handleBufferAppend({
        sessionId,
        name: 'branchBuffer',
        items: [{ id: 1 }],
      });
      const commit1 = await handleBufferCommit({
        sessionId,
        name: 'branchBuffer',
        message: 'First',
      });
      const v1 = JSON.parse(commit1.content[0].text).versionId;

      await handleBufferAppend({
        sessionId,
        name: 'branchBuffer',
        items: [{ id: 2 }],
      });
      const commit2 = await handleBufferCommit({
        sessionId,
        name: 'branchBuffer',
        message: 'Second',
      });
      const v2 = JSON.parse(commit2.content[0].text).versionId;

      const result = await handleBufferDiff({
        sessionId,
        bufferName: 'branchBuffer',
        fromVersion: v1,
        toVersion: v2,
      });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      // Handler returns counts, not arrays
      expect(data.added).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Admin Handlers', () => {
    it('gets config value', async () => {
      mockConfig._storage.set('aui:maxSteps', 25);

      const result = await handleAdminConfigGet({
        category: 'aui',
        key: 'maxSteps',
      });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.value).toBe(25);
    });

    it('sets config value', async () => {
      const result = await handleAdminConfigSet({
        category: 'aui',
        key: 'temperature',
        value: 0.5,
        reason: 'Testing',
      });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
    });

    it('lists tiers', async () => {
      const result = await handleAdminTierList();

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.tiers.length).toBeGreaterThan(0);
      expect(data.tiers.some((t: any) => t.id === 'free')).toBe(true);
    });

    it('gets tier details', async () => {
      const result = await handleAdminTierGet({ tierId: 'free' });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.id).toBe('free');
      expect(data.limits).toBeDefined();
    });

    it('gets user usage', async () => {
      const result = await handleAdminUsageGet({
        userId: 'test-user',
        period: 'day',
      });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.userId).toBe('test-user');
    });

    it('gets cost report', async () => {
      const result = await handleAdminCostReport({
        startDate: new Date(Date.now() - 86400000).toISOString(),
      });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      expect(data.totalRequests).toBeDefined();
      expect(data.totalCostCents).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Error Handling', () => {
    it('returns error for buffer operations on non-existent buffer', async () => {
      const createResult = await handleSessionCreate({ name: 'Error Test' });
      const sessionId = JSON.parse(createResult.content[0].text).sessionId;

      const result = await handleBufferGet({
        sessionId,
        name: 'nonexistent',
      });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toContain('not found');
    });

    it('returns error for commit with no changes', async () => {
      const createResult = await handleSessionCreate({ name: 'No Changes' });
      const sessionId = JSON.parse(createResult.content[0].text).sessionId;
      await handleBufferCreate({ sessionId, name: 'noChanges' });

      const result = await handleBufferCommit({
        sessionId,
        name: 'noChanges',
        message: 'Nothing to commit',
      });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toContain('Nothing to commit');
    });

    it('returns error when switching branch with uncommitted changes', async () => {
      const createResult = await handleSessionCreate({ name: 'Dirty Switch' });
      const sessionId = JSON.parse(createResult.content[0].text).sessionId;
      await handleBufferCreate({ sessionId, name: 'dirtyBuffer' });
      await handleBufferBranchCreate({
        sessionId,
        bufferName: 'dirtyBuffer',
        branchName: 'other',
      });

      // Add uncommitted changes
      await handleBufferAppend({
        sessionId,
        name: 'dirtyBuffer',
        items: [{ uncommitted: true }],
      });

      const result = await handleBufferBranchSwitch({
        sessionId,
        bufferName: 'dirtyBuffer',
        branchName: 'other',
      });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toContain('uncommitted');
    });
  });
});
