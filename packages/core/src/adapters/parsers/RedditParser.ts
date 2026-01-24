/**
 * Reddit Export Parser
 *
 * Parses Reddit GDPR data export (CSV format)
 * Supports: comments.csv, posts.csv, messages_archive.csv
 *
 * Structure:
 * - Posts: One conversation per post (natural content unit)
 * - Comments: Grouped by original post link (your comments on same thread)
 * - Messages: Grouped by thread (DMs)
 */

import * as path from 'path';
import * as fs from 'fs';
import type {
  Conversation,
  ConversationMapping,
  Message,
  MessageAuthor,
  MessageContent,
} from './types.js';

/**
 * Reddit comment from comments.csv
 */
interface RedditComment {
  id: string;
  permalink: string;
  date: string;
  ip?: string;
  subreddit: string;
  gildings: string;
  link: string;      // URL of the post being commented on
  parent?: string;   // Parent comment ID if replying to another comment
  body: string;
  media?: string;
}

/**
 * Reddit post from posts.csv
 */
interface RedditPost {
  id: string;
  permalink: string;
  date: string;
  ip?: string;
  subreddit: string;
  gildings: string;
  title: string;
  url?: string;
  body: string;
}

/**
 * Reddit message from messages_archive.csv
 */
interface RedditMessage {
  id: string;
  permalink: string;
  thread_id?: string;
  date: string;
  ip?: string;
  from: string;
  to: string;
  subject: string;
  body: string;
}

export class RedditParser {
  /**
   * Parse all content from an extracted Reddit export directory
   */
  async parseConversations(extractedDir: string): Promise<Conversation[]> {
    const conversations: Conversation[] = [];

    // Parse posts - one conversation per post
    const postsFile = path.join(extractedDir, 'posts.csv');
    if (fs.existsSync(postsFile)) {
      const postConversations = await this.parsePosts(postsFile);
      conversations.push(...postConversations);
      console.log(`Parsed ${postConversations.length} Reddit posts`);
    }

    // Parse comments - grouped by original post link
    const commentsFile = path.join(extractedDir, 'comments.csv');
    if (fs.existsSync(commentsFile)) {
      const commentConversations = await this.parseCommentsByPost(commentsFile);
      conversations.push(...commentConversations);
      console.log(`Parsed ${commentConversations.length} Reddit comment threads`);
    }

    // Parse messages - grouped by thread
    const messagesFile = path.join(extractedDir, 'messages_archive.csv');
    if (fs.existsSync(messagesFile)) {
      const messageConversations = await this.parseMessagesByThread(messagesFile);
      conversations.push(...messageConversations);
      console.log(`Parsed ${messageConversations.length} Reddit message threads`);
    }

    console.log(`Successfully parsed ${conversations.length} Reddit conversations total`);
    return conversations;
  }

  /**
   * Parse posts - one conversation per post
   */
  private async parsePosts(postsFile: string): Promise<Conversation[]> {
    const posts = this.parseCSV<RedditPost>(postsFile);
    const conversations: Conversation[] = [];

    for (const post of posts) {
      const conversationId = `reddit_post_${post.id}`;
      const timestamp = new Date(post.date).getTime() / 1000;

      // Build mapping with single message (the post)
      const mapping: ConversationMapping = {};
      const rootId = `${conversationId}_root`;
      const postNodeId = `${conversationId}_content`;

      mapping[rootId] = {
        id: rootId,
        message: undefined,
        parent: undefined,
        children: [postNodeId],
      };

      // Build content with title and body
      const parts: string[] = [];
      if (post.title) {
        parts.push(`## ${post.title}\n`);
      }
      if (post.body) {
        parts.push(post.body);
      }
      if (post.url && post.url !== post.permalink && !post.url.startsWith('/r/')) {
        parts.push(`\n\n[Link](${post.url})`);
      }

      const message: Message = {
        id: postNodeId,
        author: {
          role: 'user',
          name: 'self',
        },
        create_time: timestamp,
        content: {
          content_type: 'text',
          parts: [parts.join('\n') || '[No content]'],
        },
        status: 'finished_successfully',
        metadata: {
          reddit_id: post.id,
          subreddit: post.subreddit,
          permalink: post.permalink,
          gildings: parseInt(post.gildings) || 0,
          external_url: post.url && post.url !== post.permalink ? post.url : undefined,
        },
      };

      mapping[postNodeId] = {
        id: postNodeId,
        message,
        parent: rootId,
        children: [],
      };

      conversations.push({
        conversation_id: conversationId,
        title: post.title || 'Untitled Post',
        create_time: timestamp,
        update_time: timestamp,
        mapping,
        moderation_results: [],
        _source: 'reddit',
        _import_date: new Date().toISOString(),
        _original_id: post.id,
        _reddit_metadata: {
          subreddit: post.subreddit,
          permalink: post.permalink,
          gildings: parseInt(post.gildings) || 0,
        },
      });
    }

    return conversations;
  }

