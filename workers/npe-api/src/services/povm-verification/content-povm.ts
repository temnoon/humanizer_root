/**
 * Content POVM Pack - Measures semantic preservation
 *
 * Three critical dimensions:
 * 1. Plot Structure (event sequence)
 * 2. Semantic Entailment (logical implications)
 * 3. Ethical Stance (moral position)
 *
 * Purpose: Verify that transformations preserve meaning while changing form
 */

import type { Env } from '../../../shared/types';

export interface ContentPOVMMeasurement {
  plotStructure: {
    events: string[];
    drift: number;
    evidence: string;
  };
  semanticEntailment: {
    implications: string[];
    drift: number;
    evidence: string;
  };
  ethicalStance: {
    stance: number;        // -2 (strongly against) to +2 (strongly support)
    explanation: string;
    drift: number;
    evidence: string;
  };
  timestamp: string;
}

/**
 * Measure Content POVM for a given text
 */
export async function measureContentPOVM(
  text: string,
  ai: any
): Promise<ContentPOVMMeasurement> {
  console.log('[Content POVM] Starting measurement for text:', text.substring(0, 100) + '...');

  // Run all three measurements in parallel for speed
  const [plotResult, entailmentResult, ethicsResult] = await Promise.all([
    measurePlotStructure(text, ai),
    measureSemanticEntailment(text, ai),
    measureEthicalStance(text, ai)
  ]);

  return {
    plotStructure: plotResult,
    semanticEntailment: entailmentResult,
    ethicalStance: ethicsResult,
    timestamp: new Date().toISOString()
  };
}

/**
 * Measure 1: Plot Structure (Event Sequence)
 *
 * Extracts key events in chronological order
 * Drift = Levenshtein distance normalized by length
 */
async function measurePlotStructure(text: string, ai: any) {
  const prompt = `Analyze this text and list the key events in chronological order.

Format your response as a simple numbered list:
1. [First event]
2. [Second event]
3. [Third event]
...

Be concise - each event should be 5-10 words maximum.
If there are no clear events (e.g., purely descriptive text), respond with: "No distinct events"

TEXT:
${text}

EVENTS:`;

  const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      {
        role: 'system',
        content: 'You are a narrative analyst. Extract events precisely and concisely. Respond ONLY with the numbered list, no additional commentary.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 512,
    temperature: 0.0  // Zero temp for maximum consistency
  });

  const events = parseEventList(response.response || '');

  return {
    events,
    drift: 0,  // Calculated during comparison
    evidence: events.join(' → ')
  };
}

/**
 * Measure 2: Semantic Entailment (Logical Implications)
 *
 * Extracts what can be logically concluded from the text
 * Drift = Embedding similarity of implication sets
 */
async function measureSemanticEntailment(text: string, ai: any) {
  const prompt = `Analyze this text and identify the key logical implications or conclusions that can be drawn.

Format your response as a numbered list of 3-5 implications:
1. [First implication]
2. [Second implication]
...

Focus on what the text IMPLIES, not just what it states explicitly.
If the text is purely factual with no implications, respond with: "No clear implications"

TEXT:
${text}

IMPLICATIONS:`;

  const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      {
        role: 'system',
        content: 'You are a logic and reasoning expert. Identify implications precisely. Respond ONLY with the numbered list.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 512,
    temperature: 0.0  // Zero temp for maximum consistency
  });

  const implications = parseImplicationList(response.response || '');

  return {
    implications,
    drift: 0,  // Calculated during comparison
    evidence: implications.join('; ')
  };
}

/**
 * Measure 3: Ethical Stance (Moral Position)
 *
 * Identifies the ethical or moral position taken
 * Drift = |stance_before - stance_after| / 4 + text_similarity_penalty
 */
async function measureEthicalStance(text: string, ai: any) {
  const prompt = `Analyze the ethical or moral position taken in this text.

1. Rate the stance on this scale:
   -2 = Strongly opposes something
   -1 = Mildly opposes something
    0 = Neutral / no clear position
   +1 = Mildly supports something
   +2 = Strongly supports something

2. Briefly explain WHAT the text supports/opposes and WHY (1-2 sentences)

If the text is purely factual/descriptive with no ethical dimension, use stance: 0

Respond ONLY with valid JSON in this format:
{
  "stance": <number between -2 and 2>,
  "explanation": "<brief explanation>"
}

TEXT:
${text}

RESPONSE:`;

  const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      {
        role: 'system',
        content: 'You are an ethics expert. Analyze moral positions objectively. Respond ONLY with valid JSON, no other text.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 256,
    temperature: 0.0  // Zero temp for maximum consistency
  });

  const ethics = parseEthicsResponse(response.response || '');

  return {
    stance: ethics.stance,
    explanation: ethics.explanation,
    drift: 0,  // Calculated during comparison
    evidence: `Stance: ${ethics.stance}, ${ethics.explanation}`
  };
}

