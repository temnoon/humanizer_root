/**
 * Analysis API Routes
 *
 * Standalone analysis endpoints for POVM evaluation and density matrix inspection
 * Used by Cloud Workbench for direct text analysis without session management
 *
 * Endpoints:
 * - POST /eval/povm - Evaluate POVM measurement on text
 * - POST /eval/rho - Inspect density matrix properties
 */

import { Hono } from 'hono';
import { requireAuth, getAuthContext } from '../middleware/auth';
import {
  constructDensityMatrix,
  getTopEigenvalues,
} from '../services/quantum-reading/density-matrix-simple';
import {
  generateEmbedding,
} from '../services/quantum-reading/embeddings';
import {
  measureSentenceTetralemma,
} from '../services/quantum-reading/povm-measurement';

export const analysisRoutes = new Hono();

// Apply auth middleware
analysisRoutes.use('/*', requireAuth());

/**
 * POST /eval/povm
 *
 * Evaluate POVM measurement on text for a specific axis
 *
 * Request body:
 * {
 *   "text": "The archive remembers what you forget.",
 *   "axis": "literalness" // or other POVM axes
 * }
 *
 * Response:
 * {
 *   "weights": {
 *     "literal": 0.7,
 *     "metaphorical": 0.2,
 *     "both": 0.05,
 *     "neither": 0.05
 *   },
 *   "coherence": 0.95
 * }
 */
analysisRoutes.post('/povm', async (c) => {
  try {
    const auth = getAuthContext(c);
    const body = await c.req.json();
    const { text, axis } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return c.json({ error: 'Text is required and must be non-empty' }, 400);
    }

    if (!axis || typeof axis !== 'string') {
      return c.json({ error: 'Axis is required' }, 400);
    }

    // Generate embedding for the text
    const embedding = await generateEmbedding(c.env.AI, text);

    // Construct density matrix from embedding
    const rho = constructDensityMatrix(embedding);

    // Measure using Tetralemma POVM for the specified axis
    const measurement = await measureSentenceTetralemma(
      c.env.AI,
      text,
      axis
    );

    return c.json({
      weights: measurement.probabilities,
      coherence: measurement.coherence,
      axis: axis,
    });
  } catch (error: any) {
    console.error('POVM evaluation error:', error);
    return c.json(
      {
        error: 'POVM evaluation failed',
        details: error.message,
      },
      500
    );
  }
});

/**
 * POST /eval/rho
 *
 * Inspect density matrix properties of text
 *
 * Request body:
 * {
 *   "text": "The archive remembers what you forget."
 * }
 *
 * Response:
 * {
 *   "projections": [0.98, 0.02, ...], // top eigenvalues
 *   "purity": 0.42,
 *   "entropy": 1.85,
 *   "trace": 1.0
 * }
 */
analysisRoutes.post('/rho', async (c) => {
  try {
    const auth = getAuthContext(c);
    const body = await c.req.json();
    const { text } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return c.json({ error: 'Text is required and must be non-empty' }, 400);
    }

    // Generate embedding for the text
    const embedding = await generateEmbedding(c.env.AI, text);

    // Construct density matrix from embedding
    const rho = constructDensityMatrix(embedding);

    // Get top eigenvalues
    const topEigenvalues = getTopEigenvalues(rho, 10);

    return c.json({
      projections: topEigenvalues,
      purity: rho.purity,
      entropy: rho.entropy,
      trace: rho.trace,
    });
  } catch (error: any) {
    console.error('Rho inspection error:', error);
    return c.json(
      {
        error: 'Rho inspection failed',
        details: error.message,
      },
      500
    );
  }
});
