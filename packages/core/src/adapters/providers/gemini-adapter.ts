/**
 * Gemini/Google AI Adapter
 *
 * Parses Gemini conversation exports (downloaded from Gemini web interface).
 *
 * Export structure:
 * - conversation.json - Conversation with messages
 * - media/ - Images (user uploaded and model generated)
 *
 * The Gemini export format is simple:
 * {
 *   "title": "Conversation title",
 *   "source": "Gemini",
 *   "messages": [...],
 *   "media": [...]
 * }
 *
 * Output content types:
 * - gemini-conversation
 * - gemini-message
 */

import { join, dirname, basename } from 'path';
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
// TYPES FOR GEMINI EXPORT FORMAT
// ═══════════════════════════════════════════════════════════════════

interface GeminiConversation {
  title: string;
  source: string;
  messages: GeminiMessage[];
  media?: GeminiMedia[];
}

interface GeminiMessage {
  id: string;
  role: 'user' | 'model';
  content: {
    parts: GeminiPart[];
  };
  timestamp: number;
}

interface GeminiPart {
  text?: string;
}

interface GeminiMedia {
  url: string;
  filename: string;
}

// ═══════════════════════════════════════════════════════════════════
// GEMINI ADAPTER
// ═══════════════════════════════════════════════════════════════════

export class GeminiAdapter extends BaseAdapter {
  readonly id = 'gemini';
  readonly name = 'Gemini / Google AI';
  readonly description = 'Import Gemini conversation exports from Google';
  readonly version = '1.0.0';
  readonly contentTypes = ['gemini-conversation', 'gemini-message'];
  readonly supportedExtensions = ['.zip', '.json'];

  // ─────────────────────────────────────────────────────────────────
  // DETECTION
  // ─────────────────────────────────────────────────────────────────

  async detect(source: AdapterSource): Promise<DetectionResult> {
    try {
      const path = source.path;

      // Check for conversation.json in directory
      const conversationPath = join(path, 'conversation.json');
      if (await this.fileExists(conversationPath)) {
        try {
          const conv = await this.readJson<GeminiConversation>(conversationPath);

          // Verify it's a Gemini export
          if (conv.source === 'Gemini') {
            return {
              canHandle: true,
              confidence: 0.95,
              format: 'gemini-export',
              reason: 'Found conversation.json with source: Gemini',
            };
          }

          // Check for Gemini-specific message structure
          if (conv.messages && Array.isArray(conv.messages)) {
            const hasGeminiStructure = conv.messages.some(
              (m) => m.role === 'model' && m.content?.parts
            );
            if (hasGeminiStructure) {
              return {
                canHandle: true,
                confidence: 0.85,
                format: 'gemini-export',
                reason: 'Found conversation.json with Gemini message structure',
              };
            }
          }
        } catch {
          // Invalid JSON, not a Gemini export
        }
      }

      // Check for multiple conversation folders (bulk export)
      const entries = await this.readDir(path).catch(() => []);
      const geminiLikeFolders: string[] = [];

      for (const entry of entries) {
        const entryPath = join(path, entry);
        if (await this.isDirectory(entryPath)) {
          const innerConv = join(entryPath, 'conversation.json');
          if (await this.fileExists(innerConv)) {
            try {
              const conv = await this.readJson<GeminiConversation>(innerConv);
              if (conv.source === 'Gemini' || (conv.messages && conv.messages[0]?.role)) {
                geminiLikeFolders.push(entry);
              }
            } catch {
              // Continue checking other folders
            }
          }
        }
      }

      if (geminiLikeFolders.length > 0) {
        return {
          canHandle: true,
          confidence: 0.9,
          format: 'gemini-bulk-export',
          reason: `Found ${geminiLikeFolders.length} Gemini conversation folders`,
          metadata: { conversationCount: geminiLikeFolders.length },
        };
      }

      // Check if source.path is a conversation.json file directly
      if (source.type === 'file' && path.endsWith('conversation.json')) {
        try {
          const conv = await this.readJson<GeminiConversation>(path);
          if (conv.source === 'Gemini' || (conv.messages && conv.messages[0]?.content?.parts)) {
            return {
              canHandle: true,
              confidence: 0.9,
              format: 'gemini-export',
              reason: 'File is a Gemini conversation.json',
            };
          }
        } catch {
          // Invalid JSON
        }
      }

      return {
        canHandle: false,
        confidence: 0,
        reason: 'No Gemini export structure detected',
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
        message: 'Not a valid Gemini export',
        details: { reason: detection.reason },
      });
      return { valid: false, errors, warnings };
    }

