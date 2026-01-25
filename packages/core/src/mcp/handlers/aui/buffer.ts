/**
 * AUI Buffer Handlers
 *
 * MCP handlers for buffer lifecycle, version control, and branching operations.
 *
 * @module @humanizer/core/mcp/handlers/aui/buffer
 */

import type { MCPResult } from '../../types.js';
import type { MergeStrategy } from '../../../aui/index.js';
import { jsonResult, errorResult, getService } from './helpers.js';

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
    const { getBufferManager } = await import('../../../aui/buffer-manager.js');
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
    const { getBufferManager } = await import('../../../aui/buffer-manager.js');
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
    const { getBufferManager } = await import('../../../aui/buffer-manager.js');
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
    const { getBufferManager } = await import('../../../aui/buffer-manager.js');
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
    const { getBufferManager } = await import('../../../aui/buffer-manager.js');
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
