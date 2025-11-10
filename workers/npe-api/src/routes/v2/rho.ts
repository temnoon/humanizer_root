/**
 * V2 API Routes - /rho
 *
 * Fundamental ρ Operations:
 * - POST /rho/construct    Construct ρ from text
 * - POST /rho/measure      Perform POVM measurement
 * - POST /rho/inspect      Inspect ρ properties
 * - POST /rho/distance     Compute distance between two ρ states
 */

import { Hono } from 'hono';
import { requireAuth, getAuthContext } from '../../middleware/auth';
import { NarrativeRepository } from '../../domain/narrative-repository';
import { POVMService } from '../../domain/povm-service';
import type { Env } from '../../../shared/types';

export const rhoRoutes = new Hono<{ Bindings: Env }>();

// TODO: Re-enable auth for production deployment
// For local dev, auth is disabled to allow Workbench access
// rhoRoutes.use('/*', requireAuth());

/**
 * POST /rho/construct
 *
 * Construct ρ from text (without creating narrative)
 * Useful for transient analysis
 *
 * Request body:
 * {
 *   "text": "The archive remembers..."
 * }
 *
 * Response:
 * {
 *   "eigenvalues": [0.15, 0.12, ...],
 *   "purity": 0.42,
 *   "entropy": 1.85,
 *   "trace": 1.0
 * }
 */
rhoRoutes.post('/construct', async (c) => {
  try {
    const body = await c.req.json();
    const { text } = body;

    if (!text || typeof text !== 'string') {
      return c.json({ error: 'Text is required' }, 400);
    }

    // Use NarrativeRepository to construct ρ (without saving)
    const { generateEmbedding } = await import('../../services/quantum-reading/embeddings');
    const { constructDensityMatrix } = await import('../../services/quantum-reading/density-matrix-simple');

    const embedding = await generateEmbedding(c.env.AI, text);
    const rho = constructDensityMatrix(embedding);

    return c.json({
      eigenvalues: rho.eigenvalues,
      purity: rho.purity,
      entropy: rho.entropy,
      trace: rho.trace,
    });
  } catch (error: any) {
    console.error('Construct ρ error:', error);
    return c.json(
      {
        error: 'Failed to construct ρ',
        details: error.message,
      },
      500
    );
  }
});

/**
 * POST /rho/measure
 *
 * Perform POVM measurement on a narrative
 *
 * Request body:
 * {
 *   "narrative_id": "...",
 *   "axis": "literalness"  // POVM axis to measure
 * }
 *
 * Response:
 * {
 *   "measurement_id": "...",
 *   "rho_id_before": "...",
 *   "rho_id_after": "...",  // Post-measurement collapsed state
 *   "axis": "literalness",
 *   "probabilities": {
 *     "literal": 0.7,
 *     "metaphorical": 0.2,
 *     "both": 0.05,
 *     "neither": 0.05
 *   },
 *   "evidence": { ... },
 *   "coherence": 0.95
 * }
 */
rhoRoutes.post('/measure', async (c) => {
  try {
    const body = await c.req.json();
    const { narrative_id, axis } = body;

    if (!narrative_id) {
      return c.json({ error: 'narrative_id is required' }, 400);
    }

    const narrativeRepo = new NarrativeRepository(c.env.DB, c.env.AI);
    const povmService = new POVMService(c.env.DB, c.env.AI, narrativeRepo);

    const result = await povmService.measureNarrative(
      narrative_id,
      axis || 'literalness'
    );

    return c.json(result);
  } catch (error: any) {
    console.error('POVM measurement error:', error);
    return c.json(
      {
        error: 'Measurement failed',
        details: error.message,
      },
      500
    );
  }
});

/**
 * POST /rho/inspect
 *
 * Inspect ρ state properties
 *
 * Request body:
 * {
 *   "rho_id": "..."
 * }
 *
 * Response:
 * {
 *   "rho_id": "...",
 *   "eigenvalues": [ ... ],
 *   "purity": 0.42,
 *   "entropy": 1.85,
 *   "trace": 1.0,
 *   "top_eigenvalues": [0.15, 0.12, ...],  // Top 10
 *   "state_classification": "mixed",
 *   "interpretation": "Mixed state - narrative has multiple..."
 * }
 */
rhoRoutes.post('/inspect', async (c) => {
  try {
    const body = await c.req.json();
    const { rho_id } = body;

    if (!rho_id) {
      return c.json({ error: 'rho_id is required' }, 400);
    }

    const narrativeRepo = new NarrativeRepository(c.env.DB, c.env.AI);
    const povmService = new POVMService(c.env.DB, c.env.AI, narrativeRepo);

    const result = await povmService.inspectRho(rho_id);

    return c.json(result);
  } catch (error: any) {
    console.error('ρ inspection error:', error);
    return c.json(
      {
        error: 'Inspection failed',
        details: error.message,
      },
      500
    );
  }
});

/**
 * POST /rho/distance
 *
 * Compute distance between two ρ states
 *
 * Request body:
 * {
 *   "rho_id_1": "...",
 *   "rho_id_2": "..."
 * }
 *
 * Response:
 * {
 *   "trace_distance": 0.23,  // Trace distance ∈ [0, 1]
 *   "fidelity": 0.91         // Fidelity ∈ [0, 1]
 * }
 */
rhoRoutes.post('/distance', async (c) => {
  try {
    const body = await c.req.json();
    const { rho_id_1, rho_id_2 } = body;

    if (!rho_id_1 || !rho_id_2) {
      return c.json({ error: 'Both rho_id_1 and rho_id_2 are required' }, 400);
    }

    const narrativeRepo = new NarrativeRepository(c.env.DB, c.env.AI);
    const povmService = new POVMService(c.env.DB, c.env.AI, narrativeRepo);

    const result = await povmService.computeDistance(rho_id_1, rho_id_2);

    return c.json(result);
  } catch (error: any) {
    console.error('ρ distance error:', error);
    return c.json(
      {
        error: 'Distance computation failed',
        details: error.message,
      },
      500
    );
  }
});
