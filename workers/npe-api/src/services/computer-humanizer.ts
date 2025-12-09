// Computer Humanizer Service
// Main orchestration for AI text humanization pipeline
// 5-Stage Process: Analysis → Naturalizer → Voice Match → LLM Polish → Validation

import type { Env } from '../../shared/types';
import { detectAILocal, type LocalDetectionResult } from './ai-detection/local-detector';
// GPTZero targeting removed from humanizer - testing showed it added latency without improving results
// GPTZero is still used in AI Analyzer (ai-detection route) for detection purposes
import {
  enhanceBurstiness,
  replaceTellWords,
  replaceEmDashes,
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
 * Humanization request options
 */
export interface HumanizationOptions {
  intensity: HumanizationIntensity;
  voiceSamples?: string[];           // Optional user writing samples
  enableLLMPolish?: boolean;         // Default: true
  targetBurstiness?: number;         // Default: 60
  targetLexicalDiversity?: number;   // Default: 60
  model?: string;                    // LLM choice for polish pass (default: gpt-oss-20b)
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
 * @param options - Humanization options including model choice
 * @param userId - User ID (needed for LLM provider)
 */
export async function humanizeText(
  env: Env,
  text: string,
  options: HumanizationOptions,
  userId: string
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

  // ========================================
  // STAGE 1: Statistical Analysis (200ms)
  // ========================================
  const stage1Start = Date.now();
  const baselineDetection = await detectAILocal(trimmedText);
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
      polished = await llmPolishPass(env, voiceMatched, modelId, userId, options.intensity);

    } catch (error) {
      console.error('[Humanizer] LLM polish failed:', error);
      // Continue with naturalizer output
    }
  }

  stage4Time = Date.now() - stage4Start;

  // ========================================
  // STAGE 4.5: FINAL TELL-WORD SWEEP
  // ========================================
  // Run tell-word replacement one more time to catch any
  // that the LLM reintroduced or didn't fully eliminate
  const finalSweepStart = Date.now();
  let finalPolished = polished;

  // Check for remaining tell-words
  const preSweepDetection = await detectAILocal(finalPolished);
  if (preSweepDetection.detectedTellWords.length > 0) {
    console.log(`[Humanizer] Final sweep: ${preSweepDetection.detectedTellWords.length} tell-words remaining`);

    // Run aggressive replacement (95% rate)
    finalPolished = replaceTellWords(finalPolished, 'aggressive');

    // Also run em-dash replacement
    finalPolished = replaceEmDashes(finalPolished);

    console.log(`[Humanizer] Final sweep complete`);
  }

  // Always run em-dash replacement as final safety check
  finalPolished = replaceEmDashes(finalPolished);

  const finalSweepTime = Date.now() - finalSweepStart;
  console.log(`[Humanizer] Final sweep took ${finalSweepTime}ms`);

  // ========================================
  // STAGE 5: AI Detection Validation (1-2s)
  // ========================================
  const stage5Start = Date.now();
  const finalDetection = await detectAILocal(finalPolished);
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
  const finalText = hasMarkdownStructure && hasBlockMarkers(finalPolished)
    ? stripBlockMarkers(finalPolished)
    : finalPolished;

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
      afterLLMPolish: finalPolished !== voiceMatched ? finalPolished : undefined
    },
    voiceProfile,
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
    instructions: `Improve this text to sound more natural while keeping the original structure.

GUIDELINES:
- Add contractions where natural (don't, it's, we're, they'll)
- Soften overly formal phrases
- Replace obvious AI tell-words with natural alternatives
- Keep technical terms and specific facts exactly as written
- Minor sentence restructuring is OK if it improves flow
- Add occasional paragraph breaks where natural pauses occur

FORBIDDEN PUNCTUATION:
- NEVER use em-dashes (—) or en-dashes (–)
- Use commas, periods, or parentheses instead
- If you need a pause, use a comma
- If it's a new thought, start a new sentence`,
    wordTolerance: '±8%',
    temperature: 0.6
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
 *
 * SYNCHRONIZED with tell-words.ts detection dictionary (Dec 2025)
 * Categories: Academic/Formal, Transitional, Chatbot, Structural
 */
