/**
 * Spec-Driven Book Builder
 *
 * Builds a complete book from a JSON specification. Each chapter is
 * harvested using semantic anchor expansion, then assembled with
 * optional persona rewriting.
 *
 * Usage:
 *   npx tsx scripts/build-book-from-spec.ts --spec book-spec.json
 *   npx tsx scripts/build-book-from-spec.ts --spec book-spec.json --dry-run
 *
 * Spec Format:
 *   {
 *     "title": "Building Humanizer",
 *     "subtitle": "A Development Chronicle",
 *     "author": "Tem Noon",
 *     "chapters": [
 *       { "title": "Genesis", "seed": "carchive origins python flask architecture" },
 *       { "title": "The Quantum Turn", "seed": "POVM tetralemma rho semantic operators" }
 *     ],
 *     "arc": "chronological",
 *     "sourceTypes": ["markdown-memory", "markdown-document"],
 *     "passagesPerChapter": 15,
 *     "minSimilarity": 0.55,
 *     "persona": {
 *       "name": "Technical Memoirist",
 *       "voice": ["reflective", "precise", "warm"],
 *       "tone": ["collegial", "insightful"]
 *     }
 *   }
 */

import { PostgresContentStore } from '../src/storage/postgres-content-store.js';
import { EmbeddingService } from '../src/embeddings/embedding-service.js';
import type { Book, BookChapter, NarrativeArc } from '../src/aui/types/book-types.js';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface ChapterSpec {
  title: string;
  seed: string;
  passagesPerChapter?: number;
  minSimilarity?: number;
  minScore?: number;
}

interface PersonaSpec {
  name: string;
  voice: string[];
  tone: string[];
  formality?: number;
  useContractions?: boolean;
}

interface BookSpec {
  title: string;
  subtitle?: string;
  author?: string;
  chapters: ChapterSpec[];
  arc?: 'chronological' | 'thematic' | 'dramatic' | 'exploratory';
  sourceTypes?: string[];
  passagesPerChapter?: number;
  minSimilarity?: number;
  minScore?: number;
  persona?: PersonaSpec;
}

interface Config {
  specFile: string;
  outputDir: string;
  dryRun: boolean;
  verbose: boolean;
  ollamaUrl: string;
  expansionModel: string;
  rewriteModel: string;
  skipRewrite: boolean;
}

