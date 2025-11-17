// Namespace Transformation Service
// Single-dimension transformation: Universe/Setting only
// Preserves narrative voice and writing style while changing conceptual framework

import type { Env, NPENamespace } from '../../shared/types';
import { createLLMProvider, type LLMProvider } from './llm-providers';
import { detectAILocal, type LocalDetectionResult } from './ai-detection/local-detector';

export interface NamespaceTransformationOptions {
  enableValidation?: boolean;  // Default: true - run AI detection
  preserveLength?: boolean;     // Default: true - keep similar length
}

export interface NamespaceTransformationResult {
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
 * NamespaceTransformationService
 *
 * Transforms narrative universe/setting while preserving:
 * - Narrative voice (who is speaking)
 * - Core narrative structure (plot beats, conflicts)
 * - Writing style (sentence patterns, formality)
 *
 * Changes:
 * - Conceptual framework (mythology → quantum physics, etc.)
 * - Proper names and domain-specific terms
 * - Cultural context and references
 */
export class NamespaceTransformationService {
  private llmProvider: LLMProvider | null = null;

  constructor(
    private env: Env,
    private namespace: NPENamespace,
    private userId: string,
    private modelId: string = '@cf/meta/llama-3.1-8b-instruct'
  ) {}

  /**
   * Transform narrative universe while preserving voice and style
   */
  async transform(
    sourceText: string,
    options: NamespaceTransformationOptions = {}
  ): Promise<NamespaceTransformationResult> {
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

    // Stage 2: Transform namespace (3-step process)
    this.llmProvider = await createLLMProvider(this.modelId, this.env, this.userId);

    // Step 1: Extract core structure
    const structure = await this.extractStructure(trimmedText);

    // Step 2: Map to new namespace
    const mapped = await this.mapToNamespace(structure);

    // Step 3: Reconstruct in new universe
    const transformedText = await this.reconstruct(mapped, preserveLength);

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
      VALUES (?, ?, 'namespace', ?, ?, ?, ?)
    `).bind(
      transformationId,
      this.userId,
      sourceText,
      transformedText,
      JSON.stringify({
        namespace: this.namespace.name,
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
   * Step 1: Extract core narrative structure (content-neutral)
   */
  private async extractStructure(text: string): Promise<string> {
    if (!this.llmProvider) {
      throw new Error('LLM provider not initialized');
    }

    const prompt = `You are a narrative structure analyst.

Extract the CORE STRUCTURE of this narrative without any universe-specific details:
- Who does what (roles, not names)
- What happens (events, not locations)
- What conflicts arise (tensions, not specifics)
- How things resolve (outcomes, not details)

Preserve the NARRATIVE VOICE and TONE completely.

Source Text:
"""
${text}
"""

Core Structure (abstract, universe-neutral):`;

    const result = await this.llmProvider.generateText(prompt, {
      max_tokens: Math.ceil(text.split(/\s+/).length * 1.2),
      temperature: 0.5
    });

    return result.trim();
  }

  /**
   * Step 2: Map abstract structure to target namespace
   */
  private async mapToNamespace(structure: string): Promise<string> {
    if (!this.llmProvider) {
      throw new Error('LLM provider not initialized');
    }

    const prompt = `You are a narrative universe mapper.

Map this abstract narrative structure into the "${this.namespace.name}" universe:

${this.namespace.context_prompt}

MAPPING RULES:
1. Translate roles → appropriate entities in ${this.namespace.name}
2. Translate events → equivalent actions in ${this.namespace.name}
3. Translate conflicts → analogous tensions in ${this.namespace.name}
4. Keep the NARRATIVE VOICE and TONE from the original
5. Use proper ${this.namespace.name} terminology and concepts

Abstract Structure:
"""
${structure}
"""

Mapped to ${this.namespace.name}:`;

    const result = await this.llmProvider.generateText(prompt, {
      max_tokens: Math.ceil(structure.split(/\s+/).length * 1.3),
      temperature: 0.7
    });

    return result.trim();
  }

  /**
   * Step 3: Reconstruct full narrative in new namespace
   */
  private async reconstruct(mapped: string, preserveLength: boolean): Promise<string> {
    if (!this.llmProvider) {
      throw new Error('LLM provider not initialized');
    }

    const lengthGuidance = preserveLength
      ? `Keep the output approximately ${mapped.split(/\s+/).length} words.`
      : '';

    const prompt = `You are a narrative reconstruction specialist.

Take this ${this.namespace.name}-mapped structure and write it as a complete, engaging narrative.

RECONSTRUCTION RULES:
1. Fully realize the ${this.namespace.name} universe with vivid details
2. Maintain the EXACT narrative voice and tone from the mapping
3. Keep the same sentence patterns and paragraph structure
4. Make it feel natural and immersive in ${this.namespace.name}
${lengthGuidance}

Mapped Structure:
"""
${mapped}
"""

Complete Narrative in ${this.namespace.name}:`;

    const result = await this.llmProvider.generateText(prompt, {
      max_tokens: Math.max(500, Math.ceil(mapped.split(/\s+/).length * 1.5)),
      temperature: 0.8
    });

    return result.trim();
  }
}

/**
 * Convenience function for namespace transformation
 */
export async function transformNamespace(
  env: Env,
  text: string,
  namespace: NPENamespace,
  userId: string,
  options: NamespaceTransformationOptions = {}
): Promise<NamespaceTransformationResult> {
  const service = new NamespaceTransformationService(env, namespace, userId);
  return service.transform(text, options);
}
