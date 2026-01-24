/**
 * Substack Export Parser
 *
 * Parses Substack data export (CSV metadata + HTML content)
 * Supports: posts.csv, posts/*.html
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
 * Substack post metadata from posts.csv
 */
interface SubstackPostMeta {
  post_id: string;
  post_date?: string;
  is_published: string;
  email_sent_at?: string;
  inbox_sent_at?: string;
  type: string;
  audience: string;
  title: string;
  subtitle?: string;
  podcast_url?: string;
}

/**
 * Parsed Substack post with content
 */
interface SubstackPost {
  meta: SubstackPostMeta;
  content: string;
  htmlPath?: string;
}

export class SubstackParser {
  private publicationName: string = '';

  /**
   * Parse all content from an extracted Substack export directory
   */
  async parseConversations(extractedDir: string): Promise<Conversation[]> {
    const conversations: Conversation[] = [];

    // Parse posts
    const postsFile = path.join(extractedDir, 'posts.csv');
    if (!fs.existsSync(postsFile)) {
      console.log('No posts.csv found in Substack export');
      return conversations;
    }

    // Get publication name from email_list file if available
    this.loadPublicationName(extractedDir);

    const posts = await this.parsePosts(extractedDir);
    if (posts.length === 0) {
      console.log('No posts found in Substack export');
      return conversations;
    }

    // Create one conversation per post (they're standalone articles)
    for (const post of posts) {
      const conversation = this.createPostConversation(post);
      conversations.push(conversation);
    }

    console.log(`Successfully parsed ${conversations.length} Substack posts`);
    return conversations;
  }

  /**
   * Load publication name from export files
   */
  private loadPublicationName(extractedDir: string): void {
    // Check for email_list.*.csv pattern
    const files = fs.readdirSync(extractedDir);
    const emailListFile = files.find((f) => f.startsWith('email_list.') && f.endsWith('.csv'));

    if (emailListFile) {
      // Extract publication name from filename: email_list.{name}.csv
      const match = emailListFile.match(/^email_list\.(.+)\.csv$/);
      if (match) {
        this.publicationName = match[1];
      }
    }
  }

  /**
   * Parse all posts from posts.csv and their HTML content
   */
  private async parsePosts(extractedDir: string): Promise<SubstackPost[]> {
    const postsFile = path.join(extractedDir, 'posts.csv');
    const postsMeta = this.parseCSV<SubstackPostMeta>(postsFile);
    const postsDir = path.join(extractedDir, 'posts');

    const posts: SubstackPost[] = [];

    for (const meta of postsMeta) {
      if (!meta.post_id) continue;

      // Find corresponding HTML file
      // Substack uses pattern: {post_id}.{slug}.html
      let htmlContent = '';
      let htmlPath: string | undefined;

      if (fs.existsSync(postsDir)) {
        const htmlFiles = fs.readdirSync(postsDir);
        const matchingFile = htmlFiles.find((f) => f.startsWith(meta.post_id + '.') && f.endsWith('.html'));

        if (matchingFile) {
          htmlPath = path.join(postsDir, matchingFile);
          htmlContent = this.parseHTML(htmlPath);
        }
      }

      // Skip drafts without content
      if (!htmlContent && meta.is_published !== 'true') {
        continue;
      }

      posts.push({
        meta,
        content: htmlContent,
        htmlPath,
      });
    }

    // Sort by date (newest first for articles, but we'll reverse for chronological)
    posts.sort((a, b) => {
      const dateA = a.meta.post_date ? new Date(a.meta.post_date).getTime() : 0;
      const dateB = b.meta.post_date ? new Date(b.meta.post_date).getTime() : 0;
      return dateA - dateB;
    });

    return posts;
  }

  /**
   * Create a Conversation from a Substack post
   */
  private createPostConversation(post: SubstackPost): Conversation {
    const conversationId = `substack_${post.meta.post_id}`;
    const title = post.meta.title || 'Untitled Post';

    // Parse timestamps
    const createTime = post.meta.post_date
      ? new Date(post.meta.post_date).getTime() / 1000
      : Date.now() / 1000;
    const updateTime = createTime;

    // Build mapping with single message (the article content)
    const mapping = this.buildPostMapping(post, conversationId);

    return {
      conversation_id: conversationId,
      title,
      create_time: createTime,
      update_time: updateTime,
      mapping,
      moderation_results: [],
      _source: 'substack',
      _import_date: new Date().toISOString(),
      _original_id: post.meta.post_id,
      _substack_metadata: {
        publication_name: this.publicationName,
        post_count: 1,
        email_sent_at: post.meta.email_sent_at,
        audience: post.meta.audience,
      },
    };
  }

