/**
 * Perplexity Analyzer
 *
 * Calculates sentence-level perplexity to identify "smooth" AI text.
 *
 * Lower perplexity = more predictable = more likely AI
 * Higher perplexity = more surprising = more likely human
 *
 * Also calculates "burstiness" - the variance in perplexity across sentences.
 * Human writing has high burstiness (short punchy + long complex mixed).
 * AI writing has low burstiness (uniform smoothness).
 */

import {
  SentenceAnalysis,
  SentenceFlag,
  Transformation,
  V3Config,
  DEFAULT_CONFIG
} from './types.js';

// ============================================================
// Types for Perplexity Calculation
// ============================================================

interface TokenProbability {
  token: string;
  logprob: number;
}

interface PerplexityResult {
  perplexity: number;
  tokens: TokenProbability[];
}

interface PerplexityProvider {
  calculatePerplexity(text: string): Promise<PerplexityResult>;
}

// ============================================================
// Sentence Segmentation
// ============================================================

/**
 * Split text into sentences, preserving structure.
 */
export function segmentSentences(text: string): string[] {
  // Handle common abbreviations to avoid false splits
  const protected_text = text
    .replace(/\bDr\./g, 'Dr\u0000')
    .replace(/\bMr\./g, 'Mr\u0000')
    .replace(/\bMrs\./g, 'Mrs\u0000')
    .replace(/\bMs\./g, 'Ms\u0000')
    .replace(/\bProf\./g, 'Prof\u0000')
    .replace(/\be\.g\./g, 'e\u0000g\u0000')
    .replace(/\bi\.e\./g, 'i\u0000e\u0000')
    .replace(/\betc\./g, 'etc\u0000');

  // Split on sentence boundaries
  const sentences = protected_text
    .split(/(?<=[.!?])\s+(?=[A-Z"'])/)
    .map(s => s.replace(/\u0000/g, '.').trim())
    .filter(s => s.length > 0);

  return sentences;
}

// ============================================================
// Perplexity Estimation (Heuristic)
// ============================================================

/**
 * Estimate perplexity using heuristics when LLM is not available.
 * This is a fast approximation based on:
 * - Word frequency (common words = lower perplexity)
 * - Sentence structure (simple = lower perplexity)
 * - Vocabulary diversity
 */
export function estimatePerplexityHeuristic(sentence: string): number {
  const words = sentence.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return 50; // Neutral default

  // Factor 1: Common word ratio
  // More common words = more predictable = lower perplexity
  const commonWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
    'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'under', 'again', 'further', 'then', 'once', 'here',
    'there', 'when', 'where', 'why', 'how', 'all', 'each', 'every',
    'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
    'and', 'but', 'if', 'or', 'because', 'until', 'while', 'although',
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'you', 'your',
    'he', 'him', 'his', 'she', 'her', 'hers', 'it', 'its', 'they', 'them',
    'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
    'am', 'it', 'its', 'itself', 'about', 'against', 'over', 'out'
  ]);

  const commonCount = words.filter(w => commonWords.has(w.replace(/[^a-z]/g, ''))).length;
  const commonRatio = commonCount / words.length;

  // Factor 2: Sentence complexity
  // Longer sentences with more clauses = higher perplexity
  const punctuationCount = (sentence.match(/[,;:—–-]/g) || []).length;
  const complexityBonus = Math.min(punctuationCount * 3, 15);

  // Factor 3: Word length variance
  // More varied word lengths = higher perplexity
  const wordLengths = words.map(w => w.length);
  const meanLength = wordLengths.reduce((a, b) => a + b, 0) / words.length;
  const lengthVariance = wordLengths.reduce((sum, len) => sum + Math.pow(len - meanLength, 2), 0) / words.length;
  const varianceBonus = Math.min(lengthVariance, 10);

  // Factor 4: Sentence length
  // Very short or very long = higher perplexity (deviation from mean)
  const idealLength = 15;
  const lengthDeviation = Math.abs(words.length - idealLength);
  const lengthBonus = Math.min(lengthDeviation * 0.5, 10);

  // Factor 5: Stock phrase penalty
  // Common AI phrases lower the perplexity estimate
  const stockPhrases = [
    'i still remember',
    'true resilience',
    'in that moment',
    'i realized that',
    'it was then that',
    'the weight of',
    'a testament to',
    'in the end',
    'looking back',
    'little did i know',
    'as i stood there',
    'the air was thick',
    'i couldn\'t help but'
  ];

  const lowerSentence = sentence.toLowerCase();
  const stockPenalty = stockPhrases.some(phrase => lowerSentence.includes(phrase)) ? -10 : 0;

  // Calculate base perplexity
  // Start at 30 (neutral), adjust based on factors
  let perplexity = 30;
  perplexity -= commonRatio * 20;      // More common words = lower
  perplexity += complexityBonus;        // More complex = higher
  perplexity += varianceBonus;          // More variance = higher
  perplexity += lengthBonus;            // Deviation from ideal = higher
  perplexity += stockPenalty;           // Stock phrases = lower

  // Clamp to reasonable range
  return Math.max(5, Math.min(100, perplexity));
}

// ============================================================
// LLM-Based Perplexity (When Available)
// ============================================================

/**
 * Calculate perplexity using an LLM with logprobs.
 * Requires an LLM provider that returns token probabilities.
 */
export async function calculatePerplexityWithLLM(
  sentence: string,
  provider: PerplexityProvider
): Promise<number> {
  try {
    const result = await provider.calculatePerplexity(sentence);
    return result.perplexity;
  } catch {
    // Fall back to heuristic
    return estimatePerplexityHeuristic(sentence);
  }
}

/**
 * Create a provider for Ollama (local LLM).
 */
export function createOllamaProvider(
  model: string = 'llama3.1:8b',
  baseUrl: string = 'http://localhost:11434'
): PerplexityProvider {
  return {
    async calculatePerplexity(text: string): Promise<PerplexityResult> {
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: text,
          raw: true,
          options: {
            num_predict: 1,
            temperature: 0
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status}`);
      }

      // Ollama doesn't directly return perplexity, but we can estimate
      // For now, fall back to heuristic
      return {
        perplexity: estimatePerplexityHeuristic(text),
        tokens: []
      };
    }
  };
}

// ============================================================
// Sentence Analysis
// ============================================================

/**
 * Analyze a single sentence for perplexity and generate flags.
 */
export function analyzeSentence(
  sentence: string,
  index: number,
  totalSentences: number,
  perplexity: number,
  neighborPerplexities: number[],
  config: V3Config = DEFAULT_CONFIG
): SentenceAnalysis {
  const position = index / Math.max(totalSentences - 1, 1);
  const wordCount = sentence.split(/\s+/).filter(w => w.length > 0).length;

  // Determine perplexity rank
  let perplexityRank: 'low' | 'medium' | 'high';
  if (perplexity < config.perplexity.lowThreshold) {
    perplexityRank = 'low';
  } else if (perplexity > config.perplexity.highThreshold) {
    perplexityRank = 'high';
  } else {
    perplexityRank = 'medium';
  }

  // Calculate burstiness (variance from neighbors)
  const burstiness = calculateBurstiness(perplexity, neighborPerplexities);

  // Generate flags
  const flags = generateFlags(sentence, perplexity, burstiness, position, config);

  // Generate transformations
  const transformations = generateTransformations(sentence, flags, perplexity);

  return {
    index,
    text: sentence,
    position,
    wordCount,
    perplexity,
    perplexityRank,
    burstiness,
    flags,
    transformations
  };
}

/**
 * Calculate burstiness - how different this sentence is from neighbors.
 */
function calculateBurstiness(perplexity: number, neighbors: number[]): number {
  if (neighbors.length === 0) return 0.5; // Neutral

  const meanNeighbor = neighbors.reduce((a, b) => a + b, 0) / neighbors.length;
  const diff = Math.abs(perplexity - meanNeighbor);

  // Normalize to 0-1 range (diff of 20+ = max burstiness)
  return Math.min(diff / 20, 1);
}

/**
 * Generate flags based on sentence analysis.
 */
function generateFlags(
  sentence: string,
  perplexity: number,
  burstiness: number,
  position: number,
  config: V3Config
): SentenceFlag[] {
  const flags: SentenceFlag[] = [];
  const lower = sentence.toLowerCase();

  // Perplexity flags
  if (perplexity < config.perplexity.lowThreshold) {
    flags.push('LOW_PERPLEXITY');
  }

  // Burstiness flag
  if (burstiness < config.burstiness.lowThreshold) {
    flags.push('LOW_BURSTINESS');
  }

  // Formulaic opener (first 20% of document)
  if (position < 0.2) {
    const formulaicOpeners = [
      /^i still remember/i,
      /^the air was/i,
      /^as i (stood|sat|walked)/i,
      /^it was a/i,
      /^the (morning|evening|night|day) (was|had)/i,
      /^looking back/i,
      /^little did (i|we) know/i
    ];

    if (formulaicOpeners.some(pattern => pattern.test(sentence))) {
      flags.push('FORMULAIC_OPENER');
    }
  }

  // Explicit moral (last 20% of document)
  if (position > 0.8) {
    const moralPatterns = [
      /true (resilience|strength|courage|wisdom) (comes|is)/i,
      /i (learned|realized|understood) that/i,
      /the (lesson|moral|truth) (is|was)/i,
      /in the end,? (i|we) (learned|realized)/i,
      /what (i|this) taught me/i
    ];

    if (moralPatterns.some(pattern => pattern.test(sentence))) {
      flags.push('EXPLICIT_MORAL');
    }
  }

  // Stock phrases
  const stockPhrases = [
    'a testament to',
    'the weight of',
    'in that moment',
    'couldn\'t help but',
    'washed over me',
    'sent a shiver',
    'heart sank',
    'took a deep breath',
    'mixed emotions'
  ];

  if (stockPhrases.some(phrase => lower.includes(phrase))) {
    flags.push('STOCK_PHRASE');
  }

  // Generic specificity
  const genericPatterns = [
    /\bthe city\b(?! of)/i,
    /\bthe highway\b/i,
    /\bthe office\b/i,
    /\bthe building\b/i,
    /\ba (man|woman|stranger)\b/i
  ];

  if (genericPatterns.some(pattern => pattern.test(sentence))) {
    flags.push('GENERIC_SPECIFICITY');
  }

  return flags;
}

/**
 * Generate transformation suggestions based on flags.
 */
function generateTransformations(
  sentence: string,
  flags: SentenceFlag[],
  perplexity: number
): Transformation[] {
  const transformations: Transformation[] = [];

  if (flags.includes('LOW_PERPLEXITY')) {
    transformations.push({
      type: 'VOCABULARY',
      target: sentence,
      location: 'sentence',
      suggestion: 'Replace common words with less predictable alternatives. Add an unexpected detail or clause interruption.',
      rationale: `Perplexity ${perplexity.toFixed(1)} is low - sentence is too predictable`,
      priority: 'high',
      automated: false
    });
  }

  if (flags.includes('LOW_BURSTINESS')) {
    transformations.push({
      type: 'BURSTINESS',
      target: sentence,
      location: 'sentence',
      suggestion: 'Vary this sentence\'s length or complexity relative to neighbors. Add a parenthetical or break it into shorter punches.',
      rationale: 'Sentence blends too smoothly with neighbors - lacks human variance',
      priority: 'medium',
      automated: false
    });
  }

  if (flags.includes('FORMULAIC_OPENER')) {
    transformations.push({
      type: 'STRUCTURE',
      target: sentence.split(' ').slice(0, 4).join(' '),
      location: 'phrase',
      suggestion: 'Start mid-action, with dialogue, or with a concrete sensory detail instead of a temporal/reflective frame.',
      rationale: 'Opening pattern is a strong AI signature',
      priority: 'high',
      automated: false
    });
  }

  if (flags.includes('EXPLICIT_MORAL')) {
    transformations.push({
      type: 'STRUCTURE',
      target: sentence,
      location: 'sentence',
      suggestion: 'Show the lesson through action or implication rather than stating it directly. Let the reader draw the conclusion.',
      rationale: 'Explicit moral statements are AI signatures - humans show, AIs tell',
      priority: 'high',
      automated: false
    });
  }

  if (flags.includes('STOCK_PHRASE')) {
    // Find which phrase triggered
    const stockPhrases = [
      'a testament to', 'the weight of', 'in that moment', 'couldn\'t help but',
      'washed over me', 'sent a shiver', 'heart sank', 'took a deep breath'
    ];
    const found = stockPhrases.find(p => sentence.toLowerCase().includes(p));

    if (found) {
      transformations.push({
        type: 'VOCABULARY',
        target: found,
        location: 'phrase',
        suggestion: `Replace "${found}" with a more specific, unexpected expression of the same feeling.`,
        rationale: 'Stock phrase appears frequently in AI output',
        priority: 'medium',
        automated: false
      });
    }
  }

  if (flags.includes('GENERIC_SPECIFICITY')) {
    transformations.push({
      type: 'SPECIFICITY_ADD',
      target: sentence,
      location: 'sentence',
      suggestion: 'Name the city, describe the building, give the stranger a distinguishing detail. But only if it will pay off later.',
      rationale: 'Generic references feel AI-generated. Specificity should be purposeful.',
      priority: 'medium',
      automated: false
    });
  }

  return transformations;
}

// ============================================================
// Full Document Analysis
// ============================================================

/**
 * Analyze all sentences in a document.
 */
export function analyzeDocument(
  text: string,
  config: V3Config = DEFAULT_CONFIG
): SentenceAnalysis[] {
  const sentences = segmentSentences(text);

  // Calculate perplexity for all sentences
  const perplexities = sentences.map(s => estimatePerplexityHeuristic(s));

  // Analyze each sentence with neighbor context
  return sentences.map((sentence, index) => {
    // Get neighbor perplexities for burstiness
    const start = Math.max(0, index - config.burstiness.windowSize);
    const end = Math.min(sentences.length, index + config.burstiness.windowSize + 1);
    const neighbors = perplexities
      .slice(start, end)
      .filter((_, i) => i !== index - start);

    return analyzeSentence(
      sentence,
      index,
      sentences.length,
      perplexities[index],
      neighbors,
      config
    );
  });
}

/**
 * Get aggregate perplexity stats for a document.
 */
export function getPerplexityStats(analyses: SentenceAnalysis[]): {
  mean: number;
  variance: number;
  min: number;
  max: number;
  lowCount: number;
  highCount: number;
} {
  const perplexities = analyses.map(a => a.perplexity);

  const mean = perplexities.reduce((a, b) => a + b, 0) / perplexities.length;
  const variance = perplexities.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / perplexities.length;

  return {
    mean,
    variance,
    min: Math.min(...perplexities),
    max: Math.max(...perplexities),
    lowCount: analyses.filter(a => a.perplexityRank === 'low').length,
    highCount: analyses.filter(a => a.perplexityRank === 'high').length
  };
}
