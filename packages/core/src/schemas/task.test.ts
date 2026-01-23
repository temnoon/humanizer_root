/**
 * Task Schema Tests
 */

import { describe, it, expect } from 'vitest';
import {
  TaskStatusSchema,
  TaskMetricsSchema,
  TaskResultSchema,
  AgentTaskSchema,
  CreateTaskInputSchema,
  validateAgentTask,
  createAgentTask,
  isTaskComplete,
  canExecuteTask,
} from './task.js';
import type { AgentTask } from './task.js';

describe('Task Schemas', () => {
  describe('TaskStatusSchema', () => {
    it('accepts valid statuses', () => {
      const validStatuses = ['pending', 'assigned', 'running', 'completed', 'failed', 'cancelled', 'blocked'];
      validStatuses.forEach(status => {
        expect(TaskStatusSchema.parse(status)).toBe(status);
      });
    });

    it('rejects invalid statuses', () => {
      expect(() => TaskStatusSchema.parse('invalid')).toThrow();
      expect(() => TaskStatusSchema.parse('done')).toThrow();
    });
  });

  describe('TaskMetricsSchema', () => {
    it('accepts valid metrics', () => {
      const metrics = {
        processingTimeMs: 150,
        tokensUsed: 1000,
        cost: 0.05,
      };
      expect(TaskMetricsSchema.parse(metrics)).toEqual(metrics);
    });

    it('accepts metrics with only required fields', () => {
      const metrics = { processingTimeMs: 100 };
      expect(TaskMetricsSchema.parse(metrics)).toEqual(metrics);
    });

    it('rejects negative values', () => {
      expect(() => TaskMetricsSchema.parse({ processingTimeMs: -1 })).toThrow();
      expect(() => TaskMetricsSchema.parse({ processingTimeMs: 100, tokensUsed: -5 })).toThrow();
      expect(() => TaskMetricsSchema.parse({ processingTimeMs: 100, cost: -0.01 })).toThrow();
    });
  });

  describe('TaskResultSchema', () => {
    it('accepts successful results', () => {
      const result = {
        success: true,
        data: { issues: [], recommendations: ['Use TypeScript'] },
      };
      expect(TaskResultSchema.parse(result)).toEqual(result);
    });

    it('accepts error results', () => {
      const result = {
        success: false,
        error: 'Agent timeout',
        metrics: { processingTimeMs: 5000 },
      };
      expect(TaskResultSchema.parse(result)).toEqual(result);
    });

    it('accepts minimal results', () => {
      expect(TaskResultSchema.parse({ success: true })).toEqual({ success: true });
      expect(TaskResultSchema.parse({ success: false })).toEqual({ success: false });
    });
  });

  describe('AgentTaskSchema', () => {
    const validTask = {
      id: 'task-123',
      type: 'review-code',
      payload: { files: ['src/index.ts'] },
      priority: 50,
    };

    it('accepts valid tasks', () => {
      expect(AgentTaskSchema.parse(validTask)).toEqual(validTask);
    });

    it('accepts tasks with all optional fields', () => {
      const fullTask = {
        ...validTask,
        targetAgent: 'architect',
        targetCapability: 'review-architecture',
        projectId: 'proj-123',
        dependencies: ['task-100', 'task-101'],
        requiresApproval: true,
        timeout: 30000,
        metadata: { source: 'user' },
        status: 'pending',
        assignedTo: 'architect',
        createdAt: Date.now(),
        startedAt: Date.now(),
        completedAt: Date.now(),
        result: { success: true },
        error: undefined,
      };
      expect(AgentTaskSchema.parse(fullTask)).toMatchObject(validTask);
    });

    it('rejects tasks with invalid type (empty string)', () => {
      expect(() => AgentTaskSchema.parse({ ...validTask, type: '' })).toThrow();
    });

    it('rejects tasks with invalid priority', () => {
      expect(() => AgentTaskSchema.parse({ ...validTask, priority: 150 })).toThrow();
      expect(() => AgentTaskSchema.parse({ ...validTask, priority: -1 })).toThrow();
    });

    it('rejects tasks with type exceeding max length', () => {
      expect(() => AgentTaskSchema.parse({
        ...validTask,
        type: 'x'.repeat(65),
      })).toThrow();
    });
  });

  describe('CreateTaskInputSchema', () => {
    it('accepts valid input with targetAgent', () => {
      const input = {
        type: 'review',
        targetAgent: 'architect',
        payload: { file: 'test.ts' },
      };
      expect(CreateTaskInputSchema.parse(input)).toMatchObject(input);
    });

    it('accepts valid input with targetCapability', () => {
      const input = {
        type: 'review',
        targetCapability: 'review-architecture',
        payload: { file: 'test.ts' },
      };
      expect(CreateTaskInputSchema.parse(input)).toMatchObject(input);
    });

    it('applies default priority', () => {
      const input = {
        type: 'review',
        targetAgent: 'architect',
        payload: {},
      };
      const result = CreateTaskInputSchema.parse(input);
      expect(result.priority).toBe(50);
    });

    it('rejects input without targetAgent or targetCapability', () => {
      expect(() => CreateTaskInputSchema.parse({
        type: 'review',
        payload: {},
      })).toThrow();
    });
  });

  describe('validateAgentTask', () => {
    it('returns success for valid tasks', () => {
      const result = validateAgentTask({
        id: 'task-123',
        type: 'test',
        payload: {},
        priority: 50,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('task-123');
      }
    });

    it('returns error for invalid tasks', () => {
      const result = validateAgentTask({ invalid: true });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('createAgentTask', () => {
    it('creates a valid task with auto-generated id and timestamp', () => {
      const task = createAgentTask({
        type: 'review',
        targetAgent: 'architect',
        payload: { file: 'test.ts' },
      });

      expect(task.id).toBeDefined();
      expect(task.id.length).toBeGreaterThan(0);
      expect(task.type).toBe('review');
      expect(task.targetAgent).toBe('architect');
      expect(task.payload).toEqual({ file: 'test.ts' });
      expect(task.status).toBe('pending');
      expect(task.createdAt).toBeLessThanOrEqual(Date.now());
    });

    it('uses default priority of 50', () => {
      const task = createAgentTask({
        type: 'review',
        targetAgent: 'architect',
        payload: {},
      });
      expect(task.priority).toBe(50);
    });

    it('accepts custom priority', () => {
      const task = createAgentTask({
        type: 'urgent-review',
        targetAgent: 'security',
        payload: {},
        priority: 90,
      });
      expect(task.priority).toBe(90);
    });
  });

  describe('isTaskComplete', () => {
    const baseTask: AgentTask = {
      id: 'task-1',
      type: 'review',
      payload: {},
      priority: 50,
    };

    it('returns true for completed tasks', () => {
      expect(isTaskComplete({ ...baseTask, status: 'completed' })).toBe(true);
    });

    it('returns true for failed tasks', () => {
      expect(isTaskComplete({ ...baseTask, status: 'failed' })).toBe(true);
    });

    it('returns true for cancelled tasks', () => {
      expect(isTaskComplete({ ...baseTask, status: 'cancelled' })).toBe(true);
    });

    it('returns false for pending tasks', () => {
      expect(isTaskComplete({ ...baseTask, status: 'pending' })).toBe(false);
    });

    it('returns false for running tasks', () => {
      expect(isTaskComplete({ ...baseTask, status: 'running' })).toBe(false);
    });

    it('returns false for blocked tasks', () => {
      expect(isTaskComplete({ ...baseTask, status: 'blocked' })).toBe(false);
    });
  });

  describe('canExecuteTask', () => {
    const baseTask: AgentTask = {
      id: 'task-1',
      type: 'review',
      payload: {},
      priority: 50,
    };

    it('returns true for tasks without dependencies', () => {
      expect(canExecuteTask(baseTask, new Set())).toBe(true);
      expect(canExecuteTask({ ...baseTask, dependencies: [] }, new Set())).toBe(true);
    });

    it('returns true when all dependencies are completed', () => {
      const task: AgentTask = {
        ...baseTask,
        dependencies: ['dep-1', 'dep-2'],
      };
      const completedIds = new Set(['dep-1', 'dep-2', 'other']);
      expect(canExecuteTask(task, completedIds)).toBe(true);
    });

    it('returns false when some dependencies are not completed', () => {
      const task: AgentTask = {
        ...baseTask,
        dependencies: ['dep-1', 'dep-2'],
      };
      const completedIds = new Set(['dep-1']);
      expect(canExecuteTask(task, completedIds)).toBe(false);
    });

    it('returns false when no dependencies are completed', () => {
      const task: AgentTask = {
        ...baseTask,
        dependencies: ['dep-1', 'dep-2'],
      };
      expect(canExecuteTask(task, new Set())).toBe(false);
    });
  });
});
