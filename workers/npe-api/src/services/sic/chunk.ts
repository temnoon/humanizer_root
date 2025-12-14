/**
 * Subjective Intentional Constraint (SIC) - Chunking Utilities
 *
 * Utilities for text segmentation, JSON parsing, and numeric clamping.
 * Designed to be fast and deterministic (no LLM calls).
 */

import type { TextChunk, NarrativeModeCaveat } from './types';

/**
 * Split text into chunks of approximately the target sentence count
 * Attempts to preserve paragraph boundaries where possible
 *
 * @param text - The text to chunk
 * @param targetSentences - Target sentences per chunk (default: 8-15)
 * @returns Array of TextChunk objects
 */
export function chunkText(
  text: string,
  targetSentences: number = 10
): TextChunk[] {
  const chunks: TextChunk[] = [];

  // Split into paragraphs first
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  let currentChunk: string[] = [];
  let currentSentenceCount = 0;
  let currentStartIndex = 0;
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const sentences = splitIntoSentences(paragraph);

    // If adding this paragraph would exceed target, flush current chunk
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

    // If we've hit the target, flush
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

  // Flush remaining
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

  // If we ended up with no chunks (very short text), treat whole text as one chunk
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
 * Handles common edge cases like abbreviations and decimal numbers
 *
 * @param text - The text to split
 * @returns Array of sentence strings
 */
export function splitIntoSentences(text: string): string[] {
  // Common abbreviations that shouldn't end sentences
  const abbreviations = [
    'Mr',
    'Mrs',
    'Ms',
    'Dr',
    'Prof',
    'Sr',
    'Jr',
    'vs',
    'etc',
    'e.g',
    'i.e',
    'cf',
    'al',
    'Inc',
    'Ltd',
    'Co',
    'Corp',
    'St',
    'Ave',
    'Blvd',
  ];

  // Protect abbreviations by temporarily replacing their periods
  let processedText = text;
  for (const abbr of abbreviations) {
    const regex = new RegExp(`\\b${abbr}\\.`, 'gi');
    processedText = processedText.replace(regex, `${abbr}<<DOT>>`);
  }

  // Protect decimal numbers
  processedText = processedText.replace(/(\d)\.(\d)/g, '$1<<DOT>>$2');

  // Protect ellipses
  processedText = processedText.replace(/\.{3}/g, '<<ELLIPSIS>>');

  // Split on sentence-ending punctuation followed by space and capital
  const sentences = processedText
    .split(/(?<=[.!?])\s+(?=[A-Z])/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Restore protected sequences
  return sentences.map((s) =>
    s.replace(/<<DOT>>/g, '.').replace(/<<ELLIPSIS>>/g, '...')
  );
}

/**
 * Clamp a number to a range
 *
 * @param value - The value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Safely parse JSON with fallback
 * Handles common LLM output issues like markdown fences and preambles
 *
 * @param text - The text to parse as JSON
 * @param fallback - Fallback value if parsing fails
 * @returns Parsed object or fallback
 */
export function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    // Try direct parse first
    return JSON.parse(text);
  } catch {
    // Try to extract JSON from markdown fences
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      try {
        return JSON.parse(fenceMatch[1].trim());
      } catch {
        // Continue to other strategies
      }
    }

    // Try to find JSON object in the text
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        // Continue
      }
    }

    // Try to find JSON array
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch {
        // Continue
      }
    }

    return fallback;
  }
}

/**
 * Normalize LLM response by stripping common artifacts
 *
 * @param response - The raw LLM response
 * @returns Cleaned response
 */
