/**
 * Discord Adapter
 *
 * Parses Discord data exports (Settings > Privacy & Safety > Request all of my Data).
 *
 * Export structure:
 * - messages/c{channel_id}/messages.csv - Channel messages
 * - messages/c{channel_id}/channel.json - Channel metadata
 * - account/user.json - Account information
 * - servers/index.json - Server list
 * - activity/ - Activity logs
 *
 * Output content types:
 * - discord-message
 * - discord-dm
 * - discord-group-dm
 * - discord-server-message
 */

import { join, basename, dirname } from 'path';
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
// TYPES FOR DISCORD EXPORT FORMAT
// ═══════════════════════════════════════════════════════════════════

interface DiscordUser {
  id: string;
  username: string;
  discriminator?: string;
  email?: string;
  global_name?: string;
}

interface DiscordChannel {
  id: string;
  type: number; // 0=text, 1=DM, 3=group DM
  name?: string;
  recipients?: string[];
  guild?: {
    id: string;
    name: string;
  };
}

interface DiscordMessage {
  ID: string;
  Timestamp: string;
  Contents: string;
  Attachments: string;
}

interface DiscordServer {
  id: string;
  name: string;
}

// Channel types
const CHANNEL_TYPE_TEXT = 0;
const CHANNEL_TYPE_DM = 1;
const CHANNEL_TYPE_GROUP_DM = 3;

// ═══════════════════════════════════════════════════════════════════
// DISCORD ADAPTER
// ═══════════════════════════════════════════════════════════════════

export class DiscordAdapter extends BaseAdapter {
  readonly id = 'discord';
  readonly name = 'Discord';
  readonly description = 'Import Discord data exports';
  readonly version = '1.0.0';
  readonly contentTypes = [
    'discord-message',
    'discord-dm',
    'discord-group-dm',
    'discord-server-message',
  ];
  readonly supportedExtensions = ['.zip', '.csv', '.json'];

  // ─────────────────────────────────────────────────────────────────
  // DETECTION
  // ─────────────────────────────────────────────────────────────────

  async detect(source: AdapterSource): Promise<DetectionResult> {
    try {
      const path = source.path;

      // Check for Discord-specific folder structure
      const messagesDir = join(path, 'messages');
      const accountDir = join(path, 'account');
      const serversDir = join(path, 'servers');
      const activityDir = join(path, 'activity');

      const hasMessages = await this.isDirectory(messagesDir);
      const hasAccount = await this.isDirectory(accountDir);
      const hasServers = await this.isDirectory(serversDir);
      const hasActivity = await this.isDirectory(activityDir);

      // Check for user.json in account folder
      const userJson = join(accountDir, 'user.json');
      const hasUserJson = await this.fileExists(userJson);

      if (hasMessages && hasUserJson) {
        return {
          canHandle: true,
          confidence: 0.95,
          format: 'discord-export',
          reason: 'Found messages/ and account/user.json',
        };
      }

      if (hasMessages && (hasServers || hasActivity)) {
        return {
          canHandle: true,
          confidence: 0.85,
          format: 'discord-export',
          reason: 'Found Discord export structure',
        };
      }

      // Check for messages folder with channel subfolders
      if (hasMessages) {
        const channelFolders = await this.readDir(messagesDir).catch(() => []);
        const discordChannels = channelFolders.filter(f => /^c\d+$/.test(f));

        if (discordChannels.length > 0) {
          // Verify at least one has messages.csv
          for (const channelFolder of discordChannels.slice(0, 3)) {
            const messagesCsv = join(messagesDir, channelFolder, 'messages.csv');
            if (await this.fileExists(messagesCsv)) {
              return {
                canHandle: true,
                confidence: 0.9,
                format: 'discord-export',
                reason: `Found ${discordChannels.length} Discord channel folders`,
              };
            }
          }
        }
      }

      return {
        canHandle: false,
        confidence: 0,
        reason: 'No Discord export structure detected',
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
        message: 'Not a valid Discord export',
        details: { reason: detection.reason },
      });
      return { valid: false, errors, warnings };
    }

