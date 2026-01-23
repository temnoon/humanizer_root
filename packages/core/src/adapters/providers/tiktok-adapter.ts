/**
 * TikTok Adapter
 *
 * Parses TikTok data exports (GDPR / Settings > Privacy > Download your data).
 *
 * Export structure:
 * - Video/Videos.txt - Posted videos metadata
 * - Comment/Comments.txt - Comments made
 * - Direct Messages/*.txt - DM conversations
 * - Like List/Like List.txt - Liked videos
 * - Favorite Videos/Favorite Videos.txt - Favorited videos
 * - Activity/Browse History.txt - Watch history
 *
 * TikTok uses a custom TXT format with pipe delimiters and custom date formats.
 *
 * Output content types:
 * - tiktok-video
 * - tiktok-comment
 * - tiktok-dm
 * - tiktok-like
 * - tiktok-favorite
 * - tiktok-browse
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
// TYPES FOR TIKTOK EXPORT FORMAT
// ═══════════════════════════════════════════════════════════════════

interface TikTokVideo {
  date: string;
  link?: string;
  likes?: string;
}

interface TikTokComment {
  date: string;
  comment: string;
}

interface TikTokDM {
  date: string;
  from: string;
  content: string;
}

interface TikTokLike {
  date: string;
  link: string;
}

// ═══════════════════════════════════════════════════════════════════
// TIKTOK ADAPTER
// ═══════════════════════════════════════════════════════════════════

export class TikTokAdapter extends BaseAdapter {
  readonly id = 'tiktok';
  readonly name = 'TikTok';
  readonly description = 'Import TikTok data exports';
  readonly version = '1.0.0';
  readonly contentTypes = [
    'tiktok-video',
    'tiktok-comment',
    'tiktok-dm',
    'tiktok-like',
    'tiktok-favorite',
    'tiktok-browse',
  ];
  readonly supportedExtensions = ['.zip', '.txt'];

  // ─────────────────────────────────────────────────────────────────
  // DETECTION
  // ─────────────────────────────────────────────────────────────────

  async detect(source: AdapterSource): Promise<DetectionResult> {
    try {
      const path = source.path;

      // Check for TikTok-specific folder structure
      const videoDir = join(path, 'Video');
      const commentDir = join(path, 'Comment');
      const dmDir = join(path, 'Direct Messages');
      const likeDir = join(path, 'Like List');
      const activityDir = join(path, 'Activity');

      const hasVideo = await this.isDirectory(videoDir);
      const hasComment = await this.isDirectory(commentDir);
      const hasDM = await this.isDirectory(dmDir);
      const hasLike = await this.isDirectory(likeDir);
      const hasActivity = await this.isDirectory(activityDir);

      const matchCount = [hasVideo, hasComment, hasDM, hasLike, hasActivity].filter(Boolean).length;

      if (matchCount >= 2) {
        return {
          canHandle: true,
          confidence: 0.9,
          format: 'tiktok-export',
          reason: `Found ${matchCount} TikTok export folders`,
        };
      }

      // Check for Videos.txt file specifically
      const videosTxt = join(path, 'Video', 'Videos.txt');
      if (await this.fileExists(videosTxt)) {
        return {
          canHandle: true,
          confidence: 0.85,
          format: 'tiktok-export',
          reason: 'Found Video/Videos.txt',
        };
      }

      // Check for alternate location
      const altVideosTxt = join(path, 'Videos.txt');
      if (await this.fileExists(altVideosTxt)) {
        const content = await this.readFile(altVideosTxt);
        if (content.includes('Date:') && content.includes('Link:')) {
          return {
            canHandle: true,
            confidence: 0.7,
            format: 'tiktok-export-flat',
            reason: 'Found Videos.txt with TikTok format',
          };
        }
      }

      return {
        canHandle: false,
        confidence: 0,
        reason: 'No TikTok export structure detected',
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
        message: 'Not a valid TikTok export',
        details: { reason: detection.reason },
      });
      return { valid: false, errors, warnings };
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
    const contentTypes = new Set<string>();

    // Check for each content type folder
    const videosTxt = join(source.path, 'Video', 'Videos.txt');
    if (await this.fileExists(videosTxt)) {
      const content = await this.readFile(videosTxt);
      const videoCount = (content.match(/Date:/g) || []).length;
      estimatedCount += videoCount;
      if (videoCount > 0) contentTypes.add('tiktok-video');
    }

    const commentsTxt = join(source.path, 'Comment', 'Comments.txt');
    if (await this.fileExists(commentsTxt)) {
      const content = await this.readFile(commentsTxt);
      const commentCount = (content.match(/Date:/g) || []).length;
      estimatedCount += commentCount;
      if (commentCount > 0) contentTypes.add('tiktok-comment');
    }

    const dmDir = join(source.path, 'Direct Messages');
    if (await this.isDirectory(dmDir)) {
      const files = await this.findFiles(dmDir, ['.txt'], false).catch(() => []);
      estimatedCount += files.length * 10; // Estimate 10 messages per conversation
      if (files.length > 0) contentTypes.add('tiktok-dm');
    }

    return {
      format: detection.format || 'tiktok-export',
      formatVersion: '1.0',
      estimatedCount,
      contentTypes: Array.from(contentTypes),
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // PARSING
  // ─────────────────────────────────────────────────────────────────

  protected async *parseSource(
    source: AdapterSource,
    options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    // Parse videos
    yield* this.parseVideos(source, options);

    // Parse comments
    yield* this.parseComments(source, options);

    // Parse DMs
    yield* this.parseDMs(source, options);

    // Parse likes
    yield* this.parseLikes(source, options);

    // Parse favorites
    yield* this.parseFavorites(source, options);
  }

  private async *parseVideos(
    source: AdapterSource,
    _options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    const videosTxt = join(source.path, 'Video', 'Videos.txt');
    if (!(await this.fileExists(videosTxt))) return;

    try {
      const content = await this.readFile(videosTxt);
      const videos = this.parseTikTokTxt(content);

      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        const id = `video-${i}`;
        const date = this.parseTikTokDate(video.Date);

        yield {
          id,
          uri: this.generateUri('video', id),
          contentHash: this.hashContent(`video:${video.Link || i}:${video.Date}`),
          content: `TikTok video posted on ${video.Date}`,
          format: 'text',
          sourceType: 'tiktok-video',
          sourceCreatedAt: date,
          metadata: {
            link: video.Link,
            likes: video.Likes,
            date: video.Date,
          },
        };
      }
    } catch (error) {
      this.log('warn', 'Failed to parse Videos.txt', error);
    }
  }

  private async *parseComments(
    source: AdapterSource,
    _options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    const commentsTxt = join(source.path, 'Comment', 'Comments.txt');
    if (!(await this.fileExists(commentsTxt))) return;

    try {
      const content = await this.readFile(commentsTxt);
      const comments = this.parseTikTokTxt(content);

      for (let i = 0; i < comments.length; i++) {
        const comment = comments[i];
        const id = `comment-${i}`;
        const date = this.parseTikTokDate(comment.Date);
        const commentText = comment.Comment || '';

        yield {
          id,
          uri: this.generateUri('comment', id),
          contentHash: this.hashContent(commentText),
          content: commentText,
          format: 'text',
          sourceType: 'tiktok-comment',
          sourceCreatedAt: date,
          metadata: {
            date: comment.Date,
          },
        };
      }
    } catch (error) {
      this.log('warn', 'Failed to parse Comments.txt', error);
    }
  }

  private async *parseDMs(
    source: AdapterSource,
    _options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    const dmDir = join(source.path, 'Direct Messages');
    if (!(await this.isDirectory(dmDir))) return;

    const files = await this.findFiles(dmDir, ['.txt'], false).catch(() => []);

    for (const file of files) {
      try {
        const content = await this.readFile(file);
        const messages = this.parseTikTokDMTxt(content);

        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          const id = `dm-${file}-${i}`;
          const date = this.parseTikTokDate(msg.Date);

          yield {
            id,
            uri: this.generateUri('dm', id),
            contentHash: this.hashContent(`${msg.From}:${msg.Content}`),
            content: msg.Content,
            format: 'text',
            sourceType: 'tiktok-dm',
            sourceCreatedAt: date,
            author: {
              name: msg.From,
            },
            metadata: {
              date: msg.Date,
              from: msg.From,
            },
          };
        }
      } catch (error) {
        this.log('warn', `Failed to parse DM file: ${file}`, error);
      }
    }
  }

  private async *parseLikes(
    source: AdapterSource,
    _options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    const likesTxt = join(source.path, 'Like List', 'Like List.txt');
    if (!(await this.fileExists(likesTxt))) return;

    try {
      const content = await this.readFile(likesTxt);
      const likes = this.parseTikTokTxt(content);

      for (let i = 0; i < likes.length; i++) {
        const like = likes[i];
        const id = `like-${i}`;
        const date = this.parseTikTokDate(like.Date);

        yield {
          id,
          uri: this.generateUri('like', id),
          contentHash: this.hashContent(`like:${like.Link || i}`),
          content: `Liked video`,
          format: 'text',
          sourceType: 'tiktok-like',
          sourceCreatedAt: date,
          links: like.Link ? [
            {
              type: 'references',
              targetUri: like.Link,
            },
          ] : undefined,
          metadata: {
            link: like.Link,
            date: like.Date,
          },
        };
      }
    } catch (error) {
      this.log('warn', 'Failed to parse Like List.txt', error);
    }
  }

  private async *parseFavorites(
    source: AdapterSource,
    _options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    const favoritesTxt = join(source.path, 'Favorite Videos', 'Favorite Videos.txt');
    if (!(await this.fileExists(favoritesTxt))) return;

    try {
      const content = await this.readFile(favoritesTxt);
      const favorites = this.parseTikTokTxt(content);

      for (let i = 0; i < favorites.length; i++) {
        const fav = favorites[i];
        const id = `favorite-${i}`;
        const date = this.parseTikTokDate(fav.Date);

        yield {
          id,
          uri: this.generateUri('favorite', id),
          contentHash: this.hashContent(`favorite:${fav.Link || i}`),
          content: `Favorited video`,
          format: 'text',
          sourceType: 'tiktok-favorite',
          sourceCreatedAt: date,
          links: fav.Link ? [
            {
              type: 'references',
              targetUri: fav.Link,
            },
          ] : undefined,
          metadata: {
            link: fav.Link,
            date: fav.Date,
          },
        };
      }
    } catch (error) {
      this.log('warn', 'Failed to parse Favorite Videos.txt', error);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Parse TikTok's custom TXT format
   *
   * Format example:
   * Date: 2023-01-15 10:30:45
   * Link: https://www.tiktok.com/...
   * Likes: 100
   *
   * Date: 2023-01-14 08:20:30
   * ...
   */
  private parseTikTokTxt(content: string): Array<Record<string, string>> {
    const items: Array<Record<string, string>> = [];
    const blocks = content.split(/\n\n+/);

    for (const block of blocks) {
      if (!block.trim()) continue;

      const item: Record<string, string> = {};
      const lines = block.split('\n');

      for (const line of lines) {
        const match = line.match(/^([^:]+):\s*(.*)$/);
        if (match) {
          item[match[1].trim()] = match[2].trim();
        }
      }

      if (Object.keys(item).length > 0) {
        items.push(item);
      }
    }

    return items;
  }

  /**
   * Parse TikTok DM conversation format
   *
   * Format example:
   * Date: 2023-01-15 10:30:45
   * From: username
   * Content: Hello!
   */
  private parseTikTokDMTxt(content: string): Array<{ Date: string; From: string; Content: string }> {
    const messages: Array<{ Date: string; From: string; Content: string }> = [];
    const blocks = content.split(/\n\n+/);

    for (const block of blocks) {
      if (!block.trim()) continue;

      const lines = block.split('\n');
      const msg: { Date: string; From: string; Content: string } = {
        Date: '',
        From: '',
        Content: '',
      };

      for (const line of lines) {
        const match = line.match(/^([^:]+):\s*(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim();
          if (key === 'Date') msg.Date = value;
          else if (key === 'From') msg.From = value;
          else if (key === 'Content') msg.Content = value;
        }
      }

      if (msg.Content || msg.From) {
        messages.push(msg);
      }
    }

    return messages;
  }

  /**
   * Parse TikTok date format: "2023-01-15 10:30:45"
   */
  private parseTikTokDate(dateStr: string): Date | undefined {
    if (!dateStr) return undefined;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? undefined : date;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════

export const tiktokAdapter = new TikTokAdapter();