export function normalizeResponse(response: string): string {
  let cleaned = response;

  // Remove XML-style thinking tags
  cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  cleaned = cleaned.replace(/<reflection>[\s\S]*?<\/reflection>/gi, '');
  cleaned = cleaned.replace(/<analysis>[\s\S]*?<\/analysis>/gi, '');

  // Remove markdown code fences if wrapping JSON
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/i, '');

  // Remove common preambles
  const preambles = [
    /^(?:Here(?:'s| is) (?:the|my|an?) (?:response|answer|analysis|output|result)[:\.]?\s*)/i,
    /^(?:I'll |Let me |I will |I would )/i,
    /^(?:Sure[,!]? |Certainly[,!]? |Of course[,!]? )/i,
    /^(?:Based on (?:the |my |your )?(?:text|analysis|input)[,:]?\s*)/i,
  ];

  for (const preamble of preambles) {
    cleaned = cleaned.replace(preamble, '');
  }

  return cleaned.trim();
}

/**
 * Extract a short quote from text, truncating if necessary
 *
 * @param text - The source text
 * @param maxWords - Maximum words in the quote (default: 25)
 * @returns Truncated quote
 */
export function extractShortQuote(text: string, maxWords: number = 25): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) {
    return text.trim();
  }
  return words.slice(0, maxWords).join(' ') + '...';
}

/**
 * Calculate basic text statistics
 *
 * @param text - The text to analyze
 * @returns Statistics object
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
    avgWordsPerSentence:
      sentences.length > 0 ? words.length / sentences.length : 0,
    paragraphCount: paragraphs.length,
  };
}

/**
 * Quick heuristic checks for SIC signals
 * These can run without LLM calls for fast screening
 */
export const QUICK_HEURISTICS = {
  /**
   * Lexicon suggesting irreversibility/commitment
   */
  irreversibilityLexicon: [
    'commit',
    'decide',
    'cannot undo',
    'regret',
    'cost',
    'consequence',
    'irreversible',
    'never again',
    'point of no return',
    'sealed',
    'final',
    'permanent',
  ],

  /**
   * Temporal markers suggesting lived time
   */
  temporalMarkers: [
    'suddenly',
    'before I could',
    'too late',
    'in that moment',
    'afterward',
    'just then',
    'at that instant',
    'before I knew it',
  ],

  /**
   * Epistemic reversal patterns
   */
  epistemicReversals: [
    /I thought .+ but/i,
    /I assumed/i,
    /turns out/i,
    /I was wrong/i,
    /I didn't realize/i,
    /I had no idea/i,
    /it never occurred to me/i,
  ],

  /**
   * Tradeoff markers
   */
  tradeoffMarkers: [
    'rather than',
    'instead of',
    'had to choose',
    'at the expense of',
    'sacrifice',
    'give up',
    'couldn\'t have both',
  ],

  /**
   * Manager voice indicators (negative signal)
   */
  managerVoice: [
    'in conclusion',
    'it is important to note',
    'overall',
    'this suggests',
    'key takeaway',
    'to summarize',
    'in summary',
    'the main point',
  ],

  /**
   * Symmetry obsession (negative signal)
   */
  symmetryPatterns: [
    /on (?:the )?one hand.*on (?:the )?other hand/i,
    /balanced/i,
    /nuanced/i,
    /various perspectives/i,
    /pros and cons/i,
    /advantages and disadvantages/i,
  ],

  /**
   * Scar tissue indicators (positive signal)
   * Persistent involuntary residue - NOT formulaic apology language
   */
  scarTissueMarkers: [
    // Physical involuntary reactions
    /still flinch/i,
    /still cringe/i,
    /still wince/i,
    /stomach drops/i,
    /makes me freeze/i,
    /can't look at/i,
    /hard to talk about/i,
    // Temporal persistence
    /even now/i,
    /to this day/i,
    /years later/i,
    /still can't/i,
    /still don't/i,
    /still haven't/i,
    // Present-tense lingering suffering
    /keeps me up/i,
    /haunts me/i,
    /can't shake/i,
    /won't go away/i,
    /lives with me/i,
    // Defensive specificity protecting a wound
    /I hate that I/i,
    /I can't forgive myself/i,
    /the worst part is/i,
    /what kills me is/i,
  ],

  /**
   * Formulaic apology language (negative signal - AI pattern)
   * These should NOT count as scar tissue
   */
  formulaicApologyPatterns: [
    /I am truly sorry/i,
    /I sincerely apologize/i,
    /I take full responsibility/i,
    /I want to apologize/i,
    /please accept my apolog/i,
    /I am committed to/i,
    /moving forward/i,
    /I value our relationship/i,
    /your feelings are valid/i,
    /I understand that my/i,
  ],
};

