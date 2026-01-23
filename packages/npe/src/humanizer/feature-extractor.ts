/**
 * Feature Extraction for AI Detection
 *
 * Extracts statistical features from text that correlate with AI vs human authorship:
 * - Burstiness (sentence length variance) - PRIMARY SIGNAL
 * - Punctuation patterns (semicolons, em-dashes) - STRONG SIGNALS
 * - Vocabulary diversity (TTR, hapax, n-grams)
 */

import type {
  BurstinessMetrics,
  PunctuationProfile,
  VocabularyMetrics,
  ExtractedFeatures,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════
// Sentence Splitting
// ═══════════════════════════════════════════════════════════════════════════

const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'vs', 'etc', 'inc', 'ltd',
  'st', 'ave', 'blvd', 'rd', 'apt', 'no', 'vol', 'pp', 'ed', 'eds',
  'i.e', 'e.g', 'cf', 'et al', 'fig', 'approx',
]);

/**
 * Split text into sentences using robust heuristics.
 */
export function splitSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();

  const sentences: string[] = [];
  let current = '';
  let i = 0;

  while (i < normalized.length) {
    const char = normalized[i];
    current += char;

    if (char === '.' || char === '!' || char === '?') {
      const nextChar = normalized[i + 1];
      const afterNext = normalized[i + 2];

      const isEndOfText = i === normalized.length - 1;
      const hasSpaceCapital = nextChar === ' ' && afterNext && /[A-Z"'\u201c\u2018]/.test(afterNext);

      if (isEndOfText || hasSpaceCapital) {
        const words = current.trim().split(/\s+/);
        const lastWord = words[words.length - 1]?.toLowerCase().replace(/[.!?]+$/, '') || '';

        if (char === '.' && ABBREVIATIONS.has(lastWord)) {
          i++;
          continue;
        }

        if (char === '.' && /\d$/.test(current.slice(0, -1)) && /^\d/.test(nextChar || '')) {
          i++;
          continue;
        }

        const sentence = current.trim();
        if (sentence.length > 0) {
          sentences.push(sentence);
        }
        current = '';
      }
    }

    i++;
  }

  const remaining = current.trim();
  if (remaining.length > 0) {
    sentences.push(remaining);
  }

  return sentences.filter(s => s.length > 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// Burstiness Calculation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate burstiness metrics from text.
 *
 * Burstiness = σ/μ (coefficient of variation of sentence lengths)
 *
 * Human text: ~0.87 (high variance)
 * AI text: 0.37-0.69 (lower variance, more uniform)
 */
export function calculateBurstiness(text: string): BurstinessMetrics {
  const sentences = splitSentences(text);

  if (sentences.length === 0) {
    return {
      burstiness: 0,
      meanSentenceLength: 0,
      stdSentenceLength: 0,
      sentenceCount: 0,
      sentenceLengths: [],
    };
  }

  const sentenceLengths = sentences.map(s =>
    s.split(/\s+/).filter(w => w.length > 0).length
  );

  const n = sentenceLengths.length;
  const sum = sentenceLengths.reduce((a, b) => a + b, 0);
  const mean = sum / n;

  const squaredDiffs = sentenceLengths.map(len => Math.pow(len - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(avgSquaredDiff);

  const burstiness = mean > 0 ? std / mean : 0;

  return {
    burstiness,
    meanSentenceLength: mean,
    stdSentenceLength: std,
    sentenceCount: n,
    sentenceLengths,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Punctuation Analysis
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analyze punctuation patterns in text.
 *
 * Key findings:
 * - Semicolons: Human ~1.45%, AI 0-0.35% (strongest signal, r = -0.686)
 * - Em-dashes: AI tends to overuse
 */
export function analyzePunctuation(text: string): PunctuationProfile {
  const counts = {
    semicolons: (text.match(/;/g) || []).length,
    emDashes: (text.match(/\u2014|---/g) || []).length,
    enDashes: (text.match(/\u2013|--(?!-)/g) || []).length,
    questions: (text.match(/\?/g) || []).length,
    exclamations: (text.match(/!/g) || []).length,
    commas: (text.match(/,/g) || []).length,
    periods: (text.match(/\./g) || []).length,
  };

  const totalPunctuation =
    counts.semicolons +
    counts.emDashes +
    counts.enDashes +
    counts.questions +
    counts.exclamations +
    counts.commas +
    counts.periods;

  const rate = (count: number) =>
    totalPunctuation > 0 ? (count / totalPunctuation) * 100 : 0;

  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  const commaDensity = wordCount > 0 ? (counts.commas / wordCount) * 100 : 0;

  return {
    semicolonRate: rate(counts.semicolons),
    emDashRate: rate(counts.emDashes),
    enDashRate: rate(counts.enDashes),
    questionRate: rate(counts.questions),
    exclamationRate: rate(counts.exclamations),
    commaDensity,
    totalPunctuation,
    counts,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Vocabulary Analysis
// ═══════════════════════════════════════════════════════════════════════════

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);
}

/**
 * Analyze vocabulary richness metrics.
 */
export function analyzeVocabulary(text: string): VocabularyMetrics {
  const tokens = tokenize(text);
  const wordCount = tokens.length;

  if (wordCount === 0) {
    return {
      typeTokenRatio: 0,
      hapaxRatio: 0,
      bigramDiversity: 0,
      trigramDiversity: 0,
      wordCount: 0,
      uniqueWordCount: 0,
    };
  }

  const wordFreq = new Map<string, number>();
  for (const word of tokens) {
    wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
  }

  const uniqueWordCount = wordFreq.size;
  const typeTokenRatio = uniqueWordCount / wordCount;

  let hapaxCount = 0;
  for (const count of wordFreq.values()) {
    if (count === 1) hapaxCount++;
  }
  const hapaxRatio = uniqueWordCount > 0 ? hapaxCount / uniqueWordCount : 0;

  const bigrams = new Set<string>();
  const trigrams = new Set<string>();

  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.add(`${tokens[i]} ${tokens[i + 1]}`);
    if (i < tokens.length - 2) {
      trigrams.add(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
    }
  }

  const totalBigrams = Math.max(1, tokens.length - 1);
  const totalTrigrams = Math.max(1, tokens.length - 2);

  const bigramDiversity = bigrams.size / totalBigrams;
  const trigramDiversity = trigrams.size / totalTrigrams;

  return {
    typeTokenRatio,
    hapaxRatio,
    bigramDiversity,
    trigramDiversity,
    wordCount,
    uniqueWordCount,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Feature Extraction
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract all features from text for AI detection.
 */
export function extractFeatures(text: string): ExtractedFeatures {
  const startTime = Date.now();

  const burstiness = calculateBurstiness(text);
  const punctuation = analyzePunctuation(text);
  const vocabulary = analyzeVocabulary(text);

  const processingTimeMs = Date.now() - startTime;

  return {
    burstiness,
    punctuation,
    vocabulary,
    processingTimeMs,
  };
}

/**
 * Get a summary of features for quick inspection.
 */
export function featureSummary(features: ExtractedFeatures): Record<string, number> {
  return {
    burstiness: features.burstiness.burstiness,
    meanSentenceLength: features.burstiness.meanSentenceLength,
    sentenceCount: features.burstiness.sentenceCount,
    semicolonRate: features.punctuation.semicolonRate,
    emDashRate: features.punctuation.emDashRate,
    enDashRate: features.punctuation.enDashRate,
    typeTokenRatio: features.vocabulary.typeTokenRatio,
    hapaxRatio: features.vocabulary.hapaxRatio,
    bigramDiversity: features.vocabulary.bigramDiversity,
    wordCount: features.vocabulary.wordCount,
  };
}

/**
 * Compare features against human/AI baselines.
 */
export function compareToBaselines(features: ExtractedFeatures): {
  humanLike: string[];
  aiLike: string[];
  neutral: string[];
} {
  const humanLike: string[] = [];
  const aiLike: string[] = [];
  const neutral: string[] = [];

  const { burstiness, punctuation } = features;

  // Burstiness (human ~0.87, AI 0.37-0.69)
  if (burstiness.burstiness > 0.75) {
    humanLike.push(`High burstiness (${burstiness.burstiness.toFixed(3)})`);
  } else if (burstiness.burstiness < 0.50) {
    aiLike.push(`Low burstiness (${burstiness.burstiness.toFixed(3)})`);
  } else {
    neutral.push(`Moderate burstiness (${burstiness.burstiness.toFixed(3)})`);
  }

  // Semicolons (human ~1.45%, AI 0-0.35%)
  if (punctuation.semicolonRate > 0.8) {
    humanLike.push(`High semicolon usage (${punctuation.semicolonRate.toFixed(2)}%)`);
  } else if (punctuation.semicolonRate < 0.1) {
    aiLike.push(`No/minimal semicolons (${punctuation.semicolonRate.toFixed(2)}%)`);
  } else {
    neutral.push(`Some semicolons (${punctuation.semicolonRate.toFixed(2)}%)`);
  }

  // Em-dashes (AI tends to overuse)
  if (punctuation.emDashRate > 1.5) {
    aiLike.push(`High em-dash usage (${punctuation.emDashRate.toFixed(2)}%)`);
  } else if (punctuation.emDashRate < 0.3) {
    humanLike.push(`Low em-dash usage (${punctuation.emDashRate.toFixed(2)}%)`);
  }

  return { humanLike, aiLike, neutral };
}
