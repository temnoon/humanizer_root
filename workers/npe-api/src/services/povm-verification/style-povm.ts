/**
 * Style POVM Pack - Measures syntax space (structure, formality, lexical features)
 *
 * Purpose: Detect changes in sentence structure, formality, and surface-level linguistic patterns
 * Insensitive to: Names, voice, tone, content meaning
 * Sensitive to: Syntax complexity, formality level, lexical density, stylistic devices
 *
 * Basis Rotation Model:
 * - Style transformation = rotation in "syntax" dimensions of ρ-space
 * - Should affect ONLY structure/formality/lexical choices, not names/voice/content
 * - Leakage = drift in Namespace/Persona/Content POVMs
 */

export interface StylePOVMMeasurement {
  sentenceStructure: {
    count: number;
    avgWordsPerSentence: number;
    longestSentence: number;
    shortestSentence: number;
    complexity: string;  // simple | moderate | complex
    drift: number;
    evidence: string;
  };
  formality: {
    level: number;  // 0-10 scale
    register: string;  // casual_speech | conversational | standard_prose | formal_writing | academic | poetic | technical
    drift: number;
    evidence: string;
  };
  lexicalFeatures: {
    totalWords: number;
    uniqueWords: number;
    multisyllableWords: number;
    rareWords: number;
    lexicalDensity: number;  // 0.0-1.0
    devices: string[];  // metaphor, simile, alliteration, repetition, parallel_structure, etc.
    drift: number;
    evidence: string;
  };
  timestamp: string;
}

/**
 * Measure Style POVM for a given text
 */
export async function measureStylePOVM(
  text: string,
  ai: any
): Promise<StylePOVMMeasurement> {
  console.log('[Style POVM] Starting measurement');

  const [structureResult, formalityResult, lexicalResult] = await Promise.all([
    measureSentenceStructure(text, ai),
    measureFormality(text, ai),
    measureLexicalFeatures(text, ai)
  ]);

  return {
    sentenceStructure: structureResult,
    formality: formalityResult,
    lexicalFeatures: lexicalResult,
    timestamp: new Date().toISOString()
  };
}

/**
 * M1: Sentence Structure Analysis
 * Measures sentence counts, lengths, and complexity
 */
async function measureSentenceStructure(text: string, ai: any) {
  const prompt = `Analyze the sentence structure of this text.

Count:
- Total sentences (count all complete sentences)
- Average words per sentence (total words / total sentences)
- Longest sentence (word count)
- Shortest sentence (word count)

Classify structure complexity:
- simple (mostly simple sentences, few clauses)
- moderate (mix of simple and compound sentences)
- complex (many compound-complex sentences, subordinate clauses)

Respond with JSON (no markdown, no code blocks):
{
  "sentence_count": N,
  "avg_words_per_sentence": N,
  "longest": N,
  "shortest": N,
  "complexity": "simple|moderate|complex"
}

TEXT:
${text}

ANALYSIS:`;

  const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      {
        role: 'system',
        content: 'You are a linguistic analyst specializing in syntax. Respond ONLY with valid JSON.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 128,
    temperature: 0.0
  });

  const parsed = parseStructureResponse(response.response || '');

  return {
    count: parsed.sentence_count,
    avgWordsPerSentence: parsed.avg_words_per_sentence,
    longestSentence: parsed.longest,
    shortestSentence: parsed.shortest,
    complexity: parsed.complexity,
    drift: 0,  // Calculated during comparison
    evidence: `${parsed.sentence_count} sentences, avg ${parsed.avg_words_per_sentence} words, ${parsed.complexity} complexity`
  };
}

/**
 * M2: Formality Level
 * Measures formality and register
 */
async function measureFormality(text: string, ai: any) {
  const prompt = `Rate the formality level of this text (0-10):
0 = very casual (slang, contractions, informal speech)
3 = conversational (relaxed but clear)
5 = neutral (standard written English)
7 = formal (elevated vocabulary, no contractions)
10 = highly formal (academic, ceremonial, archaic)

Identify register (choose ONE):
- casual_speech (slang, fragments, very informal)
- conversational (relaxed, natural speech patterns)
- standard_prose (normal written English)
- formal_writing (elevated, professional)
- academic (scholarly, technical, cited)
- poetic (literary, metaphorical, artistic)
- technical (specialized jargon, precise)

Respond with JSON (no markdown, no code blocks):
{"formality": N, "register": "type_here"}

TEXT:
${text}

ANALYSIS:`;

  const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      {
        role: 'system',
        content: 'You are a linguistic analyst specializing in register and formality. Respond ONLY with valid JSON.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 128,
    temperature: 0.0
  });

  const parsed = parseFormalityResponse(response.response || '');

  return {
    level: parsed.formality,
    register: parsed.register,
    drift: 0,  // Calculated during comparison
    evidence: `formality=${parsed.formality}/10, register=${parsed.register}`
  };
}

