/**
 * Subjective Intentional Constraint (SIC) - Prompt Templates
 *
 * Two-pass prompt architecture:
 * - Pass 1 (Extractor): Cheap/fast model OK. Extracts evidence quotes and candidate features.
 * - Pass 2 (Judge): Stronger model preferred. Scores, calibrates, applies genre baseline.
 *
 * DESIGN RULES (Critical - prevent style drift):
 * 1. Never ask the model to "write like" anything
 * 2. Never ask for aesthetic judgment
 * 3. Always bind the model to constraint detection
 * 4. Always require justification in finite terms
 * 5. Force JSON-only output
 */

import type { Genre, SicFeatureKey } from './types';

/**
 * Guardrails appended to all prompts
 */
export const PROMPT_GUARDRAILS = `
CRITICAL RULES:
- Output ONLY valid JSON. No markdown, no explanation, no preamble.
- Do NOT evaluate style, aesthetics, or quality.
- Do NOT suggest improvements or rewrites.
- Focus ONLY on detecting constraint traces as specified.
- Every claim must cite specific evidence from the text.
- If uncertain, say "insufficient evidence" rather than guessing.
`;

/**
 * Genre detection prompt (Pass 0)
 * Runs before main analysis to calibrate expectations
 */
export const GENRE_DETECTION_PROMPT = `You are a genre classifier. Analyze the text and determine its primary genre.

Your task:
1. Read the text carefully
2. Identify the primary genre from: narrative, argument, technical, legal, marketing, unknown
3. Note any genre mixing or ambiguity

Output JSON only:
{
  "genre": "narrative" | "argument" | "technical" | "legal" | "marketing" | "unknown",
  "confidence": 0.0-1.0,
  "notes": "brief explanation of genre signals"
}
${PROMPT_GUARDRAILS}`;

/**
 * SIC Extractor prompt (Pass 1)
 * Extracts raw evidence for each feature category
 */
export const SIC_EXTRACTOR_PROMPT = `You are a constraint detector. Your task is to find evidence of SUBJECTIVE INTENTIONAL CONSTRAINT in the text.

Subjective Intentional Constraint measures the cost of authorship: traces of commitment, tradeoff, irreversibility, and situated stakes. It is NOT about style or quality.

For EACH feature category, extract relevant quotes (max 25 words each) with rationale:

POSITIVE FEATURES (indicators of human authorship):

1. commitment_irreversibility
   - Concrete decisions with consequences
   - Claims that narrow future options
   - "Humans trap themselves. LLMs keep exits open."
   Look for: definitive statements, declared choices, acknowledged consequences

2. epistemic_risk_uncertainty
   - Being wrong, surprises, ignorance that mattered
   - NOT just hedging words, but genuine not-knowing with stakes
   - "I thought X but Y", discoveries that cost something
   Look for: reversals of belief, acknowledged mistakes, consequential surprises

3. time_pressure_tradeoffs
   - Urgency, deadlines, asymmetric time awareness
   - Uneven pacing suggesting lived time
   - "suddenly", "before I could", "too late"
   Look for: temporal compression, deadline pressure, missed opportunities

4. situatedness_body_social
   - Embodied risk, social cost, friction
   - Physical presence, social exposure
   - References to body, place, reputation at stake
   Look for: physical sensations, social consequences, reputational risk

5. scar_tissue_specificity
   - PERSISTENT residue that shows up in the PRESENT, not just apology language
   - Physical involuntary reactions: flinch, wince, freeze, cringe, stomach drops
   - Temporal persistence markers: "still", "even now", "years later", "to this day"
   - Present-tense lingering: "keeps me up", "can't look at", "hard to talk about"
   - "Humans heal; LLMs regenerate."

   CRITICAL DISTINCTION:
   - NOT scar tissue: "I am truly sorry", "I take full responsibility", "I apologize"
     (These are FORMULAIC COMPLETENESS - AI covers all bases)
   - IS scar tissue: "I still flinch when...", "keeps me up at night", "even now I..."
     (These show PERSISTENT INVOLUNTARY RESIDUE that can't be smoothed over)

   Look for: involuntary physical reactions, temporal persistence ("still", "even now"),
   present-tense suffering, defensive specificity that protects a wound

6. bounded_viewpoint
   - Non-omniscient narration
   - Limited perspective, acknowledged gaps
   - The narrator doesn't know everything
   Look for: perspective limitations, gaps in knowledge, positioned viewpoint

NEGATIVE FEATURES (indicators of AI generation):

7. anti_smoothing (INVERSE - high score = GOOD)
   - Resistance to hedging/balancing
   - Willingness to be one-sided
   - NOT covering all perspectives equally
   Look for: committed positions, unbalanced by design, refusal to hedge

8. meta_contamination
   - Preambles, "EDIT:", roleplay wrappers
   - Meta-exposition replacing lived sequence
   - "In conclusion", "It is important to note"
   Look for: structural markers, explanatory framing, summary language

Output JSON only:
{
  "features": {
    "commitment_irreversibility": {
      "evidence": [{"quote": "...", "rationale": "..."}],
      "signal_strength": "none" | "weak" | "moderate" | "strong"
    },
    // ... same structure for each feature
  },
  "preliminary_notes": "overall observations about constraint presence"
}
${PROMPT_GUARDRAILS}`;

