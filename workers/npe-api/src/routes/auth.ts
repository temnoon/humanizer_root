// Authentication routes for NPE Workers API
import { Hono } from 'hono';
import { hashPassword, verifyPassword, generateToken, requireAuth, getAuthContext } from '../middleware/auth';
import type { Env, RegisterRequest, LoginRequest, AuthResponse, User } from '../../shared/types';

const authRoutes = new Hono<{ Bindings: Env }>();

/**
 * POST /auth/register - Register new user
 *
 * Environment-based registration control:
 * - Local development (ENVIRONMENT != "production"): Registration ENABLED
 * - Production (ENVIRONMENT == "production"): Registration DISABLED during testing
 *
 * This allows local API distribution and testing while protecting production.
 */
authRoutes.post('/register', async (c) => {
  const environment = c.env.ENVIRONMENT || 'development';

  // Block registration in production during testing phase
  if (environment === 'production') {
    return c.json({
      error: 'Registration is temporarily disabled. We are currently in testing phase and not accepting new signups at this time.',
      hint: 'For local development, ensure ENVIRONMENT is set to "development" or "local".'
    }, 503);
  }

  // Registration enabled for local/dev environments
  try {
    const { email, password }: RegisterRequest = await c.req.json();

    // Validate input
    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    if (password.length < 8) {
      return c.json({ error: 'Password must be at least 8 characters' }, 400);
    }

    // Check if user already exists
    const existingUser = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first();

    if (existingUser) {
      return c.json({ error: 'User with this email already exists' }, 409);
    }

    // Hash password (PBKDF2 with 100,000 iterations)
    const passwordHash = await hashPassword(password);

    // Create user with FREE tier by default
    const userId = crypto.randomUUID();
    const now = Date.now();

    await c.env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, role, created_at, monthly_transformations, monthly_tokens_used, last_reset_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(userId, email, passwordHash, 'free', now, 0, 0, now).run();

    // Generate JWT token
    const secret = c.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }
    const token = await generateToken(userId, email, 'free', secret);

    const user: User = {
      id: userId,
      email,
      role: 'free',
      created_at: now,
      monthly_transformations: 0,
      monthly_tokens_used: 0,
      last_reset_date: now
    };

    const response: AuthResponse = {
      token,
      user
    };

    return c.json(response, 201);
  } catch (error) {
    console.error('Registration error:', error);
    return c.json({
      error: 'Registration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /auth/login - Login existing user
 */
authRoutes.post('/login', async (c) => {
  try {
    const { email, password }: LoginRequest = await c.req.json();

    // Validate input
    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    // Find user
    const userRow = await c.env.DB.prepare(
      'SELECT id, email, password_hash, role, created_at, monthly_transformations, monthly_tokens_used, last_reset_date FROM users WHERE email = ?'
    ).bind(email).first();

    if (!userRow) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Verify password
    const storedHash = userRow.password_hash as string;
    const isValidPassword = await verifyPassword(password, storedHash);

    if (!isValidPassword) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Check if password needs migration (legacy SHA-256 format)
    const needsMigration = !storedHash.startsWith('pbkdf2$');

    // Update last_login and migrate password if needed
    const now = Date.now();
    if (needsMigration) {
      // Re-hash password with secure PBKDF2
      const newHash = await hashPassword(password);
      await c.env.DB.prepare(
        'UPDATE users SET last_login = ?, password_hash = ? WHERE id = ?'
      ).bind(now, newHash, userRow.id).run();
      console.log(`[Security] Migrated password for user ${email} to PBKDF2`);
    } else {
      await c.env.DB.prepare(
        'UPDATE users SET last_login = ? WHERE id = ?'
      ).bind(now, userRow.id).run();
    }

    // Generate JWT token
    const token = await generateToken(
      userRow.id as string,
      userRow.email as string,
      userRow.role as string,
      c.env.JWT_SECRET
    );

    const user: User = {
      id: userRow.id as string,
      email: userRow.email as string,
      role: userRow.role as string,
      created_at: userRow.created_at as number,
      last_login: now,
      monthly_transformations: userRow.monthly_transformations as number,
      monthly_tokens_used: userRow.monthly_tokens_used as number,
      last_reset_date: userRow.last_reset_date as number | undefined,
    };

    const response: AuthResponse = {
      user,
      token,
    };

    return c.json(response, 200);
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /auth/me - Get current user info (requires auth)
 */
authRoutes.get('/me', requireAuth(), async (c) => {
  const auth = getAuthContext(c);

  const userRow = await c.env.DB.prepare(
    'SELECT id, email, role, created_at, last_login, monthly_transformations, monthly_tokens_used, last_reset_date FROM users WHERE id = ?'
  ).bind(auth.userId).first();

  if (!userRow) {
    return c.json({ error: 'User not found' }, 404);
  }

  const user: User = {
    id: userRow.id as string,
    email: userRow.email as string,
    role: userRow.role as string,
    created_at: userRow.created_at as number,
    last_login: userRow.last_login as number | undefined,
    monthly_transformations: userRow.monthly_transformations as number,
    monthly_tokens_used: userRow.monthly_tokens_used as number,
    last_reset_date: userRow.last_reset_date as number | undefined,
  };

  return c.json(user, 200);
});

export default authRoutes;
