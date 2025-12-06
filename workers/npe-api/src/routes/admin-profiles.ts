/**
 * Admin Profile Management Routes
 *
 * CRUD operations for global transformation profiles (personas, styles, namespaces)
 * Includes feedback aggregation for monitoring profile quality.
 *
 * All endpoints require admin role.
 */

import { Hono } from 'hono';
import { requireAuth, getAuthContext, requireAdmin } from '../middleware/auth';
import type { Env } from '../../shared/types';

const adminProfileRoutes = new Hono<{ Bindings: Env }>();

// All routes require admin role
adminProfileRoutes.use('*', requireAuth(), requireAdmin());

// ============================================================
// PERSONAS
// ============================================================

/**
 * GET /admin/profiles/personas - List all personas with feedback stats
 */
adminProfileRoutes.get('/personas', async (c) => {
  try {
    // Get all personas
    const personas = await c.env.DB.prepare(`
      SELECT
        p.id,
        p.name,
        p.description,
        p.system_prompt,
        p.status,
        p.created_at,
        p.updated_at,
        p.created_by,
        COALESCE(f.total_uses, 0) as total_uses,
        COALESCE(f.thumbs_up, 0) as thumbs_up,
        COALESCE(f.thumbs_down, 0) as thumbs_down,
        COALESCE(f.success_rate, 0) as success_rate
      FROM npe_personas p
      LEFT JOIN profile_feedback_stats f
        ON f.profile_name = p.name AND f.transformation_type = 'persona'
      ORDER BY p.name
    `).all();

    return c.json({ personas: personas.results }, 200);
  } catch (error) {
    console.error('Error fetching personas:', error);
    return c.json({ error: 'Failed to fetch personas' }, 500);
  }
});

/**
 * POST /admin/profiles/personas - Create new persona
 */
adminProfileRoutes.post('/personas', async (c) => {
  try {
    const auth = getAuthContext(c);
    const body = await c.req.json();

    const { name, description, system_prompt, status = 'draft' } = body;

    if (!name || !description || !system_prompt) {
      return c.json({ error: 'name, description, and system_prompt are required' }, 400);
    }

    // Validate status
    if (!['active', 'draft', 'disabled'].includes(status)) {
      return c.json({ error: 'Invalid status. Must be: active, draft, or disabled' }, 400);
    }

    const now = Date.now();

    const result = await c.env.DB.prepare(`
      INSERT INTO npe_personas (name, description, system_prompt, status, created_at, updated_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(name, description, system_prompt, status, now, now, auth.userId).run();

    return c.json({
      success: true,
      id: result.meta.last_row_id,
      message: `Persona "${name}" created with status "${status}"`
    }, 201);
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint')) {
      return c.json({ error: 'A persona with this name already exists' }, 409);
    }
    console.error('Error creating persona:', error);
    return c.json({ error: 'Failed to create persona' }, 500);
  }
});

/**
 * PUT /admin/profiles/personas/:id - Update persona
 */
adminProfileRoutes.put('/personas/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();

    const { name, description, system_prompt, status } = body;

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (system_prompt !== undefined) {
      updates.push('system_prompt = ?');
      values.push(system_prompt);
    }
    if (status !== undefined) {
      if (!['active', 'draft', 'disabled'].includes(status)) {
        return c.json({ error: 'Invalid status' }, 400);
      }
      updates.push('status = ?');
      values.push(status);
    }

    if (updates.length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }

    updates.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const result = await c.env.DB.prepare(`
      UPDATE npe_personas SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run();

    if (result.meta.changes === 0) {
      return c.json({ error: 'Persona not found' }, 404);
    }

    return c.json({ success: true, message: 'Persona updated' }, 200);
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint')) {
      return c.json({ error: 'A persona with this name already exists' }, 409);
    }
    console.error('Error updating persona:', error);
    return c.json({ error: 'Failed to update persona' }, 500);
  }
});

/**
 * DELETE /admin/profiles/personas/:id - Delete persona
 */
adminProfileRoutes.delete('/personas/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const result = await c.env.DB.prepare(
      'DELETE FROM npe_personas WHERE id = ?'
    ).bind(id).run();

    if (result.meta.changes === 0) {
      return c.json({ error: 'Persona not found' }, 404);
    }

    return c.json({ success: true, message: 'Persona deleted' }, 200);
  } catch (error) {
    console.error('Error deleting persona:', error);
    return c.json({ error: 'Failed to delete persona' }, 500);
  }
});

// ============================================================
// STYLES
// ============================================================

/**
 * GET /admin/profiles/styles - List all styles with feedback stats
 */
adminProfileRoutes.get('/styles', async (c) => {
  try {
    const styles = await c.env.DB.prepare(`
      SELECT
        s.id,
        s.name,
        s.style_prompt,
        s.status,
        s.created_at,
        s.updated_at,
        s.created_by,
        COALESCE(f.total_uses, 0) as total_uses,
        COALESCE(f.thumbs_up, 0) as thumbs_up,
        COALESCE(f.thumbs_down, 0) as thumbs_down,
        COALESCE(f.success_rate, 0) as success_rate
      FROM npe_styles s
      LEFT JOIN profile_feedback_stats f
        ON f.profile_name = s.name AND f.transformation_type = 'style'
      ORDER BY s.name
    `).all();

    return c.json({ styles: styles.results }, 200);
  } catch (error) {
    console.error('Error fetching styles:', error);
    return c.json({ error: 'Failed to fetch styles' }, 500);
  }
});

