/**
 * Computer Humanizer - Stage 5: Validation
 * Final validation with local detection and optional SIC post-analysis
 */

import { detectAILocal, type LocalDetectionResult } from '../../../services/ai-detection/local-detector';
import { replaceEmDashes, replaceTellWords } from '../../text-naturalizer';
import type { HumanizationContext, SicAnalysisResult } from '../types';
import type { SicResult, SicFeatureKey } from '../../../services/sic/types';

/**
 * Stage 5: Run final validation
 * ~1-2s for local detection
 * +15-30s if SIC post-analysis is enabled
 */
export async function runValidationStage(
  ctx: HumanizationContext
): Promise<HumanizationContext> {
  const startTime = Date.now();

  // First do a final tell-word sweep
  ctx.currentText = await finalTellWordSweep(ctx.currentText);

  // Run local AI detection
  const finalDetection = await detectAILocal(ctx.currentText);

  // Store final detection in context
  (ctx as { finalDetection?: LocalDetectionResult }).finalDetection = finalDetection;

  ctx.timings.stage5 = Date.now() - startTime;

  return ctx;
}

/**
 * Run SIC post-validation (called separately after main validation)
 * This is expensive (~15-30s) so it's optional and async
 */
export async function runSicPostValidation(
  ctx: HumanizationContext,
  sicEngine: { sic: (text: string, options?: { genreHint?: string }) => Promise<SicResult> }
): Promise<SicAnalysisResult | undefined> {
  if (!ctx.sicPreAnalysis || !ctx.options.enableSicAnalysis) {
    return undefined;
  }

  const startTime = Date.now();

  try {
    // Run SIC on final output
    const finalSic = await sicEngine.sic(ctx.currentText, {
      genreHint: ctx.sicPreAnalysis.genre
    });

    // Calculate improvement
    const improvement = calculateSicImprovement(ctx.sicPreAnalysis, finalSic);

    console.log(`[SIC Post-Validation] Complete in ${Date.now() - startTime}ms`);
    console.log(`[SIC Post-Validation] Score change: ${ctx.sicPreAnalysis.sicScore} → ${finalSic.sicScore} (${improvement.sicScoreChange >= 0 ? '+' : ''}${improvement.sicScoreChange})`);

    return {
      baseline: ctx.sicPreAnalysis,
      final: finalSic,
      constraintGapsIdentified: ctx.constraintGaps || [],
      constraintImprovement: improvement
    };

  } catch (error) {
    console.error('[SIC Post-Validation] Failed:', error);

    // Return baseline-only result
    return {
      baseline: ctx.sicPreAnalysis,
      constraintGapsIdentified: ctx.constraintGaps || []
    };
  }
}

/**
 * Final tell-word sweep - catches any remaining or reintroduced tell-words
 */
async function finalTellWordSweep(text: string): Promise<string> {
  const startTime = Date.now();

  const preSweepDetection = await detectAILocal(text);
  let result = text;

  if (preSweepDetection.detectedTellWords.length > 0) {
    console.log(`[Validation] Final sweep: ${preSweepDetection.detectedTellWords.length} tell-words remaining`);

    // Run aggressive replacement (95% rate)
    result = replaceTellWords(result, 'aggressive');

    // Also run em-dash replacement
    result = replaceEmDashes(result);

    console.log(`[Validation] Final sweep complete`);
  }

  // Always run em-dash replacement as final safety check
  result = replaceEmDashes(result);

  console.log(`[Validation] Final sweep took ${Date.now() - startTime}ms`);

  return result;
}

/**
 * Calculate SIC improvement between baseline and final
 */
function calculateSicImprovement(
  baseline: SicResult,
  final: SicResult
): {
  sicScoreChange: number;
  featuresImproved: string[];
  featuresDeclined: string[];
} {
  const sicScoreChange = final.sicScore - baseline.sicScore;

  const featuresImproved: string[] = [];
  const featuresDeclined: string[] = [];

  // Compare each feature
  const featureKeys: SicFeatureKey[] = [
    'commitment_irreversibility',
    'epistemic_risk_uncertainty',
    'time_pressure_tradeoffs',
    'situatedness_body_social',
    'scar_tissue_specificity',
    'bounded_viewpoint',
    'anti_smoothing'
  ];

  for (const key of featureKeys) {
    const baselineScore = baseline.features[key]?.score ?? 50;
    const finalScore = final.features[key]?.score ?? 50;
    const delta = finalScore - baselineScore;

    // Significant improvement = +10 or more
    if (delta >= 10) {
      featuresImproved.push(key);
    }
    // Significant decline = -10 or more
    if (delta <= -10) {
      featuresDeclined.push(key);
    }
  }

  return {
    sicScoreChange,
    featuresImproved,
    featuresDeclined
  };
}
