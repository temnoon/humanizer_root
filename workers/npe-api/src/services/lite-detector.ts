/**
 * Lite AI Detector Service
 *
 * Heuristic-based AI detection for free tier users
 * Uses statistical analysis + optional LLM meta-judge
 */

import { distance } from 'fastest-levenshtein';
import aiPhrases from '../data/ai-tell-phrases.json';
import {
  stripInlineMarkdown,
  createPositionMap,
  adjustHighlightPositions,
  applyHighlightsToMarkdown,
  type HighlightRange
} from './markdown-preserver';
import { analyzeSentences, type SentenceAnalysis } from './ai-detection/tell-words';

// Types
export interface LiteDetectionResult {
  detector_type: 'lite';
  ai_likelihood: number;
  confidence: 'low' | 'medium' | 'high';
  label: 'likely_human' | 'mixed' | 'likely_ai';
  metrics: {
    burstiness: number;
    avgSentenceLength: number;
    sentenceLengthStd: number;
    typeTokenRatio: number;
    repeatedNgrams: number;
  };
  phraseHits: Array<{
    phrase: string;
    count: number;
    weight: number;
    category: string;
  }>;
  highlights: Array<{
    start: number;
    end: number;
    reason: string;
    score: number;
  }>;
  heuristicScore: number;
  llmScore?: number;
  // New: sentence-level analysis
  sentenceAnalysis?: SentenceAnalysis[];
  suspectSentences?: SentenceAnalysis[];
}

export interface TextSlice {
  id: string;
  text: string;
  start: number;
  end: number;
}

/**
 * Main detection function
 */
export async function detectWithLite(
  text: string,
  useLLMJudge: boolean = false,
  aiBinding?: any // Cloudflare AI binding (optional)
): Promise<LiteDetectionResult> {
  // 1. Segment text into sentences
  const sentences = segmentSentences(text);

  // 2. Compute heuristic features
  const metrics = computeMetrics(text, sentences);

  // 3. Detect tell-phrases
  const phraseHits = detectTellPhrases(text);

  // 4. Compute heuristic score
  const heuristicScore = computeHeuristicScore(metrics, phraseHits);

  // 5. Optional: LLM meta-judge
  let llmScore: number | undefined;
  if (useLLMJudge && aiBinding) {
    llmScore = await llmMetaJudge(text, metrics, phraseHits, aiBinding);
  }

  // 6. Combine scores
  const finalScore = llmScore !== undefined
    ? 0.4 * heuristicScore + 0.4 * llmScore + 0.2 * heuristicScore // Weighted average
    : heuristicScore;

  // 7. Determine confidence and label
  const confidence = getConfidence(finalScore);
  const label = getLabel(finalScore);

  // 8. Create highlights
  const highlights = createHighlights(text, sentences, phraseHits, finalScore);

  // 9. Run sentence-level analysis (using new tell-words module)
  const sentenceAnalysis = analyzeSentences(text);
  const suspectSentences = sentenceAnalysis.filter(s => s.aiScore >= 30).slice(0, 10);

  return {
    detector_type: 'lite',
    ai_likelihood: finalScore,
    confidence,
    label,
    metrics,
    phraseHits,
    highlights,
    heuristicScore,
    llmScore,
    sentenceAnalysis,
    suspectSentences,
  };
}

/**
 * Segment text into sentences (simple rule-based)
 */
function segmentSentences(text: string): string[] {
  // Simple sentence splitting on . ! ?
  // Note: Production would use sentence-splitter package for better accuracy
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return sentences;
}

/**
 * Compute statistical metrics
 */
function computeMetrics(text: string, sentences: string[]): LiteDetectionResult['metrics'] {
  // Sentence length analysis
  const sentenceLengths = sentences.map(s => s.split(/\s+/).length);
  const avgSentenceLength = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length || 0;

  const variance = sentenceLengths.reduce((acc, len) => {
    return acc + Math.pow(len - avgSentenceLength, 2);
  }, 0) / sentenceLengths.length;

  const sentenceLengthStd = Math.sqrt(variance);

  // Burstiness: normalized standard deviation
  // Higher burstiness = more human (varied sentence length)
  const burstiness = sentenceLengthStd / (avgSentenceLength || 1);

  // Type-Token Ratio (lexical diversity)
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const uniqueWords = new Set(words);
  const typeTokenRatio = uniqueWords.size / (words.length || 1);

  // N-gram repetition (4-grams)
  const ngrams = extractNgrams(words, 4);
  const ngramCounts = new Map<string, number>();

  for (const ngram of ngrams) {
    const key = ngram.join(' ');
    ngramCounts.set(key, (ngramCounts.get(key) || 0) + 1);
  }

  const repeatedNgrams = Array.from(ngramCounts.values()).filter(count => count >= 3).length;

  return {
    burstiness: burstiness * 100, // Scale to 0-100
    avgSentenceLength,
    sentenceLengthStd,
    typeTokenRatio,
    repeatedNgrams,
  };
}

/**
 * Extract n-grams from word array
 */
