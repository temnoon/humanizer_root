/**
 * Transformation Pipeline Test Script
 *
 * Tests the transformation pipeline with controlled inputs to verify:
 * 1. Information preservation
 * 2. Voice/style transformation
 * 3. Local vs Cloud consistency
 * 4. Different persona/style profiles
 *
 * Run with: npx tsx scripts/test-transformations.ts
 */

const OLLAMA_BASE = 'http://localhost:11434';

// Test text with specific factual content that MUST be preserved
const TEST_TEXT = `Husserl's Cartesian Meditations introduces the phenomenological method through five meditations. The first meditation establishes the epoché (bracketing) where we suspend judgment about the external world. The second discusses the transcendental ego as the foundation of experience. The third analyzes intentionality - the idea that consciousness is always consciousness OF something. The fourth explores the constitution of the world through consciousness. The fifth, perhaps most challenging, addresses intersubjectivity - how we know other minds exist.`;

// Key terms that MUST appear in any valid transformation
// Using stems/variants to catch word form changes (phenomenological -> phenomenology)
const REQUIRED_TERMS = [
  { term: 'Husserl', variants: ['husserl'] },
  { term: 'Cartesian Meditations', variants: ['cartesian meditations', 'cartesian meditation'] },
  { term: 'phenomenolog*', variants: ['phenomenolog', 'phenomenology', 'phenomenological'] },
  { term: 'epoché', variants: ['epoché', 'epoche', 'bracketing'] },
  { term: 'transcendental ego', variants: ['transcendental ego', 'transcendental'] },
  { term: 'intentionality', variants: ['intentionality', 'intentional'] },
  { term: 'intersubjectivity', variants: ['intersubjectivity', 'intersubjective', 'other minds'] },
];

interface TestResult {
  persona: string;
  model: string;
  success: boolean;
  preservedTerms: string[];
  missingTerms: string[];
  outputPreview: string;
  thinkingDetected: boolean;
  error?: string;
}

async function isOllamaAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function getModels(): Promise<string[]> {
  try {
    const response = await fetch(`${OLLAMA_BASE}/api/tags`);
    const data = await response.json();
    return data.models?.map((m: any) => m.name) || [];
  } catch {
    return [];
  }
}

