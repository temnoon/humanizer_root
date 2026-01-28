/**
 * Cluster Routes
 *
 * Clustering discovery and management operations.
 *
 * @module @humanizer/api/routes/clusters
 */

import { Hono } from 'hono';
import type { AuiContextVariables } from '../middleware/aui-context.js';

// ═══════════════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════════════

export const clustersRouter = new Hono<{ Variables: AuiContextVariables }>();

/**
 * GET /clusters
 * List discovered clusters
 */
clustersRouter.get('/', async (c) => {
  const aui = c.get('aui');
  const userId = c.req.query('userId');
  const limit = parseInt(c.req.query('limit') ?? '50', 10);

  try {
    const clusters = await aui.listClusters({ userId, limit });
    return c.json({
      clusters: clusters.map((cluster) => ({
        id: cluster.id,
        label: cluster.label,
        description: cluster.description,
        totalPassages: cluster.totalPassages,
        coherence: cluster.coherence,
        keywords: cluster.keywords,
      })),
      count: clusters.length,
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'List clusters failed' },
      500
    );
  }
});

/**
 * GET /clusters/:id
 * Get a specific cluster
 */
clustersRouter.get('/:id', async (c) => {
  const aui = c.get('aui');
  const id = c.req.param('id');

  try {
    const cluster = await aui.getCluster(id);
    if (!cluster) {
      return c.json({ error: 'Cluster not found' }, 404);
    }

    return c.json({
      id: cluster.id,
      label: cluster.label,
      description: cluster.description,
      passages: cluster.passages,
      totalPassages: cluster.totalPassages,
      coherence: cluster.coherence,
      keywords: cluster.keywords,
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Get cluster failed' },
      500
    );
  }
});

/**
 * POST /clusters/discover
 * Run cluster discovery on archive content
 */
clustersRouter.post('/discover', async (c) => {
  const aui = c.get('aui');
  const body = await c.req
    .json<{
      minClusterSize?: number;
      maxClusters?: number;
      sampleSize?: number;
    }>()
    .catch(() => null);

  try {
    const result = await aui.discoverClusters({
      minClusterSize: body?.minClusterSize,
      maxClusters: body?.maxClusters,
      sampleSize: body?.sampleSize,
    });

    return c.json({
      clusters: result.clusters.map((cluster) => ({
        id: cluster.id,
        label: cluster.label,
        description: cluster.description,
        totalPassages: cluster.totalPassages,
        coherence: cluster.coherence,
      })),
      count: result.clusters.length,
      totalPassages: result.totalPassages,
      assignedPassages: result.assignedPassages,
      noisePassages: result.noisePassages,
      durationMs: result.durationMs,
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Cluster discovery failed' },
      500
    );
  }
});

/**
 * POST /clusters
 * Save a cluster
 */
clustersRouter.post('/', async (c) => {
  const aui = c.get('aui');
  const body = await c.req
    .json<{
      cluster: {
        id?: string;
        label: string;
        description?: string;
        passages?: unknown[];
        keywords?: string[];
      };
      userId?: string;
    }>()
    .catch(() => null);

  if (!body?.cluster) {
    return c.json({ error: 'cluster is required' }, 400);
  }

  try {
    // Create a minimal cluster object
    const clusterData = {
      id: body.cluster.id ?? crypto.randomUUID(),
      label: body.cluster.label,
      description: body.cluster.description ?? '',
      passages: body.cluster.passages ?? [],
      totalPassages: (body.cluster.passages ?? []).length,
      coherence: 0,
      keywords: body.cluster.keywords ?? [],
    };

    const saved = await aui.saveCluster(clusterData as any, body.userId);

    return c.json(
      {
        id: saved.id,
        label: saved.label,
        totalPassages: saved.totalPassages,
      },
      201
    );
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Save cluster failed' },
      500
    );
  }
});
