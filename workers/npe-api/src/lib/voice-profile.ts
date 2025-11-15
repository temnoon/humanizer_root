// Voice Profile - Extract and apply user's personal writing style
// Allows users to upload writing samples to match their unique voice

/**
 * Voice Profile - Statistical fingerprint of a user's writing style
 */
export interface VoiceProfile {
  // Structural patterns
  avgSentenceLength: number;          // Average words per sentence
  sentenceLengthStdDev: number;       // Variation in sentence length
  avgParagraphLength: number;         // Average sentences per paragraph

  // Stylistic markers
  formalityScore: number;             // 0-100 (0=casual, 100=formal)
  contractionRate: number;            // Percentage of possible contractions used
  questionRate: number;               // Percentage of sentences that are questions
  exclamationRate: number;            // Percentage of sentences with exclamation marks

  // Vocabulary patterns
  lexicalDiversity: number;           // Type-token ratio (0-100)
  avgWordLength: number;              // Average characters per word
  complexWordRate: number;            // Percentage of words with 3+ syllables

  // Transitional patterns
  commonTransitions: string[];        // User's preferred transition words
  sentenceStarters: string[];         // User's preferred sentence starters

  // Punctuation habits
  commaFrequency: number;             // Commas per 100 words
  semicolonFrequency: number;         // Semicolons per 100 words
  dashFrequency: number;              // Em/en dashes per 100 words

  // Distinctive phrases (top 10)
  signaturePhrases: string[];

  // Metadata
  sampleCount: number;
  totalWordCount: number;
  analysisDate: string;
}

/**
 * Extract voice profile from user's writing samples
 * @param samples - Array of user's writing samples (preferably 500+ words total)
 * @returns VoiceProfile statistical fingerprint
 */
export function extractVoiceProfile(samples: string[]): VoiceProfile {
  // Combine all samples
  const combinedText = samples.join('\n\n');
  const totalWordCount = combinedText.split(/\s+/).filter(w => w.length > 0).length;

  if (totalWordCount < 100) {
    throw new Error('Need at least 100 words to create a voice profile');
  }

  // Split into sentences and paragraphs
  const sentences = combinedText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const paragraphs = combinedText.split(/\n\n+/).filter(p => p.trim().length > 0);

  // Calculate structural patterns
  const sentenceLengths = sentences.map(s => s.split(/\s+/).filter(w => w.length > 0).length);
  const avgSentenceLength = sentenceLengths.reduce((sum, len) => sum + len, 0) / sentenceLengths.length;
  const sentenceLengthStdDev = calculateStdDev(sentenceLengths);

  const paragraphSentenceCounts = paragraphs.map(p =>
    p.split(/[.!?]+/).filter(s => s.trim().length > 0).length
  );
  const avgParagraphLength = paragraphSentenceCounts.reduce((sum, len) => sum + len, 0) / paragraphSentenceCounts.length;

  // Calculate stylistic markers
  const formalityScore = calculateFormality(combinedText);
  const contractionRate = calculateContractionRate(combinedText);
  const questionRate = (sentences.filter(s => s.includes('?')).length / sentences.length) * 100;
  const exclamationRate = (sentences.filter(s => s.includes('!')).length / sentences.length) * 100;

  // Calculate vocabulary patterns
  const words = combinedText.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const uniqueWords = new Set(words);
  const lexicalDiversity = (uniqueWords.size / words.length) * 100;
  const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
  const complexWords = words.filter(w => countSyllables(w) >= 3).length;
  const complexWordRate = (complexWords / words.length) * 100;

  // Extract transitional patterns
  const commonTransitions = extractCommonTransitions(combinedText);
  const sentenceStarters = extractSentenceStarters(sentences);

  // Calculate punctuation habits
  const commaFrequency = (combinedText.split(',').length - 1) / totalWordCount * 100;
  const semicolonFrequency = (combinedText.split(';').length - 1) / totalWordCount * 100;
  const dashFrequency = (combinedText.split(/—|–/).length - 1) / totalWordCount * 100;

  // Extract signature phrases
  const signaturePhrases = extractSignaturePhrases(combinedText);

  return {
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    sentenceLengthStdDev: Math.round(sentenceLengthStdDev * 10) / 10,
    avgParagraphLength: Math.round(avgParagraphLength * 10) / 10,
    formalityScore: Math.round(formalityScore),
    contractionRate: Math.round(contractionRate * 10) / 10,
    questionRate: Math.round(questionRate * 10) / 10,
    exclamationRate: Math.round(exclamationRate * 10) / 10,
    lexicalDiversity: Math.round(lexicalDiversity),
    avgWordLength: Math.round(avgWordLength * 10) / 10,
    complexWordRate: Math.round(complexWordRate * 10) / 10,
    commonTransitions,
    sentenceStarters,
    commaFrequency: Math.round(commaFrequency * 10) / 10,
    semicolonFrequency: Math.round(semicolonFrequency * 10) / 10,
    dashFrequency: Math.round(dashFrequency * 10) / 10,
    signaturePhrases,
    sampleCount: samples.length,
    totalWordCount,
    analysisDate: new Date().toISOString()
  };
}

