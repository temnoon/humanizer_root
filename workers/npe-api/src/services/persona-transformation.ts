// Persona Transformation Service
// Single-dimension transformation: Voice/Perspective only
// Preserves content, namespace, and writing style while changing narrative voice

import type { Env, NPEPersona } from '../../shared/types';
import { createLLMProvider, type LLMProvider } from './llm-providers';
import { detectAILocal, type LocalDetectionResult } from './ai-detection/local-detector';

export interface PersonaTransformationOptions {
  enableValidation?: boolean;  // Default: true - run AI detection
  preserveLength?: boolean;     // Default: true - keep similar length
}

export interface PersonaTransformationResult {
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
 * PersonaTransformationService
 *
 * Transforms narrative voice/perspective while preserving:
 * - Content (what is said)
 * - Setting/universe (where it happens)
 * - Core writing style (sentence structure)
 *
 * Changes:
 * - Narrative distance (1st/2nd/3rd person)
 * - Affective tone (warm/cold, passionate/detached)
 * - Rhetorical stance (persuasive/descriptive/analytical)
 */
export class PersonaTransformationService {
  private llmProvider: LLMProvider | null = null;

  constructor(
    private env: Env,
    private persona: NPEPersona,
    private userId: string,
    private modelId: string = '@cf/meta/llama-3.1-70b-instruct'
  ) {}

  /**
   * Transform narrative voice while preserving content
   */
  async transform(
    sourceText: string,
    options: PersonaTransformationOptions = {}
  ): Promise<PersonaTransformationResult> {
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

    // Stage 2: Transform voice
    this.llmProvider = await createLLMProvider(this.modelId, this.env, this.userId);

    const transformedText = await this.applyPersona(trimmedText, preserveLength);

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
      VALUES (?, ?, 'persona', ?, ?, ?, ?)
    `).bind(
      transformationId,
      this.userId,
      sourceText,
      transformedText,
      JSON.stringify({
        persona: this.persona.name,
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
   * Apply persona voice while preserving content and structure
   */
  private async applyPersona(text: string, preserveLength: boolean): Promise<string> {
    if (!this.llmProvider) {
      throw new Error('LLM provider not initialized');
    }

    const lengthGuidance = preserveLength
      ? `IMPORTANT: Keep the output approximately the same length as the input (around ${text.split(/\s+/).length} words).`
      : '';

    const prompt = `You are a narrative voice transformation specialist.

Your task is to rewrite the following text in the voice and perspective of "${this.persona.name}":

${this.persona.system_prompt}

CRITICAL RULES:
1. PRESERVE ALL CONTENT - Don't add new ideas or remove existing ones
2. PRESERVE THE SETTING - Don't change locations, names, or universe
3. PRESERVE CORE STRUCTURE - Keep similar sentence patterns and paragraph breaks
4. CHANGE ONLY THE VOICE - Adjust narrative perspective, tone, and rhetorical stance
${lengthGuidance}

Source Text:
"""
${text}
"""

Rewrite this text in the voice of "${this.persona.name}" while following the rules above.

Transformed Text:`;

    const result = await this.llmProvider.generateText(prompt, {
      max_tokens: Math.max(500, Math.ceil(text.split(/\s+/).length * 1.5)),
      temperature: 0.7
    });

    return result.trim();
  }
}

/**
 * Convenience function for persona transformation
 */
export async function transformPersona(
  env: Env,
  text: string,
  persona: NPEPersona,
  userId: string,
  options: PersonaTransformationOptions = {}
): Promise<PersonaTransformationResult> {
  const service = new PersonaTransformationService(env, persona, userId);
  return service.transform(text, options);
}
