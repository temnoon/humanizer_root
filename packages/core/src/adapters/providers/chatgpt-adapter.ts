/**
 * ChatGPT/OpenAI Adapter
 *
 * Parses OpenAI ChatGPT data exports (ZIP or extracted directory).
 *
 * Export structure:
 * - conversations.json (or individual conversation.json files)
 * - Message tree structure with mapping object
 * - Media references via file-service:// and sediment:// URIs
 *
 * Output content types:
 * - chatgpt-conversation
 * - chatgpt-message
 */

import { join } from 'path';
import { BaseAdapter } from '../base-adapter.js';
import type {
  AdapterSource,
  DetectionResult,
  ValidationResult,
  ParseOptions,
  ImportedNode,
  SourceMetadata,
  MediaReference,
  ContentLink,
} from '../types.js';

// ═══════════════════════════════════════════════════════════════════
// TYPES FOR OPENAI EXPORT FORMAT
// ═══════════════════════════════════════════════════════════════════

interface OpenAIConversation {
  id: string;
  title: string;
  create_time: number;
  update_time: number;
  mapping: Record<string, OpenAINode>;
  current_node?: string;
  conversation_id?: string;
  moderation_results?: unknown[];
}

interface OpenAINode {
  id: string;
  message?: OpenAIMessage;
  parent?: string | null;
  children: string[];
}

interface OpenAIMessage {
  id: string;
  author: {
    role: 'user' | 'assistant' | 'system' | 'tool';
    name?: string;
    metadata?: Record<string, unknown>;
  };
  create_time?: number | null;
  update_time?: number | null;
  content?: {
    content_type: string;
    parts?: Array<string | OpenAIContentPart>;
    language?: string;
    text?: string;
  };
  status?: string;
  end_turn?: boolean | null;
  weight?: number;
  metadata?: {
    attachments?: OpenAIAttachment[];
    citations?: unknown[];
    dalle?: OpenAIDalleMetadata;
    gizmo_id?: string;
    model_slug?: string;
    finish_details?: {
      type: string;
      stop?: string;
    };
    [key: string]: unknown;
  };
  recipient?: string;
}

interface OpenAIContentPart {
  content_type?: string;
  asset_pointer?: string;
  size_bytes?: number;
  width?: number;
  height?: number;
  fovea?: unknown;
  metadata?: Record<string, unknown>;
}

interface OpenAIAttachment {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: number;
  fileTokenSize?: number;
}

interface OpenAIDalleMetadata {
  gen_id?: string;
  prompt?: string;
  seed?: number;
  serialization_title?: string;
}

// ═══════════════════════════════════════════════════════════════════
// CHATGPT ADAPTER
// ═══════════════════════════════════════════════════════════════════

export class ChatGPTAdapter extends BaseAdapter {
  readonly id = 'chatgpt';
  readonly name = 'ChatGPT / OpenAI';
  readonly description = 'Import ChatGPT conversation exports from OpenAI';
  readonly version = '1.0.0';
  readonly contentTypes = ['chatgpt-conversation', 'chatgpt-message'];
  readonly supportedExtensions = ['.zip', '.json'];

  // ─────────────────────────────────────────────────────────────────
  // DETECTION
  // ─────────────────────────────────────────────────────────────────

