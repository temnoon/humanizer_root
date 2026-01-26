/**
 * Narrated Chapter Generator
 *
 * Takes harvested development logs and writes narrative prose ABOUT them
 * in Tem Noon's voice. The logs become illustrative quotes embedded in
 * a story about the development journey.
 *
 * Usage:
 *   npx tsx scripts/narrate-chapter.ts --seed "quantum reading" --title "The Quantum Turn"
 */

import { PostgresContentStore } from '../src/storage/postgres-content-store.js';
import { EmbeddingService } from '../src/embeddings/embedding-service.js';

// ═══════════════════════════════════════════════════════════════════
// TEM NOON VOICE PERSONA
// ═══════════════════════════════════════════════════════════════════

const TEM_NOON_VOICE = `You are writing as Tem Noon, a philosopher-programmer who has spent decades thinking about consciousness, technology, and the nature of mind. You're writing a memoir-style chapter about building software.

VOICE CHARACTERISTICS (extracted from Tem's actual writing):

1. CONFESSIONAL & VULNERABLE
   - Admit struggles openly: "I can't tell you how scary that is for me"
   - Share doubts and fears alongside victories
   - "I'm smarter than this" - self-aware about patterns

2. DIGRESSIVE WITH PURPOSE
   - Tangents that loop back: "But I digress..."
   - Stories within stories that illuminate the main point
   - "Oh, why am I writing this?" - meta-commentary on the act of writing

3. MIXES MUNDANE AND PROFOUND
   - Propane bills alongside consciousness
   - Specific technical details AND existential meaning
   - "Yet I have trouble even trying to get gigs playing music" alongside "Vortex Consciousness"

4. PARENTHETICAL ASIDES
   - (scary that I haven't deleted this whole thing yet)
   - (read the better second, which is complete)
   - Thoughts interrupting thoughts

5. SPECIFIC NAMES AND PLACES
   - Vermont, CoSM, Burning Man, RPI, Hudson Valley
   - Real people, real venues, real timestamps
   - Ground abstractions in concrete reality

6. QUESTIONS TO SELF AND READER
   - "What fascinating things could I learn from you?"
   - "Questions... Questions..."
   - Invitations to think alongside

7. HUMOR - DRY AND UNEXPECTED
   - Mice on South Zaxor making psychedelic cheese
   - "the rock I've been pushing"
   - Self-deprecating but not self-pitying

8. SPIRITUAL/PHILOSOPHICAL BUT GROUNDED
   - Buddhism, consciousness, divine heart - but never floaty
   - Always returns to practical reality
   - "But it will all be OK"

WRITING STRUCTURE:

- Start with a personal moment or realization, not a summary
- Weave technical details into emotional/philosophical context
- Include development logs as BLOCK QUOTES that illustrate points
- Let the reader discover the significance through story
- End with reflection that connects to larger themes

NEVER:
- Use AI-tell phrases (delve, dive into, it's important to note)
- Write dry technical documentation
- Summarize without interpreting
- Lose the human struggling with the machine

The development logs are your SOURCE MATERIAL. You're writing ABOUT them,
not just presenting them. What did it FEEL like? What did it MEAN?
What was the 2am frustration? What was the moment of breakthrough?`;

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

interface Config {
  seed: string;
  title: string;
  sourceTypes: string[];
  topK: number;
  minSimilarity: number;
  ollamaUrl: string;
  expansionModel: string;
  narratorModel: string;
  outputFile: string | null;
  verbose: boolean;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    seed: '',
    title: 'Untitled Chapter',
    sourceTypes: ['markdown-memory', 'markdown-document'],
    topK: 12,
    minSimilarity: 0.55,
    ollamaUrl: 'http://localhost:11434',
    expansionModel: 'llama3.2:3b',
    narratorModel: 'llama3.2:3b', // Could use larger model for better narration
    outputFile: null,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--seed' && args[i + 1]) {
      config.seed = args[i + 1];
      i++;
    } else if (args[i] === '--title' && args[i + 1]) {
      config.title = args[i + 1];
      i++;
    } else if (args[i] === '--top-k' && args[i + 1]) {
      config.topK = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--min-similarity' && args[i + 1]) {
      config.minSimilarity = parseFloat(args[i + 1]);
      i++;
    } else if (args[i] === '--narrator-model' && args[i + 1]) {
      config.narratorModel = args[i + 1];
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

const EXPANSION_PROMPT = `Expand this seed phrase into a rich semantic anchor passage (150-200 words) that captures the full semantic space of the concept. Include related terminology, context, and adjacent concepts. Output ONLY the expanded passage.`;

async function expandSeed(seed: string, ollamaUrl: string, model: string): Promise<string> {
  try {
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: `Expand: "${seed}"`,
        system: EXPANSION_PROMPT,
        stream: false,
        options: { temperature: 0.7 },
      }),
    });

    if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
    const result = await response.json();
    return result.response?.trim() || seed;
  } catch {
    return seed;
  }
}

