/**
 * Agentic Loop - ReAct Pattern Implementation
 *
 * Implements the Claude Code SDK-like agentic loop:
 * Reason → Act → Observe → Adjust → Repeat
 *
 * Features:
 * - Task decomposition and planning
 * - Tool orchestration (BQL, MCP tools, buffers)
 * - Human-in-the-loop for destructive actions
 * - Step-by-step execution with interruption
 *
 * @module @humanizer/core/aui/agentic-loop
 */

import { randomUUID } from 'crypto';
import type {
  AgentStep,
  AgentStepType,
  AgentTask,
  AgentTaskStatus,
  AgentPlanStep,
  AgentLoopOptions,
  ToolCall,
  ToolResult,
  ToolDefinition,
  ToolParameter,
  TaskContext,
  ReasoningResult,
} from './types.js';
import {
  AUI_DEFAULTS,
  DESTRUCTIVE_TOOLS,
  MAX_TOOL_RESULT_SIZE,
  MAX_HISTORY_IN_CONTEXT,
} from './constants.js';
import type { BufferManager } from './buffer-manager.js';

// ═══════════════════════════════════════════════════════════════════════════
// LLM ADAPTER INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * LLM adapter interface for the agentic loop.
 */
export interface AgentLlmAdapter {
  /** Generate completion */
  complete(prompt: string, options?: {
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
    stopSequences?: string[];
  }): Promise<{
    text: string;
    tokensUsed: number;
    finishReason: 'stop' | 'max_tokens' | 'tool_use';
  }>;

  /** Check if adapter is available */
  isAvailable(): Promise<boolean>;

  /** Get model name */
  getModel(): string;
}

// ═══════════════════════════════════════════════════════════════════════════
// TOOL EXECUTOR INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tool executor that bridges to BQL and MCP tools.
 */
export interface ToolExecutor {
  /** List available tools */
  listTools(): ToolDefinition[];

  /** Get a specific tool definition */
  getTool(name: string): ToolDefinition | undefined;

  /** Execute a tool by name */
  execute(name: string, args: Record<string, unknown>): Promise<ToolResult>;

  /** Execute a BQL pipeline directly */
  executeBql(pipeline: string): Promise<ToolResult>;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROMPTS
// ═══════════════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are an AI assistant with access to tools for managing data, searching archives, and transforming content.

You follow the ReAct pattern:
1. REASON: Analyze the current situation and decide what to do next
2. ACT: Choose and execute a tool
3. OBSERVE: Process the result
4. ADJUST: Modify your approach if needed
5. Repeat until the task is complete

Always think step by step. Be explicit about your reasoning.

When you need to use a tool, respond with a JSON block:
\`\`\`tool
{
  "tool": "tool_name",
  "args": { "param1": "value1" }
}
\`\`\`

When you have completed the task, respond with:
\`\`\`complete
{
  "answer": "Your final answer here",
  "summary": "Brief summary of what was done"
}
\`\`\`

If you need clarification from the user:
\`\`\`ask
{
  "question": "Your question here"
}
\`\`\``;

const REASONING_PROMPT_TEMPLATE = `
Current task: {{request}}

{{#if plan}}
Current plan:
{{#each plan}}
{{@index}}. {{description}} {{#if completed}}[DONE]{{/if}}
{{/each}}

Current step: {{currentStepIndex}}
{{/if}}

{{#if previousSteps}}
Previous steps in this task:
{{#each previousSteps}}
[{{type}}] {{content}}
{{/each}}
{{/if}}

{{#if lastToolResult}}
Last tool result:
{{lastToolResult}}
{{/if}}

Available tools:
{{toolList}}

What should I do next? Think step by step and then either:
1. Use a tool (respond with a \`\`\`tool block)
2. Complete the task (respond with a \`\`\`complete block)
3. Ask the user for clarification (respond with a \`\`\`ask block)
`;

// ═══════════════════════════════════════════════════════════════════════════
// AGENTIC LOOP
// ═══════════════════════════════════════════════════════════════════════════

export interface AgenticLoopOptions {
  /** Default options for agent runs */
  defaultOptions?: Partial<AgentLoopOptions>;

