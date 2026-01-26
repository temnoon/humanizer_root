/**
 * Build Excellence Book
 *
 * Creates a book from the highest-scoring content in the archive.
 * Uses the AUI book system with excellence-filtered content.
 *
 * Usage:
 *   npx tsx scripts/build-excellence-book.ts [--tier excellence|polished|raw_gem] [--theme "topic"]
 *
 * With persona rewriting:
 *   npx tsx scripts/build-excellence-book.ts --persona "Author Name" --voice "warm,reflective,witty"
 */

import { randomUUID } from 'crypto';
import { PostgresContentStore } from '../src/storage/postgres-content-store.js';
import { EmbeddingService } from '../src/embeddings/embedding-service.js';
import type {
  Book,
  BookChapter,
  NarrativeArc,
  HarvestedPassage,
} from '../src/aui/types/book-types.js';
import type { ExcellenceTier } from '../src/pipelines/types.js';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

interface PersonaConfig {
  name: string;
  voiceTraits: string[];
  toneMarkers: string[];
  formalityLevel: number; // 0=casual, 1=formal
  forbiddenPhrases: string[];
  preferredPatterns: string[];
  useContractions: boolean;
}

interface Config {
  minTier: ExcellenceTier;
  maxPassages: number;
  arcType: 'chronological' | 'thematic' | 'dramatic' | 'exploratory';
  theme?: string;
  minScore: number;
  verbose: boolean;
  outputDir: string;
  // Persona options
  persona?: PersonaConfig;
  ollamaUrl: string;
  rewriteModel: string;
}

// Default AI-tell phrases to filter out during persona rewriting
const DEFAULT_FORBIDDEN_PHRASES = [
  "I can't help",
  "I cannot help",
  "As an AI",
  "As a language model",
  "I don't have personal",
  "I'm not able to",
  "delve",
  "dive into",
  "it's important to note",
  "it's worth noting",
  "in conclusion",
  "to summarize",
  "certainly",
  "absolutely",
  "moreover",
  "furthermore",
  "in essence",
  "fundamentally",
  "at its core",
  "rest assured",
  "I understand",
  "Great question",
  "That's a great question",
];

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    minTier: 'excellence',
    maxPassages: 50,
    arcType: 'thematic',
    theme: undefined,
    minScore: 75,
    verbose: false,
    outputDir: './humanizer-output',
    ollamaUrl: 'http://localhost:11434',
    rewriteModel: 'llama3.2:3b',
  };

  // Persona building args
  let personaName: string | undefined;
  let voiceTraits: string[] = [];
  let toneMarkers: string[] = [];
  let formalityLevel = 0.5;
  let forbiddenPhrases: string[] = [];
  let preferredPatterns: string[] = [];
  let useContractions = true;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tier' && args[i + 1]) {
      config.minTier = args[i + 1] as ExcellenceTier;
      i++;
    } else if (args[i] === '--theme' && args[i + 1]) {
      config.theme = args[i + 1];
      i++;
    } else if (args[i] === '--max' && args[i + 1]) {
      config.maxPassages = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--arc' && args[i + 1]) {
      config.arcType = args[i + 1] as Config['arcType'];
      i++;
    } else if (args[i] === '--min-score' && args[i + 1]) {
      config.minScore = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--verbose') {
      config.verbose = true;
    } else if (args[i] === '--output' && args[i + 1]) {
      config.outputDir = args[i + 1];
      i++;
    } else if (args[i] === '--persona' && args[i + 1]) {
      personaName = args[i + 1];
      i++;
    } else if (args[i] === '--voice' && args[i + 1]) {
      voiceTraits = args[i + 1].split(',').map(s => s.trim());
      i++;
    } else if (args[i] === '--tone' && args[i + 1]) {
      toneMarkers = args[i + 1].split(',').map(s => s.trim());
      i++;
    } else if (args[i] === '--formality' && args[i + 1]) {
      formalityLevel = parseFloat(args[i + 1]);
      i++;
    } else if (args[i] === '--forbidden' && args[i + 1]) {
      forbiddenPhrases = args[i + 1].split(',').map(s => s.trim());
      i++;
    } else if (args[i] === '--preferred' && args[i + 1]) {
      preferredPatterns = args[i + 1].split(',').map(s => s.trim());
      i++;
    } else if (args[i] === '--no-contractions') {
      useContractions = false;
    } else if (args[i] === '--ollama-url' && args[i + 1]) {
      config.ollamaUrl = args[i + 1];
      i++;
    } else if (args[i] === '--model' && args[i + 1]) {
      config.rewriteModel = args[i + 1];
      i++;
    }
  }

  // Adjust minScore based on tier
  if (config.minTier === 'excellence' && config.minScore < 75) {
    config.minScore = 75;
  } else if (config.minTier === 'polished' && config.minScore < 55) {
    config.minScore = 55;
  } else if (config.minTier === 'raw_gem') {
    config.minScore = 0; // Raw gems are identified by tier, not score
  }

  // Build persona config if name provided
  if (personaName) {
    config.persona = {
      name: personaName,
      voiceTraits: voiceTraits.length > 0 ? voiceTraits : ['authentic', 'thoughtful'],
      toneMarkers: toneMarkers.length > 0 ? toneMarkers : ['warm', 'reflective'],
      formalityLevel,
      forbiddenPhrases: [...DEFAULT_FORBIDDEN_PHRASES, ...forbiddenPhrases],
      preferredPatterns,
      useContractions,
    };
  }

  return config;
}

