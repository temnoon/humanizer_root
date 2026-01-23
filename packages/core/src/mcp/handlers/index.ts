/**
 * MCP Handlers - Barrel Export
 */

export { CODEGUARD_HANDLERS } from './codeguard.js';
export { SYSTEM_HANDLERS } from './system.js';
export { HOOKS_HANDLERS } from './hooks.js';

import { CODEGUARD_HANDLERS } from './codeguard.js';
import { SYSTEM_HANDLERS } from './system.js';
import { HOOKS_HANDLERS } from './hooks.js';
import type { MCPResult } from '../types.js';

/**
 * All handlers combined
 */
export const ALL_HANDLERS: Record<string, (args: unknown) => Promise<MCPResult>> = {
  ...CODEGUARD_HANDLERS,
  ...SYSTEM_HANDLERS,
  ...HOOKS_HANDLERS,
};

/**
 * Get a handler by tool name
 */
export function getHandler(toolName: string): ((args: unknown) => Promise<MCPResult>) | undefined {
  return ALL_HANDLERS[toolName];
}
