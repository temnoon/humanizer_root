// ============================================================
// OPENAI EXPORT PARSER
// ============================================================
// Parses OpenAI conversation exports (conversations.json format)

import * as path from 'path';
import type { Conversation } from './types';
import { readJSON, findFiles } from './utils';

export class OpenAIParser {
  /**
   * Parse all conversations from an extracted archive directory
   */
  async parseConversations(extractedDir: string): Promise<Conversation[]> {
    const conversations: Conversation[] = [];
    const conversationFiles = this.findConversationFiles(extractedDir);

    console.log(`Found ${conversationFiles.length} conversation.json files`);

    for (const filePath of conversationFiles) {
      try {
        const data = readJSON<any>(filePath);
        if (!data) continue;

        // Handle array of conversations (full export)
        if (Array.isArray(data)) {
          console.log(`Parsing array of ${data.length} conversations from ${path.basename(filePath)}`);
          for (const item of data) {
            try {
              const conversation = this.normalizeConversation(item);
              conversations.push(conversation);
            } catch (err) {
              console.error('Failed to normalize conversation:', err);
            }
          }
        } else {
          // Single conversation object
          const conversation = this.normalizeConversation(data);
          conversations.push(conversation);
        }
      } catch (err) {
        console.error(`Failed to parse ${filePath}:`, err);
      }
    }

    return conversations;
  }

  /**
   * Find all conversations.json files in the extracted archive
   * IMPORTANT: Excludes files inside already-organized folders (pattern: YYYY-MM-DD_*_*)
   * to prevent double-processing when importing into an existing archive.
   */
  private findConversationFiles(extractedDir: string): string[] {
    const allFiles = findFiles(extractedDir, /conversations?\.json$/i);

    // Filter out files that are inside organized conversation folders
    // Organized folders match: YYYY-MM-DD_title_id/conversation.json
    const organizedFolderPattern = /\/\d{4}-\d{2}-\d{2}_[^/]+\/conversation\.json$/i;

    const filtered = allFiles.filter(filePath => {
      // Exclude if file is inside an organized folder
      if (organizedFolderPattern.test(filePath)) {
        console.log(`[OpenAIParser] Skipping already-organized: ${filePath}`);
        return false;
      }
      return true;
    });

    if (allFiles.length !== filtered.length) {
      console.log(`[OpenAIParser] Filtered ${allFiles.length - filtered.length} already-organized files`);
    }

    return filtered;
  }

  /**
   * Parse a single conversation.json file
   */
  private parseConversationFile(filePath: string): Conversation | null {
    const data = readJSON<any>(filePath);
    if (!data) {
      return null;
    }

    // Handle both single conversation and array of conversations
    if (Array.isArray(data)) {
      // conversations.json with array of conversations
      console.warn(`File contains array of ${data.length} conversations: ${filePath}`);
      // For now, return null - caller should handle this differently
      return null;
    }

    // Single conversation object
    return this.normalizeConversation(data);
  }

  /**
   * Normalize a conversation object to our standard format
   * IMPORTANT: Preserves ALL original fields while ensuring required fields exist
   */
  private normalizeConversation(data: any): Conversation {
    // Start with deep clone of original to preserve all fields (including unknown ones)
    const conversation: Conversation = {
      ...JSON.parse(JSON.stringify(data)), // Deep clone original

      // Ensure/normalize required fields
      conversation_id: data.id || data.conversation_id || '',
      title: data.title || 'Untitled Conversation',
      create_time: this.parseTimestamp(data.create_time),
      update_time: this.parseTimestamp(data.update_time),
      moderation_results: data.moderation_results || [],
      current_node: data.current_node,
      plugin_ids: data.plugin_ids || null,
      conversation_template_id: data.conversation_template_id || null,

      // Extended metadata for import tracking
      _source: 'openai',
      _import_date: new Date().toISOString(),
      _original_id: data.id || data.conversation_id,
    };

    // Normalize mapping structure (preserves original fields in each node)
    conversation.mapping = this.normalizeMapping(data.mapping || {});

    return conversation;
  }

