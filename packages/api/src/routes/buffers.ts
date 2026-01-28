/**
 * Buffer Routes
 *
 * Operations for versioned buffers within sessions.
 *
 * @module @humanizer/api/routes/buffers
 */

import { Hono } from 'hono';
import type { AuiContextVariables } from '../middleware/aui-context.js';

// ═══════════════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════════════

export const buffersRouter = new Hono<{ Variables: AuiContextVariables }>();

/**
 * GET /sessions/:sessionId/buffers
 * List all buffers in a session
 */
buffersRouter.get('/:sessionId/buffers', (c) => {
  const aui = c.get('aui');
  const sessionId = c.req.param('sessionId');

  const session = aui.getSession(sessionId);
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  const buffers = aui.listBuffers(sessionId);
  return c.json({
    sessionId,
    buffers: buffers.map((buf) => ({
      id: buf.id,
      name: buf.name,
      currentBranch: buf.currentBranch,
      isDirty: buf.isDirty,
      createdAt: buf.createdAt,
      updatedAt: buf.updatedAt,
      contentLength: buf.workingContent?.length ?? 0,
    })),
    count: buffers.length,
  });
});

/**
 * POST /sessions/:sessionId/buffers
 * Create a new buffer
 */
buffersRouter.post('/:sessionId/buffers', async (c) => {
  const aui = c.get('aui');
  const sessionId = c.req.param('sessionId');
  const body = await c.req
    .json<{ name: string; content?: unknown[] }>()
    .catch(() => null);

  const session = aui.getSession(sessionId);
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  const buffer = aui.createBuffer(sessionId, body?.name ?? 'unnamed', body?.content);
  return c.json(
    {
      id: buffer.id,
      name: buffer.name,
      currentBranch: buffer.currentBranch,
      isDirty: buffer.isDirty,
      createdAt: buffer.createdAt,
      updatedAt: buffer.updatedAt,
    },
    201
  );
});

/**
 * GET /sessions/:sessionId/buffers/:name
 * Get a specific buffer
 */
buffersRouter.get('/:sessionId/buffers/:name', (c) => {
  const aui = c.get('aui');
  const sessionId = c.req.param('sessionId');
  const name = c.req.param('name');

  const session = aui.getSession(sessionId);
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  const buffer = aui.getBuffer(sessionId, name);
  if (!buffer) {
    return c.json({ error: 'Buffer not found' }, 404);
  }

  // Convert Map to array for JSON serialization
  const branches: Array<{ name: string; headVersionId: string }> = [];
  for (const [branchName, branch] of buffer.branches) {
    branches.push({
      name: branchName,
      headVersionId: branch.headVersionId,
    });
  }

  return c.json({
    id: buffer.id,
    name: buffer.name,
    currentBranch: buffer.currentBranch,
    workingContent: buffer.workingContent,
    isDirty: buffer.isDirty,
    branches,
    createdAt: buffer.createdAt,
    updatedAt: buffer.updatedAt,
  });
});

/**
 * PUT /sessions/:sessionId/buffers/:name/content
 * Set buffer content
 */
buffersRouter.put('/:sessionId/buffers/:name/content', async (c) => {
  const aui = c.get('aui');
  const sessionId = c.req.param('sessionId');
  const name = c.req.param('name');
  const body = await c.req.json<{ content: unknown[] }>().catch(() => ({ content: [] }));

  const session = aui.getSession(sessionId);
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  const buffer = aui.getBuffer(sessionId, name);
  if (!buffer) {
    return c.json({ error: 'Buffer not found' }, 404);
  }

  aui.setBufferContent(sessionId, name, body.content);
  return c.json({ updated: true });
});

/**
 * POST /sessions/:sessionId/buffers/:name/append
 * Append items to buffer
 */
buffersRouter.post('/:sessionId/buffers/:name/append', async (c) => {
  const aui = c.get('aui');
  const sessionId = c.req.param('sessionId');
  const name = c.req.param('name');
  const body = await c.req.json<{ items: unknown[] }>().catch(() => ({ items: [] }));

  const session = aui.getSession(sessionId);
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  const buffer = aui.getBuffer(sessionId, name);
  if (!buffer) {
    return c.json({ error: 'Buffer not found' }, 404);
  }

  aui.appendToBuffer(sessionId, name, body.items);
  return c.json({ appended: body.items.length });
});

