/**
 * Position Analyzer
 *
 * Computes where a sentence sits in 5D semantic space.
 * Each dimension is scored -1 to +1 based on linguistic markers.
 */

import type { SemanticPosition, SentenceVector, SemanticRegion } from '../types/vector.js';
import { SEMANTIC_REGIONS } from '../types/vector.js';

/**
 * Analyze a sentence's position in semantic space
 */
export function analyzePosition(text: string, index: number): SentenceVector {
  const position: SemanticPosition = {
    epistemic: computeEpistemic(text),
    commitment: computeCommitment(text),
    temporal: computeTemporal(text),
    embodiment: computeEmbodiment(text),
    stakes: computeStakes(text),
  };

  const magnitude = Math.sqrt(
    position.epistemic ** 2 +
    position.commitment ** 2 +
    position.temporal ** 2 +
    position.embodiment ** 2 +
    position.stakes ** 2
  );

  const dominantDimension = findDominantDimension(position);

  return {
    text,
    index,
    position,
    magnitude,
    dominantDimension,
  };
}

/**
 * Epistemic: certainty (-1) ↔ uncertainty (+1)
 */
function computeEpistemic(text: string): number {
  let score = 0;
  const lower = text.toLowerCase();

  // Certainty markers (push toward -1)
  const certaintyPatterns = [
    /\b(clearly|obviously|certainly|definitely|undoubtedly|without doubt)\b/,
    /\b(it is|this is|that is)\s+(clear|evident|obvious|true)\b/,
    /\b(we know|I know|everyone knows)\b/,
    /\b(the fact is|the truth is|in fact)\b/,
    /\b(must be|has to be|cannot be)\b/,
    /\b(always|never|every|all|none)\b/,
  ];

  // Uncertainty markers (push toward +1)
  const uncertaintyPatterns = [
    /\b(maybe|perhaps|possibly|might|could)\b/,
    /\b(I think|I believe|I suspect|I wonder|I'm not sure)\b/,
    /\b(seems?|appears?|looks? like)\b/,
    /\b(sometimes|often|usually|rarely|occasionally)\b/,
    /\b(I (don't|didn't|can't|couldn't) (know|understand))\b/,
    /\b(unclear|uncertain|ambiguous|confusing)\b/,
    /\?\s*$/,  // Ends with question
  ];

  // Lived uncertainty - not hedging but genuine not-knowing
  const livedUncertainty = [
    /\bI (was|had been) wrong\b/i,
    /\bturns out\b/i,
    /\bsurprised (me|us|to)\b/i,
    /\bnever (thought|expected|imagined)\b/i,
    /\bI thought .{5,40} but\b/i,
  ];

  for (const p of certaintyPatterns) {
    if (p.test(lower)) score -= 0.15;
  }

  for (const p of uncertaintyPatterns) {
    if (p.test(lower)) score += 0.12;
  }

  // Lived uncertainty counts more
  for (const p of livedUncertainty) {
    if (p.test(text)) score += 0.25;
  }

  return clamp(score, -1, 1);
}

/**
 * Commitment: detached (-1) ↔ committed (+1)
 */
function computeCommitment(text: string): number {
  let score = 0;
  const lower = text.toLowerCase();

  // Detachment markers (push toward -1)
  const detachmentPatterns = [
    /\bone (might|could|should|would)\b/,
    /\b(some|many|people|they) (say|think|believe|argue)\b/,
    /\b(it is said|it has been argued|studies show)\b/,
    /\b(in general|generally speaking|typically)\b/,
    /\b(on the one hand|on the other hand)\b/,
    /\b(arguably|potentially|theoretically)\b/,
  ];

  // Commitment markers (push toward +1)
  const commitmentPatterns = [
    /\bI (decided|committed|chose|will|won't|refuse|insist)\b/i,
    /\b(I|we) (did|made|took)\b/i,
    /\bmy (choice|decision|commitment|promise)\b/i,
    /\bno (going|turning) back\b/i,
    /\bI (have to|must|need to)\b/i,
    /\b(I'm|I am) (going to|determined to)\b/i,
  ];

  // Irreversibility - highest commitment
  const irreversibility = [
    /\bcan('?t|not) (undo|take back|unsay)\b/i,
    /\birreversible|permanent(ly)?\b/i,
    /\bit cost (me|us)\b/i,
    /\b(paid|suffered) the (price|consequence)\b/i,
  ];

  for (const p of detachmentPatterns) {
    if (p.test(lower)) score -= 0.12;
  }

  for (const p of commitmentPatterns) {
    if (p.test(text)) score += 0.18;
  }

  for (const p of irreversibility) {
    if (p.test(text)) score += 0.30;
  }

  return clamp(score, -1, 1);
}

/**
 * Temporal: abstract/timeless (-1) ↔ situated-in-time (+1)
 */
function computeTemporal(text: string): number {
  let score = 0;
  const lower = text.toLowerCase();

  // Timeless/abstract (push toward -1)
  const abstractPatterns = [
    /\b(always|eternally|universally|timelessly)\b/,
    /\b(in principle|by definition|by nature)\b/,
    /\b(is|are|be) (a|an|the) .{0,20} (that|which|who)\b/,  // Definitional
    /\b(every|all|any) .{0,15} (is|are|has|have)\b/,  // Universal claims
  ];

  // Situated in time (push toward +1)
  const temporalPatterns = [
    /\b(yesterday|today|tomorrow|last (week|month|year)|this morning)\b/,
    /\b(suddenly|immediately|instantly|then|next)\b/,
    /\b(before|after|during|while|when|until)\b/,
    /\bin (that|the|this) moment\b/,
    /\bright (then|now|there)\b/,
    /\b(just|already|still|yet|soon)\b/,
  ];

  // Temporal pressure - urgency
  const pressure = [
    /\bbefore (I|we) (could|had)\b/i,
    /\btoo late\b/i,
    /\btime (ran out|was running out|is running out)\b/i,
    /\bhad to (act|decide|choose) (now|fast|quickly)\b/i,
    /\blooking back\b/i,
    /\bat the time\b/i,
  ];

  for (const p of abstractPatterns) {
    if (p.test(lower)) score -= 0.15;
  }

  for (const p of temporalPatterns) {
    if (p.test(lower)) score += 0.10;
  }

  for (const p of pressure) {
    if (p.test(text)) score += 0.25;
  }

  return clamp(score, -1, 1);
}

/**
 * Embodiment: disembodied (-1) ↔ corporeal (+1)
 */
function computeEmbodiment(text: string): number {
  let score = 0;
  const lower = text.toLowerCase();

  // Disembodied/abstract (push toward -1)
  const disembodiedPatterns = [
    /\b(concept|idea|notion|theory|principle|abstraction)\b/,
    /\b(conceptually|theoretically|philosophically|logically)\b/,
    /\b(implies|suggests|indicates|demonstrates)\b/,
    /\b(framework|structure|system|model|paradigm)\b/,
  ];

  // Corporeal/sensory (push toward +1)
  const embodimentPatterns = [
    /\bmy (heart|stomach|hands|chest|throat|head|back|legs)\b/i,
    /\b(felt|feeling) (sick|nauseous|dizzy|shaky|cold|hot|warm|tight)\b/i,
    /\bcouldn'?t (breathe|move|speak|swallow)\b/i,
    /\b(saw|heard|smelled|tasted|touched|felt)\b/,
    /\b(red|blue|green|loud|quiet|rough|smooth|hot|cold|wet|dry)\b/,
  ];

  // Place anchoring
  const placePatterns = [
    /\b(standing|sitting|lying|walking|running)\s+(there|in|at|on)\b/i,
    /\bin (the|a) (room|kitchen|car|office|street|park|house)\b/i,
    /\b(outside|inside|upstairs|downstairs|nearby)\b/,
  ];

  for (const p of disembodiedPatterns) {
    if (p.test(lower)) score -= 0.12;
  }

  for (const p of embodimentPatterns) {
    if (p.test(text)) score += 0.20;
  }

  for (const p of placePatterns) {
    if (p.test(text)) score += 0.15;
  }

  return clamp(score, -1, 1);
}

/**
 * Stakes: hypothetical (-1) ↔ consequential (+1)
 */
function computeStakes(text: string): number {
  let score = 0;
  const lower = text.toLowerCase();

  // Hypothetical/low stakes (push toward -1)
  const hypotheticalPatterns = [
    /\b(imagine|suppose|consider|let's say|what if)\b/,
    /\b(in theory|hypothetically|potentially)\b/,
    /\b(example|instance|illustration|case study)\b/,
    /\b(one could|one might|it is possible)\b/,
  ];

  // Real stakes (push toward +1)
  const stakesPatterns = [
    /\b(if (I|we|this) fail(s|ed)?|when (I|we) (lose|lost))\b/i,
    /\b(job|marriage|friendship|relationship|trust) (is|was|were) (on|at)\b/i,
    /\b(reputation|career|life|health|safety) (at stake|on the line)\b/i,
    /\b(everyone|they|people) (was|were) (watching|looking|waiting)\b/i,
    /\bwhat (would|will) (they|people) think\b/i,
  ];

  // Consequence acknowledgment
  const consequencePatterns = [
    /\bconsequences? (of|from)\b/i,
    /\bprice (I|we) paid\b/i,
    /\bcost (me|us|him|her|them)\b/i,
    /\b(ruined|destroyed|damaged|lost)\b/,
  ];

  for (const p of hypotheticalPatterns) {
    if (p.test(lower)) score -= 0.15;
  }

  for (const p of stakesPatterns) {
    if (p.test(text)) score += 0.25;
  }

  for (const p of consequencePatterns) {
    if (p.test(text)) score += 0.18;
  }

  return clamp(score, -1, 1);
}

/**
 * Find which dimension has the highest absolute value
 */
function findDominantDimension(pos: SemanticPosition): keyof SemanticPosition {
  const entries = Object.entries(pos) as [keyof SemanticPosition, number][];
  entries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  return entries[0][0];
}

/**
 * Identify which named region a position falls into
 */
export function identifyRegion(pos: SemanticPosition): SemanticRegion | 'uncharted' {
  for (const [name, constraints] of Object.entries(SEMANTIC_REGIONS)) {
    let matches = true;
    for (const [dim, [min, max]] of Object.entries(constraints)) {
      const value = pos[dim as keyof SemanticPosition];
      if (value < min || value > max) {
        matches = false;
        break;
      }
    }
    if (matches) return name as SemanticRegion;
  }
  return 'uncharted';
}

/**
 * Compute Euclidean distance between two positions
 */
export function positionDistance(a: SemanticPosition, b: SemanticPosition): number {
  return Math.sqrt(
    (a.epistemic - b.epistemic) ** 2 +
    (a.commitment - b.commitment) ** 2 +
    (a.temporal - b.temporal) ** 2 +
    (a.embodiment - b.embodiment) ** 2 +
    (a.stakes - b.stakes) ** 2
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
