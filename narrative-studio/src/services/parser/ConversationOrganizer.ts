// ============================================================
// CONVERSATION ORGANIZER
// ============================================================
// Organizes conversations into self-contained folders with media.
// Ported from Python: openai_export_parser/conversation_organizer.py
//
// Each conversation gets its own folder with format:
// {timestamp}_{title}_{conv_id}/
//   ├── conversation.json
//   └── media/
//       ├── {hash}_{filename1}
//       └── {hash}_{filename2}

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { ConversationWithMedia } from './ComprehensiveMediaMatcher';
import type { Conversation } from './types';

export interface OrganizerStats {
  conversationsProcessed: number;
  mediaFilesCopied: number;
  assetsExtracted: number;
  foldersCreated: number;
}

export interface MediaMapping {
  [basename: string]: string; // original basename -> hashed filename
}

export interface AssetFile {
  filename: string;
  content: string;
}

/**
 * Organizes parsed conversations into human-readable folder structure
 * with self-contained media.
 */
export class ConversationOrganizer {
  private verbose: boolean;
  private stats: OrganizerStats;

  constructor(verbose = false) {
    this.verbose = verbose;
    this.stats = {
      conversationsProcessed: 0,
      mediaFilesCopied: 0,
      assetsExtracted: 0,
      foldersCreated: 0,
    };
  }

  private log(msg: string): void {
    if (this.verbose) {
      console.log('[ORGANIZER]', msg);
    }
  }

  /**
   * Ensure directory exists, creating it if necessary.
   */
  private ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Generate SHA256 hash of file for unique identification.
   */
  private hashFile(filepath: string): string {
    const fileBuffer = fs.readFileSync(filepath);
    const hash = crypto.createHash('sha256');
    hash.update(fileBuffer);
    return hash.digest('hex').slice(0, 12);
  }

  /**
   * Copy file from src to dst, creating parent directories if needed.
   */
  private copyFile(src: string, dst: string): void {
    this.ensureDir(path.dirname(dst));
    fs.copyFileSync(src, dst);
  }

