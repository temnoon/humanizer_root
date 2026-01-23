/**
 * Tell-Phrase Detection for AI/Human Classification
 *
 * Detects characteristic phrases that correlate with AI or human authorship.
 * Based on empirical analysis of AI-generated vs human-written text.
 */

import type { TellPhrase, TellPhraseMatch, TellPhraseScore } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════
// AI Tell-Phrases
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Phrases that strongly correlate with AI-generated text.
 * Weighted by how diagnostic they are (higher = more AI-specific).
 */
export const AI_TELL_PHRASES: TellPhrase[] = [
  // Filler phrases (very common in AI text)
  { phrase: 'it is important to note', category: 'ai-filler', weight: 0.9, direction: 'ai', replacements: ['notably', 'note that'] },
  { phrase: 'it is worth noting', category: 'ai-filler', weight: 0.85, direction: 'ai', replacements: ['notably'] },
  { phrase: 'it should be noted', category: 'ai-filler', weight: 0.8, direction: 'ai', replacements: ['note:'] },
  { phrase: 'in conclusion', category: 'ai-filler', weight: 0.7, direction: 'ai', replacements: ['ultimately', 'in the end'] },
  { phrase: 'in summary', category: 'ai-filler', weight: 0.65, direction: 'ai', replacements: ['overall'] },
  { phrase: 'to summarize', category: 'ai-filler', weight: 0.6, direction: 'ai', replacements: ['in short'] },
  { phrase: 'as we can see', category: 'ai-filler', weight: 0.75, direction: 'ai', replacements: ['clearly'] },
  { phrase: 'as mentioned earlier', category: 'ai-filler', weight: 0.65, direction: 'ai', replacements: ['as noted'] },
  { phrase: 'as previously discussed', category: 'ai-filler', weight: 0.7, direction: 'ai', replacements: ['as stated'] },

  // Transition phrases (overused by AI)
  { phrase: 'moreover', category: 'ai-transition', weight: 0.55, direction: 'ai', replacements: ['also', 'and', 'plus'] },
  { phrase: 'furthermore', category: 'ai-transition', weight: 0.6, direction: 'ai', replacements: ['also', 'and'] },
  { phrase: 'additionally', category: 'ai-transition', weight: 0.5, direction: 'ai', replacements: ['also', 'and'] },
  { phrase: 'consequently', category: 'ai-transition', weight: 0.55, direction: 'ai', replacements: ['so', 'thus'] },
  { phrase: 'nevertheless', category: 'ai-transition', weight: 0.5, direction: 'ai', replacements: ['still', 'yet'] },
  { phrase: 'nonetheless', category: 'ai-transition', weight: 0.5, direction: 'ai', replacements: ['still', 'yet'] },
  { phrase: 'on the other hand', category: 'ai-transition', weight: 0.45, direction: 'ai', replacements: ['but', 'however'] },
  { phrase: 'in other words', category: 'ai-transition', weight: 0.5, direction: 'ai', replacements: ['meaning', 'i.e.'] },
  { phrase: 'that being said', category: 'ai-transition', weight: 0.6, direction: 'ai', replacements: ['but', 'still'] },

  // Hedging phrases (AI over-hedges)
  { phrase: 'it is possible that', category: 'ai-hedge', weight: 0.65, direction: 'ai', replacements: ['maybe', 'perhaps'] },
  { phrase: 'it could be argued', category: 'ai-hedge', weight: 0.7, direction: 'ai', replacements: ['one could say'] },
  { phrase: 'this suggests that', category: 'ai-hedge', weight: 0.5, direction: 'ai', replacements: ['suggesting'] },
  { phrase: 'this indicates that', category: 'ai-hedge', weight: 0.5, direction: 'ai', replacements: ['indicating'] },
  { phrase: 'it appears that', category: 'ai-hedge', weight: 0.55, direction: 'ai', replacements: ['apparently'] },
  { phrase: 'it seems that', category: 'ai-hedge', weight: 0.45, direction: 'ai', replacements: ['seemingly'] },

  // Emphasis phrases (AI over-emphasizes)
  { phrase: 'it is crucial', category: 'ai-emphasis', weight: 0.7, direction: 'ai', replacements: ['crucial is'] },
  { phrase: 'it is essential', category: 'ai-emphasis', weight: 0.65, direction: 'ai', replacements: ['essential is'] },
  { phrase: 'it is vital', category: 'ai-emphasis', weight: 0.65, direction: 'ai', replacements: ['vital is'] },
  { phrase: 'plays a crucial role', category: 'ai-emphasis', weight: 0.75, direction: 'ai', replacements: ['matters for', 'affects'] },
  { phrase: 'plays an important role', category: 'ai-emphasis', weight: 0.7, direction: 'ai', replacements: ['matters for', 'affects'] },
  { phrase: 'of paramount importance', category: 'ai-emphasis', weight: 0.85, direction: 'ai', replacements: ['very important'] },

  // Structural phrases
  { phrase: 'first and foremost', category: 'ai-filler', weight: 0.7, direction: 'ai', replacements: ['first', 'mainly'] },
  { phrase: 'last but not least', category: 'ai-filler', weight: 0.75, direction: 'ai', replacements: ['finally', 'also'] },
  { phrase: 'in today\'s world', category: 'ai-filler', weight: 0.8, direction: 'ai', replacements: ['now', 'today'] },
  { phrase: 'in the modern era', category: 'ai-filler', weight: 0.75, direction: 'ai', replacements: ['now', 'today'] },
  { phrase: 'throughout history', category: 'ai-filler', weight: 0.55, direction: 'ai', replacements: ['historically'] },

  // Meta phrases
  { phrase: 'delve into', category: 'ai-filler', weight: 0.85, direction: 'ai', replacements: ['explore', 'examine'] },
  { phrase: 'dive into', category: 'ai-filler', weight: 0.6, direction: 'ai', replacements: ['explore', 'look at'] },
  { phrase: 'shed light on', category: 'ai-filler', weight: 0.65, direction: 'ai', replacements: ['clarify', 'explain'] },
  { phrase: 'pave the way', category: 'ai-filler', weight: 0.6, direction: 'ai', replacements: ['enable', 'allow'] },
  { phrase: 'stands out as', category: 'ai-filler', weight: 0.55, direction: 'ai', replacements: ['is notable'] },
];

