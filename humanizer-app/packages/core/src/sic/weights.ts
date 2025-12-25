/**
 * SIC Signal Weights
 *
 * These weights determine how each signal contributes to the final score.
 * Based on the phenomenological framework: traces of lived constraint.
 */

export const POSITIVE_WEIGHTS = {
  /** P1: Irreversibility / Commitment */
  irreversibility: 0.22,

  /** P2: Temporal Pressure & Sequencing */
  temporalPressure: 0.14,

  /** P3: Epistemic Incompleteness - Lived, Not Hedged */
  epistemicIncompleteness: 0.16,

  /** P4: Value Tradeoffs & Sacrifice */
  valueTradeoffs: 0.18,

  /** P5: Scar Tissue / Residue */
  scarTissue: 0.18,

  /** P6: Situated Embodiment & Stakes */
  embodiment: 0.12,
} as const;

export const NEGATIVE_WEIGHTS = {
  /** N1: Resolution Without Cost */
  resolutionWithoutCost: 0.30,

  /** N2: Manager Voice / Expository Smoothing */
  managerVoice: 0.25,

  /** N3: Symmetry & Coverage Obsession */
  symmetryCoverage: 0.25,

  /** N4: Generic Human Facsimile */
  genericFacsimile: 0.20,
} as const;

// Validate weights sum to 1.0
const positiveSum = Object.values(POSITIVE_WEIGHTS).reduce((a, b) => a + b, 0);
const negativeSum = Object.values(NEGATIVE_WEIGHTS).reduce((a, b) => a + b, 0);

if (Math.abs(positiveSum - 1.0) > 0.001) {
  console.warn(`Positive weights sum to ${positiveSum}, expected 1.0`);
}
if (Math.abs(negativeSum - 1.0) > 0.001) {
  console.warn(`Negative weights sum to ${negativeSum}, expected 1.0`);
}
