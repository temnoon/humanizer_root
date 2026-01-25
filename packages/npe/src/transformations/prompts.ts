/**
 * Transformation Prompts
 *
 * Functions that build prompts for persona and style transformations.
 *
 * IMPORTANT: The authoritative source for these prompts is:
 * @humanizer/core/src/config/prompt-registry.ts
 *
 * The prompts are duplicated here for:
 * 1. Backward compatibility with existing consumers
 * 2. TypeScript standalone compilation (avoids circular dependency)
 *
 * When updating prompts, update BOTH locations:
 * - This file (npe/src/transformations/prompts.ts)
 * - Core registry (core/src/config/prompt-registry.ts)
 *
 * Key Design Principles:
 * - Style = HOW (sentence patterns, register, figurative language)
 * - Persona = WHO (5-layer epistemic stack: ontology, epistemics, attention, values, reader)
 * - VOCABULARY preservation is crucial for quality
 *
 * @see Dec 2025 testing: "Vocabulary anchors prevent content drift"
 *
 * Note: Namespace transformations are DEPRECATED (lose original meaning).
 */

import type { PersonaDefinition, StyleDefinition, NamespaceDefinition } from './types.js';

/**
 * System prompt for transformations
 */
export const TRANSFORMATION_SYSTEM = `You are a narrative transformation specialist.
You transform text while preserving specified invariants.
Output ONLY the transformed text with no explanation or commentary.`;

/**
 * Persona transformation prompt template
 * @see TRANSFORMATION_PERSONA in @humanizer/core prompt-registry
 */
const PERSONA_TEMPLATE = `You are a narrative perspective transformation specialist. Your task is to rewrite the following text through the lens of "{{personaName}}".

PERSONA DEFINITION:
{{personaSystemPrompt}}

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

⚠️ VOCABULARY RULE (CRITICAL):
Keep ALL specific nouns, verbs, names, and key terms from the original.
Only change the FRAMING and PERSPECTIVE, not the vocabulary.
Do not replace "boss" with "supervisor", "email" with "correspondence", etc.

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

ATTENTION & SALIENCE:
• What the narrator notices first and lingers on
• What the narrator treats as background or unremarkable

NORMATIVE FRAMING:
• What the narrator implicitly approves or finds admirable (shown, not stated)
• What provokes the narrator's skepticism or concern

{{lengthGuidance}}

═══════════════════════════════════════════════════════════════════════════════
LAYER 3: PROHIBITIONS (HARD NO - NEVER DO THESE)
═══════════════════════════════════════════════════════════════════════════════

❌ NO STYLE CHANGES: Don't alter sentence length patterns, vocabulary register,
   or figurative language density.

❌ NO NEW FACTS: Don't invent new objects, characters, locations, or details.

❌ NO NARRATOR BIOGRAPHY: Don't add "As a scientist, I..." framing.

❌ NO MORAL SERMONS: Values should be implicit, not stated as lessons.

❌ NO PLATFORM ARTIFACTS: Never add "EDIT:", "Thanks for reading", etc.

❌ NO GENRE SHIFTS: Don't turn narrative into essay or vice versa.

═══════════════════════════════════════════════════════════════════════════════
SOURCE TEXT:
═══════════════════════════════════════════════════════════════════════════════
{{text}}

═══════════════════════════════════════════════════════════════════════════════
OUTPUT:
═══════════════════════════════════════════════════════════════════════════════
Output ONLY the transformed text - no explanations, no thinking process.
Begin directly with the transformed content.`;

/**
 * Style transformation prompt template
 * @see TRANSFORMATION_STYLE in @humanizer/core prompt-registry
 */
const STYLE_TEMPLATE = `You are a writing style transformation specialist. Your task is to rewrite the following text in "{{styleName}}" style.

STYLE GUIDANCE:
{{stylePrompt}}

═══════════════════════════════════════════════════════════════════════════════
LAYER 1: INVARIANTS (MUST PRESERVE)
═══════════════════════════════════════════════════════════════════════════════

• EVENT ORDER: Every event must happen in the same sequence
• CAUSE/EFFECT: Preserve all causal relationships between events
• DIALOGUE CONTENT: Keep dialogue meaning intact
• CHARACTER KNOWLEDGE: Characters know only what they knew originally
• NARRATIVE VIEWPOINT: {{viewpointHint}} - maintain this perspective throughout
• FACTS & ENTITIES: All names, locations, objects, and details stay the same
• GENRE IDENTITY: The text type remains the same

⚠️ VOCABULARY RULE (CRITICAL):
Keep ALL specific nouns, names, and key terms from the original.
Transform sentence STRUCTURE and hedging style only.
Do not replace "boss" with "supervisor", "email" with "missive", etc.

═══════════════════════════════════════════════════════════════════════════════
LAYER 2: STYLE CHANGES (WHAT YOU MAY CHANGE)
═══════════════════════════════════════════════════════════════════════════════

SENTENCE-LEVEL:
• Sentence length and variation
• Clause complexity
• Lexical register
• Cadence and rhythm

FIGURATIVE LANGUAGE:
• Metaphor and simile frequency (within reason)
• Imagery source domains
• Sound devices (light use)

DISCOURSE-LEVEL:
• Connective tissue
• Rhetorical devices
• Pacing of description

{{lengthGuidance}}

═══════════════════════════════════════════════════════════════════════════════
LAYER 3: PROHIBITIONS (HARD NO)
═══════════════════════════════════════════════════════════════════════════════

❌ NO PLATFORM ARTIFACTS: Never add "EDIT:", "Thanks for reading", etc.
❌ NO NARRATOR IDENTITY SHIFT: Don't turn third-person into first-person.
❌ NO NEW FACTS OR ENTITIES: Don't invent new details.
❌ NO MORAL REFRAMING: Don't change the fundamental tone or meaning.
❌ NO VIEWPOINT MIXING: Maintain consistent perspective throughout.

═══════════════════════════════════════════════════════════════════════════════
SOURCE TEXT:
═══════════════════════════════════════════════════════════════════════════════
{{text}}

═══════════════════════════════════════════════════════════════════════════════
OUTPUT:
═══════════════════════════════════════════════════════════════════════════════
Output ONLY the transformed text - no explanations.
Begin directly with the transformed content.`;

