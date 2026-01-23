/**
 * SIC Chunking Utilities
 *
 * Text segmentation and heuristic analysis.
 * Designed to be fast and deterministic (no LLM calls).
 */

import type { TextChunk, NarrativeModeCaveat, Genre } from '../types.js';

/**
 * Split text into chunks
 */
export function chunkText(text: string, targetSentences: number = 10): TextChunk[] {
  const chunks: TextChunk[] = [];
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  let currentChunk: string[] = [];
  let currentSentenceCount = 0;
  let currentStartIndex = 0;
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const sentences = splitIntoSentences(paragraph);

    if (
      currentSentenceCount > 0 &&
      currentSentenceCount + sentences.length > targetSentences * 1.5
    ) {
      const chunkText = currentChunk.join('\n\n');
      chunks.push({
        id: `chunk_${chunkIndex}`,
        text: chunkText,
        startIndex: currentStartIndex,
        endIndex: currentStartIndex + chunkText.length,
        sentenceCount: currentSentenceCount,
      });
      chunkIndex++;
      currentChunk = [];
      currentSentenceCount = 0;
      currentStartIndex = text.indexOf(paragraph);
    }

    currentChunk.push(paragraph);
    currentSentenceCount += sentences.length;

    if (currentSentenceCount >= targetSentences) {
      const chunkText = currentChunk.join('\n\n');
      chunks.push({
        id: `chunk_${chunkIndex}`,
        text: chunkText,
        startIndex: currentStartIndex,
        endIndex: currentStartIndex + chunkText.length,
        sentenceCount: currentSentenceCount,
      });
      chunkIndex++;
      currentChunk = [];
      currentSentenceCount = 0;
      currentStartIndex = text.indexOf(paragraph) + paragraph.length;
    }
  }

  if (currentChunk.length > 0) {
    const chunkText = currentChunk.join('\n\n');
    chunks.push({
      id: `chunk_${chunkIndex}`,
      text: chunkText,
      startIndex: currentStartIndex,
      endIndex: currentStartIndex + chunkText.length,
      sentenceCount: currentSentenceCount,
    });
  }

  if (chunks.length === 0) {
    const sentences = splitIntoSentences(text);
    chunks.push({
      id: 'chunk_0',
      text: text.trim(),
      startIndex: 0,
      endIndex: text.length,
      sentenceCount: sentences.length,
    });
  }

  return chunks;
}

/**
 * Split text into sentences
 */
export function splitIntoSentences(text: string): string[] {
  const abbreviations = [
    'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sr', 'Jr', 'vs', 'etc',
    'e.g', 'i.e', 'cf', 'al', 'Inc', 'Ltd', 'Co', 'Corp', 'St', 'Ave', 'Blvd',
  ];

  let processedText = text;
  for (const abbr of abbreviations) {
    const regex = new RegExp(`\\b${abbr}\\.`, 'gi');
    processedText = processedText.replace(regex, `${abbr}<<DOT>>`);
  }

  processedText = processedText.replace(/(\d)\.(\d)/g, '$1<<DOT>>$2');
  processedText = processedText.replace(/\.{3}/g, '<<ELLIPSIS>>');

  const sentences = processedText
    .split(/(?<=[.!?])\s+(?=[A-Z])/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return sentences.map((s) =>
    s.replace(/<<DOT>>/g, '.').replace(/<<ELLIPSIS>>/g, '...')
  );
}

/**
 * Clamp a number to a range
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculate basic text statistics
 */
export function calculateTextStats(text: string): {
  wordCount: number;
  sentenceCount: number;
  avgWordsPerSentence: number;
  paragraphCount: number;
} {
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
  const sentences = splitIntoSentences(text);
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    avgWordsPerSentence: sentences.length > 0 ? words.length / sentences.length : 0,
    paragraphCount: paragraphs.length,
  };
}

/**
 * Quick heuristic patterns
 */
