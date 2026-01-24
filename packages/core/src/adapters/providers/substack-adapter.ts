/**
 * Substack Adapter
 *
 * Parses Substack newsletter exports.
 *
 * Export structure:
 * - posts.json - Published posts
 * - drafts.json - Unpublished drafts
 * - comments.json - Comments on posts
 * - notes.json - Substack notes
 * - settings.json - Publication settings
 *
 * Output content types:
 * - substack-post
 * - substack-draft
 * - substack-comment
 * - substack-note
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
// TYPES FOR SUBSTACK EXPORT FORMAT
// ═══════════════════════════════════════════════════════════════════

interface SubstackPost {
  id: number | string;
  title: string;
  subtitle?: string;
  slug: string;
  post_date: string;
  publication_id?: number;
  audience: 'everyone' | 'only_paid' | 'founding' | 'free';
  type: 'newsletter' | 'podcast' | 'thread';
  section_id?: number;
  section_name?: string;
  body_html: string;
  body_text?: string;
  word_count?: number;
  canonical_url: string;
  podcast_url?: string;
  reaction_count?: number;
  comment_count?: number;
  is_published: boolean;
}

interface SubstackDraft extends SubstackPost {
  is_published: false;
}

interface SubstackComment {
  id: number | string;
  post_id: number | string;
  user_id?: number | string;
  user_name?: string;
  body: string;
  date: string;
  edited_at?: string;
  reaction_count?: number;
  parent_comment_id?: number | string;
}

interface SubstackNote {
  id: number | string;
  body: string;
  date: string;
  reaction_count?: number;
  restacks?: number;
  attachments?: Array<{
    type: string;
    url?: string;
    post_id?: number;
  }>;
}

interface SubstackSettings {
  publication_id: number;
  name: string;
  subdomain: string;
  custom_domain?: string;
  author_name?: string;
  author_bio?: string;
}

// ═══════════════════════════════════════════════════════════════════
// SUBSTACK ADAPTER
// ═══════════════════════════════════════════════════════════════════

export class SubstackAdapter extends BaseAdapter {
  readonly id = 'substack';
  readonly name = 'Substack';
  readonly description = 'Import Substack newsletter exports';
  readonly version = '1.0.0';
  readonly contentTypes = ['substack-post', 'substack-draft', 'substack-comment', 'substack-note'];
  readonly supportedExtensions = ['.zip', '.json'];

  // ─────────────────────────────────────────────────────────────────
  // DETECTION
  // ─────────────────────────────────────────────────────────────────

  async detect(source: AdapterSource): Promise<DetectionResult> {
    try {
      const path = source.path;

      // Check for posts.json (primary indicator)
      const postsPath = join(path, 'posts.json');
      const settingsPath = join(path, 'settings.json');

      const hasPosts = await this.fileExists(postsPath);
      const hasSettings = await this.fileExists(settingsPath);

      if (hasPosts && hasSettings) {
        // Verify Substack structure
        const posts = await this.readJson<SubstackPost[]>(postsPath);
        if (Array.isArray(posts) && posts.length > 0) {
          const first = posts[0];
          if ('slug' in first && 'body_html' in first && 'audience' in first) {
            return {
              canHandle: true,
              confidence: 0.95,
              format: 'substack-export',
              reason: 'Found posts.json with Substack structure and settings.json',
            };
          }
        }
      }

      if (hasPosts) {
        const posts = await this.readJson<SubstackPost[]>(postsPath);
        if (Array.isArray(posts) && posts.length > 0) {
          const first = posts[0];
          if ('slug' in first && 'canonical_url' in first && first.canonical_url?.includes('substack')) {
            return {
              canHandle: true,
              confidence: 0.85,
              format: 'substack-export',
              reason: 'Found posts.json with Substack URLs',
            };
          }
        }
      }

      // Check for notes.json
      const notesPath = join(path, 'notes.json');
      if (await this.fileExists(notesPath)) {
        return {
          canHandle: true,
          confidence: 0.7,
          format: 'substack-notes',
          reason: 'Found notes.json (Substack Notes export)',
        };
      }

      return {
        canHandle: false,
        confidence: 0,
        reason: 'No Substack export structure detected',
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
        message: 'Not a valid Substack export',
        details: { reason: detection.reason },
      });
      return { valid: false, errors, warnings };
    }

    // Check for content
    const postsPath = join(source.path, 'posts.json');
    if (await this.fileExists(postsPath)) {
      const posts = await this.readJson<SubstackPost[]>(postsPath);
      if (posts.length === 0) {
        warnings.push({
          code: 'EMPTY_POSTS',
          message: 'No posts found in export',
          path: postsPath,
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

    // Parse settings
    const settingsPath = join(source.path, 'settings.json');
    if (await this.fileExists(settingsPath)) {
      try {
        const settings = await this.readJson<SubstackSettings>(settingsPath);
        accountInfo = {
          id: String(settings.publication_id),
          name: settings.author_name || settings.name,
          handle: settings.subdomain,
        };
      } catch (error) {
        console.debug('[SubstackAdapter] Failed to parse settings.json:', error);
      }
    }

    // Count posts
    const postsPath = join(source.path, 'posts.json');
    if (await this.fileExists(postsPath)) {
      const posts = await this.readJson<SubstackPost[]>(postsPath);
      estimatedCount += posts.length;
      contentTypes.add('substack-post');

      for (const post of posts) {
        const date = this.parseTimestamp(post.post_date);
        if (date) {
          if (!earliestDate || date < earliestDate) earliestDate = date;
          if (!latestDate || date > latestDate) latestDate = date;
        }
      }
    }

    // Count drafts
    const draftsPath = join(source.path, 'drafts.json');
    if (await this.fileExists(draftsPath)) {
      const drafts = await this.readJson<SubstackDraft[]>(draftsPath);
      estimatedCount += drafts.length;
      contentTypes.add('substack-draft');
    }

    // Count comments
    const commentsPath = join(source.path, 'comments.json');
    if (await this.fileExists(commentsPath)) {
      const comments = await this.readJson<SubstackComment[]>(commentsPath);
      estimatedCount += comments.length;
      contentTypes.add('substack-comment');
    }

    // Count notes
    const notesPath = join(source.path, 'notes.json');
    if (await this.fileExists(notesPath)) {
      const notes = await this.readJson<SubstackNote[]>(notesPath);
      estimatedCount += notes.length;
      contentTypes.add('substack-note');
    }

    return {
      format: detection.format || 'substack-export',
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
    _options: ParseOptions
  ): AsyncGenerator<ImportedNode, void, undefined> {
    // Parse posts
    yield* this.parsePosts(source);

    // Parse drafts
    yield* this.parseDrafts(source);

    // Parse comments
    yield* this.parseComments(source);

    // Parse notes
    yield* this.parseNotes(source);
  }

  private async *parsePosts(source: AdapterSource): AsyncGenerator<ImportedNode, void, undefined> {
    const postsPath = join(source.path, 'posts.json');
    if (!(await this.fileExists(postsPath))) return;

    const posts = await this.readJson<SubstackPost[]>(postsPath);

    for (const post of posts) {
      yield this.postToNode(post, 'substack-post');
    }
  }

  private async *parseDrafts(source: AdapterSource): AsyncGenerator<ImportedNode, void, undefined> {
    const draftsPath = join(source.path, 'drafts.json');
    if (!(await this.fileExists(draftsPath))) return;

    const drafts = await this.readJson<SubstackDraft[]>(draftsPath);

    for (const draft of drafts) {
      yield this.postToNode(draft, 'substack-draft');
    }
  }

  private async *parseComments(source: AdapterSource): AsyncGenerator<ImportedNode, void, undefined> {
    const commentsPath = join(source.path, 'comments.json');
    if (!(await this.fileExists(commentsPath))) return;

    const comments = await this.readJson<SubstackComment[]>(commentsPath);

    for (const comment of comments) {
      yield this.commentToNode(comment);
    }
  }

  private async *parseNotes(source: AdapterSource): AsyncGenerator<ImportedNode, void, undefined> {
    const notesPath = join(source.path, 'notes.json');
    if (!(await this.fileExists(notesPath))) return;

    const notes = await this.readJson<SubstackNote[]>(notesPath);

    for (const note of notes) {
      yield this.noteToNode(note);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // CONVERTERS
  // ─────────────────────────────────────────────────────────────────

  private postToNode(post: SubstackPost, sourceType: string): ImportedNode {
    const id = String(post.id);

    // Extract plain text from HTML if not provided
    const content = post.body_text || this.stripHtml(post.body_html);

    return {
      id,
      uri: this.generateUri('post', id),
      contentHash: this.hashContent(post.title + content),
      content,
      format: 'html',
      sourceType,
      sourceCreatedAt: this.parseTimestamp(post.post_date),
      metadata: {
        postId: id,
        title: post.title,
        subtitle: post.subtitle,
        slug: post.slug,
        audience: post.audience,
        type: post.type,
        sectionId: post.section_id,
        sectionName: post.section_name,
        wordCount: post.word_count,
        canonicalUrl: post.canonical_url,
        podcastUrl: post.podcast_url,
        reactionCount: post.reaction_count,
        commentCount: post.comment_count,
        isPublished: post.is_published,
        bodyHtml: post.body_html,
      },
    };
  }

  private commentToNode(comment: SubstackComment): ImportedNode {
    const id = String(comment.id);

    const links: ContentLink[] = [];

    // Link to post
    if (comment.post_id) {
      links.push({
        type: 'parent',
        targetUri: this.generateUri('post', String(comment.post_id)),
      });
    }

    // Link to parent comment (for replies)
    if (comment.parent_comment_id) {
      links.push({
        type: 'reply-to',
        targetUri: this.generateUri('comment', String(comment.parent_comment_id)),
      });
    }

    return {
      id,
      uri: this.generateUri('comment', id),
      contentHash: this.hashContent(comment.body),
      content: comment.body,
      format: 'text',
      sourceType: 'substack-comment',
      sourceCreatedAt: this.parseTimestamp(comment.date),
      sourceUpdatedAt: comment.edited_at ? this.parseTimestamp(comment.edited_at) : undefined,
      author: comment.user_name ? {
        id: comment.user_id ? String(comment.user_id) : undefined,
        name: comment.user_name,
      } : undefined,
      parentUri: comment.post_id ? this.generateUri('post', String(comment.post_id)) : undefined,
      links,
      metadata: {
        commentId: id,
        postId: comment.post_id,
        userId: comment.user_id,
        userName: comment.user_name,
        reactionCount: comment.reaction_count,
        parentCommentId: comment.parent_comment_id,
      },
    };
  }

  private noteToNode(note: SubstackNote): ImportedNode {
    const id = String(note.id);

    const media: MediaReference[] = [];
    const links: ContentLink[] = [];

    // Process attachments
    if (note.attachments) {
      for (const att of note.attachments) {
        if (att.url) {
          media.push({
            id: `${id}-att-${media.length}`,
            type: this.classifyAttachmentType(att.type),
            url: att.url,
          });
        }
        if (att.post_id) {
          links.push({
            type: 'references',
            targetUri: this.generateUri('post', String(att.post_id)),
          });
        }
      }
    }

    return {
      id,
      uri: this.generateUri('note', id),
      contentHash: this.hashContent(note.body),
      content: note.body,
      format: 'text',
      sourceType: 'substack-note',
      sourceCreatedAt: this.parseTimestamp(note.date),
      media,
      links,
      metadata: {
        noteId: id,
        reactionCount: note.reaction_count,
        restacks: note.restacks,
        attachments: note.attachments,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  private stripHtml(html: string): string {
    // Basic HTML stripping - in production would use a proper parser
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private classifyAttachmentType(type?: string): MediaReference['type'] {
    if (!type) return 'other';
    if (type.includes('image')) return 'image';
    if (type.includes('video')) return 'video';
    if (type.includes('audio')) return 'audio';
    return 'other';
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════

export const substackAdapter = new SubstackAdapter();
