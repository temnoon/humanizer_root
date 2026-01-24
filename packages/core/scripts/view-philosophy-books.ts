/**
 * View Philosophy Books Content
 *
 * Run: npx tsx scripts/view-philosophy-books.ts
 */

import { initContentStore } from '../src/storage/postgres-content-store.js';
import { initUnifiedAui, getUnifiedAui } from '../src/aui/index.js';

async function main() {
  // Initialize
  await initContentStore({
    host: 'localhost',
    port: 5432,
    database: 'humanizer_archive',
    user: 'tem',
  });

  const service = await initUnifiedAui();

  // First, re-run cluster discovery to find philosophy clusters
  console.log('Discovering clusters...\n');

  const discovery = await service.discoverClusters({
    sampleSize: 3000,
    minClusterSize: 15,
    minSimilarity: 0.78,
    minWordCount: 15,
  });

  // Find philosophy clusters by keyword matching
  const PHILOSOPHY_KEYWORDS = [
    'phenomenology', 'consciousness', 'subjective', 'objective', 'world',
    'being', 'perception', 'experience', 'understanding', 'meaning',
    'embodiment', 'corporeal', 'reality', 'existence',
  ];

  const philosophyClusters = discovery.clusters.filter(c => {
    const kws = c.keywords.map(k => k.toLowerCase());
    return PHILOSOPHY_KEYWORDS.some(pk => kws.some(k => k.includes(pk)));
  });

  console.log(`Found ${philosophyClusters.length} philosophy-relevant clusters:\n`);

  for (const c of philosophyClusters) {
    console.log(`${c.id}: ${c.label}`);
    console.log(`  Coherence: ${c.coherence.toFixed(3)}, Passages: ${c.totalPassages}`);
    console.log(`  Keywords: ${c.keywords.slice(0, 8).join(', ')}`);
    console.log(`  Sample: ${c.passages[0]?.text.substring(0, 200)}...`);
    console.log();
  }

  // Create books from the best 3 philosophy clusters
  const titles = [
    'The Subjective-Objective Threshold',
    'Phenomenology and the World',
    'Corporeal Being and Understanding',
  ];

  console.log('\n' + '='.repeat(60));
  console.log('CREATING 3 PHILOSOPHY BOOKS');
  console.log('='.repeat(60) + '\n');

  const books = [];
  for (let i = 0; i < Math.min(3, philosophyClusters.length); i++) {
    const cluster = philosophyClusters[i];
    const title = titles[i];

    console.log(`Creating: ${title}`);
    const book = await service.createBookFromCluster(cluster.id, {
      title,
      arcType: 'thematic',
      maxPassages: 30,
    });

    books.push(book);
    console.log(`  ✓ ${book.chapters.length} chapters, ${book.metadata.totalWordCount} words\n`);
  }

  // Display book content
  console.log('\n' + '='.repeat(60));
  console.log('BOOK CONTENTS');
  console.log('='.repeat(60) + '\n');

  for (const book of books) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📖 ${book.title}`);
    console.log(`${'─'.repeat(60)}`);
    console.log(`\nArc: ${book.arc.title}`);
    console.log(`Introduction: ${book.arc.introduction}\n`);
    console.log(`Themes: ${book.arc.themes.join(', ')}\n`);

    for (const chapter of book.chapters) {
      console.log(`\n### ${chapter.title} (${chapter.wordCount} words)\n`);
      // Show first 500 chars of content
      console.log(chapter.content.substring(0, 500) + '...\n');
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
