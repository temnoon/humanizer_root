/**
 * Builder Agent - Persona Utilities
 *
 * Functions for persona/style merging and prompt building.
 *
 * @module @humanizer/core/houses/builder/persona-utils
 */

import type { PersonaProfile, StyleProfile } from '../../storage/aui-postgres-store.js';
import type { PersonaProfileForRewrite } from './types.js';

// ═══════════════════════════════════════════════════════════════════
// PERSONA/STYLE MERGING
// ═══════════════════════════════════════════════════════════════════

/**
 * Merge a PersonaProfile with an optional StyleProfile into the minimal
 * PersonaProfileForRewrite format needed by the rewriting methods.
 *
 * If a style is provided, its settings override the persona's styleGuide
 * and the arrays (forbiddenPhrases, preferredPatterns) are merged.
 */
export function mergePersonaWithStyle(
  persona: PersonaProfile,
  style?: StyleProfile
): PersonaProfileForRewrite {
  // If style provided, merge its settings with persona's styleGuide
  const styleGuide = style ? {
    forbiddenPhrases: [
      ...persona.styleGuide.forbiddenPhrases,
      ...style.forbiddenPhrases,
    ],
    preferredPatterns: [
      ...persona.styleGuide.preferredPatterns,
      ...style.preferredPatterns,
    ],
    useContractions: style.useContractions,
    useRhetoricalQuestions: style.useRhetoricalQuestions,
  } : {
    forbiddenPhrases: persona.styleGuide.forbiddenPhrases,
    preferredPatterns: persona.styleGuide.preferredPatterns,
    useContractions: persona.styleGuide.useContractions,
    useRhetoricalQuestions: persona.styleGuide.useRhetoricalQuestions,
  };

  // If style provided, use its formality level for both ends of range
  const formalityRange: [number, number] = style
    ? [style.formalityLevel, style.formalityLevel]
    : persona.formalityRange;

  return {
    name: persona.name,
    description: persona.description,
    voiceTraits: persona.voiceTraits,
    toneMarkers: persona.toneMarkers,
    formalityRange,
    styleGuide,
    referenceExamples: persona.referenceExamples,
  };
}

// ═══════════════════════════════════════════════════════════════════
// PROMPT BUILDING
// ═══════════════════════════════════════════════════════════════════

/**
 * Build system prompt that embodies the persona
 *
 * @param persona - The persona profile to use
 * @param leakedPhrases - Optional: phrases that leaked through a previous pass (triggers stronger enforcement)
 */
export function buildPersonaSystemPrompt(
  persona: PersonaProfileForRewrite,
  leakedPhrases?: string[]
): string {
  const parts: string[] = [
    `You are a skilled writer who transforms text to match a specific voice and persona.`,
    ``,
    `TARGET PERSONA: ${persona.name}`,
  ];

  if (persona.description) {
    parts.push(persona.description);
  }

  parts.push(``);
  parts.push(`VOICE TRAITS: ${persona.voiceTraits.join(', ')}`);
  parts.push(`TONE: ${persona.toneMarkers.join(', ')}`);
  parts.push(`FORMALITY: ${persona.formalityRange[0]} to ${persona.formalityRange[1]} (0=casual, 1=formal)`);
  parts.push(``);
  parts.push(`STYLE REQUIREMENTS:`);
  parts.push(`- Use contractions: ${persona.styleGuide.useContractions ? 'Yes' : 'No'}`);
  parts.push(`- Use rhetorical questions: ${persona.styleGuide.useRhetoricalQuestions ? 'Yes' : 'No'}`);
  parts.push(``);

  // CRITICAL REMOVAL SECTION - stronger when there are leaked phrases
  if (leakedPhrases && leakedPhrases.length > 0) {
    parts.push(`═══════════════════════════════════════════════════════════════════`);
    parts.push(`⚠️ CRITICAL REMOVAL REQUIRED ⚠️`);
    parts.push(`═══════════════════════════════════════════════════════════════════`);
    parts.push(``);
    parts.push(`The following phrases LEAKED through a previous rewrite and MUST be eliminated:`);
    for (const phrase of leakedPhrases) {
      parts.push(`   ❌ "${phrase}" → MUST BE REMOVED OR REPLACED`);
    }
    parts.push(``);
    parts.push(`You MUST NOT use these phrases under ANY circumstances.`);
    parts.push(`Find alternative ways to express the same meaning.`);
    parts.push(`This is NON-NEGOTIABLE - your output will be rejected if any of these phrases appear.`);
    parts.push(``);
    parts.push(`═══════════════════════════════════════════════════════════════════`);
    parts.push(``);
  } else if (persona.styleGuide.forbiddenPhrases.length > 0) {
    parts.push(`FORBIDDEN PHRASES (NEVER use these):`);
    for (const phrase of persona.styleGuide.forbiddenPhrases.slice(0, 15)) {
      parts.push(`- "${phrase}"`);
    }
    parts.push(``);
  }

  if (persona.styleGuide.preferredPatterns.length > 0) {
    parts.push(`PREFERRED PATTERNS (use these naturally when appropriate):`);
    for (const pattern of persona.styleGuide.preferredPatterns.slice(0, 10)) {
      parts.push(`- "${pattern}"`);
    }
    parts.push(``);
  }

  if (persona.referenceExamples && persona.referenceExamples.length > 0) {
    parts.push(`REFERENCE EXAMPLES of the target voice:`);
    for (let i = 0; i < Math.min(3, persona.referenceExamples.length); i++) {
      parts.push(`Example ${i + 1}: "${persona.referenceExamples[i]}"`);
      parts.push(``);
    }
  }

  parts.push(`YOUR TASK:`);
  parts.push(`Rewrite the given text to match this persona's voice while preserving the core meaning.`);
  parts.push(`Make it sound like the same person who wrote the reference examples.`);
  parts.push(`DO NOT add new ideas - only transform the voice and style.`);
  if (leakedPhrases && leakedPhrases.length > 0) {
    parts.push(`ENSURE all forbidden phrases are eliminated - no exceptions.`);
  }
  parts.push(`Output ONLY the rewritten text, nothing else.`);

  return parts.join('\n');
}

