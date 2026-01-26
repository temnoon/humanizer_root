/**
 * Semantic Chapter Harvester
 *
 * Uses iterative semantic focusing to expand short prompts into rich
 * anchor passages, then harvests matching content via embedding similarity.
 *
 * The expansion step is crucial: short queries like "POVM measurement"
 * produce sparse embeddings. Expanded passages (100-300 words) create
 * richer vectors that better capture the essence of target content.
 *
 * Usage:
 *   npx tsx scripts/harvest-chapter-semantic.ts --seed "quantum reading" --expand
 *   npx tsx scripts/harvest-chapter-semantic.ts --anchor-file anchors.json
 */

import { PostgresContentStore } from '../src/storage/postgres-content-store.js';
import { EmbeddingService } from '../src/embeddings/embedding-service.js';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

interface Config {
  seed: string;
  expand: boolean;
  expansionModel: string;
  ollamaUrl: string;
  topK: number;
  minSimilarity: number;
  sourceTypes: string[] | null;
  outputFile: string | null;
  verbose: boolean;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    seed: '',
    expand: true,
    expansionModel: 'llama3.2:3b',
    ollamaUrl: 'http://localhost:11434',
    topK: 20,
    minSimilarity: 0.5,
    sourceTypes: null,
    outputFile: null,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--seed' && args[i + 1]) {
      config.seed = args[i + 1];
      i++;
    } else if (args[i] === '--no-expand') {
      config.expand = false;
    } else if (args[i] === '--model' && args[i + 1]) {
      config.expansionModel = args[i + 1];
      i++;
    } else if (args[i] === '--top-k' && args[i + 1]) {
      config.topK = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--min-similarity' && args[i + 1]) {
      config.minSimilarity = parseFloat(args[i + 1]);
      i++;
    } else if (args[i] === '--source-type' && args[i + 1]) {
      config.sourceTypes = args[i + 1].split(',').map(s => s.trim());
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      config.outputFile = args[i + 1];
      i++;
    } else if (args[i] === '--verbose') {
      config.verbose = true;
    }
  }

  return config;
}

// ═══════════════════════════════════════════════════════════════════
// SEMANTIC ANCHOR EXPANSION
// ═══════════════════════════════════════════════════════════════════

const EXPANSION_SYSTEM_PROMPT = `You are a semantic anchor generator. Your task is to expand a short seed phrase into a rich, detailed passage (150-250 words) that captures the full semantic space of the concept.

The expanded passage should:
1. Define the core concept clearly
2. Include related terminology and synonyms
3. Describe the context where this concept appears
4. Mention adjacent concepts and relationships
5. Use varied vocabulary to create a rich embedding

DO NOT:
- Add opinions or judgments
- Include meta-commentary ("This passage is about...")
- Use bullet points or lists
- Ask questions

Output ONLY the expanded passage, nothing else.`;

/**
 * Expand a short seed phrase into a rich semantic anchor passage
 */
