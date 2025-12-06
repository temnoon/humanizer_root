// ============================================================
// MEDIA MATCHER
// ============================================================
// Matches media files to conversations using multiple strategies

import type { Conversation, FileIndices, MediaReferences, MatchStats, MatchStrategy } from './types';
import { MediaIndexer } from './MediaIndexer';
import { extractFileId } from './utils';

export class MediaMatcher {
  private indexer: MediaIndexer;
  private stats: MatchStats;

  constructor() {
    this.indexer = new MediaIndexer();
    this.stats = {
      totalFiles: 0,
      matchedFiles: 0,
      unmatchedFiles: 0,
      byStrategy: {
        file_hash: 0,
        file_id_size: 0,
        filename_size: 0,
        conversation_dir: 0,
        size_metadata: 0,
        size_only: 0,
        filename_only: 0,
      },
    };
  }

  /**
   * Match media files to conversations using multiple strategies
   */
  async matchMedia(
    conversations: Conversation[],
    indices: FileIndices
  ): Promise<void> {
    console.log(`Matching media for ${conversations.length} conversations...`);

    this.stats.totalFiles = indices.path_to_metadata.size;

    for (const conversation of conversations) {
      try {
        await this.matchConversation(conversation, indices);
      } catch (err) {
        console.error(`Failed to match media for conversation ${conversation.conversation_id}:`, err);
      }
    }

    this.logStats();
  }

  /**
   * Match media for a single conversation
   */
  private async matchConversation(
    conversation: Conversation,
    indices: FileIndices
  ): Promise<void> {
    const matchedFiles = new Set<string>();

    // Extract all media references from the conversation
    const references = this.extractMediaReferences(conversation);

    // Strategy 1: File Hash (most accurate)
    for (const hash of references.asset_pointers) {
      const fileId = extractFileId(hash);
      if (fileId && fileId.startsWith('file_')) {
        const filePath = this.indexer.findByHash(indices, fileId);
        if (filePath) {
          matchedFiles.add(filePath);
          this.stats.byStrategy.file_hash++;
        }
      }
    }

    // Strategy 2: File-ID + Size
    for (const attachment of references.attachments) {
      if (attachment.id && attachment.size) {
        const filePath = this.indexer.findByFileId(indices, attachment.id);
        if (filePath) {
          const metadata = this.indexer.getFileMetadata(indices, filePath);
          if (metadata && metadata.size === attachment.size) {
            matchedFiles.add(filePath);
            this.stats.byStrategy.file_id_size++;
          }
        }
      }
    }

    // Strategy 3: Filename + Size
    for (const attachment of references.attachments) {
      if (attachment.name && attachment.size) {
        const filePath = this.indexer.findByBasenameSize(indices, attachment.name, attachment.size);
        if (filePath) {
          matchedFiles.add(filePath);
          this.stats.byStrategy.filename_size++;
        }
      }
    }

    // Strategy 4: Conversation Directory (files in /conversations/{uuid}/)
    const convFiles = this.indexer.findByConversation(indices, conversation.conversation_id);
    for (const filePath of convFiles) {
      if (!matchedFiles.has(filePath)) {
        matchedFiles.add(filePath);
        this.stats.byStrategy.conversation_dir++;
      }
    }

    // Store matched files in conversation metadata
    if (matchedFiles.size > 0) {
      conversation._media_files = Array.from(matchedFiles);
      this.stats.matchedFiles += matchedFiles.size;
    }
  }

  /**
   * Extract all media references from a conversation
   */
  private extractMediaReferences(conversation: Conversation): MediaReferences {
    const references: MediaReferences = {
      asset_pointers: new Set(),
      attachments: [],
      dalle_generations: [],
      text_filenames: new Set(),
    };

    // Traverse the conversation tree
    for (const node of Object.values(conversation.mapping)) {
      if (!node.message) continue;

      const message = node.message;

      // Extract asset pointers from content
      if (message.content?.parts) {
        for (const part of message.content.parts) {
          if (typeof part === 'string') {
            // Look for sediment://, file-service://, file:// URLs
            const urlPattern = /(sediment:\/\/file_[a-f0-9]+|file-service:\/\/file-[A-Za-z0-9]+|file:\/\/[^\s]+)/g;
            const matches = part.match(urlPattern);
            if (matches) {
              matches.forEach(url => references.asset_pointers.add(url));
            }

            // Extract filenames mentioned in text
            const filenamePattern = /([a-zA-Z0-9_-]+\.(png|jpg|jpeg|gif|webp|pdf|mp3|wav|mp4|mov))/gi;
            const filenameMatches = part.match(filenamePattern);
            if (filenameMatches) {
              filenameMatches.forEach(filename => references.text_filenames.add(filename));
            }
          }
        }
      }

      // Extract attachments from metadata
      if (message.metadata?.attachments) {
        references.attachments.push(...message.metadata.attachments);
      }

      // Extract DALL-E generation metadata
      if (message.metadata?.dalle_generations) {
        references.dalle_generations.push(...message.metadata.dalle_generations);
      }

      // Check for file references in metadata
      const metadata = message.metadata as any;
      if (metadata) {
        // Look for file-related fields
        if (metadata.file_id) {
          references.asset_pointers.add(`file-service://file-${metadata.file_id}`);
        }

        if (metadata.file_hash) {
          references.asset_pointers.add(`sediment://file_${metadata.file_hash}`);
        }

        // Claude-specific file references
        if (metadata._files && Array.isArray(metadata._files)) {
          for (const file of metadata._files) {
            if (file.file_name) {
              references.text_filenames.add(file.file_name);
            }
          }
        }
      }
    }

    return references;
  }

  /**
   * Get matching statistics
   */
  getStats(): MatchStats {
    this.stats.unmatchedFiles = this.stats.totalFiles - this.stats.matchedFiles;
    return { ...this.stats };
  }

  /**
   * Log matching statistics
   */
  private logStats(): void {
    console.log('\nMedia Matching Statistics:');
    console.log(`  Total files: ${this.stats.totalFiles}`);
    console.log(`  Matched files: ${this.stats.matchedFiles}`);
    console.log(`  Unmatched files: ${this.stats.unmatchedFiles}`);

    const matchRate = this.stats.totalFiles > 0
      ? ((this.stats.matchedFiles / this.stats.totalFiles) * 100).toFixed(1)
      : '0.0';
    console.log(`  Match rate: ${matchRate}%`);

    console.log('\nMatches by strategy:');
    for (const [strategy, count] of Object.entries(this.stats.byStrategy)) {
      if (count > 0) {
        console.log(`  - ${strategy}: ${count}`);
      }
    }
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalFiles: 0,
      matchedFiles: 0,
      unmatchedFiles: 0,
      byStrategy: {
        file_hash: 0,
        file_id_size: 0,
        filename_size: 0,
        conversation_dir: 0,
        size_metadata: 0,
        size_only: 0,
        filename_only: 0,
      },
    };
  }
}
