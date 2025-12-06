/**
 * Studio Sessions API Routes
 *
 * Purpose: Cloud-compatible session storage for Narrative Studio
 * Features:
 * - Create, list, get, update, delete sessions
 * - Rename sessions
 * - Scoped to authenticated user
 *
 * Endpoints:
 * - POST /api/sessions - Create session
 * - GET /api/sessions - List user's sessions
 * - GET /api/sessions/:id - Get session by ID
 * - PUT /api/sessions/:id - Update session
 * - DELETE /api/sessions/:id - Delete session
 * - PUT /api/sessions/:id/rename - Rename session
 */

import { Hono } from 'hono';
import { optionalLocalAuth, getAuthContext } from '../middleware/auth';

// Session interface matching frontend sessionStorage.ts
interface SessionBuffer {
  bufferId: string;
  type: 'original' | 'transformation' | 'analysis' | 'edited';
  displayName: string;
  sourceBufferId?: string;
  sourceRef?: string;
  sourceSelection?: { start: number; end: number };
  tool?: string;
  settings?: Record<string, unknown>;
  text?: string;
  resultText?: string;
  analysisResult?: unknown;
  metadata?: Record<string, unknown>;
  userEdits?: unknown[];
  isEdited: boolean;
  created: string;
}

interface Session {
  sessionId: string;
  name: string;
  created: string;
  updated: string;
  sourceArchive: string;
  sourceMessageId?: string;
  buffers: SessionBuffer[];
  activeBufferId: string;
  viewMode: 'split' | 'single-original' | 'single-transformed';
}

export const sessionsRoutes = new Hono();

// Apply auth middleware - sessions require authentication
sessionsRoutes.use('/*', optionalLocalAuth());

/**
 * POST /api/sessions
 * Create new session
 */
