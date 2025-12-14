/**
 * Computer Humanizer - Stage 3: Voice Matching
 * Applies user's voice profile to the text
 */

import { extractVoiceProfile, applyVoiceProfile } from '../../voice-profile';
import type { HumanizationContext } from '../types';

/**
 * Stage 3: Apply user voice matching
 * ~1-2s - No LLM calls (uses rule-based profile matching)
 */
export async function runVoiceMatchStage(
  ctx: HumanizationContext
): Promise<HumanizationContext> {
  const startTime = Date.now();

  // Only run if voice samples are provided
  if (ctx.options.voiceSamples && ctx.options.voiceSamples.length > 0) {
    try {
      // Extract voice profile from samples
      const profile = extractVoiceProfile(ctx.options.voiceSamples);
      ctx.voiceProfile = profile;

      // Apply profile to current text
      ctx.currentText = applyVoiceProfile(ctx.currentText, profile);

    } catch (error) {
      // Continue without voice matching on error
      console.warn('[Voice Match] Failed to apply voice profile:', error);
    }
  }

  ctx.timings.stage3 = Date.now() - startTime;

  return ctx;
}
