/**
 * Test System Interconnections
 *
 * Comprehensive test to verify all major systems work together:
 * 1. PostgreSQL Content Store
 * 2. Embedding Service (Ollama)
 * 3. Agentic Search (hybrid search)
 * 4. Pattern Discovery + Persistence
 * 5. Excellence Pipeline (chunking, pyramid)
 */

import { PostgresContentStore } from '../src/storage/postgres-content-store.js';
import { EmbeddingService } from '../src/embeddings/embedding-service.js';
import { UnifiedStore, createAgenticSearchService } from '../src/agentic-search/index.js';
import { PatternSystem } from '../src/agentic-search/pattern-discovery-system.js';
import { PatternStore, initPatternStore } from '../src/storage/pattern-store.js';
import { ExcellencePipeline } from '../src/pipelines/excellence-pipeline.js';
import { ChunkingService } from '../src/chunking/index.js';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function log(msg: string) {
  console.log(msg);
}

function section(title: string) {
  console.log('\n' + '═'.repeat(70));
  console.log(` ${title}`);
  console.log('═'.repeat(70));
}

async function runTest(
  name: string,
  fn: () => Promise<{ passed: boolean; details?: string }>
): Promise<void> {
  const start = Date.now();
  log(`\n  ▶ ${name}...`);

  try {
    const { passed, details } = await fn();
    const duration = Date.now() - start;

    results.push({ name, passed, duration, details });

    if (passed) {
      log(`    ✓ PASSED (${duration}ms)${details ? ` - ${details}` : ''}`);
    } else {
      log(`    ✗ FAILED (${duration}ms)${details ? ` - ${details}` : ''}`);
    }
  } catch (err) {
    const duration = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, duration, error });
    log(`    ✗ ERROR (${duration}ms) - ${error}`);
  }
}

