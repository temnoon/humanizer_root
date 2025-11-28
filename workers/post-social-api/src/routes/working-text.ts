/**
 * Working Text Routes
 *
 * Endpoints for managing node working texts:
 * - Trigger reformatting for a node
 * - Check reformatting status
 * - List nodes needing processing
 * - Re-process existing nodes
 */

import { Hono } from 'hono';
import { requireAuth, getAuthContext } from '../middleware/auth';
import {
  reformatGutenbergText,
  reformatGutenbergTextFast,
  storeWorkingTexts,
  getWorkingTexts
} from '../services/text-reformatter';

const workingTextRoutes = new Hono();

/**
 * POST /api/working-text/node/:nodeId/reformat
 * Trigger reformatting for a node's Gutenberg content
 */
workingTextRoutes.post('/node/:nodeId/reformat', requireAuth(), async (c) => {
  const auth = getAuthContext(c);
  const nodeId = c.req.param('nodeId');

  try {
    // Verify node exists and user is owner/admin
    const node = await c.env.DB.prepare(
      `SELECT id, name, creator_user_id, archive_metadata FROM nodes WHERE id = ?`
    ).bind(nodeId).first<Record<string, unknown>>();

    if (!node) {
      return c.json({ error: 'Node not found' }, 404);
    }

    // Check if admin or owner
    const isAdmin = auth.role === 'admin';
    if (!isAdmin && node.creator_user_id !== auth.userId) {
      return c.json({ error: 'Access denied' }, 403);
    }

    // Get the raw text from node_chunks (L0 chunks have the original content)
    const { results: chunks } = await c.env.DB.prepare(
      `SELECT content, chapter_number, chapter_title
       FROM node_chunks
       WHERE node_id = ? AND pyramid_level = 0
       ORDER BY chunk_index`
    ).bind(nodeId).all();

    if (!chunks || chunks.length === 0) {
      return c.json({ error: 'No content found for this node' }, 400);
    }

    // Concatenate all chunks to get full text
    const rawText = chunks.map((c: Record<string, unknown>) => c.content).join('\n\n');

    // Check if already has working texts
    const existing = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM node_working_texts WHERE node_id = ?`
    ).bind(nodeId).first<{ count: number }>();

    if (existing && existing.count > 0) {
      // Delete existing working texts for re-processing
      await c.env.DB.prepare(
        `DELETE FROM node_working_texts WHERE node_id = ?`
      ).bind(nodeId).run();
    }

    // Run reformatter (use fast version to avoid CPU timeouts)
    const result = await reformatGutenbergTextFast(rawText);

    if (!result.success) {
      return c.json({
        error: 'Reformatting failed',
        details: result.error
      }, 500);
    }

    // Store working texts
    const storeResult = await storeWorkingTexts(c.env.DB, nodeId, result.chapters);

    // Update node metadata to indicate working texts available
    const archiveMetadata = node.archive_metadata
      ? JSON.parse(node.archive_metadata as string)
      : {};
    archiveMetadata.hasWorkingTexts = true;
    archiveMetadata.workingTextsProcessedAt = Date.now();
    archiveMetadata.chapterCount = result.chapters.length;

    await c.env.DB.prepare(
      `UPDATE nodes SET archive_metadata = ?, updated_at = ? WHERE id = ?`
    ).bind(JSON.stringify(archiveMetadata), Date.now(), nodeId).run();

    return c.json({
      success: true,
      nodeId,
      nodeName: node.name,
      chapters: result.chapters.map(ch => ({
        chapterNumber: ch.chapterNumber,
        title: ch.title,
        wordCount: ch.wordCount
      })),
      metadata: result.metadata,
      stored: storeResult.stored,
      errors: storeResult.errors
    });

  } catch (error) {
    console.error('[WORKING-TEXT] Reformat error:', error);
    return c.json({ error: 'Failed to reformat text' }, 500);
  }
});

/**
 * GET /api/working-text/node/:nodeId
 * Get working texts for a node
 */
workingTextRoutes.get('/node/:nodeId', async (c) => {
  const nodeId = c.req.param('nodeId');

  try {
    const chapters = await getWorkingTexts(c.env.DB, nodeId);

    if (chapters.length === 0) {
      return c.json({
        nodeId,
        hasWorkingTexts: false,
        chapters: []
      });
    }

    return c.json({
      nodeId,
      hasWorkingTexts: true,
      chapters: chapters.map(ch => ({
        chapterNumber: ch.chapterNumber,
        title: ch.title,
        wordCount: ch.wordCount,
        // Don't include full content in list, just metadata
      }))
    });

  } catch (error) {
    console.error('[WORKING-TEXT] Get error:', error);
    return c.json({ error: 'Failed to get working texts' }, 500);
  }
});

/**
 * GET /api/working-text/node/:nodeId/chapter/:chapterNumber
 * Get a specific chapter's working text
 */
workingTextRoutes.get('/node/:nodeId/chapter/:chapterNumber', async (c) => {
  const nodeId = c.req.param('nodeId');
  const chapterNumber = parseInt(c.req.param('chapterNumber'));

  try {
    const chapter = await c.env.DB.prepare(
      `SELECT * FROM node_working_texts
       WHERE node_id = ? AND chapter_number = ? AND status = 'complete'`
    ).bind(nodeId, chapterNumber).first<Record<string, unknown>>();

    if (!chapter) {
      return c.json({ error: 'Chapter not found' }, 404);
    }

    return c.json({
      chapterNumber: chapter.chapter_number,
      title: chapter.chapter_title,
      workingContent: chapter.working_content,
      wordCount: chapter.word_count,
      enhancements: chapter.markdown_enhancements
        ? JSON.parse(chapter.markdown_enhancements as string)
        : null
    });

  } catch (error) {
    console.error('[WORKING-TEXT] Get chapter error:', error);
    return c.json({ error: 'Failed to get chapter' }, 500);
  }
});

/**
 * GET /api/working-text/pending
 * List nodes that need working text processing (admin only)
 */
workingTextRoutes.get('/pending', requireAuth(), async (c) => {
  const auth = getAuthContext(c);

  if (auth.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    // Find nodes with Gutenberg content but no working texts
    const { results: pendingNodes } = await c.env.DB.prepare(
      `SELECT n.id, n.name, n.slug, n.archive_metadata,
              (SELECT COUNT(*) FROM node_chunks WHERE node_id = n.id AND pyramid_level = 0) as chunk_count,
              (SELECT COUNT(*) FROM node_working_texts WHERE node_id = n.id) as working_text_count
       FROM nodes n
       WHERE n.status = 'active'
         AND EXISTS (SELECT 1 FROM node_chunks WHERE node_id = n.id)
       HAVING working_text_count = 0`
    ).all();

    return c.json({
      pending: (pendingNodes || []).map((n: Record<string, unknown>) => ({
        id: n.id,
        name: n.name,
        slug: n.slug,
        chunkCount: n.chunk_count,
        archiveMetadata: n.archive_metadata
          ? JSON.parse(n.archive_metadata as string)
          : null
      }))
    });

  } catch (error) {
    console.error('[WORKING-TEXT] Pending list error:', error);
    return c.json({ error: 'Failed to list pending nodes' }, 500);
  }
});

/**
 * POST /api/working-text/batch-reformat
 * Batch reformat multiple nodes (admin only)
 */
workingTextRoutes.post('/batch-reformat', requireAuth(), async (c) => {
  const auth = getAuthContext(c);

  if (auth.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const { nodeIds, limit = 5 } = await c.req.json();

  try {
    let nodesToProcess: string[] = [];

    if (nodeIds && Array.isArray(nodeIds)) {
      nodesToProcess = nodeIds.slice(0, limit);
    } else {
      // Get pending nodes
      const { results } = await c.env.DB.prepare(
        `SELECT n.id FROM nodes n
         WHERE n.status = 'active'
           AND EXISTS (SELECT 1 FROM node_chunks WHERE node_id = n.id)
           AND NOT EXISTS (SELECT 1 FROM node_working_texts WHERE node_id = n.id)
         LIMIT ?`
      ).bind(limit).all();

      nodesToProcess = (results || []).map((r: Record<string, unknown>) => r.id as string);
    }

    const results = [];

    for (const nodeId of nodesToProcess) {
      try {
        // Get raw text
        const { results: chunks } = await c.env.DB.prepare(
          `SELECT content FROM node_chunks
           WHERE node_id = ? AND pyramid_level = 0
           ORDER BY chunk_index`
        ).bind(nodeId).all();

        if (!chunks || chunks.length === 0) {
          results.push({ nodeId, success: false, error: 'No content' });
          continue;
        }

        const rawText = chunks.map((c: Record<string, unknown>) => c.content).join('\n\n');

        // Reformat (use fast version to avoid CPU timeouts)
        const reformatResult = await reformatGutenbergTextFast(rawText);

        if (!reformatResult.success) {
          results.push({ nodeId, success: false, error: reformatResult.error });
          continue;
        }

        // Store
        const storeResult = await storeWorkingTexts(c.env.DB, nodeId, reformatResult.chapters);

        results.push({
          nodeId,
          success: true,
          chapters: reformatResult.chapters.length,
          stored: storeResult.stored
        });

      } catch (error) {
        results.push({
          nodeId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return c.json({
      processed: results.length,
      results
    });

  } catch (error) {
    console.error('[WORKING-TEXT] Batch reformat error:', error);
    return c.json({ error: 'Batch reformat failed' }, 500);
  }
});

export default workingTextRoutes;
