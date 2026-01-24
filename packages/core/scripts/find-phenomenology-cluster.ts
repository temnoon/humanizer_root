/**
 * Find and examine phenomenology/consciousness clusters in detail
 *
 * Run: npx tsx scripts/find-phenomenology-cluster.ts
 */

import { initContentStore } from '../src/storage/postgres-content-store.js';
import { initUnifiedAui } from '../src/aui/index.js';

async function main() {
  console.log('Initializing...\n');

  await initContentStore({
    host: 'localhost',
    port: 5432,
    database: 'humanizer_archive',
    user: 'tem',
  });

  const service = await initUnifiedAui();

  // Run clustering with philosophy-optimized params
  console.log('Running cluster discovery (sample=3000, minCluster=12, minSim=0.75)...\n');

  const discovery = await service.discoverClusters({
    sampleSize: 3000,
    minClusterSize: 12,
    minSimilarity: 0.75,
    minWordCount: 20,
    authorRoles: ['user', 'assistant'],
  });

  // Find clusters with specific phenomenology keywords
  const phenomenologyKeywords = [
    'husserl', 'phenomenology', 'consciousness', 'intentionality',
    'noesis', 'noema', 'perception', 'experience', 'subjective', 'objective',
    'world', 'being', 'meaning', 'understanding',
  ];

  console.log('Total clusters found: ' + discovery.clusters.length + '\n');

  // Score clusters by phenomenology relevance
  const scoredClusters = discovery.clusters.map(c => {
    const allText = (c.keywords.join(' ') + ' ' + c.description + ' ' +
      c.passages.slice(0, 10).map(p => p.text).join(' ')).toLowerCase();
    const matchCount = phenomenologyKeywords.filter(kw => allText.includes(kw)).length;
    return { cluster: c, score: matchCount * c.coherence, matchCount };
  }).filter(s => s.matchCount > 0).sort((a, b) => b.score - a.score);

  console.log('Phenomenology-relevant clusters: ' + scoredClusters.length + '\n');
  console.log('Top 5 phenomenology clusters:');
  console.log('-'.repeat(60));

  for (let i = 0; i < Math.min(5, scoredClusters.length); i++) {
    const s = scoredClusters[i];
    const c = s.cluster;
    console.log('\n' + (i + 1) + '. ' + c.label);
    console.log('   Score: ' + s.score.toFixed(2) + ', Matches: ' + s.matchCount + ', Coherence: ' + c.coherence.toFixed(3));
    console.log('   Passages: ' + c.totalPassages);
    console.log('   Keywords: ' + c.keywords.slice(0, 8).join(', '));
    console.log('   Sample: ' + (c.passages[0]?.text.substring(0, 150) || '') + '...');
  }

  // Create 3 books from best clusters
  if (scoredClusters.length >= 3) {
    console.log('\n' + '='.repeat(60));
    console.log('CREATING 3 PHILOSOPHY BOOKS');
    console.log('='.repeat(60) + '\n');

    const bookConfigs = [
      { title: 'The Subjective-Objective Threshold', cluster: scoredClusters[0].cluster },
      { title: 'Consciousness and World', cluster: scoredClusters[1].cluster },
      { title: 'Phenomenological Reflections', cluster: scoredClusters[2].cluster },
    ];

    const books = [];
    for (const config of bookConfigs) {
      console.log('Creating: "' + config.title + '" from cluster "' + config.cluster.label + '"...');

      const book = await service.createBookFromCluster(config.cluster.id, {
        title: config.title,
        arcType: 'thematic',
        maxPassages: 25,
      });

      books.push(book);
      console.log('  Created: ' + book.chapters.length + ' chapters, ' + book.metadata.totalWordCount + ' words');
      console.log();
    }

    // Show book content
    console.log('\n' + '='.repeat(60));
    console.log('BOOK CONTENT PREVIEW');
    console.log('='.repeat(60));

    for (const book of books) {
      console.log('\n--- ' + book.title + ' ---');
      console.log('Introduction: ' + book.arc.introduction.substring(0, 200) + '...');
      console.log('Themes: ' + book.arc.themes.join(', '));

      for (const ch of book.chapters) {
        console.log('\n  Chapter: ' + ch.title + ' (' + ch.wordCount + ' words)');
        console.log('  ' + ch.content.substring(0, 300).replace(/\n/g, ' ') + '...');
      }
    }

    console.log('\n\n' + '='.repeat(60));
    console.log('SUMMARY: Created 3 philosophy books');
    console.log('='.repeat(60));

    const totalWords = books.reduce((sum, b) => sum + (b.metadata.totalWordCount || 0), 0);
    console.log('Total words: ' + totalWords);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
