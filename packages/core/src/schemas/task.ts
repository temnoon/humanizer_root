/**
 * Task Schemas - Validation for agent tasks and results
 */

import { z } from 'zod';
import {
  IdSchema,
  AgentIdSchema,
  TimestampSchema,
  ProjectIdSchema,
  PrioritySchema,
  MetadataSchema,
  generateUUID,
} from './common.js';

// ═══════════════════════════════════════════════════════════════════
// TASK STATUS
// ═══════════════════════════════════════════════════════════════════

/**
 * Task status
 */
export const TaskStatusSchema = z.enum([
  'pending',
  'assigned',
  'running',
  'completed',
  'failed',
  'cancelled',
  'blocked',
]);

export type TaskStatus = z.infer<typeof TaskStatusSchema>;

// ═══════════════════════════════════════════════════════════════════
// TASK RESULT
// ═══════════════════════════════════════════════════════════════════

/**
 * Metrics for a completed task
 */
export const TaskMetricsSchema = z.object({
  processingTimeMs: z.number().int().nonnegative(),
  tokensUsed: z.number().int().nonnegative().optional(),
  cost: z.number().nonnegative().optional(),
});

export type TaskMetrics = z.infer<typeof TaskMetricsSchema>;

/**
 * Result of a completed task
 */
export const TaskResultSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  metrics: TaskMetricsSchema.optional(),
});

export type TaskResult = z.infer<typeof TaskResultSchema>;

// ═══════════════════════════════════════════════════════════════════
// AGENT TASK
// ═══════════════════════════════════════════════════════════════════

/**
 * A task for an agent to execute
 */
export const AgentTaskSchema = z.object({
  /** Unique task ID */
  id: IdSchema,

  /** Task type - determines which agent handles it */
  type: z.string().min(1).max(64),

  /** Target agent ID (or capability for routing) */
  targetAgent: AgentIdSchema.optional(),

  /** Target capability for routing */
  targetCapability: z.string().min(1).max(64).optional(),

  /** Task payload */
  payload: z.unknown(),

  /** Priority (higher = more urgent) */
  priority: PrioritySchema,

  /** Project context */
  projectId: ProjectIdSchema.optional(),

  /** Dependencies - task IDs that must complete first */
  dependencies: z.array(IdSchema).optional(),

  /** Whether this task requires approval before execution */
  requiresApproval: z.boolean().optional(),

  /** Timeout in ms */
  timeout: z.number().int().positive().optional(),

  /** Metadata */
  metadata: MetadataSchema.optional(),

  // Runtime fields
  status: TaskStatusSchema.optional(),
  assignedTo: AgentIdSchema.optional(),
  createdAt: TimestampSchema.optional(),
  startedAt: TimestampSchema.optional(),
  completedAt: TimestampSchema.optional(),
  result: TaskResultSchema.optional(),
  error: z.string().optional(),
});

export type AgentTask = z.infer<typeof AgentTaskSchema>;

// ═══════════════════════════════════════════════════════════════════
// TASK CREATION INPUT
// ═══════════════════════════════════════════════════════════════════

/**
 * Input for creating a new task (without runtime fields)
 */
export const CreateTaskInputSchema = z.object({
  type: z.string().min(1).max(64),
  targetAgent: AgentIdSchema.optional(),
  targetCapability: z.string().min(1).max(64).optional(),
  payload: z.unknown(),
  priority: PrioritySchema.default(50),
  projectId: ProjectIdSchema.optional(),
  dependencies: z.array(IdSchema).optional(),
  requiresApproval: z.boolean().optional(),
  timeout: z.number().int().positive().optional(),
  metadata: MetadataSchema.optional(),
}).refine(
  data => data.targetAgent || data.targetCapability,
  { message: 'Either targetAgent or targetCapability must be provided' }
);

export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;

// ═══════════════════════════════════════════════════════════════════
// VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Validate a task with safe parsing
 */
export function validateAgentTask(data: unknown): {
  success: true;
  data: AgentTask;
} | {
  success: false;
  error: z.ZodError;
} {
  const result = AgentTaskSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Create a valid task
 */
export function createAgentTask(input: CreateTaskInput): AgentTask {
  const validated = CreateTaskInputSchema.parse(input);
  return {
    id: generateUUID(),
    ...validated,
    status: 'pending',
    createdAt: Date.now(),
  };
}

/**
 * Check if a task is complete (success or failure)
 */
export function isTaskComplete(task: AgentTask): boolean {
  return task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled';
}

/**
 * Check if a task can be executed (dependencies met)
 */
export function canExecuteTask(task: AgentTask, completedTaskIds: Set<string>): boolean {
  if (!task.dependencies || task.dependencies.length === 0) {
    return true;
  }
  return task.dependencies.every(depId => completedTaskIds.has(depId));
}
