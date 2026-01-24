/**
 * Twitter/X Export Parser
 *
 * Parses Twitter GDPR data export (JS format with window.YTD.* wrapper)
 * Supports: tweets.js, direct-messages.js
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
import { findFiles } from './utils.js';

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

  /**
   * Parse all content from an extracted Twitter export directory
   */
  async parseConversations(extractedDir: string): Promise<Conversation[]> {
    const conversations: Conversation[] = [];

    // Get account info for user ID
    await this.loadAccountInfo(extractedDir);

    // Parse tweets
    const tweetsFile = path.join(extractedDir, 'data', 'tweets.js');
    if (fs.existsSync(tweetsFile)) {
      const tweetConversations = await this.parseTweets(tweetsFile, extractedDir);
      conversations.push(...tweetConversations);
      console.log(`Parsed ${tweetConversations.length} Twitter tweet conversations`);
    }

    // Parse DMs
    const dmsFile = path.join(extractedDir, 'data', 'direct-messages.js');
    if (fs.existsSync(dmsFile)) {
      const dmConversations = await this.parseDMs(dmsFile);
      conversations.push(...dmConversations);
      console.log(`Parsed ${dmConversations.length} Twitter DM conversations`);
    }

    // Parse group DMs
    const groupDmsFile = path.join(extractedDir, 'data', 'direct-messages-group.js');
    if (fs.existsSync(groupDmsFile)) {
      const groupDmConversations = await this.parseDMs(groupDmsFile, true);
      conversations.push(...groupDmConversations);
      console.log(`Parsed ${groupDmConversations.length} Twitter group DM conversations`);
    }

    console.log(`Successfully parsed ${conversations.length} Twitter conversations total`);
    return conversations;
  }

  /**
   * Load account info to get user ID
   */
  private async loadAccountInfo(extractedDir: string): Promise<void> {
    const accountFile = path.join(extractedDir, 'data', 'account.js');
    if (fs.existsSync(accountFile)) {
      try {
        const data = this.parseTwitterJS<Array<{ account?: { accountId?: string } }>>(accountFile);
        if (data && data[0]?.account) {
          this.userId = data[0].account.accountId || '';
        }
      } catch (err) {
        console.warn('Could not load Twitter account info:', err);
      }
    }
  }

  /**
   * Parse tweets.js into conversations (grouped by thread or standalone)
   */
  private async parseTweets(
    tweetsFile: string,
    extractedDir: string
  ): Promise<Conversation[]> {
    const tweets = this.parseTwitterJS<Tweet[]>(tweetsFile) || [];

    // Group tweets into threads
    const threads = this.groupTweetsIntoThreads(tweets);
    const conversations: Conversation[] = [];

    for (const [threadId, threadTweets] of threads) {
      const sorted = threadTweets.sort(
        (a, b) =>
          new Date(a.tweet.created_at).getTime() - new Date(b.tweet.created_at).getTime()
      );

      const conversationId = `twitter_${threadId}`;
      const mapping = this.buildTweetMapping(sorted, conversationId, extractedDir);

      const timestamps = sorted.map((t) => new Date(t.tweet.created_at).getTime() / 1000);
      const firstTweet = sorted[0]?.tweet;

      // Generate title from first tweet
      let title = firstTweet?.full_text?.slice(0, 50) || 'Tweet';
      if (title.length < (firstTweet?.full_text?.length || 0)) {
        title += '...';
      }

      // Check if it's a reply thread
      if (firstTweet?.in_reply_to_screen_name) {
        title = `Reply to @${firstTweet.in_reply_to_screen_name}: ${title}`;
      }

      conversations.push({
        conversation_id: conversationId,
        title,
        create_time: Math.min(...timestamps),
        update_time: Math.max(...timestamps),
        mapping,
        moderation_results: [],
        _source: 'twitter',
        _import_date: new Date().toISOString(),
        _original_id: threadId,
        _media_files: this.extractMediaFiles(sorted, extractedDir),
        _twitter_metadata: {
          username: this.userId,
          tweet_count: sorted.length,
          reply_count: sorted.filter((t) => t.tweet.in_reply_to_status_id_str).length,
        },
      });
    }

    return conversations;
  }

  /**
   * Group tweets into threads based on reply chains
   */
  private groupTweetsIntoThreads(tweets: Tweet[]): Map<string, Tweet[]> {
    const threads = new Map<string, Tweet[]>();
    const tweetById = new Map<string, Tweet>();

    // Index all tweets by ID
    for (const tweet of tweets) {
      tweetById.set(tweet.tweet.id_str, tweet);
    }

    // Find thread roots (tweets not replying to our own tweets)
    for (const tweet of tweets) {
      const replyTo = tweet.tweet.in_reply_to_status_id_str;

      if (!replyTo || !tweetById.has(replyTo)) {
        // This is a thread root
        const threadId = tweet.tweet.id_str;
        if (!threads.has(threadId)) {
          threads.set(threadId, []);
        }
        threads.get(threadId)!.push(tweet);
      } else {
        // Find the root of this thread
        let rootId = replyTo;
        let current = tweetById.get(replyTo);
        while (current?.tweet.in_reply_to_status_id_str) {
          const parentId = current.tweet.in_reply_to_status_id_str;
          if (tweetById.has(parentId)) {
            rootId = parentId;
            current = tweetById.get(parentId);
          } else {
            break;
          }
        }

        if (!threads.has(rootId)) {
          threads.set(rootId, []);
        }
        threads.get(rootId)!.push(tweet);
      }
    }

    return threads;
  }

  /**
   * Parse DMs into conversations
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

      conversations.push({
        conversation_id: conversationId,
        title: isGroup ? `Twitter Group DM ${conv.conversationId}` : `Twitter DM ${conv.conversationId}`,
        create_time: Math.min(...timestamps),
        update_time: Math.max(...timestamps),
        mapping,
        moderation_results: [],
        _source: 'twitter',
        _import_date: new Date().toISOString(),
        _original_id: conv.conversationId,
        _twitter_metadata: {
          username: this.userId,
          dm_count: conv.messages.filter((m) => m.messageCreate).length,
        },
      });
    }

    return conversations;
  }

  /**
   * Build conversation mapping from tweets
   */
  private buildTweetMapping(
    tweets: Tweet[],
    conversationId: string,
    extractedDir: string
  ): ConversationMapping {
    const mapping: ConversationMapping = {};

    const rootId = `${conversationId}_root`;
    mapping[rootId] = {
      id: rootId,
      message: undefined,
      parent: undefined,
      children: tweets.length > 0 ? [`${conversationId}_tweet_0`] : [],
    };

    tweets.forEach((tweet, index) => {
      const nodeId = `${conversationId}_tweet_${index}`;
      const prevNodeId = index === 0 ? rootId : `${conversationId}_tweet_${index - 1}`;
      const nextNodeId =
        index < tweets.length - 1 ? `${conversationId}_tweet_${index + 1}` : undefined;

      const author: MessageAuthor = {
        role: 'user',
        name: 'self',
      };

      const content: MessageContent = {
        content_type: 'text',
        parts: [tweet.tweet.full_text || ''],
      };

      // Extract attachments
      const attachments: MessageAttachment[] = [];
      const media = tweet.tweet.extended_entities?.media || tweet.tweet.entities?.media || [];
      media.forEach((m, idx) => {
        attachments.push({
          id: m.id_str,
          name: `media_${idx}.${m.type === 'video' ? 'mp4' : 'jpg'}`,
          mimeType: m.type === 'video' ? 'video/mp4' : 'image/jpeg',
        });
      });

      const message: Message = {
        id: nodeId,
        author,
        create_time: new Date(tweet.tweet.created_at).getTime() / 1000,
        content,
        status: 'finished_successfully',
        metadata: {
          attachments: attachments.length > 0 ? attachments : undefined,
          retweet_count: tweet.tweet.retweet_count,
          favorite_count: tweet.tweet.favorite_count,
          lang: tweet.tweet.lang,
          in_reply_to_screen_name: tweet.tweet.in_reply_to_screen_name,
          hashtags: tweet.tweet.entities?.hashtags?.map((h) => h.text),
          mentions: tweet.tweet.entities?.user_mentions?.map((m) => m.screen_name),
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
   * Build conversation mapping from DMs
   */
  private buildDMMapping(
    messages: DMConversation['dmConversation']['messages'],
    conversationId: string
  ): ConversationMapping {
    const mapping: ConversationMapping = {};

    // Filter to actual messages
    const actualMessages = messages.filter((m) => m.messageCreate);

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
      const author: MessageAuthor = {
        role: 'user',
        name: isSelf ? 'self' : dm.senderId,
      };

      const content: MessageContent = {
        content_type: 'text',
        parts: [dm.text || ''],
      };

      const message: Message = {
        id: nodeId,
        author,
        create_time: new Date(dm.createdAt).getTime() / 1000,
        content,
        status: 'finished_successfully',
        metadata: {
          senderId: dm.senderId,
          recipientId: dm.recipientId,
          reactions: dm.reactions,
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
   * Extract media file references from tweets
   */
  private extractMediaFiles(tweets: Tweet[], extractedDir: string): string[] {
    const mediaFiles: string[] = [];
    const mediaDir = path.join(extractedDir, 'data', 'tweets_media');

    if (!fs.existsSync(mediaDir)) return mediaFiles;

    for (const tweet of tweets) {
      const media =
        tweet.tweet.extended_entities?.media || tweet.tweet.entities?.media || [];
      for (const m of media) {
        // Twitter media files are named with tweet ID prefix
        const tweetId = tweet.tweet.id_str;
        const files = fs.readdirSync(mediaDir);
        const matchingFiles = files.filter((f) => f.startsWith(tweetId));
        matchingFiles.forEach((f) => {
          mediaFiles.push(path.join(mediaDir, f));
        });
      }
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
        // Try finding object start
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

    // Check for Twitter-specific files
    const hasTweets = fs.existsSync(path.join(dataDir, 'tweets.js'));
    const hasAccount = fs.existsSync(path.join(dataDir, 'account.js'));
    const hasReadme = fs.existsSync(path.join(dataDir, 'README.txt'));

    if (hasTweets && hasAccount) {
      // Verify it's Twitter format by checking file content
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
