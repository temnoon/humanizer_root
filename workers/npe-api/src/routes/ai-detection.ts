// AI Detection Routes
// Endpoints for detecting AI-generated text

import { Hono } from 'hono';
import type { Env } from '../../shared/types';
import { requireAuth, optionalLocalAuth, getAuthContext } from '../middleware/auth';
import { saveTransformationToHistory, updateTransformationHistory } from '../utils/transformation-history-helper';
import { detectWithLite, detectWithLiteMarkdown } from '../services/lite-detector';

const app = new Hono<{ Bindings: Env }>();

// Test endpoint
app.get('/test', (c) => {
  return c.json({ message: 'AI Detection routes loaded successfully' });
});

// Simple test endpoint without auth
app.post('/test-detect', async (c) => {
  try {
    const body = await c.req.json();
    return c.json({ message: 'Test detect successful', received: body });
  } catch (err) {
    console.error('[AI Detection] Test error:', err);
    return c.json({ error: String(err) }, 500);
  }
});

/**
 * POST /ai-detection/detect
 * GPTZero Pro/Premium AI Detection - ALWAYS calls GPTZero API
 *
 * Request:
 * {
 *   text: string            // Text to analyze (min 20 words, max 50k chars)
 * }
 *
 * Response:
 * {
 *   verdict: 'human' | 'ai' | 'mixed',
 *   confidence: number,      // 0-100 (from GPTZero completely_generated_prob)
 *   explanation: string,     // Human-readable explanation
 *   method: 'gptzero',       // Always 'gptzero' - never falls back
 *   details: {
 *     completely_generated_prob: number,
 *     average_generated_prob: number,
 *     sentences: Array<{sentence, generated_prob}>
 *   },
 *   classVersion: string,    // GPTZero model version
 *   modelVersion: string,    // GPTZero model version
 *   processingTimeMs: number,
 *   apiCallLogged: boolean   // Confirms API was actually called
 * }
 */
