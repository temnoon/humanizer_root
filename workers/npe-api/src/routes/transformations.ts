// Transformation routes for NPE Workers API
import { Hono } from 'hono';
import { requireAuth, getAuthContext } from '../middleware/auth';
import { AllegoricalProjectionService } from '../services/allegorical';
import { RoundTripTranslationService } from '../services/round_trip';
import { MaieuticDialogueService } from '../services/maieutic';
import type {
  Env,
  AllegoricalProjectionRequest,
  AllegoricalProjectionResponse,
  RoundTripTranslationRequest,
  RoundTripTranslationResponse,
  MaieuticStartRequest,
  MaieuticStartResponse,
  MaieuticRespondRequest,
  MaieuticRespondResponse
} from '../../shared/types';

const transformationRoutes = new Hono<{ Bindings: Env }>();

/**
 * POST /transformations/allegorical - Create allegorical projection
 *
 * Transform narrative through 5-stage pipeline with persona, namespace, and style
 */
transformationRoutes.post('/allegorical', requireAuth(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const { text, persona, namespace, style }: AllegoricalProjectionRequest = await c.req.json();

    // Validate input
    if (!text || !persona || !namespace || !style) {
      return c.json({ error: 'Missing required fields: text, persona, namespace, style' }, 400);
    }

    if (text.length > 10000) {
      return c.json({ error: 'Text too long (max 10,000 characters)' }, 400);
    }

    // Fetch persona from database
    const personaRow = await c.env.DB.prepare(
      'SELECT * FROM npe_personas WHERE name = ?'
    ).bind(persona).first();

    if (!personaRow) {
      return c.json({ error: `Invalid persona: ${persona}` }, 400);
    }

    // Fetch namespace from database
    const namespaceRow = await c.env.DB.prepare(
      'SELECT * FROM npe_namespaces WHERE name = ?'
    ).bind(namespace).first();

    if (!namespaceRow) {
      return c.json({ error: `Invalid namespace: ${namespace}` }, 400);
    }

    // Fetch style from database
    const styleRow = await c.env.DB.prepare(
      'SELECT * FROM npe_styles WHERE name = ?'
    ).bind(style).first();

    if (!styleRow) {
      return c.json({ error: `Invalid style: ${style}` }, 400);
    }

    // Create service
    const service = new AllegoricalProjectionService(
      c.env,
      {
        id: personaRow.id as number,
        name: personaRow.name as string,
        description: personaRow.description as string,
        system_prompt: personaRow.system_prompt as string
      },
      {
        id: namespaceRow.id as number,
        name: namespaceRow.name as string,
        description: namespaceRow.description as string,
        context_prompt: namespaceRow.context_prompt as string
      },
      {
        id: styleRow.id as number,
        name: styleRow.name as string,
        style_prompt: styleRow.style_prompt as string
      }
    );

    // Run transformation
    const result = await service.transform(text, auth.userId);

    const response: AllegoricalProjectionResponse = {
      transformation_id: result.transformation_id,
      final_projection: result.final_projection,
      reflection: result.reflection,
      stages: result.stages
    };

    return c.json(response, 200);
  } catch (error) {
    console.error('Allegorical projection error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /transformations/round-trip - Run round-trip translation analysis
 *
 * Translate text to intermediate language and back, analyzing semantic drift
 */
transformationRoutes.post('/round-trip', requireAuth(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const { text, intermediate_language }: RoundTripTranslationRequest = await c.req.json();

    // Validate input
    if (!text || !intermediate_language) {
      return c.json({ error: 'Missing required fields: text, intermediate_language' }, 400);
    }

    if (text.length > 5000) {
      return c.json({ error: 'Text too long (max 5,000 characters)' }, 400);
    }

    if (!RoundTripTranslationService.isLanguageSupported(intermediate_language)) {
      return c.json({
        error: `Unsupported language: ${intermediate_language}`,
        supported_languages: RoundTripTranslationService.getSupportedLanguages()
      }, 400);
    }

    // Create service
    const service = new RoundTripTranslationService(c.env);

    // Run round-trip
    const result = await service.performRoundTrip(text, intermediate_language, auth.userId);

    const response: RoundTripTranslationResponse = {
      transformation_id: result.transformation_id,
      forward_translation: result.forward_translation,
      backward_translation: result.backward_translation,
      semantic_drift: result.semantic_drift,
      preserved_elements: result.preserved_elements,
      lost_elements: result.lost_elements,
      gained_elements: result.gained_elements
    };

    return c.json(response, 200);
  } catch (error) {
    console.error('Round-trip translation error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /transformations/maieutic/start - Start maieutic dialogue session
 *
 * Begin Socratic questioning dialogue to explore narrative meaning
 */
transformationRoutes.post('/maieutic/start', requireAuth(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const { text, goal }: MaieuticStartRequest = await c.req.json();

    // Validate input
    if (!text) {
      return c.json({ error: 'Missing required field: text' }, 400);
    }

    if (text.length > 5000) {
      return c.json({ error: 'Text too long (max 5,000 characters)' }, 400);
    }

    // Create service
    const service = new MaieuticDialogueService(c.env);

    // Start session
    const result = await service.startSession(text, goal || 'understand', auth.userId);

    const response: MaieuticStartResponse = {
      session_id: result.session_id,
      question: result.question,
      depth_level: result.depth_level
    };

    return c.json(response, 200);
  } catch (error) {
    console.error('Maieutic start error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /transformations/maieutic/:sessionId/respond - Continue maieutic dialogue
 *
 * Provide answer to question and receive next question or final understanding
 */
transformationRoutes.post('/maieutic/:sessionId/respond', requireAuth(), async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const { answer }: MaieuticRespondRequest = await c.req.json();

    // Validate input
    if (!answer) {
      return c.json({ error: 'Missing required field: answer' }, 400);
    }

    if (answer.length > 2000) {
      return c.json({ error: 'Answer too long (max 2,000 characters)' }, 400);
    }

    // Create service
    const service = new MaieuticDialogueService(c.env);

    // Continue dialogue
    const result = await service.respondToQuestion(sessionId, answer);

    const response: MaieuticRespondResponse = {
      turn_number: result.turn_number,
      depth_level: result.depth_level,
      question: result.question || '',
      insights: result.insights,
      is_complete: result.is_complete,
      final_understanding: result.final_understanding
    };

    return c.json(response, 200);
  } catch (error) {
    console.error('Maieutic respond error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /transformations/maieutic/:sessionId - Get session state
 *
 * Retrieve current state of maieutic dialogue session
 */
transformationRoutes.get('/maieutic/:sessionId', requireAuth(), async (c) => {
  try {
    const sessionId = c.req.param('sessionId');

    // Create service
    const service = new MaieuticDialogueService(c.env);

    // Get state
    const state = await service.getSessionState(sessionId);

    return c.json(state, 200);
  } catch (error) {
    console.error('Maieutic get state error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default transformationRoutes;