function extractNgrams(words: string[], n: number): string[][] {
  const ngrams: string[][] = [];
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.push(words.slice(i, i + n));
  }
  return ngrams;
}

/**
 * Detect AI tell-phrases with fuzzy matching
 */
function detectTellPhrases(text: string): LiteDetectionResult['phraseHits'] {
  const lowerText = text.toLowerCase();
  const hitMap = new Map<string, { count: number; weight: number; category: string }>();

  for (const phrase of aiPhrases.phrases) {
    // Exact match
    const regex = new RegExp(`\\b${phrase.text}\\b`, 'gi');
    const matches = lowerText.match(regex);

    if (matches) {
      hitMap.set(phrase.text, {
        count: matches.length,
        weight: phrase.weight,
        category: phrase.category,
      });
      continue;
    }

    // Fuzzy match (Levenshtein distance)
    const words = lowerText.split(/\s+/);
    const phraseWords = phrase.text.split(/\s+/);

    // Only fuzzy match for multi-word phrases
    if (phraseWords.length > 1) {
      for (let i = 0; i <= words.length - phraseWords.length; i++) {
        const candidate = words.slice(i, i + phraseWords.length).join(' ');
        const dist = distance(phrase.text, candidate);
        const similarity = 1 - dist / Math.max(phrase.text.length, candidate.length);

        // Threshold: 85% similarity
        if (similarity >= 0.85) {
          const existing = hitMap.get(phrase.text);
          if (existing) {
            existing.count++;
          } else {
            hitMap.set(phrase.text, {
              count: 1,
              weight: phrase.weight,
              category: phrase.category,
            });
          }
        }
      }
    }
  }

  return Array.from(hitMap.entries())
    .map(([phrase, data]) => ({
      phrase,
      count: data.count,
      weight: data.weight,
      category: data.category,
    }))
    .sort((a, b) => b.weight * b.count - a.weight * a.count)
    .slice(0, 20); // Top 20 hits
}

/**
 * Compute heuristic score (0-1)
 */
function computeHeuristicScore(
  metrics: LiteDetectionResult['metrics'],
  phraseHits: LiteDetectionResult['phraseHits']
): number {
  let score = 0.5; // Start neutral

  // 1. Burstiness (lower = more AI-like)
  if (metrics.burstiness < 20) {
    score += 0.2; // Very low burstiness = likely AI
  } else if (metrics.burstiness < 40) {
    score += 0.1;
  } else if (metrics.burstiness > 70) {
    score -= 0.1; // High burstiness = likely human
  }

  // 2. Tell-phrases
  const totalPhraseWeight = phraseHits.reduce((sum, hit) => {
    return sum + hit.weight * hit.count;
  }, 0);

  const phraseScore = Math.min(totalPhraseWeight / 10, 0.3); // Cap at 0.3
  score += phraseScore;

  // 3. Type-Token Ratio (lower = more AI-like repetition)
  if (metrics.typeTokenRatio < 0.3) {
    score += 0.1; // Low diversity = likely AI
  } else if (metrics.typeTokenRatio > 0.5) {
    score -= 0.1; // High diversity = likely human
  }

  // 4. Repeated N-grams
  if (metrics.repeatedNgrams > 5) {
    score += 0.1; // Many repetitions = likely AI
  }

  // 5. Sentence length uniformity (low std = AI-like)
  if (metrics.sentenceLengthStd < 5) {
    score += 0.1; // Very uniform = likely AI
  }

  // Clamp to 0-1
  return Math.max(0, Math.min(1, score));
}

/**
 * LLM Meta-Judge (Cloudflare AI refinement)
 */
async function llmMetaJudge(
  text: string,
  metrics: LiteDetectionResult['metrics'],
  phraseHits: LiteDetectionResult['phraseHits'],
  aiBinding: any
): Promise<number> {
  try {
    // Truncate text to first 1000 chars to keep prompt manageable
    const textSample = text.length > 1000 ? text.substring(0, 1000) + '...' : text;

    // Get top AI phrases detected
    const topPhrases = phraseHits.slice(0, 5).map(p => p.phrase).join(', ');

    // Build prompt for LLM
    const prompt = `You are an AI detection assistant. Analyze this text and estimate the probability it was generated by an LLM.

TEXT SAMPLE:
"${textSample}"

STATISTICAL ANALYSIS:
- Burstiness Score: ${metrics.burstiness.toFixed(2)} (measures sentence length variation; AI tends to be < 30)
- Average Sentence Length: ${metrics.avgSentenceLength.toFixed(1)} words
- Type-Token Ratio: ${metrics.typeTokenRatio.toFixed(2)} (lexical diversity; AI tends to be < 0.4)
- Repeated 4-grams: ${metrics.repeatedNgrams} (phrase repetition; AI tends to have more)
- AI Tell-Phrases Detected: ${phraseHits.length} phrases
${topPhrases ? `- Top phrases: ${topPhrases}` : ''}

Based on the text sample and statistics above, return ONLY a valid JSON object (no other text) with:
{
  "ai_probability": 0.65,
  "reasoning": "brief explanation"
}

The ai_probability should be a number between 0.0 (definitely human) and 1.0 (definitely AI).`;

    // Call Cloudflare AI
    const response = await aiBinding.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: 'You are an AI detection expert. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3, // Low temperature for more consistent results
      max_tokens: 256
    });

    // Parse response
    const responseText = response.response || '';
    console.log('[LLM Meta-Judge] Raw response:', responseText);

    // Try to extract JSON from response
    const jsonMatch = responseText.match(/\{[^}]*"ai_probability"[^}]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const aiProb = parseFloat(parsed.ai_probability);

      if (!isNaN(aiProb) && aiProb >= 0 && aiProb <= 1) {
        console.log('[LLM Meta-Judge] AI probability:', aiProb, 'Reasoning:', parsed.reasoning);
        return aiProb;
      }
    }

    // Fallback: If we can't parse a valid response, use heuristic
    console.warn('[LLM Meta-Judge] Could not parse valid response, using heuristic fallback');
    const phraseScore = Math.min(phraseHits.length / 10, 0.5);
    const burstiScore = metrics.burstiness < 30 ? 0.3 : 0.1;
    return phraseScore + burstiScore;

  } catch (error) {
    console.error('[LLM Meta-Judge] Error:', error);
    // Fallback to heuristic on error
    const phraseScore = Math.min(phraseHits.length / 10, 0.5);
    const burstiScore = metrics.burstiness < 30 ? 0.3 : 0.1;
    return phraseScore + burstiScore;
  }
}

