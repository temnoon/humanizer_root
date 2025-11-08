// Writing samples routes for NPE Workers API
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import type {
  Env,
  UploadWritingSampleRequest,
  UploadWritingSampleResponse,
  WritingSample
} from '../../shared/types';

const writingSamplesRoutes = new Hono<{ Bindings: Env }>();

/**
 * POST /personal/samples/upload - Upload a writing sample
 * Requires authentication
 */
writingSamplesRoutes.post('/upload', requireAuth(), async (c) => {
  try {
    const auth = c.get('auth');
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { content, source_type, metadata }: UploadWritingSampleRequest = await c.req.json();

    // Validate input
    if (!content || !source_type) {
      return c.json({ error: 'Content and source_type are required' }, 400);
    }

    // Validate source type
    const validSources = ['manual', 'chatgpt', 'claude', 'other'];
    if (!validSources.includes(source_type)) {
      return c.json({ error: 'Invalid source_type' }, 400);
    }

    // Calculate word count
    const wordCount = content.trim().split(/\s+/).length;

    // Minimum word count check (at least 100 words)
    if (wordCount < 100) {
      return c.json({
        error: 'Writing sample must be at least 100 words',
        word_count: wordCount
      }, 400);
    }

    // Insert into database
    const result = await c.env.DB.prepare(
      'INSERT INTO writing_samples (user_id, source_type, content, word_count, custom_metadata) VALUES (?, ?, ?, ?, ?)'
    ).bind(
      auth.userId,
      source_type,
      content,
      wordCount,
      metadata ? JSON.stringify(metadata) : null
    ).run();

    return c.json({
      success: true,
      sample_id: result.meta.last_row_id,
      word_count: wordCount
    } as UploadWritingSampleResponse, 201);

  } catch (error) {
    console.error('Writing sample upload error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /personal/samples - List user's writing samples
 * Requires authentication
 */
writingSamplesRoutes.get('/', requireAuth(), async (c) => {
  try {
    const auth = c.get('auth');
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get all samples for this user, ordered by creation date
    const result = await c.env.DB.prepare(
      `SELECT id, source_type, word_count, custom_metadata, created_at,
              SUBSTR(content, 1, 200) as content_preview
       FROM writing_samples
       WHERE user_id = ?
       ORDER BY created_at DESC`
    ).bind(auth.userId).all();

    const samples = result.results.map((row: any) => ({
      id: row.id,
      source_type: row.source_type,
      word_count: row.word_count,
      content_preview: row.content_preview + (row.content_preview.length >= 200 ? '...' : ''),
      custom_metadata: row.custom_metadata ? JSON.parse(row.custom_metadata) : undefined,
      created_at: row.created_at
    }));

    // Calculate total word count
    const totalWords = samples.reduce((sum: number, s: any) => sum + s.word_count, 0);

    return c.json({
      samples,
      total_samples: samples.length,
      total_words: totalWords
    }, 200);

  } catch (error) {
    console.error('List writing samples error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /personal/samples/:id - Get a specific writing sample
 * Requires authentication
 */
writingSamplesRoutes.get('/:id', requireAuth(), async (c) => {
  try {
    const auth = c.get('auth');
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const sampleId = c.req.param('id');

    const result = await c.env.DB.prepare(
      'SELECT * FROM writing_samples WHERE id = ? AND user_id = ?'
    ).bind(sampleId, auth.userId).first();

    if (!result) {
      return c.json({ error: 'Writing sample not found' }, 404);
    }

    const sample: WritingSample = {
      id: result.id as number,
      user_id: result.user_id as number,
      source_type: result.source_type as any,
      content: result.content as string,
      word_count: result.word_count as number,
      custom_metadata: result.custom_metadata ? JSON.parse(result.custom_metadata as string) : undefined,
      created_at: result.created_at as string
    };

    return c.json({ sample }, 200);

  } catch (error) {
    console.error('Get writing sample error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * DELETE /personal/samples/:id - Delete a writing sample
 * Requires authentication
 */
writingSamplesRoutes.delete('/:id', requireAuth(), async (c) => {
  try {
    const auth = c.get('auth');
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const sampleId = c.req.param('id');

    // Delete the sample (only if it belongs to the user)
    const result = await c.env.DB.prepare(
      'DELETE FROM writing_samples WHERE id = ? AND user_id = ?'
    ).bind(sampleId, auth.userId).run();

    if (result.meta.changes === 0) {
      return c.json({ error: 'Writing sample not found' }, 404);
    }

    return c.json({ success: true }, 200);

  } catch (error) {
    console.error('Delete writing sample error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default writingSamplesRoutes;