/**
 * Compute drift between two Content POVM measurements
 * Uses embedding-based similarity for accurate semantic comparison
 */
export async function computeContentDrift(
  before: ContentPOVMMeasurement,
  after: ContentPOVMMeasurement,
  ai: any
): Promise<ContentPOVMMeasurement> {
  console.log('[Content POVM] Computing drift with embeddings...');

  try {
    // Plot drift: Embedding similarity on event lists
    const plotDrift = await computeListDriftEmbedding(
      before.plotStructure.events,
      after.plotStructure.events,
      ai
    );

    // Entailment drift: Embedding similarity on implications
    const entailmentDrift = await computeListDriftEmbedding(
      before.semanticEntailment.implications,
      after.semanticEntailment.implications,
      ai
    );

    // Ethics drift: Stance value difference + explanation similarity
    const stanceDrift = Math.abs(
      before.ethicalStance.stance - after.ethicalStance.stance
    ) / 4.0;  // Normalize to 0-1

    const explanationDrift = await computeTextDriftEmbedding(
      before.ethicalStance.explanation,
      after.ethicalStance.explanation,
      ai
    );

    const ethicsDrift = (stanceDrift + explanationDrift) / 2;

    console.log('[Content POVM] Drift calculated:', { plotDrift, entailmentDrift, ethicsDrift });

    return {
      plotStructure: {
        ...after.plotStructure,
        drift: plotDrift
      },
      semanticEntailment: {
        ...after.semanticEntailment,
        drift: entailmentDrift
      },
      ethicalStance: {
        ...after.ethicalStance,
        drift: ethicsDrift
      },
      timestamp: after.timestamp
    };
  } catch (error) {
    console.error('[Content POVM] Drift calculation failed, using fallback:', error);

    // Fallback to Levenshtein + Dice coefficient
    const plotDrift = computeListDriftFallback(
      before.plotStructure.events,
      after.plotStructure.events
    );

    const entailmentDrift = computeListDriftFallback(
      before.semanticEntailment.implications,
      after.semanticEntailment.implications
    );

    const stanceDrift = Math.abs(
      before.ethicalStance.stance - after.ethicalStance.stance
    ) / 4.0;

    const explanationDrift = computeTextDriftFallback(
      before.ethicalStance.explanation,
      after.ethicalStance.explanation
    );

    const ethicsDrift = (stanceDrift + explanationDrift) / 2;

    return {
      plotStructure: {
        ...after.plotStructure,
        drift: plotDrift
      },
      semanticEntailment: {
        ...after.semanticEntailment,
        drift: entailmentDrift
      },
      ethicalStance: {
        ...after.ethicalStance,
        drift: ethicsDrift
      },
      timestamp: after.timestamp
    };
  }
}

// ============================================================================
// PARSING UTILITIES
// ============================================================================

function parseEventList(response: string): string[] {
  const lines = response.split('\n').filter(line => line.trim().length > 0);
  const events: string[] = [];

  for (const line of lines) {
    // Match numbered list: "1. Event" or "1) Event"
    const match = line.match(/^\s*\d+[\.)]\s*(.+)$/);
    if (match) {
      events.push(match[1].trim());
    }
  }

  // If no numbered items found, check for "No distinct events"
  if (events.length === 0 && response.toLowerCase().includes('no distinct events')) {
    return ['No distinct events'];
  }

  return events;
}

function parseImplicationList(response: string): string[] {
  const lines = response.split('\n').filter(line => line.trim().length > 0);
  const implications: string[] = [];

  for (const line of lines) {
    const match = line.match(/^\s*\d+[\.)]\s*(.+)$/);
    if (match) {
      implications.push(match[1].trim());
    }
  }

  if (implications.length === 0 && response.toLowerCase().includes('no clear implications')) {
    return ['No clear implications'];
  }

  return implications;
}

