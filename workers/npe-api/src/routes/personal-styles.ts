// Personal styles routes for NPE Workers API
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import type {
  Env,
  PersonalStyle,
  CreateStyleRequest,
  StyleResponse
} from '../../shared/types';

const personalStylesRoutes = new Hono<{ Bindings: Env }>();

/**
 * GET /personal/styles - List user's styles (discovered + custom)
 * Requires authentication
 */
personalStylesRoutes.get('/', requireAuth(), async (c) => {
  try {
    const auth = c.get('auth');
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get all styles for this user, ordered by auto-discovered first, then creation date
    const result = await c.env.DB.prepare(`
      SELECT
        id, user_id, name, description, auto_discovered,
        formality_score, complexity_score, avg_sentence_length,
        vocab_diversity, tone_markers, example_texts,
        custom_metadata, created_at, updated_at
      FROM personal_styles
      WHERE user_id = ?
      ORDER BY auto_discovered DESC, created_at DESC
    `).bind(auth.userId).all();

    const styles: PersonalStyle[] = result.results.map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      description: row.description || undefined,
      auto_discovered: Boolean(row.auto_discovered),
      formality_score: row.formality_score || undefined,
      complexity_score: row.complexity_score || undefined,
      avg_sentence_length: row.avg_sentence_length || undefined,
      vocab_diversity: row.vocab_diversity || undefined,
      tone_markers: row.tone_markers ? JSON.parse(row.tone_markers) : undefined,
      example_texts: row.example_texts ? JSON.parse(row.example_texts) : undefined,
      custom_metadata: row.custom_metadata ? JSON.parse(row.custom_metadata) : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    return c.json({
      styles,
      total: styles.length,
      discovered: styles.filter(s => s.auto_discovered).length,
      custom: styles.filter(s => !s.auto_discovered).length
    }, 200);

  } catch (error) {
    console.error('List styles error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /personal/styles/:id - Get a specific style
 * Requires authentication
 */
personalStylesRoutes.get('/:id', requireAuth(), async (c) => {
  try {
    const auth = c.get('auth');
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const styleId = c.req.param('id');

    const result = await c.env.DB.prepare(
      'SELECT * FROM personal_styles WHERE id = ? AND user_id = ?'
    ).bind(styleId, auth.userId).first();

    if (!result) {
      return c.json({ error: 'Style not found' }, 404);
    }

    const style: PersonalStyle = {
      id: result.id as number,
      user_id: result.user_id as number,
      name: result.name as string,
      description: result.description as string | undefined,
      auto_discovered: Boolean(result.auto_discovered),
      formality_score: result.formality_score as number | undefined,
      complexity_score: result.complexity_score as number | undefined,
      avg_sentence_length: result.avg_sentence_length as number | undefined,
      vocab_diversity: result.vocab_diversity as number | undefined,
      tone_markers: result.tone_markers ? JSON.parse(result.tone_markers as string) : undefined,
      example_texts: result.example_texts ? JSON.parse(result.example_texts as string) : undefined,
      custom_metadata: result.custom_metadata ? JSON.parse(result.custom_metadata as string) : undefined,
      created_at: result.created_at as string,
      updated_at: result.updated_at as string
    };

    return c.json({ style } as StyleResponse, 200);

  } catch (error) {
    console.error('Get style error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /personal/styles - Create a custom style
 * Requires authentication
 */
personalStylesRoutes.post('/', requireAuth(), async (c) => {
  try {
    const auth = c.get('auth');
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const {
      name,
      description,
      formality_score,
      complexity_score,
      tone_markers,
      example_texts,
      metadata
    }: CreateStyleRequest = await c.req.json();

    // Validate input
    if (!name || name.trim().length === 0) {
      return c.json({ error: 'Style name is required' }, 400);
    }

    // Validate score ranges (0.0-1.0)
    if (formality_score !== undefined && (formality_score < 0 || formality_score > 1)) {
      return c.json({ error: 'Formality score must be between 0.0 and 1.0' }, 400);
    }

    if (complexity_score !== undefined && (complexity_score < 0 || complexity_score > 1)) {
      return c.json({ error: 'Complexity score must be between 0.0 and 1.0' }, 400);
    }

    // Check for duplicate name
    const existing = await c.env.DB.prepare(
      'SELECT id FROM personal_styles WHERE user_id = ? AND name = ?'
    ).bind(auth.userId, name.trim()).first();

    if (existing) {
      return c.json({ error: 'A style with this name already exists' }, 409);
    }

    // Insert style (auto_discovered = 0 for custom styles)
    const result = await c.env.DB.prepare(`
      INSERT INTO personal_styles
      (user_id, name, description, auto_discovered, formality_score, complexity_score,
       tone_markers, example_texts, custom_metadata)
      VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)
    `).bind(
      auth.userId,
      name.trim(),
      description || null,
      formality_score ?? null,
      complexity_score ?? null,
      tone_markers ? JSON.stringify(tone_markers) : null,
      example_texts ? JSON.stringify(example_texts) : null,
      metadata ? JSON.stringify(metadata) : null
    ).run();

    // Fetch the created style
    const created = await c.env.DB.prepare(
      'SELECT * FROM personal_styles WHERE id = ?'
    ).bind(result.meta.last_row_id).first();

    if (!created) {
      return c.json({ error: 'Failed to retrieve created style' }, 500);
    }

    const style: PersonalStyle = {
      id: created.id as number,
      user_id: created.user_id as number,
      name: created.name as string,
      description: created.description as string | undefined,
      auto_discovered: Boolean(created.auto_discovered),
      formality_score: created.formality_score as number | undefined,
      complexity_score: created.complexity_score as number | undefined,
      avg_sentence_length: created.avg_sentence_length as number | undefined,
      vocab_diversity: created.vocab_diversity as number | undefined,
      tone_markers: created.tone_markers ? JSON.parse(created.tone_markers as string) : undefined,
      example_texts: created.example_texts ? JSON.parse(created.example_texts as string) : undefined,
      custom_metadata: created.custom_metadata ? JSON.parse(created.custom_metadata as string) : undefined,
      created_at: created.created_at as string,
      updated_at: created.updated_at as string
    };

    return c.json({ style } as StyleResponse, 201);

  } catch (error) {
    console.error('Create style error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * PUT /personal/styles/:id - Update a style
 * Requires authentication
 */
personalStylesRoutes.put('/:id', requireAuth(), async (c) => {
  try {
    const auth = c.get('auth');
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const styleId = c.req.param('id');
    const {
      name,
      description,
      formality_score,
      complexity_score,
      tone_markers,
      metadata
    } = await c.req.json();

    // Verify ownership
    const existing = await c.env.DB.prepare(
      'SELECT id, name FROM personal_styles WHERE id = ? AND user_id = ?'
    ).bind(styleId, auth.userId).first();

    if (!existing) {
      return c.json({ error: 'Style not found' }, 404);
    }

    // Validate score ranges if provided
    if (formality_score !== undefined && (formality_score < 0 || formality_score > 1)) {
      return c.json({ error: 'Formality score must be between 0.0 and 1.0' }, 400);
    }

    if (complexity_score !== undefined && (complexity_score < 0 || complexity_score > 1)) {
      return c.json({ error: 'Complexity score must be between 0.0 and 1.0' }, 400);
    }

    // Check for duplicate name if name is being changed
    if (name && name.trim() !== existing.name) {
      const duplicate = await c.env.DB.prepare(
        'SELECT id FROM personal_styles WHERE user_id = ? AND name = ? AND id != ?'
      ).bind(auth.userId, name.trim(), styleId).first();

      if (duplicate) {
        return c.json({ error: 'A style with this name already exists' }, 409);
      }
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }

    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description || null);
    }

    if (formality_score !== undefined) {
      updates.push('formality_score = ?');
      values.push(formality_score);
    }

    if (complexity_score !== undefined) {
      updates.push('complexity_score = ?');
      values.push(complexity_score);
    }

    if (tone_markers !== undefined) {
      updates.push('tone_markers = ?');
      values.push(tone_markers ? JSON.stringify(tone_markers) : null);
    }

    if (metadata !== undefined) {
      updates.push('custom_metadata = ?');
      values.push(metadata ? JSON.stringify(metadata) : null);
    }

    // Always update updated_at
    updates.push('updated_at = CURRENT_TIMESTAMP');

    if (updates.length === 1) {
      // Only updated_at, no actual changes
      return c.json({ error: 'No fields to update' }, 400);
    }

    values.push(styleId, auth.userId);

    await c.env.DB.prepare(`
      UPDATE personal_styles
      SET ${updates.join(', ')}
      WHERE id = ? AND user_id = ?
    `).bind(...values).run();

    // Fetch updated style
    const updated = await c.env.DB.prepare(
      'SELECT * FROM personal_styles WHERE id = ?'
    ).bind(styleId).first();

    if (!updated) {
      return c.json({ error: 'Failed to retrieve updated style' }, 500);
    }

    const style: PersonalStyle = {
      id: updated.id as number,
      user_id: updated.user_id as number,
      name: updated.name as string,
      description: updated.description as string | undefined,
      auto_discovered: Boolean(updated.auto_discovered),
      formality_score: updated.formality_score as number | undefined,
      complexity_score: updated.complexity_score as number | undefined,
      avg_sentence_length: updated.avg_sentence_length as number | undefined,
      vocab_diversity: updated.vocab_diversity as number | undefined,
      tone_markers: updated.tone_markers ? JSON.parse(updated.tone_markers as string) : undefined,
      example_texts: updated.example_texts ? JSON.parse(updated.example_texts as string) : undefined,
      custom_metadata: updated.custom_metadata ? JSON.parse(updated.custom_metadata as string) : undefined,
      created_at: updated.created_at as string,
      updated_at: updated.updated_at as string
    };

    return c.json({ style } as StyleResponse, 200);

  } catch (error) {
    console.error('Update style error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * DELETE /personal/styles/:id - Delete a style
 * Requires authentication
 */
personalStylesRoutes.delete('/:id', requireAuth(), async (c) => {
  try {
    const auth = c.get('auth');
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const styleId = c.req.param('id');

    // Delete the style (only if it belongs to the user)
    const result = await c.env.DB.prepare(
      'DELETE FROM personal_styles WHERE id = ? AND user_id = ?'
    ).bind(styleId, auth.userId).run();

    if (result.meta.changes === 0) {
      return c.json({ error: 'Style not found' }, 404);
    }

    return c.json({ success: true }, 200);

  } catch (error) {
    console.error('Delete style error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default personalStylesRoutes;
