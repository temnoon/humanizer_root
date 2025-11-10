/**
 * POVM Measurement Service for Quantum Reading
 *
 * Performs Tetralemma (four-corner) measurements on sentences using LLM
 * Implements Positive Operator-Valued Measure (POVM) via Workers AI
 */

export interface TetralemmaMeasurement {
  literal: CornerMeasurement;
  metaphorical: CornerMeasurement;
  both: CornerMeasurement;
  neither: CornerMeasurement;
}

export interface CornerMeasurement {
  probability: number;
  evidence: string;
}

export interface POVMMeasurementResult {
  sentence: string;
  sentenceIndex: number;
  measurement: TetralemmaMeasurement;
  isValid: boolean;
  probSum: number; // Should be 1.0
}

/**
 * Tetralemma POVM measurement prompt template
 * Designed for Llama 3.1 8B via Workers AI
 */
function createTetralemmPrompt(sentence: string): string {
  return `You are performing a quantum measurement on a sentence using Tetralemma logic (four corners).

SENTENCE: "${sentence}"

AXIS: Literal ↔ Metaphorical

Measure across all four corners:

1. LITERAL (directly referential, not metaphorical)
   - Probability (0.0-1.0):
   - Evidence (one sentence):

2. METAPHORICAL (symbolic/figurative, not literal)
   - Probability (0.0-1.0):
   - Evidence (one sentence):

3. BOTH (simultaneously literal AND metaphorical)
   - Probability (0.0-1.0):
   - Evidence (one sentence):

4. NEITHER (transcends the literal/metaphorical distinction)
   - Probability (0.0-1.0):
   - Evidence (one sentence):

CRITICAL CONSTRAINT: All four probabilities MUST sum to exactly 1.0.

Respond ONLY with valid JSON in this exact format:
{
  "literal": {"probability": 0.XX, "evidence": "..."},
  "metaphorical": {"probability": 0.XX, "evidence": "..."},
  "both": {"probability": 0.XX, "evidence": "..."},
  "neither": {"probability": 0.XX, "evidence": "..."}
}`;
}

/**
 * Perform Tetralemma POVM measurement using Workers AI
 *
 * @param ai - Cloudflare AI binding
 * @param sentence - Sentence to measure
 * @param sentenceIndex - Index in sequence
 * @returns POVM measurement result
 */