/**
 * M3: Lexical Features
 * Measures word-level patterns and stylistic devices
 */
async function measureLexicalFeatures(text: string, ai: any) {
  const prompt = `Analyze the word-level features of this text.

Count:
- Total words (all words including articles, prepositions)
- Unique words (distinct vocabulary, case-insensitive)
- Multi-syllable words (3+ syllables)
- Rare/uncommon words (sophisticated vocabulary not in common use)

Calculate lexical density: unique_words / total_words (0.0-1.0)

Identify stylistic devices present (list all that apply):
- metaphor
- simile
- alliteration
- repetition
- parallel_structure
- rhetorical_question
- none

Respond with JSON (no markdown, no code blocks):
{
  "total_words": N,
  "unique_words": N,
  "multisyllable_words": N,
  "rare_words": N,
  "lexical_density": 0.XX,
  "devices": ["device1", "device2"]
}

TEXT:
${text}

ANALYSIS:`;

  const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      {
        role: 'system',
        content: 'You are a linguistic analyst specializing in lexical analysis. Respond ONLY with valid JSON.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 256,
    temperature: 0.0
  });

  const parsed = parseLexicalResponse(response.response || '');

  return {
    totalWords: parsed.total_words,
    uniqueWords: parsed.unique_words,
    multisyllableWords: parsed.multisyllable_words,
    rareWords: parsed.rare_words,
    lexicalDensity: parsed.lexical_density,
    devices: parsed.devices,
    drift: 0,  // Calculated during comparison
    evidence: `${parsed.total_words} words, ${parsed.unique_words} unique (density: ${parsed.lexical_density.toFixed(2)}), devices: ${parsed.devices.join(', ') || 'none'}`
  };
}

/**
 * Compute drift between two Style POVM measurements
 */
export async function computeStyleDrift(
  before: StylePOVMMeasurement,
  after: StylePOVMMeasurement,
  ai: any
): Promise<StylePOVMMeasurement> {
  console.log('[Style POVM] Computing drift');

  // M1: Sentence structure drift
  const structureDrift = computeStructureDrift(
    before.sentenceStructure,
    after.sentenceStructure
  );

  // M2: Formality drift
  const formalityDrift = computeFormalityDrift(
    before.formality,
    after.formality
  );

  // M3: Lexical features drift
  const lexicalDrift = computeLexicalDrift(
    before.lexicalFeatures,
    after.lexicalFeatures
  );

  return {
    sentenceStructure: {
      ...after.sentenceStructure,
      drift: structureDrift
    },
    formality: {
      ...after.formality,
      drift: formalityDrift
    },
    lexicalFeatures: {
      ...after.lexicalFeatures,
      drift: lexicalDrift
    },
    timestamp: after.timestamp
  };
}

// ============================================================================
// PARSING UTILITIES
// ============================================================================

function parseStructureResponse(response: string) {
  try {
    const cleaned = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    // Validate complexity
    const validComplexity = ['simple', 'moderate', 'complex'];
    let complexity = 'moderate';
    if (validComplexity.includes(parsed.complexity)) {
      complexity = parsed.complexity;
    }

    return {
      sentence_count: Math.max(1, parsed.sentence_count || 1),
      avg_words_per_sentence: Math.max(1, parsed.avg_words_per_sentence || 10),
      longest: Math.max(1, parsed.longest || 10),
      shortest: Math.max(1, parsed.shortest || 5),
      complexity
    };
  } catch (error) {
    console.error('[Style POVM] Failed to parse structure:', error);
    return {
      sentence_count: 1,
      avg_words_per_sentence: 10,
      longest: 10,
      shortest: 10,
      complexity: 'moderate'
    };
  }
}

function parseFormalityResponse(response: string) {
  try {
    const cleaned = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    // Validate formality level
    const formality = Math.max(0, Math.min(10, parsed.formality || 5));

    // Validate register
    const validRegisters = [
      'casual_speech', 'conversational', 'standard_prose',
      'formal_writing', 'academic', 'poetic', 'technical'
    ];

    let register = 'standard_prose';
    if (validRegisters.includes(parsed.register)) {
      register = parsed.register;
    }

    return { formality, register };
  } catch (error) {
    console.error('[Style POVM] Failed to parse formality:', error);
    return { formality: 5, register: 'standard_prose' };
  }
}

