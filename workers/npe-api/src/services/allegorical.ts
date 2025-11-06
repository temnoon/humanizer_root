// Allegorical Projection Service - 5-stage narrative transformation
// Adapted from LPE projection.py for Cloudflare Workers

import type { Env, NPEPersona, NPENamespace, NPEStyle } from '../../shared/types';
import { createLLMProvider, type LLMProvider } from './llm-providers';

export type LengthPreference = 'shorter' | 'same' | 'longer' | 'much_longer';

export interface AllegoricalStage {
  name: string;
  prompt: string;
  result: string;
  duration_ms: number;
}

export interface AllegoricalResult {
  transformation_id: string;
  stages: {
    deconstruct: string;
    map: string;
    reconstruct: string;
    stylize: string;
  };
  final_projection: string;
  reflection: string;
  total_duration_ms: number;
}

/**
 * AllegoricalProjectionService - Transform narratives through 5-stage pipeline
 *
 * Pipeline: Deconstruct → Map → Reconstruct → Stylize → Reflect
 *
 * Based on LPE's TranslationChain approach with explicit multi-stage prompts
 */
export class AllegoricalProjectionService {
  private llmProvider: LLMProvider | null = null;

  constructor(
    private env: Env,
    private persona: NPEPersona,
    private namespace: NPENamespace,
    private style: NPEStyle,
    private userId: string,
    private modelId: string = '@cf/meta/llama-3.1-8b-instruct',
    private lengthPreference: LengthPreference = 'same'
  ) {}

