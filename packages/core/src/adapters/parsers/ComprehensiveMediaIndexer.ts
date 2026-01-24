/**
 * Comprehensive Media Indexer
 *
 * Catalogs ALL files in the archive with multiple indices.
 * Ported from narrative-studio: ComprehensiveMediaIndexer.ts
 */

import * as fs from 'fs';
import * as path from 'path';

export interface FileMetadata {
  size: number;
  basename: string;
  ext: string;
  dirname: string;
  filenameOnly: string;
  width?: number;
  height?: number;
}

export interface MediaIndex {
  allFiles: string[];
  basenameSizeToPath: Map<string, string>; // "basename|size" -> path
  fileIdToPath: Map<string, string>; // file-ID -> path
  fileHashToPath: Map<string, string>; // file_hash -> path
  conversationToPaths: Map<string, string[]>; // conversation_id -> [paths]
  sizeToPaths: Map<number, string[]>; // size -> [paths]
  sizeDimensionsToPath: Map<string, string>; // "size|width|height" -> path
  pathToMetadata: Map<string, FileMetadata>; // path -> metadata
}

export interface IndexStats {
  totalFiles: number;
  fileIdFiles: number;
  fileHashFiles: number;
  conversationDirs: number;
  uniqueSizes: number;
  uniqueBasenameSizePairs: number;
}

/**
 * Builds comprehensive indices of ALL media files in the archive.
 *
 * This indexer makes no assumptions about filename patterns - it catalogs
 * everything and builds multiple indices for different matching strategies.
 */
export class ComprehensiveMediaIndexer {
  private verbose: boolean;

  // Primary indices
  private allFiles: string[] = [];
  private basenameSizeToPath: Map<string, string> = new Map();
  private fileIdToPath: Map<string, string> = new Map();
  private fileHashToPath: Map<string, string> = new Map();
  private conversationToPaths: Map<string, string[]> = new Map();
  private sizeToPaths: Map<number, string[]> = new Map();
  private sizeDimensionsToPath: Map<string, string> = new Map();

  // Secondary indices for disambiguation
  private pathToMetadata: Map<string, FileMetadata> = new Map();

  private static readonly MEDIA_EXTENSIONS = new Set([
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.bmp',
    '.tiff',
    '.pdf',
    '.svg',
    '.mp3',
    '.wav',
    '.m4a',
    '.ogg',
    '.flac',
    '.mp4',
    '.mov',
    '.avi',
    '.mkv',
    '.webm',
  ]);

  // Extensions that support dimension reading
  private static readonly IMAGE_EXTENSIONS = new Set([
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.bmp',
    '.tiff',
  ]);

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  private log(msg: string): void {
    if (this.verbose) {
      console.log(msg);
    }
  }