    // Check for messages
    const messagesDir = join(source.path, 'messages');
    if (await this.isDirectory(messagesDir)) {
      const channels = await this.readDir(messagesDir).catch(() => []);
      if (channels.length === 0) {
        warnings.push({
          code: 'EMPTY_EXPORT',
          message: 'No message channels found',
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
    let accountInfo: SourceMetadata['account'] = undefined;

    // Get user info
    const userJsonPath = join(source.path, 'account', 'user.json');
    if (await this.fileExists(userJsonPath)) {
      try {
        const user = await this.readJson<DiscordUser>(userJsonPath);
        accountInfo = {
          id: user.id,
          name: user.global_name || user.username,
          handle: user.discriminator
            ? `${user.username}#${user.discriminator}`
            : user.username,
          email: user.email,
        };
      } catch {
        // Ignore
      }
    }

    // Count messages from channel folders
    const messagesDir = join(source.path, 'messages');
    if (await this.isDirectory(messagesDir)) {
      const channelFolders = await this.readDir(messagesDir).catch(() => []);

      for (const folder of channelFolders) {
        if (!/^c\d+$/.test(folder)) continue;

        const messagesCsv = join(messagesDir, folder, 'messages.csv');
        if (await this.fileExists(messagesCsv)) {
          const content = await this.readFile(messagesCsv);
          const lines = content.split('\n').filter(l => l.trim());
          estimatedCount += Math.max(0, lines.length - 1); // Subtract header
          contentTypes.add('discord-message');
        }
      }
    }

    return {
      format: detection.format || 'discord-export',
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
    options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    const messagesDir = join(source.path, 'messages');
    if (!(await this.isDirectory(messagesDir))) return;

    const channelFolders = await this.readDir(messagesDir).catch(() => []);

    for (const folder of channelFolders) {
      if (!/^c\d+$/.test(folder)) continue;

      const channelPath = join(messagesDir, folder);
      yield* this.parseChannel(channelPath, folder);
    }
  }

  private async *parseChannel(
    channelPath: string,
    folderId: string
  ): AsyncGenerator<ImportedNode, void, undefined> {
    // Get channel metadata
    let channel: DiscordChannel | null = null;
    const channelJsonPath = join(channelPath, 'channel.json');
    if (await this.fileExists(channelJsonPath)) {
      try {
        channel = await this.readJson<DiscordChannel>(channelJsonPath);
      } catch {
        // Continue without metadata
      }
    }

    // Parse messages.csv
    const messagesCsvPath = join(channelPath, 'messages.csv');
    if (!(await this.fileExists(messagesCsvPath))) return;

    try {
      const content = await this.readFile(messagesCsvPath);
      const messages = this.parseDiscordCsv(content);

      // Determine content type based on channel type
      let sourceType = 'discord-message';
      if (channel) {
        if (channel.type === CHANNEL_TYPE_DM) {
          sourceType = 'discord-dm';
        } else if (channel.type === CHANNEL_TYPE_GROUP_DM) {
          sourceType = 'discord-group-dm';
        } else if (channel.guild) {
          sourceType = 'discord-server-message';
        }
      }

      let position = 0;
      for (const msg of messages) {
        const node = this.messageToNode(msg, channel, folderId, sourceType, position);
        if (node) {
          yield node;
          position++;
        }
      }
    } catch (error) {
      this.log('warn', `Failed to parse messages in ${folderId}`, error);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // CONVERTERS
  // ─────────────────────────────────────────────────────────────────

  private messageToNode(
    msg: DiscordMessage,
    channel: DiscordChannel | null,
    folderId: string,
    sourceType: string,
    position: number
  ): ImportedNode | null {
    // Skip empty messages
    if (!msg.Contents && !msg.Attachments) {
      return null;
    }

    const id = msg.ID || `${folderId}-${position}`;
    const timestamp = this.parseDiscordTimestamp(msg.Timestamp);
    const content = msg.Contents || '';

    // Extract attachments
    const media: MediaReference[] = [];
    if (msg.Attachments) {
      // Attachments are space-separated URLs
      const attachmentUrls = msg.Attachments.split(' ').filter(Boolean);
      for (let i = 0; i < attachmentUrls.length; i++) {
        media.push({
          id: `attachment-${id}-${i}`,
          type: this.classifyUrl(attachmentUrls[i]),
          url: attachmentUrls[i],
        });
      }
    }

    const links: ContentLink[] = [
      {
        type: 'parent',
        targetUri: this.generateUri('channel', folderId),
      },
    ];

    return {
      id,
      uri: this.generateUri('message', id),
      contentHash: this.hashContent(`${id}:${content}`),
      content: content || '[Attachment]',
      format: 'text',
      sourceType,
      sourceCreatedAt: timestamp,
      parentUri: this.generateUri('channel', folderId),
      threadRootUri: this.generateUri('channel', folderId),
      position,
      media: media.length > 0 ? media : undefined,
      links,
      metadata: {
        messageId: msg.ID,
        channelId: channel?.id || folderId.replace('c', ''),
        channelName: channel?.name,
        channelType: channel?.type,
        guildId: channel?.guild?.id,
        guildName: channel?.guild?.name,
        recipients: channel?.recipients,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Parse Discord's CSV format
   *
   * Header: ID,Timestamp,Contents,Attachments
   */
  private parseDiscordCsv(content: string): DiscordMessage[] {
    const messages: DiscordMessage[] = [];
    const lines = content.split('\n');

    if (lines.length < 2) return messages;

    // Skip header
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parsed = this.parseCsvLine(line);
      if (parsed.length >= 2) {
        messages.push({
          ID: parsed[0] || '',
          Timestamp: parsed[1] || '',
          Contents: parsed[2] || '',
          Attachments: parsed[3] || '',
        });
      }
    }

    return messages;
  }

  /**
   * Parse a single CSV line, handling quoted fields
   */
  private parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    fields.push(current);
    return fields;
  }

  /**
   * Parse Discord timestamp format
   */
  private parseDiscordTimestamp(timestamp: string): Date | undefined {
    if (!timestamp) return undefined;
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? undefined : date;
  }

  /**
   * Classify attachment URL by type
   */
  private classifyUrl(url: string): MediaReference['type'] {
    const lower = url.toLowerCase();
    if (/\.(jpg|jpeg|png|gif|webp)/.test(lower)) return 'image';
    if (/\.(mp4|mov|webm|avi)/.test(lower)) return 'video';
    if (/\.(mp3|wav|ogg|m4a)/.test(lower)) return 'audio';
    return 'other';
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════

export const discordAdapter = new DiscordAdapter();
