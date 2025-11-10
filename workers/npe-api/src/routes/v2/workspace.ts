/**
 * V2 Workspace API Routes
 *
 * Endpoints for managing user-created attributes.
 * Allows saving, retrieving, updating, and deleting custom attributes.
 */

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import type { Env } from '../../../shared/types';
import { optionalLocalAuth, getAuthContext } from '../../middleware/auth';
import {
  AttributeTypeSchema,
  AttributeDefinitionSchema,
  UserAttribute,
} from '../../domain/attribute-models';

const app = new Hono<{ Bindings: Env }>();

/**
 * POST /v2/workspace/attributes
 * Save a new attribute to the user's workspace
 */
app.post('/attributes', optionalLocalAuth(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const body = await c.req.json();

    // Validate input
    const type = AttributeTypeSchema.parse(body.type);
    const definition = AttributeDefinitionSchema.parse(body.definition);

    const attributeId = uuidv4();
    const now = Date.now();

    // Insert into database
    await c.env.DB.prepare(`
      INSERT INTO user_attributes (
        id, user_id, type, name, description,
        system_prompt, context_prompt, style_prompt,
        examples, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      attributeId,
      auth.userId,
      type,
      definition.name,
      definition.description,
      definition.systemPrompt || null,
      definition.contextPrompt || null,
      definition.stylePrompt || null,
      definition.examples ? JSON.stringify(definition.examples) : null,
      now,
      now
    ).run();

    // Return the created attribute
    const attribute: UserAttribute = {
      id: attributeId,
      userId: auth.userId,
      type,
      name: definition.name,
      description: definition.description,
      systemPrompt: definition.systemPrompt,
      contextPrompt: definition.contextPrompt,
      stylePrompt: definition.stylePrompt,
      examples: definition.examples,
      tags: definition.tags,
      category: definition.category,
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
    };

    return c.json(attribute, 201);
  } catch (error) {
    console.error('[Workspace] Create attribute error:', error);
    return c.json(
      { error: 'Failed to save attribute', details: error.message },
      500
    );
  }
});

/**
 * GET /v2/workspace/attributes
 * List all attributes for the authenticated user
 */
app.get('/attributes', optionalLocalAuth(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const type = c.req.query('type');

    let query = `
      SELECT * FROM user_attributes
      WHERE user_id = ?
    `;
    const params = [auth.userId];

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    query += ' ORDER BY updated_at DESC';

    const results = await c.env.DB.prepare(query)
      .bind(...params)
      .all();

    // Transform results to proper format
    const attributes: UserAttribute[] = results.results.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      name: row.name,
      description: row.description,
      systemPrompt: row.system_prompt,
      contextPrompt: row.context_prompt,
      stylePrompt: row.style_prompt,
      examples: row.examples ? JSON.parse(row.examples) : undefined,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      category: row.category,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      usageCount: row.usage_count || 0,
    }));

    return c.json(attributes);
  } catch (error) {
    console.error('[Workspace] List attributes error:', error);
    return c.json(
      { error: 'Failed to list attributes', details: error.message },
      500
    );
  }
});

/**
 * GET /v2/workspace/attributes/:id
 * Get a single attribute by ID
 */
app.get('/attributes/:id', optionalLocalAuth(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const attributeId = c.req.param('id');

    const result = await c.env.DB.prepare(`
      SELECT * FROM user_attributes
      WHERE id = ? AND user_id = ?
    `).bind(attributeId, auth.userId).first();

    if (!result) {
      return c.json({ error: 'Attribute not found' }, 404);
    }

    const attribute: UserAttribute = {
      id: result.id,
      userId: result.user_id,
      type: result.type,
      name: result.name,
      description: result.description,
      systemPrompt: result.system_prompt,
      contextPrompt: result.context_prompt,
      stylePrompt: result.style_prompt,
      examples: result.examples ? JSON.parse(result.examples) : undefined,
      tags: result.tags ? JSON.parse(result.tags) : undefined,
      category: result.category,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      usageCount: result.usage_count || 0,
    };

    return c.json(attribute);
  } catch (error) {
    console.error('[Workspace] Get attribute error:', error);
    return c.json(
      { error: 'Failed to get attribute', details: error.message },
      500
    );
  }
});

/**
 * PATCH /v2/workspace/attributes/:id
 * Update an existing attribute
 */
app.patch('/attributes/:id', optionalLocalAuth(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const attributeId = c.req.param('id');
    const body = await c.req.json();

    // Check ownership
    const existing = await c.env.DB.prepare(`
      SELECT id FROM user_attributes
      WHERE id = ? AND user_id = ?
    `).bind(attributeId, auth.userId).first();

    if (!existing) {
      return c.json({ error: 'Attribute not found' }, 404);
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name);
    }
    if (body.description !== undefined) {
      updates.push('description = ?');
      values.push(body.description);
    }
    if (body.systemPrompt !== undefined) {
      updates.push('system_prompt = ?');
      values.push(body.systemPrompt);
    }
    if (body.contextPrompt !== undefined) {
      updates.push('context_prompt = ?');
      values.push(body.contextPrompt);
    }
    if (body.stylePrompt !== undefined) {
      updates.push('style_prompt = ?');
      values.push(body.stylePrompt);
    }
    if (body.examples !== undefined) {
      updates.push('examples = ?');
      values.push(JSON.stringify(body.examples));
    }
    if (body.tags !== undefined) {
      updates.push('tags = ?');
      values.push(JSON.stringify(body.tags));
    }
    if (body.category !== undefined) {
      updates.push('category = ?');
      values.push(body.category);
    }

    if (updates.length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }

    updates.push('updated_at = ?');
    values.push(Date.now());

    // Add WHERE clause parameters
    values.push(attributeId);
    values.push(auth.userId);

    await c.env.DB.prepare(`
      UPDATE user_attributes
      SET ${updates.join(', ')}
      WHERE id = ? AND user_id = ?
    `).bind(...values).run();

    // Return updated attribute
    const updated = await c.env.DB.prepare(`
      SELECT * FROM user_attributes
      WHERE id = ? AND user_id = ?
    `).bind(attributeId, auth.userId).first();

    const attribute: UserAttribute = {
      id: updated.id,
      userId: updated.user_id,
      type: updated.type,
      name: updated.name,
      description: updated.description,
      systemPrompt: updated.system_prompt,
      contextPrompt: updated.context_prompt,
      stylePrompt: updated.style_prompt,
      examples: updated.examples ? JSON.parse(updated.examples) : undefined,
      tags: updated.tags ? JSON.parse(updated.tags) : undefined,
      category: updated.category,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
      usageCount: updated.usage_count || 0,
    };

    return c.json(attribute);
  } catch (error) {
    console.error('[Workspace] Update attribute error:', error);
    return c.json(
      { error: 'Failed to update attribute', details: error.message },
      500
    );
  }
});

/**
 * DELETE /v2/workspace/attributes/:id
 * Delete an attribute from the user's workspace
 */
app.delete('/attributes/:id', optionalLocalAuth(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const attributeId = c.req.param('id');

    // Check ownership
    const existing = await c.env.DB.prepare(`
      SELECT id FROM user_attributes
      WHERE id = ? AND user_id = ?
    `).bind(attributeId, auth.userId).first();

    if (!existing) {
      return c.json({ error: 'Attribute not found' }, 404);
    }

    // Delete the attribute
    await c.env.DB.prepare(`
      DELETE FROM user_attributes
      WHERE id = ? AND user_id = ?
    `).bind(attributeId, auth.userId).run();

    return c.json({ success: true, message: 'Attribute deleted' });
  } catch (error) {
    console.error('[Workspace] Delete attribute error:', error);
    return c.json(
      { error: 'Failed to delete attribute', details: error.message },
      500
    );
  }
});

/**
 * POST /v2/workspace/attributes/:id/increment-usage
 * Increment the usage count for an attribute
 */
app.post('/attributes/:id/increment-usage', optionalLocalAuth(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const attributeId = c.req.param('id');

    // Update usage count
    await c.env.DB.prepare(`
      UPDATE user_attributes
      SET usage_count = usage_count + 1,
          updated_at = ?
      WHERE id = ? AND user_id = ?
    `).bind(Date.now(), attributeId, auth.userId).run();

    return c.json({ success: true });
  } catch (error) {
    console.error('[Workspace] Increment usage error:', error);
    return c.json(
      { error: 'Failed to increment usage', details: error.message },
      500
    );
  }
});

/**
 * GET /v2/workspace/dialogues
 * List all dialogue sessions for the authenticated user
 */
app.get('/dialogues', optionalLocalAuth(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const status = c.req.query('status') || 'all';

    let query = `
      SELECT id, type, status, created_at, completed_at,
             json_extract(messages, '$[0].content') as first_message
      FROM attribute_dialogues
      WHERE user_id = ?
    `;
    const params = [auth.userId];

    if (status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT 50';

    const results = await c.env.DB.prepare(query)
      .bind(...params)
      .all();

    const dialogues = results.results.map((row: any) => ({
      id: row.id,
      type: row.type,
      status: row.status,
      firstMessage: row.first_message,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    }));

    return c.json(dialogues);
  } catch (error) {
    console.error('[Workspace] List dialogues error:', error);
    return c.json(
      { error: 'Failed to list dialogues', details: error.message },
      500
    );
  }
});

export default app;