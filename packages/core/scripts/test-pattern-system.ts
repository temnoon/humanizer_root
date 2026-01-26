/**
 * Test Pattern Discovery System on Notebook Transcriptions
 */

import { PostgresContentStore } from '../src/storage/postgres-content-store.js';
import { EmbeddingService } from '../src/embeddings/embedding-service.js';
import { PatternSystem } from '../src/agentic-search/pattern-discovery-system.js';

async function testPatternSystem() {
  // Initialize store
  const store = new PostgresContentStore({
    enableVec: true,
    enableFTS: true,
  });
  await store.initialize();

  const pool = store.getPool();

  // Initialize embedding service
  const embedder = new EmbeddingService({
    ollamaUrl: 'http://localhost:11434',
    embedModel: 'nomic-embed-text:latest',
    verbose: false,
  });

  const embedFn = async (text: string): Promise<number[]> => {
    return embedder.embed(text);
  };

  // Create pattern system
  const system = new PatternSystem(pool, embedFn);

  console.log('═'.repeat(70));
  console.log(' PATTERN DISCOVERY SYSTEM TEST');
  console.log('═'.repeat(70));

  // ─────────────────────────────────────────────────────────────────
  // 1. AUTONOMOUS DISCOVERY
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ 1. AUTONOMOUS PATTERN DISCOVERY                                      │');
  console.log('└' + '─'.repeat(68) + '┘\n');

  const discovered = await system.discovery.discover({ minInstances: 5 });

  console.log(`Discovered ${discovered.length} patterns:\n`);
  for (const pattern of discovered.slice(0, 5)) {
    console.log(`  [${pattern.status}] ${pattern.observation}`);
    console.log(`    Confidence: ${(pattern.confidence * 100).toFixed(0)}%`);
    console.log(`    Instances: ${pattern.instanceCount}`);
    console.log(`    Method: ${pattern.discoveryMethod}`);
    console.log();
  }

  // ─────────────────────────────────────────────────────────────────
  // 2. USER-DESCRIBED PATTERN: Notebook OCR
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ 2. USER-DESCRIBED PATTERN: Notebook OCR                              │');
  console.log('└' + '─'.repeat(68) + '┘\n');

  const notebookPattern = await system.describe(`
    Find OCR transcriptions of handwritten notebook pages.
    These are assistant messages with code blocks that follow
    user messages containing uploaded images.
    Custom GPTs like Journal Recognizer produce these.
  `);

  console.log(`Created pattern: ${notebookPattern.name}`);
  console.log(`Tags: ${notebookPattern.tags.join(', ')}`);
  console.log();

  // Execute pattern
  console.log('Executing pattern...\n');
  const results = await system.execute(notebookPattern.name);
  console.log(`Found ${results.length} matches\n`);

  // Show results
  for (const result of results.slice(0, 5)) {
    const preview = (result.text || '').substring(0, 200).replace(/\n/g, ' ');
    console.log(`  [${result.id.slice(0, 8)}] ${result.author_role}`);
    console.log(`    ${preview}...`);
    console.log();
  }

  // ─────────────────────────────────────────────────────────────────
  // 3. EXECUTE BUILT-IN OCR PATTERN
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ 3. BUILT-IN OCR PATTERN                                              │');
  console.log('└' + '─'.repeat(68) + '┘\n');

  const ocrResults = await system.execute('ocr-transcription');
  console.log(`Built-in 'ocr-transcription' found ${ocrResults.length} matches\n`);

  // Show some actual transcriptions
  let transcriptCount = 0;
  for (const result of ocrResults) {
    if (result.text?.includes('```') &&
        (result.text?.toLowerCase().includes('transcri') ||
         result.text?.toLowerCase().includes('here is the'))) {
      transcriptCount++;
      if (transcriptCount <= 3) {
        const preview = (result.text || '').substring(0, 400).replace(/\n/g, '\n    ');
        console.log(`  [${result.id.slice(0, 8)}]`);
        console.log(`    ${preview}...`);
        console.log();
      }
    }
  }
  console.log(`  Total with transcription indicators: ${transcriptCount}`);

  // ─────────────────────────────────────────────────────────────────
  // 4. SIMULATE FEEDBACK LEARNING
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ 4. FEEDBACK LEARNING SIMULATION                                      │');
  console.log('└' + '─'.repeat(68) + '┘\n');

  // Find a JSON prompt (incorrect) and a real transcript (correct)
  let jsonPromptId: string | null = null;
  let realTranscriptId: string | null = null;

  for (const result of ocrResults) {
    if (!jsonPromptId && result.text?.includes('{"prompt"')) {
      jsonPromptId = result.id;
    }
    if (!realTranscriptId &&
        result.text?.includes('```') &&
        result.text?.toLowerCase().includes('transcri') &&
        !result.text?.includes('{"prompt"')) {
      realTranscriptId = result.id;
    }
    if (jsonPromptId && realTranscriptId) break;
  }

  if (jsonPromptId) {
    await system.feedback('ocr-transcription', jsonPromptId, 'incorrect',
      'This is a JSON prompt for image generation, not an OCR transcript');
    console.log(`  Recorded INCORRECT feedback for ${jsonPromptId.slice(0, 8)}`);
    console.log('    Reason: JSON prompt, not transcript\n');
  }

  if (realTranscriptId) {
    await system.feedback('ocr-transcription', realTranscriptId, 'correct',
      'This is a proper notebook transcription');
    console.log(`  Recorded CORRECT feedback for ${realTranscriptId.slice(0, 8)}`);
    console.log('    Reason: Proper notebook transcription\n');
  }

  // Check learned constraints
  const constraints = system.learner.getConstraints('builtin-ocr');
  console.log(`  Learned constraints: ${constraints.length}`);
  for (const c of constraints) {
    console.log(`    - ${c.description}`);
  }

  // ─────────────────────────────────────────────────────────────────
  // 5. PATTERN COMPOSITION: German Physics OCR
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ 5. PATTERN COMPOSITION: German Physics OCR                           │');
  console.log('└' + '─'.repeat(68) + '┘\n');

  // Create a filter for German physics content
  const germanPhysicsFilter = await system.describe(
    'German language text with mathematical formulas, physics terminology like Energie, Strahlung, Wellenlänge'
  );

  // Compose: OCR AND German physics
  const germanPhysicsOcr = system.composer.and(
    'german-physics-ocr',
    'OCR transcriptions of German physics texts with mathematical formulas',
    'ocr-transcription',
    germanPhysicsFilter.name
  );

  console.log(`Composed pattern: ${germanPhysicsOcr.name}`);
  console.log(`Description: ${germanPhysicsOcr.description}\n`);

  // For now, manually search for German physics content
  const germanResult = await pool.query(`
    SELECT id, substring(text, 1, 500) as preview
    FROM content_nodes
    WHERE source_type LIKE '%chatgpt%'
      AND author_role = 'assistant'
      AND text LIKE '%\`\`\`%'
      AND (
        text LIKE '%Energie%'
        OR text LIKE '%Strahlung%'
        OR text LIKE '%Wellenlänge%'
        OR text LIKE '%elektromagnetisch%'
      )
    LIMIT 5
  `);

  console.log(`Found ${germanResult.rows.length} German physics transcriptions:\n`);
  for (const row of germanResult.rows) {
    const preview = (row.preview || '').replace(/\n/g, '\n    ');
    console.log(`  [${row.id.slice(0, 8)}]`);
    console.log(`    ${preview}...`);
    console.log();
  }

  // ─────────────────────────────────────────────────────────────────
  // 6. PATTERN LIBRARY
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ 6. PATTERN LIBRARY                                                   │');
  console.log('└' + '─'.repeat(68) + '┘\n');

  const allPatterns = system.composer.list();
  console.log(`Total patterns: ${allPatterns.length}\n`);

  for (const p of allPatterns) {
    const type = p.definition.type === 'atomic' ? 'atomic  ' : 'composed';
    console.log(`  [${type}] ${p.name}`);
    console.log(`    ${p.description.slice(0, 60)}${p.description.length > 60 ? '...' : ''}`);
  }

  console.log('\n' + '═'.repeat(70));
  console.log(' TEST COMPLETE');
  console.log('═'.repeat(70));

  await store.close();
}

testPatternSystem().catch(console.error);
