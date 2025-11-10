/**
 * Quantum Reading Analysis API Routes
 *
 * Endpoints:
 * - POST /quantum-analysis/start - Initialize quantum reading session
 * - POST /quantum-analysis/:id/step - Process next sentence
 * - GET /quantum-analysis/:id - Get session state
 * - GET /quantum-analysis/:id/trace - Get full reading history
 */

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, optionalLocalAuth, getAuthContext } from '../middleware/auth';
import {
  createMaximallyMixedState,
  constructDensityMatrix,
  updateDensityMatrixAfterMeasurement,
  serializeDensityMatrix,
  deserializeDensityMatrix,
  getTopEigenvalues,
  type DensityMatrixState
} from '../services/quantum-reading/density-matrix-simple';
import {
  generateEmbedding,
  splitIntoSentences
} from '../services/quantum-reading/embeddings';
import {
  measureSentenceTetralemma,
  type POVMMeasurementResult
} from '../services/quantum-reading/povm-measurement';

export const quantumAnalysisRoutes = new Hono();

// Apply auth middleware (optional for local dev)
quantumAnalysisRoutes.use('/*', optionalLocalAuth());

/**
 * POST /quantum-analysis/start
 *
 * Initialize quantum reading session
 *
 * Request body:
 * {
 *   "text": "The archive remembers what you forget. Each entry..."
 * }
 *
 * Response:
 * {
 *   "session_id": "uuid",
 *   "total_sentences": 15,
 *   "initial_rho": { purity, entropy, eigenvalues }
 * }
 */
