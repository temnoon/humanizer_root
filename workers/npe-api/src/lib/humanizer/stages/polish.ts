/**
 * Computer Humanizer - Stage 4: LLM Polish
 * Two-pass LLM refinement with optional SIC constraint guidance
 */

import { detectAILocal } from '../../../services/ai-detection/local-detector';
import { filterModelOutput } from '../../../services/model-vetting';
import { createLLMProvider } from '../../../services/llm-providers';
import { hasBlockMarkers, getBlockMarkerInstructions } from '../../block-markers';
import {
  INTENSITY_PROMPTS,
  FORBIDDEN_TELL_WORDS,
  TWO_PASS_CONFIG,
  TELL_WORD_REPLACEMENTS
} from '../prompts';
import type { HumanizationContext, HumanizationIntensity } from '../types';
import type { Env } from '../../../../shared/types';

/**
 * Stage 4: Two-pass LLM polish with optional constraint guidance
 * ~2-5s - 2 LLM calls
 */
export async function runPolishStage(
  ctx: HumanizationContext
): Promise<HumanizationContext> {
  const startTime = Date.now();

  // Skip if LLM polish is disabled
  if (ctx.options.enableLLMPolish === false) {
    ctx.timings.stage4 = Date.now() - startTime;
    return ctx;
  }

  try {
    const { result, tellWordsReintroduced } = await twoPassLLMPolish(
      ctx.env as Env,
      ctx.currentText,
      ctx.modelId,
      ctx.userId,
      ctx.options.intensity,
      ctx.constraintGuidance  // SIC constraint guidance (if available)
    );

    if (tellWordsReintroduced > 0) {
      console.log(`[LLM Polish] Note: ${tellWordsReintroduced} tell-words were reintroduced and stripped`);
    }

    ctx.currentText = result;

  } catch (error) {
    console.error('[LLM Polish] Two-pass failed, continuing with previous text:', error);
  }

  ctx.timings.stage4 = Date.now() - startTime;

  return ctx;
}

/**
 * Two-pass LLM polish - separates structure from style for better results
 *
 * Pass 1 (Structure): Focus on sentence length variation, flow, paragraph breaks
 * Pass 2 (Style): Focus on word choice, tell-word elimination, natural voice
 *
 * When constraintGuidance is provided (from SIC analysis), it's injected into
 * Pass 2 to guide the LLM toward adding missing human authorship signals.
 */
