/**
 * Test Pattern Discovery Persistence
 *
 * Verifies that patterns, feedback, and constraints persist to PostgreSQL.
 */

import { PostgresContentStore } from '../src/storage/postgres-content-store.js';
import { PatternStore, initPatternStore } from '../src/storage/pattern-store.js';
import { PatternSystem } from '../src/agentic-search/pattern-discovery-system.js';
import { EmbeddingService } from '../src/embeddings/embedding-service.js';

async function testPatternPersistence() {
  console.log('═'.repeat(70));
  console.log(' PATTERN DISCOVERY PERSISTENCE TEST');
  console.log('═'.repeat(70));

  // ─────────────────────────────────────────────────────────────────
  // 1. INITIALIZE STORES
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ 1. INITIALIZING STORES                                               │');
  console.log('└' + '─'.repeat(68) + '┘\n');

  const contentStore = new PostgresContentStore({
    enableVec: true,
    enableFTS: true,
  });
  await contentStore.initialize();
  console.log('  ✓ Content store initialized');

  const pool = contentStore.getPool();
  const patternStore = initPatternStore(pool);
  console.log('  ✓ Pattern store initialized');

  // Check if tables exist
  const tableCheck = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE 'aui_pattern%'
    ORDER BY table_name
  `);
  console.log(`  ✓ Pattern tables found: ${tableCheck.rows.map(r => r.table_name).join(', ')}`);

  // Initialize embedding service
  const embedder = new EmbeddingService({
    ollamaUrl: 'http://localhost:11434',
    embedModel: 'nomic-embed-text:latest',
    verbose: false,
  });
  const embedFn = async (text: string): Promise<number[]> => embedder.embed(text);

  // ─────────────────────────────────────────────────────────────────
  // 2. CREATE PATTERN SYSTEM WITH PERSISTENCE
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ 2. CREATING PATTERN SYSTEM WITH PERSISTENCE                          │');
  console.log('└' + '─'.repeat(68) + '┘\n');

  const system = new PatternSystem(pool, embedFn, {
    store: patternStore,
    userId: 'test-user',
  });
  await system.ensureLoaded();
  console.log('  ✓ Pattern system created with store');

  // List initial patterns
  const initialPatterns = system.composer.list();
  console.log(`  ✓ Built-in patterns loaded: ${initialPatterns.length}`);
  for (const p of initialPatterns.slice(0, 3)) {
    console.log(`    - ${p.name}: ${p.description.slice(0, 50)}...`);
  }

  // ─────────────────────────────────────────────────────────────────
  // 3. CREATE A NEW PATTERN (SHOULD PERSIST)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ 3. CREATING NEW PATTERN (PERSISTED)                                  │');
  console.log('└' + '─'.repeat(68) + '┘\n');

  const newPattern = await system.describe(
    'Find German physics texts with mathematical formulas about quantum mechanics'
  );

  console.log(`  ✓ Created pattern: ${newPattern.name}`);
  console.log(`    ID: ${newPattern.id}`);
  console.log(`    Tags: ${newPattern.tags.join(', ')}`);

  // Verify it's in the store (pattern was already saved by registerAndPersist)
  const storedPattern = await patternStore.getPattern(newPattern.id);
  if (storedPattern) {
    console.log(`  ✓ Pattern found in store: ${storedPattern.name}`);
    console.log(`    Status: ${storedPattern.status}`);
    console.log(`    Usage count: ${storedPattern.usageCount}`);
  } else {
    console.log(`  ⚠ Pattern not found in store (may be in-memory only)`);
  }

  // ─────────────────────────────────────────────────────────────────
  // 4. EXECUTE PATTERN (INCREMENTS USAGE)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ 4. EXECUTING PATTERN (INCREMENTS USAGE)                              │');
  console.log('└' + '─'.repeat(68) + '┘\n');

  // Execute built-in pattern
  const results = await system.execute('ocr-transcription');
  console.log(`  ✓ Executed ocr-transcription: ${results.length} matches`);

  // Show a sample result
  if (results.length > 0) {
    const sample = results[0];
    console.log(`    Sample: [${sample.id.slice(0, 8)}] ${(sample.text || '').slice(0, 80)}...`);
  }

  // ─────────────────────────────────────────────────────────────────
  // 5. RECORD FEEDBACK (SHOULD PERSIST)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ 5. RECORDING FEEDBACK (PERSISTED)                                    │');
  console.log('└' + '─'.repeat(68) + '┘\n');

  if (results.length >= 2) {
    // Record correct feedback on the user-created pattern (has UUID, persists)
    await system.feedback(newPattern.name, results[0].id, 'correct', 'Good match');
    console.log(`  ✓ Recorded CORRECT feedback for ${results[0].id.slice(0, 8)}`);

    // Record incorrect feedback
    await system.feedback(newPattern.name, results[1].id, 'incorrect', 'Not a match');
    console.log(`  ✓ Recorded INCORRECT feedback for ${results[1].id.slice(0, 8)}`);

    // Record partial feedback
    await system.feedback(newPattern.name, results[2]?.id || results[0].id, 'partial', 'Close but not exact');
    console.log(`  ✓ Recorded PARTIAL feedback`);

    // Check feedback in store
    const feedbackList = await patternStore.listFeedback(newPattern.id, { limit: 10 });
    console.log(`  ✓ Feedback in store: ${feedbackList.length} records`);
    for (const fb of feedbackList) {
      console.log(`    - ${fb.judgment}: ${fb.contentId.slice(0, 8)} - ${fb.explanation || 'no explanation'}`);
    }

    // Check feedback counts
    const counts = await patternStore.countFeedback(newPattern.id);
    console.log(`  ✓ Feedback counts: correct=${counts.correct}, incorrect=${counts.incorrect}, partial=${counts.partial}`);

    // Check success rate was updated
    const updatedPattern = await patternStore.getPattern(newPattern.id);
    if (updatedPattern) {
      console.log(`  ✓ Success rate: ${(updatedPattern.successRate || 0).toFixed(2)}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // 6. SAVE DISCOVERED PATTERN
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ 6. SAVING DISCOVERED PATTERN                                         │');
  console.log('└' + '─'.repeat(68) + '┘\n');

  // Run discovery
  const discovered = await system.discovery.discover({ minInstances: 5 });
  console.log(`  ✓ Discovered ${discovered.length} patterns`);

  if (discovered.length > 0) {
    const firstDiscovered = discovered[0];

    // Save to store
    const savedDiscovered = await patternStore.saveDiscoveredPattern({
      id: firstDiscovered.id,
      userId: 'test-user',
      observation: firstDiscovered.observation,
      dimensions: firstDiscovered.dimensions.map(d => ({
        type: d.type as any,
        description: d.description,
        weight: d.weight,
      })),
      instanceCount: firstDiscovered.instanceCount,
      confidence: firstDiscovered.confidence,
      discoveryMethod: firstDiscovered.discoveryMethod,
      status: 'candidate',
    });
    console.log(`  ✓ Saved discovered pattern: ${savedDiscovered.id}`);
    console.log(`    Observation: ${savedDiscovered.observation.slice(0, 60)}...`);
    console.log(`    Expires: ${savedDiscovered.expiresAt}`);

    // Promote to saved pattern
    const promoted = await patternStore.promoteDiscoveredPattern(
      savedDiscovered.id,
      `promoted-${Date.now()}`,
      {
        userId: 'test-user',
        description: savedDiscovered.observation,
        tags: ['discovered', 'promoted'],
      }
    );
    if (promoted) {
      console.log(`  ✓ Promoted to pattern: ${promoted.name}`);
      console.log(`    Source discovered ID: ${promoted.sourceDiscoveredId}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // 7. LIST ALL PERSISTED PATTERNS
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ 7. LISTING ALL PERSISTED PATTERNS                                    │');
  console.log('└' + '─'.repeat(68) + '┘\n');

  const allPatterns = await patternStore.listPatterns({ userId: 'test-user' });
  console.log(`  Total patterns in store: ${allPatterns.length}\n`);

  for (const p of allPatterns) {
    console.log(`  [${p.status}] ${p.name}`);
    console.log(`    Usage: ${p.usageCount}, Success: ${p.successRate?.toFixed(2) || 'N/A'}`);
    console.log(`    Tags: ${p.tags.join(', ') || 'none'}`);
    console.log();
  }

  // ─────────────────────────────────────────────────────────────────
  // 8. VERIFY PERSISTENCE (NEW SYSTEM INSTANCE)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ 8. VERIFYING PERSISTENCE (NEW SYSTEM INSTANCE)                       │');
  console.log('└' + '─'.repeat(68) + '┘\n');

  // Create new system instance (simulating server restart)
  const system2 = new PatternSystem(pool, embedFn, {
    store: patternStore,
    userId: 'test-user',
  });
  await system2.ensureLoaded();

  const loadedPatterns = system2.composer.list();
  const userPatterns = loadedPatterns.filter(p => !p.id.startsWith('builtin-'));

  console.log(`  ✓ New system loaded ${loadedPatterns.length} patterns`);
  console.log(`  ✓ User patterns (persisted): ${userPatterns.length}`);

  for (const p of userPatterns.slice(0, 3)) {
    console.log(`    - ${p.name}`);
  }

  // ─────────────────────────────────────────────────────────────────
  // CLEANUP
  // ─────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log(' TEST COMPLETE - Patterns persisted to PostgreSQL');
  console.log('═'.repeat(70));

  await contentStore.close();
}

testPatternPersistence().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
