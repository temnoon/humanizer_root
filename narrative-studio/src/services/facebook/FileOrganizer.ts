/**
 * FileOrganizer - Organize Facebook content into period-based folders
 *
 * Creates self-contained, portable folders organized by quarters/periods
 */

import fs from 'fs/promises';
import path from 'path';
import { PeriodCalculator, type Period, type ArchiveOrganizationSettings } from './PeriodCalculator.js';
import type { ContentItem, Reaction, PeriodSummary } from './types.js';

export interface OrganizeOptions {
  exportDir: string;              // Original Facebook export directory
  targetDir: string;              // Where to create organized archive
  settings: ArchiveOrganizationSettings;
  preserveSource?: boolean;       // Copy original JSON files to _source/
}

export class FileOrganizer {
  private calculator: PeriodCalculator;
  private settings: ArchiveOrganizationSettings;

  constructor(settings: ArchiveOrganizationSettings) {
    this.settings = settings;
    this.calculator = new PeriodCalculator(settings);
  }

  /**
   * Organize all content into period-based folders
   */
  async organize(
    posts: ContentItem[],
    comments: ContentItem[],
    reactions: Reaction[],
    options: OrganizeOptions
  ): Promise<{
    archiveDir: string;
    periods: PeriodSummary[];
  }> {
    console.log('📁 Organizing Facebook content into period folders...\n');

    const { targetDir, exportDir, preserveSource } = options;

    // Create archive directory
    const archiveId = `facebook_import_${new Date().toISOString().split('T')[0]}`;
    const archiveDir = path.join(targetDir, archiveId);

    await fs.mkdir(archiveDir, { recursive: true });
    console.log(`   Archive directory: ${archiveDir}`);

    // Save settings
    await this.saveSettings(archiveDir);

    // Organize posts by period
    console.log('\n📝 Organizing posts...');
    const postPeriods = await this.organizePosts(posts, archiveDir, exportDir);

    // Organize comments by period
    console.log('\n💬 Organizing comments...');
    const commentPeriods = await this.organizeComments(comments, archiveDir);

    // Organize reactions (all in one file for now, they don't have reliable timestamps)
    console.log('\n❤️  Organizing reactions...');
    await this.organizeReactions(reactions, archiveDir);

    // Preserve source files if requested
    if (preserveSource) {
      console.log('\n📦 Preserving source files...');
      await this.preserveSourceFiles(exportDir, archiveDir);
    }

    // Generate period summaries
    console.log('\n📊 Generating period summaries...');
    const periods = await this.generatePeriodSummaries(posts, comments, reactions, archiveDir);

    // Create manifest
    await this.createManifest(archiveDir, posts.length, comments.length, reactions.length);

    console.log(`\n✅ Organization complete!`);
    console.log(`   Archive: ${archiveDir}`);
    console.log(`   Periods: ${periods.length}`);

    return { archiveDir, periods };
  }

  /**
   * Organize posts into period folders with individual post folders
   */
  private async organizePosts(
    posts: ContentItem[],
    archiveDir: string,
    exportDir: string
  ): Promise<Map<string, ContentItem[]>> {
    const postsDir = path.join(archiveDir, 'posts');
    await fs.mkdir(postsDir, { recursive: true });

    // Group posts by period
    const postsByPeriod = new Map<string, ContentItem[]>();

    for (const post of posts) {
      const period = this.calculator.getPeriodForDate(post.created_at);
      const periodFolder = period.folderName;

      if (!postsByPeriod.has(periodFolder)) {
        postsByPeriod.set(periodFolder, []);
      }
      postsByPeriod.get(periodFolder)!.push(post);
    }

    console.log(`   Found ${postsByPeriod.size} periods`);

    // Create folders for each period
    let totalPostFolders = 0;
    for (const [periodFolder, periodPosts] of postsByPeriod.entries()) {
      const periodDir = path.join(postsDir, periodFolder);
      await fs.mkdir(periodDir, { recursive: true });

      console.log(`   ${periodFolder}: ${periodPosts.length} posts`);

      // Create individual folder for each post
      for (const post of periodPosts) {
        const postFolder = await this.createPostFolder(post, periodDir, exportDir);
        if (postFolder) {
          totalPostFolders++;
        }
      }
    }

    console.log(`   Created ${totalPostFolders} post folders`);
    return postsByPeriod;
  }

