/**
 * SIC Constants
 *
 * Default weights and genre baselines for SIC analysis.
 */

import type { SicWeights, Genre, SicFeatureKey } from '../types.js';

/**
 * Default weights for SIC feature scoring
 */
export const DEFAULT_SIC_WEIGHTS: SicWeights = {
  commitment_irreversibility: 0.22,
  epistemic_risk_uncertainty: 0.16,
  time_pressure_tradeoffs: 0.14,
  situatedness_body_social: 0.12,
  scar_tissue_specificity: 0.18,
  bounded_viewpoint: 0.18,
  anti_smoothing_penalty: 0.30,
  meta_contamination_penalty: 0.25,
};

/**
 * Genre baseline adjustments
 * Low SIC in technical/legal writing is appropriate, not a false positive
 */
export const GENRE_BASELINES: Record<Genre, number> = {
  narrative: 0,      // No adjustment - high SIC expected
  argument: -5,      // Slight adjustment - some formality expected
  technical: -25,    // Significant adjustment - professional suppression expected
  legal: -30,        // Major adjustment - intentional objectivity
  marketing: -10,    // Some adjustment - promotional voice expected
  unknown: 0,        // No adjustment
};

/**
 * Feature keys for iteration
 */
export const SIC_FEATURE_KEYS: SicFeatureKey[] = [
  'commitment_irreversibility',
  'epistemic_risk_uncertainty',
  'time_pressure_tradeoffs',
  'situatedness_body_social',
  'scar_tissue_specificity',
  'bounded_viewpoint',
  'anti_smoothing',
  'meta_contamination',
];

/**
 * Feature descriptions for documentation
 */
export const FEATURE_DESCRIPTIONS: Record<SicFeatureKey, string> = {
  commitment_irreversibility:
    'Concrete decisions with consequences. "Humans trap themselves. LLMs keep exits open."',
  epistemic_risk_uncertainty:
    'Being wrong, surprises, ignorance that mattered. Not hedging, but genuine stakes.',
  time_pressure_tradeoffs:
    'Urgency, deadlines, asymmetric time awareness. Evidence of lived time.',
  situatedness_body_social:
    'Embodied risk, social cost, friction. Body, place, reputation at stake.',
  scar_tissue_specificity:
    'Persistent involuntary residue: "still flinch", "keeps me up", "even now". NOT formulaic apologies.',
  bounded_viewpoint:
    'Non-omniscient narration. The narrator acknowledges not knowing everything.',
  anti_smoothing:
    'Refusal of symmetry. Does the author close off the opposing view or perform balance?',
  meta_contamination:
    'Preambles, meta-exposition, "in conclusion". Manager voice replacing lived sequence.',
};