  /**
   * Build conversation mapping for a post
   */
  private buildPostMapping(post: SubstackPost, conversationId: string): ConversationMapping {
    const mapping: ConversationMapping = {};

    const rootId = `${conversationId}_root`;
    const articleId = `${conversationId}_article`;

    mapping[rootId] = {
      id: rootId,
      message: undefined,
      parent: undefined,
      children: [articleId],
    };

    // Build content with title, subtitle, and body
    const parts: string[] = [];

    if (post.meta.title) {
      parts.push(`# ${post.meta.title}\n`);
    }
    if (post.meta.subtitle) {
      parts.push(`*${post.meta.subtitle}*\n`);
    }
    if (post.content) {
      parts.push(post.content);
    }

    const author: MessageAuthor = {
      role: 'user',
      name: this.publicationName || 'author',
    };

    const content: MessageContent = {
      content_type: 'text',
      parts: [parts.join('\n')],
    };

    const message: Message = {
      id: articleId,
      author,
      create_time: post.meta.post_date
        ? new Date(post.meta.post_date).getTime() / 1000
        : undefined,
      content,
      status: post.meta.is_published === 'true' ? 'finished_successfully' : 'draft',
      metadata: {
        type: post.meta.type,
        audience: post.meta.audience,
        podcast_url: post.meta.podcast_url,
        email_sent_at: post.meta.email_sent_at,
        is_published: post.meta.is_published === 'true',
      },
    };

    mapping[articleId] = {
      id: articleId,
      message,
      parent: rootId,
      children: [],
    };

    return mapping;
  }

  /**
   * Parse HTML file and extract text content
   */
  private parseHTML(filePath: string): string {
    try {
      const html = fs.readFileSync(filePath, 'utf-8');
      return this.htmlToMarkdown(html);
    } catch (err) {
      console.error(`Failed to parse HTML: ${filePath}`, err);
      return '';
    }
  }

  /**
   * Simple HTML to Markdown conversion
   * Extracts text content while preserving basic structure
   */
  private htmlToMarkdown(html: string): string {
    let text = html;

    // Remove scripts and styles
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

    // Convert headers
    text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
    text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
    text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
    text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');
    text = text.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n');
    text = text.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n');

    // Convert paragraphs
    text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n');

    // Convert breaks
    text = text.replace(/<br\s*\/?>/gi, '\n');

    // Convert bold and italic
    text = text.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
    text = text.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*');

    // Convert links
    text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

    // Convert images to markdown
    text = text.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
    text = text.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');

    // Convert lists
    text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
    text = text.replace(/<\/?[uo]l[^>]*>/gi, '\n');

    // Convert blockquotes
    text = text.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (match, content) => {
      return content.split('\n').map((line: string) => `> ${line}`).join('\n') + '\n';
    });

    // Convert code blocks
    text = text.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n');
    text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

    // Remove remaining HTML tags
    text = text.replace(/<[^>]+>/g, '');

    // Decode HTML entities
    text = this.decodeHTMLEntities(text);

    // Clean up whitespace
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.trim();

    return text;
  }

  /**
   * Decode HTML entities
   */
  private decodeHTMLEntities(text: string): string {
    const entities: Record<string, string> = {
      '&nbsp;': ' ',
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
      '&mdash;': '\u2014',
      '&ndash;': '\u2013',
      '&hellip;': '\u2026',
      '&rsquo;': '\u2019',
      '&lsquo;': '\u2018',
      '&rdquo;': '\u201D',
      '&ldquo;': '\u201C',
    };

    let result = text;
    for (const [entity, char] of Object.entries(entities)) {
      result = result.replace(new RegExp(entity, 'gi'), char);
    }

    // Handle numeric entities
    result = result.replace(/&#(\d+);/g, (match, num) => {
      return String.fromCharCode(parseInt(num, 10));
    });
    result = result.replace(/&#x([0-9a-f]+);/gi, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });

    return result;
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
   * Detect if a directory contains Substack export format
   */
  static async detectFormat(extractedDir: string): Promise<boolean> {
    // Substack exports have posts.csv and posts/ directory with HTML files
    const hasPostsCsv = fs.existsSync(path.join(extractedDir, 'posts.csv'));
    const hasPostsDir = fs.existsSync(path.join(extractedDir, 'posts'));

    if (hasPostsCsv) {
      // Verify it's Substack format by checking CSV headers
      try {
        const content = fs.readFileSync(path.join(extractedDir, 'posts.csv'), 'utf-8');
        const firstLine = content.split('\n')[0];
        // Substack posts.csv has specific columns
        return (
          firstLine.includes('post_id') &&
          firstLine.includes('is_published') &&
          firstLine.includes('audience')
        );
      } catch (error) {
        console.debug('[SubstackParser] Error detecting format:', error);
        return false;
      }
    }

    return false;
  }
}
