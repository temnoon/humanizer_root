/**
 * Media-Text Extractor
 *
 * Extracts and links media (images) to text content (OCR, descriptions, captions).
 * Handles specific Custom GPT patterns:
 * - Journal Recognizer OCR (g-T7bW2qVzx): Notebook transcription in code blocks
 * - Image Echo & Bounce (g-FmQp1Tm1G): Title/description tables, echo chains
 *
 * General extraction patterns:
 * - Markdown code blocks (triple-tick) for OCR/transcript content
 * - Markdown tables for structured descriptions
 * - Image references in messages
 */

import { randomUUID } from 'crypto';
import type { MediaTextAssociation, MediaTextAssociationType } from '../../storage/types.js';
import { KNOWN_GIZMO_IDS } from '../../storage/types.js';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * A media reference found in a message
 */
export interface ExtractedMedia {
  /** Media ID (file pointer ID) */
  mediaId: string;
  /** Full pointer URL (file-service://... or sediment://...) */
  pointer?: string;
  /** Media type if known */
  type?: 'image' | 'audio' | 'video' | 'document';
  /** Position in message (for batch ordering) */
  position: number;
}

/**
 * An extracted text block from a message
 */
export interface ExtractedTextBlock {
  /** The extracted text */
  text: string;
  /** Start offset in the original message content */
  startOffset: number;
  /** End offset in the original message content */
  endOffset: number;
  /** Type of block */
  blockType: 'code-block' | 'table' | 'paragraph' | 'inline';
  /** Language hint from code block (if any) */
  language?: string;
}

/**
 * Result from analyzing a message for media-text associations
 */
export interface MediaTextExtractionResult {
  /** Found media references */
  media: ExtractedMedia[];
  /** Extracted text blocks */
  textBlocks: ExtractedTextBlock[];
  /** Proposed associations */
  associations: Omit<MediaTextAssociation, 'id' | 'createdAt'>[];
  /** Detected gizmo ID (if Custom GPT) */
  gizmoId?: string;
  /** Extraction method used */
  extractionMethod: string;
}

/**
 * Message content to analyze
 */
export interface MessageForExtraction {
  /** Message ID */
  messageId: string;
  /** Conversation ID */
  conversationId: string;
  /** Message content (text) */
  content: string;
  /** Author role */
  authorRole: 'user' | 'assistant' | 'system' | 'tool';
  /** Media attachments in this message */
  mediaRefs?: Array<{
    id: string;
    type?: string;
    url?: string;
  }>;
  /** Message metadata */
  metadata?: Record<string, unknown>;
  /** When created */
  createdAt?: Date;
}

/**
 * Options for media-text extraction
 */
export interface MediaTextExtractionOptions {
  /** Override gizmo ID detection */
  gizmoId?: string;
  /** Skip code block extraction */
  skipCodeBlocks?: boolean;
  /** Skip table extraction */
  skipTables?: boolean;
  /** Minimum text length to consider */
  minTextLength?: number;
  /** Import job ID for tracking */
  importJobId?: string;
}

// ═══════════════════════════════════════════════════════════════════
// PATTERNS
// ═══════════════════════════════════════════════════════════════════

/** Pattern for markdown code blocks (triple-tick) */
const CODE_BLOCK_PATTERN = /```(\w*)\n([\s\S]*?)```/g;

/** Pattern for markdown tables */
const TABLE_PATTERN = /\|[^\n]+\|\n\|[-:\s|]+\|\n((?:\|[^\n]+\|\n?)+)/g;

/** Pattern for file-service pointers */
const FILE_SERVICE_PATTERN = /file-service:\/\/file-([A-Za-z0-9]+)/g;

/** Pattern for sediment pointers */
const SEDIMENT_PATTERN = /sediment:\/\/file_([A-Za-z0-9]+)/g;

/** Pattern for asset_pointer references */
const ASSET_POINTER_PATTERN = /"asset_pointer"\s*:\s*"([^"]+)"/g;

// ═══════════════════════════════════════════════════════════════════
// EXTRACTION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Extract media references from message content
 */