const FORBIDDEN_TELL_WORDS = [
  // Academic/Formal (weight 0.8)
  'delve', 'delving', 'tapestry', 'landscape', 'robust', 'leverage', 'leveraging',
  'navigate', 'navigating', 'realm', 'holistic', 'paradigm', 'multifaceted',
  'nuanced', 'pivotal', 'crucial', 'vital', 'comprehensive', 'intricate',
  'meticulously', 'underscores', 'quintessential', 'culminate', 'embark', 'endeavor',

  // Transitional (weight 0.6)
  'furthermore', 'moreover', 'consequently', 'additionally', 'subsequently',
  'nevertheless', 'nonetheless', 'henceforth', 'whereby', 'thereof',
  "it's worth noting", "it is worth noting", "it's important to",
  "it is important to", "in today's", "in the modern", "needless to say",
  "it goes without saying", "in light of", "with that said", "with this in mind",

  // Chatbot Phrases (weight 0.9 - HIGHEST!)
  'absolutely', 'great question', 'excellent question', "i'd be happy to",
  'happy to help', "i'm happy to help", 'let me help you', 'allow me to',
  "i'll walk you through", 'let me walk you through', 'let me explain',
  'let me break this down', "here's what you need to know", "here's the thing",
  'hope this helps', 'hope that helps', 'i hope this helps',
  'let me know if you', 'feel free to ask', 'feel free to',
  'if you have any questions', 'if you need anything else',
  'is there anything else', 'anything else i can help',
  "here's a breakdown", 'here are some', 'there are several',
  'first and foremost', 'last but not least',
  'in summary', 'to summarize', 'to recap', 'key takeaways',
  "you're absolutely right", "that's correct", 'exactly right', 'precisely',
  'spot on', 'excellent point', 'great point',

  // Structural (weight 0.6)
  'the following', 'as follows', 'listed below', 'outlined below',
  'firstly', 'secondly', 'thirdly', 'lastly', 'in conclusion', 'to conclude',
  'in closing', 'at the end of the day',

  // Punctuation (weight 0.7)
  '—',  // em-dash - NEVER use (known AI tell)
  '–'   // en-dash - NEVER use (known AI tell)
];

/**
 * Two-pass LLM configuration
 * Pass 1: Structure (sentence length variation, flow, paragraph breaks)
 * Pass 2: Style (word choice, tell-word elimination, natural voice)
 */
const TWO_PASS_CONFIG = {
  structure: {
    temperature: 0.6,
    focus: 'sentence structure and flow'
  },
  style: {
    temperature: 0.7,
    focus: 'word choice and natural voice'
  }
};

/**
 * Two-pass LLM polish - separates structure from style for better results
 *
 * Pass 1 (Structure): Focus on sentence length variation, flow, paragraph breaks
 * Pass 2 (Style): Focus on word choice, tell-word elimination, natural voice
 *
 * This approach prevents the LLM from trying to do too much at once, which
 * often results in mediocre improvements across all dimensions.
 */
