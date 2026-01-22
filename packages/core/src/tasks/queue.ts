/**
 * Task Queue
 *
 * Manages task lifecycle, assignment, and execution for the Agent Council.
 * Supports priority-based scheduling, retries, timeouts, and dependencies.
 */

import type {
  AgentTask,
  TaskStatus,
  TaskResult,
  Agent,
} from '../runtime/types.js';
import { getAgentStore, type StoredTask } from '../state/store.js';
import { getAgentRegistry } from '../runtime/registry.js';
import { getMessageBus } from '../bus/message-bus.js';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface QueuedTask extends AgentTask {
  createdAt: number;
  assignedAt?: number;
  startedAt?: number;
  completedAt?: number;
  retries: number;
  maxRetries: number;
  timeoutMs: number;
}

export interface TaskAssignment {
  taskId: string;
  agentId: string;
  assignedAt: number;
}

export interface TaskQueueConfig {
  defaultTimeout: number;
  defaultMaxRetries: number;
  checkIntervalMs: number;
  maxConcurrentTasks: number;
}

export interface TaskQueueStats {
  pending: number;
  assigned: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  totalProcessed: number;
  avgProcessingTimeMs: number;
}

// ═══════════════════════════════════════════════════════════════════
// TASK QUEUE INTERFACE
// ═══════════════════════════════════════════════════════════════════

export interface TaskQueue {
  /**
   * Enqueue a new task
   */
  enqueue(task: Omit<AgentTask, 'id'>, options?: EnqueueOptions): Promise<string>;

  /**
   * Get a task by ID
   */
  get(taskId: string): QueuedTask | undefined;

  /**
   * List tasks with optional filter
   */
  list(filter?: TaskListFilter): QueuedTask[];

  /**
   * Assign a task to an agent
   */
  assign(taskId: string, agentId: string): Promise<TaskAssignment>;

  /**
   * Start task execution
   */
  start(taskId: string): Promise<void>;

  /**
   * Mark task as completed
   */
  complete(taskId: string, result: TaskResult): Promise<void>;

  /**
   * Mark task as failed
   */
  fail(taskId: string, error: Error, retry?: boolean): Promise<void>;

  /**
   * Cancel a task
   */
  cancel(taskId: string, reason?: string): Promise<void>;

  /**
   * Get next pending task for an agent
   */
  getNext(agentId?: string): QueuedTask | undefined;

  /**
   * Get tasks assigned to an agent
   */
  getAgentTasks(agentId: string): QueuedTask[];

  /**
   * Add task dependency
   */
  addDependency(taskId: string, dependsOnTaskId: string): void;

  /**
   * Check if task dependencies are satisfied
   */
  areDependenciesSatisfied(taskId: string): boolean;

  /**
   * Get queue statistics
   */
  getStats(): TaskQueueStats;

  /**
   * Start the queue processor
   */
  startProcessor(): void;

  /**
   * Stop the queue processor
   */
  stopProcessor(): void;
}

export interface EnqueueOptions {
  priority?: number;
  timeoutMs?: number;
  maxRetries?: number;
  dependsOn?: string[];
  projectId?: string;
}

export interface TaskListFilter {
  status?: TaskStatus | TaskStatus[];
  agentId?: string;
  projectId?: string;
  type?: string;
  limit?: number;
}

// ═══════════════════════════════════════════════════════════════════
// IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

export class AgentTaskQueue implements TaskQueue {
  private config: TaskQueueConfig;
  private processorInterval: ReturnType<typeof setInterval> | null = null;
  private runningTasks: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private dependencies: Map<string, Set<string>> = new Map();
  private totalProcessed = 0;
  private totalProcessingTime = 0;

  private store = getAgentStore();
  private registry = getAgentRegistry();
  private bus = getMessageBus();

