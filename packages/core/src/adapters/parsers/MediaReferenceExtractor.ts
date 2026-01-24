/**
 * Media Reference Extractor
 *
 * Comprehensive extraction of ALL media references from conversation JSON.
 * Ported from Python: openai_export_parser/media_reference_extractor.py
 */

import type { Conversation } from './types.js';

export interface AssetPointerRef {
  pointer: string;
  type: 'sediment' | 'file-service' | 'file' | 'unknown';
  file_hash?: string;
  file_id?: string;
  size_bytes?: number;
  width?: number;
  height?: number;
  metadata?: Record<string, unknown>;
}

export interface AttachmentRef {
  id?: string;
  name?: string;
  size?: number;
  mime_type?: string;
  width?: number;
  height?: number;
}

export interface DalleGenerationRef {
  gen_id?: string;
  size_bytes?: number;
  width?: number;
  height?: number;
  asset_pointer?: string;
  dalle_metadata?: Record<string, unknown>;
}

export interface TextRef {
  match: string;
  context: string;
}

export interface MediaReferences {
  asset_pointers: AssetPointerRef[];
  attachments: AttachmentRef[];
  dalle_generations: DalleGenerationRef[];
  text_references: TextRef[];
}

/**
 * Extracts ALL media references from conversation JSON.
 * This extractor makes no assumptions about reference format - it looks
 * everywhere for any hint of media files.
 */
export class MediaReferenceExtractor {
  private verbose: boolean;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  private log(msg: string): void {
    if (this.verbose) {
      console.log(msg);
    }
  }

  /**
   * Extract ALL media references from a conversation JSON.
   */
  extractAllReferences(conversation: Conversation): MediaReferences {
    const references: MediaReferences = {
      asset_pointers: [],
      attachments: [],
      dalle_generations: [],
      text_references: [],
    };

    const mapping = conversation.mapping || {};

    for (const [nodeId, nodeData] of Object.entries(mapping)) {
      const message = nodeData.message;
      if (!message) continue;

      // Extract from message content
      const content = message.content as { parts?: (string | Record<string, unknown>)[] } | undefined;
      const parts = content?.parts || [];

      for (const part of parts) {
        if (typeof part === 'object' && part !== null) {
          this.extractFromPart(part as Record<string, unknown>, references);
        } else if (typeof part === 'string') {
          this.extractFromText(part, references);
        }
      }

      // Extract from message metadata (attachments)
      const metadata = message.metadata || {};
      this.extractFromMetadata(metadata as Record<string, unknown>, references);
    }

    return references;
  }

  /**
   * Extract media references from a content part dict.
   */
  private extractFromPart(part: Record<string, unknown>, references: MediaReferences): void {
    const assetPointer = part.asset_pointer as string || '';
    if (assetPointer) {
      const ref: AssetPointerRef = {
        pointer: assetPointer,
        type: 'unknown',
        size_bytes: part.size_bytes as number | undefined,
        width: part.width as number | undefined,
        height: part.height as number | undefined,
        metadata: (part.metadata as Record<string, unknown>) || {},
      };

      if (assetPointer.startsWith('sediment://')) {
        ref.type = 'sediment';
        ref.file_hash = assetPointer.replace('sediment://', '');
        references.asset_pointers.push(ref);
      } else if (assetPointer.startsWith('file-service://')) {
        ref.type = 'file-service';

        const fileId = assetPointer.replace('file-service://', '');
        if (fileId.startsWith('file-')) {
          ref.file_id = fileId;
        }

        const partMetadata = (part.metadata as Record<string, unknown>) || {};
        const dalleMetadata = (partMetadata.dalle as Record<string, unknown>) || {};
        if (Object.keys(dalleMetadata).length > 0) {
          const genRef: DalleGenerationRef = {
            gen_id: dalleMetadata.gen_id as string | undefined,
            size_bytes: part.size_bytes as number | undefined,
            width: part.width as number | undefined,
            height: part.height as number | undefined,
            asset_pointer: assetPointer,
            dalle_metadata: dalleMetadata,
          };
          references.dalle_generations.push(genRef);
        }

        references.asset_pointers.push(ref);
      } else if (assetPointer.startsWith('file://')) {
        ref.type = 'file';
        const filename = assetPointer.replace('file://', '').split('/').pop() || '';
        if (filename) {
          ref.metadata = { ...ref.metadata, filename };
        }
        references.asset_pointers.push(ref);
      } else {
        references.asset_pointers.push(ref);
      }
    }

    // Check for multimodal content
    if (part.content_type === 'multimodal_text' && Array.isArray(part.parts)) {
      for (const nestedPart of part.parts as Array<unknown>) {
        if (typeof nestedPart === 'object' && nestedPart !== null) {
          this.extractFromPart(nestedPart as Record<string, unknown>, references);
        }
      }
    }
  }

