// AI Detection Routes
// Endpoints for detecting AI-generated text

import { Hono } from 'hono';
import type { Env } from '../../shared/types';
import { requireAuth } from '../middleware/auth';
import { detectAI, explainResult, HybridDetectionResult } from '../services/ai-detection/hybrid-orchestrator';

const app = new Hono<{ Bindings: Env }>();

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
app.post('/detect', requireAuth, async (c) => {
  try {
    // Get user info from auth context
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    // Parse request body
    const body = await c.req.json();
    const { text, useAPI = false } = body;

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

    // Get GPTZero API key from environment (optional)
    const apiKey = c.env.GPTZERO_API_KEY;

    // Run detection
    const result: HybridDetectionResult = await detectAI(trimmedText, {
      useAPI: useAPI === true,
      userTier: user.role,
      apiKey: apiKey
    });

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

    return c.json(response);
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
app.get('/status', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const hasAPIKey = Boolean(c.env.GPTZERO_API_KEY);
    const isProPlus = user.role === 'pro' || user.role === 'premium' || user.role === 'admin';

    return c.json({
      localDetection: true,
      apiDetection: hasAPIKey,
      userTier: user.role,
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
app.get('/tell-words', requireAuth, async (c) => {
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