// ═══════════════════════════════════════════════════════════════════
// STOPWORDS FOR THEME/TITLE EXTRACTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Comprehensive stopwords to filter out metadata noise, technical terms,
 * month names, and other non-meaningful words from theme extraction.
 */
const THEME_STOPWORDS = new Set([
  // Common English stopwords
  'about', 'which', 'would', 'could', 'should', 'their', 'there', 'these', 'those',
  'through', 'being', 'between', 'during', 'without', 'however', 'because', 'before',
  'after', 'while', 'where', 'really', 'actually', 'something', 'nothing', 'anything',
  'everything', 'someone', 'everyone', 'maybe', 'perhaps', 'though', 'although',
  'since', 'until', 'unless', 'whether', 'already', 'always', 'never', 'often',
  'usually', 'sometimes', 'probably', 'certainly', 'definitely', 'exactly',

  // Metadata field names (common source of noise)
  'recommendshareflag', 'commented', 'metadata', 'content', 'message', 'messages',
  'conversation', 'conversations', 'author', 'assistant', 'system', 'function',
  'timestamp', 'created', 'updated', 'source', 'target', 'parent', 'children',
  'status', 'version', 'mapping', 'mappings', 'value', 'values', 'object', 'objects',
  'string', 'number', 'boolean', 'default', 'current', 'previous', 'following',

  // Technical/code terms
  'undefined', 'function', 'return', 'export', 'import', 'const', 'variable',
  'parameter', 'argument', 'callback', 'promise', 'async', 'await', 'response',
  'request', 'context', 'component', 'instance', 'prototype', 'constructor',

  // Month names (often appear in dates)
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',

  // Day names
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',

  // Common words that don't carry meaning
  'different', 'another', 'various', 'several', 'multiple', 'specific', 'particular',
  'general', 'overall', 'important', 'interesting', 'relevant', 'related',
  'example', 'examples', 'include', 'includes', 'including', 'especially',
  'basically', 'essentially', 'primarily', 'mainly', 'simply', 'clearly',

  // ChatGPT/AI conversation artifacts
  'chatgpt', 'openai', 'anthropic', 'claude', 'assistant', 'model', 'models',
  'gpt', 'language', 'generate', 'generated', 'generation', 'output', 'outputs',
  'prompt', 'prompts', 'response', 'responses', 'question', 'questions',
  'answer', 'answers', 'provide', 'provides', 'providing', 'continue', 'continues',
]);

/**
 * Filter words against stopwords and additional criteria
 */
function filterThemeWords(words: string[]): string[] {
  return words.filter(word => {
    const lower = word.toLowerCase();
    // Filter stopwords
    if (THEME_STOPWORDS.has(lower)) return false;
    // Filter purely numeric
    if (/^\d+$/.test(word)) return false;
    // Filter words with unusual characters (likely metadata)
    if (/[_\-]/.test(word)) return false;
    // Filter very long words (likely technical/metadata)
    if (word.length > 20) return false;
    // Filter words that look like IDs (mix of letters and numbers)
    if (/^[a-z]+\d+$/i.test(word) || /^\d+[a-z]+$/i.test(word)) return false;
    return true;
  });
}