// ═══════════════════════════════════════════════════════════════════════════
// Human Tell-Phrases
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Phrases that correlate with human-written text.
 * These are markers of authentic human voice.
 */
export const HUMAN_TELL_PHRASES: TellPhrase[] = [
  // Personal/specific references
  { phrase: 'i think', category: 'human-specific', weight: 0.4, direction: 'human' },
  { phrase: 'i believe', category: 'human-specific', weight: 0.35, direction: 'human' },
  { phrase: 'in my experience', category: 'human-specific', weight: 0.6, direction: 'human' },
  { phrase: 'in my opinion', category: 'human-specific', weight: 0.5, direction: 'human' },
  { phrase: 'from what i\'ve seen', category: 'human-specific', weight: 0.65, direction: 'human' },
  { phrase: 'from my perspective', category: 'human-specific', weight: 0.55, direction: 'human' },

  // Conversational hedges (different from AI hedges)
  { phrase: 'honestly', category: 'human-hedge', weight: 0.45, direction: 'human' },
  { phrase: 'frankly', category: 'human-hedge', weight: 0.5, direction: 'human' },
  { phrase: 'to be honest', category: 'human-hedge', weight: 0.55, direction: 'human' },
  { phrase: 'if i\'m being honest', category: 'human-hedge', weight: 0.6, direction: 'human' },
  { phrase: 'to be fair', category: 'human-hedge', weight: 0.45, direction: 'human' },
  { phrase: 'i mean', category: 'human-hedge', weight: 0.4, direction: 'human' },
  { phrase: 'you know', category: 'human-hedge', weight: 0.5, direction: 'human' },
  { phrase: 'i guess', category: 'human-hedge', weight: 0.45, direction: 'human' },
  { phrase: 'i suppose', category: 'human-hedge', weight: 0.4, direction: 'human' },

  // Colloquialisms
  { phrase: 'kind of', category: 'human-specific', weight: 0.35, direction: 'human' },
  { phrase: 'sort of', category: 'human-specific', weight: 0.35, direction: 'human' },
  { phrase: 'pretty much', category: 'human-specific', weight: 0.4, direction: 'human' },
  { phrase: 'basically', category: 'human-specific', weight: 0.3, direction: 'human' },
  { phrase: 'literally', category: 'human-specific', weight: 0.35, direction: 'human' },
  { phrase: 'actually', category: 'human-specific', weight: 0.25, direction: 'human' },

  // Uncertainty markers (human-style)
  { phrase: 'i\'m not sure', category: 'human-hedge', weight: 0.55, direction: 'human' },
  { phrase: 'i don\'t know', category: 'human-hedge', weight: 0.5, direction: 'human' },
  { phrase: 'maybe', category: 'human-hedge', weight: 0.25, direction: 'human' },
  { phrase: 'probably', category: 'human-hedge', weight: 0.2, direction: 'human' },
];