// ═══════════════════════════════════════════════════════════════════
// HARVEST LOGS
// ═══════════════════════════════════════════════════════════════════

interface LogEntry {
  id: string;
  text: string;
  similarity: number;
  date: string | null;
  excerpt: string; // Shortened for narrator context
}

async function harvestLogs(
  seed: string,
  store: PostgresContentStore,
  embeddingService: EmbeddingService,
  config: Config
): Promise<LogEntry[]> {
  console.log('  Expanding seed...');
  const anchor = await expandSeed(seed, config.ollamaUrl, config.expansionModel);
  console.log('  Generating embedding...');
  const embedding = await embeddingService.embed(anchor);
  console.log(`  Embedding: ${embedding.length} dims`);

  const pool = store.getPool();
  const embStr = '[' + embedding.join(',') + ']';

  console.log(`  Query params: sourceTypes=${config.sourceTypes}, minSim=${config.minSimilarity}, topK=${config.topK}`);

  const result = await pool.query(`
    SELECT
      id, text, source_created_at,
      1 - (embedding <=> $1::vector) as similarity
    FROM content_nodes
    WHERE embedding IS NOT NULL
      AND source_type = ANY($2)
      AND 1 - (embedding <=> $1::vector) >= $3
    ORDER BY embedding <=> $1::vector
    LIMIT $4
  `, [embStr, config.sourceTypes, config.minSimilarity, config.topK]);

  console.log(`  Query returned: ${result.rows.length} rows`);

  return result.rows.map(row => ({
    id: row.id,
    text: row.text,
    similarity: parseFloat(row.similarity),
    date: row.source_created_at ? new Date(row.source_created_at).toLocaleDateString() : null,
    // Create excerpt for narrator (first 500 chars, or key section)
    excerpt: extractKeyExcerpt(row.text, 500),
  }));
}

function extractKeyExcerpt(text: string, maxLength: number): string {
  // Try to find a meaningful section
  const lines = text.split('\n').filter(l => l.trim().length > 0);

  // Look for summary/status/result lines
  const keyPatterns = [
    /^(COMPLETED|STATUS|RESULT|KEY|SUMMARY|WHAT)/i,
    /^##?\s/,
    /✓|✅|COMPLETE/i,
  ];

  for (const line of lines) {
    for (const pattern of keyPatterns) {
      if (pattern.test(line.trim())) {
        const idx = text.indexOf(line);
        return text.slice(idx, idx + maxLength).trim() + (text.length > idx + maxLength ? '...' : '');
      }
    }
  }

  // Default to start
  return text.slice(0, maxLength).trim() + (text.length > maxLength ? '...' : '');
}

// ═══════════════════════════════════════════════════════════════════
// NARRATION GENERATION
// ═══════════════════════════════════════════════════════════════════

function buildNarratorPrompt(title: string, logs: LogEntry[]): string {
  const logsContext = logs.map((log, i) => {
    const dateStr = log.date ? ` (${log.date})` : '';
    return `--- LOG ${i + 1}${dateStr} [${(log.similarity * 100).toFixed(0)}% relevant] ---
${log.excerpt}
--- END LOG ${i + 1} ---`;
  }).join('\n\n');

  return `Write a narrative chapter titled "${title}" for a memoir about building the Humanizer software project.

You have ${logs.length} development logs as source material. Your job is to write ABOUT these logs—what they mean, what the struggle was, what it felt like—not just present them.

The chapter should be 800-1200 words of prose narrative with 2-4 embedded block quotes from the logs that illustrate key moments.

SOURCE MATERIAL (development logs):

${logsContext}

CHAPTER REQUIREMENTS:
1. Start with a personal moment, observation, or question—not a summary
2. Tell the STORY of this development phase—the problem, the struggle, the insight, the resolution (or ongoing battle)
3. Embed 2-4 SHORT excerpts from the logs as block quotes (use > markdown format)
4. Connect the technical work to larger themes about consciousness, technology, or the human condition
5. End with reflection, not conclusion

Write the chapter now in Tem Noon's voice:`;
}

