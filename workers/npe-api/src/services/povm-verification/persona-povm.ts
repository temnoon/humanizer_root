/**
 * Persona POVM Pack - Measures voice space (perspective, tone, stance)
 *
 * Purpose: Detect changes in narrative voice, affective tone, and rhetorical stance
 * Insensitive to: Proper names, cultural references, sentence structure
 * Sensitive to: Point of view, emotional valence, subjectivity, rhetorical approach
 *
 * Basis Rotation Model:
 * - Persona transformation = rotation in "voice" dimensions of ρ-space
 * - Should affect ONLY perspective/tone/stance, not names/syntax/content
 * - Leakage = drift in Namespace/Style/Content POVMs
 */

export interface PersonaPOVMMeasurement {
  narrativePerspective: {
    type: string;  // first_person_participant | second_person | third_person_limited | third_person_omniscient | third_person_objective
    subjectivity: number;  // 0-10 scale
    drift: number;
    evidence: string;
  };
  affectiveTone: {
    valence: number;      // -5 to +5 (negative to positive)
    energy: number;       // -5 to +5 (calm to energetic)
    certainty: number;    // -5 to +5 (doubtful to certain)
    dominantEmotion: string;  // joy, sadness, anger, fear, contentment, neutral, etc.
    drift: number;
    evidence: string;
  };
  rhetoricalStance: {
    stance: string;  // advocate | critic | neutral_observer | storyteller | educator | philosopher
    analyticalDistance: number;  // 0-10 (immersed to meta-analytical)
    drift: number;
    evidence: string;
  };
  timestamp: string;
}

/**
 * Measure Persona POVM for a given text
 */
export async function measurePersonaPOVM(
  text: string,
  ai: any
): Promise<PersonaPOVMMeasurement> {
  console.log('[Persona POVM] Starting measurement');

  const [perspectiveResult, toneResult, stanceResult] = await Promise.all([
    measureNarrativePerspective(text, ai),
    measureAffectiveTone(text, ai),
    measureRhetoricalStance(text, ai)
  ]);

  return {
    narrativePerspective: perspectiveResult,
    affectiveTone: toneResult,
    rhetoricalStance: stanceResult,
    timestamp: new Date().toISOString()
  };
}

/**
 * M1: Narrative Perspective
 * Measures point of view and subjectivity level
 */
async function measureNarrativePerspective(text: string, ai: any) {
  const prompt = `Analyze the narrative perspective of this text.

Choose ONE perspective type:
- first_person_participant (I, we - narrator is a character)
- second_person (you - addresses reader directly)
- third_person_limited (he/she - one character's viewpoint)
- third_person_omniscient (he/she - multiple viewpoints, god-like knowledge)
- third_person_objective (he/she - camera-like, external observation only)

Also rate subjectivity (0-10):
0 = purely objective facts, no opinions or feelings
5 = balanced mix of facts and interpretation
10 = highly subjective, opinionated, personal

Respond with JSON (no markdown, no code blocks):
{"perspective": "type_here", "subjectivity": N}

TEXT:
${text}

ANALYSIS:`;

  const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      {
        role: 'system',
        content: 'You are a literary analyst specializing in narrative voice. Respond ONLY with valid JSON.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 128,
    temperature: 0.0
  });

  const parsed = parsePerspectiveResponse(response.response || '');

  return {
    type: parsed.perspective,
    subjectivity: parsed.subjectivity,
    drift: 0,  // Calculated during comparison
    evidence: `${parsed.perspective} (subjectivity: ${parsed.subjectivity}/10)`
  };
}

/**
 * M2: Affective Tone
 * Measures emotional valence, energy, certainty, and dominant emotion
 */
