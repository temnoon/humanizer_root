/**
 * Import Parsed Archives to PostgreSQL Database
 *
 * Converts parsed Conversations from the parser into ImportedNode format
 * and stores them in the PostgreSQL content_nodes table.
 */

import * as crypto from 'crypto';
import type { Conversation, ParsedArchive, ExportFormat } from './types.js';
import type { ImportedNode, MediaReference, ContentLink } from '../types.js';
import {
  initContentStore,
  getContentStore,
  closeContentStore,
} from '../../storage/postgres-content-store.js';
import type { ImportJob } from '../../storage/types.js';

/**
 * Import result statistics
 */
export interface ImportResult {
  jobId: string;
  status: 'completed' | 'failed';
  conversationsProcessed: number;
  messagesImported: number;
  messagesSkipped: number;
  messagesFailed: number;
  mediaRefsLinked: number;
  durationMs: number;
  error?: string;
}

/**
 * Convert a parsed archive to ImportedNodes and store in database
 */
export async function importArchiveToDb(
  archive: ParsedArchive,
  options: {
    verbose?: boolean;
    batchSize?: number;
    skipExisting?: boolean;
  } = {}
): Promise<ImportResult> {
  const { verbose = false, batchSize = 100, skipExisting = true } = options;
  const startTime = Date.now();

  const log = (msg: string) => {
    if (verbose) console.log(msg);
  };

  // Initialize store
  await initContentStore();
  const store = getContentStore();

  // Create import job
  const adapterId = formatToAdapter(archive.format);
  const job = await store.createJob(adapterId, archive.extractedPath);

  log(`\nImport job ${job.id} started`);
  log(`Format: ${archive.format}`);
  log(`Conversations: ${archive.stats.totalConversations}`);
  log(`Messages: ${archive.stats.totalMessages}`);

  await store.updateJob(job.id, {
    status: 'running',
    startedAt: Date.now(),
  });

  let conversationsProcessed = 0;
  let messagesImported = 0;
  let messagesSkipped = 0;
  let messagesFailed = 0;
  let mediaRefsLinked = 0;

  try {
    // Process conversations in batches
    for (const conversation of archive.conversations) {
      conversationsProcessed++;

      // Convert conversation to nodes
      const nodes = conversationToNodes(conversation, archive.format);

      // Store nodes
      for (const node of nodes) {
        try {
          if (skipExisting) {
            const existing = await store.getNodeByHash(node.contentHash);
            if (existing) {
              messagesSkipped++;
              continue;
            }
          }

          await store.storeNode(node, job.id);
          messagesImported++;

          if (node.media) {
            mediaRefsLinked += node.media.length;
          }
        } catch (err) {
          messagesFailed++;
          if (verbose) {
            console.error(`  Failed to store node ${node.uri}:`, err);
          }
        }
      }

      // Progress update
      if (conversationsProcessed % 100 === 0) {
        log(`  Processed ${conversationsProcessed}/${archive.conversations.length} conversations...`);
        await store.updateJob(job.id, {
          nodesImported: messagesImported,
          nodesSkipped: messagesSkipped,
          nodesFailed: messagesFailed,
        });
      }
    }

    // Final update
    await store.updateJob(job.id, {
      status: 'completed',
      completedAt: Date.now(),
      nodesImported: messagesImported,
      nodesSkipped: messagesSkipped,
      nodesFailed: messagesFailed,
      stats: {
        conversationsProcessed,
        mediaRefsLinked,
        format: archive.format,
      },
    });

    const durationMs = Date.now() - startTime;

    log(`\n✓ Import complete in ${(durationMs / 1000).toFixed(1)}s`);
    log(`  Conversations: ${conversationsProcessed}`);
    log(`  Messages imported: ${messagesImported}`);
    log(`  Messages skipped: ${messagesSkipped}`);
    log(`  Messages failed: ${messagesFailed}`);
    log(`  Media refs: ${mediaRefsLinked}`);

    return {
      jobId: job.id,
      status: 'completed',
      conversationsProcessed,
      messagesImported,
      messagesSkipped,
      messagesFailed,
      mediaRefsLinked,
      durationMs,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    await store.updateJob(job.id, {
      status: 'failed',
      completedAt: Date.now(),
      error: errorMsg,
    });

    return {
      jobId: job.id,
      status: 'failed',
      conversationsProcessed,
      messagesImported,
      messagesSkipped,
      messagesFailed,
      mediaRefsLinked,
      durationMs: Date.now() - startTime,
      error: errorMsg,
    };
  }
}

/**
 * Convert a Conversation to ImportedNode array
 */
function conversationToNodes(
  conversation: Conversation,
  format: ExportFormat
): ImportedNode[] {
  const nodes: ImportedNode[] = [];
  const sourceType = formatToSourceType(format, conversation);
  const convId = conversation.conversation_id || conversation.id || 'unknown';

  // Create conversation root node
  const convUri = `${format}://${convId}`;
  const convContent = conversation.title || 'Untitled Conversation';
  const convHash = hashContent(convContent + convId);

  const convNode: ImportedNode = {
    // Generate UUID - the original ID is preserved in metadata.originalId
    id: crypto.randomUUID(),
    uri: convUri,
    contentHash: convHash,
    content: convContent,
    format: 'text',
    sourceType: `${sourceType}-conversation`,
    sourceCreatedAt: conversation.create_time
      ? new Date(conversation.create_time * 1000)
      : undefined,
    sourceUpdatedAt: conversation.update_time
      ? new Date(conversation.update_time * 1000)
      : undefined,
    metadata: {
      title: conversation.title,
      source: format,
      originalId: convId,
      messageCount: Object.keys(conversation.mapping || {}).length,
      hasMedia: (conversation._media_files?.length || 0) > 0,
    },
  };

  nodes.push(convNode);

  // Extract messages from mapping tree
  const mapping = conversation.mapping || {};
  const messages = extractMessagesFromMapping(mapping);

  // Create message nodes
  let position = 0;
  for (const msg of messages) {
    const msgId = (msg.id as string) || `${convId}_msg_${position}`;
    const msgUri = `${format}://${convId}/${msgId}`;

    // Extract text content
    const textContent = extractTextContent(msg);
    if (!textContent || textContent.trim().length === 0) {
      continue; // Skip empty messages
    }

    const msgHash = hashContent(textContent + msgId);
    const author = msg.author as { role?: string; name?: string } | undefined;
    const metadata = msg.metadata as Record<string, unknown> | undefined;
    const createTime = msg.create_time as number | undefined;
    const updateTime = msg.update_time as number | undefined;

    const msgNode: ImportedNode = {
      // Generate UUID - the original ID is preserved in metadata.originalId
      id: crypto.randomUUID(),
      uri: msgUri,
      contentHash: msgHash,
      content: textContent,
      format: 'markdown',
      sourceType: `${sourceType}-message`,
      sourceCreatedAt: createTime ? new Date(createTime * 1000) : undefined,
      sourceUpdatedAt: updateTime ? new Date(updateTime * 1000) : undefined,
      author: {
        role: (author?.role as 'user' | 'assistant' | 'system' | 'tool') || 'user',
        name: author?.name,
      },
      parentUri: convUri,
      threadRootUri: convUri,
      position,
      metadata: {
        originalId: msgId,
        status: msg.status,
        modelSlug: metadata?.model_slug,
        endTurn: msg.end_turn,
        weight: msg.weight,
      },
    };

    // Add media references if present
    const mediaRefs = extractMediaRefs(msg);
    if (mediaRefs.length > 0) {
      msgNode.media = mediaRefs;
    }

    nodes.push(msgNode);
    position++;
  }

  return nodes;
}

/**
 * Extract messages from OpenAI-style mapping tree (DAG linearization)
 */
function extractMessagesFromMapping(
  mapping: Record<string, unknown>
): Array<Record<string, unknown>> {
  const messages: Array<Record<string, unknown>> = [];

  // Find root node (no parent)
  let rootId: string | null = null;
  for (const [nodeId, node] of Object.entries(mapping)) {
    const nodeObj = node as { parent?: string };
    if (!nodeObj.parent) {
      rootId = nodeId;
      break;
    }
  }

  if (!rootId) {
    // Fallback: just iterate all nodes
    for (const node of Object.values(mapping)) {
      const nodeObj = node as { message?: Record<string, unknown> };
      if (nodeObj.message) {
        messages.push(nodeObj.message);
      }
    }
    return messages;
  }

  // BFS traversal from root, following first child (main thread)
  const visited = new Set<string>();
  const queue: string[] = [rootId];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = mapping[nodeId] as {
      message?: Record<string, unknown>;
      children?: string[];
    };

    if (node?.message) {
      messages.push(node.message);
    }

    // Add children to queue (follow main thread first)
    if (node?.children && Array.isArray(node.children)) {
      for (const childId of node.children) {
        if (!visited.has(childId)) {
          queue.push(childId);
        }
      }
    }
  }

  // Sort by create_time if available
  messages.sort((a, b) => {
    const timeA = (a.create_time as number) || 0;
    const timeB = (b.create_time as number) || 0;
    return timeA - timeB;
  });

  return messages;
}