export async function measureSentenceTetralemma(
  ai: any,
  sentence: string,
  sentenceIndex: number
): Promise<POVMMeasurementResult> {
  const MODEL_NAME = '@cf/meta/llama-3.1-8b-instruct';

  const prompt = createTetralemmPrompt(sentence);

  try {
    const response = await ai.run(MODEL_NAME, {
      messages: [
        {
          role: 'system',
          content: 'You are a quantum measurement system for text analysis. Always respond with valid JSON only, no additional text.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 512,
      temperature: 0.3 // Low temperature for more consistent measurements
    });

    // Extract JSON from response
    const responseText = response.response || response.content || '';
    const measurement = parseAndValidateMeasurement(responseText, sentence, sentenceIndex);

    return measurement;
  } catch (error) {
    console.error('Error performing POVM measurement:', error);

    // NO FALLBACK - Fail loudly instead of returning mock data
    // Mock results erode user trust and credibility
    throw new Error(
      `POVM measurement failed: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
      `Workers AI model may be unavailable or timed out.`
    );
  }
}

/**
 * Parse and validate LLM response
 * Ensures probabilities sum to 1.0 and all fields are present
 */
function parseAndValidateMeasurement(
  responseText: string,
  sentence: string,
  sentenceIndex: number
): POVMMeasurementResult {
  try {
    // Extract JSON from markdown code blocks if present
    let jsonText = responseText;
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                      responseText.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    // Try to find JSON object in text
    const jsonObjectMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
      jsonText = jsonObjectMatch[0];
    }

    const parsed = JSON.parse(jsonText);

    // Extract probabilities
    const probLiteral = parseFloat(parsed.literal?.probability || 0);
    const probMetaphorical = parseFloat(parsed.metaphorical?.probability || 0);
    const probBoth = parseFloat(parsed.both?.probability || 0);
    const probNeither = parseFloat(parsed.neither?.probability || 0);

    // Calculate sum
    const sum = probLiteral + probMetaphorical + probBoth + probNeither;

    // Normalize if sum is not exactly 1.0 but close
    let normalizedProbs = { probLiteral, probMetaphorical, probBoth, probNeither };
    if (Math.abs(sum - 1.0) > 0.001 && Math.abs(sum - 1.0) < 0.1) {
      // Normalize - acceptable rounding error
      normalizedProbs = {
        probLiteral: probLiteral / sum,
        probMetaphorical: probMetaphorical / sum,
        probBoth: probBoth / sum,
        probNeither: probNeither / sum
      };
    } else if (Math.abs(sum - 1.0) > 0.1) {
      // Too far off - FAIL instead of returning mock data
      throw new Error(
        `POVM probabilities sum to ${sum.toFixed(3)}, expected 1.0. ` +
        `LLM returned invalid measurement. Workers AI may be malfunctioning.`
      );
    }

    const measurement: TetralemmaMeasurement = {
      literal: {
        probability: normalizedProbs.probLiteral,
        evidence: parsed.literal?.evidence || 'No evidence provided'
      },
      metaphorical: {
        probability: normalizedProbs.probMetaphorical,
        evidence: parsed.metaphorical?.evidence || 'No evidence provided'
      },
      both: {
        probability: normalizedProbs.probBoth,
        evidence: parsed.both?.evidence || 'No evidence provided'
      },
      neither: {
        probability: normalizedProbs.probNeither,
        evidence: parsed.neither?.evidence || 'No evidence provided'
      }
    };

    const finalSum = normalizedProbs.probLiteral + normalizedProbs.probMetaphorical +
                     normalizedProbs.probBoth + normalizedProbs.probNeither;

    return {
      sentence,
      sentenceIndex,
      measurement,
      isValid: Math.abs(finalSum - 1.0) < 0.01,
      probSum: finalSum
    };
  } catch (error) {
    console.error('Error parsing measurement:', error, 'Response:', responseText);

    // NO FALLBACK - Fail loudly instead of returning mock data
    throw new Error(
      `Failed to parse POVM measurement from LLM response. ` +
      `Response was: ${responseText.substring(0, 200)}... ` +
      `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validate that POVM constraints are satisfied
 *
 * Requirements:
 * 1. All probabilities in [0, 1]
 * 2. Sum of probabilities = 1.0 (±0.01 tolerance)
 * 3. All evidence strings non-empty
 */
export function validatePOVMMeasurement(result: POVMMeasurementResult): boolean {
  const { measurement } = result;

  // Check probability bounds
  const probs = [
    measurement.literal.probability,
    measurement.metaphorical.probability,
    measurement.both.probability,
    measurement.neither.probability
  ];

  if (probs.some(p => p < 0 || p > 1 || isNaN(p))) {
    return false;
  }

  // Check sum (with tolerance)
  const sum = probs.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1.0) > 0.01) {
    return false;
  }

  // Check evidence
  if (
    !measurement.literal.evidence ||
    !measurement.metaphorical.evidence ||
    !measurement.both.evidence ||
    !measurement.neither.evidence
  ) {
    return false;
  }

  return true;
}

/**
 * Get dominant corner from measurement
 * Returns the corner with highest probability
 */
export function getDominantCorner(measurement: TetralemmaMeasurement): string {
  const probs = {
    literal: measurement.literal.probability,
    metaphorical: measurement.metaphorical.probability,
    both: measurement.both.probability,
    neither: measurement.neither.probability
  };

  return Object.entries(probs).reduce((max, [corner, prob]) =>
    prob > probs[max as keyof typeof probs] ? corner : max
  , 'literal') as string;
}
