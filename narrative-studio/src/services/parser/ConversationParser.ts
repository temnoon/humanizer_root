// ============================================================
// CONVERSATION PARSER - Main Orchestrator
// ============================================================
// Coordinates parsing, indexing, and matching for conversation archives
// Uses comprehensive 7-strategy media matching (ported from Python)

import * as fs from 'fs';
import * as path from 'path';
import { OpenAIParser } from './OpenAIParser';
import { ClaudeParser } from './ClaudeParser';
import { FacebookParser } from './FacebookParser';
import { ComprehensiveMediaIndexer } from './ComprehensiveMediaIndexer';
import { ComprehensiveMediaMatcher } from './ComprehensiveMediaMatcher';
import type { ParsedArchive, Conversation, ExportFormat, MediaFile } from './types';
import { extractZip, ensureDir, generateId } from './utils';

export class ConversationParser {
  private openAIParser: OpenAIParser;
  private claudeParser: ClaudeParser;
  private facebookParser: FacebookParser;
  private mediaIndexer: ComprehensiveMediaIndexer;
  private mediaMatcher: ComprehensiveMediaMatcher;
  private verbose: boolean;

  constructor(verbose = false) {
    this.verbose = verbose;
    this.openAIParser = new OpenAIParser();
    this.claudeParser = new ClaudeParser();
    this.facebookParser = new FacebookParser();
    this.mediaIndexer = new ComprehensiveMediaIndexer(verbose);
    this.mediaMatcher = new ComprehensiveMediaMatcher(verbose);
  }

  /**
   * Parse a conversation archive from ZIP file or directory
   * @param zipPath - Path to ZIP file or extracted directory
   * @param workDir - Optional working directory for extraction
   * @param additionalMediaSourceDirs - Optional array of additional directories to search for media
   *                                    (e.g., older archives like chat5, recovery folders)
   */
  async parseArchive(
    zipPath: string,
    workDir?: string,
    additionalMediaSourceDirs?: string[]
  ): Promise<ParsedArchive> {
    console.log(`\n=== Parsing Archive: ${path.basename(zipPath)} ===\n`);

    // Create temporary working directory
    const tempDir = workDir || path.join('/tmp', `archive-parse-${generateId()}`);
    ensureDir(tempDir);

    try {
      // Step 1: Extract ZIP
      console.log('Step 1: Extracting archive...');
      await extractZip(zipPath, tempDir);
      console.log(`✓ Extracted to: ${tempDir}`);

      // Step 2: Detect format
      console.log('\nStep 2: Detecting export format...');
      const format = await this.detectFormat(tempDir);
      console.log(`✓ Detected format: ${format.toUpperCase()}`);

      // Step 3: Parse conversations
      console.log('\nStep 3: Parsing conversations...');
      const conversations = await this.parseConversations(tempDir, format);
      console.log(`✓ Parsed ${conversations.length} conversations`);

      // Step 4: Build media indices (comprehensive - 6 index types)
      // Include additional source directories for more complete media matching
      console.log('\nStep 4: Building comprehensive media indices...');
      if (additionalMediaSourceDirs && additionalMediaSourceDirs.length > 0) {
        console.log(`  Including ${additionalMediaSourceDirs.length} additional media source(s):`);
        additionalMediaSourceDirs.forEach(dir => console.log(`    - ${dir}`));
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
      console.log(`✓ Matched ${matchStats.totalFilesMatched} files to ${matchStats.conversationsWithMedia} conversations`);
      console.log(`  - By file hash: ${matchStats.byFileHash}`);
      console.log(`  - By file ID: ${matchStats.byFileId}`);
      console.log(`  - By filename+size: ${matchStats.byFilenameSize}`);
      console.log(`  - By conversation dir: ${matchStats.byConversationDir}`);
      console.log(`  - By size+metadata: ${matchStats.bySizeMetadata}`);
      console.log(`  - By size only: ${matchStats.bySizeOnly}`);
      console.log(`  - By filename only: ${matchStats.byFilenameOnly}`);

      // Step 6: Extract media file list from indices (map FileMetadata to MediaFile)
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

      const result: ParsedArchive = {
        conversations: conversationsWithMedia, // Use conversations with matched media
        mediaFiles,
        format,
        extractedPath: tempDir, // Store for media file access
        stats,
      };

      console.log('\n=== Parsing Complete ===');
      console.log(`  Conversations: ${stats.totalConversations}`);
      console.log(`  Messages: ${stats.totalMessages}`);
      console.log(`  Media files: ${stats.totalMediaFiles}`);
      console.log(`  Parse errors: ${stats.parseErrors}`);
      console.log('');

      return result;

    } catch (error) {
      console.error('Failed to parse archive:', error);
      throw error;
    } finally {
      // Cleanup temp directory (optional - comment out for debugging)
      // this.cleanupTempDir(tempDir);
    }
  }

  /**
   * Detect export format (OpenAI, Claude, or Facebook)
   */
  private async detectFormat(extractedDir: string): Promise<ExportFormat> {
    // Check for Facebook format first (most specific directory structure)
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
      case 'facebook':
        return await this.facebookParser.parseConversations(extractedDir);

      case 'claude':
        return await this.claudeParser.parseConversations(extractedDir);

      case 'openai':
        return await this.openAIParser.parseConversations(extractedDir);

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
        node => node.message !== undefined
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
   * Get media matching statistics
   */
  getMatchStats() {
    return this.mediaMatcher.getStats();
  }

  /**
   * Parse archive and return minimal metadata (for preview)
   */
  async parseArchiveMetadata(zipPath: string): Promise<{
    format: ExportFormat;
    conversationCount: number;
    estimatedSize: number;
  }> {
    const tempDir = path.join('/tmp', `archive-preview-${generateId()}`);
    ensureDir(tempDir);

    try {
      await extractZip(zipPath, tempDir);
      const format = await this.detectFormat(tempDir);
      const conversations = await this.parseConversations(tempDir, format);

      return {
        format,
        conversationCount: conversations.length,
        estimatedSize: this.getDirectorySize(tempDir),
      };
    } finally {
      this.cleanupTempDir(tempDir);
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