async function twoPassLLMPolish(
  env: Env,
  text: string,
  modelId: string,
  userId: string,
  intensity: HumanizationIntensity
): Promise<{ result: string; tellWordsReintroduced: number }> {
  const wordCount = text.split(/\s+/).length;
  const hasMarkers = hasBlockMarkers(text);
  const intensityConfig = INTENSITY_PROMPTS[intensity];

  // Track original tell-words for monitoring
  const originalDetection = await detectAILocal(text);
  const originalTellWords = originalDetection.detectedTellWords.length;

  // Include block marker instructions if text has markers
  const markerInstructions = hasMarkers ? `\n\nFORMAT PRESERVATION:\n${getBlockMarkerInstructions()}\n` : '';

  const provider = await createLLMProvider(modelId, env, userId);

  // ========================================
  // PASS 1: STRUCTURE
  // ========================================
  const structurePrompt = `You are an editor improving text STRUCTURE only. Do NOT change word choices yet.

TASK: Restructure this text for better sentence variety and flow.

STRUCTURE GUIDELINES (${intensity} intensity):
${intensity === 'light' ? `- Make minimal changes to sentence structure
- Only split sentences that are obviously too long (40+ words)
- Keep paragraph structure intact` :
intensity === 'moderate' ? `- Vary sentence lengths: mix short (5-10 words) with medium (15-25 words)
- Break up any sentence over 30 words
- Add paragraph breaks where natural pauses occur
- Occasionally combine very short sentences` :
`- Aggressively vary sentence lengths: some very short (3-7 words), some medium (12-20 words)
- Never have two sentences of similar length in a row
- Break up walls of text with frequent paragraph breaks
- Start some sentences with "But", "And", "So" for variety`}

CRITICAL RULES:
1. Return ONLY the restructured text - no explanations
2. Keep the SAME words - only change punctuation and sentence breaks
3. Preserve all facts exactly
4. Stay within ${wordCount} words (±5%)
${markerInstructions}

ORIGINAL TEXT:
${text}

RESTRUCTURED TEXT:`;

  let structuredText = text;
  try {
    const structureResult = await provider.generateText(structurePrompt, {
      max_tokens: 4096,
      temperature: TWO_PASS_CONFIG.structure.temperature
    });

    structuredText = structureResult.trim() || text;
    structuredText = filterModelOutput(structuredText, modelId).content;

    // Clean up preambles
    structuredText = structuredText
      .replace(/^(Here's|Here is|Below is|The restructured|Restructured)[^:]*:\s*/i, '')
      .replace(/^(Sure|Certainly|Of course)[^.]*\.\s*/i, '')
      .trim();

    console.log(`[LLM Polish] Pass 1 (Structure) complete`);
  } catch (error) {
    console.error('[LLM Polish] Pass 1 failed, continuing with original:', error);
  }

  // ========================================
  // PASS 2: STYLE
  // ========================================
  const stylePrompt = `You are an editor improving text STYLE. The structure is already good.

TASK: ${intensityConfig.instructions}

STYLE GUIDELINES:
- Use contractions naturally (don't, can't, it's, they're)
- Replace formal words with simpler alternatives
- Add conversational touches where appropriate
- Make it sound like a real person wrote this

FORBIDDEN WORDS - NEVER use these AI tell-words:
${FORBIDDEN_TELL_WORDS.filter(w => w !== '—' && w !== '–').join(', ')}

FORBIDDEN PUNCTUATION:
- NEVER use em-dashes (—) or en-dashes (–)
- Use commas, periods, or parentheses instead

CRITICAL RULES:
1. Return ONLY the styled text - no explanations, no preambles
2. Keep the sentence structure mostly as-is (it's already been optimized)
3. Preserve all facts, names, numbers exactly
4. Stay within ${wordCount} words (${intensityConfig.wordTolerance})

TEXT TO STYLE:
${structuredText}

STYLED TEXT:`;

  let styledText = structuredText;
  try {
    const styleResult = await provider.generateText(stylePrompt, {
      max_tokens: 4096,
      temperature: TWO_PASS_CONFIG.style.temperature
    });

    styledText = styleResult.trim() || structuredText;
    styledText = filterModelOutput(styledText, modelId).content;

    // Clean up preambles
    styledText = styledText
      .replace(/^(Here's|Here is|Below is|The styled|Styled)[^:]*:\s*/i, '')
      .replace(/^(Sure|Certainly|Of course)[^.]*\.\s*/i, '')
      .trim();

    console.log(`[LLM Polish] Pass 2 (Style) complete`);
  } catch (error) {
    console.error('[LLM Polish] Pass 2 failed, using structure pass result:', error);
  }

  // ========================================
  // MONITORING: Check for tell-word reintroduction
  // ========================================
  const finalDetection = await detectAILocal(styledText);
  const finalTellWords = finalDetection.detectedTellWords.length;
  const tellWordsReintroduced = Math.max(0, finalTellWords - originalTellWords);

  if (tellWordsReintroduced > 0) {
    console.log(`[LLM Polish] WARNING: Tell-words reintroduced: ${tellWordsReintroduced}`);
    console.log(`[LLM Polish]   Original: ${originalTellWords}, Final: ${finalTellWords}`);
    console.log(`[LLM Polish]   Reintroduced words: ${finalDetection.detectedTellWords.filter(w =>
      !originalDetection.detectedTellWords.some(o => o.word === w.word)
    ).map(w => w.word).join(', ')}`);

    // Apply post-processing to strip reintroduced tell-words
    styledText = postProcessTellWords(styledText, finalDetection.detectedTellWords.map(w => w.word));
  }

  return { result: styledText, tellWordsReintroduced };
}

/**
 * Post-process to strip tell-words the LLM reintroduced
 * This is a safety net - we'd prefer the LLM not use them in the first place
 */
function postProcessTellWords(text: string, detectedTellWords: string[]): string {
  let result = text;

  // Import the replacement dictionary from text-naturalizer
  const simpleReplacements: Record<string, string> = {
    'furthermore': 'also',
    'moreover': 'also',
    'consequently': 'so',
    'additionally': 'also',
    'subsequently': 'then',
    'nevertheless': 'still',
    'nonetheless': 'still',
    'comprehensive': 'complete',
    'crucial': 'important',
    'vital': 'important',
    'pivotal': 'key',
    'intricate': 'complex',
    'nuanced': 'subtle',
    'multifaceted': 'complex',
    'holistic': 'complete',
    'paradigm': 'model',
    'robust': 'strong',
    'leverage': 'use',
    'leveraging': 'using',
    'navigate': 'handle',
    'navigating': 'handling',
    'realm': 'area',
    'landscape': 'field',
    'tapestry': 'mix',
    'delve': 'explore'
  };

  for (const word of detectedTellWords) {
    const lowerWord = word.toLowerCase();
    const replacement = simpleReplacements[lowerWord];

    if (replacement) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      result = result.replace(regex, (match) => {
        if (match.charAt(0) === match.charAt(0).toUpperCase()) {
          return replacement.charAt(0).toUpperCase() + replacement.slice(1);
        }
        return replacement;
      });
    }
  }

  return result;
}

/**
 * LLM polish pass - with intensity-aware prompts and improved instructions
 * Now uses two-pass approach for better results
 *
 * @param env - Cloudflare environment bindings
 * @param text - Text to polish
 * @param modelId - Model to use for polish
 * @param userId - User ID for LLM provider
 * @param intensity - Humanization intensity level
 */
async function llmPolishPass(
  env: Env,
  text: string,
  modelId: string,
  userId: string,
  intensity: HumanizationIntensity
): Promise<string> {
  try {
    // Use two-pass approach for better results
    const { result, tellWordsReintroduced } = await twoPassLLMPolish(
      env, text, modelId, userId, intensity
    );

    if (tellWordsReintroduced > 0) {
      console.log(`[LLM Polish] Note: ${tellWordsReintroduced} tell-words were reintroduced and stripped`);
    }

    return result;
  } catch (error) {
    console.error('[LLM Polish] Two-pass failed, falling back to original:', error);
    return text;
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
