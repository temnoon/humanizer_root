/**
 * Google Takeout Adapter
 *
 * Parses Google Takeout exports containing data from various Google services.
 *
 * Supported services:
 * - Google Chat / Hangouts (messages.json)
 * - Google Keep (notes as JSON/HTML)
 * - Google Drive (file metadata, not actual files)
 * - YouTube (watch history, comments, subscriptions)
 * - Google Photos (metadata only)
 *
 * Export structure:
 * Takeout/
 * ├── Google Chat/
 * │   └── Groups/
 * │       └── [Group Name]/
 * │           └── messages.json
 * ├── Google Keep/
 * │   └── [note files].json/.html
 * ├── Drive/
 * │   └── [folders and files]
 * ├── Mail/
 * │   └── All mail Including Spam and Trash.mbox
 * ├── My Activity/
 * │   └── [service]/
 * │       └── MyActivity.json
 * ├── YouTube and YouTube Music/
 * │   └── history/
 * │       └── watch-history.json
 * └── archive_browser.html
 *
 * Output content types:
 * - google-chat-message
 * - google-chat-conversation
 * - google-keep-note
 * - google-drive-file (metadata only)
 * - youtube-watch-history
 * - youtube-comment
 * - google-activity
 */

import { join, basename, extname, dirname, relative } from 'path';
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
// TYPES FOR GOOGLE TAKEOUT EXPORT FORMAT
// ═══════════════════════════════════════════════════════════════════

// Google Chat types
interface GoogleChatMessage {
  creator?: {
    name?: string;
    email?: string;
    user_type?: string;
  };
  created_date?: string;
  text?: string;
  topic_id?: string;
  message_id?: string;
  attached_files?: Array<{
    export_name?: string;
    original_name?: string;
  }>;
  annotations?: Array<{
    type?: string;
    chip_render_type?: string;
    url_metadata?: {
      url?: {
        private_do_not_access_or_else_safe_url_wrapped_value?: string;
      };
      title?: string;
      snippet?: string;
    };
  }>;
}

interface GoogleChatConversation {
  messages: GoogleChatMessage[];
}

// Google Keep types
interface GoogleKeepNote {
  title?: string;
  textContent?: string;
  listContent?: Array<{
    text?: string;
    isChecked?: boolean;
  }>;
  labels?: Array<{ name?: string }>;
  color?: string;
  isTrashed?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
  userEditedTimestampUsec?: number;
  createdTimestampUsec?: number;
  attachments?: Array<{
    filePath?: string;
    mimetype?: string;
  }>;
}

// YouTube types
interface YouTubeWatchHistoryItem {
  header?: string;
  title?: string;
  titleUrl?: string;
  subtitles?: Array<{
    name?: string;
    url?: string;
  }>;
  time?: string;
  products?: string[];
  details?: Array<{
    name?: string;
  }>;
  activityControls?: string[];
}

interface YouTubeComment {
  commentId?: string;
  channelId?: string;
  videoId?: string;
  text?: string;
  createdTimestamp?: string;
  videoTitle?: string;
}

// Google Activity types
interface GoogleActivity {
  header?: string;
  title?: string;
  titleUrl?: string;
  time?: string;
  products?: string[];
  details?: Array<{
    name?: string;
  }>;
  locationInfos?: Array<{
    name?: string;
    url?: string;
  }>;
}

// Drive metadata types
interface DriveFileMetadata {
  name?: string;
  mimeType?: string;
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
  parents?: string[];
  description?: string;
  starred?: boolean;
  trashed?: boolean;
  webViewLink?: string;
  webContentLink?: string;
}

// ═══════════════════════════════════════════════════════════════════
// GOOGLE TAKEOUT ADAPTER
// ═══════════════════════════════════════════════════════════════════

export class GoogleTakeoutAdapter extends BaseAdapter {
  readonly id = 'google-takeout';
  readonly name = 'Google Takeout';
  readonly description = 'Import Google Takeout exports (Chat, Keep, Drive, YouTube, etc.)';
  readonly version = '1.0.0';
  readonly contentTypes = [
    'google-chat-message',
    'google-chat-conversation',
    'google-keep-note',
    'google-drive-file',
    'youtube-watch-history',
    'youtube-comment',
    'google-activity',
  ];
  readonly supportedExtensions = ['.zip', '.json', '.html'];

