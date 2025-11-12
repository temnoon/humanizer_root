/**
 * ρ-Based Allegorical Transformation Service
 *
 * Architecture: Narrative → ρ (density matrix) → 5-stage transformation → ρ'
 *
 * Each stage performs POVM measurement + transformation, updating ρ:
 * 1. Deconstruct: Measure narrative structure → Extract elements
 * 2. Map: Measure semantic space → Find analogues in namespace
 * 3. Reconstruct: Measure coherence → Rebuild narrative
 * 4. Stylize: Measure tone/voice → Apply persona/style
 * 5. Reflect: Measure transformation quality → Generate reflection
 */

import { v4 as uuidv4 } from 'uuid';
import type { D1Database } from '@cloudflare/workers-types';
import { NarrativeRepository } from './narrative-repository';
import { POVMService } from './povm-service';
import { generateEmbedding } from '../services/quantum-reading/embeddings';
import { constructDensityMatrix } from '../services/quantum-reading/density-matrix-simple';

export interface AllegoricalStageResult {
  stage_name: string;
  stage_number: number;
  input_text: string;
  output_text: string;
  rho_before: {
    id: string;
    purity: number;
    entropy: number;
    top_eigenvalues: number[];
  };
  rho_after: {
    id: string;
    purity: number;
    entropy: number;
    top_eigenvalues: number[];
  };
  povm_measurement?: {
    axis: string;
    probabilities: Record<string, number>;
    coherence: number;
  };
  transformation_description: string;
}

export interface AllegoricalTransformationResult {
  transformation_id: string;
  narrative_id: string;
  original_text: string;
  final_text: string;
  stages: AllegoricalStageResult[];
  overall_metrics: {
    initial_purity: number;
    final_purity: number;
    purity_delta: number;
    initial_entropy: number;
    final_entropy: number;
    entropy_delta: number;
    total_coherence: number;
  };
}

export class AllegoricalRhoService {
  constructor(
    private db: D1Database,
    private ai: any,
    private narrativeRepo: NarrativeRepository,
    private povmService: POVMService,
    private persona: { name: string; system_prompt: string },
    private namespace: { name: string; description: string; context_prompt: string },
    private style: { name: string; style_prompt: string },
    private model: string = '@cf/meta/llama-3.1-8b-instruct',
    private lengthPreference: 'shorter' | 'same' | 'longer' | 'much_longer' = 'same'
  ) {}

  /**
   * Transform narrative through 5-stage ρ-based pipeline
   */
  async transform(originalText: string, userId: string): Promise<AllegoricalTransformationResult> {
    const transformationId = uuidv4();
    const stages: AllegoricalStageResult[] = [];

    console.log('[Allegorical] Starting transformation:', transformationId);

    // Create initial narrative and ρ
    const initialNarrative = await this.narrativeRepo.create(
      userId,
      originalText,
      {
        title: `Allegorical ${transformationId}`,
        source: 'user_upload'
      }
    );

    console.log('[Allegorical] Initial narrative created:', initialNarrative.narrative.id);

    let currentText = originalText;
    let currentNarrativeId = initialNarrative.narrative.id;
    const initialRho = initialNarrative.rho;

    // Stage 1: Deconstruct - Measure narrative structure
    console.log('[Allegorical] Stage 1: Deconstruct');
    const stage1 = await this.performStage(
        1,
        'Deconstruct',
        currentText,
        currentNarrativeId,
        'narrative_structure',
        async (text: string) => {
          return await this.deconstructNarrative(text);
        },
        'Extracted core narrative elements and measured structural coherence'
      );
      stages.push(stage1);
      currentText = stage1.output_text;
      currentNarrativeId = await this.createStageNarrative(stage1.output_text, userId, 'stage_1_deconstruct');
      console.log('[Allegorical] Stage 1 complete');

    // Stage 2: Map - Measure semantic space
    const stage2 = await this.performStage(
      2,
      'Map',
      currentText,
      currentNarrativeId,
      'semantic_distance',
      async (text: string) => {
        return await this.mapToNamespace(text);
      },
      `Mapped elements to ${this.namespace.name} namespace and measured semantic alignment`
    );
    stages.push(stage2);
    currentText = stage2.output_text;
    currentNarrativeId = await this.createStageNarrative(stage2.output_text, userId, 'stage_2_map');

    // Stage 3: Reconstruct - Measure narrative coherence
    const stage3 = await this.performStage(
      3,
      'Reconstruct',
      currentText,
      currentNarrativeId,
      'narrative_coherence',
      async (text: string) => {
        return await this.reconstructNarrative(text);
      },
      'Reconstructed narrative in new namespace and measured coherence preservation'
    );
    stages.push(stage3);
    currentText = stage3.output_text;
    currentNarrativeId = await this.createStageNarrative(stage3.output_text, userId, 'stage_3_reconstruct');

    // Stage 4: Stylize - Measure tone/voice shift
    const stage4 = await this.performStage(
      4,
      'Stylize',
      currentText,
      currentNarrativeId,
      'tone_voice',
      async (text: string) => {
        return await this.stylizeNarrative(text);
      },
      `Applied ${this.persona.name} persona with ${this.style.name} style`
    );
    stages.push(stage4);
    currentText = stage4.output_text;
    currentNarrativeId = await this.createStageNarrative(stage4.output_text, userId, 'stage_4_stylize');

    // Stage 5: Reflect - Measure transformation quality
    const stage5 = await this.performStage(
      5,
      'Reflect',
      currentText,
      currentNarrativeId,
      'transformation_quality',
      async (text: string) => {
        return await this.generateReflection(text, originalText);
      },
      'Generated meta-reflection on transformation process and quality'
    );
    stages.push(stage5);

    // Calculate overall metrics
    const finalRho = stage5.rho_after;
    const overallMetrics = {
      initial_purity: initialRho.purity,
      final_purity: finalRho.purity,
      purity_delta: finalRho.purity - initialRho.purity,
      initial_entropy: initialRho.entropy,
      final_entropy: finalRho.entropy,
      entropy_delta: finalRho.entropy - initialRho.entropy,
      total_coherence: stages.reduce((sum, s) => sum + (s.povm_measurement?.coherence || 0), 0) / stages.length
    };

    return {
      transformation_id: transformationId,
      narrative_id: currentNarrativeId,
      original_text: originalText,
      final_text: currentText,
      stages,
      overall_metrics: overallMetrics
    };
  }

