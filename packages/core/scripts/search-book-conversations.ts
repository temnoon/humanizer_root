/**
 * Search archive for conversations related to Building Humanizer book chapters
 */

import { PostgresContentStore } from '../src/storage/postgres-content-store.js';
import { EmbeddingService } from '../src/embeddings/embedding-service.js';
import { UnifiedStore, createAgenticSearchService } from '../src/agentic-search/index.js';
import * as fs from 'fs';

async function searchBookConversations() {
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

  const embedFn = async (text: string): Promise<number[]> => {
    return embedder.embed(text);
  };

  const searchService = createAgenticSearchService(unifiedStore, embedFn);

  // Book chapter topics for search
  const chapterSearches = [
    {
      chapter: '1. Genesis',
      queries: [
        'carchive python flask chatgpt export parser',
        'why I started building this project motivation',
        'chat archive processing conversation history',
        'openai export parser development',
      ],
    },
    {
      chapter: '2. Quantum Turn - Rho',
      queries: [
        'rho density matrix quantum mechanics text',
        'POVM measurement operators semantic',
        'purity entropy text measurement formalism',
        'reverse embeddings reconstruction failure',
        'embedding to words inverse problem',
        'density matrix eigenvalues text semantics',
      ],
    },
    {
      chapter: '3. AI Detection',
      queries: [
        'detecting AI generated text patterns',
        'Claude ChatGPT tells linguistic markers',
        'AI writing detection heuristics',
        'human vs machine writing distinguishing',
      ],
    },
    {
      chapter: '4. Transformation Engine',
      queries: [
        'persona transformation writing style',
        'style transfer text transformation',
        'preserving meaning while changing voice',
        'llm persona system prompts',
      ],
    },
    {
      chapter: '5. LLM Benchmarking',
      queries: [
        'model evaluation benchmarks comparison',
        'ollama llama mistral comparison testing',
        'narrative generation quality assessment',
        'local model vs cloud model tradeoffs',
      ],
    },
    {
      chapter: '6. Building Studio',
      queries: [
        'react typescript three panel layout',
        'studio interface design workspace',
        'buffer system state management',
        'mobile responsive bottom sheet design',
      ],
    },
    {
      chapter: '7. Debugging',
      queries: [
        'debugging frustrating bug hunting session',
        'production bug fix deployment',
        'late night coding debugging session',
        'troubleshooting integration error',
      ],
    },
    {
      chapter: '8. Making Books (Recursion)',
      queries: [
        'semantic harvesting book generation',
        'embedding search chapter assembly',
        'self-documenting code meta recursion',
        'narration engine quality iteration',
      ],
    },
    {
      chapter: 'Meta: Philosophical',
      queries: [
        'phenomenology intentionality consciousness',
        'meaning emergence semantic understanding',
        'AI understanding vs human understanding',
        'latent space representation meaning',
        'matrix multiplication brain understanding',
      ],
    },
  ];

  const allResults: Array<{
    chapter: string;
    query: string;
    results: Array<{
      score: number;
      text: string;
      source: string;
      type: string;
    }>;
  }> = [];

  for (const chapter of chapterSearches) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`CHAPTER: ${chapter.chapter}`);
    console.log('='.repeat(70));

    for (const query of chapter.queries) {
      console.log(`\n  Query: "${query}"`);

      try {
        const response = await searchService.search(query, {
          target: 'archive',
          limit: 3,
          threshold: 0.3,
          mode: 'hybrid',
        });

        const chapterResults = {
          chapter: chapter.chapter,
          query,
          results: response.results.map((r) => ({
            score: r.score,
            text: r.text || '',
            source: r.provenance.source || 'unknown',
            type: r.provenance.sourceType || 'unknown',
          })),
        };

        allResults.push(chapterResults);

        if (response.results.length === 0) {
          console.log('    No results');
          continue;
        }

        for (const result of response.results) {
          const score = result.score.toFixed(3);
          const preview = (result.text || '')
            .substring(0, 150)
            .replace(/\n+/g, ' ')
            .trim();
          console.log(`    [${score}] ${preview}...`);
        }
      } catch (err) {
        console.error('    Error:', err);
      }
    }
  }

  // Save results
  const outputPath = './humanizer-output/book-conversations-search.json';
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2));
  console.log(`\nSaved ${allResults.length} search results to ${outputPath}`);

  await archiveStore.close();
}

searchBookConversations().catch(console.error);