/**
 * POST /admin/profiles/styles - Create new style
 */
adminProfileRoutes.post('/styles', async (c) => {
  try {
    const auth = getAuthContext(c);
    const body = await c.req.json();

    const { name, style_prompt, status = 'draft' } = body;

    if (!name || !style_prompt) {
      return c.json({ error: 'name and style_prompt are required' }, 400);
    }

    if (!['active', 'draft', 'disabled'].includes(status)) {
      return c.json({ error: 'Invalid status' }, 400);
    }

    const now = Date.now();

    const result = await c.env.DB.prepare(`
      INSERT INTO npe_styles (name, style_prompt, status, created_at, updated_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(name, style_prompt, status, now, now, auth.userId).run();

    return c.json({
      success: true,
      id: result.meta.last_row_id,
      message: `Style "${name}" created with status "${status}"`
    }, 201);
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint')) {
      return c.json({ error: 'A style with this name already exists' }, 409);
    }
    console.error('Error creating style:', error);
    return c.json({ error: 'Failed to create style' }, 500);
  }
});

/**
 * PUT /admin/profiles/styles/:id - Update style
 */
adminProfileRoutes.put('/styles/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();

    const { name, style_prompt, status } = body;

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (style_prompt !== undefined) {
      updates.push('style_prompt = ?');
      values.push(style_prompt);
    }
    if (status !== undefined) {
      if (!['active', 'draft', 'disabled'].includes(status)) {
        return c.json({ error: 'Invalid status' }, 400);
      }
      updates.push('status = ?');
      values.push(status);
    }

    if (updates.length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }

    updates.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const result = await c.env.DB.prepare(`
      UPDATE npe_styles SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run();

    if (result.meta.changes === 0) {
      return c.json({ error: 'Style not found' }, 404);
    }

    return c.json({ success: true, message: 'Style updated' }, 200);
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint')) {
      return c.json({ error: 'A style with this name already exists' }, 409);
    }
    console.error('Error updating style:', error);
    return c.json({ error: 'Failed to update style' }, 500);
  }
});

/**
 * DELETE /admin/profiles/styles/:id - Delete style
 */
adminProfileRoutes.delete('/styles/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const result = await c.env.DB.prepare(
      'DELETE FROM npe_styles WHERE id = ?'
    ).bind(id).run();

    if (result.meta.changes === 0) {
      return c.json({ error: 'Style not found' }, 404);
    }

    return c.json({ success: true, message: 'Style deleted' }, 200);
  } catch (error) {
    console.error('Error deleting style:', error);
    return c.json({ error: 'Failed to delete style' }, 500);
  }
});

// ============================================================
// FEEDBACK AGGREGATION
// ============================================================

/**
 * GET /admin/profiles/feedback - Get all feedback with filtering
 */
adminProfileRoutes.get('/feedback', async (c) => {
  try {
    const profile = c.req.query('profile');
    const type = c.req.query('type');
    const rating = c.req.query('rating');
    const limit = parseInt(c.req.query('limit') || '100');
    const offset = parseInt(c.req.query('offset') || '0');

    let query = `
      SELECT
        f.*,
        u.email as user_email
      FROM transformation_feedback f
      LEFT JOIN users u ON u.id = f.user_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (profile) {
      query += ' AND f.profile_name = ?';
      params.push(profile);
    }
    if (type) {
      query += ' AND f.transformation_type = ?';
      params.push(type);
    }
    if (rating) {
      query += ' AND f.rating = ?';
      params.push(rating);
    }

    query += ' ORDER BY f.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const feedback = await c.env.DB.prepare(query).bind(...params).all();

    // Also get aggregate stats
    const stats = await c.env.DB.prepare(`
      SELECT * FROM profile_feedback_stats ORDER BY total_uses DESC
    `).all();

    return c.json({
      feedback: feedback.results,
      stats: stats.results,
      pagination: { limit, offset }
    }, 200);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return c.json({ error: 'Failed to fetch feedback' }, 500);
  }
});

/**
 * GET /admin/profiles/feedback/summary - Overall feedback summary
 */
adminProfileRoutes.get('/feedback/summary', async (c) => {
  try {
    // Overall totals
    const overall = await c.env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN rating = 'good' THEN 1 ELSE 0 END) as good,
        SUM(CASE WHEN rating = 'bad' THEN 1 ELSE 0 END) as bad
      FROM transformation_feedback
    `).first();

    // By profile (top 10 by usage)
    const byProfile = await c.env.DB.prepare(`
      SELECT * FROM profile_feedback_stats
      ORDER BY total_uses DESC
      LIMIT 10
    `).all();

    // Recent negative feedback (for attention)
    const recentNegative = await c.env.DB.prepare(`
      SELECT
        f.profile_name,
        f.transformation_type,
        f.feedback_text,
        f.created_at,
        u.email as user_email
      FROM transformation_feedback f
      LEFT JOIN users u ON u.id = f.user_id
      WHERE f.rating = 'bad' AND f.feedback_text IS NOT NULL
      ORDER BY f.created_at DESC
      LIMIT 10
    `).all();

    return c.json({
      overall,
      byProfile: byProfile.results,
      recentNegative: recentNegative.results
    }, 200);
  } catch (error) {
    console.error('Error fetching feedback summary:', error);
    return c.json({ error: 'Failed to fetch feedback summary' }, 500);
  }
});

export default adminProfileRoutes;
