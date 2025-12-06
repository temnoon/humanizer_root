/**
 * FacebookFullParser - Main orchestrator for Facebook full archive import
 *
 * Coordinates parsing, organizing, and indexing of Facebook content
 */

import path from 'path';
import { PostsParser } from './PostsParser.js';
import { CommentsParser } from './CommentsParser.js';
import { ReactionsParser } from './ReactionsParser.js';
import { FileOrganizer } from './FileOrganizer.js';
import { DatabaseImporter } from './DatabaseImporter.js';
import { MediaParser } from './MediaParser.js';
import { MediaItemsDatabase } from './MediaItemsDatabase.js';
import { PeriodCalculator, DEFAULT_SETTINGS, type ArchiveOrganizationSettings } from './PeriodCalculator.js';
import type { ContentItem, Reaction, FacebookImportResult, FacebookImportProgress } from './types.js';

export interface FacebookImportOptions {
  exportDir: string;                          // Facebook export directory
  targetDir: string;                          // Where to create organized archive
  archivePath?: string;                       // Path to archive for database (default: targetDir/archive_id)
  settings?: Partial<ArchiveOrganizationSettings>;
  preserveSource?: boolean;                   // Copy original JSON to _source/
  generateEmbeddings?: boolean;               // Generate embeddings (default: true)
  onProgress?: (progress: FacebookImportProgress) => void;
}

export class FacebookFullParser {
  private postsParser: PostsParser;
  private commentsParser: CommentsParser;
  private reactionsParser: ReactionsParser;

  constructor() {
    this.postsParser = new PostsParser();
    this.commentsParser = new CommentsParser();
    this.reactionsParser = new ReactionsParser();
  }

  /**
   * Import a complete Facebook export
   */
  async importExport(options: FacebookImportOptions): Promise<FacebookImportResult> {
    const { exportDir, targetDir, settings, preserveSource = true, generateEmbeddings = true, onProgress } = options;

    console.log('🎯 Starting Facebook full archive import...\n');
    console.log(`   Export: ${exportDir}`);
    console.log(`   Target: ${targetDir}\n`);

    const importSettings: ArchiveOrganizationSettings = {
      ...DEFAULT_SETTINGS,
      ...settings,
    };

    const startTime = Date.now();

    try {
      // ================================================================
      // Stage 1: Parse all content from export
      // ================================================================
      onProgress?.({
        stage: 'parsing',
        current: 0,
        total: 3,
        message: 'Parsing posts, comments, and reactions...',
      });

      console.log('📂 Stage 1: Parsing content from export\n');

      // Parse posts
      const postsDir = path.join(exportDir, 'your_facebook_activity/posts');
      const posts = await this.postsParser.parseAll(postsDir, exportDir);

      onProgress?.({
        stage: 'parsing',
        current: 1,
        total: 3,
        message: `Parsed ${posts.length} posts`,
      });

      // Parse comments
      const commentsFile = path.join(exportDir, 'your_facebook_activity/comments_and_reactions/comments.json');
      const comments = await this.commentsParser.parse(commentsFile);

      onProgress?.({
        stage: 'parsing',
        current: 2,
        total: 3,
        message: `Parsed ${comments.length} comments`,
      });

      // Parse reactions
      const reactionsDir = path.join(exportDir, 'your_facebook_activity/comments_and_reactions');
      const reactions = await this.reactionsParser.parseAll(reactionsDir);

      onProgress?.({
        stage: 'parsing',
        current: 3,
        total: 3,
        message: `Parsed ${reactions.length} reactions`,
      });

      console.log(`\n✅ Parsing complete:`);
      console.log(`   Posts: ${posts.length}`);
      console.log(`   Comments: ${comments.length}`);
      console.log(`   Reactions: ${reactions.length}`);
      console.log(`   Total items: ${posts.length + comments.length + reactions.length}\n`);

      // ================================================================
      // Stage 2: Organize into period folders
      // ================================================================
      onProgress?.({
        stage: 'organizing',
        current: 0,
        total: 1,
        message: 'Organizing content into period folders...',
      });

      console.log('📁 Stage 2: Organizing into period folders\n');

      const organizer = new FileOrganizer(importSettings);
      const { archiveDir, periods } = await organizer.organize(posts, comments, reactions, {
        exportDir,
        targetDir,
        settings: importSettings,
        preserveSource,
      });

      onProgress?.({
        stage: 'organizing',
        current: 1,
        total: 1,
        message: `Organized into ${periods.length} periods`,
      });

      // ================================================================
      // Stage 3: Parse and index media items
      // ================================================================
      onProgress?.({
        stage: 'media',
        current: 0,
        total: 1,
        message: 'Parsing media items...',
      });

      console.log('🎬 Stage 3: Parsing media items\n');

      const mediaParser = new MediaParser(exportDir);
      const mediaItems = await mediaParser.parseAll();

      onProgress?.({
        stage: 'media',
        current: 1,
        total: 1,
        message: `Parsed ${mediaItems.length} media items`,
      });

      // Index media into database
      const dbArchivePath = options.archivePath || archiveDir;
      const mediaDb = new MediaItemsDatabase(dbArchivePath);
      const mediaIndexed = mediaDb.insertMediaItems(mediaItems);
      console.log(`✅ Indexed ${mediaIndexed} media items into database\n`);

      // ================================================================
      // Stage 4: Index into database with embeddings
      // ================================================================
      let embeddingsGenerated = 0;

      if (generateEmbeddings) {
        onProgress?.({
          stage: 'indexing',
          current: 0,
          total: 1,
          message: 'Indexing into database...',
        });

        const importer = new DatabaseImporter(dbArchivePath);

        const dbResult = await importer.importToDatabase(posts, comments, reactions, {
          archivePath: dbArchivePath,
          batchSize: 100,
          onProgress,
        });

        embeddingsGenerated = dbResult.embeddingsGenerated;
        importer.close();

        onProgress?.({
          stage: 'indexing',
          current: 1,
          total: 1,
          message: `Indexed ${dbResult.postsIndexed + dbResult.commentsIndexed} items with ${embeddingsGenerated} embeddings`,
        });
      }

      mediaDb.close();

      // ================================================================
      // Calculate statistics
      // ================================================================
      const photosCount = mediaItems.filter(m => m.media_type === 'image').length;
      const videosCount = mediaItems.filter(m => m.media_type === 'video').length;

      const result: FacebookImportResult = {
        archive_id: path.basename(archiveDir),
        import_date: Date.now() / 1000,
        settings: importSettings,
        periods,
        total_items: posts.length + comments.length + reactions.length + mediaItems.length,
        posts_imported: posts.length,
        comments_imported: comments.length,
        photos_imported: photosCount,
        videos_imported: videosCount,
        reactions_imported: reactions.length,
        errors: [],
      };

      const durationSec = (Date.now() - startTime) / 1000;

      console.log(`\n✅ Import complete! (${durationSec.toFixed(1)}s)`);
      console.log(`   Archive: ${archiveDir}`);
      console.log(`   Periods: ${periods.length}`);
      console.log(`   Total items: ${result.total_items}`);

      onProgress?.({
        stage: 'complete',
        current: 1,
        total: 1,
        message: 'Import complete!',
      });

      return result;

    } catch (error) {
      console.error('\n❌ Import failed:', error);
      throw error;
    }
  }

