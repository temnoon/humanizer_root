/**
 * Conversation Parser - Main Orchestrator
 *
 * Coordinates parsing, indexing, and matching for conversation archives.
 * Uses comprehensive 7-strategy media matching.
 * Ported from narrative-studio: ConversationParser.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { OpenAIParser } from './OpenAIParser.js';
import { ClaudeParser } from './ClaudeParser.js';
import { FacebookParser } from './FacebookParser.js';
import { FacebookRelationshipParser } from './FacebookRelationshipParser.js';
import { BrowserPluginParser } from './BrowserPluginParser.js';
import { RedditParser } from './RedditParser.js';
import { TwitterParser } from './TwitterParser.js';
import { InstagramParser } from './InstagramParser.js';
import { SubstackParser } from './SubstackParser.js';
import { ComprehensiveMediaIndexer } from './ComprehensiveMediaIndexer.js';
import { ComprehensiveMediaMatcher } from './ComprehensiveMediaMatcher.js';
import type { ParsedArchive, ParsedArchiveWithRelationships, Conversation, ExportFormat, MediaFile } from './types.js';
import { extractZip, ensureDir, generateId } from './utils.js';

export class ConversationParser {
  private openAIParser: OpenAIParser;
  private claudeParser: ClaudeParser;
  private facebookParser: FacebookParser;
  private facebookRelationshipParser: FacebookRelationshipParser;
  private browserPluginParser: BrowserPluginParser;
  private redditParser: RedditParser;
  private twitterParser: TwitterParser;
  private instagramParser: InstagramParser;
  private substackParser: SubstackParser;
  private mediaIndexer: ComprehensiveMediaIndexer;
  private mediaMatcher: ComprehensiveMediaMatcher;
  private verbose: boolean;

  constructor(verbose = false) {
    this.verbose = verbose;
    this.openAIParser = new OpenAIParser();
    this.claudeParser = new ClaudeParser();
    this.facebookParser = new FacebookParser();
    this.facebookRelationshipParser = new FacebookRelationshipParser();
    this.browserPluginParser = new BrowserPluginParser(verbose);
    this.redditParser = new RedditParser();
    this.twitterParser = new TwitterParser();
    this.instagramParser = new InstagramParser();
    this.substackParser = new SubstackParser();
    this.mediaIndexer = new ComprehensiveMediaIndexer(verbose);
    this.mediaMatcher = new ComprehensiveMediaMatcher(verbose);
  }

  /**
   * Parse a conversation archive from ZIP file or directory
   * @param archivePath - Path to ZIP file or extracted directory
   * @param workDir - Optional working directory for extraction
   * @param additionalMediaSourceDirs - Optional additional directories to search for media
   * @param options - Optional parsing options
   */
  async parseArchive(
    archivePath: string,
    workDir?: string,
    additionalMediaSourceDirs?: string[],
    options: { parseRelationships?: boolean } = {}
  ): Promise<ParsedArchiveWithRelationships> {
    const { parseRelationships = true } = options;
    console.log(`\n=== Parsing Archive: ${path.basename(archivePath)} ===\n`);

    // Check if input is a directory or ZIP file
    const isDirectory = fs.statSync(archivePath).isDirectory();
    let tempDir: string;

    if (isDirectory) {
      // Input is already a directory, use it directly
      tempDir = archivePath;
      console.log(`Step 1: Using directory directly: ${tempDir}`);
    } else {
      // Input is a ZIP file, extract it
      tempDir = workDir || path.join('/tmp', `archive-parse-${generateId()}`);
      ensureDir(tempDir);
      console.log('Step 1: Extracting archive...');
      await extractZip(archivePath, tempDir);
      console.log(`✓ Extracted to: ${tempDir}`);
    }

    try {
      // Step 2: Detect format
      console.log('\nStep 2: Detecting export format...');
      const format = await this.detectFormat(tempDir);
      console.log(`✓ Detected format: ${format.toUpperCase()}`);

      // Step 3: Parse conversations
      console.log('\nStep 3: Parsing conversations...');
      const conversations = await this.parseConversations(tempDir, format);
      console.log(`✓ Parsed ${conversations.length} conversations`);

      // Step 4: Build media indices (comprehensive - 6 index types)
      console.log('\nStep 4: Building comprehensive media indices...');
      if (additionalMediaSourceDirs && additionalMediaSourceDirs.length > 0) {
        console.log(`  Including ${additionalMediaSourceDirs.length} additional media source(s):`);
        additionalMediaSourceDirs.forEach((dir) => console.log(`    - ${dir}`));
      }
      const indices = this.mediaIndexer.buildIndex(tempDir, additionalMediaSourceDirs);
      const indexStats = this.mediaIndexer.getStats();
      console.log(`✓ Indexed ${indexStats.totalFiles} files`);
      console.log(`  - File hash: ${indexStats.fileHashFiles}`);
      console.log(`  - File ID: ${indexStats.fileIdFiles}`);
      console.log(`  - Conversation dirs: ${indexStats.conversationDirs}`);

      // Step 5: Match media to conversations (7 strategies)
      console.log('\nStep 5: Matching media files (7 strategies)...');
      const conversationsWithMedia = this.mediaMatcher.match(conversations, indices);
      const matchStats = this.mediaMatcher.getStats();
      console.log(
        `✓ Matched ${matchStats.totalFilesMatched} files to ${matchStats.conversationsWithMedia} conversations`
      );
      console.log(`  - By file hash: ${matchStats.byFileHash}`);
      console.log(`  - By file ID: ${matchStats.byFileId}`);
      console.log(`  - By filename+size: ${matchStats.byFilenameSize}`);
      console.log(`  - By conversation dir: ${matchStats.byConversationDir}`);
      console.log(`  - By size+metadata: ${matchStats.bySizeMetadata}`);
      console.log(`  - By size only: ${matchStats.bySizeOnly}`);
      console.log(`  - By filename only: ${matchStats.byFilenameOnly}`);

      // Step 6: Extract media file list from indices
      const mediaFiles: MediaFile[] = Array.from(indices.pathToMetadata.entries()).map(
        ([filePath, meta]) => ({
          path: filePath,
          basename: meta.basename,
          size: meta.size,
          ext: meta.ext,
        })
      );

      // Step 7: Calculate statistics
      const stats = this.calculateStats(conversationsWithMedia);

      const result: ParsedArchiveWithRelationships = {
        conversations: conversationsWithMedia,
        mediaFiles,
        format,
        extractedPath: tempDir,
        stats,
      };

      // Step 8: Parse relationship data for Facebook exports
      if (parseRelationships && format === 'facebook') {
        console.log('\nStep 6: Parsing relationship data (social graph)...');
        if (FacebookRelationshipParser.hasRelationshipData(tempDir)) {
          result.relationships = await this.facebookRelationshipParser.parseAll(tempDir);
        } else {
          console.log('  No relationship data found in export');
        }
      }

      console.log('\n=== Parsing Complete ===');
      console.log(`  Conversations: ${stats.totalConversations}`);
      console.log(`  Messages: ${stats.totalMessages}`);
      console.log(`  Media files: ${stats.totalMediaFiles}`);
      console.log(`  Parse errors: ${stats.parseErrors}`);
      if (result.relationships) {
        console.log(`  Relationships: ${result.relationships.friends.stats.totalFriends} friends, ${result.relationships.advertisers.stats.total} advertisers, ${result.relationships.reactions.stats.total} reactions`);
      }
      console.log('');

      return result;
    } catch (error) {
      console.error('Failed to parse archive:', error);
      throw error;
    }
  }

  /**
   * Detect export format
   * Supports: OpenAI, Claude, Facebook, Chrome Plugin, Reddit, Twitter, Instagram, Substack
   */
  private async detectFormat(extractedDir: string): Promise<ExportFormat> {
    // Check for browser plugin format first (single conversation exports)
    const pluginFormat = await BrowserPluginParser.detectFormat(extractedDir);
    if (pluginFormat) {
      return 'chrome-plugin';
    }

    // Check for Twitter/X format (specific data/tweets.js structure)
    const isTwitter = await TwitterParser.detectFormat(extractedDir);
    if (isTwitter) {
      return 'twitter';
    }

    // Check for Reddit format (CSV files with specific headers)
    const isReddit = await RedditParser.detectFormat(extractedDir);
    if (isReddit) {
      return 'reddit';
    }

    // Check for Substack format (posts.csv with specific columns)
    const isSubstack = await SubstackParser.detectFormat(extractedDir);
    if (isSubstack) {
      return 'substack';
    }

    // Check for Instagram format (your_instagram_activity directory)
    const isInstagram = await InstagramParser.detectFormat(extractedDir);
    if (isInstagram) {
      return 'instagram';
    }

    // Check for Facebook format (messages/inbox structure)
    const isFacebook = await FacebookParser.detectFormat(extractedDir);
    if (isFacebook) {
      return 'facebook';
    }

    // Check for Claude format (more specific than OpenAI)
    const isClaude = await ClaudeParser.detectFormat(extractedDir);
    if (isClaude) {
      return 'claude';
    }

    // Check for OpenAI format
    const isOpenAI = await OpenAIParser.detectFormat(extractedDir);
    if (isOpenAI) {
      return 'openai';
    }

    return 'unknown';
  }

  /**
   * Parse conversations based on detected format
   */
  private async parseConversations(
    extractedDir: string,
    format: ExportFormat
  ): Promise<Conversation[]> {
    switch (format) {
      case 'chrome-plugin': {
        const conversation = await this.browserPluginParser.parseConversation(extractedDir);
        return conversation ? [conversation] : [];
      }

      case 'facebook':
        return await this.facebookParser.parseConversations(extractedDir);

      case 'claude':
        return await this.claudeParser.parseConversations(extractedDir);

      case 'openai':
        return await this.openAIParser.parseConversations(extractedDir);

      case 'reddit':
        return await this.redditParser.parseConversations(extractedDir);

      case 'twitter':
        return await this.twitterParser.parseConversations(extractedDir);

      case 'instagram':
        return await this.instagramParser.parseConversations(extractedDir);

      case 'substack':
        return await this.substackParser.parseConversations(extractedDir);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Calculate statistics for parsed archive
   */
  private calculateStats(conversations: Conversation[]): ParsedArchive['stats'] {
    let totalMessages = 0;
    let totalMediaFiles = 0;
    let parseErrors = 0;

    for (const conversation of conversations) {
      // Count messages
      const messageCount = Object.values(conversation.mapping).filter(
        (node) => (node as { message?: unknown }).message !== undefined
      ).length;
      totalMessages += messageCount;

      // Count media files
      if (conversation._media_files) {
        totalMediaFiles += conversation._media_files.length;
      }

      // Check for parse errors (missing required fields)
      if (!conversation.conversation_id || !conversation.title) {
        parseErrors++;
      }
    }

    return {
      totalConversations: conversations.length,
      totalMessages,
      totalMediaFiles,
      parseErrors,
    };
  }

  /**
   * Get media matching statistics
   */
  getMatchStats() {
    return this.mediaMatcher.getStats();
  }

  /**
   * Parse archive and return minimal metadata (for preview)
   */
  async parseArchiveMetadata(archivePath: string): Promise<{
    format: ExportFormat;
    conversationCount: number;
    estimatedSize: number;
  }> {
    const isDirectory = fs.statSync(archivePath).isDirectory();
    let tempDir: string;
    let shouldCleanup = false;

    if (isDirectory) {
      tempDir = archivePath;
    } else {
      tempDir = path.join('/tmp', `archive-preview-${generateId()}`);
      ensureDir(tempDir);
      await extractZip(archivePath, tempDir);
      shouldCleanup = true;
    }

    try {
      const format = await this.detectFormat(tempDir);
      const conversations = await this.parseConversations(tempDir, format);

      return {
        format,
        conversationCount: conversations.length,
        estimatedSize: this.getDirectorySize(tempDir),
      };
    } finally {
      if (shouldCleanup) {
        this.cleanupTempDir(tempDir);
      }
    }
  }

  /**
   * Cleanup temporary directory
   */
  private cleanupTempDir(tempDir: string): void {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log(`✓ Cleaned up temp directory: ${tempDir}`);
      }
    } catch (err) {
      console.warn(`Failed to cleanup temp directory ${tempDir}:`, err);
    }
  }

  /**
   * Get total size of directory in bytes
   */
  private getDirectorySize(dirPath: string): number {
    let totalSize = 0;

    const walk = (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
          walk(filePath);
        } else {
          totalSize += stats.size;
        }
      }
    };

    walk(dirPath);
    return totalSize;
  }
}