  constructor(config?: Partial<TaskQueueConfig>) {
    this.config = {
      defaultTimeout: config?.defaultTimeout || 60000,
      defaultMaxRetries: config?.defaultMaxRetries || 3,
      checkIntervalMs: config?.checkIntervalMs || 1000,
      maxConcurrentTasks: config?.maxConcurrentTasks || 10,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // ENQUEUE
  // ─────────────────────────────────────────────────────────────────

  async enqueue(task: Omit<AgentTask, 'id'>, options?: EnqueueOptions): Promise<string> {
    const id = this.generateId('task');

    const storedTask: Omit<StoredTask, 'createdAt'> = {
      id,
      type: task.type,
      agentId: task.targetAgent,
      projectId: options?.projectId || task.projectId,
      payload: task.payload,
      status: 'pending',
      priority: options?.priority || task.priority || 0,
      timeoutMs: options?.timeoutMs || this.config.defaultTimeout,
      maxRetries: options?.maxRetries || this.config.defaultMaxRetries,
      retries: 0,
    };

    this.store.createTask(storedTask);

    // Add dependencies
    if (options?.dependsOn) {
      for (let i = 0; i < options.dependsOn.length; i++) {
        this.addDependency(id, options.dependsOn[i]);
      }
    }

    // Emit event
    this.bus.publish('task:created', {
      taskId: id,
      type: task.type,
      priority: storedTask.priority,
    });

    console.log(`[TaskQueue] Enqueued task ${id} (type: ${task.type}, priority: ${storedTask.priority})`);

    return id;
  }

  // ─────────────────────────────────────────────────────────────────
  // GET / LIST
  // ─────────────────────────────────────────────────────────────────

  get(taskId: string): QueuedTask | undefined {
    const stored = this.store.getTask(taskId);
    return stored ? this.storedToQueued(stored) : undefined;
  }

  list(filter?: TaskListFilter): QueuedTask[] {
    const stored = this.store.listTasks(filter);
    return stored.map(t => this.storedToQueued(t));
  }

  private storedToQueued(stored: StoredTask): QueuedTask {
    return {
      id: stored.id,
      type: stored.type,
      targetAgent: stored.agentId,
      projectId: stored.projectId,
      payload: stored.payload,
      status: stored.status,
      priority: stored.priority,
      result: stored.result ? { success: true, data: stored.result } : undefined,
      error: stored.error,
      createdAt: stored.createdAt,
      assignedAt: stored.assignedAt,
      startedAt: stored.startedAt,
      completedAt: stored.completedAt,
      retries: stored.retries,
      maxRetries: stored.maxRetries,
      timeoutMs: stored.timeoutMs,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // ASSIGNMENT
  // ─────────────────────────────────────────────────────────────────

  async assign(taskId: string, agentId: string): Promise<TaskAssignment> {
    const task = this.store.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (task.status !== 'pending') {
      throw new Error(`Task ${taskId} is not pending (status: ${task.status})`);
    }

    const assignedAt = Date.now();
    this.store.updateTask(taskId, {
      agentId,
      status: 'assigned',
      assignedAt,
    });

    this.bus.publish('task:assigned', { taskId, agentId });

    console.log(`[TaskQueue] Assigned task ${taskId} to agent ${agentId}`);

    return { taskId, agentId, assignedAt };
  }

  // ─────────────────────────────────────────────────────────────────
  // EXECUTION
  // ─────────────────────────────────────────────────────────────────

  async start(taskId: string): Promise<void> {
    const task = this.store.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (task.status !== 'assigned') {
      throw new Error(`Task ${taskId} is not assigned (status: ${task.status})`);
    }

    const startedAt = Date.now();
    this.store.updateTask(taskId, {
      status: 'running',
      startedAt,
    });

    // Set up timeout
    const timeout = setTimeout(() => {
      this.handleTimeout(taskId);
    }, task.timeoutMs);

    this.runningTasks.set(taskId, timeout);

    this.bus.publish('task:started', { taskId, agentId: task.agentId });

    console.log(`[TaskQueue] Started task ${taskId}`);
  }

  async complete(taskId: string, result: TaskResult): Promise<void> {
    const task = this.store.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Clear timeout
    const timeout = this.runningTasks.get(taskId);
    if (timeout) {
      clearTimeout(timeout);
      this.runningTasks.delete(taskId);
    }

    const completedAt = Date.now();
    const processingTime = completedAt - (task.startedAt || task.createdAt);

    this.store.updateTask(taskId, {
      status: 'completed',
      completedAt,
      result: result.data,
    });

    // Track stats
    this.totalProcessed++;
    this.totalProcessingTime += processingTime;

    this.bus.publish('task:completed', {
      taskId,
      agentId: task.agentId,
      result,
      processingTimeMs: processingTime,
    });

    console.log(`[TaskQueue] Completed task ${taskId} (${processingTime}ms)`);
  }

  async fail(taskId: string, error: Error, retry = true): Promise<void> {
    const task = this.store.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Clear timeout
    const timeout = this.runningTasks.get(taskId);
    if (timeout) {
      clearTimeout(timeout);
      this.runningTasks.delete(taskId);
    }

    const shouldRetry = retry && task.retries < task.maxRetries;

    if (shouldRetry) {
      // Retry - reset to pending
      this.store.updateTask(taskId, {
        status: 'pending',
        agentId: undefined,
        assignedAt: undefined,
        startedAt: undefined,
        retries: task.retries + 1,
        error: error.message,
      });

      this.bus.publish('task:retry', {
        taskId,
        attempt: task.retries + 1,
        maxRetries: task.maxRetries,
        error: error.message,
      });

      console.log(`[TaskQueue] Retrying task ${taskId} (attempt ${task.retries + 1}/${task.maxRetries})`);
    } else {
      // Final failure
      this.store.updateTask(taskId, {
        status: 'failed',
        completedAt: Date.now(),
        error: error.message,
      });

      this.totalProcessed++;

      this.bus.publish('task:failed', {
        taskId,
        agentId: task.agentId,
        error: error.message,
      });

      console.log(`[TaskQueue] Failed task ${taskId}: ${error.message}`);
    }
  }

  async cancel(taskId: string, reason?: string): Promise<void> {
    const task = this.store.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Clear timeout if running
    const timeout = this.runningTasks.get(taskId);
    if (timeout) {
      clearTimeout(timeout);
      this.runningTasks.delete(taskId);
    }

    this.store.updateTask(taskId, {
      status: 'cancelled',
      completedAt: Date.now(),
      error: reason || 'Cancelled by user',
    });

    this.bus.publish('task:cancelled', { taskId, reason });

    console.log(`[TaskQueue] Cancelled task ${taskId}${reason ? `: ${reason}` : ''}`);
  }

  private handleTimeout(taskId: string): void {
    console.log(`[TaskQueue] Task ${taskId} timed out`);
    this.fail(taskId, new Error('Task timed out')).catch(console.error);
  }

  // ─────────────────────────────────────────────────────────────────
  // QUEUE ACCESS
  // ─────────────────────────────────────────────────────────────────

  getNext(agentId?: string): QueuedTask | undefined {
    // Get all pending tasks
    const pending = this.store.listTasks({
      status: 'pending',
      agentId,
      limit: 100,
    });

    // Find first task with satisfied dependencies
    for (let i = 0; i < pending.length; i++) {
      const task = pending[i];
      if (this.areDependenciesSatisfied(task.id)) {
        return this.storedToQueued(task);
      }
    }

    return undefined;
  }

  getAgentTasks(agentId: string): QueuedTask[] {
    const tasks = this.store.listTasks({
      agentId,
      status: ['assigned', 'running'],
    });
    return tasks.map(t => this.storedToQueued(t));
  }

  // ─────────────────────────────────────────────────────────────────
  // DEPENDENCIES
  // ─────────────────────────────────────────────────────────────────

  addDependency(taskId: string, dependsOnTaskId: string): void {
    if (!this.dependencies.has(taskId)) {
      this.dependencies.set(taskId, new Set());
    }
    this.dependencies.get(taskId)!.add(dependsOnTaskId);
  }

  areDependenciesSatisfied(taskId: string): boolean {
    const deps = this.dependencies.get(taskId);
    if (!deps || deps.size === 0) return true;

    const depsArray = Array.from(deps);
    for (let i = 0; i < depsArray.length; i++) {
      const depTask = this.store.getTask(depsArray[i]);
      if (!depTask || depTask.status !== 'completed') {
        return false;
      }
    }

    return true;
  }

  // ─────────────────────────────────────────────────────────────────
  // PROCESSOR
  // ─────────────────────────────────────────────────────────────────

  startProcessor(): void {
    if (this.processorInterval) {
      console.warn('[TaskQueue] Processor already running');
      return;
    }

    console.log('[TaskQueue] Starting processor');

    this.processorInterval = setInterval(() => {
      this.processQueue().catch(console.error);
    }, this.config.checkIntervalMs);
  }

  stopProcessor(): void {
    if (this.processorInterval) {
      clearInterval(this.processorInterval);
      this.processorInterval = null;
      console.log('[TaskQueue] Stopped processor');
    }
  }

  private async processQueue(): Promise<void> {
    // Count currently running tasks
    const running = this.runningTasks.size;
    if (running >= this.config.maxConcurrentTasks) {
      return;
    }

    // Get available agents
    const agents = this.registry.findByStatus('idle');
    if (agents.length === 0) return;

    // Try to assign tasks to idle agents
    for (let i = 0; i < agents.length && this.runningTasks.size < this.config.maxConcurrentTasks; i++) {
      const agent = agents[i];

      // Find a task this agent can handle
      const task = this.findTaskForAgent(agent);
      if (task) {
        try {
          await this.assign(task.id, agent.id);
          await this.executeTask(task.id, agent);
        } catch (error) {
          console.error(`[TaskQueue] Error assigning task to ${agent.id}:`, error);
        }
      }
    }
  }

  private findTaskForAgent(agent: Agent): QueuedTask | undefined {
    // Get pending tasks that match agent's capabilities
    const pending = this.store.listTasks({ status: 'pending', limit: 50 });

    for (let i = 0; i < pending.length; i++) {
      const task = pending[i];

      // Check if task is targeted to this agent
      if (task.agentId && task.agentId !== agent.id) continue;

      // Check dependencies
      if (!this.areDependenciesSatisfied(task.id)) continue;

      // Check if agent can handle this task type
      if (this.canAgentHandle(agent, task.type)) {
        return this.storedToQueued(task);
      }
    }

    return undefined;
  }

  private canAgentHandle(agent: Agent, taskType: string): boolean {
    // Task types map to capabilities
    // e.g., 'harvest-thread' → 'harvest' capability
    const capability = taskType.split('-')[0];
    return agent.capabilities.includes(capability) || agent.capabilities.includes(taskType);
  }

  private async executeTask(taskId: string, agent: Agent): Promise<void> {
    try {
      await this.start(taskId);

      // Send task to agent
      const task = this.get(taskId);
      if (!task) return;

      const response = await this.bus.request(agent.id, {
        type: task.type,
        payload: task.payload,
        priority: task.priority,
      });

      if (response.success) {
        await this.complete(taskId, {
          success: true,
          data: response.data,
        });
      } else {
        await this.fail(taskId, new Error(response.error || 'Task failed'));
      }
    } catch (error) {
      await this.fail(taskId, error instanceof Error ? error : new Error(String(error)));
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // STATS
  // ─────────────────────────────────────────────────────────────────

  getStats(): TaskQueueStats {
    const pending = this.store.listTasks({ status: 'pending' }).length;
    const assigned = this.store.listTasks({ status: 'assigned' }).length;
    const running = this.store.listTasks({ status: 'running' }).length;
    const completed = this.store.listTasks({ status: 'completed' }).length;
    const failed = this.store.listTasks({ status: 'failed' }).length;
    const cancelled = this.store.listTasks({ status: 'cancelled' }).length;

    return {
      pending,
      assigned,
      running,
      completed,
      failed,
      cancelled,
      totalProcessed: this.totalProcessed,
      avgProcessingTimeMs: this.totalProcessed > 0
        ? this.totalProcessingTime / this.totalProcessed
        : 0,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _queue: TaskQueue | null = null;

/**
 * Get the singleton task queue
 */
export function getTaskQueue(): TaskQueue {
  if (!_queue) {
    _queue = new AgentTaskQueue();
  }
  return _queue;
}

/**
 * Set a custom task queue (for testing)
 */
export function setTaskQueue(queue: TaskQueue): void {
  _queue = queue;
}

/**
 * Reset the task queue (for testing)
 */
export function resetTaskQueue(): void {
  _queue = null;
}