// ═══════════════════════════════════════════════════════════════════
// PERSONA REWRITING
// ═══════════════════════════════════════════════════════════════════

/**
 * Build system prompt for persona rewriting
 */
function buildPersonaSystemPrompt(persona: PersonaConfig): string {
  const parts: string[] = [
    `You are a skilled writer who transforms text to match a specific voice and persona.`,
    ``,
    `TARGET PERSONA: ${persona.name}`,
    ``,
    `VOICE TRAITS: ${persona.voiceTraits.join(', ')}`,
    `TONE: ${persona.toneMarkers.join(', ')}`,
    `FORMALITY: ${persona.formalityLevel} (0=casual, 1=formal)`,
    ``,
    `STYLE REQUIREMENTS:`,
    `- Use contractions: ${persona.useContractions ? 'Yes' : 'No'}`,
    ``,
  ];

  if (persona.forbiddenPhrases.length > 0) {
    parts.push(`FORBIDDEN PHRASES (NEVER use these - they sound artificial):`);
    for (const phrase of persona.forbiddenPhrases.slice(0, 20)) {
      parts.push(`- "${phrase}"`);
    }
    parts.push(``);
  }

  if (persona.preferredPatterns.length > 0) {
    parts.push(`PREFERRED PATTERNS (use naturally when appropriate):`);
    for (const pattern of persona.preferredPatterns) {
      parts.push(`- "${pattern}"`);
    }
    parts.push(``);
  }

  parts.push(`YOUR TASK:`);
  parts.push(`Rewrite the given text to match this persona's voice while preserving the core meaning.`);
  parts.push(`Make it sound natural, human, and authentic.`);
  parts.push(`DO NOT add new ideas - only transform the voice and style.`);
  parts.push(`Output ONLY the rewritten text, nothing else.`);

  return parts.join('\n');
}

/**
 * Rewrite a chapter for persona consistency using Ollama
 */
async function rewriteChapterForPersona(
  chapterContent: string,
  persona: PersonaConfig,
  ollamaUrl: string,
  model: string,
  verbose: boolean
): Promise<string> {
  const systemPrompt = buildPersonaSystemPrompt(persona);

  const userPrompt = `Rewrite this chapter in the ${persona.name} voice:\n\n${chapterContent}`;

  try {
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: userPrompt,
        system: systemPrompt,
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
    const rewritten = result.response?.trim();

    if (!rewritten || rewritten.length < chapterContent.length * 0.3) {
      if (verbose) {
        console.log('    ⚠ Rewrite too short, keeping original');
      }
      return chapterContent;
    }

    // Check for remaining forbidden phrases
    const remaining = persona.forbiddenPhrases.filter(
      phrase => rewritten.toLowerCase().includes(phrase.toLowerCase())
    );

    if (verbose && remaining.length > 0) {
      console.log(`    ⚠ ${remaining.length} forbidden phrases still present`);
    }

    return rewritten;
  } catch (error) {
    console.error('    ✗ Rewrite failed:', error instanceof Error ? error.message : error);
    return chapterContent;
  }
}

// ═══════════════════════════════════════════════════════════════════
// BOOK GENERATION
// ═══════════════════════════════════════════════════════════════════

