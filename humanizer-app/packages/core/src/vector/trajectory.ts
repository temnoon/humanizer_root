/**
 * Trajectory Analyzer
 *
 * Analyzes how a passage moves through semantic space:
 * - Sentence-by-sentence position vectors
 * - Inflection points where the text pivots
 * - Summary statistics about the journey
 */

import type {
  PassageRho,
  SentenceVector,
  Inflection,
  SemanticPosition,
  CraftMetrics,
} from '../types/vector.js';
import { analyzePosition, identifyRegion, positionDistance } from './position.js';
import { computeCraftMetrics } from './craft.js';
import { tokenize } from '../sentence/tokenizer.js';

/**
 * Full passage analysis - computes the density matrix (rho)
 */
export function analyzePassage(text: string): PassageRho {
  // Tokenize into sentences
  const sentenceObjects = tokenize(text);
  const sentences = sentenceObjects.map(s => s.text);

  // Compute position vector for each sentence
  const vectors: SentenceVector[] = sentences.map((s: string, i: number) => analyzePosition(s, i));

  // Detect inflection points
  const inflections = detectInflections(vectors);

  // Extract trajectory (just the positions)
  const trajectory = vectors.map(v => v.position);

  // Compute craft metrics
  const craft = computeCraftMetrics(text, sentences, vectors);

  // Compute summary statistics
  const summary = computeSummary(vectors, inflections, craft);

  return {
    text,
    sentences: vectors,
    inflections,
    trajectory,
    craft,
    summary,
  };
}

/**
 * Detect inflection points - where the text pivots significantly
 */
function detectInflections(vectors: SentenceVector[]): Inflection[] {
  const inflections: Inflection[] = [];
  const threshold = 0.6; // Minimum distance to count as inflection

  for (let i = 1; i < vectors.length; i++) {
    const prev = vectors[i - 1];
    const curr = vectors[i];

    const distance = positionDistance(prev.position, curr.position);

    if (distance >= threshold) {
      const fromRegion = identifyRegion(prev.position);
      const toRegion = identifyRegion(curr.position);

      // Find which dimension shifted most
      const shifts: [keyof SemanticPosition, number][] = [
        ['epistemic', Math.abs(curr.position.epistemic - prev.position.epistemic)],
        ['commitment', Math.abs(curr.position.commitment - prev.position.commitment)],
        ['temporal', Math.abs(curr.position.temporal - prev.position.temporal)],
        ['embodiment', Math.abs(curr.position.embodiment - prev.position.embodiment)],
        ['stakes', Math.abs(curr.position.stakes - prev.position.stakes)],
      ];
      shifts.sort((a, b) => b[1] - a[1]);

      inflections.push({
        sentenceIndex: i,
        text: curr.text,
        from: fromRegion,
        to: toRegion,
        magnitude: distance,
        primaryShift: shifts[0][0],
      });
    }
  }

  return inflections;
}

/**
 * Compute summary statistics
 */
function computeSummary(
  vectors: SentenceVector[],
  inflections: Inflection[],
  craft: CraftMetrics
): PassageRho['summary'] {
  if (vectors.length === 0) {
    const zero: SemanticPosition = {
      epistemic: 0,
      commitment: 0,
      temporal: 0,
      embodiment: 0,
      stakes: 0,
    };
    return {
      centroid: zero,
      variance: zero,
      coverage: 0,
      journeyLength: 0,
      inflectionCount: 0,
      dominantRegion: 'neutral-expository',
    };
  }

  // Compute centroid (average position)
  const centroid: SemanticPosition = {
    epistemic: 0,
    commitment: 0,
    temporal: 0,
    embodiment: 0,
    stakes: 0,
  };

  for (const v of vectors) {
    centroid.epistemic += v.position.epistemic;
    centroid.commitment += v.position.commitment;
    centroid.temporal += v.position.temporal;
    centroid.embodiment += v.position.embodiment;
    centroid.stakes += v.position.stakes;
  }

  const n = vectors.length;
  centroid.epistemic /= n;
  centroid.commitment /= n;
  centroid.temporal /= n;
  centroid.embodiment /= n;
  centroid.stakes /= n;

  // Compute variance
  const variance: SemanticPosition = {
    epistemic: 0,
    commitment: 0,
    temporal: 0,
    embodiment: 0,
    stakes: 0,
  };

  for (const v of vectors) {
    variance.epistemic += (v.position.epistemic - centroid.epistemic) ** 2;
    variance.commitment += (v.position.commitment - centroid.commitment) ** 2;
    variance.temporal += (v.position.temporal - centroid.temporal) ** 2;
    variance.embodiment += (v.position.embodiment - centroid.embodiment) ** 2;
    variance.stakes += (v.position.stakes - centroid.stakes) ** 2;
  }

  variance.epistemic = Math.sqrt(variance.epistemic / n);
  variance.commitment = Math.sqrt(variance.commitment / n);
  variance.temporal = Math.sqrt(variance.temporal / n);
  variance.embodiment = Math.sqrt(variance.embodiment / n);
  variance.stakes = Math.sqrt(variance.stakes / n);

  // Coverage: how much of the 5D space is traversed
  // Sum of variances normalized by max possible (each dimension -1 to +1, max variance ~1)
  const totalVariance =
    variance.epistemic +
    variance.commitment +
    variance.temporal +
    variance.embodiment +
    variance.stakes;
  const coverage = Math.min(1, totalVariance / 2.5);

  // Journey length: total semantic distance traveled
  const journeyLength = craft.velocity.totalDistance;

  // Dominant region: where centroid falls
  const dominantRegion = identifyRegion(centroid);

  return {
    centroid,
    variance,
    coverage,
    journeyLength,
    inflectionCount: inflections.length,
    dominantRegion,
  };
}