  /**
   * Extract media references from text content.
   */
  private extractFromText(text: string, references: MediaReferences): void {
    const filenamePatterns = [
      /[\w\-]+\.(jpg|jpeg|png|gif|webp|pdf|mp3|wav|mp4|mov)/gi,
      /file-[A-Za-z0-9]+/g,
      /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
    ];

    for (const pattern of filenamePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const start = Math.max(0, match.index - 50);
        const end = Math.min(text.length, match.index + match[0].length + 50);
        const context = text.slice(start, end);

        references.text_references.push({
          match: match[0],
          context,
        });
      }
      pattern.lastIndex = 0;
    }
  }

  /**
   * Extract media references from message metadata.
   */
  private extractFromMetadata(metadata: Record<string, unknown>, references: MediaReferences): void {
    const attachments = (metadata.attachments as Array<Record<string, unknown>>) || [];
    for (const attachment of attachments) {
      references.attachments.push({
        id: attachment.id as string | undefined,
        name: attachment.name as string | undefined,
        size: attachment.size as number | undefined,
        mime_type: attachment.mimeType as string | undefined,
        width: attachment.width as number | undefined,
        height: attachment.height as number | undefined,
      });
    }

    const dalleGenerations = (metadata.dalle_generations as Array<Record<string, unknown>>) || [];
    for (const gen of dalleGenerations) {
      references.dalle_generations.push({
        gen_id: gen.gen_id as string | undefined,
        size_bytes: gen.size_bytes as number | undefined,
        width: gen.width as number | undefined,
        height: gen.height as number | undefined,
        asset_pointer: gen.asset_pointer as string | undefined,
        dalle_metadata: gen,
      });
    }

    // Claude-specific file references
    if (metadata._files && Array.isArray(metadata._files)) {
      for (const file of metadata._files as Array<Record<string, unknown>>) {
        if (file.file_name) {
          references.text_references.push({
            match: file.file_name as string,
            context: 'Claude file attachment',
          });
        }
      }
    }

    if (metadata.file_id) {
      references.asset_pointers.push({
        pointer: `file-service://file-${metadata.file_id}`,
        type: 'file-service',
        file_id: `file-${metadata.file_id}`,
      });
    }

    if (metadata.file_hash) {
      references.asset_pointers.push({
        pointer: `sediment://file_${metadata.file_hash}`,
        type: 'sediment',
        file_hash: `file_${metadata.file_hash}`,
      });
    }
  }

  /**
   * Get all unique file hashes (sediment://) from references.
   */
  getAllFileHashes(references: MediaReferences): Set<string> {
    const hashes = new Set<string>();

    for (const ref of references.asset_pointers) {
      if (ref.type === 'sediment' && ref.file_hash) {
        hashes.add(ref.file_hash);
      }
    }

    return hashes;
  }

  /**
   * Get all file-IDs from references.
   */
  getAllFileIds(references: MediaReferences): Set<string> {
    const fileIds = new Set<string>();

    for (const ref of references.asset_pointers) {
      if (ref.file_id) {
        fileIds.add(ref.file_id);
      }
    }

    for (const ref of references.attachments) {
      if (ref.id) {
        fileIds.add(ref.id);
      }
    }

    for (const ref of references.text_references) {
      if (ref.match.startsWith('file-')) {
        fileIds.add(ref.match);
      }
    }

    return fileIds;
  }

  /**
   * Get all filenames from references.
   */
  getAllFilenames(references: MediaReferences): Set<string> {
    const filenames = new Set<string>();

    for (const ref of references.attachments) {
      if (ref.name) {
        filenames.add(ref.name);
      }
    }

    for (const ref of references.text_references) {
      if (ref.match.includes('.') && !ref.match.startsWith('file-')) {
        filenames.add(ref.match);
      }
    }

    return filenames;
  }

  /**
   * Get all sizes mentioned in references.
   */
  getAllSizes(references: MediaReferences): Set<number> {
    const sizes = new Set<number>();

    for (const ref of references.asset_pointers) {
      if (ref.size_bytes) {
        sizes.add(ref.size_bytes);
      }
    }

    for (const ref of references.attachments) {
      if (ref.size) {
        sizes.add(ref.size);
      }
    }

    for (const ref of references.dalle_generations) {
      if (ref.size_bytes) {
        sizes.add(ref.size_bytes);
      }
    }

    return sizes;
  }

  /**
   * Count references by type.
   */
  countReferences(references: MediaReferences): Record<string, number> {
    return {
      asset_pointers: references.asset_pointers.length,
      attachments: references.attachments.length,
      dalle_generations: references.dalle_generations.length,
      text_references: references.text_references.length,
    };
  }
}
