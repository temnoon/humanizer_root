/**
 * Session Routes
 *
 * CRUD operations for AUI sessions.
 *
 * @module @humanizer/api/routes/sessions
 */

import { Hono } from 'hono';
import type { AuiContextVariables } from '../middleware/aui-context.js';

// ═══════════════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════════════

export const sessionsRouter = new Hono<{ Variables: AuiContextVariables }>();

/**
 * GET /sessions
 * List all sessions
 */
sessionsRouter.get('/', (c) => {
  const aui = c.get('aui');
  const sessions = aui.listSessions();
  return c.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      name: s.name,
      userId: s.userId,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      bufferCount: s.buffers.size,
    })),
    count: sessions.length,
  });
});

/**
 * POST /sessions
 * Create a new session
 */
sessionsRouter.post('/', async (c) => {
  const aui = c.get('aui');
  const body = await c.req.json<{ userId?: string; name?: string }>().catch(() => null);

  const session = await aui.createSession({
    userId: body?.userId,
    name: body?.name,
  });

  return c.json(
    {
      id: session.id,
      name: session.name,
      userId: session.userId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    },
    201
  );
});

/**
 * GET /sessions/:id
 * Get a specific session
 */
sessionsRouter.get('/:id', async (c) => {
  const aui = c.get('aui');
  const id = c.req.param('id');

  const session = await aui.getSessionAsync(id);
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  const buffers: Array<{ name: string; branch: string; isDirty: boolean }> = [];
  for (const [name, buf] of session.buffers) {
    buffers.push({
      name,
      branch: buf.currentBranch,
      isDirty: buf.isDirty,
    });
  }

  return c.json({
    id: session.id,
    name: session.name,
    userId: session.userId,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    buffers,
    activeBufferName: session.activeBufferName,
    searchSessionId: session.searchSessionId,
  });
});

/**
 * DELETE /sessions/:id
 * Delete a session
 */
sessionsRouter.delete('/:id', (c) => {
  const aui = c.get('aui');
  const id = c.req.param('id');

  const deleted = aui.deleteSession(id);
  if (!deleted) {
    return c.json({ error: 'Session not found' }, 404);
  }

  return c.json({ deleted: true }, 200);
});
