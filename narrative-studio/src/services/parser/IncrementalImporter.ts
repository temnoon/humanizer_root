// ============================================================
// INCREMENTAL IMPORTER
// ============================================================
// Smart merge: append new messages to existing conversations

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { Conversation, ImportPreview, ImportConflict, MergeResult, ImportResult } from './types';
import { readJSON, writeJSON, ensureDir, copyFile, hashContent, generateFolderName } from './utils';
import { MediaReferenceExtractor } from './MediaReferenceExtractor';

// Enhanced media manifest structure
interface MediaManifest {
  // Original basename -> hashed filename (for file lookup)
  files: { [basename: string]: string };
  // asset_pointer (file-service://..., sediment://...) -> hashed filename
  assetPointers: { [pointer: string]: string };
  // file-ID (file-ABC123) -> hashed filename
  fileIds: { [fileId: string]: string };
  // file_hash (sediment:// hash) -> hashed filename
  fileHashes: { [hash: string]: string };
  // Size-based lookups for fallback matching
  sizeToFiles: { [size: number]: string[] };
}

export class IncrementalImporter {
  /**
   * Generate preview of import operation
   */
  async generatePreview(
    newConversations: Conversation[],
    archiveDir: string
  ): Promise<ImportPreview> {
    const existingConversations = await this.loadExistingConversations(archiveDir);
    const existingById = new Map(
      existingConversations.map(conv => [conv.conversation_id, conv])
    );

    let newConversationCount = 0;
    let existingToUpdateCount = 0;
    let newMessagesCount = 0;
    let newMediaFilesCount = 0;
    const conflicts: ImportConflict[] = [];

    for (const newConv of newConversations) {
      const existing = existingById.get(newConv.conversation_id);

      if (existing) {
        // Conversation exists - check for new messages
        existingToUpdateCount++;

        const newMessages = this.findNewMessages(existing, newConv);
        newMessagesCount += newMessages.length;

        // Count new media files
        const existingMedia = new Set(existing._media_files || []);
        const newMedia = (newConv._media_files || []).filter(file =>
          !existingMedia.has(file)
        );
        newMediaFilesCount += newMedia.length;

        // Check for conflicts
        if (newMessages.length > 0 || newMedia.length > 0) {
          conflicts.push({
            conversationId: newConv.conversation_id,
            conversationTitle: newConv.title,
            type: 'duplicate_conversation',
            existingCount: this.countMessages(existing),
            newCount: newMessages.length,
            resolution: 'merge',
          });
        }
      } else {
        // New conversation
        newConversationCount++;
        newMessagesCount += this.countMessages(newConv);
        newMediaFilesCount += (newConv._media_files || []).length;
      }
    }

    // Estimate size
    const estimatedSize = this.estimateImportSize(newConversations);

    return {
      newConversations: newConversationCount,
      existingConversationsToUpdate: existingToUpdateCount,
      newMessages: newMessagesCount,
      newMediaFiles: newMediaFilesCount,
      conflicts,
      estimatedSize,
    };
  }

