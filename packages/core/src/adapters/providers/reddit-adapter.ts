/**
 * Reddit Adapter
 *
 * Parses Reddit GDPR data exports.
 *
 * Export structure (CSV format):
 * - posts.csv - Submitted posts
 * - comments.csv - All comments
 * - messages.csv - Private messages
 * - saved_posts.csv - Saved posts
 * - saved_comments.csv - Saved comments
 * - upvoted_posts.csv - Upvoted posts
 * - downvoted_posts.csv - Downvoted posts
 * - subscribed_subreddits.csv - Subreddit subscriptions
 * - statistics.csv - Account stats
 *
 * Output content types:
 * - reddit-post
 * - reddit-comment
 * - reddit-message
 * - reddit-saved-post
 * - reddit-saved-comment
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
  ContentLink,
} from '../types.js';

// ═══════════════════════════════════════════════════════════════════
// TYPES FOR REDDIT EXPORT FORMAT
// ═══════════════════════════════════════════════════════════════════

interface RedditPost {
  id: string;
  permalink: string;
  date: string;
  ip?: string;
  subreddit: string;
  gildings?: string;
  title: string;
  url?: string;
  body: string;
}

interface RedditComment {
  id: string;
  permalink: string;
  date: string;
  ip?: string;
  subreddit: string;
  gildings?: string;
  link: string;
  body: string;
}

interface RedditMessage {
  id: string;
  permalink: string;
  date: string;
  from: string;
  to: string;
  subject: string;
  body: string;
}

interface RedditSavedPost {
  id: string;
  permalink: string;
  date?: string;
  subreddit: string;
  title?: string;
}

interface RedditSavedComment {
  id: string;
  permalink: string;
  date?: string;
  subreddit: string;
  link?: string;
}

// ═══════════════════════════════════════════════════════════════════
// REDDIT ADAPTER
// ═══════════════════════════════════════════════════════════════════

export class RedditAdapter extends BaseAdapter {
  readonly id = 'reddit';
  readonly name = 'Reddit';
  readonly description = 'Import Reddit GDPR data exports';
  readonly version = '1.0.0';
  readonly contentTypes = [
    'reddit-post',
    'reddit-comment',
    'reddit-message',
    'reddit-saved-post',
    'reddit-saved-comment',
  ];
  readonly supportedExtensions = ['.zip', '.csv'];

  // ─────────────────────────────────────────────────────────────────
  // DETECTION
  // ─────────────────────────────────────────────────────────────────

  async detect(source: AdapterSource): Promise<DetectionResult> {
    try {
      const path = source.path;

      // Check for characteristic Reddit CSV files
      const postsCsv = join(path, 'posts.csv');
      const commentsCsv = join(path, 'comments.csv');
      const statisticsCsv = join(path, 'statistics.csv');

      const hasPosts = await this.fileExists(postsCsv);
      const hasComments = await this.fileExists(commentsCsv);
      const hasStats = await this.fileExists(statisticsCsv);

      if ((hasPosts || hasComments) && hasStats) {
        return {
          canHandle: true,
          confidence: 0.95,
          format: 'reddit-export',
          reason: 'Found Reddit CSV files (posts/comments + statistics)',
        };
      }

      if (hasPosts || hasComments) {
        // Verify CSV structure
        if (hasPosts) {
          const content = await this.readFile(postsCsv);
          const lines = content.split('\n');
          if (lines.length > 0 && lines[0].includes('subreddit')) {
            return {
              canHandle: true,
              confidence: 0.85,
              format: 'reddit-export',
              reason: 'Found posts.csv with subreddit column',
            };
          }
        }
        if (hasComments) {
          const content = await this.readFile(commentsCsv);
          const lines = content.split('\n');
          if (lines.length > 0 && lines[0].includes('subreddit')) {
            return {
              canHandle: true,
              confidence: 0.85,
              format: 'reddit-export',
              reason: 'Found comments.csv with subreddit column',
            };
          }
        }
      }

      return {
        canHandle: false,
        confidence: 0,
        reason: 'No Reddit export structure detected',
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
        message: 'Not a valid Reddit export',
        details: { reason: detection.reason },
      });
      return { valid: false, errors, warnings };
    }

    // Check for content
    const postsCsv = join(source.path, 'posts.csv');
    const commentsCsv = join(source.path, 'comments.csv');

    let hasContent = false;

    if (await this.fileExists(postsCsv)) {
      const posts = await this.parseCsv<RedditPost>(postsCsv);
      if (posts.length > 0) hasContent = true;
    }

    if (await this.fileExists(commentsCsv)) {
      const comments = await this.parseCsv<RedditComment>(commentsCsv);
      if (comments.length > 0) hasContent = true;
    }

    if (!hasContent) {
      warnings.push({
        code: 'EMPTY_EXPORT',
        message: 'No posts or comments found in export',
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

    // Count posts
    const postsCsv = join(source.path, 'posts.csv');
    if (await this.fileExists(postsCsv)) {
      const posts = await this.parseCsv<RedditPost>(postsCsv);
      estimatedCount += posts.length;
      contentTypes.add('reddit-post');

      for (const post of posts) {
        const date = this.parseTimestamp(post.date);
        if (date) {
          if (!earliestDate || date < earliestDate) earliestDate = date;
          if (!latestDate || date > latestDate) latestDate = date;
        }
      }
    }

    // Count comments
    const commentsCsv = join(source.path, 'comments.csv');
    if (await this.fileExists(commentsCsv)) {
      const comments = await this.parseCsv<RedditComment>(commentsCsv);
      estimatedCount += comments.length;
      contentTypes.add('reddit-comment');

      for (const comment of comments) {
        const date = this.parseTimestamp(comment.date);
        if (date) {
          if (!earliestDate || date < earliestDate) earliestDate = date;
          if (!latestDate || date > latestDate) latestDate = date;
        }
      }
    }

    // Count messages
    const messagesCsv = join(source.path, 'messages.csv');
    if (await this.fileExists(messagesCsv)) {
      const messages = await this.parseCsv<RedditMessage>(messagesCsv);
      estimatedCount += messages.length;
      contentTypes.add('reddit-message');
    }

    // Count saved
    const savedPostsCsv = join(source.path, 'saved_posts.csv');
    if (await this.fileExists(savedPostsCsv)) {
      const saved = await this.parseCsv<RedditSavedPost>(savedPostsCsv);
      estimatedCount += saved.length;
      contentTypes.add('reddit-saved-post');
    }

    const savedCommentsCsv = join(source.path, 'saved_comments.csv');
    if (await this.fileExists(savedCommentsCsv)) {
      const saved = await this.parseCsv<RedditSavedComment>(savedCommentsCsv);
      estimatedCount += saved.length;
      contentTypes.add('reddit-saved-comment');
    }

    return {
      format: detection.format || 'reddit-export',
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
    _options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    // Parse posts
    yield* this.parsePosts(source);

    // Parse comments
    yield* this.parseComments(source);

    // Parse messages
    yield* this.parseMessages(source);

    // Parse saved posts
    yield* this.parseSavedPosts(source);

    // Parse saved comments
    yield* this.parseSavedComments(source);
  }

  private async *parsePosts(source: AdapterSource): AsyncGenerator<ImportedNode, void, undefined> {
    const postsCsv = join(source.path, 'posts.csv');
    if (!(await this.fileExists(postsCsv))) return;

    const posts = await this.parseCsv<RedditPost>(postsCsv);

    for (const post of posts) {
      yield this.postToNode(post);
    }
  }

  private async *parseComments(source: AdapterSource): AsyncGenerator<ImportedNode, void, undefined> {
    const commentsCsv = join(source.path, 'comments.csv');
    if (!(await this.fileExists(commentsCsv))) return;

    const comments = await this.parseCsv<RedditComment>(commentsCsv);

    for (const comment of comments) {
      yield this.commentToNode(comment);
    }
  }

  private async *parseMessages(source: AdapterSource): AsyncGenerator<ImportedNode, void, undefined> {
    const messagesCsv = join(source.path, 'messages.csv');
    if (!(await this.fileExists(messagesCsv))) return;

    const messages = await this.parseCsv<RedditMessage>(messagesCsv);

    for (const message of messages) {
      yield this.messageToNode(message);
    }
  }

  private async *parseSavedPosts(source: AdapterSource): AsyncGenerator<ImportedNode, void, undefined> {
    const savedCsv = join(source.path, 'saved_posts.csv');
    if (!(await this.fileExists(savedCsv))) return;

    const saved = await this.parseCsv<RedditSavedPost>(savedCsv);

    for (const post of saved) {
      yield this.savedPostToNode(post);
    }
  }

  private async *parseSavedComments(source: AdapterSource): AsyncGenerator<ImportedNode, void, undefined> {
    const savedCsv = join(source.path, 'saved_comments.csv');
    if (!(await this.fileExists(savedCsv))) return;

    const saved = await this.parseCsv<RedditSavedComment>(savedCsv);

    for (const comment of saved) {
      yield this.savedCommentToNode(comment);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // CONVERTERS
  // ─────────────────────────────────────────────────────────────────

  private postToNode(post: RedditPost): ImportedNode {
    const id = post.id.replace('t3_', '');
    const content = post.body || '';
    const isLinkPost = post.url && !post.url.includes('reddit.com');

    return {
      id,
      uri: this.generateUri('post', id),
      contentHash: this.hashContent(post.title + content),
      content: content || post.title,
      format: 'text',
      sourceType: 'reddit-post',
      sourceCreatedAt: this.parseTimestamp(post.date),
      metadata: {
        postId: id,
        title: post.title,
        subreddit: post.subreddit,
        permalink: post.permalink,
        url: post.url,
        isLinkPost,
        gildings: post.gildings,
      },
    };
  }

  private commentToNode(comment: RedditComment): ImportedNode {
    const id = comment.id.replace('t1_', '');
    const content = this.decodeHtmlEntities(comment.body);

    // Extract post ID from link
    const postIdMatch = comment.link?.match(/comments\/([a-z0-9]+)/);
    const postId = postIdMatch ? postIdMatch[1] : undefined;

    const links: ContentLink[] = [];
    if (postId) {
      links.push({
        type: 'parent',
        targetUri: this.generateUri('post', postId),
      });
    }

    return {
      id,
      uri: this.generateUri('comment', id),
      contentHash: this.hashContent(content),
      content,
      format: 'text',
      sourceType: 'reddit-comment',
      sourceCreatedAt: this.parseTimestamp(comment.date),
      parentUri: postId ? this.generateUri('post', postId) : undefined,
      links,
      metadata: {
        commentId: id,
        subreddit: comment.subreddit,
        permalink: comment.permalink,
        postLink: comment.link,
        postId,
        gildings: comment.gildings,
      },
    };
  }

  private messageToNode(message: RedditMessage): ImportedNode {
    const id = message.id.replace('t4_', '');
    const content = this.decodeHtmlEntities(message.body);

    return {
      id,
      uri: this.generateUri('message', id),
      contentHash: this.hashContent(message.subject + content),
      content,
      format: 'text',
      sourceType: 'reddit-message',
      sourceCreatedAt: this.parseTimestamp(message.date),
      author: {
        name: message.from,
      },
      metadata: {
        messageId: id,
        from: message.from,
        to: message.to,
        subject: message.subject,
        permalink: message.permalink,
      },
    };
  }

  private savedPostToNode(post: RedditSavedPost): ImportedNode {
    const id = post.id.replace('t3_', '');

    return {
      id: `saved-${id}`,
      uri: this.generateUri('saved-post', id),
      contentHash: this.hashContent(`saved:${id}:${post.title || ''}`),
      content: post.title || `Saved post from r/${post.subreddit}`,
      format: 'text',
      sourceType: 'reddit-saved-post',
      sourceCreatedAt: post.date ? this.parseTimestamp(post.date) : undefined,
      links: [
        {
          type: 'references',
          targetUri: this.generateUri('post', id),
        },
      ],
      metadata: {
        savedPostId: id,
        title: post.title,
        subreddit: post.subreddit,
        permalink: post.permalink,
      },
    };
  }

  private savedCommentToNode(comment: RedditSavedComment): ImportedNode {
    const id = comment.id.replace('t1_', '');

    return {
      id: `saved-${id}`,
      uri: this.generateUri('saved-comment', id),
      contentHash: this.hashContent(`saved:${id}`),
      content: `Saved comment from r/${comment.subreddit}`,
      format: 'text',
      sourceType: 'reddit-saved-comment',
      sourceCreatedAt: comment.date ? this.parseTimestamp(comment.date) : undefined,
      links: [
        {
          type: 'references',
          targetUri: this.generateUri('comment', id),
        },
      ],
      metadata: {
        savedCommentId: id,
        subreddit: comment.subreddit,
        permalink: comment.permalink,
        postLink: comment.link,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  private async parseCsv<T>(path: string): Promise<T[]> {
    const content = await this.readFile(path);
    const lines = content.split('\n');

    if (lines.length < 2) return [];

    // Parse header
    const headers = this.parseCsvLine(lines[0]);
    const results: T[] = [];

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = this.parseCsvLine(line);
      const obj: Record<string, string> = {};

      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = values[j] || '';
      }

      results.push(obj as T);
    }

    return results;
  }

  private parseCsvLine(line: string): string[] {
    const values: string[] = [];
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
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current);
    return values;
  }

  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════

export const redditAdapter = new RedditAdapter();
