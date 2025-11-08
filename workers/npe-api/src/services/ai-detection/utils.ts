// Statistical utility functions for AI text detection

/**
 * Calculate burstiness (sentence length variation)
 * Higher burstiness = more human-like (varied sentence lengths)
 * Lower burstiness = more AI-like (uniform sentence lengths)
 *
 * Returns: 0-100 score (0 = uniform/AI-like, 100 = highly varied/human-like)
 */
export function calculateBurstiness(text: string): number {
  // Split into sentences
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (sentences.length < 2) {
    return 50; // Neutral score for single sentence
  }

  // Calculate word counts per sentence
  const wordCounts = sentences.map(s => s.split(/\s+/).filter(w => w.length > 0).length);

  // Calculate coefficient of variation (CV = std_dev / mean)
  const mean = wordCounts.reduce((sum, count) => sum + count, 0) / wordCounts.length;

  if (mean === 0) {
    return 50; // Neutral score
  }

  const variance = wordCounts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / wordCounts.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = stdDev / mean;

  // Convert CV to 0-100 scale
  // Typical human CV: 0.4-0.8 (high variation)
  // Typical AI CV: 0.1-0.3 (low variation)
  // Map: CV < 0.3 = 0-30 (AI-like), CV > 0.6 = 70-100 (human-like)
  let score: number;
  if (coefficientOfVariation < 0.3) {
    // AI-like: uniform sentence lengths
    score = (coefficientOfVariation / 0.3) * 30;
  } else if (coefficientOfVariation > 0.6) {
    // Human-like: varied sentence lengths
    score = 70 + Math.min(30, (coefficientOfVariation - 0.6) * 75);
  } else {
    // Middle range
    score = 30 + ((coefficientOfVariation - 0.3) / 0.3) * 40;
  }

  return Math.round(score);
}

/**
 * Calculate Flesch Reading Ease score
 * Higher = easier to read
 * AI tends toward mid-range readability (avoiding extremes)
 *
 * Formula: 206.835 - 1.015(words/sentences) - 84.6(syllables/words)
 * Returns: 0-100 (0 = very difficult, 100 = very easy)
 */
export function calculateFleschReadingEase(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);

  if (sentences.length === 0 || words.length === 0) {
    return 50; // Neutral score
  }

  const syllableCount = words.reduce((sum, word) => sum + countSyllables(word), 0);

  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = syllableCount / words.length;

  const score = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;

  // Clamp to 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Calculate Gunning Fog Index (readability)
 * Estimates years of education needed to understand text
 *
 * Formula: 0.4 * [(words/sentences) + 100 * (complex words / words)]
 * Complex words = 3+ syllables
 *
 * Returns: approximate grade level (6-17+)
 */
export function calculateGunningFog(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);

  if (sentences.length === 0 || words.length === 0) {
    return 12; // Neutral score (college level)
  }

  const complexWords = words.filter(word => countSyllables(word) >= 3).length;
  const avgWordsPerSentence = words.length / sentences.length;
  const percentComplexWords = (complexWords / words.length) * 100;

  const score = 0.4 * (avgWordsPerSentence + percentComplexWords);

  return Math.round(score * 10) / 10; // Round to 1 decimal
}

/**
 * Count syllables in a word (approximation)
 * Simplified algorithm - not 100% accurate but good enough for readability metrics
 */
function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');

  if (word.length <= 3) {
    return 1;
  }

  // Count vowel groups
  const vowels = word.match(/[aeiouy]+/g);
  let count = vowels ? vowels.length : 1;

  // Subtract silent 'e' at end
  if (word.endsWith('e') && count > 1) {
    count--;
  }

  // Handle special cases
  if (word.endsWith('le') && word.length > 2 && !/[aeiouy]/.test(word[word.length - 3])) {
    count++;
  }

  return Math.max(1, count);
}

/**
 * Calculate lexical diversity (type-token ratio)
 * Unique words / total words
 * Higher = more diverse vocabulary (human-like)
 * Lower = repetitive vocabulary (potentially AI-like)
 *
 * Returns: 0-100 score
 */
export function calculateLexicalDiversity(text: string): number {
  const words = text.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 0)
    .map(w => w.replace(/[^a-z]/g, '')); // Remove punctuation

  if (words.length === 0) {
    return 50; // Neutral
  }

  const uniqueWords = new Set(words);
  const ratio = uniqueWords.size / words.length;

  // Convert to 0-100 scale
  // Typical human: 0.6-0.8 (high diversity)
  // Typical AI: 0.4-0.6 (moderate diversity)
  return Math.round(ratio * 100);
}

/**
 * Analyze readability pattern for AI detection
 * AI tends toward mid-range readability (50-70 Flesch, 10-14 Fog)
 * Returns: 0-100 score (higher = more likely AI pattern)
 */
export function analyzeReadabilityPattern(text: string): number {
  const flesch = calculateFleschReadingEase(text);
  const fog = calculateGunningFog(text);

  // AI pattern: Flesch 50-70, Fog 10-14
  const fleschInAIRange = flesch >= 50 && flesch <= 70;
  const fogInAIRange = fog >= 10 && fog <= 14;

  if (fleschInAIRange && fogInAIRange) {
    return 70; // Strong AI pattern
  } else if (fleschInAIRange || fogInAIRange) {
    return 50; // Moderate AI pattern
  } else {
    return 30; // Not typical AI pattern
  }
}
