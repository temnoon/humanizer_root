// ============================================================
// COMPREHENSIVE MEDIA MATCHER
// ============================================================
// Matches media files to conversations using 7 strategies.
// Ported from Python: openai_export_parser/comprehensive_media_matcher.py

import * as path from 'path';
import type { MediaIndex, FileMetadata } from './ComprehensiveMediaIndexer';
import { MediaReferenceExtractor, type MediaReferences } from './MediaReferenceExtractor';
import type { Conversation } from './types';

export interface MatcherStats {
  conversationsProcessed: number;
  conversationsWithMedia: number;
  totalFilesMatched: number;
  byFileHash: number;
  byFileId: number;
  byFilenameSize: number;
  byConversationDir: number;
  bySizeMetadata: number;
  bySizeOnly: number;
  byFilenameOnly: number;
  unmatchedReferences: number;
}

export interface ConversationWithMedia extends Conversation {
  _media_files?: string[];
}

/**
 * Matches media files to conversations using comprehensive strategies.
 *
 * Matching strategies in order of priority:
 * 1. File hash (sediment://) - exact match, 100% reliable
 * 2. File-ID + size - very reliable
 * 3. Filename + size - good for user uploads
 * 4. Conversation directory - reliable for DALL-E
 * 5. Size + metadata (gen_id, dimensions) - good for DALL-E
 * 6. Size alone - fallback, may have collisions
 * 7. Filename alone - least reliable fallback
 */
export class ComprehensiveMediaMatcher {
  private verbose: boolean;
  private stats: MatcherStats;
  private referenceExtractor: MediaReferenceExtractor;

  constructor(verbose = false) {
    this.verbose = verbose;
    this.referenceExtractor = new MediaReferenceExtractor(verbose);
    this.stats = {
      conversationsProcessed: 0,
      conversationsWithMedia: 0,
      totalFilesMatched: 0,
      byFileHash: 0,
      byFileId: 0,
      byFilenameSize: 0,
      byConversationDir: 0,
      bySizeMetadata: 0,
      bySizeOnly: 0,
      byFilenameOnly: 0,
      unmatchedReferences: 0,
    };
  }

  private log(msg: string): void {
    if (this.verbose) {
      console.log(msg);
    }
  }

