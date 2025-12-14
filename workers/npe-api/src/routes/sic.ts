/**
 * Subjective Intentional Constraint (SIC) Routes
 *
 * API endpoints for the SIC framework:
 * - POST /ai-detection/sic/sic - Core constraint evaluation
 * - POST /ai-detection/sic/style-check - Style consistency check
 * - POST /ai-detection/sic/profile/vet - Profile factory gate
 *
 * TERMINOLOGY:
 * - "sic" = Subjective Intentional Constraint (novel contribution)
 * - "style_check" = traditional stylometry (supporting tool)
 */

import { Hono } from 'hono';
import { requireAuth, optionalLocalAuth, getAuthContext } from '../middleware/auth';
import {
  SicEngine,
  NpeLlmAdapter,
  createExtractorAdapter,
  createJudgeAdapter,
  getAdapterConfigForTier,
  type SicResult,
  type StyleCheckResult,
  type ProfileVettingResult,
  type Genre,
} from '../services/sic';
import type { Env } from '../../shared/types';

const sicRoutes = new Hono<{ Bindings: Env }>();

/**
 * POST /ai-detection/sic/sic
 *
 * Core Subjective Intentional Constraint evaluation.
 * Measures the cost of authorship: commitment, tradeoff, irreversibility.
 *
 * Request body:
 * {
 *   text: string;           // Required: text to analyze
 *   genreHint?: Genre;      // Optional: skip genre detection
 *   maxChunks?: number;     // Optional: limit chunks analyzed
 * }
 *
 * Response: SicResult
 */
sicRoutes.post('/sic', optionalLocalAuth(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const body = await c.req.json() as {
      text: string;
      genreHint?: Genre;
      maxChunks?: number;
    };

    const { text, genreHint, maxChunks } = body;

    // Validate input
    if (!text || typeof text !== 'string') {
      return c.json({
        error: 'Missing required field: text',
        code: 'MISSING_TEXT',
      }, 400);
    }

    if (text.length < 50) {
      return c.json({
        error: 'Text too short for meaningful analysis (minimum 50 characters)',
        code: 'TEXT_TOO_SHORT',
      }, 400);
    }

    if (text.length > 50000) {
      return c.json({
        error: 'Text too long (maximum 50,000 characters)',
        code: 'TEXT_TOO_LONG',
      }, 400);
    }

    // Get user tier for adapter configuration
    const userRow = await c.env.DB.prepare(
      'SELECT tier FROM users WHERE id = ?'
    ).bind(auth.userId).first();

    const tier = (userRow?.tier as 'free' | 'reader' | 'author' | 'scholar') || 'free';
    const config = getAdapterConfigForTier(tier);

    // Create adapters
    const extractorAdapter = new NpeLlmAdapter(c.env, auth.userId, config.extractorModel);
    const judgeAdapter = new NpeLlmAdapter(c.env, auth.userId, config.judgeModel);

    // Create engine
    const engine = new SicEngine(extractorAdapter, judgeAdapter);

    // Run analysis
    const result = await engine.sic(text, {
      genreHint,
      maxChunks: maxChunks || config.maxChunks,
      skipGenreDetection: config.skipGenreDetection,
    });

    // Log analysis for metrics
    console.log(`SIC analysis: userId=${auth.userId}, tier=${tier}, sicScore=${result.sicScore}, aiProbability=${result.aiProbability}, genre=${result.genre}`);

    return c.json(result);
  } catch (error) {
    console.error('SIC analysis error:', error);
    return c.json({
      error: 'Analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'ANALYSIS_ERROR',
    }, 500);
  }
});

/**
 * POST /ai-detection/sic/style-check
 *
 * Style consistency check against a profile.
 * This is a supporting tool, NOT the novel contribution.
 *
 * Request body:
 * {
 *   text: string;           // Required: text to check
 *   profile: {              // Required: profile to compare against
 *     patterns?: string[];
 *     vocabulary?: string[];
 *     sentenceStructure?: string;
 *     formality?: 'informal' | 'neutral' | 'formal';
 *   }
 * }
 *
 * Response: StyleCheckResult
 */
