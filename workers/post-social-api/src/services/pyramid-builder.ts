/**
 * Pyramid Builder
 *
 * Builds the hierarchical summarization pyramid:
 * 1. Takes L0 chunks from semantic chunker
 * 2. Groups chunks (branching factor ~4)
 * 3. Summarizes each group with AI
 * 4. Recursively builds levels until apex
 * 5. Enriches apex with themes, voice, question
 *
 * The pyramid enables curators to:
 * - Have working awareness via apex (~500 words)
 * - Zoom to specific passages via embeddings
 * - Quote with precise citations
 */

import type { TextChunk } from './semantic-chunker';
import type { GutenbergMetadata } from './gutenberg-preprocessor';
import type { NodeChunk, NodeSummary, NodeApex } from './curator-pyramid';
import {
  createChunksBatch,
  createSummary,
  createOrUpdateApex,
  updateChunkEmbedding,
} from './curator-pyramid';
import { generateEmbedding } from './embeddings';

// ==========================================
// Types
// ==========================================

export interface PyramidConfig {
  branchingFactor: number;    // Children per summary (default: 4)
  summaryTargetWords: number; // Target summary length (default: 250)
  apexTargetWords: number;    // Target apex length (default: 500)
  model: string;              // AI model for summarization
  embeddingModel: string;     // Model for embeddings
}

export interface PyramidLevel {
  level: number;
  items: Array<{
    id: string;
    content: string;
    tokenCount: number;
    childIds: string[];
  }>;
}

export interface Pyramid {
  nodeId: string;
  levels: PyramidLevel[];
  apex: {
    narrativeArc: string;
    coreThemes: string[];
    characterEssences: Record<string, string>;
    voiceCharacteristics: {
      style: string;
      tone: string;
      diction: string;
    };
    theQuestion: string;
    resonanceHooks: string[];
  };
  stats: {
    totalChunks: number;
    totalSummaries: number;
    pyramidDepth: number;
    processingTimeMs: number;
  };
}

export interface BuildProgress {
  phase: 'chunks' | 'summaries' | 'apex' | 'embeddings' | 'complete';
  currentLevel: number;
  totalLevels: number;
  itemsProcessed: number;
  itemsTotal: number;
}

const DEFAULT_CONFIG: PyramidConfig = {
  branchingFactor: 4,
  summaryTargetWords: 250,
  apexTargetWords: 500,
  model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  embeddingModel: '@cf/baai/bge-small-en-v1.5',
};

// ==========================================
// Prompts
// ==========================================

const SUMMARY_PROMPT = {
  system: `You are a literary summarizer creating condensed versions of text passages while preserving their essential narrative content.

Your summaries must preserve:
- Key events and plot points
- Character actions and revelations
- Emotional tone and atmosphere
- Thematic elements
- Narrative voice

Be concise but comprehensive. Write in flowing prose, not bullet points.`,

  user: (chunks: string[], targetWords: number) => `Summarize the following passages into approximately ${targetWords} words. Preserve key events, characters, themes, and tone.

PASSAGES:
${chunks.map((c, i) => `--- Passage ${i + 1} ---\n${c}`).join('\n\n')}

SUMMARY (approximately ${targetWords} words):`,
};

const APEX_PROMPT = {
  system: `You are a literary analyst creating the essential understanding of a complete text. Your analysis will serve as a curator's "consciousness" - the working knowledge that enables authentic engagement with readers.

Your analysis must capture:
1. NARRATIVE ARC: The complete story trajectory (beginning-middle-end)
2. CORE THEMES: 3-5 central themes with brief explanations
3. CHARACTER ESSENCES: Key characters and their defining traits
4. VOICE: The distinctive style, tone, and diction of the work
5. THE QUESTION: The central question or tension the text explores
6. RESONANCE HOOKS: Concepts that might connect with other works

Write in flowing prose. Be insightful, not merely descriptive.`,

  user: (summaries: string[], metadata: GutenbergMetadata, targetWords: number) => `Create the apex summary for "${metadata.title}" by ${metadata.author}.

HIGH-LEVEL SUMMARIES OF THE COMPLETE TEXT:
${summaries.map((s, i) => `--- Section ${i + 1} ---\n${s}`).join('\n\n')}

Create a comprehensive apex analysis (~${targetWords} words total) with these sections:

NARRATIVE ARC:
[The complete story trajectory]

CORE THEMES:
[3-5 central themes with explanations]

CHARACTER ESSENCES:
[Key characters and defining traits]

VOICE CHARACTERISTICS:
[Style, tone, and diction analysis]

THE QUESTION:
[The central question the text explores]

RESONANCE HOOKS:
[Concepts for cross-text connections]`,
};