quantumAnalysisRoutes.post('/start', async (c) => {
  try {
    const auth = getAuthContext(c);
    const userId = auth.userId;
    console.log('User ID:', userId);

    const body = await c.req.json();
    console.log('Request body:', body);
    const { text } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return c.json({ error: 'Text is required and must be non-empty' }, 400);
    }

    // Split text into sentences
    console.log('Splitting text into sentences...');
    const sentences = splitIntoSentences(text);
    console.log('Sentences found:', sentences.length);

    if (sentences.length === 0) {
      return c.json({ error: 'Could not parse any sentences from text' }, 400);
    }

    // Create maximally-mixed initial density matrix (ρ₀)
    console.log('Creating initial density matrix...');
    const initialRho = createMaximallyMixedState();
    console.log('Initial rho created, purity:', initialRho.purity);

    const sessionId = uuidv4();
    console.log('Session ID:', sessionId);

    // Store session in D1
    console.log('Storing session in D1...');
    await c.env.DB.prepare(`
      INSERT INTO quantum_analysis_sessions
      (id, user_id, text, total_sentences, current_sentence, initial_rho_json, current_rho_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      sessionId,
      userId,
      text,
      sentences.length,
      0,
      serializeDensityMatrix(initialRho),
      serializeDensityMatrix(initialRho)
    ).run();

    console.log('Session stored successfully');

    return c.json({
      session_id: sessionId,
      total_sentences: sentences.length,
      sentences: sentences,
      initial_rho: {
        purity: initialRho.purity,
        entropy: initialRho.entropy,
        top_eigenvalues: getTopEigenvalues(initialRho, 5)
      }
    }, 201);
  } catch (error) {
    console.error('Error in /start endpoint:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    return c.json({
      error: 'Failed to create session',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

/**
 * POST /quantum-analysis/:id/step
 *
 * Process next sentence in quantum reading session
 *
 * Response:
 * {
 *   "sentence_index": 0,
 *   "sentence": "The archive remembers what you forget.",
 *   "measurement": { literal, metaphorical, both, neither },
 *   "rho_after": { purity, entropy, top_eigenvalues },
 *   "done": false
 * }
 */
quantumAnalysisRoutes.post('/:id/step', async (c) => {
  const auth = getAuthContext(c);
  const userId = auth.userId;
  const sessionId = c.req.param('id');

  try {
    // Get session
    const session = await c.env.DB.prepare(`
      SELECT * FROM quantum_analysis_sessions WHERE id = ? AND user_id = ?
    `).bind(sessionId, userId).first();

    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }

    const currentSentenceIndex = session.current_sentence as number;
    const totalSentences = session.total_sentences as number;

    if (currentSentenceIndex >= totalSentences) {
      return c.json({ error: 'All sentences have been processed' }, 400);
    }

    // Get sentences
    const sentences = splitIntoSentences(session.text as string);
    const currentSentence = sentences[currentSentenceIndex];

    // Get current ρ
    const currentRho = deserializeDensityMatrix(session.current_rho_json as string);

    // Generate embedding for sentence
    const { embedding } = await generateEmbedding(c.env.AI, currentSentence);

    // Perform POVM measurement
    const measurement = await measureSentenceTetralemma(
      c.env.AI,
      currentSentence,
      currentSentenceIndex
    );

    // Update ρ based on measurement
    const updatedRho = updateDensityMatrixAfterMeasurement(currentRho, embedding);

    // Store measurement in database
    const measurementId = uuidv4();
    await c.env.DB.prepare(`
      INSERT INTO quantum_measurements
      (id, session_id, sentence_index, sentence,
       prob_literal, prob_metaphorical, prob_both, prob_neither,
       evidence_literal, evidence_metaphorical, evidence_both, evidence_neither,
       rho_purity, rho_entropy, rho_top_eigenvalues)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      measurementId,
      sessionId,
      currentSentenceIndex,
      currentSentence,
      measurement.measurement.literal.probability,
      measurement.measurement.metaphorical.probability,
      measurement.measurement.both.probability,
      measurement.measurement.neither.probability,
      measurement.measurement.literal.evidence,
      measurement.measurement.metaphorical.evidence,
      measurement.measurement.both.evidence,
      measurement.measurement.neither.evidence,
      updatedRho.purity,
      updatedRho.entropy,
      JSON.stringify(getTopEigenvalues(updatedRho, 5))
    ).run();

    // Update session with new ρ and increment sentence index
    await c.env.DB.prepare(`
      UPDATE quantum_analysis_sessions
      SET current_sentence = ?, current_rho_json = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      currentSentenceIndex + 1,
      serializeDensityMatrix(updatedRho),
      sessionId
    ).run();

    const done = (currentSentenceIndex + 1) >= totalSentences;

    return c.json({
      sentence_index: currentSentenceIndex,
      sentence: currentSentence,
      measurement: {
        literal: measurement.measurement.literal,
        metaphorical: measurement.measurement.metaphorical,
        both: measurement.measurement.both,
        neither: measurement.measurement.neither
      },
      rho_before: {
        purity: currentRho.purity,
        entropy: currentRho.entropy,
        top_eigenvalues: getTopEigenvalues(currentRho, 5)
      },
      rho_after: {
        purity: updatedRho.purity,
        entropy: updatedRho.entropy,
        top_eigenvalues: getTopEigenvalues(updatedRho, 5)
      },
      done,
      next_sentence_index: done ? null : currentSentenceIndex + 1
    }, 200);
  } catch (error) {
    console.error('Error processing quantum step:', error);
    return c.json({ error: 'Failed to process step' }, 500);
  }
});

/**
 * GET /quantum-analysis/:id
 *
 * Get current state of quantum reading session
 */
quantumAnalysisRoutes.get('/:id', async (c) => {
  const auth = getAuthContext(c);
  const userId = auth.userId;
  const sessionId = c.req.param('id');

  try {
    const session = await c.env.DB.prepare(`
      SELECT * FROM quantum_analysis_sessions WHERE id = ? AND user_id = ?
    `).bind(sessionId, userId).first();

    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }

    const currentRho = deserializeDensityMatrix(session.current_rho_json as string);
    const sentences = splitIntoSentences(session.text as string);

    return c.json({
      session_id: session.id,
      total_sentences: session.total_sentences,
      current_sentence: session.current_sentence,
      sentences: sentences,
      current_rho: {
        purity: currentRho.purity,
        entropy: currentRho.entropy,
        top_eigenvalues: getTopEigenvalues(currentRho, 5)
      },
      created_at: session.created_at,
      updated_at: session.updated_at
    }, 200);
  } catch (error) {
    console.error('Error getting quantum session:', error);
    return c.json({ error: 'Failed to get session' }, 500);
  }
});

/**
 * GET /quantum-analysis/:id/trace
 *
 * Get full reading history with all measurements
 */
quantumAnalysisRoutes.get('/:id/trace', async (c) => {
  const auth = getAuthContext(c);
  const userId = auth.userId;
  const sessionId = c.req.param('id');

  try {
    // Get session
    const session = await c.env.DB.prepare(`
      SELECT * FROM quantum_analysis_sessions WHERE id = ? AND user_id = ?
    `).bind(sessionId, userId).first();

    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }

    // Get all measurements
    const measurements = await c.env.DB.prepare(`
      SELECT * FROM quantum_measurements
      WHERE session_id = ?
      ORDER BY sentence_index ASC
    `).bind(sessionId).all();

    const trace = measurements.results.map(m => ({
      sentence_index: m.sentence_index,
      sentence: m.sentence,
      measurement: {
        literal: {
          probability: m.prob_literal,
          evidence: m.evidence_literal
        },
        metaphorical: {
          probability: m.prob_metaphorical,
          evidence: m.evidence_metaphorical
        },
        both: {
          probability: m.prob_both,
          evidence: m.evidence_both
        },
        neither: {
          probability: m.prob_neither,
          evidence: m.evidence_neither
        }
      },
      rho: {
        purity: m.rho_purity,
        entropy: m.rho_entropy,
        top_eigenvalues: JSON.parse(m.rho_top_eigenvalues as string)
      }
    }));

    return c.json({
      session_id: session.id,
      total_sentences: session.total_sentences,
      trace
    }, 200);
  } catch (error) {
    console.error('Error getting quantum trace:', error);
    return c.json({ error: 'Failed to get trace' }, 500);
  }
});
