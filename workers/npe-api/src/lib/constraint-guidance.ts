/**
 * Constraint Guidance Module
 *
 * Maps SIC (Subjective Intentional Constraint) feature gaps to actionable
 * prompt guidance for LLM humanization passes.
 *
 * This module is the bridge between SIC analysis and text transformation.
 * When SIC identifies low scores in specific features, this module provides
 * targeted guidance to inject those missing human authorship signals.
 *
 * SHARED: Used by Computer Humanizer and (future) other transformation tools.
 */

import type { SicResult, SicFeatureKey, FeatureScore } from '../services/sic/types';

/**
 * Threshold below which a feature is considered a "gap" that needs addressing
 * Features scoring below this are targeted for enhancement
 */
const GAP_THRESHOLD = 45;

/**
 * Minimum gap count to bother with constraint guidance
 * If all features are reasonably high, skip the overhead
 */
const MIN_GAPS_TO_GUIDE = 1;

/**
 * Maximum number of constraint guidance items to include
 * Too many confuses the LLM; focus on the most impactful gaps
 */
const MAX_GUIDANCE_ITEMS = 4;

/**
 * Mapping from SIC feature keys to actionable prompt guidance
 *
 * Each guidance string tells the LLM HOW to inject the missing human signal.
 * These are written as direct instructions the LLM can follow.
 */
const CONSTRAINT_GUIDANCE_MAP: Record<SicFeatureKey, {
  /** Human-readable name of this constraint */
  name: string;
  /** What low score indicates */
  problem: string;
  /** Actionable guidance for the LLM */
  guidance: string;
  /** Example phrases the LLM might use */
  examples: string[];
  /** Weight for prioritization (higher = more important to fix) */
  weight: number;
}> = {
  commitment_irreversibility: {
    name: 'Commitment & Irreversibility',
    problem: 'Text lacks definitive stances; everything feels reversible and hedged',
    guidance: `Add definitive language that closes off alternatives. Replace hedging with commitment.
- Use "I decided" not "I was thinking about"
- Use "This means" not "This might suggest"
- Use "The point is" not "One could argue"
- State positions as facts, not possibilities
- Close off opposing views: "No, that's wrong" or "I refuse to pretend otherwise"`,
    examples: [
      'I decided to quit, and that was final.',
      'This means we have to change course.',
      'The point is simple: it doesn\'t work.',
      'No. That approach is fundamentally broken.'
    ],
    weight: 1.0
  },

  epistemic_risk_uncertainty: {
    name: 'Epistemic Risk & Uncertainty',
    problem: 'Text feels omniscient; no moments of not-knowing or being wrong',
    guidance: `Show moments of genuine uncertainty, surprise, or being corrected.
- Add "I thought X but it turned out..."
- Include "I didn't realize until..."
- Show learning: "turns out", "surprisingly", "I was wrong about"
- Express genuine confusion: "I still don't understand why..."
- Acknowledge limits: "as far as I know", "from what I could tell"`,
    examples: [
      'I thought the deadline was Friday, but turns out it was Thursday.',
      'I didn\'t realize how hard this would be until I started.',
      'Turns out my whole approach was backwards.',
      'I still don\'t fully understand why it failed.'
    ],
    weight: 0.9
  },

  time_pressure_tradeoffs: {
    name: 'Time Pressure & Tradeoffs',
    problem: 'Text feels timeless; no urgency, deadlines, or temporal stakes',
    guidance: `Add markers of temporal pressure and lived time.
- Include urgency: "suddenly", "before I could", "by then it was too late"
- Show deadlines: "we had until", "running out of time"
- Express racing thoughts: "in that moment", "everything happened so fast"
- Add tradeoff markers: "I had to choose between", "there wasn't time for both"`,
    examples: [
      'By the time I realized, it was already too late.',
      'We had three days to figure this out.',
      'I had to choose between fixing it properly or meeting the deadline.',
      'Suddenly everything clicked into place.'
    ],
    weight: 0.8
  },

  situatedness_body_social: {
    name: 'Situatedness (Body & Social)',
    problem: 'Text floats in abstract space; no physical or social grounding',
    guidance: `Ground the text in physical reality and social context.
- Reference body states: tired, hungry, couldn't sleep, hands shaking
- Include locations: specific places, environments
- Show social friction: what others thought, disagreements, pressure
- Add environmental details: weather, noise, interruptions`,
    examples: [
      'I was exhausted and hadn\'t slept in two days.',
      'Everyone in the room went quiet.',
      'My hands were shaking when I hit send.',
      'The coffee had gone cold hours ago.'
    ],
    weight: 0.7
  },

  scar_tissue_specificity: {
    name: 'Scar Tissue & Persistent Residue',
    problem: 'Text lacks traces of past difficulty; everything feels freshly minted',
    guidance: `Add traces of persistent discomfort or unresolved residue from past events.
- Use "still" and "even now" to show persistence: "I still wince at", "even now I"
- Show ongoing effects: "I can't shake", "it keeps coming back"
- Reference specific past pain: "after what happened with X"
- Add defensive patterns: "I've learned to", "I make sure to now"`,
    examples: [
      'I still flinch whenever I see that error message.',
      'Even now, years later, I check twice.',
      'After what happened last time, I always back up first.',
      'I can\'t hear that phrase without remembering.'
    ],
    weight: 0.85
  },

  bounded_viewpoint: {
    name: 'Bounded Viewpoint',
    problem: 'Narrator seems to know everything; no acknowledged gaps in knowledge',
    guidance: `Show the narrator doesn't have complete information.
- Acknowledge gaps: "I don't know why", "I never found out"
- Show limited perspective: "from where I was standing", "all I could see"
- Express uncertainty about others: "she seemed to", "I think he meant"
- Admit missing context: "I only heard later that", "I wasn't there for"`,
    examples: [
      'I never did find out what happened next.',
      'From what I could see, it looked like...',
      'She seemed upset, but I couldn\'t be sure.',
      'I only learned later that the whole thing had been a mistake.'
    ],
    weight: 0.75
  },

  anti_smoothing: {
    name: 'Anti-Smoothing (Stance Taking)',
    problem: 'Text hedges everything; refuses to take sides or make claims',
    guidance: `Take sides. Remove balance-performing language.
- Delete "on one hand / on the other hand" patterns
- Replace "some argue / others argue" with a clear position
- Remove "it's complicated" without providing a stance
- Avoid "valid points on both sides" - commit to which side is more valid
- End arguments with a verdict, not with "it depends"`,
    examples: [
      'The critics are wrong. Here\'s why.',
      'Despite the counterarguments, this approach is clearly better.',
      'I\'m not going to pretend both sides have equal merit.',
      'Let me be clear: this is a bad idea.'
    ],
    weight: 0.95
  },

  meta_contamination: {
    name: 'Meta-Contamination',
    problem: 'Text contains AI artifacts like preambles, "EDIT:", or roleplay markers',
    guidance: `Remove any meta-textual artifacts.
- Delete preambles: "Here's...", "Let me explain...", "Sure, I can help..."
- Remove edit markers: "EDIT:", "UPDATE:", "[Note:]"
- Strip roleplay frames: "As an AI...", "In this scenario..."
- Cut sign-offs: "Hope this helps!", "Let me know if..."`,
    examples: [], // No examples - this is about removal, not addition
    weight: 0.5  // Lower weight - usually caught by post-processing
  }
};

