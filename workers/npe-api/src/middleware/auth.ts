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
 * Generate random salt for password hashing
 */
function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Convert Uint8Array to hex string
 */
function uint8ArrayToHex(array: Uint8Array): string {
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to Uint8Array
 */
function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Hash password using PBKDF2 with random salt (secure)
 * Format: algorithm$iterations$salt$hash
 * Example: pbkdf2$100000$1a2b3c4d...$5e6f7g8h...
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);
  const salt = generateSalt();
  const iterations = 100000; // OWASP recommended minimum

  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  // Derive key using PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    256 // 32 bytes
  );

  const hash = new Uint8Array(derivedBits);

  // Return format: algorithm$iterations$salt$hash
  return `pbkdf2$${iterations}$${uint8ArrayToHex(salt)}$${uint8ArrayToHex(hash)}`;
}

/**
 * Legacy SHA-256 hash (for backward compatibility during migration)
 * @deprecated Use hashPassword() instead
 */
async function legacyHashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify password against hash (supports both PBKDF2 and legacy SHA-256)
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // Check if it's the new PBKDF2 format
  if (storedHash.startsWith('pbkdf2$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 4) {
      return false;
    }

    const iterations = parseInt(parts[1], 10);
    const salt = hexToUint8Array(parts[2]);
    const storedHashBytes = hexToUint8Array(parts[3]);

    // Re-derive the key with the same parameters
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordData,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );

    const derivedHash = new Uint8Array(derivedBits);

    // Constant-time comparison
    if (derivedHash.length !== storedHashBytes.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < derivedHash.length; i++) {
      result |= derivedHash[i] ^ storedHashBytes[i];
    }

    return result === 0;
  }

  // Legacy SHA-256 format (backward compatibility)
  const legacyHash = await legacyHashPassword(password);
  return legacyHash === storedHash;
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

/**
 * Hono middleware to require PRO tier or higher (pro, premium, admin)
 * MUST be used after requireAuth()
 */
export function requireProPlus() {
  return async (c: Context<{ Bindings: Env }>, next: () => Promise<void>) => {
    const auth = c.get('auth') as AuthContext;

    if (!auth) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const allowedRoles: UserRole[] = ['pro', 'premium', 'admin'];
    if (!allowedRoles.includes(auth.role)) {
      return c.json({
        error: 'PRO subscription required',
        message: 'External API keys are available to PRO, PREMIUM, and ADMIN users only'
      }, 403);
    }

    await next();
  };
}