/**
 * Build the user prompt for rewriting
 */
export function buildRewritePrompt(
  text: string,
  persona: PersonaProfileForRewrite,
  sourceType?: string,
  voiceIssues?: string[]
): string {
  const parts: string[] = [`Original passage to rewrite:`];
  parts.push(``);
  parts.push(`"${text}"`);

  if (sourceType) {
    parts.push(``);
    parts.push(`Source: ${sourceType}`);
  }

  if (voiceIssues && voiceIssues.length > 0) {
    parts.push(``);
    parts.push(`DETECTED ISSUES TO FIX:`);
    for (const issue of voiceIssues) {
      parts.push(`- ${issue}`);
    }
  }

  parts.push(``);
  parts.push(`Rewrite this in the ${persona.name} voice:`);

  return parts.join('\n');
}

/**
 * Build revision prompt based on focus areas
 */
export function buildFocusedRevisionPrompt(
  focusAreas: Array<'voice' | 'pacing' | 'clarity' | 'transitions' | 'humanization' | 'structure'>,
  issues: Array<{
    type: string;
    description: string;
    location: string;
    suggestedFix?: string;
  }>,
  personaRef?: string
): string {
  const parts: string[] = [`Revise this chapter text. Focus specifically on:`];

  for (const area of focusAreas) {
    switch (area) {
      case 'voice':
        parts.push('- Voice: Ensure consistent, authentic voice throughout');
        break;
      case 'pacing':
        parts.push('- Pacing: Improve rhythm and flow between sections');
        break;
      case 'clarity':
        parts.push('- Clarity: Make ideas clearer and more accessible');
        break;
      case 'transitions':
        parts.push('- Transitions: Smooth connections between paragraphs and sections');
        break;
      case 'humanization':
        parts.push('- Humanization: Remove AI-like patterns, add natural variation');
        break;
      case 'structure':
        parts.push('- Structure: Improve organization and logical flow');
        break;
    }
  }

  if (issues.length > 0) {
    parts.push('');
    parts.push('Specific issues to address:');
    for (const issue of issues.slice(0, 5)) {
      parts.push(`- ${issue.description}`);
      if (issue.suggestedFix) {
        parts.push(`  Fix: ${issue.suggestedFix}`);
      }
    }
  }

  if (personaRef) {
    parts.push('');
    parts.push(`Maintain the voice of: ${personaRef}`);
  }

  parts.push('');
  parts.push('Output only the revised chapter text. Preserve core meaning and structure.');

  return parts.join('\n');
}
