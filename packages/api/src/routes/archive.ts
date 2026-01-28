/**
 * Archive Routes
 *
 * Browse and query the UCG (Universal Content Graph) archive.
 * All content types (chatgpt, facebook, reddit, substack, etc.) are
 * stored uniformly and accessible through these endpoints.
 *
 * @module @humanizer/api/routes/archive
 */

import { Hono } from 'hono';
import { auiMiddleware, type AuiContextVariables } from '../middleware/aui-context.js';

// ═══════════════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════════════

export const archiveRouter = new Hono<{ Variables: AuiContextVariables }>();

// Apply AUI middleware to all archive routes
archiveRouter.use('*', auiMiddleware);

/**
 * GET /archive/browse
 * Browse UCG nodes with filtering and pagination
 */
archiveRouter.get('/browse', async (c) => {
  const aui = c.get('aui');
  const archiveStore = aui.getArchiveStore();

  if (!archiveStore) {
    return c.json({ error: 'Archive store not available' }, 503);
  }

  // Parse query parameters
  const sourceType = c.req.query('sourceType');
  const threadRootId = c.req.query('threadRootId');
  const parentNodeId = c.req.query('parentNodeId');
  const hierarchyLevel = c.req.query('hierarchyLevel');
  const authorRole = c.req.query('authorRole') as 'user' | 'assistant' | 'system' | undefined;
  const limit = parseInt(c.req.query('limit') ?? '50', 10);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);
  const orderBy = (c.req.query('orderBy') ?? 'sourceCreatedAt') as 'createdAt' | 'sourceCreatedAt' | 'importedAt' | 'wordCount';
  const orderDir = (c.req.query('orderDir') ?? 'desc') as 'asc' | 'desc';

  try {
    const result = await archiveStore.queryNodes({
      sourceType: sourceType ? sourceType.split(',') : undefined,
      threadRootId: threadRootId || undefined,
      parentNodeId: parentNodeId || undefined,
      hierarchyLevel: hierarchyLevel ? parseInt(hierarchyLevel, 10) : undefined,
      authorRole: authorRole || undefined,
      limit: Math.min(limit, 200), // Cap at 200
      offset,
      orderBy,
      orderDir,
    });

    return c.json({
      nodes: result.nodes.map((node) => ({
        id: node.id,
        uri: node.uri,
        text: node.text.substring(0, 500) + (node.text.length > 500 ? '...' : ''),
        fullText: node.text,
        title: node.title,
        sourceType: node.sourceType,
        sourceAdapter: node.sourceAdapter,
        author: node.author,
        authorRole: node.authorRole,
        parentNodeId: node.parentNodeId,
        threadRootId: node.threadRootId,
        hierarchyLevel: node.hierarchyLevel,
        wordCount: node.wordCount,
        tags: node.tags,
        mediaRefs: node.mediaRefs,
        sourceCreatedAt: node.sourceCreatedAt,
        createdAt: node.createdAt,
      })),
      total: result.total,
      hasMore: result.hasMore,
      limit,
      offset,
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Browse failed' },
      500
    );
  }
});

/**
 * GET /archive/sources
 * List available source types with counts
 */
archiveRouter.get('/sources', async (c) => {
  const aui = c.get('aui');
  const archiveStore = aui.getArchiveStore();

  if (!archiveStore) {
    return c.json({ error: 'Archive store not available' }, 503);
  }

  try {
    const stats = await archiveStore.getStats();

    return c.json({
      sources: Object.entries(stats.nodesBySourceType).map(([type, count]) => ({
        sourceType: type,
        count,
      })),
      total: stats.totalNodes,
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to get sources' },
      500
    );
  }
});

/**
 * GET /archive/threads
 * List thread roots (conversations/posts) for a source type
 */
archiveRouter.get('/threads', async (c) => {
  const aui = c.get('aui');
  const archiveStore = aui.getArchiveStore();

  if (!archiveStore) {
    return c.json({ error: 'Archive store not available' }, 503);
  }

  const sourceType = c.req.query('sourceType');
  const limit = parseInt(c.req.query('limit') ?? '50', 10);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);

  try {
    // Get thread root nodes (hierarchyLevel 0, no parent)
    const result = await archiveStore.queryNodes({
      sourceType: sourceType ? sourceType.split(',') : undefined,
      hierarchyLevel: 0,
      limit: Math.min(limit, 200),
      offset,
      orderBy: 'sourceCreatedAt',
      orderDir: 'desc',
    });

    // Filter to only include nodes that are thread roots
    const threads = result.nodes.filter(
      (node) => !node.parentNodeId || node.id === node.threadRootId
    );

    return c.json({
      threads: threads.map((node) => ({
        id: node.id,
        title: node.title || node.text.substring(0, 100) + (node.text.length > 100 ? '...' : ''),
        sourceType: node.sourceType,
        author: node.author,
        wordCount: node.wordCount,
        sourceCreatedAt: node.sourceCreatedAt,
        createdAt: node.createdAt,
      })),
      total: result.total,
      hasMore: result.hasMore,
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to get threads' },
      500
    );
  }
});

/**
 * GET /archive/thread/:threadId
 * Get all nodes in a thread (conversation/post with replies)
 */
archiveRouter.get('/thread/:threadId', async (c) => {
  const aui = c.get('aui');
  const archiveStore = aui.getArchiveStore();

  if (!archiveStore) {
    return c.json({ error: 'Archive store not available' }, 503);
  }

  const threadId = c.req.param('threadId');

  try {
    const result = await archiveStore.queryNodes({
      threadRootId: threadId,
      orderBy: 'sourceCreatedAt',
      orderDir: 'asc',
      limit: 500, // Get all messages in thread
    });

    return c.json({
      threadId,
      nodes: result.nodes.map((node) => ({
        id: node.id,
        text: node.text,
        title: node.title,
        sourceType: node.sourceType,
        author: node.author,
        authorRole: node.authorRole,
        parentNodeId: node.parentNodeId,
        hierarchyLevel: node.hierarchyLevel,
        position: node.position,
        wordCount: node.wordCount,
        mediaRefs: node.mediaRefs,
        sourceCreatedAt: node.sourceCreatedAt,
      })),
      count: result.nodes.length,
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to get thread' },
      500
    );
  }
});

/**
 * GET /archive/node/:nodeId
 * Get a single node by ID with full details
 */
archiveRouter.get('/node/:nodeId', async (c) => {
  const aui = c.get('aui');
  const archiveStore = aui.getArchiveStore();

  if (!archiveStore) {
    return c.json({ error: 'Archive store not available' }, 503);
  }

  const nodeId = c.req.param('nodeId');

  try {
    const node = await archiveStore.getNode(nodeId);

    if (!node) {
      return c.json({ error: 'Node not found' }, 404);
    }

    return c.json({ node });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to get node' },
      500
    );
  }
});

/**
 * GET /archive/stats
 * Get archive statistics
 */
archiveRouter.get('/stats', async (c) => {
  const aui = c.get('aui');
  const archiveStore = aui.getArchiveStore();

  if (!archiveStore) {
    return c.json({ error: 'Archive store not available' }, 503);
  }

  try {
    const stats = await archiveStore.getStats();

    return c.json({
      totalNodes: stats.totalNodes,
      nodesBySourceType: stats.nodesBySourceType,
      nodesByAdapter: stats.nodesByAdapter,
      nodesWithEmbeddings: stats.nodesWithEmbeddings,
      totalLinks: stats.totalLinks,
      totalJobs: stats.totalJobs,
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to get stats' },
      500
    );
  }
});
