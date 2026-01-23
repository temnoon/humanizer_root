/**
 * SIC Prompt Templates
 *
 * Two-pass architecture:
 * - Pass 1 (Extractor): Fast model. Extracts evidence quotes.
 * - Pass 2 (Judge): Stronger model. Scores and calibrates.
 */

import type { Genre } from '../types.js';

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
 */
export const SIC_EXTRACTOR_PROMPT = `You are a constraint detector. Your task is to find evidence of SUBJECTIVE INTENTIONAL CONSTRAINT in the text.

Subjective Intentional Constraint measures the cost of authorship: traces of commitment, tradeoff, irreversibility, and situated stakes. It is NOT about style or quality.

For EACH feature category, extract relevant quotes (max 25 words each) with rationale:

POSITIVE FEATURES (indicators of human authorship):

1. commitment_irreversibility
   - Concrete decisions with consequences
   - Claims that narrow future options
   - "Humans trap themselves. LLMs keep exits open."

2. epistemic_risk_uncertainty
   - Being wrong, surprises, ignorance that mattered
   - NOT just hedging words, but genuine not-knowing with stakes
   - "I thought X but Y", discoveries that cost something

3. time_pressure_tradeoffs
   - Urgency, deadlines, asymmetric time awareness
   - "suddenly", "before I could", "too late"

4. situatedness_body_social
   - Embodied risk, social cost, friction
   - Physical presence, social exposure

5. scar_tissue_specificity
   - PERSISTENT residue in the PRESENT
   - Physical involuntary reactions: flinch, wince, freeze
   - Temporal persistence: "still", "even now", "years later"
   - NOT formulaic apology language

6. bounded_viewpoint
   - Non-omniscient narration
   - Limited perspective, acknowledged gaps

NEGATIVE FEATURES (indicators of AI generation):

7. anti_smoothing (high score = GOOD)
   - REFUSAL OF SYMMETRY
   - HIGH: Asymmetric commitment, closure of alternatives
   - LOW: "Valid arguments on both sides", performed balance

8. meta_contamination
   - Preambles, "EDIT:", roleplay wrappers
   - "In conclusion", "It is important to note"

Output JSON only:
{
  "features": {
    "commitment_irreversibility": {
      "evidence": [{"quote": "...", "rationale": "..."}],
      "signal_strength": "none" | "weak" | "moderate" | "strong"
    }
  },
  "preliminary_notes": "overall observations"
}
${PROMPT_GUARDRAILS}`;

/**
 * SIC Judge prompt (Pass 2)
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
- 21-40: Some evidence but inconsistent
- 41-60: Moderate evidence, clear constraint traces
- 61-80: Strong evidence, multiple constraint types
- 81-100: Exceptional, load-bearing constraint throughout

INFLECTION POINTS:
Collapse moments where interpretive freedom reduces.
Types: commitment, reversal, reframe, stakes, constraint-reveal

Output JSON only:
{
  "features": {
    "commitment_irreversibility": {
      "score": 0-100,
      "notes": "brief scoring rationale",
      "evidence": [{"quote": "...", "rationale": "..."}]
    }
  },
  "inflectionPoints": [
    {
      "chunkId": "chunk_0",
      "kind": "commitment",
      "quote": "the specific sentence",
      "whyItMatters": "why this reduces degrees of freedom"
    }
  ],
  "sicScore": 0-100,
  "aiProbability": 0.0-1.0,
  "diagnostics": {
    "genreBaselineUsed": true/false,
    "corporateBureaucratRisk": true/false,
    "highFluencyLowCommitmentPattern": true/false
  },
  "notes": "human-readable summary"
}
${PROMPT_GUARDRAILS}`;
}

/**
 * Get genre-specific context
 */
function getGenreContext(genre: Genre): string {
  switch (genre) {
    case 'narrative':
      return 'Narrative/personal writing. High SIC expected. Low SIC is diagnostic.';
    case 'argument':
      return 'Argumentative writing. Moderate-to-high SIC expected.';
    case 'technical':
      return 'Technical writing. Low SIC is APPROPRIATE. Professional suppression is intentional.';
    case 'legal':
      return 'Legal writing. Very low SIC is APPROPRIATE. Flag corporateBureaucratRisk.';
    case 'marketing':
      return 'Marketing writing. Moderate SIC expected.';
    default:
      return 'Genre unclear. Apply standard scoring.';
  }
}

/**
 * Style Check Extractor prompt
 */
export const STYLE_CHECK_EXTRACTOR_PROMPT = `You are a style analyzer. Compare the text against the provided style profile.

Output JSON only:
{
  "matches": [{"pattern": "...", "evidence": "...", "strength": 0.0-1.0}],
  "deviations": [{"expected": "...", "actual": "...", "severity": "minor" | "moderate" | "major"}],
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
export const STYLE_CHECK_JUDGE_PROMPT = `You are a style consistency judge. Score the overall consistency.

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
 */
export const VET_PROFILE_TEXT_PROMPT = `You are a profile source evaluator. Determine if this text is suitable for extracting a writing profile.

Output JSON only:
{
  "suitable": true/false,
  "qualityScore": 0-100,
  "sicScore": 0-100,
  "concerns": ["list of specific concerns"],
  "recommendations": ["suggestions for better samples"]
}
${PROMPT_GUARDRAILS}`;
