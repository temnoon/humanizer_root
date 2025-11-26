// Curation Pipeline Service
// Orchestrates safety check, curation, and embedding generation
// This is the main entry point for processing new posts

import { checkSafety, type SafetyResult } from './safety-gate';
import { curatePost, type CurationResult } from './curation';
import { generateEmbedding, indexPost, type VectorMetadata } from './embeddings';

export type PostStatus = 'pending' | 'approved' | 'rejected' | 'curated';

export interface PipelineResult {
  status: PostStatus;
  safety: SafetyResult;
  curation?: CurationResult;
  embeddingId?: string;
  totalProcessingTimeMs: number;
  error?: string;
}

export interface PipelineOptions {
  userRole?: string;
  skipSafety?: boolean;
  skipEmbedding?: boolean;
}

/**
 * Run the full curation pipeline on a post
 * 
 * Pipeline stages:
 * 1. Safety check (Llama Guard)
 * 2. Curation (summarize + tag)
 * 3. Embedding (for semantic search)
 */
export async function runCurationPipeline(
  ai: Ai,
  vectorize: VectorizeIndex | null,
  postId: string,
  content: string,
  userId: string,
  visibility: string,
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  const startTime = Date.now();
  
  // Stage 1: Safety Check
  let safetyResult: SafetyResult;
  
  if (options.skipSafety) {
    safetyResult = {
      safe: true,
      category: null,
      reason: 'Safety check skipped',
      confidence: 1.0,
      model: 'skipped',
      promptId: 'skipped',
      processingTimeMs: 0,
    };
  } else {
    safetyResult = await checkSafety(ai, content, { userRole: options.userRole });
  }
  
  // If not safe, stop pipeline
  if (!safetyResult.safe) {
    return {
      status: 'rejected',
      safety: safetyResult,
      totalProcessingTimeMs: Date.now() - startTime,
    };
  }
  
  // Stage 2: Curation (summarize + tag)
  let curationResult: CurationResult;
  try {
    curationResult = await curatePost(ai, content);
  } catch (error) {
    console.error('[PIPELINE] Curation failed:', error);
    return {
      status: 'approved', // Still approved, just not fully curated
      safety: safetyResult,
      totalProcessingTimeMs: Date.now() - startTime,
      error: `Curation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
  
  // Stage 3: Embedding (if vectorize is available)
  let embeddingId: string | undefined;
  
  if (vectorize && !options.skipEmbedding) {
    try {
      // Generate embedding from combined content
      const textToEmbed = `${curationResult.summary}\n\n${content}`;
      const embeddingResult = await generateEmbedding(ai, textToEmbed);
      
      // Index in Vectorize
      const metadata: VectorMetadata = {
        postId,
        userId,
        summary: curationResult.summary,
        tags: curationResult.tags,
        visibility,
        createdAt: Date.now(),
        version: 1,
      };
      
      await indexPost(vectorize, postId, embeddingResult.embedding, metadata);
      embeddingId = postId;
      
    } catch (error) {
      console.error('[PIPELINE] Embedding failed:', error);
      // Continue without embedding - post is still curated
    }
  }
  
  return {
    status: 'curated',
    safety: safetyResult,
    curation: curationResult,
    embeddingId,
    totalProcessingTimeMs: Date.now() - startTime,
  };
}

/**
 * Update curation status and fields in the database
 */
export async function updatePostCuration(
  db: D1Database,
  postId: string,
  result: PipelineResult
): Promise<void> {
  const now = Date.now();
  
  const safetyJson = JSON.stringify({
    safe: result.safety.safe,
    category: result.safety.category,
    reason: result.safety.reason,
    confidence: result.safety.confidence,
  });
  
  if (result.status === 'rejected') {
    // Post was rejected - update status and safety check only
    await db.prepare(
      `UPDATE posts 
       SET status = ?, 
           safety_check = ?,
           updated_at = ?
       WHERE id = ?`
    ).bind('rejected', safetyJson, now, postId).run();
    return;
  }
  
  if (result.status === 'approved' && !result.curation) {
    // Approved but curation failed
    await db.prepare(
      `UPDATE posts 
       SET status = ?, 
           safety_check = ?,
           updated_at = ?
       WHERE id = ?`
    ).bind('approved', safetyJson, now, postId).run();
    return;
  }
  
  // Full curation completed
  const tagsJson = result.curation ? JSON.stringify(result.curation.tags) : null;
  
  await db.prepare(
    `UPDATE posts 
     SET status = ?, 
         safety_check = ?,
         summary = ?,
         tags = ?,
         embedding_id = ?,
         curation_model = ?,
         curated_at = ?,
         updated_at = ?
     WHERE id = ?`
  ).bind(
    result.status,
    safetyJson,
    result.curation?.summary ?? null,
    tagsJson,
    result.embeddingId ?? null,
    result.curation?.model ?? null,
    now,
    now,
    postId
  ).run();
  
  // Update tags table for browsing
  if (result.curation?.tags?.length) {
    await updateTagsTable(db, postId, result.curation.tags);
  }
}

/**
 * Update the tags and post_tags tables
 */
async function updateTagsTable(
  db: D1Database,
  postId: string,
  tags: string[]
): Promise<void> {
  const now = Date.now();
  
  for (const tagName of tags) {
    // Upsert tag
    await db.prepare(
      `INSERT INTO tags (id, name, post_count, created_at, updated_at)
       VALUES (?, ?, 1, ?, ?)
       ON CONFLICT(name) DO UPDATE SET 
         post_count = post_count + 1,
         updated_at = ?`
    ).bind(crypto.randomUUID(), tagName, now, now, now).run();
    
    // Get tag id
    const tag = await db.prepare(
      `SELECT id FROM tags WHERE name = ?`
    ).bind(tagName).first<{ id: string }>();
    
    if (tag) {
      // Link post to tag
      await db.prepare(
        `INSERT OR IGNORE INTO post_tags (post_id, tag_id, created_at)
         VALUES (?, ?, ?)`
      ).bind(postId, tag.id, now).run();
    }
  }
}

/**
 * Track curation in the queue table
 */
export async function trackCurationQueue(
  db: D1Database,
  postId: string,
  status: 'queued' | 'processing' | 'completed' | 'failed',
  stage?: 'safety' | 'summarize' | 'tags' | 'embed',
  errorMessage?: string
): Promise<void> {
  const now = Date.now();
  
  if (status === 'queued') {
    await db.prepare(
      `INSERT INTO curation_queue (id, post_id, status, queued_at)
       VALUES (?, ?, 'queued', ?)
       ON CONFLICT(post_id) DO UPDATE SET
         status = 'queued',
         stage = NULL,
         error_message = NULL,
         attempts = attempts + 1,
         queued_at = ?`
    ).bind(crypto.randomUUID(), postId, now, now).run();
  } else if (status === 'processing') {
    await db.prepare(
      `UPDATE curation_queue 
       SET status = 'processing', 
           stage = ?,
           started_at = ?
       WHERE post_id = ?`
    ).bind(stage ?? null, now, postId).run();
  } else if (status === 'completed') {
    await db.prepare(
      `UPDATE curation_queue 
       SET status = 'completed',
           completed_at = ?
       WHERE post_id = ?`
    ).bind(now, postId).run();
  } else if (status === 'failed') {
    await db.prepare(
      `UPDATE curation_queue 
       SET status = 'failed',
           error_message = ?
       WHERE post_id = ?`
    ).bind(errorMessage ?? 'Unknown error', postId).run();
  }
}

/**
 * Get pipeline statistics
 */
export async function getPipelineStats(db: D1Database): Promise<{
  pending: number;
  approved: number;
  rejected: number;
  curated: number;
  queuedForProcessing: number;
  failed: number;
}> {
  const [postStats, queueStats] = await Promise.all([
    db.prepare(
      `SELECT status, COUNT(*) as count FROM posts GROUP BY status`
    ).all<{ status: string; count: number }>(),
    db.prepare(
      `SELECT status, COUNT(*) as count FROM curation_queue GROUP BY status`
    ).all<{ status: string; count: number }>(),
  ]);
  
  const stats = {
    pending: 0,
    approved: 0,
    rejected: 0,
    curated: 0,
    queuedForProcessing: 0,
    failed: 0,
  };
  
  for (const row of postStats.results || []) {
    if (row.status in stats) {
      stats[row.status as keyof typeof stats] = row.count;
    }
  }
  
  for (const row of queueStats.results || []) {
    if (row.status === 'queued' || row.status === 'processing') {
      stats.queuedForProcessing += row.count;
    } else if (row.status === 'failed') {
      stats.failed = row.count;
    }
  }
  
  return stats;
}
