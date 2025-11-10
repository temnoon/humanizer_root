// AI Detection Routes
// Endpoints for detecting AI-generated text

import { Hono } from 'hono';
import type { Env } from '../../shared/types';
import { requireAuth, optionalLocalAuth, getAuthContext } from '../middleware/auth';
import { detectAI, explainResult, HybridDetectionResult } from '../services/ai-detection/hybrid-orchestrator';
import { saveTransformationToHistory, updateTransformationHistory } from '../utils/transformation-history-helper';

const app = new Hono<{ Bindings: Env }>();

// Test endpoint
app.get('/test', (c) => {
  console.log('[AI Detection] Test endpoint hit');
  return c.json({ message: 'AI Detection routes loaded successfully' });
});

// Simple test endpoint without auth
app.post('/test-detect', async (c) => {
  console.log('[AI Detection] Test detect endpoint hit');
  try {
    const body = await c.req.json();
    console.log('[AI Detection] Body:', body);
    return c.json({ message: 'Test detect successful', received: body });
  } catch (err) {
    console.error('[AI Detection] Test error:', err);
    return c.json({ error: String(err) }, 500);
  }
});

/**
 * POST /ai-detection/detect
 * Detect if text is AI-generated
 *
 * Request:
 * {
 *   text: string,            // Text to analyze (min 20 words)
 *   useAPI?: boolean         // Opt-in to GPTZero API (default: false)
 * }
 *
 * Response:
 * {
 *   verdict: 'human' | 'ai' | 'uncertain',
 *   confidence: number,      // 0-100
 *   explanation: string,     // Human-readable explanation
 *   method: 'local' | 'gptzero' | 'hybrid',
 *   signals: {               // Detailed signal breakdown
 *     burstiness: number,
 *     tellWordScore: number,
 *     readabilityPattern: number,
 *     lexicalDiversity: number
 *   },
 *   metrics: {               // Raw statistics
 *     fleschReadingEase: number,
 *     gunningFog: number,
 *     wordCount: number,
 *     sentenceCount: number,
 *     avgSentenceLength: number
 *   },
 *   detectedTellWords: Array<{word, category, count}>,
 *   processingTimeMs: number,
 *   message?: string         // Optional info message
 * }
 */
app.post('/detect', optionalLocalAuth(), async (c) => {
  console.log('[AI Detection Route] Handler called');
  try {
    // Get user info from auth context
    const auth = getAuthContext(c);
    console.log('[AI Detection Route] User:', auth.email, auth.role);
    if (!auth) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    // Parse request body
    const body = await c.req.json();
    const { text, useAPI = false } = body;
    console.log('[AI Detection Route] Request body parsed, text length:', text?.length);

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

    // Generate transformation ID
    const transformationId = crypto.randomUUID();

    // Save to history before starting
    try {
      await saveTransformationToHistory(c.env.DB, {
        id: transformationId,
        user_id: auth.userId,
        transformation_type: 'ai-detection',
        input_text: trimmedText,
        input_params: { useAPI }
      });
    } catch (err) {
      console.error('[Transformation History] Failed to save:', err);
    }

    // Get GPTZero API key from environment (optional)
    const apiKey = c.env.GPTZERO_API_KEY;

    console.log('[AI Detection] Starting detection, words:', words.length, 'useAPI:', useAPI, 'tier:', auth.role);

    // Run detection
    try {
      const result: HybridDetectionResult = await detectAI(trimmedText, {
        useAPI: useAPI === true,
        userTier: auth.role,
        apiKey: apiKey
      });

      console.log('[AI Detection] Result:', result.verdict, result.confidence, result.method);

      // Format response with detailed breakdown
      const response = {
        verdict: result.verdict,
        confidence: result.confidence,
        explanation: explainResult(result),
        method: result.method,
        signals: result.local?.signals || {
          burstiness: 0,
          tellWordScore: 0,
          readabilityPattern: 0,
          lexicalDiversity: 0
        },
        metrics: result.local?.metrics || {
          fleschReadingEase: 0,
          gunningFog: 0,
          wordCount: words.length,
          sentenceCount: 0,
          avgSentenceLength: 0
        },
        detectedTellWords: result.local?.detectedTellWords || [],
        processingTimeMs: result.processingTimeMs,
        message: result.message
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
    } catch (detectError) {
      // Update history on failure
      try {
        await updateTransformationHistory(c.env.DB, {
          id: transformationId,
          user_id: auth.userId,
          status: 'failed',
          error_message: detectError instanceof Error ? detectError.message : 'Detection failed'
        });
      } catch (err) {
        console.error('[Transformation History] Failed to update error:', err);
      }
      throw detectError;
    }
  } catch (error) {
    console.error('AI detection error:', error);
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
    'Sentence Starters': 'Common AI sentence openers (e.g., "in recent years", "looking ahead")'
  };
  return descriptions[category] || 'AI-characteristic phrases';
}

export default app;