  /**
   * Build comprehensive index of ALL media files in the archive.
   *
   * @param tmpDir - The primary directory to scan
   * @param additionalSourceDirs - Optional array of additional directories to scan
   */
  buildIndex(tmpDir: string, additionalSourceDirs?: string[]): MediaIndex {
    this.log('Building comprehensive media index...');
    this.log(`Primary directory: ${tmpDir}`);

    // Reset all indices
    this.allFiles = [];
    this.basenameSizeToPath.clear();
    this.fileIdToPath.clear();
    this.fileHashToPath.clear();
    this.conversationToPaths.clear();
    this.sizeToPaths.clear();
    this.sizeDimensionsToPath.clear();
    this.pathToMetadata.clear();

    // Build list of directories to scan
    const dirsToScan: string[] = [tmpDir];

    // Add all additional source directories that exist
    if (additionalSourceDirs) {
      for (const sourceDir of additionalSourceDirs) {
        if (sourceDir && fs.existsSync(sourceDir)) {
          dirsToScan.push(sourceDir);
          this.log(`Including additional source directory: ${sourceDir}`);
        } else if (sourceDir) {
          this.log(`Skipping non-existent source directory: ${sourceDir}`);
        }
      }
    }

    let totalFiles = 0;
    let fileIdCount = 0;
    let fileHashCount = 0;
    let conversationFiles = 0;

    // Walk ALL files in all scan directories
    for (const scanDir of dirsToScan) {
      this.walkDirectory(scanDir, (filepath) => {
        const basename = path.basename(filepath);
        const ext = path.extname(basename).toLowerCase();

        // Check if it's a media file
        if (!ComprehensiveMediaIndexer.MEDIA_EXTENSIONS.has(ext)) {
          return;
        }

        // It's a media file - catalog it
        totalFiles++;
        this.allFiles.push(filepath);

        // Get file metadata
        let fileSize: number;
        try {
          const stats = fs.statSync(filepath);
          fileSize = stats.size;
        } catch {
          return;
        }

        const dirname = path.dirname(filepath);

        // Note: Dimension reading requires image-size package
        // For now, we skip dimension reading to avoid external dependency
        // TODO: Add image-size as optional dependency for dimension matching
        const width: number | undefined = undefined;
        const height: number | undefined = undefined;

        // Store metadata (including dimensions if available)
        this.pathToMetadata.set(filepath, {
          size: fileSize,
          basename,
          ext,
          dirname,
          filenameOnly: basename,
          width,
          height,
        });

        // Index 1: By (basename, size) - UNIVERSAL FALLBACK
        const basenameSizeKey = `${basename}|${fileSize}`;
        this.basenameSizeToPath.set(basenameSizeKey, filepath);

        // Index 2: By file-ID if present (file-{ID}_* or file-{ID}-*)
        const fileId = this.extractFileId(basename);
        if (fileId) {
          this.fileIdToPath.set(fileId, filepath);
          fileIdCount++;
        }

        // Index 3: By file hash if present (file_{hash}-{uuid}.ext)
        const fileHash = this.extractFileHash(basename);
        if (fileHash) {
          this.fileHashToPath.set(fileHash, filepath);
          fileHashCount++;
        }

        // Index 4: By conversation_id from path if present
        const convId = this.extractConversationId(filepath);
        if (convId) {
          if (!this.conversationToPaths.has(convId)) {
            this.conversationToPaths.set(convId, []);
          }
          this.conversationToPaths.get(convId)!.push(filepath);
          conversationFiles++;
        }

        // Index 5: By file size (for DALL-E matching)
        if (!this.sizeToPaths.has(fileSize)) {
          this.sizeToPaths.set(fileSize, []);
        }
        this.sizeToPaths.get(fileSize)!.push(filepath);

        // Index 6: By size + dimensions (for disambiguation when multiple files have same size)
        if (width && height) {
          const sizeDimKey = `${fileSize}|${width}|${height}`;
          this.sizeDimensionsToPath.set(sizeDimKey, filepath);
        }
      });
    }

    this.log(`✓ Indexed ${totalFiles} total media files`);
    this.log(`  - ${fileIdCount} files with file-ID prefixes`);
    this.log(`  - ${fileHashCount} files with file_{hash}-{uuid} pattern`);
    this.log(`  - ${conversationFiles} files in conversation directories`);
    this.log(`  - ${this.basenameSizeToPath.size} unique (basename, size) pairs`);
    this.log(`  - ${this.sizeToPaths.size} unique file sizes`);
    this.log(`  - ${this.sizeDimensionsToPath.size} files with size+dimensions`);

    return {
      allFiles: this.allFiles,
      basenameSizeToPath: this.basenameSizeToPath,
      fileIdToPath: this.fileIdToPath,
      fileHashToPath: this.fileHashToPath,
      conversationToPaths: this.conversationToPaths,
      sizeToPaths: this.sizeToPaths,
      sizeDimensionsToPath: this.sizeDimensionsToPath,
      pathToMetadata: this.pathToMetadata,
    };
  }

