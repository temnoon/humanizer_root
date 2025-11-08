// Local AI Detection Service (Statistical Analysis)
// No external API calls - privacy-friendly, instant results

import { calculateTellWordScore } from './tell-words';
import {
  calculateBurstiness,
  calculateFleschReadingEase,
  calculateGunningFog,
  calculateLexicalDiversity,
  analyzeReadabilityPattern
} from './utils';

export interface LocalDetectionResult {
  verdict: 'human' | 'ai' | 'uncertain';
  confidence: number; // 0-100 (0 = definitely human, 100 = definitely AI)
  signals: {
    burstiness: number; // 0-100 (0 = uniform/AI, 100 = varied/human)
    tellWordScore: number; // 0-100 (0 = no tells, 100 = many tells)
    readabilityPattern: number; // 0-100 (0 = atypical, 100 = typical AI)
    lexicalDiversity: number; // 0-100 (type-token ratio)
  };
  metrics: {
    fleschReadingEase: number;
    gunningFog: number;
    wordCount: number;
    sentenceCount: number;
    avgSentenceLength: number;
  };
  detectedTellWords: Array<{ word: string; category: string; count: number }>;
  processingTimeMs: number;
  method: 'local';
}

/**
 * Perform local AI detection using statistical analysis
 * Fast (<100ms), privacy-friendly (no external calls), moderate accuracy (~70%)
 *
 * @param text - Text to analyze
 * @returns Detection result with confidence score and signals
 */
export async function detectAILocal(text: string): Promise<LocalDetectionResult> {
  const startTime = Date.now();

  // Basic validation
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  const trimmedText = text.trim();
  const words = trimmedText.split(/\s+/).filter(w => w.length > 0);
  const sentences = trimmedText.split(/[.!?]+/).filter(s => s.trim().length > 0);

  if (words.length < 20) {
    throw new Error('Text must be at least 20 words for accurate detection');
  }

  // Calculate all signals
  const burstiness = calculateBurstiness(trimmedText);
  const tellWordAnalysis = calculateTellWordScore(trimmedText);
  const readabilityPattern = analyzeReadabilityPattern(trimmedText);
  const lexicalDiversity = calculateLexicalDiversity(trimmedText);

  // Additional metrics for display
  const fleschReadingEase = calculateFleschReadingEase(trimmedText);
  const gunningFog = calculateGunningFog(trimmedText);
  const avgSentenceLength = words.length / sentences.length;

  // Calculate weighted confidence score
  // Lower burstiness = more AI-like
  // Higher tell-word score = more AI-like
  // Readability pattern in AI range = more AI-like
  // Lower lexical diversity = more AI-like

  const burstin essAIScore = 100 - burstiness; // Invert: low burstiness = high AI score
  const tellWordAIScore = tellWordAnalysis.score;
  const readabilityAIScore = readabilityPattern;
  const diversityAIScore = 100 - lexicalDiversity; // Invert: low diversity = high AI score

  // Weighted combination (weights based on research accuracy)
  const confidence = Math.round(
    burstin essAIScore * 0.35 +       // Burstiness: 35% (strongest signal)
    tellWordAIScore * 0.30 +           // Tell words: 30%
    readabilityAIScore * 0.20 +        // Readability: 20%
    diversityAIScore * 0.15            // Diversity: 15%
  );

  // Determine verdict based on confidence thresholds
  let verdict: 'human' | 'ai' | 'uncertain';
  if (confidence < 35) {
    verdict = 'human';
  } else if (confidence > 65) {
    verdict = 'ai';
  } else {
    verdict = 'uncertain';
  }

  const processingTimeMs = Date.now() - startTime;

  return {
    verdict,
    confidence,
    signals: {
      burstiness,
      tellWordScore: tellWordAnalysis.score,
      readabilityPattern,
      lexicalDiversity
    },
    metrics: {
      fleschReadingEase,
      gunningFog,
      wordCount: words.length,
      sentenceCount: sentences.length,
      avgSentenceLength: Math.round(avgSentenceLength * 10) / 10
    },
    detectedTellWords: tellWordAnalysis.detectedWords.slice(0, 10), // Top 10 most frequent
    processingTimeMs,
    method: 'local'
  };
}

/**
 * Explain confidence score in human-readable terms
 */
export function explainConfidence(confidence: number): string {
  if (confidence < 20) {
    return 'Very likely written by a human';
  } else if (confidence < 35) {
    return 'Likely written by a human';
  } else if (confidence < 50) {
    return 'Possibly written by a human';
  } else if (confidence === 50) {
    return 'Uncertain - could be human or AI';
  } else if (confidence < 65) {
    return 'Possibly written by AI';
  } else if (confidence < 80) {
    return 'Likely written by AI';
  } else {
    return 'Very likely written by AI';
  }
}
