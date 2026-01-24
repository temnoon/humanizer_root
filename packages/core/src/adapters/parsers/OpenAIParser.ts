/**
 * OpenAI Export Parser
 *
 * Parses OpenAI conversation exports (conversations.json format)
 * Ported from narrative-studio: OpenAIParser.ts
 */

import * as path from 'path';
import type { Conversation, ConversationMapping, ConversationNode, Message } from './types.js';
import { readJSON, findFiles } from './utils.js';

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
        const data = readJSON<unknown>(filePath);
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
   */
  private findConversationFiles(extractedDir: string): string[] {
    const allFiles = findFiles(extractedDir, /conversations?\.json$/i);

    // Filter out files that are inside organized conversation folders
    const organizedFolderPattern = /\/\d{4}-\d{2}-\d{2}_[^/]+\/conversation\.json$/i;

    const filtered = allFiles.filter((filePath) => {
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
    const data = readJSON<unknown>(filePath);
    if (!data) {
      return null;
    }

    if (Array.isArray(data)) {
      console.warn(`File contains array of ${data.length} conversations: ${filePath}`);
      return null;
    }

    return this.normalizeConversation(data);
  }

  /**
   * Normalize a conversation object to our standard format
   * IMPORTANT: Preserves ALL original fields while ensuring required fields exist
   */
  private normalizeConversation(data: unknown): Conversation {
    const obj = data as Record<string, unknown>;

    // Start with deep clone of original to preserve all fields
    const conversation: Conversation = {
      ...(JSON.parse(JSON.stringify(data)) as Record<string, unknown>),

      // Ensure/normalize required fields
      conversation_id: (obj.id as string) || (obj.conversation_id as string) || '',
      title: (obj.title as string) || 'Untitled Conversation',
      create_time: this.parseTimestamp(obj.create_time),
      update_time: this.parseTimestamp(obj.update_time),
      moderation_results: (obj.moderation_results as unknown[]) || [],
      current_node: obj.current_node as string | undefined,
      plugin_ids: (obj.plugin_ids as string) || null,
      conversation_template_id: (obj.conversation_template_id as string) || null,

      // Extended metadata for import tracking
      _source: 'openai',
      _import_date: new Date().toISOString(),
      _original_id: (obj.id as string) || (obj.conversation_id as string),

      // Will be set below
      mapping: {},
    };

    // Normalize mapping structure (preserves original fields in each node)
    conversation.mapping = this.normalizeMapping(obj.mapping || {});

    return conversation;
  }

  /**
   * Normalize the mapping structure (conversation tree)
   * IMPORTANT: Preserves ALL original fields in each node
   */
  private normalizeMapping(mapping: unknown): ConversationMapping {
    const normalized: ConversationMapping = {};
    const mappingObj = mapping as Record<string, Record<string, unknown>>;

    for (const [nodeId, node] of Object.entries(mappingObj)) {
      const nodeData = node;

      // Preserve all original fields, then ensure/normalize required ones
      normalized[nodeId] = {
        ...nodeData,

        // Ensure required fields
        id: (nodeData.id as string) || nodeId,
        message: nodeData.message ? this.normalizeMessage(nodeData.message) : undefined,
        parent: (nodeData.parent as string) || undefined,
        children: Array.isArray(nodeData.children) ? (nodeData.children as string[]) : [],
      } as ConversationNode;
    }

    return normalized;
  }

  /**
   * Normalize a message object
   * IMPORTANT: Preserves ALL original fields while ensuring required fields exist
   */
  private normalizeMessage(message: unknown): Record<string, unknown> {
    const msg = message as Record<string, unknown>;
    const author = msg.author as Record<string, unknown> | undefined;

    return {
      ...msg, // Keep all original fields

      // Ensure/normalize required fields
      id: msg.id || '',
      author: {
        ...(author || {}),
        role: author?.role || 'user',
        name: author?.name,
        metadata: author?.metadata || {},
      },
      create_time: this.parseTimestamp(msg.create_time),
      update_time: msg.update_time ? this.parseTimestamp(msg.update_time) : undefined,
      content: msg.content || { content_type: 'text', parts: [] },
      status: msg.status || 'finished_successfully',
      metadata: msg.metadata || {},
      recipient: msg.recipient || 'all',
      weight: msg.weight !== undefined ? msg.weight : 1.0,
      end_turn: msg.end_turn !== undefined ? msg.end_turn : true,
    };
  }

  /**
   * Parse timestamp - handle various formats
   */
  private parseTimestamp(value: unknown): number {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      return Math.floor(new Date(value).getTime() / 1000);
    }

    return Math.floor(Date.now() / 1000);
  }

  /**
   * Detect if a directory contains OpenAI export format
   */
  static async detectFormat(extractedDir: string): Promise<boolean> {
    const allFiles = findFiles(extractedDir, /conversations?\.json$/i);

    // Filter out already-organized folders
    const organizedFolderPattern = /\/\d{4}-\d{2}-\d{2}_[^/]+\/conversation\.json$/i;
    const conversationFiles = allFiles.filter((f) => !organizedFolderPattern.test(f));

    if (conversationFiles.length === 0) {
      return false;
    }

    // Check first file for OpenAI-specific structure
    const firstFile = readJSON<unknown>(conversationFiles[0]);
    if (!firstFile) {
      return false;
    }

    // OpenAI exports can be either:
    // 1. An array of conversations (conversations.json from full export)
    // 2. A single conversation object
    let sample = firstFile as Record<string, unknown>;
    if (Array.isArray(firstFile)) {
      if (firstFile.length === 0) {
        return false;
      }
      sample = firstFile[0] as Record<string, unknown>;
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
    const data = readJSON<unknown>(filePath);
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
