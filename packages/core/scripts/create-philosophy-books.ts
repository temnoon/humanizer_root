/**
 * Create 3 Philosophy Books from Archive Clusters
 *
 * Uses the Unified AUI service to:
 * 1. Discover clusters with enhanced parameters
 * 2. Find philosophy-related clusters by keywords
 * 3. Create books from the top 3 philosophy clusters
 *
 * Run: npx tsx scripts/create-philosophy-books.ts
 */

import { initContentStore } from '../src/storage/postgres-content-store.js';
import { initUnifiedAui, getUnifiedAui } from '../src/aui/index.js';

const PHILOSOPHY_KEYWORDS = [
  'phenomenology',
  'consciousness',
  'subjective',
  'objective',
  'world',
  'being',
  'perception',
  'experience',
  'intentionality',
  'embodiment',
  'corporeal',
  'reality',
  'knowledge',
  'understanding',
  'meaning',
  'existence',
  'ontology',
  'epistemology',
];

interface ClusterInfo {
  id: string;
  label: string;
  description: string;
  totalPassages: number;
  coherence: number;
  keywords: string[];
  philosophyScore: number;
}

async function main() {
  console.log('='.repeat(60));
  console.log('PHILOSOPHY BOOK CREATION PIPELINE');
  console.log('='.repeat(60));
  console.log();

  // 1. Initialize
  console.log('[1/5] Initializing content store...');
  await initContentStore({
    host: 'localhost',
    port: 5432,
    database: 'humanizer_archive',
    user: 'tem',
  });

  console.log('[2/5] Initializing Unified AUI service...');
  const service = await initUnifiedAui();

  // 2. Discover clusters with handoff parameters
  console.log('[3/5] Discovering clusters (sampleSize=3000, minClusterSize=15, minSimilarity=0.78)...');
  console.log('       This may take a moment...');

  const discoveryResult = await service.discoverClusters({
    sampleSize: 3000,
    minClusterSize: 15,
    minSimilarity: 0.78,
    minWordCount: 15,
    generateLabels: true,
    onProgress: (progress) => {
      console.log(`       [${progress.phase}] ${progress.message || ''}`);
    },
  });

  console.log();
  console.log(`Found ${discoveryResult.clusters.length} clusters:`);
  console.log(`  - Total passages sampled: ${discoveryResult.totalPassages}`);
  console.log(`  - Assigned to clusters: ${discoveryResult.assignedPassages}`);
  console.log(`  - Noise (unclustered): ${discoveryResult.noisePassages}`);
  console.log(`  - Duration: ${(discoveryResult.durationMs / 1000).toFixed(1)}s`);
  console.log();

  // 3. Score and rank clusters by philosophy relevance
  console.log('[4/5] Scoring clusters for philosophy content...');

  const scoredClusters: ClusterInfo[] = discoveryResult.clusters.map(cluster => {
    // Count philosophy keyword matches
    const keywordsLower = cluster.keywords.map(k => k.toLowerCase());
    const matchCount = PHILOSOPHY_KEYWORDS.filter(pk =>
      keywordsLower.some(k => k.includes(pk))
    ).length;

    // Also check the description
    const descLower = cluster.description.toLowerCase();
    const descMatches = PHILOSOPHY_KEYWORDS.filter(pk => descLower.includes(pk)).length;

    // Philosophy score: weighted combination of keyword matches and coherence
    const philosophyScore = (matchCount * 2 + descMatches) * cluster.coherence;

    return {
      id: cluster.id,
      label: cluster.label,
      description: cluster.description.substring(0, 150),
      totalPassages: cluster.totalPassages,
      coherence: cluster.coherence,
      keywords: cluster.keywords.slice(0, 10),
      philosophyScore,
    };
  });

  // Sort by philosophy score
  scoredClusters.sort((a, b) => b.philosophyScore - a.philosophyScore);

  console.log();
  console.log('Clusters ranked by philosophy relevance:');
  console.log('-'.repeat(60));

  for (let i = 0; i < Math.min(10, scoredClusters.length); i++) {
    const c = scoredClusters[i];
    const marker = i < 3 ? '★' : ' ';
    console.log(`${marker} ${i + 1}. ${c.label} (score: ${c.philosophyScore.toFixed(2)}, coherence: ${c.coherence.toFixed(3)})`);
    console.log(`     Passages: ${c.totalPassages}, Keywords: ${c.keywords.slice(0, 5).join(', ')}`);
  }
  console.log();

  // 4. Create books from top 3 philosophy clusters
  console.log('[5/5] Creating 3 philosophy books...');
  console.log();

  const bookTitles = [
    'The Subjective-Objective Threshold: Passages on Consciousness and World',
    'Phenomenology Meets Science: Explorations in Embodied Understanding',
    'Corporeal Being: Notes on Perception and Experience',
  ];

  const createdBooks: Array<{ id: string; title: string; chapters: number; words: number }> = [];

  for (let i = 0; i < Math.min(3, scoredClusters.length); i++) {
    const cluster = scoredClusters[i];
    const title = bookTitles[i] || `Philosophy Collection ${i + 1}`;

    console.log(`Creating book ${i + 1}/3: "${title}"`);
    console.log(`  Source cluster: ${cluster.label} (${cluster.totalPassages} passages)`);

    try {
      const book = await service.createBookFromCluster(cluster.id, {
        title,
        arcType: 'thematic',
        maxPassages: 50,
        generateIntro: true,
        onProgress: (progress) => {
          console.log(`    [${progress.phase}] ${progress.message || `Step ${progress.step}/${progress.totalSteps}`}`);
        },
      });

      createdBooks.push({
        id: book.id,
        title: book.title,
        chapters: book.chapters.length,
        words: book.metadata.totalWordCount ?? 0,
      });

      console.log(`  ✓ Created: ${book.id}`);
      console.log(`    Chapters: ${book.chapters.length}, Words: ${book.metadata.totalWordCount}`);
      console.log();
    } catch (error) {
      console.error(`  ✗ Failed: ${error instanceof Error ? error.message : String(error)}`);
      console.log();
    }
  }

  // Summary
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log();
  console.log(`Created ${createdBooks.length} philosophy books:`);
  console.log();

  for (const book of createdBooks) {
    console.log(`  📖 ${book.title}`);
    console.log(`     ID: ${book.id}`);
    console.log(`     Chapters: ${book.chapters}, Words: ${book.words}`);
    console.log();
  }

  // List all books
  const allBooks = await service.listBooks();
  console.log(`Total books in system: ${allBooks.length}`);

  console.log();
  console.log('Done!');

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