  /**
   * Apply import with smart merge
   */
  async applyImport(
    newConversations: Conversation[],
    archiveDir: string,
    mediaSourceDir: string
  ): Promise<ImportResult> {
    const startTime = Date.now();
    const existingConversations = await this.loadExistingConversations(archiveDir);
    const existingById = new Map(
      existingConversations.map(conv => [conv.conversation_id, conv])
    );

    let conversationsCreated = 0;
    let conversationsUpdated = 0;
    let totalMessagesAdded = 0;
    let totalMediaFilesAdded = 0;
    const mergeResults: MergeResult[] = [];
    const errors: string[] = [];

    for (const newConv of newConversations) {
      try {
        const existing = existingById.get(newConv.conversation_id);

        if (existing) {
          // Merge into existing conversation
          const result = await this.mergeConversation(
            existing,
            newConv,
            archiveDir,
            mediaSourceDir
          );

          if (result.messagesAdded > 0 || result.mediaFilesAdded > 0) {
            conversationsUpdated++;
            totalMessagesAdded += result.messagesAdded;
            totalMediaFilesAdded += result.mediaFilesAdded;
            mergeResults.push(result);
          }
        } else {
          // Create new conversation
          await this.createConversation(
            newConv,
            archiveDir,
            mediaSourceDir,
            existingConversations.length + conversationsCreated
          );

          conversationsCreated++;
          totalMessagesAdded += this.countMessages(newConv);
          totalMediaFilesAdded += (newConv._media_files || []).length;
        }
      } catch (err: any) {
        errors.push(`Failed to import ${newConv.title}: ${err.message}`);
        console.error(`Import error for ${newConv.conversation_id}:`, err);
      }
    }

    const duration = Date.now() - startTime;

    return {
      success: errors.length === 0,
      conversationsCreated,
      conversationsUpdated,
      totalMessagesAdded,
      totalMediaFilesAdded,
      mergeResults,
      errors,
      duration,
    };
  }

  /**
   * Merge new messages into existing conversation
   */
  private async mergeConversation(
    existing: Conversation,
    newConv: Conversation,
    archiveDir: string,
    mediaSourceDir: string
  ): Promise<MergeResult> {
    let messagesAdded = 0;
    let messagesSkipped = 0;
    let mediaFilesAdded = 0;
    let mediaFilesSkipped = 0;

    // Find conversation folder
    const convFolder = this.findConversationFolder(archiveDir, existing.conversation_id);
    if (!convFolder) {
      throw new Error(`Conversation folder not found: ${existing.conversation_id}`);
    }

    const convJsonPath = path.join(convFolder, 'conversation.json');

    // Merge mapping (conversation tree)
    const existingMessageIds = new Set(
      Object.values(existing.mapping)
        .filter(node => node.message)
        .map(node => node.message!.id)
    );

    for (const [nodeId, node] of Object.entries(newConv.mapping)) {
      if (node.message && !existingMessageIds.has(node.message.id)) {
        // New message - add to existing mapping
        existing.mapping[nodeId] = node;
        messagesAdded++;
      } else if (node.message) {
        messagesSkipped++;
      }
    }

    // Update timestamps
    if (newConv.update_time > existing.update_time) {
      existing.update_time = newConv.update_time;
    }

    // Merge media files
    // NOTE: existing._media_files may contain basenames, newConv._media_files contains absolute paths
    const existingMediaBasenames = new Set(
      (existing._media_files || []).map(f => path.basename(f))
    );
    const newMediaFiles: string[] = [];

    // Ensure media directory exists BEFORE attempting to copy files
    const mediaDir = path.join(convFolder, 'media');
    if (newConv._media_files && newConv._media_files.length > 0) {
      ensureDir(mediaDir);
    }

    for (const mediaPath of newConv._media_files || []) {
      const basename = path.basename(mediaPath);

      if (!existingMediaBasenames.has(basename)) {
        // Copy new media file - mediaPath is already absolute from indexer
        const sourcePath = path.isAbsolute(mediaPath) ? mediaPath : path.join(mediaSourceDir, mediaPath);
        const destPath = path.join(mediaDir, basename);

        if (fs.existsSync(sourcePath)) {
          try {
            copyFile(sourcePath, destPath);
            newMediaFiles.push(basename);
            mediaFilesAdded++;
            console.log(`  + Added media: ${basename}`);
          } catch (err) {
            console.warn(`Failed to copy media file ${basename}:`, err);
          }
        } else {
          console.warn(`Media file not found for merge: ${sourcePath}`);
        }
      } else {
        mediaFilesSkipped++;
      }
    }

    // Update media files list
    if (newMediaFiles.length > 0) {
      existing._media_files = [...(existing._media_files || []), ...newMediaFiles];
    }

    // Write updated conversation
    writeJSON(convJsonPath, existing);

    return {
      conversationId: existing.conversation_id,
      messagesAdded,
      messagesSkipped,
      mediaFilesAdded,
      mediaFilesSkipped,
    };
  }