/**
 * Determine confidence level
 */
function getConfidence(score: number): 'low' | 'medium' | 'high' {
  if (score < 0.3 || score > 0.7) {
    return 'high'; // Strong signal either way
  } else if (score < 0.4 || score > 0.6) {
    return 'medium';
  } else {
    return 'low'; // Ambiguous
  }
}

/**
 * Determine label
 */
function getLabel(score: number): 'likely_human' | 'mixed' | 'likely_ai' {
  if (score < 0.35) {
    return 'likely_human';
  } else if (score < 0.65) {
    return 'mixed';
  } else {
    return 'likely_ai';
  }
}

/**
 * Create highlights for suspicious sections
 */
function createHighlights(
  text: string,
  sentences: string[],
  phraseHits: LiteDetectionResult['phraseHits'],
  overallScore: number
): LiteDetectionResult['highlights'] {
  const highlights: LiteDetectionResult['highlights'] = [];

  // Highlight sentences with tell-phrases
  let currentIndex = 0;
  for (const sentence of sentences) {
    const sentenceStart = text.indexOf(sentence, currentIndex);
    const sentenceEnd = sentenceStart + sentence.length;

    // Check if this sentence contains any tell-phrases
    const phrasesInSentence = phraseHits.filter(hit => {
      return sentence.toLowerCase().includes(hit.phrase);
    });

    if (phrasesInSentence.length > 0) {
      const totalWeight = phrasesInSentence.reduce((sum, hit) => sum + hit.weight, 0);
      const score = Math.min(totalWeight / 5, 1);

      highlights.push({
        start: sentenceStart,
        end: sentenceEnd,
        reason: `Contains AI phrases: ${phrasesInSentence.map(h => h.phrase).join(', ')}`,
        score,
      });
    }

    currentIndex = sentenceEnd;
  }

  // Limit to top 10 highlights
  return highlights
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

/**
 * Markdown-aware AI detection wrapper
 * Strips markdown before analysis, then restores it with highlights
 *
 * @param markdownText - Original text with markdown formatting
 * @param useLLMJudge - Whether to use LLM meta-judge
 * @param aiBinding - Cloudflare AI binding (optional)
 * @returns Detection result with markdown-aware highlights
 */
export async function detectWithLiteMarkdown(
  markdownText: string,
  useLLMJudge: boolean = false,
  aiBinding?: any
): Promise<LiteDetectionResult & { highlightedMarkdown: string }> {
  // 1. Create position map BEFORE stripping
  const positionMap = createPositionMap(markdownText);

  // 2. Strip markdown for analysis
  const plainText = stripInlineMarkdown(markdownText);

  // 3. Run detection on plain text
  const result = await detectWithLite(plainText, useLLMJudge, aiBinding);

  // 4. Adjust highlight positions to account for markdown
  const highlightRanges: HighlightRange[] = result.highlights.map(h => ({
    start: h.start,
    end: h.end,
    reason: h.reason
  }));

  const adjustedHighlights = adjustHighlightPositions(highlightRanges, positionMap);

  // 5. Apply highlights to original markdown
  const highlightedMarkdown = applyHighlightsToMarkdown(markdownText, adjustedHighlights);

  // 6. Convert adjusted highlights back to the full format with scores
  // IMPORTANT: Return adjusted highlights (mapped to markdown positions) not original highlights
  const adjustedHighlightsWithScores = adjustedHighlights.map((h, i) => ({
    start: h.start,
    end: h.end,
    reason: h.reason,
    score: result.highlights[i]?.score || 0
  }));

  return {
    ...result,
    highlights: adjustedHighlightsWithScores, // Override with markdown-adjusted positions
    highlightedMarkdown
  };
}
