/**
 * Search archive for Humanizer philosophy, House Council, handoff struggles
 */

import { PostgresContentStore } from '../src/storage/postgres-content-store.js';
import { EmbeddingService } from '../src/embeddings/embedding-service.js';
import { UnifiedStore, createAgenticSearchService } from '../src/agentic-search/index.js';
import * as fs from 'fs';

async function searchHumanizerPhilosophy() {
  const archiveStore = new PostgresContentStore({
    enableVec: true,
    enableFTS: true,
  });
  await archiveStore.initialize();

  const unifiedStore = new UnifiedStore(archiveStore);

  const embedder = new EmbeddingService({
    ollamaUrl: 'http://localhost:11434',
    embedModel: 'nomic-embed-text:latest',
    verbose: false,
  });

  const embedFn = async (text: string): Promise<number[]> => {
    return embedder.embed(text);
  };

  const searchService = createAgenticSearchService(unifiedStore, embedFn);

  const searches = [
    // Philosophy and mission
    {
      topic: 'Humanizer Philosophy',
      queries: [
        'what is humanizer for what is it about',
        'philosophy of humanizer phenomenology',
        'humanize themselves technology self understanding',
        'restore ownership creative output social media',
        'local first archive self rediscovery',
        'phenomenology being consciousness humanizer',
        'subjective experience meaning understanding',
      ],
    },
    // House Council
    {
      topic: 'House Council',
      queries: [
        'house council establishment governance',
        'council decision making architecture',
        'multi-agent council coordination',
        'house council protocol rules',
      ],
    },
    // ChromaDB memory as archive
    {
      topic: 'ChromaDB Memory Archive',
      queries: [
        'chromadb memory archive crucial',
        'memory server context persistence',
        'handoff memory transfer session',
        'chromadb storing development notes',
      ],
    },
    // Handoffs good and bad
    {
      topic: 'Handoff Struggles',
      queries: [
        'handoff lost context transfer crash',
        'good handoff bad handoff advice',
        'session crashed lost work recovery',
        'context lost between sessions',
        'what makes a good handoff',
      ],
    },
    // Mock operations left behind
    {
      topic: 'Mock Operations Problem',
      queries: [
        'mock data stub placeholder left behind',
        'assistant doing quickly mock later',
        'fake implementation real later forgotten',
        'placeholder code never replaced',
        'technical debt mock stubs',
      ],
    },
    // Foundation vs quick fixes
    {
      topic: 'Foundation vs Quick Fixes',
      queries: [
        'better foundation problem overcome',
        'refactor proper solution not patch',
        'architectural debt accumulation',
        'quick fix became permanent',
      ],
    },
    // Crashes and lost work
    {
      topic: 'Crashes and Lost Work',
      queries: [
        'crashed lost work frustration',
        'glitch bug destroyed progress',
        'had to redo everything lost',
        'terminal killed context gone',
      ],
    },
  ];

  const allResults: Array<{
    topic: string;
    query: string;
    results: Array<{
      score: number;
      text: string;
      source: string;
      type: string;
    }>;
  }> = [];

  for (const section of searches) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`TOPIC: ${section.topic}`);
    console.log('='.repeat(70));

    for (const query of section.queries) {
      console.log(`\n  Query: "${query}"`);

      try {
        const response = await searchService.search(query, {
          target: 'archive',
          limit: 5,
          threshold: 0.3,
          mode: 'hybrid',
        });

        const topicResults = {
          topic: section.topic,
          query,
          results: response.results.map((r) => ({
            score: r.score,
            text: r.text || '',
            source: r.provenance.source || 'unknown',
            type: r.provenance.sourceType || 'unknown',
          })),
        };

        allResults.push(topicResults);

        if (response.results.length === 0) {
          console.log('    No results');
          continue;
        }

        for (const result of response.results.slice(0, 3)) {
          const score = result.score.toFixed(3);
          const preview = (result.text || '')
            .substring(0, 200)
            .replace(/\n+/g, ' ')
            .trim();
          console.log(`    [${score}] ${preview}...`);
        }
      } catch (err) {
        console.error('    Error:', err);
      }
    }
  }

  const outputPath = './humanizer-output/humanizer-philosophy-search.json';
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2));
  console.log(`\nSaved ${allResults.length} search results to ${outputPath}`);

  await archiveStore.close();
}

searchHumanizerPhilosophy().catch(console.error);
