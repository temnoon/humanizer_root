// ============================================================
// CONVERSATION PARSER - Main Orchestrator
// ============================================================
// Coordinates parsing, indexing, and matching for conversation archives

import * as fs from 'fs';
import * as path from 'path';
import { OpenAIParser } from './OpenAIParser';
import { ClaudeParser } from './ClaudeParser';
import { MediaIndexer } from './MediaIndexer';
import { MediaMatcher } from './MediaMatcher';
import { ParsedArchive, Conversation, ExportFormat } from './types';
import { extractZip, ensureDir, generateId } from './utils';

export class ConversationParser {
  private openAIParser: OpenAIParser;
  private claudeParser: ClaudeParser;
  private mediaIndexer: MediaIndexer;
  private mediaMatcher: MediaMatcher;

  constructor() {
    this.openAIParser = new OpenAIParser();
    this.claudeParser = new ClaudeParser();
    this.mediaIndexer = new MediaIndexer();
    this.mediaMatcher = new MediaMatcher();
  }

  /**
   * Parse a conversation archive from ZIP file
   */
  async parseArchive(zipPath: string, workDir?: string): Promise<ParsedArchive> {
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

      // Step 4: Build media indices
      console.log('\nStep 4: Building media indices...');
      const indices = await this.mediaIndexer.buildIndices(tempDir);

      // Step 5: Match media to conversations
      console.log('\nStep 5: Matching media files...');
      await this.mediaMatcher.matchMedia(conversations, indices);

      // Step 6: Extract media file list
      const mediaFiles = Array.from(indices.path_to_metadata.values());

      // Step 7: Calculate statistics
      const stats = this.calculateStats(conversations);

      const result: ParsedArchive = {
        conversations,
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
   * Detect export format (OpenAI vs Claude)
   */
  private async detectFormat(extractedDir: string): Promise<ExportFormat> {
    // Check for Claude format first (more specific)
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
