// GPTZero API Client
// Official API documentation: https://gptzero.me/docs

export interface GPTZeroDetectionResult {
  verdict: 'human' | 'ai' | 'mixed';
  confidence: number; // 0-100 (0 = human, 100 = AI)
  details: {
    completely_generated_prob: number; // Probability entirely AI
    average_generated_prob: number; // Average probability across sentences
    sentences: Array<{
      sentence: string;
      generated_prob: number;
    }>;
  };
  processingTimeMs: number;
  method: 'gptzero';
  classVersion: string;
  modelVersion: string;
}

interface GPTZeroAPIResponse {
  documents: Array<{
    completely_generated_prob: number;
    average_generated_prob: number;
    sentences: Array<{
      sentence: string;
      generated_prob: number;
      perplexity: number | null;
      perplexity_per_line: number | null;
    }>;
    class_probabilities: {
      ai: number;
      human: number;
      mixed: number;
    };
  }>;
  class_version: string;
  model_version: string;
}

/**
 * Detect AI-generated text using GPTZero API
 * Requires API key (set via wrangler secret)
 *
 * @param text - Text to analyze (max recommended: 50,000 characters)
 * @param apiKey - GPTZero API key
 * @returns Detection result with confidence score
 */
export async function detectAIWithGPTZero(
  text: string,
  apiKey: string
): Promise<GPTZeroDetectionResult> {
  const startTime = Date.now();

  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  if (!apiKey) {
    throw new Error('GPTZero API key not configured');
  }

  // GPTZero recommends max 50k characters
  if (text.length > 50000) {
    throw new Error('Text too long (max 50,000 characters for GPTZero)');
  }

  try {
    const response = await fetch('https://api.gptzero.me/v2/predict/text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        document: text,
        version: '2024-01-09' // API version
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GPTZero API error:', response.status, errorText);

      if (response.status === 401) {
        throw new Error('Invalid GPTZero API key');
      } else if (response.status === 429) {
        throw new Error('GPTZero rate limit exceeded. Please try again later.');
      } else if (response.status === 400) {
        throw new Error('Invalid request to GPTZero API');
      } else {
        throw new Error(`GPTZero API error: ${response.status}`);
      }
    }

    const data: GPTZeroAPIResponse = await response.json();

    if (!data.documents || data.documents.length === 0) {
      throw new Error('No detection results from GPTZero');
    }

    const doc = data.documents[0];

    // Determine verdict based on class probabilities
    let verdict: 'human' | 'ai' | 'mixed';
    const { ai, human, mixed } = doc.class_probabilities;

    if (ai > human && ai > mixed) {
      verdict = 'ai';
    } else if (human > ai && human > mixed) {
      verdict = 'human';
    } else {
      verdict = 'mixed';
    }

    // Convert to 0-100 confidence scale (higher = more AI-like)
    const confidence = Math.round(doc.completely_generated_prob * 100);

    const processingTimeMs = Date.now() - startTime;

    return {
      verdict,
      confidence,
      details: {
        completely_generated_prob: doc.completely_generated_prob,
        average_generated_prob: doc.average_generated_prob,
        sentences: doc.sentences.map(s => ({
          sentence: s.sentence,
          generated_prob: s.generated_prob
        }))
      },
      processingTimeMs,
      method: 'gptzero',
      classVersion: data.class_version,
      modelVersion: data.model_version
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error calling GPTZero API');
  }
}

/**
 * Test GPTZero API key validity
 * Sends a short test string to verify authentication
 */
export async function testGPTZeroAPIKey(apiKey: string): Promise<boolean> {
  try {
    await detectAIWithGPTZero(
      'This is a short test message to verify the API key works correctly.',
      apiKey
    );
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid GPTZero API key')) {
      return false;
    }
    // Other errors (network, etc.) we'll assume key might be valid
    return true;
  }
}
