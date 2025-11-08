// Transformation History Routes
// Endpoints for managing saved transformations with tier-based quotas

import { Hono } from 'hono';
import type { Env } from '../../shared/types';
import { requireAuth, getAuthContext } from '../middleware/auth';

const app = new Hono<{ Bindings: Env }>();

// Storage quotas per tier
const STORAGE_QUOTAS = {
  free: { max_count: 10, retention_days: 30 },
  member: { max_count: 50, retention_days: 90 },
  pro: { max_count: 200, retention_days: 365 },
  premium: { max_count: -1, retention_days: -1 }, // unlimited
  admin: { max_count: -1, retention_days: -1 }    // unlimited
};

/**
 * GET /transformation-history
 * List transformation history for authenticated user
 *
 * Query params:
 * - type: Filter by transformation type
 * - status: Filter by status (pending, completed, failed)
 * - limit: Number of results (default 50, max 200)
 * - offset: Pagination offset
 */
app.get('/', requireAuth(), async (c) => {
  const auth = getAuthContext(c);

  const type = c.req.query('type');
  const status = c.req.query('status');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200);
  const offset = parseInt(c.req.query('offset') || '0');

  let query = 'SELECT * FROM transformation_history WHERE user_id = ?';
  const params: any[] = [auth.userId];

  if (type) {
    query += ' AND transformation_type = ?';
    params.push(type);
  }

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const results = await c.env.DB.prepare(query).bind(...params).all();

  // Get total count for pagination
  let countQuery = 'SELECT COUNT(*) as total FROM transformation_history WHERE user_id = ?';
  const countParams: any[] = [auth.userId];

  if (type) {
    countQuery += ' AND transformation_type = ?';
    countParams.push(type);
  }

  if (status) {
    countQuery += ' AND status = ?';
    countParams.push(status);
  }

  const countResult = await c.env.DB.prepare(countQuery).bind(...countParams).first();

  return c.json({
    transformations: results.results || [],
    pagination: {
      total: countResult?.total || 0,
      limit,
      offset,
      has_more: (offset + limit) < (countResult?.total || 0)
    }
  });
});

/**
 * GET /transformation-history/:id
 * Get single transformation by ID
 */
app.get('/:id', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const id = c.req.param('id');

  const result = await c.env.DB.prepare(
    'SELECT * FROM transformation_history WHERE id = ? AND user_id = ?'
  ).bind(id, auth.userId).first();

  if (!result) {
    return c.json({ error: 'Transformation not found' }, 404);
  }

  return c.json(result);
});

/**
 * POST /transformation-history
 * Create new transformation history entry (called by transformation routes)
 */
app.post('/', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const body = await c.req.json();

  const { id, transformation_type, input_text, input_params } = body;

  if (!id || !transformation_type || !input_text) {
    return c.json({ error: 'Missing required fields: id, transformation_type, input_text' }, 400);
  }

  // Check quota
  const quota = STORAGE_QUOTAS[auth.role as keyof typeof STORAGE_QUOTAS] || STORAGE_QUOTAS.free;

  if (quota.max_count > 0) {
    const countResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM transformation_history WHERE user_id = ? AND status != ?'
    ).bind(auth.userId, 'failed').first();

    if ((countResult?.total || 0) >= quota.max_count) {
      return c.json({
        error: 'Storage quota exceeded',
        quota: quota.max_count,
        current: countResult?.total
      }, 403);
    }
  }

  // Create transformation history entry
  const now = Date.now();
  await c.env.DB.prepare(`
    INSERT INTO transformation_history (id, user_id, transformation_type, input_text, input_params, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `).bind(id, auth.userId, transformation_type, input_text, input_params || null, now).run();

  return c.json({ id, status: 'pending' }, 201);
});

/**
 * PATCH /transformation-history/:id
 * Update transformation status/results
 */
app.patch('/:id', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const id = c.req.param('id');
  const body = await c.req.json();

  const { status, output_data, error_message } = body;

  // Verify ownership
  const existing = await c.env.DB.prepare(
    'SELECT id FROM transformation_history WHERE id = ? AND user_id = ?'
  ).bind(id, auth.userId).first();

  if (!existing) {
    return c.json({ error: 'Transformation not found' }, 404);
  }

  const updates: string[] = [];
  const params: any[] = [];

  if (status) {
    updates.push('status = ?');
    params.push(status);
  }

  if (output_data) {
    updates.push('output_data = ?');
    params.push(typeof output_data === 'string' ? output_data : JSON.stringify(output_data));
  }

  if (error_message) {
    updates.push('error_message = ?');
    params.push(error_message);
  }

  if (status === 'completed' || status === 'failed') {
    updates.push('completed_at = ?');
    params.push(Date.now());
  }

  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }

  params.push(id, auth.userId);

  await c.env.DB.prepare(`
    UPDATE transformation_history
    SET ${updates.join(', ')}
    WHERE id = ? AND user_id = ?
  `).bind(...params).run();

  return c.json({ id, updated: true });
});

/**
 * DELETE /transformation-history/:id
 * Delete transformation from history
 */
app.delete('/:id', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const id = c.req.param('id');

  const result = await c.env.DB.prepare(
    'DELETE FROM transformation_history WHERE id = ? AND user_id = ? RETURNING id'
  ).bind(id, auth.userId).first();

  if (!result) {
    return c.json({ error: 'Transformation not found' }, 404);
  }

  return c.json({ deleted: true });
});

/**
 * POST /transformation-history/:id/favorite
 * Toggle favorite status
 */
app.post('/:id/favorite', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const id = c.req.param('id');

  const existing = await c.env.DB.prepare(
    'SELECT is_favorite FROM transformation_history WHERE id = ? AND user_id = ?'
  ).bind(id, auth.userId).first();

  if (!existing) {
    return c.json({ error: 'Transformation not found' }, 404);
  }

  const newFavoriteStatus = existing.is_favorite ? 0 : 1;

  await c.env.DB.prepare(
    'UPDATE transformation_history SET is_favorite = ? WHERE id = ? AND user_id = ?'
  ).bind(newFavoriteStatus, id, auth.userId).run();

  return c.json({ is_favorite: newFavoriteStatus === 1 });
});

/**
 * DELETE /transformation-history/cleanup
 * Clean up old transformations based on retention policy
 */
app.delete('/cleanup', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const quota = STORAGE_QUOTAS[auth.role as keyof typeof STORAGE_QUOTAS] || STORAGE_QUOTAS.free;

  if (quota.retention_days < 0) {
    return c.json({ message: 'Unlimited retention - no cleanup needed' });
  }

  const cutoffDate = Date.now() - (quota.retention_days * 24 * 60 * 60 * 1000);

  const result = await c.env.DB.prepare(`
    DELETE FROM transformation_history
    WHERE user_id = ? AND created_at < ? AND is_favorite = 0
    RETURNING id
  `).bind(auth.userId, cutoffDate).all();

  return c.json({
    deleted: result.results?.length || 0,
    cutoff_date: new Date(cutoffDate).toISOString()
  });
});

export default app;