app.post('/detect', optionalLocalAuth(), async (c) => {
  const startTime = Date.now();

  try {
    // Get user info from auth context
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    // Check user tier (Pro/Premium/Admin only)
    if (auth.role !== 'pro' && auth.role !== 'premium' && auth.role !== 'admin') {
      return c.json({
        error: 'GPTZero detection requires Pro or Premium subscription',
        userTier: auth.role,
        upgradeRequired: true
      }, 403);
    }

    // Parse request body
    const body = await c.req.json();
    const { text } = body;

    // Validate input
    if (!text || typeof text !== 'string') {
      return c.json({ error: 'Text is required' }, 400);
    }

    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      return c.json({ error: 'Text cannot be empty' }, 400);
    }

    const words = trimmedText.split(/\s+/).filter(w => w.length > 0);
    if (words.length < 20) {
      return c.json({ error: 'Text must be at least 20 words for accurate detection' }, 400);
    }

    if (trimmedText.length > 50000) {
      return c.json({ error: 'Text too long (max 50,000 characters for GPTZero)' }, 400);
    }

    // Get GPTZero API key from environment (REQUIRED)
    const apiKey = c.env.GPTZERO_API_KEY;
    if (!apiKey) {
      console.error('[GPTZero Detection] API key not configured');
      return c.json({
        error: 'GPTZero API not configured. Please contact support.',
        apiKeyMissing: true
      }, 503);
    }

    // Generate transformation ID
    const transformationId = crypto.randomUUID();

    // Save to history before starting
    try {
      await saveTransformationToHistory(c.env.DB, {
        id: transformationId,
        user_id: auth.userId,
        transformation_type: 'ai-detection-gptzero',
        input_text: trimmedText,
        input_params: { method: 'gptzero', apiCalled: true }
      });
    } catch (err) {
      console.error('[Transformation History] Failed to save:', err);
    }

    // ALWAYS call GPTZero API - NO FALLBACK (with markdown awareness)
    try {
      const { detectAIWithGPTZeroMarkdown } = await import('../services/ai-detection/gptzero-client');
      const result = await detectAIWithGPTZeroMarkdown(trimmedText, apiKey);

      const processingTimeMs = Date.now() - startTime;

      // Format response with premium GPTZero features (including markdown highlights)
      const response = {
        verdict: result.verdict,
        confidence: result.confidence, // Now includes 3 decimal places
        explanation: result.result_message || `GPTZero API: ${result.verdict === 'ai' ? 'Likely AI-generated' : result.verdict === 'human' ? 'Likely human-written' : 'Mixed/Uncertain'}`,
        method: 'gptzero' as const,
        details: result.details, // Now includes highlighted sentences and paragraphs
        result_message: result.result_message,
        confidence_category: result.confidence_category,
        subclass_type: result.subclass_type,
        classVersion: result.classVersion,
        modelVersion: result.modelVersion,
        highlightedMarkdown: result.highlightedMarkdown, // Markdown with <mark> tags for AI sentences
        processingTimeMs,
        apiCallLogged: true
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

      return c.json(response);

    } catch (apiError) {
      const processingTimeMs = Date.now() - startTime;

      // Log API call FAILURE
      console.error('[GPTZero Detection] API CALL FAILED', {
        transformationId,
        error: apiError instanceof Error ? apiError.message : 'Unknown error',
        processingTimeMs,
        timestamp: new Date().toISOString()
      });

      // Update history with error
      try {
        await updateTransformationHistory(c.env.DB, {
          id: transformationId,
          user_id: auth.userId,
          status: 'failed',
          error_message: apiError instanceof Error ? apiError.message : 'GPTZero API call failed'
        });
      } catch (err) {
        console.error('[Transformation History] Failed to update error:', err);
      }

      // Return HONEST error to user - NO MOCK RESULTS
      const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown API error';
      return c.json({
        error: `GPTZero API Error: ${errorMessage}`,
        method: 'gptzero',
        apiCallFailed: true,
        processingTimeMs
      }, 500);
    }

  } catch (error) {
    console.error('[GPTZero Detection] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: errorMessage }, 500);
  }
});

/**
 * POST /ai-detection/lite
 * Free-tier AI detection using heuristic analysis
 *
 * Request:
 * {
 *   text: string,              // Text to analyze (min 20 words)
 *   useLLMJudge?: boolean      // Use Cloudflare AI for refinement (default: false)
 * }
 *
 * Response:
 * {
 *   detector_type: 'lite',
 *   ai_likelihood: number,     // 0-1 score
 *   confidence: 'low' | 'medium' | 'high',
 *   label: 'likely_human' | 'mixed' | 'likely_ai',
 *   metrics: {
 *     burstiness: number,
 *     avgSentenceLength: number,
 *     sentenceLengthStd: number,
 *     typeTokenRatio: number,
 *     repeatedNgrams: number
 *   },
 *   phraseHits: Array<{phrase, count, weight, category}>,
 *   highlights: Array<{start, end, reason, score}>,
 *   heuristicScore: number,
 *   llmScore?: number
 * }
 */
app.post('/lite', async (c) => {
  try {
    // Get user info from auth context (optional for free tier)
    let auth = null;
    try {
      auth = getAuthContext(c);
    } catch (e) {
      // No auth context - that's fine for Lite detector
    }
    const userId = auth?.userId || null;

    // Parse request body
    const body = await c.req.json();
    const { text, useLLMJudge = false } = body;

    // Validate input
    if (!text || typeof text !== 'string') {
      return c.json({ error: 'Text is required' }, 400);
    }

    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      return c.json({ error: 'Text cannot be empty' }, 400);
    }

    const words = trimmedText.split(/\s+/).filter(w => w.length > 0);
    if (words.length < 20) {
      return c.json({ error: 'Text must be at least 20 words for accurate detection' }, 400);
    }

    // Run Lite detection (markdown-aware)
    const startTime = Date.now();
    const result = await detectWithLiteMarkdown(trimmedText, useLLMJudge, c.env.AI);
    const processingTimeMs = Date.now() - startTime;

    // Save to database if user is authenticated
    if (userId && c.env.DB) {
      try {
        const runId = crypto.randomUUID();
        const now = Date.now();

        await c.env.DB.prepare(`
          INSERT INTO detector_runs (
            id, user_id, detector_type, ai_likelihood, confidence, label,
            metrics_json, quota_used, quota_remaining, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          runId,
          userId,
          'lite',
          result.ai_likelihood,
          result.confidence,
          result.label,
          JSON.stringify({
            metrics: result.metrics,
            phraseHits: result.phraseHits,
            highlights: result.highlights,
            heuristicScore: result.heuristicScore,
            llmScore: result.llmScore
          }),
          0, // No quota used for Lite detector
          null, // No quota remaining
          now
        ).run();
      } catch (dbError) {
        console.error('[Lite Detection] Failed to save to database:', dbError);
        // Don't fail the request if DB save fails
      }
    }

    // Return result with processing time
    return c.json({
      ...result,
      processingTimeMs
    });
  } catch (error) {
    console.error('Lite detection error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: errorMessage }, 500);
  }
});

/**
 * GET /ai-detection/status
 * Check API availability and configuration
 *
 * Response:
 * {
 *   localDetection: true,
 *   apiDetection: boolean,    // True if GPTZero API key configured
 *   userTier: string,
 *   canUseAPI: boolean        // True if user has PRO+ tier and API key available
 * }
 */
app.get('/status', optionalLocalAuth(), async (c) => {
  try {
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const hasAPIKey = Boolean(c.env.GPTZERO_API_KEY);
    const isProPlus = auth.role === 'pro' || auth.role === 'premium' || auth.role === 'admin';

    return c.json({
      localDetection: true,
      apiDetection: hasAPIKey,
      userTier: auth.role,
      canUseAPI: hasAPIKey && isProPlus
    });
  } catch (error) {
    console.error('Status check error:', error);
    return c.json({ error: 'Failed to check status' }, 500);
  }
});

/**
 * GET /ai-detection/tell-words
 * Get the dictionary of AI tell-words (for reference/transparency)
 *
 * Response:
 * {
 *   categories: Array<{
 *     category: string,
 *     words: string[],
 *     weight: number,
 *     description: string
 *   }>
 * }
 */
app.get('/tell-words', optionalLocalAuth(), async (c) => {
  try {
    // Import tell-words dynamically to get categories
    const { AI_TELL_WORDS } = await import('../services/ai-detection/tell-words');

    const categories = AI_TELL_WORDS.map(cat => ({
      category: cat.category,
      words: cat.words,
      weight: cat.weight,
      description: getCategoryDescription(cat.category)
    }));

    return c.json({ categories });
  } catch (error) {
    console.error('Tell-words retrieval error:', error);
    return c.json({ error: 'Failed to retrieve tell-words' }, 500);
  }
});

/**
 * Helper: Get human-readable description for tell-word category
 */
function getCategoryDescription(category: string): string {
  const descriptions: Record<string, string> = {
    'Overused Academic/Formal': 'Formal words overused by AI models (e.g., "delve", "leverage", "tapestry")',
    'Transitional Phrases': 'Connecting phrases common in AI-generated text (e.g., "it\'s worth noting")',
    'Hedging/Qualifiers': 'Cautious qualifiers that AI uses to avoid definitive statements',
    'Metadiscourse': 'Self-referential phrases pointing to the text itself',
    'Sentence Starters': 'Common AI sentence openers (e.g., "in recent years", "looking ahead")',
    'Punctuation Patterns': 'AI-characteristic punctuation (e.g., em-dashes)',
    'Chatbot Phrases': 'Conversational AI patterns (e.g., "happy to help", "let me explain", "hope this helps")',
    'Structural Patterns': 'List and enumeration patterns common in AI (e.g., "firstly", "secondly", "in conclusion")'
  };
  return descriptions[category] || 'AI-characteristic phrases';
}

export default app;