/**
 * Extract text content from a message
 */
function extractTextContent(message: Record<string, unknown>): string {
  const content = message.content as { parts?: unknown[] } | undefined;

  if (!content?.parts) {
    return '';
  }

  const textParts: string[] = [];

  for (const part of content.parts) {
    if (typeof part === 'string') {
      textParts.push(part);
    } else if (typeof part === 'object' && part !== null) {
      // Handle multimodal content
      const partObj = part as { text?: string };
      if (partObj.text) {
        textParts.push(partObj.text);
      }
    }
  }

  return textParts.join('\n');
}

/**
 * Extract media references from a message
 */
function extractMediaRefs(message: Record<string, unknown>): MediaReference[] {
  const refs: MediaReference[] = [];
  const content = message.content as { parts?: unknown[] } | undefined;
  const metadata = message.metadata as { attachments?: unknown[] } | undefined;

  // Check content parts for asset_pointers
  if (content?.parts) {
    for (const part of content.parts) {
      if (typeof part === 'object' && part !== null) {
        const partObj = part as {
          asset_pointer?: string;
          content_type?: string;
          size_bytes?: number;
          width?: number;
          height?: number;
        };

        if (partObj.asset_pointer) {
          refs.push({
            id: partObj.asset_pointer,
            type: 'image',
            url: partObj.asset_pointer,
            size: partObj.size_bytes,
            dimensions:
              partObj.width && partObj.height
                ? { width: partObj.width, height: partObj.height }
                : undefined,
          });
        }
      }
    }
  }

  // Check metadata attachments
  if (metadata?.attachments) {
    for (const att of metadata.attachments) {
      const attObj = att as {
        id?: string;
        name?: string;
        mimeType?: string;
        size?: number;
        width?: number;
        height?: number;
      };

      refs.push({
        id: attObj.id || attObj.name || 'unknown',
        type: mimeToMediaType(attObj.mimeType),
        mimeType: attObj.mimeType,
        size: attObj.size,
        dimensions:
          attObj.width && attObj.height
            ? { width: attObj.width, height: attObj.height }
            : undefined,
      });
    }
  }

  return refs;
}