async function measureAffectiveTone(text: string, ai: any) {
  const prompt = `Analyze the emotional tone/affect of this text.

Rate on these scales:
- Valence: -5 (very negative) to +5 (very positive), 0 = neutral
- Energy: -5 (very calm/subdued) to +5 (very energetic/excited), 0 = neutral
- Certainty: -5 (very doubtful/tentative) to +5 (very certain/confident), 0 = neutral

Identify dominant emotion (one word):
joy, sadness, anger, fear, surprise, disgust, contentment, anticipation, trust, neutral

Respond with JSON (no markdown, no code blocks):
{"valence": N, "energy": N, "certainty": N, "emotion": "word"}

TEXT:
${text}

ANALYSIS:`;

  const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      {
        role: 'system',
        content: 'You are an emotion analyst. Respond ONLY with valid JSON.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 128,
    temperature: 0.0
  });

  const parsed = parseToneResponse(response.response || '');

  return {
    valence: parsed.valence,
    energy: parsed.energy,
    certainty: parsed.certainty,
    dominantEmotion: parsed.emotion,
    drift: 0,  // Calculated during comparison
    evidence: `valence=${parsed.valence}, energy=${parsed.energy}, certainty=${parsed.certainty}, emotion=${parsed.emotion}`
  };
}

/**
 * M3: Rhetorical Stance
 * Measures the author's rhetorical approach and analytical distance
 */
async function measureRhetoricalStance(text: string, ai: any) {
  const prompt = `Analyze the rhetorical stance of this text.

Choose ONE stance:
- advocate (championing, persuading toward a position)
- critic (questioning, analyzing flaws, skeptical)
- neutral_observer (balanced, objective, non-partisan)
- storyteller (engaging narrative, focused on the tale)
- educator (explaining, informing, teaching)
- philosopher (contemplating, probing deeper meaning)

Rate analytical distance (0-10):
0 = fully immersed in the narrative, no meta-awareness
5 = some self-awareness, moderate distance
10 = highly detached, meta-analytical, commenting on the commentary

Respond with JSON (no markdown, no code blocks):
{"stance": "type_here", "analytical_distance": N}

TEXT:
${text}

ANALYSIS:`;

  const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      {
        role: 'system',
        content: 'You are a rhetoric analyst. Respond ONLY with valid JSON.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 128,
    temperature: 0.0
  });

  const parsed = parseStanceResponse(response.response || '');

  return {
    stance: parsed.stance,
    analyticalDistance: parsed.analyticalDistance,
    drift: 0,  // Calculated during comparison
    evidence: `${parsed.stance} (distance: ${parsed.analyticalDistance}/10)`
  };
}

/**
 * Compute drift between two Persona POVM measurements
 */
export async function computePersonaDrift(
  before: PersonaPOVMMeasurement,
  after: PersonaPOVMMeasurement,
  ai: any
): Promise<PersonaPOVMMeasurement> {
  console.log('[Persona POVM] Computing drift');

  // M1: Narrative perspective drift
  const perspectiveDrift = computePerspectiveDrift(
    before.narrativePerspective,
    after.narrativePerspective
  );

  // M2: Affective tone drift
  const toneDrift = computeToneDrift(
    before.affectiveTone,
    after.affectiveTone
  );

  // M3: Rhetorical stance drift
  const stanceDrift = computeStanceDrift(
    before.rhetoricalStance,
    after.rhetoricalStance
  );

  return {
    narrativePerspective: {
      ...after.narrativePerspective,
      drift: perspectiveDrift
    },
    affectiveTone: {
      ...after.affectiveTone,
      drift: toneDrift
    },
    rhetoricalStance: {
      ...after.rhetoricalStance,
      drift: stanceDrift
    },
    timestamp: after.timestamp
  };
}

// ============================================================================
// PARSING UTILITIES
// ============================================================================

function parsePerspectiveResponse(response: string): { perspective: string; subjectivity: number } {
  try {
    // Clean response
    const cleaned = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    // Validate perspective type
    const validPerspectives = [
      'first_person_participant',
      'second_person',
      'third_person_limited',
      'third_person_omniscient',
      'third_person_objective'
    ];

    let perspective = 'third_person_objective';  // default
    if (validPerspectives.includes(parsed.perspective)) {
      perspective = parsed.perspective;
    } else {
      // Try to extract from response text
      const lower = response.toLowerCase();
      for (const p of validPerspectives) {
        if (lower.includes(p.replace(/_/g, ' ')) || lower.includes(p)) {
          perspective = p;
          break;
        }
      }
    }

    // Validate subjectivity
    let subjectivity = 5;  // default
    if (typeof parsed.subjectivity === 'number') {
      subjectivity = Math.max(0, Math.min(10, parsed.subjectivity));
    }

    return { perspective, subjectivity };
  } catch (error) {
    console.error('[Persona POVM] Failed to parse perspective:', error);
    return { perspective: 'third_person_objective', subjectivity: 5 };
  }
}