/**
 * SIC Judge prompt (Pass 2)
 * Scores features and applies genre calibration
 */
export function getSicJudgePrompt(genre: Genre): string {
  const genreContext = getGenreContext(genre);

  return `You are a constraint judge. Given extracted evidence, score each feature and provide final assessment.

GENRE CONTEXT: ${genreContext}

Your task:
1. Review the extracted evidence for each feature
2. Score each feature 0-100 based on evidence strength
3. Apply genre-appropriate calibration
4. Identify key inflection points (collapse moments)
5. Calculate overall SIC score

SCORING GUIDELINES:
- 0-20: No evidence or very weak signals
- 21-40: Some evidence but inconsistent or superficial
- 41-60: Moderate evidence, clear constraint traces
- 61-80: Strong evidence, multiple constraint types
- 81-100: Exceptional, load-bearing constraint throughout

INFLECTION POINTS:
These are "collapse" moments where interpretive degrees of freedom reduce.
Types: commitment, reversal, reframe, stakes, constraint-reveal

GENRE CALIBRATION:
- Technical/legal writing legitimately suppresses subjectivity
- Low SIC in such genres is APPROPRIATE, not diagnostic
- Flag corporateBureaucratRisk if low SIC seems intentional profession

Output JSON only:
{
  "features": {
    "commitment_irreversibility": {
      "score": 0-100,
      "notes": "brief scoring rationale",
      "evidence": [{"quote": "...", "rationale": "..."}]
    },
    // ... same for each feature
  },
  "inflectionPoints": [
    {
      "chunkId": "chunk_0",
      "kind": "commitment" | "reversal" | "reframe" | "stakes" | "constraint-reveal",
      "quote": "the specific sentence",
      "whyItMatters": "why this moment reduces degrees of freedom"
    }
  ],
  "sicScore": 0-100,
  "aiProbability": 0.0-1.0,
  "diagnostics": {
    "genreBaselineUsed": true/false,
    "corporateBureaucratRisk": true/false,
    "highFluencyLowCommitmentPattern": true/false
  },
  "notes": "human-readable summary of constraint analysis"
}
${PROMPT_GUARDRAILS}`;
}

/**
 * Get genre-specific context for the judge
 */
function getGenreContext(genre: Genre): string {
  switch (genre) {
    case 'narrative':
      return 'This is narrative/personal writing. High SIC is expected. Low SIC is diagnostic of possible AI generation.';
    case 'argument':
      return 'This is argumentative/opinion writing. Moderate-to-high SIC expected. Some formality is normal.';
    case 'technical':
      return 'This is technical writing. Low SIC is APPROPRIATE and expected. Professional suppression of subjectivity is intentional. Do not penalize for lack of personal stakes.';
    case 'legal':
      return 'This is legal writing. Very low SIC is APPROPRIATE. Intentional objectivity is a feature, not a bug. Flag corporateBureaucratRisk but do not treat as AI signal.';
    case 'marketing':
      return 'This is marketing/promotional writing. Moderate SIC expected. Some enthusiasm without personal stakes is normal.';
    case 'unknown':
    default:
      return 'Genre unclear. Apply standard scoring without baseline adjustment.';
  }
}

