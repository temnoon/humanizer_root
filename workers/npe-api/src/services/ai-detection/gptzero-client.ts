// GPTZero API Client
// Official API documentation: https://gptzero.me/docs

import {
  stripInlineMarkdown,
  createPositionMap,
  adjustHighlightPositions,
  applyHighlightsToMarkdown,
  type HighlightRange
} from '../markdown-preserver';

export interface GPTZeroDetectionResult {
  verdict: 'human' | 'ai' | 'mixed';
  confidence: number; // 0-100 with 3 decimal places (0 = human, 100 = AI)
  details: {
    completely_generated_prob: number; // Probability entirely AI
    average_generated_prob: number; // Average probability across sentences
    sentences: Array<{
      sentence: string;
      generated_prob: number;
      highlight_sentence_for_ai: boolean; // Premium: which sentences are flagged as AI
      paraphrased_prob: number; // Premium: paraphrased detection probability
    }>;
    paragraphs: Array<{
      start_sentence_index: number;
      num_sentences: number;
      completely_generated_prob: number;
    }>;
  };
  result_message: string; // GPTZero's human-readable explanation
  confidence_category: string; // "low" | "medium" | "high"
  subclass_type: string; // "pure_ai" | "ai_paraphrased"
  processingTimeMs: number;
  method: 'gptzero';
  classVersion: string;
  modelVersion: string;
}

interface GPTZeroAPIResponse {
  documents: Array<{
    completely_generated_prob: number;
    average_generated_prob: number;
    confidence_category: string; // "low" | "medium" | "high"
    result_message: string; // GPTZero's explanation
    sentences: Array<{
      sentence: string;
      generated_prob: number;
      highlight_sentence_for_ai: boolean; // Which sentences are flagged
      class_probabilities: {
        ai: number;
        human: number;
        paraphrased: number; // Paraphrased detection
      };
      perplexity: number | null;
      perplexity_per_line?: number | null;
    }>;
    paragraphs: Array<{
      start_sentence_index: number;
      num_sentences: number;
      completely_generated_prob: number;
    }>;
    class_probabilities: {
      ai: number;
      human: number;
      mixed: number;
    };
    subclass: {
      ai: {
        predicted_class: string; // "pure_ai" | "ai_paraphrased"
        confidence_score: number;
      };
    };
  }>;
  neatVersion: string; // GPTZero's classifier version (was: class_version)
  version: string;     // Model version (was: model_version)
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
        version: '2025-11-13-base' // Latest GPTZero model version
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

    // Convert to 0-100 confidence scale with 3 decimal places (higher = more AI-like)
    const confidence = Math.round(doc.completely_generated_prob * 100000) / 1000;

    const processingTimeMs = Date.now() - startTime;

    return {
      verdict,
      confidence,
      details: {
        completely_generated_prob: doc.completely_generated_prob,
        average_generated_prob: doc.average_generated_prob,
        sentences: doc.sentences.map(s => ({
          sentence: s.sentence,
          generated_prob: s.generated_prob,
          highlight_sentence_for_ai: s.highlight_sentence_for_ai,
          paraphrased_prob: s.class_probabilities?.paraphrased || 0
        })),
        paragraphs: doc.paragraphs || []
      },
      result_message: doc.result_message || '',
      confidence_category: doc.confidence_category || 'unknown',
      subclass_type: doc.subclass?.ai?.predicted_class || 'unknown',
      processingTimeMs,
      method: 'gptzero',
      classVersion: data.neatVersion,  // Fixed: was data.class_version
      modelVersion: data.version       // Fixed: was data.model_version
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

/**
 * Markdown-aware GPTZero detection wrapper
 * Strips markdown before analysis, then restores it with highlights
 *
 * @param markdownText - Original text with markdown formatting
 * @param apiKey - GPTZero API key
 * @returns Detection result with markdown-aware highlights
 */
export async function detectAIWithGPTZeroMarkdown(
  markdownText: string,
  apiKey: string
): Promise<GPTZeroDetectionResult & { highlightedMarkdown: string }> {
  // 1. Create position map BEFORE stripping
  const positionMap = createPositionMap(markdownText);

  // 2. Strip markdown for analysis
  const plainText = stripInlineMarkdown(markdownText);

  // 3. Run GPTZero detection on plain text
  const result = await detectAIWithGPTZero(plainText, apiKey);

  // 4. Create highlights from GPTZero's flagged sentences
  const highlightRanges: HighlightRange[] = [];

  // GPTZero returns sentences with highlight_sentence_for_ai flag
  // We need to find these sentences in the plain text and create highlight ranges
  let currentPos = 0;
  for (const sentenceData of result.details.sentences) {
    const sentence = sentenceData.sentence;
    const shouldHighlight = sentenceData.highlight_sentence_for_ai;

    // Find this sentence in the plain text
    const sentenceStart = plainText.indexOf(sentence, currentPos);

    if (sentenceStart !== -1 && shouldHighlight) {
      const sentenceEnd = sentenceStart + sentence.length;

      highlightRanges.push({
        start: sentenceStart,
        end: sentenceEnd,
        reason: `AI-generated (${(sentenceData.generated_prob * 100).toFixed(1)}% confidence)`
      });

      currentPos = sentenceEnd;
    } else if (sentenceStart !== -1) {
      currentPos = sentenceStart + sentence.length;
    }
  }

  // 5. Adjust highlight positions to account for markdown
  const adjustedHighlights = adjustHighlightPositions(highlightRanges, positionMap);

  // 6. Apply highlights to original markdown
  const highlightedMarkdown = applyHighlightsToMarkdown(markdownText, adjustedHighlights);

  return {
    ...result,
    highlightedMarkdown
  };
}
