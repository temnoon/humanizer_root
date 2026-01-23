/**
 * AI Detection Engine
 *
 * Combines statistical features into a composite AI likelihood score.
 * Uses weighted combination of burstiness, punctuation, vocabulary, and tell-phrases.
 */

import type {
  DetectionResult,
  DetectionOptions,
  SentenceAnalysis,
  HumanizationRecommendation,
  ExtractedFeatures,
  FEATURE_WEIGHTS,
  HUMAN_BASELINES,
  AI_BASELINES,
  THRESHOLDS,
  DETECTOR_VERSION,
  FEATURE_WEIGHTS_STATISTICAL,
} from './types.js';
import { extractFeatures, splitSentences, compareToBaselines } from './feature-extractor.js';
import { scoreTellPhrases, getReplacementSuggestions } from './tell-phrases.js';

// Re-import constants for use
const WEIGHTS = {
  semicolonRate: 0.30,
  burstiness: 0.25,
  emDashRate: 0.15,
  enDashRate: 0.10,
  tellPhraseScore: 0.15,
  ngramDiversity: 0.05,
};

const HUMAN = {
  burstiness: 0.874,
  semicolonRate: 1.447,
  emDashRate: 0.5,
};

const AI = {
  burstiness: { min: 0.37, max: 0.69, typical: 0.45 },
  semicolonRate: { min: 0.0, max: 0.36, typical: 0.1 },
  emDashRate: { min: 0.5, max: 2.0, typical: 1.2 },
};

const THRESHOLD = {
  aiLikely: 60,
  humanLikely: 35,
};

const VERSION = '2.1.0-npe';

// ═══════════════════════════════════════════════════════════════════════════
// Feature Scoring Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Score burstiness feature (0-100 AI likelihood).
 *
 * Human: ~0.87 (high variance)
 * AI: 0.37-0.69 (uniform sentence lengths)
 */
function scoreBurstiness(burstiness: number): number {
  if (burstiness >= HUMAN.burstiness) {
    // Very human-like
    return 10;
  } else if (burstiness <= AI.burstiness.max && burstiness >= AI.burstiness.min) {
    // In AI range
    const aiScore = 70 + (AI.burstiness.typical - burstiness) / (AI.burstiness.typical - AI.burstiness.min) * 20;
    return Math.min(90, Math.max(50, aiScore));
  } else if (burstiness > AI.burstiness.max && burstiness < HUMAN.burstiness) {
    // Between AI and human ranges
    const range = HUMAN.burstiness - AI.burstiness.max;
    const position = (burstiness - AI.burstiness.max) / range;
    return 50 - position * 30;
  } else {
    // Below AI min (very uniform, likely AI)
    return 95;
  }
}

/**
 * Score semicolon usage (0-100 AI likelihood).
 *
 * Human: ~1.45%
 * AI: 0-0.36% (rarely uses semicolons)
 */
function scoreSemicolons(semicolonRate: number): number {
  if (semicolonRate >= HUMAN.semicolonRate * 0.5) {
    // Good semicolon usage - human-like
    return 15;
  } else if (semicolonRate <= AI.semicolonRate.max) {
    // Very low or no semicolons - AI-like
    return 85;
  } else {
    // In between
    const range = HUMAN.semicolonRate * 0.5 - AI.semicolonRate.max;
    const position = (semicolonRate - AI.semicolonRate.max) / range;
    return 85 - position * 60;
  }
}

/**
 * Score em-dash usage (0-100 AI likelihood).
 *
 * AI tends to overuse em-dashes.
 */
function scoreEmDashes(emDashRate: number): number {
  if (emDashRate >= AI.emDashRate.typical) {
    // High em-dash usage - AI-like
    const excess = emDashRate - AI.emDashRate.typical;
    return Math.min(80, 60 + excess * 20);
  } else if (emDashRate <= HUMAN.emDashRate) {
    // Low em-dash usage - human-like
    return 30;
  } else {
    // In between
    const range = AI.emDashRate.typical - HUMAN.emDashRate;
    const position = (emDashRate - HUMAN.emDashRate) / range;
    return 30 + position * 30;
  }
}

/**
 * Score tell-phrase analysis (0-100 AI likelihood).
 *
 * Positive score = AI-like phrases dominate
 * Negative score = Human-like phrases dominate
 */
function scoreTellPhraseSignal(tellScore: number): number {
  // tellScore is -1 to +1
  // Map to 0-100 where higher = more AI-like
  const normalized = (tellScore + 1) / 2; // 0 to 1
  return normalized * 100;
}

