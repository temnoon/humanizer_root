/**
 * AUI Context Middleware
 *
 * Injects UnifiedAuiService into the Hono context for route handlers.
 *
 * @module @humanizer/api/middleware/aui-context
 */

import { createMiddleware } from 'hono/factory';
import type { UnifiedAuiService } from '@humanizer/core';
import type { AuthContext } from './auth.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface AuiContextVariables {
  aui: UnifiedAuiService;
  auth?: AuthContext;
}

// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════

let _auiService: UnifiedAuiService | null = null;

/**
 * Set the global AUI service instance.
 * Must be called before starting the server.
 */
export function setAuiService(service: UnifiedAuiService): void {
  _auiService = service;
}

/**
 * Get the current AUI service instance.
 */
export function getAuiService(): UnifiedAuiService | null {
  return _auiService;
}

/**
 * Middleware that injects the AUI service into the Hono context.
 */
export const auiMiddleware = createMiddleware<{
  Variables: AuiContextVariables;
}>(async (c, next) => {
  if (!_auiService) {
    return c.json({ error: 'AUI service not initialized' }, 503);
  }
  c.set('aui', _auiService);
  await next();
});
