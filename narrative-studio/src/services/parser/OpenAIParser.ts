// ============================================================
// OPENAI EXPORT PARSER
// ============================================================
// Parses OpenAI conversation exports (conversations.json format)

import * as path from 'path';
import { Conversation } from './types';
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
        const conversation = this.parseConversationFile(filePath);
        if (conversation) {
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
   */
  private findConversationFiles(extractedDir: string): string[] {
    return findFiles(extractedDir, /conversations?\.json$/i);
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
   */
  private normalizeConversation(data: any): Conversation {
    // Ensure required fields exist
    const conversation: Conversation = {
      conversation_id: data.id || data.conversation_id || '',
      title: data.title || 'Untitled Conversation',
      create_time: this.parseTimestamp(data.create_time),
      update_time: this.parseTimestamp(data.update_time),
      mapping: data.mapping || {},
      moderation_results: data.moderation_results || [],
      current_node: data.current_node,
      plugin_ids: data.plugin_ids || null,
      conversation_template_id: data.conversation_template_id || null,

      // Extended metadata
      _source: 'openai',
      _import_date: new Date().toISOString(),
      _original_id: data.id || data.conversation_id,
    };

    // Normalize mapping structure
    conversation.mapping = this.normalizeMapping(data.mapping || {});

    return conversation;
  }

  /**
   * Normalize the mapping structure (conversation tree)
   */
  private normalizeMapping(mapping: any): any {
    const normalized: any = {};

    for (const [nodeId, node] of Object.entries(mapping)) {
      const nodeData = node as any;

      normalized[nodeId] = {
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
   */
  private normalizeMessage(message: any): any {
    return {
      id: message.id || '',
      author: {
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
    const conversationFiles = findFiles(extractedDir, /conversations?\.json$/i);

    if (conversationFiles.length === 0) {
      return false;
    }

    // Check first file for OpenAI-specific structure
    const firstFile = readJSON<any>(conversationFiles[0]);
    if (!firstFile) {
      return false;
    }

    // OpenAI exports have 'mapping' field with conversation tree
    const hasMapping = firstFile.mapping !== undefined;
    const hasCreateTime = firstFile.create_time !== undefined;

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
