/**
 * AUI Processing Handlers
 *
 * MCP handlers for NL processing and agent execution.
 *
 * @module @humanizer/core/mcp/handlers/aui/processing
 */

import type { MCPResult } from '../../types.js';
import { jsonResult, errorResult, getService } from './helpers.js';

export async function handleProcess(args: {
  sessionId: string;
  request: string;
  dryRun?: boolean;
  route?: 'bql' | 'search' | 'agent';
}): Promise<MCPResult> {
  try {
    const service = getService();
    const response = await service.process(args.sessionId, args.request, {
      dryRun: args.dryRun,
      route: args.route,
    });
    return jsonResult(response);
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAgentRun(args: {
  sessionId: string;
  request: string;
  maxSteps?: number;
  autoApprove?: boolean;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const task = await service.runAgent(args.sessionId, args.request, {
      maxSteps: args.maxSteps,
      autoApprove: args.autoApprove,
    });
    return jsonResult({
      taskId: task.id,
      status: task.status,
      stepCount: task.steps.length,
      result: task.result,
      error: task.error,
      totalTokens: task.totalTokens,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAgentStep(args: {
  sessionId: string;
  taskId: string;
}): Promise<MCPResult> {
  // Step execution would be implemented via AgenticLoop directly
  return errorResult('Not implemented - use agent_run for full task execution');
}

export async function handleAgentInterrupt(args: {
  sessionId: string;
  taskId: string;
  reason?: string;
}): Promise<MCPResult> {
  // Interrupt would be implemented via AgenticLoop
  return errorResult('Not implemented');
}

export async function handleAgentStatus(args: {
  sessionId: string;
  taskId: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const session = service.getSession(args.sessionId);
    if (!session) {
      return errorResult(`Session "${args.sessionId}" not found`);
    }
    const task = session.taskHistory.find(t => t.id === args.taskId) ?? session.currentTask;
    if (!task || task.id !== args.taskId) {
      return errorResult(`Task "${args.taskId}" not found`);
    }
    return jsonResult({
      taskId: task.id,
      status: task.status,
      stepCount: task.steps.length,
      currentStepIndex: task.currentStepIndex,
      result: task.result,
      error: task.error,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAgentResume(args: {
  sessionId: string;
  taskId: string;
  userInput?: string;
}): Promise<MCPResult> {
  // Resume would be implemented via AgenticLoop
  return errorResult('Not implemented');
}

export async function handleBqlExecute(args: {
  sessionId: string;
  pipeline: string;
  dryRun?: boolean;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const result = await service.executeBql(args.sessionId, args.pipeline, {
      dryRun: args.dryRun,
    });
    return jsonResult(result);
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}
