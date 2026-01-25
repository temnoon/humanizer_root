/**
 * AUI Session Handlers
 *
 * MCP handlers for session management operations.
 *
 * @module @humanizer/core/mcp/handlers/aui/session
 */

import type { MCPResult } from '../../types.js';
import { jsonResult, errorResult, getService } from './helpers.js';

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
