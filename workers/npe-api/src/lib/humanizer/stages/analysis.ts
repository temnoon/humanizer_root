/**
 * Computer Humanizer - Stage 1: Statistical Analysis
 * Analyzes input text for AI detection metrics
 */

import { detectAILocal } from '../../../services/ai-detection/local-detector';
import type { HumanizationContext } from '../types';

/**
 * Stage 1: Run statistical analysis on input text
 * ~200ms - No LLM calls
 */
export async function runAnalysisStage(
  ctx: HumanizationContext
): Promise<HumanizationContext> {
  const startTime = Date.now();

  // Run local AI detection
  const baselineDetection = await detectAILocal(ctx.currentText);

  ctx.timings.stage1 = Date.now() - startTime;

  // Store baseline in context for later comparison
  (ctx as { baselineDetection?: typeof baselineDetection }).baselineDetection = baselineDetection;

  return ctx;
}

/**
 * Analyze text to determine if it needs humanization
 * Utility function for pre-flight checks
 */
export async function analyzeForHumanization(text: string): Promise<{
  needsHumanization: boolean;
  recommendation: 'light' | 'moderate' | 'aggressive';
  currentMetrics: Awaited<ReturnType<typeof detectAILocal>>;
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
