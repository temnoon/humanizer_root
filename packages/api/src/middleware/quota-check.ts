/**
 * Quota Check Middleware
 *
 * Pre-flight quota checking before LLM operations.
 * Returns 429 Too Many Requests when quota exceeded.
 * Adds usage headers to responses.
 *
 * @module @humanizer/api/middleware/quota-check
 */

import type { Context, MiddlewareHandler } from 'hono';
import type { AuthContext } from './auth.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Usage service interface (injected from @humanizer/core)
 */
export interface UsageServiceAdapter {
  canPerform(
    userId: string,
    estimatedTokens: number,
    tenantId?: string
  ): Promise<{
    allowed: boolean;
    reason?: string;
    usage: {
      tokensUsed: number;
      tokensLimit: number;
      requestsUsed: number;
      requestsLimit: number;
      percentUsed: number;
    };
    tier: string;
    hasOverride: boolean;
  }>;
}

/**
 * Options for quota check middleware
 */
export interface QuotaCheckOptions {
  /** Estimated tokens for this operation (default: 1000) */
  estimatedTokens?: number;
  /** Skip quota check for admin users */
  skipForAdmin?: boolean;
  /** Custom header prefix (default: 'X-Quota-') */
  headerPrefix?: string;
}

export interface QuotaContextVariables {
  quotaCheck?: {
    tokensUsed: number;
    tokensLimit: number;
    requestsUsed: number;
    requestsLimit: number;
    percentUsed: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL STATE
// ═══════════════════════════════════════════════════════════════════════════

let _usageService: UsageServiceAdapter | null = null;

/**
 * Set the usage service for quota checking.
 * Call this during server initialization.
 */
export function setUsageService(service: UsageServiceAdapter): void {
  _usageService = service;
}

/**
 * Get the current usage service.
 */
export function getUsageService(): UsageServiceAdapter | null {
  return _usageService;
}

// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Quota check middleware.
 * Verifies user has sufficient quota before processing request.
 * Returns 429 if quota exceeded, 503 if service unavailable.
 *
 * Usage:
 * ```ts
 * app.use('/transform/*', requireAuth(), quotaCheck({ estimatedTokens: 2000 }));
 * ```
 */
export function quotaCheck(options?: QuotaCheckOptions): MiddlewareHandler {
  const estimatedTokens = options?.estimatedTokens ?? 1000;
  const skipForAdmin = options?.skipForAdmin ?? true;
  const headerPrefix = options?.headerPrefix ?? 'X-Quota-';

  return async (c, next) => {
    // Get auth context
    const auth = c.get('auth') as AuthContext | undefined;

    if (!auth) {
      // No auth - let auth middleware handle this
      return c.json({ error: 'Authentication required' }, 401);
    }

    // Skip quota check for admins if configured
    if (skipForAdmin && auth.role === 'admin') {
      await next();
      return;
    }

    // Check if usage service is available
    if (!_usageService) {
      console.warn('Quota check skipped: UsageService not initialized');
      // Allow request but log warning - fail open to not break service
      await next();
      return;
    }

    // Perform quota check
    try {
      const result = await _usageService.canPerform(auth.userId, estimatedTokens, auth.tenantId);

      // Add usage info to context for downstream handlers
      c.set('quotaCheck', result.usage);

      // Add headers
      c.header(`${headerPrefix}Tokens-Used`, String(result.usage.tokensUsed));
      c.header(`${headerPrefix}Tokens-Limit`, String(result.usage.tokensLimit));
      c.header(`${headerPrefix}Requests-Used`, String(result.usage.requestsUsed));
      c.header(`${headerPrefix}Requests-Limit`, String(result.usage.requestsLimit));
      c.header(`${headerPrefix}Percent-Used`, String(Math.round(result.usage.percentUsed)));

      if (!result.allowed) {
        // Add retry-after header (suggest checking back in 1 hour)
        c.header('Retry-After', '3600');

        return c.json(
          {
            error: 'Quota exceeded',
            message: result.reason ?? 'You have exceeded your usage quota for this period.',
            code: 'QUOTA_EXCEEDED',
            usage: result.usage,
            upgradeUrl: '/settings/upgrade',
          },
          429
        );
      }

      // Quota OK - proceed with request
      await next();
    } catch (error) {
      console.error('Quota check error:', error);
      // Fail open - allow request but log error
      await next();
    }
  };
}

/**
 * Soft quota check middleware.
 * Adds usage headers but doesn't block requests.
 * Useful for informational purposes.
 */
export function softQuotaCheck(options?: Omit<QuotaCheckOptions, 'skipForAdmin'>): MiddlewareHandler {
  const estimatedTokens = options?.estimatedTokens ?? 1000;
  const headerPrefix = options?.headerPrefix ?? 'X-Quota-';

  return async (c, next) => {
    const auth = c.get('auth') as AuthContext | undefined;

    if (!auth || !_usageService) {
      await next();
      return;
    }

    try {
      const result = await _usageService.canPerform(auth.userId, estimatedTokens, auth.tenantId);

      c.set('quotaCheck', result.usage);
      c.header(`${headerPrefix}Tokens-Used`, String(result.usage.tokensUsed));
      c.header(`${headerPrefix}Tokens-Limit`, String(result.usage.tokensLimit));
      c.header(`${headerPrefix}Requests-Used`, String(result.usage.requestsUsed));
      c.header(`${headerPrefix}Requests-Limit`, String(result.usage.requestsLimit));
      c.header(`${headerPrefix}Percent-Used`, String(Math.round(result.usage.percentUsed)));

      // Add warning header if approaching limit
      if (result.usage.percentUsed >= 80) {
        c.header(`${headerPrefix}Warning`, `Approaching quota limit (${Math.round(result.usage.percentUsed)}% used)`);
      }
    } catch {
      // Ignore errors in soft check
    }

    await next();
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get quota check result from context.
 */
export function getQuotaCheck(c: Context): QuotaContextVariables['quotaCheck'] | undefined {
  return c.get('quotaCheck') as QuotaContextVariables['quotaCheck'] | undefined;
}

/**
 * Check if user is approaching quota limit.
 */
export function isApproachingLimit(c: Context, threshold = 80): boolean {
  const check = getQuotaCheck(c);
  return check !== undefined && check.percentUsed >= threshold;
}

/**
 * Check if user is over quota (but was allowed through soft check).
 */
export function isOverQuota(c: Context): boolean {
  const check = getQuotaCheck(c);
  return check !== undefined && check.percentUsed >= 100;
}
