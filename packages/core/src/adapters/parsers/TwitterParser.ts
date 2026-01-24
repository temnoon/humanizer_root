/**
 * Twitter/X Export Parser
 *
 * Parses Twitter GDPR data export (JS format with window.YTD.* wrapper)
 * Supports: tweets.js, direct-messages.js
 *
 * Structure:
 * - Tweets: One conversation per tweet (natural content unit)
 * - DMs: Grouped by conversation thread
 */

import * as path from 'path';
import * as fs from 'fs';
import type {
  Conversation,
  ConversationMapping,
  Message,
  MessageAuthor,
  MessageContent,
  MessageAttachment,
} from './types.js';

/**
 * Twitter tweet structure
 */
interface Tweet {
  tweet: {
    id: string;
    id_str: string;
    full_text: string;
    created_at: string;
    source: string;
    in_reply_to_status_id?: string;
    in_reply_to_status_id_str?: string;
    in_reply_to_user_id?: string;
    in_reply_to_user_id_str?: string;
    in_reply_to_screen_name?: string;
    retweet_count: string;
    favorite_count: string;
    favorited: boolean;
    retweeted: boolean;
    lang: string;
    entities?: {
      hashtags?: Array<{ text: string; indices: string[] }>;
      user_mentions?: Array<{ screen_name: string; name: string; id_str: string }>;
      urls?: Array<{ url: string; expanded_url: string; display_url: string }>;
      media?: Array<{
        id_str: string;
        media_url_https: string;
        type: string;
        url: string;
      }>;
    };
    extended_entities?: {
      media?: Array<{
        id_str: string;
        media_url_https: string;
        type: string;
        video_info?: {
          variants: Array<{ url: string; bitrate?: number; content_type: string }>;
        };
      }>;
    };
  };
}

/**
 * Twitter DM conversation structure
 */
interface DMConversation {
  dmConversation: {
    conversationId: string;
    messages: Array<{
      messageCreate?: {
        id: string;
        senderId: string;
        recipientId: string;
        text: string;
        createdAt: string;
        mediaUrls?: string[];
        reactions?: Array<{ emoticon: string; senderId: string }>;
      };
      joinConversation?: {
        initiatingUserId: string;
        participantsSnapshot: string[];
        createdAt: string;
      };
    }>;
  };
}

export class TwitterParser {
  private userId: string = '';
  private username: string = '';

  /**
   * Parse all content from an extracted Twitter export directory
   */
  async parseConversations(extractedDir: string): Promise<Conversation[]> {
    const conversations: Conversation[] = [];

    // Get account info for user ID
    await this.loadAccountInfo(extractedDir);

    // Parse tweets - one conversation per tweet
    const tweetsFile = path.join(extractedDir, 'data', 'tweets.js');
    if (fs.existsSync(tweetsFile)) {
      const tweetConversations = await this.parseTweets(tweetsFile, extractedDir);
      conversations.push(...tweetConversations);
      console.log(`Parsed ${tweetConversations.length} tweets`);
    }

    // Parse DMs - grouped by conversation
    const dmsFile = path.join(extractedDir, 'data', 'direct-messages.js');
    if (fs.existsSync(dmsFile)) {
      const dmConversations = await this.parseDMs(dmsFile);
      conversations.push(...dmConversations);
      console.log(`Parsed ${dmConversations.length} DM conversations`);
    }

    // Parse group DMs
    const groupDmsFile = path.join(extractedDir, 'data', 'direct-messages-group.js');
    if (fs.existsSync(groupDmsFile)) {
      const groupDmConversations = await this.parseDMs(groupDmsFile, true);
      conversations.push(...groupDmConversations);
      console.log(`Parsed ${groupDmConversations.length} group DM conversations`);
    }

    console.log(`Successfully parsed ${conversations.length} Twitter conversations total`);
    return conversations;
  }

  /**
   * Load account info to get user ID and username
   */
  private async loadAccountInfo(extractedDir: string): Promise<void> {
    const accountFile = path.join(extractedDir, 'data', 'account.js');
    if (fs.existsSync(accountFile)) {
      try {
        const data = this.parseTwitterJS<Array<{ account?: { accountId?: string; username?: string } }>>(accountFile);
        if (data && data[0]?.account) {
          this.userId = data[0].account.accountId || '';
          this.username = data[0].account.username || '';
        }
      } catch (err) {
        console.warn('Could not load Twitter account info:', err);
      }
    }
  }

