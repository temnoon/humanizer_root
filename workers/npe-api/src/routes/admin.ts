/**
 * Admin Routes
 * Protected endpoints for site administration
 *
 * All endpoints require ADMIN role
 */

import { Hono } from 'hono';
import { requireAuth, requireAdmin, getAuthContext } from '../middleware/auth';
import type { Env } from '../../shared/types';

const adminRoutes = new Hono<{ Bindings: Env }>();

/**
 * GET /admin/metrics
 *
 * Returns comprehensive site-wide analytics for monitoring beta usage
 *
 * Response:
 * {
 *   "overview": {
 *     "total_users": 125,
 *     "active_users_24h": 12,
 *     "active_users_7d": 45,
 *     "active_users_30d": 89,
 *     "total_transformations": 1523,
 *     "transformations_24h": 67,
 *     "transformations_7d": 342,
 *     "mailing_list_signups": 73
 *   },
 *   "users_by_tier": {
 *     "FREE": 98,
 *     "MEMBER": 15,
 *     "PRO": 10,
 *     "PREMIUM": 1,
 *     "ADMIN": 1
 *   },
 *   "transformations_by_type": [
 *     { "type": "allegorical", "count": 456, "percentage": 30 },
 *     { "type": "round-trip", "count": 345, "percentage": 23 },
 *     ...
 *   ],
 *   "daily_activity": [
 *     { "date": "2025-11-12", "users": 12, "transformations": 67 },
 *     { "date": "2025-11-11", "users": 18, "transformations": 89 },
 *     ...
 *   ],
 *   "popular_features": [
 *     { "feature": "allegorical", "users": 45 },
 *     { "feature": "round-trip", "users": 38 },
 *     ...
 *   ],
 *   "quota_usage": {
 *     "users_near_limit": 5,
 *     "avg_usage_percentage": 34
 *   }
 * }
 */
