/**
 * MCP Handlers - Barrel Export
 */

export { CODEGUARD_HANDLERS } from './codeguard.js';
export { SYSTEM_HANDLERS } from './system.js';
export { HOOKS_HANDLERS } from './hooks.js';
export { BOOK_AGENT_HANDLERS } from './book-agent.js';
export { BOOKMAKING_HANDLERS } from './bookmaking.js';
export { AUI_HANDLERS } from './aui.js';
export { ARXIV_HANDLERS } from './arxiv.js';

import { CODEGUARD_HANDLERS } from './codeguard.js';
import { SYSTEM_HANDLERS } from './system.js';
import { HOOKS_HANDLERS } from './hooks.js';
import { BOOK_AGENT_HANDLERS } from './book-agent.js';
import { BOOKMAKING_HANDLERS } from './bookmaking.js';
import { AUI_HANDLERS } from './aui.js';
import { ARXIV_HANDLERS } from './arxiv.js';
import type { MCPResult, HandlerContext } from '../types.js';

/**
 * Handler function type with optional context for progress reporting
 */
export type MCPHandler = (args: unknown, context?: HandlerContext) => Promise<MCPResult>;

/**
 * All handlers combined
 */
export const ALL_HANDLERS: Record<string, MCPHandler> = {
  ...CODEGUARD_HANDLERS,
  ...SYSTEM_HANDLERS,
  ...HOOKS_HANDLERS,
  ...BOOK_AGENT_HANDLERS,
  ...BOOKMAKING_HANDLERS,
  ...AUI_HANDLERS,
  ...ARXIV_HANDLERS,
};

/**
 * Get a handler by tool name
 */
export function getHandler(toolName: string): MCPHandler | undefined {
  return ALL_HANDLERS[toolName];
}
