/**
 * Computer Humanizer - Stage 2: Rule-Based Naturalizer
 * Applies statistical transformations to reduce AI detection signals
 */

import {
  enhanceBurstiness,
  replaceTellWords,
  normalizeLexicalDiversity,
  addConversationalElements
} from '../../text-naturalizer';
import type { HumanizationContext } from '../types';

/**
 * Stage 2: Apply rule-based naturalizing transformations
 * ~500ms - No LLM calls
 */
export async function runNaturalizerStage(
  ctx: HumanizationContext
): Promise<HumanizationContext> {
  const startTime = Date.now();

  let text = ctx.currentText;

  // Step 2.1: Enhance burstiness (sentence length variation)
  text = enhanceBurstiness(
    text,
    ctx.options.targetBurstiness || 60
  );

  // Step 2.2: Replace tell-words
  text = replaceTellWords(
    text,
    ctx.options.intensity
  );

  // Step 2.3: Normalize lexical diversity
  text = normalizeLexicalDiversity(
    text,
    ctx.options.targetLexicalDiversity || 60
  );

  // Step 2.4: Add conversational elements
  text = addConversationalElements(text);

  ctx.currentText = text;
  ctx.timings.stage2 = Date.now() - startTime;

  return ctx;
}