  /**
   * Parse comments - grouped by original post link
   * Your comments on the same post become a single conversation
   */
  private async parseCommentsByPost(commentsFile: string): Promise<Conversation[]> {
    const comments = this.parseCSV<RedditComment>(commentsFile);
    const byPost = new Map<string, RedditComment[]>();

    // Group by the post link (what you were commenting on)
    for (const comment of comments) {
      const postLink = comment.link || 'unknown';
      if (!byPost.has(postLink)) {
        byPost.set(postLink, []);
      }
      byPost.get(postLink)!.push(comment);
    }

    const conversations: Conversation[] = [];

    for (const [postLink, postComments] of byPost) {
      // Sort chronologically
      const sorted = postComments.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Extract post title from link if possible
      // Link format: https://www.reddit.com/r/SubredditName/comments/xyz123/post_title_here/
      const titleMatch = postLink.match(/\/comments\/[^\/]+\/([^\/]+)/);
      const postTitle = titleMatch
        ? titleMatch[1].replace(/_/g, ' ')
        : 'Unknown Post';

      const subreddit = sorted[0]?.subreddit || 'unknown';
      const conversationId = `reddit_comments_${sorted[0]?.id || postLink.replace(/[^a-zA-Z0-9]/g, '_')}`;

      const timestamps = sorted.map((c) => new Date(c.date).getTime() / 1000);

      // Build mapping - comments in chronological order
      const mapping = this.buildCommentMapping(sorted, conversationId, postLink);

      conversations.push({
        conversation_id: conversationId,
        title: `Comments on: ${postTitle}`,
        create_time: Math.min(...timestamps),
        update_time: Math.max(...timestamps),
        mapping,
        moderation_results: [],
        _source: 'reddit',
        _import_date: new Date().toISOString(),
        _original_id: conversationId,
        _reddit_metadata: {
          subreddit,
          permalink: postLink,
          comment_count: sorted.length,
        },
      });
    }

    return conversations;
  }

