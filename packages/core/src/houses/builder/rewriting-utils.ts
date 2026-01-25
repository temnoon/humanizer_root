/**
 * Builder Agent - Rewriting Utilities
 *
 * Functions for detecting changes and validating rewrites.
 *
 * @module @humanizer/core/houses/builder/rewriting-utils
 */

import type { PersonaProfileForRewrite } from './types.js';

// ═══════════════════════════════════════════════════════════════════
// CHANGE DETECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Detect what changes were made during rewriting
 */
export function detectChanges(
  original: string,
  rewritten: string,
  persona: PersonaProfileForRewrite
): string[] {
  const changes: string[] = [];
  const originalLower = original.toLowerCase();
  const rewrittenLower = rewritten.toLowerCase();

  // Check forbidden phrases removed
  for (const phrase of persona.styleGuide.forbiddenPhrases) {
    if (originalLower.includes(phrase.toLowerCase()) &&
        !rewrittenLower.includes(phrase.toLowerCase())) {
      changes.push(`Removed: "${phrase}"`);
    }
  }

  // Check preferred patterns added
  for (const pattern of persona.styleGuide.preferredPatterns) {
    const basePattern = pattern.replace('...', '').toLowerCase().trim();
    if (!originalLower.includes(basePattern) &&
        rewrittenLower.includes(basePattern)) {
      changes.push(`Added pattern: "${pattern}"`);
    }
  }

  // Check contractions
  if (persona.styleGuide.useContractions) {
    const contractionPairs = [
      ["i am", "i'm"], ["you are", "you're"], ["we are", "we're"],
      ["they are", "they're"], ["it is", "it's"], ["do not", "don't"],
      ["does not", "doesn't"], ["cannot", "can't"], ["will not", "won't"],
    ];
    for (const [expanded, contracted] of contractionPairs) {
      if (originalLower.includes(expanded) && rewrittenLower.includes(contracted)) {
        changes.push(`Added contraction: "${contracted}"`);
        break; // Just note one
      }
    }
  }

  // Check rhetorical questions
  if (persona.styleGuide.useRhetoricalQuestions) {
    const originalQuestions = (original.match(/\?/g) || []).length;
    const rewrittenQuestions = (rewritten.match(/\?/g) || []).length;
    if (rewrittenQuestions > originalQuestions) {
      changes.push(`Added rhetorical question`);
    }
  }

  return changes;
}

// ═══════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Check for forbidden phrases that remain in text
 */
export function checkForbiddenPhrases(text: string, forbiddenPhrases: string[]): string[] {
  const textLower = text.toLowerCase();
  const remaining: string[] = [];

  for (const phrase of forbiddenPhrases) {
    if (textLower.includes(phrase.toLowerCase())) {
      remaining.push(phrase);
    }
  }

  return remaining;
}

/**
 * Calculate confidence score for rewrite quality
 */
export function calculateRewriteConfidence(
  changesApplied: string[],
  remainingIssues: string[]
): number {
  // Base score
  let score = 0.5;

  // Bonus for changes applied
  score += Math.min(0.3, changesApplied.length * 0.05);

  // Penalty for remaining issues
  score -= Math.min(0.3, remainingIssues.length * 0.1);

  return Math.max(0, Math.min(1, score));
}

// ═══════════════════════════════════════════════════════════════════
// LEAKED PHRASE DETECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Detect leaked phrases from voice issues that match forbidden phrases
 */
export function detectLeakedPhrases(
  voiceIssues: string[] | undefined,
  forbiddenPhrases: string[]
): string[] {
  if (!voiceIssues) return [];

  return voiceIssues.filter(issue =>
    forbiddenPhrases.some(fp =>
      issue.toLowerCase().includes(fp.toLowerCase()) ||
      fp.toLowerCase().includes(issue.toLowerCase())
    )
  );
}