// ═══════════════════════════════════════════════════════════════════════════
// Tell-Phrase Scoring
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Find all occurrences of a phrase in text (case-insensitive).
 */
function findPhrasePositions(text: string, phrase: string): number[] {
  const positions: number[] = [];
  const lowerText = text.toLowerCase();
  const lowerPhrase = phrase.toLowerCase();

  let pos = 0;
  while ((pos = lowerText.indexOf(lowerPhrase, pos)) !== -1) {
    positions.push(pos);
    pos += lowerPhrase.length;
  }

  return positions;
}

/**
 * Score text for tell-phrases.
 *
 * Returns a score from -1 (very human) to +1 (very AI).
 * Also returns detailed match information.
 */
export function scoreTellPhrases(text: string): TellPhraseScore {
  const matches: TellPhraseMatch[] = [];
  let aiTellWeight = 0;
  let humanTellWeight = 0;

  // Check AI phrases
  for (const tellPhrase of AI_TELL_PHRASES) {
    const positions = findPhrasePositions(text, tellPhrase.phrase);
    if (positions.length > 0) {
      matches.push({
        phrase: tellPhrase.phrase,
        category: tellPhrase.category,
        count: positions.length,
        weight: tellPhrase.weight,
        direction: 'ai',
        positions,
      });
      aiTellWeight += tellPhrase.weight * positions.length;
    }
  }

  // Check human phrases
  for (const tellPhrase of HUMAN_TELL_PHRASES) {
    const positions = findPhrasePositions(text, tellPhrase.phrase);
    if (positions.length > 0) {
      matches.push({
        phrase: tellPhrase.phrase,
        category: tellPhrase.category,
        count: positions.length,
        weight: tellPhrase.weight,
        direction: 'human',
        positions,
      });
      humanTellWeight += tellPhrase.weight * positions.length;
    }
  }

  // Calculate composite score (-1 to +1)
  const totalWeight = aiTellWeight + humanTellWeight;
  let score = 0;

  if (totalWeight > 0) {
    // Positive = AI-like, Negative = human-like
    score = (aiTellWeight - humanTellWeight) / Math.max(totalWeight, 1);
  }

  // Sort matches by weight descending
  matches.sort((a, b) => b.weight * b.count - a.weight * a.count);

  return {
    score,
    matches,
    aiTellWeight,
    humanTellWeight,
  };
}

/**
 * Get top N most significant tell-phrase matches.
 */
export function getTopMatches(tellScore: TellPhraseScore, n: number = 5): TellPhraseMatch[] {
  return tellScore.matches.slice(0, n);
}

/**
 * Get phrases that should be replaced for humanization.
 */
export function getReplacementSuggestions(
  tellScore: TellPhraseScore
): Array<{ phrase: string; replacements: string[]; positions: number[] }> {
  const suggestions: Array<{ phrase: string; replacements: string[]; positions: number[] }> = [];

  for (const match of tellScore.matches) {
    if (match.direction === 'ai') {
      const tellPhrase = AI_TELL_PHRASES.find(t => t.phrase === match.phrase);
      if (tellPhrase?.replacements && tellPhrase.replacements.length > 0) {
        suggestions.push({
          phrase: match.phrase,
          replacements: tellPhrase.replacements,
          positions: match.positions,
        });
      }
    }
  }

  return suggestions;
}