function generateArc(passages: HarvestedPassage[], arcType: string): NarrativeArc {
  let organizedPassages = [...passages];

  switch (arcType) {
    case 'chronological':
      organizedPassages.sort((a, b) => {
        const dateA = a.sourceCreatedAt?.getTime() || 0;
        const dateB = b.sourceCreatedAt?.getTime() || 0;
        return dateA - dateB;
      });
      break;
    case 'thematic':
      // Group by source type first, then by relevance
      organizedPassages.sort((a, b) => {
        if (a.sourceType !== b.sourceType) {
          return a.sourceType.localeCompare(b.sourceType);
        }
        return b.relevance - a.relevance;
      });
      break;
    case 'dramatic':
      // Build tension - start low, end high
      organizedPassages.sort((a, b) => a.relevance - b.relevance);
      break;
    case 'exploratory':
      // Random exploration
      organizedPassages = organizedPassages.sort(() => Math.random() - 0.5);
      break;
  }

  // Create chapters
  const chapterCount = Math.min(5, Math.max(3, Math.ceil(passages.length / 10)));
  const passagesPerChapter = Math.ceil(passages.length / chapterCount);

  const chapters: NarrativeArc['chapters'] = [];
  for (let i = 0; i < chapterCount; i++) {
    const chapterPassages = organizedPassages.slice(
      i * passagesPerChapter,
      (i + 1) * passagesPerChapter
    );

    if (chapterPassages.length === 0) continue;

    // Generate chapter title from content
    const firstWords = chapterPassages[0].text.split(/\s+/).slice(0, 6).join(' ');
    const chapterTitle = generateChapterTitle(chapterPassages, i + 1);

    chapters.push({
      title: chapterTitle,
      summary: chapterPassages
        .slice(0, 2)
        .map(p => p.text.substring(0, 100))
        .join(' | '),
      passageIds: chapterPassages.map(p => p.id),
      theme: extractTheme(chapterPassages),
      position: i,
    });
  }

  // Extract overall themes (with comprehensive stopword filtering)
  const allText = passages.map(p => p.text).join(' ');
  const rawWords = allText.toLowerCase().split(/\s+/).filter(w => w.length > 5);
  const filteredWords = filterThemeWords(rawWords);
  const wordFreq = new Map<string, number>();
  for (const word of filteredWords) {
    wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
  }
  const themes = [...wordFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  // Generate title
  const title = themes.length > 0
    ? `Reflections on ${themes.slice(0, 2).map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' and ')}`
    : 'Collected Excellence';

  // Generate introduction
  const introduction = generateIntroduction(passages, themes, arcType, chapters.length);

  // Generate transitions
  const transitions = chapters.slice(0, -1).map((ch, i) =>
    `From ${ch.theme} we move to ${chapters[i + 1].theme}...`
  );

  return {
    title,
    arcType,
    introduction,
    chapters,
    themes,
    transitions,
  };
}

function generateChapterTitle(passages: HarvestedPassage[], chapterNum: number): string {
  // Extract key concepts from chapter passages (with stopword filtering)
  const allText = passages.map(p => p.text).join(' ');
  const rawWords = allText.toLowerCase().split(/\s+/).filter(w => w.length > 6);
  const filteredWords = filterThemeWords(rawWords);
  const wordFreq = new Map<string, number>();

  for (const word of filteredWords) {
    wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
  }

  const topWords = [...wordFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));

  if (topWords.length >= 2) {
    return `Chapter ${chapterNum}: ${topWords[0]} and ${topWords[1]}`;
  }
  return `Chapter ${chapterNum}: ${topWords[0] || 'Reflections'}`;
}

function extractTheme(passages: HarvestedPassage[]): string {
  const allText = passages.map(p => p.text).join(' ');
  const rawWords = allText.toLowerCase().split(/\s+/).filter(w => w.length > 5);
  const filteredWords = filterThemeWords(rawWords);
  const wordFreq = new Map<string, number>();

  for (const word of filteredWords) {
    wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
  }

  const topWord = [...wordFreq.entries()]
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'exploration';

  return topWord.charAt(0).toUpperCase() + topWord.slice(1);
}

function generateIntroduction(
  passages: HarvestedPassage[],
  themes: string[],
  arcType: string,
  chapterCount: number
): string {
  const totalWords = passages.reduce((sum, p) => sum + p.wordCount, 0);
  const userPassages = passages.filter(p => p.authorRole === 'user').length;
  const assistantPassages = passages.length - userPassages;

  const themeList = themes.slice(0, 3).join(', ');

  const arcDescription = arcType === 'chronological'
    ? 'organized chronologically to show the evolution of thought'
    : arcType === 'thematic'
      ? 'arranged thematically to highlight recurring patterns'
      : arcType === 'dramatic'
        ? 'structured dramatically, building toward deeper insights'
        : 'presented as an open exploration of connected ideas';

  return `This collection brings together ${passages.length} passages of exceptional quality, ` +
    `spanning ${totalWords.toLocaleString()} words of personal reflection and dialogue. ` +
    `The material explores themes of ${themeList}, ${arcDescription}.\n\n` +
    `Across ${chapterCount} chapters, we encounter both original thoughts (${userPassages} passages) ` +
    `and enriched dialogues (${assistantPassages} passages), each selected for its insight, ` +
    `clarity, and authentic voice. What emerges is not merely a collection, but a ` +
    `portrait of thinking at its most engaged.`;
}

