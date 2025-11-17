// Computer Humanizer Service
// Main orchestration for AI text humanization pipeline
// 5-Stage Process: Analysis → Naturalizer → Voice Match → LLM Polish → Validation

import type { Env } from '../../shared/types';
import { detectAILocal, type LocalDetectionResult } from './ai-detection/local-detector';
import {
  enhanceBurstiness,
  replaceTellWords,
  normalizeLexicalDiversity,
  addConversationalElements
} from '../lib/text-naturalizer';
import { extractVoiceProfile, applyVoiceProfile, type VoiceProfile } from '../lib/voice-profile';

/**
 * Humanization intensity levels
 */
export type HumanizationIntensity = 'light' | 'moderate' | 'aggressive';

/**
 * Humanization request options
 */
export interface HumanizationOptions {
  intensity: HumanizationIntensity;
  voiceSamples?: string[];           // Optional user writing samples
  enableLLMPolish?: boolean;         // Default: true
  targetBurstiness?: number;         // Default: 60
  targetLexicalDiversity?: number;   // Default: 60
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
 */
export async function humanizeText(
  env: Env,
  text: string,
  options: HumanizationOptions
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

  // Initialize timing trackers
  let stage1Time = 0, stage2Time = 0, stage3Time = 0, stage4Time = 0, stage5Time = 0;

  // ========================================
  // STAGE 1: Statistical Analysis (200ms)
  // ========================================
  const stage1Start = Date.now();
  const baselineDetection = await detectAILocal(trimmedText);
  stage1Time = Date.now() - stage1Start;

  console.log('[Computer Humanizer] Stage 1: Analysis complete', {
    confidence: baselineDetection.confidence,
    burstiness: baselineDetection.signals.burstiness,
    tellWords: baselineDetection.detectedTellWords.length
  });

  // ========================================
  // STAGE 2: Rule-Based Naturalizer (500ms)
  // ========================================
  const stage2Start = Date.now();
  let naturalized = trimmedText;

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

  console.log('[Computer Humanizer] Stage 2: Naturalizer complete', {
    lengthChange: naturalized.length - trimmedText.length,
    intensity: options.intensity
  });

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

      console.log('[Computer Humanizer] Stage 3: Voice profile applied', {
        sampleCount: options.voiceSamples.length,
        avgSentenceLength: voiceProfile.avgSentenceLength,
        formalityScore: voiceProfile.formalityScore
      });
    } catch (error) {
      console.warn('[Computer Humanizer] Stage 3: Voice profile extraction failed', error);
      // Continue without voice matching
    }
  } else {
    console.log('[Computer Humanizer] Stage 3: Skipped (no voice samples)');
  }

  stage3Time = Date.now() - stage3Start;

  // ========================================
  // STAGE 4: LLM Polish Pass (2-5s)
  // ========================================
  const stage4Start = Date.now();
  let polished = voiceMatched;

  if (options.enableLLMPolish !== false) {
    try {
      polished = await llmPolishPass(env, voiceMatched);

      console.log('[Computer Humanizer] Stage 4: LLM polish complete', {
        lengthChange: polished.length - voiceMatched.length
      });
    } catch (error) {
      console.warn('[Computer Humanizer] Stage 4: LLM polish failed', error);
      // Continue with naturalizer output
    }
  } else {
    console.log('[Computer Humanizer] Stage 4: Skipped (LLM polish disabled)');
  }

  stage4Time = Date.now() - stage4Start;

  // ========================================
  // STAGE 5: AI Detection Validation (1-2s)
  // ========================================
  const stage5Start = Date.now();
  const finalDetection = await detectAILocal(polished);
  stage5Time = Date.now() - stage5Start;

  console.log('[Computer Humanizer] Stage 5: Validation complete', {
    confidence: finalDetection.confidence,
    burstiness: finalDetection.signals.burstiness,
    tellWords: finalDetection.detectedTellWords.length
  });

  // Calculate improvement metrics
  const improvement = {
    aiConfidenceDrop: baselineDetection.confidence - finalDetection.confidence,
    burstinessIncrease: finalDetection.signals.burstiness - baselineDetection.signals.burstiness,
    tellWordsRemoved: baselineDetection.detectedTellWords.length - finalDetection.detectedTellWords.length,
    lexicalDiversityChange: finalDetection.signals.lexicalDiversity - baselineDetection.signals.lexicalDiversity
  };

  const totalTime = Date.now() - totalStartTime;

  console.log('[Computer Humanizer] Pipeline complete', {
    aiConfidenceDrop: improvement.aiConfidenceDrop,
    burstinessIncrease: improvement.burstinessIncrease,
    tellWordsRemoved: improvement.tellWordsRemoved,
    totalTimeMs: totalTime
  });

  return {
    humanizedText: polished,
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
 * LLM polish pass using Llama 70b
 * Ensures natural flow while preserving humanization improvements
 */
async function llmPolishPass(env: Env, text: string): Promise<string> {
  // Use Workers AI Llama 70b (Claude not available on Cloudflare Workers AI)
  const wordCount = text.split(/\s+/).length;
  const prompt = `Make this text sound natural and conversational, like a real person wrote it. Use simpler words. Remove any remaining formal or robotic language. Keep it around ${wordCount} words (±10%). Don't add new facts or explanations. Return ONLY the polished text.

Text:
${text}

Polished:`;

  try {
    const response = await env.AI.run('@cf/meta/llama-3-70b-instruct', {
      prompt,
      max_tokens: 4096,
      temperature: 0.7
    });

    const polished = (response as any).response?.trim() || text;

    // Safety check: If LLM reintroduced tell-words, return unpolished version
    const reintroducedDetection = await detectAILocal(polished);
    const originalDetection = await detectAILocal(text);

    if (reintroducedDetection.detectedTellWords.length > originalDetection.detectedTellWords.length) {
      console.warn('[LLM Polish] Tell-words reintroduced, returning unpolished version');
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
