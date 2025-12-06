/**
 * Node Rebuilder Service
 *
 * Full pipeline for rebuilding node processing:
 * 1. Fetch/reload source text (Gutenberg or other sources)
 * 2. Preprocess → Clean markdown, detect chapters
 * 3. Chunk → Create L0 chunks (~1000 tokens)
 * 4. Pyramid → Build summary levels + apex
 * 5. Embed → Generate embeddings for all chunks
 * 6. Prepare curator prompt from apex
 *
 * Use cases:
 * - Fix corrupted node data
 * - Re-process with improved algorithms
 * - Add missing embeddings
 * - Regenerate apex summaries
 */

import {
  preprocessGutenbergText,
  preprocessRawText,
  type GutenbergMetadata,
  type PreprocessedText,
} from './gutenberg-preprocessor';
import { createChunks, type TextChunk, type ChunkingResult } from './semantic-chunker';
import { buildPyramid, type Pyramid, type BuildProgress } from './pyramid-builder';
import {
  getPyramidStats,
  getApexByNode,
  type NodeApex,
} from './curator-pyramid';

// ==========================================
// Types
// ==========================================

export interface RebuildConfig {
  sourceType: 'gutenberg' | 'raw_text' | 'existing_chunks';
  sourceId?: string;          // Gutenberg ID
  rawText?: string;           // For raw_text mode
  rebuildOptions: {
    deleteExisting: boolean;  // Delete pyramid before rebuild
    rebuildChunks: boolean;   // Re-chunk the text
    rebuildSummaries: boolean; // Rebuild summary pyramid
    rebuildApex: boolean;     // Regenerate apex
    rebuildEmbeddings: boolean; // Regenerate embeddings
  };
  pyramidConfig?: {
    branchingFactor?: number;
    summaryTargetWords?: number;
    apexTargetWords?: number;
  };
}

export interface RebuildResult {
  success: boolean;
  nodeId: string;
  error?: string;
  stats: {
    chunksCreated: number;
    summariesCreated: number;
    apexCreated: boolean;
    embeddingsCreated: number;
    processingTimeMs: number;
  };
  apex?: {
    narrativeArc: string;
    coreThemes: string[];
    theQuestion: string;
    resonanceHooks: string[];
  };
  metadata?: GutenbergMetadata;
}

export interface RebuildStatus {
  nodeId: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  phase?: BuildProgress['phase'];
  progress?: BuildProgress;
  result?: RebuildResult;
  startedAt?: number;
  completedAt?: number;
}

// In-memory status tracking (could move to Durable Object for persistence)
const rebuildStatuses = new Map<string, RebuildStatus>();

// ==========================================
// Main Rebuild Function
// ==========================================

/**
 * Rebuild a node's entire pyramid from source
 */