/**
 * Identify constraint gaps from SIC analysis results
 *
 * Returns feature keys where the score is below the gap threshold,
 * sorted by importance (weight * gap size)
 */
export function identifyConstraintGaps(
  sicResult: SicResult,
  threshold: number = GAP_THRESHOLD
): SicFeatureKey[] {
  const gaps: Array<{ key: SicFeatureKey; score: number; weight: number; priority: number }> = [];

  for (const [key, feature] of Object.entries(sicResult.features) as [SicFeatureKey, FeatureScore][]) {
    // Skip meta_contamination - handled separately
    if (key === 'meta_contamination') continue;

    if (feature.score < threshold) {
      const config = CONSTRAINT_GUIDANCE_MAP[key];
      const gapSize = threshold - feature.score;
      const priority = config.weight * gapSize;

      gaps.push({
        key,
        score: feature.score,
        weight: config.weight,
        priority
      });
    }
  }

  // Sort by priority (highest first)
  gaps.sort((a, b) => b.priority - a.priority);

  return gaps.map(g => g.key);
}

/**
 * Build constraint guidance string for LLM prompts
 *
 * Takes the identified gaps and generates actionable guidance text
 * that can be injected into humanization prompts.
 */
export function buildConstraintGuidance(
  gaps: SicFeatureKey[],
  sicResult?: SicResult,
  maxItems: number = MAX_GUIDANCE_ITEMS
): string | undefined {
  if (gaps.length < MIN_GAPS_TO_GUIDE) {
    return undefined;
  }

  const items: string[] = [];

  for (const key of gaps.slice(0, maxItems)) {
    const config = CONSTRAINT_GUIDANCE_MAP[key];
    if (!config) continue;

    const score = sicResult?.features[key]?.score;
    const scoreNote = score !== undefined ? ` (current: ${score}/100)` : '';

    items.push(`**${config.name}**${scoreNote}
${config.guidance}
${config.examples.length > 0 ? `Examples: "${config.examples.slice(0, 2).join('", "')}"` : ''}`);
  }

  if (items.length === 0) {
    return undefined;
  }

  return items.join('\n\n');
}

/**
 * Get a summary of constraint gaps for logging/display
 */
export function summarizeGaps(gaps: SicFeatureKey[]): string {
  if (gaps.length === 0) {
    return 'No significant constraint gaps identified.';
  }

  const names = gaps.map(key => CONSTRAINT_GUIDANCE_MAP[key]?.name || key);
  return `Constraint gaps: ${names.join(', ')}`;
}

/**
 * Get detailed gap analysis for display to users
 */
export function getGapAnalysis(
  sicResult: SicResult,
  threshold: number = GAP_THRESHOLD
): Array<{
  feature: SicFeatureKey;
  name: string;
  score: number;
  problem: string;
  isGap: boolean;
}> {
  return (Object.entries(sicResult.features) as [SicFeatureKey, FeatureScore][])
    .filter(([key]) => key !== 'meta_contamination')
    .map(([key, feature]) => ({
      feature: key,
      name: CONSTRAINT_GUIDANCE_MAP[key]?.name || key,
      score: feature.score,
      problem: CONSTRAINT_GUIDANCE_MAP[key]?.problem || '',
      isGap: feature.score < threshold
    }))
    .sort((a, b) => a.score - b.score);
}