  /**
   * Generic stage execution with ρ measurement
   */
  private async performStage(
    stageNumber: number,
    stageName: string,
    inputText: string,
    narrativeId: string,
    povmAxis: string,
    transformFn: (text: string) => Promise<string>,
    description: string
  ): Promise<AllegoricalStageResult> {
    // Get ρ before transformation
    const narrativeBefore = await this.narrativeRepo.get(narrativeId);
    if (!narrativeBefore) {
      throw new Error(`Narrative ${narrativeId} not found`);
    }

    const rhoBefore = narrativeBefore.rho;

    // Perform POVM measurement
    let povmMeasurement = null;
    try {
      const measurementResult = await this.povmService.measureNarrative(narrativeId, povmAxis);
      povmMeasurement = {
        axis: povmAxis,
        probabilities: measurementResult.probabilities,
        coherence: measurementResult.coherence
      };
    } catch (error) {
      console.error(`[Allegorical] POVM measurement failed for stage ${stageNumber}:`, error);
      // Continue without POVM if it fails
    }

    // Perform transformation
    const outputText = await transformFn(inputText);

    // Create new ρ for output
    const embeddingResult = await generateEmbedding(this.ai, outputText);
    const rhoMatrix = constructDensityMatrix(embeddingResult.embedding);

    const rhoAfter = {
      id: uuidv4(),
      purity: rhoMatrix.purity,
      entropy: rhoMatrix.entropy,
      top_eigenvalues: rhoMatrix.eigenvalues.slice(0, 10)
    };

    return {
      stage_name: stageName,
      stage_number: stageNumber,
      input_text: inputText,
      output_text: outputText,
      rho_before: {
        id: rhoBefore.id,
        purity: rhoBefore.purity,
        entropy: rhoBefore.entropy,
        top_eigenvalues: rhoBefore.eigenvalues.slice(0, 10)
      },
      rho_after: rhoAfter,
      povm_measurement: povmMeasurement || undefined,
      transformation_description: description
    };
  }

  /**
   * Create narrative for stage output (for next stage's ρ measurement)
   */
  private async createStageNarrative(text: string, userId: string, source: string): Promise<string> {
    const narrative = await this.narrativeRepo.create(
      userId,
      text,
      {
        title: `Allegorical ${source}`,
        source: 'transformation'
      }
    );
    return narrative.narrative.id;
  }