/**
 * Map format to adapter ID
 */
function formatToAdapter(format: ExportFormat): string {
  switch (format) {
    case 'openai':
      return 'chatgpt';
    case 'claude':
      return 'claude';
    case 'facebook':
      return 'facebook';
    case 'chrome-plugin':
      return 'browser-plugin';
    case 'reddit':
      return 'reddit';
    case 'twitter':
      return 'twitter';
    case 'instagram':
      return 'instagram';
    case 'substack':
      return 'substack';
    default:
      return format;
  }
}

/**
 * Map format to source type (can be overridden by conversation._source)
 */
function formatToSourceType(format: ExportFormat, conversation?: { _source?: string }): string {
  // Check for specific plugin source type
  if (conversation?._source?.startsWith('plugin-')) {
    return conversation._source; // e.g., 'plugin-chatgpt', 'plugin-claude', 'plugin-gemini'
  }

  // Check for specific source override
  if (conversation?._source) {
    return conversation._source;
  }

  switch (format) {
    case 'openai':
      return 'chatgpt';
    case 'claude':
      return 'claude';
    case 'facebook':
      return 'facebook';
    case 'chrome-plugin':
      return 'plugin';
    case 'reddit':
      return 'reddit';
    case 'twitter':
      return 'twitter';
    case 'instagram':
      return 'instagram';
    case 'substack':
      return 'substack';
    default:
      return format;
  }
}

/**
 * Map MIME type to media type
 */
function mimeToMediaType(
  mimeType?: string
): 'image' | 'video' | 'audio' | 'document' | 'other' {
  if (!mimeType) return 'other';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('pdf') || mimeType.includes('document')) return 'document';
  return 'other';
}

/**
 * Hash content for deduplication
 */
function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * CLI entry point
 */
export async function runImportCli(): Promise<void> {
  const archivePath = process.argv[2];

  if (!archivePath) {
    console.log(`
Usage: npx tsx import-to-db.ts <archive-path>

Examples:
  npx tsx import-to-db.ts ~/Downloads/openai-export.zip
  npx tsx import-to-db.ts ~/Downloads/extracted-archive/
`);
    process.exit(1);
  }

  console.log(`Importing archive: ${archivePath}`);

  // Import parser dynamically to avoid circular deps
  const { ConversationParser } = await import('./ConversationParser.js');

  const parser = new ConversationParser(true);
  const archive = await parser.parseArchive(archivePath);

  const result = await importArchiveToDb(archive, { verbose: true });

  if (result.status === 'failed') {
    console.error(`\nImport failed: ${result.error}`);
    process.exit(1);
  }

  await closeContentStore();
  console.log('\nDone!');
}

// Run CLI if executed directly
if (process.argv[1]?.endsWith('import-to-db.ts')) {
  runImportCli().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