    // Verify conversation has messages
    const conversationPath = join(source.path, 'conversation.json');
    if (await this.fileExists(conversationPath)) {
      try {
        const conv = await this.readJson<GeminiConversation>(conversationPath);
        if (!conv.messages || conv.messages.length === 0) {
          warnings.push({
            code: 'EMPTY_CONVERSATION',
            message: 'Conversation has no messages',
            path: conversationPath,
          });
        }
      } catch (error) {
        errors.push({
          code: 'PARSE_ERROR',
          message: `Failed to parse conversation.json: ${error}`,
          path: conversationPath,
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

    if (detection.format === 'gemini-bulk-export') {
      // Count conversations in bulk export
      const entries = await this.readDir(source.path).catch(() => []);
      for (const entry of entries) {
        const convPath = join(source.path, entry, 'conversation.json');
        if (await this.fileExists(convPath)) {
          try {
            const conv = await this.readJson<GeminiConversation>(convPath);
            estimatedCount++; // conversation
            estimatedCount += conv.messages?.length || 0;
            contentTypes.add('gemini-conversation');
            if (conv.messages?.length) {
              contentTypes.add('gemini-message');
            }

            for (const msg of conv.messages || []) {
              const date = this.parseTimestamp(msg.timestamp);
              if (date) {
                if (!earliestDate || date < earliestDate) earliestDate = date;
                if (!latestDate || date > latestDate) latestDate = date;
              }
            }
          } catch {
            // Continue with other folders
          }
        }
      }
    } else {
      // Single conversation
      const conversationPath = join(source.path, 'conversation.json');
      if (await this.fileExists(conversationPath)) {
        try {
          const conv = await this.readJson<GeminiConversation>(conversationPath);
          estimatedCount = 1 + (conv.messages?.length || 0);
          contentTypes.add('gemini-conversation');
          if (conv.messages?.length) {
            contentTypes.add('gemini-message');
          }

          for (const msg of conv.messages || []) {
            const date = this.parseTimestamp(msg.timestamp);
            if (date) {
              if (!earliestDate || date < earliestDate) earliestDate = date;
              if (!latestDate || date > latestDate) latestDate = date;
            }
          }
        } catch {
          // Ignore
        }
      }
    }

    return {
      format: detection.format || 'gemini-export',
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

    if (detection.format === 'gemini-bulk-export') {
      yield* this.parseBulkExport(source, options);
    } else {
      yield* this.parseSingleConversation(source, options);
    }
  }

  private async *parseBulkExport(
    source: AdapterSource,
    options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    const entries = await this.readDir(source.path).catch(() => []);

    for (const entry of entries) {
      const folderPath = join(source.path, entry);
      if (!(await this.isDirectory(folderPath))) continue;

      const convPath = join(folderPath, 'conversation.json');
      if (!(await this.fileExists(convPath))) continue;

      try {
        const conv = await this.readJson<GeminiConversation>(convPath);
        yield* this.parseConversation(conv, folderPath, entry);
      } catch (error) {
        this.log('warn', `Failed to parse conversation in ${entry}`, error);
      }
    }
  }

  private async *parseSingleConversation(
    source: AdapterSource,
    options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    const conversationPath = join(source.path, 'conversation.json');
    if (!(await this.fileExists(conversationPath))) return;

    try {
      const conv = await this.readJson<GeminiConversation>(conversationPath);
      const folderId = basename(source.path);
      yield* this.parseConversation(conv, source.path, folderId);
    } catch (error) {
      this.log('error', `Failed to parse conversation`, error);
    }
  }

  private *parseConversation(
    conv: GeminiConversation,
    folderPath: string,
    folderId: string
  ): Generator<ImportedNode> {
    // Create media lookup map
    const mediaMap = new Map<string, GeminiMedia>();
    for (const m of conv.media || []) {
      mediaMap.set(m.filename, m);
    }

    // Yield conversation node
    yield this.conversationToNode(conv, folderId);

    // Yield message nodes
    let position = 0;
    for (const message of conv.messages || []) {
      const node = this.messageToNode(message, conv, folderId, folderPath, mediaMap, position);
      if (node) {
        yield node;
        position++;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // CONVERTERS
  // ─────────────────────────────────────────────────────────────────

  private conversationToNode(conv: GeminiConversation, folderId: string): ImportedNode {
    const id = `conversation-${folderId}`;

    // Find date range from messages
    let earliestDate: Date | undefined;
    let latestDate: Date | undefined;
    for (const msg of conv.messages || []) {
      const date = this.parseTimestamp(msg.timestamp);
      if (date) {
        if (!earliestDate || date < earliestDate) earliestDate = date;
        if (!latestDate || date > latestDate) latestDate = date;
      }
    }

    return {
      id,
      uri: this.generateUri('conversation', folderId),
      contentHash: this.hashContent(conv.title),
      content: conv.title,
      format: 'text',
      sourceType: 'gemini-conversation',
      sourceCreatedAt: earliestDate,
      sourceUpdatedAt: latestDate,
      metadata: {
        title: conv.title,
        source: conv.source,
        messageCount: conv.messages?.length || 0,
        mediaCount: conv.media?.length || 0,
      },
    };
  }

  private messageToNode(
    msg: GeminiMessage,
    conv: GeminiConversation,
    folderId: string,
    folderPath: string,
    mediaMap: Map<string, GeminiMedia>,
    position: number
  ): ImportedNode | null {
    // Extract text content and media references from parts
    const textParts: string[] = [];
    const media: MediaReference[] = [];

    for (const part of msg.content?.parts || []) {
      if (part.text) {
        // Check if this is an image reference like "[Image: media/filename.jpg]"
        const imageMatch = part.text.match(/^\[Image:\s*(.+)\]$/);
        if (imageMatch) {
          const imagePath = imageMatch[1];
          const filename = basename(imagePath);
          const mediaInfo = mediaMap.get(filename);

          media.push({
            id: `media-${msg.id}-${media.length}`,
            type: 'image',
            localPath: join(folderPath, imagePath),
            url: mediaInfo?.url,
            metadata: {
              filename,
              originalUrl: mediaInfo?.url,
            },
          });
        } else {
          textParts.push(part.text);
        }
      }
    }

    const content = textParts.join('\n').trim();

    // Skip empty messages
    if (!content && media.length === 0) {
      return null;
    }

    const id = msg.id;
    const timestamp = this.parseTimestamp(msg.timestamp);

    const links: ContentLink[] = [
      {
        type: 'parent',
        targetUri: this.generateUri('conversation', folderId),
      },
    ];

    return {
      id,
      uri: this.generateUri('message', id),
      contentHash: this.hashContent(content || `media-${msg.id}`),
      content: content || '[Media]',
      format: 'text',
      sourceType: 'gemini-message',
      sourceCreatedAt: timestamp,
      author: {
        role: msg.role === 'model' ? 'assistant' : 'user',
      },
      parentUri: this.generateUri('conversation', folderId),
      threadRootUri: this.generateUri('conversation', folderId),
      position,
      media: media.length > 0 ? media : undefined,
      links,
      metadata: {
        messageId: msg.id,
        role: msg.role,
        conversationTitle: conv.title,
      },
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════

export const geminiAdapter = new GeminiAdapter();
