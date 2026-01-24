/**
 * Create 3 Focused Philosophy Books
 *
 * Specifically targets clusters containing:
 * - Husserl/Phenomenology content
 * - Consciousness/World themes
 * - Understanding/Framework discussions
 *
 * Run: npx tsx scripts/create-focused-philosophy-books.ts
 */

import { initContentStore } from '../src/storage/postgres-content-store.js';
import { initUnifiedAui } from '../src/aui/index.js';

async function main() {
  console.log('='.repeat(70));
  console.log('FOCUSED PHILOSOPHY BOOK CREATION');
  console.log('='.repeat(70));
  console.log();

  // Initialize
  await initContentStore({
    host: 'localhost',
    port: 5432,
    database: 'humanizer_archive',
    user: 'tem',
  });

  const service = await initUnifiedAui();

  // Discover clusters with parameters optimized for philosophy content
  console.log('Discovering clusters with philosophy-optimized parameters...\n');

  const discovery = await service.discoverClusters({
    sampleSize: 5000,
    minClusterSize: 10,
    minSimilarity: 0.75,
    minWordCount: 20,
    authorRoles: ['user', 'assistant'], // Include assistant for philosophical discussions
  });

  console.log(`Found ${discovery.clusters.length} clusters\n`);

  // Deep philosophy keyword matching with weights
  const CORE_PHILOSOPHY = ['phenomenology', 'consciousness', 'husserl', 'intentionality', 'noesis', 'noema'];
  const ONTOLOGY = ['being', 'existence', 'world', 'reality', 'ontology'];
  const EPISTEMOLOGY = ['understanding', 'knowledge', 'meaning', 'truth', 'perception'];
  const EMBODIMENT = ['corporeal', 'embodied', 'body', 'perception', 'experience'];
  const SCIENCE = ['quantum', 'framework', 'theory', 'model', 'science'];

  interface ScoredCluster {
    cluster: typeof discovery.clusters[0];
    coreScore: number;
    ontologyScore: number;
    epistemologyScore: number;
    embodimentScore: number;
    scienceScore: number;
    totalScore: number;
    bestCategory: string;
  }

  const scoredClusters: ScoredCluster[] = discovery.clusters.map(cluster => {
    const text = (cluster.keywords.join(' ') + ' ' + cluster.description + ' ' +
      cluster.passages.slice(0, 5).map(p => p.text).join(' ')).toLowerCase();

    const countMatches = (keywords: string[]) =>
      keywords.filter(k => text.includes(k)).length;

    const coreScore = countMatches(CORE_PHILOSOPHY) * 3; // Weight core philosophy highest
    const ontologyScore = countMatches(ONTOLOGY) * 2;
    const epistemologyScore = countMatches(EPISTEMOLOGY) * 2;
    const embodimentScore = countMatches(EMBODIMENT) * 2;
    const scienceScore = countMatches(SCIENCE) * 1.5;

    const totalScore = coreScore + ontologyScore + epistemologyScore + embodimentScore + scienceScore;

    const scores = [
      { name: 'Phenomenology', score: coreScore },
      { name: 'Ontology', score: ontologyScore },
      { name: 'Epistemology', score: epistemologyScore },
      { name: 'Embodiment', score: embodimentScore },
      { name: 'Philosophy of Science', score: scienceScore },
    ];
    const bestCategory = scores.sort((a, b) => b.score - a.score)[0].name;

    return {
      cluster,
      coreScore,
      ontologyScore,
      epistemologyScore,
      embodimentScore,
      scienceScore,
      totalScore,
      bestCategory,
    };
  });

  // Sort by total score and filter for philosophy relevance
  const philosophyClusters = scoredClusters
    .filter(s => s.totalScore >= 3)
    .sort((a, b) => b.totalScore - a.totalScore);

  console.log('Top Philosophy Clusters:');
  console.log('-'.repeat(70));

  for (let i = 0; i < Math.min(10, philosophyClusters.length); i++) {
    const s = philosophyClusters[i];
    const c = s.cluster;
    console.log(`${i + 1}. ${c.label} [${s.bestCategory}]`);
    console.log(`   Score: ${s.totalScore.toFixed(1)} (core:${s.coreScore}, onto:${s.ontologyScore}, epist:${s.epistemologyScore})`);
    console.log(`   Coherence: ${c.coherence.toFixed(3)}, Passages: ${c.totalPassages}`);
    console.log(`   Sample: ${c.passages[0]?.text.substring(0, 100)}...`);
    console.log();
  }

  if (philosophyClusters.length < 3) {
    console.log('Not enough philosophy clusters found. Exiting.');
    process.exit(1);
  }

  // Select the best 3 for books
  const selectedClusters = philosophyClusters.slice(0, 3);

  const bookConfigs = [
    {
      cluster: selectedClusters[0],
      title: 'The Structure of Intentionality: Husserl and the Phenomenological Method',
      description: 'An exploration of consciousness, noesis and noema',
    },
    {
      cluster: selectedClusters[1],
      title: 'Being in the World: Ontological Reflections',
      description: 'On existence, reality, and our place in the cosmos',
    },
    {
      cluster: selectedClusters[2],
      title: 'Meaning and Understanding: Epistemological Investigations',
      description: 'How we come to know and understand our experience',
    },
  ];

  console.log('='.repeat(70));
  console.log('CREATING 3 PHILOSOPHY BOOKS');
  console.log('='.repeat(70));
  console.log();

  const books = [];

  for (const config of bookConfigs) {
    console.log(`📖 Creating: "${config.title}"`);
    console.log(`   Category: ${config.cluster.bestCategory}`);
    console.log(`   Source cluster: ${config.cluster.cluster.label}`);

    const book = await service.createBookFromCluster(config.cluster.cluster.id, {
      title: config.title,
      arcType: 'thematic',
      maxPassages: 30,
      generateIntro: true,
    });

    books.push({ ...book, config });

    console.log(`   ✓ Created: ${book.chapters.length} chapters, ${book.metadata.totalWordCount} words`);
    console.log();
  }

  // Output book details
  console.log('\n' + '='.repeat(70));
  console.log('BOOKS CREATED');
  console.log('='.repeat(70));

  for (const book of books) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`📖 ${book.title}`);
    console.log(`   ID: ${book.id}`);
    console.log(`   Description: ${book.config.description}`);
    console.log(`${'─'.repeat(70)}`);

    console.log(`\nIntroduction:\n${book.arc.introduction}\n`);
    console.log(`Themes: ${book.arc.themes.join(', ')}\n`);

    for (const chapter of book.chapters) {
      console.log(`\n### ${chapter.title}`);
      console.log(`Words: ${chapter.wordCount}`);
      console.log(`\nExcerpt:\n${chapter.content.substring(0, 400)}...\n`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log();
  console.log('3 Philosophy Books Created:');
  console.log();

  for (const book of books) {
    console.log(`  📖 ${book.title}`);
    console.log(`     Chapters: ${book.chapters.length}`);
    console.log(`     Total Words: ${book.metadata.totalWordCount}`);
    console.log();
  }

  const totalWords = books.reduce((sum, b) => sum + (b.metadata.totalWordCount ?? 0), 0);
  console.log(`Total Words Across All Books: ${totalWords}`);

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