/**
 * Style Check Extractor prompt
 * For traditional stylometry (supporting tool, not novel)
 */
export const STYLE_CHECK_EXTRACTOR_PROMPT = `You are a style analyzer. Compare the text against the provided style profile.

Your task:
1. Analyze the text for style markers
2. Compare against the profile's expected patterns
3. Identify deviations and matches

This is NOT about quality judgment. It's about consistency with established patterns.

Output JSON only:
{
  "matches": [
    {"pattern": "...", "evidence": "...", "strength": 0.0-1.0}
  ],
  "deviations": [
    {"expected": "...", "actual": "...", "severity": "minor" | "moderate" | "major"}
  ],
  "metrics": {
    "avgSentenceLength": number,
    "vocabularyLevel": "basic" | "intermediate" | "advanced",
    "formalityLevel": "informal" | "neutral" | "formal"
  }
}
${PROMPT_GUARDRAILS}`;

/**
 * Style Check Judge prompt
 */
export const STYLE_CHECK_JUDGE_PROMPT = `You are a style consistency judge. Given extracted style analysis, score the overall consistency.

Your task:
1. Review matches and deviations
2. Weight deviations by severity
3. Calculate consistency and profile match scores

Output JSON only:
{
  "consistencyScore": 0-100,
  "profileMatchScore": 0-100,
  "deviations": ["human-readable deviation descriptions"],
  "metrics": {
    "perplexity": number or null,
    "burstiness": number or null,
    "avgSentenceLength": number,
    "typeTokenRatio": number or null
  }
}
${PROMPT_GUARDRAILS}`;

/**
 * Profile Vetting prompt
 * For Profile Factory gate
 */
export const VET_PROFILE_TEXT_PROMPT = `You are a profile source evaluator. Determine if this text sample is suitable for extracting a writing profile.

Good profile sources have:
- Sufficient length (500+ words ideal)
- Consistent voice throughout
- Evidence of genuine authorship (not AI-generated)
- Distinctive patterns that could transfer to other writing

Poor profile sources have:
- Very short or fragmentary text
- Mixed voices or inconsistent style
- Signs of AI generation (high fluency, low commitment)
- Generic patterns with nothing distinctive

Your task:
1. Assess the text for profile extraction suitability
2. Check for SIC signals (constraint traces)
3. Identify any concerns
4. Provide recommendations

Output JSON only:
{
  "suitable": true/false,
  "qualityScore": 0-100,
  "sicScore": 0-100,
  "concerns": ["list of specific concerns"],
  "recommendations": ["suggestions for better samples if unsuitable"]
}
${PROMPT_GUARDRAILS}`;

/**
 * AI Probability prompt
 * Quick assessment based on constraint patterns
 */
export const AI_PROBABILITY_PROMPT = `You are an AI detection analyst. Based on the constraint profile, estimate AI-generation probability.

Key signals of AI generation:
- High fluency with low commitment (the primary tell)
- Resolution without cost (conflicts instantly harmonized)
- Symmetry obsession (covering all sides, nothing chosen)
- Manager voice (meta-exposition, "in conclusion")
- Generic facsimile (stock empathy, ornamental vividness)

Key signals of human authorship:
- Irreversible commitments
- Epistemic reversals (being wrong that mattered)
- Temporal pressure traces
- Scar tissue (lingering discomfort, unresolved)
- Bounded viewpoint (narrator doesn't know everything)

"LLMs are very good at simulating styles. They are much worse at simulating being someone while not knowing everything."

Output JSON only:
{
  "aiProbability": 0.0-1.0,
  "primaryReason": "the single most important factor",
  "confidence": 0.0-1.0,
  "notes": "brief explanation"
}
${PROMPT_GUARDRAILS}`;

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
    'Persistent involuntary residue: "still flinch", "keeps me up", "even now". NOT formulaic apologies. "Humans heal; LLMs regenerate."',
  bounded_viewpoint:
    'Non-omniscient narration. The narrator acknowledges not knowing everything.',
  anti_smoothing:
    'Resistance to hedging/balancing. Willingness to be one-sided, committed.',
  meta_contamination:
    'Preambles, meta-exposition, "in conclusion". Manager voice replacing lived sequence.',
};
