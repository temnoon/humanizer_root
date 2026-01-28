/**
 * Search Routes
 *
 * Semantic search and find similar operations.
 *
 * @module @humanizer/api/routes/search
 */

import { Hono } from 'hono';
import type { AuiContextVariables } from '../middleware/aui-context.js';

// ═══════════════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════════════

export const searchRouter = new Hono<{ Variables: AuiContextVariables }>();

/**
 * POST /search
 * Perform semantic search across archive and books
 */
searchRouter.post('/', async (c) => {
  const aui = c.get('aui');
  const body = await c.req
    .json<{
      sessionId: string;
      query: string;
      limit?: number;
      threshold?: number;
    }>()
    .catch(() => null);

  if (!body?.sessionId || !body?.query) {
    return c.json({ error: 'sessionId and query are required' }, 400);
  }

  const session = aui.getSession(body.sessionId);
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  try {
    const response = await aui.search(body.sessionId, body.query, {
      limit: body.limit,
      threshold: body.threshold,
    });

    return c.json({
      query: response.query,
      results: response.results.map((r) => ({
        id: r.id,
        text: r.text,
        source: r.source,
        score: r.score,
        wordCount: r.wordCount,
        hierarchyLevel: r.hierarchyLevel,
        // Include full provenance for UI display
        provenance: r.provenance,
        // Include quality indicators for rating computation
        quality: r.quality,
        // Include enrichment (title, summary, rating) if available
        enrichment: r.enrichment,
        // Include score breakdown for debugging/transparency
        scoreBreakdown: r.scoreBreakdown,
        title: r.title,
        tags: r.tags,
      })),
      count: response.results.length,
      hasMore: response.hasMore,
      stats: response.stats,
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      500
    );
  }
});

/**
 * POST /search/similar
 * Find content similar to provided text
 */
searchRouter.post('/similar', async (c) => {
  const aui = c.get('aui');
  const body = await c.req
    .json<{
      sessionId: string;
      text: string;
      limit?: number;
      threshold?: number;
    }>()
    .catch(() => null);

  if (!body?.sessionId || !body?.text) {
    return c.json({ error: 'sessionId and text are required' }, 400);
  }

  const session = aui.getSession(body.sessionId);
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  try {
    // Use the text directly as a query for semantic search
    const response = await aui.search(body.sessionId, body.text, {
      limit: body.limit ?? 20,
      threshold: body.threshold ?? 0.5,
    });

    return c.json({
      sourceText: body.text.slice(0, 100) + (body.text.length > 100 ? '...' : ''),
      results: response.results.map((r) => ({
        id: r.id,
        text: r.text,
        source: r.source,
        score: r.score,
        wordCount: r.wordCount,
        hierarchyLevel: r.hierarchyLevel,
        provenance: r.provenance,
        quality: r.quality,
        enrichment: r.enrichment,
        scoreBreakdown: r.scoreBreakdown,
        preview: r.text.slice(0, 200) + (r.text.length > 200 ? '...' : ''),
      })),
      count: response.results.length,
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Find similar failed' },
      500
    );
  }
});

/**
 * POST /search/refine
 * Refine search with positive/negative examples
 */
searchRouter.post('/refine', async (c) => {
  const aui = c.get('aui');
  const body = await c.req
    .json<{
      sessionId: string;
      likeThese?: string[];
      unlikeThese?: string[];
      query?: string;
      limit?: number;
    }>()
    .catch(() => null);

  if (!body?.sessionId) {
    return c.json({ error: 'sessionId is required' }, 400);
  }

  const session = aui.getSession(body.sessionId);
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  try {
    const response = await aui.refine(body.sessionId, {
      likeThese: body.likeThese,
      unlikeThese: body.unlikeThese,
      query: body.query,
      limit: body.limit,
    });

    return c.json({
      results: response.results.map((r) => ({
        id: r.id,
        text: r.text,
        source: r.source,
        score: r.score,
        wordCount: r.wordCount,
        hierarchyLevel: r.hierarchyLevel,
        provenance: r.provenance,
        quality: r.quality,
        enrichment: r.enrichment,
        scoreBreakdown: r.scoreBreakdown,
      })),
      count: response.results.length,
      hasMore: response.hasMore,
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Refine failed' },
      500
    );
  }
});

/**
 * POST /search/anchor
 * Add an anchor (positive or negative) to refine search
 */
searchRouter.post('/anchor', async (c) => {
  const aui = c.get('aui');
  const body = await c.req
    .json<{
      sessionId: string;
      resultId: string;
      type: 'positive' | 'negative';
    }>()
    .catch(() => null);

  if (!body?.sessionId || !body?.resultId || !body?.type) {
    return c.json({ error: 'sessionId, resultId, and type are required' }, 400);
  }

  const session = aui.getSession(body.sessionId);
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  try {
    const anchor = await aui.addAnchor(body.sessionId, body.resultId, body.type);
    return c.json({
      id: anchor.id,
      name: anchor.name,
      createdAt: anchor.createdAt,
    }, 201);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Add anchor failed' },
      500
    );
  }
});

/**
 * POST /search/to-buffer
 * Copy search results to a buffer
 */
searchRouter.post('/to-buffer', async (c) => {
  const aui = c.get('aui');
  const body = await c.req
    .json<{
      sessionId: string;
      bufferName: string;
      limit?: number;
      create?: boolean;
    }>()
    .catch(() => null);

  if (!body?.sessionId || !body?.bufferName) {
    return c.json({ error: 'sessionId and bufferName are required' }, 400);
  }

  const session = aui.getSession(body.sessionId);
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  try {
    const buffer = await aui.searchToBuffer(body.sessionId, body.bufferName, {
      limit: body.limit,
      create: body.create,
    });

    return c.json({
      id: buffer.id,
      name: buffer.name,
      currentBranch: buffer.currentBranch,
      contentLength: buffer.workingContent?.length ?? 0,
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Search to buffer failed' },
      500
    );
  }
});
