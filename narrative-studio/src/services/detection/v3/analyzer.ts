/**
 * V3 AI Analyzer
 *
 * Main entry point for V3 analysis combining:
 * - Sentence-level perplexity analysis
 * - Narrative-level Chekhov ratio (specificity fulfillment)
 * - Actionable transformation suggestions
 *
 * Designed to minimize external API dependency (GPTZero) by doing
 * most analysis locally.
 */

import { DEFAULT_CONFIG } from './types.js';
import type {
  V3Analysis,
  V3Config,
  Transformation,
  SentenceAnalysis,
  CompletenessInfo
} from './types.js';

import {
  segmentSentences,
  analyzeDocument,
  getPerplexityStats
} from './perplexity.js';

import {
  extractEntities,
  analyzeChekhovRatio,
  getChekhovSummary
} from './chekhov.js';

import {
  analyzeCompleteness,
  getCompletenessSummary
} from './completeness.js';

// ============================================================
// Main Analysis Function
// ============================================================

/**
 * Perform full V3 analysis on text.
 */
export async function analyzeText(
  text: string,
  config: V3Config = DEFAULT_CONFIG
): Promise<V3Analysis> {
  const startTime = Date.now();

  // Basic stats
  const sentences = segmentSentences(text);
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

  // Sentence-level analysis (perplexity, burstiness, flags)
  const sentenceAnalyses = analyzeDocument(text, config);
  const perplexityStats = getPerplexityStats(sentenceAnalyses);

  // Narrative-level analysis (Chekhov ratio)
  const entities = extractEntities(sentences, config);
  const chekhov = analyzeChekhovRatio(entities, config);

  // Completeness analysis (affects Chekhov weighting)
  const completenessResult = analyzeCompleteness(text, config);
  const completeness: CompletenessInfo = {
    classification: completenessResult.classification,
    confidence: completenessResult.confidence,
    chekhovWeight: completenessResult.recommendedChekhovWeight,
  };

  // Calculate scores with dynamic Chekhov weighting
  const scores = calculateScores(sentenceAnalyses, chekhov, perplexityStats, completeness, config);

  // Determine classification
  const { classification, confidence } = classify(scores);

  // Collect and prioritize all transformations
  const transformations = collectTransformations(sentenceAnalyses, chekhov);

  const processingTimeMs = Date.now() - startTime;

  return {
    text,
    wordCount,
    sentenceCount: sentences.length,
    sentences: sentenceAnalyses,
    meanPerplexity: perplexityStats.mean,
    perplexityVariance: perplexityStats.variance,
    chekhov,
    completeness,
    scores,
    classification,
    confidence,
    transformations,
    analyzedAt: new Date().toISOString(),
    processingTimeMs
  };
}

// ============================================================
// Scoring
// ============================================================

/**
 * Calculate component scores and composite.
 *
 * Uses DYNAMIC Chekhov weighting based on completeness:
 * - Complete works: full Chekhov weight (entities should be fulfilled)
 * - Excerpts: reduced Chekhov weight (entities may be fulfilled elsewhere)
 * - Uncertain: moderate weight
 *
 * Other weights are redistributed proportionally to maintain sum = 1.
 */