export const QUICK_HEURISTICS = {
  irreversibilityLexicon: [
    'commit', 'decide', 'cannot undo', 'regret', 'cost', 'consequence',
    'irreversible', 'never again', 'point of no return', 'sealed', 'final', 'permanent',
  ],
  temporalMarkers: [
    'suddenly', 'before I could', 'too late', 'in that moment',
    'afterward', 'just then', 'at that instant', 'before I knew it',
  ],
  epistemicReversals: [
    /I thought .+ but/i,
    /I assumed/i,
    /turns out/i,
    /I was wrong/i,
    /I didn't realize/i,
    /I had no idea/i,
    /it never occurred to me/i,
  ],
  tradeoffMarkers: [
    'rather than', 'instead of', 'had to choose', 'at the expense of',
    'sacrifice', 'give up', "couldn't have both",
  ],
  managerVoice: [
    'in conclusion', 'it is important to note', 'overall', 'this suggests',
    'key takeaway', 'to summarize', 'in summary', 'the main point',
  ],
  symmetryPatterns: [
    /on (?:the )?one hand.*on (?:the )?other hand/i,
    /balanced/i, /nuanced/i, /various perspectives/i,
    /pros and cons/i, /advantages and disadvantages/i,
  ],
  scarTissueMarkers: [
    /still flinch/i, /still cringe/i, /still wince/i, /stomach drops/i,
    /makes me freeze/i, /can't look at/i, /hard to talk about/i,
    /even now/i, /to this day/i, /years later/i,
    /still can't/i, /still don't/i, /still haven't/i,
    /keeps me up/i, /haunts me/i, /can't shake/i, /won't go away/i,
    /I hate that I/i, /I can't forgive myself/i, /the worst part is/i,
  ],
  formulaicApologyPatterns: [
    /I am truly sorry/i, /I sincerely apologize/i, /I take full responsibility/i,
    /I want to apologize/i, /please accept my apolog/i,
    /I am committed to/i, /moving forward/i, /I value our relationship/i,
    /your feelings are valid/i, /I understand that my/i,
  ],
};

/**
 * Run quick heuristic analysis
 */
export function runQuickHeuristics(text: string): {
  irreversibilitySignals: number;
  temporalSignals: number;
  epistemicReversalSignals: number;
  tradeoffSignals: number;
  managerVoiceSignals: number;
  symmetrySignals: number;
  scarTissueSignals: number;
  formulaicApologySignals: number;
} {
  const countMatches = (patterns: (string | RegExp)[]): number => {
    let count = 0;
    for (const pattern of patterns) {
      if (typeof pattern === 'string') {
        const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const matches = text.match(regex);
        count += matches ? matches.length : 0;
      } else {
        const matches = text.match(pattern);
        count += matches ? matches.length : 0;
      }
    }
    return count;
  };

  return {
    irreversibilitySignals: countMatches(QUICK_HEURISTICS.irreversibilityLexicon),
    temporalSignals: countMatches(QUICK_HEURISTICS.temporalMarkers),
    epistemicReversalSignals: countMatches(QUICK_HEURISTICS.epistemicReversals),
    tradeoffSignals: countMatches(QUICK_HEURISTICS.tradeoffMarkers),
    managerVoiceSignals: countMatches(QUICK_HEURISTICS.managerVoice),
    symmetrySignals: countMatches(QUICK_HEURISTICS.symmetryPatterns),
    scarTissueSignals: countMatches(QUICK_HEURISTICS.scarTissueMarkers),
    formulaicApologySignals: countMatches(QUICK_HEURISTICS.formulaicApologyPatterns),
  };
}

/**
 * Narrative mode detection patterns
 */
