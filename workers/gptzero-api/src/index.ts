/**
 * GPTZero API Worker
 *
 * Provides professional-grade AI detection via GPTZero API
 * with per-user quota tracking for Pro/Premium tier users.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { QuotaTracker } from './quota-tracker';

export interface Env {
  GPTZERO_API_KEY: string;
  USAGE_KV: KVNamespace;
  ALLOWED_ORIGINS: string;
}

// GPTZero API types
interface GPTZeroRequest {
  document: string;
  version?: string;
}

interface GPTZeroResponse {
  documents: Array<{
    average_generated_prob: number;
    completely_generated_prob: number;
    overall_burstiness: number;
    paragraphs: Array<{
      start_sentence_index: number;
      end_sentence_index: number;
      completely_generated_prob: number;
    }>;
    sentences: Array<{
      sentence: string;
      generated_prob: number;
      perplexity: number;
      start_char_index: number;
      end_char_index: number;
    }>;
  }>;
  error?: string;
}

// Our standardized detection response
export interface DetectionResult {
  detector_type: 'gptzero';
  ai_likelihood: number; // 0-1 scale
  confidence: 'low' | 'medium' | 'high';
  label: 'likely_human' | 'mixed' | 'likely_ai';
  metrics: {
    averageGeneratedProb: number;
    completelyGeneratedProb: number;
    overallBurstiness: number;
  };
  highlights: Array<{
    start: number;
    end: number;
    sentence: string;
    score: number;
    reason: string;
  }>;
  quota: {
    used: number;
    limit: number;
    remaining: number;
    resetDate: string;
    percentUsed: number;
  };
  wordsProcessed: number;
}

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('*', async (c, next) => {
  const allowedOrigins = c.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:5173',
    'https://workbench.humanizer.com',
    'https://humanizer.com',
  ];

  const origin = c.req.header('Origin') || '';
  const corsMiddleware = cors({
    origin: allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    credentials: true,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  });

  return corsMiddleware(c, next);
});

/**
 * POST /api/gptzero/detect
 *
 * Run GPTZero AI detection on text
 */