  /**
   * Convert string to safe filename component.
   */
  private sanitizeFilename(name: string, maxLength = 50): string {
    // Replace spaces with underscores
    let safe = name.replace(/\s+/g, '_');

    // Remove or replace unsafe characters
    safe = safe.replace(/[<>:"/\\|?*\x00-\x1f]/g, '');

    // Replace multiple underscores with single
    safe = safe.replace(/_+/g, '_');

    // Trim to max length
    if (safe.length > maxLength) {
      safe = safe.slice(0, maxLength).replace(/_+$/, '');
    }

    return safe || 'untitled';
  }

  /**
   * Convert Unix timestamp to ISO date string for folder naming.
   */
  private timestampToIso(timestamp?: number): string {
    if (!timestamp) {
      return '0000-00-00';
    }

    try {
      const date = new Date(timestamp * 1000);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '0000-00-00';
    }
  }

  /**
   * Generate human-readable folder name for conversation.
   * Format: {timestamp}_{title}_{conv_id}
   */
  generateFolderName(conversation: Conversation, convIndex: number): string {
    // Get timestamp
    const createTime = conversation.create_time;
    const timestamp = this.timestampToIso(createTime);

    // Get title (sanitized)
    const title = conversation.title || 'untitled';
    const titleSafe = this.sanitizeFilename(title, 50);

    // Use conversation ID if available, otherwise use index
    const convId = (conversation.conversation_id || conversation.id || '').slice(0, 8);
    const idPart = convId || String(convIndex).padStart(5, '0');

    return `${timestamp}_${titleSafe}_${idPart}`;
  }

  /**
   * Extract code blocks and canvas artifacts from conversation.
   */
  extractAssetsFromConversation(conversation: Conversation): AssetFile[] {
    const assets: AssetFile[] = [];
    const assetCounter = { code_block: 0, canvas: 0 };

    const mapping = conversation.mapping || {};

    for (const [nodeId, nodeData] of Object.entries(mapping)) {
      const message = nodeData.message;
      if (!message) continue;

      const content = message.content as { content_type?: string; text?: string; language?: string } | undefined;

      // Extract canvas/artifacts
      if (content?.content_type === 'canvas') {
        assetCounter.canvas++;
        const text = content.text || '';
        const language = content.language || 'txt';
        const filename = `canvas_${nodeId.slice(0, 8)}_${assetCounter.canvas}.${language}`;
        assets.push({ filename, content: text });
      }

      // Extract code blocks from text content
      else if (content?.content_type === 'code') {
        assetCounter.code_block++;
        const text = content.text || '';
        const language = content.language || 'txt';
        const filename = `code_block_${nodeId.slice(0, 8)}_${assetCounter.code_block}.${language}`;
        assets.push({ filename, content: text });
      }
    }

    return assets;
  }

  /**
   * Write conversations to organized folder structure.
   *
   * @param conversations - List of conversation dicts with _media_files
   * @param outDir - Base output directory
   * @returns List of created conversation folder paths
   */
  writeOrganizedOutput(
    conversations: ConversationWithMedia[],
    outDir: string
  ): string[] {
    this.ensureDir(outDir);
    const createdFolders: string[] = [];

    // Reset stats
    this.stats = {
      conversationsProcessed: 0,
      mediaFilesCopied: 0,
      assetsExtracted: 0,
      foldersCreated: 0,
    };

    this.log(`Processing ${conversations.length} conversations...`);

    for (let convIdx = 0; convIdx < conversations.length; convIdx++) {
      const conv = conversations[convIdx];

      // Generate folder name
      const folderName = this.generateFolderName(conv, convIdx);
      const convDir = path.join(outDir, folderName);
      const mediaDir = path.join(convDir, 'media');

      this.ensureDir(convDir);
      this.ensureDir(mediaDir);

      // Write conversation.json
      const convPath = path.join(convDir, 'conversation.json');
      fs.writeFileSync(convPath, JSON.stringify(conv, null, 2), 'utf-8');

      // Extract assets (code blocks, canvas artifacts)
      const assets = this.extractAssetsFromConversation(conv);
      const assetFilenames: string[] = [];

      if (assets.length > 0) {
        const assetsDir = path.join(convDir, 'assets');
        this.ensureDir(assetsDir);

        for (const asset of assets) {
          const assetPath = path.join(assetsDir, asset.filename);
          fs.writeFileSync(assetPath, asset.content, 'utf-8');
          assetFilenames.push(asset.filename);
          this.stats.assetsExtracted++;
        }
      }

      // Copy media files for this conversation
      const mediaPaths = conv._media_files || [];
      const mediaMapping: MediaMapping = {};

      for (const srcPath of mediaPaths) {
        if (!fs.existsSync(srcPath)) {
          this.log(`Warning: Media file not found: ${srcPath}`);
          continue;
        }

        const basename = path.basename(srcPath);

        try {
          // Generate hash for unique naming
          const fileHash = this.hashFile(srcPath);

          // Use hash + original name for uniqueness and recognition
          const hashedName = `${fileHash}_${basename}`;

          const dstPath = path.join(mediaDir, hashedName);
          this.copyFile(srcPath, dstPath);

          mediaMapping[basename] = hashedName;
          this.stats.mediaFilesCopied++;
        } catch (e) {
          this.log(`Error processing media ${basename}: ${e}`);
        }
      }

      // Write media manifest for this conversation
      if (Object.keys(mediaMapping).length > 0) {
        const manifestPath = path.join(convDir, 'media_manifest.json');
        fs.writeFileSync(manifestPath, JSON.stringify(mediaMapping, null, 2), 'utf-8');
      }

      // Store metadata on conversation for reference
      (conv as any)._folder_name = folderName;
      (conv as any)._assets = assetFilenames.length > 0;

      createdFolders.push(convDir);
      this.stats.foldersCreated++;
      this.stats.conversationsProcessed++;

      if ((convIdx + 1) % 100 === 0) {
        this.log(`Processed ${convIdx + 1}/${conversations.length} conversations`);
      }
    }

    // Create convenience symlink folders
    this.createConvenienceSymlinks(outDir, createdFolders);

    this.log(`Created ${createdFolders.length} conversation folders`);
    return createdFolders;
  }

  /**
   * Create convenience symlink folders:
   * - _with_media/ - symlinks to conversations with non-empty media/ folder
   * - _with_assets/ - symlinks to conversations with non-empty assets/ folder
   */
  private createConvenienceSymlinks(outDir: string, createdFolders: string[]): void {
    const mediaSymlinkDir = path.join(outDir, '_with_media');
    const assetsSymlinkDir = path.join(outDir, '_with_assets');

    // Remove existing symlink dirs if they exist
    if (fs.existsSync(mediaSymlinkDir)) {
      fs.rmSync(mediaSymlinkDir, { recursive: true });
    }
    if (fs.existsSync(assetsSymlinkDir)) {
      fs.rmSync(assetsSymlinkDir, { recursive: true });
    }

    this.ensureDir(mediaSymlinkDir);
    this.ensureDir(assetsSymlinkDir);

    let mediaCount = 0;
    let assetsCount = 0;

    for (const convDir of createdFolders) {
      const folderName = path.basename(convDir);
      const mediaDir = path.join(convDir, 'media');
      const assetsDir = path.join(convDir, 'assets');

      // Check if media folder exists and has files
      if (fs.existsSync(mediaDir)) {
        const mediaFiles = fs.readdirSync(mediaDir);
        if (mediaFiles.length > 0) {
          // Create relative symlink
          const symlinkPath = path.join(mediaSymlinkDir, folderName);
          const targetPath = path.join('..', folderName);
          try {
            fs.symlinkSync(targetPath, symlinkPath);
            mediaCount++;
          } catch (e) {
            this.log(`Warning: Could not create media symlink for ${folderName}: ${e}`);
          }
        }
      }

      // Check if assets folder exists and has files
      if (fs.existsSync(assetsDir)) {
        const assetFiles = fs.readdirSync(assetsDir);
        if (assetFiles.length > 0) {
          // Create relative symlink
          const symlinkPath = path.join(assetsSymlinkDir, folderName);
          const targetPath = path.join('..', folderName);
          try {
            fs.symlinkSync(targetPath, symlinkPath);
            assetsCount++;
          } catch (e) {
            this.log(`Warning: Could not create assets symlink for ${folderName}: ${e}`);
          }
        }
      }
    }

    this.log(`Created ${mediaCount} symlinks in _with_media/`);
    this.log(`Created ${assetsCount} symlinks in _with_assets/`);
  }

  /**
   * Get organizer statistics.
   */
  getStats(): OrganizerStats {
    return { ...this.stats };
  }
}
