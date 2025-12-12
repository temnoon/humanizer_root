// ============================================================
// CLAUDE EXPORT PARSER
// ============================================================
// Parses Claude conversation exports and converts to OpenAI format

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Conversation, ClaudeExport, ClaudeChatMessage } from './types';
import { readJSON, findFiles, parseISOTimestamp } from './utils';

export class ClaudeParser {
  /**
   * Parse all conversations from Claude export directory
   */
  async parseConversations(extractedDir: string): Promise<Conversation[]> {
    const conversations: Conversation[] = [];

    // Claude exports have conversations.json in root
    const conversationsFile = path.join(extractedDir, 'conversations.json');
    const claudeConversations = readJSON<ClaudeExport[]>(conversationsFile);

    if (!claudeConversations || !Array.isArray(claudeConversations)) {
      console.error('Failed to read conversations.json or invalid format');
      return [];
    }

    console.log(`Found ${claudeConversations.length} Claude conversations`);

    for (const claudeConv of claudeConversations) {
      try {
        const conversation = this.convertToOpenAIFormat(claudeConv);
        conversations.push(conversation);
      } catch (err) {
        console.error(`Failed to convert Claude conversation ${claudeConv.uuid}:`, err);
      }
    }

    return conversations;
  }

  /**
   * Convert Claude conversation format to OpenAI format
   */
  private convertToOpenAIFormat(claudeConv: ClaudeExport): Conversation {
    // Convert timestamps
    const createTime = parseISOTimestamp(claudeConv.created_at);
    const updateTime = parseISOTimestamp(claudeConv.updated_at);

    // Build conversation tree from flat message list
    const mapping = this.buildMappingFromMessages(claudeConv.chat_messages);

    const conversation: Conversation = {
      conversation_id: claudeConv.uuid,
      title: claudeConv.name || 'Untitled Claude Conversation',
      create_time: createTime,
      update_time: updateTime,
      mapping,
      moderation_results: [],
      current_node: undefined, // Will be set to last message node
      plugin_ids: null,
      conversation_template_id: null,

      // Extended metadata
      _source: 'claude',
      _import_date: new Date().toISOString(),
      _original_id: claudeConv.uuid,
    };

    // Set current_node to the last message in the chain
    const mappingValues = Object.values(mapping) as Array<{ parent?: string; children: string[]; id: string }>;
    const rootNode = mappingValues.find(node => !node.parent);
    if (rootNode && rootNode.children.length > 0) {
      conversation.current_node = this.findLastNode(mapping, rootNode.id);
    }

    return conversation;
  }

  /**
   * Build OpenAI-style mapping tree from Claude's flat message list
   */
  private buildMappingFromMessages(messages: ClaudeChatMessage[]): any {
    const mapping: any = {};

    // Create root node (no message, just container)
    const rootId = uuidv4();
    mapping[rootId] = {
      id: rootId,
      message: undefined,
      parent: undefined,
      children: [],
    };

    let previousNodeId = rootId;

    // Convert each message to a node
    for (const msg of messages) {
      const nodeId = msg.uuid || uuidv4();

      // Convert Claude message to OpenAI message format
      const openAIMessage = {
        id: nodeId,
        author: {
          role: msg.sender === 'human' ? 'user' : 'assistant',
          name: undefined,
          metadata: {},
        },
        create_time: msg.created_at ? parseISOTimestamp(msg.created_at) : undefined,
        update_time: msg.updated_at ? parseISOTimestamp(msg.updated_at) : undefined,
        content: {
          content_type: 'text' as const,
          parts: [msg.text],
        },
        status: 'finished_successfully',
        metadata: {
          // Store Claude-specific file attachments
          _files: msg.files || [],
          _attachments: msg.attachments || [],
        },
        recipient: 'all',
        weight: 1.0,
        end_turn: true,
      };

      // Create node
      mapping[nodeId] = {
        id: nodeId,
        message: openAIMessage,
        parent: previousNodeId,
        children: [],
      };

      // Link parent to this child
      mapping[previousNodeId].children.push(nodeId);

      // Move to next
      previousNodeId = nodeId;
    }

    return mapping;
  }

  /**
   * Find the last node in a conversation chain
   */
  private findLastNode(mapping: any, nodeId: string): string {
    const node = mapping[nodeId];
    if (!node || node.children.length === 0) {
      return nodeId;
    }

    // Follow the first child (linear conversation)
    return this.findLastNode(mapping, node.children[0]);
  }

  /**
   * Detect if a directory contains Claude export format
   */
  static async detectFormat(extractedDir: string): Promise<boolean> {
    const conversationsFile = path.join(extractedDir, 'conversations.json');
    const usersFile = path.join(extractedDir, 'users.json');

    // Claude exports have both conversations.json and users.json in root
    const hasConversations = fs.existsSync(conversationsFile);
    const hasUsers = fs.existsSync(usersFile);

    if (!hasConversations) {
      return false;
    }

    // Check structure of conversations.json
    const data = readJSON<any>(conversationsFile);
    if (!data || !Array.isArray(data)) {
      return false;
    }

    if (data.length === 0) {
      return false;
    }

    // Claude conversations have 'uuid', 'name', 'chat_messages'
    const firstConv = data[0];
    const hasClaudeFields =
      firstConv.uuid !== undefined &&
      firstConv.chat_messages !== undefined &&
      Array.isArray(firstConv.chat_messages);

    return hasClaudeFields && hasUsers;
  }
}
