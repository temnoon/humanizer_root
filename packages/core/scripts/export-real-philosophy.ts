import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { initContentStore, getContentStore } from '../src/storage/postgres-content-store.js';
import { initUnifiedAui } from '../src/aui/index.js';

async function main() {
  await initContentStore({ host: 'localhost', port: 5432, database: 'humanizer_archive', user: 'tem' });
  const service = await initUnifiedAui();
  const store = getContentStore()!;

  // Search directly for philosophy terms
  const queries = [
    'Husserl phenomenology intentionality noesis noema',
    'consciousness subjective objective QBism quantum',
    'Nagarjuna catuskoti Buddhist ontology',
  ];

  const outputDir = join(process.cwd(), 'output', 'philosophy-books');
  mkdirSync(outputDir, { recursive: true });

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    console.log('Searching: ' + query);
    
    // Use keyword search to find actual philosophy content
    const results = await store.searchByKeyword(query, { limit: 30 });
    
    if (results.length === 0) {
      console.log('  No results found\n');
      continue;
    }

    console.log('  Found ' + results.length + ' passages');

    // Build markdown book
    const titles = [
      'Husserl and Phenomenological Method',
      'Consciousness QBism and the Quantum Mind',
      'Nagarjuna and Buddhist Ontology',
    ];

    let md = '# ' + titles[i] + '\n\n';
    md += '> Search query: ' + query + '\n\n---\n\n';
    
    let totalWords = 0;
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      const text = r.node.text || '';
      const words = text.split(/\s+/).length;
      totalWords += words;
      
      md += '## Passage ' + (j + 1) + '\n\n';
      md += '*Source: ' + r.node.sourceType + ', ' + words + ' words*\n\n';
      md += text + '\n\n---\n\n';
    }

    md += '\n*Total: ' + results.length + ' passages, ' + totalWords + ' words*\n';
    md += '*Generated: ' + new Date().toISOString() + '*\n';

    const filename = (i + 1) + '-' + titles[i].toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.md';
    writeFileSync(join(outputDir, filename), md);
    console.log('  Exported: ' + filename + ' (' + totalWords + ' words)\n');
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
