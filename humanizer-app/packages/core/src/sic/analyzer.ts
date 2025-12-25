/**
 * SIC Analyzer
 *
 * Analyzes text for Subjective Intentional Constraint -
 * traces of lived constraint that distinguish human writing
 * from LLM output.
 *
 * "Burstiness detects statistics. SIC analysis detects whether
 * a mind seems to be paying the cost of being itself."
 */

import type {
  SICAnalysis,
  SICPositiveSignals,
  SICNegativeSignals,
  SICEvidence,
  SICCategory,
  SignalScore,
} from '../types/index.js';
import { POSITIVE_WEIGHTS, NEGATIVE_WEIGHTS } from './weights.js';
import * as lexicons from './lexicons.js';

export interface AnalyzeOptions {
  /** Include detailed evidence (slower) */
  includeEvidence?: boolean;

  /** Use LLM for deeper analysis (requires provider) */
  useLLM?: boolean;

  /** LLM provider for deep analysis */
  llmProvider?: LLMProvider;
}

export interface LLMProvider {
  analyze(text: string, prompt: string): Promise<string>;
}

/**
 * Analyze text for SIC signals
 */
export function analyzeSIC(
  text: string,
  options: AnalyzeOptions = {}
): SICAnalysis {
  const { includeEvidence = true } = options;

  const evidence: SICEvidence[] = [];

  // Analyze positive signals
  const positive = analyzePositiveSignals(text, evidence, includeEvidence);

  // Analyze negative signals
  const negative = analyzeNegativeSignals(text, evidence, includeEvidence);

  // Calculate scores
  const positiveScore = calculatePositiveScore(positive);
  const negativeScore = calculateNegativeScore(negative);

  // Final score: positive contribution minus negative contribution
  // Scaled to 0-100
  const rawScore = (positiveScore - negativeScore + 1) * 50;
  const score = Math.max(0, Math.min(100, rawScore));

  // Determine category based on SIC and neatness
  const neatness = calculateNeatnessIndex(text);
  const category = categorize(score, neatness);

  // Confidence based on evidence density
  const confidence = calculateConfidence(positive, negative, text.length);

  return {
    score,
    confidence,
    positive,
    negative,
    evidence: includeEvidence ? evidence : [],
    category,
  };
}

function analyzePositiveSignals(
  text: string,
  evidence: SICEvidence[],
  collectEvidence: boolean
): SICPositiveSignals {
  return {
    irreversibility: analyzeSignal(
      text,
      'irreversibility',
      'positive',
      lexicons.IRREVERSIBILITY_PATTERNS,
      POSITIVE_WEIGHTS.irreversibility,
      evidence,
      collectEvidence
    ),
    temporalPressure: analyzeSignal(
      text,
      'temporalPressure',
      'positive',
      lexicons.TEMPORAL_PRESSURE_PATTERNS,
      POSITIVE_WEIGHTS.temporalPressure,
      evidence,
      collectEvidence
    ),
    epistemicIncompleteness: analyzeSignal(
      text,
      'epistemicIncompleteness',
      'positive',
      lexicons.EPISTEMIC_INCOMPLETENESS_PATTERNS,
      POSITIVE_WEIGHTS.epistemicIncompleteness,
      evidence,
      collectEvidence
    ),
    valueTradeoffs: analyzeSignal(
      text,
      'valueTradeoffs',
      'positive',
      lexicons.VALUE_TRADEOFF_PATTERNS,
      POSITIVE_WEIGHTS.valueTradeoffs,
      evidence,
      collectEvidence
    ),
    scarTissue: analyzeSignal(
      text,
      'scarTissue',
      'positive',
      lexicons.SCAR_TISSUE_PATTERNS,
      POSITIVE_WEIGHTS.scarTissue,
      evidence,
      collectEvidence
    ),
    embodiment: analyzeSignal(
      text,
      'embodiment',
      'positive',
      lexicons.EMBODIMENT_PATTERNS,
      POSITIVE_WEIGHTS.embodiment,
      evidence,
      collectEvidence
    ),
  };
}

function analyzeNegativeSignals(
  text: string,
  evidence: SICEvidence[],
  collectEvidence: boolean
): SICNegativeSignals {
  return {
    resolutionWithoutCost: analyzeSignal(
      text,
      'resolutionWithoutCost',
      'negative',
      lexicons.RESOLUTION_WITHOUT_COST_PATTERNS,
      NEGATIVE_WEIGHTS.resolutionWithoutCost,
      evidence,
      collectEvidence
    ),
    managerVoice: analyzeSignal(
      text,
      'managerVoice',
      'negative',
      lexicons.MANAGER_VOICE_PATTERNS,
      NEGATIVE_WEIGHTS.managerVoice,
      evidence,
      collectEvidence
    ),
    symmetryCoverage: analyzeSignal(
      text,
      'symmetryCoverage',
      'negative',
      lexicons.SYMMETRY_COVERAGE_PATTERNS,
      NEGATIVE_WEIGHTS.symmetryCoverage,
      evidence,
      collectEvidence
    ),
    genericFacsimile: analyzeSignal(
      text,
      'genericFacsimile',
      'negative',
      lexicons.GENERIC_FACSIMILE_PATTERNS,
      NEGATIVE_WEIGHTS.genericFacsimile,
      evidence,
      collectEvidence
    ),
  };
}