  async detect(source: AdapterSource): Promise<DetectionResult> {
    try {
      const path = source.path;

      // Check for conversations.json (bulk export)
      const conversationsPath = join(path, 'conversations.json');
      if (await this.fileExists(conversationsPath)) {
        // Verify it's OpenAI format
        const sample = await this.readJson<unknown[]>(conversationsPath);
        if (Array.isArray(sample) && sample.length > 0) {
          const first = sample[0] as Record<string, unknown>;
          if ('mapping' in first && 'create_time' in first) {
            return {
              canHandle: true,
              confidence: 0.95,
              format: 'openai-export',
              reason: 'Found conversations.json with OpenAI structure',
            };
          }
        }
      }

      // Check for single conversation.json
      const singlePath = join(path, 'conversation.json');
      if (await this.fileExists(singlePath)) {
        const data = await this.readJson<Record<string, unknown>>(singlePath);
        if ('mapping' in data && 'create_time' in data) {
          return {
            canHandle: true,
            confidence: 0.9,
            format: 'openai-conversation',
            reason: 'Found single conversation.json with OpenAI structure',
          };
        }
      }

      // Check for organized folder structure (YYYY-MM-DD_Title_Index)
      const entries = await this.readDir(path);
      const conversationFolders = entries.filter(e => /^\d{4}-\d{2}-\d{2}_/.test(e));
      if (conversationFolders.length > 0) {
        // Check first folder for conversation.json
        const firstFolder = join(path, conversationFolders[0]);
        if (await this.isDirectory(firstFolder)) {
          const innerConv = join(firstFolder, 'conversation.json');
          if (await this.fileExists(innerConv)) {
            return {
              canHandle: true,
              confidence: 0.9,
              format: 'openai-organized',
              reason: `Found ${conversationFolders.length} organized conversation folders`,
            };
          }
        }
      }

      return {
        canHandle: false,
        confidence: 0,
        reason: 'No OpenAI export structure detected',
      };
    } catch (error) {
      return {
        canHandle: false,
        confidence: 0,
        reason: `Detection error: ${error}`,
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // VALIDATION
  // ─────────────────────────────────────────────────────────────────

  async validate(source: AdapterSource): Promise<ValidationResult> {
    const errors: ValidationResult['errors'] = [];
    const warnings: ValidationResult['warnings'] = [];

    const detection = await this.detect(source);
    if (!detection.canHandle) {
      errors.push({
        code: 'INVALID_FORMAT',
        message: 'Not a valid OpenAI export',
        details: { reason: detection.reason },
      });
      return { valid: false, errors, warnings };
    }

    // Check for conversations
    const conversationsPath = join(source.path, 'conversations.json');
    if (await this.fileExists(conversationsPath)) {
      const conversations = await this.readJson<OpenAIConversation[]>(conversationsPath);
      if (!Array.isArray(conversations)) {
        errors.push({
          code: 'INVALID_STRUCTURE',
          message: 'conversations.json is not an array',
          path: conversationsPath,
        });
      } else if (conversations.length === 0) {
        warnings.push({
          code: 'EMPTY_EXPORT',
          message: 'No conversations found in export',
          path: conversationsPath,
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // SOURCE METADATA
  // ─────────────────────────────────────────────────────────────────

  async getSourceMetadata(source: AdapterSource): Promise<SourceMetadata> {
    const detection = await this.detect(source);

    let estimatedCount = 0;
    let earliestDate: Date | undefined;
    let latestDate: Date | undefined;
    const contentTypes = new Set<string>();

    // Load conversations to get counts
    const conversationsPath = join(source.path, 'conversations.json');
    if (await this.fileExists(conversationsPath)) {
      const conversations = await this.readJson<OpenAIConversation[]>(conversationsPath);

      for (const conv of conversations) {
        estimatedCount++; // Count conversation
        contentTypes.add('chatgpt-conversation');

        // Count messages
        if (conv.mapping) {
          const messageCount = Object.values(conv.mapping).filter(
            n => n.message?.content?.parts?.length
          ).length;
          estimatedCount += messageCount;
          if (messageCount > 0) {
            contentTypes.add('chatgpt-message');
          }
        }

        // Track dates
        const createDate = this.parseTimestamp(conv.create_time);
        const updateDate = this.parseTimestamp(conv.update_time);

        if (createDate) {
          if (!earliestDate || createDate < earliestDate) earliestDate = createDate;
          if (!latestDate || createDate > latestDate) latestDate = createDate;
        }
        if (updateDate) {
          if (!latestDate || updateDate > latestDate) latestDate = updateDate;
        }
      }
    }

    return {
      format: detection.format || 'openai-export',
      formatVersion: '1.0',
      estimatedCount,
      dateRange: {
        earliest: earliestDate,
        latest: latestDate,
      },
      contentTypes: Array.from(contentTypes),
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // PARSING
  // ─────────────────────────────────────────────────────────────────

  protected async *parseSource(
    source: AdapterSource,
    options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    const detection = await this.detect(source);

    if (detection.format === 'openai-export' || detection.format === 'openai-conversation') {
      // Parse from conversations.json or single conversation.json
      yield* this.parseConversationsFile(source, options);
    } else if (detection.format === 'openai-organized') {
      // Parse from organized folder structure
      yield* this.parseOrganizedFolders(source, options);
    }
  }

  private async *parseConversationsFile(
    source: AdapterSource,
    _options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    let conversations: OpenAIConversation[];

    const bulkPath = join(source.path, 'conversations.json');
    const singlePath = join(source.path, 'conversation.json');

    if (await this.fileExists(bulkPath)) {
      conversations = await this.readJson<OpenAIConversation[]>(bulkPath);
    } else if (await this.fileExists(singlePath)) {
      const single = await this.readJson<OpenAIConversation>(singlePath);
      conversations = [single];
    } else {
      return;
    }

    this.updateProgress({ total: conversations.length });

    for (const conv of conversations) {
      // Yield conversation node
      yield this.conversationToNode(conv);

      // Yield message nodes
      yield* this.parseMessages(conv);
    }
  }

  private async *parseOrganizedFolders(
    source: AdapterSource,
    _options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    const entries = await this.readDir(source.path);
    const folders = entries.filter(e => /^\d{4}-\d{2}-\d{2}_/.test(e));

    this.updateProgress({ total: folders.length });

    for (const folder of folders) {
      const folderPath = join(source.path, folder);
      const convPath = join(folderPath, 'conversation.json');

      if (await this.fileExists(convPath)) {
        const conv = await this.readJson<OpenAIConversation>(convPath);

        // Yield conversation node
        yield this.conversationToNode(conv);

        // Yield message nodes
        yield* this.parseMessages(conv);
      }
    }
  }

  private *parseMessages(conv: OpenAIConversation): Generator<ImportedNode> {
    if (!conv.mapping) return;

    // Linearize the message tree (DFS from root)
    const linearized = this.linearizeMessages(conv);

    let position = 0;
    for (const { nodeId, node } of linearized) {
      if (!node.message?.content?.parts?.length) continue;

      const message = node.message;
      const content = this.extractContent(message);

      if (!content.trim()) continue;

      const messageNode: ImportedNode = {
        id: message.id || nodeId,
        uri: this.generateUri('message', message.id || nodeId),
        contentHash: this.hashContent(content),
        content,
        format: 'text',
        sourceType: 'chatgpt-message',
        sourceCreatedAt: this.parseTimestamp(message.create_time),
        sourceUpdatedAt: this.parseTimestamp(message.update_time),
        author: {
          role: message.author.role,
          name: message.author.name,
        },
        parentUri: this.generateUri('conversation', conv.id || conv.conversation_id || 'unknown'),
        threadRootUri: this.generateUri('conversation', conv.id || conv.conversation_id || 'unknown'),
        position,
        media: this.extractMedia(message),
        links: this.buildLinks(conv, node),
        metadata: {
          nodeId,
          parentNodeId: node.parent,
          childNodeIds: node.children,
          model: message.metadata?.model_slug,
          gizmoId: message.metadata?.gizmo_id,
          status: message.status,
          endTurn: message.end_turn,
          weight: message.weight,
          contentType: message.content?.content_type,
        },
      };

      yield messageNode;
      position++;
    }
  }

  private conversationToNode(conv: OpenAIConversation): ImportedNode {
    const id = conv.id || conv.conversation_id || `conv-${Date.now()}`;

    // Get first user message for content preview
    const messages = this.linearizeMessages(conv);
    const firstUserMessage = messages.find(
      m => m.node.message?.author.role === 'user'
    );
    const preview = firstUserMessage
      ? this.extractContent(firstUserMessage.node.message!).substring(0, 500)
      : '';

    return {
      id,
      uri: this.generateUri('conversation', id),
      contentHash: this.hashContent(conv.title + preview),
      content: conv.title || 'Untitled Conversation',
      format: 'text',
      sourceType: 'chatgpt-conversation',
      sourceCreatedAt: this.parseTimestamp(conv.create_time),
      sourceUpdatedAt: this.parseTimestamp(conv.update_time),
      metadata: {
        title: conv.title,
        messageCount: messages.length,
        currentNode: conv.current_node,
        moderationResults: conv.moderation_results,
      },
    };
  }

  private linearizeMessages(conv: OpenAIConversation): Array<{ nodeId: string; node: OpenAINode }> {
    const result: Array<{ nodeId: string; node: OpenAINode }> = [];
    const visited = new Set<string>();

    // Find root node (no parent or parent is null)
    const rootId = Object.keys(conv.mapping).find(
      id => !conv.mapping[id].parent
    );

    if (!rootId) return result;

    // DFS traversal
    const stack: string[] = [rootId];

    while (stack.length > 0) {
      const nodeId = stack.pop()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const node = conv.mapping[nodeId];
      if (node) {
        result.push({ nodeId, node });

        // Add children in reverse order so they're processed in order
        for (let i = node.children.length - 1; i >= 0; i--) {
          stack.push(node.children[i]);
        }
      }
    }

    return result;
  }

  private extractContent(message: OpenAIMessage): string {
    if (!message.content?.parts) return '';

    const parts: string[] = [];

    for (const part of message.content.parts) {
      if (typeof part === 'string') {
        parts.push(part);
      } else if (part.content_type === 'text' && 'text' in part) {
        parts.push(String(part.text));
      }
      // Skip image/asset parts - they're handled in extractMedia
    }

    return parts.join('\n');
  }

  private extractMedia(message: OpenAIMessage): MediaReference[] {
    const media: MediaReference[] = [];

    // Check content parts for asset pointers
    if (message.content?.parts) {
      for (const part of message.content.parts) {
        if (typeof part !== 'string' && part.asset_pointer) {
          media.push({
            id: part.asset_pointer,
            type: 'image',
            url: part.asset_pointer,
            size: part.size_bytes,
            dimensions: part.width && part.height
              ? { width: part.width, height: part.height }
              : undefined,
            metadata: {
              contentType: part.content_type,
              fovea: part.fovea,
            },
          });
        }
      }
    }

    // Check attachments
    if (message.metadata?.attachments) {
      for (const attachment of message.metadata.attachments) {
        media.push({
          id: attachment.id || `attachment-${media.length}`,
          type: this.classifyMimeType(attachment.mimeType),
          mimeType: attachment.mimeType,
          size: attachment.size,
          alt: attachment.name,
          metadata: {
            fileTokenSize: attachment.fileTokenSize,
          },
        });
      }
    }

    // Check DALL-E metadata
    if (message.metadata?.dalle) {
      media.push({
        id: message.metadata.dalle.gen_id || `dalle-${media.length}`,
        type: 'image',
        metadata: {
          prompt: message.metadata.dalle.prompt,
          seed: message.metadata.dalle.seed,
          title: message.metadata.dalle.serialization_title,
        },
      });
    }

    return media;
  }

  private buildLinks(conv: OpenAIConversation, node: OpenAINode): ContentLink[] {
    const links: ContentLink[] = [];
    const convUri = this.generateUri('conversation', conv.id || conv.conversation_id || 'unknown');

    // Link to conversation
    links.push({
      type: 'parent',
      targetUri: convUri,
    });

    // Link to parent message
    if (node.parent && conv.mapping[node.parent]?.message) {
      links.push({
        type: 'follows',
        targetUri: this.generateUri('message', conv.mapping[node.parent].message!.id || node.parent),
      });
    }

    return links;
  }

  private classifyMimeType(mimeType?: string): MediaReference['type'] {
    if (!mimeType) return 'other';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.includes('pdf') || mimeType.includes('document')) return 'document';
    return 'other';
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════

export const chatgptAdapter = new ChatGPTAdapter();