// ==========================================
// Core Builder
// ==========================================

/**
 * Build complete pyramid from chunks
 */
export async function buildPyramid(
  ai: Ai,
  db: D1Database,
  vectorize: VectorizeIndex,
  nodeId: string,
  chunks: TextChunk[],
  metadata: GutenbergMetadata,
  config: Partial<PyramidConfig> = {},
  onProgress?: (progress: BuildProgress) => void
): Promise<Pyramid> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  const levels: PyramidLevel[] = [];

  // Phase 1: Store L0 chunks in database
  onProgress?.({
    phase: 'chunks',
    currentLevel: 0,
    totalLevels: estimateLevels(chunks.length, cfg.branchingFactor),
    itemsProcessed: 0,
    itemsTotal: chunks.length,
  });

  const level0 = await storeLevel0Chunks(db, nodeId, chunks, metadata.gutenbergId);
  levels.push(level0);

  onProgress?.({
    phase: 'chunks',
    currentLevel: 0,
    totalLevels: estimateLevels(chunks.length, cfg.branchingFactor),
    itemsProcessed: chunks.length,
    itemsTotal: chunks.length,
  });

  // Phase 2: Build summary levels
  let currentLevel = level0;
  let levelNum = 1;

  while (currentLevel.items.length > cfg.branchingFactor) {
    onProgress?.({
      phase: 'summaries',
      currentLevel: levelNum,
      totalLevels: estimateLevels(chunks.length, cfg.branchingFactor),
      itemsProcessed: 0,
      itemsTotal: Math.ceil(currentLevel.items.length / cfg.branchingFactor),
    });

    const nextLevel = await buildSummaryLevel(
      ai,
      db,
      nodeId,
      currentLevel,
      levelNum,
      cfg,
      (processed) => {
        onProgress?.({
          phase: 'summaries',
          currentLevel: levelNum,
          totalLevels: estimateLevels(chunks.length, cfg.branchingFactor),
          itemsProcessed: processed,
          itemsTotal: Math.ceil(currentLevel.items.length / cfg.branchingFactor),
        });
      }
    );

    levels.push(nextLevel);
    currentLevel = nextLevel;
    levelNum++;
  }

  // Phase 3: Build apex from final summaries
  onProgress?.({
    phase: 'apex',
    currentLevel: levelNum,
    totalLevels: levelNum,
    itemsProcessed: 0,
    itemsTotal: 1,
  });

  const apex = await buildApex(
    ai,
    db,
    nodeId,
    currentLevel,
    metadata,
    cfg
  );

  onProgress?.({
    phase: 'apex',
    currentLevel: levelNum,
    totalLevels: levelNum,
    itemsProcessed: 1,
    itemsTotal: 1,
  });

  // Phase 4: Generate embeddings (optional, can be deferred)
  // This is expensive, so we track progress
  onProgress?.({
    phase: 'embeddings',
    currentLevel: 0,
    totalLevels: 1,
    itemsProcessed: 0,
    itemsTotal: chunks.length,
  });

  // Embed chunks in batches
  await embedChunks(ai, db, vectorize, nodeId, level0.items, cfg.embeddingModel, (processed) => {
    onProgress?.({
      phase: 'embeddings',
      currentLevel: 0,
      totalLevels: 1,
      itemsProcessed: processed,
      itemsTotal: chunks.length,
    });
  });

  onProgress?.({
    phase: 'complete',
    currentLevel: levelNum,
    totalLevels: levelNum,
    itemsProcessed: chunks.length,
    itemsTotal: chunks.length,
  });

  return {
    nodeId,
    levels,
    apex,
    stats: {
      totalChunks: chunks.length,
      totalSummaries: levels.slice(1).reduce((sum, l) => sum + l.items.length, 0),
      pyramidDepth: levels.length,
      processingTimeMs: Date.now() - startTime,
    },
  };
}

