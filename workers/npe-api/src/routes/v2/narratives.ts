/**
 * V2 API Routes - /narratives
 *
 * Philosophy-Driven Endpoints:
 * - POST /narratives          Create narrative (auto-generates ρ)
 * - GET  /narratives/:id      Get narrative with ρ and lineage summary
 * - PATCH /narratives/:id     Update text (creates new ρ version)
 * - DELETE /narratives/:id    Soft delete (preserves lineage)
 * - GET /narratives/search    Search by text
 * - GET /narratives/:id/rho   Get all ρ versions for narrative
 */

import { Hono } from 'hono';
import { optionalLocalAuth, getAuthContext } from '../../middleware/auth';
import { NarrativeRepository } from '../../domain/narrative-repository';
import type { Env } from '../../../shared/types';

export const narrativesRoutes = new Hono<{ Bindings: Env }>();

/**
 * POST /narratives
 *
 * Create a narrative from text
 * Auto-generates: embedding, initial ρ
 *
 * Request body:
 * {
 *   "text": "The archive remembers what you forget...",
 *   "title": "Optional title",
 *   "source": "user_upload" | "transformation" | "import"
 * }
 *
 * Response:
 * {
 *   "narrative": { id, user_id, text, ... },
 *   "rho": { id, eigenvalues, purity, entropy, ... }
 * }
 */
narrativesRoutes.post('/', optionalLocalAuth(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const body = await c.req.json();
    const { text, title, source } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return c.json({ error: 'Text is required and must be non-empty' }, 400);
    }

    const narrativeRepo = new NarrativeRepository(c.env.DB, c.env.AI);
    const result = await narrativeRepo.create(auth.userId, text, {
      title,
      source: source || 'user_upload',
    });

    return c.json(result, 201);
  } catch (error: any) {
    console.error('Create narrative error:', error);
    return c.json(
      {
        error: 'Failed to create narrative',
        details: error.message,
      },
      500
    );
  }
});

/**
 * GET /narratives/:id
 *
 * Get narrative with current ρ and lineage summary
 *
 * Response:
 * {
 *   "narrative": { ... },
 *   "rho": { ... },  // Latest ρ
 *   "rho_history_count": 5,
 *   "ancestor_count": 2,
 *   "descendant_count": 3
 * }
 */
narrativesRoutes.get('/:id', optionalLocalAuth(), async (c) => {
  try {
    const narrative_id = c.req.param('id');
    const narrativeRepo = new NarrativeRepository(c.env.DB, c.env.AI);

    const result = await narrativeRepo.get(narrative_id);

    if (!result) {
      return c.json({ error: 'Narrative not found' }, 404);
    }

    return c.json(result);
  } catch (error: any) {
    console.error('Get narrative error:', error);
    return c.json(
      {
        error: 'Failed to get narrative',
        details: error.message,
      },
      500
    );
  }
});

/**
 * PATCH /narratives/:id
 *
 * Update narrative text
 * Philosophy: Creates new embedding + new ρ version (never overwrites)
 *
 * Request body:
 * {
 *   "text": "Updated text..."
 * }
 *
 * Response:
 * {
 *   "id", "text", "updated_at", ...
 * }
 */
narrativesRoutes.patch('/:id', async (c) => {
  try {
    const narrative_id = c.req.param('id');
    const body = await c.req.json();
    const { text } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return c.json({ error: 'Text is required' }, 400);
    }

    const narrativeRepo = new NarrativeRepository(c.env.DB, c.env.AI);
    const updated = await narrativeRepo.update(narrative_id, text);

    return c.json(updated);
  } catch (error: any) {
    console.error('Update narrative error:', error);
    return c.json(
      {
        error: 'Failed to update narrative',
        details: error.message,
      },
      500
    );
  }
});

/**
 * DELETE /narratives/:id
 *
 * Soft delete narrative
 * Philosophy: Never truly delete - preserve lineage
 */
narrativesRoutes.delete('/:id', async (c) => {
  try {
    const narrative_id = c.req.param('id');
    const narrativeRepo = new NarrativeRepository(c.env.DB, c.env.AI);

    await narrativeRepo.delete(narrative_id);

    return c.json({ message: 'Narrative deleted' }, 200);
  } catch (error: any) {
    console.error('Delete narrative error:', error);
    return c.json(
      {
        error: 'Failed to delete narrative',
        details: error.message,
      },
      500
    );
  }
});

/**
 * GET /narratives/search
 *
 * Search narratives by text
 *
 * Query params:
 * - q: search query
 * - limit: results limit (default 20)
 * - offset: pagination offset (default 0)
 * - source: filter by source
 *
 * Response:
 * {
 *   "narratives": [ ... ],
 *   "count": 15
 * }
 */
narrativesRoutes.get('/search', async (c) => {
  try {
    const auth = getAuthContext(c);
    const query = c.req.query('q');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');
    const source = c.req.query('source');

    if (!query) {
      return c.json({ error: 'Query parameter "q" is required' }, 400);
    }

    const narrativeRepo = new NarrativeRepository(c.env.DB, c.env.AI);
    const results = await narrativeRepo.search(auth.userId, query, {
      limit,
      offset,
      source: source as any,
    });

    return c.json({
      narratives: results,
      count: results.length,
    });
  } catch (error: any) {
    console.error('Search narratives error:', error);
    return c.json(
      {
        error: 'Search failed',
        details: error.message,
      },
      500
    );
  }
});

/**
 * GET /narratives/:id/rho
 *
 * Get all ρ versions for a narrative
 *
 * Query params:
 * - scope: filter by scope (narrative | sentence | paragraph)
 *
 * Response:
 * {
 *   "narrative_id": "...",
 *   "rho_states": [ ... ],
 *   "count": 5
 * }
 */
narrativesRoutes.get('/:id/rho', async (c) => {
  try {
    const narrative_id = c.req.param('id');
    const scope = c.req.query('scope');

    const narrativeRepo = new NarrativeRepository(c.env.DB, c.env.AI);
    const rho_states = await narrativeRepo.getRhoHistory(
      narrative_id,
      scope as any
    );

    return c.json({
      narrative_id,
      rho_states,
      count: rho_states.length,
    });
  } catch (error: any) {
    console.error('Get ρ history error:', error);
    return c.json(
      {
        error: 'Failed to get ρ history',
        details: error.message,
      },
      500
    );
  }
});
