// Personal personas routes for NPE Workers API
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { discoverVoices } from '../services/voice-discovery';
import type {
  Env,
  PersonalPersona,
  CreatePersonaRequest,
  PersonaResponse,
  DiscoverVoicesRequest,
  DiscoverVoicesResponse
} from '../../shared/types';

const personalPersonasRoutes = new Hono<{ Bindings: Env }>();

/**
 * GET /personal/personas - List user's personas (discovered + custom)
 * Requires authentication
 */
personalPersonasRoutes.get('/', requireAuth(), async (c) => {
  try {
    const auth = c.get('auth');
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get all personas for this user, ordered by auto-discovered first, then creation date
    const result = await c.env.DB.prepare(`
      SELECT
        id, user_id, name, description, auto_discovered,
        embedding_signature, example_texts, custom_metadata,
        created_at, updated_at
      FROM personal_personas
      WHERE user_id = ?
      ORDER BY auto_discovered DESC, created_at DESC
    `).bind(auth.userId).all();

    const personas: PersonalPersona[] = result.results.map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      description: row.description || undefined,
      auto_discovered: Boolean(row.auto_discovered),
      embedding_signature: row.embedding_signature ? JSON.parse(row.embedding_signature) : undefined,
      example_texts: row.example_texts ? JSON.parse(row.example_texts) : undefined,
      custom_metadata: row.custom_metadata ? JSON.parse(row.custom_metadata) : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    return c.json({
      personas,
      total: personas.length,
      discovered: personas.filter(p => p.auto_discovered).length,
      custom: personas.filter(p => !p.auto_discovered).length
    }, 200);

  } catch (error) {
    console.error('List personas error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /personal/personas/:id - Get a specific persona
 * Requires authentication
 */
personalPersonasRoutes.get('/:id', requireAuth(), async (c) => {
  try {
    const auth = c.get('auth');
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const personaId = c.req.param('id');

    const result = await c.env.DB.prepare(
      'SELECT * FROM personal_personas WHERE id = ? AND user_id = ?'
    ).bind(personaId, auth.userId).first();

    if (!result) {
      return c.json({ error: 'Persona not found' }, 404);
    }

    const persona: PersonalPersona = {
      id: result.id as number,
      user_id: result.user_id as number,
      name: result.name as string,
      description: result.description as string | undefined,
      auto_discovered: Boolean(result.auto_discovered),
      embedding_signature: result.embedding_signature ? JSON.parse(result.embedding_signature as string) : undefined,
      example_texts: result.example_texts ? JSON.parse(result.example_texts as string) : undefined,
      custom_metadata: result.custom_metadata ? JSON.parse(result.custom_metadata as string) : undefined,
      created_at: result.created_at as string,
      updated_at: result.updated_at as string
    };

    return c.json({ persona } as PersonaResponse, 200);

  } catch (error) {
    console.error('Get persona error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /personal/personas - Create a custom persona
 * Requires authentication
 */
personalPersonasRoutes.post('/', requireAuth(), async (c) => {
  try {
    const auth = c.get('auth');
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { name, description, example_texts, metadata }: CreatePersonaRequest = await c.req.json();

    // Validate input
    if (!name || name.trim().length === 0) {
      return c.json({ error: 'Persona name is required' }, 400);
    }

    // Check for duplicate name
    const existing = await c.env.DB.prepare(
      'SELECT id FROM personal_personas WHERE user_id = ? AND name = ?'
    ).bind(auth.userId, name.trim()).first();

    if (existing) {
      return c.json({ error: 'A persona with this name already exists' }, 409);
    }

    // Insert persona (auto_discovered = 0 for custom personas)
    const result = await c.env.DB.prepare(`
      INSERT INTO personal_personas
      (user_id, name, description, auto_discovered, example_texts, custom_metadata)
      VALUES (?, ?, ?, 0, ?, ?)
    `).bind(
      auth.userId,
      name.trim(),
      description || null,
      example_texts ? JSON.stringify(example_texts) : null,
      metadata ? JSON.stringify(metadata) : null
    ).run();

    // Fetch the created persona
    const created = await c.env.DB.prepare(
      'SELECT * FROM personal_personas WHERE id = ?'
    ).bind(result.meta.last_row_id).first();

    if (!created) {
      return c.json({ error: 'Failed to retrieve created persona' }, 500);
    }

    const persona: PersonalPersona = {
      id: created.id as number,
      user_id: created.user_id as number,
      name: created.name as string,
      description: created.description as string | undefined,
      auto_discovered: Boolean(created.auto_discovered),
      embedding_signature: created.embedding_signature ? JSON.parse(created.embedding_signature as string) : undefined,
      example_texts: created.example_texts ? JSON.parse(created.example_texts as string) : undefined,
      custom_metadata: created.custom_metadata ? JSON.parse(created.custom_metadata as string) : undefined,
      created_at: created.created_at as string,
      updated_at: created.updated_at as string
    };

    return c.json({ persona } as PersonaResponse, 201);

  } catch (error) {
    console.error('Create persona error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * PUT /personal/personas/:id - Update a persona
 * Requires authentication
 * Note: Can only update name, description, and metadata. Embeddings/examples are preserved.
 */
personalPersonasRoutes.put('/:id', requireAuth(), async (c) => {
  try {
    const auth = c.get('auth');
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const personaId = c.req.param('id');
    const { name, description, metadata } = await c.req.json();

    // Verify ownership
    const existing = await c.env.DB.prepare(
      'SELECT id, name FROM personal_personas WHERE id = ? AND user_id = ?'
    ).bind(personaId, auth.userId).first();

    if (!existing) {
      return c.json({ error: 'Persona not found' }, 404);
    }

    // Check for duplicate name if name is being changed
    if (name && name.trim() !== existing.name) {
      const duplicate = await c.env.DB.prepare(
        'SELECT id FROM personal_personas WHERE user_id = ? AND name = ? AND id != ?'
      ).bind(auth.userId, name.trim(), personaId).first();

      if (duplicate) {
        return c.json({ error: 'A persona with this name already exists' }, 409);
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

    values.push(personaId, auth.userId);

    await c.env.DB.prepare(`
      UPDATE personal_personas
      SET ${updates.join(', ')}
      WHERE id = ? AND user_id = ?
    `).bind(...values).run();

    // Fetch updated persona
    const updated = await c.env.DB.prepare(
      'SELECT * FROM personal_personas WHERE id = ?'
    ).bind(personaId).first();

    if (!updated) {
      return c.json({ error: 'Failed to retrieve updated persona' }, 500);
    }

    const persona: PersonalPersona = {
      id: updated.id as number,
      user_id: updated.user_id as number,
      name: updated.name as string,
      description: updated.description as string | undefined,
      auto_discovered: Boolean(updated.auto_discovered),
      embedding_signature: updated.embedding_signature ? JSON.parse(updated.embedding_signature as string) : undefined,
      example_texts: updated.example_texts ? JSON.parse(updated.example_texts as string) : undefined,
      custom_metadata: updated.custom_metadata ? JSON.parse(updated.custom_metadata as string) : undefined,
      created_at: updated.created_at as string,
      updated_at: updated.updated_at as string
    };

    return c.json({ persona } as PersonaResponse, 200);

  } catch (error) {
    console.error('Update persona error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * DELETE /personal/personas/:id - Delete a persona
 * Requires authentication
 */
personalPersonasRoutes.delete('/:id', requireAuth(), async (c) => {
  try {
    const auth = c.get('auth');
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const personaId = c.req.param('id');

    // Delete the persona (only if it belongs to the user)
    const result = await c.env.DB.prepare(
      'DELETE FROM personal_personas WHERE id = ? AND user_id = ?'
    ).bind(personaId, auth.userId).run();

    if (result.meta.changes === 0) {
      return c.json({ error: 'Persona not found' }, 404);
    }

    return c.json({ success: true }, 200);

  } catch (error) {
    console.error('Delete persona error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /personal/personas/discover-voices - Discover voices from writing samples
 * Requires authentication
 * Analyzes user's writing samples using clustering and creates auto-discovered personas/styles
 */
personalPersonasRoutes.post('/discover-voices', requireAuth(), async (c) => {
  try {
    const auth = c.get('auth');
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const { min_clusters, max_clusters }: DiscoverVoicesRequest = body;

    // Run voice discovery
    const result = await discoverVoices(
      c.env,
      auth.userId,
      min_clusters || 3,
      max_clusters || 7
    );

    // Fetch the discovered personas
    const personasResult = await c.env.DB.prepare(
      'SELECT * FROM personal_personas WHERE user_id = ? AND auto_discovered = 1 ORDER BY created_at DESC'
    ).bind(auth.userId).all();

    const personas: PersonalPersona[] = personasResult.results.map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      description: row.description || undefined,
      auto_discovered: Boolean(row.auto_discovered),
      embedding_signature: row.embedding_signature ? JSON.parse(row.embedding_signature) : undefined,
      example_texts: row.example_texts ? JSON.parse(row.example_texts) : undefined,
      custom_metadata: row.custom_metadata ? JSON.parse(row.custom_metadata) : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    // Fetch the discovered styles
    const stylesResult = await c.env.DB.prepare(
      'SELECT * FROM personal_styles WHERE user_id = ? AND auto_discovered = 1 ORDER BY created_at DESC'
    ).bind(auth.userId).all();

    const styles = stylesResult.results.map((row: any) => ({
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

    const response: DiscoverVoicesResponse = {
      personas_discovered: result.personasDiscovered,
      styles_discovered: result.stylesDiscovered,
      personas,
      styles,
      total_words_analyzed: result.totalWordsAnalyzed
    };

    return c.json(response, 200);

  } catch (error) {
    console.error('Discover voices error:', error);

    // Handle specific error messages
    if (error instanceof Error) {
      if (error.message.includes('No writing samples found')) {
        return c.json({ error: 'No writing samples found. Please upload samples first.' }, 400);
      }
      if (error.message.includes('Insufficient content')) {
        return c.json({ error: error.message }, 400);
      }
    }

    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default personalPersonasRoutes;