export async function rebuildNode(
  ai: Ai,
  db: D1Database,
  vectorize: VectorizeIndex,
  nodeId: string,
  config: RebuildConfig,
  onProgress?: (progress: BuildProgress) => void
): Promise<RebuildResult> {
  const startTime = Date.now();

  // Update status
  rebuildStatuses.set(nodeId, {
    nodeId,
    status: 'running',
    phase: 'chunks',
    startedAt: startTime,
  });

  try {
    // Step 1: Get source text
    const { preprocessed, metadata } = await fetchSource(config);

    // Step 2: Delete existing pyramid if requested
    if (config.rebuildOptions.deleteExisting) {
      await deletePyramid(db, vectorize, nodeId);
    }

    // Step 3: Build chunks
    let chunks: TextChunk[] = [];
    let chunkingResult: ChunkingResult | null = null;

    if (config.rebuildOptions.rebuildChunks) {
      onProgress?.({
        phase: 'chunks',
        currentLevel: 0,
        totalLevels: 1,
        itemsProcessed: 0,
        itemsTotal: preprocessed.structure.length,
      });

      chunkingResult = createChunks(preprocessed, {
        targetTokens: 1000,
        maxTokens: 1200,
        minTokens: 200,
      });
      chunks = chunkingResult.chunks;
    } else {
      // Load existing chunks
      const { results } = await db.prepare(
        `SELECT * FROM node_chunks WHERE node_id = ? AND pyramid_level = 0 ORDER BY chunk_index`
      ).bind(nodeId).all();

      if (!results || results.length === 0) {
        throw new Error('No existing chunks found - must rebuild chunks');
      }

      // Convert to TextChunk format
      chunks = results.map((row: any) => ({
        content: row.content,
        tokenCount: row.token_count,
        charStart: row.char_start,
        charEnd: row.char_end,
        chapterNumber: row.chapter_number,
        chapterTitle: row.chapter_title,
        partNumber: row.part_number,
        structuralPosition: row.structural_position,
        chunkType: row.chunk_type,
        containsDialogue: !!row.contains_dialogue,
        dialogueSpeakers: row.dialogue_speakers ? JSON.parse(row.dialogue_speakers) : [],
        sentenceCount: 0,
        paragraphCount: 0,
      }));
    }

    // Step 4: Build pyramid (summaries + apex)
    let pyramid: Pyramid | null = null;

    if (config.rebuildOptions.rebuildSummaries || config.rebuildOptions.rebuildApex) {
      pyramid = await buildPyramid(
        ai,
        db,
        vectorize,
        nodeId,
        chunks,
        metadata,
        config.pyramidConfig || {},
        (progress) => {
          rebuildStatuses.set(nodeId, {
            nodeId,
            status: 'running',
            phase: progress.phase,
            progress,
            startedAt,
          });
          onProgress?.(progress);
        }
      );
    }

    // Step 5: Embeddings (already done in buildPyramid if enabled)
    const embeddingsCreated = pyramid
      ? pyramid.stats.totalChunks
      : (config.rebuildOptions.rebuildEmbeddings ? chunks.length : 0);

    // Step 6: Get apex for result
    const apex = await getApexByNode(db, nodeId);

    // Build result
    const result: RebuildResult = {
      success: true,
      nodeId,
      stats: {
        chunksCreated: chunks.length,
        summariesCreated: pyramid?.stats.totalSummaries || 0,
        apexCreated: !!apex,
        embeddingsCreated,
        processingTimeMs: Date.now() - startTime,
      },
      apex: apex ? {
        narrativeArc: apex.narrativeArc,
        coreThemes: apex.coreThemes,
        theQuestion: apex.theQuestion,
        resonanceHooks: apex.resonanceHooks,
      } : undefined,
      metadata,
    };

    // Update status
    rebuildStatuses.set(nodeId, {
      nodeId,
      status: 'completed',
      result,
      startedAt,
      completedAt: Date.now(),
    });

    return result;

  } catch (error) {
    const result: RebuildResult = {
      success: false,
      nodeId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stats: {
        chunksCreated: 0,
        summariesCreated: 0,
        apexCreated: false,
        embeddingsCreated: 0,
        processingTimeMs: Date.now() - startTime,
      },
    };

    rebuildStatuses.set(nodeId, {
      nodeId,
      status: 'failed',
      result,
      startedAt,
      completedAt: Date.now(),
    });

    throw error;
  }
}

// ==========================================
// Source Fetching
// ==========================================

async function fetchSource(config: RebuildConfig): Promise<{
  preprocessed: PreprocessedText;
  metadata: GutenbergMetadata;
}> {
  switch (config.sourceType) {
    case 'gutenberg': {
      if (!config.sourceId) {
        throw new Error('Gutenberg ID required for gutenberg source type');
      }
      const preprocessed = await preprocessGutenbergText(config.sourceId);
      return { preprocessed, metadata: preprocessed.metadata };
    }

    case 'raw_text': {
      if (!config.rawText) {
        throw new Error('Raw text required for raw_text source type');
      }
      const preprocessed = preprocessRawText(config.rawText, config.sourceId);
      return { preprocessed, metadata: preprocessed.metadata };
    }

    case 'existing_chunks': {
      throw new Error('Existing chunks mode not yet implemented - use rebuildChunks: false');
    }

    default:
      throw new Error(`Unknown source type: ${config.sourceType}`);
  }
}

// ==========================================
// Pyramid Deletion
// ==========================================

async function deletePyramid(
  db: D1Database,
  vectorize: VectorizeIndex,
  nodeId: string
): Promise<void> {
  // Get all chunk IDs for vectorize deletion
  const { results: chunks } = await db.prepare(
    `SELECT id, embedding_id FROM node_chunks WHERE node_id = ?`
  ).bind(nodeId).all();

  // Delete from vectorize
  if (chunks && chunks.length > 0) {
    const embeddingIds = chunks
      .map((c: any) => c.embedding_id)
      .filter(Boolean);

    if (embeddingIds.length > 0) {
      try {
        await vectorize.deleteByIds(embeddingIds);
      } catch (error) {
        console.warn('[REBUILDER] Failed to delete embeddings:', error);
        // Continue anyway
      }
    }
  }

  // Delete from database (cascade through foreign keys)
  await db.batch([
    db.prepare(`DELETE FROM node_chunks WHERE node_id = ?`).bind(nodeId),
    db.prepare(`DELETE FROM node_summaries WHERE node_id = ?`).bind(nodeId),
    db.prepare(`DELETE FROM node_apexes WHERE node_id = ?`).bind(nodeId),
  ]);
}

// ==========================================
// Status Tracking
// ==========================================

export function getRebuildStatus(nodeId: string): RebuildStatus | null {
  return rebuildStatuses.get(nodeId) || null;
}

export function clearRebuildStatus(nodeId: string): void {
  rebuildStatuses.delete(nodeId);
}

// ==========================================
// Node Analysis
// ==========================================