adminRoutes.get('/metrics', requireAuth(), requireAdmin(), async (c) => {
  try {
    const env = c.env;

    // Overview - Total users
    const totalUsersResult = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
    const totalUsers = (totalUsersResult?.count as number) || 0;

    // Active users (users with transformations in time period)
    // Note: created_at is stored as INTEGER (Unix timestamp)
    const now = Math.floor(Date.now() / 1000);
    const day_ago = now - (24 * 60 * 60);
    const week_ago = now - (7 * 24 * 60 * 60);
    const month_ago = now - (30 * 24 * 60 * 60);

    const active24h = await env.DB.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM transformations
      WHERE created_at >= ?
    `).bind(day_ago).first();

    const active7d = await env.DB.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM transformations
      WHERE created_at >= ?
    `).bind(week_ago).first();

    const active30d = await env.DB.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM transformations
      WHERE created_at >= ?
    `).bind(month_ago).first();

    // Total transformations
    const totalTransforms = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM transformations
    `).first();

    const transforms24h = await env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM transformations
      WHERE created_at >= ?
    `).bind(day_ago).first();

    const transforms7d = await env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM transformations
      WHERE created_at >= ?
    `).bind(week_ago).first();

    // Mailing list signups
    const mailingListCount = await env.DB.prepare('SELECT COUNT(*) as count FROM mailing_list').first();

    // Users by tier
    const usersByTier = await env.DB.prepare(`
      SELECT role, COUNT(*) as count
      FROM users
      GROUP BY role
    `).all();

    const tierCounts: Record<string, number> = {
      FREE: 0,
      MEMBER: 0,
      PRO: 0,
      PREMIUM: 0,
      ADMIN: 0
    };

    usersByTier.results.forEach((row: any) => {
      tierCounts[row.role] = row.count;
    });

    // Transformations by type
    // Count from specialized tables since transformation_history doesn't exist yet
    let transformationsByType: any[] = [];
    try {
      const allegoricalCount = await env.DB.prepare('SELECT COUNT(*) as count FROM allegorical_projections').first();
      const roundTripCount = await env.DB.prepare('SELECT COUNT(*) as count FROM round_trip_translations').first();
      const maieuticCount = await env.DB.prepare('SELECT COUNT(*) as count FROM maieutic_sessions').first();
      const quantumCount = await env.DB.prepare('SELECT COUNT(*) as count FROM quantum_analysis_sessions').first();

      const typeCounts = [
        { type: 'allegorical', count: allegoricalCount?.count || 0 },
        { type: 'round-trip', count: roundTripCount?.count || 0 },
        { type: 'maieutic', count: maieuticCount?.count || 0 },
        { type: 'quantum-reading', count: quantumCount?.count || 0 }
      ].filter(item => item.count > 0);

      const totalTypeTransforms = typeCounts.reduce((sum, item) => sum + item.count, 0);
      transformationsByType = typeCounts.map(item => ({
        type: item.type,
        count: item.count,
        percentage: totalTypeTransforms > 0 ? Math.round((item.count / totalTypeTransforms) * 100) : 0
      }));
    } catch (error) {
      console.error('Error fetching transformations by type:', error);
      transformationsByType = [];
    }

    // Daily activity (last 14 days)
    // Note: created_at is INTEGER (Unix timestamp), convert to date
    const twoWeeksAgo = now - (14 * 24 * 60 * 60);
    const dailyActivity = await env.DB.prepare(`
      SELECT
        date(created_at, 'unixepoch') as date,
        COUNT(DISTINCT user_id) as users,
        COUNT(*) as transformations
      FROM transformations
      WHERE created_at >= ?
      GROUP BY date(created_at, 'unixepoch')
      ORDER BY date DESC
    `).bind(twoWeeksAgo).all();

    // Popular features (users who used each transformation type)
    let popularFeatures: any = { results: [] };
    try {
      // Count unique users for each transformation type from specialized tables
      const allegoricalUsers = await env.DB.prepare(`
        SELECT COUNT(DISTINCT user_id) as users FROM allegorical_projections
      `).first();
      const roundTripUsers = await env.DB.prepare(`
        SELECT COUNT(DISTINCT user_id) as users FROM round_trip_translations
      `).first();
      const maieuticUsers = await env.DB.prepare(`
        SELECT COUNT(DISTINCT user_id) as users FROM maieutic_sessions
      `).first();
      const quantumUsers = await env.DB.prepare(`
        SELECT COUNT(DISTINCT user_id) as users FROM quantum_analysis_sessions
      `).first();

      popularFeatures.results = [
        { feature: 'allegorical', users: allegoricalUsers?.users || 0 },
        { feature: 'round-trip', users: roundTripUsers?.users || 0 },
        { feature: 'maieutic', users: maieuticUsers?.users || 0 },
        { feature: 'quantum-reading', users: quantumUsers?.users || 0 }
      ].filter(item => item.users > 0).sort((a, b) => b.users - a.users);
    } catch (error) {
      console.error('Error fetching popular features:', error);
      popularFeatures.results = [];
    }

    // Quota usage - users near their monthly limit
    const quotaUsage = await env.DB.prepare(`
      SELECT
        COUNT(*) as users_near_limit,
        AVG(CAST(monthly_transformations as FLOAT) /
            CASE role
              WHEN 'FREE' THEN 10
              WHEN 'MEMBER' THEN 50
              WHEN 'PRO' THEN 200
              ELSE 999999
            END * 100) as avg_usage_percentage
      FROM users
      WHERE role IN ('FREE', 'MEMBER', 'PRO')
        AND CAST(monthly_transformations as FLOAT) /
            CASE role
              WHEN 'FREE' THEN 10
              WHEN 'MEMBER' THEN 50
              WHEN 'PRO' THEN 200
              ELSE 999999
            END > 0.8
    `).first();

    return c.json({
      overview: {
        total_users: totalUsers,
        active_users_24h: active24h?.count || 0,
        active_users_7d: active7d?.count || 0,
        active_users_30d: active30d?.count || 0,
        total_transformations: totalTransforms?.count || 0,
        transformations_24h: transforms24h?.count || 0,
        transformations_7d: transforms7d?.count || 0,
        mailing_list_signups: mailingListCount?.count || 0
      },
      users_by_tier: tierCounts,
      transformations_by_type: transformationsByType,
      daily_activity: dailyActivity.results,
      popular_features: popularFeatures.results,
      quota_usage: {
        users_near_limit: quotaUsage?.users_near_limit || 0,
        avg_usage_percentage: Math.round(quotaUsage?.avg_usage_percentage || 0)
      }
    });
  } catch (error: any) {
    console.error('Error fetching admin metrics:', error);
    return c.json({ error: 'Failed to fetch metrics', details: error.message }, 500);
  }
});

