/**
 * Discover Book Themes - Multi-Faceted Analysis
 *
 * Uses tag clustering, temporal analysis, and semantic anchors
 * to discover themes for the humanizer development book.
 */

import { PostgresContentStore } from '../src/storage/postgres-content-store.js';

interface Memory {
  id: string;
  text: string;
  title: string;
  tags: string[];
  sourceCreatedAt: Date;
  embedding: number[];
  memoryType?: string;
  sourceType: string;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function computeCentroid(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];
  const dim = embeddings[0].length;
  const centroid = new Array(dim).fill(0);
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += emb[i];
    }
  }
  for (let i = 0; i < dim; i++) {
    centroid[i] /= embeddings.length;
  }
  return centroid;
}

async function discoverThemes() {
  console.log('═'.repeat(70));
  console.log(' HUMANIZER BOOK THEME DISCOVERY');
  console.log('═'.repeat(70));

  const store = new PostgresContentStore({ enableVec: true, enableFTS: true });
  await store.initialize();
  const pool = store.getPool();

  // Fetch all memories with embeddings
  const result = await pool.query(`
    SELECT id, text, title, tags, source_created_at, embedding::text as emb,
           source_metadata->>'memoryType' as memory_type, source_type
    FROM content_nodes
    WHERE (source_type = 'markdown-memory' OR source_type = 'markdown-document')
      AND embedding IS NOT NULL
    ORDER BY source_created_at ASC
  `);

  const memories: Memory[] = result.rows.map(row => ({
    id: row.id,
    text: row.text,
    title: row.title || '',
    tags: row.tags || [],
    sourceCreatedAt: new Date(row.source_created_at),
    embedding: JSON.parse(row.emb),
    memoryType: row.memory_type,
    sourceType: row.source_type,
  }));

  console.log(`\nLoaded ${memories.length} memories with embeddings\n`);

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 1: TAG-BASED THEME CLUSTERS
  // ═══════════════════════════════════════════════════════════════════
  console.log('═'.repeat(70));
  console.log(' SECTION 1: TAG-BASED THEMES');
  console.log('═'.repeat(70));

  // Define theme tag groups (curated based on known development areas)
  const themeGroups: Record<string, string[]> = {
    'Origins & Carchive': ['carchive', 'flask', 'python', 'sqlite', 'postgres'],
    'Quantum Narrative System': ['quantum', 'rho', 'povm', 'trm', 'tetralemma', 'narrative'],
    'AI Detection': ['ai-detection', 'detection', 'gptzero', 'tells', 'sic', 'chekhov'],
    'Transformation Engine': ['transformation', 'persona', 'style', 'humanizer', 'allegory'],
    'LLM Integration': ['llm', 'ollama', 'claude', 'anthropic', 'deepseek', 'model'],
    'Archive & Import': ['archive', 'import', 'parser', 'media', 'openai', 'chatgpt'],
    'Embeddings & Search': ['embeddings', 'search', 'semantic', 'clustering', 'vector'],
    'Book Making': ['bookmaking', 'harvest', 'book', 'chapter', 'outline', 'draft'],
    'Frontend & Studio': ['frontend', 'react', 'ui', 'studio', 'workspace', 'buffer'],
    'Production & Deploy': ['production', 'deploy', 'cloudflare', 'wrangler', 'api'],
  };

  const themeMemories: Record<string, Memory[]> = {};

  for (const [theme, keywords] of Object.entries(themeGroups)) {
    themeMemories[theme] = memories.filter(m => {
      const memTags = m.tags.map(t => t.toLowerCase());
      const memText = m.text.toLowerCase();
      return keywords.some(kw =>
        memTags.includes(kw) || memText.includes(kw)
      );
    });
  }

  console.log('\nTheme sizes (by tag/keyword matching):');
  const sortedThemes = Object.entries(themeMemories)
    .sort((a, b) => b[1].length - a[1].length);

  for (const [theme, mems] of sortedThemes) {
    if (mems.length > 0) {
      const dateRange = mems.length > 0
        ? `${mems[0].sourceCreatedAt.toISOString().split('T')[0]} - ${mems[mems.length-1].sourceCreatedAt.toISOString().split('T')[0]}`
        : 'N/A';
      console.log(`  ${theme}: ${mems.length} memories (${dateRange})`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 2: TEMPORAL DEVELOPMENT ARC
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log(' SECTION 2: DEVELOPMENT TIMELINE');
  console.log('═'.repeat(70));

  const phases: Record<string, { start: string; end: string; description: string }> = {
    'Phase 1: Carchive Origins': { start: '2025-03-01', end: '2025-06-30', description: 'Python/Flask chat archive system' },
    'Phase 2: Humanizer Vision': { start: '2025-07-01', end: '2025-07-31', description: 'humanizer_api project, LPE transformation' },
    'Phase 3: Quantum Experiments': { start: '2025-08-01', end: '2025-08-31', description: 'Rho system, analytic lexicology' },
    'Phase 4: Narrative Studio': { start: '2025-09-01', end: '2025-10-31', description: 'React frontend, semantic search' },
    'Phase 5: Platform Consolidation': { start: '2025-11-01', end: '2025-12-15', description: 'Cloud deployment, tools framework' },
    'Phase 6: Book Making': { start: '2025-12-16', end: '2026-01-31', description: 'Harvest, outline, draft workflow' },
  };

  console.log('\nPhase breakdown:');
  for (const [phase, info] of Object.entries(phases)) {
    const phaseMems = memories.filter(m => {
      const d = m.sourceCreatedAt.toISOString().split('T')[0];
      return d >= info.start && d <= info.end;
    });
    console.log(`\n${phase} (${phaseMems.length} memories)`);
    console.log(`  ${info.description}`);

    // Get top keywords for this phase
    const phaseText = phaseMems.map(m => m.text).join(' ').toLowerCase();
    const words = phaseText.split(/\s+/).filter(w => w.length > 6);
    const wordFreq = new Map<string, number>();
    const stopwords = new Set(['however', 'because', 'through', 'between', 'something', 'actually', 'different', 'should', 'would', 'could', 'really', 'complete', 'session', 'handoff', 'created', 'updated']);
    for (const word of words) {
      if (!stopwords.has(word) && !/^\d+$/.test(word)) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }
    }
    const topWords = [...wordFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);
    console.log(`  Key terms: ${topWords.join(', ')}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 3: SEMANTIC ANCHOR DISCOVERY
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log(' SECTION 3: SEMANTIC ANCHORS');
  console.log('═'.repeat(70));

  // Define anchor queries (key concepts to find related content)
  const anchorQueries = [
    'debugging session fixed critical bug error resolution',
    'architecture design decision system structure',
    'AI detection tells patterns human vs machine writing',
    'transformation engine persona style rewriting',
    'quantum narrative measurement POVM semantic operators',
    'book making harvest outline draft chapter',
    'LLM model comparison benchmark evaluation',
    'user interface React component workspace',
  ];

  console.log('\nFinding memories nearest to semantic anchors:');

  for (const query of anchorQueries) {
    // Find memories that mention key terms from the query
    const queryTerms = query.toLowerCase().split(' ');
    const matchingMems = memories.filter(m => {
      const text = m.text.toLowerCase();
      return queryTerms.filter(t => t.length > 3).some(t => text.includes(t));
    });

    if (matchingMems.length > 5) {
      // Compute centroid of matching memories
      const centroid = computeCentroid(matchingMems.map(m => m.embedding));

      // Find closest memories to centroid
      const withDist = matchingMems.map(m => ({
        ...m,
        dist: 1 - cosineSimilarity(m.embedding, centroid),
      })).sort((a, b) => a.dist - b.dist);

      console.log(`\n"${query.substring(0, 50)}..."`);
      console.log(`  Matched: ${matchingMems.length} memories`);
      console.log('  Top 3 (closest to centroid):');
      for (const m of withDist.slice(0, 3)) {
        const preview = m.text.substring(0, 80).replace(/\n/g, ' ');
        console.log(`    [${m.sourceCreatedAt.toISOString().split('T')[0]}] ${preview}...`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 4: LLM BENCHMARK CONTENT
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log(' SECTION 4: LLM BENCHMARK CONTENT');
  console.log('═'.repeat(70));

  const benchmarkDocs = memories.filter(m => m.sourceType === 'markdown-document');
  console.log(`\nLLM Benchmark documents: ${benchmarkDocs.length}`);

  if (benchmarkDocs.length > 0) {
    console.log('\nDocument titles:');
    for (const doc of benchmarkDocs.slice(0, 15)) {
      const title = doc.title || doc.text.substring(0, 60).replace(/\n/g, ' ');
      console.log(`  - ${title}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 5: BOOK CHAPTER RECOMMENDATIONS
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log(' RECOMMENDED BOOK STRUCTURE');
  console.log('═'.repeat(70));

  const chapters = [
    { title: 'Genesis: From Chat Archive to Vision', phase: 'Phase 1', themes: ['Origins & Carchive'] },
    { title: 'The Quantum Turn: Rho and Semantic Operators', phase: 'Phase 3', themes: ['Quantum Narrative System'] },
    { title: 'Detecting the Machine: AI Writing Tells', phase: 'Phase 4-5', themes: ['AI Detection'] },
    { title: 'The Transformation Engine', phase: 'Phase 2-5', themes: ['Transformation Engine'] },
    { title: 'LLM Benchmarks: A Comparative Study', phase: 'special', themes: ['LLM Benchmark Content'] },
    { title: 'Building the Studio', phase: 'Phase 4-5', themes: ['Frontend & Studio', 'Archive & Import'] },
    { title: 'The Debugging Chronicles', phase: 'all', themes: ['debugging', 'bugfix'] },
    { title: 'Making Books from Archives', phase: 'Phase 6', themes: ['Book Making'] },
  ];

  console.log('\nProposed chapters:');
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    // Count relevant memories
    let count = 0;
    if (ch.themes.includes('LLM Benchmark Content')) {
      count = benchmarkDocs.length;
    } else {
      for (const theme of ch.themes) {
        if (themeMemories[theme]) {
          count += themeMemories[theme].length;
        }
      }
    }
    console.log(`\n  Chapter ${i + 1}: "${ch.title}"`);
    console.log(`    Sources: ~${count} memories`);
    console.log(`    Themes: ${ch.themes.join(', ')}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // OUTPUT: SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log(' SUMMARY');
  console.log('═'.repeat(70));

  console.log(`
Total content available:
  - Development memories: ${memories.filter(m => m.sourceType === 'markdown-memory').length}
  - LLM benchmark docs: ${benchmarkDocs.length}
  - Date range: ${memories[0]?.sourceCreatedAt.toISOString().split('T')[0]} to ${memories[memories.length-1]?.sourceCreatedAt.toISOString().split('T')[0]}
  - Recommended chapters: ${chapters.length}

Next steps:
  1. Use harvest_for_thread to collect content for each chapter
  2. Apply persona rewriting to transform notes → narrative
  3. Use compose_chapter to generate drafts
`);

  console.log('═'.repeat(70) + '\n');

  await store.close();
}

discoverThemes().catch(console.error);
