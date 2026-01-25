/**
 * AUI Search Handlers
 *
 * MCP handlers for search operations.
 *
 * @module @humanizer/core/mcp/handlers/aui/search
 */

import type { MCPResult } from '../../types.js';
import { jsonResult, errorResult, getService } from './helpers.js';

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