  /**
   * Recursively walk a directory and call callback for each file.
   */
  private walkDirectory(dir: string, callback: (filepath: string) => void): void {
    if (!fs.existsSync(dir)) {
      return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        this.walkDirectory(fullPath, callback);
      } else if (entry.isFile()) {
        callback(fullPath);
      }
    }
  }

  /**
   * Extract file-ID from filename.
   *
   * Patterns:
   * - file-{ID}_{filename} (top-level user uploads)
   * - file-{ID}-{uuid}.ext (DALL-E generations)
   * - file-{ID}-{filename} (other hyphen separators)
   */
  private extractFileId(filename: string): string | null {
    // Pattern 1: Underscore separator (top-level user uploads)
    const underscoreMatch = filename.match(/^(file-[A-Za-z0-9]+)_/);
    if (underscoreMatch) {
      return underscoreMatch[1];
    }

    // Pattern 2: DALL-E generation format (file-{ID}-{uuid}.ext)
    const dalleMatch = filename.match(
      /^(file-[A-Za-z0-9]+)-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\./
    );
    if (dalleMatch) {
      return dalleMatch[1];
    }

    // Pattern 3: Generic hyphen separator (for other cases)
    const hyphenMatch = filename.match(/^(file-[A-Za-z0-9]+)-(?![a-f0-9]{8}-)/);
    if (hyphenMatch) {
      return hyphenMatch[1];
    }

    return null;
  }

  /**
   * Extract file hash from sediment:// pattern filename.
   *
   * Pattern: file_{32-hex}-{uuid}.ext
   */
  private extractFileHash(filename: string): string | null {
    const match = filename.match(/^(file_[a-f0-9]{32})-[a-f0-9-]{36}\./);
    if (match) {
      return match[1];
    }
    return null;
  }

  /**
   * Extract conversation_id from file path.
   *
   * Looks for multiple patterns:
   * - /conversations/{uuid}/ - standard extracted archive structure
   * - /{uuid}/audio/ - OpenAI export voice memo structure
   * - /{uuid}/ - direct UUID folder at root level
   */
  private extractConversationId(filepath: string): string | null {
    // Pattern 1: Standard /conversations/{uuid}/ structure
    const conversationsMatch = filepath.match(
      /\/conversations\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\//
    );
    if (conversationsMatch) {
      return conversationsMatch[1];
    }

    // Pattern 2: Alternative UUID format 8-4-4-4-8 (OpenAI specific)
    const altConversationsMatch = filepath.match(
      /\/conversations\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{8})\//
    );
    if (altConversationsMatch) {
      return altConversationsMatch[1];
    }

    // Pattern 3: Direct UUID folder with /audio/ subfolder (OpenAI voice memos)
    const audioFolderMatch = filepath.match(
      /\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/audio\//
    );
    if (audioFolderMatch) {
      return audioFolderMatch[1];
    }

    // Pattern 4: Alternative UUID format in audio folder (8-4-4-4-8)
    const altAudioMatch = filepath.match(
      /\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{8})\/audio\//
    );
    if (altAudioMatch) {
      return altAudioMatch[1];
    }

    // Pattern 5: Direct UUID folder (any files directly in UUID folder)
    const directUuidMatch = filepath.match(
      /\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\//
    );
    if (directUuidMatch) {
      return directUuidMatch[1];
    }

    // Pattern 6: Alternative UUID format direct folder (8-4-4-4-8)
    const altDirectMatch = filepath.match(
      /\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{8})\//
    );
    if (altDirectMatch) {
      return altDirectMatch[1];
    }

    return null;
  }

  /**
   * Get indexing statistics.
   */
  getStats(): IndexStats {
    return {
      totalFiles: this.allFiles.length,
      fileIdFiles: this.fileIdToPath.size,
      fileHashFiles: this.fileHashToPath.size,
      conversationDirs: this.conversationToPaths.size,
      uniqueSizes: this.sizeToPaths.size,
      uniqueBasenameSizePairs: this.basenameSizeToPath.size,
    };
  }
}
