/**
 * CommentsParser - Parse Facebook comments from export JSON
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { FacebookComment, ContentItem } from './types.js';

interface CommentsFile {
  comments_v2: FacebookComment[];
}

export class CommentsParser {
  /**
   * Parse Facebook comments from JSON file
   */
  async parse(filePath: string): Promise<ContentItem[]> {
    console.log(`💬 Parsing comments from: ${filePath}`);

    const rawData = await fs.readFile(filePath, 'utf-8');
    const data: CommentsFile = JSON.parse(rawData);
    const comments = data.comments_v2 || [];

    console.log(`   Found ${comments.length} comments`);

    const contentItems: ContentItem[] = [];

    for (const comment of comments) {
      const item = this.convertCommentToContentItem(comment);
      if (item) {
        contentItems.push(item);
      }
    }

    console.log(`   Converted ${contentItems.length} comments to content items`);
    return contentItems;
  }

  /**
   * Convert a Facebook comment to a ContentItem
   */
  private convertCommentToContentItem(comment: FacebookComment): ContentItem | null {
    // Extract the actual comment data
    if (!comment.data || comment.data.length === 0) {
      return null;
    }

    const commentData = comment.data[0]?.comment;
    if (!commentData) {
      return null;
    }

    // Get comment text
    const text = commentData.comment ? this.decodeFacebookUnicode(commentData.comment) : undefined;
    if (!text) {
      return null;  // Skip empty comments
    }

    // Get author
    const author = commentData.author ? this.decodeFacebookUnicode(commentData.author) : 'Tem Noon';

    // Parse context from title
    const context = this.parseCommentContext(comment.title);

    // Build metadata
    const metadata: any = {
      original_title: comment.title,
      context_type: context.contextType,
      target_author: context.targetAuthor,
    };

    // Create content item
    const item: ContentItem = {
      id: `fb_comment_${commentData.timestamp || comment.timestamp}`,
      type: 'comment',
      source: 'facebook',
      text,
      created_at: commentData.timestamp || comment.timestamp,
      author_name: author,
      is_own_content: author === 'Tem Noon',
      context: JSON.stringify(context),
      metadata,
      search_text: text.toLowerCase(),
    };

    return item;
  }

  /**
   * Parse context from comment title
   * Examples:
   * - "Tem Noon commented on David Morris's post."
   * - "Tem Noon commented on his own post."
   * - "Tem Noon commented on Jessica Robin Smernoff-Rose's post."
   */
  private parseCommentContext(title?: string): {
    contextType: 'own_post' | 'other_post' | 'photo' | 'video' | 'unknown';
    targetAuthor?: string;
    action: string;
  } {
    if (!title) {
      return { contextType: 'unknown', action: 'commented' };
    }

    const decodedTitle = this.decodeFacebookUnicode(title);

    // Check if commenting on own content
    if (decodedTitle.includes('his own post') || decodedTitle.includes('her own post')) {
      return {
        contextType: 'own_post',
        action: 'commented',
      };
    }

    // Extract target author from "commented on [Name]'s post"
    const match = decodedTitle.match(/commented on (.+?)(?:'s|'s) (post|photo|video)/i);
    if (match) {
      const targetAuthor = match[1];
      const contentType = match[2];

      let contextType: 'other_post' | 'photo' | 'video' | 'unknown' = 'unknown';
      if (contentType === 'post') contextType = 'other_post';
      else if (contentType === 'photo') contextType = 'photo';
      else if (contentType === 'video') contextType = 'video';

      return {
        contextType,
        targetAuthor,
        action: 'commented',
      };
    }

    return { contextType: 'unknown', action: 'commented' };
  }

  /**
   * Decode Facebook's non-standard Unicode encoding
   */
  private decodeFacebookUnicode(text: string): string {
    return text.replace(/\\u00([0-9a-f]{2})/gi, (match, hex) => {
      const code = parseInt(hex, 16);
      if (code >= 128) {
        return String.fromCharCode(code);
      }
      return match;
    });
  }

  /**
   * Get statistics about comments file
   */
  async getFileStats(filePath: string): Promise<{
    totalComments: number;
    ownComments: number;
    commentsOnOwnPosts: number;
    commentsOnOtherPosts: number;
    dateRange: { earliest: number; latest: number };
    topTargetAuthors: Array<{ name: string; count: number }>;
  }> {
    const rawData = await fs.readFile(filePath, 'utf-8');
    const data: CommentsFile = JSON.parse(rawData);
    const comments = data.comments_v2 || [];

    let ownComments = 0;
    let commentsOnOwnPosts = 0;
    let commentsOnOtherPosts = 0;
    let earliest = Infinity;
    let latest = -Infinity;
    const targetAuthors = new Map<string, number>();

    for (const comment of comments) {
      const timestamp = comment.timestamp;
      if (timestamp < earliest) earliest = timestamp;
      if (timestamp > latest) latest = timestamp;

      const commentData = comment.data?.[0]?.comment;
      const author = commentData?.author || 'Tem Noon';

      if (author === 'Tem Noon') {
        ownComments++;
      }

      const context = this.parseCommentContext(comment.title);
      if (context.contextType === 'own_post') {
        commentsOnOwnPosts++;
      } else if (context.contextType === 'other_post' || context.contextType === 'photo' || context.contextType === 'video') {
        commentsOnOtherPosts++;

        if (context.targetAuthor) {
          targetAuthors.set(context.targetAuthor, (targetAuthors.get(context.targetAuthor) || 0) + 1);
        }
      }
    }

    // Get top 10 target authors
    const topTargetAuthors = Array.from(targetAuthors.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalComments: comments.length,
      ownComments,
      commentsOnOwnPosts,
      commentsOnOtherPosts,
      dateRange: { earliest, latest },
      topTargetAuthors,
    };
  }
}