export function extractMediaFromContent(content: string): ExtractedMedia[] {
  const media: ExtractedMedia[] = [];
  let position = 0;

  // Extract file-service:// pointers
  let match: RegExpExecArray | null;
  const fileServicePattern = new RegExp(FILE_SERVICE_PATTERN);
  while ((match = fileServicePattern.exec(content)) !== null) {
    media.push({
      mediaId: `file-${match[1]}`,
      pointer: match[0],
      type: 'image',
      position: position++,
    });
  }

  // Extract sediment:// pointers
  const sedimentPattern = new RegExp(SEDIMENT_PATTERN);
  while ((match = sedimentPattern.exec(content)) !== null) {
    media.push({
      mediaId: `file-${match[1]}`,
      pointer: match[0],
      type: 'image',
      position: position++,
    });
  }

  // Extract asset_pointer references
  const assetPattern = new RegExp(ASSET_POINTER_PATTERN);
  while ((match = assetPattern.exec(content)) !== null) {
    const pointer = match[1];
    const idMatch = pointer.match(/file-([A-Za-z0-9]+)/);
    if (idMatch) {
      media.push({
        mediaId: `file-${idMatch[1]}`,
        pointer,
        type: 'image',
        position: position++,
      });
    }
  }

  // Deduplicate by mediaId
  const seen = new Set<string>();
  return media.filter((m) => {
    if (seen.has(m.mediaId)) return false;
    seen.add(m.mediaId);
    return true;
  });
}

/**
 * Extract media from message media_refs
 */
export function extractMediaFromRefs(
  refs: Array<{ id: string; type?: string; url?: string }>
): ExtractedMedia[] {
  return refs.map((ref, index) => ({
    mediaId: ref.id,
    pointer: ref.url,
    type: (ref.type as ExtractedMedia['type']) || 'image',
    position: index,
  }));
}

/**
 * Extract code blocks from content
 */
export function extractCodeBlocks(content: string): ExtractedTextBlock[] {
  const blocks: ExtractedTextBlock[] = [];
  const pattern = new RegExp(CODE_BLOCK_PATTERN);
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    const language = match[1] || undefined;
    const text = match[2].trim();

    if (text.length > 0) {
      blocks.push({
        text,
        startOffset: match.index,
        endOffset: match.index + match[0].length,
        blockType: 'code-block',
        language,
      });
    }
  }

  return blocks;
}

/**
 * Extract tables from content
 */
export function extractTables(content: string): ExtractedTextBlock[] {
  const blocks: ExtractedTextBlock[] = [];
  const pattern = new RegExp(TABLE_PATTERN);
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    const text = match[0].trim();

    if (text.length > 0) {
      blocks.push({
        text,
        startOffset: match.index,
        endOffset: match.index + match[0].length,
        blockType: 'table',
      });
    }
  }

  return blocks;
}

/**
 * Parse a markdown table into rows
 */
export function parseTable(tableText: string): Array<Record<string, string>> {
  const lines = tableText.trim().split('\n');
  if (lines.length < 3) return [];

  // Parse header
  const headerLine = lines[0];
  const headers = headerLine
    .split('|')
    .map((h) => h.trim())
    .filter((h) => h.length > 0);

  // Skip separator line (lines[1])

  // Parse data rows
  const rows: Array<Record<string, string>> = [];
  for (let i = 2; i < lines.length; i++) {
    const cells = lines[i]
      .split('|')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header.toLowerCase()] = cells[index] || '';
    });
    rows.push(row);
  }

  return rows;
}

// ═══════════════════════════════════════════════════════════════════
// GIZMO-SPECIFIC EXTRACTORS
// ═══════════════════════════════════════════════════════════════════

/**
 * Extract OCR transcript from Journal Recognizer response
 *
 * Journal Recognizer pattern:
 * - User uploads notebook page images
 * - Assistant responds with OCR transcript in code block
 * - Multiple images can map to one transcript
 */
export function extractJournalRecognizerOCR(
  userMessage: MessageForExtraction,
  assistantMessage: MessageForExtraction
): Omit<MediaTextAssociation, 'id' | 'createdAt'>[] {
  const associations: Omit<MediaTextAssociation, 'id' | 'createdAt'>[] = [];

  // Get media from user message
  const userMedia = userMessage.mediaRefs
    ? extractMediaFromRefs(userMessage.mediaRefs)
    : extractMediaFromContent(userMessage.content);

  if (userMedia.length === 0) return associations;

  // Get code blocks from assistant response (OCR transcript)
  const codeBlocks = extractCodeBlocks(assistantMessage.content);

  // If we have media and code blocks, create associations
  if (codeBlocks.length > 0) {
    // Generate batch ID if multiple images
    const batchId = userMedia.length > 1 ? randomUUID() : undefined;

    // Each code block is a potential transcript
    for (const block of codeBlocks) {
      // Link all images to this transcript
      for (const media of userMedia) {
        associations.push({
          mediaId: media.mediaId,
          mediaPointer: media.pointer,
          extractedText: block.text,
          textSpanStart: block.startOffset,
          textSpanEnd: block.endOffset,
          associationType: 'ocr',
          chainPosition: 0,
          extractionMethod: 'journal-recognizer',
          confidence: 0.9, // High confidence for dedicated OCR GPT
          gizmoId: KNOWN_GIZMO_IDS.JOURNAL_RECOGNIZER_OCR,
          conversationId: assistantMessage.conversationId,
          messageId: assistantMessage.messageId,
          batchId,
          batchPosition: media.position,
          sourceCreatedAt: assistantMessage.createdAt?.getTime(),
        });
      }
    }
  }

  return associations;
}

