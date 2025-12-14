/**
 * Computer Humanizer Service
 *
 * Main orchestration for AI text humanization pipeline.
 * 6-Stage Process (with optional SIC):
 *   Stage 0: SIC Pre-Analysis (paid tiers, optional)
 *   Stage 1: Statistical Analysis
 *   Stage 2: Rule-Based Naturalizer
 *   Stage 3: Voice Matching
 *   Stage 4: LLM Polish (with constraint guidance if SIC enabled)
 *   Stage 5: Validation (with optional SIC post-check)
 *
 * See lib/humanizer/ for stage implementations.
 */

import type { Env } from '../../shared/types';
import { detectAILocal, type LocalDetectionResult } from './ai-detection/local-detector';
import { insertBlockMarkers, stripBlockMarkers, hasBlockMarkers } from '../lib/block-markers';
import { isModelVetted } from './model-vetting';
import { getModelForUseCase, detectEnvironment, hasCloudflareAI, isModelCompatibleWithEnvironment } from '../config/llm-models';
import { selectModel, type ModelInfo } from './model-selector';
import { SicEngine } from './sic/engine';
import { NpeLlmAdapter } from './sic/npeLlmAdapter';

// Import modular components
import type {
  HumanizationOptions,
  HumanizationResult,
  HumanizationContext
} from '../lib/humanizer/types';
import {
  runSicPreAnalysisStage,
  runAnalysisStage,
  runNaturalizerStage,
  runVoiceMatchStage,
  runPolishStage,
  runValidationStage,
  runSicPostValidation,
  analyzeForHumanization
} from '../lib/humanizer';

// Re-export types for external consumers
export type { HumanizationIntensity, HumanizationOptions, HumanizationResult } from '../lib/humanizer/types';
export { analyzeForHumanization } from '../lib/humanizer';

/**
 * Main humanization pipeline
 * Transforms AI-generated text to reduce AI detection while preserving meaning
 *
 * @param env - Cloudflare environment bindings
 * @param text - Text to humanize
 * @param options - Humanization options including model choice
 * @param userId - User ID (needed for LLM provider)
 * @param userTier - Optional user tier for model selection (free, pro, premium, admin)
 */