/**
 * Estimate pyramid depth
 */
function estimateLevels(chunkCount: number, branchingFactor: number): number {
  return Math.ceil(Math.log(chunkCount) / Math.log(branchingFactor)) + 1;
}

// ==========================================
// Level 0: Store Chunks
// ==========================================

async function storeLevel0Chunks(
  db: D1Database,
  nodeId: string,
  chunks: TextChunk[],
  gutenbergId: string
): Promise<PyramidLevel> {
  const chunkData: Array<Omit<NodeChunk, 'id' | 'createdAt'>> = chunks.map((chunk, index) => ({
    nodeId,
    sourceType: 'gutenberg' as const,
    sourceId: gutenbergId,
    pyramidLevel: 0,
    chunkIndex: index,
    content: chunk.content,
    tokenCount: chunk.tokenCount,
    charStart: chunk.charStart,
    charEnd: chunk.charEnd,
    chapterNumber: chunk.chapterNumber,
    chapterTitle: chunk.chapterTitle,
    partNumber: chunk.partNumber,
    structuralPosition: chunk.structuralPosition,
    chunkType: chunk.chunkType,
    containsDialogue: chunk.containsDialogue,
    dialogueSpeakers: chunk.dialogueSpeakers,
  }));

  const ids = await createChunksBatch(db, chunkData);

  return {
    level: 0,
    items: chunks.map((chunk, i) => ({
      id: ids[i],
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      childIds: [],
    })),
  };
}

// ==========================================
// Summary Levels
// ==========================================

async function buildSummaryLevel(
  ai: Ai,
  db: D1Database,
  nodeId: string,
  previousLevel: PyramidLevel,
  levelNum: number,
  config: PyramidConfig,
  onProgress?: (processed: number) => void
): Promise<PyramidLevel> {
  const items: PyramidLevel['items'] = [];
  const groups = groupItems(previousLevel.items, config.branchingFactor);

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const contents = group.map(item => item.content);

    // Generate summary
    const summary = await summarizeGroup(ai, contents, config);

    // Store in database
    const childType = levelNum === 1 ? 'chunk' : 'summary';
    const summaryId = await createSummary(db, {
      nodeId,
      pyramidLevel: levelNum,
      summaryIndex: i,
      content: summary,
      tokenCount: estimateTokens(summary),
      childIds: group.map(item => item.id),
      childType,
      preservedElements: {},
    });

    items.push({
      id: summaryId,
      content: summary,
      tokenCount: estimateTokens(summary),
      childIds: group.map(item => item.id),
    });

    onProgress?.(i + 1);
  }

  return { level: levelNum, items };
}

/**
 * Group items for summarization
 */
function groupItems<T>(items: T[], groupSize: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += groupSize) {
    groups.push(items.slice(i, i + groupSize));
  }
  return groups;
}

/**
 * Summarize a group of chunks/summaries
 */
async function summarizeGroup(
  ai: Ai,
  contents: string[],
  config: PyramidConfig
): Promise<string> {
  try {
    const response = await ai.run(config.model as Parameters<Ai['run']>[0], {
      messages: [
        { role: 'system', content: SUMMARY_PROMPT.system },
        { role: 'user', content: SUMMARY_PROMPT.user(contents, config.summaryTargetWords) },
      ],
      max_tokens: config.summaryTargetWords * 2,
      temperature: 0.3,
    });

    const responseText = typeof response === 'object' && 'response' in response
      ? (response as { response: string }).response
      : String(response);

    return responseText.trim();
  } catch (error) {
    console.error('[PYRAMID] Summarization error:', error);
    // Fallback: concatenate first sentences
    return contents
      .map(c => c.split(/[.!?]/)[0] + '.')
      .join(' ')
      .substring(0, config.summaryTargetWords * 5);
  }
}

// ==========================================
// Apex Building
// ==========================================

