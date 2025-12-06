/**
 * Node Admin Routes
 *
 * Administrative endpoints for managing nodes:
 * - Rebuild node pyramids (chunks, summaries, apex, embeddings)
 * - Check node health (missing data, corruption)
 * - View pyramid stats
 * - Test curator prompts
 * - Batch operations
 *
 * All endpoints require admin authentication.
 */

import { Hono } from 'hono';
import { requireAuth, getAuthContext } from '../middleware/auth';
import {
  rebuildNode,
  getRebuildStatus,
  clearRebuildStatus,
  analyzeNodeHealth,
  generateCuratorPrompt,
  testCuratorPrompt,
  type RebuildConfig,
  type NodeHealthCheck,
} from '../services/node-rebuilder';
import { getPyramidStats, getApexByNode } from '../services/curator-pyramid';

const nodeAdminRoutes = new Hono();

// ==========================================
// Middleware: Admin Only
// ==========================================

const requireAdmin = () => {
  return async (c: any, next: any) => {
    const auth = getAuthContext(c);
    if (auth.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, 403);
    }
    await next();
  };
};

// ==========================================
// Health Check
// ==========================================

/**
 * GET /api/admin/node/:nodeId/health
 * Analyze node health and get recommendations
 */
nodeAdminRoutes.get('/:nodeId/health', requireAuth(), requireAdmin(), async (c) => {
  const nodeId = c.req.param('nodeId');

  try {
    const health = await analyzeNodeHealth(c.env.DB, nodeId);
    return c.json(health);
  } catch (error) {
    console.error('[NODE-ADMIN] Health check error:', error);
    return c.json({
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/admin/nodes/health
 * Get health status for all nodes
 */
nodeAdminRoutes.get('/health', requireAuth(), requireAdmin(), async (c) => {
  try {
    // Get all active nodes
    const { results: nodes } = await c.env.DB.prepare(
      `SELECT id, name FROM nodes WHERE status = 'active' ORDER BY name`
    ).all();

    if (!nodes || nodes.length === 0) {
      return c.json({ nodes: [] });
    }

    // Check health for each node
    const healthChecks: NodeHealthCheck[] = [];

    for (const node of nodes as Array<{ id: string; name: string }>) {
      try {
        const health = await analyzeNodeHealth(c.env.DB, node.id);
        healthChecks.push(health);
      } catch (error) {
        // Skip nodes that error out
        console.error(`[NODE-ADMIN] Health check failed for ${node.id}:`, error);
      }
    }

    // Separate healthy vs unhealthy
    const healthy = healthChecks.filter(h => h.issues.length === 0);
    const unhealthy = healthChecks.filter(h => h.issues.length > 0);

    return c.json({
      total: healthChecks.length,
      healthy: healthy.length,
      unhealthy: unhealthy.length,
      nodes: healthChecks,
    });

  } catch (error) {
    console.error('[NODE-ADMIN] Batch health check error:', error);
    return c.json({
      error: 'Batch health check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// ==========================================
// Pyramid Stats
// ==========================================

/**
 * GET /api/admin/node/:nodeId/pyramid
 * Get detailed pyramid statistics
 */
nodeAdminRoutes.get('/:nodeId/pyramid', requireAuth(), requireAdmin(), async (c) => {
  const nodeId = c.req.param('nodeId');

  try {
    const stats = await getPyramidStats(c.env.DB, nodeId);
    const apex = await getApexByNode(c.env.DB, nodeId);

    return c.json({
      nodeId,
      stats,
      apex: apex ? {
        narrativeArc: apex.narrativeArc.substring(0, 200) + '...',
        coreThemes: apex.coreThemes,
        theQuestion: apex.theQuestion,
        resonanceHooks: apex.resonanceHooks,
        lifecycleState: apex.lifecycleState,
        sourceTitle: apex.sourceTitle,
        sourceAuthor: apex.sourceAuthor,
      } : null,
    });

  } catch (error) {
    console.error('[NODE-ADMIN] Pyramid stats error:', error);
    return c.json({
      error: 'Failed to get pyramid stats',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// ==========================================
// Curator Prompt
// ==========================================

/**
 * GET /api/admin/node/:nodeId/curator-prompt
 * Generate and view curator system prompt
 */
nodeAdminRoutes.get('/:nodeId/curator-prompt', requireAuth(), requireAdmin(), async (c) => {
  const nodeId = c.req.param('nodeId');

  try {
    const result = await testCuratorPrompt(c.env.DB, nodeId);

    if (!result.success) {
      return c.json({
        error: result.error,
      }, 400);
    }

    return c.json({
      nodeId,
      prompt: result.prompt,
      characterCount: result.prompt!.length,
      wordCount: result.prompt!.split(/\s+/).length,
    });

  } catch (error) {
    console.error('[NODE-ADMIN] Curator prompt error:', error);
    return c.json({
      error: 'Failed to generate curator prompt',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// ==========================================
// Rebuild Operations
// ==========================================

/**
 * POST /api/admin/node/:nodeId/rebuild
 * Rebuild node pyramid from source
 *
 * Body:
 * {
 *   "sourceType": "gutenberg" | "raw_text",
 *   "sourceId": "2701",  // For Gutenberg books
 *   "rawText": "...",    // For raw text
 *   "rebuildOptions": {
 *     "deleteExisting": true,
 *     "rebuildChunks": true,
 *     "rebuildSummaries": true,
 *     "rebuildApex": true,
 *     "rebuildEmbeddings": true
 *   },
 *   "pyramidConfig": {
 *     "branchingFactor": 4,
 *     "summaryTargetWords": 250,
 *     "apexTargetWords": 500
 *   }
 * }
 */
nodeAdminRoutes.post('/:nodeId/rebuild', requireAuth(), requireAdmin(), async (c) => {
  const auth = getAuthContext(c);
  const nodeId = c.req.param('nodeId');

  try {
    // Verify node exists
    const node = await c.env.DB.prepare(
      `SELECT id, name, creator_user_id FROM nodes WHERE id = ?`
    ).bind(nodeId).first<Record<string, unknown>>();

    if (!node) {
      return c.json({ error: 'Node not found' }, 404);
    }

    // Parse config
    const body = await c.req.json();
    const config: RebuildConfig = {
      sourceType: body.sourceType || 'gutenberg',
      sourceId: body.sourceId,
      rawText: body.rawText,
      rebuildOptions: {
        deleteExisting: body.rebuildOptions?.deleteExisting ?? true,
        rebuildChunks: body.rebuildOptions?.rebuildChunks ?? true,
        rebuildSummaries: body.rebuildOptions?.rebuildSummaries ?? true,
        rebuildApex: body.rebuildOptions?.rebuildApex ?? true,
        rebuildEmbeddings: body.rebuildOptions?.rebuildEmbeddings ?? true,
      },
      pyramidConfig: body.pyramidConfig || {},
    };

    // Validate config
    if (config.sourceType === 'gutenberg' && !config.sourceId) {
      return c.json({ error: 'Gutenberg ID required for gutenberg source type' }, 400);
    }

    if (config.sourceType === 'raw_text' && !config.rawText) {
      return c.json({ error: 'Raw text required for raw_text source type' }, 400);
    }

    // Check if already rebuilding
    const status = getRebuildStatus(nodeId);
    if (status && status.status === 'running') {
      return c.json({
        error: 'Rebuild already in progress',
        status,
      }, 409);
    }

    // Start rebuild (async)
    // Note: For production, consider using Durable Objects or queue
    rebuildNode(
      c.env.AI,
      c.env.DB,
      c.env.NODE_CHUNKS,  // Vectorize index
      nodeId,
      config
    ).catch(error => {
      console.error('[NODE-ADMIN] Rebuild error:', error);
    });

    return c.json({
      message: 'Rebuild started',
      nodeId,
      nodeName: node.name,
      config,
    }, 202);

  } catch (error) {
    console.error('[NODE-ADMIN] Rebuild initiation error:', error);
    return c.json({
      error: 'Failed to start rebuild',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/admin/node/:nodeId/rebuild-status
 * Check rebuild status
 */
nodeAdminRoutes.get('/:nodeId/rebuild-status', requireAuth(), requireAdmin(), async (c) => {
  const nodeId = c.req.param('nodeId');

  try {
    const status = getRebuildStatus(nodeId);

    if (!status) {
      return c.json({
        nodeId,
        status: 'idle',
        message: 'No rebuild in progress or completed recently',
      });
    }

    return c.json(status);

  } catch (error) {
    console.error('[NODE-ADMIN] Rebuild status error:', error);
    return c.json({
      error: 'Failed to get rebuild status',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * DELETE /api/admin/node/:nodeId/rebuild-status
 * Clear rebuild status (after viewing results)
 */
nodeAdminRoutes.delete('/:nodeId/rebuild-status', requireAuth(), requireAdmin(), async (c) => {
  const nodeId = c.req.param('nodeId');

  clearRebuildStatus(nodeId);

  return c.json({
    message: 'Rebuild status cleared',
    nodeId,
  });
});

// ==========================================
// Quick Fixes
// ==========================================

/**
 * POST /api/admin/node/:nodeId/rebuild-apex
 * Quick fix: Rebuild only apex summary
 */
nodeAdminRoutes.post('/:nodeId/rebuild-apex', requireAuth(), requireAdmin(), async (c) => {
  const nodeId = c.req.param('nodeId');

  try {
    // Rebuild with minimal options
    const config: RebuildConfig = {
      sourceType: 'existing_chunks',
      rebuildOptions: {
        deleteExisting: false,
        rebuildChunks: false,
        rebuildSummaries: false,
        rebuildApex: true,
        rebuildEmbeddings: false,
      },
    };

    rebuildNode(
      c.env.AI,
      c.env.DB,
      c.env.NODE_CHUNKS,
      nodeId,
      config
    ).catch(error => {
      console.error('[NODE-ADMIN] Apex rebuild error:', error);
    });

    return c.json({
      message: 'Apex rebuild started',
      nodeId,
    }, 202);

  } catch (error) {
    console.error('[NODE-ADMIN] Apex rebuild error:', error);
    return c.json({
      error: 'Failed to rebuild apex',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * POST /api/admin/node/:nodeId/rebuild-embeddings
 * Quick fix: Rebuild only embeddings
 */
nodeAdminRoutes.post('/:nodeId/rebuild-embeddings', requireAuth(), requireAdmin(), async (c) => {
  const nodeId = c.req.param('nodeId');

  try {
    const config: RebuildConfig = {
      sourceType: 'existing_chunks',
      rebuildOptions: {
        deleteExisting: false,
        rebuildChunks: false,
        rebuildSummaries: false,
        rebuildApex: false,
        rebuildEmbeddings: true,
      },
    };

    rebuildNode(
      c.env.AI,
      c.env.DB,
      c.env.NODE_CHUNKS,
      nodeId,
      config
    ).catch(error => {
      console.error('[NODE-ADMIN] Embedding rebuild error:', error);
    });

    return c.json({
      message: 'Embedding rebuild started',
      nodeId,
    }, 202);

  } catch (error) {
    console.error('[NODE-ADMIN] Embedding rebuild error:', error);
    return c.json({
      error: 'Failed to rebuild embeddings',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// ==========================================
// Batch Operations
// ==========================================

/**
 * POST /api/admin/nodes/rebuild-batch
 * Rebuild multiple nodes
 *
 * Body:
 * {
 *   "nodeIds": ["node-1", "node-2"],
 *   "maxConcurrent": 2,
 *   "config": { ... }
 * }
 */
nodeAdminRoutes.post('/rebuild-batch', requireAuth(), requireAdmin(), async (c) => {
  try {
    const { nodeIds, maxConcurrent = 1, config } = await c.req.json();

    if (!nodeIds || !Array.isArray(nodeIds) || nodeIds.length === 0) {
      return c.json({ error: 'nodeIds array required' }, 400);
    }

    const results = [];

    for (const nodeId of nodeIds.slice(0, 10)) {  // Max 10 at a time
      try {
        // Start rebuild
        rebuildNode(
          c.env.AI,
          c.env.DB,
          c.env.NODE_CHUNKS,
          nodeId,
          config
        ).catch(error => {
          console.error(`[NODE-ADMIN] Batch rebuild error for ${nodeId}:`, error);
        });

        results.push({
          nodeId,
          success: true,
          message: 'Rebuild started',
        });

      } catch (error) {
        results.push({
          nodeId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return c.json({
      message: 'Batch rebuild started',
      total: nodeIds.length,
      processed: results.length,
      results,
    }, 202);

  } catch (error) {
    console.error('[NODE-ADMIN] Batch rebuild error:', error);
    return c.json({
      error: 'Batch rebuild failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default nodeAdminRoutes;