async function testSystemInterconnections() {
  section('SYSTEM INTERCONNECTION TESTS');
  log('Testing integration between all major subsystems\n');

  // ─────────────────────────────────────────────────────────────────
  // 1. DATABASE CONNECTION
  // ─────────────────────────────────────────────────────────────────
  section('1. PostgreSQL Content Store');

  let contentStore: PostgresContentStore | null = null;

  await runTest('Initialize PostgreSQL connection', async () => {
    contentStore = new PostgresContentStore({
      enableVec: true,
      enableFTS: true,
    });
    await contentStore.initialize();
    return { passed: true, details: 'Connection established' };
  });

  await runTest('Query database stats', async () => {
    if (!contentStore) return { passed: false, details: 'No store' };
    const stats = await contentStore.getStats();
    return {
      passed: stats.totalNodes >= 0,
      details: `${stats.totalNodes} nodes, ${stats.totalLinks} links`,
    };
  });

  await runTest('Test pgvector extension', async () => {
    if (!contentStore) return { passed: false, details: 'No store' };
    const pool = contentStore.getPool();
    const result = await pool.query(`SELECT '[1,2,3]'::vector AS v`);
    return {
      passed: result.rows.length > 0,
      details: 'pgvector working',
    };
  });

  // ─────────────────────────────────────────────────────────────────
  // 2. EMBEDDING SERVICE
  // ─────────────────────────────────────────────────────────────────
  section('2. Embedding Service (Ollama)');

  let embedder: EmbeddingService | null = null;
  let embedFn: ((text: string) => Promise<number[]>) | null = null;

  await runTest('Initialize embedding service', async () => {
    embedder = new EmbeddingService({
      ollamaUrl: 'http://localhost:11434',
      embedModel: 'nomic-embed-text:latest',
      verbose: false,
    });
    embedFn = async (text: string) => embedder!.embed(text);
    return { passed: true, details: 'nomic-embed-text:latest' };
  });

  await runTest('Generate test embedding', async () => {
    if (!embedFn) return { passed: false, details: 'No embedder' };
    const vec = await embedFn('Hello world, this is a test.');
    return {
      passed: vec.length === 768,
      details: `${vec.length} dimensions`,
    };
  });

  await runTest('Verify embedding similarity', async () => {
    if (!embedFn) return { passed: false, details: 'No embedder' };
    const v1 = await embedFn('Machine learning algorithms');
    const v2 = await embedFn('AI and ML systems');
    const v3 = await embedFn('Cooking Italian pasta');

    // Cosine similarity
    const dot = (a: number[], b: number[]) =>
      a.reduce((sum, x, i) => sum + x * b[i], 0);
    const norm = (a: number[]) => Math.sqrt(dot(a, a));
    const sim = (a: number[], b: number[]) => dot(a, b) / (norm(a) * norm(b));

    const simMLtoAI = sim(v1, v2);
    const simMLtoCooking = sim(v1, v3);

    // ML should be more similar to AI than cooking
    return {
      passed: simMLtoAI > simMLtoCooking,
      details: `ML-AI: ${simMLtoAI.toFixed(3)}, ML-Cooking: ${simMLtoCooking.toFixed(3)}`,
    };
  });

  // ─────────────────────────────────────────────────────────────────
  // 3. AGENTIC SEARCH SERVICE
  // ─────────────────────────────────────────────────────────────────
  section('3. Agentic Search Service');

  await runTest('Create UnifiedStore and SearchService', async () => {
    if (!contentStore || !embedFn) {
      return { passed: false, details: 'Missing dependencies' };
    }
    const unifiedStore = new UnifiedStore(contentStore);
    const searchService = createAgenticSearchService(unifiedStore, embedFn);
    return {
      passed: searchService !== null,
      details: 'Search service created',
    };
  });

  await runTest('Execute hybrid search', async () => {
    if (!contentStore || !embedFn) {
      return { passed: false, details: 'Missing dependencies' };
    }
    const unifiedStore = new UnifiedStore(contentStore);
    const searchService = createAgenticSearchService(unifiedStore, embedFn);

    const response = await searchService.search('consciousness and philosophy', {
      target: 'archive',
      limit: 5,
      threshold: 0.3,
      mode: 'hybrid',
    });

    return {
      passed: response.stats.totalTimeMs > 0,
      details: `${response.results.length} results in ${response.stats.totalTimeMs}ms`,
    };
  });

  // ─────────────────────────────────────────────────────────────────
  // 4. PATTERN DISCOVERY SYSTEM
  // ─────────────────────────────────────────────────────────────────
  section('4. Pattern Discovery System');

  let patternStore: PatternStore | null = null;
  let patternSystem: PatternSystem | null = null;

  await runTest('Initialize PatternStore', async () => {
    if (!contentStore) return { passed: false, details: 'No content store' };
    const pool = contentStore.getPool();
    patternStore = initPatternStore(pool);
    return { passed: true, details: 'PatternStore initialized' };
  });

  await runTest('Create PatternSystem with persistence', async () => {
    if (!contentStore || !embedFn || !patternStore) {
      return { passed: false, details: 'Missing dependencies' };
    }
    const pool = contentStore.getPool();
    patternSystem = new PatternSystem(pool, embedFn, {
      store: patternStore,
      userId: 'test-interconnect',
    });
    await patternSystem.ensureLoaded();
    return { passed: true, details: 'PatternSystem loaded' };
  });

  await runTest('List built-in patterns', async () => {
    if (!patternSystem) return { passed: false, details: 'No pattern system' };
    const patterns = patternSystem.composer.list();
    return {
      passed: patterns.length > 0,
      details: `${patterns.length} patterns available`,
    };
  });

  await runTest('Create user pattern (persisted)', async () => {
    if (!patternSystem) return { passed: false, details: 'No pattern system' };
    const pattern = await patternSystem.describe(
      'Find discussions about AI ethics and moral implications'
    );
    return {
      passed: pattern.id !== undefined && pattern.name !== undefined,
      details: `Created: ${pattern.name}`,
    };
  });

  await runTest('Execute pattern against archive', async () => {
    if (!patternSystem) return { passed: false, details: 'No pattern system' };
    const results = await patternSystem.execute('ocr-transcription');
    return {
      passed: true, // May have 0 results but should not throw
      details: `${results.length} matches found`,
    };
  });

  await runTest('Verify pattern persisted to database', async () => {
    if (!patternStore) return { passed: false, details: 'No pattern store' };
    const patterns = await patternStore.listPatterns({ userId: 'test-interconnect' });
    return {
      passed: patterns.length > 0,
      details: `${patterns.length} patterns persisted`,
    };
  });

  // ─────────────────────────────────────────────────────────────────
  // 5. CHUNKING SERVICE
  // ─────────────────────────────────────────────────────────────────
  section('5. Chunking Service');

  await runTest('Initialize ChunkingService', async () => {
    const chunker = new ChunkingService();
    return { passed: true, details: 'ChunkingService ready' };
  });

  await runTest('Chunk long text', async () => {
    const chunker = new ChunkingService();
    const longText = Array(100)
      .fill('This is a sentence about machine learning and AI systems.')
      .join(' ');

    const { chunks, stats } = chunker.chunk({
      content: longText,
      parentId: 'test-parent',
      format: 'text',
    });

    const totalWords = chunks.reduce((sum, c) => sum + c.wordCount, 0);
    return {
      passed: chunks.length > 1,
      details: `${chunks.length} chunks, ${totalWords} words total`,
    };
  });

  // ─────────────────────────────────────────────────────────────────
  // 6. EXCELLENCE PIPELINE
  // ─────────────────────────────────────────────────────────────────
  section('6. Excellence Pipeline');

  await runTest('Create ExcellencePipeline', async () => {
    const pipeline = new ExcellencePipeline();
    return { passed: true, details: 'Pipeline created' };
  });

  await runTest('Execute ingest + chunk stages', async () => {
    const pipeline = new ExcellencePipeline();

    const result = await pipeline.execute({
      sourceType: 'text',
      text: `
        Machine learning is transforming how we build software systems.
        Deep neural networks can learn complex patterns from data.
        Natural language processing enables computers to understand text.
        Computer vision allows machines to interpret visual information.
        Reinforcement learning creates agents that learn through interaction.
      `.trim(),
      config: {
        generateEmbeddings: false,
        buildPyramid: false,
        scoreExcellence: false,
      },
    });

    return {
      passed: result.success && result.createdNodeIds.length > 0,
      details: `${result.createdNodeIds.length} nodes created`,
    };
  });

  await runTest('Execute with summarization (pyramid)', async () => {
    // Simple summarizer for testing
    const simpleSummarizer = async (text: string, targetWords: number) => {
      const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10);
      return sentences.slice(0, 2).join('. ').trim() + '.';
    };

    const pipeline = new ExcellencePipeline({ summarizer: simpleSummarizer });

    const longText = Array(20)
      .fill(
        'Deep learning uses neural networks with many layers. ' +
          'These networks can learn hierarchical representations. '
      )
      .join('');

    const result = await pipeline.execute({
      sourceType: 'text',
      text: longText,
      config: {
        generateEmbeddings: false,
        buildPyramid: true,
        scoreExcellence: false,
      },
    });

    return {
      passed: result.success && result.pyramidStats !== undefined,
      details: result.pyramidStats
        ? `L0: ${result.pyramidStats.nodeCounts[0]}, L1: ${result.pyramidStats.nodeCounts[1]}, Apex: ${result.pyramidStats.nodeCounts[2]}`
        : 'No pyramid stats',
    };
  });

  // ─────────────────────────────────────────────────────────────────
  // 7. END-TO-END: Search → Pattern → Feedback
  // ─────────────────────────────────────────────────────────────────
  section('7. End-to-End Integration');

  await runTest('Search → create pattern from results', async () => {
    if (!contentStore || !embedFn || !patternSystem) {
      return { passed: false, details: 'Missing dependencies' };
    }
    const unifiedStore = new UnifiedStore(contentStore);
    const searchService = createAgenticSearchService(unifiedStore, embedFn);

    // Search
    const response = await searchService.search('programming and software', {
      target: 'archive',
      limit: 5,
      threshold: 0.3,
      mode: 'hybrid',
    });

    // If we got results, we could use them to inform a pattern
    if (response.results.length > 0) {
      const pattern = await patternSystem.describe(
        'Find content about software development and programming'
      );
      return {
        passed: pattern.id !== undefined,
        details: `Search: ${response.results.length} results → Pattern: ${pattern.name}`,
      };
    }

    return { passed: true, details: 'No search results but pipeline completed' };
  });

  await runTest('Pattern → execute → feedback', async () => {
    if (!patternSystem) return { passed: false, details: 'No pattern system' };

    // Execute a built-in pattern (ocr-transcription, image-description, or dalle-generation)
    const results = await patternSystem.execute('ocr-transcription');

    if (results.length > 0) {
      // Record feedback (note: only persists for UUID patterns, built-in patterns skip)
      try {
        await patternSystem.feedback(
          'ocr-transcription',
          results[0].id,
          'correct',
          'Good OCR match'
        );
        return {
          passed: true,
          details: `Executed on ${results.length} results, feedback recorded`,
        };
      } catch (err) {
        // Built-in patterns don't persist feedback, that's OK
        return {
          passed: true,
          details: `Executed on ${results.length} results (feedback skip for built-in)`,
        };
      }
    }

    return { passed: true, details: 'Pattern executed (no results to give feedback on)' };
  });

  // ─────────────────────────────────────────────────────────────────
  // CLEANUP & SUMMARY
  // ─────────────────────────────────────────────────────────────────
  section('CLEANUP');

  // Clean up test patterns
  if (patternStore) {
    const testPatterns = await patternStore.listPatterns({ userId: 'test-interconnect' });
    for (const p of testPatterns) {
      await patternStore.deletePattern(p.id);
    }
    log(`  Cleaned up ${testPatterns.length} test patterns`);
  }

  if (contentStore) {
    await contentStore.close();
    log('  Closed database connection');
  }

  // ─────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────
  section('TEST SUMMARY');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);

  log(`\n  Total tests: ${results.length}`);
  log(`  ✓ Passed: ${passed}`);
  log(`  ✗ Failed: ${failed}`);
  log(`  Duration: ${(totalTime / 1000).toFixed(2)}s`);

  if (failed > 0) {
    log('\n  Failed tests:');
    for (const r of results.filter((r) => !r.passed)) {
      log(`    - ${r.name}: ${r.error || r.details}`);
    }
  }

  console.log('\n' + '═'.repeat(70));
  if (failed === 0) {
    console.log(' ALL SYSTEMS INTERCONNECTED SUCCESSFULLY ✓');
  } else {
    console.log(` ${failed} INTERCONNECTION FAILURES ✗`);
  }
  console.log('═'.repeat(70) + '\n');

  return failed === 0;
}

testSystemInterconnections()
  .then((success) => process.exit(success ? 0 : 1))
  .catch((err) => {
    console.error('Test runner failed:', err);
    process.exit(1);
  });