function calculateScores(
  sentences: SentenceAnalysis[],
  chekhov: ReturnType<typeof analyzeChekhovRatio>,
  perplexityStats: ReturnType<typeof getPerplexityStats>,
  completeness: CompletenessInfo,
  config: V3Config
): V3Analysis['scores'] {
  // Perplexity score: higher variance and mean = more human-like
  // Normalize to 0-1 where 1 = human-like
  const perplexityScore = normalizePerplexityScore(
    perplexityStats.mean,
    perplexityStats.variance,
    config
  );

  // Burstiness score: higher average burstiness = more human-like
  const avgBurstiness = sentences.reduce((sum, s) => sum + s.burstiness, 0) / sentences.length;
  const burstiessScore = Math.min(avgBurstiness / 0.5, 1); // Normalize where 0.5+ = very human

  // Chekhov score: directly use the ratio
  const chekhovScore = chekhov.chekhovRatio;

  // DYNAMIC WEIGHTING based on completeness
  // Use the recommended Chekhov weight from completeness analysis
  const effectiveChekhovWeight = completeness.chekhovWeight;

  // Redistribute remaining weight proportionally to perplexity and burstiness
  // Original ratio: perplexity:burstiness = 0.35:0.25 = 7:5
  const nonChekhovWeight = 1 - effectiveChekhovWeight;
  const perplexityWeight = nonChekhovWeight * (7 / 12);  // 7/(7+5)
  const burstiessWeight = nonChekhovWeight * (5 / 12);   // 5/(7+5)

  // Composite: weighted average with dynamic weights
  const composite =
    perplexityScore * perplexityWeight +
    burstiessScore * burstiessWeight +
    chekhovScore * effectiveChekhovWeight;

  return {
    perplexityScore,
    burstiessScore,
    chekhovScore,
    composite,
    effectiveChekhovWeight
  };
}

/**
 * Normalize perplexity metrics to a 0-1 score.
 */
function normalizePerplexityScore(
  mean: number,
  variance: number,
  config: V3Config
): number {
  // Mean perplexity: 10-20 is AI-like, 30-50 is human-like
  const meanScore = Math.min(Math.max((mean - 10) / 40, 0), 1);

  // Variance: 0-50 is AI-like, 100+ is human-like
  const varianceScore = Math.min(variance / 100, 1);

  // Combine (mean matters more)
  return meanScore * 0.7 + varianceScore * 0.3;
}

// ============================================================
// Classification
// ============================================================

/**
 * Classify text based on scores.
 */
function classify(scores: V3Analysis['scores']): {
  classification: V3Analysis['classification'];
  confidence: number;
} {
  const { composite } = scores;

  // Classification thresholds
  if (composite >= 0.6) {
    return {
      classification: 'LIKELY_HUMAN',
      confidence: Math.min((composite - 0.5) * 2, 0.95)
    };
  } else if (composite <= 0.4) {
    return {
      classification: 'LIKELY_AI',
      confidence: Math.min((0.5 - composite) * 2, 0.95)
    };
  } else {
    return {
      classification: 'UNCERTAIN',
      confidence: 1 - Math.abs(composite - 0.5) * 4
    };
  }
}

// ============================================================
// Transformation Collection
// ============================================================

/**
 * Collect and prioritize all transformation suggestions.
 */
