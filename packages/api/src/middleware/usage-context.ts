/**
 * Usage Context Middleware
 *
 * Uses AsyncLocalStorage to propagate user context from request middleware
 * down to embedding/LLM functions for usage attribution.
 *
 * The context is set by middleware at request start and accessed by wrapped
 * providers without needing to thread it through every function call.
 *
 * @module @humanizer/api/middleware/usage-context
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { MiddlewareHandler } from 'hono';
import type { AuthContext } from './auth.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface UsageContext {
  userId: string;
  tenantId: string;
  sessionId?: string;
  requestId?: string;
  operationType?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// ASYNC LOCAL STORAGE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * AsyncLocalStorage for request-scoped usage context.
 * Allows embedding/LLM functions to access user info without explicit passing.
 */
const usageContextStorage = new AsyncLocalStorage<UsageContext>();

/**
 * Get the current usage context from AsyncLocalStorage.
 * Returns undefined if called outside a request context.
 */
export function getUsageContext(): UsageContext | undefined {
  return usageContextStorage.getStore();
}

/**
 * Run a function with a specific usage context.
 * Useful for background jobs or testing.
 */
export function runWithUsageContext<T>(
  context: UsageContext,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return usageContextStorage.run(context, fn);
}

// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Middleware to set up usage context for the request.
 * Extracts user info from auth context and makes it available
 * to all downstream functions via AsyncLocalStorage.
 *
 * @example
 * ```ts
 * app.use('*', devAuth(), usageContextMiddleware());
 * ```
 */
export function usageContextMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    // Get auth context from previous middleware
    const auth = c.get('auth') as AuthContext | undefined;

    // Try to extract sessionId from request body for search/book operations
    let sessionId: string | undefined;
    if (c.req.method === 'POST' && c.req.header('Content-Type')?.includes('application/json')) {
      try {
        // Clone the request to peek at the body without consuming it
        const cloned = c.req.raw.clone();
        const body = await cloned.json().catch(() => ({}));
        sessionId = (body as { sessionId?: string }).sessionId;
      } catch {
        // Ignore body parsing errors
      }
    }

    // Generate a unique request ID for this request
    const requestId = crypto.randomUUID();

    // Create usage context
    const context: UsageContext = {
      userId: auth?.userId ?? 'anonymous',
      tenantId: auth?.tenantId ?? 'humanizer',
      sessionId,
      requestId,
    };

    // Run the rest of the middleware chain within this context
    return usageContextStorage.run(context, () => next());
  };
}

/**
 * Set the operation type for the current request.
 * Call this in route handlers to specify what operation is being performed.
 *
 * @example
 * ```ts
 * searchRouter.post('/', async (c) => {
 *   setOperationType('search');
 *   // ... rest of handler
 * });
 * ```
 */
export function setOperationType(opType: string): void {
  const ctx = usageContextStorage.getStore();
  if (ctx) {
    ctx.operationType = opType;
  }
}