function parseEthicsResponse(response: string): { stance: number; explanation: string } {
  try {
    // Extract JSON from response (may have markdown code blocks)
    let jsonText = response.trim();

    // Remove markdown code blocks if present
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) ||
                      response.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    // Try to find JSON object
    const objectMatch = jsonText.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonText = objectMatch[0];
    }

    const parsed = JSON.parse(jsonText);

    return {
      stance: clamp(parseFloat(parsed.stance || 0), -2, 2),
      explanation: (parsed.explanation || 'No explanation provided').trim()
    };
  } catch (error) {
    console.error('[Content POVM] Failed to parse ethics response:', response, error);

    // Fallback: Try to extract stance from text
    const stanceMatch = response.match(/stance[:\s]+(-?\d+)/i);
    const stance = stanceMatch ? clamp(parseFloat(stanceMatch[1]), -2, 2) : 0;

    return {
      stance,
      explanation: 'Parse error - defaulted to neutral stance'
    };
  }
}

// ============================================================================
// DRIFT CALCULATION UTILITIES
// ============================================================================

/**
 * Compute drift between two lists using embedding similarity
 * Compares the semantic similarity of joined list items
 * Returns normalized drift (0.0 = identical, 1.0 = completely different)
 */
async function computeListDriftEmbedding(list1: string[], list2: string[], ai: any): Promise<number> {
  // Handle edge cases
  if (list1.length === 0 && list2.length === 0) return 0;
  if (list1.length === 0 || list2.length === 0) return 1.0;

  // Fast path: If lists are identical (deep equality), return 0 drift
  if (list1.length === list2.length && list1.every((item, i) => item === list2[i])) {
    return 0;
  }

  // Join lists into single strings and compare semantically
  const text1 = list1.join('. ');
  const text2 = list2.join('. ');

  return await computeTextDriftEmbedding(text1, text2, ai);
}

/**
 * Fallback: Compute drift using Levenshtein distance
 * Used when embeddings fail or for simpler comparison
 */
function computeListDriftFallback(list1: string[], list2: string[]): number {
  // Handle edge cases
  if (list1.length === 0 && list2.length === 0) return 0;
  if (list1.length === 0 || list2.length === 0) return 1.0;

  // Levenshtein distance on lists (treating each item as a unit)
  const distance = levenshteinDistance(list1, list2);
  const maxLength = Math.max(list1.length, list2.length);

  return distance / maxLength;
}

/**
 * Compute drift between two text strings using embedding similarity
 * Uses Workers AI embeddings for semantic comparison
 */
async function computeTextDriftEmbedding(text1: string, text2: string, ai: any): Promise<number> {
  // Handle edge cases
  if (text1 === text2) return 0;
  if (!text1 || !text2) return 1.0;

  try {
    // Get embeddings for both texts
    const [embedding1, embedding2] = await Promise.all([
      ai.run('@cf/baai/bge-base-en-v1.5', { text: text1 }),
      ai.run('@cf/baai/bge-base-en-v1.5', { text: text2 })
    ]);

    const vec1 = embedding1.data[0];
    const vec2 = embedding2.data[0];

    // Compute cosine similarity
    const similarity = cosineSimilarity(vec1, vec2);

    // Convert similarity to drift (0 = identical, 1 = completely different)
    return 1 - similarity;
  } catch (error) {
    console.error('[Content POVM] Embedding drift calculation failed:', error);
    // Fallback to simple character-level similarity
    return computeTextDriftFallback(text1, text2);
  }
}

/**
 * Fallback: Simple character-level similarity (Dice coefficient)
 * More reliable than Jaccard for this use case
 */
function computeTextDriftFallback(text1: string, text2: string): number {
  const bigrams1 = getBigrams(text1.toLowerCase());
  const bigrams2 = getBigrams(text2.toLowerCase());

  const intersection = bigrams1.filter(b => bigrams2.includes(b));

  if (bigrams1.length + bigrams2.length === 0) return 0;

  const dice = (2 * intersection.length) / (bigrams1.length + bigrams2.length);
  return 1 - dice;
}

function getBigrams(text: string): string[] {
  const bigrams: string[] = [];
  for (let i = 0; i < text.length - 1; i++) {
    bigrams.push(text.substring(i, i + 2));
  }
  return bigrams;
}

/**
 * Levenshtein distance for arrays
 */
function levenshteinDistance<T>(arr1: T[], arr2: T[]): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= arr1.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= arr2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= arr1.length; i++) {
    for (let j = 1; j <= arr2.length; j++) {
      const cost = arr1[i - 1] === arr2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[arr1.length][arr2.length];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Compute cosine similarity between two vectors
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);

  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}