function assembleChapter(
  arc: NarrativeArc['chapters'][0],
  passages: HarvestedPassage[],
  includeAttribution: boolean
): BookChapter {
  const chapterPassages = passages.filter(p => arc.passageIds.includes(p.id));

  const contentParts: string[] = [];

  for (const passage of chapterPassages) {
    let text = passage.text.trim();

    if (includeAttribution) {
      const source = passage.sourceType || 'archive';
      const role = passage.authorRole || 'author';
      const date = passage.sourceCreatedAt
        ? passage.sourceCreatedAt.toLocaleDateString()
        : '';
      const attribution = date ? `— ${role}, ${source}, ${date}` : `— ${role}, ${source}`;
      text = `${text}\n\n*${attribution}*`;
    }

    contentParts.push(text);
  }

  const content = contentParts.join('\n\n---\n\n');

  return {
    id: `chapter-${arc.position + 1}`,
    title: arc.title,
    content,
    passageIds: arc.passageIds,
    position: arc.position,
    wordCount: content.split(/\s+/).filter(Boolean).length,
  };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════════

async function buildExcellenceBook() {
  const config = parseArgs();
  const startTime = Date.now();

  console.log('═'.repeat(70));
  console.log(' EXCELLENCE BOOK BUILDER');
  console.log('═'.repeat(70));
  console.log(`\n  Minimum tier: ${config.minTier}`);
  console.log(`  Minimum score: ${config.minScore}`);
  console.log(`  Max passages: ${config.maxPassages}`);
  console.log(`  Arc type: ${config.arcType}`);
  if (config.theme) {
    console.log(`  Theme filter: "${config.theme}"`);
  }

  // Initialize store
  const store = new PostgresContentStore({
    enableVec: true,
    enableFTS: true,
  });
  await store.initialize();
  const pool = store.getPool();

  // ─────────────────────────────────────────────────────────────────
  // STEP 1: Query excellent content
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ STEP 1: GATHERING EXCELLENT CONTENT                                    │');
  console.log('└' + '─'.repeat(68) + '┘\n');

  let query = `
    SELECT
      id, text, author_role, source_type, source_created_at,
      source_metadata->>'excellenceScore' as score,
      source_metadata->>'excellenceTier' as tier
    FROM content_nodes
    WHERE source_metadata->>'excellenceTier' = $1
  `;
  const params: any[] = [config.minTier];

  if (config.minScore > 0) {
    query += ` AND (source_metadata->>'excellenceScore')::int >= $2`;
    params.push(config.minScore);
  }

  // Add theme filter using ILIKE for each word
  if (config.theme) {
    const themeWords = config.theme.split(/\s+/).filter(w => w.length > 2);
    for (const word of themeWords) {
      query += ` AND text ILIKE $${params.length + 1}`;
      params.push(`%${word}%`);
    }
  }

  query += ` ORDER BY (source_metadata->>'excellenceScore')::int DESC LIMIT $${params.length + 1}`;
  params.push(config.maxPassages);

  const result = await pool.query(query, params);

  console.log(`  Found ${result.rows.length} passages in tier "${config.minTier}"`);

  if (result.rows.length === 0) {
    console.log('\n  ⚠ No content found matching criteria. Try a different tier or lower score threshold.');
    await store.close();
    return;
  }

  // Convert to HarvestedPassage format
  const passages: HarvestedPassage[] = result.rows.map(row => ({
    id: row.id,
    text: row.text,
    relevance: parseInt(row.score, 10) / 100,
    sourceType: row.source_type,
    authorRole: row.author_role,
    title: undefined,
    sourceCreatedAt: row.source_created_at ? new Date(row.source_created_at) : undefined,
    wordCount: (row.text || '').split(/\s+/).filter(Boolean).length,
  }));

  // Show preview
  console.log('\n  Top passages by score:');
  for (const p of passages.slice(0, 5)) {
    const preview = p.text.slice(0, 80).replace(/\n/g, ' ');
    console.log(`    [${Math.round(p.relevance * 100)}] ${preview}...`);
  }

  // ─────────────────────────────────────────────────────────────────
  // STEP 2: Generate narrative arc
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ STEP 2: GENERATING NARRATIVE ARC                                       │');
  console.log('└' + '─'.repeat(68) + '┘\n');

  const arc = generateArc(passages, config.arcType);

  console.log(`  Title: "${arc.title}"`);
  console.log(`  Arc type: ${arc.arcType}`);
  console.log(`  Themes: ${arc.themes.join(', ')}`);
  console.log(`  Chapters: ${arc.chapters.length}`);

  for (const chapter of arc.chapters) {
    console.log(`    ${chapter.title} (${chapter.passageIds.length} passages)`);
  }

  // ─────────────────────────────────────────────────────────────────
  // STEP 3: Assemble book
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ STEP 3: ASSEMBLING BOOK                                                │');
  console.log('└' + '─'.repeat(68) + '┘\n');

  let chapters: BookChapter[] = arc.chapters.map(ch =>
    assembleChapter(ch, passages, true)
  );

  let totalWordCount = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);

  console.log(`  Chapters assembled: ${chapters.length}`);
  console.log(`  Total word count: ${totalWordCount.toLocaleString()}`);

  // ─────────────────────────────────────────────────────────────────
  // STEP 3.5: Persona Rewriting (optional)
  // ─────────────────────────────────────────────────────────────────
  if (config.persona) {
    console.log('\n┌' + '─'.repeat(68) + '┐');
    console.log('│ STEP 3.5: PERSONA REWRITING                                            │');
    console.log('└' + '─'.repeat(68) + '┘\n');

    console.log(`  Persona: ${config.persona.name}`);
    console.log(`  Voice: ${config.persona.voiceTraits.join(', ')}`);
    console.log(`  Tone: ${config.persona.toneMarkers.join(', ')}`);
    console.log(`  Model: ${config.rewriteModel}`);
    console.log(`  Rewriting ${chapters.length} chapters...\n`);

    const rewrittenChapters: BookChapter[] = [];

    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      console.log(`  [${i + 1}/${chapters.length}] ${chapter.title}...`);

      const rewrittenContent = await rewriteChapterForPersona(
        chapter.content,
        config.persona,
        config.ollamaUrl,
        config.rewriteModel,
        config.verbose
      );

      const rewrittenWordCount = rewrittenContent.split(/\s+/).filter(Boolean).length;

      rewrittenChapters.push({
        ...chapter,
        content: rewrittenContent,
        wordCount: rewrittenWordCount,
      });

      console.log(`    ✓ ${chapter.wordCount} → ${rewrittenWordCount} words`);
    }

    chapters = rewrittenChapters;
    totalWordCount = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);

    console.log(`\n  ✓ Rewriting complete: ${totalWordCount.toLocaleString()} words total`);
  }

  const book: Book = {
    id: `book-excellence-${Date.now()}`,
    title: arc.title,
    description: `A collection of ${config.minTier}-tier content, curated for exceptional quality.`,
    arc,
    chapters,
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'draft',
    metadata: {
      passageCount: passages.length,
      totalWordCount,
      arcType: config.arcType,
      minTier: config.minTier,
      minScore: config.minScore,
      theme: config.theme,
      // Persona rewriting info
      personaName: config.persona?.name,
      personaVoice: config.persona?.voiceTraits.join(', '),
      rewriteModel: config.persona ? config.rewriteModel : undefined,
    },
  };

  // ─────────────────────────────────────────────────────────────────
  // STEP 4: Export book
  // ─────────────────────────────────────────────────────────────────
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ STEP 4: EXPORTING BOOK                                                 │');
  console.log('└' + '─'.repeat(68) + '┘\n');

  const fs = await import('fs/promises');
  const path = await import('path');

  // Ensure output directory exists
  await fs.mkdir(config.outputDir, { recursive: true });

  // Generate markdown
  const markdown = bookToMarkdown(book);
  const mdPath = path.join(config.outputDir, `${book.id}.md`);
  await fs.writeFile(mdPath, markdown);
  console.log(`  ✓ Markdown: ${mdPath}`);

  // Generate HTML
  const html = bookToHtml(book);
  const htmlPath = path.join(config.outputDir, `${book.id}.html`);
  await fs.writeFile(htmlPath, html);
  console.log(`  ✓ HTML: ${htmlPath}`);

  // Generate JSON
  const jsonPath = path.join(config.outputDir, `${book.id}.json`);
  await fs.writeFile(jsonPath, JSON.stringify(book, null, 2));
  console.log(`  ✓ JSON: ${jsonPath}`);

  // ─────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '═'.repeat(70));
  console.log(' BOOK GENERATION COMPLETE');
  console.log('═'.repeat(70));
  console.log(`\n  Title: "${book.title}"`);
  console.log(`  Chapters: ${book.chapters.length}`);
  console.log(`  Word count: ${totalWordCount.toLocaleString()}`);
  console.log(`  Duration: ${duration}s`);
  console.log(`\n  Output: ${config.outputDir}/`);
  console.log('═'.repeat(70) + '\n');

  await store.close();
}