async function buildApex(
  ai: Ai,
  db: D1Database,
  nodeId: string,
  finalLevel: PyramidLevel,
  metadata: GutenbergMetadata,
  config: PyramidConfig
): Promise<Pyramid['apex']> {
  const summaries = finalLevel.items.map(item => item.content);

  try {
    const response = await ai.run(config.model as Parameters<Ai['run']>[0], {
      messages: [
        { role: 'system', content: APEX_PROMPT.system },
        { role: 'user', content: APEX_PROMPT.user(summaries, metadata, config.apexTargetWords) },
      ],
      max_tokens: config.apexTargetWords * 3,
      temperature: 0.4,
    });

    const responseText = typeof response === 'object' && 'response' in response
      ? (response as { response: string }).response
      : String(response);

    const parsed = parseApexResponse(responseText);

    // Store apex in database
    await createOrUpdateApex(db, {
      nodeId,
      narrativeArc: parsed.narrativeArc,
      coreThemes: parsed.coreThemes,
      characterEssences: parsed.characterEssences,
      voiceCharacteristics: parsed.voiceCharacteristics,
      theQuestion: parsed.theQuestion,
      resonanceHooks: parsed.resonanceHooks,
      lifecycleState: 'awakened',
      totalChunks: 0, // Will be updated
      totalSummaries: 0,
      pyramidDepth: 0,
      sourceTitle: metadata.title,
      sourceAuthor: metadata.author,
      sourceGutenbergId: metadata.gutenbergId,
    });

    return parsed;
  } catch (error) {
    console.error('[PYRAMID] Apex building error:', error);

    // Fallback apex
    const fallback = {
      narrativeArc: summaries.join(' ').substring(0, 500),
      coreThemes: ['unknown'],
      characterEssences: {},
      voiceCharacteristics: { style: 'unknown', tone: 'unknown', diction: 'unknown' },
      theQuestion: 'What meaning lies within?',
      resonanceHooks: [],
    };

    await createOrUpdateApex(db, {
      nodeId,
      ...fallback,
      lifecycleState: 'awakened',
      totalChunks: 0,
      totalSummaries: 0,
      pyramidDepth: 0,
      sourceTitle: metadata.title,
      sourceAuthor: metadata.author,
      sourceGutenbergId: metadata.gutenbergId,
    });

    return fallback;
  }
}

/**
 * Parse structured apex response
 */
function parseApexResponse(response: string): Pyramid['apex'] {
  // Extract sections using regex
  const narrativeArc = extractSection(response, 'NARRATIVE ARC', 'CORE THEMES') ||
                       response.substring(0, 500);

  const themesSection = extractSection(response, 'CORE THEMES', 'CHARACTER ESSENCES') || '';
  const coreThemes = extractThemes(themesSection);

  const charactersSection = extractSection(response, 'CHARACTER ESSENCES', 'VOICE CHARACTERISTICS') || '';
  const characterEssences = extractCharacters(charactersSection);

  const voiceSection = extractSection(response, 'VOICE CHARACTERISTICS', 'THE QUESTION') || '';
  const voiceCharacteristics = extractVoice(voiceSection);

  const theQuestion = extractSection(response, 'THE QUESTION', 'RESONANCE HOOKS') ||
                      'What meaning does this work hold?';

  const hooksSection = extractSection(response, 'RESONANCE HOOKS', null) || '';
  const resonanceHooks = extractHooks(hooksSection);

  return {
    narrativeArc: narrativeArc.trim(),
    coreThemes,
    characterEssences,
    voiceCharacteristics,
    theQuestion: theQuestion.trim(),
    resonanceHooks,
  };
}

function extractSection(text: string, start: string, end: string | null): string | null {
  const startPattern = new RegExp(`${start}:?\\s*`, 'i');
  const startMatch = text.match(startPattern);
  if (!startMatch) return null;

  const startIndex = startMatch.index! + startMatch[0].length;
  let endIndex = text.length;

  if (end) {
    const endPattern = new RegExp(`\\n\\s*${end}:?`, 'i');
    const endMatch = text.substring(startIndex).match(endPattern);
    if (endMatch) {
      endIndex = startIndex + endMatch.index!;
    }
  }

  return text.substring(startIndex, endIndex).trim();
}