/**
 * GET /admin/users
 *
 * List all users with search, filter, and pagination
 *
 * Query params:
 * - search: Email or ID search
 * - role: Filter by role (FREE, MEMBER, PRO, PREMIUM, ADMIN)
 * - limit: Results per page (default 50)
 * - offset: Pagination offset
 *
 * Response:
 * {
 *   "users": [
 *     {
 *       "id": "uuid",
 *       "email": "user@example.com",
 *       "role": "PRO",
 *       "monthly_transformations": 45,
 *       "monthly_tokens_used": 12500,
 *       "last_reset_date": "2025-11-01",
 *       "created_at": "2025-10-15",
 *       "total_transformations": 123
 *     }
 *   ],
 *   "total": 125,
 *   "limit": 50,
 *   "offset": 0
 * }
 */
adminRoutes.get('/users', requireAuth(), requireAdmin(), async (c) => {
  try {
    const search = c.req.query('search') || '';
    const role = c.req.query('role') || '';
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    let query = `
      SELECT
        u.id,
        u.email,
        u.role,
        u.monthly_transformations,
        u.monthly_tokens_used,
        u.last_reset_date,
        u.created_at,
        COUNT(t.id) as total_transformations
      FROM users u
      LEFT JOIN transformations t ON u.id = t.user_id
      WHERE 1=1
    `;

    const bindings: any[] = [];

    if (search) {
      query += ` AND (u.email LIKE ? OR u.id LIKE ?)`;
      bindings.push(`%${search}%`, `%${search}%`);
    }

    if (role) {
      query += ` AND u.role = ?`;
      bindings.push(role);
    }

    query += ` GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
    bindings.push(limit, offset);

    const users = await c.env.DB.prepare(query).bind(...bindings).all();

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as count FROM users WHERE 1=1`;
    const countBindings: any[] = [];

    if (search) {
      countQuery += ` AND (email LIKE ? OR id LIKE ?)`;
      countBindings.push(`%${search}%`, `%${search}%`);
    }

    if (role) {
      countQuery += ` AND role = ?`;
      countBindings.push(role);
    }

    const totalResult = await c.env.DB.prepare(countQuery).bind(...countBindings).first();
    const total = (totalResult?.count as number) || 0;

    return c.json({
      users: users.results,
      total,
      limit,
      offset
    });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return c.json({ error: 'Failed to fetch users', details: error.message }, 500);
  }
});

/**
 * PATCH /admin/users/:id
 *
 * Update user properties (role, quotas, etc.)
 *
 * Request body:
 * {
 *   "role": "PRO",
 *   "monthly_transformations": 0,  // Reset quota
 *   "monthly_tokens_used": 0       // Reset tokens
 * }
 */
adminRoutes.patch('/users/:id', requireAuth(), requireAdmin(), async (c) => {
  try {
    const userId = c.req.param('id');
    const updates = await c.req.json();

    // Build update query dynamically
    const fields: string[] = [];
    const bindings: any[] = [];

    if (updates.role) {
      fields.push('role = ?');
      bindings.push(updates.role);
    }

    if (updates.monthly_transformations !== undefined) {
      fields.push('monthly_transformations = ?');
      bindings.push(updates.monthly_transformations);
    }

    if (updates.monthly_tokens_used !== undefined) {
      fields.push('monthly_tokens_used = ?');
      bindings.push(updates.monthly_tokens_used);
    }

    if (fields.length === 0) {
      return c.json({ error: 'No valid fields to update' }, 400);
    }

    bindings.push(userId);
    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;

    await c.env.DB.prepare(query).bind(...bindings).run();

    // Fetch updated user
    const updatedUser = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();

    return c.json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return c.json({ error: 'Failed to update user', details: error.message }, 500);
  }
});

/**
 * GET /admin/system-health
 *
 * Returns system health status for monitoring
 *
 * Response:
 * {
 *   "status": "healthy",
 *   "checks": {
 *     "database": "ok",
 *     "api": "ok"
 *   },
 *   "timestamp": "2025-11-12T..."
 * }
 */
adminRoutes.get('/system-health', requireAuth(), requireAdmin(), async (c) => {
  try {
    // Test database connection
    const dbTest = await c.env.DB.prepare('SELECT 1 as test').first();
    const dbStatus = dbTest?.test === 1 ? 'ok' : 'error';

    return c.json({
      status: dbStatus === 'ok' ? 'healthy' : 'degraded',
      checks: {
        database: dbStatus,
        api: 'ok'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Health check error:', error);
    return c.json({
      status: 'error',
      checks: {
        database: 'error',
        api: 'ok'
      },
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

export { adminRoutes };
