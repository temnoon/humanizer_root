// Style Transformation Service
// Single-dimension transformation: Writing Patterns only
// Preserves content and voice while changing formality, structure, and lexical choices

import type { Env, NPEStyle } from '../../shared/types';
import { createLLMProvider, type LLMProvider } from './llm-providers';
import { detectAILocal, type LocalDetectionResult } from './ai-detection/local-detector';
import { hasCloudflareAI, detectEnvironment, getModelForUseCase } from '../config/llm-models';
import { extractStructure, restoreStructure, stripInlineMarkdown } from './markdown-preserver';
import { filterModelOutput, UnvettedModelError } from './model-vetting';

export interface StyleTransformationOptions {
  enableValidation?: boolean;  // Default: true - run AI detection
  preserveLength?: boolean;     // Default: true - keep similar length
  model?: string;              // Override default model (e.g., '@cf/openai/gpt-oss-20b')
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
  private userRole: string | null = null;

  constructor(
    private env: Env,
    private style: NPEStyle,
    private userId: string,
    private modelId: string = '@cf/meta/llama-3.1-70b-instruct'
  ) {}

  /**
   * Fetch user role from database
   */
  private async getUserRole(): Promise<string> {
    if (this.userRole) return this.userRole;

    const result = await this.env.DB.prepare(
      'SELECT role FROM users WHERE id = ?'
    ).bind(this.userId).first<{ role: string }>();

    this.userRole = result?.role || 'free';
    return this.userRole;
  }

  /**
   * Get max tokens based on user role
   */
  private getMaxTokensForRole(wordCount: number): number {
    const roleTokenLimits: Record<string, number> = {
      'admin': 50000, 'premium': 20000, 'pro': 10000, 'member': 5000, 'free': 4000
    };
    const maxTokens = roleTokenLimits[this.userRole || 'free'] || 4000;
    const neededTokens = Math.ceil(wordCount * 2.0);
    return Math.min(Math.max(500, neededTokens), maxTokens);
  }

