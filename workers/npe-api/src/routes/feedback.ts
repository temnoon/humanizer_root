/**
 * Feedback Routes
 *
 * Allows users to submit feedback on transformations.
 * Feeds into the admin dashboard for profile quality monitoring.
 */

import { Hono } from 'hono';
import { requireAuth, getAuthContext } from '../middleware/auth';
import type { Env } from '../../shared/types';

const feedbackRoutes = new Hono<{ Bindings: Env }>();

/**
 * POST /feedback - Submit transformation feedback
 *
 * Body:
 * - transformation_id: string (required)
 * - transformation_type: 'persona' | 'style' | 'humanizer' | 'round-trip' (required)
 * - rating: 'good' | 'bad' (required)
 * - profile_name?: string (the specific persona/style used)
 * - feedback_text?: string (optional comment)
 * - model_used?: string (which LLM model)
 */
feedbackRoutes.post('/', requireAuth(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const body = await c.req.json();

    const {
      transformation_id,
      transformation_type,
      rating,
      profile_name,
      feedback_text,
      model_used
    } = body;

    // Validate required fields
    if (!transformation_id || !transformation_type || !rating) {
      return c.json({
        error: 'transformation_id, transformation_type, and rating are required'
      }, 400);
    }

    // Validate transformation_type
    const validTypes = ['persona', 'style', 'humanizer', 'round-trip'];
    if (!validTypes.includes(transformation_type)) {
      return c.json({
        error: `Invalid transformation_type. Must be one of: ${validTypes.join(', ')}`
      }, 400);
    }

    // Validate rating
    if (!['good', 'bad'].includes(rating)) {
      return c.json({ error: 'Rating must be "good" or "bad"' }, 400);
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    await c.env.DB.prepare(`
      INSERT INTO transformation_feedback
      (id, user_id, transformation_id, transformation_type, profile_name, rating, feedback_text, model_used, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      auth.userId,
      transformation_id,
      transformation_type,
      profile_name || null,
      rating,
      feedback_text || null,
      model_used || null,
      now
    ).run();

    return c.json({ success: true, id }, 201);
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return c.json({ error: 'Failed to submit feedback' }, 500);
  }
});

/**
 * POST /feedback/batch - Submit multiple feedbacks at once
 *
 * Used for syncing locally-stored feedback to cloud.
 * Body: { feedbacks: FeedbackItem[] }
 */
feedbackRoutes.post('/batch', requireAuth(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const body = await c.req.json();

    const { feedbacks } = body;

    if (!Array.isArray(feedbacks) || feedbacks.length === 0) {
      return c.json({ error: 'feedbacks array is required' }, 400);
    }

    // Limit batch size
    if (feedbacks.length > 100) {
      return c.json({ error: 'Maximum 100 feedbacks per batch' }, 400);
    }

    const now = Date.now();
    let inserted = 0;
    let errors: string[] = [];

    for (const fb of feedbacks) {
      try {
        const {
          transformation_id,
          transformation_type,
          rating,
          profile_name,
          feedback_text,
          model_used,
          timestamp
        } = fb;

        if (!transformation_id || !transformation_type || !rating) {
          errors.push(`Missing required fields for transformation ${transformation_id}`);
          continue;
        }

        const id = crypto.randomUUID();
        const createdAt = timestamp ? new Date(timestamp).getTime() : now;

        await c.env.DB.prepare(`
          INSERT INTO transformation_feedback
          (id, user_id, transformation_id, transformation_type, profile_name, rating, feedback_text, model_used, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id,
          auth.userId,
          transformation_id,
          transformation_type,
          profile_name || null,
          rating,
          feedback_text || null,
          model_used || null,
          createdAt
        ).run();

        inserted++;
      } catch (e: any) {
        errors.push(`Failed to insert feedback: ${e.message}`);
      }
    }

    return c.json({
      success: true,
      inserted,
      errors: errors.length > 0 ? errors : undefined
    }, 201);
  } catch (error) {
    console.error('Error submitting batch feedback:', error);
    return c.json({ error: 'Failed to submit batch feedback' }, 500);
  }
});

/**
 * GET /feedback/my - Get current user's feedback history
 */
feedbackRoutes.get('/my', requireAuth(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const limit = parseInt(c.req.query('limit') || '50');

    const feedback = await c.env.DB.prepare(`
      SELECT * FROM transformation_feedback
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(auth.userId, limit).all();

    return c.json({ feedback: feedback.results }, 200);
  } catch (error) {
    console.error('Error fetching user feedback:', error);
    return c.json({ error: 'Failed to fetch feedback' }, 500);
  }
});

export default feedbackRoutes;