async function generateNarration(
  title: string,
  logs: LogEntry[],
  ollamaUrl: string,
  model: string,
  verbose: boolean
): Promise<string> {
  const prompt = buildNarratorPrompt(title, logs);

  if (verbose) {
    console.log(`\n  Generating narration with ${model}...`);
    console.log(`  Context: ${logs.length} logs, ~${prompt.length} chars`);
  }

  try {
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        system: TEM_NOON_VOICE,
        stream: false,
        options: {
          temperature: 0.8,
          top_p: 0.9,
          num_predict: 2000,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const result = await response.json();
    return result.response?.trim() || '';
  } catch (error) {
    console.error(`  ✗ Narration failed: ${error instanceof Error ? error.message : error}`);
    return '';
  }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════

async function narrateChapter() {
  const config = parseArgs();

  if (!config.seed) {
    console.error('Error: --seed is required');
    console.log('Usage: npx tsx scripts/narrate-chapter.ts --seed "topic" --title "Chapter Title"');
    process.exit(1);
  }

  console.log('═'.repeat(70));
  console.log(' NARRATED CHAPTER GENERATOR');
  console.log(' Voice: Tem Noon');
  console.log('═'.repeat(70));
  console.log(`\n  Title: "${config.title}"`);
  console.log(`  Seed: "${config.seed}"`);
  console.log(`  Narrator model: ${config.narratorModel}`);

  // Initialize
  const store = new PostgresContentStore({ enableVec: true, enableFTS: true });
  await store.initialize();

  const embeddingService = new EmbeddingService({
    ollamaUrl: config.ollamaUrl,
    embedModel: 'nomic-embed-text',
  });

  // ─────────────────────────────────────────────────────────────────
  // HARVEST
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ HARVESTING SOURCE MATERIAL                                             │');
  console.log('└' + '─'.repeat(68) + '┘\n');

  const logs = await harvestLogs(config.seed, store, embeddingService, config);

  console.log(`  Found ${logs.length} relevant logs`);
  if (config.verbose) {
    for (const log of logs.slice(0, 5)) {
      const preview = log.excerpt.slice(0, 60).replace(/\n/g, ' ');
      console.log(`    ${(log.similarity * 100).toFixed(0)}% | ${preview}...`);
    }
  }

  if (logs.length === 0) {
    console.log('  ⚠ No logs found. Try a different seed or lower similarity threshold.');
    await store.close();
    return;
  }

  // ─────────────────────────────────────────────────────────────────
  // NARRATE
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ GENERATING NARRATION                                                   │');
  console.log('└' + '─'.repeat(68) + '┘\n');

  const narration = await generateNarration(
    config.title,
    logs,
    config.ollamaUrl,
    config.narratorModel,
    config.verbose
  );

  if (!narration) {
    console.log('  ✗ Failed to generate narration');
    await store.close();
    return;
  }

  const wordCount = narration.split(/\s+/).length;
  console.log(`  ✓ Generated ${wordCount} words`);

  // ─────────────────────────────────────────────────────────────────
  // OUTPUT
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ OUTPUT                                                                 │');
  console.log('└' + '─'.repeat(68) + '┘\n');

  const output = `# ${config.title}

${narration}

---

*Chapter generated from ${logs.length} development logs*
*Seed: "${config.seed}"*
`;

  if (config.outputFile) {
    const fs = await import('fs/promises');
    await fs.writeFile(config.outputFile, output);
    console.log(`  ✓ Saved to: ${config.outputFile}`);
  } else {
    console.log('─'.repeat(70));
    console.log(output);
    console.log('─'.repeat(70));
  }

  console.log('\n' + '═'.repeat(70));
  console.log(' NARRATION COMPLETE');
  console.log('═'.repeat(70) + '\n');

  await store.close();
}

narrateChapter()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Narration failed:', err);
    process.exit(1);
  });