  /**
   * Parse tweets - one conversation per tweet
   */
  private async parseTweets(
    tweetsFile: string,
    extractedDir: string
  ): Promise<Conversation[]> {
    const tweets = this.parseTwitterJS<Tweet[]>(tweetsFile) || [];
    const conversations: Conversation[] = [];

    // Index tweets by ID for thread context
    const tweetById = new Map<string, Tweet>();
    for (const tweet of tweets) {
      tweetById.set(tweet.tweet.id_str, tweet);
    }

    for (const tweet of tweets) {
      const t = tweet.tweet;
      const conversationId = `twitter_tweet_${t.id_str}`;
      const timestamp = new Date(t.created_at).getTime() / 1000;

      // Build mapping with single message (the tweet)
      const mapping: ConversationMapping = {};
      const rootId = `${conversationId}_root`;
      const tweetNodeId = `${conversationId}_content`;

      mapping[rootId] = {
        id: rootId,
        message: undefined,
        parent: undefined,
        children: [tweetNodeId],
      };

      // Extract attachments
      const attachments: MessageAttachment[] = [];
      const media = t.extended_entities?.media || t.entities?.media || [];
      media.forEach((m, idx) => {
        attachments.push({
          id: m.id_str,
          name: `media_${idx}.${m.type === 'video' ? 'mp4' : 'jpg'}`,
          mimeType: m.type === 'video' ? 'video/mp4' : 'image/jpeg',
        });
      });

      const message: Message = {
        id: tweetNodeId,
        author: {
          role: 'user',
          name: this.username || 'self',
        },
        create_time: timestamp,
        content: {
          content_type: 'text',
          parts: [t.full_text || ''],
        },
        status: 'finished_successfully',
        metadata: {
          twitter_id: t.id_str,
          attachments: attachments.length > 0 ? attachments : undefined,
          retweet_count: parseInt(t.retweet_count) || 0,
          favorite_count: parseInt(t.favorite_count) || 0,
          lang: t.lang,
          // Thread context
          in_reply_to_tweet_id: t.in_reply_to_status_id_str || undefined,
          in_reply_to_user: t.in_reply_to_screen_name || undefined,
          // Entities
          hashtags: t.entities?.hashtags?.map((h) => h.text),
          mentions: t.entities?.user_mentions?.map((m) => `@${m.screen_name}`),
          urls: t.entities?.urls?.map((u) => u.expanded_url),
        },
      };

      mapping[tweetNodeId] = {
        id: tweetNodeId,
        message,
        parent: rootId,
        children: [],
      };

      // Generate title
      let title = t.full_text?.slice(0, 60) || 'Tweet';
      if (title.length < (t.full_text?.length || 0)) {
        title += '...';
      }

      // Determine tweet type for title prefix
      let titlePrefix = '';
      if (t.in_reply_to_screen_name) {
        if (t.in_reply_to_screen_name === this.username) {
          titlePrefix = '🧵 '; // Part of own thread
        } else {
          titlePrefix = `↩️ @${t.in_reply_to_screen_name}: `;
        }
      }

      // Extract media files for this tweet
      const mediaFiles = this.extractTweetMediaFiles(t, extractedDir);

      conversations.push({
        conversation_id: conversationId,
        title: titlePrefix + title,
        create_time: timestamp,
        update_time: timestamp,
        mapping,
        moderation_results: [],
        _source: 'twitter',
        _import_date: new Date().toISOString(),
        _original_id: t.id_str,
        _media_files: mediaFiles.length > 0 ? mediaFiles : undefined,
        _twitter_metadata: {
          username: this.username,
          tweet_count: 1,
          retweet_count: parseInt(t.retweet_count) || 0,
        },
      });
    }

    return conversations;
  }

  /**
   * Parse DMs - grouped by conversation thread
   */
  private async parseDMs(dmsFile: string, isGroup = false): Promise<Conversation[]> {
    const dmData = this.parseTwitterJS<DMConversation[]>(dmsFile) || [];
    const conversations: Conversation[] = [];

    for (const dm of dmData) {
      const conv = dm.dmConversation;
      if (!conv.messages || conv.messages.length === 0) continue;

      const conversationId = `twitter_dm_${conv.conversationId}`;
      const mapping = this.buildDMMapping(conv.messages, conversationId);

      const timestamps = conv.messages
        .map((m) => m.messageCreate?.createdAt || m.joinConversation?.createdAt)
        .filter((t): t is string => !!t)
        .map((t) => new Date(t).getTime() / 1000);

      if (timestamps.length === 0) continue;

      // Get participant IDs for title
      const participants = new Set<string>();
      conv.messages.forEach((m) => {
        if (m.messageCreate) {
          participants.add(m.messageCreate.senderId);
          participants.add(m.messageCreate.recipientId);
        }
      });
      participants.delete(this.userId); // Remove self

      const otherParticipants = Array.from(participants);
      const title = isGroup
        ? `Group DM (${otherParticipants.length + 1} participants)`
        : `DM with ${otherParticipants[0] || 'unknown'}`;

      conversations.push({
        conversation_id: conversationId,
        title,
        create_time: Math.min(...timestamps),
        update_time: Math.max(...timestamps),
        mapping,
        moderation_results: [],
        _source: 'twitter',
        _import_date: new Date().toISOString(),
        _original_id: conv.conversationId,
        _twitter_metadata: {
          username: this.username,
          dm_count: conv.messages.filter((m) => m.messageCreate).length,
        },
      });
    }

    return conversations;
  }