  /**
   * Transform writing style while preserving content and voice
   */
  async transform(
    sourceText: string,
    options: StyleTransformationOptions = {}
  ): Promise<StyleTransformationResult> {
    const totalStartTime = Date.now();

    // Fetch user role for token limits
    await this.getUserRole();

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
   *
   * Style transformation follows a 3-layer model:
   * 1. INVARIANTS - What must be preserved (plot, facts, viewpoint, dialogue)
   * 2. STYLE CHANGES - What can change (sentence shape, register, figurative language)
   * 3. PROHIBITIONS - What must NOT happen (platform artifacts, narrator shifts, new facts)
   */
  private async applyStyle(text: string, preserveLength: boolean): Promise<string> {
    if (!this.llmProvider) {
      throw new Error('LLM provider not initialized');
    }

    // Extract markdown structure (paragraphs, lists)
    const structure = extractStructure(text);

    // Strip inline markdown but preserve structure
    const plainText = stripInlineMarkdown(text);

    const wordCount = plainText.split(/\s+/).length;
    const maxTokens = this.getMaxTokensForRole(wordCount);

    const lengthGuidance = preserveLength
      ? `Keep the output approximately the same length as the input (around ${wordCount} words).`
      : '';

    // Detect narrative viewpoint from source text
    const viewpointHint = this.detectViewpoint(plainText);

    const prompt = `You are a writing style transformation specialist. Your task is to rewrite the following text in "${this.style.name}" style.

STYLE GUIDANCE:
${this.style.style_prompt}

═══════════════════════════════════════════════════════════════════════════════
LAYER 1: INVARIANTS (MUST PRESERVE)
═══════════════════════════════════════════════════════════════════════════════
These elements define WHAT the text says and WHO is speaking. Do not change them.

• EVENT ORDER: Every event must happen in the same sequence
• CAUSE/EFFECT: Preserve all causal relationships between events
• DIALOGUE CONTENT: Keep dialogue meaning intact (minor wording adjustments OK)
• CHARACTER KNOWLEDGE: Characters know only what they knew in the original
• NARRATIVE VIEWPOINT: ${viewpointHint} - maintain this perspective throughout
• FACTS & ENTITIES: All names, locations, objects, and specific details stay the same
• GENRE IDENTITY: The text type remains the same (narrative stays narrative, essay stays essay)

═══════════════════════════════════════════════════════════════════════════════
LAYER 2: STYLE CHANGES (WHAT YOU MAY CHANGE)
═══════════════════════════════════════════════════════════════════════════════
Style is HOW the same narrator tells the same events. You may adjust:

SENTENCE-LEVEL:
• Sentence length and variation (short/medium/long mix)
• Clause complexity (simple vs compound vs complex)
• Lexical register (formal ↔ informal vocabulary)
• Cadence and rhythm (balanced clauses, periodic sentences, fragments)

FIGURATIVE LANGUAGE:
• Metaphor and simile frequency (within reason - don't drench the text)
• Imagery source domains appropriate to the style
• Sound devices (alliteration, assonance - light use only)

DISCOURSE-LEVEL:
• Connective tissue ("however/thus/indeed" vs "and/so/like")
• Rhetorical devices (questions, parallel structure, repetition)
• Pacing of description (slight expansion or compression)

${lengthGuidance}

═══════════════════════════════════════════════════════════════════════════════
LAYER 3: PROHIBITIONS (HARD NO - NEVER DO THESE)
═══════════════════════════════════════════════════════════════════════════════

❌ NO PLATFORM ARTIFACTS: Never add "EDIT:", "Thanks for reading", "Here goes...",
   "Now I know what you're thinking", "IANAL", or any meta-commentary about writing.

❌ NO NARRATOR IDENTITY SHIFT: Don't turn third-person into first-person memoir,
   or add "As I sit here reflecting..." framing. The narrator remains anonymous.

❌ NO NEW FACTS OR ENTITIES: Don't invent new objects, characters, locations,
   motivations, or worldbuilding details not in the original.

❌ NO MORAL REFRAMING: Don't turn comedy into spiritual parable or vice versa.
   The text's fundamental tone and meaning stay intact.

❌ NO EXTRADIEGETIC FRAMING: Don't add "Let me tell you a story about..." or
   "What follows is..." wrappers. Begin directly with the transformed content.

❌ NO VIEWPOINT MIXING: If it starts as third-person limited on Alice, it stays
   that way. Don't switch between "she" and "I" or add omniscient commentary.

═══════════════════════════════════════════════════════════════════════════════
SOURCE TEXT:
═══════════════════════════════════════════════════════════════════════════════
${plainText}

═══════════════════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS:
═══════════════════════════════════════════════════════════════════════════════
• Output ONLY the transformed text - no explanations, no thinking process
• Begin directly with the transformed content
• Maintain paragraph structure from the original

Transformed Text:`;

    const result = await this.llmProvider.generateText(prompt, {
      max_tokens: maxTokens,
      temperature: 0.7
    });

    // Filter output using model-specific vetting profile
    const filterResult = filterModelOutput(result.trim(), this.modelId);
    let strippedResult = filterResult.content;

    // Apply sanity pass to catch any remaining platform artifacts
    strippedResult = this.sanitizeStyleOutput(strippedResult);

    // Restore markdown structure (paragraph breaks, lists)
    const withStructure = restoreStructure(strippedResult, structure);

    return withStructure;
  }

  /**
   * Detect the narrative viewpoint of the source text
   */
  private detectViewpoint(text: string): string {
    const firstPersonIndicators = /\b(I|me|my|mine|myself|we|us|our)\b/gi;
    const thirdPersonIndicators = /\b(he|she|they|him|her|them|his|hers|their)\b/gi;

    const firstCount = (text.match(firstPersonIndicators) || []).length;
    const thirdCount = (text.match(thirdPersonIndicators) || []).length;

    // Check first 200 chars for strong signals
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
   * Sanity pass: Remove platform artifacts and framing that slipped through
   * This catches issues the LLM might generate despite instructions
   */
  private sanitizeStyleOutput(text: string): string {
    let result = text;

    // Platform artifact patterns (Reddit, social media, blog)
    const platformPatterns = [
      /^(So,?\s*)?(Here goes\.?\.?\.?|Let me (tell you|explain|rewrite)\.?\.?\.?)\s*/i,
      /^(Now,?\s*)?I know what you('re| are) thinking\.?\.?\.?\s*/i,
      /\bEDIT:?\s*.*$/gim,
      /\bUpdate:?\s*.*$/gim,
      /\bTL;?DR:?\s*.*$/gim,
      /\bIANAL\b.*$/gim,
      /\bIMHO\b/gi,
      /\bThanks for (reading|the gold|coming to my TED talk).*$/gim,
      /^(Okay,?\s*so,?\s*)/i,
      /^(Alright,?\s*so,?\s*)/i,
    ];

    // Framing/meta-commentary patterns
    const framingPatterns = [
      /^(What follows is|The following is|Below is).*?:\s*/i,
      /^(Let me paint you a picture|Picture this|Imagine)[:,.]?\s*/i,
      /^(I('ll| will) (now )?(rewrite|transform|convert)).*?:\s*/i,
      /^Here('s| is) (the|my) (rewrite|transformation|version).*?:\s*/i,
    ];

    // Apply platform pattern removals
    for (const pattern of platformPatterns) {
      result = result.replace(pattern, '');
    }

    // Apply framing pattern removals
    for (const pattern of framingPatterns) {
      result = result.replace(pattern, '');
    }

    // Clean up any resulting leading whitespace or newlines
    result = result.replace(/^\s*\n+/, '').trim();

    return result;
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
  // Use provided model or detect environment and select default
  let modelId = options.model;

  if (!modelId) {
    const hasAI = hasCloudflareAI(env);
    const environment = detectEnvironment(hasAI);
    modelId = getModelForUseCase('style', environment);
  }

  console.log(`[Style] Model: ${modelId}${options.model ? ' (user selected)' : ' (default)'}`);

  const service = new StyleTransformationService(env, style, userId, modelId);
  return service.transform(text, options);
}