interface HarvestedPassage {
  id: string;
  text: string;
  similarity: number;
  sourceType: string;
  excellenceScore: number | null;
  createdAt: Date | null;
  wordCount: number;
}

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    specFile: '',
    outputDir: './humanizer-output',
    dryRun: false,
    verbose: false,
    ollamaUrl: 'http://localhost:11434',
    expansionModel: 'llama3.2:3b',
    rewriteModel: 'llama3.2:3b',
    skipRewrite: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--spec' && args[i + 1]) {
      config.specFile = args[i + 1];
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      config.outputDir = args[i + 1];
      i++;
    } else if (args[i] === '--dry-run') {
      config.dryRun = true;
    } else if (args[i] === '--verbose') {
      config.verbose = true;
    } else if (args[i] === '--expansion-model' && args[i + 1]) {
      config.expansionModel = args[i + 1];
      i++;
    } else if (args[i] === '--rewrite-model' && args[i + 1]) {
      config.rewriteModel = args[i + 1];
      i++;
    } else if (args[i] === '--skip-rewrite') {
      config.skipRewrite = true;
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

async function expandSeedToAnchor(
  seed: string,
  ollamaUrl: string,
  model: string,
  verbose: boolean
): Promise<string> {
  const prompt = `Expand this seed phrase into a rich semantic anchor passage:\n\n"${seed}"`;

  if (verbose) {
    console.log(`    Expanding: "${seed.slice(0, 50)}..."`);
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
        options: { temperature: 0.7, top_p: 0.9 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status}`);
    }

    const result = await response.json();
    const expanded = result.response?.trim();

    if (!expanded || expanded.length < 50) {
      return seed;
    }

    if (verbose) {
      console.log(`    ✓ Expanded to ${expanded.split(/\s+/).length} words`);
    }

    return expanded;
  } catch (error) {
    console.error(`    ✗ Expansion failed: ${error instanceof Error ? error.message : error}`);
    return seed;
  }
}

// ═══════════════════════════════════════════════════════════════════
// CHAPTER HARVESTING
// ═══════════════════════════════════════════════════════════════════

async function harvestChapter(
  chapterSpec: ChapterSpec,
  store: PostgresContentStore,
  embeddingService: EmbeddingService,
  config: Config,
  defaults: { sourceTypes: string[] | null; passagesPerChapter: number; minSimilarity: number; minScore: number }
): Promise<HarvestedPassage[]> {
  const pool = store.getPool();

  // Expand seed to anchor
  const anchor = await expandSeedToAnchor(
    chapterSpec.seed,
    config.ollamaUrl,
    config.expansionModel,
    config.verbose
  );

  // Generate embedding
  const embedding = await embeddingService.embed(anchor);

  // Build query
  const passagesPerChapter = chapterSpec.passagesPerChapter ?? defaults.passagesPerChapter;
  const minSimilarity = chapterSpec.minSimilarity ?? defaults.minSimilarity;
  const minScore = chapterSpec.minScore ?? defaults.minScore;

  let query = `
    SELECT
      id, text, source_type, source_created_at,
      source_metadata->>'excellenceScore' as excellence_score,
      1 - (embedding <=> $1::vector) as similarity
    FROM content_nodes
    WHERE embedding IS NOT NULL
      AND 1 - (embedding <=> $1::vector) >= $2
  `;
  const params: any[] = [`[${embedding.join(',')}]`, minSimilarity];

  if (defaults.sourceTypes) {
    params.push(defaults.sourceTypes);
    query += ` AND source_type = ANY($${params.length})`;
  }

  if (minScore > 0) {
    params.push(minScore);
    query += ` AND (source_metadata->>'excellenceScore')::int >= $${params.length}`;
  }

  query += ` ORDER BY embedding <=> $1::vector LIMIT $${params.length + 1}`;
  params.push(passagesPerChapter);

  const result = await pool.query(query, params);

  return result.rows.map(row => ({
    id: row.id,
    text: row.text,
    similarity: parseFloat(row.similarity),
    sourceType: row.source_type,
    excellenceScore: row.excellence_score ? parseInt(row.excellence_score, 10) : null,
    createdAt: row.source_created_at ? new Date(row.source_created_at) : null,
    wordCount: (row.text || '').split(/\s+/).filter(Boolean).length,
  }));
}

// ═══════════════════════════════════════════════════════════════════
// PERSONA REWRITING
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_FORBIDDEN_PHRASES = [
  "I can't help", "I cannot help", "As an AI", "As a language model",
  "delve", "dive into", "it's important to note", "it's worth noting",
  "in conclusion", "to summarize", "certainly", "absolutely",
  "moreover", "furthermore", "in essence", "fundamentally",
  "at its core", "rest assured", "Great question",
];

function buildPersonaSystemPrompt(persona: PersonaSpec): string {
  return `You are a skilled writer who transforms text to match a specific voice and persona.

TARGET PERSONA: ${persona.name}

VOICE TRAITS: ${persona.voice.join(', ')}
TONE: ${persona.tone.join(', ')}
FORMALITY: ${persona.formality ?? 0.5} (0=casual, 1=formal)

STYLE REQUIREMENTS:
- Use contractions: ${persona.useContractions !== false ? 'Yes' : 'No'}

FORBIDDEN PHRASES (NEVER use these - they sound artificial):
${DEFAULT_FORBIDDEN_PHRASES.slice(0, 15).map(p => `- "${p}"`).join('\n')}

YOUR TASK:
Rewrite the given text to match this persona's voice while preserving the core meaning.
Make it sound natural, human, and authentic.
DO NOT add new ideas - only transform the voice and style.
Output ONLY the rewritten text, nothing else.`;
}

async function rewriteForPersona(
  content: string,
  persona: PersonaSpec,
  ollamaUrl: string,
  model: string
): Promise<string> {
  const systemPrompt = buildPersonaSystemPrompt(persona);
  const userPrompt = `Rewrite this in the ${persona.name} voice:\n\n${content}`;

  try {
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: userPrompt,
        system: systemPrompt,
        stream: false,
        options: { temperature: 0.7, top_p: 0.9 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status}`);
    }

    const result = await response.json();
    const rewritten = result.response?.trim();

    if (!rewritten || rewritten.length < content.length * 0.3) {
      return content;
    }

    return rewritten;
  } catch (error) {
    console.error(`    ✗ Rewrite failed: ${error instanceof Error ? error.message : error}`);
    return content;
  }
}