/**
 * POST /sessions/:sessionId/buffers/:name/commit
 * Commit buffer changes
 */
buffersRouter.post('/:sessionId/buffers/:name/commit', async (c) => {
  const aui = c.get('aui');
  const sessionId = c.req.param('sessionId');
  const name = c.req.param('name');
  const body = await c.req.json<{ message: string }>().catch(() => ({ message: 'commit' }));

  const session = aui.getSession(sessionId);
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  const buffer = aui.getBuffer(sessionId, name);
  if (!buffer) {
    return c.json({ error: 'Buffer not found' }, 404);
  }

  const version = await aui.commit(sessionId, name, body.message);
  return c.json({
    id: version.id,
    message: version.message,
    timestamp: version.timestamp,
    parentId: version.parentId,
  });
});

/**
 * GET /sessions/:sessionId/buffers/:name/history
 * Get buffer version history
 */
buffersRouter.get('/:sessionId/buffers/:name/history', (c) => {
  const aui = c.get('aui');
  const sessionId = c.req.param('sessionId');
  const name = c.req.param('name');
  const limit = parseInt(c.req.query('limit') ?? '10', 10);

  const session = aui.getSession(sessionId);
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  const buffer = aui.getBuffer(sessionId, name);
  if (!buffer) {
    return c.json({ error: 'Buffer not found' }, 404);
  }

  const history = aui.getHistory(sessionId, name, limit);
  return c.json({
    bufferName: name,
    history: history.map((v) => ({
      id: v.id,
      message: v.message,
      timestamp: v.timestamp,
      parentId: v.parentId,
      tags: v.tags,
    })),
    count: history.length,
  });
});

/**
 * POST /sessions/:sessionId/buffers/:name/branch
 * Create a new branch
 */
buffersRouter.post('/:sessionId/buffers/:name/branch', async (c) => {
  const aui = c.get('aui');
  const sessionId = c.req.param('sessionId');
  const name = c.req.param('name');
  const body = await c.req.json<{ branchName: string }>().catch(() => ({ branchName: 'branch' }));

  const session = aui.getSession(sessionId);
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  const buffer = aui.getBuffer(sessionId, name);
  if (!buffer) {
    return c.json({ error: 'Buffer not found' }, 404);
  }

  const branch = aui.branch(sessionId, name, body.branchName);
  return c.json(
    {
      name: branch.name,
      headVersionId: branch.headVersionId,
      createdAt: branch.createdAt,
      parentBranch: branch.parentBranch,
    },
    201
  );
});

/**
 * POST /sessions/:sessionId/buffers/:name/switch
 * Switch to a different branch
 */
buffersRouter.post('/:sessionId/buffers/:name/switch', async (c) => {
  const aui = c.get('aui');
  const sessionId = c.req.param('sessionId');
  const name = c.req.param('name');
  const body = await c.req.json<{ branchName: string }>().catch(() => ({ branchName: 'main' }));

  const session = aui.getSession(sessionId);
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  const buffer = aui.getBuffer(sessionId, name);
  if (!buffer) {
    return c.json({ error: 'Buffer not found' }, 404);
  }

  aui.switchBranch(sessionId, name, body.branchName);
  return c.json({ switched: true, branch: body.branchName });
});

/**
 * POST /sessions/:sessionId/buffers/:name/rollback
 * Rollback buffer changes
 */
buffersRouter.post('/:sessionId/buffers/:name/rollback', async (c) => {
  const aui = c.get('aui');
  const sessionId = c.req.param('sessionId');
  const name = c.req.param('name');
  const body = await c.req.json<{ steps?: number }>().catch(() => null);

  const session = aui.getSession(sessionId);
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  const buffer = aui.getBuffer(sessionId, name);
  if (!buffer) {
    return c.json({ error: 'Buffer not found' }, 404);
  }

  const version = aui.rollback(sessionId, name, body?.steps);
  return c.json({
    id: version.id,
    message: version.message,
    timestamp: version.timestamp,
  });
});