const NARRATIVE_MODE_SIGNALS = {
  firstPersonConfessional: [
    /\bI felt\b/i, /\bI knew\b/i, /\bI remember\b/i,
    /\bmy heart\b/i, /\bmy mind\b/i, /\bI couldn't\b/i,
    /\bI didn't\b/i, /\bI was wrong\b/i, /\bI regret\b/i,
  ],
  thirdPersonOmniscient: [
    /\bshe thought\b.*\bhe thought\b/is,
    /\blittle did (he|she|they) know\b/i,
    /\bunbeknownst to\b/i, /\bmeanwhile\b/i,
    /\bin another part of\b/i, /\bthe narrator\b/i,
  ],
  thirdPersonLimited: [
    /\b(he|she) wondered\b/i, /\b(he|she) felt\b/i,
    /\b(he|she) thought\b/i, /\b(he|she) didn't know\b/i,
    /\bit seemed to (him|her)\b/i,
  ],
  streamOfConsciousness: [
    /—\s*\w/, /\.\.\./g, /;\s*[a-z]/,
    /\b(and|but|or)\s+[a-z]/g,
    /\byes\b.*\byes\b/i, /\bremember\b.*\bremember\b/i,
  ],
};

/**
 * Detect narrative mode
 */
export function detectNarrativeMode(text: string, genre: Genre): NarrativeModeCaveat | undefined {
  if (genre !== 'narrative') return undefined;

  const signals: string[] = [];
  let mode: NarrativeModeCaveat['mode'] = 'uncertain';
  let confidence = 0.5;

  const firstPersonCount = (text.match(/\bI\b/g) || []).length;
  const thirdPersonCount = (text.match(/\b(he|she|they)\b/gi) || []).length;
  const wordCount = text.split(/\s+/).length;

  const firstPersonDensity = firstPersonCount / wordCount;
  const thirdPersonDensity = thirdPersonCount / wordCount;

  if (firstPersonDensity > 0.02) {
    signals.push(`High first-person density (${(firstPersonDensity * 100).toFixed(1)}%)`);
    const confessionalMatches = NARRATIVE_MODE_SIGNALS.firstPersonConfessional.filter(p => p.test(text));
    if (confessionalMatches.length >= 2) {
      mode = 'first_person_confessional';
      confidence = 0.7 + (confessionalMatches.length * 0.05);
      signals.push(`Confessional markers: ${confessionalMatches.length}`);
    } else {
      mode = 'first_person_observer';
      confidence = 0.6;
    }
  }

  if (thirdPersonDensity > 0.02 && firstPersonDensity < 0.01) {
    signals.push(`Third-person narration (${(thirdPersonDensity * 100).toFixed(1)}%)`);
    const omniscientMatches = NARRATIVE_MODE_SIGNALS.thirdPersonOmniscient.filter(p => p.test(text));
    const limitedMatches = NARRATIVE_MODE_SIGNALS.thirdPersonLimited.filter(p => p.test(text));

    if (omniscientMatches.length > 0) {
      mode = 'third_person_omniscient';
      confidence = 0.6 + (omniscientMatches.length * 0.1);
    } else if (limitedMatches.length > 0) {
      mode = 'third_person_limited';
      confidence = 0.6 + (limitedMatches.length * 0.05);
    }
  }

  const socMatches = NARRATIVE_MODE_SIGNALS.streamOfConsciousness.filter(p => {
    const matches = text.match(p);
    return matches && matches.length > 0;
  });

  if (socMatches.length >= 3) {
    mode = 'stream_of_consciousness';
    confidence = 0.5 + (socMatches.length * 0.1);
    signals.push(`Stream of consciousness: ${socMatches.length} patterns`);
  }

  if (signals.length === 0) return undefined;

  const interpretationNotes: Record<NarrativeModeCaveat['mode'], string> = {
    first_person_confessional: 'First-person confessional. Standard SIC applies.',
    first_person_observer: 'First-person observer. Stakes may be displaced.',
    third_person_limited: 'Third-person limited POV. Bounded viewpoint should be moderate.',
    third_person_omniscient: 'Third-person omniscient. Low bounded_viewpoint is appropriate.',
    stream_of_consciousness: 'Stream of consciousness. Low SIC may reflect artistic constraint.',
    uncertain: 'Narrative mode uncertain. Interpret SIC with caution.',
  };

  const standardScoringModes = ['first_person_confessional', 'first_person_observer', 'third_person_limited', 'uncertain'];

  return {
    mode,
    confidence: Math.min(confidence, 1.0),
    signals,
    interpretationNote: interpretationNotes[mode],
    standardScoringApplies: standardScoringModes.includes(mode),
  };
}
