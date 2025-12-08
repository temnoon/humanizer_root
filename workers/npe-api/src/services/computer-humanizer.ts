// Computer Humanizer Service
// Main orchestration for AI text humanization pipeline
// 5-Stage Process: Analysis → Naturalizer → Voice Match → LLM Polish → Validation

import type { Env } from '../../shared/types';
import { detectAILocal, type LocalDetectionResult } from './ai-detection/local-detector';
import { detectAIWithGPTZero, type GPTZeroDetectionResult } from './ai-detection/gptzero-client';
import {
  enhanceBurstiness,
  replaceTellWords,
  normalizeLexicalDiversity,
  addConversationalElements
} from '../lib/text-naturalizer';
import { extractVoiceProfile, applyVoiceProfile, type VoiceProfile } from '../lib/voice-profile';
import {
  insertBlockMarkers,
  stripBlockMarkers,
  hasBlockMarkers,
  getBlockMarkerInstructions
} from '../lib/block-markers';
import { filterModelOutput, UnvettedModelError } from './model-vetting';
import { createLLMProvider } from './llm-providers';

/**
 * Humanization intensity levels
 */
export type HumanizationIntensity = 'light' | 'moderate' | 'aggressive';

/**
 * GPTZero sentence analysis for targeted transformation
 */
export interface GPTZeroSentence {
  sentence: string;
  generated_prob: number;
  highlight_sentence_for_ai: boolean;
}

/**
 * Humanization request options
 */
export interface HumanizationOptions {
  intensity: HumanizationIntensity;
  voiceSamples?: string[];           // Optional user writing samples
  enableLLMPolish?: boolean;         // Default: true
  targetBurstiness?: number;         // Default: 60
  targetLexicalDiversity?: number;   // Default: 60
  model?: string;                    // LLM choice for polish pass (default: llama-3.1-70b)
  useGPTZeroTargeting?: boolean;     // Premium: use GPTZero for sentence-level targeting
}

/**
 * Humanization result with metrics and stages
 */
export interface HumanizationResult {
  // Final output
  humanizedText: string;

  // Before/after metrics
  baseline: {
    detection: LocalDetectionResult;
  };
  final: {
    detection: LocalDetectionResult;
  };

  // Improvement stats
  improvement: {
    aiConfidenceDrop: number;         // How much AI confidence decreased
    burstinessIncrease: number;       // How much burstiness increased
    tellWordsRemoved: number;         // Number of tell-words removed
    lexicalDiversityChange: number;   // Change in lexical diversity
  };

  // Stage outputs (for debugging/transparency)
  stages: {
    original: string;
    afterNaturalizer: string;
    afterVoiceMatch?: string;
    afterLLMPolish?: string;
  };

  // Voice profile (if samples provided)
  voiceProfile?: VoiceProfile;

  // GPTZero targeting data (if enabled)
  gptzeroAnalysis?: {
    sentences: GPTZeroSentence[];
    flaggedCount: number;
    totalCount: number;
    overallConfidence: number;
  };

  // Model used for LLM polish
  modelUsed?: string;

  // Processing metadata
  processing: {
    totalDurationMs: number;
    stage1DurationMs: number;  // Analysis
    stage2DurationMs: number;  // Naturalizer
    stage3DurationMs: number;  // Voice matching
    stage4DurationMs: number;  // LLM polish
    stage5DurationMs: number;  // Validation
  };
}

/**
 * Main humanization pipeline
 * Transforms AI-generated text to reduce AI detection while preserving meaning
 *
 * @param env - Cloudflare environment bindings
 * @param text - Text to humanize
 * @param options - Humanization options including model choice and GPTZero targeting
 * @param userId - User ID (needed for LLM provider and tier-based features)
 * @param gptzeroApiKey - Optional GPTZero API key (for targeting feature)
 */
