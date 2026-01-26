/**
 * Extract Media-Text Associations from Existing Database Content
 *
 * This script processes existing content_nodes to create media_text_associations.
 * It handles:
 * 1. DALL-E image generations (assistant messages with image refs + descriptions)
 * 2. User-uploaded images with assistant descriptions
 * 3. OCR transcriptions from code blocks (notebook pages, etc.)
 *
 * Unlike import-time extraction (which only processes known gizmos),
 * this script uses heuristic pattern matching on all ChatGPT content.
 */

import { randomUUID } from 'crypto';
import { PostgresContentStore } from '../src/storage/postgres-content-store.js';
import type { MediaTextAssociation, MediaTextAssociationType } from '../src/storage/types.js';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const CONFIG = {
  /** Batch size for database queries */
  batchSize: 100,
  /** Minimum text length to consider for extraction */
  minTextLength: 50,
  /** Enable verbose logging */
  verbose: true,
};

// ═══════════════════════════════════════════════════════════════════
// PATTERNS
// ═══════════════════════════════════════════════════════════════════

/** Pattern for DALL-E image generation responses */
const DALLE_PATTERNS = [
  /I've created/i,
  /I created/i,
  /Here is (an?|the) (image|illustration|picture)/i,
  /I've generated/i,
  /I generated/i,
  /Here's (an?|the) (image|illustration|picture)/i,
  /Created using DALL[·-]?E/i,
  /DALL[·-]?E\s+\d/i,
];

/** Pattern for image description responses */
const DESCRIPTION_PATTERNS = [
  /The image (shows|depicts|features|contains)/i,
  /In this image/i,
  /This (image|picture|photo|photograph) (shows|depicts|is)/i,
  /I can see/i,
  /Looking at (this|the) image/i,
  /The (photo|photograph|picture) (shows|depicts|captures)/i,
];