  /**
   * Build conversation mapping from DMs
   */
  private buildDMMapping(
    messages: DMConversation['dmConversation']['messages'],
    conversationId: string
  ): ConversationMapping {
    const mapping: ConversationMapping = {};

    // Filter to actual messages and sort chronologically
    const actualMessages = messages
      .filter((m) => m.messageCreate)
      .sort((a, b) => {
        const timeA = new Date(a.messageCreate!.createdAt).getTime();
        const timeB = new Date(b.messageCreate!.createdAt).getTime();
        return timeA - timeB;
      });

    const rootId = `${conversationId}_root`;
    mapping[rootId] = {
      id: rootId,
      message: undefined,
      parent: undefined,
      children: actualMessages.length > 0 ? [`${conversationId}_dm_0`] : [],
    };

    actualMessages.forEach((msg, index) => {
      const dm = msg.messageCreate!;
      const nodeId = `${conversationId}_dm_${index}`;
      const prevNodeId = index === 0 ? rootId : `${conversationId}_dm_${index - 1}`;
      const nextNodeId =
        index < actualMessages.length - 1 ? `${conversationId}_dm_${index + 1}` : undefined;

      const isSelf = dm.senderId === this.userId;

      const message: Message = {
        id: nodeId,
        author: {
          role: 'user',
          name: isSelf ? (this.username || 'self') : dm.senderId,
        },
        create_time: new Date(dm.createdAt).getTime() / 1000,
        content: {
          content_type: 'text',
          parts: [dm.text || ''],
        },
        status: 'finished_successfully',
        metadata: {
          dm_id: dm.id,
          sender_id: dm.senderId,
          recipient_id: dm.recipientId,
          reactions: dm.reactions,
          media_urls: dm.mediaUrls,
        },
      };

      mapping[nodeId] = {
        id: nodeId,
        message,
        parent: prevNodeId,
        children: nextNodeId ? [nextNodeId] : [],
      };
    });

    return mapping;
  }

  /**
   * Extract media files for a single tweet
   */
  private extractTweetMediaFiles(tweet: Tweet['tweet'], extractedDir: string): string[] {
    const mediaFiles: string[] = [];
    const mediaDir = path.join(extractedDir, 'data', 'tweets_media');

    if (!fs.existsSync(mediaDir)) return mediaFiles;

    const media = tweet.extended_entities?.media || tweet.entities?.media || [];
    if (media.length === 0) return mediaFiles;

    try {
      const files = fs.readdirSync(mediaDir);
      const tweetId = tweet.id_str;

      // Twitter media files are named with tweet ID prefix: {tweet_id}-{media_id}.ext
      const matchingFiles = files.filter((f) => f.startsWith(tweetId));
      matchingFiles.forEach((f) => {
        mediaFiles.push(path.join(mediaDir, f));
      });
    } catch {
      // Ignore errors reading media directory
    }

    return mediaFiles;
  }

  /**
   * Parse Twitter JS file (strips window.YTD.* wrapper)
   */
  private parseTwitterJS<T>(filePath: string): T | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      // Strip the window.YTD.*.part0 = prefix
      const jsonStart = content.indexOf('[');
      if (jsonStart === -1) {
        const objStart = content.indexOf('{');
        if (objStart === -1) return null;
        return JSON.parse(content.slice(objStart));
      }
      return JSON.parse(content.slice(jsonStart));
    } catch (err) {
      console.error(`Failed to parse Twitter JS file: ${filePath}`, err);
      return null;
    }
  }

  /**
   * Detect if a directory contains Twitter export format
   */
  static async detectFormat(extractedDir: string): Promise<boolean> {
    const dataDir = path.join(extractedDir, 'data');
    if (!fs.existsSync(dataDir)) return false;

    const hasTweets = fs.existsSync(path.join(dataDir, 'tweets.js'));
    const hasAccount = fs.existsSync(path.join(dataDir, 'account.js'));

    if (hasTweets && hasAccount) {
      try {
        const content = fs.readFileSync(path.join(dataDir, 'tweets.js'), 'utf-8');
        return content.startsWith('window.YTD.tweets');
      } catch {
        return false;
      }
    }

    return false;
  }
}