sicRoutes.post('/style-check', optionalLocalAuth(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const body = await c.req.json() as {
      text: string;
      profile: {
        patterns?: string[];
        vocabulary?: string[];
        sentenceStructure?: string;
        formality?: 'informal' | 'neutral' | 'formal';
      };
    };

    const { text, profile } = body;

    // Validate input
    if (!text || typeof text !== 'string') {
      return c.json({
        error: 'Missing required field: text',
        code: 'MISSING_TEXT',
      }, 400);
    }

    if (!profile || typeof profile !== 'object') {
      return c.json({
        error: 'Missing required field: profile',
        code: 'MISSING_PROFILE',
      }, 400);
    }

    if (text.length > 20000) {
      return c.json({
        error: 'Text too long for style check (maximum 20,000 characters)',
        code: 'TEXT_TOO_LONG',
      }, 400);
    }

    // Create adapters (style check uses cheaper models)
    const adapter = createExtractorAdapter(c.env, auth.userId);

    // Create engine
    const engine = new SicEngine(adapter);

    // Run style check
    const result = await engine.style_check(profile, text);

    return c.json(result);
  } catch (error) {
    console.error('Style check error:', error);
    return c.json({
      error: 'Style check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'STYLE_CHECK_ERROR',
    }, 500);
  }
});

/**
 * POST /ai-detection/sic/profile/vet
 *
 * Vet a text sample for profile extraction suitability.
 * Used as a gate for the Profile Factory.
 *
 * Request body:
 * {
 *   sample: string;   // Required: text sample to vet
 * }
 *
 * Response: ProfileVettingResult
 */
sicRoutes.post('/profile/vet', optionalLocalAuth(), async (c) => {
  try {
    const auth = getAuthContext(c);
    const body = await c.req.json() as {
      sample: string;
    };

    const { sample } = body;

    // Validate input
    if (!sample || typeof sample !== 'string') {
      return c.json({
        error: 'Missing required field: sample',
        code: 'MISSING_SAMPLE',
      }, 400);
    }

    if (sample.length < 100) {
      return c.json({
        error: 'Sample too short for profile vetting (minimum 100 characters)',
        code: 'SAMPLE_TOO_SHORT',
      }, 400);
    }

    if (sample.length > 30000) {
      return c.json({
        error: 'Sample too long for profile vetting (maximum 30,000 characters)',
        code: 'SAMPLE_TOO_LONG',
      }, 400);
    }

    // Create adapter
    const adapter = createJudgeAdapter(c.env, auth.userId);

    // Create engine
    const engine = new SicEngine(adapter);

    // Run vetting
    const result = await engine.vetProfileText(sample);

    // Log vetting for metrics
    console.log(`Profile vetting: userId=${auth.userId}, suitable=${result.suitable}, qualityScore=${result.qualityScore}, sicScore=${result.sicScore}`);

    return c.json(result);
  } catch (error) {
    console.error('Profile vetting error:', error);
    return c.json({
      error: 'Profile vetting failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'VETTING_ERROR',
    }, 500);
  }
});

/**
 * GET /ai-detection/sic/health
 *
 * Health check endpoint for the SIC service.
 */
sicRoutes.get('/health', async (c) => {
  return c.json({
    status: 'ok',
    service: 'sic',
    version: 'sic.v1',
    description: 'Subjective Intentional Constraint - AI detection through constraint analysis',
  });
});

/**
 * GET /ai-detection/sic/features
 *
 * Return the feature categories used for SIC analysis.
 * Useful for documentation and UI building.
 */
sicRoutes.get('/features', async (c) => {
  const { FEATURE_DESCRIPTIONS, SIC_FEATURE_KEYS } = await import('../services/sic');

  return c.json({
    version: 'sic.v1',
    features: SIC_FEATURE_KEYS.map((key) => ({
      key,
      description: FEATURE_DESCRIPTIONS[key],
      type: key === 'meta_contamination' ? 'negative' : 'positive',
    })),
    positiveFeatures: [
      'commitment_irreversibility',
      'epistemic_risk_uncertainty',
      'time_pressure_tradeoffs',
      'situatedness_body_social',
      'scar_tissue_specificity',
      'bounded_viewpoint',
      'anti_smoothing',
    ],
    negativeFeatures: [
      'meta_contamination',
    ],
    coreInsight: 'Human language is not defined by how it flows, but by how it binds.',
  });
});

export default sicRoutes;
