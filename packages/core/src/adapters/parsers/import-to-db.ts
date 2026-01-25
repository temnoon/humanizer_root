/**
 * Import Parsed Archives to PostgreSQL Database
 *
 * Converts parsed Conversations from the parser into ImportedNode format
 * and stores them in the PostgreSQL content_nodes table.
 * Also stores relationship data (friends, advertisers, etc.) for Facebook exports.
 */

import * as crypto from 'crypto';
import type {
  Conversation,
  ParsedArchive,
  ParsedArchiveWithRelationships,
  ExportFormat,
  RelationshipData,
} from './types.js';
import type { ImportedNode, MediaReference, ContentLink } from '../types.js';
import {
  initContentStore,
  getContentStore,
  closeContentStore,
} from '../../storage/postgres-content-store.js';
import type { ImportJob, StoredNode } from '../../storage/types.js';
import {
  getEmbeddingService,
  initEmbeddingService,
  type EmbeddingServiceConfig,
} from '../../embeddings/index.js';
import {
  hashContent as hashContentForDedup,
  hashParagraphs,
  hashLines,
  type ParagraphHash,
  type LineHash,
} from '../../chunking/content-hasher.js';

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
  // Relationship import stats
  relationships?: {
    friendsImported: number;
    advertisersImported: number;
    pagesImported: number;
    reactionsImported: number;
    groupsImported: number;
    groupContentImported: number;
  };
  // Embedding stats
  embeddings?: {
    nodesEmbedded: number;
    pyramidsBuilt: number;
    embeddingModel: string;
    embeddingDurationMs: number;
    ollamaAvailable: boolean;
  };
  // Fine-grained deduplication stats
  dedup?: {
    totalParagraphHashes: number;
    totalLineHashes: number;
    hashingDurationMs: number;
  };
}

/**
 * Convert a parsed archive to ImportedNodes and store in database
 */
