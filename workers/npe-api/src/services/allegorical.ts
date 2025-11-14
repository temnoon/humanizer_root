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
   * Content-aware: preserves the type of discourse (argument, story, analysis, etc.)
   */
  private async deconstruct(text: string): Promise<AllegoricalStage> {
    const startTime = Date.now();

    const systemPrompt = `You are analyzing the structure of meaning in discourse.
Your task is to identify core elements WITHOUT changing what type of discourse it is.
If it's an argument, identify claims and evidence. If it's a story, identify characters and events.
If it's analysis, identify concepts and relationships. Preserve the essence.`;

    const prompt = `Identify the fundamental elements of this discourse:

${text}

**STEP 1: IDENTIFY PRIMARY DISCOURSE TYPE**

Ask: What is the MAIN content here?
- STORY: Characters doing things, dialogue, scenes, events
  - Even if text also contains commentary about the story
  - Primary = what happens, Secondary = commentary
- ARGUMENT: Claims with reasoning to support them
  - May include examples as evidence
- EXPLANATION: Theory/mechanism with evidence/examples
  - Must preserve BOTH abstract principles AND concrete examples
- ANALYSIS: Examination/interpretation of something else
  - About a text, not the text itself

**PRIMARY TYPE for this text**: [State it clearly]

**STEP 2: LIST ALL ELEMENTS (keeping abstraction level)**

Then identify:
1. Core concepts or entities (what this is ABOUT)
   - If STORY: List actual character names (not "characters")
   - If EXPLANATION: List BOTH concepts AND specific examples
   - Example: "Natural selection (concept), woodpecker (example)"
2. Key claims or actions (what is SAID or HAPPENS)
3. Relationships (how concepts/entities relate)
4. Tensions (conflicts, paradoxes, problems, challenges)
5. Resolutions or outcomes (conclusions, results, implications)

**CRITICAL RULES**:
- Preserve abstraction level: Concrete stays concrete, abstract stays abstract
- For SPECIFIC EXAMPLES: List them explicitly, don't generalize
  - ✅ "woodpecker, mistletoe" (specific)
  - ❌ "organisms, beings" (too general)
- Do NOT invent examples. Do NOT create fiction. Extract what's actually there.
- Tag concrete examples: [CONCRETE: woodpecker, mistletoe] so later stages preserve them`;

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
   * CRITICAL: Translate concepts, DON'T create fiction
   */
  private async map(deconstructedText: string): Promise<AllegoricalStage> {
    const startTime = Date.now();

    const systemPrompt = `You are translating concepts between conceptual frameworks.
${this.namespace.context_prompt}

CRITICAL RULES:
- If the source is an ARGUMENT, translate to an argument in this framework
- If the source is ANALYSIS, translate to analysis in this framework
- If the source is a STORY, only then translate to a story
- DO NOT invent concrete examples that weren't in the source
- PRESERVE the abstraction level - if source is abstract/conceptual, keep it abstract
- Translate VOCABULARY and CONCEPTUAL FRAMEWORK, not create new content`;

    const prompt = `Translate these elements into the conceptual framework of ${this.namespace.description}:

Source Elements:
${deconstructedText}

**CRITICAL: PRESERVE DISCOURSE TYPE FROM STAGE 1**
The Stage 1 analysis identified this as: [extract type from deconstructedText]
You MUST maintain that same type in your mapping.

**CRITICAL: PRESERVE ABSTRACTION LEVEL**

For each element, find the EQUIVALENT (not abstracted) concept in ${this.namespace.name} framework.

**TRANSLATION RULES**:

1. **ABSTRACT → ABSTRACT**:
   - "Empiricism" → "Empirical study"
   - "Causation" → "Mechanical necessity"

2. **CONCRETE → CONCRETE** (DO NOT ABSTRACT):
   - "Woodpecker's beak" → [Find equivalent specific example in ${this.namespace.name}]
   - Example: "Galileo's telescope" (specific tool, not "instruments")
   - "Elizabeth Bennet" → [Find equivalent character in ${this.namespace.name}]
   - Example: "Miss Havisham" (specific person, not "woman")

3. **MIXED → MIXED** (Preserve BOTH):
   - Theory + Examples → Theory + Examples
   - Characters + Themes → Characters + Themes

**FOR CONCRETE EXAMPLES**:
If source mentions "woodpecker", your output MUST include a specific equivalent:
✅ "Woodpecker → Diving bird of the Thames estuary"
✅ "Mistletoe → Climbing vine of tropical conservatories"
❌ "Woodpecker → Organism" (too abstract - WRONG)
❌ "Mistletoe → Plant" (too abstract - WRONG)

**FOR STORY CHARACTERS**:
If source mentions "Elizabeth", your output MUST include a character:
✅ "Elizabeth Bennet → Sarah Marwick of Cheapside"
❌ "Elizabeth → Individual" (too abstract - WRONG)

Provide structured mapping that:
- Preserves discourse type
- Maintains abstraction level
- Provides concrete equivalents for concrete examples`;

    const result = await this.callLLM(systemPrompt, prompt, 2);

    return {
      name: 'Map',
      prompt: prompt,
      result: result,
      duration_ms: Date.now() - startTime
    };
  }

  /**
   * Stage 3: Reconstruct in new conceptual framework
   * Preserves discourse type while using new vocabulary
   */
  private async reconstruct(mappedText: string): Promise<AllegoricalStage> {
    const startTime = Date.now();

    const systemPrompt = `You are expressing ideas through a specific conceptual framework.
${this.namespace.context_prompt}

Your task is to reconstruct the SAME MEANING using the vocabulary and concepts of this framework.

**TYPE LOCK**: The discourse type was identified in Stage 1. You MUST preserve that exact type.`;

    const prompt = `Using these translated elements, reconstruct the discourse entirely within ${this.namespace.description} framework:

Translated Elements:
${mappedText}

**IDENTIFY THE TYPE** (from Stage 1 mapping):
[Extract from mappedText]

**RECONSTRUCT REQUIREMENTS**:

IF TYPE = STORY:
- Output MUST be narrative scene/story
- Use translated character names in action
- Show events happening, not analysis of events
- Include dialogue or concrete actions
- ❌ Do NOT write "This story demonstrates..."
- ✅ DO write "Sarah walked into... she said..."

IF TYPE = EXPLANATION:
- Output MUST explain mechanism/theory
- Include BOTH abstract principles AND concrete examples
- Use specific examples from Stage 2 mapping
- ❌ Do NOT drop the examples
- ✅ DO include: "Consider the case of [specific example]..."

IF TYPE = ARGUMENT:
- Output MUST make claims with reasoning
- Maintain argumentative structure
- Support abstract claims with concrete evidence (if source had it)

IF TYPE = ANALYSIS:
- Output MUST analyze/interpret
- Maintain analytical structure

**ABSTRACTION PRESERVATION**:
- If Stage 2 mapping included concrete examples → OUTPUT MUST INCLUDE THEM
- If Stage 2 mapping was pure abstract → OUTPUT stays abstract
- Match the abstraction level of the input

Write the reconstructed discourse in ${this.namespace.name} framework.`;

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
   * Voice and register, NOT content changes
   */
  private async stylize(reconstructedText: string): Promise<AllegoricalStage> {
    const startTime = Date.now();

    const systemPrompt = `You are applying a specific voice and stylistic register to discourse.
${this.persona.system_prompt}

${this.style.style_prompt}

Your task is to express the SAME CONTENT in your distinctive voice.
Change ONLY the linguistic style, NOT the substance or structure.`;

    const prompt = `Apply ${this.persona.name} voice and ${this.style.name} style to this discourse:

Source:
${reconstructedText}

**FIRST: IDENTIFY THE TYPE**:
What type of discourse is this? [story/argument/explanation/analysis]

**THEN: APPLY VOICE WITHIN THAT TYPE**:

IF STORY:
- Keep it a story (characters, actions, scenes)
- Apply voice to narrative and dialogue
- Example: "Most astutely observed..." (Austen analyzing character action)

IF ARGUMENT/EXPLANATION/ANALYSIS:
- Keep it argumentative/explanatory/analytical
- Apply voice to reasoning and claims
- Example: "One cannot help but conclude..." (Austen analyzing argument)

**Style requirements**:
- Apply ${this.persona.description.toLowerCase()} perspective and voice
- Use ${this.style.name} stylistic characteristics
- Preserve ALL content, claims, and structure from source
- Change ONLY word choice, sentence structure, and rhetorical devices

**TYPE MUST MATCH SOURCE**:
- If source is argument, output argument in this voice
- If source is story, output story in this voice
- If source is analysis, output analysis in this voice
- If source is explanation, output explanation in this voice

Do NOT change what is being said, only HOW it is said.

Write the styled version.`;

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
