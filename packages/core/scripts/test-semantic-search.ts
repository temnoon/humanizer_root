/**
 * Test semantic search using the Agentic Search Service
 */

import { PostgresContentStore } from '../src/storage/postgres-content-store.js';
import { EmbeddingService } from '../src/embeddings/embedding-service.js';
import { UnifiedStore, createAgenticSearchService } from '../src/agentic-search/index.js';

async function testSearch() {
  // Initialize archive store
  const archiveStore = new PostgresContentStore({
    enableVec: true,
    enableFTS: true,
  });
  await archiveStore.initialize();

  // Create unified store and embedding function
  const unifiedStore = new UnifiedStore(archiveStore);

  const embedder = new EmbeddingService({
    ollamaUrl: 'http://localhost:11434',
    embedModel: 'nomic-embed-text:latest',
    verbose: false,
  });

  // Create embedding function wrapper
  const embedFn = async (text: string): Promise<number[]> => {
    return embedder.embed(text);
  };

  // Create agentic search service
  const searchService = createAgenticSearchService(unifiedStore, embedFn);

  // Test queries
  const queries = [
    'machine learning and artificial intelligence',
    'cooking recipes and food preparation',
    'philosophy and consciousness',
    'programming bugs and debugging code',
    'travel destinations and vacation'
  ];

  for (const query of queries) {
    console.log('\n' + '='.repeat(70));
    console.log('Query:', query);
    console.log('='.repeat(70));

    try {
      const response = await searchService.search(query, {
        target: 'archive',
        limit: 5,
        threshold: 0.3,
        mode: 'hybrid',
      });

      console.log(`Found ${response.results.length} results (${response.stats.totalTimeMs}ms)`);

      if (response.results.length === 0) {
        console.log('No results found');
        continue;
      }

      for (const result of response.results) {
        const score = result.score.toFixed(3);
        const source = result.provenance.source;
        const type = result.provenance.sourceType;
        console.log(`\n[Score: ${score}] ${source}/${type}`);

        const preview = (result.text || '')
          .substring(0, 300)
          .replace(/\n+/g, ' ')
          .trim();
        console.log(preview + (result.text && result.text.length > 300 ? '...' : ''));
      }
    } catch (err) {
      console.error('Error:', err);
    }
  }

  await archiveStore.close();
}

testSearch().catch(console.error);
