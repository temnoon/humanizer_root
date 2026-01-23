/**
 * Tetralemma Measurement
 *
 * Implements four-corner (Catuṣkoṭi) evaluation via LLM.
 *
 * HONEST REBRANDING NOTE:
 * This is NOT quantum POVM. It's LLM-based semantic judgment that assigns
 * probabilities to four interpretive stances. We call it "measurement"
 * by analogy to quantum mechanics, but it's actually semantic analysis.
 *
 * The four corners:
 * - Literal: Direct referential meaning
 * - Metaphorical: Symbolic/figurative meaning
 * - Both: Simultaneously literal AND metaphorical
 * - Neither: Transcends the distinction
 *
 * Probabilities must sum to 1.0 (POVM completeness constraint).
 */

import type { LlmAdapter } from '../llm/types.js';
import { safeJsonParse } from '../llm/normalizer.js';
import type { TetralemmaReading, POVMMeasurement, CornerMeasurement } from '../types.js';

/**
 * POVM measurement axis (extensible)
 */
export type POVMAxis =
  | 'literalness'    // Literal ↔ Metaphorical
  | 'certainty'      // Certain ↔ Uncertain
  | 'formality'      // Formal ↔ Informal
  | 'temporality'    // Present ↔ Past/Future
  | 'agency';        // Active ↔ Passive

/**
 * Tetralemma prompt template
 */
function createTetralemmaPrompt(sentence: string, axis: POVMAxis = 'literalness'): string {
  const axisDescriptions: Record<POVMAxis, { positive: string; negative: string }> = {
    literalness: { positive: 'Literal (directly referential)', negative: 'Metaphorical (symbolic/figurative)' },
    certainty: { positive: 'Certain (definite, confident)', negative: 'Uncertain (tentative, qualified)' },
    formality: { positive: 'Formal (professional, structured)', negative: 'Informal (casual, conversational)' },
    temporality: { positive: 'Present (immediate, current)', negative: 'Past/Future (remembered, anticipated)' },
    agency: { positive: 'Active (agent doing)', negative: 'Passive (being acted upon)' },
  };

  const desc = axisDescriptions[axis] || axisDescriptions.literalness;

  return `Perform a four-corner measurement on this sentence.

SENTENCE: "${sentence}"

AXIS: ${desc.positive} ↔ ${desc.negative}

Measure across all four corners:

1. POSITIVE (${desc.positive})
   - Probability (0.0-1.0):
   - Evidence (one sentence):

2. NEGATIVE (${desc.negative})
   - Probability (0.0-1.0):
   - Evidence (one sentence):

3. BOTH (simultaneously positive AND negative)
   - Probability (0.0-1.0):
   - Evidence (one sentence):

4. NEITHER (transcends the distinction)
   - Probability (0.0-1.0):
   - Evidence (one sentence):

CRITICAL: All four probabilities MUST sum to exactly 1.0.

Respond ONLY with valid JSON:
{
  "literal": {"probability": 0.XX, "evidence": "..."},
  "metaphorical": {"probability": 0.XX, "evidence": "..."},
  "both": {"probability": 0.XX, "evidence": "..."},
  "neither": {"probability": 0.XX, "evidence": "..."}
}`;
}

/**
 * System prompt for Tetralemma measurement
 */
const TETRALEMMA_SYSTEM = `You are a semantic measurement system for text analysis.
You assign probabilities to interpretive stances using four-corner logic.
Always respond with valid JSON only. No additional text.`;

/**
 * Measure a sentence using Tetralemma
 */
export async function measureTetralemma(
  adapter: LlmAdapter,
  sentence: string,
  sentenceIndex: number,
  axis: POVMAxis = 'literalness'
): Promise<POVMMeasurement> {
  const prompt = createTetralemmaPrompt(sentence, axis);

  const response = await adapter.complete(TETRALEMMA_SYSTEM, prompt, {
    temperature: 0.3, // Low temperature for consistency
    max_tokens: 512,
  });

  return parseAndValidateMeasurement(response, sentence, sentenceIndex);
}

/**
 * Parse and validate measurement response
 */
function parseAndValidateMeasurement(
  responseText: string,
  sentence: string,
  sentenceIndex: number
): POVMMeasurement {
  const fallbackReading: TetralemmaReading = {
    literal: { probability: 0.25, evidence: 'Unable to parse' },
    metaphorical: { probability: 0.25, evidence: 'Unable to parse' },
    both: { probability: 0.25, evidence: 'Unable to parse' },
    neither: { probability: 0.25, evidence: 'Unable to parse' },
  };

  const parsed = safeJsonParse(responseText, fallbackReading);

  // Extract probabilities
  const probLiteral = parseFloat(String(parsed.literal?.probability || 0));
  const probMetaphorical = parseFloat(String(parsed.metaphorical?.probability || 0));
  const probBoth = parseFloat(String(parsed.both?.probability || 0));
  const probNeither = parseFloat(String(parsed.neither?.probability || 0));

  const sum = probLiteral + probMetaphorical + probBoth + probNeither;

  // Normalize if close to 1.0
  let normalized = { probLiteral, probMetaphorical, probBoth, probNeither };
  if (Math.abs(sum - 1.0) > 0.001 && sum > 0) {
    normalized = {
      probLiteral: probLiteral / sum,
      probMetaphorical: probMetaphorical / sum,
      probBoth: probBoth / sum,
      probNeither: probNeither / sum,
    };
  }

  const reading: TetralemmaReading = {
    literal: {
      probability: normalized.probLiteral,
      evidence: String(parsed.literal?.evidence || 'No evidence'),
    },
    metaphorical: {
      probability: normalized.probMetaphorical,
      evidence: String(parsed.metaphorical?.evidence || 'No evidence'),
    },
    both: {
      probability: normalized.probBoth,
      evidence: String(parsed.both?.evidence || 'No evidence'),
    },
    neither: {
      probability: normalized.probNeither,
      evidence: String(parsed.neither?.evidence || 'No evidence'),
    },
  };

  const finalSum = normalized.probLiteral + normalized.probMetaphorical +
                   normalized.probBoth + normalized.probNeither;

  return {
    sentence,
    sentenceIndex,
    reading,
    isValid: Math.abs(finalSum - 1.0) < 0.01,
    probSum: finalSum,
  };
}

/**
 * Validate POVM measurement constraints
 */
export function validateMeasurement(measurement: POVMMeasurement): boolean {
  const { reading } = measurement;

  const probs = [
    reading.literal.probability,
    reading.metaphorical.probability,
    reading.both.probability,
    reading.neither.probability,
  ];

  // Check bounds
  if (probs.some(p => p < 0 || p > 1 || isNaN(p))) {
    return false;
  }

  // Check sum
  const sum = probs.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1.0) > 0.01) {
    return false;
  }

  // Check evidence
  if (!reading.literal.evidence || !reading.metaphorical.evidence ||
      !reading.both.evidence || !reading.neither.evidence) {
    return false;
  }

  return true;
}

/**
 * Get dominant corner from reading
 */
export function getDominantCorner(reading: TetralemmaReading): keyof TetralemmaReading {
  const probs = {
    literal: reading.literal.probability,
    metaphorical: reading.metaphorical.probability,
    both: reading.both.probability,
    neither: reading.neither.probability,
  };

  return Object.entries(probs).reduce((max, [corner, prob]) =>
    prob > probs[max as keyof typeof probs] ? corner as keyof TetralemmaReading : max as keyof TetralemmaReading
  , 'literal' as keyof TetralemmaReading);
}