/** Pattern for OCR/transcription responses */
const OCR_PATTERNS = [
  /Here('s| is) the (transcription|transcript|text)/i,
  /The text (reads|says|contains)/i,
  /Transcribed content/i,
  /OCR (result|output)/i,
  /Here's what (I can read|the text says)/i,
];

/** Pattern for markdown code blocks (often contain transcriptions) */
const CODE_BLOCK_PATTERN = /```(\w*)\n([\s\S]*?)```/g;

/** Pattern for file-service pointers */
const FILE_SERVICE_PATTERN = /file-service:\/\/file-([A-Za-z0-9]+)/g;

/** Pattern for DALL-E file pointers in media_refs */
const DALLE_FILE_PATTERN = /file-[A-Za-z0-9]+-[A-Fa-f0-9-]+/;

// ═══════════════════════════════════════════════════════════════════
// EXTRACTION LOGIC
// ═══════════════════════════════════════════════════════════════════

interface NodeWithMedia {
  id: string;
  text: string;
  authorRole: string;
  sourceType: string;
  mediaRefs: Array<{ id: string; type?: string; url?: string }>;
  conversationId?: string;
  sourceCreatedAt?: Date;
  threadRootId?: string;
}

/**
 * Detect if text is a DALL-E image description
 */
function isDalleDescription(text: string): boolean {
  return DALLE_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Detect if text contains an image description
 */
function isImageDescription(text: string): boolean {
  return DESCRIPTION_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Detect if text contains OCR/transcription content
 */
function isOcrContent(text: string): boolean {
  return OCR_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Extract code blocks from text (often contain OCR transcriptions)
 */
function extractCodeBlocks(text: string): string[] {
  const blocks: string[] = [];
  const pattern = new RegExp(CODE_BLOCK_PATTERN);
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const content = match[2].trim();
    if (content.length >= CONFIG.minTextLength) {
      blocks.push(content);
    }
  }

  return blocks;
}

/**
 * Extract media IDs from media_refs
 */
function extractMediaIds(mediaRefs: Array<{ id: string; type?: string; url?: string }>): string[] {
  return mediaRefs.map(ref => ref.id).filter(Boolean);
}

/**
 * Create associations for a DALL-E generation
 */
function createDalleAssociations(
  node: NodeWithMedia
): Omit<MediaTextAssociation, 'id' | 'createdAt'>[] {
  const associations: Omit<MediaTextAssociation, 'id' | 'createdAt'>[] = [];
  const mediaIds = extractMediaIds(node.mediaRefs);

  // For each media ref, create a "generated-from" association
  for (const mediaId of mediaIds) {
    associations.push({
      mediaId,
      mediaPointer: node.mediaRefs.find(r => r.id === mediaId)?.url,
      extractedText: node.text.substring(0, 2000), // Truncate for storage
      associationType: 'description',
      chainPosition: 0,
      extractionMethod: 'dalle-heuristic',
      confidence: 0.85,
      conversationId: node.conversationId,
      messageId: node.id,
      sourceCreatedAt: node.sourceCreatedAt?.getTime(),
    });
  }

  return associations;
}

/**
 * Create associations for an image description
 */
function createDescriptionAssociations(
  node: NodeWithMedia,
  userMediaRefs?: Array<{ id: string; type?: string; url?: string }>
): Omit<MediaTextAssociation, 'id' | 'createdAt'>[] {
  const associations: Omit<MediaTextAssociation, 'id' | 'createdAt'>[] = [];

  // If we have the user's media refs, associate with those
  const mediaRefs = userMediaRefs || node.mediaRefs;
  const mediaIds = extractMediaIds(mediaRefs);

  for (const mediaId of mediaIds) {
    associations.push({
      mediaId,
      mediaPointer: mediaRefs.find(r => r.id === mediaId)?.url,
      extractedText: node.text.substring(0, 2000),
      associationType: 'description',
      chainPosition: 0,
      extractionMethod: 'description-heuristic',
      confidence: 0.75,
      conversationId: node.conversationId,
      messageId: node.id,
      sourceCreatedAt: node.sourceCreatedAt?.getTime(),
    });
  }

  return associations;
}

/**
 * Create associations for OCR content
 */
function createOcrAssociations(
  node: NodeWithMedia,
  userMediaRefs?: Array<{ id: string; type?: string; url?: string }>
): Omit<MediaTextAssociation, 'id' | 'createdAt'>[] {
  const associations: Omit<MediaTextAssociation, 'id' | 'createdAt'>[] = [];

  // Extract code blocks (often contain transcriptions)
  const codeBlocks = extractCodeBlocks(node.text);
  const mediaRefs = userMediaRefs || node.mediaRefs;
  const mediaIds = extractMediaIds(mediaRefs);

  if (codeBlocks.length > 0 && mediaIds.length > 0) {
    // Link each code block to each media item
    for (const block of codeBlocks) {
      for (const mediaId of mediaIds) {
        associations.push({
          mediaId,
          mediaPointer: mediaRefs.find(r => r.id === mediaId)?.url,
          extractedText: block,
          associationType: 'ocr',
          chainPosition: 0,
          extractionMethod: 'ocr-code-block-heuristic',
          confidence: 0.70,
          conversationId: node.conversationId,
          messageId: node.id,
          sourceCreatedAt: node.sourceCreatedAt?.getTime(),
        });
      }
    }
  } else if (mediaIds.length > 0) {
    // No code blocks but text indicates OCR, use full text
    for (const mediaId of mediaIds) {
      associations.push({
        mediaId,
        mediaPointer: mediaRefs.find(r => r.id === mediaId)?.url,
        extractedText: node.text.substring(0, 2000),
        associationType: 'ocr',
        chainPosition: 0,
        extractionMethod: 'ocr-heuristic',
        confidence: 0.65,
        conversationId: node.conversationId,
        messageId: node.id,
        sourceCreatedAt: node.sourceCreatedAt?.getTime(),
      });
    }
  }

  return associations;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN EXTRACTION
// ═══════════════════════════════════════════════════════════════════

async function extractMediaTextFromDb() {
  const store = new PostgresContentStore({
    enableVec: true,
    enableFTS: true,
  });
  await store.initialize();

  const pool = store.getPool();
  const log = (msg: string) => {
    if (CONFIG.verbose) console.log(msg);
  };

  log('═'.repeat(70));
  log(' MEDIA-TEXT EXTRACTION FROM DATABASE');
  log('═'.repeat(70));

  // ─────────────────────────────────────────────────────────────────
  // Phase 1: Get current stats
  // ─────────────────────────────────────────────────────────────────
  const existingStats = await pool.query(`
    SELECT COUNT(*) as count FROM media_text_associations
  `);
  const existingCount = parseInt(existingStats.rows[0].count, 10);
  log(`\nExisting associations: ${existingCount}`);

  // ─────────────────────────────────────────────────────────────────
  // Phase 2: Find assistant messages with DALL-E content
  // ─────────────────────────────────────────────────────────────────
  log('\n[Phase 1] Processing DALL-E generations...');

  // Look for messages with actual file-service URLs (proper file IDs)
  const dalleResult = await pool.query(`
    SELECT
      id, text, author_role, source_type, media_refs,
      source_metadata->>'conversation_id' as conversation_id,
      source_created_at, thread_root_id
    FROM content_nodes
    WHERE source_type LIKE '%chatgpt%'
      AND media_refs IS NOT NULL
      AND media_refs::text LIKE '%file-service%'
    ORDER BY source_created_at DESC NULLS LAST
  `);

  log(`  Found ${dalleResult.rows.length} potential DALL-E messages`);

  let imageAssociations: Omit<MediaTextAssociation, 'id' | 'createdAt'>[] = [];
  for (const row of dalleResult.rows) {
    // Handle JSONB - might be object, array, or string
    let mediaRefs: Array<{ id: string; type?: string; url?: string }> = [];
    if (Array.isArray(row.media_refs)) {
      mediaRefs = row.media_refs;
    } else if (typeof row.media_refs === 'string') {
      try {
        mediaRefs = JSON.parse(row.media_refs);
      } catch {
        continue;
      }
    } else if (row.media_refs && typeof row.media_refs === 'object') {
      // Single object, wrap in array
      mediaRefs = [row.media_refs];
    }

    if (!mediaRefs || mediaRefs.length === 0) continue;

    // Filter to only file-service URLs (real file IDs)
    const fileServiceRefs = mediaRefs.filter(r => r.id?.includes('file-') || r.url?.includes('file-'));
    if (fileServiceRefs.length === 0) continue;

    const node: NodeWithMedia = {
      id: row.id,
      text: row.text || '',
      authorRole: row.author_role,
      sourceType: row.source_type,
      mediaRefs: fileServiceRefs,
      conversationId: row.conversation_id,
      sourceCreatedAt: row.source_created_at,
      threadRootId: row.thread_root_id,
    };

    // For assistant messages with images - likely DALL-E generations
    if (node.authorRole === 'assistant' && node.text.length > CONFIG.minTextLength) {
      if (isDalleDescription(node.text) || isImageDescription(node.text)) {
        const assocs = createDalleAssociations(node);
        imageAssociations.push(...assocs);
      }
    }
    // For user messages with images - check for OCR requests or image context
    else if (node.authorRole === 'user' && node.text.length > 20) {
      // User providing context about uploaded images
      for (const ref of fileServiceRefs) {
        imageAssociations.push({
          mediaId: ref.id,
          mediaPointer: ref.url,
          extractedText: node.text.substring(0, 2000),
          associationType: 'caption',
          chainPosition: 0,
          extractionMethod: 'user-caption-heuristic',
          confidence: 0.80,
          conversationId: node.conversationId,
          messageId: node.id,
          sourceCreatedAt: node.sourceCreatedAt?.getTime(),
        });
      }
    }
  }

  log(`  Created ${imageAssociations.length} image associations (DALL-E + user captions)`);

  // ─────────────────────────────────────────────────────────────────
  // Phase 1b: Process sediment:// URLs (voice mode screenshots)
  // ─────────────────────────────────────────────────────────────────
  log('\n[Phase 1b] Processing voice mode screenshots (sediment://)...');

  const sedimentResult = await pool.query(`
    SELECT
      id, text, author_role, source_type, media_refs,
      source_metadata->>'conversation_id' as conversation_id,
      source_created_at, thread_root_id
    FROM content_nodes
    WHERE source_type LIKE '%chatgpt%'
      AND media_refs IS NOT NULL
      AND media_refs::text LIKE '%sediment://%'
    ORDER BY source_created_at DESC NULLS LAST
  `);

  log(`  Found ${sedimentResult.rows.length} messages with sediment:// refs`);

  for (const row of sedimentResult.rows) {
    let mediaRefs: Array<{ id: string; type?: string; url?: string }> = [];
    if (Array.isArray(row.media_refs)) {
      mediaRefs = row.media_refs;
    } else if (typeof row.media_refs === 'string') {
      try { mediaRefs = JSON.parse(row.media_refs); } catch { continue; }
    } else if (row.media_refs && typeof row.media_refs === 'object') {
      mediaRefs = [row.media_refs];
    }

    const sedimentRefs = mediaRefs.filter(r => r.id?.includes('sediment://') || r.url?.includes('sediment://'));
    if (sedimentRefs.length === 0 || !row.text || row.text.length < CONFIG.minTextLength) continue;

    // Voice mode screenshots with accompanying text
    for (const ref of sedimentRefs) {
      imageAssociations.push({
        mediaId: ref.id,
        mediaPointer: ref.url,
        extractedText: row.text.substring(0, 2000),
        associationType: 'description',
        chainPosition: 0,
        extractionMethod: 'voice-mode-transcript',
        confidence: 0.70,
        conversationId: row.conversation_id,
        messageId: row.id,
        sourceCreatedAt: row.source_created_at?.getTime(),
      });
    }
  }

  log(`  Total image associations: ${imageAssociations.length}`);

  // ─────────────────────────────────────────────────────────────────
  // Phase 2: Custom GPT OCR Transcriptions
  // ─────────────────────────────────────────────────────────────────
  log('\n[Phase 2] Processing Custom GPT OCR transcriptions...');

  // Find Custom GPT assistant messages with code blocks that follow user image uploads
  const ocrTranscriptResult = await pool.query(`
    SELECT DISTINCT ON (a.id)
      a.id as assistant_id,
      a.text as assistant_text,
      a.thread_root_id,
      a.source_created_at,
      a.source_metadata->>'conversation_id' as conversation_id,
      u.id as user_id,
      u.media_refs as user_media_refs
    FROM content_nodes a
    JOIN content_nodes u ON a.thread_root_id = u.thread_root_id
      AND u.author_role = 'user'
      AND u.source_created_at < a.source_created_at
      AND u.media_refs IS NOT NULL
      AND u.media_refs::text LIKE '%file-%'
    WHERE a.source_type LIKE '%chatgpt%'
      AND a.author_role = 'assistant'
      AND a.source_metadata::text LIKE '%gpt-4-gizmo%'
      AND a.text LIKE '%\`\`\`%'
      AND (a.text ILIKE '%transcri%' OR a.text ILIKE '%here is the%text%')
    ORDER BY a.id, u.source_created_at DESC
  `);

  log(`  Found ${ocrTranscriptResult.rows.length} Custom GPT OCR transcript messages`);

  let ocrAssociationsCreated = 0;
  for (const row of ocrTranscriptResult.rows) {
    // Parse user media refs
    let userMediaRefs: Array<{ id: string; type?: string; url?: string }> = [];
    if (Array.isArray(row.user_media_refs)) {
      userMediaRefs = row.user_media_refs;
    } else if (typeof row.user_media_refs === 'string') {
      try { userMediaRefs = JSON.parse(row.user_media_refs); } catch { continue; }
    } else if (row.user_media_refs && typeof row.user_media_refs === 'object') {
      userMediaRefs = [row.user_media_refs];
    }

    // Filter to file-service URLs only
    const fileRefs = userMediaRefs.filter(r => r.id?.includes('file-') || r.url?.includes('file-'));
    if (fileRefs.length === 0) continue;

    // Extract code blocks from assistant text
    const codeBlocks = extractCodeBlocks(row.assistant_text || '');
    if (codeBlocks.length === 0) continue;

    // Create batch ID for multi-image transcripts
    const batchId = fileRefs.length > 1 ? randomUUID() : undefined;

    // Link all images to all code blocks (Journal Recognizer can combine multiple images)
    for (let blockIdx = 0; blockIdx < codeBlocks.length; blockIdx++) {
      const block = codeBlocks[blockIdx];
      for (let imgIdx = 0; imgIdx < fileRefs.length; imgIdx++) {
        const ref = fileRefs[imgIdx];
        imageAssociations.push({
          mediaId: ref.id,
          mediaPointer: ref.url,
          extractedText: block,
          associationType: 'ocr',
          chainPosition: 0,
          extractionMethod: 'custom-gpt-ocr',
          confidence: 0.90, // High confidence for dedicated OCR GPTs
          conversationId: row.conversation_id,
          messageId: row.assistant_id,
          batchId,
          batchPosition: imgIdx,
          sourceCreatedAt: row.source_created_at?.getTime(),
        });
        ocrAssociationsCreated++;
      }
    }
  }

  log(`  Created ${ocrAssociationsCreated} OCR associations from Custom GPTs`);
  log(`  Total associations so far: ${imageAssociations.length}`);

  // ─────────────────────────────────────────────────────────────────
  // Phase 4: Find image description conversations
  // ─────────────────────────────────────────────────────────────────
  log('\n[Phase 4] Processing image descriptions...');

  // Find user messages with images, then get assistant responses
  const userImagesResult = await pool.query(`
    SELECT
      u.id as user_id, u.text as user_text, u.media_refs as user_media_refs,
      u.source_metadata->>'conversation_id' as conversation_id,
      u.source_created_at as user_created_at,
      u.thread_root_id,
      a.id as assistant_id, a.text as assistant_text,
      a.source_created_at as assistant_created_at
    FROM content_nodes u
    LEFT JOIN content_nodes a ON (
      a.thread_root_id = u.thread_root_id
      AND a.author_role = 'assistant'
      AND a.source_created_at > u.source_created_at
      AND a.source_created_at < u.source_created_at + INTERVAL '10 minutes'
    )
    WHERE u.source_type LIKE '%chatgpt%'
      AND u.author_role = 'user'
      AND u.media_refs IS NOT NULL
      AND u.media_refs::text != '[]'
      AND a.id IS NOT NULL
    ORDER BY u.source_created_at DESC NULLS LAST
    LIMIT 5000
  `);

  log(`  Found ${userImagesResult.rows.length} user image + assistant response pairs`);

  let descriptionAssociations: Omit<MediaTextAssociation, 'id' | 'createdAt'>[] = [];
  let ocrAssociations: Omit<MediaTextAssociation, 'id' | 'createdAt'>[] = [];

  for (const row of userImagesResult.rows) {
    // Handle JSONB - might be object, array, or string
    let userMediaRefs: Array<{ id: string; type?: string; url?: string }> = [];
    if (Array.isArray(row.user_media_refs)) {
      userMediaRefs = row.user_media_refs;
    } else if (typeof row.user_media_refs === 'string') {
      try {
        userMediaRefs = JSON.parse(row.user_media_refs);
      } catch {
        continue;
      }
    } else if (row.user_media_refs && typeof row.user_media_refs === 'object') {
      userMediaRefs = [row.user_media_refs];
    }

    if (!userMediaRefs || userMediaRefs.length === 0) continue;

    const assistantNode: NodeWithMedia = {
      id: row.assistant_id,
      text: row.assistant_text || '',
      authorRole: 'assistant',
      sourceType: 'chatgpt',
      mediaRefs: userMediaRefs, // Associate with user's media
      conversationId: row.conversation_id,
      sourceCreatedAt: row.assistant_created_at,
      threadRootId: row.thread_root_id,
    };

    // Check for OCR content first (more specific)
    if (isOcrContent(assistantNode.text)) {
      const assocs = createOcrAssociations(assistantNode, userMediaRefs);
      ocrAssociations.push(...assocs);
    } else if (isImageDescription(assistantNode.text)) {
      const assocs = createDescriptionAssociations(assistantNode, userMediaRefs);
      descriptionAssociations.push(...assocs);
    }
  }

  log(`  Created ${descriptionAssociations.length} description associations`);
  log(`  Created ${ocrAssociations.length} OCR associations`);

  // ─────────────────────────────────────────────────────────────────
  // Phase 5: Store all associations
  // ─────────────────────────────────────────────────────────────────
  const allAssociations = [
    ...imageAssociations,
    ...descriptionAssociations,
    ...ocrAssociations,
  ];

  log(`\n[Phase 5] Storing ${allAssociations.length} associations...`);

  if (allAssociations.length > 0) {
    const result = await store.storeMediaTextAssociations(allAssociations);
    log(`  Stored: ${result.stored}, Failed: ${result.failed}`);
  }

  // ─────────────────────────────────────────────────────────────────
  // Phase 6: Final stats
  // ─────────────────────────────────────────────────────────────────
  const finalStats = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN association_type = 'ocr' THEN 1 END) as ocr_count,
      COUNT(CASE WHEN association_type = 'description' THEN 1 END) as desc_count,
      COUNT(DISTINCT media_id) as unique_media,
      COUNT(DISTINCT conversation_id) as unique_conversations
    FROM media_text_associations
  `);

  const stats = finalStats.rows[0];
  log('\n═'.repeat(70));
  log(' EXTRACTION COMPLETE');
  log('═'.repeat(70));
  log(`  Total associations: ${stats.total}`);
  log(`  OCR transcriptions: ${stats.ocr_count}`);
  log(`  Descriptions: ${stats.desc_count}`);
  log(`  Unique media items: ${stats.unique_media}`);
  log(`  Conversations covered: ${stats.unique_conversations}`);

  await store.close();
}

// ═══════════════════════════════════════════════════════════════════
// RUN
// ═══════════════════════════════════════════════════════════════════

extractMediaTextFromDb().catch(console.error);
