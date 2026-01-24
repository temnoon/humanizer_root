/**
 * Twitter/X Adapter
 *
 * Parses Twitter data exports (GDPR / Settings > Download your data).
 *
 * Export structure:
 * - data/tweet.js - User's tweets (wrapped in JS)
 * - data/like.js - Liked tweets
 * - data/direct-messages.js - DMs
 * - data/direct-messages-group.js - Group DMs
 * - data/follower.js - Followers
 * - data/following.js - Following
 * - data/account.js - Account info
 * - assets/media/ - Media files
 *
 * Output content types:
 * - twitter-tweet
 * - twitter-retweet
 * - twitter-quote
 * - twitter-reply
 * - twitter-dm
 * - twitter-group-dm
 * - twitter-like
 * - twitter-bookmark
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
// TYPES FOR TWITTER EXPORT FORMAT
// ═══════════════════════════════════════════════════════════════════

interface TwitterTweetWrapper {
  tweet: TwitterTweet;
}

interface TwitterTweet {
  id: string;
  id_str: string;
  full_text: string;
  created_at: string;
  truncated: boolean;
  display_text_range: [number, number];
  entities: TwitterEntities;
  extended_entities?: TwitterExtendedEntities;
  source: string;
  in_reply_to_status_id?: string;
  in_reply_to_status_id_str?: string;
  in_reply_to_user_id?: string;
  in_reply_to_user_id_str?: string;
  in_reply_to_screen_name?: string;
  conversation_id?: string;
  conversation_id_str?: string;
  retweet_count: string | number;
  favorite_count: string | number;
  favorited: boolean;
  retweeted: boolean;
  possibly_sensitive?: boolean;
  lang?: string;
  // Retweet indicator
  retweeted_status_id?: string;
  retweeted_status_id_str?: string;
  // Quote tweet
  quoted_status_id?: string;
  quoted_status_id_str?: string;
}

interface TwitterEntities {
  hashtags: Array<{
    text: string;
    indices: [number, number];
  }>;
  symbols: Array<{
    text: string;
    indices: [number, number];
  }>;
  user_mentions: Array<{
    screen_name: string;
    name: string;
    id: string;
    id_str: string;
    indices: [number, number];
  }>;
  urls: Array<{
    url: string;
    expanded_url: string;
    display_url: string;
    indices: [number, number];
  }>;
  media?: TwitterMediaEntity[];
}

interface TwitterExtendedEntities {
  media: TwitterMediaEntity[];
}

interface TwitterMediaEntity {
  id: string;
  id_str: string;
  indices: [number, number];
  media_url: string;
  media_url_https: string;
  url: string;
  display_url: string;
  expanded_url: string;
  type: 'photo' | 'video' | 'animated_gif';
  sizes: {
    thumb: { w: number; h: number; resize: string };
    small: { w: number; h: number; resize: string };
    medium: { w: number; h: number; resize: string };
    large: { w: number; h: number; resize: string };
  };
  video_info?: {
    aspect_ratio: [number, number];
    duration_millis?: number;
    variants: Array<{
      bitrate?: number;
      content_type: string;
      url: string;
    }>;
  };
}

interface TwitterDMConversation {
  dmConversation: {
    conversationId: string;
    messages: TwitterDMMessage[];
  };
}

interface TwitterDMMessage {
  messageCreate?: {
    id: string;
    senderId: string;
    recipientId?: string;
    createdAt: string;
    text: string;
    mediaUrls?: string[];
    reactions?: Array<{
      senderId: string;
      reactionKey: string;
      eventId: string;
      createdAt: string;
    }>;
  };
  joinConversation?: {
    initiatingUserId: string;
    participantsSnapshot: string[];
    createdAt: string;
  };
  participantsLeave?: {
    userIds: string[];
    createdAt: string;
  };
}

interface TwitterLikeWrapper {
  like: {
    tweetId: string;
    fullText?: string;
    expandedUrl?: string;
  };
}

interface TwitterAccountWrapper {
  account: {
    email?: string;
    createdVia?: string;
    username?: string;
    accountId?: string;
    createdAt?: string;
    accountDisplayName?: string;
  };
}

// ═══════════════════════════════════════════════════════════════════
// TWITTER ADAPTER
// ═══════════════════════════════════════════════════════════════════

export class TwitterAdapter extends BaseAdapter {
  readonly id = 'twitter';
  readonly name = 'Twitter / X';
  readonly description = 'Import Twitter/X data exports';
  readonly version = '1.0.0';
  readonly contentTypes = [
    'twitter-tweet',
    'twitter-retweet',
    'twitter-quote',
    'twitter-reply',
    'twitter-dm',
    'twitter-group-dm',
    'twitter-like',
    'twitter-bookmark',
  ];
  readonly supportedExtensions = ['.zip', '.js', '.json'];

  // ─────────────────────────────────────────────────────────────────
  // DETECTION
  // ─────────────────────────────────────────────────────────────────

  async detect(source: AdapterSource): Promise<DetectionResult> {
    try {
      const path = source.path;

      // Check for data directory with Twitter JS files
      const dataDir = join(path, 'data');
      if (await this.isDirectory(dataDir)) {
        const tweetJs = join(dataDir, 'tweet.js');
        const accountJs = join(dataDir, 'account.js');

        const hasTweets = await this.fileExists(tweetJs);
        const hasAccount = await this.fileExists(accountJs);

        if (hasTweets && hasAccount) {
          return {
            canHandle: true,
            confidence: 0.95,
            format: 'twitter-archive',
            reason: 'Found data/tweet.js and data/account.js',
          };
        }

        if (hasTweets) {
          return {
            canHandle: true,
            confidence: 0.8,
            format: 'twitter-archive',
            reason: 'Found data/tweet.js',
          };
        }

        // Check for manifest.js
        const manifestJs = join(dataDir, 'manifest.js');
        if (await this.fileExists(manifestJs)) {
          return {
            canHandle: true,
            confidence: 0.7,
            format: 'twitter-archive',
            reason: 'Found data/manifest.js',
          };
        }
      }

      // Check root for Twitter files (older format)
      const tweetJsRoot = join(path, 'tweet.js');
      if (await this.fileExists(tweetJsRoot)) {
        return {
          canHandle: true,
          confidence: 0.75,
          format: 'twitter-archive-legacy',
          reason: 'Found tweet.js in root',
        };
      }

      return {
        canHandle: false,
        confidence: 0,
        reason: 'No Twitter export structure detected',
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
        message: 'Not a valid Twitter export',
        details: { reason: detection.reason },
      });
      return { valid: false, errors, warnings };
    }

    // Check for tweets
    const tweetPath = join(source.path, 'data', 'tweet.js');
    if (await this.fileExists(tweetPath)) {
      try {
        const tweets = await this.parseTwitterJs<TwitterTweetWrapper[]>(tweetPath);
        if (tweets.length === 0) {
          warnings.push({
            code: 'EMPTY_TWEETS',
            message: 'No tweets found in export',
            path: tweetPath,
          });
        }
      } catch (error) {
        errors.push({
          code: 'PARSE_ERROR',
          message: `Failed to parse tweet.js: ${error}`,
          path: tweetPath,
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

    // Parse account info
    const accountPath = join(source.path, 'data', 'account.js');
    if (await this.fileExists(accountPath)) {
      try {
        const accounts = await this.parseTwitterJs<TwitterAccountWrapper[]>(accountPath);
        if (accounts.length > 0) {
          const acc = accounts[0].account;
          accountInfo = {
            id: acc.accountId,
            name: acc.accountDisplayName,
            handle: acc.username,
            email: acc.email,
          };
        }
      } catch (error) {
        console.debug('[TwitterAdapter] Failed to parse account:', error);
      }
    }

    // Count tweets
    const tweetPath = join(source.path, 'data', 'tweet.js');
    if (await this.fileExists(tweetPath)) {
      try {
        const tweets = await this.parseTwitterJs<TwitterTweetWrapper[]>(tweetPath);
        estimatedCount += tweets.length;
        contentTypes.add('twitter-tweet');

        for (const { tweet } of tweets) {
          const date = this.parseTwitterDate(tweet.created_at);
          if (date) {
            if (!earliestDate || date < earliestDate) earliestDate = date;
            if (!latestDate || date > latestDate) latestDate = date;
          }
        }
      } catch (error) {
        console.debug('[TwitterAdapter] Failed to parse tweets:', error);
      }
    }

    // Count DMs
    const dmPath = join(source.path, 'data', 'direct-messages.js');
    if (await this.fileExists(dmPath)) {
      try {
        const dms = await this.parseTwitterJs<TwitterDMConversation[]>(dmPath);
        for (const conv of dms) {
          estimatedCount += conv.dmConversation.messages.length;
        }
        contentTypes.add('twitter-dm');
      } catch (error) {
        console.debug('[TwitterAdapter] Failed to parse DMs:', error);
      }
    }

    // Count likes
    const likePath = join(source.path, 'data', 'like.js');
    if (await this.fileExists(likePath)) {
      try {
        const likes = await this.parseTwitterJs<TwitterLikeWrapper[]>(likePath);
        estimatedCount += likes.length;
        contentTypes.add('twitter-like');
      } catch (error) {
        console.debug('[TwitterAdapter] Failed to parse likes:', error);
      }
    }

    return {
      format: detection.format || 'twitter-archive',
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
    // Parse tweets
    yield* this.parseTweets(source, options);

    // Parse DMs
    yield* this.parseDMs(source, options);

    // Parse likes
    yield* this.parseLikes(source, options);
  }

  private async *parseTweets(
    source: AdapterSource,
    _options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    const tweetPath = join(source.path, 'data', 'tweet.js');
    if (!(await this.fileExists(tweetPath))) return;

    const tweets = await this.parseTwitterJs<TwitterTweetWrapper[]>(tweetPath);
    this.updateProgress({ total: tweets.length });

    // Build thread map for linking
    const tweetMap = new Map<string, TwitterTweet>();
    for (const { tweet } of tweets) {
      tweetMap.set(tweet.id_str || tweet.id, tweet);
    }

    for (const { tweet } of tweets) {
      yield this.tweetToNode(tweet, tweetMap);
    }
  }

  private async *parseDMs(
    source: AdapterSource,
    _options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    const dmPath = join(source.path, 'data', 'direct-messages.js');
    if (!(await this.fileExists(dmPath))) return;

    const conversations = await this.parseTwitterJs<TwitterDMConversation[]>(dmPath);

    for (const { dmConversation } of conversations) {
      let position = 0;
      for (const msg of dmConversation.messages) {
        if (msg.messageCreate) {
          yield this.dmToNode(msg.messageCreate, dmConversation.conversationId, position);
          position++;
        }
      }
    }
  }

  private async *parseLikes(
    source: AdapterSource,
    _options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    const likePath = join(source.path, 'data', 'like.js');
    if (!(await this.fileExists(likePath))) return;

    const likes = await this.parseTwitterJs<TwitterLikeWrapper[]>(likePath);

    for (const { like } of likes) {
      yield this.likeToNode(like);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // CONVERTERS
  // ─────────────────────────────────────────────────────────────────

  private tweetToNode(tweet: TwitterTweet, tweetMap: Map<string, TwitterTweet>): ImportedNode {
    const id = tweet.id_str || tweet.id;
    const sourceType = this.classifyTweet(tweet);

    const node: ImportedNode = {
      id,
      uri: this.generateUri('tweet', id),
      contentHash: this.hashContent(tweet.full_text),
      content: tweet.full_text,
      format: 'text',
      sourceType,
      sourceCreatedAt: this.parseTwitterDate(tweet.created_at),
      media: this.extractTweetMedia(tweet),
      links: this.buildTweetLinks(tweet, tweetMap),
      metadata: {
        tweetId: id,
        conversationId: tweet.conversation_id_str || tweet.conversation_id,
        inReplyToStatusId: tweet.in_reply_to_status_id_str,
        inReplyToUserId: tweet.in_reply_to_user_id_str,
        inReplyToScreenName: tweet.in_reply_to_screen_name,
        isRetweet: !!tweet.retweeted_status_id_str,
        retweetedStatusId: tweet.retweeted_status_id_str,
        quotedStatusId: tweet.quoted_status_id_str,
        retweetCount: parseInt(String(tweet.retweet_count)) || 0,
        favoriteCount: parseInt(String(tweet.favorite_count)) || 0,
        hashtags: tweet.entities.hashtags.map(h => h.text),
        mentions: tweet.entities.user_mentions.map(m => m.screen_name),
        urls: tweet.entities.urls.map(u => u.expanded_url),
        source: this.parseTwitterSource(tweet.source),
        language: tweet.lang,
        possiblySensitive: tweet.possibly_sensitive,
      },
    };

    // Set parent for replies
    if (tweet.in_reply_to_status_id_str) {
      node.parentUri = this.generateUri('tweet', tweet.in_reply_to_status_id_str);
    }

    // Set thread root
    if (tweet.conversation_id_str && tweet.conversation_id_str !== id) {
      node.threadRootUri = this.generateUri('tweet', tweet.conversation_id_str);
    }

    return node;
  }

  private dmToNode(
    msg: NonNullable<TwitterDMMessage['messageCreate']>,
    conversationId: string,
    position: number
  ): ImportedNode {
    const id = msg.id;

    return {
      id,
      uri: this.generateUri('dm', id),
      contentHash: this.hashContent(msg.text),
      content: msg.text,
      format: 'text',
      sourceType: 'twitter-dm',
      sourceCreatedAt: this.parseTimestamp(msg.createdAt),
      author: {
        id: msg.senderId,
      },
      parentUri: this.generateUri('dm-conversation', conversationId),
      threadRootUri: this.generateUri('dm-conversation', conversationId),
      position,
      media: msg.mediaUrls?.map((url, i) => ({
        id: `${id}-media-${i}`,
        type: 'image' as const,
        url,
      })),
      links: [
        {
          type: 'parent',
          targetUri: this.generateUri('dm-conversation', conversationId),
        },
      ],
      metadata: {
        messageId: id,
        conversationId,
        senderId: msg.senderId,
        recipientId: msg.recipientId,
        reactions: msg.reactions,
      },
    };
  }

  private likeToNode(like: TwitterLikeWrapper['like']): ImportedNode {
    const id = like.tweetId;

    return {
      id: `like-${id}`,
      uri: this.generateUri('like', id),
      contentHash: this.hashContent(`like:${id}:${like.fullText || ''}`),
      content: like.fullText || `Liked tweet ${id}`,
      format: 'text',
      sourceType: 'twitter-like',
      links: [
        {
          type: 'references',
          targetUri: this.generateUri('tweet', id),
          metadata: { likedTweetId: id },
        },
      ],
      metadata: {
        likedTweetId: id,
        expandedUrl: like.expandedUrl,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  private classifyTweet(tweet: TwitterTweet): string {
    if (tweet.retweeted_status_id_str) return 'twitter-retweet';
    if (tweet.quoted_status_id_str) return 'twitter-quote';
    if (tweet.in_reply_to_status_id_str) return 'twitter-reply';
    return 'twitter-tweet';
  }

  private extractTweetMedia(tweet: TwitterTweet): MediaReference[] {
    const media: MediaReference[] = [];
    const entities = tweet.extended_entities?.media || tweet.entities.media || [];

    for (const m of entities) {
      const ref: MediaReference = {
        id: m.id_str || m.id,
        type: m.type === 'photo' ? 'image' : m.type === 'video' ? 'video' : 'image',
        url: m.media_url_https || m.media_url,
        dimensions: m.sizes.large ? { width: m.sizes.large.w, height: m.sizes.large.h } : undefined,
        metadata: {
          displayUrl: m.display_url,
          expandedUrl: m.expanded_url,
        },
      };

      if (m.video_info) {
        ref.duration = m.video_info.duration_millis
          ? Math.round(m.video_info.duration_millis / 1000)
          : undefined;
        ref.metadata = {
          ...ref.metadata,
          aspectRatio: m.video_info.aspect_ratio,
          variants: m.video_info.variants,
        };
      }

      media.push(ref);
    }

    return media;
  }

  private buildTweetLinks(tweet: TwitterTweet, tweetMap: Map<string, TwitterTweet>): ContentLink[] {
    const links: ContentLink[] = [];

    // Reply to
    if (tweet.in_reply_to_status_id_str) {
      links.push({
        type: 'reply-to',
        targetUri: this.generateUri('tweet', tweet.in_reply_to_status_id_str),
      });
    }

    // Quote
    if (tweet.quoted_status_id_str) {
      links.push({
        type: 'quotes',
        targetUri: this.generateUri('tweet', tweet.quoted_status_id_str),
      });
    }

    // Retweet
    if (tweet.retweeted_status_id_str) {
      links.push({
        type: 'retweet-of',
        targetUri: this.generateUri('tweet', tweet.retweeted_status_id_str),
      });
    }

    // Thread root
    if (tweet.conversation_id_str && tweet.conversation_id_str !== (tweet.id_str || tweet.id)) {
      links.push({
        type: 'thread-root',
        targetUri: this.generateUri('tweet', tweet.conversation_id_str),
      });
    }

    return links;
  }

  private async parseTwitterJs<T>(path: string): Promise<T> {
    const content = await this.readFile(path);
    const json = this.stripJsWrapper(content);
    return JSON.parse(json) as T;
  }

  private parseTwitterDate(dateStr: string): Date | undefined {
    if (!dateStr) return undefined;

    // Twitter format: "Wed Oct 10 20:19:24 +0000 2018"
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? undefined : date;
  }

  private parseTwitterSource(source: string | undefined): string {
    if (!source) return 'Unknown';
    // Extract text from HTML like: <a href="..." rel="nofollow">Twitter Web App</a>
    const match = source.match(/>([^<]+)</);
    return match ? match[1] : source;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════

export const twitterAdapter = new TwitterAdapter();
