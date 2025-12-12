/**
 * Profile Factory Routes
 *
 * User-facing endpoints for extracting style and persona profiles from text.
 * Available to paid tier users (pro, premium, admin).
 *
 * This is separate from admin-profiles.ts which is for managing global profiles.
 */

import { Hono } from 'hono';
import { requireAuth, getAuthContext } from '../middleware/auth';
import type { Env } from '../../shared/types';
import { createLLMProvider } from '../services/llm-providers';
import { hasCloudflareAI, detectEnvironment, getModelForUseCase } from '../config/llm-models';

const profileFactoryRoutes = new Hono<{ Bindings: Env }>();

// All routes require authentication
profileFactoryRoutes.use('*', requireAuth());

// Paid tier check middleware
const requirePaidTier = async (c: any, next: () => Promise<void>) => {
  const auth = getAuthContext(c);
  const paidTiers = ['pro', 'premium', 'admin'];

  if (!paidTiers.includes(auth.role || 'free')) {
    return c.json({
      error: 'Upgrade required',
      message: 'Profile Factory cloud extraction requires Pro tier or higher',
      currentTier: auth.role || 'free',
    }, 403);
  }

  await next();
};

// Style extraction prompt with vocabulary preservation rule
const STYLE_EXTRACTION_PROMPT = `You are a literary style analyst. Extract the distinctive WRITING STYLE from this text—the mechanical and aesthetic patterns, NOT the narrator's identity or worldview.

ANALYZE:
- Sentence architecture (length, complexity, punctuation patterns)
- Lexical register (formal/informal, vocabulary density)
- Figurative language density
- Rhetorical patterns (questions, parallelism, direct address)
- Pacing and rhythm

DO NOT ANALYZE: narrator beliefs, values, what they notice, why they're telling the story.

TEXT:
{TEXT}

OUTPUT FORMAT:
STYLE ANALYSIS: [2-3 sentences]
STYLE PROFILE:
- Sentence pattern: [describe]
- Register: [level]
- Figurative density: [sparse/moderate/dense]
- Rhetorical signature: [devices]
- Pacing: [describe]

TRANSFORMATION PROMPT:
[Start with "Apply this writing style:" - focus on mechanics only]`;

// Persona extraction prompt with 5-layer stack
const PERSONA_EXTRACTION_PROMPT = `You are a narrative voice analyst. Extract the distinctive PERSONA from this text—the narrator's identity as a perceiving, knowing, valuing entity. NOT the writing style (sentence patterns, vocabulary).

THE 5-LAYER PERSONA STACK:
1. ONTOLOGICAL POSITION - Is the world orderly, chaotic, improvable?
2. EPISTEMIC STANCE - How do they know things? Certainty level?
3. ATTENTION & SALIENCE - What do they notice? What's invisible?
4. NORMATIVE BIAS - What do they approve/disapprove (implicitly)?
5. READER RELATIONSHIP - Why tell this? Instructing, witnessing, persuading?

DO NOT ANALYZE: sentence length, vocabulary register, figurative language, punctuation.

TEXT:
{TEXT}

OUTPUT FORMAT:
PERSONA ANALYSIS: [2-3 sentences capturing WHO this narrator is]

THE 5 LAYERS:
1. Ontology: [worldview]
2. Epistemics: [how they know]
3. Attention: [what they notice]
4. Values: [implicit approvals/disapprovals]
5. Reader contract: [why tell this]

TRANSFORMATION PROMPT:
[Start with "Adopt the perspective of a narrator who..." - focus on worldview, not mechanics]`;

/**
 * POST /profiles/extract - Extract style or persona from sample text
 * Available to paid tier users (pro, premium, admin)
 * Uses cloud LLM for extraction
 */