  /**
   * Create individual folder for a post
   */
  private async createPostFolder(
    post: ContentItem,
    periodDir: string,
    exportDir: string
  ): Promise<string | null> {
    // Generate folder name
    const date = new Date(post.created_at * 1000);
    const dateStr = date.toISOString().split('T')[0];

    // Extract type from title (shared a link, shared an album, etc.)
    const titleSlug = this.slugify(post.title || 'post');
    const folderName = `post_${dateStr}_${titleSlug}_${post.created_at}`;
    const postDir = path.join(periodDir, folderName);

    try {
      await fs.mkdir(postDir, { recursive: true });

      // Save post.json
      await fs.writeFile(
        path.join(postDir, 'post.json'),
        JSON.stringify(post, null, 2),
        'utf-8'
      );

      // Copy media files if any
      if (post.media_refs && post.media_refs.length > 0) {
        const mediaDir = path.join(postDir, 'media');
        await fs.mkdir(mediaDir, { recursive: true });

        for (const mediaRef of post.media_refs) {
          await this.copyMediaFile(mediaRef, mediaDir, exportDir);
        }
      }

      return postDir;
    } catch (err) {
      console.error(`   ⚠️  Failed to create post folder: ${folderName}`, err);
      return null;
    }
  }

  /**
   * Organize comments by period (consolidated JSON per period)
   */
  private async organizeComments(
    comments: ContentItem[],
    archiveDir: string
  ): Promise<Map<string, ContentItem[]>> {
    const commentsDir = path.join(archiveDir, 'comments');
    await fs.mkdir(commentsDir, { recursive: true });

    // Group comments by period
    const commentsByPeriod = new Map<string, ContentItem[]>();

    for (const comment of comments) {
      const period = this.calculator.getPeriodForDate(comment.created_at);
      const periodFolder = period.folderName;

      if (!commentsByPeriod.has(periodFolder)) {
        commentsByPeriod.set(periodFolder, []);
      }
      commentsByPeriod.get(periodFolder)!.push(comment);
    }

    console.log(`   Found ${commentsByPeriod.size} periods`);

    // Save comments.json for each period
    for (const [periodFolder, periodComments] of commentsByPeriod.entries()) {
      const periodDir = path.join(commentsDir, periodFolder);
      await fs.mkdir(periodDir, { recursive: true });

      console.log(`   ${periodFolder}: ${periodComments.length} comments`);

      await fs.writeFile(
        path.join(periodDir, 'comments.json'),
        JSON.stringify(periodComments, null, 2),
        'utf-8'
      );
    }

    return commentsByPeriod;
  }

  /**
   * Organize reactions (consolidated, since many have timestamp=1)
   */
  private async organizeReactions(
    reactions: Reaction[],
    archiveDir: string
  ): Promise<void> {
    const reactionsDir = path.join(archiveDir, 'reactions');
    await fs.mkdir(reactionsDir, { recursive: true });

    console.log(`   Saving ${reactions.length} reactions`);

    // Save all reactions in one file
    await fs.writeFile(
      path.join(reactionsDir, 'reactions.json'),
      JSON.stringify(reactions, null, 2),
      'utf-8'
    );
  }

  /**
   * Copy media file from export to organized archive
   */
  private async copyMediaFile(
    mediaRef: string,
    targetDir: string,
    exportDir: string
  ): Promise<void> {
    try {
      // Media ref might be absolute or relative
      let sourcePath = mediaRef;
      if (!path.isAbsolute(mediaRef)) {
        sourcePath = path.join(exportDir, mediaRef);
      }

      // Check if source exists
      try {
        await fs.access(sourcePath);
      } catch {
        // File doesn't exist, skip
        return;
      }

      const fileName = path.basename(sourcePath);
      const targetPath = path.join(targetDir, fileName);

      await fs.copyFile(sourcePath, targetPath);
    } catch (err) {
      // Silently skip files that can't be copied
    }
  }

