/**
 * useSentenceAnalysis Hook
 *
 * Provides sentence-level metrics for text content.
 * Uses the @humanizer/core sentence tokenizer and SIC analyzer.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  SentenceMetrics,
  TetralemmaProbs,
  TetralemmaStance,
  SemanticPosition,
} from './types';

interface AnalysisState {
  sentences: SentenceMetrics[];
  loading: boolean;
  error: string | null;
  overall: {
    totalSentences: number;
    avgSicScore: number;
    avgEntropy: number;
    dominantStance: TetralemmaStance;
  };
}

interface UseSentenceAnalysisOptions {
  /** API endpoint for analysis (if using server-side) */
  apiEndpoint?: string;

  /** Use local analysis (browser-side) */
  useLocal?: boolean;

  /** Debounce delay in ms */
  debounceMs?: number;
}

/**
 * Simple sentence tokenizer (client-side fallback)
 */
function tokenizeSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by space or end
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return sentences;
}

/**
 * Calculate tetralemma probabilities from text
 * This is a simplified local implementation
 */
function analyzeTetralemma(text: string): TetralemmaProbs {
  const lower = text.toLowerCase();

  // Simple heuristic indicators
  const affirmationSignals = ['is', 'are', 'yes', 'true', 'must', 'always', 'certainly'];
  const negationSignals = ['not', 'no', 'never', "isn't", "aren't", "don't", 'false'];
  const bothSignals = ['and', 'also', 'both', 'as well as', 'together'];
  const neitherSignals = ['neither', 'nor', 'none', 'empty', 'void', 'beyond'];

  const countSignals = (signals: string[]) =>
    signals.reduce((acc, s) => acc + (lower.includes(s) ? 1 : 0), 0);

  const raw = {
    affirmation: countSignals(affirmationSignals) + 1, // +1 prior
    negation: countSignals(negationSignals) + 1,
    both: countSignals(bothSignals) + 0.5,
    neither: countSignals(neitherSignals) + 0.5,
  };

  const total = raw.affirmation + raw.negation + raw.both + raw.neither;

  return {
    affirmation: raw.affirmation / total,
    negation: raw.negation / total,
    both: raw.both / total,
    neither: raw.neither / total,
  };
}

/**
 * Calculate entropy from probabilities
 */
function calculateEntropy(probs: TetralemmaProbs): number {
  const values = Object.values(probs);
  return -values.reduce((sum, p) => {
    if (p <= 0) return sum;
    return sum + p * Math.log2(p);
  }, 0);
}

/**
 * Determine dominant stance
 */
function getDominantStance(probs: TetralemmaProbs): TetralemmaStance {
  const entries = Object.entries(probs) as [TetralemmaStance, number][];
  return entries.reduce((max, curr) => (curr[1] > max[1] ? curr : max))[0];
}

/**
 * Simple SIC score estimation
 * Higher scores indicate more human-like constraint traces
 */
function estimateSicScore(text: string): number {
  const lower = text.toLowerCase();

  // SIC indicators (traces of lived constraint)
  const irreversibilityMarkers = ['decided', 'chose', 'committed', "can't undo", 'final'];
  const temporalPressure = ['before i could', 'suddenly', 'immediately', 'in that moment'];
  const epistemicIncomplete = ['i was wrong', "didn't know", 'mistaken', 'realized'];
  const valueTradeoffs = ['at the cost of', 'sacrificed', 'gave up', 'instead of'];
  const scarTissue = ['regret', 'still', 'haunts', 'remember when'];
  const embodiment = ['hands', 'felt', 'body', 'breath', 'heart'];

  const countMatches = (markers: string[]) =>
    markers.reduce((acc, m) => acc + (lower.includes(m) ? 10 : 0), 0);

  let score = 30; // Base score
  score += countMatches(irreversibilityMarkers);
  score += countMatches(temporalPressure);
  score += countMatches(epistemicIncomplete);
  score += countMatches(valueTradeoffs);
  score += countMatches(scarTissue);
  score += countMatches(embodiment);

  // Penalty for generic/corporate language
  const genericMarkers = ['leverage', 'synergy', 'optimize', 'solutions', 'innovative'];
  score -= countMatches(genericMarkers);

  // Clamp to 0-100
  return Math.max(0, Math.min(100, score));
}

/**
 * Determine SIC level from score
 */
function getSicLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/**
 * Analyze a single sentence
 */
function analyzeSentence(text: string, index: number): SentenceMetrics {
  const tetralemma = analyzeTetralemma(text);
  const sicScore = estimateSicScore(text);

  return {
    text,
    index,
    tetralemma,
    dominantStance: getDominantStance(tetralemma),
    entropy: calculateEntropy(tetralemma),
    sicScore,
    sicLevel: getSicLevel(sicScore),
  };
}

/**
 * Main hook for sentence analysis
 */
export function useSentenceAnalysis(
  text: string,
  options: UseSentenceAnalysisOptions = {}
): AnalysisState & {
  analyzeSentenceAt: (index: number) => SentenceMetrics | null;
  refreshAnalysis: () => void;
} {
  const { apiEndpoint, useLocal = true, debounceMs = 300 } = options;

  const [state, setState] = useState<AnalysisState>({
    sentences: [],
    loading: false,
    error: null,
    overall: {
      totalSentences: 0,
      avgSicScore: 0,
      avgEntropy: 0,
      dominantStance: 'affirmation',
    },
  });

  const analyzeText = useCallback(async () => {
    if (!text.trim()) {
      setState({
        sentences: [],
        loading: false,
        error: null,
        overall: {
          totalSentences: 0,
          avgSicScore: 0,
          avgEntropy: 0,
          dominantStance: 'affirmation',
        },
      });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      let sentences: SentenceMetrics[];

      if (useLocal || !apiEndpoint) {
        // Local analysis
        const tokenized = tokenizeSentences(text);
        sentences = tokenized.map((s, i) => analyzeSentence(s, i));
      } else {
        // API analysis
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });

        if (!response.ok) {
          throw new Error(`Analysis failed: ${response.statusText}`);
        }

        const data = await response.json();
        sentences = data.sentences;
      }

      // Calculate overall metrics
      const totalSentences = sentences.length;
      const avgSicScore =
        sentences.reduce((sum, s) => sum + s.sicScore, 0) / totalSentences || 0;
      const avgEntropy =
        sentences.reduce((sum, s) => sum + s.entropy, 0) / totalSentences || 0;

      // Aggregate tetralemma
      const aggregateTetralemma = sentences.reduce(
        (acc, s) => ({
          affirmation: acc.affirmation + s.tetralemma.affirmation,
          negation: acc.negation + s.tetralemma.negation,
          both: acc.both + s.tetralemma.both,
          neither: acc.neither + s.tetralemma.neither,
        }),
        { affirmation: 0, negation: 0, both: 0, neither: 0 }
      );

      setState({
        sentences,
        loading: false,
        error: null,
        overall: {
          totalSentences,
          avgSicScore,
          avgEntropy,
          dominantStance: getDominantStance(aggregateTetralemma),
        },
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Analysis failed',
      }));
    }
  }, [text, apiEndpoint, useLocal]);

  // Debounced analysis
  useEffect(() => {
    const timer = setTimeout(analyzeText, debounceMs);
    return () => clearTimeout(timer);
  }, [analyzeText, debounceMs]);

  const analyzeSentenceAt = useCallback(
    (index: number): SentenceMetrics | null => {
      return state.sentences[index] || null;
    },
    [state.sentences]
  );

  return {
    ...state,
    analyzeSentenceAt,
    refreshAnalysis: analyzeText,
  };
}

export default useSentenceAnalysis;
