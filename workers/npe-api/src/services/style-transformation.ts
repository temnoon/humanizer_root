// Style Transformation Service
// Single-dimension transformation: Writing Patterns only
// Preserves content and voice while changing formality, structure, and lexical choices

import type { Env, NPEStyle } from '../../shared/types';
import { createLLMProvider, type LLMProvider } from './llm-providers';
import { detectAILocal, type LocalDetectionResult } from './ai-detection/local-detector';

export interface StyleTransformationOptions {
  enableValidation?: boolean;  // Default: true - run AI detection
  preserveLength?: boolean;     // Default: true - keep similar length
}

export interface StyleTransformationResult {
  // Final output
  transformedText: string;

  // Validation metrics (if enabled)
  baseline?: {
    detection: LocalDetectionResult;
  };
  final?: {
    detection: LocalDetectionResult;
  };

  // Improvement stats
  improvement?: {
    aiConfidenceDrop: number;
    burstinessIncrease: number;
  };

  // Processing metadata
  processing: {
    totalDurationMs: number;
    validationDurationMs: number;
  };

  // Transformation record ID
  transformationId: string;
}

/**
 * StyleTransformationService
 *
 * Transforms writing patterns while preserving:
 * - Content (what is said)
 * - Narrative voice (who is speaking)
 * - Universe/setting (where it happens)
 *
 * Changes:
 * - Sentence structure (length, complexity, variation)
 * - Formality level (academic → casual, etc.)
 * - Lexical features (word choice, metaphor density)
 * - Rhetorical devices (parallelism, repetition, etc.)
 */
export class StyleTransformationService {
  private llmProvider: LLMProvider | null = null;

  constructor(
    private env: Env,
    private style: NPEStyle,
    private userId: string,
    private modelId: string = '@cf/meta/llama-3.1-8b-instruct'
  ) {}

  /**
   * Transform writing style while preserving content and voice
   */
  async transform(
    sourceText: string,
    options: StyleTransformationOptions = {}
  ): Promise<StyleTransformationResult> {
    const totalStartTime = Date.now();

    // Validate input
    if (!sourceText || sourceText.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    const trimmedText = sourceText.trim();
    const wordCount = trimmedText.split(/\s+/).length;

    if (wordCount < 20) {
      throw new Error('Text must be at least 20 words for transformation');
    }

    // Set defaults
    const enableValidation = options.enableValidation !== false;
    const preserveLength = options.preserveLength !== false;

    let baseline: LocalDetectionResult | undefined;
    let final: LocalDetectionResult | undefined;
    let validationTime = 0;

    // Stage 1: Baseline metrics (if validation enabled)
    if (enableValidation) {
      const validationStart = Date.now();
      baseline = await detectAILocal(trimmedText);
      validationTime += Date.now() - validationStart;
    }

    // Stage 2: Transform style
    this.llmProvider = await createLLMProvider(this.modelId, this.env, this.userId);

    const transformedText = await this.applyStyle(trimmedText, preserveLength);

    // Stage 3: Final validation (if enabled)
    if (enableValidation) {
      const validationStart = Date.now();
      final = await detectAILocal(transformedText);
      validationTime += Date.now() - validationStart;
    }

    const totalDuration = Date.now() - totalStartTime;

    // Calculate improvement
    let improvement;
    if (baseline && final) {
      improvement = {
        aiConfidenceDrop: baseline.aiConfidence - final.aiConfidence,
        burstinessIncrease: final.burstinessScore - baseline.burstinessScore
      };
    }

    // Store transformation in database
    const transformationId = crypto.randomUUID();

    await this.env.DB.prepare(`
      INSERT INTO transformations (id, user_id, type, source_text, result_text, parameters, created_at)
      VALUES (?, ?, 'style', ?, ?, ?, ?)
    `).bind(
      transformationId,
      this.userId,
      sourceText,
      transformedText,
      JSON.stringify({
        style: this.style.name,
        model: this.modelId,
        preserveLength,
        enableValidation,
        baseline_metrics: baseline,
        final_metrics: final
      }),
      Date.now()
    ).run();

    return {
      transformedText,
      baseline: baseline ? { detection: baseline } : undefined,
      final: final ? { detection: final } : undefined,
      improvement,
      processing: {
        totalDurationMs: totalDuration,
        validationDurationMs: validationTime
      },
      transformationId
    };
  }

  /**
   * Apply writing style while preserving content and voice
   */
  private async applyStyle(text: string, preserveLength: boolean): Promise<string> {
    if (!this.llmProvider) {
      throw new Error('LLM provider not initialized');
    }

    const lengthGuidance = preserveLength
      ? `IMPORTANT: Keep the output approximately the same length as the input (around ${text.split(/\s+/).length} words).`
      : '';

    const prompt = `You are a writing style transformation specialist.

Your task is to rewrite the following text in "${this.style.name}" style:

${this.style.style_prompt}

CRITICAL RULES:
1. PRESERVE ALL CONTENT - Don't add new ideas or remove existing ones
2. PRESERVE THE VOICE - Keep the same narrative perspective and tone
3. PRESERVE THE SETTING - Don't change names, locations, or universe
4. CHANGE ONLY THE WRITING PATTERNS:
   - Adjust sentence structure (length, complexity, variation)
   - Adjust formality level (academic, casual, technical, etc.)
   - Adjust word choice and vocabulary (simple → complex or vice versa)
   - Adjust rhetorical devices (metaphors, parallelism, etc.)
${lengthGuidance}

Source Text:
"""
${text}
"""

Rewrite this text in "${this.style.name}" style while following the rules above.

Transformed Text:`;

    const result = await this.llmProvider.generateText(prompt, {
      max_tokens: Math.max(500, Math.ceil(text.split(/\s+/).length * 1.5)),
      temperature: 0.7
    });

    return result.trim();
  }
}

/**
 * Convenience function for style transformation
 */
export async function transformStyle(
  env: Env,
  text: string,
  style: NPEStyle,
  userId: string,
  options: StyleTransformationOptions = {}
): Promise<StyleTransformationResult> {
  const service = new StyleTransformationService(env, style, userId);
  return service.transform(text, options);
}