  /**
   * Generate period summaries (stats for each period)
   */
  private async generatePeriodSummaries(
    posts: ContentItem[],
    comments: ContentItem[],
    reactions: Reaction[],
    archiveDir: string
  ): Promise<PeriodSummary[]> {
    // Group all content by period
    const periodData = new Map<string, {
      period: Period;
      posts: ContentItem[];
      comments: ContentItem[];
    }>();

    // Add posts
    for (const post of posts) {
      const period = this.calculator.getPeriodForDate(post.created_at);
      if (!periodData.has(period.folderName)) {
        periodData.set(period.folderName, { period, posts: [], comments: [] });
      }
      periodData.get(period.folderName)!.posts.push(post);
    }

    // Add comments
    for (const comment of comments) {
      const period = this.calculator.getPeriodForDate(comment.created_at);
      if (!periodData.has(period.folderName)) {
        periodData.set(period.folderName, { period, posts: [], comments: [] });
      }
      periodData.get(period.folderName)!.comments.push(comment);
    }

    // Generate summaries
    const summaries: PeriodSummary[] = [];

    for (const [folderName, data] of periodData.entries()) {
      const summary: PeriodSummary = {
        period_folder: folderName,
        start_date: data.period.startDate.getTime() / 1000,
        end_date: data.period.endDate.getTime() / 1000,
        posts_count: data.posts.length,
        comments_count: data.comments.length,
        photos_count: 0,  // TODO: Count from media_files
        videos_count: 0,
        reactions_count: 0,  // TODO: Count reactions in this period
        total_characters: this.countTotalCharacters(data.posts, data.comments),
        media_size_bytes: 0,  // TODO: Calculate from actual files
      };

      summaries.push(summary);

      // Save summary.json in the period folder
      const periodDir = path.join(archiveDir, 'posts', folderName);
      await fs.mkdir(periodDir, { recursive: true });
      await fs.writeFile(
        path.join(periodDir, 'summary.json'),
        JSON.stringify(summary, null, 2),
        'utf-8'
      );
    }

    return summaries.sort((a, b) => a.start_date - b.start_date);
  }

  /**
   * Count total characters in content
   */
  private countTotalCharacters(posts: ContentItem[], comments: ContentItem[]): number {
    let total = 0;
    for (const post of posts) {
      if (post.text) total += post.text.length;
      if (post.title) total += post.title.length;
    }
    for (const comment of comments) {
      if (comment.text) total += comment.text.length;
    }
    return total;
  }

  /**
   * Save settings to archive
   */
  private async saveSettings(archiveDir: string): Promise<void> {
    await fs.writeFile(
      path.join(archiveDir, 'settings.json'),
      JSON.stringify(this.settings, null, 2),
      'utf-8'
    );
  }

  /**
   * Create manifest.json with import metadata
   */
  private async createManifest(
    archiveDir: string,
    postsCount: number,
    commentsCount: number,
    reactionsCount: number
  ): Promise<void> {
    const manifest = {
      version: '1.0',
      created_at: Date.now() / 1000,
      source: 'facebook',
      settings: this.settings,
      totals: {
        posts: postsCount,
        comments: commentsCount,
        reactions: reactionsCount,
      },
    };

    await fs.writeFile(
      path.join(archiveDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );
  }

  /**
   * Preserve source files in _source directory
   */
  private async preserveSourceFiles(exportDir: string, archiveDir: string): Promise<void> {
    const sourceDir = path.join(archiveDir, '_source');
    await fs.mkdir(sourceDir, { recursive: true });

    // Copy posts JSON
    const postsDir = path.join(exportDir, 'your_facebook_activity/posts');
    const commentsDir = path.join(exportDir, 'your_facebook_activity/comments_and_reactions');

    try {
      const postsFiles = await fs.readdir(postsDir);
      for (const file of postsFiles) {
        if (file.endsWith('.json')) {
          await fs.copyFile(
            path.join(postsDir, file),
            path.join(sourceDir, file)
          );
        }
      }
    } catch (err) {
      console.warn('   ⚠️  Could not copy posts source files');
    }

    try {
      const commentsFiles = await fs.readdir(commentsDir);
      for (const file of commentsFiles) {
        if (file.endsWith('.json')) {
          await fs.copyFile(
            path.join(commentsDir, file),
            path.join(sourceDir, file)
          );
        }
      }
    } catch (err) {
      console.warn('   ⚠️  Could not copy comments/reactions source files');
    }
  }

  /**
   * Convert string to URL-friendly slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);  // Limit length
  }
}
