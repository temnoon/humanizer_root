/**
 * Voice Analyzer
 *
 * Analyzes writing samples to extract voice fingerprints and propose traits.
 * Used in the persona harvest flow to quantitatively characterize writing style.
 *
 * @module @humanizer/core/aui/voice-analyzer
 */

import type { VoiceFingerprint, StyleGuide } from '../storage/aui-postgres-store.js';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Proposed traits from voice analysis
 */
export interface ProposedTraits {
  /** Descriptive voice traits (e.g., "warm", "analytical") */
  voiceTraits: string[];
  /** Tone markers (e.g., "empathetic", "curious") */
  toneMarkers: string[];
  /** Suggested formality range */
  formalityRange: [number, number];
  /** Confidence in the analysis (0-1) */
  confidence: number;
}

/**
 * Style suggestion derived from analysis
 */
export interface SuggestedStyle {
  name: string;
  description: string;
  formalityLevel: number;
  useContractions: boolean;
  useRhetoricalQuestions: boolean;
  sentenceVariety: 'low' | 'medium' | 'high';
  paragraphStyle: 'short' | 'medium' | 'long';
}

/**
 * Complete analysis result
 */
export interface VoiceAnalysisResult {
  fingerprint: VoiceFingerprint;
  proposedTraits: ProposedTraits;
  suggestedStyles: SuggestedStyle[];
  sampleCount: number;
  totalWords: number;
}

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

/** Common contractions to detect */
const CONTRACTIONS = [
  "n't", "'re", "'ve", "'ll", "'d", "'m", "'s",
  "won't", "can't", "don't", "doesn't", "isn't", "aren't",
  "wasn't", "weren't", "haven't", "hasn't", "hadn't",
  "wouldn't", "couldn't", "shouldn't", "might've", "would've",
  "could've", "should've", "let's", "that's", "there's",
  "here's", "what's", "who's", "it's", "he's", "she's",
];

/** First person pronouns */
const FIRST_PERSON = ['i', 'me', 'my', 'mine', 'myself', 'we', 'us', 'our', 'ours', 'ourselves'];

/** Common n-gram stop patterns to exclude */
const NGRAM_STOP_PATTERNS = [
  /^(the|a|an|and|or|but|in|on|at|to|for|of|with|by)\s/i,
  /\s(the|a|an|and|or|but|in|on|at|to|for|of|with|by)$/i,
];

// ═══════════════════════════════════════════════════════════════════
// VOICE ANALYZER
// ═══════════════════════════════════════════════════════════════════

/**
 * Analyzes writing samples to extract voice fingerprints
 */
export class VoiceAnalyzer {
  /**
   * Extract a quantitative voice fingerprint from writing samples
   */
  extractFingerprint(samples: string[]): VoiceFingerprint {
    if (samples.length === 0) {
      return this.emptyFingerprint();
    }

    const allText = samples.join('\n\n');
    const sentences = this.splitSentences(allText);
    const words = this.tokenize(allText);

    if (words.length === 0) {
      return this.emptyFingerprint();
    }

    return {
      avgSentenceLength: this.calcAvgSentenceLength(sentences),
      sentenceLengthVariance: this.calcSentenceLengthVariance(sentences),
      contractionFrequency: this.calcContractionFrequency(allText, words.length),
      questionFrequency: this.calcQuestionFrequency(sentences),
      firstPersonFrequency: this.calcFirstPersonFrequency(words),
      commonPhrases: this.extractCommonPhrases(allText, { minFreq: 2, maxPhrases: 20 }),
      vocabularyRichness: this.calcVocabularyRichness(words),
    };
  }