export async function humanizeText(
  env: Env,
  text: string,
  options: HumanizationOptions,
  userId: string,
  gptzeroApiKey?: string
): Promise<HumanizationResult> {
  const totalStartTime = Date.now();

  // Validate input
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  const trimmedText = text.trim();
  const wordCount = trimmedText.split(/\s+/).length;

  if (wordCount < 20) {
    throw new Error('Text must be at least 20 words for humanization');
  }

  // Default model for LLM polish pass
  const modelId = options.model || '@cf/meta/llama-3.1-70b-instruct';
  console.log(`[Humanizer] Model: ${modelId}${options.model ? ' (user selected)' : ' (default)'}`);

  // Initialize timing trackers
  let stage1Time = 0, stage2Time = 0, stage3Time = 0, stage4Time = 0, stage5Time = 0;

  // GPTZero analysis data (if enabled)
  let gptzeroAnalysis: HumanizationResult['gptzeroAnalysis'] | undefined;
  let flaggedSentences: Set<string> = new Set();

  // ========================================
  // STAGE 1: Statistical Analysis (200ms)
  // ========================================
  const stage1Start = Date.now();
  const baselineDetection = await detectAILocal(trimmedText);

  // Optional: GPTZero targeting for sentence-level analysis
  if (options.useGPTZeroTargeting && gptzeroApiKey) {
    try {
      console.log('[Humanizer] Running GPTZero targeting analysis...');
      const gptzeroResult = await detectAIWithGPTZero(trimmedText, gptzeroApiKey);

      // Extract flagged sentences for targeted transformation
      const sentences = gptzeroResult.details.sentences.map(s => ({
        sentence: s.sentence,
        generated_prob: s.generated_prob,
        highlight_sentence_for_ai: s.highlight_sentence_for_ai
      }));

      // Build set of flagged sentences for targeted naturalization
      for (const s of sentences) {
        if (s.highlight_sentence_for_ai) {
          flaggedSentences.add(s.sentence);
        }
      }

      gptzeroAnalysis = {
        sentences,
        flaggedCount: flaggedSentences.size,
        totalCount: sentences.length,
        overallConfidence: gptzeroResult.confidence
      };

      console.log(`[Humanizer] GPTZero flagged ${flaggedSentences.size}/${sentences.length} sentences`);
    } catch (error) {
      console.error('[Humanizer] GPTZero analysis failed, falling back to local:', error);
      // Continue without GPTZero targeting
    }
  }

  stage1Time = Date.now() - stage1Start;

  // ========================================
  // FORMAT PRESERVATION: Add block markers
  // ========================================
  // Detect if input has markdown structure worth preserving
  const hasMarkdownStructure = /^#+\s|^\s*[-*+]\s|^\s*\d+\.\s|^>/m.test(trimmedText);
  const markedInput = hasMarkdownStructure ? insertBlockMarkers(trimmedText) : trimmedText;

  // ========================================
  // STAGE 2: Rule-Based Naturalizer (500ms)
  // ========================================
  const stage2Start = Date.now();
  let naturalized = markedInput;

  // Step 2.1: Enhance burstiness
  naturalized = enhanceBurstiness(
    naturalized,
    options.targetBurstiness || 60
  );

  // Step 2.2: Replace tell-words
  naturalized = replaceTellWords(
    naturalized,
    options.intensity
  );

  // Step 2.3: Normalize lexical diversity
  naturalized = normalizeLexicalDiversity(
    naturalized,
    options.targetLexicalDiversity || 60
  );

  // Step 2.4: Add conversational elements
  naturalized = addConversationalElements(naturalized);

  stage2Time = Date.now() - stage2Start;

  // ========================================
  // STAGE 3: User Voice Matching (1-2s)
  // ========================================
  const stage3Start = Date.now();
  let voiceMatched = naturalized;
  let voiceProfile: VoiceProfile | undefined;

  if (options.voiceSamples && options.voiceSamples.length > 0) {
    try {
      voiceProfile = extractVoiceProfile(options.voiceSamples);
      voiceMatched = applyVoiceProfile(naturalized, voiceProfile);

    } catch (error) {
      // Continue without voice matching
    }
  }

  stage3Time = Date.now() - stage3Start;

  // ========================================
  // STAGE 4: LLM Polish Pass (2-5s)
  // ========================================
  const stage4Start = Date.now();
  let polished = voiceMatched;

  if (options.enableLLMPolish !== false) {
    try {
      polished = await llmPolishPass(env, voiceMatched, modelId, userId, flaggedSentences);

    } catch (error) {
      console.error('[Humanizer] LLM polish failed:', error);
      // Continue with naturalizer output
    }
  }

  stage4Time = Date.now() - stage4Start;

  // ========================================
  // STAGE 5: AI Detection Validation (1-2s)
  // ========================================
  const stage5Start = Date.now();
  const finalDetection = await detectAILocal(polished);
  stage5Time = Date.now() - stage5Start;

  // Calculate improvement metrics
  const improvement = {
    aiConfidenceDrop: baselineDetection.confidence - finalDetection.confidence,
    burstinessIncrease: finalDetection.signals.burstiness - baselineDetection.signals.burstiness,
    tellWordsRemoved: baselineDetection.detectedTellWords.length - finalDetection.detectedTellWords.length,
    lexicalDiversityChange: finalDetection.signals.lexicalDiversity - baselineDetection.signals.lexicalDiversity
  };

  const totalTime = Date.now() - totalStartTime;

  // ========================================
  // FORMAT PRESERVATION: Strip block markers
  // ========================================
  const finalText = hasMarkdownStructure && hasBlockMarkers(polished)
    ? stripBlockMarkers(polished)
    : polished;

  return {
    humanizedText: finalText,
    baseline: {
      detection: baselineDetection
    },
    final: {
      detection: finalDetection
    },
    improvement,
    stages: {
      original: trimmedText,
      afterNaturalizer: naturalized,
      afterVoiceMatch: voiceMatched !== naturalized ? voiceMatched : undefined,
      afterLLMPolish: polished !== voiceMatched ? polished : undefined
    },
    voiceProfile,
    gptzeroAnalysis,
    modelUsed: options.enableLLMPolish !== false ? modelId : undefined,
    processing: {
      totalDurationMs: totalTime,
      stage1DurationMs: stage1Time,
      stage2DurationMs: stage2Time,
      stage3DurationMs: stage3Time,
      stage4DurationMs: stage4Time,
      stage5DurationMs: stage5Time
    }
  };
}

