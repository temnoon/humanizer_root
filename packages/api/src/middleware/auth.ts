/**
 * Authentication Middleware
 *
 * JWT verification for tokens issued by the auth-api service.
 * Also supports API key authentication via X-API-Key header.
 * Validates tokens/keys and extracts user context for protected routes.
 *
 * @module @humanizer/api/middleware/auth
 */

import { Context, MiddlewareHandler } from 'hono';
import * as jose from 'jose';
import type { ApiKeyService, ValidateKeyResult } from '@humanizer/core';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type UserRole = 'free' | 'member' | 'pro' | 'premium' | 'admin';

export interface AuthContext {
  userId: string;
  email: string;
  role: UserRole;
  tenantId: string;
}

export interface AuthContextVariables {
  auth?: AuthContext;
}

// ═══════════════════════════════════════════════════════════════════════════
// API KEY SERVICE STATE
// ═══════════════════════════════════════════════════════════════════════════

let _apiKeyService: ApiKeyService | null = null;

/**
 * Set the API key service for API key authentication.
 * Call this during server initialization.
 */
export function setApiKeyService(service: ApiKeyService): void {
  _apiKeyService = service;
}

/**
 * Get the current API key service.
 */
export function getApiKeyService(): ApiKeyService | null {
  return _apiKeyService;
}

// ═══════════════════════════════════════════════════════════════════════════
// JWT VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verify JWT token and extract auth context.
 * Token format matches auth-api: {userId, email, role, tenantId}
 */
export async function verifyToken(token: string, secret: string): Promise<AuthContext | null> {
  try {
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(secret);

    const { payload } = await jose.jwtVerify(token, secretKey);

    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as UserRole,
      tenantId: payload.tenantId as string,
    };
  } catch {
    return null;
  }
}

/**
 * Verify API key and extract auth context.
 * Returns auth context based on key's user and scopes.
 */
export async function verifyApiKey(apiKey: string): Promise<AuthContext | null> {
  if (!_apiKeyService) {
    return null;
  }

  try {
    const result = await _apiKeyService.validateKey(apiKey);

    if (!result.valid || !result.userId) {
      return null;
    }

    // API key auth uses 'member' as default role (no admin access via API keys)
    // Scopes determine what operations are allowed, not the role
    const hasAdminScope = result.scopes?.some(s => s === 'admin') ?? false;
    return {
      userId: result.userId,
      email: `apikey:${result.keyId}`, // Placeholder email for API key auth
      role: hasAdminScope ? 'admin' : 'member',
      tenantId: result.tenantId ?? 'humanizer',
    };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get JWT secret from environment.
 * Falls back to development secret ONLY when explicitly in development mode.
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Only allow fallback in explicit development mode
    // Production requires JWT_SECRET - fail fast if missing
    const isExplicitDev = process.env.NODE_ENV === 'development';
    const isTest = process.env.NODE_ENV === 'test';

    if (isExplicitDev || isTest) {
      console.warn('⚠️ Using development JWT_SECRET - set JWT_SECRET for production');
      return 'dev-jwt-secret-not-for-production';
    }

    // Production or unknown environment - require the secret
    throw new Error(
      'JWT_SECRET environment variable is required. ' +
      'Generate with: openssl rand -base64 32'
    );
  }
  return secret;
}

/**
 * Require authentication middleware.
 * Supports both JWT Bearer tokens and API keys via X-API-Key header.
 * Returns 401 if no valid credentials present.
 * Will pass through if auth context is already set (e.g., by devAuth()).
 */
export function requireAuth(): MiddlewareHandler {
  return async (c, next) => {
    // Check if auth is already set (e.g., by devAuth())
    const existingAuth = c.get('auth') as AuthContext | undefined;
    if (existingAuth) {
      await next();
      return;
    }

    // Check for API key first (X-API-Key header)
    const apiKeyHeader = c.req.header('X-API-Key');
    if (apiKeyHeader) {
      const authContext = await verifyApiKey(apiKeyHeader);
      if (authContext) {
        c.set('auth', authContext);
        c.set('authMethod', 'api-key');
        await next();
        return;
      }
      return c.json({ error: 'Invalid or expired API key' }, 401);
    }

    // Check for JWT Bearer token
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid authorization header' }, 401);
    }

    const token = authHeader.substring(7);
    const secret = getJwtSecret();
    const authContext = await verifyToken(token, secret);

    if (!authContext) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    c.set('auth', authContext);
    c.set('authMethod', 'jwt');
    await next();
  };
}