  /**
   * Get preview of what would be imported (without actually organizing files)
   */
  async getImportPreview(exportDir: string, settings?: Partial<ArchiveOrganizationSettings>): Promise<{
    posts: number;
    comments: number;
    reactions: number;
    periods: number;
    dateRange: { earliest: Date; latest: Date };
  }> {
    console.log('👀 Getting import preview...\n');

    const importSettings: ArchiveOrganizationSettings = {
      ...DEFAULT_SETTINGS,
      ...settings,
    };

    // Quick stats from first posts file
    const postsFile = path.join(exportDir, 'your_facebook_activity/posts/your_posts__check_ins__photos_and_videos_1.json');
    const postsStats = await this.postsParser.getFileStats(postsFile);

    // Quick stats from comments
    const commentsFile = path.join(exportDir, 'your_facebook_activity/comments_and_reactions/comments.json');
    const commentsStats = await this.commentsParser.getFileStats(commentsFile);

    // Quick stats from reactions
    const reactionsDir = path.join(exportDir, 'your_facebook_activity/comments_and_reactions');
    const reactionsStats = await this.reactionsParser.getAllStats(reactionsDir);

    // Calculate periods
    const earliest = Math.min(postsStats.dateRange.earliest, commentsStats.dateRange.earliest);
    const latest = Math.max(postsStats.dateRange.latest, commentsStats.dateRange.latest);

    const calculator = new PeriodCalculator(importSettings);
    const periods = calculator.getPeriodsInRange(earliest, latest);

    return {
      posts: postsStats.totalPosts,
      comments: commentsStats.totalComments,
      reactions: reactionsStats.totalReactions,
      periods: periods.length,
      dateRange: {
        earliest: new Date(earliest * 1000),
        latest: new Date(latest * 1000),
      },
    };
  }

  /**
   * Detect if a directory is a Facebook export
   */
  static async detectFormat(exportDir: string): Promise<boolean> {
    try {
      const { default: fs } = await import('fs/promises');

      // Check for characteristic Facebook export structure
      const postsPath = path.join(exportDir, 'your_facebook_activity/posts');
      const commentsPath = path.join(exportDir, 'your_facebook_activity/comments_and_reactions');

      const [postsExists, commentsExists] = await Promise.all([
        fs.access(postsPath).then(() => true).catch(() => false),
        fs.access(commentsPath).then(() => true).catch(() => false),
      ]);

      return postsExists || commentsExists;
    } catch {
      return false;
    }
  }
}