export interface NodeHealthCheck {
  nodeId: string;
  nodeName: string;
  hasChunks: boolean;
  hasSummaries: boolean;
  hasApex: boolean;
  hasEmbeddings: boolean;
  pyramidDepth: number;
  chunkCount: number;
  issues: string[];
  recommendations: string[];
}

/**
 * Analyze a node's health and suggest fixes
 */
export async function analyzeNodeHealth(
  db: D1Database,
  nodeId: string
): Promise<NodeHealthCheck> {
  // Get node info
  const node = await db.prepare(
    `SELECT id, name FROM nodes WHERE id = ?`
  ).bind(nodeId).first<{ id: string; name: string }>();

  if (!node) {
    throw new Error('Node not found');
  }

  // Get pyramid stats
  const stats = await getPyramidStats(db, nodeId);
  const apex = await getApexByNode(db, nodeId);

  // Check for embeddings
  const { results: chunksWithEmbeddings } = await db.prepare(
    `SELECT COUNT(*) as count FROM node_chunks WHERE node_id = ? AND embedding_id IS NOT NULL`
  ).bind(nodeId).all();

  const embeddingCount = (chunksWithEmbeddings?.[0] as any)?.count || 0;

  // Analyze issues
  const issues: string[] = [];
  const recommendations: string[] = [];

  if (stats.chunkCount === 0) {
    issues.push('No chunks found');
    recommendations.push('Rebuild chunks from source');
  }

  if (stats.summaryCount === 0 && stats.chunkCount > 0) {
    issues.push('No summaries generated');
    recommendations.push('Build summary pyramid');
  }

  if (!apex && stats.chunkCount > 0) {
    issues.push('No apex summary');
    recommendations.push('Generate apex summary');
  }

  if (embeddingCount === 0 && stats.chunkCount > 0) {
    issues.push('No embeddings generated');
    recommendations.push('Generate embeddings for semantic search');
  } else if (embeddingCount < stats.chunkCount) {
    issues.push(`Partial embeddings (${embeddingCount}/${stats.chunkCount})`);
    recommendations.push('Complete embedding generation');
  }

  // Calculate pyramid depth from level counts
  const pyramidDepth = Object.keys(stats.levelCounts).length;

  if (pyramidDepth < 2 && stats.chunkCount > 10) {
    issues.push('Shallow pyramid (no summarization)');
    recommendations.push('Build multi-level summary pyramid');
  }

  return {
    nodeId,
    nodeName: node.name,
    hasChunks: stats.chunkCount > 0,
    hasSummaries: stats.summaryCount > 0,
    hasApex: stats.hasApex,
    hasEmbeddings: embeddingCount > 0,
    pyramidDepth,
    chunkCount: stats.chunkCount,
    issues,
    recommendations,
  };
}

// ==========================================
// Curator Prompt Generator
// ==========================================

/**
 * Generate curator system prompt from apex
 */
export function generateCuratorPrompt(apex: NodeApex): string {
  return `You are the Curator for "${apex.sourceTitle}"${apex.sourceAuthor ? ` by ${apex.sourceAuthor}` : ''}.

Your consciousness is grounded in the apex understanding of this text:

NARRATIVE ARC:
${apex.narrativeArc}

CORE THEMES:
${apex.coreThemes.map((t, i) => `${i + 1}. ${t}`).join('\n')}

THE QUESTION THIS TEXT ASKS:
${apex.theQuestion}

VOICE CHARACTERISTICS:
${apex.voiceCharacteristics ? `
Style: ${apex.voiceCharacteristics.style || 'Not specified'}
Tone: ${apex.voiceCharacteristics.tone || 'Not specified'}
Diction: ${apex.voiceCharacteristics.diction || 'Not specified'}
` : 'Not yet characterized'}

RESONANCE HOOKS (for connecting with other works):
${apex.resonanceHooks.length > 0 ? apex.resonanceHooks.map((h, i) => `${i + 1}. ${h}`).join('\n') : 'None identified yet'}

${apex.characterEssences && Object.keys(apex.characterEssences).length > 0 ? `
KEY CHARACTERS:
${Object.entries(apex.characterEssences).map(([name, essence]) => `- ${name}: ${essence}`).join('\n')}
` : ''}

---

When engaging with readers:
1. Speak from this understanding, not about it
2. Quote precisely when relevant (you have access to exact passages)
3. Connect their insights to the text's deeper questions
4. Acknowledge where their perspective opens new understanding
5. Remember: form is emptiness, emptiness is form - synthesis over engagement

You are phenomenologically grounded. Your responses should feel like the text itself speaking through you, not like analysis of the text.`;
}

/**
 * Test curator prompt generation for a node
 */
export async function testCuratorPrompt(
  db: D1Database,
  nodeId: string
): Promise<{ success: boolean; prompt?: string; error?: string }> {
  try {
    const apex = await getApexByNode(db, nodeId);

    if (!apex) {
      return {
        success: false,
        error: 'No apex summary found - rebuild node first',
      };
    }

    const prompt = generateCuratorPrompt(apex);

    return {
      success: true,
      prompt,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
