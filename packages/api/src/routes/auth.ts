/**
 * Authentication Routes
 *
 * Public endpoints for user registration, login, and password management.
 * These routes do NOT require authentication (they create/verify auth).
 *
 * @module @humanizer/api/routes/auth
 */

import { Hono } from 'hono';
import * as jose from 'jose';
import { getUserService } from '@humanizer/core';
import type { AuiContextVariables } from '../middleware/aui-context.js';
import { devAuth, getAuth, type AuthContext, type UserRole } from '../middleware/auth.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface AuthRouteVariables extends AuiContextVariables {
  auth?: AuthContext;
}

// ═══════════════════════════════════════════════════════════════════════════
// JWT HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get JWT secret from environment.
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
      console.warn('⚠️ Using development JWT_SECRET - not secure for production');
      return 'dev-secret-do-not-use-in-production';
    }
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

/**
 * Generate access and refresh tokens for a user.
 */
async function generateTokens(
  userId: string,
  email: string,
  role: UserRole,
  tenantId: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const secret = getJwtSecret();
  const encoder = new TextEncoder();
  const secretKey = encoder.encode(secret);

  const now = Math.floor(Date.now() / 1000);
  const accessExpiresIn = 60 * 60; // 1 hour
  const refreshExpiresIn = 60 * 60 * 24 * 7; // 7 days

  // Access token - short-lived, contains user info
  const accessToken = await new jose.SignJWT({
    userId,
    email,
    role,
    tenantId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + accessExpiresIn)
    .setSubject(userId)
    .sign(secretKey);

  // Refresh token - longer-lived, minimal claims
  const refreshToken = await new jose.SignJWT({
    userId,
    tenantId,
    type: 'refresh',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + refreshExpiresIn)
    .setSubject(userId)
    .sign(secretKey);

  return {
    accessToken,
    refreshToken,
    expiresIn: accessExpiresIn,
  };
}

/**
 * Verify a refresh token.
 */
async function verifyRefreshToken(
  token: string
): Promise<{ userId: string; tenantId: string } | null> {
  try {
    const secret = getJwtSecret();
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(secret);

    const { payload } = await jose.jwtVerify(token, secretKey);

    if (payload.type !== 'refresh') {
      return null;
    }

    return {
      userId: payload.userId as string,
      tenantId: payload.tenantId as string,
    };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════════════

export const authRouter = new Hono<{ Variables: AuthRouteVariables }>();

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES (No authentication required)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /auth/register
 * Register a new user account
 */
authRouter.post('/register', async (c) => {
  const userService = getUserService();

  if (!userService) {
    return c.json({ error: 'User service not initialized' }, 503);
  }

  const body = await c.req.json<{
    email: string;
    password: string;
    displayName?: string;
  }>();

  if (!body.email || !body.password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(body.email)) {
    return c.json({ error: 'Invalid email format' }, 400);
  }

  try {
    const user = await userService.createUser({
      email: body.email,
      password: body.password,
      displayName: body.displayName,
    });

    // Generate tokens
    const tokens = await generateTokens(user.id, user.email, user.tier as UserRole, user.tenantId);

    // Create verification token (email not yet verified)
    const verificationToken = await userService.createEmailVerificationToken(user.id, user.tenantId);

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        tier: user.tier,
        emailVerified: false,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      // In production, send this via email instead of returning it
      ...(process.env.NODE_ENV === 'development' && { verificationToken }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    const status = message.includes('already registered') ? 409 : 400;
    return c.json({ error: message }, status);
  }
});

/**
 * POST /auth/login
 * Authenticate user with email and password
 */
authRouter.post('/login', async (c) => {
  const userService = getUserService();

  if (!userService) {
    return c.json({ error: 'User service not initialized' }, 503);
  }

  const body = await c.req.json<{
    email: string;
    password: string;
  }>();

  if (!body.email || !body.password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }

  try {
    const user = await userService.authenticateWithPassword(body.email, body.password);

    if (!user) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Generate tokens
    const tokens = await generateTokens(user.id, user.email, user.tier as UserRole, user.tenantId);

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        tier: user.tier,
        emailVerified: !!user.emailVerifiedAt,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    // Don't reveal if it's a ban vs wrong password
    if (message.includes('banned')) {
      return c.json({ error: message }, 403);
    }
    return c.json({ error: 'Invalid email or password' }, 401);
  }
});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
authRouter.post('/refresh', async (c) => {
  const userService = getUserService();

  if (!userService) {
    return c.json({ error: 'User service not initialized' }, 503);
  }

  const body = await c.req.json<{
    refreshToken: string;
  }>();

  if (!body.refreshToken) {
    return c.json({ error: 'Refresh token is required' }, 400);
  }

  const payload = await verifyRefreshToken(body.refreshToken);

  if (!payload) {
    return c.json({ error: 'Invalid or expired refresh token' }, 401);
  }

  // Get user to verify they still exist and aren't banned
  const user = await userService.getUserById(payload.userId, payload.tenantId);

  if (!user) {
    return c.json({ error: 'User not found' }, 401);
  }

  if (user.bannedAt && (!user.banExpiresAt || user.banExpiresAt > new Date())) {
    return c.json({ error: user.banReason ?? 'Account is banned' }, 403);
  }

  // Generate new tokens
  const tokens = await generateTokens(user.id, user.email, user.tier as UserRole, user.tenantId);

  return c.json({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
  });
});

/**
 * POST /auth/forgot-password
 * Request password reset email
 */
authRouter.post('/forgot-password', async (c) => {
  const userService = getUserService();

  if (!userService) {
    return c.json({ error: 'User service not initialized' }, 503);
  }

  const body = await c.req.json<{
    email: string;
  }>();

  if (!body.email) {
    return c.json({ error: 'Email is required' }, 400);
  }

  try {
    const token = await userService.createPasswordResetToken(body.email);

    // Always return success to prevent email enumeration
    const response: {
      message: string;
      resetToken?: string;
    } = {
      message: 'If an account with that email exists, a password reset link has been sent.',
    };

    // In development, return the token directly for testing
    if (process.env.NODE_ENV === 'development' && token) {
      response.resetToken = token;
    }

    return c.json(response);
  } catch {
    // Don't reveal errors
    return c.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  }
});

/**
 * POST /auth/reset-password
 * Reset password using token
 */
authRouter.post('/reset-password', async (c) => {
  const userService = getUserService();

  if (!userService) {
    return c.json({ error: 'User service not initialized' }, 503);
  }

  const body = await c.req.json<{
    token: string;
    newPassword: string;
  }>();

  if (!body.token || !body.newPassword) {
    return c.json({ error: 'Token and new password are required' }, 400);
  }

  try {
    await userService.resetPassword(body.token, body.newPassword);
    return c.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reset password';
    return c.json({ error: message }, 400);
  }
});

/**
 * POST /auth/verify-email
 * Verify email using token
 */
authRouter.post('/verify-email', async (c) => {
  const userService = getUserService();

  if (!userService) {
    return c.json({ error: 'User service not initialized' }, 503);
  }

  const body = await c.req.json<{
    token: string;
  }>();

  if (!body.token) {
    return c.json({ error: 'Token is required' }, 400);
  }

  try {
    const user = await userService.verifyEmailWithToken(body.token);

    return c.json({
      message: 'Email verified successfully',
      user: {
        id: user.id,
        email: user.email,
        emailVerified: true,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to verify email';
    return c.json({ error: message }, 400);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AUTHENTICATED ROUTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /auth/me
 * Get current authenticated user's info
 */
authRouter.get('/me', devAuth(), async (c) => {
  const auth = getAuth(c);

  if (!auth) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const userService = getUserService();

  if (!userService) {
    // Return basic info from token if service not available
    return c.json({
      user: {
        id: auth.userId,
        email: auth.email,
        tier: auth.role,
        tenantId: auth.tenantId,
      },
    });
  }

  const user = await userService.getUserById(auth.userId, auth.tenantId);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      tier: user.tier,
      emailVerified: !!user.emailVerifiedAt,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

/**
 * POST /auth/logout
 * Logout (client-side token invalidation)
 * Note: JWTs are stateless, so this is mainly for audit/activity tracking
 */
authRouter.post('/logout', devAuth(), async (c) => {
  const auth = getAuth(c);

  if (!auth) {
    return c.json({ message: 'Already logged out' });
  }

  // In a stateful session system, we would invalidate the session here
  // With JWTs, the client should discard the token

  return c.json({ message: 'Logged out successfully' });
});

/**
 * POST /auth/resend-verification
 * Resend email verification token
 */
authRouter.post('/resend-verification', devAuth(), async (c) => {
  const auth = getAuth(c);

  if (!auth) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const userService = getUserService();

  if (!userService) {
    return c.json({ error: 'User service not initialized' }, 503);
  }

  const user = await userService.getUserById(auth.userId, auth.tenantId);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  if (user.emailVerifiedAt) {
    return c.json({ message: 'Email is already verified' });
  }

  try {
    const token = await userService.createEmailVerificationToken(auth.userId, auth.tenantId);

    const response: {
      message: string;
      verificationToken?: string;
    } = {
      message: 'Verification email sent',
    };

    // In development, return the token directly for testing
    if (process.env.NODE_ENV === 'development') {
      response.verificationToken = token;
    }

    return c.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send verification email';
    return c.json({ error: message }, 500);
  }
});