function analyzeSignal(
  text: string,
  signalName: keyof SICPositiveSignals | keyof SICNegativeSignals,
  polarity: 'positive' | 'negative',
  patterns: RegExp[],
  weight: number,
  evidence: SICEvidence[],
  collectEvidence: boolean
): SignalScore {
  let totalMatches = 0;
  const textLower = text.toLowerCase();

  for (const pattern of patterns) {
    // Reset regex state
    pattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      totalMatches++;

      if (collectEvidence) {
        // Get surrounding context
        const start = Math.max(0, match.index - 30);
        const end = Math.min(text.length, match.index + match[0].length + 30);
        const quote = text.slice(start, end);

        evidence.push({
          signal: signalName,
          polarity,
          quote: (start > 0 ? '...' : '') + quote + (end < text.length ? '...' : ''),
          offset: match.index,
          rationale: `Matched pattern: ${pattern.source.slice(0, 50)}...`,
          strength: calculateMatchStrength(match[0], textLower),
        });
      }
    }
  }

  // Normalize to 0-4 scale based on text length
  const wordsApprox = text.split(/\s+/).length;
  const normalizedDensity = (totalMatches / Math.max(wordsApprox, 1)) * 100;

  // Map density to 0-4 score
  // 0 matches = 0, increasing logarithmically
  const raw = Math.min(4, Math.log2(normalizedDensity + 1) * 1.5);

  return {
    raw,
    weighted: raw * weight,
    count: totalMatches,
  };
}

function calculateMatchStrength(match: string, fullText: string): number {
  // Stronger if the match is longer or appears in a more significant context
  const lengthScore = Math.min(match.length / 20, 1);

  // Could add more sophisticated strength calculation
  return 1 + lengthScore * 3; // 1-4 range
}

function calculatePositiveScore(signals: SICPositiveSignals): number {
  return (
    signals.irreversibility.weighted +
    signals.temporalPressure.weighted +
    signals.epistemicIncompleteness.weighted +
    signals.valueTradeoffs.weighted +
    signals.scarTissue.weighted +
    signals.embodiment.weighted
  );
}

function calculateNegativeScore(signals: SICNegativeSignals): number {
  return (
    signals.resolutionWithoutCost.weighted +
    signals.managerVoice.weighted +
    signals.symmetryCoverage.weighted +
    signals.genericFacsimile.weighted
  );
}

/**
 * Calculate "neatness" index for the diagnostic 2D map
 * High neatness = grammatically perfect, rhetorically closed, low contradiction
 */
function calculateNeatnessIndex(text: string): number {
  let neatness = 0.5; // Start neutral

  // Sentence length variance (low variance = more neat)
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length > 1) {
    const lengths = sentences.map((s) => s.trim().split(/\s+/).length);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance =
      lengths.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / lengths.length;
    const cv = Math.sqrt(variance) / mean; // Coefficient of variation

    // Low CV = consistent sentence lengths = more neat
    neatness += (1 - Math.min(cv, 1)) * 0.2;
  }

  // Rhetorical closure markers
  const closurePatterns = [
    /in conclusion/i,
    /therefore/i,
    /thus/i,
    /hence/i,
    /as we have seen/i,
    /this demonstrates/i,
  ];
  const closureCount = closurePatterns.filter((p) => p.test(text)).length;
  neatness += Math.min(closureCount * 0.1, 0.2);

  // Paragraph structure (if present)
  const paragraphs = text.split(/\n\n+/);
  if (paragraphs.length > 2) {
    // Multiple paragraphs suggest structure = more neat
    neatness += 0.1;
  }

  return Math.min(1, Math.max(0, neatness));
}

function categorize(sicScore: number, neatness: number): SICCategory {
  const highSIC = sicScore > 50;
  const highNeat = neatness > 0.5;

  if (highSIC && highNeat) return 'polished-human';
  if (highSIC && !highNeat) return 'raw-human';
  if (!highSIC && highNeat) return 'neat-slop';
  return 'messy-low-craft';
}

function calculateConfidence(
  positive: SICPositiveSignals,
  negative: SICNegativeSignals,
  textLength: number
): number {
  // More evidence = higher confidence
  const totalEvidence =
    positive.irreversibility.count +
    positive.temporalPressure.count +
    positive.epistemicIncompleteness.count +
    positive.valueTradeoffs.count +
    positive.scarTissue.count +
    positive.embodiment.count +
    negative.resolutionWithoutCost.count +
    negative.managerVoice.count +
    negative.symmetryCoverage.count +
    negative.genericFacsimile.count;

  // Longer text with more evidence = higher confidence
  const evidenceDensity = totalEvidence / Math.max(textLength / 100, 1);

  // Asymptotic approach to 1.0
  return Math.min(0.95, 1 - Math.exp(-evidenceDensity * 2));
}

/**
 * Quick check for a single sentence
 */
export function quickSIC(sentence: string): number {
  const result = analyzeSIC(sentence, { includeEvidence: false });
  return result.score;
}

/**
 * Batch analyze multiple texts
 */
export function batchAnalyzeSIC(
  texts: string[],
  options: AnalyzeOptions = {}
): SICAnalysis[] {
  return texts.map((text) => analyzeSIC(text, options));
}