/**
 * Run quick heuristic analysis on text
 * Returns preliminary signals before LLM analysis
 *
 * @param text - The text to analyze
 * @returns Heuristic scores
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
 * Used to identify POV, focalization, and stylistic modes in fiction
 */
export const NARRATIVE_MODE_SIGNALS = {
  /**
   * First-person protagonist markers
   */
  firstPersonConfessional: [
    /\bI felt\b/i,
    /\bI knew\b/i,
    /\bI remember\b/i,
    /\bmy heart\b/i,
    /\bmy mind\b/i,
    /\bI couldn't\b/i,
    /\bI didn't\b/i,
    /\bI was wrong\b/i,
    /\bI regret\b/i,
  ],

  /**
   * Third-person omniscient markers
   */
  thirdPersonOmniscient: [
    /\bshe thought\b.*\bhe thought\b/is,  // Multiple character thoughts
    /\blittle did (he|she|they) know\b/i,
    /\bunbeknownst to\b/i,
    /\bmeanwhile\b/i,
    /\bin another part of\b/i,
    /\bthe narrator\b/i,
  ],

  /**
   * Third-person limited markers
   */
  thirdPersonLimited: [
    /\b(he|she) wondered\b/i,
    /\b(he|she) felt\b/i,
    /\b(he|she) thought\b/i,
    /\b(he|she) didn't know\b/i,
    /\bit seemed to (him|her)\b/i,
  ],

  /**
   * Stream of consciousness markers (Woolf, Joyce, Faulkner)
   */
  streamOfConsciousness: [
    /—\s*\w/,                           // Em-dash mid-thought shifts
    /\.\.\./g,                           // Ellipses (associative gaps)
    /;\s*[a-z]/,                         // Semicolons before lowercase (stream continuation)
    /\b(and|but|or)\s+[a-z]/g,          // Coordinating conjunctions as thought connectors
    /\byes\b.*\byes\b/i,                // Affirmative repetition (Molly Bloom style)
    /\bremember\b.*\bremember\b/i,      // Memory loops
  ],

  /**
   * Fragmentation indicators (modernist technique)
   */
  fragmentation: [
    /[^.!?]\s*\n\s*[a-z]/,              // Line breaks without sentence ending
    /^[a-z]/m,                           // Lowercase sentence starts
    /\b(no|not|never)\.\s*[A-Z]/,       // Abrupt negations
  ],
};

/**
 * Detect narrative mode and generate appropriate caveat
 * Exposes reasoning about how narrative technique affects SIC interpretation
 *
 * @param text - The text to analyze
 * @param genre - Detected genre (narrative modes only apply to 'narrative' genre)
 * @returns NarrativeModeCaveat or undefined if not applicable
 */