// ═══════════════════════════════════════════════════════════════════
// EXPORT HELPERS
// ═══════════════════════════════════════════════════════════════════

function bookToMarkdown(book: Book): string {
  const lines: string[] = [];
  lines.push(`# ${book.title}`);
  lines.push('');

  if (book.description) {
    lines.push(`*${book.description}*`);
    lines.push('');
  }

  if (book.arc?.introduction) {
    lines.push('## Introduction');
    lines.push('');
    lines.push(book.arc.introduction);
    lines.push('');
  }

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

  return lines.join('\n');
}

function bookToHtml(book: Book): string {
  const escapeHtml = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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
  lines.push('    .intro { font-style: italic; color: #7f8c8d; margin-bottom: 2rem; }');
  lines.push('    .chapter { margin-bottom: 3rem; }');
  lines.push('    .chapter p { margin-bottom: 1.2rem; text-align: justify; }');
  lines.push('    .passage-separator { text-align: center; margin: 2rem 0; color: #bdc3c7; }');
  lines.push('    .attribution { font-size: 0.9rem; color: #95a5a6; font-style: italic; }');
  lines.push('    .footer { margin-top: 4rem; padding-top: 1rem; border-top: 2px solid #ecf0f1; font-size: 0.9rem; color: #95a5a6; }');
  lines.push('    blockquote { border-left: 3px solid #3498db; padding-left: 1rem; margin-left: 0; color: #555; }');
  lines.push('  </style>');
  lines.push('</head>');
  lines.push('<body>');

  lines.push(`  <h1>${escapeHtml(book.title)}</h1>`);

  if (book.description) {
    lines.push(`  <p class="intro">${escapeHtml(book.description)}</p>`);
  }

  if (book.arc?.introduction) {
    lines.push('  <section class="introduction">');
    lines.push('    <h2>Introduction</h2>');
    const introParagraphs = book.arc.introduction.split('\n\n').filter(Boolean);
    for (const para of introParagraphs) {
      lines.push(`    <p>${escapeHtml(para)}</p>`);
    }
    lines.push('  </section>');
  }

  for (const chapter of book.chapters) {
    lines.push('  <section class="chapter">');
    lines.push(`    <h2>${escapeHtml(chapter.title)}</h2>`);

    // Split by passage separators
    const passages = chapter.content.split(/\n\n---\n\n/);
    for (let i = 0; i < passages.length; i++) {
      const passage = passages[i];
      const paragraphs = passage.split('\n\n').filter(Boolean);

      for (const para of paragraphs) {
        if (para.startsWith('*—')) {
          // Attribution line
          lines.push(`    <p class="attribution">${escapeHtml(para.replace(/^\*|\*$/g, ''))}</p>`);
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

  lines.push('  <div class="footer">');
  lines.push('    <p>Generated by humanizer.com</p>');
  lines.push(`    <p>Created: ${book.createdAt.toISOString()}</p>`);
  if (book.metadata?.passageCount) {
    lines.push(`    <p>Compiled from ${book.metadata.passageCount} passages of excellence-tier content</p>`);
  }
  lines.push('  </div>');

  lines.push('</body>');
  lines.push('</html>');

  return lines.join('\n');
}

buildExcellenceBook()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Book generation failed:', err);
    process.exit(1);
  });