// ═══════════════════════════════════════════════════════════════════
// BOOK ASSEMBLY
// ═══════════════════════════════════════════════════════════════════

function assembleChapterContent(
  passages: HarvestedPassage[],
  includeAttribution: boolean = true
): string {
  const parts: string[] = [];

  for (const passage of passages) {
    let text = passage.text.trim();

    if (includeAttribution) {
      const source = passage.sourceType || 'archive';
      const date = passage.createdAt?.toLocaleDateString() || '';
      const score = passage.excellenceScore ? `[${passage.excellenceScore}]` : '';
      const sim = `${(passage.similarity * 100).toFixed(0)}%`;
      const attribution = `— ${source}${date ? `, ${date}` : ''} ${score} (${sim} match)`;
      text = `${text}\n\n*${attribution}*`;
    }

    parts.push(text);
  }

  return parts.join('\n\n---\n\n');
}

function generateIntroduction(spec: BookSpec, chapters: BookChapter[]): string {
  const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);
  const totalPassages = chapters.reduce((sum, ch) => sum + ch.passageIds.length, 0);

  return `This book brings together ${totalPassages} passages spanning ${totalWords.toLocaleString()} words ` +
    `of development history, technical insight, and architectural evolution. ` +
    `Organized across ${chapters.length} chapters, it traces the journey from initial conception ` +
    `through implementation, capturing both the technical decisions and the reasoning behind them.\n\n` +
    `Each chapter was assembled through semantic harvesting—expanding seed concepts into rich anchor passages ` +
    `that capture the essence of each theme, then finding the most relevant content through embedding similarity.`;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════