  /**
   * Stage 1: Deconstruct narrative into elements
   */
  private async deconstructNarrative(text: string): Promise<string> {
    const prompt = `Deconstruct the following narrative into its core elements. Identify:
- Key characters/entities and their roles
- Central conflict or tension
- Setting and context
- Emotional tone
- Core message or theme

Narrative:
${text}

Provide a structured analysis in clear prose, not a list.`;

    const response = await this.ai.run(this.model, {
      messages: [
        { role: 'system', content: this.persona.system_prompt },
        { role: 'user', content: prompt }
      ],
      max_tokens: this.getStageTokenBudget(1),
      temperature: 0.4
    });

    return this.extractLLMResponse(response);
  }

  /**
   * Stage 2: Map elements to namespace
   */
  private async mapToNamespace(deconstructedElements: string): Promise<string> {
    const prompt = `Given these narrative elements, map each element to analogous concepts in ${this.namespace.description}.

Find specific, concrete parallels that maintain the same relationships and dynamics.

Elements:
${deconstructedElements}

Namespace context: ${this.namespace.context_prompt}

Provide the mapped elements in clear prose.`;

    const response = await this.ai.run(this.model, {
      messages: [
        { role: 'system', content: this.persona.system_prompt },
        { role: 'user', content: prompt }
      ],
      max_tokens: this.getStageTokenBudget(2),
      temperature: 0.5
    });

    return this.extractLLMResponse(response);
  }

  /**
   * Stage 3: Reconstruct narrative from mapped elements
   */
  private async reconstructNarrative(mappedElements: string): Promise<string> {
    const prompt = `Using these mapped elements, reconstruct the narrative as a complete story set entirely within ${this.namespace.description}.

Mapped elements:
${mappedElements}

Create a cohesive narrative that:
- Maintains the same emotional arc
- Preserves character relationships and dynamics
- Tells the same essential story in a completely different setting
- Feels natural within ${this.namespace.name}

Write the reconstructed narrative.`;

    const response = await this.ai.run(this.model, {
      messages: [
        { role: 'system', content: this.persona.system_prompt },
        { role: 'user', content: prompt }
      ],
      max_tokens: this.getStageTokenBudget(3),
      temperature: 0.7
    });

    return this.extractLLMResponse(response);
  }

  /**
   * Stage 4: Stylize with persona and style
   */
  private async stylizeNarrative(narrative: string): Promise<string> {
    const prompt = `Retell this narrative in your voice as the ${this.persona.name} persona, using a ${this.style.name} style.

Narrative:
${narrative}

Style guidance: ${this.style.style_prompt}

Rewrite the narrative in your distinctive voice while preserving the story.`;

    const response = await this.ai.run(this.model, {
      messages: [
        { role: 'system', content: this.persona.system_prompt },
        { role: 'user', content: prompt }
      ],
      max_tokens: this.getStageTokenBudget(4),
      temperature: 0.8
    });

    return this.extractLLMResponse(response);
  }

  /**
   * Stage 5: Generate reflection on transformation
   */
  private async generateReflection(finalNarrative: string, originalText: string): Promise<string> {
    const prompt = `Reflect on how this transformation preserved the essential narrative while completely changing its expression.

Original text:
${originalText}

Transformed narrative:
${finalNarrative}

Analyze:
- What remained constant (narrative core)
- What changed (expression, setting, voice)
- The quality of the transformation
- Whether the story's essence survived the journey

Provide a thoughtful 2-3 paragraph reflection.`;

    const response = await this.ai.run(this.model, {
      messages: [
        { role: 'system', content: 'You are a literary critic analyzing narrative transformations.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: this.getStageTokenBudget(5),
      temperature: 0.6
    });

    return this.extractLLMResponse(response);
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
    const multipliers: Record<'shorter' | 'same' | 'longer' | 'much_longer', number> = {
      shorter: 0.5,
      same: 1.0,
      longer: 1.5,
      much_longer: 2.0
    };

    const multiplier = multipliers[this.lengthPreference] || 1.0;
    return Math.ceil(base * multiplier);
  }

  /**
   * Extract clean text from LLM response
   */
  private extractLLMResponse(response: any): string {
    let text = response.response || response.content || '';

    // Remove thinking tags
    text = text.replace(/<think>[\s\S]*?<\/think>/g, '');
    text = text.replace(/<\/think>/g, '');

    // Remove markdown code blocks
    text = text.replace(/```[\s\S]*?```/g, '');

    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, '');

    return text.trim();
  }
}
