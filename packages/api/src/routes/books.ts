/**
 * Book Routes
 *
 * Book creation, management, and export operations.
 *
 * @module @humanizer/api/routes/books
 */

import { Hono } from 'hono';
import type { AuiContextVariables } from '../middleware/aui-context.js';

// ═══════════════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════════════

export const booksRouter = new Hono<{ Variables: AuiContextVariables }>();

/**
 * GET /books
 * List all books
 */
booksRouter.get('/', async (c) => {
  const aui = c.get('aui');
  const userId = c.req.query('userId');
  const limit = parseInt(c.req.query('limit') ?? '50', 10);

  try {
    const books = await aui.listBooks({ userId, limit });
    return c.json({
      books: books.map((book) => ({
        id: book.id,
        title: book.title,
        description: book.description,
        chapterCount: book.chapters?.length ?? 0,
        status: book.status,
        createdAt: book.createdAt,
        updatedAt: book.updatedAt,
      })),
      count: books.length,
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'List books failed' },
      500
    );
  }
});

/**
 * GET /books/:id
 * Get a specific book
 */
booksRouter.get('/:id', async (c) => {
  const aui = c.get('aui');
  const id = c.req.param('id');

  try {
    const book = await aui.getBook(id);
    if (!book) {
      return c.json({ error: 'Book not found' }, 404);
    }

    return c.json({
      id: book.id,
      title: book.title,
      description: book.description,
      status: book.status,
      chapters: book.chapters?.map((ch) => ({
        title: ch.title,
        position: ch.position,
        wordCount: ch.wordCount,
      })),
      arc: book.arc,
      sourceClusterId: book.sourceClusterId,
      createdAt: book.createdAt,
      updatedAt: book.updatedAt,
      metadata: book.metadata,
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Get book failed' },
      500
    );
  }
});

/**
 * POST /books/from-cluster
 * Create a book from a cluster
 */
booksRouter.post('/from-cluster', async (c) => {
  const aui = c.get('aui');
  const body = await c.req
    .json<{
      clusterId: string;
      title?: string;
      personaId?: string;
      arcType?: 'thematic' | 'chronological' | 'dramatic' | 'exploratory';
    }>()
    .catch(() => null);

  if (!body?.clusterId) {
    return c.json({ error: 'clusterId is required' }, 400);
  }

  try {
    const book = await aui.createBookFromCluster(body.clusterId, {
      title: body.title,
      personaId: body.personaId,
      arcType: body.arcType,
    });

    return c.json(
      {
        id: book.id,
        title: book.title,
        chapterCount: book.chapters?.length ?? 0,
        status: book.status,
      },
      201
    );
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Create book from cluster failed' },
      500
    );
  }
});

/**
 * POST /books/harvest
 * Harvest content for a book
 */
booksRouter.post('/harvest', async (c) => {
  const aui = c.get('aui');
  const body = await c.req
    .json<{
      query: string;
      limit?: number;
      minRelevance?: number;
    }>()
    .catch(() => null);

  if (!body?.query) {
    return c.json({ error: 'query is required' }, 400);
  }

  try {
    const result = await aui.harvest({
      query: body.query,
      limit: body.limit,
      minRelevance: body.minRelevance,
    });

    return c.json({
      passages: result.passages.map((p) => ({
        id: p.id,
        text: p.text.slice(0, 200) + (p.text.length > 200 ? '...' : ''),
        relevance: p.relevance,
        sourceType: p.sourceType,
      })),
      count: result.passages.length,
      query: result.query,
      candidatesFound: result.candidatesFound,
      durationMs: result.durationMs,
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Harvest failed' },
      500
    );
  }
});

/**
 * POST /books/arc
 * Generate a narrative arc from harvested passages
 */
booksRouter.post('/arc', async (c) => {
  const aui = c.get('aui');
  const body = await c.req
    .json<{
      passages: Array<{
        id: string;
        text: string;
        relevance: number;
        sourceType: string;
        wordCount: number;
        authorRole?: string;
        title?: string;
      }>;
      arcType?: 'thematic' | 'chronological' | 'dramatic' | 'exploratory';
    }>()
    .catch(() => null);

  if (!body?.passages?.length) {
    return c.json({ error: 'passages array required' }, 400);
  }

  try {
    const arc = await aui.generateArc({
      passages: body.passages,
      arcType: body.arcType,
    });

    return c.json({
      title: arc.title,
      arcType: arc.arcType,
      introduction: arc.introduction,
      chapters: arc.chapters.map((ch) => ({
        title: ch.title,
        position: ch.position,
      })),
      themes: arc.themes,
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Generate arc failed' },
      500
    );
  }
});

/**
 * GET /books/:id/export
 * Export a book to a specific format
 */
booksRouter.get('/:id/export', async (c) => {
  const aui = c.get('aui');
  const id = c.req.param('id');
  const format = (c.req.query('format') as 'markdown' | 'html' | 'json') ?? 'markdown';

  try {
    const artifact = await aui.exportBook(id, format);
    if (!artifact) {
      return c.json({ error: 'Export failed or book not found' }, 404);
    }

    // Set appropriate content type based on format
    const contentTypes: Record<string, string> = {
      markdown: 'text/markdown',
      html: 'text/html',
      json: 'application/json',
    };

    if (artifact.content) {
      c.header('Content-Type', contentTypes[format] ?? 'text/plain');
      c.header('Content-Disposition', `attachment; filename="${artifact.name}"`);
      return c.text(artifact.content);
    }

    return c.json({ error: 'No content in artifact' }, 500);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      500
    );
  }
});

/**
 * GET /books/:id/chapters/:chapterId/provenance
 * Get provenance chain for a chapter
 */
booksRouter.get('/:id/chapters/:chapterId/provenance', async (c) => {
  const aui = c.get('aui');
  const bookId = c.req.param('id');
  const chapterId = c.req.param('chapterId');

  try {
    const provenance = await aui.getChapterProvenance(bookId, chapterId);
    if (!provenance) {
      return c.json({ error: 'Provenance not found' }, 404);
    }

    return c.json({
      id: provenance.id,
      rootBufferId: provenance.rootBufferId,
      currentBufferId: provenance.currentBufferId,
      transformationCount: provenance.transformationCount,
      branch: provenance.branch,
      operations: provenance.operations.map((op) => ({
        id: op.id,
        type: op.type,
        description: op.description,
        timestamp: op.timestamp,
        performer: op.performer,
      })),
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Get provenance failed' },
      500
    );
  }
});