export async function humanizeText(
  env: Env,
  text: string,
  options: HumanizationOptions,
  userId: string,
  userTier?: string
): Promise<HumanizationResult> {
  const totalStartTime = Date.now();

  // ========================================
  // INPUT VALIDATION
  // ========================================
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  const trimmedText = text.trim();
  const wordCount = trimmedText.split(/\s+/).length;

  if (wordCount < 20) {
    throw new Error('Text must be at least 20 words for humanization');
  }

  // ========================================
  // MODEL SELECTION
  // ========================================
  const modelId = await resolveModel(env, userId, userTier, options.model);
  console.log(`[Humanizer] Model: ${modelId}`);

  // ========================================
  // INITIALIZE CONTEXT
  // ========================================
  const hasMarkdownStructure = /^#+\s|^\s*[-*+]\s|^\s*\d+\.\s|^>/m.test(trimmedText);
  const markedInput = hasMarkdownStructure ? insertBlockMarkers(trimmedText) : trimmedText;

  const ctx: HumanizationContext = {
    env,
    userId,
    userTier,
    options,
    modelId,
    originalText: trimmedText,
    currentText: markedInput,
    hasMarkdownStructure,
    timings: {}
  };

  // ========================================
  // STAGE 0: SIC Pre-Analysis (optional, paid tiers)
  // ========================================
  await runSicPreAnalysisStage(ctx);

  // ========================================
  // STAGE 1: Statistical Analysis
  // ========================================
  await runAnalysisStage(ctx);
  const baselineDetection = (ctx as { baselineDetection?: LocalDetectionResult }).baselineDetection!;

  // ========================================
  // STAGE 2: Rule-Based Naturalizer
  // ========================================
  await runNaturalizerStage(ctx);
  const afterNaturalizer = ctx.currentText;

  // ========================================
  // STAGE 3: Voice Matching
  // ========================================
  await runVoiceMatchStage(ctx);
  const afterVoiceMatch = ctx.currentText !== afterNaturalizer ? ctx.currentText : undefined;

  // ========================================
  // STAGE 4: LLM Polish (with constraint guidance if SIC enabled)
  // ========================================
  await runPolishStage(ctx);
  const afterLLMPolish = ctx.currentText !== (afterVoiceMatch || afterNaturalizer) ? ctx.currentText : undefined;

  // ========================================
  // STAGE 5: Validation
  // ========================================
  await runValidationStage(ctx);
  const finalDetection = (ctx as { finalDetection?: LocalDetectionResult }).finalDetection!;

  // ========================================
  // SIC POST-VALIDATION (if enabled)
  // ========================================
  let sicAnalysis;
  if (options.enableSicAnalysis && ctx.sicPreAnalysis) {
    const adapter = new NpeLlmAdapter(env, userId);
    const sicEngine = new SicEngine(adapter);
    sicAnalysis = await runSicPostValidation(ctx, sicEngine);
  }

  // ========================================
  // FORMAT PRESERVATION: Strip block markers
  // ========================================
  const finalText = hasMarkdownStructure && hasBlockMarkers(ctx.currentText)
    ? stripBlockMarkers(ctx.currentText)
    : ctx.currentText;

  // ========================================
  // BUILD RESULT
  // ========================================
  const improvement = {
    aiConfidenceDrop: baselineDetection.confidence - finalDetection.confidence,
    burstinessIncrease: finalDetection.signals.burstiness - baselineDetection.signals.burstiness,
    tellWordsRemoved: baselineDetection.detectedTellWords.length - finalDetection.detectedTellWords.length,
    lexicalDiversityChange: finalDetection.signals.lexicalDiversity - baselineDetection.signals.lexicalDiversity
  };

  const totalTime = Date.now() - totalStartTime;

  return {
    humanizedText: finalText,
    baseline: { detection: baselineDetection },
    final: { detection: finalDetection },
    improvement,
    stages: {
      original: trimmedText,
      afterSicAnalysis: ctx.sicPreAnalysis ? trimmedText : undefined,
      afterNaturalizer,
      afterVoiceMatch,
      afterLLMPolish
    },
    voiceProfile: ctx.voiceProfile,
    modelUsed: options.enableLLMPolish !== false ? modelId : undefined,
    sicAnalysis,
    processing: {
      totalDurationMs: totalTime,
      stage0DurationMs: ctx.timings.stage0,
      stage1DurationMs: ctx.timings.stage1 || 0,
      stage2DurationMs: ctx.timings.stage2 || 0,
      stage3DurationMs: ctx.timings.stage3 || 0,
      stage4DurationMs: ctx.timings.stage4 || 0,
      stage5DurationMs: ctx.timings.stage5 || 0
    }
  };
}

/**
 * Resolve which model to use based on user tier and preferences
 */
async function resolveModel(
  env: Env,
  userId: string,
  userTier?: string,
  requestedModel?: string
): Promise<string> {
  const environment = detectEnvironment(hasCloudflareAI(env));

  // Try new registry-based selection if userTier is provided
  if (userTier) {
    try {
      const selection = await selectModel(env, userId, userTier, 'general');
      console.log(`[Humanizer] Model selected via registry: ${selection.model.modelId} (${selection.reason})`);
      return selection.model.modelId;
    } catch (err) {
      console.warn(`[Humanizer] Registry selection failed, using legacy: ${err}`);
    }
  }

  // User provided a model directly - validate it
  if (requestedModel) {
    if (!isModelVetted(requestedModel)) {
      throw new Error(`Model ${requestedModel} is not vetted for use. Check model-vetting/profiles.ts`);
    }
    if (!isModelCompatibleWithEnvironment(requestedModel, environment)) {
      console.warn(`[Humanizer] User selected cloud model ${requestedModel} but environment is ${environment}. Falling back to default.`);
      return getModelForUseCase('general', environment);
    }
    return requestedModel;
  }

  // Legacy fallback
  return getModelForUseCase('general', environment);
}