export async function importArchiveToDb(
  archive: ParsedArchive | ParsedArchiveWithRelationships,
  options: {
    verbose?: boolean;
    batchSize?: number;
    skipExisting?: boolean;
    /** Generate embeddings using Ollama (default: true) */
    generateEmbeddings?: boolean;
    /** Embedding service configuration */
    embeddingConfig?: EmbeddingServiceConfig;
    /** Generate paragraph/line hashes for fine-grained deduplication (default: true) */
    generateHashes?: boolean;
    /** Include line hashes (can be expensive for large content, default: true) */
    includeLineHashes?: boolean;
  } = {}
): Promise<ImportResult> {
  const {
    verbose = false,
    batchSize = 100,
    skipExisting = true,
    generateEmbeddings = true,
    embeddingConfig,
    generateHashes = true,
    includeLineHashes = true,
  } = options;
  const archiveWithRels = archive as ParsedArchiveWithRelationships;
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

  // Fine-grained dedup stats
  let totalParagraphHashes = 0;
  let totalLineHashes = 0;
  const hashingStartTime = Date.now();

  try {
    // Process conversations in batches
    for (const conversation of archive.conversations) {
      conversationsProcessed++;

      // Convert conversation to nodes
      const nodes = conversationToNodes(conversation, archive.format);

      // Store nodes with optional hash generation
      for (const node of nodes) {
        try {
          if (skipExisting) {
            const existing = await store.getNodeByHash(node.contentHash);
            if (existing) {
              messagesSkipped++;
              continue;
            }
          }

          // Generate fine-grained hashes if enabled
          if (generateHashes && node.content.length > 0) {
            const paragraphHashResult = hashParagraphs(node.content);
            node.paragraphHashes = paragraphHashResult;
            totalParagraphHashes += paragraphHashResult.length;

            if (includeLineHashes) {
              const lineHashResult = hashLines(node.content);
              node.lineHashes = lineHashResult;
              totalLineHashes += lineHashResult.length;
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

    const hashingDurationMs = Date.now() - hashingStartTime;

    // Import relationship data if present
    let relationshipStats: ImportResult['relationships'] | undefined;
    if (archiveWithRels.relationships) {
      log('\nImporting relationship data...');
      relationshipStats = await importRelationships(
        archiveWithRels.relationships,
        job.id,
        verbose
      );
      log(`  Friends: ${relationshipStats.friendsImported}`);
      log(`  Advertisers: ${relationshipStats.advertisersImported}`);
      log(`  Pages: ${relationshipStats.pagesImported}`);
      log(`  Reactions: ${relationshipStats.reactionsImported}`);
      log(`  Groups: ${relationshipStats.groupsImported}`);
      log(`  Group content: ${relationshipStats.groupContentImported}`);
    }

    // Generate embeddings if enabled
    let embeddingStats: ImportResult['embeddings'] | undefined;
    if (generateEmbeddings && messagesImported > 0) {
      log('\nGenerating embeddings...');
      const embeddingStartTime = Date.now();

      // Initialize embedding service
      const embedService = embeddingConfig
        ? initEmbeddingService({ ...embeddingConfig, verbose })
        : getEmbeddingService({ verbose });

      // Check Ollama availability
      const ollamaAvailable = await embedService.isAvailable();
      if (!ollamaAvailable) {
        log('  ⚠ Ollama not available, skipping embeddings');
        embeddingStats = {
          nodesEmbedded: 0,
          pyramidsBuilt: 0,
          embeddingModel: embedService.getEmbedModel(),
          embeddingDurationMs: 0,
          ollamaAvailable: false,
        };
      } else {
        // Get all nodes that need embedding
        const nodesResult = await store.queryNodes({
          importJobId: job.id,
          limit: 10000,
        });

        let nodesEmbedded = 0;
        let pyramidsBuilt = 0;
        let pyramidNodesCreated = 0;

        // Embed nodes with automatic pyramid building for large threads
        const pyramidResult = await embedService.embedNodesWithPyramid(
          nodesResult.nodes,
          formatToSourceType(archive.format)
        );

        pyramidsBuilt = pyramidResult.pyramidsBuilt;

        // Store new pyramid nodes (L0 chunks, L1 summaries, Apex)
        if (pyramidResult.newNodes.length > 0) {
          log(`  Creating ${pyramidResult.newNodes.length} pyramid nodes...`);
          for (const pyramidNode of pyramidResult.newNodes) {
            try {
              // Convert PyramidStoredNode to ImportedNode format
              const importedNode: ImportedNode = {
                id: pyramidNode.id,
                uri: `pyramid://${pyramidNode.threadRootId}/${pyramidNode.hierarchyLevel}/${pyramidNode.id}`,
                contentHash: pyramidNode.contentHash,
                content: pyramidNode.text,
                format: 'text',
                sourceType: pyramidNode.sourceType,
                sourceAdapter: adapterId,
                parentUri: pyramidNode.parentNodeId
                  ? `pyramid://${pyramidNode.threadRootId}/${pyramidNode.hierarchyLevel - 1}/${pyramidNode.parentNodeId}`
                  : undefined,
                threadRootUri: `${archive.format}://${pyramidNode.threadRootId}`,
                position: pyramidNode.position,
                chunkIndex: pyramidNode.chunkIndex,
                chunkStartOffset: pyramidNode.chunkStartOffset,
                chunkEndOffset: pyramidNode.chunkEndOffset,
                hierarchyLevel: pyramidNode.hierarchyLevel,
                metadata: {
                  wordCount: pyramidNode.wordCount,
                  pyramidLevel: pyramidNode.hierarchyLevel,
                },
              };

              await store.storeNode(importedNode, job.id);
              pyramidNodesCreated++;
            } catch (err) {
              if (verbose) {
                console.error(`  Failed to store pyramid node ${pyramidNode.id}:`, err);
              }
            }
          }
          log(`  Created ${pyramidNodesCreated} pyramid nodes`);
        }

        // Store content links for pyramid relationships
        if (pyramidResult.links.length > 0) {
          log(`  Creating ${pyramidResult.links.length} pyramid links...`);
          let linksCreated = 0;
          for (const link of pyramidResult.links) {
            try {
              await store.createLink(link.sourceId, link.targetId, link.linkType);
              linksCreated++;
            } catch (err) {
              // Link may already exist or target doesn't exist
              if (verbose) {
                console.debug(`  Link creation skipped: ${link.sourceId} -> ${link.targetId}`);
              }
            }
          }
          log(`  Created ${linksCreated} pyramid links`);
        }

        // Store embeddings for all nodes (original + pyramid)
        if (pyramidResult.embeddingItems.length > 0) {
          const result = await store.storeEmbeddings(
            pyramidResult.embeddingItems,
            embedService.getEmbedModel()
          );
          nodesEmbedded = result.stored;
          log(`  Embedded ${nodesEmbedded} nodes`);
        }

        embeddingStats = {
          nodesEmbedded,
          pyramidsBuilt,
          embeddingModel: embedService.getEmbedModel(),
          embeddingDurationMs: Date.now() - embeddingStartTime,
          ollamaAvailable: true,
        };

        log(`  ✓ Embeddings complete (${nodesEmbedded} nodes, ${pyramidsBuilt} pyramids, ${(embeddingStats.embeddingDurationMs / 1000).toFixed(1)}s)`);
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
        relationships: relationshipStats,
      },
    });

    const durationMs = Date.now() - startTime;

    log(`\n✓ Import complete in ${(durationMs / 1000).toFixed(1)}s`);
    log(`  Conversations: ${conversationsProcessed}`);
    log(`  Messages imported: ${messagesImported}`);
    log(`  Messages skipped: ${messagesSkipped}`);
    log(`  Messages failed: ${messagesFailed}`);
    log(`  Media refs: ${mediaRefsLinked}`);
    if (relationshipStats) {
      log(`  Relationships: ${relationshipStats.friendsImported} friends, ${relationshipStats.advertisersImported} advertisers, ${relationshipStats.reactionsImported} reactions`);
    }
    if (embeddingStats) {
      log(`  Embeddings: ${embeddingStats.nodesEmbedded} nodes (${embeddingStats.ollamaAvailable ? 'Ollama OK' : 'Ollama unavailable'})`);
    }

    // Dedup stats
    const dedupStats = generateHashes
      ? {
          totalParagraphHashes,
          totalLineHashes,
          hashingDurationMs,
        }
      : undefined;

    if (dedupStats) {
      log(`  Dedup hashes: ${totalParagraphHashes} paragraphs, ${totalLineHashes} lines`);
    }

    return {
      jobId: job.id,
      status: 'completed',
      conversationsProcessed,
      messagesImported,
      messagesSkipped,
      messagesFailed,
      mediaRefsLinked,
      durationMs,
      relationships: relationshipStats,
      embeddings: embeddingStats,
      dedup: dedupStats,
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
 * Import relationship data to database
 */
async function importRelationships(
  relationships: RelationshipData,
  jobId: string,
  verbose: boolean
): Promise<NonNullable<ImportResult['relationships']>> {
  const store = getContentStore();
  const pool = (store as any).pool;

  if (!pool) {
    throw new Error('Database pool not available');
  }

  let friendsImported = 0;
  let advertisersImported = 0;
  let pagesImported = 0;
  let reactionsImported = 0;
  let groupsImported = 0;
  let groupContentImported = 0;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Import friends
    for (const friend of relationships.friends.friends) {
      await client.query(
        `INSERT INTO fb_friends (id, import_job_id, name, friendship_date, status, removed_date)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           friendship_date = COALESCE(EXCLUDED.friendship_date, fb_friends.friendship_date),
           status = EXCLUDED.status`,
        [
          friend.id,
          jobId,
          friend.name,
          friend.friendshipDate > 0 ? new Date(friend.friendshipDate * 1000) : null,
          friend.status,
          friend.removedDate ? new Date(friend.removedDate * 1000) : null,
        ]
      );
      friendsImported++;
    }

    // Import removed friends
    for (const friend of relationships.friends.removed) {
      await client.query(
        `INSERT INTO fb_friends (id, import_job_id, name, friendship_date, status, removed_date)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           removed_date = COALESCE(EXCLUDED.removed_date, fb_friends.removed_date)`,
        [
          friend.id,
          jobId,
          friend.name,
          null,
          'removed',
          friend.removedDate ? new Date(friend.removedDate * 1000) : null,
        ]
      );
      friendsImported++;
    }

    // Import advertisers
    for (const advertiser of relationships.advertisers.advertisers) {
      await client.query(
        `INSERT INTO fb_advertisers (id, import_job_id, name, targeting_type, interaction_count, first_seen, last_seen, is_data_broker)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           interaction_count = fb_advertisers.interaction_count + EXCLUDED.interaction_count,
           first_seen = LEAST(fb_advertisers.first_seen, EXCLUDED.first_seen),
           last_seen = GREATEST(fb_advertisers.last_seen, EXCLUDED.last_seen)`,
        [
          advertiser.id,
          jobId,
          advertiser.name,
          advertiser.targetingType,
          advertiser.interactionCount,
          advertiser.firstSeen ? new Date(advertiser.firstSeen * 1000) : null,
          advertiser.lastSeen ? new Date(advertiser.lastSeen * 1000) : null,
          advertiser.isDataBroker,
        ]
      );
      advertisersImported++;
    }

    // Import pages
    for (const page of relationships.pages.pages) {
      await client.query(
        `INSERT INTO fb_pages (id, import_job_id, name, facebook_id, url, is_liked, liked_at, is_following, followed_at, unfollowed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           is_liked = EXCLUDED.is_liked OR fb_pages.is_liked,
           liked_at = COALESCE(EXCLUDED.liked_at, fb_pages.liked_at),
           is_following = EXCLUDED.is_following OR fb_pages.is_following,
           followed_at = COALESCE(EXCLUDED.followed_at, fb_pages.followed_at),
           unfollowed_at = COALESCE(EXCLUDED.unfollowed_at, fb_pages.unfollowed_at)`,
        [
          page.id,
          jobId,
          page.name,
          page.facebookId || null,
          page.url || null,
          page.isLiked,
          page.likedAt ? new Date(page.likedAt * 1000) : null,
          page.isFollowing,
          page.followedAt ? new Date(page.followedAt * 1000) : null,
          page.unfollowedAt ? new Date(page.unfollowedAt * 1000) : null,
        ]
      );
      pagesImported++;
    }

    // Import reactions (batch for performance)
    const reactionBatchSize = 1000;
    for (let i = 0; i < relationships.reactions.reactions.length; i += reactionBatchSize) {
      const batch = relationships.reactions.reactions.slice(i, i + reactionBatchSize);

      for (const reaction of batch) {
        await client.query(
          `INSERT INTO fb_reactions (id, import_job_id, reaction_type, reactor_name, target_type, target_author, title, reacted_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO NOTHING`,
          [
            reaction.id,
            jobId,
            reaction.reactionType,
            reaction.reactorName,
            reaction.targetType,
            reaction.targetAuthor || null,
            reaction.title || null,
            new Date(reaction.createdAt * 1000),
          ]
        );
        reactionsImported++;
      }

      if (verbose && i > 0 && i % 10000 === 0) {
        console.log(`    Imported ${i}/${relationships.reactions.reactions.length} reactions...`);
      }
    }

    // Import groups
    for (const group of relationships.groups.groups) {
      await client.query(
        `INSERT INTO fb_groups (id, import_job_id, name, joined_at, post_count, comment_count, last_activity)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           joined_at = COALESCE(EXCLUDED.joined_at, fb_groups.joined_at),
           post_count = EXCLUDED.post_count,
           comment_count = EXCLUDED.comment_count,
           last_activity = GREATEST(fb_groups.last_activity, EXCLUDED.last_activity)`,
        [
          group.id,
          jobId,
          group.name,
          group.joinedAt ? new Date(group.joinedAt * 1000) : null,
          group.postCount,
          group.commentCount,
          group.lastActivity ? new Date(group.lastActivity * 1000) : null,
        ]
      );
      groupsImported++;
    }

    // Import group posts
    for (const post of relationships.groups.posts) {
      const groupId = `fb_group_${post.groupName.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 40)}`;
      await client.query(
        `INSERT INTO fb_group_content (id, import_job_id, group_id, content_type, text, author, original_post_author, external_urls, has_attachments, title, posted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO NOTHING`,
        [
          post.id,
          jobId,
          groupId,
          'post',
          post.text,
          null, // author is self for posts
          null,
          JSON.stringify(post.externalUrls),
          post.hasAttachments,
          post.title,
          new Date(post.timestamp * 1000),
        ]
      );
      groupContentImported++;
    }

    // Import group comments
    for (const comment of relationships.groups.comments) {
      const groupId = `fb_group_${comment.groupName.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 40)}`;
      await client.query(
        `INSERT INTO fb_group_content (id, import_job_id, group_id, content_type, text, author, original_post_author, external_urls, has_attachments, title, posted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO NOTHING`,
        [
          comment.id,
          jobId,
          groupId,
          'comment',
          comment.text,
          comment.author,
          comment.originalPostAuthor,
          '[]',
          false,
          comment.title,
          new Date(comment.timestamp * 1000),
        ]
      );
      groupContentImported++;
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return {
    friendsImported,
    advertisersImported,
    pagesImported,
    reactionsImported,
    groupsImported,
    groupContentImported,
  };
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
