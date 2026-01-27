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

// ═══════════════════════════════════════════════════════════════════════════
// OAUTH ROUTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * OAuth provider configurations
 */
interface OAuthProviderConfig {
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  clientIdEnv: string;
  clientSecretEnv: string;
}

const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scope: 'email profile',
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
  },
  github: {
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scope: 'user:email',
    clientIdEnv: 'GITHUB_CLIENT_ID',
    clientSecretEnv: 'GITHUB_CLIENT_SECRET',
  },
  discord: {
    authUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    userInfoUrl: 'https://discord.com/api/users/@me',
    scope: 'identify email',
    clientIdEnv: 'DISCORD_CLIENT_ID',
    clientSecretEnv: 'DISCORD_CLIENT_SECRET',
  },
};

/**
 * Get OAuth callback URL
 */
function getOAuthCallbackUrl(provider: string): string {
  const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3030';
  return `${baseUrl}/auth/oauth/${provider}/callback`;
}

/**
 * Get frontend URL for redirect after OAuth
 */
function getFrontendUrl(): string {
  return process.env.FRONTEND_URL ?? 'http://localhost:5173';
}

/**
 * GET /auth/oauth/:provider
 * Redirect to OAuth provider authorization page
 */
authRouter.get('/oauth/:provider', async (c) => {
  const provider = c.req.param('provider');
  const config = OAUTH_PROVIDERS[provider];

  if (!config) {
    return c.json({ error: `Unknown OAuth provider: ${provider}` }, 400);
  }

  const clientId = process.env[config.clientIdEnv];
  if (!clientId) {
    return c.json({ error: `OAuth not configured for ${provider}` }, 503);
  }

  // Build authorization URL
  const state = crypto.randomUUID(); // CSRF protection
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getOAuthCallbackUrl(provider),
    response_type: 'code',
    scope: config.scope,
    state,
  });

  // Store state in cookie for validation
  c.header('Set-Cookie', `oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`);

  return c.redirect(`${config.authUrl}?${params.toString()}`);
});

/**
 * GET /auth/oauth/:provider/callback
 * Handle OAuth callback, exchange code for tokens
 */
authRouter.get('/oauth/:provider/callback', async (c) => {
  const provider = c.req.param('provider');
  const config = OAUTH_PROVIDERS[provider];

  if (!config) {
    return c.redirect(`${getFrontendUrl()}?error=unknown_provider`);
  }

  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.redirect(`${getFrontendUrl()}?error=${error}`);
  }

  if (!code) {
    return c.redirect(`${getFrontendUrl()}?error=no_code`);
  }

  // Validate state (CSRF protection)
  const cookieHeader = c.req.header('Cookie') ?? '';
  const stateCookie = cookieHeader.match(/oauth_state=([^;]+)/)?.[1];
  if (!stateCookie || stateCookie !== state) {
    return c.redirect(`${getFrontendUrl()}?error=invalid_state`);
  }

  const clientId = process.env[config.clientIdEnv];
  const clientSecret = process.env[config.clientSecretEnv];

  if (!clientId || !clientSecret) {
    return c.redirect(`${getFrontendUrl()}?error=oauth_not_configured`);
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: getOAuthCallbackUrl(provider),
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };

    if (!tokenData.access_token) {
      console.error('OAuth token error:', tokenData);
      return c.redirect(`${getFrontendUrl()}?error=token_exchange_failed`);
    }

    // Get user info from provider
    const userInfoResponse = await fetch(config.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/json',
      },
    });

    const userInfo = await userInfoResponse.json() as Record<string, unknown>;

    // Extract user data (varies by provider)
    let email: string;
    let displayName: string | undefined;
    let avatarUrl: string | undefined;
    let providerId: string;

    if (provider === 'google') {
      email = userInfo.email as string;
      displayName = userInfo.name as string;
      avatarUrl = userInfo.picture as string;
      providerId = userInfo.id as string;
    } else if (provider === 'github') {
      email = userInfo.email as string;
      // GitHub might not return email directly, need to fetch from /user/emails
      if (!email) {
        const emailsResponse = await fetch('https://api.github.com/user/emails', {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            Accept: 'application/json',
          },
        });
        const emails = await emailsResponse.json() as Array<{ email: string; primary: boolean }>;
        const primaryEmail = emails.find((e) => e.primary);
        email = primaryEmail?.email ?? emails[0]?.email;
      }
      displayName = (userInfo.name as string) ?? (userInfo.login as string);
      avatarUrl = userInfo.avatar_url as string;
      providerId = String(userInfo.id);
    } else if (provider === 'discord') {
      email = userInfo.email as string;
      displayName = userInfo.username as string;
      avatarUrl = userInfo.avatar
        ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}.png`
        : undefined;
      providerId = userInfo.id as string;
    } else {
      return c.redirect(`${getFrontendUrl()}?error=unsupported_provider`);
    }

    if (!email) {
      return c.redirect(`${getFrontendUrl()}?error=no_email`);
    }

    // Find or create user
    const userService = getUserService();
    if (!userService) {
      return c.redirect(`${getFrontendUrl()}?error=service_unavailable`);
    }

    const user = await userService.findOrCreateOAuthUser(
      provider,
      providerId,
      email,
      displayName,
      avatarUrl
    );

    // Generate tokens
    const tokens = await generateTokens(user.id, user.email, user.tier as UserRole, user.tenantId);

    // Clear state cookie
    c.header('Set-Cookie', 'oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');

    // Redirect to frontend with tokens
    const frontendUrl = new URL(getFrontendUrl());
    frontendUrl.searchParams.set('access_token', tokens.accessToken);
    frontendUrl.searchParams.set('refresh_token', tokens.refreshToken);
    frontendUrl.searchParams.set('expires_in', String(tokens.expiresIn));

    return c.redirect(frontendUrl.toString());
  } catch (err) {
    console.error('OAuth error:', err);
    return c.redirect(`${getFrontendUrl()}?error=oauth_failed`);
  }
});

/**
 * GET /auth/oauth/providers
 * List available OAuth providers
 */
authRouter.get('/oauth/providers', (c) => {
  const available = Object.entries(OAUTH_PROVIDERS)
    .filter(([, config]) => process.env[config.clientIdEnv])
    .map(([name]) => name);

  return c.json({ providers: available });
});

// ═══════════════════════════════════════════════════════════════════════════
// AUTHENTICATED ROUTES (continued)
// ═══════════════════════════════════════════════════════════════════════════

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