  // Service directories to look for
  private readonly SERVICE_DIRS = {
    chat: ['Google Chat', 'Hangouts', 'Chat'],
    keep: ['Keep', 'Google Keep'],
    drive: ['Drive', 'Google Drive'],
    youtube: ['YouTube and YouTube Music', 'YouTube'],
    mail: ['Mail', 'Gmail'],
    photos: ['Google Photos', 'Photos'],
    activity: ['My Activity'],
  };

  // ─────────────────────────────────────────────────────────────────
  // DETECTION
  // ─────────────────────────────────────────────────────────────────

  async detect(source: AdapterSource): Promise<DetectionResult> {
    try {
      const path = source.path;

      // Check for archive_browser.html (signature file for Takeout)
      const browserPath = join(path, 'archive_browser.html');
      if (await this.fileExists(browserPath)) {
        return {
          canHandle: true,
          confidence: 0.95,
          format: 'google-takeout',
          reason: 'Found archive_browser.html (Google Takeout signature)',
        };
      }

      // Check for Takeout subfolder
      const takeoutPath = join(path, 'Takeout');
      if (await this.isDirectory(takeoutPath)) {
        const browserInTakeout = join(takeoutPath, 'archive_browser.html');
        if (await this.fileExists(browserInTakeout)) {
          return {
            canHandle: true,
            confidence: 0.95,
            format: 'google-takeout',
            reason: 'Found Takeout/archive_browser.html',
          };
        }
      }

      // Check for known service directories
      const detectedServices: string[] = [];
      const entries = await this.readDir(path).catch(() => []);

      for (const entry of entries) {
        const entryPath = join(path, entry);
        if (await this.isDirectory(entryPath)) {
          // Check each service type
          for (const [service, names] of Object.entries(this.SERVICE_DIRS)) {
            if (names.some((n) => entry.toLowerCase().includes(n.toLowerCase()))) {
              detectedServices.push(service);
            }
          }
        }
      }

      if (detectedServices.length >= 2) {
        return {
          canHandle: true,
          confidence: 0.85,
          format: 'google-takeout',
          reason: `Found Google service directories: ${detectedServices.join(', ')}`,
          metadata: { services: detectedServices },
        };
      }

      if (detectedServices.length === 1) {
        return {
          canHandle: true,
          confidence: 0.7,
          format: 'google-takeout-partial',
          reason: `Found single Google service: ${detectedServices[0]}`,
          metadata: { services: detectedServices },
        };
      }

      // Check for Google Chat specific structure
      const chatPath = await this.findServiceDir(path, 'chat');
      if (chatPath) {
        return {
          canHandle: true,
          confidence: 0.8,
          format: 'google-chat-export',
          reason: 'Found Google Chat export structure',
          metadata: { services: ['chat'] },
        };
      }

      // Check for Google Keep export
      const keepPath = await this.findServiceDir(path, 'keep');
      if (keepPath) {
        return {
          canHandle: true,
          confidence: 0.8,
          format: 'google-keep-export',
          reason: 'Found Google Keep export structure',
          metadata: { services: ['keep'] },
        };
      }

      return {
        canHandle: false,
        confidence: 0,
        reason: 'No Google Takeout structure detected',
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
        message: 'Not a valid Google Takeout export',
        details: { reason: detection.reason },
      });
      return { valid: false, errors, warnings };
    }

    // Check for parseable content in detected services
    const services = (detection.metadata?.services as string[]) || [];
    let hasContent = false;

    const basePath = await this.getTakeoutBasePath(source.path);

    for (const service of services) {
      const servicePath = await this.findServiceDir(basePath, service);
      if (servicePath) {
        hasContent = true;
      }
    }

    // If no specific services detected, look for any parseable files
    if (services.length === 0) {
      const jsonFiles = await this.findFiles(basePath, ['.json'], true).catch(() => []);
      if (jsonFiles.length > 0) {
        hasContent = true;
      }
    }

