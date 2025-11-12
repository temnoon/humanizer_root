/**
 * Narratives API Routes
 *
 * Purpose: Manage narrative texts for transformation pipelines
 * Features:
 * - Create narratives with validation (6-criteria scoring)
 * - List user's narratives
 * - Get narrative details
 * - Delete narratives
 *
 * Endpoints:
 * - POST /narratives - Create narrative (with validation)
 * - GET /narratives - List user's narratives
 * - GET /narratives/:id - Get narrative details
 * - DELETE /narratives/:id - Delete narrative
 */

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, optionalLocalAuth, getAuthContext } from '../middleware/auth';
import { validateNarrative, getWordCount } from '../utils/narrative-validation';

export const narrativesRoutes = new Hono();

// Apply auth middleware
narrativesRoutes.use('/*', optionalLocalAuth());

/**
 * POST /narratives
 *
 * Create new narrative with validation
 *
 * Request body:
 * {
 *   "title": "Optional title",
 *   "source_text": "The narrative text to validate and store..."
 * }
 *
 * Response (success):
 * {
 *   "id": "uuid",
 *   "title": "Optional title",
 *   "validation_score": 0.85,
 *   "word_count": 127,
 *   "created_at": 1234567890
 * }
 *
 * Response (validation failed):
 * {
 *   "error": "Invalid narrative structure",
 *   "reasons": ["Text is too short (42 words, minimum 50 required)", "..."],
 *   "score": 0.45
 * }
 */