sessionsRoutes.post('/', async (c) => {
  const auth = getAuthContext(c);
  const userId = auth.userId;

  try {
    const session: Session = await c.req.json();

    // Validate required fields
    if (!session.sessionId || !session.name) {
      return c.json({ error: 'sessionId and name are required' }, 400);
    }

    const now = new Date().toISOString();

    await c.env.DB.prepare(`
      INSERT INTO studio_sessions (
        id, user_id, name, source_archive, source_message_id,
        view_mode, active_buffer_id, buffers, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      session.sessionId,
      userId,
      session.name,
      session.sourceArchive || 'main',
      session.sourceMessageId || null,
      session.viewMode || 'single-original',
      session.activeBufferId || null,
      JSON.stringify(session.buffers || []),
      session.created || now,
      session.updated || now
    ).run();

    return c.json({ success: true, sessionId: session.sessionId }, 201);
  } catch (error) {
    console.error('Error creating session:', error);

    // Check for duplicate key error
    if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
      return c.json({ error: 'Session already exists' }, 409);
    }

    return c.json({
      error: 'Failed to create session',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

/**
 * GET /api/sessions
 * List user's sessions (sorted by updated_at DESC)
 */
sessionsRoutes.get('/', async (c) => {
  const auth = getAuthContext(c);
  const userId = auth.userId;

  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
    const offset = parseInt(c.req.query('offset') || '0');

    const result = await c.env.DB.prepare(`
      SELECT id, name, source_archive, source_message_id,
             view_mode, active_buffer_id, buffers,
             created_at, updated_at
      FROM studio_sessions
      WHERE user_id = ?
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all();

    // Transform to frontend Session format
    const sessions: Session[] = result.results.map((row: any) => ({
      sessionId: row.id,
      name: row.name,
      sourceArchive: row.source_archive,
      sourceMessageId: row.source_message_id,
      viewMode: row.view_mode,
      activeBufferId: row.active_buffer_id,
      buffers: JSON.parse(row.buffers || '[]'),
      created: row.created_at,
      updated: row.updated_at
    }));

    return c.json(sessions, 200);
  } catch (error) {
    console.error('Error listing sessions:', error);
    return c.json({ error: 'Failed to list sessions' }, 500);
  }
});

/**
 * GET /api/sessions/:id
 * Get session by ID
 */
sessionsRoutes.get('/:id', async (c) => {
  const auth = getAuthContext(c);
  const userId = auth.userId;
  const sessionId = c.req.param('id');

  try {
    const row: any = await c.env.DB.prepare(`
      SELECT id, name, source_archive, source_message_id,
             view_mode, active_buffer_id, buffers,
             created_at, updated_at
      FROM studio_sessions
      WHERE id = ? AND user_id = ?
    `).bind(sessionId, userId).first();

    if (!row) {
      return c.json({ error: 'Session not found' }, 404);
    }

    // Parse buffers JSON
    let buffers: SessionBuffer[] = [];
    try {
      buffers = JSON.parse(row.buffers || '[]');
    } catch (parseError) {
      console.error('Error parsing session buffers:', parseError);
      return c.json({ error: 'Session file is corrupted' }, 422);
    }

    const session: Session = {
      sessionId: row.id,
      name: row.name,
      sourceArchive: row.source_archive,
      sourceMessageId: row.source_message_id,
      viewMode: row.view_mode,
      activeBufferId: row.active_buffer_id,
      buffers,
      created: row.created_at,
      updated: row.updated_at
    };

    return c.json(session, 200);
  } catch (error) {
    console.error('Error getting session:', error);
    return c.json({ error: 'Failed to get session' }, 500);
  }
});

/**
 * PUT /api/sessions/:id
 * Update session
 */
sessionsRoutes.put('/:id', async (c) => {
  const auth = getAuthContext(c);
  const userId = auth.userId;
  const sessionId = c.req.param('id');

  try {
    const session: Session = await c.req.json();
    const now = new Date().toISOString();

    // Verify session exists and belongs to user
    const existing = await c.env.DB.prepare(`
      SELECT id FROM studio_sessions WHERE id = ? AND user_id = ?
    `).bind(sessionId, userId).first();

    if (!existing) {
      return c.json({ error: 'Session not found' }, 404);
    }

    await c.env.DB.prepare(`
      UPDATE studio_sessions SET
        name = ?,
        source_archive = ?,
        source_message_id = ?,
        view_mode = ?,
        active_buffer_id = ?,
        buffers = ?,
        updated_at = ?
      WHERE id = ? AND user_id = ?
    `).bind(
      session.name,
      session.sourceArchive || 'main',
      session.sourceMessageId || null,
      session.viewMode || 'single-original',
      session.activeBufferId || null,
      JSON.stringify(session.buffers || []),
      now,
      sessionId,
      userId
    ).run();

    return c.json({ success: true }, 200);
  } catch (error) {
    console.error('Error updating session:', error);
    return c.json({ error: 'Failed to update session' }, 500);
  }
});

/**
 * DELETE /api/sessions/:id
 * Delete session
 */
sessionsRoutes.delete('/:id', async (c) => {
  const auth = getAuthContext(c);
  const userId = auth.userId;
  const sessionId = c.req.param('id');

  try {
    const result = await c.env.DB.prepare(`
      DELETE FROM studio_sessions WHERE id = ? AND user_id = ?
    `).bind(sessionId, userId).run();

    if (result.meta.changes === 0) {
      return c.json({ error: 'Session not found' }, 404);
    }

    return c.json({ success: true }, 200);
  } catch (error) {
    console.error('Error deleting session:', error);
    return c.json({ error: 'Failed to delete session' }, 500);
  }
});

/**
 * PUT /api/sessions/:id/rename
 * Rename session
 */
sessionsRoutes.put('/:id/rename', async (c) => {
  const auth = getAuthContext(c);
  const userId = auth.userId;
  const sessionId = c.req.param('id');

  try {
    const { name } = await c.req.json();

    if (!name || typeof name !== 'string') {
      return c.json({ error: 'name is required' }, 400);
    }

    const now = new Date().toISOString();

    // Update and return the session
    const existing: any = await c.env.DB.prepare(`
      SELECT id, name, source_archive, source_message_id,
             view_mode, active_buffer_id, buffers,
             created_at, updated_at
      FROM studio_sessions
      WHERE id = ? AND user_id = ?
    `).bind(sessionId, userId).first();

    if (!existing) {
      return c.json({ error: 'Session not found' }, 404);
    }

    await c.env.DB.prepare(`
      UPDATE studio_sessions SET name = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).bind(name, now, sessionId, userId).run();

    const session: Session = {
      sessionId: existing.id,
      name: name,
      sourceArchive: existing.source_archive,
      sourceMessageId: existing.source_message_id,
      viewMode: existing.view_mode,
      activeBufferId: existing.active_buffer_id,
      buffers: JSON.parse(existing.buffers || '[]'),
      created: existing.created_at,
      updated: now
    };

    return c.json({ success: true, session }, 200);
  } catch (error) {
    console.error('Error renaming session:', error);
    return c.json({ error: 'Failed to rename session' }, 500);
  }
});
