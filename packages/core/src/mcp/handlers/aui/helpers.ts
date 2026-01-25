/**
 * AUI Handler Helpers
 *
 * Shared utility functions for AUI MCP handlers.
 *
 * @module @humanizer/core/mcp/handlers/aui/helpers
 */

import type { MCPResult } from '../../types.js';
import type { UnifiedAuiService } from '../../../aui/index.js';
import { getUnifiedAui } from '../../../aui/index.js';

/**
 * Format data as JSON MCP result
 */
export function jsonResult(data: unknown): MCPResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * Format error as MCP result
 */
export function errorResult(message: string): MCPResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

/**
 * Get the initialized UnifiedAuiService or throw
 */
export function getService(): UnifiedAuiService {
  const service = getUnifiedAui();
  if (!service) {
    throw new Error('UnifiedAuiService not initialized. Call initUnifiedAui() first.');
  }
  return service;
}

/**
 * Wrap handler execution with error handling
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  formatResult: (result: T) => MCPResult = jsonResult
): Promise<MCPResult> {
  try {
    const result = await fn();
    return formatResult(result);
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}
