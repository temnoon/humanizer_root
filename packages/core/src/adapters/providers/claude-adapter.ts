/**
 * Claude Adapter
 *
 * Parses Anthropic Claude conversation exports.
 *
 * Export structure:
 * - conversations.json - Array of conversations with chat_messages
 * - users.json - User information
 *
 * Output content types:
 * - claude-conversation
 * - claude-message
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
// TYPES FOR CLAUDE EXPORT FORMAT
// ═══════════════════════════════════════════════════════════════════

interface ClaudeConversation {
  uuid: string;
  name: string;
  created_at: string;
  updated_at: string;
  chat_messages: ClaudeMessage[];
  project?: {
    uuid: string;
    name: string;
  };
}

interface ClaudeMessage {
  uuid: string;
  text: string;
  sender: 'human' | 'assistant';
  created_at: string;
  updated_at: string;
  attachments?: ClaudeAttachment[];
  files?: ClaudeFile[];
}

interface ClaudeAttachment {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  extracted_content?: string;
}

interface ClaudeFile {
  file_uuid: string;
  file_name: string;
}

interface ClaudeUser {
  uuid: string;
  email_address: string;
  full_name?: string;
}

// ═══════════════════════════════════════════════════════════════════
// CLAUDE ADAPTER
// ═══════════════════════════════════════════════════════════════════

export class ClaudeAdapter extends BaseAdapter {
  readonly id = 'claude';
  readonly name = 'Claude / Anthropic';
  readonly description = 'Import Claude conversation exports from Anthropic';
  readonly version = '1.0.0';
  readonly contentTypes = ['claude-conversation', 'claude-message'];
  readonly supportedExtensions = ['.zip', '.json'];

  // ─────────────────────────────────────────────────────────────────
  // DETECTION
  // ─────────────────────────────────────────────────────────────────

  async detect(source: AdapterSource): Promise<DetectionResult> {
    try {
      const path = source.path;

      // Check for conversations.json AND users.json (Claude-specific combo)
      const conversationsPath = join(path, 'conversations.json');
      const usersPath = join(path, 'users.json');

      const hasConversations = await this.fileExists(conversationsPath);
      const hasUsers = await this.fileExists(usersPath);

      if (hasConversations && hasUsers) {
        // Verify Claude format (has uuid, chat_messages)
        const conversations = await this.readJson<ClaudeConversation[]>(conversationsPath);
        if (Array.isArray(conversations) && conversations.length > 0) {
          const first = conversations[0];
          if ('uuid' in first && 'chat_messages' in first) {
            return {
              canHandle: true,
              confidence: 0.95,
              format: 'claude-export',
              reason: 'Found conversations.json with Claude structure and users.json',
            };
          }
        }
      }

      // Check for just conversations.json with Claude structure
      if (hasConversations) {
        const conversations = await this.readJson<ClaudeConversation[]>(conversationsPath);
        if (Array.isArray(conversations) && conversations.length > 0) {
          const first = conversations[0];
          if ('uuid' in first && 'chat_messages' in first && 'sender' in (first.chat_messages?.[0] || {})) {
            return {
              canHandle: true,
              confidence: 0.85,
              format: 'claude-export',
              reason: 'Found conversations.json with Claude message structure',
            };
          }
        }
      }

      return {
        canHandle: false,
        confidence: 0,
        reason: 'No Claude export structure detected',
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
        message: 'Not a valid Claude export',
        details: { reason: detection.reason },
      });
      return { valid: false, errors, warnings };
    }

    const conversationsPath = join(source.path, 'conversations.json');
    const conversations = await this.readJson<ClaudeConversation[]>(conversationsPath);

    if (conversations.length === 0) {
      warnings.push({
        code: 'EMPTY_EXPORT',
        message: 'No conversations found in export',
        path: conversationsPath,
      });
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
    let accountInfo: SourceMetadata['account'] = undefined;

    // Parse users
    const usersPath = join(source.path, 'users.json');
    if (await this.fileExists(usersPath)) {
      try {
        const users = await this.readJson<ClaudeUser[]>(usersPath);
        if (users.length > 0) {
          const user = users[0];
          accountInfo = {
            id: user.uuid,
            email: user.email_address,
            name: user.full_name,
          };
        }
      } catch {
        // Ignore
      }
    }

    // Parse conversations
    const conversationsPath = join(source.path, 'conversations.json');
    if (await this.fileExists(conversationsPath)) {
      const conversations = await this.readJson<ClaudeConversation[]>(conversationsPath);

      for (const conv of conversations) {
        estimatedCount++; // Conversation node
        contentTypes.add('claude-conversation');

        if (conv.chat_messages) {
          estimatedCount += conv.chat_messages.length;
          contentTypes.add('claude-message');
        }

        const createDate = this.parseTimestamp(conv.created_at);
        const updateDate = this.parseTimestamp(conv.updated_at);

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
      format: detection.format || 'claude-export',
      formatVersion: '1.0',
      estimatedCount,
      dateRange: {
        earliest: earliestDate,
        latest: latestDate,
      },
      contentTypes: Array.from(contentTypes),
      account: accountInfo,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // PARSING
  // ─────────────────────────────────────────────────────────────────

  protected async *parseSource(
    source: AdapterSource,
    _options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    const conversationsPath = join(source.path, 'conversations.json');
    const conversations = await this.readJson<ClaudeConversation[]>(conversationsPath);

    this.updateProgress({ total: conversations.length });

    for (const conv of conversations) {
      // Yield conversation node
      yield this.conversationToNode(conv);

      // Yield message nodes
      yield* this.parseMessages(conv);
    }
  }

  private *parseMessages(conv: ClaudeConversation): Generator<ImportedNode> {
    if (!conv.chat_messages) return;

    let position = 0;
    let previousUri: string | undefined;

    for (const msg of conv.chat_messages) {
      const msgNode = this.messageToNode(msg, conv, position, previousUri);
      yield msgNode;
      previousUri = msgNode.uri;
      position++;
    }
  }

  private conversationToNode(conv: ClaudeConversation): ImportedNode {
    const messageCount = conv.chat_messages?.length || 0;
    const firstMessage = conv.chat_messages?.[0];
    const preview = firstMessage?.text?.substring(0, 500) || '';

    return {
      id: conv.uuid,
      uri: this.generateUri('conversation', conv.uuid),
      contentHash: this.hashContent(conv.name + preview),
      content: conv.name || 'Untitled Conversation',
      format: 'text',
      sourceType: 'claude-conversation',
      sourceCreatedAt: this.parseTimestamp(conv.created_at),
      sourceUpdatedAt: this.parseTimestamp(conv.updated_at),
      metadata: {
        title: conv.name,
        messageCount,
        project: conv.project,
      },
    };
  }

  private messageToNode(
    msg: ClaudeMessage,
    conv: ClaudeConversation,
    position: number,
    previousUri?: string
  ): ImportedNode {
    const conversationUri = this.generateUri('conversation', conv.uuid);

    const links: ContentLink[] = [
      { type: 'parent', targetUri: conversationUri },
    ];

    if (previousUri) {
      links.push({ type: 'follows', targetUri: previousUri });
    }

    return {
      id: msg.uuid,
      uri: this.generateUri('message', msg.uuid),
      contentHash: this.hashContent(msg.text),
      content: msg.text,
      format: 'text',
      sourceType: 'claude-message',
      sourceCreatedAt: this.parseTimestamp(msg.created_at),
      sourceUpdatedAt: this.parseTimestamp(msg.updated_at),
      author: {
        role: msg.sender === 'human' ? 'user' : 'assistant',
      },
      parentUri: conversationUri,
      threadRootUri: conversationUri,
      position,
      media: this.extractMedia(msg),
      links,
      metadata: {
        sender: msg.sender,
        attachments: msg.attachments,
        files: msg.files,
      },
    };
  }

  private extractMedia(msg: ClaudeMessage): MediaReference[] {
    const media: MediaReference[] = [];

    if (msg.attachments) {
      for (const att of msg.attachments) {
        media.push({
          id: att.id,
          type: this.classifyMimeType(att.file_type),
          mimeType: att.file_type,
          size: att.file_size,
          alt: att.file_name,
          metadata: {
            extractedContent: att.extracted_content,
          },
        });
      }
    }

    if (msg.files) {
      for (const file of msg.files) {
        media.push({
          id: file.file_uuid,
          type: 'document',
          alt: file.file_name,
        });
      }
    }

    return media;
  }

  private classifyMimeType(mimeType?: string): MediaReference['type'] {
    if (!mimeType) return 'other';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) {
      return 'document';
    }
    return 'other';
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════

export const claudeAdapter = new ClaudeAdapter();