  /**
   * Run the complete 5-stage allegorical transformation
   */
  async transform(sourceText: string): Promise<AllegoricalResult> {
    const startTime = Date.now();
    const stages: AllegoricalStage[] = [];

    // Initialize LLM provider
    this.llmProvider = await createLLMProvider(this.modelId, this.env, this.userId);

    // Stage 1: Deconstruct - Break down narrative into core elements
    const deconstructResult = await this.deconstruct(sourceText);
    stages.push(deconstructResult);

    // Stage 2: Map - Map elements to target namespace
    const mapResult = await this.map(deconstructResult.result);
    stages.push(mapResult);

    // Stage 3: Reconstruct - Rebuild narrative in new namespace
    const reconstructResult = await this.reconstruct(mapResult.result);
    stages.push(reconstructResult);

    // Stage 4: Stylize - Apply style and persona voice
    const stylizeResult = await this.stylize(reconstructResult.result);
    stages.push(stylizeResult);

    // Stage 5: Reflect - Generate meta-reflection on transformation
    const reflectResult = await this.reflect(sourceText, stylizeResult.result);
    stages.push(reflectResult);

    const totalDuration = Date.now() - startTime;

    // Create transformation record in database
    const transformationId = crypto.randomUUID();

    await this.env.DB.prepare(`
      INSERT INTO transformations (id, user_id, type, source_text, result_text, parameters, created_at)
      VALUES (?, ?, 'allegorical', ?, ?, ?, ?)
    `).bind(
      transformationId,
      this.userId,
      sourceText,
      stylizeResult.result,
      JSON.stringify({
        persona: this.persona.name,
        namespace: this.namespace.name,
        style: this.style.name,
        model: this.modelId,
        length_preference: this.lengthPreference,
        stage_token_budgets: {
          deconstruct: this.getStageTokenBudget(1),
          map: this.getStageTokenBudget(2),
          reconstruct: this.getStageTokenBudget(3),
          stylize: this.getStageTokenBudget(4),
          reflect: this.getStageTokenBudget(5)
        }
      }),
      Date.now()
    ).run();

    // Create allegorical projection record
    const projectionId = crypto.randomUUID();

    await this.env.DB.prepare(`
      INSERT INTO allegorical_projections (
        id, transformation_id, persona_id, namespace_id, style_id,
        stage_1_deconstruct, stage_2_map, stage_3_reconstruct,
        stage_4_stylize, stage_5_reflect
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      projectionId,
      transformationId,
      this.persona.id,
      this.namespace.id,
      this.style.id,
      deconstructResult.result,
      mapResult.result,
      reconstructResult.result,
      stylizeResult.result,
      reflectResult.result
    ).run();

    return {
      transformation_id: transformationId,
      stages: {
        deconstruct: deconstructResult.result,
        map: mapResult.result,
        reconstruct: reconstructResult.result,
        stylize: stylizeResult.result,
      },
      final_projection: stylizeResult.result,
      reflection: reflectResult.result,
      total_duration_ms: totalDuration
    };
  }

  /**
   * Stage 1: Deconstruct narrative into core elements
   */
  private async deconstruct(text: string): Promise<AllegoricalStage> {
    const startTime = Date.now();

    const systemPrompt = `You are analyzing narratives to identify their fundamental elements.
Your task is to deconstruct the narrative into its core components without interpretation or judgment.`;

    const prompt = `Deconstruct the following narrative into its fundamental elements:

Narrative:
${text}

Identify and list:
1. Key actors (individuals, groups, entities)
2. Core actions (what happens)
3. Relationships (connections between actors)
4. Conflicts (tensions, obstacles, challenges)
5. Outcomes (results, consequences, transformations)

Provide a structured breakdown of these elements.`;

    const result = await this.callLLM(systemPrompt, prompt, 1);

    return {
      name: 'Deconstruct',
      prompt: prompt,
      result: result,
      duration_ms: Date.now() - startTime
    };
  }

  /**
   * Stage 2: Map elements to target namespace
   */
  private async map(deconstructedText: string): Promise<AllegoricalStage> {
    const startTime = Date.now();

    const systemPrompt = `You are mapping narrative elements to a specific fictional universe.
${this.namespace.context_prompt}

Your task is to find analogous elements in this universe that parallel the original narrative elements.`;

    const prompt = `Given these deconstructed narrative elements, map each element to analogous elements in ${this.namespace.description}:

Deconstructed Elements:
${deconstructedText}

Create a mapping where:
- Each actor becomes an analogous character/entity in ${this.namespace.name}
- Each action becomes an analogous event in ${this.namespace.name}
- Each relationship becomes an analogous connection in ${this.namespace.name}
- Each conflict becomes an analogous tension in ${this.namespace.name}
- Each outcome becomes an analogous result in ${this.namespace.name}

Provide the complete mapping in a structured format.`;

    const result = await this.callLLM(systemPrompt, prompt, 2);

    return {
      name: 'Map',
      prompt: prompt,
      result: result,
      duration_ms: Date.now() - startTime
    };
  }

  /**
   * Stage 3: Reconstruct narrative in new namespace
   */
  private async reconstruct(mappedText: string): Promise<AllegoricalStage> {
    const startTime = Date.now();

    const systemPrompt = `You are reconstructing a narrative in a specific fictional universe.
${this.namespace.context_prompt}

Your task is to weave the mapped elements into a coherent narrative that tells THE SAME STORY but in a completely different setting.`;

    const prompt = `Using these mapped elements, reconstruct the narrative as a cohesive story set entirely within ${this.namespace.description}:

Mapped Elements:
${mappedText}

Create a complete narrative that:
- Tells the same fundamental story as the original
- Uses ONLY characters, settings, and events from ${this.namespace.name}
- Maintains the same narrative arc (beginning, conflict, resolution)
- Preserves the core relationships and tensions
- Achieves the same outcomes through analogous means

Write the reconstructed narrative.`;

    const result = await this.callLLM(systemPrompt, prompt, 3);

    return {
      name: 'Reconstruct',
      prompt: prompt,
      result: result,
      duration_ms: Date.now() - startTime
    };
  }

  /**
   * Stage 4: Apply style and persona voice
   */
  private async stylize(reconstructedText: string): Promise<AllegoricalStage> {
    const startTime = Date.now();

    const systemPrompt = `You are a narrator with a specific voice and style.
${this.persona.system_prompt}

${this.style.style_prompt}

Your task is to retell the narrative in your distinctive voice and style.`;

    const prompt = `Retell this narrative in your voice as the ${this.persona.name} persona, using a ${this.style.name} style:

Narrative:
${reconstructedText}

Retell the complete narrative with:
- Your ${this.persona.description.toLowerCase()} perspective
- The characteristics of ${this.style.name} writing
- The same events and outcomes
- Your distinctive narrative voice throughout

Write the stylized narrative.`;

    const result = await this.callLLM(systemPrompt, prompt, 4);

    return {
      name: 'Stylize',
      prompt: prompt,
      result: result,
      duration_ms: Date.now() - startTime
    };
  }

  /**
   * Stage 5: Generate reflection on the transformation
   */
  private async reflect(originalText: string, finalText: string): Promise<AllegoricalStage> {
    const startTime = Date.now();

    const systemPrompt = `You are a literary analyst reflecting on narrative transformations.
Provide insightful meta-commentary on how the transformation process revealed new meanings.`;

    const prompt = `Reflect on this allegorical transformation:

Original Narrative:
${originalText}

Final Allegorical Projection (in ${this.namespace.name}, told by ${this.persona.name} in ${this.style.name} style):
${finalText}

Provide a reflection that:
1. Identifies what core elements were preserved across the transformation
2. Explains what new insights emerged through the allegorical lens
3. Discusses how the ${this.namespace.name} setting illuminated aspects of the original
4. Analyzes how the ${this.persona.name} perspective shaped the narrative
5. Considers what was gained or lost in translation

Write a thoughtful reflection (2-3 paragraphs).`;

    const result = await this.callLLM(systemPrompt, prompt, 5);

    return {
      name: 'Reflect',
      prompt: prompt,
      result: result,
      duration_ms: Date.now() - startTime
    };
  }

  /**
   * Get token budget for a specific stage with length preference applied
   *
   * Per-stage base budgets:
   * - Stage 1 (Deconstruct): 800 tokens - Lists elements
   * - Stage 2 (Map): 1000 tokens - Creates mappings
   * - Stage 3 (Reconstruct): 2000 tokens - Full narrative
   * - Stage 4 (Stylize): 2000 tokens - Full narrative with style
   * - Stage 5 (Reflect): 1000 tokens - Meta-analysis
   *
   * Length preference multipliers:
   * - shorter: 0.5x base
   * - same: 1.0x base
   * - longer: 1.5x base
   * - much_longer: 2.0x base
   */
  private getStageTokenBudget(stage: number): number {
    // Base budgets per stage (optimized for narrative flow)
    const baseBudgets: Record<number, number> = {
      1: 800,   // Deconstruct: List elements
      2: 1000,  // Map: Create mappings
      3: 2000,  // Reconstruct: Full narrative
      4: 2000,  // Stylize: Full narrative with style
      5: 1000   // Reflect: Meta-analysis
    };

    const base = baseBudgets[stage] || 1000;

    // Apply length preference multiplier
    const multipliers: Record<LengthPreference, number> = {
      shorter: 0.5,
      same: 1.0,
      longer: 1.5,
      much_longer: 2.0
    };

    const multiplier = multipliers[this.lengthPreference] || 1.0;
    return Math.ceil(base * multiplier);
  }

  /**
   * Call LLM using the configured provider with per-stage token budget
   */
  private async callLLM(systemPrompt: string, userPrompt: string, stage: number): Promise<string> {
    if (!this.llmProvider) {
      throw new Error('LLM provider not initialized');
    }

    const maxTokens = this.getStageTokenBudget(stage);

    try {
      const response = await this.llmProvider.call({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: maxTokens,
        temperature: 0.7
      });

      return response.response || '';
    } catch (error) {
      console.error('LLM call failed:', error);
      throw new Error(`Failed to generate transformation stage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