/**
 * Optional authentication middleware.
 * Extracts auth context if token present, but doesn't require it.
 * Useful for routes that work for both anonymous and authenticated users.
 */
export function optionalAuth(): MiddlewareHandler {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const secret = getJwtSecret();
      const authContext = await verifyToken(token, secret);

      if (authContext) {
        c.set('auth', authContext);
      }
    }

    await next();
  };
}

/**
 * Development auth middleware.
 * In development mode, creates a mock auth context if no credentials present.
 * In production, requires real authentication.
 * Supports both JWT Bearer tokens and API keys.
 */
export function devAuth(): MiddlewareHandler {
  return async (c, next) => {
    const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

    // Check for API key first
    const apiKeyHeader = c.req.header('X-API-Key');
    if (apiKeyHeader) {
      const authContext = await verifyApiKey(apiKeyHeader);
      if (authContext) {
        c.set('auth', authContext);
        c.set('authMethod', 'api-key');
        await next();
        return;
      }
      // Invalid API key - fail in production, warn in dev
      if (!isDev) {
        return c.json({ error: 'Invalid or expired API key' }, 401);
      }
    }

    // Check for JWT Bearer token
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const secret = getJwtSecret();
      const authContext = await verifyToken(token, secret);

      if (authContext) {
        c.set('auth', authContext);
        c.set('authMethod', 'jwt');
        await next();
        return;
      }

      // Invalid token - fail in production, warn in dev
      if (!isDev) {
        return c.json({ error: 'Invalid or expired token' }, 401);
      }
    }

    // No valid credentials - mock auth in dev, fail in production
    if (isDev) {
      c.set('auth', {
        userId: 'dev-user-local',
        email: 'dev@localhost',
        role: 'admin' as UserRole,
        tenantId: 'humanizer',
      });
      c.set('authMethod', 'mock');
      await next();
      return;
    }

    return c.json({ error: 'Authentication required' }, 401);
  };
}

/**
 * Require admin role middleware.
 * Must be used after requireAuth() or devAuth().
 */
export function requireAdmin(): MiddlewareHandler {
  return async (c, next) => {
    const auth = c.get('auth') as AuthContext | undefined;

    if (!auth) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    if (auth.role !== 'admin') {
      return c.json({
        error: 'Admin access required',
        message: 'This endpoint is restricted to administrators',
      }, 403);
    }

    await next();
  };
}

/**
 * Require specific tier or higher middleware.
 * Tier hierarchy: free < member < pro < premium < admin
 */
export function requireTier(minTier: UserRole): MiddlewareHandler {
  const tierOrder: Record<UserRole, number> = {
    free: 0,
    member: 1,
    pro: 2,
    premium: 3,
    admin: 4,
  };

  return async (c, next) => {
    const auth = c.get('auth') as AuthContext | undefined;

    if (!auth) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    if (tierOrder[auth.role] < tierOrder[minTier]) {
      return c.json({
        error: 'Insufficient tier',
        message: `This endpoint requires ${minTier} tier or higher`,
        currentTier: auth.role,
        requiredTier: minTier,
      }, 403);
    }

    await next();
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get auth context from request context.
 * Returns undefined if not authenticated.
 */
export function getAuth(c: Context): AuthContext | undefined {
  return c.get('auth') as AuthContext | undefined;
}

/**
 * Get authenticated user ID or throw.
 * Use in routes that require authentication.
 */
export function getUserId(c: Context): string {
  const auth = getAuth(c);
  if (!auth) {
    throw new Error('Authentication required - use requireAuth() middleware');
  }
  return auth.userId;
}

/**
 * Get authenticated user's tenant ID or throw.
 */
export function getTenantId(c: Context): string {
  const auth = getAuth(c);
  if (!auth) {
    throw new Error('Authentication required - use requireAuth() middleware');
  }
  return auth.tenantId;
}