/**
 * Compare two passages by their trajectories
 */
export function compareTrajectories(a: PassageRho, b: PassageRho): TrajectoryComparison {
  const centroidDistance = positionDistance(a.summary.centroid, b.summary.centroid);

  // Compare craft metrics
  const craftDiff = {
    compression: a.craft.compression.score - b.craft.compression.score,
    surprise: a.craft.surprise.score - b.craft.surprise.score,
    specificity: a.craft.specificity.score - b.craft.specificity.score,
    tension: a.craft.tension.score - b.craft.tension.score,
    velocity: a.craft.velocity.score - b.craft.velocity.score,
  };

  return {
    centroidDistance,
    aRegion: a.summary.dominantRegion,
    bRegion: b.summary.dominantRegion,
    sameRegion: a.summary.dominantRegion === b.summary.dominantRegion,
    craftDiff,
    coverageDiff: a.summary.coverage - b.summary.coverage,
    inflectionDiff: a.summary.inflectionCount - b.summary.inflectionCount,
  };
}

export interface TrajectoryComparison {
  centroidDistance: number;
  aRegion: string;
  bRegion: string;
  sameRegion: boolean;
  craftDiff: {
    compression: number;
    surprise: number;
    specificity: number;
    tension: number;
    velocity: number;
  };
  coverageDiff: number;
  inflectionDiff: number;
}

/**
 * Format trajectory for display
 */
export function formatTrajectory(rho: PassageRho): string {
  const lines: string[] = [];

  lines.push(`Passage Analysis (${rho.sentences.length} sentences)`);
  lines.push('═'.repeat(50));

  // Summary
  lines.push(`\nDominant Region: ${rho.summary.dominantRegion}`);
  lines.push(`Coverage: ${(rho.summary.coverage * 100).toFixed(0)}%`);
  lines.push(`Journey Length: ${rho.summary.journeyLength.toFixed(2)}`);
  lines.push(`Inflections: ${rho.summary.inflectionCount}`);

  // Centroid
  lines.push(`\nCentroid Position:`);
  const c = rho.summary.centroid;
  lines.push(`  epistemic:  ${formatBar(c.epistemic)}`);
  lines.push(`  commitment: ${formatBar(c.commitment)}`);
  lines.push(`  temporal:   ${formatBar(c.temporal)}`);
  lines.push(`  embodiment: ${formatBar(c.embodiment)}`);
  lines.push(`  stakes:     ${formatBar(c.stakes)}`);

  // Craft metrics
  lines.push(`\nCraft Metrics:`);
  lines.push(`  Compression: ${(rho.craft.compression.score * 100).toFixed(0)}% (${rho.craft.compression.wordsPerSentence.toFixed(1)} words/sentence)`);
  lines.push(`  Surprise:    ${(rho.craft.surprise.score * 100).toFixed(0)}% (${rho.craft.surprise.unusualTransitions} unusual transitions)`);
  lines.push(`  Specificity: ${(rho.craft.specificity.score * 100).toFixed(0)}% (${rho.craft.specificity.concreteNouns} concrete nouns)`);
  lines.push(`  Tension:     ${(rho.craft.tension.score * 100).toFixed(0)}% (${rho.craft.tension.openQuestions} open questions)`);
  lines.push(`  Velocity:    ${(rho.craft.velocity.score * 100).toFixed(0)}% (avg distance: ${rho.craft.velocity.averageDistance.toFixed(2)})`);

  // Inflections
  if (rho.inflections.length > 0) {
    lines.push(`\nInflection Points:`);
    for (const inf of rho.inflections.slice(0, 5)) {
      const preview = inf.text.slice(0, 60) + (inf.text.length > 60 ? '...' : '');
      lines.push(`  [${inf.sentenceIndex}] ${inf.from} → ${inf.to} (${inf.primaryShift})`);
      lines.push(`      "${preview}"`);
    }
    if (rho.inflections.length > 5) {
      lines.push(`  ... and ${rho.inflections.length - 5} more`);
    }
  }

  return lines.join('\n');
}

function formatBar(value: number): string {
  // -1 to +1 mapped to visual bar
  const normalized = (value + 1) / 2; // 0 to 1
  const width = 20;
  const filled = Math.round(normalized * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  const sign = value >= 0 ? '+' : '';
  return `[${bar}] ${sign}${value.toFixed(2)}`;
}
