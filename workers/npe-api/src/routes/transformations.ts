// Transformation routes for NPE Workers API
import { Hono } from 'hono';
import { requireAuth, optionalLocalAuth, getAuthContext, requireProPlus } from '../middleware/auth';
import { AllegoricalProjectionService } from '../services/allegorical';
import { RoundTripTranslationService } from '../services/round_trip';
import { MaieuticDialogueService } from '../services/maieutic';
import { transformWithPersonalizer, getTransformationHistory } from '../services/personalizer';
import { humanizeText, analyzeForHumanization, type HumanizationOptions } from '../services/computer-humanizer';
import { checkQuota, updateUsage } from '../middleware/tier-check';
import { saveTransformationToHistory, updateTransformationHistory } from '../utils/transformation-history-helper';
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
transformationRoutes.post('/allegorical', optionalLocalAuth(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const body = await c.req.json() as AllegoricalProjectionRequest & {
      model?: string;
      length_preference?: 'shorter' | 'same' | 'longer' | 'much_longer';
    };
    const { text, persona, namespace, style, model, length_preference } = body;

    // Validate input
    if (!text || !persona || !namespace || !style) {
      return c.json({ error: 'Missing required fields: text, persona, namespace, style' }, 400);
    }

    if (text.length > 10000) {
      return c.json({ error: 'Text too long (max 10,000 characters)' }, 400);
    }

    // Fetch user preferences if model/length not specified
    let selectedModel = model;
    let selectedLength = length_preference;

    if (!selectedModel || !selectedLength) {
      const userPrefsRow = await c.env.DB.prepare(
        'SELECT preferred_model, preferred_length FROM users WHERE id = ?'
      ).bind(auth.userId).first();

      if (userPrefsRow) {
        selectedModel = selectedModel || (userPrefsRow.preferred_model as string) || '@cf/meta/llama-3.1-8b-instruct';
        selectedLength = selectedLength || (userPrefsRow.preferred_length as any) || 'same';
      } else {
        selectedModel = selectedModel || '@cf/meta/llama-3.1-8b-instruct';
        selectedLength = selectedLength || 'same';
      }
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

    // Generate transformation ID
    const transformationId = crypto.randomUUID();

    // Save to history before starting (status: pending)
    try {
      await saveTransformationToHistory(c.env.DB, {
        id: transformationId,
        user_id: auth.userId,
        transformation_type: 'allegorical',
        input_text: text,
        input_params: { persona, namespace, style, model: selectedModel, length_preference: selectedLength }
      });
    } catch (err) {
      console.error('[Transformation History] Failed to save:', err);
      // Continue with transformation even if history save fails
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
      },
      auth.userId,
      selectedModel,
      selectedLength as 'shorter' | 'same' | 'longer' | 'much_longer'
    );

    // Run transformation
    try {
      const result = await service.transform(text);

      const response: AllegoricalProjectionResponse = {
        transformation_id: result.transformation_id,
        final_projection: result.final_projection,
        reflection: result.reflection,
        stages: result.stages
      };

      // Update history on success
      try {
        await updateTransformationHistory(c.env.DB, {
          id: transformationId,
          user_id: auth.userId,
          status: 'completed',
          output_data: response
        });
      } catch (err) {
        console.error('[Transformation History] Failed to update:', err);
      }

      return c.json(response, 200);
    } catch (transformError) {
      // Update history on failure
      try {
        await updateTransformationHistory(c.env.DB, {
          id: transformationId,
          user_id: auth.userId,
          status: 'failed',
          error_message: transformError instanceof Error ? transformError.message : 'Transformation failed'
        });
      } catch (err) {
        console.error('[Transformation History] Failed to update error:', err);
      }
      throw transformError;
    }
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
transformationRoutes.post('/round-trip', optionalLocalAuth(), async (c) => {
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

    // Generate transformation ID
    const transformationId = crypto.randomUUID();

    // Save to history before starting
    try {
      await saveTransformationToHistory(c.env.DB, {
        id: transformationId,
        user_id: auth.userId,
        transformation_type: 'round-trip',
        input_text: text,
        input_params: { intermediate_language }
      });
    } catch (err) {
      console.error('[Transformation History] Failed to save:', err);
    }

    // Create service
    const service = new RoundTripTranslationService(c.env);

    // Run round-trip
    try {
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

      // Update history on success
      try {
        await updateTransformationHistory(c.env.DB, {
          id: transformationId,
          user_id: auth.userId,
          status: 'completed',
          output_data: response
        });
      } catch (err) {
        console.error('[Transformation History] Failed to update:', err);
      }

      return c.json(response, 200);
    } catch (transformError) {
      // Update history on failure
      try {
        await updateTransformationHistory(c.env.DB, {
          id: transformationId,
          user_id: auth.userId,
          status: 'failed',
          error_message: transformError instanceof Error ? transformError.message : 'Transformation failed'
        });
      } catch (err) {
        console.error('[Transformation History] Failed to update error:', err);
      }
      throw transformError;
    }
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
transformationRoutes.post('/maieutic/start', optionalLocalAuth(), async (c) => {
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
transformationRoutes.post('/maieutic/:sessionId/respond', optionalLocalAuth(), async (c) => {
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
transformationRoutes.get('/maieutic/:sessionId', optionalLocalAuth(), async (c) => {
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

/**
 * POST /transformations/personalizer - Transform text using discovered personas/styles
 * Requires PRO+ tier
 *
 * Transform text to express content through user's authentic discovered voices
 */
transformationRoutes.post('/personalizer', optionalLocalAuth(), requireProPlus(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const { text, persona_id, style_id, model } = await c.req.json();

    // Validate input
    if (!text || text.trim().length === 0) {
      return c.json({ error: 'Missing required field: text' }, 400);
    }

    if (text.length > 5000) {
      return c.json({ error: 'Text too long (max 5,000 characters)' }, 400);
    }

    // At least one of persona_id or style_id must be provided
    if (!persona_id && !style_id) {
      return c.json({ error: 'Must provide at least one of: persona_id or style_id' }, 400);
    }

    // Estimate tokens for quota check
    const estimatedTokens = Math.ceil(text.length / 4) * 3; // Input + output + prompt

    // Check quota
    try {
      await checkQuota(c.env, auth.userId, auth.role, estimatedTokens);
    } catch (error) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 429);
      }
      throw error;
    }

    // Use user's preferred model if not specified
    let selectedModel = model;
    if (!selectedModel) {
      const userPrefs = await c.env.DB.prepare(
        'SELECT preferred_model FROM users WHERE id = ?'
      ).bind(auth.userId).first();

      selectedModel = (userPrefs?.preferred_model as string) || '@cf/meta/llama-3.1-8b-instruct';
    }

    // Transform text
    const result = await transformWithPersonalizer(
      c.env,
      auth.userId,
      text,
      persona_id,
      style_id,
      selectedModel
    );

    // Update usage
    await updateUsage(c.env, auth.userId, result.tokensUsed);

    return c.json({
      transformation_id: result.transformationId,
      output_text: result.outputText,
      semantic_similarity: result.semanticSimilarity,
      tokens_used: result.tokensUsed,
      model_used: result.modelUsed
    }, 200);
  } catch (error) {
    console.error('Personalizer transformation error:', error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('does not belong')) {
        return c.json({ error: error.message }, 404);
      }
      if (error.message.includes('empty output')) {
        return c.json({ error: error.message }, 500);
      }
    }

    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /transformations/personalizer/history - Get transformation history
 * Requires PRO+ tier
 *
 * Retrieve user's personalizer transformation history
 */
transformationRoutes.get('/personalizer/history', optionalLocalAuth(), requireProPlus(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const limit = parseInt(c.req.query('limit') || '10', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    // Validate pagination params
    if (limit < 1 || limit > 100) {
      return c.json({ error: 'Limit must be between 1 and 100' }, 400);
    }

    if (offset < 0) {
      return c.json({ error: 'Offset must be non-negative' }, 400);
    }

    const history = await getTransformationHistory(c.env, auth.userId, limit, offset);

    return c.json({
      transformations: history,
      limit,
      offset
    }, 200);
  } catch (error) {
    console.error('Get personalizer history error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /transformations/computer-humanizer - Humanize AI-generated text
 *
 * Transforms AI text to reduce detection while preserving meaning
 * Uses hybrid approach: statistical + rule-based + optional LLM
 */
transformationRoutes.post('/computer-humanizer', optionalLocalAuth(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const body = await c.req.json();
    const {
      text,
      intensity = 'moderate',
      voiceSamples = [],
      enableLLMPolish = true,
      targetBurstiness = 60,
      targetLexicalDiversity = 60
    } = body;

    // Validate input
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return c.json({ error: 'Missing required field: text' }, 400);
    }

    if (text.length > 10000) {
      return c.json({ error: 'Text too long (max 10,000 characters)' }, 400);
    }

    if (!['light', 'moderate', 'aggressive'].includes(intensity)) {
      return c.json({ error: 'Invalid intensity. Must be: light, moderate, or aggressive' }, 400);
    }

    // Validate voice samples if provided
    if (voiceSamples && !Array.isArray(voiceSamples)) {
      return c.json({ error: 'voiceSamples must be an array of strings' }, 400);
    }

    if (voiceSamples && voiceSamples.length > 10) {
      return c.json({ error: 'Maximum 10 voice samples allowed' }, 400);
    }

    // Generate transformation ID
    const transformationId = crypto.randomUUID();

    // Save to history before starting
    try {
      await saveTransformationToHistory(c.env.DB, {
        id: transformationId,
        user_id: auth.userId,
        transformation_type: 'computer-humanizer',
        input_text: text,
        input_params: {
          intensity,
          voiceSamplesCount: voiceSamples?.length || 0,
          enableLLMPolish,
          targetBurstiness,
          targetLexicalDiversity
        }
      });
    } catch (err) {
      console.error('[Transformation History] Failed to save:', err);
      // Continue with transformation even if history save fails
    }

    // Build options
    const options: HumanizationOptions = {
      intensity: intensity as 'light' | 'moderate' | 'aggressive',
      voiceSamples: voiceSamples || undefined,
      enableLLMPolish,
      targetBurstiness,
      targetLexicalDiversity
    };

    // Run humanization
    try {
      const result = await humanizeText(c.env, text, options);

      const response = {
        transformation_id: transformationId,
        humanizedText: result.humanizedText,
        baseline: result.baseline,
        final: result.final,
        improvement: result.improvement,
        stages: result.stages,
        voiceProfile: result.voiceProfile,
        processing: result.processing
      };

      // Update history on success
      try {
        await updateTransformationHistory(c.env.DB, {
          id: transformationId,
          user_id: auth.userId,
          status: 'completed',
          output_data: response
        });
      } catch (err) {
        console.error('[Transformation History] Failed to update:', err);
      }

      return c.json(response, 200);
    } catch (transformError) {
      // Update history on failure
      try {
        await updateTransformationHistory(c.env.DB, {
          id: transformationId,
          user_id: auth.userId,
          status: 'failed',
          error_message: transformError instanceof Error ? transformError.message : 'Humanization failed'
        });
      } catch (err) {
        console.error('[Transformation History] Failed to update error:', err);
      }
      throw transformError;
    }
  } catch (error) {
    console.error('Computer humanizer error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, 500);
  }
});

/**
 * POST /transformations/computer-humanizer/analyze - Analyze text for humanization needs
 *
 * Returns recommendation and current AI detection metrics
 */
transformationRoutes.post('/computer-humanizer/analyze', optionalLocalAuth(), async (c) => {
  try {
    const body = await c.req.json();
    const { text } = body;

    // Validate input
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return c.json({ error: 'Missing required field: text' }, 400);
    }

    if (text.length > 10000) {
      return c.json({ error: 'Text too long (max 10,000 characters)' }, 400);
    }

    // Analyze text
    const analysis = await analyzeForHumanization(text);

    return c.json({
      needsHumanization: analysis.needsHumanization,
      recommendation: analysis.recommendation,
      currentMetrics: analysis.currentMetrics,
      reasons: analysis.reasons
    }, 200);
  } catch (error) {
    console.error('Computer humanizer analyze error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, 500);
  }
});

export default transformationRoutes;