/**
 * Extract title/description from Image Echo & Bounce response
 *
 * Image Echo pattern:
 * - User uploads image
 * - Assistant responds with title/description in markdown table
 * - Can generate "echo" image based on description
 * - Creates chains: original → echo → echo
 */
export function extractImageEchoDescription(
  userMessage: MessageForExtraction,
  assistantMessage: MessageForExtraction,
  previousEchoMediaId?: string
): Omit<MediaTextAssociation, 'id' | 'createdAt'>[] {
  const associations: Omit<MediaTextAssociation, 'id' | 'createdAt'>[] = [];

  // Get media from user message (uploaded image)
  const userMedia = userMessage.mediaRefs
    ? extractMediaFromRefs(userMessage.mediaRefs)
    : extractMediaFromContent(userMessage.content);

  // Get generated media from assistant message (echo image)
  const assistantMedia = extractMediaFromContent(assistantMessage.content);

  // Get tables from assistant response (title/description)
  const tables = extractTables(assistantMessage.content);

  // Parse tables for title/description
  for (const table of tables) {
    const rows = parseTable(table.text);

    for (const row of rows) {
      const title = row['title'] || row['name'];
      const description = row['description'] || row['desc'];

      if (title || description) {
        // Link uploaded images to the description
        for (const media of userMedia) {
          if (title) {
            associations.push({
              mediaId: media.mediaId,
              mediaPointer: media.pointer,
              extractedText: title,
              textSpanStart: table.startOffset,
              textSpanEnd: table.endOffset,
              associationType: 'title',
              sourceMediaId: previousEchoMediaId,
              chainPosition: previousEchoMediaId ? 1 : 0,
              extractionMethod: 'image-echo-bounce',
              confidence: 0.95,
              gizmoId: KNOWN_GIZMO_IDS.IMAGE_ECHO_BOUNCE,
              conversationId: assistantMessage.conversationId,
              messageId: assistantMessage.messageId,
              sourceCreatedAt: assistantMessage.createdAt?.getTime(),
            });
          }

          if (description) {
            associations.push({
              mediaId: media.mediaId,
              mediaPointer: media.pointer,
              extractedText: description,
              textSpanStart: table.startOffset,
              textSpanEnd: table.endOffset,
              associationType: 'description',
              sourceMediaId: previousEchoMediaId,
              chainPosition: previousEchoMediaId ? 1 : 0,
              extractionMethod: 'image-echo-bounce',
              confidence: 0.95,
              gizmoId: KNOWN_GIZMO_IDS.IMAGE_ECHO_BOUNCE,
              conversationId: assistantMessage.conversationId,
              messageId: assistantMessage.messageId,
              sourceCreatedAt: assistantMessage.createdAt?.getTime(),
            });
          }
        }

        // Link echo images (generated from description)
        for (const echoMedia of assistantMedia) {
          const sourceId = userMedia[0]?.mediaId;

          associations.push({
            mediaId: echoMedia.mediaId,
            mediaPointer: echoMedia.pointer,
            extractedText: description || title,
            associationType: 'generated-from',
            sourceMediaId: sourceId,
            chainPosition: sourceId ? 1 : 0,
            extractionMethod: 'image-echo-bounce',
            confidence: 0.9,
            gizmoId: KNOWN_GIZMO_IDS.IMAGE_ECHO_BOUNCE,
            conversationId: assistantMessage.conversationId,
            messageId: assistantMessage.messageId,
            sourceCreatedAt: assistantMessage.createdAt?.getTime(),
          });

          // Also mark it as echo-of the original
          if (sourceId) {
            associations.push({
              mediaId: echoMedia.mediaId,
              mediaPointer: echoMedia.pointer,
              associationType: 'echo-of',
              sourceMediaId: sourceId,
              chainPosition: 1,
              extractionMethod: 'image-echo-bounce',
              confidence: 0.95,
              gizmoId: KNOWN_GIZMO_IDS.IMAGE_ECHO_BOUNCE,
              conversationId: assistantMessage.conversationId,
              messageId: assistantMessage.messageId,
              sourceCreatedAt: assistantMessage.createdAt?.getTime(),
            });
          }
        }
      }
    }
  }

  return associations;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN EXTRACTION FUNCTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Extract media-text associations from a message pair (user + assistant)
 *
 * @param userMessage - The user message (typically contains uploaded media)
 * @param assistantMessage - The assistant response (contains extracted text)
 * @param options - Extraction options
 */
export function extractMediaTextAssociations(
  userMessage: MessageForExtraction,
  assistantMessage: MessageForExtraction,
  options: MediaTextExtractionOptions = {}
): MediaTextExtractionResult {
  const { minTextLength = 10, skipCodeBlocks, skipTables } = options;

  // Detect gizmo ID from metadata
  const gizmoId =
    options.gizmoId ||
    (assistantMessage.metadata?.gizmo_id as string) ||
    (userMessage.metadata?.gizmo_id as string);

  // Extract media from both messages
  const userMedia = userMessage.mediaRefs
    ? extractMediaFromRefs(userMessage.mediaRefs)
    : extractMediaFromContent(userMessage.content);

  const assistantMedia = extractMediaFromContent(assistantMessage.content);
  const allMedia = [...userMedia, ...assistantMedia];

  // Extract text blocks
  const textBlocks: ExtractedTextBlock[] = [];

  if (!skipCodeBlocks) {
    textBlocks.push(...extractCodeBlocks(assistantMessage.content));
  }

  if (!skipTables) {
    textBlocks.push(...extractTables(assistantMessage.content));
  }

  // Filter by minimum length
  const filteredBlocks = textBlocks.filter((b) => b.text.length >= minTextLength);

  // Generate associations based on gizmo
  let associations: Omit<MediaTextAssociation, 'id' | 'createdAt'>[] = [];
  let extractionMethod = 'generic';

  if (gizmoId === KNOWN_GIZMO_IDS.JOURNAL_RECOGNIZER_OCR) {
    associations = extractJournalRecognizerOCR(userMessage, assistantMessage);
    extractionMethod = 'journal-recognizer';
  } else if (gizmoId === KNOWN_GIZMO_IDS.IMAGE_ECHO_BOUNCE) {
    associations = extractImageEchoDescription(userMessage, assistantMessage);
    extractionMethod = 'image-echo-bounce';
  } else if (allMedia.length > 0 && filteredBlocks.length > 0) {
    // Generic extraction: link all media to all text blocks
    extractionMethod = 'generic-code-block';

    for (const media of userMedia) {
      for (const block of filteredBlocks) {
        const associationType: MediaTextAssociationType =
          block.blockType === 'code-block' ? 'ocr' : 'description';

        associations.push({
          mediaId: media.mediaId,
          mediaPointer: media.pointer,
          extractedText: block.text,
          textSpanStart: block.startOffset,
          textSpanEnd: block.endOffset,
          associationType,
          chainPosition: 0,
          extractionMethod,
          confidence: 0.7, // Lower confidence for generic extraction
          gizmoId,
          conversationId: assistantMessage.conversationId,
          messageId: assistantMessage.messageId,
          importJobId: options.importJobId,
          sourceCreatedAt: assistantMessage.createdAt?.getTime(),
        });
      }
    }
  }

  return {
    media: allMedia,
    textBlocks: filteredBlocks,
    associations,
    gizmoId,
    extractionMethod,
  };
}

/**
 * Check if a conversation is from a known Custom GPT for media-text extraction
 */
export function isMediaTextGizmo(gizmoId: string | undefined): boolean {
  if (!gizmoId) return false;
  return (
    gizmoId === KNOWN_GIZMO_IDS.JOURNAL_RECOGNIZER_OCR ||
    gizmoId === KNOWN_GIZMO_IDS.IMAGE_ECHO_BOUNCE
  );
}

/**
 * Get extraction method for a gizmo
 */
export function getExtractionMethodForGizmo(gizmoId: string | undefined): string {
  if (gizmoId === KNOWN_GIZMO_IDS.JOURNAL_RECOGNIZER_OCR) {
    return 'journal-recognizer';
  }
  if (gizmoId === KNOWN_GIZMO_IDS.IMAGE_ECHO_BOUNCE) {
    return 'image-echo-bounce';
  }
  return 'generic';
}
