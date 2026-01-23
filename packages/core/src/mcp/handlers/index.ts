/**
 * MCP Handlers - Barrel Export
 */

export { CODEGUARD_HANDLERS } from './codeguard.js';
export { SYSTEM_HANDLERS } from './system.js';
export { HOOKS_HANDLERS } from './hooks.js';
export { BOOK_AGENT_HANDLERS } from './book-agent.js';
export { BOOKMAKING_HANDLERS } from './bookmaking.js';
export { AUI_HANDLERS } from './aui.js';

import { CODEGUARD_HANDLERS } from './codeguard.js';
import { SYSTEM_HANDLERS } from './system.js';
import { HOOKS_HANDLERS } from './hooks.js';
import { BOOK_AGENT_HANDLERS } from './book-agent.js';
import { BOOKMAKING_HANDLERS } from './bookmaking.js';
import { AUI_HANDLERS } from './aui.js';
import type { MCPResult } from '../types.js';

/**
 * All handlers combined
 */
export const ALL_HANDLERS: Record<string, (args: unknown) => Promise<MCPResult>> = {
  ...CODEGUARD_HANDLERS,
  ...SYSTEM_HANDLERS,
  ...HOOKS_HANDLERS,
  ...BOOK_AGENT_HANDLERS,
  ...BOOKMAKING_HANDLERS,
  ...AUI_HANDLERS,
};

/**
 * Get a handler by tool name
 */
export function getHandler(toolName: string): ((args: unknown) => Promise<MCPResult>) | undefined {
  return ALL_HANDLERS[toolName];
}