/**
 * Apply voice profile to transformed text
 * Adjusts text to match user's statistical fingerprint
 */
export function applyVoiceProfile(text: string, profile: VoiceProfile): string {
  let result = text;

  // Adjust sentence length to match user's pattern
  result = adjustSentenceLength(result, profile.avgSentenceLength, profile.sentenceLengthStdDev);

  // Adjust formality
  result = adjustFormality(result, profile.formalityScore);

  // Adjust contraction rate
  result = adjustContractionRate(result, profile.contractionRate);

  // Adjust question rate
  result = adjustQuestionRate(result, profile.questionRate);

  // Use user's preferred transitions
  result = applyPreferredTransitions(result, profile.commonTransitions);

  // Adjust punctuation habits
  result = adjustPunctuationHabits(result, profile);

  return result;
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[]): number {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Calculate formality score (0-100)
 * Based on: contractions, informal words, sentence complexity
 */
function calculateFormality(text: string): number {
  const contractions = text.match(/\b\w+'\w+\b/g) || [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);

  // Informal markers
  const informalWords = [
    'gonna', 'wanna', 'gotta', 'kinda', 'sorta',
    'yeah', 'yep', 'nope', 'ok', 'okay',
    'stuff', 'things', 'guys', 'folks'
  ];
  const informalCount = informalWords.reduce((count, word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    return count + (text.match(regex) || []).length;
  }, 0);

  // Calculate scores
  const contractionPenalty = (contractions.length / words.length) * 40; // Max -40
  const informalPenalty = (informalCount / words.length) * 30; // Max -30
  const complexityBonus = Math.min(30, (words.length / sentences.length) * 2); // Max +30

  const score = 50 - contractionPenalty - informalPenalty + complexityBonus;
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate contraction rate
 */
function calculateContractionRate(text: string): number {
  const contractions = text.match(/\b\w+'\w+\b/g) || [];

  // Count potential contractions (phrases that COULD be contracted)
  const potentialContractions = [
    'cannot', 'will not', 'do not', 'does not', 'did not',
    'is not', 'are not', 'was not', 'were not',
    'have not', 'has not', 'had not',
    'would not', 'could not', 'should not',
    'it is', 'that is', 'what is', 'there is'
  ];

  const potentialCount = potentialContractions.reduce((count, phrase) => {
    const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
    return count + (text.match(regex) || []).length;
  }, 0);

  const totalPossible = contractions.length + potentialCount;

  if (totalPossible === 0) return 0;

  return (contractions.length / totalPossible) * 100;
}

/**
 * Extract common transition words used by user
 */
function extractCommonTransitions(text: string): string[] {
  const transitions = [
    'however', 'therefore', 'moreover', 'furthermore', 'nonetheless',
    'additionally', 'consequently', 'meanwhile', 'thus', 'hence',
    'also', 'but', 'and', 'or', 'yet', 'so',
    'first', 'second', 'finally', 'next', 'then',
    'for example', 'for instance', 'in fact', 'indeed'
  ];

  const counts = new Map<string, number>();

  for (const transition of transitions) {
    const regex = new RegExp(`\\b${transition}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      counts.set(transition, matches.length);
    }
  }

  // Return top 5 most used
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

/**
 * Extract common sentence starters
 */
function extractSentenceStarters(sentences: string[]): string[] {
  const starterCounts = new Map<string, number>();

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.length === 0) continue;

    // Get first 1-3 words
    const words = trimmed.split(/\s+/).slice(0, 3).join(' ').toLowerCase();
    const firstWord = trimmed.split(/\s+/)[0].toLowerCase();

    // Count 1-word starters
    starterCounts.set(firstWord, (starterCounts.get(firstWord) || 0) + 1);

    // Count 2-3 word starters if they seem like phrases
    if (words.split(/\s+/).length >= 2) {
      const twoWords = words.split(/\s+/).slice(0, 2).join(' ');
      if (twoWords.length < 20) {
        starterCounts.set(twoWords, (starterCounts.get(twoWords) || 0) + 1);
      }
    }
  }

  // Return top 5, excluding very common words
  const commonWords = ['the', 'a', 'an', 'i', 'it', 'this', 'that'];
  return Array.from(starterCounts.entries())
    .filter(([word]) => !commonWords.includes(word) && starterCounts.get(word)! >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

/**
 * Extract signature phrases (2-4 word sequences user frequently uses)
 */
function extractSignaturePhrases(text: string): string[] {
  const words = text.toLowerCase().split(/\s+/);
  const phraseCounts = new Map<string, number>();

  // Look for 2-4 word sequences
  for (let len = 2; len <= 4; len++) {
    for (let i = 0; i <= words.length - len; i++) {
      const phrase = words.slice(i, i + len).join(' ');

      // Skip if contains only common words
      const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with'];
      const phraseWords = phrase.split(' ');
      if (phraseWords.every(w => commonWords.includes(w))) {
        continue;
      }

      phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
    }
  }

  // Return top 10 phrases used 3+ times
  return Array.from(phraseCounts.entries())
    .filter(([_, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([phrase]) => phrase);
}

/**
 * Count syllables in a word (approximation)
 */
function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;

  const vowels = word.match(/[aeiouy]+/g);
  let count = vowels ? vowels.length : 1;

  if (word.endsWith('e') && count > 1) count--;
  if (word.endsWith('le') && word.length > 2 && !/[aeiouy]/.test(word[word.length - 3])) {
    count++;
  }

  return Math.max(1, count);
}

/**
 * Adjust sentence length to match target average and variation
 */
function adjustSentenceLength(text: string, targetAvg: number, targetStdDev: number): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];

  // Calculate current stats
  const lengths = sentences.map(s => s.split(/\s+/).filter(w => w.length > 0).length);
  const currentAvg = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;

  // If current average is too high, split some sentences
  if (currentAvg > targetAvg + 3) {
    const transformed: string[] = [];
    for (const sentence of sentences) {
      const wordCount = sentence.split(/\s+/).filter(w => w.length > 0).length;
      if (wordCount > targetAvg * 1.5) {
        // Split long sentences
        const words = sentence.split(/\s+/);
        const midpoint = Math.floor(words.length / 2);
        const part1 = words.slice(0, midpoint).join(' ').trim() + '.';
        const part2 = words.slice(midpoint).join(' ').trim();
        transformed.push(part1, part2.charAt(0).toUpperCase() + part2.slice(1));
      } else {
        transformed.push(sentence);
      }
    }
    return transformed.join(' ');
  }

  // If current average is too low, combine some sentences (rare)
  // For now, just return as-is since this is uncommon for AI text
  return text;
}

/**
 * Adjust formality to match user's score
 */
function adjustFormality(text: string, targetFormality: number): string {
  // If target is low (casual), add more contractions and informal markers
  if (targetFormality < 50) {
    // Already handled in addConversationalElements()
    return text;
  }

  // If target is high (formal), remove contractions
  if (targetFormality > 70) {
    const contractions: Record<string, string> = {
      "can't": 'cannot',
      "won't": 'will not',
      "don't": 'do not',
      "doesn't": 'does not',
      "didn't": 'did not',
      "isn't": 'is not',
      "aren't": 'are not',
      "wasn't": 'was not',
      "weren't": 'were not',
      "haven't": 'have not',
      "hasn't": 'has not',
      "hadn't": 'had not',
      "wouldn't": 'would not',
      "couldn't": 'could not',
      "shouldn't": 'should not',
      "it's": 'it is',
      "that's": 'that is',
      "what's": 'what is',
      "there's": 'there is',
      "they're": 'they are',
      "we're": 'we are',
      "you're": 'you are'
    };

    let result = text;
    for (const [informal, formal] of Object.entries(contractions)) {
      const regex = new RegExp(`\\b${informal}\\b`, 'gi');
      result = result.replace(regex, formal);
    }
    return result;
  }

  return text;
}

/**
 * Adjust contraction rate to match user's preference
 */
function adjustContractionRate(text: string, targetRate: number): string {
  // Count current contractions
  const currentContractions = text.match(/\b\w+'\w+\b/g) || [];
  const currentRate = (currentContractions.length / text.split(/\s+/).length) * 100;

  // If current rate is close to target, return as-is
  if (Math.abs(currentRate - targetRate) < 5) {
    return text;
  }

  // If we need more contractions, apply them
  if (currentRate < targetRate) {
    // Already handled in addConversationalElements()
    return text;
  }

  // If we need fewer contractions, expand some
  // This is handled in adjustFormality()
  return text;
}

/**
 * Adjust question rate to match user's preference
 */
function adjustQuestionRate(text: string, targetRate: number): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  const currentQuestions = sentences.filter(s => s.includes('?')).length;
  const currentRate = (currentQuestions / sentences.length) * 100;

  // If rates are similar, return as-is
  if (Math.abs(currentRate - targetRate) < 5) {
    return text;
  }

  // For now, don't force questions if user doesn't use them
  // This is better handled in context-specific transformations
  return text;
}

/**
 * Apply user's preferred transition words
 */
function applyPreferredTransitions(text: string, preferredTransitions: string[]): string {
  if (preferredTransitions.length === 0) return text;

  // This is a complex transformation that would require
  // understanding context to replace transitions appropriately
  // For MVP, skip this - can add in future iteration
  return text;
}

/**
 * Adjust punctuation habits to match user's profile
 */
function adjustPunctuationHabits(text: string, profile: VoiceProfile): string {
  // For MVP, keep punctuation adjustments minimal
  // This could be enhanced in future iterations
  return text;
}
