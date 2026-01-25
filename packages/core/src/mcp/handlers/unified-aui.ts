/**
 * Unified AUI MCP Handlers
 *
 * Handler implementations for the 40+ AUI MCP tools.
 *
 * @module @humanizer/core/mcp/handlers/unified-aui
 */

import type { MCPResult } from '../types.js';
import { TOOL_NAMES } from '../../aui/constants.js';
import type {
  UnifiedAuiService,
  MergeStrategy,
} from '../../aui/index.js';
import { getUnifiedAui } from '../../aui/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function jsonResult(data: unknown): MCPResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message: string): MCPResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

function getService(): UnifiedAuiService {
  const service = getUnifiedAui();
  if (!service) {
    throw new Error('UnifiedAuiService not initialized. Call initUnifiedAui() first.');
  }
  return service;
}

// ═══════════════════════════════════════════════════════════════════════════
// SESSION HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleSessionCreate(args: {
  name?: string;
  userId?: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const session = await service.createSession(args);
    return jsonResult({
      sessionId: session.id,
      name: session.name,
      createdAt: session.createdAt,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleSessionGet(args: {
  sessionId: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const session = service.getSession(args.sessionId);
    if (!session) {
      return errorResult(`Session "${args.sessionId}" not found`);
    }
    return jsonResult({
      id: session.id,
      name: session.name,
      userId: session.userId,
      activeBuffer: session.activeBufferName,
      bufferCount: session.buffers.size,
      taskCount: session.taskHistory.length,
      searchSessionId: session.searchSessionId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      metadata: session.metadata,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleSessionList(): Promise<MCPResult> {
  try {
    const service = getService();
    const sessions = service.listSessions();
    return jsonResult({
      sessions: sessions.map(s => ({
        id: s.id,
        name: s.name,
        userId: s.userId,
        updatedAt: s.updatedAt,
      })),
      count: sessions.length,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleSessionDelete(args: {
  sessionId: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const deleted = service.deleteSession(args.sessionId);
    return jsonResult({ success: deleted });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROCESSING HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// BUFFER LIFECYCLE HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleBufferCreate(args: {
  sessionId: string;
  name: string;
  content?: unknown[];
}): Promise<MCPResult> {
  try {
    const service = getService();
    const buffer = service.createBuffer(args.sessionId, args.name, args.content);
    return jsonResult({
      name: buffer.name,
      id: buffer.id,
      itemCount: buffer.workingContent.length,
      branch: buffer.currentBranch,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleBufferList(args: {
  sessionId: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const buffers = service.listBuffers(args.sessionId);
    return jsonResult({
      buffers: buffers.map(b => ({
        name: b.name,
        itemCount: b.workingContent.length,
        branch: b.currentBranch,
        isDirty: b.isDirty,
        versionCount: b.versions.size,
      })),
      count: buffers.length,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleBufferGet(args: {
  sessionId: string;
  name: string;
  limit?: number;
  offset?: number;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const buffer = service.getBuffer(args.sessionId, args.name);
    if (!buffer) {
      return errorResult(`Buffer "${args.name}" not found`);
    }
    const limit = args.limit ?? 100;
    const offset = args.offset ?? 0;
    const items = buffer.workingContent.slice(offset, offset + limit);
    return jsonResult({
      name: buffer.name,
      items,
      total: buffer.workingContent.length,
      offset,
      limit,
      isDirty: buffer.isDirty,
      branch: buffer.currentBranch,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleBufferSet(args: {
  sessionId: string;
  name: string;
  content: unknown[];
}): Promise<MCPResult> {
  try {
    const service = getService();
    service.setBufferContent(args.sessionId, args.name, args.content);
    return jsonResult({
      success: true,
      name: args.name,
      itemCount: args.content.length,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleBufferAppend(args: {
  sessionId: string;
  name: string;
  items: unknown[];
}): Promise<MCPResult> {
  try {
    const service = getService();
    service.appendToBuffer(args.sessionId, args.name, args.items);
    const buffer = service.getBuffer(args.sessionId, args.name);
    return jsonResult({
      success: true,
      name: args.name,
      itemCount: buffer?.workingContent.length ?? 0,
      appended: args.items.length,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleBufferDelete(args: {
  sessionId: string;
  name: string;
}): Promise<MCPResult> {
  try {
    const { getBufferManager } = await import('../../aui/buffer-manager.js');
    const manager = getBufferManager();
    const deleted = manager.deleteBuffer(args.name);
    return jsonResult({ success: deleted });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BUFFER VERSION HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleBufferCommit(args: {
  sessionId: string;
  name: string;
  message: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const version = await service.commit(args.sessionId, args.name, args.message);
    return jsonResult({
      versionId: version.id,
      message: version.message,
      timestamp: version.timestamp,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleBufferRollback(args: {
  sessionId: string;
  name: string;
  steps?: number;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const version = service.rollback(args.sessionId, args.name, args.steps);
    return jsonResult({
      versionId: version.id,
      message: version.message,
      timestamp: version.timestamp,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleBufferHistory(args: {
  sessionId: string;
  name: string;
  limit?: number;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const history = service.getHistory(args.sessionId, args.name, args.limit);
    return jsonResult({
      history: history.map(v => ({
        id: v.id,
        message: v.message,
        timestamp: v.timestamp,
        tags: v.tags,
        itemCount: v.content.length,
      })),
      count: history.length,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleBufferTag(args: {
  sessionId: string;
  name: string;
  versionId: string;
  tag: string;
}): Promise<MCPResult> {
  try {
    const { getBufferManager } = await import('../../aui/buffer-manager.js');
    const manager = getBufferManager();
    manager.tag(args.name, args.versionId, args.tag);
    return jsonResult({ success: true, versionId: args.versionId, tag: args.tag });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleBufferCheckout(args: {
  sessionId: string;
  name: string;
  versionIdOrTag: string;
}): Promise<MCPResult> {
  try {
    const { getBufferManager } = await import('../../aui/buffer-manager.js');
    const manager = getBufferManager();
    manager.checkout(args.name, args.versionIdOrTag);
    return jsonResult({ success: true, checkedOut: args.versionIdOrTag });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BUFFER BRANCH HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleBufferBranchCreate(args: {
  sessionId: string;
  bufferName: string;
  branchName: string;
  description?: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const branch = service.branch(args.sessionId, args.bufferName, args.branchName);
    return jsonResult({
      branch: branch.name,
      createdAt: branch.createdAt,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleBufferBranchSwitch(args: {
  sessionId: string;
  bufferName: string;
  branchName: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    service.switchBranch(args.sessionId, args.bufferName, args.branchName);
    return jsonResult({ success: true, branch: args.branchName });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleBufferBranchList(args: {
  sessionId: string;
  bufferName: string;
}): Promise<MCPResult> {
  try {
    const { getBufferManager } = await import('../../aui/buffer-manager.js');
    const manager = getBufferManager();
    const branches = manager.listBranches(args.bufferName);
    const buffer = manager.getBuffer(args.bufferName);
    return jsonResult({
      branches: branches.map(b => ({
        name: b.name,
        isCurrent: b.name === buffer?.currentBranch,
        createdAt: b.createdAt,
        description: b.description,
      })),
      count: branches.length,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleBufferBranchDelete(args: {
  sessionId: string;
  bufferName: string;
  branchName: string;
}): Promise<MCPResult> {
  try {
    const { getBufferManager } = await import('../../aui/buffer-manager.js');
    const manager = getBufferManager();
    const deleted = manager.deleteBranch(args.bufferName, args.branchName);
    return jsonResult({ success: deleted });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleBufferMerge(args: {
  sessionId: string;
  bufferName: string;
  sourceBranch: string;
  message?: string;
  strategy?: MergeStrategy;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const result = service.merge(args.sessionId, args.bufferName, args.sourceBranch, args.message);
    return jsonResult({
      success: result.success,
      newVersionId: result.newVersionId,
      conflicts: result.conflicts.length,
      details: result.details,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleBufferDiff(args: {
  sessionId: string;
  bufferName: string;
  fromVersion: string;
  toVersion: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const diff = service.diff(args.sessionId, args.bufferName, args.fromVersion, args.toVersion);
    return jsonResult({
      summary: diff.summary,
      added: diff.added.length,
      removed: diff.removed.length,
      modified: diff.modified.length,
      stats: diff.stats,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SEARCH HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleSearch(args: {
  sessionId: string;
  query: string;
  target?: 'archive' | 'books' | 'all';
  limit?: number;
  threshold?: number;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const response = await service.search(args.sessionId, args.query, {
      target: args.target,
      limit: args.limit,
      threshold: args.threshold,
    });
    return jsonResult({
      results: response.results.map(r => ({
        id: r.id,
        text: r.text.substring(0, 200) + (r.text.length > 200 ? '...' : ''),
        score: r.score,
        source: r.source,
      })),
      count: response.results.length,
      stats: response.stats,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleSearchRefine(args: {
  sessionId: string;
  query?: string;
  minScore?: number;
  minWordCount?: number;
  limit?: number;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const response = await service.refine(args.sessionId, {
      query: args.query,
      minScore: args.minScore,
      minWordCount: args.minWordCount,
      limit: args.limit,
    });
    return jsonResult({
      results: response.results.length,
      stats: response.stats,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleSearchAnchorAdd(args: {
  sessionId: string;
  resultId: string;
  type: 'positive' | 'negative';
}): Promise<MCPResult> {
  try {
    const service = getService();
    const anchor = await service.addAnchor(args.sessionId, args.resultId, args.type);
    return jsonResult({
      anchorId: anchor.id,
      type: args.type,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleSearchAnchorRemove(args: {
  sessionId: string;
  anchorId: string;
}): Promise<MCPResult> {
  // Would need to implement in AgenticSearchService
  return errorResult('Not implemented');
}

export async function handleSearchToBuffer(args: {
  sessionId: string;
  bufferName: string;
  limit?: number;
  create?: boolean;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const buffer = await service.searchToBuffer(args.sessionId, args.bufferName, {
      limit: args.limit,
      create: args.create,
    });
    return jsonResult({
      bufferName: buffer.name,
      itemCount: buffer.workingContent.length,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN CONFIG HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleAdminConfigGet(args: {
  category: string;
  key: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const value = await service.getConfig(args.category, args.key);
    return jsonResult({ category: args.category, key: args.key, value });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAdminConfigSet(args: {
  category: string;
  key: string;
  value: string;
  reason?: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const parsedValue = JSON.parse(args.value);
    await service.setConfig(args.category, args.key, parsedValue);
    return jsonResult({ success: true, category: args.category, key: args.key });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAdminConfigList(args: {
  category: string;
}): Promise<MCPResult> {
  try {
    const { getAdminService } = await import('../../aui/admin-service.js');
    const admin = getAdminService();
    if (!admin) {
      return errorResult('Admin service not initialized');
    }
    const entries = await admin.listConfig(args.category as any);
    return jsonResult({
      category: args.category,
      entries: entries.map(e => ({ key: e.key, value: e.value })),
      count: entries.length,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAdminConfigAudit(args: {
  category?: string;
  limit?: number;
}): Promise<MCPResult> {
  try {
    const { getAdminService } = await import('../../aui/admin-service.js');
    const admin = getAdminService();
    if (!admin) {
      return errorResult('Admin service not initialized');
    }
    const entries = await admin.getConfigAudit(args.category as any, args.limit);
    return jsonResult({
      entries: entries.slice(0, args.limit ?? 50),
      count: entries.length,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN PROMPT HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleAdminPromptList(args: {
  tag?: string;
  usedBy?: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const prompts = await service.listPrompts();
    return jsonResult({
      prompts: prompts.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        requiredVariables: p.requiredVariables,
      })),
      count: prompts.length,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAdminPromptGet(args: {
  id: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const prompt = await service.getPrompt(args.id);
    if (!prompt) {
      return errorResult(`Prompt "${args.id}" not found`);
    }
    return jsonResult(prompt);
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAdminPromptSet(args: {
  id: string;
  name: string;
  template: string;
  description?: string;
  requiredVariables?: string[];
}): Promise<MCPResult> {
  try {
    const service = getService();
    await service.setPrompt({
      id: args.id,
      name: args.name,
      template: args.template,
      description: args.description,
      requiredVariables: args.requiredVariables ?? [],
    });
    return jsonResult({ success: true, id: args.id });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAdminPromptTest(args: {
  id: string;
  variables: Record<string, string>;
}): Promise<MCPResult> {
  try {
    const { getAdminService } = await import('../../aui/admin-service.js');
    const admin = getAdminService();
    if (!admin) {
      return errorResult('Admin service not initialized');
    }
    const result = await admin.testPrompt(args.id, args.variables);
    return jsonResult({ compiledPrompt: result });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN COST & USAGE HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleAdminCostRecord(args: {
  model: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  success: boolean;
  userId?: string;
}): Promise<MCPResult> {
  try {
    const { getAdminService } = await import('../../aui/admin-service.js');
    const admin = getAdminService();
    if (!admin) {
      return errorResult('Admin service not initialized');
    }
    const costCents = admin.calculateCost(args.model, args.inputTokens, args.outputTokens);
    admin.recordLlmCost({
      model: args.model,
      operation: args.operation,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      costCents,
      latencyMs: args.latencyMs,
      success: args.success,
      userId: args.userId,
    });
    return jsonResult({ success: true, costCents });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAdminCostReport(args: {
  startDate: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month';
  userId?: string;
  model?: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const report = await service.getCostReport({
      startDate: new Date(args.startDate),
      endDate: args.endDate ? new Date(args.endDate) : undefined,
      groupBy: args.groupBy,
      userId: args.userId,
      model: args.model,
    });
    return jsonResult({
      totalCostCents: report.totalCostCents,
      totalTokens: report.totalTokens,
      totalRequests: report.totalRequests,
      byModelCount: report.byModel.size,
      byOperationCount: report.byOperation.size,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAdminUsageGet(args: {
  userId: string;
  period?: 'day' | 'month';
}): Promise<MCPResult> {
  try {
    const service = getService();
    const usage = await service.getUsage(args.userId);
    return jsonResult({
      userId: usage.userId,
      tierId: usage.tierId,
      period: usage.period,
      tokensUsed: usage.tokensUsed,
      requestsCount: usage.requestsCount,
      costAccruedCents: usage.costAccruedCents,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAdminUsageCheck(args: {
  userId: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const result = await service.checkLimits(args.userId);
    return jsonResult({
      withinLimits: result.withinLimits,
      exceededLimits: result.exceededLimits,
      warnings: result.warnings,
      tierName: result.tier.name,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAdminUsageReport(args: {
  startDate: string;
  endDate?: string;
  groupBy?: 'user' | 'tier' | 'model' | 'operation';
  limit?: number;
}): Promise<MCPResult> {
  try {
    const { getAdminService } = await import('../../aui/admin-service.js');
    const admin = getAdminService();
    if (!admin) {
      return errorResult('Admin service not initialized');
    }
    const report = await admin.getUsageReport({
      startDate: new Date(args.startDate),
      endDate: args.endDate ? new Date(args.endDate) : undefined,
      groupBy: args.groupBy,
      limit: args.limit,
    });
    return jsonResult({
      totalUsers: report.totalUsers,
      activeUsers: report.activeUsers,
      totalTokens: report.totalTokens,
      totalCostCents: report.totalCostCents,
      breakdownCount: report.breakdown.size,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN TIER HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleAdminTierList(): Promise<MCPResult> {
  try {
    const service = getService();
    const tiers = await service.listTiers();
    return jsonResult({
      tiers: tiers.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        priceMonthly: t.priceMonthly,
        tokensPerDay: t.limits.tokensPerDay,
      })),
      count: tiers.length,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAdminTierGet(args: {
  tierId: string;
}): Promise<MCPResult> {
  try {
    const { getAdminService } = await import('../../aui/admin-service.js');
    const admin = getAdminService();
    if (!admin) {
      return errorResult('Admin service not initialized');
    }
    const tier = await admin.getTier(args.tierId);
    if (!tier) {
      return errorResult(`Tier "${args.tierId}" not found`);
    }
    return jsonResult(tier);
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAdminTierSet(args: {
  id: string;
  name: string;
  description?: string;
  limits?: Record<string, unknown>;
  features?: string[];
  priceMonthly?: number;
  isPublic?: boolean;
}): Promise<MCPResult> {
  try {
    const { getAdminService } = await import('../../aui/admin-service.js');
    const { DEFAULT_TIERS } = await import('../../aui/constants.js');
    const admin = getAdminService();
    if (!admin) {
      return errorResult('Admin service not initialized');
    }

    // Get base tier limits from defaults
    const baseTier = DEFAULT_TIERS.free;

    await admin.setTier({
      id: args.id,
      name: args.name,
      description: args.description,
      limits: { ...baseTier.limits, ...(args.limits as any) },
      features: args.features ?? [],
      priceMonthly: args.priceMonthly,
      priority: 2,
      isPublic: args.isPublic ?? true,
    });
    return jsonResult({ success: true, id: args.id });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAdminUserTierGet(args: {
  userId: string;
}): Promise<MCPResult> {
  try {
    const { getAdminService } = await import('../../aui/admin-service.js');
    const admin = getAdminService();
    if (!admin) {
      return errorResult('Admin service not initialized');
    }
    const tier = await admin.getUserTier(args.userId);
    return jsonResult({
      userId: args.userId,
      tier: {
        id: tier.id,
        name: tier.name,
      },
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAdminUserTierSet(args: {
  userId: string;
  tierId: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    await service.setUserTier(args.userId, args.tierId);
    return jsonResult({ success: true, userId: args.userId, tierId: args.tierId });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ARCHIVE & EMBEDDING HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleArchiveStats(): Promise<MCPResult> {
  try {
    const service = getService();
    const stats = await service.getArchiveStats();
    return jsonResult(stats);
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleArchiveEmbedAll(args: {
  batchSize?: number;
  minWordCount?: number;
  limit?: number;
  sourceTypes?: string[];
  authorRoles?: ('user' | 'assistant' | 'system' | 'tool')[];
  skipExisting?: boolean;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const result = await service.embedAll({
      batchSize: args.batchSize,
      minWordCount: args.minWordCount,
      limit: args.limit,
      sourceTypes: args.sourceTypes,
      authorRoles: args.authorRoles,
      skipExisting: args.skipExisting ?? true,
    });
    return jsonResult(result);
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleArchiveEmbedBatch(args: {
  nodeIds: string[];
}): Promise<MCPResult> {
  try {
    const service = getService();
    const result = await service.embedBatch(args.nodeIds);
    return jsonResult(result);
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CLUSTERING HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleClusterDiscover(args: {
  sampleSize?: number;
  minClusterSize?: number;
  maxClusters?: number;
  minSimilarity?: number;
  excludePatterns?: string[];
  minWordCount?: number;
  sourceTypes?: string[];
  authorRoles?: ('user' | 'assistant')[];
  generateLabels?: boolean;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const result = await service.discoverClusters({
      sampleSize: args.sampleSize,
      minClusterSize: args.minClusterSize,
      maxClusters: args.maxClusters,
      minSimilarity: args.minSimilarity,
      excludePatterns: args.excludePatterns,
      minWordCount: args.minWordCount,
      sourceTypes: args.sourceTypes,
      authorRoles: args.authorRoles,
      generateLabels: args.generateLabels,
    });
    return jsonResult({
      clusters: result.clusters.map(c => ({
        id: c.id,
        label: c.label,
        description: c.description.substring(0, 200),
        totalPassages: c.totalPassages,
        coherence: c.coherence,
        keywords: c.keywords.slice(0, 5),
      })),
      totalPassages: result.totalPassages,
      assignedPassages: result.assignedPassages,
      noisePassages: result.noisePassages,
      durationMs: result.durationMs,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleClusterList(): Promise<MCPResult> {
  try {
    const service = getService();
    const clusters = await service.listClusters();
    return jsonResult({
      clusters: clusters.map(c => ({
        id: c.id,
        label: c.label,
        totalPassages: c.totalPassages,
        coherence: c.coherence,
        keywords: c.keywords?.slice(0, 5) || [],
        sourceDistribution: c.sourceDistribution,
      })),
      count: clusters.length,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleClusterGet(args: {
  clusterId: string;
  passageLimit?: number;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const cluster = await service.getCluster(args.clusterId);
    if (!cluster) {
      return errorResult(`Cluster "${args.clusterId}" not found`);
    }

    const passageLimit = args.passageLimit ?? 10;
    return jsonResult({
      id: cluster.id,
      label: cluster.label,
      description: cluster.description,
      passages: cluster.passages.slice(0, passageLimit).map(p => ({
        id: p.id,
        text: p.text.substring(0, 300) + (p.text.length > 300 ? '...' : ''),
        sourceType: p.sourceType,
        wordCount: p.wordCount,
      })),
      totalPassages: cluster.totalPassages,
      coherence: cluster.coherence,
      keywords: cluster.keywords,
      sourceDistribution: cluster.sourceDistribution,
      dateRange: cluster.dateRange,
      avgWordCount: cluster.avgWordCount,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BOOK CREATION HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleBookCreateFromCluster(args: {
  clusterId: string;
  title?: string;
  maxPassages?: number;
  generateIntro?: boolean;
  arcType?: 'chronological' | 'thematic' | 'dramatic' | 'exploratory';
  audience?: string;
  style?: 'conversational' | 'formal' | 'literary' | 'journalistic';
}): Promise<MCPResult> {
  try {
    const service = getService();
    const book = await service.createBookFromCluster(args.clusterId, {
      title: args.title,
      maxPassages: args.maxPassages,
      generateIntro: args.generateIntro ?? true,
      arcType: args.arcType,
      audience: args.audience,
      style: args.style,
    });
    return jsonResult({
      id: book.id,
      title: book.title,
      description: book.description,
      chapterCount: book.chapters.length,
      totalWordCount: book.metadata.totalWordCount,
      status: book.status,
      createdAt: book.createdAt.toISOString(),
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleBookHarvest(args: {
  query: string;
  limit?: number;
  minRelevance?: number;
  maxFromSingleSource?: number;
  dateStart?: string;
  dateEnd?: string;
  excludeIds?: string[];
}): Promise<MCPResult> {
  try {
    const service = getService();
    const result = await service.harvest({
      query: args.query,
      limit: args.limit,
      minRelevance: args.minRelevance,
      maxFromSingleSource: args.maxFromSingleSource,
      dateRange: (args.dateStart || args.dateEnd) ? {
        start: args.dateStart ? new Date(args.dateStart) : undefined,
        end: args.dateEnd ? new Date(args.dateEnd) : undefined,
      } : undefined,
      excludeIds: args.excludeIds,
    });
    return jsonResult({
      passages: result.passages.map(p => ({
        id: p.id,
        text: p.text.substring(0, 200) + (p.text.length > 200 ? '...' : ''),
        relevance: p.relevance,
        sourceType: p.sourceType,
        wordCount: p.wordCount,
      })),
      query: result.query,
      candidatesFound: result.candidatesFound,
      durationMs: result.durationMs,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleBookGenerateArc(args: {
  passageIds: string[];
  arcType?: 'chronological' | 'thematic' | 'dramatic' | 'exploratory';
  introWordCount?: number;
  includeChapterSummaries?: boolean;
}): Promise<MCPResult> {
  try {
    const service = getService();

    // Fetch passages by ID
    const harvestResult = await service.harvest({
      query: args.passageIds.join(' '),
      limit: args.passageIds.length * 2,
    });

    // Filter to only requested IDs
    const passages = harvestResult.passages.filter(p => args.passageIds.includes(p.id));

    const arc = await service.generateArc({
      passages,
      arcType: args.arcType,
      introWordCount: args.introWordCount,
      includeChapterSummaries: args.includeChapterSummaries,
    });

    return jsonResult({
      title: arc.title,
      arcType: arc.arcType,
      introduction: arc.introduction,
      chapters: arc.chapters.map(ch => ({
        title: ch.title,
        summary: ch.summary,
        passageCount: ch.passageIds.length,
        position: ch.position,
      })),
      themes: arc.themes,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleBookList(): Promise<MCPResult> {
  try {
    const service = getService();
    const books = await service.listBooks();
    return jsonResult({
      books: books.map(b => ({
        id: b.id,
        title: b.title,
        chapterCount: b.chapters.length,
        status: b.status,
        createdAt: b.createdAt.toISOString(),
      })),
      count: books.length,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleBookGet(args: {
  bookId: string;
  includeContent?: boolean;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const book = await service.getBook(args.bookId);
    if (!book) {
      return errorResult(`Book "${args.bookId}" not found`);
    }

    const result: Record<string, unknown> = {
      id: book.id,
      title: book.title,
      description: book.description,
      arc: {
        title: book.arc.title,
        introduction: book.arc.introduction,
        themes: book.arc.themes,
      },
      chapters: book.chapters.map(ch => ({
        id: ch.id,
        title: ch.title,
        wordCount: ch.wordCount,
        position: ch.position,
        ...(args.includeContent ? { content: ch.content } : {}),
      })),
      status: book.status,
      createdAt: book.createdAt.toISOString(),
      updatedAt: book.updatedAt.toISOString(),
      metadata: book.metadata,
    };

    return jsonResult(result);
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PERSONA HARVEST HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handlePersonaStartHarvest(args: {
  sessionId: string;
  name: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const result = await service.startPersonaHarvest(args.sessionId, { name: args.name });
    return jsonResult({
      harvestId: result.harvestId,
      status: result.status,
      message: `Persona harvest session started. Add samples with persona_add_sample or persona_harvest_archive.`,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handlePersonaAddSample(args: {
  harvestId: string;
  text: string;
  source?: 'user-provided' | 'archive';
  archiveNodeId?: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const result = await service.addPersonaSample(args.harvestId, {
      text: args.text,
      source: args.source,
      archiveNodeId: args.archiveNodeId,
    });
    return jsonResult({
      totalSamples: result.totalSamples,
      message: `Sample added. Total samples: ${result.totalSamples}`,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handlePersonaHarvestArchive(args: {
  harvestId: string;
  query: string;
  minRelevance?: number;
  limit?: number;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const result = await service.harvestFromArchive(args.harvestId, {
      query: args.query,
      minRelevance: args.minRelevance,
      limit: args.limit,
    });
    return jsonResult({
      samplesFound: result.samplesFound,
      totalSamples: result.totalSamples,
      message: `Found ${result.samplesFound} relevant samples from archive. Total samples: ${result.totalSamples}`,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handlePersonaExtractTraits(args: {
  harvestId: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const result = await service.extractPersonaTraits(args.harvestId);
    return jsonResult({
      voiceTraits: result.voiceTraits,
      toneMarkers: result.toneMarkers,
      voiceFingerprint: result.voiceFingerprint,
      suggestedStyles: result.suggestedStyles.map(s => ({
        name: s.name,
        description: s.description,
        formalityLevel: s.formalityLevel,
        useContractions: s.useContractions,
      })),
      confidence: result.confidence,
      message: `Extracted ${result.voiceTraits.length} voice traits. Suggested ${result.suggestedStyles.length} styles.`,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handlePersonaFinalize(args: {
  harvestId: string;
  voiceTraits?: string[];
  toneMarkers?: string[];
  formalityRange?: [number, number];
  styles?: Array<{
    name: string;
    forbiddenPhrases?: string[];
    preferredPatterns?: string[];
    useContractions?: boolean;
    useRhetoricalQuestions?: boolean;
    formalityLevel?: number;
    isDefault?: boolean;
  }>;
  setAsDefault?: boolean;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const result = await service.finalizePersona(args.harvestId, {
      voiceTraits: args.voiceTraits,
      toneMarkers: args.toneMarkers,
      formalityRange: args.formalityRange,
      styles: args.styles,
      setAsDefault: args.setAsDefault,
    });
    return jsonResult({
      personaId: result.personaId,
      styleIds: result.styleIds,
      message: `Persona created with ${result.styleIds.length} styles.`,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLE PROFILE HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleStyleCreate(args: {
  personaId: string;
  name: string;
  description?: string;
  context?: string;
  forbiddenPhrases?: string[];
  preferredPatterns?: string[];
  sentenceVariety?: 'low' | 'medium' | 'high';
  paragraphStyle?: 'short' | 'medium' | 'long';
  useContractions?: boolean;
  useRhetoricalQuestions?: boolean;
  formalityLevel?: number;
  isDefault?: boolean;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const style = await service.createStyleProfile({
      personaId: args.personaId,
      name: args.name,
      description: args.description,
      context: args.context,
      forbiddenPhrases: args.forbiddenPhrases,
      preferredPatterns: args.preferredPatterns,
      sentenceVariety: args.sentenceVariety,
      paragraphStyle: args.paragraphStyle,
      useContractions: args.useContractions,
      useRhetoricalQuestions: args.useRhetoricalQuestions,
      formalityLevel: args.formalityLevel,
      isDefault: args.isDefault,
    });
    return jsonResult({
      id: style.id,
      name: style.name,
      personaId: style.personaId,
      isDefault: style.isDefault,
      message: `Style "${style.name}" created.`,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleStyleList(args: {
  personaId: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const styles = await service.listStyleProfiles(args.personaId);
    return jsonResult({
      styles: styles.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        context: s.context,
        formalityLevel: s.formalityLevel,
        useContractions: s.useContractions,
        isDefault: s.isDefault,
        forbiddenPhrasesCount: s.forbiddenPhrases.length,
      })),
      count: styles.length,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleStyleGet(args: {
  styleId: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const style = await service.getStyleProfile(args.styleId);
    if (!style) {
      return errorResult(`Style "${args.styleId}" not found`);
    }
    return jsonResult(style);
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleStyleUpdate(args: {
  styleId: string;
  name?: string;
  description?: string;
  context?: string;
  forbiddenPhrases?: string[];
  preferredPatterns?: string[];
  sentenceVariety?: 'low' | 'medium' | 'high';
  paragraphStyle?: 'short' | 'medium' | 'long';
  useContractions?: boolean;
  useRhetoricalQuestions?: boolean;
  formalityLevel?: number;
  isDefault?: boolean;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const style = await service.updateStyleProfile(args.styleId, {
      name: args.name,
      description: args.description,
      context: args.context,
      forbiddenPhrases: args.forbiddenPhrases,
      preferredPatterns: args.preferredPatterns,
      sentenceVariety: args.sentenceVariety,
      paragraphStyle: args.paragraphStyle,
      useContractions: args.useContractions,
      useRhetoricalQuestions: args.useRhetoricalQuestions,
      formalityLevel: args.formalityLevel,
      isDefault: args.isDefault,
    });
    if (!style) {
      return errorResult(`Style "${args.styleId}" not found`);
    }
    return jsonResult({
      id: style.id,
      name: style.name,
      message: `Style "${style.name}" updated.`,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleStyleDelete(args: {
  styleId: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const deleted = await service.deleteStyleProfile(args.styleId);
    return jsonResult({
      success: deleted,
      message: deleted ? 'Style deleted.' : 'Style not found.',
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PERSONA PROFILE HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handlePersonaList(args: {
  userId?: string;
  limit?: number;
  offset?: number;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const personas = await service.listPersonaProfiles({
      userId: args.userId,
      limit: args.limit,
      offset: args.offset,
    });
    return jsonResult({
      personas: personas.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        voiceTraits: p.voiceTraits,
        toneMarkers: p.toneMarkers,
        isDefault: p.isDefault,
      })),
      count: personas.length,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handlePersonaGet(args: {
  personaId: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const persona = await service.getPersonaProfile(args.personaId);
    if (!persona) {
      return errorResult(`Persona "${args.personaId}" not found`);
    }
    return jsonResult(persona);
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handlePersonaGetDefault(args: {
  userId: string;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const persona = await service.getDefaultPersonaProfile(args.userId);
    if (!persona) {
      return jsonResult({
        message: 'No default persona set for this user.',
      });
    }
    return jsonResult(persona);
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Set a persona as the default for a user.
 */
export async function handlePersonaSetDefault(args: {
  userId: string;
  personaId: string;
}): Promise<MCPResult> {
  try {
    if (!args.userId) {
      return errorResult('userId is required');
    }
    if (!args.personaId) {
      return errorResult('personaId is required');
    }

    const service = getService();
    const persona = await service.setDefaultPersona(args.userId, args.personaId);

    return jsonResult({
      message: `Persona "${persona.name}" set as default for user.`,
      persona,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Create a book with explicit persona consistency.
 *
 * This is a convenience method that handles persona resolution and
 * book creation in one call. Supports either cluster-based or
 * query-based content sourcing.
 */
export async function handleBookCreateWithPersona(args: {
  userId: string;
  clusterId?: string;
  query?: string;
  personaId?: string;
  styleId?: string;
  title?: string;
  arcType?: 'chronological' | 'thematic' | 'dramatic' | 'exploratory';
  maxPassages?: number;
}): Promise<MCPResult> {
  try {
    if (!args.userId) {
      return errorResult('userId is required');
    }
    if (!args.clusterId && !args.query) {
      return errorResult('Either clusterId or query is required');
    }

    const service = getService();

    const book = await service.createBookWithPersona({
      userId: args.userId,
      clusterId: args.clusterId,
      query: args.query,
      personaId: args.personaId,
      styleId: args.styleId,
      title: args.title,
      arcType: args.arcType,
      maxPassages: args.maxPassages,
    });

    return jsonResult({
      message: `Book "${book.title}" created with persona-consistent chapters.`,
      book: {
        id: book.id,
        title: book.title,
        description: book.description,
        chapterCount: book.chapters.length,
        totalWordCount: book.metadata?.totalWordCount,
        personaId: book.metadata?.personaId,
        personaName: book.metadata?.personaName,
        styleId: book.metadata?.styleId,
        styleName: book.metadata?.styleName,
        status: book.status,
        createdAt: book.createdAt,
      },
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Generate a sample in the persona's voice for preview.
 *
 * This is used during persona creation to let users review what content
 * would look like before committing to save the persona.
 */
export async function handlePersonaGenerateSample(args: {
  harvestId: string;
  wordCount?: number;
  topic?: string;
}): Promise<MCPResult> {
  try {
    if (!args.harvestId) {
      return errorResult('harvestId is required');
    }

    const service = getService();

    const result = await service.generatePersonaSample(args.harvestId, {
      wordCount: args.wordCount,
      topic: args.topic,
    });

    return jsonResult({
      message: 'Sample generated. Review this content to see how your persona writes.',
      sample: result.sample,
      personaPreview: result.personaPreview,
      metrics: result.metrics,
      nextSteps: [
        'If satisfied, call persona_finalize to save the persona.',
        'If not satisfied, add more samples with persona_add_sample.',
      ],
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLER REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

export const UNIFIED_AUI_HANDLERS: Record<string, (args: unknown) => Promise<MCPResult>> = {
  // Session
  [TOOL_NAMES.SESSION_CREATE]: handleSessionCreate as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.SESSION_GET]: handleSessionGet as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.SESSION_LIST]: handleSessionList as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.SESSION_DELETE]: handleSessionDelete as (args: unknown) => Promise<MCPResult>,

  // Processing
  [TOOL_NAMES.PROCESS]: handleProcess as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.AGENT_RUN]: handleAgentRun as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.AGENT_STEP]: handleAgentStep as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.AGENT_INTERRUPT]: handleAgentInterrupt as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.AGENT_STATUS]: handleAgentStatus as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.AGENT_RESUME]: handleAgentResume as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.BQL_EXECUTE]: handleBqlExecute as (args: unknown) => Promise<MCPResult>,

  // Buffer lifecycle
  [TOOL_NAMES.BUFFER_CREATE]: handleBufferCreate as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.BUFFER_LIST]: handleBufferList as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.BUFFER_GET]: handleBufferGet as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.BUFFER_SET]: handleBufferSet as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.BUFFER_APPEND]: handleBufferAppend as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.BUFFER_DELETE]: handleBufferDelete as (args: unknown) => Promise<MCPResult>,

  // Buffer version control
  [TOOL_NAMES.BUFFER_COMMIT]: handleBufferCommit as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.BUFFER_ROLLBACK]: handleBufferRollback as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.BUFFER_HISTORY]: handleBufferHistory as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.BUFFER_TAG]: handleBufferTag as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.BUFFER_CHECKOUT]: handleBufferCheckout as (args: unknown) => Promise<MCPResult>,

  // Buffer branching
  [TOOL_NAMES.BUFFER_BRANCH_CREATE]: handleBufferBranchCreate as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.BUFFER_BRANCH_SWITCH]: handleBufferBranchSwitch as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.BUFFER_BRANCH_LIST]: handleBufferBranchList as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.BUFFER_BRANCH_DELETE]: handleBufferBranchDelete as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.BUFFER_MERGE]: handleBufferMerge as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.BUFFER_DIFF]: handleBufferDiff as (args: unknown) => Promise<MCPResult>,

  // Search
  [TOOL_NAMES.SEARCH]: handleSearch as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.SEARCH_REFINE]: handleSearchRefine as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.SEARCH_ANCHOR_ADD]: handleSearchAnchorAdd as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.SEARCH_ANCHOR_REMOVE]: handleSearchAnchorRemove as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.SEARCH_TO_BUFFER]: handleSearchToBuffer as (args: unknown) => Promise<MCPResult>,

  // Admin config
  [TOOL_NAMES.ADMIN_CONFIG_GET]: handleAdminConfigGet as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.ADMIN_CONFIG_SET]: handleAdminConfigSet as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.ADMIN_CONFIG_LIST]: handleAdminConfigList as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.ADMIN_CONFIG_AUDIT]: handleAdminConfigAudit as (args: unknown) => Promise<MCPResult>,

  // Admin prompts
  [TOOL_NAMES.ADMIN_PROMPT_LIST]: handleAdminPromptList as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.ADMIN_PROMPT_GET]: handleAdminPromptGet as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.ADMIN_PROMPT_SET]: handleAdminPromptSet as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.ADMIN_PROMPT_TEST]: handleAdminPromptTest as (args: unknown) => Promise<MCPResult>,

  // Admin costs & usage
  [TOOL_NAMES.ADMIN_COST_RECORD]: handleAdminCostRecord as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.ADMIN_COST_REPORT]: handleAdminCostReport as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.ADMIN_USAGE_GET]: handleAdminUsageGet as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.ADMIN_USAGE_CHECK]: handleAdminUsageCheck as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.ADMIN_USAGE_REPORT]: handleAdminUsageReport as (args: unknown) => Promise<MCPResult>,

  // Admin tiers
  [TOOL_NAMES.ADMIN_TIER_LIST]: handleAdminTierList as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.ADMIN_TIER_GET]: handleAdminTierGet as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.ADMIN_TIER_SET]: handleAdminTierSet as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.ADMIN_USER_TIER_GET]: handleAdminUserTierGet as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.ADMIN_USER_TIER_SET]: handleAdminUserTierSet as (args: unknown) => Promise<MCPResult>,

  // Archive & embedding
  [TOOL_NAMES.ARCHIVE_STATS]: handleArchiveStats as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.ARCHIVE_EMBED_ALL]: handleArchiveEmbedAll as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.ARCHIVE_EMBED_BATCH]: handleArchiveEmbedBatch as (args: unknown) => Promise<MCPResult>,

  // Clustering
  [TOOL_NAMES.CLUSTER_DISCOVER]: handleClusterDiscover as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.CLUSTER_LIST]: handleClusterList as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.CLUSTER_GET]: handleClusterGet as (args: unknown) => Promise<MCPResult>,

  // Book creation
  [TOOL_NAMES.BOOK_CREATE_FROM_CLUSTER]: handleBookCreateFromCluster as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.BOOK_HARVEST]: handleBookHarvest as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.BOOK_GENERATE_ARC]: handleBookGenerateArc as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.BOOK_LIST]: handleBookList as (args: unknown) => Promise<MCPResult>,
  [TOOL_NAMES.BOOK_GET]: handleBookGet as (args: unknown) => Promise<MCPResult>,
  'book_create_with_persona': handleBookCreateWithPersona as (args: unknown) => Promise<MCPResult>,

  // Persona harvest
  'persona_start_harvest': handlePersonaStartHarvest as (args: unknown) => Promise<MCPResult>,
  'persona_add_sample': handlePersonaAddSample as (args: unknown) => Promise<MCPResult>,
  'persona_harvest_archive': handlePersonaHarvestArchive as (args: unknown) => Promise<MCPResult>,
  'persona_extract_traits': handlePersonaExtractTraits as (args: unknown) => Promise<MCPResult>,
  'persona_generate_sample': handlePersonaGenerateSample as (args: unknown) => Promise<MCPResult>,
  'persona_finalize': handlePersonaFinalize as (args: unknown) => Promise<MCPResult>,
  'persona_list': handlePersonaList as (args: unknown) => Promise<MCPResult>,
  'persona_get': handlePersonaGet as (args: unknown) => Promise<MCPResult>,
  'persona_get_default': handlePersonaGetDefault as (args: unknown) => Promise<MCPResult>,
  'persona_set_default': handlePersonaSetDefault as (args: unknown) => Promise<MCPResult>,

  // Style profiles
  'style_create': handleStyleCreate as (args: unknown) => Promise<MCPResult>,
  'style_list': handleStyleList as (args: unknown) => Promise<MCPResult>,
  'style_get': handleStyleGet as (args: unknown) => Promise<MCPResult>,
  'style_update': handleStyleUpdate as (args: unknown) => Promise<MCPResult>,
  'style_delete': handleStyleDelete as (args: unknown) => Promise<MCPResult>,
};
