/**
 * Export Philosophy Books to Markdown Files
 *
 * Run: npx tsx scripts/export-philosophy-books.ts
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
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

  // Run cluster discovery with good parameters
  console.log('Discovering philosophy clusters...\n');

  const discovery = await service.discoverClusters({
    sampleSize: 3000,
    minClusterSize: 12,
    minSimilarity: 0.75,
    minWordCount: 20,
    authorRoles: ['user', 'assistant'],
  });

  // Score for philosophy content
  const phenomenologyKeywords = [
    'husserl', 'phenomenology', 'consciousness', 'intentionality',
    'noesis', 'noema', 'perception', 'experience', 'subjective', 'objective',
    'world', 'being', 'meaning', 'understanding', 'quantum', 'nagarjuna',
  ];

  const scoredClusters = discovery.clusters.map(c => {
    const allText = (c.keywords.join(' ') + ' ' + c.description + ' ' +
      c.passages.slice(0, 10).map(p => p.text).join(' ')).toLowerCase();
    const matchCount = phenomenologyKeywords.filter(kw => allText.includes(kw)).length;
    return { cluster: c, score: matchCount * c.coherence, matchCount };
  }).filter(s => s.matchCount > 0).sort((a, b) => b.score - a.score);

  console.log('Found ' + scoredClusters.length + ' philosophy clusters\n');

  // Create output directory
  const outputDir = join(process.cwd(), 'output', 'philosophy-books');
  mkdirSync(outputDir, { recursive: true });

  // Create 3 books from best clusters
  const bookConfigs = [
    { title: 'The Subjective-Objective Threshold', filename: '01-subjective-objective-threshold.md' },
    { title: 'Consciousness and World', filename: '02-consciousness-and-world.md' },
    { title: 'Phenomenological Reflections', filename: '03-phenomenological-reflections.md' },
  ];

  for (let i = 0; i < Math.min(3, scoredClusters.length); i++) {
    const config = bookConfigs[i];
    const cluster = scoredClusters[i].cluster;

    console.log('Creating: ' + config.title + '...');

    const book = await service.createBookFromCluster(cluster.id, {
      title: config.title,
      arcType: 'thematic',
      maxPassages: 30,
    });

    // Generate markdown
    let markdown = '# ' + book.title + '\n\n';
    markdown += '> ' + book.description + '\n\n';
    markdown += '---\n\n';
    markdown += '## Introduction\n\n';
    markdown += book.arc.introduction + '\n\n';
    markdown += '**Themes:** ' + book.arc.themes.join(', ') + '\n\n';
    markdown += '---\n\n';

    for (const chapter of book.chapters) {
      markdown += '## ' + chapter.title + '\n\n';
      markdown += '*' + chapter.wordCount + ' words*\n\n';
      markdown += chapter.content + '\n\n';
      markdown += '---\n\n';
    }

    markdown += '\n\n*Generated: ' + new Date().toISOString() + '*\n';
    markdown += '*Source cluster: ' + cluster.label + ' (coherence: ' + cluster.coherence.toFixed(3) + ')*\n';

    // Write file
    const filepath = join(outputDir, config.filename);
    writeFileSync(filepath, markdown, 'utf-8');
    console.log('  Exported: ' + filepath);
    console.log('  Words: ' + book.metadata.totalWordCount + '\n');
  }

  console.log('\n=== EXPORT COMPLETE ===');
  console.log('Files written to: ' + outputDir);

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