  /** Verbose logging */
  verbose?: boolean;
}

/**
 * AgenticLoop implements the ReAct pattern for autonomous task execution.
 */
export class AgenticLoop {
  private llm: AgentLlmAdapter;
  private toolExecutor: ToolExecutor;
  private tasks: Map<string, AgentTask> = new Map();
  private taskHistory: AgentTask[] = [];
  private defaultOptions: Partial<AgentLoopOptions>;
  private verbose: boolean;

  constructor(
    llm: AgentLlmAdapter,
    toolExecutor: ToolExecutor,
    options?: AgenticLoopOptions
  ) {
    this.llm = llm;
    this.toolExecutor = toolExecutor;
    this.defaultOptions = options?.defaultOptions ?? {};
    this.verbose = options?.verbose ?? false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN LOOP
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Execute an agentic task using ReAct pattern.
   */
  async run(
    request: string,
    context?: Partial<TaskContext>,
    options?: AgentLoopOptions
  ): Promise<AgentTask> {
    const opts = { ...this.defaultOptions, ...options };
    const maxSteps = opts.maxSteps ?? AUI_DEFAULTS.maxSteps;

    // Create task
    const task = this.createTask(request, context);
    this.tasks.set(task.id, task);

    if (this.verbose) {
      console.log(`[AgenticLoop] Starting task ${task.id}: ${request.substring(0, 50)}...`);
    }

    // Update status
    task.status = 'executing';
    opts.onStatusChange?.(task);

    try {
      // Main loop
      while (task.status === 'executing' && task.steps.length < maxSteps) {
        // Check timeout
        if (opts.timeoutMs && Date.now() - task.startedAt > opts.timeoutMs) {
          task.status = 'failed';
          task.error = 'Task timed out';
          break;
        }

        // Execute one step
        const step = await this.executeStep(task, opts);
        task.steps.push(step);
        opts.onStep?.(step);

        // Check if complete
        if (step.type === 'complete') {
          task.status = 'completed';
          task.completedAt = Date.now();
          break;
        }

        // Check if error
        if (step.type === 'error') {
          task.status = 'failed';
          task.error = step.content;
          task.completedAt = Date.now();
          break;
        }

        // Check if awaiting input (status may have been set in executeStep)
        if (task.status !== 'executing') {
          break;
        }
      }

      // Check if max steps reached
      if (task.steps.length >= maxSteps && task.status === 'executing') {
        task.status = 'failed';
        task.error = `Maximum steps (${maxSteps}) reached without completing task`;
        task.completedAt = Date.now();
      }

    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : String(error);
      task.completedAt = Date.now();
    }

    // Move to history
    this.taskHistory.push(task);
    opts.onStatusChange?.(task);

    if (this.verbose) {
      console.log(`[AgenticLoop] Task ${task.id} ${task.status}: ${task.steps.length} steps`);
    }

    return task;
  }

  /**
   * Execute a single step (for step-by-step mode).
   */
  async step(taskId: string, options?: AgentLoopOptions): Promise<AgentStep> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task "${taskId}" not found`);
    }

    if (task.status !== 'executing' && task.status !== 'paused') {
      throw new Error(`Task is not in executable state (status: ${task.status})`);
    }

    task.status = 'executing';
    const step = await this.executeStep(task, options);
    task.steps.push(step);

    // Update status based on step type
    if (step.type === 'complete') {
      task.status = 'completed';
      task.completedAt = Date.now();
    } else if (step.type === 'error') {
      task.status = 'failed';
      task.error = step.content;
      task.completedAt = Date.now();
    } else {
      task.status = 'paused'; // Pause for next step
    }

    return step;
  }

  /**
   * Interrupt a running task.
   */
  interrupt(taskId: string, reason?: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task "${taskId}" not found`);
    }

    task.status = 'cancelled';
    task.error = reason ?? 'Interrupted by user';
    task.completedAt = Date.now();