/**
 * LLM polish pass - now with model choice and GPTZero targeting
 * Ensures natural flow while preserving humanization improvements
 *
 * @param env - Cloudflare environment bindings
 * @param text - Text to polish
 * @param modelId - Model to use for polish
 * @param userId - User ID for LLM provider
 * @param flaggedSentences - Optional set of GPTZero-flagged sentences for targeted transformation
 */
async function llmPolishPass(
  env: Env,
  text: string,
  modelId: string,
  userId: string,
  flaggedSentences?: Set<string>
): Promise<string> {
  const wordCount = text.split(/\s+/).length;
  const hasMarkers = hasBlockMarkers(text);

  // Include block marker instructions if text has markers
  const markerInstructions = hasMarkers ? `\n\n${getBlockMarkerInstructions()}\n` : '';

  // Build GPTZero targeting instructions if flagged sentences provided
  let targetingInstructions = '';
  if (flaggedSentences && flaggedSentences.size > 0) {
    const flaggedList = Array.from(flaggedSentences).slice(0, 10); // Limit to 10 for prompt size
    targetingInstructions = `\n\nPRIORITY: The following sentences were flagged as AI-generated and need extra attention:
${flaggedList.map((s, i) => `${i + 1}. "${s.substring(0, 100)}${s.length > 100 ? '...' : ''}"`).join('\n')}

Focus on making these sentences sound more natural and human-like. Vary their structure, use more casual language, and break up any overly formal patterns.`;
  }

  const prompt = `Make this text sound natural and conversational, like a real person wrote it. Use simpler words. Remove any remaining formal or robotic language. Keep it around ${wordCount} words (±10%). Don't add new facts or explanations.${markerInstructions}${targetingInstructions}
Return ONLY the polished text.

Text:
${text}

Polished:`;

  try {
    // Use createLLMProvider for model selection
    const provider = await createLLMProvider(modelId, env, userId);
    const result = await provider.generateText(prompt, {
      max_tokens: 4096,
      temperature: 0.7
    });

    const rawResponse = result.trim() || text;

    // Filter output using model-specific vetting profile
    const filterResult = filterModelOutput(rawResponse, modelId);
    const polished = filterResult.content;

    // Safety check: If LLM reintroduced tell-words, return unpolished version
    const reintroducedDetection = await detectAILocal(polished);
    const originalDetection = await detectAILocal(text);

    if (reintroducedDetection.detectedTellWords.length > originalDetection.detectedTellWords.length) {
      console.log('[LLM Polish] Reverted: LLM reintroduced tell-words');
      return text;
    }

    return polished;

  } catch (error) {
    console.error('[LLM Polish] Failed:', error);
    return text; // Return original if polish fails
  }
}

/**
 * Analyze text to determine if it needs humanization
 * Returns recommendation and current metrics
 */
export async function analyzeForHumanization(text: string): Promise<{
  needsHumanization: boolean;
  recommendation: 'light' | 'moderate' | 'aggressive';
  currentMetrics: LocalDetectionResult;
  reasons: string[];
}> {
  const detection = await detectAILocal(text);
  const reasons: string[] = [];

  // Check if text appears AI-generated
  if (detection.confidence >= 65) {
    reasons.push(`High AI confidence (${detection.confidence}%)`);
  }

  if (detection.signals.burstiness < 40) {
    reasons.push(`Low burstiness (${detection.signals.burstiness}/100) - uniform sentence lengths`);
  }

  if (detection.detectedTellWords.length >= 5) {
    reasons.push(`${detection.detectedTellWords.length} AI tell-words detected`);
  }

  if (detection.signals.lexicalDiversity > 70) {
    reasons.push(`High lexical diversity (${detection.signals.lexicalDiversity}%) - possibly over-diverse`);
  }

  // Determine recommendation
  let recommendation: 'light' | 'moderate' | 'aggressive';
  if (detection.confidence >= 80) {
    recommendation = 'aggressive';
  } else if (detection.confidence >= 50) {
    recommendation = 'moderate';
  } else {
    recommendation = 'light';
  }

  return {
    needsHumanization: reasons.length > 0,
    recommendation,
    currentMetrics: detection,
    reasons
  };
}