app.post('/api/gptzero/detect', async (c) => {
  try {
    const { text, userId, userTier = 'pro' } = await c.req.json();

    // Validate input
    if (!text || typeof text !== 'string') {
      return c.json({ error: 'Missing or invalid text parameter' }, 400);
    }

    if (!userId || typeof userId !== 'string') {
      return c.json({ error: 'Missing or invalid userId parameter' }, 400);
    }

    // Count words
    const wordCount = countWords(text);

    if (wordCount === 0) {
      return c.json({ error: 'Text must contain at least one word' }, 400);
    }

    // Determine quota limit based on tier
    const quotaLimit = getQuotaLimit(userTier);

    // Check quota
    const tracker = new QuotaTracker(c.env.USAGE_KV);
    const hasQuota = await tracker.hasQuota(userId, wordCount, quotaLimit);

    if (!hasQuota) {
      const quota = await tracker.getQuota(userId, quotaLimit);
      return c.json(
        {
          error: 'Quota exceeded',
          quota: {
            used: quota.used,
            limit: quota.limit,
            remaining: quota.remaining,
            resetDate: quota.resetDate,
            percentUsed: quota.percentUsed,
          },
          wordsNeeded: wordCount,
        },
        429
      );
    }

    // Call GPTZero API
    const gptzeroResult = await callGPTZeroAPI(text, c.env.GPTZERO_API_KEY);

    if (gptzeroResult.error) {
      return c.json({ error: `GPTZero API error: ${gptzeroResult.error}` }, 500);
    }

    // Consume quota
    const quotaInfo = await tracker.consumeQuota(userId, wordCount, quotaLimit);

    // Map to standardized format
    const result = mapGPTZeroResponse(gptzeroResult, quotaInfo, wordCount);

    return c.json(result, 200);
  } catch (error: any) {
    console.error('GPTZero detection error:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

/**
 * GET /api/gptzero/quota/:userId
 *
 * Get quota info for a user
 */
app.get('/api/gptzero/quota/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');
    const userTier = c.req.query('tier') || 'pro';

    if (!userId) {
      return c.json({ error: 'Missing userId parameter' }, 400);
    }

    const quotaLimit = getQuotaLimit(userTier);
    const tracker = new QuotaTracker(c.env.USAGE_KV);
    const quota = await tracker.getQuota(userId, quotaLimit);

    return c.json(quota, 200);
  } catch (error: any) {
    console.error('Quota fetch error:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

/**
 * POST /api/gptzero/quota/:userId/set-limit
 *
 * Set custom quota limit for a user (admin only)
 */
app.post('/api/gptzero/quota/:userId/set-limit', async (c) => {
  try {
    const userId = c.req.param('userId');
    const { limit } = await c.req.json();

    if (!userId) {
      return c.json({ error: 'Missing userId parameter' }, 400);
    }

    if (typeof limit !== 'number' || limit < 0) {
      return c.json({ error: 'Invalid limit value' }, 400);
    }

    const tracker = new QuotaTracker(c.env.USAGE_KV);
    await tracker.setQuotaLimit(userId, limit);

    return c.json({ success: true, userId, newLimit: limit }, 200);
  } catch (error: any) {
    console.error('Set quota limit error:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

/**
 * GET /health
 *
 * Health check endpoint
 */
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'gptzero-api',
    timestamp: new Date().toISOString(),
  });
});

// Helper functions

function countWords(text: string): number {
  const words = text.trim().split(/\s+/);
  return words.filter((w) => w.length > 0).length;
}

function getQuotaLimit(tier: string): number {
  switch (tier) {
    case 'premium':
      return 1000000; // 1M words (effectively unlimited)
    case 'pro':
      return 50000; // 50k words
    default:
      return 0; // Free tier has no GPTZero access
  }
}

async function callGPTZeroAPI(text: string, apiKey: string): Promise<GPTZeroResponse> {
  const url = 'https://api.gptzero.me/v2/predict/text';

  const requestBody: GPTZeroRequest = {
    document: text,
    version: '2025-11-13-base', // Latest GPTZero model
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        documents: [],
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const data = await response.json();
    return data as GPTZeroResponse;
  } catch (error: any) {
    return {
      documents: [],
      error: error.message || 'Unknown error calling GPTZero API',
    };
  }
}

function mapGPTZeroResponse(
  gptzeroResult: GPTZeroResponse,
  quota: any,
  wordsProcessed: number
): DetectionResult {
  const doc = gptzeroResult.documents[0];

  if (!doc) {
    throw new Error('No document in GPTZero response');
  }

  const aiLikelihood = doc.completely_generated_prob;

  // Determine confidence based on score extremity
  let confidence: 'low' | 'medium' | 'high';
  if (aiLikelihood < 0.3 || aiLikelihood > 0.7) {
    confidence = 'high';
  } else if (aiLikelihood < 0.4 || aiLikelihood > 0.6) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // Determine label
  let label: 'likely_human' | 'mixed' | 'likely_ai';
  if (aiLikelihood < 0.35) {
    label = 'likely_human';
  } else if (aiLikelihood < 0.65) {
    label = 'mixed';
  } else {
    label = 'likely_ai';
  }

  // Extract high-probability sentences as highlights
  const highlights = doc.sentences
    .filter((s) => s.generated_prob > 0.7)
    .map((s) => ({
      start: s.start_char_index,
      end: s.end_char_index,
      sentence: s.sentence,
      score: s.generated_prob,
      reason: `High AI probability (${Math.round(s.generated_prob * 100)}%)`,
    }))
    .slice(0, 10); // Limit to top 10

  return {
    detector_type: 'gptzero',
    ai_likelihood: aiLikelihood,
    confidence,
    label,
    metrics: {
      averageGeneratedProb: doc.average_generated_prob,
      completelyGeneratedProb: doc.completely_generated_prob,
      overallBurstiness: doc.overall_burstiness,
    },
    highlights,
    quota,
    wordsProcessed,
  };
}

export default app;
