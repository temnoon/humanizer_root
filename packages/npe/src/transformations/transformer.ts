/**
 * Transformer Service
 *
 * Unified transformation service for persona, style, and namespace.
 * Uses LlmAdapter interface for backend abstraction.
 */

import type { LlmAdapter } from '../llm/types.js';
import type {
  TransformOptions,
  TransformResult,
  PersonaDefinition,
  StyleDefinition,
  NamespaceDefinition,
} from './types.js';
import {
  TRANSFORMATION_SYSTEM,
  createPersonaPrompt,
  createStylePrompt,
  createNamespaceExtractPrompt,
  createNamespaceMapPrompt,
  createNamespaceReconstructPrompt,
  sanitizeOutput,
} from './prompts.js';

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Detect narrative viewpoint
 */
function detectViewpoint(text: string): string {
  const firstPersonIndicators = /\b(I|me|my|mine|myself|we|us|our)\b/gi;
  const thirdPersonIndicators = /\b(he|she|they|him|her|them|his|hers|their)\b/gi;

  const firstCount = (text.match(firstPersonIndicators) || []).length;
  const thirdCount = (text.match(thirdPersonIndicators) || []).length;

  const opening = text.slice(0, 200).toLowerCase();
  const startsWithI = /^[^a-z]*i\s/i.test(opening);

  if (startsWithI || firstCount > thirdCount * 2) {
    return 'First-person narrator ("I/we")';
  } else if (thirdCount > firstCount * 2) {
    return 'Third-person narrator ("he/she/they")';
  } else if (firstCount > 0 && thirdCount > 0) {
    return 'Mixed perspective - preserve the original pattern';
  }
  return 'Preserve the original narrative perspective';
}

/**
 * Transformer Service
 */
export class TransformerService {
  private adapter: LlmAdapter;

  constructor(adapter: LlmAdapter) {
    this.adapter = adapter;
  }

  /**
   * Transform by persona (WHO perceives)
   */
  async transformPersona(
    text: string,
    persona: PersonaDefinition,
    options: TransformOptions = {}
  ): Promise<TransformResult> {
    const startTime = Date.now();
    const inputWordCount = countWords(text);

    const { preserveLength = true, temperature = 0.7, maxTokens } = options;

    const prompt = createPersonaPrompt(persona, text, inputWordCount, preserveLength);

    const response = await this.adapter.complete(TRANSFORMATION_SYSTEM, prompt, {
      temperature,
      max_tokens: maxTokens || Math.max(500, inputWordCount * 2),
      model: options.model,
    });

    const transformed = sanitizeOutput(response);

    return {
      text: transformed,
      durationMs: Date.now() - startTime,
      inputWordCount,
      outputWordCount: countWords(transformed),
    };
  }

  /**
   * Transform by style (HOW it's written)
   */
  async transformStyle(
    text: string,
    style: StyleDefinition,
    options: TransformOptions = {}
  ): Promise<TransformResult> {
    const startTime = Date.now();
    const inputWordCount = countWords(text);

    const { preserveLength = true, temperature = 0.7, maxTokens } = options;
    const viewpointHint = detectViewpoint(text);

    const prompt = createStylePrompt(style, text, inputWordCount, preserveLength, viewpointHint);

    const response = await this.adapter.complete(TRANSFORMATION_SYSTEM, prompt, {
      temperature,
      max_tokens: maxTokens || Math.max(500, inputWordCount * 2),
      model: options.model,
    });

    const transformed = sanitizeOutput(response);

    return {
      text: transformed,
      durationMs: Date.now() - startTime,
      inputWordCount,
      outputWordCount: countWords(transformed),
    };
  }

  /**
   * Transform by namespace (WHERE/WHAT universe)
   *
   * Uses 3-step process: Extract → Map → Reconstruct
   */
  async transformNamespace(
    text: string,
    namespace: NamespaceDefinition,
    options: TransformOptions = {}
  ): Promise<TransformResult> {
    const startTime = Date.now();
    const inputWordCount = countWords(text);

    const { preserveLength = true, maxTokens } = options;

    // Step 1: Extract abstract structure
    const extractPrompt = createNamespaceExtractPrompt(text);
    const structure = await this.adapter.complete(TRANSFORMATION_SYSTEM, extractPrompt, {
      temperature: 0.5,
      max_tokens: Math.ceil(inputWordCount * 1.2),
      model: options.model,
    });

    // Step 2: Map to new namespace
    const mapPrompt = createNamespaceMapPrompt(namespace, structure.trim());
    const mapped = await this.adapter.complete(TRANSFORMATION_SYSTEM, mapPrompt, {
      temperature: 0.7,
      max_tokens: Math.ceil(inputWordCount * 1.3),
      model: options.model,
    });

    // Step 3: Reconstruct full narrative
    const reconstructPrompt = createNamespaceReconstructPrompt(
      namespace,
      mapped.trim(),
      inputWordCount,
      preserveLength
    );
    const response = await this.adapter.complete(TRANSFORMATION_SYSTEM, reconstructPrompt, {
      temperature: 0.8,
      max_tokens: maxTokens || Math.max(500, inputWordCount * 1.5),
      model: options.model,
    });

    const transformed = sanitizeOutput(response);

    return {
      text: transformed,
      durationMs: Date.now() - startTime,
      inputWordCount,
      outputWordCount: countWords(transformed),
    };
  }

  /**
   * Compound transformation: apply multiple transforms in sequence
   */
  async transformCompound(
    text: string,
    transforms: Array<
      | { type: 'persona'; definition: PersonaDefinition }
      | { type: 'style'; definition: StyleDefinition }
      | { type: 'namespace'; definition: NamespaceDefinition }
    >,
    options: TransformOptions = {}
  ): Promise<TransformResult> {
    const startTime = Date.now();
    const inputWordCount = countWords(text);

    let currentText = text;

    for (const transform of transforms) {
      let result: TransformResult;

      switch (transform.type) {
        case 'persona':
          result = await this.transformPersona(currentText, transform.definition, options);
          break;
        case 'style':
          result = await this.transformStyle(currentText, transform.definition, options);
          break;
        case 'namespace':
          result = await this.transformNamespace(currentText, transform.definition, options);
          break;
      }

      currentText = result.text;
    }

    return {
      text: currentText,
      durationMs: Date.now() - startTime,
      inputWordCount,
      outputWordCount: countWords(currentText),
    };
  }
}