profileFactoryRoutes.post('/extract', requirePaidTier, async (c) => {
  try {
    const auth = getAuthContext(c);
    const body = await c.req.json();

    const { text, type } = body;

    if (!text || text.length < 500) {
      return c.json({
        error: 'Text must be at least 500 characters',
        received: text?.length || 0,
      }, 400);
    }

    if (!type || !['style', 'persona'].includes(type)) {
      return c.json({ error: 'type must be "style" or "persona"' }, 400);
    }

    // Get appropriate model
    const hasAI = hasCloudflareAI(c.env);
    const environment = detectEnvironment(hasAI);
    const modelId = getModelForUseCase(type, environment);

    console.log(`[ProfileFactory] User: ${auth.userId}, Type: ${type}, Model: ${modelId}, Tier: ${auth.role}`);

    // Create LLM provider
    const llmProvider = await createLLMProvider(modelId, c.env, auth.userId);

    // Select extraction prompt
    const extractionPrompt = type === 'style'
      ? STYLE_EXTRACTION_PROMPT.replace('{TEXT}', text.substring(0, 3000))
      : PERSONA_EXTRACTION_PROMPT.replace('{TEXT}', text.substring(0, 3000));

    const systemPrompt = type === 'style'
      ? 'You are an expert literary style analyst. Extract writing mechanics precisely.'
      : 'You are an expert narrative voice analyst. Extract the narrator\'s epistemic stance and worldview.';

    // Run extraction
    const startTime = Date.now();
    const response = await llmProvider.generateText(extractionPrompt, {
      max_tokens: 2000,
      temperature: 0.7,
    });

    const duration = Date.now() - startTime;

    // Parse response
    let analysis = '';
    let profile = '';
    let transformationPrompt = '';

    if (type === 'style') {
      const analysisMatch = response.match(/STYLE ANALYSIS:\s*([\s\S]*?)(?=STYLE PROFILE:|TRANSFORMATION PROMPT:|$)/i);
      const profileMatch = response.match(/STYLE PROFILE:\s*([\s\S]*?)(?=TRANSFORMATION PROMPT:|$)/i);
      const promptMatch = response.match(/TRANSFORMATION PROMPT:\s*([\s\S]*?)$/i);

      analysis = analysisMatch ? analysisMatch[1].trim() : '';
      profile = profileMatch ? profileMatch[1].trim() : '';

      if (promptMatch) {
        transformationPrompt = promptMatch[1].trim();
        if (!transformationPrompt.toLowerCase().startsWith('apply')) {
          transformationPrompt = 'Apply this writing style: ' + transformationPrompt;
        }
        // Add vocabulary preservation rule
        transformationPrompt += '\n\nVOCABULARY RULE: Keep all specific nouns, names, and key terms from the original. Transform sentence structure and hedging style only.';
        transformationPrompt += '\n\nCRITICAL: Preserve ALL factual content. Transform ONLY the writing style mechanics.';
      }
    } else {
      const analysisMatch = response.match(/PERSONA ANALYSIS:\s*([\s\S]*?)(?=THE 5 LAYERS:|TRANSFORMATION PROMPT:|$)/i);
      const layersMatch = response.match(/THE 5 LAYERS:\s*([\s\S]*?)(?=TRANSFORMATION PROMPT:|$)/i);
      const promptMatch = response.match(/TRANSFORMATION PROMPT:\s*([\s\S]*?)$/i);

      analysis = analysisMatch ? analysisMatch[1].trim() : '';
      profile = layersMatch ? layersMatch[1].trim() : '';

      if (promptMatch) {
        transformationPrompt = promptMatch[1].trim();
        if (!transformationPrompt.toLowerCase().startsWith('adopt')) {
          transformationPrompt = 'Adopt the perspective of a narrator who ' + transformationPrompt;
        }
        // Add vocabulary preservation rule
        transformationPrompt += '\n\nVOCABULARY RULE: Keep all specific nouns, verbs, names, and key terms from the original. Only change the FRAMING and PERSPECTIVE, not the vocabulary.';
        transformationPrompt += '\n\nCRITICAL: Preserve ALL factual content and writing mechanics. Transform ONLY the epistemic stance.';
      }
    }

    return c.json({
      success: true,
      type,
      analysis,
      profile,
      transformationPrompt,
      model: modelId,
      durationMs: duration,
      sourceExcerpt: text.substring(0, 200),
    }, 200);
  } catch (error) {
    console.error('Error extracting profile:', error);
    return c.json({ error: 'Failed to extract profile' }, 500);
  }
});

/**
 * POST /profiles/test - Test a profile prompt with sample text
 * Available to paid tier users (pro, premium, admin)
 */
profileFactoryRoutes.post('/test', requirePaidTier, async (c) => {
  try {
    const auth = getAuthContext(c);
    const body = await c.req.json();

    const { prompt, text } = body;

    if (!prompt || prompt.length < 20) {
      return c.json({ error: 'Prompt must be at least 20 characters' }, 400);
    }

    if (!text || text.length < 50) {
      return c.json({ error: 'Text must be at least 50 characters' }, 400);
    }

    // Get appropriate model
    const hasAI = hasCloudflareAI(c.env);
    const environment = detectEnvironment(hasAI);
    const modelId = getModelForUseCase('style', environment); // Use style model for transformations

    console.log(`[ProfileFactory/Test] User: ${auth.userId}, Model: ${modelId}`);

    // Create LLM provider
    const llmProvider = await createLLMProvider(modelId, c.env, auth.userId);

    // Build the transformation prompt
    const fullPrompt = `${prompt}

Original text to transform:
---
${text.substring(0, 2000)}
---

Transformed text:`;

    // Run transformation
    const startTime = Date.now();
    const response = await llmProvider.generateText(fullPrompt, {
      max_tokens: 2000,
      temperature: 0.7,
    });

    const duration = Date.now() - startTime;

    // Strip any preamble
    let result = response.trim();
    if (result.toLowerCase().startsWith('here')) {
      const firstNewline = result.indexOf('\n');
      if (firstNewline > 0 && firstNewline < 100) {
        result = result.substring(firstNewline + 1).trim();
      }
    }

    return c.json({
      success: true,
      result,
      model: modelId,
      durationMs: duration,
    }, 200);
  } catch (error) {
    console.error('Error testing profile:', error);
    return c.json({ error: 'Failed to test profile' }, 500);
  }
});

/**
 * GET /profiles/capabilities - Check what the user can do
 */
profileFactoryRoutes.get('/capabilities', async (c) => {
  const auth = getAuthContext(c);
  const paidTiers = ['pro', 'premium', 'admin'];
  const canExtract = paidTiers.includes(auth.role || 'free');

  return c.json({
    canExtract,
    tier: auth.role || 'free',
    extractionTypes: canExtract ? ['style', 'persona'] : [],
    upgradeUrl: canExtract ? null : '/upgrade',
  });
});

export default profileFactoryRoutes;
