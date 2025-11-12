/**
 * Narrative Validation Utility
 *
 * Purpose: Validate text has narrative structure before accepting for processing
 * Rejects gibberish, saves user time and API costs
 *
 * Scoring system: 6 criteria, 0-100 points total
 * Threshold: 0.6 (60% score required to pass)
 */

export interface ValidationResult {
  valid: boolean;
  score: number; // 0.0 - 1.0
  reasons?: string[];
}

/**
 * Validate narrative text using 6-criteria scoring system
 *
 * Criteria:
 * 1. Length (20 points) - Minimum 50 words
 * 2. Sentence structure (20 points) - Minimum 3 sentences
 * 3. Punctuation coherence (15 points) - Proper sentence endings
 * 4. Word diversity (15 points) - Unique word ratio
 * 5. Not gibberish (15 points) - Average word length and character patterns
 * 6. Narrative markers (15 points) - Pronouns, verbs, temporal words
 *
 * @param text - The text to validate
 * @returns ValidationResult with valid flag, score, and reasons if invalid
 */
export function validateNarrative(text: string): ValidationResult {
  if (!text || typeof text !== 'string') {
    return {
      valid: false,
      score: 0,
      reasons: ['Text is required and must be a string']
    };
  }

  const trimmedText = text.trim();
  if (trimmedText.length === 0) {
    return {
      valid: false,
      score: 0,
      reasons: ['Text cannot be empty']
    };
  }

  let score = 0;
  const reasons: string[] = [];

  // Criterion 1: Length (20 points) - Minimum 50 words
  const words = trimmedText.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  if (wordCount >= 50) {
    score += 20;
  } else if (wordCount >= 30) {
    score += 15;
    reasons.push(`Text is short (${wordCount} words, recommended 50+)`);
  } else if (wordCount >= 20) {
    score += 10;
    reasons.push(`Text is very short (${wordCount} words, minimum 50 recommended)`);
  } else {
    reasons.push(`Text is too short (${wordCount} words, minimum 50 required)`);
  }

  // Criterion 2: Sentence structure (20 points) - Minimum 3 sentences
  const sentences = trimmedText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const sentenceCount = sentences.length;

  if (sentenceCount >= 3) {
    score += 20;
  } else if (sentenceCount === 2) {
    score += 10;
    reasons.push('Only 2 sentences detected (minimum 3 recommended)');
  } else {
    reasons.push('Only 1 sentence detected (minimum 3 required)');
  }

  // Criterion 3: Punctuation coherence (15 points)
  // Check for proper sentence endings
  const sentenceEndings = (trimmedText.match(/[.!?]/g) || []).length;
  const punctuationRatio = sentenceEndings / Math.max(1, sentenceCount);

  if (punctuationRatio >= 0.8) {
    score += 15;
  } else if (punctuationRatio >= 0.5) {
    score += 10;
    reasons.push('Some sentences lack proper punctuation');
  } else {
    score += 5;
    reasons.push('Many sentences lack proper punctuation');
  }

  // Criterion 4: Word diversity (15 points)
  // Unique word ratio (excluding common words)
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  const diversityRatio = uniqueWords.size / Math.max(1, wordCount);

  if (diversityRatio >= 0.5) {
    score += 15;
  } else if (diversityRatio >= 0.3) {
    score += 10;
    reasons.push('Low word diversity (repetitive vocabulary)');
  } else {
    score += 5;
    reasons.push('Very low word diversity (highly repetitive)');
  }

  // Criterion 5: Not gibberish (15 points)
  // Check average word length and character patterns
  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / Math.max(1, wordCount);
  const hasReasonableWords = words.filter(w => w.length >= 2 && w.length <= 20).length / Math.max(1, wordCount);

  if (avgWordLength >= 3 && avgWordLength <= 10 && hasReasonableWords >= 0.8) {
    score += 15;
  } else if (avgWordLength >= 2 && avgWordLength <= 15 && hasReasonableWords >= 0.6) {
    score += 10;
    reasons.push('Some words appear unusual (possible gibberish)');
  } else {
    score += 5;
    reasons.push('Text appears to contain gibberish or unusual patterns');
  }

  // Criterion 6: Narrative markers (15 points)
  // Check for pronouns, verbs, temporal words
  const narrativeMarkers = {
    pronouns: /\b(i|you|he|she|it|we|they|me|him|her|us|them|my|your|his|her|its|our|their)\b/gi,
    verbs: /\b(is|are|was|were|been|being|be|have|has|had|do|does|did|will|would|could|should|can|may|might)\b/gi,
    temporal: /\b(when|then|now|before|after|while|during|since|until|always|never|sometimes|often|soon|later|yesterday|today|tomorrow)\b/gi
  };

  const pronounMatches = (trimmedText.match(narrativeMarkers.pronouns) || []).length;
  const verbMatches = (trimmedText.match(narrativeMarkers.verbs) || []).length;
  const temporalMatches = (trimmedText.match(narrativeMarkers.temporal) || []).length;

  const narrativeScore = Math.min(15, (pronounMatches + verbMatches + temporalMatches) * 0.5);

  if (narrativeScore >= 10) {
    score += 15;
  } else if (narrativeScore >= 5) {
    score += 10;
    reasons.push('Limited narrative markers (few pronouns, verbs, or temporal words)');
  } else {
    score += 5;
    reasons.push('Very few narrative markers detected');
  }

  // Calculate final score (0.0 - 1.0)
  const finalScore = score / 100;
  const valid = finalScore >= 0.6;

  if (!valid && reasons.length === 0) {
    reasons.push('Text does not meet narrative structure criteria');
  }

  return {
    valid,
    score: finalScore,
    reasons: valid ? undefined : reasons
  };
}

/**
 * Get word count from text
 * @param text - The text to count words in
 * @returns Number of words
 */
export function getWordCount(text: string): number {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}
