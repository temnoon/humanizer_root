/**
 * PostsParser - Parse Facebook posts from export JSON
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { FacebookPost, ContentItem } from './types.js';

export class PostsParser {
  /**
   * Parse Facebook posts from JSON file(s)
   */
  async parse(filePath: string, exportDir: string): Promise<ContentItem[]> {
    console.log(`📝 Parsing posts from: ${filePath}`);

    const rawData = await fs.readFile(filePath, 'utf-8');
    const posts: FacebookPost[] = JSON.parse(rawData);

    console.log(`   Found ${posts.length} posts`);

    const contentItems: ContentItem[] = [];

    for (const post of posts) {
      const item = this.convertPostToContentItem(post, exportDir);
      if (item) {
        contentItems.push(item);
      }
    }

    console.log(`   Converted ${contentItems.length} posts to content items`);
    return contentItems;
  }

  /**
   * Parse all post files in a directory
   */
  async parseAll(postsDir: string, exportDir: string): Promise<ContentItem[]> {
    const allItems: ContentItem[] = [];

    // Find all JSON files in the posts directory
    const files = await fs.readdir(postsDir);
    const jsonFiles = files.filter(f => f.endsWith('.json') && f.startsWith('your_posts'));

    console.log(`📝 Found ${jsonFiles.length} post files to parse`);

    for (const file of jsonFiles) {
      const filePath = path.join(postsDir, file);
      const items = await this.parse(filePath, exportDir);
      allItems.push(...items);
    }

    return allItems;
  }

  /**
   * Convert a Facebook post to a ContentItem
   */
  private convertPostToContentItem(post: FacebookPost, exportDir: string): ContentItem | null {
    // Get post text
    const postText = this.extractPostText(post);

    // Get title
    const title = post.title ? this.decodeFacebookUnicode(post.title) : undefined;

    // Extract media references
    const mediaRefs = this.extractMediaRefs(post, exportDir);

    // Extract external link
    const externalUrl = this.extractExternalUrl(post);

    // Build metadata
    const metadata: any = {
      original_title: post.title,
      tags: post.tags?.map(t => t.name) || [],
    };

    if (externalUrl) {
      metadata.external_url = externalUrl;
    }

    if (post.event) {
      metadata.event = post.event;
    }

    if (post.attachments) {
      metadata.has_attachments = true;
      metadata.attachment_count = post.attachments.length;
    }

    // Create content item
    const item: ContentItem = {
      id: `fb_post_${post.timestamp}`,
      type: 'post',
      source: 'facebook',
      text: postText,
      title,
      created_at: post.timestamp,
      author_name: 'Tem Noon',  // TODO: Extract from title if format is "FirstName LastName shared..."
      is_own_content: true,
      media_refs: mediaRefs,
      media_count: mediaRefs.length,
      metadata,
      tags: post.tags?.map(t => t.name),
      search_text: this.buildSearchText(postText, title),
    };

    return item;
  }

  /**
   * Extract post text from data array
   */
  private extractPostText(post: FacebookPost): string | undefined {
    if (!post.data || post.data.length === 0) {
      return undefined;
    }

    // Find the data entry with a 'post' field
    for (const data of post.data) {
      if (data.post) {
        return this.decodeFacebookUnicode(data.post);
      }
    }

    return undefined;
  }

  /**
   * Extract media references from attachments
   */
  private extractMediaRefs(post: FacebookPost, exportDir: string): string[] {
    const refs: string[] = [];

    if (!post.attachments) {
      return refs;
    }

    for (const attachment of post.attachments) {
      if (!attachment.data) continue;

      for (const data of attachment.data) {
        // Media files
        if (data.media?.uri) {
          const mediaPath = path.join(exportDir, data.media.uri);
          refs.push(mediaPath);
        }
      }
    }

    return refs;
  }

  /**
   * Extract external URL from attachments
   */
  private extractExternalUrl(post: FacebookPost): string | undefined {
    if (!post.attachments) {
      return undefined;
    }

    for (const attachment of post.attachments) {
      if (!attachment.data) continue;

      for (const data of attachment.data) {
        if (data.external_context?.url) {
          return data.external_context.url;
        }
      }
    }

    return undefined;
  }

  /**
   * Build search text from post content
   */
  private buildSearchText(text?: string, title?: string): string {
    const parts: string[] = [];

    if (title) parts.push(title);
    if (text) parts.push(text);

    return parts.join(' ').toLowerCase();
  }

  /**
   * Decode Facebook's non-standard Unicode encoding
   * Facebook uses \u00XX for Latin-1 characters which should be decoded
   * Example: "caf\u00e9" should become "café"
   */
  private decodeFacebookUnicode(text: string): string {
    // Replace Facebook's Unicode escape sequences
    // They use \u00XX for characters in the Latin-1 range (128-255)
    return text.replace(/\\u00([0-9a-f]{2})/gi, (match, hex) => {
      const code = parseInt(hex, 16);
      // Only decode if it's actually in the extended ASCII range
      if (code >= 128) {
        return String.fromCharCode(code);
      }
      // Otherwise leave it as-is (might be intentional escape)
      return match;
    });
  }

  /**
   * Parse a single posts file and return statistics
   */
  async getFileStats(filePath: string): Promise<{
    totalPosts: number;
    postsWithText: number;
    postsWithMedia: number;
    postsWithLinks: number;
    dateRange: { earliest: number; latest: number };
  }> {
    const rawData = await fs.readFile(filePath, 'utf-8');
    const posts: FacebookPost[] = JSON.parse(rawData);

    let postsWithText = 0;
    let postsWithMedia = 0;
    let postsWithLinks = 0;
    let earliest = Infinity;
    let latest = -Infinity;

    for (const post of posts) {
      // Update date range
      if (post.timestamp < earliest) earliest = post.timestamp;
      if (post.timestamp > latest) latest = post.timestamp;

      // Check for text
      if (this.extractPostText(post)) {
        postsWithText++;
      }

      // Check for media
      if (this.extractMediaRefs(post, '').length > 0) {
        postsWithMedia++;
      }

      // Check for links
      if (this.extractExternalUrl(post)) {
        postsWithLinks++;
      }
    }

    return {
      totalPosts: posts.length,
      postsWithText,
      postsWithMedia,
      postsWithLinks,
      dateRange: { earliest, latest },
    };
  }
}
