/**
 * Instagram Adapter
 *
 * Parses Instagram data exports (GDPR / Settings > Download your information).
 *
 * Export structure:
 * - your_instagram_activity/messages/inbox/ - DM conversations
 * - your_instagram_activity/comments/ - Comments on posts
 * - your_instagram_activity/likes/ - Liked posts
 * - your_instagram_activity/saved/ - Saved posts
 * - media/posts/ - Posted media
 * - media/stories/ - Stories
 * - personal_information/ - Profile data
 *
 * Output content types:
 * - instagram-post
 * - instagram-story
 * - instagram-reel
 * - instagram-comment
 * - instagram-message
 * - instagram-conversation
 * - instagram-like
 * - instagram-saved
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
// TYPES FOR INSTAGRAM EXPORT FORMAT
// ═══════════════════════════════════════════════════════════════════

interface InstagramComment {
  media_list_data?: Array<{
    uri?: string;
  }>;
  string_map_data?: {
    Comment?: {
      value?: string;
    };
    'Media Owner'?: {
      value?: string;
    };
    Time?: {
      timestamp?: number;
    };
  };
}

interface InstagramLike {
  title?: string;
  string_list_data?: Array<{
    href?: string;
    value?: string;
    timestamp?: number;
  }>;
}

interface InstagramSavedPost {
  title?: string;
  string_map_data?: {
    'Saved on'?: {
      timestamp?: number;
    };
  };
}

interface InstagramMessage {
  sender_name: string;
  timestamp_ms: number;
  content?: string;
  type?: string;
  is_unsent?: boolean;
  share?: {
    link?: string;
    share_text?: string;
  };
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
  reactions?: Array<{
    reaction: string;
    actor: string;
  }>;
  is_geoblocked_for_viewer?: boolean;
}

interface InstagramConversation {
  participants: Array<{
    name: string;
  }>;
  messages: InstagramMessage[];
  title: string;
  is_still_participant: boolean;
  thread_path: string;
  magic_words?: string[];
}

interface InstagramPost {
  media?: Array<{
    uri?: string;
    creation_timestamp?: number;
    title?: string;
  }>;
  title?: string;
  creation_timestamp?: number;
}

interface InstagramProfile {
  profile_user?: Array<{
    string_map_data?: {
      Username?: { value?: string };
      Name?: { value?: string };
      Email?: { value?: string };
      Bio?: { value?: string };
    };
  }>;
}

// ═══════════════════════════════════════════════════════════════════
// INSTAGRAM ADAPTER
// ═══════════════════════════════════════════════════════════════════

export class InstagramAdapter extends BaseAdapter {
  readonly id = 'instagram';
  readonly name = 'Instagram';
  readonly description = 'Import Instagram data exports from Meta';
  readonly version = '1.0.0';
  readonly contentTypes = [
    'instagram-post',
    'instagram-story',
    'instagram-reel',
    'instagram-comment',
    'instagram-message',
    'instagram-conversation',
    'instagram-like',
    'instagram-saved',
  ];
  readonly supportedExtensions = ['.zip', '.json'];

  // ─────────────────────────────────────────────────────────────────
  // DETECTION
  // ─────────────────────────────────────────────────────────────────

  async detect(source: AdapterSource): Promise<DetectionResult> {
    try {
      const path = source.path;

      // Check for Instagram-specific folder structure
      const instagramActivityDir = join(path, 'your_instagram_activity');
      if (await this.isDirectory(instagramActivityDir)) {
        // Verify it's Instagram by checking for Instagram-specific folders
        const commentsDir = join(instagramActivityDir, 'comments');
        const messagesDir = join(instagramActivityDir, 'messages');
        const likesDir = join(instagramActivityDir, 'likes');

        const hasComments = await this.isDirectory(commentsDir);
        const hasMessages = await this.isDirectory(messagesDir);
        const hasLikes = await this.isDirectory(likesDir);

        if (hasComments || hasMessages || hasLikes) {
          return {
            canHandle: true,
            confidence: 0.95,
            format: 'instagram-export',
            reason: 'Found your_instagram_activity structure',
          };
        }
      }

      // Check for media folder with Instagram-specific structure
      const mediaDir = join(path, 'media');
      if (await this.isDirectory(mediaDir)) {
        const postsDir = join(mediaDir, 'posts');
        const storiesDir = join(mediaDir, 'stories');
        const reelsDir = join(mediaDir, 'reels');

        const hasPosts = await this.isDirectory(postsDir);
        const hasStories = await this.isDirectory(storiesDir);
        const hasReels = await this.isDirectory(reelsDir);

        if (hasPosts || hasStories || hasReels) {
          return {
            canHandle: true,
            confidence: 0.85,
            format: 'instagram-export',
            reason: 'Found Instagram media structure',
          };
        }
      }

      // Check for apps_and_websites_off_of_instagram (unique to Instagram)
      const offInstagramDir = join(path, 'apps_and_websites_off_of_instagram');
      if (await this.isDirectory(offInstagramDir)) {
        return {
          canHandle: true,
          confidence: 0.8,
          format: 'instagram-export',
          reason: 'Found apps_and_websites_off_of_instagram folder',
        };
      }

      return {
        canHandle: false,
        confidence: 0,
        reason: 'No Instagram export structure detected',
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
        message: 'Not a valid Instagram export',
        details: { reason: detection.reason },
      });
      return { valid: false, errors, warnings };
    }

    // Check for expected content
    const instagramActivityDir = join(source.path, 'your_instagram_activity');
    const mediaDir = join(source.path, 'media');

    const hasActivity = await this.isDirectory(instagramActivityDir);
    const hasMedia = await this.isDirectory(mediaDir);

    if (!hasActivity && !hasMedia) {
      warnings.push({
        code: 'EMPTY_EXPORT',
        message: 'No activity or media found in Instagram export',
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

    // Try to get profile information
    const profilePath = join(
      source.path,
      'personal_information',
      'personal_information',
      'personal_information.json'
    );
    if (await this.fileExists(profilePath)) {
      try {
        const profile = await this.readJson<InstagramProfile>(profilePath);
        const userData = profile.profile_user?.[0]?.string_map_data;
        if (userData) {
          accountInfo = {
            handle: userData.Username?.value,
            name: userData.Name?.value,
            email: userData.Email?.value,
          };
        }
      } catch {
        // Ignore profile parsing errors
      }
    }

    // Count comments
    const commentsPath = join(
      source.path,
      'your_instagram_activity',
      'comments',
      'post_comments_1.json'
    );
    if (await this.fileExists(commentsPath)) {
      try {
        const comments = await this.readJson<InstagramComment[]>(commentsPath);
        estimatedCount += comments.length;
        contentTypes.add('instagram-comment');
      } catch {
        // Ignore
      }
    }

    // Count messages (estimate from inbox)
    const inboxDir = join(source.path, 'your_instagram_activity', 'messages', 'inbox');
    if (await this.isDirectory(inboxDir)) {
      try {
        const threads = await this.readDir(inboxDir);
        // Estimate ~30 messages per thread
        estimatedCount += threads.length * 30;
        contentTypes.add('instagram-message');
        contentTypes.add('instagram-conversation');
      } catch {
        // Ignore
      }
    }

    // Count posts
    const postsDir = join(source.path, 'media', 'posts');
    if (await this.isDirectory(postsDir)) {
      try {
        const posts = await this.readDir(postsDir);
        estimatedCount += posts.length;
        contentTypes.add('instagram-post');
      } catch {
        // Ignore
      }
    }

    return {
      format: detection.format || 'instagram-export',
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
    // Parse comments
    yield* this.parseComments(source, options);

    // Parse likes
    yield* this.parseLikes(source, options);

    // Parse messages
    yield* this.parseMessages(source, options);

    // Parse saved posts
    yield* this.parseSavedPosts(source, options);

    // Parse posts from media folder
    yield* this.parsePosts(source, options);
  }

  private async *parseComments(
    source: AdapterSource,
    _options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    const commentsDir = join(source.path, 'your_instagram_activity', 'comments');
    if (!(await this.isDirectory(commentsDir))) return;

    const commentFiles = await this.findFiles(commentsDir, ['.json'], false).catch(() => []);

    for (const file of commentFiles) {
      if (!file.includes('post_comments')) continue;

      try {
        const comments = await this.readJson<InstagramComment[]>(file);

        for (const comment of comments) {
          const node = this.commentToNode(comment);
          if (node) yield node;
        }
      } catch (error) {
        this.log('warn', `Failed to parse comments file: ${file}`, error);
      }
    }
  }

  private async *parseLikes(
    source: AdapterSource,
    _options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    const likesDir = join(source.path, 'your_instagram_activity', 'likes');
    if (!(await this.isDirectory(likesDir))) return;

    const likeFiles = await this.findFiles(likesDir, ['.json'], false).catch(() => []);

    for (const file of likeFiles) {
      try {
        const data = await this.readJson<{ likes_media_likes?: InstagramLike[] }>(file);
        const likes = data.likes_media_likes || [];

        for (const like of likes) {
          const node = this.likeToNode(like);
          if (node) yield node;
        }
      } catch (error) {
        this.log('warn', `Failed to parse likes file: ${file}`, error);
      }
    }
  }

  private async *parseMessages(
    source: AdapterSource,
    _options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    // Check both inbox and message_requests
    const messageDirs = [
      join(source.path, 'your_instagram_activity', 'messages', 'inbox'),
      join(source.path, 'your_instagram_activity', 'messages', 'message_requests'),
    ];

    for (const messagesDir of messageDirs) {
      if (!(await this.isDirectory(messagesDir))) continue;

      const threads = await this.readDir(messagesDir).catch(() => []);

      for (const threadFolder of threads) {
        const threadPath = join(messagesDir, threadFolder);
        if (!(await this.isDirectory(threadPath))) continue;

        // Find message files
        const messageFiles = await this.findFiles(threadPath, ['.json'], false).catch(() => []);
        const sortedFiles = messageFiles
          .filter(f => f.includes('message_'))
          .sort((a, b) => {
            const numA = parseInt(a.match(/message_(\d+)\.json/)?.[1] || '0');
            const numB = parseInt(b.match(/message_(\d+)\.json/)?.[1] || '0');
            return numA - numB;
          });

        if (sortedFiles.length === 0) continue;

        try {
          // Parse first file to get conversation metadata
          const firstConv = await this.readJson<InstagramConversation>(sortedFiles[0]);

          // Yield conversation node
          yield this.conversationToNode(firstConv, threadFolder);

          // Yield messages from all files
          let position = 0;
          for (const file of sortedFiles) {
            const conv = await this.readJson<InstagramConversation>(file);
            // Messages are in reverse chronological order
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
  }

  private async *parseSavedPosts(
    source: AdapterSource,
    _options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    const savedPath = join(
      source.path,
      'your_instagram_activity',
      'saved',
      'saved_posts.json'
    );

    if (!(await this.fileExists(savedPath))) return;

    try {
      const data = await this.readJson<{ saved_saved_media?: InstagramSavedPost[] }>(savedPath);
      const savedPosts = data.saved_saved_media || [];

      for (const saved of savedPosts) {
        const node = this.savedPostToNode(saved);
        if (node) yield node;
      }
    } catch (error) {
      this.log('warn', `Failed to parse saved posts`, error);
    }
  }

  private async *parsePosts(
    source: AdapterSource,
    _options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    // Posts are typically in media/posts/ with JSON metadata
    const postsDir = join(source.path, 'media', 'posts');
    if (!(await this.isDirectory(postsDir))) return;

    // Look for posts.json or iterate through folders
    const postsJsonPath = join(source.path, 'content', 'posts_1.json');
    if (await this.fileExists(postsJsonPath)) {
      try {
        const posts = await this.readJson<InstagramPost[]>(postsJsonPath);
        for (let i = 0; i < posts.length; i++) {
          const node = this.postToNode(posts[i], i);
          if (node) yield node;
        }
      } catch (error) {
        this.log('warn', `Failed to parse posts JSON`, error);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // CONVERTERS
  // ─────────────────────────────────────────────────────────────────

  private commentToNode(comment: InstagramComment): ImportedNode | null {
    const content = comment.string_map_data?.Comment?.value;
    if (!content) return null;

    const mediaOwner = comment.string_map_data?.['Media Owner']?.value || '';
    const timestamp = comment.string_map_data?.Time?.timestamp;

    const id = `comment-${timestamp || Date.now()}`;
    const date = timestamp ? this.parseTimestamp(timestamp * 1000) : undefined;

    return {
      id,
      uri: this.generateUri('comment', id),
      contentHash: this.hashContent(content),
      content: this.fixEncoding(content),
      format: 'text',
      sourceType: 'instagram-comment',
      sourceCreatedAt: date,
      metadata: {
        mediaOwner: this.fixEncoding(mediaOwner),
        mediaUri: comment.media_list_data?.[0]?.uri,
      },
    };
  }

  private likeToNode(like: InstagramLike): ImportedNode | null {
    const likeData = like.string_list_data?.[0];
    if (!likeData) return null;

    const timestamp = likeData.timestamp;
    const id = `like-${timestamp || Date.now()}`;
    const date = timestamp ? this.parseTimestamp(timestamp * 1000) : undefined;

    return {
      id,
      uri: this.generateUri('like', id),
      contentHash: this.hashContent(`like:${likeData.href || ''}:${timestamp}`),
      content: likeData.value || like.title || 'Liked post',
      format: 'text',
      sourceType: 'instagram-like',
      sourceCreatedAt: date,
      links: likeData.href ? [
        {
          type: 'references',
          targetUri: likeData.href,
        },
      ] : undefined,
      metadata: {
        title: like.title,
        href: likeData.href,
      },
    };
  }

  private savedPostToNode(saved: InstagramSavedPost): ImportedNode | null {
    const timestamp = saved.string_map_data?.['Saved on']?.timestamp;
    const id = `saved-${timestamp || Date.now()}`;
    const date = timestamp ? this.parseTimestamp(timestamp * 1000) : undefined;

    return {
      id,
      uri: this.generateUri('saved', id),
      contentHash: this.hashContent(`saved:${saved.title || ''}:${timestamp}`),
      content: saved.title || 'Saved post',
      format: 'text',
      sourceType: 'instagram-saved',
      sourceCreatedAt: date,
      metadata: {
        title: saved.title,
      },
    };
  }

  private conversationToNode(conv: InstagramConversation, threadFolder: string): ImportedNode {
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
      sourceType: 'instagram-conversation',
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
    msg: InstagramMessage,
    conv: InstagramConversation,
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
      sourceType: 'instagram-message',
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
        shareLink: msg.share?.link,
        reactions: msg.reactions?.map(r => ({
          reaction: r.reaction,
          actor: this.fixEncoding(r.actor),
        })),
      },
    };
  }

  private postToNode(post: InstagramPost, index: number): ImportedNode | null {
    const timestamp = post.creation_timestamp;
    const id = `post-${timestamp || index}`;
    const date = timestamp ? this.parseTimestamp(timestamp * 1000) : undefined;

    // Extract media
    const media: MediaReference[] = [];
    if (post.media) {
      for (const m of post.media) {
        if (m.uri) {
          media.push({
            id: `media-${id}-${media.length}`,
            type: this.classifyMediaUri(m.uri),
            localPath: m.uri,
            alt: m.title,
          });
        }
      }
    }

    const content = post.title || '';

    return {
      id,
      uri: this.generateUri('post', id),
      contentHash: this.hashContent(content || `post-${timestamp}`),
      content: this.fixEncoding(content),
      format: 'text',
      sourceType: 'instagram-post',
      sourceCreatedAt: date,
      media: media.length > 0 ? media : undefined,
      metadata: {
        title: post.title ? this.fixEncoding(post.title) : undefined,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  private classifyMediaUri(uri: string): MediaReference['type'] {
    const lower = uri.toLowerCase();
    if (/\.(jpg|jpeg|png|gif|webp|heic)$/i.test(lower)) {
      return 'image';
    }
    if (/\.(mp4|mov|avi|webm)$/i.test(lower)) {
      return 'video';
    }
    if (/\.(mp3|m4a|wav|ogg)$/i.test(lower)) {
      return 'audio';
    }
    return 'other';
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════

export const instagramAdapter = new InstagramAdapter();
