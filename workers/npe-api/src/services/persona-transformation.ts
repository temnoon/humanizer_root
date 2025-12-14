// Persona Transformation Service
// Single-dimension transformation: Voice/Perspective only
// Preserves content, namespace, and writing style while changing narrative voice

import type { Env, NPEPersona } from '../../shared/types';
import { createLLMProvider, type LLMProvider } from './llm-providers';
import { detectAILocal, type LocalDetectionResult } from './ai-detection/local-detector';
import { hasCloudflareAI, detectEnvironment, getModelForUseCase, isModelCompatibleWithEnvironment } from '../config/llm-models';
import { extractStructure, restoreStructure, stripInlineMarkdown } from './markdown-preserver';
import { filterModelOutput, UnvettedModelError, isModelVetted } from './model-vetting';
import { selectModel, type ModelInfo } from './model-selector';

export interface PersonaTransformationOptions {
  enableValidation?: boolean;  // Default: true - run AI detection
  preserveLength?: boolean;     // Default: true - keep similar length
  model?: string;              // Override default model (e.g., '@cf/openai/gpt-oss-20b')
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
  private userRole: string | null = null;

  constructor(
    private env: Env,
    private persona: NPEPersona,
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
   * Transform narrative voice while preserving content
   */
  async transform(
    sourceText: string,
    options: PersonaTransformationOptions = {}
  ): Promise<PersonaTransformationResult> {
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
   * Get max tokens based on user role
   */
  private getMaxTokensForRole(wordCount: number): number {
    // Role-based token limits for output
    // Note: This is output tokens only, not total context
    const roleTokenLimits: Record<string, number> = {
      'admin': 50000,     // ~37k words - essentially unlimited for admins
      'premium': 20000,   // ~15k words
      'pro': 10000,       // ~5k words
      'member': 5000,     // ~2.5k words
      'free': 4000        // ~2k words
    };

    // Default to free tier if role not found
    const maxTokens = roleTokenLimits[this.userRole || 'free'] || 4000;

    // Calculate needed tokens (2x word count for transformation expansion)
    const neededTokens = Math.ceil(wordCount * 2.0);

    // Return the minimum of needed tokens and role limit
    return Math.min(Math.max(500, neededTokens), maxTokens);
  }

  /**
   * Apply persona voice while preserving content and structure
   *
   * Persona transformation follows a 5-layer model:
   * 1. INVARIANTS - What must be preserved (content, style mechanics, setting)
   * 2. PERSONA DIMENSIONS - What the persona controls (epistemics, attention, values)
   * 3. PROHIBITIONS - What must NOT happen (style changes, new facts, narrator identity)
   *
   * Key insight: Persona = WHO is perceiving/knowing, not HOW they write
   */
  private async applyPersona(text: string, preserveLength: boolean): Promise<string> {
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

    const prompt = `You are a narrative perspective transformation specialist. Your task is to rewrite the following text through the lens of "${this.persona.name}".

PERSONA DEFINITION:
${this.persona.system_prompt}

═══════════════════════════════════════════════════════════════════════════════
LAYER 1: INVARIANTS (MUST PRESERVE)
═══════════════════════════════════════════════════════════════════════════════
These elements define WHAT happens and HOW it's written. Do not change them.

• PLOT & EVENTS: Every event must happen in the same sequence with same outcomes
• FACTS & ENTITIES: All names, locations, objects, dates, and specific details stay the same
• SETTING & UNIVERSE: The world remains the same (don't shift genres or eras)
• DIALOGUE CONTENT: Keep dialogue meaning intact
• WRITING STYLE: Preserve sentence patterns, vocabulary register, figurative language density
  (Persona changes WHO perceives, not HOW they write)

═══════════════════════════════════════════════════════════════════════════════
LAYER 2: PERSONA DIMENSIONS (WHAT YOU MAY CHANGE)
═══════════════════════════════════════════════════════════════════════════════
Persona is a stable epistemic operator - it determines WHO perceives, WHAT counts
as salient, WHAT is taken for granted, and HOW uncertainty is handled.

ONTOLOGICAL FRAMING:
• How the narrator understands the world (orderly vs chaotic, improvable vs fixed)
• What forces the narrator sees as primary (systems vs individuals, fate vs agency)

EPISTEMIC STANCE:
• How the narrator knows things (observation, inference, intuition, authority)
• Certainty level (confident assertions vs hedged observations vs open questions)
• Judgment timing (immediate evaluation vs suspended judgment vs retrospective insight)

ATTENTION & SALIENCE:
• What the narrator notices first and lingers on
• What the narrator treats as background or unremarkable
• Which details deserve emphasis vs which are merely noted

NORMATIVE FRAMING:
• What the narrator implicitly approves or finds admirable (shown, not stated)
• What provokes the narrator's skepticism or concern
• What the narrator normalizes vs what they find remarkable

READER RELATIONSHIP:
• Why the narrator is telling this (instructing, witnessing, confessing, persuading)
• What the narrator assumes the reader knows or values
• Degree of intimacy or formal distance

${lengthGuidance}

═══════════════════════════════════════════════════════════════════════════════
LAYER 3: PROHIBITIONS (HARD NO - NEVER DO THESE)
═══════════════════════════════════════════════════════════════════════════════

❌ NO STYLE CHANGES: Don't alter sentence length patterns, vocabulary register,
   or figurative language density. The persona perceives differently but the
   text's mechanical style should remain similar.

❌ NO NEW FACTS: Don't invent new objects, characters, locations, motivations,
   or worldbuilding details not in the original.

❌ NO NARRATOR BIOGRAPHY: Don't add "As a scientist, I..." or "In my years of..."
   framing. The persona shapes perception, not explicit identity claims.

❌ NO MORAL SERMONS: Values should be implicit in what's noticed and emphasized,
   not stated as lessons or judgments.

❌ NO PLATFORM ARTIFACTS: Never add "EDIT:", "Thanks for reading", meta-commentary
   about the writing process, or direct reader address unless the original has it.

❌ NO GENRE SHIFTS: Don't turn narrative into essay, or essay into dialogue.
   The text type remains the same.

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

    // Apply sanity pass to catch any remaining artifacts
    strippedResult = this.sanitizePersonaOutput(strippedResult);

    // Restore markdown structure (paragraph breaks, lists)
    const withStructure = restoreStructure(strippedResult, structure);

    return withStructure;
  }

  /**
   * Sanity pass: Remove artifacts that shouldn't appear in persona transformations
   */
  private sanitizePersonaOutput(text: string): string {
    let result = text;

    // Platform artifact patterns
    const platformPatterns = [
      /^(So,?\s*)?(Here goes\.?\.?\.?|Let me (tell you|explain|rewrite)\.?\.?\.?)\s*/i,
      /^(Now,?\s*)?I know what you('re| are) thinking\.?\.?\.?\s*/i,
      /\bEDIT:?\s*.*$/gim,
      /\bUpdate:?\s*.*$/gim,
      /\bTL;?DR:?\s*.*$/gim,
      /\bThanks for (reading|the gold|coming to my TED talk).*$/gim,
      /^(Okay,?\s*so,?\s*)/i,
    ];

    // Meta-framing patterns (persona shouldn't add these)
    const framingPatterns = [
      /^(What follows is|The following is|Below is).*?:\s*/i,
      /^(Let me paint you a picture|Picture this|Imagine)[:,.]?\s*/i,
      /^(As a \w+,?\s*I\s)/i, // "As a scientist, I..."
      /^(In my (years|experience|time) (of|as))/i, // "In my years of..."
      /^Here('s| is) (the|my) (rewrite|transformation|version).*?:\s*/i,
    ];

    // Apply pattern removals
    for (const pattern of platformPatterns) {
      result = result.replace(pattern, '');
    }
    for (const pattern of framingPatterns) {
      result = result.replace(pattern, '');
    }

    // Clean up any resulting leading whitespace or newlines
    result = result.replace(/^\s*\n+/, '').trim();

    return result;
  }
}

/**
 * Convenience function for persona transformation
 * @param userTier - Optional user tier for model selection (free, pro, premium, admin)
 */
export async function transformPersona(
  env: Env,
  text: string,
  persona: NPEPersona,
  userId: string,
  options: PersonaTransformationOptions = {},
  userTier?: string
): Promise<PersonaTransformationResult> {
  // Detect environment (local vs cloud) based on available bindings
  const environment = detectEnvironment(hasCloudflareAI(env));

  // Model selection: Use new registry-based system if userTier is provided
  let modelId: string;
  let modelInfo: ModelInfo | null = null;

  if (userTier) {
    // New system: Use model registry and user preferences
    try {
      const selection = await selectModel(env, userId, userTier, 'persona');
      modelId = selection.model.modelId;
      modelInfo = selection.model;
      console.log(`[Persona] Model selected via registry: ${modelId} (${selection.reason})`);
    } catch (err) {
      // Fallback to legacy system if registry fails
      console.warn(`[Persona] Registry selection failed, using legacy: ${err}`);
      modelId = getModelForUseCase('persona', environment);
    }
  } else if (options.model) {
    // User provided a model - validate it
    if (!isModelVetted(options.model)) {
      throw new Error(`Model ${options.model} is not vetted for use. Check model-vetting/profiles.ts`);
    }
    // Check environment compatibility
    if (!isModelCompatibleWithEnvironment(options.model, environment)) {
      console.warn(`[Persona] User selected cloud model ${options.model} but environment is ${environment}. Falling back to default.`);
      modelId = getModelForUseCase('persona', environment);
    } else {
      modelId = options.model;
    }
  } else {
    // Legacy fallback: No user tier provided, use config-assigned model
    modelId = getModelForUseCase('persona', environment);
  }

  console.log(`[Persona] Environment: ${environment}, Model: ${modelId}`);

  const service = new PersonaTransformationService(env, persona, userId, modelId);
  return service.transform(text, options);
}