function collectTransformations(
  sentences: SentenceAnalysis[],
  chekhov: ReturnType<typeof analyzeChekhovRatio>
): Transformation[] {
  const transformations: Transformation[] = [];

  // Collect sentence-level transformations
  sentences.forEach(s => {
    transformations.push(...s.transformations);
  });

  // Add Chekhov-based transformations
  chekhov.suggestions.forEach(suggestion => {
    const transform: Transformation = {
      type: suggestion.suggestionType === 'FULFILL' ? 'PAYOFF_ADD' :
            suggestion.suggestionType === 'DEMOTE' ? 'SPECIFICITY_REMOVE' :
            'DELETION',
      target: suggestion.entity.text,
      location: 'phrase',
      suggestion: suggestion.rationale,
      rationale: `Entity "${suggestion.entity.text}" is ${suggestion.entity.status.toLowerCase()}`,
      priority: suggestion.entity.firstPosition < 0.3 ? 'high' : 'medium',
      automated: false
    };

    if (suggestion.example) {
      transform.suggestion += ` Example: ${suggestion.example}`;
    }

    transformations.push(transform);
  });

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  transformations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return transformations;
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Get a human-readable summary of the analysis.
 */
export function getSummary(analysis: V3Analysis): string {
  const lines: string[] = [];

  // Classification
  lines.push(`Classification: ${analysis.classification} (${(analysis.confidence * 100).toFixed(0)}% confidence)`);
  lines.push('');

  // Completeness assessment
  const comp = analysis.completeness;
  lines.push(`Completeness: ${comp.classification} (${(comp.confidence * 100).toFixed(0)}% conf) → Chekhov weight: ${(comp.chekhovWeight * 100).toFixed(0)}%`);
  lines.push('');

  // Scores
  lines.push('Scores:');
  lines.push(`  Perplexity:  ${(analysis.scores.perplexityScore * 100).toFixed(0)}%`);
  lines.push(`  Burstiness:  ${(analysis.scores.burstiessScore * 100).toFixed(0)}%`);
  lines.push(`  Chekhov:     ${(analysis.scores.chekhovScore * 100).toFixed(0)}% (effective weight: ${(analysis.scores.effectiveChekhovWeight * 100).toFixed(0)}%)`);
  lines.push(`  Composite:   ${(analysis.scores.composite * 100).toFixed(0)}%`);
  lines.push('');

  // Chekhov details
  lines.push(getChekhovSummary(analysis.chekhov));
  lines.push('');

  // Flagged sentences
  const flagged = analysis.sentences.filter(s => s.flags.length > 0);
  if (flagged.length > 0) {
    lines.push(`Flagged Sentences: ${flagged.length}/${analysis.sentenceCount}`);
    flagged.slice(0, 5).forEach(s => {
      lines.push(`  [${s.flags.join(', ')}] "${s.text.slice(0, 60)}..."`);
    });
    if (flagged.length > 5) {
      lines.push(`  ... and ${flagged.length - 5} more`);
    }
    lines.push('');
  }

  // Top transformations
  if (analysis.transformations.length > 0) {
    lines.push(`Suggested Transformations: ${analysis.transformations.length}`);
    analysis.transformations.slice(0, 5).forEach(t => {
      lines.push(`  [${t.priority}] ${t.type}: ${t.suggestion.slice(0, 70)}...`);
    });
  }

  return lines.join('\n');
}

/**
 * Get just the flagged sentences with their issues.
 */
export function getFlaggedSentences(analysis: V3Analysis): Array<{
  text: string;
  flags: string[];
  perplexity: number;
  suggestions: string[];
}> {
  return analysis.sentences
    .filter(s => s.flags.length > 0)
    .map(s => ({
      text: s.text,
      flags: s.flags,
      perplexity: s.perplexity,
      suggestions: s.transformations.map(t => t.suggestion)
    }));
}

/**
 * Get orphaned entities that need attention.
 */
export function getOrphanedEntities(analysis: V3Analysis): Array<{
  entity: string;
  type: string;
  position: string;
  suggestion: string;
}> {
  return analysis.chekhov.orphanedEntities.map(e => {
    const suggestion = analysis.chekhov.suggestions.find(s => s.entity.id === e.id);
    return {
      entity: e.text,
      type: e.type,
      position: `${(e.firstPosition * 100).toFixed(0)}%`,
      suggestion: suggestion?.rationale || 'Consider removing or fulfilling this specificity'
    };
  });
}

// ============================================================
// Quick Analysis (Minimal Output)
// ============================================================

/**
 * Quick analysis returning just key metrics.
 */
export async function quickAnalyze(text: string): Promise<{
  classification: string;
  confidence: number;
  composite: number;
  chekhovRatio: number;
  flaggedCount: number;
  topIssues: string[];
}> {
  const analysis = await analyzeText(text);

  return {
    classification: analysis.classification,
    confidence: analysis.confidence,
    composite: analysis.scores.composite,
    chekhovRatio: analysis.chekhov.chekhovRatio,
    flaggedCount: analysis.sentences.filter(s => s.flags.length > 0).length,
    topIssues: analysis.transformations.slice(0, 3).map(t => t.suggestion)
  };
}