    if (this.verbose) {
      console.log(`[AgenticLoop] Task ${taskId} interrupted: ${task.error}`);
    }
  }

  /**
   * Resume a paused or awaiting_input task.
   */
  async resume(taskId: string, userInput?: string, options?: AgentLoopOptions): Promise<AgentTask> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task "${taskId}" not found`);
    }

    if (task.status !== 'paused' && task.status !== 'awaiting_input') {
      throw new Error(`Task cannot be resumed (status: ${task.status})`);
    }

    // Add user input as a step if provided
    if (userInput) {
      task.steps.push({
        id: randomUUID(),
        type: 'observe',
        content: `User input: ${userInput}`,
        timestamp: Date.now(),
      });
    }

    task.status = 'executing';

    // Continue the loop
    return this.continueTask(task, options);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TASK MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get a task by ID.
   */
  getTask(taskId: string): AgentTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * List tasks by status.
   */
  listTasks(status?: AgentTaskStatus): AgentTask[] {
    const tasks = Array.from(this.tasks.values());
    if (status) {
      return tasks.filter(t => t.status === status);
    }
    return tasks;
  }

  /**
   * Get task history.
   */
  getTaskHistory(limit?: number): AgentTask[] {
    const history = [...this.taskHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Clear completed tasks from memory.
   */
  clearCompletedTasks(): number {
    let cleared = 0;
    for (const [id, task] of this.tasks) {
      if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
        this.tasks.delete(id);
        cleared++;
      }
    }
    return cleared;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: STEP EXECUTION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a new task.
   */
  private createTask(request: string, context?: Partial<TaskContext>): AgentTask {
    return {
      id: randomUUID(),
      request,
      status: 'pending',
      steps: [],
      currentStepIndex: 0,
      startedAt: Date.now(),
      totalTokens: 0,
      totalCostCents: 0,
      context: {
        variables: context?.variables ?? new Map(),
        ...context,
      },
      priority: 3,
    };
  }

  /**
   * Execute a single step in the task.
   */
  private async executeStep(task: AgentTask, options?: AgentLoopOptions): Promise<AgentStep> {
    const startTime = Date.now();

    // Generate reasoning
    const reasoningResult = await this.reason(task, options);
    task.totalTokens += reasoningResult.tokensUsed ?? 0;

    // Create the step based on reasoning result
    let step: AgentStep;

    switch (reasoningResult.nextAction) {
      case 'tool':
        step = await this.executeToolAction(task, reasoningResult, options);
        break;

      case 'complete':
        step = {
          id: randomUUID(),
          type: 'complete',
          content: reasoningResult.answer ?? 'Task completed',
          timestamp: Date.now(),
          durationMs: Date.now() - startTime,
        };
        task.result = reasoningResult.answer;
        break;

      case 'ask_user':
        step = {
          id: randomUUID(),
          type: 'reason',
          content: reasoningResult.question ?? 'Awaiting user input',
          timestamp: Date.now(),
          durationMs: Date.now() - startTime,
        };
        task.status = 'awaiting_input';
        break;

      case 'adjust_plan':
        step = {
          id: randomUUID(),
          type: 'adjust',
          content: reasoningResult.planAdjustment ?? 'Adjusting approach',
          timestamp: Date.now(),
          durationMs: Date.now() - startTime,
        };
        break;

      default:
        step = {
          id: randomUUID(),
          type: 'error',
          content: 'Unknown action from reasoning',
          timestamp: Date.now(),
          durationMs: Date.now() - startTime,
        };
    }

    return step;
  }

  /**
   * Execute a tool action.
   */
  private async executeToolAction(
    task: AgentTask,
    reasoning: ReasoningResult,
    options?: AgentLoopOptions
  ): Promise<AgentStep> {
    const startTime = Date.now();
    const toolCall = reasoning.toolCall!;

    // Check if approval is needed
    if (this.isDestructiveAction(toolCall) && !options?.autoApprove) {
      if (options?.onApprovalNeeded) {
        const approved = await options.onApprovalNeeded(toolCall);
        if (!approved) {
          return {
            id: randomUUID(),
            type: 'observe',
            content: `Tool "${toolCall.tool}" was not approved by user`,
            toolCall,
            toolResult: { success: false, error: 'User rejected action' },
            timestamp: Date.now(),
            durationMs: Date.now() - startTime,
          };
        }
      }
    }

    // Record the act step
    const actStep: AgentStep = {
      id: randomUUID(),
      type: 'act',
      content: `Executing ${toolCall.tool}`,
      toolCall,
      timestamp: Date.now(),
    };
    task.steps.push(actStep);
    options?.onStep?.(actStep);

    // Execute the tool
    let result: ToolResult;
    try {
      if (toolCall.rawBql) {
        result = await this.toolExecutor.executeBql(toolCall.rawBql);
      } else {
        result = await this.toolExecutor.execute(toolCall.tool, toolCall.args);
      }
    } catch (error) {
      result = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // Update token/cost tracking
    if (result.tokensUsed) {
      task.totalTokens += result.tokensUsed;
    }
    if (result.costCents) {
      task.totalCostCents += result.costCents;
    }

    // Create observe step
    return {
      id: randomUUID(),
      type: 'observe',
      content: this.formatToolResult(result),
      toolCall,
      toolResult: result,
      timestamp: Date.now(),
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Continue a task that was paused.
   */
  private async continueTask(task: AgentTask, options?: AgentLoopOptions): Promise<AgentTask> {
    const opts = { ...this.defaultOptions, ...options };
    const maxSteps = opts.maxSteps ?? AUI_DEFAULTS.maxSteps;

    try {
      while (task.status === 'executing' && task.steps.length < maxSteps) {
        if (opts.timeoutMs && Date.now() - task.startedAt > opts.timeoutMs) {
          task.status = 'failed';
          task.error = 'Task timed out';
          break;
        }

        const step = await this.executeStep(task, opts);
        task.steps.push(step);
        opts.onStep?.(step);

        if (step.type === 'complete') {
          task.status = 'completed';
          task.completedAt = Date.now();
          break;
        }

        if (step.type === 'error') {
          task.status = 'failed';
          task.error = step.content;
          task.completedAt = Date.now();
          break;
        }

        // Check if awaiting input (status may have been set in executeStep)
        if (task.status !== 'executing') {
          break;
        }
      }

      if (task.steps.length >= maxSteps && task.status === 'executing') {
        task.status = 'failed';
        task.error = `Maximum steps (${maxSteps}) reached`;
        task.completedAt = Date.now();
      }

    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : String(error);
      task.completedAt = Date.now();
    }

    opts.onStatusChange?.(task);
    return task;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: REASONING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate reasoning for the next step.
   */
  private async reason(task: AgentTask, options?: AgentLoopOptions): Promise<ReasoningResult & { tokensUsed?: number }> {
    const prompt = this.buildReasoningPrompt(task);
    const temperature = options?.temperature ?? AUI_DEFAULTS.temperature;
    const maxTokens = options?.maxTokens ?? 2000;

    const response = await this.llm.complete(prompt, {
      temperature,
      maxTokens,
      systemPrompt: SYSTEM_PROMPT,
    });

    const parsed = this.parseReasoningResponse(response.text);

    return {
      ...parsed,
      tokensUsed: response.tokensUsed,
    };
  }

  /**
   * Build the reasoning prompt.
   */
  private buildReasoningPrompt(task: AgentTask): string {
    const tools = this.toolExecutor.listTools();
    const toolList = tools.map(t => `- ${t.name}: ${t.description}`).join('\n');

    // Get recent steps
    const recentSteps = task.steps.slice(-MAX_HISTORY_IN_CONTEXT);
    const previousSteps = recentSteps.map(s => ({
      type: s.type,
      content: s.content.substring(0, 500),
    }));

    // Get last tool result
    let lastToolResult: string | undefined;
    for (let i = task.steps.length - 1; i >= 0; i--) {
      if (task.steps[i].toolResult) {
        lastToolResult = this.formatToolResult(task.steps[i].toolResult!);
        break;
      }
    }

    // Build prompt (simplified template rendering)
    let prompt = REASONING_PROMPT_TEMPLATE
      .replace('{{request}}', task.request)
      .replace('{{toolList}}', toolList);

    // Handle plan section
    if (task.plan && task.plan.length > 0) {
      const planStr = task.plan.map((p, i) =>
        `${i + 1}. ${p.description}${p.completed ? ' [DONE]' : ''}`
      ).join('\n');
      prompt = prompt
        .replace('{{#if plan}}', '')
        .replace('{{/if}}', '')
        .replace('{{#each plan}}\n{{@index}}. {{description}} {{#if completed}}[DONE]{{/if}}\n{{/each}}', planStr)
        .replace('{{currentStepIndex}}', String(task.currentStepIndex));
    } else {
      // Remove plan section
      prompt = prompt.replace(/\{\{#if plan\}\}[\s\S]*?\{\{\/if\}\}/g, '');
    }

    // Handle previous steps
    if (previousSteps.length > 0) {
      const stepsStr = previousSteps.map(s => `[${s.type}] ${s.content}`).join('\n');
      prompt = prompt
        .replace('{{#if previousSteps}}', '')
        .replace('{{/if}}', '')
        .replace('{{#each previousSteps}}\n[{{type}}] {{content}}\n{{/each}}', stepsStr);
    } else {
      prompt = prompt.replace(/\{\{#if previousSteps\}\}[\s\S]*?\{\{\/if\}\}/g, '');
    }

    // Handle last tool result
    if (lastToolResult) {
      prompt = prompt
        .replace('{{#if lastToolResult}}', '')
        .replace('{{/if}}', '')
        .replace('{{lastToolResult}}', lastToolResult);
    } else {
      prompt = prompt.replace(/\{\{#if lastToolResult\}\}[\s\S]*?\{\{\/if\}\}/g, '');
    }

    return prompt;
  }

  /**
   * Parse the LLM response to extract next action.
   */
  private parseReasoningResponse(response: string): ReasoningResult {
    // Try to find tool block
    const toolMatch = response.match(/```tool\s*\n([\s\S]*?)\n```/);
    if (toolMatch) {
      try {
        const parsed = JSON.parse(toolMatch[1]);
        return {
          nextAction: 'tool',
          reasoning: response.split('```tool')[0].trim(),
          toolCall: {
            tool: parsed.tool,
            args: parsed.args ?? {},
            rawBql: parsed.bql,
          },
          confidence: 0.8,
        };
      } catch {
        // Invalid JSON, continue parsing
      }
    }

    // Try to find complete block
    const completeMatch = response.match(/```complete\s*\n([\s\S]*?)\n```/);
    if (completeMatch) {
      try {
        const parsed = JSON.parse(completeMatch[1]);
        return {
          nextAction: 'complete',
          reasoning: response.split('```complete')[0].trim(),
          answer: parsed.answer ?? parsed.summary ?? 'Task completed',
          confidence: 0.9,
        };
      } catch {
        // If JSON parsing fails, treat the whole content as the answer
        return {
          nextAction: 'complete',
          reasoning: response,
          answer: completeMatch[1].trim(),
          confidence: 0.7,
        };
      }
    }

    // Try to find ask block
    const askMatch = response.match(/```ask\s*\n([\s\S]*?)\n```/);
    if (askMatch) {
      try {
        const parsed = JSON.parse(askMatch[1]);
        return {
          nextAction: 'ask_user',
          reasoning: response.split('```ask')[0].trim(),
          question: parsed.question,
          confidence: 0.8,
        };
      } catch {
        return {
          nextAction: 'ask_user',
          reasoning: response,
          question: askMatch[1].trim(),
          confidence: 0.6,
        };
      }
    }

    // No recognizable block, assume it's just reasoning
    // Check if it looks like a completion
    if (response.toLowerCase().includes('task complete') ||
        response.toLowerCase().includes('done') ||
        response.toLowerCase().includes('finished')) {
      return {
        nextAction: 'complete',
        reasoning: response,
        answer: response,
        confidence: 0.5,
      };
    }

    // Default to adjustment
    return {
      nextAction: 'adjust_plan',
      reasoning: response,
      planAdjustment: response,
      confidence: 0.4,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if a tool call is destructive.
   */
  private isDestructiveAction(toolCall: ToolCall): boolean {
    if (toolCall.isDestructive) return true;
    if (toolCall.requiresApproval) return true;

    // Check against known destructive tools
    const toolName = toolCall.tool.toLowerCase();
    for (const destructive of DESTRUCTIVE_TOOLS) {
      if (toolName.includes(destructive)) return true;
    }

    return false;
  }

  /**
   * Format tool result for inclusion in context.
   */
  private formatToolResult(result: ToolResult): string {
    if (!result.success) {
      return `Error: ${result.error ?? 'Unknown error'}`;
    }

    if (result.data === undefined) {
      return 'Success (no data returned)';
    }

    let formatted: string;
    if (typeof result.data === 'string') {
      formatted = result.data;
    } else {
      formatted = JSON.stringify(result.data, null, 2);
    }

    // Truncate if too long
    if (formatted.length > MAX_TOOL_RESULT_SIZE) {
      formatted = formatted.substring(0, MAX_TOOL_RESULT_SIZE) + '\n... (truncated)';
    }

    return formatted;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TOOL EXECUTOR FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a tool executor that wraps BQL CLI and custom handlers.
 */
export function createToolExecutor(
  bqlExecutor: (pipeline: string) => Promise<{ data?: unknown; error?: string }>,
  bufferManager: BufferManager,
  customHandlers?: Record<string, (args: Record<string, unknown>) => Promise<ToolResult>>
): ToolExecutor {
  // Built-in buffer tools
  const bufferTools: Record<string, ToolDefinition> = {
    buffer_list: {
      name: 'buffer_list',
      description: 'List all versioned buffers',
      parameters: {},
    },
    buffer_get: {
      name: 'buffer_get',
      description: 'Get content from a buffer',
      parameters: {
        name: { type: 'string', description: 'Buffer name' },
        limit: { type: 'number', description: 'Max items to return' },
      },
      required: ['name'],
    },
    buffer_create: {
      name: 'buffer_create',
      description: 'Create a new versioned buffer',
      parameters: {
        name: { type: 'string', description: 'Buffer name' },
        content: { type: 'array', description: 'Initial content' },
      },
      required: ['name'],
    },
    buffer_commit: {
      name: 'buffer_commit',
      description: 'Commit changes to buffer',
      parameters: {
        name: { type: 'string', description: 'Buffer name' },
        message: { type: 'string', description: 'Commit message' },
      },
      required: ['name', 'message'],
    },
    buffer_history: {
      name: 'buffer_history',
      description: 'Get version history of a buffer',
      parameters: {
        name: { type: 'string', description: 'Buffer name' },
        limit: { type: 'number', description: 'Max versions to return' },
      },
      required: ['name'],
    },
    buffer_branch_create: {
      name: 'buffer_branch_create',
      description: 'Create a new branch',
      parameters: {
        bufferName: { type: 'string', description: 'Buffer name' },
        branchName: { type: 'string', description: 'New branch name' },
      },
      required: ['bufferName', 'branchName'],
    },
    buffer_branch_switch: {
      name: 'buffer_branch_switch',
      description: 'Switch to a different branch',
      parameters: {
        bufferName: { type: 'string', description: 'Buffer name' },
        branchName: { type: 'string', description: 'Branch to switch to' },
      },
      required: ['bufferName', 'branchName'],
    },
    bql: {
      name: 'bql',
      description: 'Execute a BQL pipeline (harvest, transform, save)',
      parameters: {
        pipeline: { type: 'string', description: 'BQL pipeline to execute' },
      },
      required: ['pipeline'],
    },
  };

  return {
    listTools(): ToolDefinition[] {
      const tools = Object.values(bufferTools);
      if (customHandlers) {
        for (const name of Object.keys(customHandlers)) {
          if (!bufferTools[name]) {
            tools.push({
              name,
              description: `Custom handler: ${name}`,
              parameters: {},
            });
          }
        }
      }
      return tools;
    },

    getTool(name: string): ToolDefinition | undefined {
      return bufferTools[name];
    },

    async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
      const startTime = Date.now();

      try {
        // Check custom handlers first
        if (customHandlers?.[name]) {
          return await customHandlers[name](args);
        }

        // Built-in buffer tools
        switch (name) {
          case 'buffer_list': {
            const buffers = bufferManager.listBuffers().map(b => ({
              name: b.name,
              itemCount: b.workingContent.length,
              branch: b.currentBranch,
              isDirty: b.isDirty,
            }));
            return { success: true, data: buffers, durationMs: Date.now() - startTime };
          }

          case 'buffer_get': {
            const buffer = bufferManager.getBuffer(args.name as string);
            if (!buffer) {
              return { success: false, error: `Buffer "${args.name}" not found` };
            }
            const limit = (args.limit as number) ?? 100;
            const content = buffer.workingContent.slice(0, limit);
            return {
              success: true,
              data: { name: buffer.name, content, total: buffer.workingContent.length },
              durationMs: Date.now() - startTime,
            };
          }

          case 'buffer_create': {
            const content = (args.content as unknown[]) ?? [];
            const buffer = bufferManager.createBuffer(args.name as string, content);
            return {
              success: true,
              data: { name: buffer.name, id: buffer.id },
              durationMs: Date.now() - startTime,
            };
          }

          case 'buffer_commit': {
            const version = bufferManager.commit(args.name as string, args.message as string);
            return {
              success: true,
              data: { versionId: version.id, message: version.message },
              durationMs: Date.now() - startTime,
            };
          }

          case 'buffer_history': {
            const limit = (args.limit as number) ?? 10;
            const history = bufferManager.getHistory(args.name as string, limit);
            return {
              success: true,
              data: history.map(v => ({ id: v.id, message: v.message, timestamp: v.timestamp })),
              durationMs: Date.now() - startTime,
            };
          }

          case 'buffer_branch_create': {
            const branch = bufferManager.createBranch(
              args.bufferName as string,
              args.branchName as string
            );
            return {
              success: true,
              data: { branch: branch.name },
              durationMs: Date.now() - startTime,
            };
          }

          case 'buffer_branch_switch': {
            bufferManager.switchBranch(args.bufferName as string, args.branchName as string);
            return {
              success: true,
              data: { branch: args.branchName },
              durationMs: Date.now() - startTime,
            };
          }

          case 'bql': {
            return await this.executeBql(args.pipeline as string);
          }

          default:
            return { success: false, error: `Unknown tool: ${name}` };
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startTime,
        };
      }
    },

    async executeBql(pipeline: string): Promise<ToolResult> {
      const startTime = Date.now();
      try {
        const result = await bqlExecutor(pipeline);
        if (result.error) {
          return {
            success: false,
            error: result.error,
            durationMs: Date.now() - startTime,
          };
        }
        return {
          success: true,
          data: result.data,
          durationMs: Date.now() - startTime,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startTime,
        };
      }
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

let _agenticLoop: AgenticLoop | null = null;

/**
 * Initialize the global agentic loop.
 */
export function initAgenticLoop(
  llm: AgentLlmAdapter,
  toolExecutor: ToolExecutor,
  options?: AgenticLoopOptions
): AgenticLoop {
  _agenticLoop = new AgenticLoop(llm, toolExecutor, options);
  return _agenticLoop;
}

/**
 * Get the global agentic loop.
 */
export function getAgenticLoop(): AgenticLoop | null {
  return _agenticLoop;
}

/**
 * Reset the global agentic loop.
 */
export function resetAgenticLoop(): void {
  _agenticLoop = null;
}