function parseToneResponse(response: string): { valence: number; energy: number; certainty: number; emotion: string } {
  try {
    const cleaned = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    // Clamp values to [-5, +5]
    const valence = Math.max(-5, Math.min(5, parsed.valence || 0));
    const energy = Math.max(-5, Math.min(5, parsed.energy || 0));
    const certainty = Math.max(-5, Math.min(5, parsed.certainty || 0));

    // Validate emotion
    const validEmotions = [
      'joy', 'sadness', 'anger', 'fear', 'surprise', 'disgust',
      'contentment', 'anticipation', 'trust', 'neutral'
    ];

    let emotion = 'neutral';
    if (validEmotions.includes(parsed.emotion)) {
      emotion = parsed.emotion;
    }

    return { valence, energy, certainty, emotion };
  } catch (error) {
    console.error('[Persona POVM] Failed to parse tone:', error);
    return { valence: 0, energy: 0, certainty: 0, emotion: 'neutral' };
  }
}

function parseStanceResponse(response: string): { stance: string; analyticalDistance: number } {
  try {
    const cleaned = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    // Validate stance
    const validStances = [
      'advocate', 'critic', 'neutral_observer',
      'storyteller', 'educator', 'philosopher'
    ];

    let stance = 'neutral_observer';  // default
    if (validStances.includes(parsed.stance)) {
      stance = parsed.stance;
    }

    // Validate analytical distance
    let analyticalDistance = 5;  // default
    if (typeof parsed.analytical_distance === 'number') {
      analyticalDistance = Math.max(0, Math.min(10, parsed.analytical_distance));
    }

    return { stance, analyticalDistance };
  } catch (error) {
    console.error('[Persona POVM] Failed to parse stance:', error);
    return { stance: 'neutral_observer', analyticalDistance: 5 };
  }
}

// ============================================================================
// DRIFT CALCULATION UTILITIES
// ============================================================================

/**
 * Compute perspective drift
 * - Type change: 100% if different, 0% if same
 * - Subjectivity drift: |before - after| / 10
 * - Overall: weighted average (60% type, 40% subjectivity)
 */
function computePerspectiveDrift(
  before: PersonaPOVMMeasurement['narrativePerspective'],
  after: PersonaPOVMMeasurement['narrativePerspective']
): number {
  const typeDrift = before.type === after.type ? 0 : 1.0;
  const subjectivityDrift = Math.abs(before.subjectivity - after.subjectivity) / 10;

  return (typeDrift * 0.6) + (subjectivityDrift * 0.4);
}

/**
 * Compute affective tone drift
 * - Valence drift: |before - after| / 10 (scaled from -5 to +5 range)
 * - Energy drift: |before - after| / 10
 * - Certainty drift: |before - after| / 10
 * - Emotion drift: 100% if different, 0% if same
 * - Overall: average of all four
 */
function computeToneDrift(
  before: PersonaPOVMMeasurement['affectiveTone'],
  after: PersonaPOVMMeasurement['affectiveTone']
): number {
  const valenceDrift = Math.abs(before.valence - after.valence) / 10;
  const energyDrift = Math.abs(before.energy - after.energy) / 10;
  const certaintyDrift = Math.abs(before.certainty - after.certainty) / 10;
  const emotionDrift = before.dominantEmotion === after.dominantEmotion ? 0 : 1.0;

  return (valenceDrift + energyDrift + certaintyDrift + emotionDrift) / 4;
}

/**
 * Compute rhetorical stance drift
 * - Stance change: 100% if different, 0% if same
 * - Distance drift: |before - after| / 10
 * - Overall: weighted average (60% stance, 40% distance)
 */
function computeStanceDrift(
  before: PersonaPOVMMeasurement['rhetoricalStance'],
  after: PersonaPOVMMeasurement['rhetoricalStance']
): number {
  const stanceDrift = before.stance === after.stance ? 0 : 1.0;
  const distanceDrift = Math.abs(before.analyticalDistance - after.analyticalDistance) / 10;

  return (stanceDrift * 0.6) + (distanceDrift * 0.4);
}
