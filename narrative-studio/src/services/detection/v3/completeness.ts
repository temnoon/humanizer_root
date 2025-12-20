/**
 * Completeness Classifier
 *
 * Detects whether a text sample is a complete work or an excerpt.
 * This is CRITICAL for Chekhov ratio weighting:
 *
 * - Complete works: Entities introduced AND resolved in same text → full Chekhov weight
 * - Excerpts: Entities may be fulfilled outside the sample → reduced Chekhov weight
 *
 * The Problem: AI samples are typically complete 800-word stories.
 *              Human samples from Gutenberg are excerpts from novels.
 *              Without adjustment, excerpts falsely score as "AI-like" because
 *              their entity fulfillment happens outside the visible text.
 */

import { DEFAULT_CONFIG } from './types.js';
import type { V3Config } from './types.js';

// ============================================================
// Types
// ============================================================

export interface CompletenessAnalysis {
  // Classification
  classification: 'COMPLETE' | 'EXCERPT' | 'UNCERTAIN';
  confidence: number;  // 0-1

  // Component scores
  openingScore: number;     // Higher = has proper opening/establishment
  closingScore: number;     // Higher = has resolution/conclusion
  arcScore: number;         // Higher = has setup-conflict-resolution arc
  excerptIndicatorScore: number;  // Higher = MORE excerpt-like (inverted for final)

  // Raw signals found
  signals: {
    openingPatterns: string[];
    closingPatterns: string[];
    arcMarkers: string[];
    excerptIndicators: string[];
  };

  // Recommended Chekhov weight adjustment
  recommendedChekhovWeight: number;  // 0.15-0.40
}

// ============================================================
// Pattern Definitions
// ============================================================

/**
 * Opening patterns that suggest a complete work beginning.
 */
const OPENING_PATTERNS = {
  // Markdown/Title header (very strong indicator of complete work)
  title: [
    /^#\s+[A-Z]/,  // "# The Title"
    /^##\s+[A-Z]/,  // "## Subtitle"
    /^\*\*[A-Z][^*]+\*\*/,  // **Title Here**
    /^_[A-Z][^_]+_\s*$/m,  // _Title Here_
  ],
  // Strong establishment openers
  temporal: [
    /^(?:In|On|During)\s+(?:the\s+)?(?:year|month|day|morning|evening|summer|winter|spring|fall|autumn)\s+(?:of\s+)?\d{4}/i,
    /^(?:It was|That was)\s+(?:a|the)\s+(?:day|night|morning|evening|summer|winter)/i,
    /^(?:Once|Long ago|Years ago|Many years ago)/i,
    /^The\s+(?:year|day|night|summer|winter)\s+(?:was|that|when)/i,
  ],
  // Character introduction openers
  character: [
    /^(?:There was|There lived)\s+(?:once\s+)?(?:a|an)/i,
    /^[A-Z][a-z]+\s+was\s+(?:a|an|the)\s+[a-z]+/,  // "Sarah was a teacher"
    /^(?:My|Our)\s+(?:name|story)\s+(?:is|begins)/i,
    /^I\s+(?:was born|grew up|remember|never|always)/i,
  ],
  // Scene establishment
  scene: [
    /^The\s+(?:village|town|city|house|room|forest|mountain|sea|shop|store|smoothie|office|hotel)\s+(?:of|was|had)/i,
    /^(?:In|At)\s+(?:the\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:,|\.|\s+there)/,  // "In New York, there..."
    /^(?:Here|This)\s+(?:is|was|begins)\s+(?:the|a|my)/i,
    /^The\s+[a-z]+\s+(?:shop|store|restaurant|cafe|bar)\s+had/i,  // "The smoothie shop had"
  ],
  // Meta-narrative openers (essays, reflections)
  meta: [
    /^(?:What|When|Why|How)\s+(?:I|we|one)\s+(?:learned|discovered|realized)/i,
    /^(?:The|A)\s+(?:question|problem|truth|lesson)\s+(?:of|is|that)/i,
    /^(?:I've|I have)\s+(?:always|often|never)\s+(?:wondered|thought|believed)/i,
  ],
};

/**
 * Closing patterns that suggest a complete work ending.
 */
const CLOSING_PATTERNS = {
  // Dialogue endings (very common in AI stories - final line of dialogue)
  dialogue: [
    /"[^"]{10,}[.!]"\s*$/,  // Ends with dialogue followed by period/exclamation
    /"[^"]+\.\s*$/,  // Ends with quoted dialogue
    /said\s+[A-Z][a-z]+\.\s*$/,  // "...said Marcus."
  ],
  // Resolution markers
  resolution: [
    /(?:finally|at last|in the end|eventually)\s+(?:I|we|he|she|they|it)\s+(?:understood|realized|knew|found)/i,
    /(?:And so|Thus|Therefore|In this way)\s+(?:I|we|he|she|they|it)/i,
    /(?:ever after|from that day|since then|to this day)/i,
    /(?:came to|learned to|began to)\s+(?:understand|accept|appreciate|see)/i,
  ],
  // Conclusion markers
  conclusion: [
    /(?:The end|Fin|Finis)\.?\s*$/i,
    /(?:And that|That|This)\s+(?:is|was)\s+(?:how|why|when|the)\s+/i,
    /(?:Looking back|In retrospect|Now I|Today I)\s+(?:know|understand|see|realize)/i,
  ],
  // Moral/lesson statements (common in complete short pieces)
  moral: [
    /(?:The|A|This)\s+(?:lesson|moral|truth|point)\s+(?:is|was|being)/i,
    /(?:I|We)\s+(?:learned|discovered|realized)\s+(?:that|what)/i,
    /(?:never|always)\s+(?:forget|remember)\s+(?:that|what|how)/i,
  ],
  // Cyclical/callback endings
  cyclical: [
    /(?:back to|returned to|once again|just as)\s+(?:where|when|the)/i,
  ],
  // Final action/gesture endings
  action: [
    /(?:turned|walked|left|smiled|nodded|laughed)\s+(?:and|away|quietly|slowly).*\.$/i,
    /(?:closed|opened|picked up|put down|let go).*\.$/i,
  ],
  // Reflective/epiphany endings (very common in AI stories)
  reflective: [
    /(?:learning|realizing|understanding|discovering|knowing|seeing)\s+that\s+.{20,}\.$/i,
    /had\s+been[^.]*(?:incomplete|wrong|different|changed|transformed)\.$/i,
    /(?:finally|at last|now)\s+(?:understood|knew|saw|realized)\s+.{10,}\.$/i,
    /(?:for now|for the moment|right now)[^.]*\.$/i,  // "For now, she just sat..."
  ],
};