async function expandSeedToAnchor(
  seed: string,
  ollamaUrl: string,
  model: string,
  verbose: boolean
): Promise<string> {
  const prompt = `Expand this seed phrase into a rich semantic anchor passage:\n\n"${seed}"`;

  if (verbose) {
    console.log(`\n  Expanding seed: "${seed}"`);
    console.log(`  Using model: ${model}`);
  }

  try {
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        system: EXPANSION_SYSTEM_PROMPT,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status}`);
    }

    const result = await response.json();
    const expanded = result.response?.trim();

    if (!expanded || expanded.length < 50) {
      console.log('  ⚠ Expansion too short, using seed directly');
      return seed;
    }

    if (verbose) {
      console.log(`  ✓ Expanded to ${expanded.split(/\s+/).length} words`);
      console.log(`\n  --- Expanded Anchor ---`);
      console.log(`  ${expanded.slice(0, 300)}...`);
      console.log(`  ------------------------\n`);
    }

    return expanded;
  } catch (error) {
    console.error('  ✗ Expansion failed:', error instanceof Error ? error.message : error);
    return seed;
  }
}

/**
 * Iterative refinement: expand, search, refine anchor based on top results
 */
async function iterativeSemanticFocus(
  seed: string,
  store: PostgresContentStore,
  embeddingService: EmbeddingService,
  config: Config,
  iterations: number = 2
): Promise<{ anchor: string; embedding: number[] }> {
  let currentAnchor = seed;
  let currentEmbedding: number[] = [];

  for (let i = 0; i < iterations; i++) {
    console.log(`\n  Iteration ${i + 1}/${iterations}`);

    // Expand current anchor
    if (config.expand) {
      currentAnchor = await expandSeedToAnchor(
        currentAnchor,
        config.ollamaUrl,
        config.expansionModel,
        config.verbose
      );
    }

    // Generate embedding for anchor
    currentEmbedding = await embeddingService.embed(currentAnchor);

    // If not last iteration, refine based on top results
    if (i < iterations - 1) {
      const pool = store.getPool();

      // Search for similar content
      const searchResult = await pool.query(`
        SELECT text, 1 - (embedding <=> $1::vector) as similarity
        FROM content_nodes
        WHERE embedding IS NOT NULL
        ${config.sourceTypes ? `AND source_type = ANY($2)` : ''}
        ORDER BY embedding <=> $1::vector
        LIMIT 5
      `, config.sourceTypes ? [`[${currentEmbedding.join(',')}]`, config.sourceTypes] : [`[${currentEmbedding.join(',')}]`]);

      if (searchResult.rows.length > 0) {
        // Extract key phrases from top results to refine anchor
        const topTexts = searchResult.rows
          .slice(0, 3)
          .map(r => r.text.slice(0, 200))
          .join(' ');

        // Create refinement seed combining original + discovered context
        currentAnchor = `${seed}. Context from archive: ${topTexts.slice(0, 500)}`;

        if (config.verbose) {
          console.log(`  Top similarity: ${searchResult.rows[0].similarity.toFixed(3)}`);
        }
      }
    }
  }

  return { anchor: currentAnchor, embedding: currentEmbedding };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN HARVESTING
// ═══════════════════════════════════════════════════════════════════

interface HarvestedPassage {
  id: string;
  text: string;
  similarity: number;
  sourceType: string;
  excellenceScore: number | null;
  createdAt: Date | null;
}

async function harvestChapter() {
  const config = parseArgs();

  if (!config.seed) {
    console.error('Error: --seed is required');
    console.log('Usage: npx tsx scripts/harvest-chapter-semantic.ts --seed "your topic"');
    process.exit(1);
  }

  console.log('═'.repeat(70));
  console.log(' SEMANTIC CHAPTER HARVESTER');
  console.log('═'.repeat(70));
  console.log(`\n  Seed: "${config.seed}"`);
  console.log(`  Expand: ${config.expand}`);
  console.log(`  Top K: ${config.topK}`);
  console.log(`  Min similarity: ${config.minSimilarity}`);
  if (config.sourceTypes) {
    console.log(`  Source types: ${config.sourceTypes.join(', ')}`);
  }

  // Initialize services
  const store = new PostgresContentStore({
    enableVec: true,
    enableFTS: true,
  });
  await store.initialize();

  const embeddingService = new EmbeddingService({
    ollamaUrl: 'http://localhost:11434',
    embedModel: 'nomic-embed-text',
  });

  // ─────────────────────────────────────────────────────────────────
  // STEP 1: Build semantic anchor
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ STEP 1: BUILDING SEMANTIC ANCHOR                                       │');
  console.log('└' + '─'.repeat(68) + '┘');

  const { anchor, embedding } = await iterativeSemanticFocus(
    config.seed,
    store,
    embeddingService,
    config,
    config.expand ? 2 : 1
  );

  console.log(`\n  Final anchor: ${anchor.split(/\s+/).length} words`);

  // ─────────────────────────────────────────────────────────────────
  // STEP 2: Harvest similar content
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ STEP 2: HARVESTING SIMILAR CONTENT                                     │');
  console.log('└' + '─'.repeat(68) + '┘\n');

  const pool = store.getPool();

  let query = `
    SELECT
      id,
      text,
      source_type,
      source_created_at,
      source_metadata->>'excellenceScore' as excellence_score,
      1 - (embedding <=> $1::vector) as similarity
    FROM content_nodes
    WHERE embedding IS NOT NULL
  `;
  const params: any[] = [`[${embedding.join(',')}]`];

  if (config.sourceTypes) {
    params.push(config.sourceTypes);
    query += ` AND source_type = ANY($${params.length})`;
  }

  query += ` AND 1 - (embedding <=> $1::vector) >= $${params.length + 1}`;
  params.push(config.minSimilarity);

  query += ` ORDER BY embedding <=> $1::vector LIMIT $${params.length + 1}`;
  params.push(config.topK);

  const result = await pool.query(query, params);

  const passages: HarvestedPassage[] = result.rows.map(row => ({
    id: row.id,
    text: row.text,
    similarity: parseFloat(row.similarity),
    sourceType: row.source_type,
    excellenceScore: row.excellence_score ? parseInt(row.excellence_score, 10) : null,
    createdAt: row.source_created_at ? new Date(row.source_created_at) : null,
  }));

  console.log(`  Found ${passages.length} passages above ${config.minSimilarity} similarity\n`);

  // Show results
  console.log('  Top passages:');
  for (const p of passages.slice(0, 10)) {
    const preview = p.text.slice(0, 80).replace(/\n/g, ' ');
    const score = p.excellenceScore ? `[${p.excellenceScore}]` : '[--]';
    console.log(`    ${(p.similarity * 100).toFixed(1)}% ${score} ${preview}...`);
  }

  // ─────────────────────────────────────────────────────────────────
  // STEP 3: Output
  // ─────────────────────────────────────────────────────────────────
  if (config.outputFile) {
    const fs = await import('fs/promises');
    const output = {
      seed: config.seed,
      anchor: anchor.slice(0, 500),
      harvestedAt: new Date().toISOString(),
      passageCount: passages.length,
      passages: passages.map(p => ({
        id: p.id,
        similarity: p.similarity,
        excellenceScore: p.excellenceScore,
        sourceType: p.sourceType,
        preview: p.text.slice(0, 200),
      })),
    };
    await fs.writeFile(config.outputFile, JSON.stringify(output, null, 2));
    console.log(`\n  ✓ Output saved to: ${config.outputFile}`);
  }

  // Summary stats
  const avgSimilarity = passages.reduce((sum, p) => sum + p.similarity, 0) / passages.length;
  const excellenceCount = passages.filter(p => p.excellenceScore && p.excellenceScore >= 75).length;
  const totalWords = passages.reduce((sum, p) => sum + p.text.split(/\s+/).length, 0);

  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ HARVEST SUMMARY                                                        │');
  console.log('└' + '─'.repeat(68) + '┘');
  console.log(`\n  Passages: ${passages.length}`);
  console.log(`  Total words: ${totalWords.toLocaleString()}`);
  console.log(`  Avg similarity: ${(avgSimilarity * 100).toFixed(1)}%`);
  console.log(`  Excellence tier: ${excellenceCount}`);
  console.log('═'.repeat(70) + '\n');

  await store.close();
  return passages;
}

harvestChapter()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Harvest failed:', err);
    process.exit(1);
  });
