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
  // GPT-OSS 20B performs better for humanization tasks (tested Dec 2025)
  const modelId = options.model || '@cf/openai/gpt-oss-20b';
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
      polished = await llmPolishPass(env, voiceMatched, modelId, userId, options.intensity, flaggedSentences);

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
 * Intensity-specific prompt templates
 * Each level provides progressively more aggressive humanization instructions
 */
const INTENSITY_PROMPTS: Record<HumanizationIntensity, { instructions: string; wordTolerance: string; temperature: number }> = {
  light: {
    instructions: `Gently improve this text to sound slightly more natural while keeping the original structure mostly intact.

GUIDELINES:
- Add a few contractions where natural (don't, it's, we're, they'll)
- Soften overly formal phrases but keep the professional tone
- Keep technical terms, proper nouns, and specific facts exactly as written
- Make minimal structural changes - keep sentence order and paragraph breaks
- Only fix obviously robotic phrasing`,
    wordTolerance: '±5%',
    temperature: 0.5
  },

  moderate: {
    instructions: `Rewrite this to sound like a knowledgeable person explaining something to a colleague.

GUIDELINES:
- Use contractions throughout (don't, can't, it's, they're, we've)
- Vary sentence lengths - mix short punchy sentences (5-10 words) with longer explanatory ones (15-25 words)
- Use simpler words: "use" not "utilize", "help" not "facilitate", "show" not "demonstrate"
- Add occasional conversational phrases like "Here's the thing" or "Think about it this way"
- Break up any sentence longer than 30 words
- Keep all facts, names, and technical accuracy intact`,
    wordTolerance: '±10%',
    temperature: 0.7
  },

  aggressive: {
    instructions: `Completely rewrite this in a casual, conversational tone - like explaining to a friend over coffee.

GUIDELINES:
- Short sentences are good. Really short sometimes. Then mix in longer ones for variety.
- Start some sentences with "But", "And", "So", or "Now" - that's how people actually talk
- Use contractions everywhere - nobody writes "do not" in casual conversation
- Replace all jargon with plain language a teenager would understand
- Add personality: rhetorical questions, emphasis, occasional asides
- It's okay to restructure paragraphs entirely for better flow
- Break up walls of text - add paragraph breaks where natural pauses occur
- Keep the core meaning and all facts, but express them like a human would`,
    wordTolerance: '±15%',
    temperature: 0.8
  }
};

/**
 * AI tell-words to explicitly forbid in output
 * The LLM sometimes reintroduces these if not explicitly told to avoid them
 */
const FORBIDDEN_TELL_WORDS = [
  'furthermore', 'moreover', 'consequently', 'additionally', 'subsequently',
  'nevertheless', 'nonetheless', 'henceforth', 'whereby', 'thereof',
  'delve', 'tapestry', 'landscape', 'robust', 'leverage', 'leveraging',
  'navigate', 'navigating', 'realm', 'holistic', 'paradigm', 'multifaceted',
  'nuanced', 'pivotal', 'crucial', 'vital', 'comprehensive', 'intricate',
  "it's worth noting", "it is worth noting", "it's important to",
  "it is important to", "in today's", "in the modern", "needless to say"
];

/**
 * LLM polish pass - with intensity-aware prompts and improved instructions
 *
 * @param env - Cloudflare environment bindings
 * @param text - Text to polish
 * @param modelId - Model to use for polish
 * @param userId - User ID for LLM provider
 * @param intensity - Humanization intensity level
 * @param flaggedSentences - Optional set of GPTZero-flagged sentences for targeted transformation
 */
async function llmPolishPass(
  env: Env,
  text: string,
  modelId: string,
  userId: string,
  intensity: HumanizationIntensity,
  flaggedSentences?: Set<string>
): Promise<string> {
  const wordCount = text.split(/\s+/).length;
  const hasMarkers = hasBlockMarkers(text);
  const intensityConfig = INTENSITY_PROMPTS[intensity];

  // Include block marker instructions if text has markers
  const markerInstructions = hasMarkers ? `\n\nFORMAT PRESERVATION:\n${getBlockMarkerInstructions()}\n` : '';

  // Build GPTZero targeting instructions if flagged sentences provided
  let targetingInstructions = '';
  if (flaggedSentences && flaggedSentences.size > 0) {
    const flaggedList = Array.from(flaggedSentences).slice(0, 5); // Limit to 5 for prompt size
    targetingInstructions = `\n\nPRIORITY SENTENCES (flagged as AI-generated - focus extra attention here):
${flaggedList.map((s, i) => `${i + 1}. "${s.substring(0, 80)}${s.length > 80 ? '...' : ''}"`).join('\n')}`;
  }

  const prompt = `You are a skilled editor helping make AI-generated text sound human-written.

TASK: ${intensityConfig.instructions}

CRITICAL RULES:
1. Return ONLY the rewritten text - no explanations, no "Here's the rewritten version:", no meta-commentary
2. Preserve all facts, names, numbers, and technical accuracy
3. Never add information that wasn't in the original
4. Keep the text approximately ${wordCount} words (${intensityConfig.wordTolerance})
5. NEVER use these AI tell-words: ${FORBIDDEN_TELL_WORDS.slice(0, 15).join(', ')}
${markerInstructions}${targetingInstructions}

ORIGINAL TEXT:
${text}

REWRITTEN TEXT:`;

  try {
    // Use createLLMProvider for model selection
    const provider = await createLLMProvider(modelId, env, userId);
    const result = await provider.generateText(prompt, {
      max_tokens: 4096,
      temperature: intensityConfig.temperature
    });

    const rawResponse = result.trim() || text;

    // Filter output using model-specific vetting profile
    const filterResult = filterModelOutput(rawResponse, modelId);
    let polished = filterResult.content;

    // Safety check: If LLM reintroduced tell-words, try to strip them
    const reintroducedDetection = await detectAILocal(polished);
    const originalDetection = await detectAILocal(text);

    if (reintroducedDetection.detectedTellWords.length > originalDetection.detectedTellWords.length) {
      console.log(`[LLM Polish] Warning: LLM reintroduced ${reintroducedDetection.detectedTellWords.length - originalDetection.detectedTellWords.length} tell-words`);
      // Don't revert entirely - the LLM output is usually still better
      // Just log it for monitoring
    }

    // Additional cleanup: remove any preamble the LLM might have added
    polished = polished
      .replace(/^(Here's|Here is|Below is|The rewritten|Rewritten)[^:]*:\s*/i, '')
      .replace(/^(Sure|Certainly|Of course)[^.]*\.\s*/i, '')
      .trim();

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