    if (!hasContent) {
      warnings.push({
        code: 'NO_PARSEABLE_CONTENT',
        message: 'No parseable content found in export',
        path: source.path,
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
    const contentTypes = new Set<string>();
    let estimatedCount = 0;
    let earliestDate: Date | undefined;
    let latestDate: Date | undefined;
    const detectedServices: string[] = [];

    const basePath = await this.getTakeoutBasePath(source.path);

    // Scan each service directory
    for (const [service, _names] of Object.entries(this.SERVICE_DIRS)) {
      const servicePath = await this.findServiceDir(basePath, service);
      if (!servicePath) continue;

      detectedServices.push(service);

      switch (service) {
        case 'chat': {
          const chatMeta = await this.scanChatService(servicePath);
          estimatedCount += chatMeta.count;
          contentTypes.add('google-chat-message');
          contentTypes.add('google-chat-conversation');
          if (chatMeta.earliest && (!earliestDate || chatMeta.earliest < earliestDate)) {
            earliestDate = chatMeta.earliest;
          }
          if (chatMeta.latest && (!latestDate || chatMeta.latest > latestDate)) {
            latestDate = chatMeta.latest;
          }
          break;
        }
        case 'keep': {
          const keepMeta = await this.scanKeepService(servicePath);
          estimatedCount += keepMeta.count;
          contentTypes.add('google-keep-note');
          break;
        }
        case 'youtube': {
          const ytMeta = await this.scanYouTubeService(servicePath);
          estimatedCount += ytMeta.count;
          if (ytMeta.hasWatchHistory) contentTypes.add('youtube-watch-history');
          if (ytMeta.hasComments) contentTypes.add('youtube-comment');
          break;
        }
        case 'activity': {
          const actMeta = await this.scanActivityService(servicePath);
          estimatedCount += actMeta.count;
          contentTypes.add('google-activity');
          break;
        }
      }
    }

    return {
      format: detection.format || 'google-takeout',
      formatVersion: '1.0',
      estimatedCount,
      dateRange: {
        earliest: earliestDate,
        latest: latestDate,
      },
      contentTypes: Array.from(contentTypes),
      metadata: {
        services: detectedServices,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // PARSING
  // ─────────────────────────────────────────────────────────────────

  protected async *parseSource(
    source: AdapterSource,
    options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    const basePath = await this.getTakeoutBasePath(source.path);

    // Parse each detected service
    for (const [service, _names] of Object.entries(this.SERVICE_DIRS)) {
      const servicePath = await this.findServiceDir(basePath, service);
      if (!servicePath) continue;

      switch (service) {
        case 'chat':
          yield* this.parseGoogleChat(servicePath, basePath);
          break;
        case 'keep':
          yield* this.parseGoogleKeep(servicePath, basePath);
          break;
        case 'youtube':
          yield* this.parseYouTube(servicePath, basePath);
          break;
        case 'activity':
          yield* this.parseActivity(servicePath, basePath);
          break;
        // Drive and Photos are metadata-only, skip for now
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // GOOGLE CHAT PARSING
  // ─────────────────────────────────────────────────────────────────

  private async *parseGoogleChat(
    servicePath: string,
    basePath: string
  ): AsyncGenerator<ImportedNode> {
    // Find all messages.json files
    const groupsPath = join(servicePath, 'Groups');
    if (!(await this.isDirectory(groupsPath))) {
      // Try direct structure
      yield* this.parseChatDirectory(servicePath, basePath);
      return;
    }

    const groups = await this.readDir(groupsPath).catch(() => []);
    for (const group of groups) {
      const groupPath = join(groupsPath, group);
      if (!(await this.isDirectory(groupPath))) continue;

      yield* this.parseChatDirectory(groupPath, basePath, group);
    }
  }

  private async *parseChatDirectory(
    dirPath: string,
    basePath: string,
    groupName?: string
  ): AsyncGenerator<ImportedNode> {
    const messagesPath = join(dirPath, 'messages.json');
    if (!(await this.fileExists(messagesPath))) return;

    try {
      const data = await this.readJson<GoogleChatConversation>(messagesPath);
      const messages = data.messages || [];

      if (messages.length === 0) return;

      // Generate conversation ID
      const convId = groupName || basename(dirPath);
      const sanitizedConvId = this.sanitizeId(convId);

      // Find date range
      let earliestDate: Date | undefined;
      let latestDate: Date | undefined;
      for (const msg of messages) {
        const date = this.parseTimestamp(msg.created_date);
        if (date) {
          if (!earliestDate || date < earliestDate) earliestDate = date;
          if (!latestDate || date > latestDate) latestDate = date;
        }
      }

      // Yield conversation node
      yield {
        id: `chat-conv-${sanitizedConvId}`,
        uri: this.generateUri('chat-conversation', sanitizedConvId),
        contentHash: this.hashContent(convId),
        content: convId,
        format: 'text',
        sourceType: 'google-chat-conversation',
        sourceCreatedAt: earliestDate,
        sourceUpdatedAt: latestDate,
        metadata: {
          title: convId,
          messageCount: messages.length,
          relativePath: relative(basePath, dirPath),
        },
      };

      // Yield message nodes
      let position = 0;
      for (const msg of messages) {
        const msgNode = this.chatMessageToNode(msg, sanitizedConvId, position, dirPath);
        if (msgNode) {
          yield msgNode;
          position++;
        }
      }
    } catch (error) {
      this.log('warn', `Failed to parse chat directory ${dirPath}`, error);
    }
  }

  private chatMessageToNode(
    msg: GoogleChatMessage,
    convId: string,
    position: number,
    dirPath: string
  ): ImportedNode | null {
    const content = msg.text?.trim();
    if (!content) return null;

    const msgId = msg.message_id || `${convId}-${position}`;
    const timestamp = this.parseTimestamp(msg.created_date);

    // Handle attachments
    const media: MediaReference[] = [];
    for (const file of msg.attached_files || []) {
      if (file.export_name) {
        media.push({
          id: `media-${msgId}-${media.length}`,
          type: this.inferMediaType(file.export_name),
          localPath: join(dirPath, file.export_name),
          metadata: {
            originalName: file.original_name,
            exportName: file.export_name,
          },
        });
      }
    }

    // Extract URLs from annotations
    const urls: string[] = [];
    for (const ann of msg.annotations || []) {
      if (ann.url_metadata?.url?.private_do_not_access_or_else_safe_url_wrapped_value) {
        urls.push(ann.url_metadata.url.private_do_not_access_or_else_safe_url_wrapped_value);
      }
    }

    const links: ContentLink[] = [
      {
        type: 'parent',
        targetUri: this.generateUri('chat-conversation', convId),
      },
    ];

    return {
      id: msgId,
      uri: this.generateUri('chat-message', msgId),
      contentHash: this.hashContent(content),
      content,
      format: 'text',
      sourceType: 'google-chat-message',
      sourceCreatedAt: timestamp,
      author: {
        name: msg.creator?.name,
        id: msg.creator?.email,
        role: 'user',
      },
      parentUri: this.generateUri('chat-conversation', convId),
      threadRootUri: this.generateUri('chat-conversation', convId),
      position,
      media: media.length > 0 ? media : undefined,
      links,
      metadata: {
        topicId: msg.topic_id,
        messageId: msg.message_id,
        creatorEmail: msg.creator?.email,
        creatorUserType: msg.creator?.user_type,
        urls: urls.length > 0 ? urls : undefined,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // GOOGLE KEEP PARSING
  // ─────────────────────────────────────────────────────────────────

  private async *parseGoogleKeep(
    servicePath: string,
    basePath: string
  ): AsyncGenerator<ImportedNode> {
    // Find all JSON note files
    const entries = await this.readDir(servicePath).catch(() => []);

    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;

      const notePath = join(servicePath, entry);
      try {
        const note = await this.readJson<GoogleKeepNote>(notePath);

        // Skip trashed notes by default
        if (note.isTrashed) continue;

        const node = this.keepNoteToNode(note, entry, servicePath);
        if (node) yield node;
      } catch (error) {
        this.log('warn', `Failed to parse Keep note ${entry}`, error);
      }
    }
  }

  private keepNoteToNode(
    note: GoogleKeepNote,
    filename: string,
    dirPath: string
  ): ImportedNode | null {
    // Build content from text or list
    let content = note.title || '';

    if (note.textContent) {
      content += content ? '\n\n' : '';
      content += note.textContent;
    }

    if (note.listContent && note.listContent.length > 0) {
      content += content ? '\n\n' : '';
      content += note.listContent
        .map((item) => `${item.isChecked ? '[x]' : '[ ]'} ${item.text || ''}`)
        .join('\n');
    }

    if (!content.trim()) return null;

    const noteId = this.sanitizeId(filename.replace('.json', ''));
    const createdAt = note.createdTimestampUsec
      ? new Date(note.createdTimestampUsec / 1000)
      : undefined;
    const updatedAt = note.userEditedTimestampUsec
      ? new Date(note.userEditedTimestampUsec / 1000)
      : undefined;

    // Handle attachments
    const media: MediaReference[] = [];
    for (const att of note.attachments || []) {
      if (att.filePath) {
        media.push({
          id: `media-${noteId}-${media.length}`,
          type: this.inferMediaType(att.filePath),
          mimeType: att.mimetype,
          localPath: join(dirPath, att.filePath),
        });
      }
    }

    return {
      id: noteId,
      uri: this.generateUri('keep-note', noteId),
      contentHash: this.hashContent(content),
      content,
      format: note.listContent ? 'markdown' : 'text',
      sourceType: 'google-keep-note',
      sourceCreatedAt: createdAt,
      sourceUpdatedAt: updatedAt,
      media: media.length > 0 ? media : undefined,
      metadata: {
        title: note.title,
        color: note.color,
        isPinned: note.isPinned,
        isArchived: note.isArchived,
        labels: note.labels?.map((l) => l.name).filter(Boolean),
        filename,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // YOUTUBE PARSING
  // ─────────────────────────────────────────────────────────────────

  private async *parseYouTube(
    servicePath: string,
    basePath: string
  ): AsyncGenerator<ImportedNode> {
    // Parse watch history
    const historyPath = join(servicePath, 'history', 'watch-history.json');
    if (await this.fileExists(historyPath)) {
      yield* this.parseYouTubeWatchHistory(historyPath);
    }

    // Parse comments (my-comments.json)
    const commentsPath = join(servicePath, 'my-comments', 'my-comments.json');
    if (await this.fileExists(commentsPath)) {
      yield* this.parseYouTubeComments(commentsPath);
    }
  }

  private async *parseYouTubeWatchHistory(
    filePath: string
  ): AsyncGenerator<ImportedNode> {
    try {
      const data = await this.readJson<YouTubeWatchHistoryItem[]>(filePath);
      if (!Array.isArray(data)) return;

      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        const node = this.youtubeWatchToNode(item, i);
        if (node) yield node;
      }
    } catch (error) {
      this.log('warn', 'Failed to parse YouTube watch history', error);
    }
  }

  private youtubeWatchToNode(
    item: YouTubeWatchHistoryItem,
    index: number
  ): ImportedNode | null {
    const title = item.title;
    if (!title) return null;

    const watchId = `yt-watch-${index}`;
    const timestamp = this.parseTimestamp(item.time);

    // Extract video ID from URL
    let videoId: string | undefined;
    if (item.titleUrl) {
      const match = item.titleUrl.match(/[?&]v=([^&]+)/);
      videoId = match?.[1];
    }

    // Build description
    const parts: string[] = [title];
    if (item.subtitles?.[0]?.name) {
      parts.push(`Channel: ${item.subtitles[0].name}`);
    }

    return {
      id: watchId,
      uri: this.generateUri('youtube-watch', watchId),
      contentHash: this.hashContent(`${title}-${item.time}`),
      content: parts.join('\n'),
      format: 'text',
      sourceType: 'youtube-watch-history',
      sourceCreatedAt: timestamp,
      metadata: {
        title,
        videoId,
        videoUrl: item.titleUrl,
        channel: item.subtitles?.[0]?.name,
        channelUrl: item.subtitles?.[0]?.url,
        products: item.products,
        details: item.details?.map((d) => d.name),
      },
    };
  }

  private async *parseYouTubeComments(
    filePath: string
  ): AsyncGenerator<ImportedNode> {
    try {
      const data = await this.readJson<YouTubeComment[]>(filePath);
      if (!Array.isArray(data)) return;

      for (let i = 0; i < data.length; i++) {
        const comment = data[i];
        const node = this.youtubeCommentToNode(comment, i);
        if (node) yield node;
      }
    } catch (error) {
      this.log('warn', 'Failed to parse YouTube comments', error);
    }
  }

  private youtubeCommentToNode(
    comment: YouTubeComment,
    index: number
  ): ImportedNode | null {
    const text = comment.text?.trim();
    if (!text) return null;

    const commentId = comment.commentId || `yt-comment-${index}`;
    const timestamp = this.parseTimestamp(comment.createdTimestamp);

    return {
      id: commentId,
      uri: this.generateUri('youtube-comment', commentId),
      contentHash: this.hashContent(text),
      content: text,
      format: 'text',
      sourceType: 'youtube-comment',
      sourceCreatedAt: timestamp,
      author: { role: 'user' },
      metadata: {
        commentId: comment.commentId,
        videoId: comment.videoId,
        channelId: comment.channelId,
        videoTitle: comment.videoTitle,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // GOOGLE ACTIVITY PARSING
  // ─────────────────────────────────────────────────────────────────

  private async *parseActivity(
    servicePath: string,
    basePath: string
  ): AsyncGenerator<ImportedNode> {
    // Find all MyActivity.json files
    const activityFiles = await this.findFiles(servicePath, ['.json'], true);

    for (const filePath of activityFiles) {
      if (!filePath.includes('MyActivity')) continue;

      try {
        const data = await this.readJson<GoogleActivity[]>(filePath);
        if (!Array.isArray(data)) continue;

        const serviceName = this.getActivityServiceName(filePath, servicePath);

        for (let i = 0; i < data.length; i++) {
          const activity = data[i];
          const node = this.activityToNode(activity, serviceName, i);
          if (node) yield node;
        }
      } catch (error) {
        this.log('warn', `Failed to parse activity file ${filePath}`, error);
      }
    }
  }

  private getActivityServiceName(filePath: string, servicePath: string): string {
    const relativePath = relative(servicePath, filePath);
    const parts = relativePath.split('/');
    return parts[0] || 'Unknown';
  }

  private activityToNode(
    activity: GoogleActivity,
    serviceName: string,
    index: number
  ): ImportedNode | null {
    const title = activity.title;
    if (!title) return null;

    const activityId = `activity-${serviceName}-${index}`;
    const timestamp = this.parseTimestamp(activity.time);

    // Build content
    const parts: string[] = [title];
    if (activity.header && activity.header !== title) {
      parts.unshift(`[${activity.header}]`);
    }
    for (const detail of activity.details || []) {
      if (detail.name) parts.push(detail.name);
    }

    return {
      id: activityId,
      uri: this.generateUri('google-activity', activityId),
      contentHash: this.hashContent(`${serviceName}-${title}-${activity.time}`),
      content: parts.join('\n'),
      format: 'text',
      sourceType: 'google-activity',
      sourceCreatedAt: timestamp,
      metadata: {
        service: serviceName,
        header: activity.header,
        titleUrl: activity.titleUrl,
        products: activity.products,
        locationInfos: activity.locationInfos,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPER METHODS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get the base path for Takeout (handles Takeout subdirectory)
   */
  private async getTakeoutBasePath(path: string): Promise<string> {
    const takeoutPath = join(path, 'Takeout');
    if (await this.isDirectory(takeoutPath)) {
      return takeoutPath;
    }
    return path;
  }

  /**
   * Find a service directory by name
   */
  private async findServiceDir(basePath: string, service: string): Promise<string | null> {
    const names = this.SERVICE_DIRS[service as keyof typeof this.SERVICE_DIRS];
    if (!names) return null;

    const entries = await this.readDir(basePath).catch(() => []);

    for (const entry of entries) {
      const entryLower = entry.toLowerCase();
      for (const name of names) {
        if (entryLower === name.toLowerCase() || entryLower.includes(name.toLowerCase())) {
          const fullPath = join(basePath, entry);
          if (await this.isDirectory(fullPath)) {
            return fullPath;
          }
        }
      }
    }

    return null;
  }

  /**
   * Sanitize an ID for use in URIs
   */
  private sanitizeId(id: string): string {
    return id
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      .slice(0, 100);
  }

  /**
   * Infer media type from filename
   */
  private inferMediaType(filename: string): MediaReference['type'] {
    const ext = extname(filename).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
      return 'image';
    }
    if (['.mp4', '.mov', '.avi', '.webm', '.mkv'].includes(ext)) {
      return 'video';
    }
    if (['.mp3', '.wav', '.m4a', '.ogg', '.flac'].includes(ext)) {
      return 'audio';
    }
    if (['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'].includes(ext)) {
      return 'document';
    }
    return 'other';
  }

  // ─────────────────────────────────────────────────────────────────
  // METADATA SCANNING
  // ─────────────────────────────────────────────────────────────────

  private async scanChatService(
    servicePath: string
  ): Promise<{ count: number; earliest?: Date; latest?: Date }> {
    let count = 0;
    let earliest: Date | undefined;
    let latest: Date | undefined;

    const groupsPath = join(servicePath, 'Groups');
    const searchPath = (await this.isDirectory(groupsPath)) ? groupsPath : servicePath;

    const entries = await this.readDir(searchPath).catch(() => []);
    for (const entry of entries) {
      const messagesPath = join(searchPath, entry, 'messages.json');
      if (await this.fileExists(messagesPath)) {
        try {
          const data = await this.readJson<GoogleChatConversation>(messagesPath);
          count += 1 + (data.messages?.length || 0);

          for (const msg of data.messages || []) {
            const date = this.parseTimestamp(msg.created_date);
            if (date) {
              if (!earliest || date < earliest) earliest = date;
              if (!latest || date > latest) latest = date;
            }
          }
        } catch (error) {
          this.log('debug', `Failed to scan chat ${entry}`, error);
        }
      }
    }

    return { count, earliest, latest };
  }

  private async scanKeepService(servicePath: string): Promise<{ count: number }> {
    const files = await this.findFiles(servicePath, ['.json'], false).catch(() => []);
    return { count: files.length };
  }

  private async scanYouTubeService(
    servicePath: string
  ): Promise<{ count: number; hasWatchHistory: boolean; hasComments: boolean }> {
    let count = 0;
    let hasWatchHistory = false;
    let hasComments = false;

    const historyPath = join(servicePath, 'history', 'watch-history.json');
    if (await this.fileExists(historyPath)) {
      hasWatchHistory = true;
      try {
        const data = await this.readJson<unknown[]>(historyPath);
        count += data.length;
      } catch (error) {
        this.log('debug', 'Failed to count watch history', error);
      }
    }

    const commentsPath = join(servicePath, 'my-comments', 'my-comments.json');
    if (await this.fileExists(commentsPath)) {
      hasComments = true;
      try {
        const data = await this.readJson<unknown[]>(commentsPath);
        count += data.length;
      } catch (error) {
        this.log('debug', 'Failed to count comments', error);
      }
    }

    return { count, hasWatchHistory, hasComments };
  }

  private async scanActivityService(servicePath: string): Promise<{ count: number }> {
    let count = 0;
    const activityFiles = await this.findFiles(servicePath, ['.json'], true).catch(() => []);

    for (const filePath of activityFiles) {
      if (!filePath.includes('MyActivity')) continue;
      try {
        const data = await this.readJson<unknown[]>(filePath);
        if (Array.isArray(data)) {
          count += data.length;
        }
      } catch (error) {
        this.log('debug', `Failed to count activity file ${filePath}`, error);
      }
    }

    return { count };
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════

export const googleTakeoutAdapter = new GoogleTakeoutAdapter();