  /**
   * Generate SHA256 hash of file (first 12 chars)
   */
  private hashFile(filepath: string): string {
    const fileBuffer = fs.readFileSync(filepath);
    const hash = crypto.createHash('sha256');
    hash.update(fileBuffer);
    return hash.digest('hex').slice(0, 12);
  }

  /**
   * Create new conversation in archive with proper media handling
   */
  private async createConversation(
    conversation: Conversation,
    archiveDir: string,
    mediaSourceDir: string,
    index: number
  ): Promise<void> {
    // Generate folder name
    const folderName = generateFolderName(
      conversation.title,
      conversation.create_time,
      index
    );

    const convFolder = path.join(archiveDir, folderName);
    ensureDir(convFolder);

    // Initialize media manifest
    const manifest: MediaManifest = {
      files: {},
      assetPointers: {},
      fileIds: {},
      fileHashes: {},
      sizeToFiles: {},
    };

    // Copy media files with hashed names and build manifest
    // NOTE: _media_files contains ABSOLUTE paths from the media indexer
    if (conversation._media_files && conversation._media_files.length > 0) {
      const mediaDir = path.join(convFolder, 'media');
      ensureDir(mediaDir);

      // Build size-to-path lookup from source files
      const sizeToSourcePath: Map<number, string[]> = new Map();

      for (const mediaPath of conversation._media_files) {
        const sourcePath = path.isAbsolute(mediaPath) ? mediaPath : path.join(mediaSourceDir, mediaPath);

        if (!fs.existsSync(sourcePath)) {
          console.warn(`Media file not found: ${sourcePath}`);
          continue;
        }

        try {
          const basename = path.basename(mediaPath);
          const fileHash = this.hashFile(sourcePath);
          const hashedName = `${fileHash}_${basename}`;
          const destPath = path.join(mediaDir, hashedName);

          // Copy file with hashed name
          copyFile(sourcePath, destPath);

          // Add to manifest: files
          manifest.files[basename] = hashedName;

          // Get file size for size-based matching
          const stats = fs.statSync(sourcePath);
          const fileSize = stats.size;

          // Add to sizeToFiles for size-based matching
          if (!manifest.sizeToFiles[fileSize]) {
            manifest.sizeToFiles[fileSize] = [];
          }
          manifest.sizeToFiles[fileSize].push(hashedName);

          // Track source paths by size for reference extraction
          if (!sizeToSourcePath.has(fileSize)) {
            sizeToSourcePath.set(fileSize, []);
          }
          sizeToSourcePath.get(fileSize)!.push(sourcePath);

          // Extract file-ID from basename if present (file-ABC123_name.png)
          const fileIdMatch = basename.match(/^(file-[A-Za-z0-9]+)[_-]/);
          if (fileIdMatch) {
            manifest.fileIds[fileIdMatch[1]] = hashedName;
          }

          // Extract file hash from basename if present (file_abc123def456-uuid.png)
          const fileHashMatch = basename.match(/^(file_[a-f0-9]{32})-/);
          if (fileHashMatch) {
            manifest.fileHashes[fileHashMatch[1]] = hashedName;
          }
        } catch (err) {
          console.warn(`Failed to copy media file ${mediaPath}:`, err);
        }
      }

      // Extract references from conversation and map to files
      const extractor = new MediaReferenceExtractor();
      const references = extractor.extractAllReferences(conversation);

      // Map asset_pointers to files by size
      for (const ref of references.asset_pointers) {
        if (ref.size_bytes && manifest.sizeToFiles[ref.size_bytes]) {
          const filesWithSize = manifest.sizeToFiles[ref.size_bytes];
          // Use first available file with matching size
          // (for multiple same-size files, we'd need to track usage - simplified for now)
          if (filesWithSize.length > 0) {
            manifest.assetPointers[ref.pointer] = filesWithSize[0];
          }
        }

        // Also map by file_hash (sediment://)
        if (ref.type === 'sediment' && ref.file_hash && manifest.fileHashes[ref.file_hash]) {
          manifest.assetPointers[ref.pointer] = manifest.fileHashes[ref.file_hash];
        }

        // Also map by file_id (file-service://file-ABC123)
        if (ref.file_id && manifest.fileIds[ref.file_id]) {
          manifest.assetPointers[ref.pointer] = manifest.fileIds[ref.file_id];
        }
      }

      // Map attachments by name+size or just name
      for (const att of references.attachments) {
        if (att.name && manifest.files[att.name]) {
          // Direct name match
          continue; // Already in files map
        }
        if (att.id && att.name) {
          // Map file-ID to the attachment name's hashed file
          const hashedFile = manifest.files[att.name];
          if (hashedFile) {
            manifest.fileIds[att.id] = hashedFile;
          }
        }
      }

      // Write media manifest
      if (Object.keys(manifest.files).length > 0) {
        const manifestPath = path.join(convFolder, 'media_manifest.json');
        writeJSON(manifestPath, manifest);
        console.log(`  📁 Created media manifest with ${Object.keys(manifest.files).length} files, ${Object.keys(manifest.assetPointers).length} asset pointers`);
      }
    }

    // Write conversation.json
    const convJsonPath = path.join(convFolder, 'conversation.json');
    writeJSON(convJsonPath, conversation);
  }