async function twoPassLLMPolish(
  env: Env,
  text: string,
  modelId: string,
  userId: string,
  intensity: HumanizationIntensity,
  constraintGuidance?: string
): Promise<{ result: string; tellWordsReintroduced: number }> {
  const wordCount = text.split(/\s+/).length;
  const hasMarkers = hasBlockMarkers(text);
  const intensityConfig = INTENSITY_PROMPTS[intensity];

  // Track original tell-words for monitoring
  const originalDetection = await detectAILocal(text);
  const originalTellWords = originalDetection.detectedTellWords.length;

  // Include block marker instructions if text has markers
  const markerInstructions = hasMarkers
    ? `\n\nFORMAT PRESERVATION:\n${getBlockMarkerInstructions()}\n`
    : '';

  const provider = await createLLMProvider(modelId, env, userId);

  // ========================================
  // PASS 1: STRUCTURE
  // ========================================
  const structurePrompt = buildStructurePrompt(
    intensity,
    wordCount,
    markerInstructions
  );

  let structuredText = text;
  try {
    const structureResult = await provider.generateText(structurePrompt + `\n\nORIGINAL TEXT:\n${text}\n\nRESTRUCTURED TEXT:`, {
      max_tokens: 4096,
      temperature: TWO_PASS_CONFIG.structure.temperature
    });

    structuredText = structureResult.trim() || text;
    structuredText = filterModelOutput(structuredText, modelId).content;
    structuredText = cleanPreambles(structuredText);

    console.log(`[LLM Polish] Pass 1 (Structure) complete`);
  } catch (error) {
    console.error('[LLM Polish] Pass 1 failed, continuing with original:', error);
  }

  // ========================================
  // PASS 2: STYLE (with optional constraint guidance)
  // ========================================
  const stylePrompt = buildStylePrompt(
    intensityConfig,
    wordCount,
    constraintGuidance
  );

  let styledText = structuredText;
  try {
    const styleResult = await provider.generateText(stylePrompt + `\n\nTEXT TO STYLE:\n${structuredText}\n\nSTYLED TEXT:`, {
      max_tokens: 4096,
      temperature: TWO_PASS_CONFIG.style.temperature
    });

    styledText = styleResult.trim() || structuredText;
    styledText = filterModelOutput(styledText, modelId).content;
    styledText = cleanPreambles(styledText);

    console.log(`[LLM Polish] Pass 2 (Style) complete`);
  } catch (error) {
    console.error('[LLM Polish] Pass 2 failed, using structure pass result:', error);
  }

  // ========================================
  // POST-PROCESSING: Check for tell-word reintroduction
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
 * Build structure pass prompt
 */
function buildStructurePrompt(
  intensity: HumanizationIntensity,
  wordCount: number,
  markerInstructions: string
): string {
  const structureGuidelines = intensity === 'light'
    ? `- Make minimal changes to sentence structure
- Only split sentences that are obviously too long (40+ words)
- Keep paragraph structure intact`
    : intensity === 'moderate'
    ? `- Vary sentence lengths: mix short (5-10 words) with medium (15-25 words)
- Break up any sentence over 30 words
- Add paragraph breaks where natural pauses occur
- Occasionally combine very short sentences`
    : `- Aggressively vary sentence lengths: some very short (3-7 words), some medium (12-20 words)
- Never have two sentences of similar length in a row
- Break up walls of text with frequent paragraph breaks
- Start some sentences with "But", "And", "So" for variety`;

  return `You are an editor improving text STRUCTURE only. Do NOT change word choices yet.

TASK: Restructure this text for better sentence variety and flow.

STRUCTURE GUIDELINES (${intensity} intensity):
${structureGuidelines}

CRITICAL RULES:
1. Return ONLY the restructured text - no explanations
2. Keep the SAME words - only change punctuation and sentence breaks
3. Preserve all facts exactly
4. Stay within ${wordCount} words (±5%)
${markerInstructions}`;
}

/**
 * Build style pass prompt with optional constraint guidance
 */
function buildStylePrompt(
  intensityConfig: { instructions: string; wordTolerance: string },
  wordCount: number,
  constraintGuidance?: string
): string {
  // Base style instructions
  let prompt = `You are an editor improving text STYLE. The structure is already good.

TASK: ${intensityConfig.instructions}

STYLE GUIDELINES:
- Use contractions naturally (don't, can't, it's, they're)
- Replace formal words with simpler alternatives
- Add conversational touches where appropriate
- Make it sound like a real person wrote this`;

  // Add SIC constraint guidance if provided
  if (constraintGuidance) {
    prompt += `

CONSTRAINT ENHANCEMENT:
The analysis identified missing human authorship signals. Apply these targeted improvements:
${constraintGuidance}`;
  }

  // Add forbidden words and rules
  prompt += `

FORBIDDEN WORDS - NEVER use these AI tell-words:
${FORBIDDEN_TELL_WORDS.filter(w => w !== '—' && w !== '–').join(', ')}

FORBIDDEN PUNCTUATION:
- NEVER use em-dashes (—) or en-dashes (–)
- Use commas, periods, or parentheses instead

CRITICAL RULES:
1. Return ONLY the styled text - no explanations, no preambles
2. Keep the sentence structure mostly as-is (it's already been optimized)
3. Preserve all facts, names, numbers exactly
4. Stay within ${wordCount} words (${intensityConfig.wordTolerance})`;

  return prompt;
}

/**
 * Clean LLM preambles from output
 */
function cleanPreambles(text: string): string {
  return text
    .replace(/^(Here's|Here is|Below is|The restructured|Restructured|The styled|Styled)[^:]*:\s*/i, '')
    .replace(/^(Sure|Certainly|Of course)[^.]*\.\s*/i, '')
    .trim();
}

/**
 * Post-process to strip tell-words the LLM reintroduced
 */
function postProcessTellWords(text: string, detectedTellWords: string[]): string {
  let result = text;

  for (const word of detectedTellWords) {
    const lowerWord = word.toLowerCase();
    const replacement = TELL_WORD_REPLACEMENTS[lowerWord];

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
