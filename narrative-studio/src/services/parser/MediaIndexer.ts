// ============================================================
// MEDIA INDEXER
// ============================================================
// Builds comprehensive indices of media files for matching

import * as path from 'path';
import type { FileIndices, MediaFile } from './types';
import { findFiles, getFileSize, getFileExtension, hashFile, isMediaFile } from './utils';

export class MediaIndexer {
  private static readonly MEDIA_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff',
    '.pdf', '.svg',
    '.mp3', '.wav', '.m4a', '.ogg', '.flac',
    '.mp4', '.mov', '.avi', '.mkv', '.webm',
  ]);

  /**
   * Build comprehensive file indices from extracted archive directory
   */
  async buildIndices(extractedDir: string): Promise<FileIndices> {
    console.log('Building media file indices...');

    // Find all media files
    const mediaFiles = this.findMediaFiles(extractedDir);
    console.log(`Found ${mediaFiles.length} media files`);

    // Build indices
    const indices: FileIndices = {
      basename_size_to_path: new Map(),
      file_id_to_path: new Map(),
      file_hash_to_path: new Map(),
      conversation_to_paths: new Map(),
      size_to_paths: new Map(),
      path_to_metadata: new Map(),
    };

    for (const filePath of mediaFiles) {
      try {
        await this.indexFile(filePath, indices, extractedDir);
      } catch (err) {
        console.error(`Failed to index file ${filePath}:`, err);
      }
    }

    console.log('Media indexing complete');
    console.log(`  - ${indices.basename_size_to_path.size} basename+size entries`);
    console.log(`  - ${indices.file_hash_to_path.size} file hashes`);
    console.log(`  - ${indices.size_to_paths.size} unique sizes`);
    console.log(`  - ${indices.conversation_to_paths.size} conversations with media`);

    return indices;
  }

  /**
   * Find all media files in directory
   */
  private findMediaFiles(dir: string): string[] {
    const allFiles = findFiles(dir, /.*/);
    return allFiles.filter(file => isMediaFile(file));
  }

  /**
   * Index a single file into all indices
   */
  private async indexFile(
    filePath: string,
    indices: FileIndices,
    extractedDir: string
  ): Promise<void> {
    const basename = path.basename(filePath);
    const size = getFileSize(filePath);
    const ext = getFileExtension(filePath);

    // Build file metadata
    const metadata: MediaFile = {
      path: filePath,
      basename,
      size,
      ext,
    };

    // Compute file hash for content-based matching (most accurate)
    try {
      const hash = hashFile(filePath);
      metadata.hash = hash;

      // Index by hash: file_abc123 -> path
      const hashKey = `file_${hash}`;
      indices.file_hash_to_path.set(hashKey, filePath);
    } catch (err) {
      console.warn(`Failed to hash file ${filePath}:`, err);
    }

    // Index by basename + size: (filename, size) -> path
    const basenameSizeKey = `${basename}:${size}`;
    indices.basename_size_to_path.set(basenameSizeKey, filePath);

    // Index by size: size -> [paths]
    if (!indices.size_to_paths.has(size)) {
      indices.size_to_paths.set(size, []);
    }
    indices.size_to_paths.get(size)!.push(filePath);

    // Index by conversation folder (if applicable)
    const conversationMatch = filePath.match(/\/conversations\/([^\/]+)\//);
    if (conversationMatch) {
      const convId = conversationMatch[1];
      if (!indices.conversation_to_paths.has(convId)) {
        indices.conversation_to_paths.set(convId, []);
      }
      indices.conversation_to_paths.get(convId)!.push(filePath);
    }

    // Extract file-ID from filename if present (file-ABC123_name.ext)
    const fileIdMatch = basename.match(/^(file-[A-Za-z0-9]+)/);
    if (fileIdMatch) {
      const fileId = fileIdMatch[1];
      indices.file_id_to_path.set(fileId, filePath);
    }

    // Store metadata
    indices.path_to_metadata.set(filePath, metadata);
  }

  /**
   * Get file metadata from indices
   */
  getFileMetadata(indices: FileIndices, filePath: string): MediaFile | undefined {
    return indices.path_to_metadata.get(filePath);
  }

  /**
   * Find files by exact hash
   */
  findByHash(indices: FileIndices, hash: string): string | undefined {
    const hashKey = hash.startsWith('file_') ? hash : `file_${hash}`;
    return indices.file_hash_to_path.get(hashKey);
  }

  /**
   * Find files by file-ID
   */
  findByFileId(indices: FileIndices, fileId: string): string | undefined {
    return indices.file_id_to_path.get(fileId);
  }

  /**
   * Find files by basename and size
   */
  findByBasenameSize(indices: FileIndices, basename: string, size: number): string | undefined {
    const key = `${basename}:${size}`;
    return indices.basename_size_to_path.get(key);
  }

  /**
   * Find files by size only
   */
  findBySize(indices: FileIndices, size: number): string[] {
    return indices.size_to_paths.get(size) || [];
  }

  /**
   * Find files in conversation directory
   */
  findByConversation(indices: FileIndices, conversationId: string): string[] {
    return indices.conversation_to_paths.get(conversationId) || [];
  }
}