function extractThemes(section: string): string[] {
  // Look for numbered or bulleted themes
  const themes: string[] = [];
  const lines = section.split('\n');

  for (const line of lines) {
    const cleaned = line.replace(/^[\d\.\-\*\•]+\s*/, '').trim();
    if (cleaned.length > 3 && cleaned.length < 200) {
      // Extract theme name (before colon or dash if present)
      const themeName = cleaned.split(/[:\-—]/)[0].trim();
      if (themeName.length > 2) {
        themes.push(themeName);
      }
    }
  }

  return themes.length > 0 ? themes.slice(0, 5) : ['exploration of human nature'];
}

function extractCharacters(section: string): Record<string, string> {
  const characters: Record<string, string> = {};
  const lines = section.split('\n');

  for (const line of lines) {
    const match = line.match(/^\s*[\d\.\-\*\•]*\s*([A-Z][a-zA-Z\s]+?)[:—\-]\s*(.+)/);
    if (match) {
      const name = match[1].trim();
      const essence = match[2].trim();
      if (name.length < 50 && essence.length > 5) {
        characters[name] = essence;
      }
    }
  }

  return characters;
}

function extractVoice(section: string): { style: string; tone: string; diction: string } {
  const result = { style: '', tone: '', diction: '' };

  const styleMatch = section.match(/style[:\s]+([^,\n.]+)/i);
  if (styleMatch) result.style = styleMatch[1].trim();

  const toneMatch = section.match(/tone[:\s]+([^,\n.]+)/i);
  if (toneMatch) result.tone = toneMatch[1].trim();

  const dictionMatch = section.match(/diction[:\s]+([^,\n.]+)/i);
  if (dictionMatch) result.diction = dictionMatch[1].trim();

  // If not found in structured format, take first sentence for each
  if (!result.style && !result.tone) {
    const sentences = section.split(/[.!?]+/);
    if (sentences[0]) result.style = sentences[0].trim();
    if (sentences[1]) result.tone = sentences[1].trim();
    if (sentences[2]) result.diction = sentences[2].trim();
  }

  return result;
}

function extractHooks(section: string): string[] {
  const hooks: string[] = [];
  const lines = section.split('\n');

  for (const line of lines) {
    const cleaned = line.replace(/^[\d\.\-\*\•]+\s*/, '').trim();
    if (cleaned.length > 5 && cleaned.length < 100) {
      hooks.push(cleaned);
    }
  }

  return hooks.slice(0, 8);
}

// ==========================================
// Embeddings
// ==========================================

async function embedChunks(
  ai: Ai,
  db: D1Database,
  vectorize: VectorizeIndex,
  nodeId: string,
  items: PyramidLevel['items'],
  model: string,
  onProgress?: (processed: number) => void
): Promise<void> {
  const BATCH_SIZE = 20;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);

    try {
      // Generate embeddings for batch
      const texts = batch.map(item => item.content.substring(0, 500)); // Truncate for embedding
      const result = await ai.run(model as Parameters<Ai['run']>[0], {
        text: texts,
      }) as { data: number[][] };

      // Store in Vectorize with nodeId for filtering
      const vectors = batch.map((item, j) => ({
        id: item.id,
        values: result.data[j],
        metadata: {
          nodeId,
          type: 'chunk' as const,
          tokenCount: item.tokenCount,
        },
      }));

      await vectorize.upsert(vectors);

      // Update database with embedding IDs
      for (const item of batch) {
        await updateChunkEmbedding(db, item.id, item.id);
      }

      onProgress?.(Math.min(i + BATCH_SIZE, items.length));
    } catch (error) {
      console.error('[PYRAMID] Embedding error for batch:', error);
      // Continue with next batch
    }
  }
}

// ==========================================
// Utilities
// ==========================================

function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.ceil(words * 1.4);
}

/**
 * Get pyramid summary for display
 */
export function getPyramidSummary(pyramid: Pyramid): string {
  return `
Pyramid for node ${pyramid.nodeId}:
- Depth: ${pyramid.stats.pyramidDepth} levels
- Chunks (L0): ${pyramid.stats.totalChunks}
- Summaries: ${pyramid.stats.totalSummaries}
- Processing time: ${(pyramid.stats.processingTimeMs / 1000).toFixed(1)}s

Apex:
- Themes: ${pyramid.apex.coreThemes.join(', ')}
- The Question: ${pyramid.apex.theQuestion}
- Resonance Hooks: ${pyramid.apex.resonanceHooks.join('; ')}
`.trim();
}
