// Authentication routes for NPE Workers API
import { Hono } from 'hono';
import { hashPassword, verifyPassword, generateToken } from '../middleware/auth';
import type { Env, RegisterRequest, LoginRequest, AuthResponse, User } from '../../shared/types';

const authRoutes = new Hono<{ Bindings: Env }>();

/**
 * POST /auth/register - Register new user
 * TEMPORARILY DISABLED - Application in testing phase
 */
authRoutes.post('/register', async (c) => {
  // Registration temporarily disabled during testing phase
  return c.json({
    error: 'Registration is temporarily disabled. We are currently in testing phase and not accepting new signups at this time.'
  }, 503);
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
      'SELECT id, email, password_hash, created_at FROM users WHERE email = ?'
    ).bind(email).first();

    if (!userRow) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, userRow.password_hash as string);

    if (!isValidPassword) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Update last_login
    const now = Date.now();
    await c.env.DB.prepare(
      'UPDATE users SET last_login = ? WHERE id = ?'
    ).bind(now, userRow.id).run();

    // Generate JWT token
    const token = await generateToken(userRow.id as string, userRow.email as string, c.env.JWT_SECRET);

    const user: User = {
      id: userRow.id as string,
      email: userRow.email as string,
      created_at: userRow.created_at as number,
      last_login: now,
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
authRoutes.get('/me', async (c) => {
  // This will be protected by requireAuth middleware in main app
  const auth = c.get('auth');

  const userRow = await c.env.DB.prepare(
    'SELECT id, email, created_at, last_login FROM users WHERE id = ?'
  ).bind(auth.userId).first();

  if (!userRow) {
    return c.json({ error: 'User not found' }, 404);
  }

  const user: User = {
    id: userRow.id as string,
    email: userRow.email as string,
    created_at: userRow.created_at as number,
    last_login: userRow.last_login as number | undefined,
  };

  return c.json(user, 200);
});

export default authRoutes;