/**
 * Arc markers - suggest presence of narrative structure.
 */
const ARC_MARKERS = {
  // Conflict introduction
  conflict: [
    /(?:but|however|yet|unfortunately|suddenly|then)\s+(?:one day|everything|something)/i,
    /(?:the|a)\s+(?:problem|trouble|crisis|disaster|challenge)\s+(?:was|began|came)/i,
    /(?:everything|things)\s+(?:changed|fell apart|went wrong)/i,
    /(?:I|we|he|she|they)\s+(?:had to|needed to|must|couldn't)/i,
  ],
  // Climax markers
  climax: [
    /(?:finally|at last|then)\s+(?:I|we|he|she|they)\s+(?:decided|realized|understood|knew)/i,
    /(?:the|that)\s+(?:moment|instant|day)\s+(?:when|that|everything)/i,
    /(?:it|this)\s+(?:was|became)\s+(?:clear|obvious|evident|apparent)/i,
  ],
  // Transition markers (suggest multi-phase structure)
  transition: [
    /(?:years|months|weeks|days)\s+(?:later|passed|went by)/i,
    /(?:first|then|next|after that|finally)/i,
    /(?:in the beginning|at first|initially)\s+/i,
  ],
};

/**
 * Excerpt indicators - suggest this is part of a larger work.
 */
const EXCERPT_INDICATORS = {
  // Mid-scene start (no establishment)
  midScene: [
    /^"[^"]+"\s+(?:said|asked|replied|shouted)/i,  // Opens with dialogue
    /^(?:He|She|They|It)\s+(?:was|were|had|looked|turned)/i,  // Pronoun with no antecedent
    /^The\s+(?:man|woman|boy|girl|child|stranger)\s+(?:who|that|had)/i,  // Definite article for unintroduced character
  ],
  // External references
  externalRef: [
    /(?:as\s+)?(?:mentioned|noted|said|stated|described)\s+(?:earlier|before|above|previously)/i,
    /(?:in|from)\s+(?:the\s+)?(?:previous|last|earlier)\s+(?:chapter|section|part)/i,
    /(?:as we|as I)\s+(?:saw|discussed|learned|read)/i,
    /(?:see|refer to|cf\.?)\s+(?:chapter|section|page|above)/i,
  ],
  // Unresolved ending
  unresolvedEnd: [
    /(?:to be continued|continued in|more on this)/i,
    /(?:but that|but this)\s+(?:is|was)\s+(?:another|a different)\s+(?:story|matter)/i,
    /\.{3}\s*$/,  // Ends with ellipsis
  ],
  // Chapter markers (mid-book)
  chapterMarkers: [
    /^(?:Chapter|Part|Section|Book)\s+(?:\d+|[IVXLC]+|One|Two|Three)/i,
    /^\s*[IVXLC]+\s*$/,  // Roman numeral alone
  ],
  // Unexplained character knowledge
  unexplainedKnowledge: [
    /(?:remembered|recalled|thought of)\s+(?:the|that)\s+(?:time|day|conversation)/i,
  ],
};