function parseLexicalResponse(response: string) {
  try {
    const cleaned = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    // Calculate lexical density if not provided
    let lexical_density = parsed.lexical_density || 0.5;
    if (parsed.unique_words && parsed.total_words && parsed.total_words > 0) {
      lexical_density = parsed.unique_words / parsed.total_words;
    }
    lexical_density = Math.max(0, Math.min(1, lexical_density));

    // Parse devices
    let devices: string[] = [];
    if (Array.isArray(parsed.devices)) {
      devices = parsed.devices.filter((d: any) => typeof d === 'string');
    }

    return {
      total_words: Math.max(1, parsed.total_words || 10),
      unique_words: Math.max(1, parsed.unique_words || 8),
      multisyllable_words: Math.max(0, parsed.multisyllable_words || 0),
      rare_words: Math.max(0, parsed.rare_words || 0),
      lexical_density,
      devices
    };
  } catch (error) {
    console.error('[Style POVM] Failed to parse lexical features:', error);
    return {
      total_words: 10,
      unique_words: 8,
      multisyllable_words: 0,
      rare_words: 0,
      lexical_density: 0.8,
      devices: []
    };
  }
}

// ============================================================================
// DRIFT CALCULATION UTILITIES
// ============================================================================

/**
 * Compute sentence structure drift
 * - Count drift: |before - after| / max(before, after)
 * - Avg length drift: |before - after| / max(before, after)
 * - Complexity drift: 0% same, 50% adjacent (simple↔moderate, moderate↔complex), 100% opposite (simple↔complex)
 * - Overall: average of all three
 */
function computeStructureDrift(
  before: StylePOVMMeasurement['sentenceStructure'],
  after: StylePOVMMeasurement['sentenceStructure']
): number {
  const countDrift = Math.abs(before.count - after.count) / Math.max(before.count, after.count);
  const avgLengthDrift = Math.abs(before.avgWordsPerSentence - after.avgWordsPerSentence) /
                          Math.max(before.avgWordsPerSentence, after.avgWordsPerSentence);

  // Complexity drift
  let complexityDrift = 0;
  if (before.complexity !== after.complexity) {
    const complexityMap: { [key: string]: number } = {
      'simple': 0,
      'moderate': 1,
      'complex': 2
    };
    const beforeVal = complexityMap[before.complexity] || 1;
    const afterVal = complexityMap[after.complexity] || 1;
    const distance = Math.abs(beforeVal - afterVal);
    complexityDrift = distance === 1 ? 0.5 : 1.0;
  }

  return (countDrift + avgLengthDrift + complexityDrift) / 3;
}

/**
 * Compute formality drift
 * - Level drift: |before - after| / 10
 * - Register drift: 0% same, 100% different
 * - Overall: weighted average (50% level, 50% register)
 */
function computeFormalityDrift(
  before: StylePOVMMeasurement['formality'],
  after: StylePOVMMeasurement['formality']
): number {
  const levelDrift = Math.abs(before.level - after.level) / 10;
  const registerDrift = before.register === after.register ? 0 : 1.0;

  return (levelDrift + registerDrift) / 2;
}

/**
 * Compute lexical features drift
 * - Density drift: |before - after|
 * - Devices drift: Jaccard similarity of device sets
 * - Overall: average
 */
function computeLexicalDrift(
  before: StylePOVMMeasurement['lexicalFeatures'],
  after: StylePOVMMeasurement['lexicalFeatures']
): number {
  const densityDrift = Math.abs(before.lexicalDensity - after.lexicalDensity);

  // Devices drift (Jaccard distance)
  let devicesDrift = 0;
  if (before.devices.length === 0 && after.devices.length === 0) {
    devicesDrift = 0;
  } else if (before.devices.length === 0 || after.devices.length === 0) {
    devicesDrift = 1.0;
  } else {
    const beforeSet = new Set(before.devices.map(d => d.toLowerCase()));
    const afterSet = new Set(after.devices.map(d => d.toLowerCase()));
    const intersection = new Set([...beforeSet].filter(d => afterSet.has(d)));
    const union = new Set([...beforeSet, ...afterSet]);
    const jaccard = intersection.size / union.size;
    devicesDrift = 1 - jaccard;
  }

  return (densityDrift + devicesDrift) / 2;
}