  /**
   * Propose human-readable traits from a fingerprint
   */
  proposeTraits(fingerprint: VoiceFingerprint): ProposedTraits {
    const voiceTraits: string[] = [];
    const toneMarkers: string[] = [];
    let formalityScore = 0.5;
    let confidence = 0.5;

    // Sentence length analysis
    if (fingerprint.avgSentenceLength > 25) {
      voiceTraits.push('elaborate');
      formalityScore += 0.1;
    } else if (fingerprint.avgSentenceLength < 12) {
      voiceTraits.push('punchy');
      formalityScore -= 0.1;
    } else {
      voiceTraits.push('balanced');
    }

    // Sentence variety
    if (fingerprint.sentenceLengthVariance > 100) {
      voiceTraits.push('varied');
      confidence += 0.1;
    } else if (fingerprint.sentenceLengthVariance < 30) {
      voiceTraits.push('consistent');
    }

    // Contraction usage
    if (fingerprint.contractionFrequency > 0.03) {
      voiceTraits.push('conversational');
      formalityScore -= 0.15;
    } else if (fingerprint.contractionFrequency < 0.005) {
      voiceTraits.push('formal');
      formalityScore += 0.15;
    }

    // Question frequency
    if (fingerprint.questionFrequency > 0.15) {
      toneMarkers.push('inquisitive');
      voiceTraits.push('engaging');
    } else if (fingerprint.questionFrequency > 0.08) {
      toneMarkers.push('curious');
    }

    // First person usage
    if (fingerprint.firstPersonFrequency > 0.05) {
      voiceTraits.push('personal');
      toneMarkers.push('reflective');
    } else if (fingerprint.firstPersonFrequency < 0.01) {
      voiceTraits.push('detached');
      toneMarkers.push('objective');
    }

    // Vocabulary richness
    if (fingerprint.vocabularyRichness > 0.7) {
      voiceTraits.push('articulate');
      toneMarkers.push('thoughtful');
      confidence += 0.1;
    } else if (fingerprint.vocabularyRichness < 0.3) {
      voiceTraits.push('accessible');
    }

    // Derive additional traits from common phrases
    if (fingerprint.commonPhrases.length > 10) {
      confidence += 0.1;
    }

    // Clamp formality score
    formalityScore = Math.max(0, Math.min(1, formalityScore));

    // Derive formality range
    const formalityRange: [number, number] = [
      Math.max(0, formalityScore - 0.15),
      Math.min(1, formalityScore + 0.15),
    ];

    return {
      voiceTraits: [...new Set(voiceTraits)],
      toneMarkers: [...new Set(toneMarkers)],
      formalityRange,
      confidence: Math.min(1, confidence),
    };
  }

  /**
   * Suggest specific writing styles based on fingerprint analysis
   */
  suggestStyles(fingerprint: VoiceFingerprint, traits: ProposedTraits): SuggestedStyle[] {
    const styles: SuggestedStyle[] = [];
    const formalityMid = (traits.formalityRange[0] + traits.formalityRange[1]) / 2;

    // Primary style based on detected traits
    const primaryStyle: SuggestedStyle = {
      name: 'Primary Voice',
      description: 'Your natural writing style',
      formalityLevel: formalityMid,
      useContractions: fingerprint.contractionFrequency > 0.01,
      useRhetoricalQuestions: fingerprint.questionFrequency > 0.1,
      sentenceVariety: fingerprint.sentenceLengthVariance > 80 ? 'high' :
                       fingerprint.sentenceLengthVariance < 40 ? 'low' : 'medium',
      paragraphStyle: fingerprint.avgSentenceLength > 20 ? 'long' :
                      fingerprint.avgSentenceLength < 12 ? 'short' : 'medium',
    };
    styles.push(primaryStyle);

    // Suggest a more formal variant
    if (formalityMid < 0.7) {
      styles.push({
        name: 'Formal',
        description: 'For professional or academic contexts',
        formalityLevel: Math.min(1, formalityMid + 0.3),
        useContractions: false,
        useRhetoricalQuestions: false,
        sentenceVariety: 'medium',
        paragraphStyle: 'medium',
      });
    }

    // Suggest a more casual variant
    if (formalityMid > 0.3) {
      styles.push({
        name: 'Casual',
        description: 'For informal or personal writing',
        formalityLevel: Math.max(0, formalityMid - 0.3),
        useContractions: true,
        useRhetoricalQuestions: fingerprint.questionFrequency > 0.05,
        sentenceVariety: 'high',
        paragraphStyle: 'short',
      });
    }

    return styles;
  }