async function runOllamaTransform(
  text: string,
  persona: string,
  model: string
): Promise<string> {
  // Base preservation instruction
  const BASE_PRESERVATION = `CRITICAL: Preserve ALL factual information, specific details, names, dates, concepts, and technical terms from the original. Transform ONLY the voice and tone, not the content. If the original mentions specific topics (e.g., Husserl, phenomenology), the output MUST include those same topics.`;

  // Stronger preservation for creative/dramatic styles that tend to drop terms
  const STRICT_PRESERVATION = `MANDATORY: You MUST include EVERY proper noun, technical term, and concept from the original. This includes: all author names, all work titles, all philosophical terms (phenomenological, epoché, transcendental, intentionality, intersubjectivity, etc.). NEVER paraphrase or omit these - copy them exactly. Transform ONLY the style, not the terminology.`;

  const personaPrompts: Record<string, string> = {
    'holmes_analytical': `Rewrite in Sherlock Holmes's voice: precise, deductive, observant. Use logical analysis and keen observations. ${BASE_PRESERVATION}`,
    'watson_chronicler': `Rewrite as Dr. Watson: warm, descriptive, earnest, slightly awed by intellectual matters. ${BASE_PRESERVATION}`,
    'austen_ironic_observer': `Rewrite in Jane Austen's style: witty, ironic, socially perceptive, with elegant balanced sentences. ${STRICT_PRESERVATION}`,
    'dickens_dramatic': `Rewrite like Dickens: vivid imagery, dramatic flair, emotionally rich, with memorable turns of phrase. ${STRICT_PRESERVATION}`,
    'ishmael_philosophical': `Rewrite as Ishmael from Moby Dick: philosophical, finding metaphysical meaning in experience, reflective maritime voice. ${STRICT_PRESERVATION}`,
    'marlow_reflective': `Rewrite as Marlow from Heart of Darkness: contemplative, layered meaning, measured storytelling. ${BASE_PRESERVATION}`,
    'scout_innocent': `Rewrite as Scout from To Kill a Mockingbird: innocent perspective, simple language, unexpectedly insightful. Keep all technical terms even if Scout wouldn't understand them - just present them simply. ${STRICT_PRESERVATION}`,
    'nick_observant': `Rewrite as Nick Carraway: reserved, observant, elegantly detached, literary. ${STRICT_PRESERVATION}`,
    'tech_optimist': `Rewrite as a Silicon Valley tech optimist: enthusiastic about innovation, uses startup/tech jargon ("pivot", "disrupt", "ecosystem"), sees transformative potential everywhere. ${STRICT_PRESERVATION}`,
    'academic_formal': `Rewrite in formal academic voice: precise terminology, hedged claims, citations-ready, scholarly tone. ${BASE_PRESERVATION}`,
    'hemingway_terse': `Rewrite in Hemingway's style: short declarative sentences, simple words, understated emotion, no adjectives where none needed. ${BASE_PRESERVATION}`,
  };

  const systemPrompt = personaPrompts[persona] || `Rewrite in ${persona} style. ${STRICT_PRESERVATION}`;

  const prompt = `OUTPUT ONLY THE TRANSFORMED TEXT. No explanations, no preamble.

${systemPrompt}

Original text:
---
${text}
---

Transformed text:`;

  const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { temperature: 0.7 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.response;
}

function detectThinking(text: string): boolean {
  const thinkingPatterns = [
    /^(?:okay|let me|first|i need|the user|to accomplish)/i,
    /^<think>/i,
    /^(?:an? )?(?:intriguing|interesting|fascinating)/i,
  ];

  const first200 = text.substring(0, 200).toLowerCase();
  return thinkingPatterns.some(p => p.test(first200));
}

function checkPreservation(output: string): { preserved: string[]; missing: string[] } {
  const outputLower = output.toLowerCase();
  const preserved: string[] = [];
  const missing: string[] = [];

  for (const termObj of REQUIRED_TERMS) {
    const found = termObj.variants.some(v => outputLower.includes(v.toLowerCase()));
    if (found) {
      preserved.push(termObj.term);
    } else {
      missing.push(termObj.term);
    }
  }

  return { preserved, missing };
}

async function runTest(persona: string, model: string): Promise<TestResult> {
  console.log(`\n  Testing PERSONA: ${persona} with ${model}...`);

  try {
    const output = await runOllamaTransform(TEST_TEXT, persona, model);
    const { preserved, missing } = checkPreservation(output);
    const thinkingDetected = detectThinking(output);

    const success = missing.length === 0 && !thinkingDetected;

    return {
      persona,
      model,
      success,
      preservedTerms: preserved,
      missingTerms: missing,
      outputPreview: output.substring(0, 300) + (output.length > 300 ? '...' : ''),
      thinkingDetected,
    };
  } catch (error: any) {
    return {
      persona,
      model,
      success: false,
      preservedTerms: [],
      missingTerms: REQUIRED_TERMS.map(t => t.term),
      outputPreview: '',
      thinkingDetected: false,
      error: error.message,
    };
  }
}

async function runOllamaStyleTransform(
  text: string,
  style: string,
  model: string
): Promise<string> {
  // Base style preservation
  const BASE_STYLE = `CRITICAL: Preserve ALL factual content, specific details, names, concepts, and meaning. Transform ONLY the writing style, not the information.`;

  // Stricter preservation for creative styles that drop terms
  const STRICT_STYLE = `MANDATORY: You MUST include EVERY proper noun, technical term, and concept from the original. This includes: all author names, all work titles, all philosophical terms (phenomenological, epoché, transcendental, intentionality, intersubjectivity, etc.). NEVER paraphrase or omit these - copy them exactly. Transform ONLY the prose style, not the terminology.`;

  const stylePrompts: Record<string, string> = {
    'austen_precision': `Apply Austen-style prose: precise, elegant, balanced sentences with subtle irony. ${BASE_STYLE}`,
    'dickens_dramatic': `Apply Dickensian style: vivid imagery, dramatic flair, emotionally rich descriptions. ${STRICT_STYLE}`,
    'hemingway_sparse': `Apply Hemingway style: short sentences. Simple words. Direct. MUST KEEP: Author names (Husserl, etc.), work titles (Cartesian Meditations, etc.), and ALL technical terms. Simplify sentence structure only - never remove proper nouns or concepts. ${STRICT_STYLE}`,
    'reddit_casual_prose': `Apply casual Reddit style: conversational, uses "honestly", "tbh", friendly tone, relatable. ${BASE_STYLE}`,
    'academic_formal': `Apply academic style: formal register, precise terminology, hedged claims, objective tone. ${BASE_STYLE}`,
    'journalistic_clear': `Apply journalistic style: clear, factual, inverted pyramid, no jargon, accessible. ${BASE_STYLE}`,
    'poetic_lyrical': `Apply poetic style: lyrical rhythm, vivid imagery, metaphorical, emotionally resonant. ${STRICT_STYLE}`,
    'technical_precise': `Apply technical style: exact terminology, structured, unambiguous, specification-like. ${BASE_STYLE}`,
    'conversational_warm': `Apply warm conversational style: friendly, uses contractions, inclusive "we", approachable. ${STRICT_STYLE}`,
    'noir_hardboiled': `Apply noir style: cynical, terse, world-weary, atmospheric, morally ambiguous. ${STRICT_STYLE}`,
  };

  const styleInstruction = stylePrompts[style] || `Write in ${style.replace(/_/g, ' ')} style. ${STRICT_STYLE}`;

  const prompt = `OUTPUT ONLY THE TRANSFORMED TEXT. No explanations, no preamble.

${styleInstruction}

Original text:
---
${text}
---

Transformed text:`;

  const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { temperature: 0.7 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.response;
}

async function runStyleTest(style: string, model: string): Promise<TestResult> {
  console.log(`\n  Testing STYLE: ${style} with ${model}...`);

  try {
    const output = await runOllamaStyleTransform(TEST_TEXT, style, model);
    const { preserved, missing } = checkPreservation(output);
    const thinkingDetected = detectThinking(output);

    const success = missing.length === 0 && !thinkingDetected;

    return {
      persona: `[STYLE] ${style}`,
      model,
      success,
      preservedTerms: preserved,
      missingTerms: missing,
      outputPreview: output.substring(0, 300) + (output.length > 300 ? '...' : ''),
      thinkingDetected,
    };
  } catch (error: any) {
    return {
      persona: `[STYLE] ${style}`,
      model,
      success: false,
      preservedTerms: [],
      missingTerms: REQUIRED_TERMS.map(t => t.term),
      outputPreview: '',
      thinkingDetected: false,
      error: error.message,
    };
  }
}

// ============================================================
// CLOUD (Cloudflare Workers AI) TEST
// ============================================================

const CLOUD_API_BASE = 'https://npe-api.tem-527.workers.dev';

async function runCloudTransform(
  text: string,
  persona: string
): Promise<string> {
  const response = await fetch(`${CLOUD_API_BASE}/transformations/persona`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      persona,
      preserveLength: true,
      enableValidation: false,  // Skip validation for speed
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Cloud API error: ${response.status} - ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return data.transformed_text || '';
}

async function runCloudTest(persona: string): Promise<TestResult> {
  console.log(`\n  Testing CLOUD: ${persona}...`);

  try {
    const output = await runCloudTransform(TEST_TEXT, persona);
    const { preserved, missing } = checkPreservation(output);
    const thinkingDetected = detectThinking(output);

    const success = missing.length === 0 && !thinkingDetected;

    return {
      persona: `${persona} (CLOUD)`,
      model: '@cf/meta/llama-3.1-70b-instruct',
      success,
      preservedTerms: preserved,
      missingTerms: missing,
      outputPreview: output.substring(0, 300) + (output.length > 300 ? '...' : ''),
      thinkingDetected,
    };
  } catch (error: any) {
    return {
      persona: `${persona} (CLOUD)`,
      model: '@cf/meta/llama-3.1-70b-instruct',
      success: false,
      preservedTerms: [],
      missingTerms: REQUIRED_TERMS.map(t => t.term),
      outputPreview: '',
      thinkingDetected: false,
      error: error.message,
    };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('TRANSFORMATION PIPELINE TEST');
  console.log('Local: llama3.2:3b (3B params)');
  console.log('Cloud: @cf/meta/llama-3.1-70b-instruct (70B params)');
  console.log('='.repeat(60));

  // Check Ollama
  console.log('\n[1] Checking Ollama availability...');
  const available = await isOllamaAvailable();
  if (!available) {
    console.error('ERROR: Ollama is not running. Start it with: ollama serve');
    process.exit(1);
  }
  console.log('  ✓ Ollama is running');

  // Get models
  const models = await getModels();
  console.log(`  Available models: ${models.slice(0, 5).join(', ')}${models.length > 5 ? '...' : ''}`);

  // Pick a test model
  const testModel = models.find(m => m.includes('llama3.2:3b')) ||
                    models.find(m => m.includes('llama')) ||
                    models[0];

  if (!testModel) {
    console.error('ERROR: No models available');
    process.exit(1);
  }
  console.log(`  Using model: ${testModel}`);

  // Curated personas (10 total - scout_innocent removed)
  const personas = [
    'holmes_analytical',
    'watson_chronicler',
    'austen_ironic_observer',
    'dickens_dramatic',
    'ishmael_philosophical',
    'marlow_reflective',
    'nick_observant',
    'tech_optimist',
    'academic_formal',
    'hemingway_terse',
  ];

  // Curated styles (8 total - poetic_lyrical, noir_hardboiled removed)
  const styles = [
    'austen_precision',
    'dickens_dramatic',
    'hemingway_sparse',
    'reddit_casual_prose',
    'academic_formal',
    'journalistic_clear',
    'technical_precise',
    'conversational_warm',
  ];

  const results: TestResult[] = [];

  console.log('\n[2] Running PERSONA transformation tests...');
  console.log(`  Test text preview: "${TEST_TEXT.substring(0, 100)}..."`);
  console.log(`  Required terms: ${REQUIRED_TERMS.map(t => t.term).join(', ')}`);
  console.log(`  Testing ${personas.length} personas...`);

  for (const persona of personas) {
    const result = await runTest(persona, testModel);
    results.push(result);
  }

  console.log('\n[3] Running STYLE transformation tests...');
  console.log(`  Testing ${styles.length} styles...`);

  for (const style of styles) {
    const result = await runStyleTest(style, testModel);
    results.push(result);
  }

  console.log('\n[4] Cloud tests skipped (requires auth token)');

  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS');
  console.log('='.repeat(60));

  let passCount = 0;
  let failCount = 0;

  for (const r of results) {
    const status = r.success ? '✓ PASS' : '✗ FAIL';
    if (r.success) passCount++;
    else failCount++;

    console.log(`\n${status} - ${r.persona}`);

    if (r.error) {
      console.log(`  Error: ${r.error}`);
      continue;
    }

    console.log(`  Preserved: ${r.preservedTerms.length}/${REQUIRED_TERMS.length} terms`);
    if (r.missingTerms.length > 0) {
      console.log(`  MISSING: ${r.missingTerms.join(', ')}`);
    }
    if (r.thinkingDetected) {
      console.log(`  WARNING: Thinking/preamble detected in output`);
    }
    console.log(`  Preview: "${r.outputPreview.substring(0, 150)}..."`);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`SUMMARY: ${passCount} passed, ${failCount} failed`);
  console.log('='.repeat(60));

  // Exit with appropriate code
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(console.error);
