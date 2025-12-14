/**
 * Computer Humanizer - Stage 0: SIC Pre-Analysis
 * Runs Subjective Intentional Constraint analysis to identify constraint gaps
 * and generate guidance for the humanization pipeline.
 *
 * This stage is OPTIONAL (paid tiers only) and adds ~15-30s to processing.
 * When enabled, it provides:
 * 1. Baseline SIC score of input text
 * 2. Identification of low-scoring constraint features
 * 3. Targeted guidance for Stage 4 (LLM Polish) to inject missing signals
 */

import type { HumanizationContext } from '../types';
import type { Env } from '../../../../shared/types';
import { SicEngine } from '../../../services/sic/engine';
import { NpeLlmAdapter } from '../../../services/sic/npeLlmAdapter';
import {
  identifyConstraintGaps,
  buildConstraintGuidance,
  summarizeGaps
} from '../../constraint-guidance';

/**
 * Stage 0: SIC Pre-Analysis (paid tiers only)
 * ~15-30s - 2+ LLM calls
 *
 * Runs full SIC analysis on input text to identify constraint gaps,
 * then generates targeted guidance for subsequent stages.
 */
export async function runSicPreAnalysisStage(
  ctx: HumanizationContext
): Promise<HumanizationContext> {
  // Skip if SIC analysis not enabled
  if (!ctx.options.enableSicAnalysis) {
    return ctx;
  }

  // Skip for free tier (even if they somehow enabled it)
  if (ctx.userTier === 'free') {
    console.log('[SIC Pre-Analysis] Skipped: free tier');
    return ctx;
  }

  const startTime = Date.now();
  console.log('[SIC Pre-Analysis] Starting constraint analysis...');

  try {
    // Create SIC engine with NPE LLM adapter
    const adapter = new NpeLlmAdapter(ctx.env as Env, ctx.userId);
    const sicEngine = new SicEngine(adapter);

    // Run SIC analysis
    const sicResult = await sicEngine.sic(ctx.originalText, {
      // Let SIC detect genre automatically
    });

    ctx.sicPreAnalysis = sicResult;

    // Identify constraint gaps
    const gaps = identifyConstraintGaps(sicResult);
    ctx.constraintGaps = gaps;

    // Generate guidance for Stage 4
    if (gaps.length > 0) {
      const guidance = buildConstraintGuidance(gaps, sicResult);
      ctx.constraintGuidance = guidance;

      console.log(`[SIC Pre-Analysis] ${summarizeGaps(gaps)}`);
      console.log(`[SIC Pre-Analysis] Baseline SIC score: ${sicResult.sicScore}`);
      console.log(`[SIC Pre-Analysis] AI probability: ${(sicResult.aiProbability * 100).toFixed(1)}%`);
    } else {
      console.log(`[SIC Pre-Analysis] No significant gaps (SIC score: ${sicResult.sicScore})`);
    }

  } catch (error) {
    console.error('[SIC Pre-Analysis] Failed:', error);
    // Continue without SIC - don't block the pipeline
  }

  ctx.timings.stage0 = Date.now() - startTime;
  console.log(`[SIC Pre-Analysis] Complete in ${ctx.timings.stage0}ms`);

  return ctx;
}

/**
 * Check if user tier allows SIC analysis
 */
export function canUseSicAnalysis(userTier?: string): boolean {
  if (!userTier) return false;
  return ['pro', 'premium', 'admin'].includes(userTier.toLowerCase());
}

/**
 * Get SIC analysis status message for API response
 */
export function getSicAnalysisStatus(
  enabled: boolean,
  userTier?: string
): { available: boolean; reason?: string } {
  if (!enabled) {
    return { available: true };  // Not requested, so "available" to enable
  }

  if (!canUseSicAnalysis(userTier)) {
    return {
      available: false,
      reason: 'SIC analysis requires a paid subscription (Pro or Premium)'
    };
  }

  return { available: true };
}
