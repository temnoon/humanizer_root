/**
 * Reddit Export Parser
 *
 * Parses Reddit GDPR data export (CSV format)
 * Supports: comments.csv, posts.csv, messages_archive.csv
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
import { findFiles } from './utils.js';

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
  link: string;
  parent?: string;
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

    // Parse posts grouped by subreddit
    const postsFile = path.join(extractedDir, 'posts.csv');
    if (fs.existsSync(postsFile)) {
      const postConversations = await this.parsePostsBySubreddit(postsFile);
      conversations.push(...postConversations);
      console.log(`Parsed ${postConversations.length} Reddit post conversations`);
    }

    // Parse comments grouped by subreddit
    const commentsFile = path.join(extractedDir, 'comments.csv');
    if (fs.existsSync(commentsFile)) {
      const commentConversations = await this.parseCommentsBySubreddit(commentsFile);
      conversations.push(...commentConversations);
      console.log(`Parsed ${commentConversations.length} Reddit comment conversations`);
    }

    // Parse messages grouped by thread
    const messagesFile = path.join(extractedDir, 'messages_archive.csv');
    if (fs.existsSync(messagesFile)) {
      const messageConversations = await this.parseMessagesByThread(messagesFile);
      conversations.push(...messageConversations);
      console.log(`Parsed ${messageConversations.length} Reddit message conversations`);
    }

    console.log(`Successfully parsed ${conversations.length} Reddit conversations total`);
    return conversations;
  }

  /**
   * Parse posts grouped by subreddit
   */
  private async parsePostsBySubreddit(postsFile: string): Promise<Conversation[]> {
    const posts = this.parseCSV<RedditPost>(postsFile);
    const bySubreddit = new Map<string, RedditPost[]>();

    for (const post of posts) {
      const subreddit = post.subreddit || 'unknown';
      if (!bySubreddit.has(subreddit)) {
        bySubreddit.set(subreddit, []);
      }
      bySubreddit.get(subreddit)!.push(post);
    }

    const conversations: Conversation[] = [];

    for (const [subreddit, subredditPosts] of bySubreddit) {
      const sorted = subredditPosts.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const conversationId = `reddit_posts_r_${subreddit}`;
      const mapping = this.buildPostMapping(sorted, conversationId);

      const timestamps = sorted.map((p) => new Date(p.date).getTime() / 1000);

      conversations.push({
        conversation_id: conversationId,
        title: `r/${subreddit} - Posts`,
        create_time: Math.min(...timestamps),
        update_time: Math.max(...timestamps),
        mapping,
        moderation_results: [],
        _source: 'reddit',
        _import_date: new Date().toISOString(),
        _original_id: conversationId,
        _reddit_metadata: {
          subreddit,
          post_count: sorted.length,
        },
      });
    }

    return conversations;
  }

  /**
   * Parse comments grouped by subreddit
   */
  private async parseCommentsBySubreddit(commentsFile: string): Promise<Conversation[]> {
    const comments = this.parseCSV<RedditComment>(commentsFile);
    const bySubreddit = new Map<string, RedditComment[]>();

    for (const comment of comments) {
      const subreddit = comment.subreddit || 'unknown';
      if (!bySubreddit.has(subreddit)) {
        bySubreddit.set(subreddit, []);
      }
      bySubreddit.get(subreddit)!.push(comment);
    }

    const conversations: Conversation[] = [];

    for (const [subreddit, subredditComments] of bySubreddit) {
      const sorted = subredditComments.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const conversationId = `reddit_comments_r_${subreddit}`;
      const mapping = this.buildCommentMapping(sorted, conversationId);

      const timestamps = sorted.map((c) => new Date(c.date).getTime() / 1000);

      conversations.push({
        conversation_id: conversationId,
        title: `r/${subreddit} - Comments`,
        create_time: Math.min(...timestamps),
        update_time: Math.max(...timestamps),
        mapping,
        moderation_results: [],
        _source: 'reddit',
        _import_date: new Date().toISOString(),
        _original_id: conversationId,
        _reddit_metadata: {
          subreddit,
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

      const conversationId = `reddit_messages_${threadKey.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const mapping = this.buildMessageMapping(sorted, conversationId);

      const timestamps = sorted.map((m) => new Date(m.date).getTime() / 1000);
      const participants = new Set<string>();
      sorted.forEach((m) => {
        if (m.from) participants.add(m.from);
        if (m.to) participants.add(m.to);
      });

      conversations.push({
        conversation_id: conversationId,
        title: sorted[0]?.subject || 'Reddit Messages',
        create_time: Math.min(...timestamps),
        update_time: Math.max(...timestamps),
        mapping,
        moderation_results: [],
        _source: 'reddit',
        _import_date: new Date().toISOString(),
        _original_id: conversationId,
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
   * Build conversation mapping from posts
   */
  private buildPostMapping(posts: RedditPost[], conversationId: string): ConversationMapping {
    const mapping: ConversationMapping = {};

    const rootId = `${conversationId}_root`;
    mapping[rootId] = {
      id: rootId,
      message: undefined,
      parent: undefined,
      children: posts.length > 0 ? [`${conversationId}_post_0`] : [],
    };

    posts.forEach((post, index) => {
      const nodeId = `${conversationId}_post_${index}`;
      const prevNodeId = index === 0 ? rootId : `${conversationId}_post_${index - 1}`;
      const nextNodeId =
        index < posts.length - 1 ? `${conversationId}_post_${index + 1}` : undefined;

      const author: MessageAuthor = {
        role: 'user',
        name: 'self',
      };

      // Build content with title and body
      const parts: string[] = [];
      if (post.title) {
        parts.push(`## ${post.title}\n`);
      }
      if (post.body) {
        parts.push(post.body);
      }
      if (post.url && post.url !== post.permalink) {
        parts.push(`\n[Link](${post.url})`);
      }

      const content: MessageContent = {
        content_type: 'text',
        parts: [parts.join('\n')],
      };

      const message: Message = {
        id: nodeId,
        author,
        create_time: new Date(post.date).getTime() / 1000,
        content,
        status: 'finished_successfully',
        metadata: {
          subreddit: post.subreddit,
          permalink: post.permalink,
          gildings: parseInt(post.gildings) || 0,
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
   * Build conversation mapping from comments
   */
  private buildCommentMapping(
    comments: RedditComment[],
    conversationId: string
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

      const author: MessageAuthor = {
        role: 'user',
        name: 'self',
      };

      const content: MessageContent = {
        content_type: 'text',
        parts: [comment.body || ''],
      };

      const message: Message = {
        id: nodeId,
        author,
        create_time: new Date(comment.date).getTime() / 1000,
        content,
        status: 'finished_successfully',
        metadata: {
          subreddit: comment.subreddit,
          permalink: comment.permalink,
          link: comment.link,
          parent: comment.parent,
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

      const author: MessageAuthor = {
        role: 'user',
        name: msg.from || 'unknown',
      };

      const content: MessageContent = {
        content_type: 'text',
        parts: [msg.body || ''],
      };

      const message: Message = {
        id: nodeId,
        author,
        create_time: new Date(msg.date).getTime() / 1000,
        content,
        status: 'finished_successfully',
        metadata: {
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

    // Parse header
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
          i++; // Skip escaped quote
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
    // Reddit exports have specific CSV files
    const hasComments = fs.existsSync(path.join(extractedDir, 'comments.csv'));
    const hasPosts = fs.existsSync(path.join(extractedDir, 'posts.csv'));
    const hasMessages = fs.existsSync(path.join(extractedDir, 'messages_archive.csv'));
    const hasStatistics = fs.existsSync(path.join(extractedDir, 'statistics.csv'));

    // Need at least posts or comments, and statistics file is unique to Reddit
    if ((hasComments || hasPosts) && hasStatistics) {
      return true;
    }

    // Check for Reddit-specific headers in posts.csv
    if (hasPosts) {
      try {
        const content = fs.readFileSync(path.join(extractedDir, 'posts.csv'), 'utf-8');
        const firstLine = content.split('\n')[0];
        return firstLine.includes('subreddit') && firstLine.includes('gildings');
      } catch {
        return false;
      }
    }

    return false;
  }
}