/**
 * Score n-gram diversity.
 *
 * Lower diversity can indicate AI (repetitive patterns).
 */
function scoreNgramDiversity(bigramDiversity: number, trigramDiversity: number): number {
  const avgDiversity = (bigramDiversity + trigramDiversity) / 2;

  if (avgDiversity >= 0.9) {
    // Very high diversity - human-like
    return 25;
  } else if (avgDiversity <= 0.6) {
    // Low diversity - AI-like (repetitive)
    return 75;
  } else {
    // In between
    const range = 0.9 - 0.6;
    const position = (avgDiversity - 0.6) / range;
    return 75 - position * 50;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Sentence-Level Analysis
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analyze individual sentences for AI likelihood.
 */
function analyzeSentences(text: string): SentenceAnalysis[] {
  const sentences = splitSentences(text);
  const results: SentenceAnalysis[] = [];

  let offset = 0;

  for (const sentence of sentences) {
    const wordCount = sentence.split(/\s+/).filter(w => w.length > 0).length;
    const flags: string[] = [];
    let aiLikelihood = 50; // Start neutral

    // Check for AI tells in this sentence
    const sentenceTells = scoreTellPhrases(sentence);
    if (sentenceTells.aiTellWeight > 0) {
      flags.push('ai-tell-phrase');
      aiLikelihood += 20;
    }
    if (sentenceTells.humanTellWeight > 0) {
      flags.push('human-tell-phrase');
      aiLikelihood -= 15;
    }

    // Check sentence length (AI tends toward uniform 15-25 word sentences)
    if (wordCount >= 15 && wordCount <= 25) {
      flags.push('typical-ai-length');
      aiLikelihood += 10;
    } else if (wordCount < 8 || wordCount > 35) {
      flags.push('varied-length');
      aiLikelihood -= 10;
    }

    // Clamp to 0-100
    aiLikelihood = Math.max(0, Math.min(100, aiLikelihood));

    results.push({
      text: sentence,
      startOffset: offset,
      wordCount,
      aiLikelihood,
      flags,
      isSuspect: aiLikelihood >= 65,
    });

    offset += sentence.length + 1; // +1 for space
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// Humanization Recommendations
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate humanization recommendations based on features.
 */
function generateRecommendations(
  features: ExtractedFeatures,
  tellScore: ReturnType<typeof scoreTellPhrases>
): HumanizationRecommendation[] {
  const recommendations: HumanizationRecommendation[] = [];
  const { burstiness, punctuation, vocabulary } = features;

  // Burstiness recommendation
  if (burstiness.burstiness < 0.6) {
    recommendations.push({
      type: 'burstiness',
      priority: 'high',
      description: 'Sentence lengths are too uniform. Vary sentence lengths more.',
      currentValue: burstiness.burstiness,
      targetValue: HUMAN.burstiness,
      suggestedFix: 'Mix short punchy sentences with longer flowing ones.',
    });
  }

  // Semicolon recommendation
  if (punctuation.semicolonRate < 0.5) {
    recommendations.push({
      type: 'semicolons',
      priority: 'high',
      description: 'Consider using semicolons to join related clauses.',
      currentValue: punctuation.semicolonRate,
      targetValue: HUMAN.semicolonRate,
      suggestedFix: 'Replace some periods or commas with semicolons where clauses are related.',
    });
  }

  // Em-dash recommendation
  if (punctuation.emDashRate > 1.5) {
    recommendations.push({
      type: 'em-dashes',
      priority: 'medium',
      description: 'Reduce em-dash usage; AI tends to overuse them.',
      currentValue: punctuation.emDashRate,
      targetValue: HUMAN.emDashRate,
      suggestedFix: 'Replace some em-dashes with commas or parentheses.',
    });
  }

  // Tell-phrase recommendations
  if (tellScore.aiTellWeight > 1) {
    const suggestions = getReplacementSuggestions(tellScore);
    const topSuggestion = suggestions[0];

    recommendations.push({
      type: 'tell-words',
      priority: 'high',
      description: `Remove or replace AI tell-phrases like "${topSuggestion?.phrase || 'various phrases'}"`,
      currentValue: tellScore.aiTellWeight,
      targetValue: 0,
      suggestedFix: topSuggestion
        ? `Replace "${topSuggestion.phrase}" with "${topSuggestion.replacements[0]}"`
        : 'Simplify formal transition phrases.',
    });
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Detection Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect AI likelihood in text using statistical analysis.
 *
 * Returns a comprehensive detection result with scores, features,
 * and humanization recommendations.
 */
export function detect(text: string, options: DetectionOptions = {}): DetectionResult {
  const startTime = Date.now();

  const {
    returnSentenceAnalysis = false,
    returnHumanizationRecommendations = true,
    minTextLength = 100,
  } = options;

  // Extract features
  const extractedFeatures = extractFeatures(text);
  const tellPhraseResult = scoreTellPhrases(text);

  // Score individual features
  const burstinessScore = scoreBurstiness(extractedFeatures.burstiness.burstiness);
  const semicolonScore = scoreSemicolons(extractedFeatures.punctuation.semicolonRate);
  const emDashScore = scoreEmDashes(extractedFeatures.punctuation.emDashRate);
  const tellScore = scoreTellPhraseSignal(tellPhraseResult.score);
  const ngramScore = scoreNgramDiversity(
    extractedFeatures.vocabulary.bigramDiversity,
    extractedFeatures.vocabulary.trigramDiversity
  );

  // Weighted composite score
  const aiLikelihood =
    burstinessScore * WEIGHTS.burstiness +
    semicolonScore * WEIGHTS.semicolonRate +
    emDashScore * WEIGHTS.emDashRate +
    tellScore * WEIGHTS.tellPhraseScore +
    ngramScore * WEIGHTS.ngramDiversity +
    // En-dash weight goes to em-dash for simplicity
    emDashScore * WEIGHTS.enDashRate;

  // Determine confidence based on text length and feature agreement
  let confidence: 'low' | 'medium' | 'high' = 'medium';
  if (text.length < minTextLength) {
    confidence = 'low';
  } else if (text.length > 500 && extractedFeatures.burstiness.sentenceCount >= 5) {
    confidence = 'high';
  }

  // Determine verdict
  let verdict: 'human' | 'mixed' | 'ai' = 'mixed';
  if (aiLikelihood >= THRESHOLD.aiLikely) {
    verdict = 'ai';
  } else if (aiLikelihood <= THRESHOLD.humanLikely) {
    verdict = 'human';
  }

  // Optional sentence analysis
  const sentenceAnalysis = returnSentenceAnalysis ? analyzeSentences(text) : undefined;

  // Humanization recommendations
  const humanizationRecommendations = returnHumanizationRecommendations
    ? generateRecommendations(extractedFeatures, tellPhraseResult)
    : [];

  const processingTimeMs = Date.now() - startTime;

  return {
    aiLikelihood,
    confidence,
    verdict,
    features: {
      burstiness: extractedFeatures.burstiness.burstiness,
      semicolonRate: extractedFeatures.punctuation.semicolonRate,
      emDashRate: extractedFeatures.punctuation.emDashRate,
      tellPhraseScore: tellPhraseResult.score,
      ngramDiversity: extractedFeatures.vocabulary.bigramDiversity,
    },
    extractedFeatures,
    tellPhrases: tellPhraseResult,
    sentenceAnalysis,
    humanizationRecommendations,
    processingTimeMs,
    detectorVersion: VERSION,
    method: 'statistical',
  };
}

/**
 * Quick detection for screening (faster, less detailed).
 */
export function detectQuick(text: string): { aiLikelihood: number; verdict: 'human' | 'mixed' | 'ai' } {
  const result = detect(text, {
    returnSentenceAnalysis: false,
    returnHumanizationRecommendations: false,
  });

  return {
    aiLikelihood: result.aiLikelihood,
    verdict: result.verdict,
  };
}

/**
 * Get a human-readable explanation of the detection result.
 */
export function explainResult(result: DetectionResult): string {
  const lines: string[] = [];

  lines.push(`AI Likelihood: ${result.aiLikelihood.toFixed(1)}% (${result.verdict})`);
  lines.push(`Confidence: ${result.confidence}`);
  lines.push('');
  lines.push('Key Features:');

  const comparison = compareToBaselines(result.extractedFeatures);

  for (const item of comparison.aiLike) {
    lines.push(`  ⚠️ ${item}`);
  }
  for (const item of comparison.humanLike) {
    lines.push(`  ✓ ${item}`);
  }
  for (const item of comparison.neutral) {
    lines.push(`  • ${item}`);
  }

  if (result.tellPhrases.matches.length > 0) {
    lines.push('');
    lines.push('Tell-Phrases Found:');
    for (const match of result.tellPhrases.matches.slice(0, 3)) {
      const icon = match.direction === 'ai' ? '⚠️' : '✓';
      lines.push(`  ${icon} "${match.phrase}" (×${match.count})`);
    }
  }

  return lines.join('\n');
}
