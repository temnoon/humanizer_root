/**
 * AUI Archive & Embedding Handlers
 *
 * MCP handlers for archive statistics and embedding operations.
 *
 * @module @humanizer/core/mcp/handlers/aui/archive
 */

import type { MCPResult } from '../../types.js';
import { jsonResult, errorResult, getService } from './helpers.js';

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