  /**
   * Parse messages grouped by thread
   */
  private async parseMessagesByThread(messagesFile: string): Promise<Conversation[]> {
    const messages = this.parseCSV<RedditMessage>(messagesFile);
    const byThread = new Map<string, RedditMessage[]>();

    for (const msg of messages) {
      // Group by thread_id or by subject if no thread_id
      const threadKey = msg.thread_id || msg.subject || 'direct';
      if (!byThread.has(threadKey)) {
        byThread.set(threadKey, []);
      }
      byThread.get(threadKey)!.push(msg);
    }

    const conversations: Conversation[] = [];

    for (const [threadKey, threadMessages] of byThread) {
      const sorted = threadMessages.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const conversationId = `reddit_dm_${threadKey.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const mapping = this.buildMessageMapping(sorted, conversationId);

      const timestamps = sorted.map((m) => new Date(m.date).getTime() / 1000);
      const participants = new Set<string>();
      sorted.forEach((m) => {
        if (m.from) participants.add(m.from);
        if (m.to) participants.add(m.to);
      });

      conversations.push({
        conversation_id: conversationId,
        title: sorted[0]?.subject || 'Reddit DM',
        create_time: Math.min(...timestamps),
        update_time: Math.max(...timestamps),
        mapping,
        moderation_results: [],
        _source: 'reddit',
        _import_date: new Date().toISOString(),
        _original_id: threadKey,
        _reddit_metadata: {
          post_count: sorted.length,
        },
        _facebook_metadata: {
          participants: Array.from(participants).map((name) => ({ name })),
          message_count: sorted.length,
        },
      });
    }

    return conversations;
  }

  /**
   * Build conversation mapping from comments on a single post
   */
  private buildCommentMapping(
    comments: RedditComment[],
    conversationId: string,
    postLink: string
  ): ConversationMapping {
    const mapping: ConversationMapping = {};

    const rootId = `${conversationId}_root`;
    mapping[rootId] = {
      id: rootId,
      message: undefined,
      parent: undefined,
      children: comments.length > 0 ? [`${conversationId}_comment_0`] : [],
    };

    comments.forEach((comment, index) => {
      const nodeId = `${conversationId}_comment_${index}`;
      const prevNodeId = index === 0 ? rootId : `${conversationId}_comment_${index - 1}`;
      const nextNodeId =
        index < comments.length - 1 ? `${conversationId}_comment_${index + 1}` : undefined;

      const message: Message = {
        id: nodeId,
        author: {
          role: 'user',
          name: 'self',
        },
        create_time: new Date(comment.date).getTime() / 1000,
        content: {
          content_type: 'text',
          parts: [comment.body || ''],
        },
        status: 'finished_successfully',
        metadata: {
          reddit_id: comment.id,
          subreddit: comment.subreddit,
          permalink: comment.permalink,
          post_link: postLink,
          parent_comment: comment.parent || undefined,
          gildings: parseInt(comment.gildings) || 0,
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
   * Build conversation mapping from messages
   */
  private buildMessageMapping(
    messages: RedditMessage[],
    conversationId: string
  ): ConversationMapping {
    const mapping: ConversationMapping = {};

    const rootId = `${conversationId}_root`;
    mapping[rootId] = {
      id: rootId,
      message: undefined,
      parent: undefined,
      children: messages.length > 0 ? [`${conversationId}_msg_0`] : [],
    };

    messages.forEach((msg, index) => {
      const nodeId = `${conversationId}_msg_${index}`;
      const prevNodeId = index === 0 ? rootId : `${conversationId}_msg_${index - 1}`;
      const nextNodeId =
        index < messages.length - 1 ? `${conversationId}_msg_${index + 1}` : undefined;

      const message: Message = {
        id: nodeId,
        author: {
          role: 'user',
          name: msg.from || 'unknown',
        },
        create_time: new Date(msg.date).getTime() / 1000,
        content: {
          content_type: 'text',
          parts: [msg.body || ''],
        },
        status: 'finished_successfully',
        metadata: {
          reddit_id: msg.id,
          to: msg.to,
          subject: msg.subject,
          permalink: msg.permalink,
          thread_id: msg.thread_id,
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
   * Parse CSV file to array of objects
   */
  private parseCSV<T>(filePath: string): T[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    if (lines.length < 2) return [];

    const headers = this.parseCSVLine(lines[0]);
    const results: T[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = this.parseCSVLine(line);
      const obj: Record<string, string> = {};

      headers.forEach((header, idx) => {
        obj[header] = values[idx] || '';
      });

      results.push(obj as T);
    }

    return results;
  }

  /**
   * Parse a single CSV line, handling quoted fields
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  /**
   * Detect if a directory contains Reddit export format
   */
  static async detectFormat(extractedDir: string): Promise<boolean> {
    const hasComments = fs.existsSync(path.join(extractedDir, 'comments.csv'));
    const hasPosts = fs.existsSync(path.join(extractedDir, 'posts.csv'));
    const hasStatistics = fs.existsSync(path.join(extractedDir, 'statistics.csv'));

    if ((hasComments || hasPosts) && hasStatistics) {
      return true;
    }

    if (hasPosts) {
      try {
        const content = fs.readFileSync(path.join(extractedDir, 'posts.csv'), 'utf-8');
        const firstLine = content.split('\n')[0];
        return firstLine.includes('subreddit') && firstLine.includes('gildings');
      } catch (error) {
        console.debug('[RedditParser] Error detecting format:', error);
        return false;
      }
    }

    return false;
  }
}