  /**
   * Match media files to conversations using comprehensive strategies.
   */
  match(conversations: Conversation[], fileIndices: MediaIndex): ConversationWithMedia[] {
    this.log('Matching media using comprehensive multi-strategy approach...');

    // Reset stats
    this.stats = {
      conversationsProcessed: 0,
      conversationsWithMedia: 0,
      totalFilesMatched: 0,
      byFileHash: 0,
      byFileId: 0,
      byFilenameSize: 0,
      byConversationDir: 0,
      bySizeMetadata: 0,
      bySizeOnly: 0,
      byFilenameOnly: 0,
      unmatchedReferences: 0,
    };

    const result: ConversationWithMedia[] = [];

    for (const conv of conversations) {
      this.stats.conversationsProcessed++;

      // Extract all media references from this conversation
      const references = this.referenceExtractor.extractAllReferences(conv);

      // Collect matched files
      const matchedFiles = new Set<string>();

      // Strategy 1: Match by file hash (sediment://)
      const fileHashes = this.referenceExtractor.getAllFileHashes(references);
      for (const fileHash of fileHashes) {
        const filepath = fileIndices.fileHashToPath.get(fileHash);
        if (filepath) {
          matchedFiles.add(filepath);
          this.stats.byFileHash++;
          this.log(`    Matched by file_hash: ${fileHash}`);
        } else {
          this.stats.unmatchedReferences++;
          this.log(`    UNMATCHED file_hash: ${fileHash}`);
        }
      }

      // Strategy 2: Match by file-ID
      const fileIds = this.referenceExtractor.getAllFileIds(references);
      for (const fileId of fileIds) {
        const filepath = fileIndices.fileIdToPath.get(fileId);
        if (filepath && !matchedFiles.has(filepath)) {
          matchedFiles.add(filepath);
          this.stats.byFileId++;
          this.log(`    Matched by file_id: ${fileId}`);
        }
      }

      // Strategy 3: Match by filename + size (for attachments)
      for (const attachment of references.attachments) {
        const filename = attachment.name;
        const size = attachment.size;
        if (filename && size) {
          const key = `${filename}|${size}`;
          const filepath = fileIndices.basenameSizeToPath.get(key);
          if (filepath && !matchedFiles.has(filepath)) {
            matchedFiles.add(filepath);
            this.stats.byFilenameSize++;
            this.log(`    Matched by filename+size: ${filename} (${size} bytes)`);
          }
        }
      }

      // Strategy 4: Match by conversation directory
      const convId = conv.conversation_id || conv.id;
      if (convId) {
        const convFiles = fileIndices.conversationToPaths.get(convId) || [];
        for (const filepath of convFiles) {
          if (!matchedFiles.has(filepath)) {
            matchedFiles.add(filepath);
            this.stats.byConversationDir++;
            this.log(`    Matched by conversation_dir: ${path.basename(filepath)}`);
          }
        }
      }

      // Strategy 5: Match by size + metadata (DALL-E generations)
      for (const dalleGen of references.dalle_generations) {
        const sizeBytes = dalleGen.size_bytes;
        const width = dalleGen.width;
        const height = dalleGen.height;

        if (sizeBytes) {
          const candidateFiles = fileIndices.sizeToPaths.get(sizeBytes) || [];

          // If we have only one file with this size, it's likely a match
          if (candidateFiles.length === 1) {
            const filepath = candidateFiles[0];
            if (!matchedFiles.has(filepath)) {
              matchedFiles.add(filepath);
              this.stats.bySizeMetadata++;
              this.log(`    Matched by size (unique): ${sizeBytes} bytes`);
            }
          } else if (candidateFiles.length > 1) {
            // Multiple files with same size - try to disambiguate by dimensions
            let matched = false;

            if (width && height) {
              const sizeDimKey = `${sizeBytes}|${width}|${height}`;
              const filepath = fileIndices.sizeDimensionsToPath.get(sizeDimKey);
              if (filepath && !matchedFiles.has(filepath)) {
                matchedFiles.add(filepath);
                this.stats.bySizeMetadata++;
                this.log(`    Matched by size+dimensions: ${sizeBytes} bytes, ${width}x${height}`);
                matched = true;
              }
            }

            // Fallback: take first candidate if dimension matching failed
            if (!matched) {
              const filepath = candidateFiles[0];
              if (!matchedFiles.has(filepath)) {
                matchedFiles.add(filepath);
                this.stats.bySizeOnly++;
                this.log(`    Matched by size (ambiguous): ${sizeBytes} bytes - ${candidateFiles.length} candidates`);
              }
            }
          }
        }
      }

      // Strategy 6: Match by asset_pointer size + dimensions (for non-DALL-E)
      for (const assetRef of references.asset_pointers) {
        const sizeBytes = assetRef.size_bytes;
        const width = assetRef.width;
        const height = assetRef.height;
        const pointerType = assetRef.type;

        // Skip if already matched by hash (sediment) or file-ID
        if (pointerType === 'sediment' || pointerType === 'file') {
          continue;
        }

        if (sizeBytes) {
          const candidateFiles = fileIndices.sizeToPaths.get(sizeBytes) || [];

          if (candidateFiles.length === 1) {
            const filepath = candidateFiles[0];
            if (!matchedFiles.has(filepath)) {
              matchedFiles.add(filepath);
              this.stats.bySizeOnly++;
              this.log(`    Matched by size: ${sizeBytes} bytes`);
            }
          } else if (candidateFiles.length > 1) {
            // Multiple files with same size - try to disambiguate by dimensions
            let matched = false;

            if (width && height) {
              const sizeDimKey = `${sizeBytes}|${width}|${height}`;
              const filepath = fileIndices.sizeDimensionsToPath.get(sizeDimKey);
              if (filepath && !matchedFiles.has(filepath)) {
                matchedFiles.add(filepath);
                this.stats.bySizeMetadata++;
                this.log(`    Matched by size+dimensions: ${sizeBytes} bytes, ${width}x${height}`);
                matched = true;
              }
            }

            // Only match ambiguously if we have no other option and it's unique enough
            // (Skip ambiguous matches for asset_pointers - too risky)
            if (!matched) {
              this.log(`    Skipping ambiguous size match: ${sizeBytes} bytes - ${candidateFiles.length} candidates`);
            }
          }
        }
      }

      // Strategy 7: Match by filename alone (least reliable)
      const filenames = this.referenceExtractor.getAllFilenames(references);
      for (const filename of filenames) {
        // Look through all files for basename match
        for (const [filepath, metadata] of fileIndices.pathToMetadata) {
          if (metadata.basename === filename) {
            if (!matchedFiles.has(filepath)) {
              matchedFiles.add(filepath);
              this.stats.byFilenameOnly++;
              this.log(`    Matched by filename only: ${filename}`);
              break;
            }
          }
        }
      }

      // Create result conversation with matched files
      const convWithMedia: ConversationWithMedia = { ...conv };

      if (matchedFiles.size > 0) {
        convWithMedia._media_files = Array.from(matchedFiles);
        this.stats.conversationsWithMedia++;
        this.stats.totalFilesMatched += matchedFiles.size;
        this.log(`  Conversation ${convId ? convId.slice(0, 8) : 'unknown'}: matched ${matchedFiles.size} files`);
      }

      result.push(convWithMedia);
    }

    return result;
  }

  /**
   * Get matching statistics.
   */
  getStats(): MatcherStats {
    return { ...this.stats };
  }

  /**
   * Print a summary of matching results.
   */
  printSummary(): void {
    console.log('\n=== Matching Summary ===');
    console.log(`Conversations processed: ${this.stats.conversationsProcessed}`);
    console.log(`Conversations with media: ${this.stats.conversationsWithMedia}`);
    console.log(`Total files matched: ${this.stats.totalFilesMatched}`);
    console.log('\nMatching strategy breakdown:');
    console.log(`  By file hash (sediment://): ${this.stats.byFileHash}`);
    console.log(`  By file-ID: ${this.stats.byFileId}`);
    console.log(`  By filename+size: ${this.stats.byFilenameSize}`);
    console.log(`  By conversation directory: ${this.stats.byConversationDir}`);
    console.log(`  By size+metadata: ${this.stats.bySizeMetadata}`);
    console.log(`  By size only: ${this.stats.bySizeOnly}`);
    console.log(`  By filename only: ${this.stats.byFilenameOnly}`);
    console.log(`\nUnmatched references: ${this.stats.unmatchedReferences}`);
  }
}