  /**
   * Find conversation folder by ID
   */
  private findConversationFolder(archiveDir: string, conversationId: string): string | null {
    if (!fs.existsSync(archiveDir)) {
      return null;
    }

    const folders = fs.readdirSync(archiveDir);

    for (const folder of folders) {
      const folderPath = path.join(archiveDir, folder);
      const convJsonPath = path.join(folderPath, 'conversation.json');

      if (fs.existsSync(convJsonPath)) {
        const conv = readJSON<Conversation>(convJsonPath);
        if (conv && conv.conversation_id === conversationId) {
          return folderPath;
        }
      }
    }

    return null;
  }

  /**
   * Load all existing conversations from archive
   */
  private async loadExistingConversations(archiveDir: string): Promise<Conversation[]> {
    const conversations: Conversation[] = [];

    if (!fs.existsSync(archiveDir)) {
      return conversations;
    }

    const folders = fs.readdirSync(archiveDir);

    for (const folder of folders) {
      const convJsonPath = path.join(archiveDir, folder, 'conversation.json');

      if (fs.existsSync(convJsonPath)) {
        const conv = readJSON<Conversation>(convJsonPath);
        if (conv) {
          conversations.push(conv);
        }
      }
    }

    return conversations;
  }

  /**
   * Find new messages in incoming conversation
   */
  private findNewMessages(existing: Conversation, newConv: Conversation): any[] {
    const existingMessageIds = new Set(
      Object.values(existing.mapping)
        .filter(node => node.message)
        .map(node => node.message!.id)
    );

    const newMessages = Object.values(newConv.mapping)
      .filter(node => node.message && !existingMessageIds.has(node.message.id))
      .map(node => node.message);

    return newMessages;
  }

  /**
   * Count messages in conversation
   */
  private countMessages(conversation: Conversation): number {
    return Object.values(conversation.mapping).filter(
      node => node.message !== undefined
    ).length;
  }

  /**
   * Estimate import size in bytes
   */
  private estimateImportSize(conversations: Conversation[]): number {
    // Rough estimate: 10KB per conversation + media files
    let size = conversations.length * 10 * 1024;

    for (const conv of conversations) {
      if (conv._media_files) {
        // Assume average 500KB per media file
        size += conv._media_files.length * 500 * 1024;
      }
    }

    return size;
  }
}
