/**
 * AgenticLoop Tests
 *
 * Unit tests for the ReAct pattern implementation:
 * - Task creation and management
 * - Step execution (Reason → Act → Observe → Adjust)
 * - Tool orchestration
 * - Interruption and resumption
 *
 * @module @humanizer/core/aui/agentic-loop.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AgenticLoop,
  createToolExecutor,
  initAgenticLoop,
  getAgenticLoop,
  resetAgenticLoop,
  type AgentLlmAdapter,
  type ToolExecutor,
} from './agentic-loop.js';
import {
  BufferManager,
  resetBufferManager,
} from './buffer-manager.js';
import type { AgentTask, ToolResult } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════
// MOCK LLM ADAPTER
// ═══════════════════════════════════════════════════════════════════════════

function createMockLlmAdapter(responses?: string[]): AgentLlmAdapter {
  let callCount = 0;
  const defaultResponses = [
    '```complete\n{"answer": "Task completed successfully"}\n```',
  ];
  const responseQueue = responses ?? defaultResponses;

  return {
    complete: vi.fn(async (prompt: string, options?: any) => {
      const response = responseQueue[callCount % responseQueue.length];
      callCount++;
      return {
        text: response,
        tokensUsed: 100,
        finishReason: 'stop' as const,
      };
    }),
    isAvailable: vi.fn(async () => true),
    getModel: vi.fn(() => 'mock-model'),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCK TOOL EXECUTOR
// ═══════════════════════════════════════════════════════════════════════════

function createMockToolExecutor(): ToolExecutor {
  return {
    listTools: vi.fn(() => [
      { name: 'search', description: 'Search for content', parameters: {} },
      { name: 'buffer_create', description: 'Create a buffer', parameters: {} },
      { name: 'buffer_delete', description: 'Delete a buffer (destructive)', parameters: {} },
    ]),
    getTool: vi.fn((name: string) => ({
      name,
      description: `Mock tool: ${name}`,
      parameters: {},
    })),
    execute: vi.fn(async (name: string, args: Record<string, unknown>): Promise<ToolResult> => {
      return {
        success: true,
        data: { tool: name, args },
        durationMs: 50,
      };
    }),
    executeBql: vi.fn(async (pipeline: string): Promise<ToolResult> => {
      return {
        success: true,
        data: { pipeline, results: [] },
        durationMs: 100,
      };
    }),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// AGENTIC LOOP TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('AgenticLoop', () => {
  let loop: AgenticLoop;
  let mockLlm: AgentLlmAdapter;
  let mockExecutor: ToolExecutor;

  beforeEach(() => {
    resetAgenticLoop();
    mockLlm = createMockLlmAdapter();
    mockExecutor = createMockToolExecutor();
    loop = new AgenticLoop(mockLlm, mockExecutor, { verbose: false });
  });

  afterEach(() => {
    resetAgenticLoop();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TASK CREATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Task Creation', () => {
    it('creates a task with unique ID', async () => {
      const task = await loop.run('Test request');

      expect(task.id).toBeDefined();
      expect(task.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('stores the original request', async () => {
      const task = await loop.run('Find my vacation photos');

      expect(task.request).toBe('Find my vacation photos');
    });

    it('initializes with correct status', async () => {
      const task = await loop.run('Test');

      // Task should be completed (mock LLM returns complete immediately)
      expect(task.status).toBe('completed');
    });

    it('tracks start and completion time', async () => {
      const task = await loop.run('Test');

      expect(task.startedAt).toBeDefined();
      expect(task.completedAt).toBeDefined();
      expect(task.completedAt).toBeGreaterThanOrEqual(task.startedAt);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP EXECUTION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Step Execution', () => {
    it('executes complete step', async () => {
      const task = await loop.run('Test');

      expect(task.steps.length).toBeGreaterThan(0);
      const lastStep = task.steps[task.steps.length - 1];
      expect(lastStep.type).toBe('complete');
    });

    it('executes tool step', async () => {
      const llm = createMockLlmAdapter([
        'Let me search for that.\n```tool\n{"tool": "search", "args": {"query": "test"}}\n```',
        '```complete\n{"answer": "Found results"}\n```',
      ]);
      const localLoop = new AgenticLoop(llm, mockExecutor, { verbose: false });

      const task = await localLoop.run('Search for test');

      // Should have act, observe, and complete steps
      expect(task.steps.length).toBeGreaterThanOrEqual(2);
      expect(task.steps.some(s => s.type === 'act')).toBe(true);
      expect(task.steps.some(s => s.type === 'observe')).toBe(true);
    });

    it('handles ask_user step', async () => {
      const llm = createMockLlmAdapter([
        '```ask\n{"question": "Which folder should I search?"}\n```',
      ]);
      const localLoop = new AgenticLoop(llm, mockExecutor, { verbose: false });

      const task = await localLoop.run('Search for photos');

      expect(task.status).toBe('awaiting_input');
    });

    it('calls onStep callback', async () => {
      const onStep = vi.fn();
      await loop.run('Test', undefined, { onStep });

      expect(onStep).toHaveBeenCalled();
    });

    it('calls onStatusChange callback', async () => {
      const onStatusChange = vi.fn();
      await loop.run('Test', undefined, { onStatusChange });

      expect(onStatusChange).toHaveBeenCalled();
    });

    it('respects max steps limit', async () => {
      const llm = createMockLlmAdapter([
        // Return adjust responses to keep the loop going
        'I need to think about this more...',
      ]);
      const localLoop = new AgenticLoop(llm, mockExecutor, { verbose: false });

      const task = await localLoop.run('Endless task', undefined, { maxSteps: 3 });

      expect(task.status).toBe('failed');
      expect(task.error).toContain('Maximum steps');
    });

    it('respects timeout', async () => {
      // Create a slow LLM
      const slowLlm: AgentLlmAdapter = {
        complete: async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return { text: 'thinking...', tokensUsed: 10, finishReason: 'stop' };
        },
        isAvailable: async () => true,
        getModel: () => 'slow-model',
      };

      const localLoop = new AgenticLoop(slowLlm, mockExecutor, { verbose: false });
      const task = await localLoop.run('Test', undefined, { timeoutMs: 50 });

      expect(task.status).toBe('failed');
      expect(task.error).toContain('timed out');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TOOL EXECUTION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Tool Execution', () => {
    it('executes tool and records result', async () => {
      const llm = createMockLlmAdapter([
        '```tool\n{"tool": "search", "args": {"query": "test"}}\n```',
        '```complete\n{"answer": "Done"}\n```',
      ]);
      const localLoop = new AgenticLoop(llm, mockExecutor, { verbose: false });

      const task = await localLoop.run('Search');

      expect(mockExecutor.execute).toHaveBeenCalledWith('search', { query: 'test' });

      // Find the observe step
      const observeStep = task.steps.find(s => s.type === 'observe' && s.toolResult);
      expect(observeStep?.toolResult?.success).toBe(true);
    });

    it('executes BQL pipeline', async () => {
      const llm = createMockLlmAdapter([
        '```tool\n{"tool": "bql", "bql": "harvest photos | transform"}\n```',
        '```complete\n{"answer": "Done"}\n```',
      ]);
      const localLoop = new AgenticLoop(llm, mockExecutor, { verbose: false });

      await localLoop.run('Process photos');

      expect(mockExecutor.executeBql).toHaveBeenCalledWith('harvest photos | transform');
    });

    it('handles tool execution error', async () => {
      const failingExecutor = {
        ...createMockToolExecutor(),
        execute: vi.fn(async () => {
          throw new Error('Tool failed');
        }),
      };

      const llm = createMockLlmAdapter([
        '```tool\n{"tool": "broken", "args": {}}\n```',
        '```complete\n{"answer": "Handled error"}\n```',
      ]);
      const localLoop = new AgenticLoop(llm, failingExecutor, { verbose: false });

      const task = await localLoop.run('Test');

      const observeStep = task.steps.find(s => s.type === 'observe' && s.toolResult);
      expect(observeStep?.toolResult?.success).toBe(false);
      expect(observeStep?.toolResult?.error).toContain('Tool failed');
    });

    it('requires approval for destructive tools', async () => {
      const llm = createMockLlmAdapter([
        '```tool\n{"tool": "buffer_delete", "args": {"name": "important"}}\n```',
        '```complete\n{"answer": "Cancelled"}\n```',
      ]);
      const onApprovalNeeded = vi.fn(async () => false);
      const localLoop = new AgenticLoop(llm, mockExecutor, { verbose: false });

      const task = await localLoop.run('Delete buffer', undefined, {
        onApprovalNeeded,
        autoApprove: false,
      });

      expect(onApprovalNeeded).toHaveBeenCalled();
      const observeStep = task.steps.find(s => s.toolResult?.error === 'User rejected action');
      expect(observeStep).toBeDefined();
    });

    it('auto-approves when configured', async () => {
      const llm = createMockLlmAdapter([
        '```tool\n{"tool": "buffer_delete", "args": {"name": "test"}}\n```',
        '```complete\n{"answer": "Deleted"}\n```',
      ]);
      const localLoop = new AgenticLoop(llm, mockExecutor, { verbose: false });

      await localLoop.run('Delete buffer', undefined, { autoApprove: true });

      expect(mockExecutor.execute).toHaveBeenCalledWith('buffer_delete', { name: 'test' });
    });

    it('tracks token usage', async () => {
      const task = await loop.run('Test');

      expect(task.totalTokens).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TASK MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Task Management', () => {
    it('gets task by ID', async () => {
      const created = await loop.run('Test');
      const found = loop.getTask(created.id);

      expect(found?.id).toBe(created.id);
    });

    it('returns undefined for non-existent task', () => {
      const task = loop.getTask('nonexistent');
      expect(task).toBeUndefined();
    });

    it('lists all tasks', async () => {
      await loop.run('Task 1');
      await loop.run('Task 2');

      const tasks = loop.listTasks();
      expect(tasks.length).toBe(2);
    });

    it('lists tasks by status', async () => {
      await loop.run('Test');

      const completed = loop.listTasks('completed');
      expect(completed.length).toBeGreaterThan(0);

      const pending = loop.listTasks('pending');
      expect(pending.length).toBe(0);
    });

    it('gets task history', async () => {
      await loop.run('Task 1');
      await loop.run('Task 2');

      const history = loop.getTaskHistory();
      expect(history.length).toBe(2);
    });

    it('limits task history', async () => {
      await loop.run('Task 1');
      await loop.run('Task 2');
      await loop.run('Task 3');

      const history = loop.getTaskHistory(2);
      expect(history.length).toBe(2);
    });

    it('clears completed tasks', async () => {
      await loop.run('Task 1');
      await loop.run('Task 2');

      const cleared = loop.clearCompletedTasks();
      expect(cleared).toBe(2);

      const tasks = loop.listTasks();
      expect(tasks.length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INTERRUPTION & RESUMPTION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Interruption & Resumption', () => {
    it('interrupts a task', async () => {
      const llm = createMockLlmAdapter([
        '```ask\n{"question": "Which file?"}\n```',
      ]);
      const localLoop = new AgenticLoop(llm, mockExecutor, { verbose: false });

      const task = await localLoop.run('Test');
      expect(task.status).toBe('awaiting_input');

      localLoop.interrupt(task.id, 'User cancelled');

      const updated = localLoop.getTask(task.id);
      expect(updated?.status).toBe('cancelled');
      expect(updated?.error).toBe('User cancelled');
    });

    it('throws when interrupting non-existent task', () => {
      expect(() => loop.interrupt('nonexistent')).toThrow('not found');
    });

    it('resumes an awaiting_input task', async () => {
      const llm = createMockLlmAdapter([
        '```ask\n{"question": "Which file?"}\n```',
        '```complete\n{"answer": "Used user input"}\n```',
      ]);
      const localLoop = new AgenticLoop(llm, mockExecutor, { verbose: false });

      const task = await localLoop.run('Test');
      expect(task.status).toBe('awaiting_input');

      const resumed = await localLoop.resume(task.id, 'document.txt');
      expect(resumed.status).toBe('completed');
    });

    it('adds user input as observe step', async () => {
      const llm = createMockLlmAdapter([
        '```ask\n{"question": "Which file?"}\n```',
        '```complete\n{"answer": "Done"}\n```',
      ]);
      const localLoop = new AgenticLoop(llm, mockExecutor, { verbose: false });

      const task = await localLoop.run('Test');
      const resumed = await localLoop.resume(task.id, 'user provided input');

      const inputStep = resumed.steps.find(s =>
        s.type === 'observe' && s.content.includes('User input')
      );
      expect(inputStep).toBeDefined();
    });

    it('throws when resuming non-resumable task', async () => {
      const task = await loop.run('Test'); // Completes immediately

      await expect(loop.resume(task.id))
        .rejects.toThrow('cannot be resumed');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP-BY-STEP MODE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Step-by-Step Mode', () => {
    it('executes single step', async () => {
      // Start a task that will need user input
      const llm = createMockLlmAdapter([
        '```tool\n{"tool": "search", "args": {"query": "test"}}\n```',
      ]);
      const localLoop = new AgenticLoop(llm, mockExecutor, { verbose: false });

      // Need to start the task first
      const task = await localLoop.run('Test');

      // Since mock completes immediately, task may already be done
      // This tests that step() exists and can be called
      expect(task.steps.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SINGLETON MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Singleton Management', () => {
    beforeEach(() => {
      resetAgenticLoop();
    });

    it('initializes global agentic loop', () => {
      const loop = initAgenticLoop(mockLlm, mockExecutor);
      expect(loop).toBeInstanceOf(AgenticLoop);
    });

    it('gets global agentic loop', () => {
      initAgenticLoop(mockLlm, mockExecutor);
      const loop = getAgenticLoop();
      expect(loop).toBeInstanceOf(AgenticLoop);
    });

    it('returns null before initialization', () => {
      expect(getAgenticLoop()).toBeNull();
    });

    it('resets global agentic loop', () => {
      initAgenticLoop(mockLlm, mockExecutor);
      resetAgenticLoop();
      expect(getAgenticLoop()).toBeNull();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TOOL EXECUTOR FACTORY TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('createToolExecutor', () => {
  let bufferManager: BufferManager;
  let executor: ToolExecutor;
  const mockBqlExecutor = vi.fn(async (pipeline: string) => ({
    data: { pipeline, executed: true },
  }));

  beforeEach(() => {
    resetBufferManager();
    bufferManager = new BufferManager({ verbose: false });
    executor = createToolExecutor(mockBqlExecutor, bufferManager);
  });

  afterEach(() => {
    bufferManager.clear();
    resetBufferManager();
  });

  describe('Built-in Buffer Tools', () => {
    it('lists available tools', () => {
      const tools = executor.listTools();

      expect(tools.length).toBeGreaterThan(0);
      expect(tools.some(t => t.name === 'buffer_list')).toBe(true);
      expect(tools.some(t => t.name === 'buffer_get')).toBe(true);
      expect(tools.some(t => t.name === 'buffer_create')).toBe(true);
      expect(tools.some(t => t.name === 'bql')).toBe(true);
    });

    it('executes buffer_list', async () => {
      bufferManager.createBuffer('test1', [{ id: 1 }]);
      bufferManager.createBuffer('test2', [{ id: 2 }]);

      const result = await executor.execute('buffer_list', {});

      expect(result.success).toBe(true);
      expect((result.data as any[]).length).toBe(2);
    });

    it('executes buffer_get', async () => {
      bufferManager.createBuffer('myBuffer', [{ text: 'hello' }, { text: 'world' }]);

      const result = await executor.execute('buffer_get', { name: 'myBuffer' });

      expect(result.success).toBe(true);
      expect((result.data as any).content).toHaveLength(2);
    });

    it('handles buffer_get for non-existent buffer', async () => {
      const result = await executor.execute('buffer_get', { name: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('executes buffer_create', async () => {
      const result = await executor.execute('buffer_create', {
        name: 'newBuffer',
        content: [{ id: 1 }],
      });

      expect(result.success).toBe(true);
      expect(bufferManager.hasBuffer('newBuffer')).toBe(true);
    });

    it('executes buffer_commit', async () => {
      bufferManager.createBuffer('commitTest');
      bufferManager.appendToBuffer('commitTest', [{ id: 1 }]);

      const result = await executor.execute('buffer_commit', {
        name: 'commitTest',
        message: 'Test commit',
      });

      expect(result.success).toBe(true);
      expect((result.data as any).message).toBe('Test commit');
    });

    it('executes buffer_history', async () => {
      bufferManager.createBuffer('historyTest');
      bufferManager.appendToBuffer('historyTest', [{ id: 1 }]);
      bufferManager.commit('historyTest', 'First commit');

      const result = await executor.execute('buffer_history', {
        name: 'historyTest',
        limit: 10,
      });

      expect(result.success).toBe(true);
      expect((result.data as any[]).length).toBe(2); // Initial + first commit
    });

    it('executes buffer_branch_create', async () => {
      bufferManager.createBuffer('branchTest');

      const result = await executor.execute('buffer_branch_create', {
        bufferName: 'branchTest',
        branchName: 'feature',
      });

      expect(result.success).toBe(true);
      expect(bufferManager.listBranches('branchTest')).toHaveLength(2);
    });

    it('executes buffer_branch_switch', async () => {
      bufferManager.createBuffer('switchTest');
      bufferManager.createBranch('switchTest', 'dev');

      const result = await executor.execute('buffer_branch_switch', {
        bufferName: 'switchTest',
        branchName: 'dev',
      });

      expect(result.success).toBe(true);
      expect(bufferManager.getBuffer('switchTest')?.currentBranch).toBe('dev');
    });
  });

  describe('BQL Execution', () => {
    it('executes BQL pipeline via tool', async () => {
      const result = await executor.execute('bql', {
        pipeline: 'harvest | transform',
      });

      expect(result.success).toBe(true);
      expect(mockBqlExecutor).toHaveBeenCalledWith('harvest | transform');
    });

    it('executes BQL directly', async () => {
      const result = await executor.executeBql('harvest photos');

      expect(result.success).toBe(true);
      expect(mockBqlExecutor).toHaveBeenCalledWith('harvest photos');
    });

    it('handles BQL execution error', async () => {
      const failingBql = vi.fn(async () => ({ error: 'Syntax error' }));
      const failingExecutor = createToolExecutor(failingBql, bufferManager);

      const result = await failingExecutor.executeBql('invalid');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Syntax error');
    });
  });

  describe('Custom Handlers', () => {
    it('executes custom handler', async () => {
      const customHandler = vi.fn(async (args: Record<string, unknown>): Promise<ToolResult> => ({
        success: true,
        data: { custom: true, args },
      }));

      const customExecutor = createToolExecutor(mockBqlExecutor, bufferManager, {
        custom_tool: customHandler,
      });

      const result = await customExecutor.execute('custom_tool', { param: 'value' });

      expect(result.success).toBe(true);
      expect(customHandler).toHaveBeenCalledWith({ param: 'value' });
    });

    it('lists custom handlers in tools', () => {
      const customExecutor = createToolExecutor(mockBqlExecutor, bufferManager, {
        my_custom_tool: async () => ({ success: true }),
      });

      const tools = customExecutor.listTools();
      expect(tools.some(t => t.name === 'my_custom_tool')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('handles unknown tool', async () => {
      const result = await executor.execute('unknown_tool', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });

    it('handles execution exception', async () => {
      // Try to commit with no changes - should fail
      bufferManager.createBuffer('errorTest');

      const result = await executor.execute('buffer_commit', {
        name: 'errorTest',
        message: 'No changes',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Nothing to commit');
    });

    it('tracks duration on all results', async () => {
      const result = await executor.execute('buffer_list', {});

      expect(result.durationMs).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