function bookToMarkdown(book: Book, spec: BookSpec): string {
  const lines: string[] = [];

  lines.push(`# ${book.title}`);
  if (spec.subtitle) {
    lines.push(`## ${spec.subtitle}`);
  }
  if (spec.author) {
    lines.push(`\n*By ${spec.author}*`);
  }
  lines.push('');

  if (book.arc?.introduction) {
    lines.push('## Introduction');
    lines.push('');
    lines.push(book.arc.introduction);
    lines.push('');
  }

  // Table of contents
  lines.push('## Contents');
  lines.push('');
  for (const chapter of book.chapters) {
    lines.push(`- [${chapter.title}](#${chapter.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')})`);
  }
  lines.push('');

  // Chapters
  for (const chapter of book.chapters) {
    lines.push(`## ${chapter.title}`);
    lines.push('');
    lines.push(chapter.content);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(`*Generated by humanizer.com*`);
  lines.push(`*Created: ${book.createdAt.toISOString()}*`);
  if (book.metadata?.totalWordCount) {
    lines.push(`*${book.metadata.totalWordCount.toLocaleString()} words across ${book.chapters.length} chapters*`);
  }

  return lines.join('\n');
}

function bookToHtml(book: Book, spec: BookSpec): string {
  const escapeHtml = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  const lines: string[] = [];

  lines.push('<!DOCTYPE html>');
  lines.push('<html lang="en">');
  lines.push('<head>');
  lines.push('  <meta charset="UTF-8">');
  lines.push('  <meta name="viewport" content="width=device-width, initial-scale=1.0">');
  lines.push(`  <title>${escapeHtml(book.title)}</title>`);
  lines.push('  <style>');
  lines.push('    body { font-family: Georgia, serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.8; color: #333; }');
  lines.push('    h1 { border-bottom: 3px solid #2c3e50; padding-bottom: 0.5rem; color: #2c3e50; }');
  lines.push('    h2 { color: #34495e; margin-top: 2.5rem; border-bottom: 1px solid #bdc3c7; padding-bottom: 0.3rem; }');
  lines.push('    .subtitle { font-size: 1.3rem; color: #7f8c8d; margin-top: -0.5rem; }');
  lines.push('    .author { font-style: italic; color: #95a5a6; margin-bottom: 2rem; }');
  lines.push('    .intro { font-style: italic; color: #7f8c8d; margin-bottom: 2rem; padding: 1rem; background: #f8f9fa; border-radius: 4px; }');
  lines.push('    .toc { background: #f8f9fa; padding: 1rem 2rem; border-radius: 4px; margin-bottom: 2rem; }');
  lines.push('    .toc ul { list-style: none; padding-left: 0; }');
  lines.push('    .toc li { margin: 0.5rem 0; }');
  lines.push('    .toc a { color: #3498db; text-decoration: none; }');
  lines.push('    .chapter { margin-bottom: 3rem; }');
  lines.push('    .chapter p { margin-bottom: 1.2rem; text-align: justify; }');
  lines.push('    .passage-separator { text-align: center; margin: 2rem 0; color: #bdc3c7; }');
  lines.push('    .attribution { font-size: 0.85rem; color: #95a5a6; font-style: italic; }');
  lines.push('    .footer { margin-top: 4rem; padding-top: 1rem; border-top: 2px solid #ecf0f1; font-size: 0.9rem; color: #95a5a6; }');
  lines.push('    pre { background: #f4f4f4; padding: 1rem; overflow-x: auto; border-radius: 4px; }');
  lines.push('    code { font-family: "SF Mono", Monaco, monospace; font-size: 0.9em; }');
  lines.push('  </style>');
  lines.push('</head>');
  lines.push('<body>');

  lines.push(`  <h1>${escapeHtml(book.title)}</h1>`);
  if (spec.subtitle) {
    lines.push(`  <p class="subtitle">${escapeHtml(spec.subtitle)}</p>`);
  }
  if (spec.author) {
    lines.push(`  <p class="author">By ${escapeHtml(spec.author)}</p>`);
  }

  if (book.arc?.introduction) {
    lines.push('  <div class="intro">');
    lines.push(`    <p>${escapeHtml(book.arc.introduction)}</p>`);
    lines.push('  </div>');
  }

  // TOC
  lines.push('  <nav class="toc">');
  lines.push('    <h3>Contents</h3>');
  lines.push('    <ul>');
  for (const chapter of book.chapters) {
    const anchor = chapter.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    lines.push(`      <li><a href="#${anchor}">${escapeHtml(chapter.title)}</a></li>`);
  }
  lines.push('    </ul>');
  lines.push('  </nav>');

  // Chapters
  for (const chapter of book.chapters) {
    const anchor = chapter.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    lines.push(`  <section class="chapter" id="${anchor}">`);
    lines.push(`    <h2>${escapeHtml(chapter.title)}</h2>`);

    const passages = chapter.content.split(/\n\n---\n\n/);
    for (let i = 0; i < passages.length; i++) {
      const passage = passages[i];
      const paragraphs = passage.split('\n\n').filter(Boolean);

      for (const para of paragraphs) {
        if (para.startsWith('*—') || para.startsWith('*—')) {
          lines.push(`    <p class="attribution">${escapeHtml(para.replace(/^\*|\*$/g, ''))}</p>`);
        } else if (para.startsWith('```')) {
          lines.push(`    <pre><code>${escapeHtml(para.replace(/```\w*\n?/g, ''))}</code></pre>`);
        } else {
          lines.push(`    <p>${escapeHtml(para)}</p>`);
        }
      }

      if (i < passages.length - 1) {
        lines.push('    <div class="passage-separator">◆ ◆ ◆</div>');
      }
    }

    lines.push('  </section>');
  }

  // Footer
  lines.push('  <div class="footer">');
  lines.push('    <p>Generated by humanizer.com</p>');
  lines.push(`    <p>Created: ${book.createdAt.toISOString()}</p>`);
  if (book.metadata?.totalWordCount) {
    lines.push(`    <p>${book.metadata.totalWordCount.toLocaleString()} words across ${book.chapters.length} chapters</p>`);
  }
  lines.push('  </div>');

  lines.push('</body>');
  lines.push('</html>');

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════

async function buildBookFromSpec() {
  const config = parseArgs();
  const startTime = Date.now();

  if (!config.specFile) {
    console.error('Error: --spec is required');
    console.log('Usage: npx tsx scripts/build-book-from-spec.ts --spec book-spec.json');
    process.exit(1);
  }

  // Load spec
  const fs = await import('fs/promises');
  const path = await import('path');

  let spec: BookSpec;
  try {
    const specContent = await fs.readFile(config.specFile, 'utf-8');
    spec = JSON.parse(specContent);
  } catch (error) {
    console.error(`Error loading spec file: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }

  console.log('═'.repeat(70));
  console.log(' SPEC-DRIVEN BOOK BUILDER');
  console.log('═'.repeat(70));
  console.log(`\n  Title: "${spec.title}"`);
  if (spec.subtitle) console.log(`  Subtitle: "${spec.subtitle}"`);
  if (spec.author) console.log(`  Author: ${spec.author}`);
  console.log(`  Chapters: ${spec.chapters.length}`);
  console.log(`  Arc: ${spec.arc || 'thematic'}`);
  if (spec.sourceTypes) console.log(`  Source types: ${spec.sourceTypes.join(', ')}`);
  if (spec.persona) console.log(`  Persona: ${spec.persona.name}`);
  console.log(`  Dry run: ${config.dryRun}`);

  if (config.dryRun) {
    console.log('\n  [DRY RUN - No content will be generated]\n');
    for (const ch of spec.chapters) {
      console.log(`    Chapter: "${ch.title}"`);
      console.log(`      Seed: "${ch.seed}"`);
    }
    return;
  }

  // Initialize services
  const store = new PostgresContentStore({
    enableVec: true,
    enableFTS: true,
  });
  await store.initialize();

  const embeddingService = new EmbeddingService({
    ollamaUrl: config.ollamaUrl,
    embedModel: 'nomic-embed-text',
  });

  // Defaults from spec
  const defaults = {
    sourceTypes: spec.sourceTypes || null,
    passagesPerChapter: spec.passagesPerChapter || 15,
    minSimilarity: spec.minSimilarity || 0.55,
    minScore: spec.minScore || 0,
  };

  // ─────────────────────────────────────────────────────────────────
  // HARVEST CHAPTERS
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ HARVESTING CHAPTERS                                                    │');
  console.log('└' + '─'.repeat(68) + '┘\n');

  const chapters: BookChapter[] = [];
  let totalPassages = 0;

  for (let i = 0; i < spec.chapters.length; i++) {
    const chapterSpec = spec.chapters[i];
    console.log(`  [${i + 1}/${spec.chapters.length}] ${chapterSpec.title}`);

    const passages = await harvestChapter(
      chapterSpec,
      store,
      embeddingService,
      config,
      defaults
    );

    if (passages.length === 0) {
      console.log(`    ⚠ No passages found for "${chapterSpec.title}"`);
      continue;
    }

    const avgSim = passages.reduce((sum, p) => sum + p.similarity, 0) / passages.length;
    const totalWords = passages.reduce((sum, p) => sum + p.wordCount, 0);

    console.log(`    ✓ ${passages.length} passages, ${totalWords.toLocaleString()} words, ${(avgSim * 100).toFixed(1)}% avg similarity`);

    let content = assembleChapterContent(passages, true);

    // Persona rewriting
    if (spec.persona && !config.skipRewrite) {
      console.log(`    Rewriting for ${spec.persona.name} persona...`);
      content = await rewriteForPersona(
        content,
        spec.persona,
        config.ollamaUrl,
        config.rewriteModel
      );
      console.log(`    ✓ Rewritten`);
    }

    chapters.push({
      id: `chapter-${i + 1}`,
      title: chapterSpec.title,
      content,
      passageIds: passages.map(p => p.id),
      position: i,
      wordCount: content.split(/\s+/).filter(Boolean).length,
    });

    totalPassages += passages.length;
  }

  // ─────────────────────────────────────────────────────────────────
  // ASSEMBLE BOOK
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ ASSEMBLING BOOK                                                        │');
  console.log('└' + '─'.repeat(68) + '┘\n');

  const totalWordCount = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);

  const arc: NarrativeArc = {
    title: spec.title,
    arcType: spec.arc || 'thematic',
    introduction: generateIntroduction(spec, chapters),
    chapters: chapters.map((ch, i) => ({
      title: ch.title,
      summary: ch.content.slice(0, 200),
      passageIds: ch.passageIds,
      theme: spec.chapters[i].seed.split(/\s+/).slice(0, 3).join(' '),
      position: i,
    })),
    themes: spec.chapters.map(ch => ch.seed.split(/\s+/)[0]),
    transitions: [],
  };

  const book: Book = {
    id: `book-${Date.now()}`,
    title: spec.title,
    description: spec.subtitle || `A book with ${chapters.length} chapters`,
    arc,
    chapters,
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'draft',
    metadata: {
      passageCount: totalPassages,
      totalWordCount,
      arcType: spec.arc || 'thematic',
      sourceTypes: spec.sourceTypes,
      personaName: spec.persona?.name,
    },
  };

  console.log(`  Title: "${book.title}"`);
  console.log(`  Chapters: ${chapters.length}`);
  console.log(`  Passages: ${totalPassages}`);
  console.log(`  Word count: ${totalWordCount.toLocaleString()}`);

  // ─────────────────────────────────────────────────────────────────
  // EXPORT
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ EXPORTING                                                              │');
  console.log('└' + '─'.repeat(68) + '┘\n');

  await fs.mkdir(config.outputDir, { recursive: true });

  const baseName = spec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-');

  const mdPath = path.join(config.outputDir, `${baseName}.md`);
  await fs.writeFile(mdPath, bookToMarkdown(book, spec));
  console.log(`  ✓ Markdown: ${mdPath}`);

  const htmlPath = path.join(config.outputDir, `${baseName}.html`);
  await fs.writeFile(htmlPath, bookToHtml(book, spec));
  console.log(`  ✓ HTML: ${htmlPath}`);

  const jsonPath = path.join(config.outputDir, `${baseName}.json`);
  await fs.writeFile(jsonPath, JSON.stringify(book, null, 2));
  console.log(`  ✓ JSON: ${jsonPath}`);

  // Save spec alongside for reference
  const specOutPath = path.join(config.outputDir, `${baseName}.spec.json`);
  await fs.writeFile(specOutPath, JSON.stringify(spec, null, 2));
  console.log(`  ✓ Spec: ${specOutPath}`);

  // ─────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '═'.repeat(70));
  console.log(' BOOK GENERATION COMPLETE');
  console.log('═'.repeat(70));
  console.log(`\n  Title: "${book.title}"`);
  console.log(`  Chapters: ${chapters.length}`);
  console.log(`  Word count: ${totalWordCount.toLocaleString()}`);
  console.log(`  Duration: ${duration}s`);
  console.log(`\n  Output: ${config.outputDir}/`);
  console.log('═'.repeat(70) + '\n');

  await store.close();
}

buildBookFromSpec()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Book generation failed:', err);
    process.exit(1);
  });
