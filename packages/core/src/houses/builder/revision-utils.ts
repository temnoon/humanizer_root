/**
 * Builder Agent - Revision Utilities
 *
 * Functions for revision and text extraction helpers.
 *
 * @module @humanizer/core/houses/builder/revision-utils
 */

import type { ChapterStructure, PersonaProfileForRewrite } from './types.js';

// ═══════════════════════════════════════════════════════════════════
// TEXT EXTRACTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Extract text at a specified location
 */
export function extractTextAtLocation(content: string, location: string): string | null {
  // Parse location like "Paragraph 3" or "Section 2"
  const paragraphMatch = location.match(/paragraph\s*(\d+)/i);
  if (paragraphMatch) {
    const paragraphNum = parseInt(paragraphMatch[1], 10);
    const paragraphs = content.split(/\n\n+/);
    if (paragraphNum > 0 && paragraphNum <= paragraphs.length) {
      return paragraphs[paragraphNum - 1];
    }
  }

  // Fallback: return first substantial paragraph
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 50);
  return paragraphs[0] || null;
}

// ═══════════════════════════════════════════════════════════════════
// NARRATIVE ANALYSIS
// ═══════════════════════════════════════════════════════════════════

/**
 * Detect narrative arc from section types
 */
export function detectNarrativeArc(
  sections: ChapterStructure['sections']
): ChapterStructure['narrativeArc'] {
  // Simple heuristic based on section types and word distribution
  const hasOpening = sections.some(s => s.type === 'opening');
  const hasConclusion = sections.some(s => s.type === 'conclusion');

  if (hasOpening && hasConclusion) return 'resolution';
  if (hasOpening && !hasConclusion) return 'building';
  return 'flat';
}

/**
 * Calculate pacing score from section word counts
 */
export function calculatePacingScore(sections: ChapterStructure['sections']): number {
  if (sections.length === 0) return 0;

  // Ideal pacing has varied section lengths
  const wordCounts = sections.map(s => s.wordCount);
  const avg = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length;
  const variance = wordCounts.reduce((sum, wc) => sum + Math.pow(wc - avg, 2), 0) / wordCounts.length;

  // Some variance is good (0.3-0.5 of avg), too much or too little is bad
  const idealVariance = avg * 0.4;
  const varianceScore = 1 - Math.min(1, Math.abs(variance - idealVariance) / idealVariance);

  return varianceScore;
}

// ═══════════════════════════════════════════════════════════════════
// PERSONA FALLBACK
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a fallback minimal persona from a reference string
 */
export function createFallbackPersona(personaRef: string): PersonaProfileForRewrite {
  return {
    name: personaRef,
    voiceTraits: ['consistent', 'clear'],
    toneMarkers: ['appropriate'],
    formalityRange: [0.3, 0.7],
    styleGuide: {
      forbiddenPhrases: [
        'delve into',
        'leverage',
        'utilize',
        'in conclusion',
        'it is important to note',
      ],
      preferredPatterns: [],
      useContractions: true,
      useRhetoricalQuestions: false,
    },
  };
}