  /**
   * Perform complete voice analysis on samples
   */
  analyze(samples: string[]): VoiceAnalysisResult {
    const fingerprint = this.extractFingerprint(samples);
    const proposedTraits = this.proposeTraits(fingerprint);
    const suggestedStyles = this.suggestStyles(fingerprint, proposedTraits);

    const allText = samples.join(' ');
    const words = this.tokenize(allText);

    return {
      fingerprint,
      proposedTraits,
      suggestedStyles,
      sampleCount: samples.length,
      totalWords: words.length,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────

  private emptyFingerprint(): VoiceFingerprint {
    return {
      avgSentenceLength: 0,
      sentenceLengthVariance: 0,
      contractionFrequency: 0,
      questionFrequency: 0,
      firstPersonFrequency: 0,
      commonPhrases: [],
      vocabularyRichness: 0,
    };
  }

  /**
   * Split text into sentences
   */
  private splitSentences(text: string): string[] {
    // Split on sentence-ending punctuation followed by space or end
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    return sentences;
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s'-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0);
  }

  /**
   * Calculate average sentence length in words
   */
  private calcAvgSentenceLength(sentences: string[]): number {
    if (sentences.length === 0) return 0;

    const lengths = sentences.map(s => this.tokenize(s).length);
    return lengths.reduce((a, b) => a + b, 0) / lengths.length;
  }

  /**
   * Calculate variance in sentence length
   */
  private calcSentenceLengthVariance(sentences: string[]): number {
    if (sentences.length < 2) return 0;

    const lengths = sentences.map(s => this.tokenize(s).length);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const squaredDiffs = lengths.map(l => Math.pow(l - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / lengths.length;
  }

  /**
   * Calculate contraction frequency
   */
  private calcContractionFrequency(text: string, totalWords: number): number {
    if (totalWords === 0) return 0;

    let count = 0;
    const textLower = text.toLowerCase();

    for (const contraction of CONTRACTIONS) {
      const regex = new RegExp(contraction.replace(/'/g, "'?"), 'gi');
      const matches = textLower.match(regex);
      if (matches) {
        count += matches.length;
      }
    }

    return count / totalWords;
  }

  /**
   * Calculate question frequency
   */
  private calcQuestionFrequency(sentences: string[]): number {
    if (sentences.length === 0) return 0;

    const questions = sentences.filter(s => s.trim().endsWith('?'));
    return questions.length / sentences.length;
  }

  /**
   * Calculate first person pronoun frequency
   */
  private calcFirstPersonFrequency(words: string[]): number {
    if (words.length === 0) return 0;

    const firstPersonCount = words.filter(w => FIRST_PERSON.includes(w)).length;
    return firstPersonCount / words.length;
  }

  /**
   * Extract common phrases (n-grams)
   */
  private extractCommonPhrases(
    text: string,
    options: { minFreq?: number; maxPhrases?: number } = {}
  ): Array<{ phrase: string; frequency: number }> {
    const { minFreq = 2, maxPhrases = 20 } = options;

    // Generate 2-grams and 3-grams
    const words = this.tokenize(text);
    const ngramCounts = new Map<string, number>();

    // 2-grams
    for (let i = 0; i < words.length - 1; i++) {
      const ngram = `${words[i]} ${words[i + 1]}`;
      if (!this.isStopNgram(ngram)) {
        ngramCounts.set(ngram, (ngramCounts.get(ngram) || 0) + 1);
      }
    }

    // 3-grams
    for (let i = 0; i < words.length - 2; i++) {
      const ngram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      if (!this.isStopNgram(ngram)) {
        ngramCounts.set(ngram, (ngramCounts.get(ngram) || 0) + 1);
      }
    }

    // Filter and sort
    const phrases = Array.from(ngramCounts.entries())
      .filter(([_, count]) => count >= minFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxPhrases)
      .map(([phrase, count]) => ({
        phrase,
        frequency: count / words.length,
      }));

    return phrases;
  }

  /**
   * Check if n-gram is a stop pattern (common function words)
   */
  private isStopNgram(ngram: string): boolean {
    for (const pattern of NGRAM_STOP_PATTERNS) {
      if (pattern.test(ngram)) return true;
    }
    return false;
  }

  /**
   * Calculate vocabulary richness (type-token ratio with adjustment)
   */
  private calcVocabularyRichness(words: string[]): number {
    if (words.length === 0) return 0;

    // Use Yule's K measure for vocabulary richness
    // (more reliable than simple TTR for varying text lengths)
    const uniqueWords = new Set(words);
    const ttr = uniqueWords.size / words.length;

    // Adjust for text length (longer texts naturally have lower TTR)
    // Use logarithmic scaling
    const lengthFactor = Math.log10(words.length + 1) / 4;
    const adjusted = ttr + (ttr * lengthFactor);

    return Math.min(1, adjusted);
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

let _voiceAnalyzer: VoiceAnalyzer | null = null;

/**
 * Get the voice analyzer singleton
 */
export function getVoiceAnalyzer(): VoiceAnalyzer {
  if (!_voiceAnalyzer) {
    _voiceAnalyzer = new VoiceAnalyzer();
  }
  return _voiceAnalyzer;
}