/**
 * Simple template variable substitution.
 * Replaces {{variable}} patterns with provided values.
 */
function fillTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

/**
 * Persona transformation prompt
 *
 * Transforms WHO perceives/narrates while preserving WHAT and HOW.
 */
export function createPersonaPrompt(
  persona: PersonaDefinition,
  text: string,
  wordCount: number,
  preserveLength: boolean
): string {
  const lengthGuidance = preserveLength
    ? `Keep the output approximately the same length as the input (around ${wordCount} words).`
    : '';

  return fillTemplate(PERSONA_TEMPLATE, {
    personaName: persona.name,
    personaSystemPrompt: persona.systemPrompt,
    lengthGuidance,
    text,
  });
}

/**
 * Style transformation prompt
 *
 * Transforms HOW the text is written while preserving WHO and WHAT.
 */
export function createStylePrompt(
  style: StyleDefinition,
  text: string,
  wordCount: number,
  preserveLength: boolean,
  viewpointHint: string
): string {
  const lengthGuidance = preserveLength
    ? `Keep the output approximately the same length as the input (around ${wordCount} words).`
    : '';

  return fillTemplate(STYLE_TEMPLATE, {
    styleName: style.name,
    stylePrompt: style.stylePrompt,
    viewpointHint,
    lengthGuidance,
    text,
  });
}

/**
 * Namespace transformation - Step 1: Extract structure
 * @deprecated Namespace transformations lose original meaning. Use persona/style instead.
 */
export function createNamespaceExtractPrompt(text: string): string {
  return `You are a narrative structure analyst.

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
}

/**
 * Namespace transformation - Step 2: Map to new namespace
 * @deprecated Namespace transformations lose original meaning. Use persona/style instead.
 */
export function createNamespaceMapPrompt(
  namespace: NamespaceDefinition,
  structure: string
): string {
  return `You are a narrative universe mapper.

Map this abstract narrative structure into the "${namespace.name}" universe:

${namespace.contextPrompt}

MAPPING RULES:
1. Translate roles → appropriate entities in ${namespace.name}
2. Translate events → equivalent actions in ${namespace.name}
3. Translate conflicts → analogous tensions in ${namespace.name}
4. Keep the NARRATIVE VOICE and TONE from the original
5. Use proper ${namespace.name} terminology and concepts

Abstract Structure:
"""
${structure}
"""

Mapped to ${namespace.name}:`;
}

/**
 * Namespace transformation - Step 3: Reconstruct
 * @deprecated Namespace transformations lose original meaning. Use persona/style instead.
 */
export function createNamespaceReconstructPrompt(
  namespace: NamespaceDefinition,
  mapped: string,
  wordCount: number,
  preserveLength: boolean
): string {
  const lengthGuidance = preserveLength
    ? `Keep the output approximately ${wordCount} words.`
    : '';

  return `You are a narrative reconstruction specialist.

Take this ${namespace.name}-mapped structure and write it as a complete, engaging narrative.

RECONSTRUCTION RULES:
1. Fully realize the ${namespace.name} universe with vivid details
2. Maintain the EXACT narrative voice and tone from the mapping
3. Keep the same sentence patterns and paragraph structure
4. Make it feel natural and immersive in ${namespace.name}
${lengthGuidance}

Mapped Structure:
"""
${mapped}
"""

Complete Narrative in ${namespace.name}:`;
}

/**
 * Sanitize output - remove common LLM artifacts
 */
export function sanitizeOutput(text: string): string {
  let result = text;

  // Platform artifact patterns
  const platformPatterns = [
    /^(So,?\s*)?(Here goes\.?\.?\.?|Let me (tell you|explain|rewrite)\.?\.?\.?)\s*/i,
    /^(Now,?\s*)?I know what you('re| are) thinking\.?\.?\.?\s*/i,
    /\bEDIT:?\s*.*$/gim,
    /\bUpdate:?\s*.*$/gim,
    /\bTL;?DR:?\s*.*$/gim,
    /\bThanks for (reading|the gold|coming to my TED talk).*$/gim,
    /\bLet me know if (you (need|have|want)|there('s| is)).*$/gim,
    /\bHope this helps.*$/gim,
    /\bFeel free to.*$/gim,
    /^(Okay,?\s*so,?\s*)/i,
  ];

  // Meta-framing patterns
  const framingPatterns = [
    /^(What follows is|The following is|Below is).*?:\s*/i,
    /^(Let me paint you a picture|Picture this|Imagine)[:,.]?\s*/i,
    /^(As a \w+,?\s*I\s)/i,
    /^(In my (years|experience|time) (of|as))/i,
    /^Here('s| is) (the|my) (rewrite|transformation|version).*?:\s*/i,
  ];

  for (const pattern of platformPatterns) {
    result = result.replace(pattern, '');
  }
  for (const pattern of framingPatterns) {
    result = result.replace(pattern, '');
  }

  return result.replace(/^\s*\n+/, '').trim();
}