// ============================================================
// Analysis Functions
// ============================================================

/**
 * Analyze text for completeness.
 */
export function analyzeCompleteness(
  text: string,
  _config: V3Config = DEFAULT_CONFIG
): CompletenessAnalysis {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

  if (sentences.length === 0) {
    return createEmptyAnalysis();
  }

  // Get opening and closing sections
  const openingText = sentences.slice(0, Math.min(3, sentences.length)).join(' ');
  const closingText = sentences.slice(-Math.min(3, sentences.length)).join(' ');

  // Analyze each component
  const openingResult = analyzeOpening(text);  // Pass full text for title detection
  const closingResult = analyzeClosing(closingText);
  const arcResult = analyzeArc(text);
  const excerptResult = analyzeExcerptIndicators(text, openingText, closingText);

  // Calculate component scores
  const openingScore = openingResult.score;
  const closingScore = closingResult.score;
  const arcScore = arcResult.score;
  const excerptIndicatorScore = excerptResult.score;

  // Word count heuristic: 600-1000 words is typical "complete" AI story
  // This range strongly suggests a complete work (prompted for ~800 words)
  const isTypicalCompleteLength = wordCount >= 600 && wordCount <= 1200;

  // Markdown title is a VERY strong signal - human excerpts never have markdown titles
  const hasMarkdownTitle = openingResult.patterns.some(p => p.startsWith('title:'));

  // Composite: Higher = more complete
  // excerpt indicator is inverted (high = more excerpt-like = less complete)
  let compositeScore = (
    openingScore * 0.25 +
    closingScore * 0.35 +   // Closing is most important
    arcScore * 0.25 +
    (1 - excerptIndicatorScore) * 0.15
  );

  // Arc markers found
  const hasArcMarkers = arcResult.markers.length >= 2;

  // Boost for markdown title + appropriate length (very strong complete signal)
  if (hasMarkdownTitle && isTypicalCompleteLength) {
    compositeScore = Math.max(compositeScore, 0.55);  // At least COMPLETE threshold
  }
  // Boost for markdown title alone
  else if (hasMarkdownTitle) {
    compositeScore += 0.15;
  }
  // Boost for arc markers + appropriate length (likely prompted complete work)
  else if (hasArcMarkers && isTypicalCompleteLength) {
    compositeScore += 0.15;  // Moderate boost - less certain than markdown title
  }
  // Boost for arc markers + closing dialogue (complete story pattern)
  else if (hasArcMarkers && closingResult.score >= 0.5) {
    compositeScore += 0.12;
  }

  // Classification
  let classification: CompletenessAnalysis['classification'];
  let confidence: number;

  if (compositeScore >= 0.55) {
    classification = 'COMPLETE';
    confidence = Math.min((compositeScore - 0.5) * 2, 0.95);
  } else if (compositeScore <= 0.35) {
    classification = 'EXCERPT';
    confidence = Math.min((0.4 - compositeScore) * 2.5, 0.95);
  } else {
    classification = 'UNCERTAIN';
    confidence = 0.3 + (0.5 - Math.abs(compositeScore - 0.45)) * 0.8;
  }

  // Recommend Chekhov weight based on classification
  let recommendedChekhovWeight: number;
  if (classification === 'COMPLETE') {
    recommendedChekhovWeight = 0.40;  // Full weight
  } else if (classification === 'EXCERPT') {
    recommendedChekhovWeight = 0.15;  // Reduced weight
  } else {
    recommendedChekhovWeight = 0.25;  // Moderate weight
  }

  return {
    classification,
    confidence,
    openingScore,
    closingScore,
    arcScore,
    excerptIndicatorScore,
    signals: {
      openingPatterns: openingResult.patterns,
      closingPatterns: closingResult.patterns,
      arcMarkers: arcResult.markers,
      excerptIndicators: excerptResult.indicators,
    },
    recommendedChekhovWeight,
  };
}

/**
 * Analyze opening for establishment patterns.
 */
function analyzeOpening(openingText: string): { score: number; patterns: string[] } {
  const foundPatterns: string[] = [];

  // Check each category
  for (const [category, patterns] of Object.entries(OPENING_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(openingText)) {
        foundPatterns.push(`${category}:${pattern.source.slice(0, 30)}`);
      }
    }
  }

  // Score: 0 patterns = 0.2, 1 pattern = 0.6, 2+ patterns = 0.9
  const score = foundPatterns.length === 0
    ? 0.2
    : Math.min(0.4 + foundPatterns.length * 0.25, 0.9);

  return { score, patterns: foundPatterns };
}

/**
 * Analyze closing for resolution patterns.
 */