  /**
   * Normalize the mapping structure (conversation tree)
   * IMPORTANT: Preserves ALL original fields in each node
   */
  private normalizeMapping(mapping: any): any {
    const normalized: any = {};

    for (const [nodeId, node] of Object.entries(mapping)) {
      const nodeData = node as any;

      // Preserve all original fields, then ensure/normalize required ones
      normalized[nodeId] = {
        ...nodeData, // Keep all original fields

        // Ensure required fields
        id: nodeData.id || nodeId,
        message: nodeData.message ? this.normalizeMessage(nodeData.message) : undefined,
        parent: nodeData.parent || undefined,
        children: Array.isArray(nodeData.children) ? nodeData.children : [],
      };
    }

    return normalized;
  }

  /**
   * Normalize a message object
   * IMPORTANT: Preserves ALL original fields while ensuring required fields exist
   */
  private normalizeMessage(message: any): any {
    return {
      ...message, // Keep all original fields (attachments, model_slug, etc.)

      // Ensure/normalize required fields
      id: message.id || '',
      author: {
        ...(message.author || {}), // Keep all original author fields
        role: message.author?.role || 'user',
        name: message.author?.name,
        metadata: message.author?.metadata || {},
      },
      create_time: this.parseTimestamp(message.create_time),
      update_time: message.update_time ? this.parseTimestamp(message.update_time) : undefined,
      content: message.content || { content_type: 'text', parts: [] },
      status: message.status || 'finished_successfully',
      metadata: message.metadata || {},
      recipient: message.recipient || 'all',
      weight: message.weight !== undefined ? message.weight : 1.0,
      end_turn: message.end_turn !== undefined ? message.end_turn : true,
    };
  }

  /**
   * Parse timestamp - handle various formats
   */
  private parseTimestamp(value: any): number {
    if (typeof value === 'number') {
      // Already a Unix timestamp
      return value;
    }

    if (typeof value === 'string') {
      // ISO 8601 string
      return Math.floor(new Date(value).getTime() / 1000);
    }

    // Default to current time if invalid
    return Math.floor(Date.now() / 1000);
  }

  /**
   * Detect if a directory contains OpenAI export format
   */
  static async detectFormat(extractedDir: string): Promise<boolean> {
    const allFiles = findFiles(extractedDir, /conversations?\.json$/i);

    // Filter out already-organized folders (same as findConversationFiles)
    const organizedFolderPattern = /\/\d{4}-\d{2}-\d{2}_[^/]+\/conversation\.json$/i;
    const conversationFiles = allFiles.filter(f => !organizedFolderPattern.test(f));

    if (conversationFiles.length === 0) {
      return false;
    }

    // Check first file for OpenAI-specific structure
    const firstFile = readJSON<any>(conversationFiles[0]);
    if (!firstFile) {
      return false;
    }

    // OpenAI exports can be either:
    // 1. An array of conversations (conversations.json from full export)
    // 2. A single conversation object
    let sample = firstFile;
    if (Array.isArray(firstFile)) {
      if (firstFile.length === 0) {
        return false;
      }
      sample = firstFile[0];
    }

    // OpenAI exports have 'mapping' field with conversation tree
    const hasMapping = sample.mapping !== undefined;
    const hasCreateTime = sample.create_time !== undefined;

    return hasMapping || hasCreateTime;
  }

  /**
   * Parse conversations.json file that contains an array of conversations
   */
  async parseConversationsArray(filePath: string): Promise<Conversation[]> {
    const data = readJSON<any>(filePath);
    if (!data) {
      return [];
    }

    if (!Array.isArray(data)) {
      console.warn(`Expected array but got object: ${filePath}`);
      const single = this.parseConversationFile(filePath);
      return single ? [single] : [];
    }

    const conversations: Conversation[] = [];

    for (const item of data) {
      try {
        const conversation = this.normalizeConversation(item);
        conversations.push(conversation);
      } catch (err) {
        console.error('Failed to normalize conversation:', err);
      }
    }

    return conversations;
  }
}
