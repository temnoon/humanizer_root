/**
 * Facebook/Meta Adapter
 *
 * Parses Facebook data exports (GDPR / Settings > Download your information).
 *
 * Export structure:
 * - your_facebook_activity/posts/ - User's posts, check-ins, photos, videos
 * - your_facebook_activity/comments_and_reactions/ - Comments and likes
 * - your_facebook_activity/messages/inbox/ - Messenger conversations
 * - personal_information/profile_information/ - Profile data
 * - connections/friends/ - Friends list
 *
 * Output content types:
 * - facebook-post
 * - facebook-comment
 * - facebook-reaction
 * - facebook-message
 * - facebook-note
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
// TYPES FOR FACEBOOK EXPORT FORMAT
// ═══════════════════════════════════════════════════════════════════

interface FacebookPost {
  timestamp: number;
  title?: string;
  data?: Array<{
    post?: string;
    update_timestamp?: number;
  }>;
  attachments?: Array<{
    data: Array<{
      external_context?: {
        url?: string;
        name?: string;
      };
      media?: {
        uri?: string;
        creation_timestamp?: number;
        title?: string;
        description?: string;
      };
      place?: {
        name?: string;
        coordinate?: {
          latitude?: number;
          longitude?: number;
        };
        address?: string;
        url?: string;
      };
    }>;
  }>;
  tags?: Array<{
    name?: string;
  }>;
}

interface FacebookComment {
  timestamp: number;
  title?: string;
  data?: Array<{
    comment?: {
      timestamp: number;
      comment: string;
      author: string;
    };
  }>;
  attachments?: Array<{
    data: Array<{
      media?: {
        uri?: string;
      };
    }>;
  }>;
}

interface FacebookReaction {
  timestamp: number;
  title?: string;
  data?: Array<{
    reaction?: {
      reaction: string;
      actor: string;
    };
  }>;
}

interface FacebookMessage {
  sender_name: string;
  timestamp_ms: number;
  content?: string;
  type?: string;
  is_unsent?: boolean;
  photos?: Array<{
    uri: string;
    creation_timestamp?: number;
  }>;
  videos?: Array<{
    uri: string;
    creation_timestamp?: number;
  }>;
  audio_files?: Array<{
    uri: string;
    creation_timestamp?: number;
  }>;
  gifs?: Array<{
    uri: string;
  }>;
  sticker?: {
    uri: string;
  };
  share?: {
    link?: string;
    share_text?: string;
  };
  reactions?: Array<{
    reaction: string;
    actor: string;
  }>;
  call_duration?: number;
  is_geoblocked_for_viewer?: boolean;
}

interface FacebookConversation {
  participants: Array<{
    name: string;
  }>;
  messages: FacebookMessage[];
  title: string;
  is_still_participant: boolean;
  thread_path: string;
  magic_words?: string[];
}

interface FacebookProfile {
  profile_v2?: {
    name?: {
      full_name?: string;
      first_name?: string;
      last_name?: string;
    };
    emails?: {
      emails?: string[];
    };
    birthday?: {
      year?: number;
      month?: number;
      day?: number;
    };
    gender?: {
      gender_option?: string;
    };
    current_city?: {
      name?: string;
    };
    hometown?: {
      name?: string;
    };
    relationship?: {
      status?: string;
    };
    bio_text?: string;
  };
}

// ═══════════════════════════════════════════════════════════════════
// FACEBOOK ADAPTER
// ═══════════════════════════════════════════════════════════════════

export class FacebookAdapter extends BaseAdapter {
  readonly id = 'facebook';
  readonly name = 'Facebook / Meta';
  readonly description = 'Import Facebook data exports from Meta';
  readonly version = '1.0.0';
  readonly contentTypes = [
    'facebook-post',
    'facebook-comment',
    'facebook-reaction',
    'facebook-message',
    'facebook-conversation',
    'facebook-note',
  ];
  readonly supportedExtensions = ['.zip', '.json'];

  // ─────────────────────────────────────────────────────────────────
  // DETECTION
  // ─────────────────────────────────────────────────────────────────

  async detect(source: AdapterSource): Promise<DetectionResult> {
    try {
      const path = source.path;

      // Check for Facebook-specific folder structure
      const facebookActivityDir = join(path, 'your_facebook_activity');
      if (await this.isDirectory(facebookActivityDir)) {
        // Verify it's Facebook (not Instagram which has similar structure)
        const postsDir = join(facebookActivityDir, 'posts');
        const messagesDir = join(facebookActivityDir, 'messages');

        const hasPosts = await this.isDirectory(postsDir);
        const hasMessages = await this.isDirectory(messagesDir);

        if (hasPosts || hasMessages) {
          // Check for Facebook-specific files
          const postFiles = await this.findFiles(postsDir, ['.json'], false).catch(() => []);
          const hasTypicalPosts = postFiles.some(f =>
            f.includes('your_posts__check_ins') ||
            f.includes('posts_on_other')
          );

          if (hasTypicalPosts) {
            return {
              canHandle: true,
              confidence: 0.95,
              format: 'facebook-export',
              reason: 'Found your_facebook_activity with typical Facebook post files',
            };
          }

          return {
            canHandle: true,
            confidence: 0.85,
            format: 'facebook-export',
            reason: 'Found your_facebook_activity structure',
          };
        }
      }

      // Check for older Facebook export format
      const timelineDir = join(path, 'timeline');
      const photosDir = join(path, 'photos_and_videos');
      if (await this.isDirectory(timelineDir) || await this.isDirectory(photosDir)) {
        return {
          canHandle: true,
          confidence: 0.7,
          format: 'facebook-export-legacy',
          reason: 'Found legacy Facebook export structure',
        };
      }

      // Check for messages-only export
      const messagesRoot = join(path, 'messages');
      if (await this.isDirectory(messagesRoot)) {
        const inboxDir = join(messagesRoot, 'inbox');
        if (await this.isDirectory(inboxDir)) {
          return {
            canHandle: true,
            confidence: 0.75,
            format: 'facebook-messages',
            reason: 'Found Facebook Messenger export',
          };
        }
      }

      return {
        canHandle: false,
        confidence: 0,
        reason: 'No Facebook export structure detected',
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
        message: 'Not a valid Facebook export',
        details: { reason: detection.reason },
      });
      return { valid: false, errors, warnings };
    }

    // Check for expected content directories
    const facebookActivityDir = join(source.path, 'your_facebook_activity');
    if (await this.isDirectory(facebookActivityDir)) {
      const postsDir = join(facebookActivityDir, 'posts');
      const commentsDir = join(facebookActivityDir, 'comments_and_reactions');
      const messagesDir = join(facebookActivityDir, 'messages');

      const hasPosts = await this.isDirectory(postsDir);
      const hasComments = await this.isDirectory(commentsDir);
      const hasMessages = await this.isDirectory(messagesDir);

      if (!hasPosts && !hasComments && !hasMessages) {
        warnings.push({
          code: 'EMPTY_EXPORT',
          message: 'No posts, comments, or messages found in Facebook export',
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

    // Try to get profile information
    const profilePath = join(
      source.path,
      'personal_information',
      'profile_information',
      'profile_information.json'
    );
    if (await this.fileExists(profilePath)) {
      try {
        const profile = await this.readJson<FacebookProfile>(profilePath);
        if (profile.profile_v2?.name) {
          accountInfo = {
            name: profile.profile_v2.name.full_name,
          };
          if (profile.profile_v2.emails?.emails?.[0]) {
            accountInfo.email = profile.profile_v2.emails.emails[0];
          }
        }
      } catch (error) {
        console.debug('[FacebookAdapter] Failed to parse profile:', error);
      }
    }

    // Count posts
    const postsDir = join(source.path, 'your_facebook_activity', 'posts');
    if (await this.isDirectory(postsDir)) {
      const postFiles = await this.findFiles(postsDir, ['.json'], false).catch(() => []);
      for (const file of postFiles) {
        if (file.includes('your_posts')) {
          try {
            const posts = await this.readJson<FacebookPost[]>(file);
            estimatedCount += posts.length;
            contentTypes.add('facebook-post');

            for (const post of posts) {
              const date = this.parseTimestamp(post.timestamp * 1000);
              if (date) {
                if (!earliestDate || date < earliestDate) earliestDate = date;
                if (!latestDate || date > latestDate) latestDate = date;
              }
            }
          } catch (error) {
            console.debug('[FacebookAdapter] Failed to parse post file:', error);
          }
        }
      }
    }

    // Count comments
    const commentsPath = join(
      source.path,
      'your_facebook_activity',
      'comments_and_reactions',
      'comments.json'
    );
    if (await this.fileExists(commentsPath)) {
      try {
        const data = await this.readJson<{ comments_v2: FacebookComment[] }>(commentsPath);
        estimatedCount += data.comments_v2?.length || 0;
        contentTypes.add('facebook-comment');
      } catch (error) {
        console.debug('[FacebookAdapter] Failed to parse comments:', error);
      }
    }

    // Count messages (sample from inbox)
    const inboxDir = join(source.path, 'your_facebook_activity', 'messages', 'inbox');
    if (await this.isDirectory(inboxDir)) {
      try {
        const threads = await this.readDir(inboxDir);
        // Estimate ~50 messages per thread on average
        estimatedCount += threads.length * 50;
        contentTypes.add('facebook-message');
        contentTypes.add('facebook-conversation');
      } catch (error) {
        console.debug('[FacebookAdapter] Failed to read inbox:', error);
      }
    }

    return {
      format: detection.format || 'facebook-export',
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
    // Parse posts
    yield* this.parsePosts(source, options);

    // Parse comments
    yield* this.parseComments(source, options);

    // Parse reactions
    yield* this.parseReactions(source, options);

    // Parse messages
    yield* this.parseMessages(source, options);
  }

  private async *parsePosts(
    source: AdapterSource,
    _options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    const postsDir = join(source.path, 'your_facebook_activity', 'posts');
    if (!(await this.isDirectory(postsDir))) return;

    const postFiles = await this.findFiles(postsDir, ['.json'], false).catch(() => []);

    for (const file of postFiles) {
      if (!file.includes('your_posts')) continue;

      try {
        const posts = await this.readJson<FacebookPost[]>(file);

        for (const post of posts) {
          const node = this.postToNode(post);
          if (node) yield node;
        }
      } catch (error) {
        this.log('warn', `Failed to parse posts file: ${file}`, error);
      }
    }
  }

  private async *parseComments(
    source: AdapterSource,
    _options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    const commentsPath = join(
      source.path,
      'your_facebook_activity',
      'comments_and_reactions',
      'comments.json'
    );

    if (!(await this.fileExists(commentsPath))) return;

    try {
      const data = await this.readJson<{ comments_v2: FacebookComment[] }>(commentsPath);
      const comments = data.comments_v2 || [];

      for (const comment of comments) {
        const node = this.commentToNode(comment);
        if (node) yield node;
      }
    } catch (error) {
      this.log('warn', `Failed to parse comments file`, error);
    }
  }

  private async *parseReactions(
    source: AdapterSource,
    _options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    const reactionsDir = join(
      source.path,
      'your_facebook_activity',
      'comments_and_reactions'
    );

    if (!(await this.isDirectory(reactionsDir))) return;

    const reactionFiles = await this.findFiles(reactionsDir, ['.json'], false).catch(() => []);

    for (const file of reactionFiles) {
      if (!file.includes('likes_and_reactions')) continue;

      try {
        const data = await this.readJson<{ reactions_v2?: FacebookReaction[] }>(file);
        const reactions = data.reactions_v2 || [];

        for (const reaction of reactions) {
          const node = this.reactionToNode(reaction);
          if (node) yield node;
        }
      } catch (error) {
        this.log('warn', `Failed to parse reactions file: ${file}`, error);
      }
    }
  }

  private async *parseMessages(
    source: AdapterSource,
    _options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    const inboxDir = join(source.path, 'your_facebook_activity', 'messages', 'inbox');
    if (!(await this.isDirectory(inboxDir))) return;

    const threads = await this.readDir(inboxDir).catch(() => []);

    for (const threadFolder of threads) {
      const threadPath = join(inboxDir, threadFolder);
      if (!(await this.isDirectory(threadPath))) continue;

      // Find message files (message_1.json, message_2.json, etc.)
      const messageFiles = await this.findFiles(threadPath, ['.json'], false).catch(() => []);
      const sortedFiles = messageFiles
        .filter(f => f.includes('message_'))
        .sort((a, b) => {
          const numA = parseInt(a.match(/message_(\d+)\.json/)?.[1] || '0');
          const numB = parseInt(b.match(/message_(\d+)\.json/)?.[1] || '0');
          return numA - numB;
        });

      if (sortedFiles.length === 0) continue;

      // Parse first file to get conversation metadata
      try {
        const firstConv = await this.readJson<FacebookConversation>(sortedFiles[0]);

        // Yield conversation node
        yield this.conversationToNode(firstConv, threadFolder);

        // Yield messages from all files
        let position = 0;
        for (const file of sortedFiles) {
          const conv = await this.readJson<FacebookConversation>(file);
          // Messages are in reverse chronological order in Facebook exports
          const messages = [...(conv.messages || [])].reverse();

          for (const msg of messages) {
            const node = this.messageToNode(msg, firstConv, threadFolder, position);
            if (node) {
              yield node;
              position++;
            }
          }
        }
      } catch (error) {
        this.log('warn', `Failed to parse messages in thread: ${threadFolder}`, error);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // CONVERTERS
  // ─────────────────────────────────────────────────────────────────

  private postToNode(post: FacebookPost): ImportedNode | null {
    // Extract post content
    let content = '';
    if (post.data) {
      for (const item of post.data) {
        if (item.post) {
          content = this.fixEncoding(item.post);
          break;
        }
      }
    }

    // Skip empty posts (just shares with no content)
    if (!content && !post.title) {
      return null;
    }

    const id = `post-${post.timestamp}`;
    const timestamp = this.parseTimestamp(post.timestamp * 1000);

    // Extract media
    const media: MediaReference[] = [];
    if (post.attachments) {
      for (const attachment of post.attachments) {
        for (const item of attachment.data || []) {
          if (item.media?.uri) {
            media.push({
              id: `media-${post.timestamp}-${media.length}`,
              type: this.classifyMediaUri(item.media.uri),
              localPath: item.media.uri,
              alt: item.media.title || item.media.description,
            });
          }
        }
      }
    }

    // Extract external URLs
    const urls: string[] = [];
    if (post.attachments) {
      for (const attachment of post.attachments) {
        for (const item of attachment.data || []) {
          if (item.external_context?.url) {
            urls.push(item.external_context.url);
          }
        }
      }
    }

    // Extract tags
    const tags = post.tags?.map(t => t.name).filter(Boolean) || [];

    return {
      id,
      uri: this.generateUri('post', id),
      contentHash: this.hashContent(content || post.title || ''),
      content: content || post.title || '',
      format: 'text',
      sourceType: 'facebook-post',
      sourceCreatedAt: timestamp,
      media: media.length > 0 ? media : undefined,
      metadata: {
        title: post.title ? this.fixEncoding(post.title) : undefined,
        externalUrls: urls.length > 0 ? urls : undefined,
        tags: tags.length > 0 ? tags : undefined,
      },
    };
  }

  private commentToNode(comment: FacebookComment): ImportedNode | null {
    // Extract comment content
    let content = '';
    let author = '';
    let commentTimestamp = comment.timestamp;

    if (comment.data) {
      for (const item of comment.data) {
        if (item.comment) {
          content = this.fixEncoding(item.comment.comment);
          author = this.fixEncoding(item.comment.author);
          commentTimestamp = item.comment.timestamp;
          break;
        }
      }
    }

    if (!content) return null;

    const id = `comment-${commentTimestamp}`;
    const timestamp = this.parseTimestamp(commentTimestamp * 1000);

    // Extract media
    const media: MediaReference[] = [];
    if (comment.attachments) {
      for (const attachment of comment.attachments) {
        for (const item of attachment.data || []) {
          if (item.media?.uri) {
            media.push({
              id: `media-${commentTimestamp}-${media.length}`,
              type: this.classifyMediaUri(item.media.uri),
              localPath: item.media.uri,
            });
          }
        }
      }
    }

    return {
      id,
      uri: this.generateUri('comment', id),
      contentHash: this.hashContent(content),
      content,
      format: 'text',
      sourceType: 'facebook-comment',
      sourceCreatedAt: timestamp,
      author: {
        name: author,
      },
      media: media.length > 0 ? media : undefined,
      metadata: {
        title: comment.title ? this.fixEncoding(comment.title) : undefined,
      },
    };
  }

  private reactionToNode(reaction: FacebookReaction): ImportedNode | null {
    let reactionType = '';
    let actor = '';

    if (reaction.data) {
      for (const item of reaction.data) {
        if (item.reaction) {
          reactionType = item.reaction.reaction;
          actor = this.fixEncoding(item.reaction.actor);
          break;
        }
      }
    }

    if (!reactionType) return null;

    const id = `reaction-${reaction.timestamp}`;
    const timestamp = this.parseTimestamp(reaction.timestamp * 1000);

    return {
      id,
      uri: this.generateUri('reaction', id),
      contentHash: this.hashContent(`${actor}:${reactionType}:${reaction.timestamp}`),
      content: reactionType,
      format: 'text',
      sourceType: 'facebook-reaction',
      sourceCreatedAt: timestamp,
      author: {
        name: actor,
      },
      metadata: {
        title: reaction.title ? this.fixEncoding(reaction.title) : undefined,
        reactionType,
      },
    };
  }

  private conversationToNode(conv: FacebookConversation, threadFolder: string): ImportedNode {
    const id = `conversation-${threadFolder}`;
    const participants = conv.participants.map(p => this.fixEncoding(p.name));
    const title = this.fixEncoding(conv.title);

    // Find date range from messages
    let earliestDate: Date | undefined;
    let latestDate: Date | undefined;
    for (const msg of conv.messages || []) {
      const date = this.parseTimestamp(msg.timestamp_ms);
      if (date) {
        if (!earliestDate || date < earliestDate) earliestDate = date;
        if (!latestDate || date > latestDate) latestDate = date;
      }
    }

    return {
      id,
      uri: this.generateUri('conversation', threadFolder),
      contentHash: this.hashContent(`${title}:${participants.join(',')}`),
      content: title,
      format: 'text',
      sourceType: 'facebook-conversation',
      sourceCreatedAt: earliestDate,
      sourceUpdatedAt: latestDate,
      metadata: {
        title,
        participants,
        threadPath: conv.thread_path,
        isStillParticipant: conv.is_still_participant,
        messageCount: conv.messages?.length || 0,
      },
    };
  }

  private messageToNode(
    msg: FacebookMessage,
    conv: FacebookConversation,
    threadFolder: string,
    position: number
  ): ImportedNode | null {
    // Skip system messages with no content
    if (!msg.content && !msg.photos?.length && !msg.videos?.length && !msg.share) {
      return null;
    }

    const id = `message-${threadFolder}-${msg.timestamp_ms}`;
    const timestamp = this.parseTimestamp(msg.timestamp_ms);
    const senderName = this.fixEncoding(msg.sender_name);
    const content = msg.content ? this.fixEncoding(msg.content) : '';

    // Extract media
    const media: MediaReference[] = [];

    if (msg.photos) {
      for (const photo of msg.photos) {
        media.push({
          id: `photo-${msg.timestamp_ms}-${media.length}`,
          type: 'image',
          localPath: photo.uri,
        });
      }
    }

    if (msg.videos) {
      for (const video of msg.videos) {
        media.push({
          id: `video-${msg.timestamp_ms}-${media.length}`,
          type: 'video',
          localPath: video.uri,
        });
      }
    }

    if (msg.audio_files) {
      for (const audio of msg.audio_files) {
        media.push({
          id: `audio-${msg.timestamp_ms}-${media.length}`,
          type: 'audio',
          localPath: audio.uri,
        });
      }
    }

    if (msg.gifs) {
      for (const gif of msg.gifs) {
        media.push({
          id: `gif-${msg.timestamp_ms}-${media.length}`,
          type: 'image',
          localPath: gif.uri,
        });
      }
    }

    if (msg.sticker) {
      media.push({
        id: `sticker-${msg.timestamp_ms}`,
        type: 'image',
        localPath: msg.sticker.uri,
      });
    }

    // Build links
    const links: ContentLink[] = [
      {
        type: 'parent',
        targetUri: this.generateUri('conversation', threadFolder),
      },
    ];

    return {
      id,
      uri: this.generateUri('message', id),
      contentHash: this.hashContent(`${senderName}:${content}:${msg.timestamp_ms}`),
      content: content || (msg.share?.share_text ? this.fixEncoding(msg.share.share_text) : '[Media]'),
      format: 'text',
      sourceType: 'facebook-message',
      sourceCreatedAt: timestamp,
      author: {
        name: senderName,
      },
      parentUri: this.generateUri('conversation', threadFolder),
      threadRootUri: this.generateUri('conversation', threadFolder),
      position,
      media: media.length > 0 ? media : undefined,
      links,
      metadata: {
        conversationTitle: this.fixEncoding(conv.title),
        messageType: msg.type,
        isUnsent: msg.is_unsent,
        callDuration: msg.call_duration,
        shareLink: msg.share?.link,
        reactions: msg.reactions?.map(r => ({
          reaction: r.reaction,
          actor: this.fixEncoding(r.actor),
        })),
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  private classifyMediaUri(uri: string): MediaReference['type'] {
    const lower = uri.toLowerCase();
    if (lower.includes('/photos/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(lower)) {
      return 'image';
    }
    if (lower.includes('/videos/') || /\.(mp4|mov|avi|webm)$/i.test(lower)) {
      return 'video';
    }
    if (lower.includes('/audio/') || /\.(mp3|m4a|wav|ogg)$/i.test(lower)) {
      return 'audio';
    }
    return 'other';
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════

export const facebookAdapter = new FacebookAdapter();