export function detectNarrativeMode(
  text: string,
  genre: string
): NarrativeModeCaveat | undefined {
  // Only generate caveat for narrative genre
  if (genre !== 'narrative') {
    return undefined;
  }

  const signals: string[] = [];
  let mode: NarrativeModeCaveat['mode'] = 'uncertain';
  let confidence = 0.5;

  // Count first-person pronouns
  const firstPersonCount = (text.match(/\bI\b/g) || []).length;
  const thirdPersonCount = (text.match(/\b(he|she|they)\b/gi) || []).length;
  const wordCount = text.split(/\s+/).length;

  const firstPersonDensity = firstPersonCount / wordCount;
  const thirdPersonDensity = thirdPersonCount / wordCount;

  // Detect first-person narrative
  if (firstPersonDensity > 0.02) {
    signals.push(`High first-person pronoun density (${(firstPersonDensity * 100).toFixed(1)}%)`);

    // Check for confessional markers
    const confessionalMatches = NARRATIVE_MODE_SIGNALS.firstPersonConfessional
      .filter(p => p.test(text));

    if (confessionalMatches.length >= 2) {
      mode = 'first_person_confessional';
      confidence = 0.7 + (confessionalMatches.length * 0.05);
      signals.push(`Confessional markers: ${confessionalMatches.length} patterns found`);
    } else {
      mode = 'first_person_observer';
      confidence = 0.6;
      signals.push('First-person but limited confessional markers');
    }
  }

  // Detect third-person modes
  if (thirdPersonDensity > 0.02 && firstPersonDensity < 0.01) {
    signals.push(`Third-person narration detected (${(thirdPersonDensity * 100).toFixed(1)}% pronoun density)`);

    const omniscientMatches = NARRATIVE_MODE_SIGNALS.thirdPersonOmniscient
      .filter(p => p.test(text));
    const limitedMatches = NARRATIVE_MODE_SIGNALS.thirdPersonLimited
      .filter(p => p.test(text));

    if (omniscientMatches.length > 0) {
      mode = 'third_person_omniscient';
      confidence = 0.6 + (omniscientMatches.length * 0.1);
      signals.push(`Omniscient narrator signals: ${omniscientMatches.length}`);
    } else if (limitedMatches.length > 0) {
      mode = 'third_person_limited';
      confidence = 0.6 + (limitedMatches.length * 0.05);
      signals.push(`Limited POV signals: ${limitedMatches.length}`);
    }
  }

  // Detect stream of consciousness (can overlay other modes)
  const socMatches = NARRATIVE_MODE_SIGNALS.streamOfConsciousness
    .filter(p => {
      const matches = text.match(p);
      return matches && matches.length > 0;
    });

  const fragMatches = NARRATIVE_MODE_SIGNALS.fragmentation
    .filter(p => p.test(text));

  if (socMatches.length >= 3 || fragMatches.length >= 2) {
    mode = 'stream_of_consciousness';
    confidence = 0.5 + (socMatches.length * 0.1) + (fragMatches.length * 0.1);
    signals.push(`Stream of consciousness markers: ${socMatches.length} patterns`);
    if (fragMatches.length > 0) {
      signals.push(`Fragmentation signals: ${fragMatches.length}`);
    }
  }

  // Generate interpretation note based on mode
  let interpretationNote: string;
  let standardScoringApplies: boolean;

  switch (mode) {
    case 'first_person_confessional':
      interpretationNote = 'First-person confessional narrative detected. Standard SIC scoring applies well—personal stakes and commitment should be evident.';
      standardScoringApplies = true;
      break;

    case 'first_person_observer':
      interpretationNote = 'First-person observer narrative (narrator describes events involving others). SIC features like bounded_viewpoint should be high, but personal stakes may be displaced.';
      standardScoringApplies = true;
      break;

    case 'third_person_limited':
      interpretationNote = 'Third-person limited POV detected. bounded_viewpoint should be moderate (one character\'s perspective). Commitment features depend on how closely the narrator tracks the focal character.';
      standardScoringApplies = true;
      break;

    case 'third_person_omniscient':
      interpretationNote = 'Third-person omniscient narration detected. Low bounded_viewpoint is appropriate for this mode—the narrator can see into multiple minds. Low SIC may reflect narrative technique rather than AI generation.';
      standardScoringApplies = false;
      break;

    case 'stream_of_consciousness':
      interpretationNote = 'Stream of consciousness technique detected (Woolf, Joyce, Faulkner tradition). Constraint manifests through stylistic fragmentation and associative leaps rather than explicit personal stakes. Low traditional SIC scores may reflect artistic constraint, not AI generation.';
      standardScoringApplies = false;
      break;

    case 'uncertain':
    default:
      interpretationNote = 'Narrative mode uncertain. Multiple signals present or insufficient markers for confident classification. SIC scores should be interpreted with caution.';
      standardScoringApplies = true;
  }

  // If we detected nothing meaningful, return undefined
  if (signals.length === 0) {
    return undefined;
  }

  return {
    mode,
    confidence: Math.min(confidence, 1.0),
    signals,
    interpretationNote,
    standardScoringApplies,
  };
}
