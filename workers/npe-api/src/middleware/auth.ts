// Authentication middleware for Cloudflare Workers
import { Context } from 'hono';
import * as jose from 'jose';
import type { Env, UserRole } from '../../shared/types';

export interface AuthContext {
  userId: string;
  email: string;
  role: UserRole;
}

/**
 * Hash password using Web Crypto API (SHA-256)
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

/**
 * Generate JWT token for user
 */
export async function generateToken(userId: string, email: string, role: UserRole, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const secretKey = encoder.encode(secret);

  const jwt = await new jose.SignJWT({ userId, email, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey);

  return jwt;
}

/**
 * Verify JWT token and extract user info
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
    };
  } catch (error) {
    return null;
  }
}

/**
 * Hono middleware to require authentication
 */
export function requireAuth() {
  return async (c: Context<{ Bindings: Env }>, next: () => Promise<void>) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid authorization header' }, 401);
    }

    const token = authHeader.substring(7);
    const authContext = await verifyToken(token, c.env.JWT_SECRET);

    if (!authContext) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    // Add auth context to request
    c.set('auth', authContext);

    await next();
  };
}

/**
 * Get authenticated user from context
 */
export function getAuthContext(c: Context): AuthContext {
  return c.get('auth') as AuthContext;
}

/**
 * Hono middleware to require admin role
 * MUST be used after requireAuth()
 */
export function requireAdmin() {
  return async (c: Context<{ Bindings: Env }>, next: () => Promise<void>) => {
    const auth = c.get('auth') as AuthContext;

    if (!auth) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    if (auth.role !== 'admin') {
      return c.json({
        error: 'Admin access required',
        message: 'This endpoint is restricted to administrators only'
      }, 403);
    }

    await next();
  };
}