function analyzeClosing(closingText: string): { score: number; patterns: string[] } {
  const foundPatterns: string[] = [];

  for (const [category, patterns] of Object.entries(CLOSING_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(closingText)) {
        foundPatterns.push(`${category}:${pattern.source.slice(0, 30)}`);
      }
    }
  }

  // Score: 0 patterns = 0.15, 1 pattern = 0.6, 2+ patterns = 0.9
  const score = foundPatterns.length === 0
    ? 0.15
    : Math.min(0.35 + foundPatterns.length * 0.25, 0.9);

  return { score, patterns: foundPatterns };
}

/**
 * Analyze for narrative arc markers.
 */
function analyzeArc(text: string): { score: number; markers: string[] } {
  const foundMarkers: string[] = [];

  // Check for conflict, climax, and transitions
  let hasConflict = false;
  let hasClimax = false;
  let hasTransitions = false;

  for (const pattern of ARC_MARKERS.conflict) {
    if (pattern.test(text)) {
      hasConflict = true;
      foundMarkers.push(`conflict:${pattern.source.slice(0, 25)}`);
      break;
    }
  }

  for (const pattern of ARC_MARKERS.climax) {
    if (pattern.test(text)) {
      hasClimax = true;
      foundMarkers.push(`climax:${pattern.source.slice(0, 25)}`);
      break;
    }
  }

  let transitionCount = 0;
  for (const pattern of ARC_MARKERS.transition) {
    const matches = text.match(new RegExp(pattern.source, 'gi'));
    if (matches) {
      transitionCount += matches.length;
      if (transitionCount <= 3) {
        foundMarkers.push(`transition:${pattern.source.slice(0, 25)}`);
      }
    }
  }
  hasTransitions = transitionCount >= 2;

  // Score based on presence of arc elements
  // Complete arc = conflict + climax + transitions
  let score = 0.2;  // Baseline
  if (hasConflict) score += 0.25;
  if (hasClimax) score += 0.30;
  if (hasTransitions) score += 0.15;

  return { score: Math.min(score, 0.9), markers: foundMarkers };
}

/**
 * Analyze for excerpt indicators.
 */
function analyzeExcerptIndicators(
  text: string,
  openingText: string,
  closingText: string
): { score: number; indicators: string[] } {
  const foundIndicators: string[] = [];

  // Check mid-scene start
  for (const pattern of EXCERPT_INDICATORS.midScene) {
    if (pattern.test(openingText)) {
      foundIndicators.push(`midScene:${pattern.source.slice(0, 25)}`);
    }
  }

  // Check external references
  for (const pattern of EXCERPT_INDICATORS.externalRef) {
    if (pattern.test(text)) {
      foundIndicators.push(`externalRef:${pattern.source.slice(0, 25)}`);
    }
  }

  // Check unresolved ending
  for (const pattern of EXCERPT_INDICATORS.unresolvedEnd) {
    if (pattern.test(closingText)) {
      foundIndicators.push(`unresolvedEnd:${pattern.source.slice(0, 25)}`);
    }
  }

  // Check chapter markers
  for (const pattern of EXCERPT_INDICATORS.chapterMarkers) {
    if (pattern.test(text)) {
      foundIndicators.push(`chapterMarker:${pattern.source.slice(0, 25)}`);
    }
  }

  // Score: 0 indicators = 0.1, 1 = 0.4, 2 = 0.65, 3+ = 0.85
  const score = foundIndicators.length === 0
    ? 0.1
    : Math.min(0.2 + foundIndicators.length * 0.22, 0.85);

  return { score, indicators: foundIndicators };
}

/**
 * Create empty analysis for edge cases.
 */
function createEmptyAnalysis(): CompletenessAnalysis {
  return {
    classification: 'UNCERTAIN',
    confidence: 0,
    openingScore: 0.5,
    closingScore: 0.5,
    arcScore: 0.5,
    excerptIndicatorScore: 0.5,
    signals: {
      openingPatterns: [],
      closingPatterns: [],
      arcMarkers: [],
      excerptIndicators: [],
    },
    recommendedChekhovWeight: 0.25,
  };
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Get a human-readable summary of the completeness analysis.
 */
export function getCompletenessSummary(analysis: CompletenessAnalysis): string {
  const { classification, confidence, recommendedChekhovWeight } = analysis;
  const pct = (n: number) => (n * 100).toFixed(0);

  return `Completeness: ${classification} (${pct(confidence)}% confidence) → Chekhov weight: ${pct(recommendedChekhovWeight)}%`;
}

/**
 * Quick check if text is likely a complete work.
 */
export function isLikelyComplete(text: string): boolean {
  const analysis = analyzeCompleteness(text);
  return analysis.classification === 'COMPLETE';
}

/**
 * Quick check if text is likely an excerpt.
 */
export function isLikelyExcerpt(text: string): boolean {
  const analysis = analyzeCompleteness(text);
  return analysis.classification === 'EXCERPT';
}