narrativesRoutes.post('/', async (c) => {
  const auth = getAuthContext(c);
  const userId = auth.userId;

  try {
    const body = await c.req.json();
    const { title, source_text } = body;

    if (!source_text || typeof source_text !== 'string') {
      return c.json({ error: 'source_text is required and must be a string' }, 400);
    }

    // Validate narrative structure
    const validation = validateNarrative(source_text);

    if (!validation.valid) {
      return c.json({
        error: 'Invalid narrative structure',
        reasons: validation.reasons,
        score: validation.score
      }, 400);
    }

    const narrativeId = uuidv4();
    const wordCount = getWordCount(source_text);
    const now = Date.now();

    // Store narrative in database
    await c.env.DB.prepare(`
      INSERT INTO narratives (id, user_id, title, source_text, validation_score, word_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      narrativeId,
      userId,
      title || null,
      source_text,
      validation.score,
      wordCount,
      now
    ).run();

    return c.json({
      id: narrativeId,
      title: title || null,
      validation_score: validation.score,
      word_count: wordCount,
      created_at: now
    }, 201);
  } catch (error) {
    console.error('Error creating narrative:', error);
    return c.json({
      error: 'Failed to create narrative',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

/**
 * GET /narratives
 *
 * List user's narratives
 *
 * Query parameters:
 * - limit: Number of narratives to return (default: 50, max: 100)
 * - offset: Number of narratives to skip (default: 0)
 *
 * Response:
 * {
 *   "narratives": [
 *     {
 *       "id": "uuid",
 *       "title": "Optional title",
 *       "word_count": 127,
 *       "validation_score": 0.85,
 *       "created_at": 1234567890,
 *       "preview": "First 100 characters..."
 *     }
 *   ],
 *   "total": 42
 * }
 */
narrativesRoutes.get('/', async (c) => {
  const auth = getAuthContext(c);
  const userId = auth.userId;

  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
    const offset = parseInt(c.req.query('offset') || '0');

    // Get narratives
    const narratives = await c.env.DB.prepare(`
      SELECT id, title, source_text, validation_score, word_count, created_at
      FROM narratives
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all();

    // Get total count
    const countResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as total FROM narratives WHERE user_id = ?
    `).bind(userId).first();

    const total = (countResult?.total as number) || 0;

    // Format results with preview
    const formattedNarratives = narratives.results.map(n => ({
      id: n.id,
      title: n.title,
      word_count: n.word_count,
      validation_score: n.validation_score,
      created_at: n.created_at,
      preview: (n.source_text as string).substring(0, 100) + (n.source_text as string).length > 100 ? '...' : ''
    }));

    return c.json({
      narratives: formattedNarratives,
      total,
      limit,
      offset
    }, 200);
  } catch (error) {
    console.error('Error listing narratives:', error);
    return c.json({ error: 'Failed to list narratives' }, 500);
  }
});

/**
 * GET /narratives/:id
 *
 * Get narrative details including full text
 *
 * Response:
 * {
 *   "id": "uuid",
 *   "title": "Optional title",
 *   "source_text": "Full narrative text...",
 *   "validation_score": 0.85,
 *   "word_count": 127,
 *   "created_at": 1234567890
 * }
 */
narrativesRoutes.get('/:id', async (c) => {
  const auth = getAuthContext(c);
  const userId = auth.userId;
  const narrativeId = c.req.param('id');

  try {
    const narrative = await c.env.DB.prepare(`
      SELECT * FROM narratives WHERE id = ? AND user_id = ?
    `).bind(narrativeId, userId).first();

    if (!narrative) {
      return c.json({ error: 'Narrative not found' }, 404);
    }

    return c.json({
      id: narrative.id,
      title: narrative.title,
      source_text: narrative.source_text,
      validation_score: narrative.validation_score,
      word_count: narrative.word_count,
      created_at: narrative.created_at
    }, 200);
  } catch (error) {
    console.error('Error getting narrative:', error);
    return c.json({ error: 'Failed to get narrative' }, 500);
  }
});

/**
 * DELETE /narratives/:id
 *
 * Delete narrative and all associated data (sessions, operations, measurements)
 * Cascading deletes handled by database foreign key constraints
 *
 * Response:
 * {
 *   "message": "Narrative deleted successfully",
 *   "id": "uuid"
 * }
 */
narrativesRoutes.delete('/:id', async (c) => {
  const auth = getAuthContext(c);
  const userId = auth.userId;
  const narrativeId = c.req.param('id');

  try {
    // Check narrative exists and belongs to user
    const narrative = await c.env.DB.prepare(`
      SELECT id FROM narratives WHERE id = ? AND user_id = ?
    `).bind(narrativeId, userId).first();

    if (!narrative) {
      return c.json({ error: 'Narrative not found' }, 404);
    }

    // Delete narrative (cascades to operations, quantum_sessions, quantum_session_measurements)
    await c.env.DB.prepare(`
      DELETE FROM narratives WHERE id = ? AND user_id = ?
    `).bind(narrativeId, userId).run();

    return c.json({
      message: 'Narrative deleted successfully',
      id: narrativeId
    }, 200);
  } catch (error) {
    console.error('Error deleting narrative:', error);
    return c.json({ error: 'Failed to delete narrative' }, 500);
  }
});

/**
 * GET /narratives/:id/operations
 *
 * Get all operations (transformation history) for a narrative
 * This provides the linear session history for the Canvas pipeline
 *
 * Response:
 * {
 *   "operations": [
 *     {
 *       "id": "uuid",
 *       "operation_type": "allegorical",
 *       "input_text": "...",
 *       "output_text": "...",
 *       "params": {},
 *       "status": "completed",
 *       "duration_ms": 15234,
 *       "created_at": 1234567890
 *     }
 *   ]
 * }
 */
narrativesRoutes.get('/:id/operations', async (c) => {
  const auth = getAuthContext(c);
  const userId = auth.userId;
  const narrativeId = c.req.param('id');

  try {
    // Verify narrative exists and belongs to user
    const narrative = await c.env.DB.prepare(`
      SELECT id FROM narratives WHERE id = ? AND user_id = ?
    `).bind(narrativeId, userId).first();

    if (!narrative) {
      return c.json({ error: 'Narrative not found' }, 404);
    }

    // Get operations for this narrative
    const operations = await c.env.DB.prepare(`
      SELECT id, operation_type, input_text, output_text, params, status, duration_ms, created_at
      FROM operations
      WHERE narrative_id = ? AND user_id = ?
      ORDER BY created_at ASC
    `).bind(narrativeId, userId).all();

    // Parse params JSON strings
    const formattedOperations = operations.results.map(op => ({
      id: op.id,
      operation_type: op.operation_type,
      input_text: op.input_text,
      output_text: op.output_text,
      params: JSON.parse(op.params as string),
      status: op.status,
      duration_ms: op.duration_ms,
      created_at: op.created_at
    }));

    return c.json({
      narrative_id: narrativeId,
      operations: formattedOperations
    }, 200);
  } catch (error) {
    console.error('Error getting operations:', error);
    return c.json({ error: 'Failed to get operations' }, 500);
  }
});
