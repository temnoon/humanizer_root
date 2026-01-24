/**
 * Browser Plugin Export Parser
 *
 * Parses single-conversation exports from the Chrome browser plugin.
 * Supports ChatGPT, Claude, and Gemini formats.
 *
 * Format detection:
 * - Has `conversation.json` in root (not `conversations.json`)
 * - Has `source` field: "ChatGPT", "Claude", or "Gemini"
 * - Has optional `media/` folder with downloaded files
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type {
  Conversation,
  ConversationMapping,
  Message,
  MessageAuthor,
  MessageContent,
} from './types.js';
import { readJSON, findFiles, parseISOTimestamp } from './utils.js';

/**
 * Browser plugin conversation format
 */
interface PluginConversation {
  title: string;
  source: 'ChatGPT' | 'Claude' | 'Gemini' | string;
  messages: PluginChatGPTMapping | PluginClaudeMessages | PluginGeminiMessages;
  media?: PluginMediaRef[];
}

/**
 * ChatGPT mapping format (same as OpenAI)
 */
interface PluginChatGPTMapping {
  [nodeId: string]: {
    id: string;
    message: {
      id: string;
      author: { role: string; name?: string; metadata?: Record<string, unknown> };
      create_time?: number;
      update_time?: number;
      content: { content_type: string; parts: unknown[] };
      status?: string;
      metadata?: Record<string, unknown>;
      end_turn?: boolean;
      weight?: number;
      recipient?: string;
    } | null;
    parent: string | null;
    children: string[];
  };
}

/**
 * Claude messages format
 */
interface PluginClaudeMessages {
  uuid: string;
  name: string;
  created_at: string;
  updated_at: string;
  chat_messages: PluginClaudeChatMessage[];
  // ... other fields
}

interface PluginClaudeChatMessage {
  uuid: string;
  text: string;
  sender: 'human' | 'assistant';
  index: number;
  created_at: string;
  updated_at: string;
  attachments?: unknown[];
  files?: PluginClaudeFile[];
  files_v2?: unknown[];
  parent_message_uuid?: string;
}

interface PluginClaudeFile {
  file_kind: string;
  file_uuid: string;
  file_name: string;
  created_at: string;
}

/**
 * Gemini messages format (array of simple messages)
 */
type PluginGeminiMessages = PluginGeminiMessage[];

interface PluginGeminiMessage {
  id: string;
  role: 'model' | 'user';
  content: { parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> };
  timestamp: number;
}

/**
 * Media reference from plugin export
 */
interface PluginMediaRef {
  url: string;
  filename: string;
  originalRef?: {
    type: string;
    assetPointer?: string;
    fileId?: string;
    messageId?: string;
    metadata?: Record<string, unknown>;
  };
}

export class BrowserPluginParser {
  private verbose: boolean;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  private log(msg: string) {
    if (this.verbose) console.log(msg);
  }

  /**
   * Parse a single-conversation export from browser plugin or native export
   */
  async parseConversation(extractedDir: string): Promise<Conversation | null> {
    const conversationFile = this.findConversationFile(extractedDir);
    if (!conversationFile) {
      this.log('No conversation.json found');
      return null;
    }

    const data = readJSON<Record<string, unknown>>(conversationFile);
    if (!data) {
      this.log('Failed to read conversation file');
      return null;
    }

    let conversation: Conversation;
    let source: string;

    // Detect format
    if (data.source) {
      // Plugin format with source field
      source = (data.source as string).toLowerCase();
      this.log(`[BrowserPluginParser] Detected plugin source: ${data.source}`);
    } else if (data.mapping && data.conversation_id) {
      // Native OpenAI single export
      source = 'openai-single';
      this.log('[BrowserPluginParser] Detected native OpenAI single export');
    } else if (data.chat_messages) {
      // Native Claude single export
      source = 'claude-single';
      this.log('[BrowserPluginParser] Detected native Claude single export');
    } else {
      this.log('Unknown conversation format');
      return null;
    }

    if (source === 'chatgpt') {
      conversation = this.parseChatGPT(data as unknown as PluginConversation, extractedDir);
    } else if (source === 'claude') {
      conversation = this.parseClaude(data as unknown as PluginConversation, extractedDir);
    } else if (source === 'gemini') {
      conversation = this.parseGemini(data as unknown as PluginConversation, extractedDir);
    } else if (source === 'openai-single') {
      conversation = this.parseNativeOpenAI(data, extractedDir);
    } else if (source === 'claude-single') {
      conversation = this.parseNativeClaude(data, extractedDir);
    } else {
      this.log(`Unknown source: ${source}, attempting generic parse`);
      conversation = this.parseGeneric(data as unknown as PluginConversation, extractedDir);
    }

    // Attach media files
    const mediaDir = path.join(extractedDir, 'media');
    if (fs.existsSync(mediaDir)) {
      const mediaFiles = fs.readdirSync(mediaDir)
        .filter(f => !f.startsWith('.'))
        .map(f => path.join(mediaDir, f));
      conversation._media_files = mediaFiles;
    }

    return conversation;
  }

  /**
   * Find conversation.json file (handles various naming)
   */
  private findConversationFile(dir: string): string | null {
    const candidates = [
      'conversation.json',
      'conversation (1).json',
      'conversation (2).json',
    ];

    for (const name of candidates) {
      const filePath = path.join(dir, name);
      if (fs.existsSync(filePath)) {
        return filePath;
      }
    }

    // Fall back to glob search
    const files = findFiles(dir, /^conversation.*\.json$/i);
    return files.length > 0 ? files[0] : null;
  }

  /**
   * Parse ChatGPT plugin export
   */
  private parseChatGPT(data: PluginConversation, extractedDir: string): Conversation {
    const mapping = data.messages as PluginChatGPTMapping;
    const mediaRefs = data.media || [];

    // Build media lookup by messageId
    const mediaByMessage = new Map<string, PluginMediaRef[]>();
    for (const ref of mediaRefs) {
      if (ref.originalRef?.messageId) {
        const existing = mediaByMessage.get(ref.originalRef.messageId) || [];
        existing.push(ref);
        mediaByMessage.set(ref.originalRef.messageId, existing);
      }
    }

    // Convert mapping to our format
    const convMapping: ConversationMapping = {};
    let createTime: number | undefined;
    let updateTime: number | undefined;

    for (const [nodeId, node] of Object.entries(mapping)) {
      if (!node.message) {
        // Root node without message
        convMapping[nodeId] = {
          id: nodeId,
          message: undefined,
          parent: node.parent || undefined,
          children: node.children,
        };
        continue;
      }

      const msg = node.message;

      // Track timestamps
      if (msg.create_time) {
        if (!createTime || msg.create_time < createTime) createTime = msg.create_time;
        if (!updateTime || msg.create_time > updateTime) updateTime = msg.create_time;
      }

      // Build message object
      const message: Message = {
        id: msg.id,
        author: {
          role: msg.author.role as 'user' | 'assistant' | 'system' | 'tool',
          name: msg.author.name,
          metadata: msg.author.metadata || {},
        },
        create_time: msg.create_time,
        update_time: msg.update_time,
        content: msg.content as MessageContent,
        status: msg.status || 'finished_successfully',
        metadata: {
          ...msg.metadata,
          // Attach media references
          _plugin_media: mediaByMessage.get(msg.id),
        },
        recipient: msg.recipient || 'all',
        weight: msg.weight ?? 1.0,
        end_turn: msg.end_turn,
      };

      convMapping[nodeId] = {
        id: nodeId,
        message,
        parent: node.parent || undefined,
        children: node.children,
      };
    }

    const conversationId = `plugin_chatgpt_${crypto.randomUUID().slice(0, 8)}`;

    return {
      conversation_id: conversationId,
      title: data.title || 'Untitled ChatGPT Conversation',
      create_time: createTime,
      update_time: updateTime,
      mapping: convMapping,
      moderation_results: [],
      current_node: undefined,
      plugin_ids: null,
      conversation_template_id: null,
      _source: 'plugin-chatgpt',
      _import_date: new Date().toISOString(),
      _original_id: conversationId,
    };
  }

  /**
   * Parse Claude plugin export
   */
  private parseClaude(data: PluginConversation, extractedDir: string): Conversation {
    const messages = data.messages as PluginClaudeMessages;
    const chatMessages = messages.chat_messages || [];

    const conversationId = messages.uuid || `plugin_claude_${crypto.randomUUID().slice(0, 8)}`;
    const createTime = messages.created_at ? parseISOTimestamp(messages.created_at) : undefined;
    const updateTime = messages.updated_at ? parseISOTimestamp(messages.updated_at) : undefined;

    // Build mapping from flat message list
    const mapping: ConversationMapping = {};

    // Root node
    const rootId = `${conversationId}_root`;
    mapping[rootId] = {
      id: rootId,
      message: undefined,
      parent: undefined,
      children: chatMessages.length > 0 ? [chatMessages[0].uuid] : [],
    };

    // Convert each message
    for (let i = 0; i < chatMessages.length; i++) {
      const msg = chatMessages[i];
      const nextMsg = chatMessages[i + 1];

      const message: Message = {
        id: msg.uuid,
        author: {
          role: msg.sender === 'human' ? 'user' : 'assistant',
          metadata: {},
        },
        create_time: msg.created_at ? parseISOTimestamp(msg.created_at) : undefined,
        update_time: msg.updated_at ? parseISOTimestamp(msg.updated_at) : undefined,
        content: {
          content_type: 'text',
          parts: [msg.text],
        },
        status: 'finished_successfully',
        metadata: {
          _files: msg.files,
          _attachments: msg.attachments,
        },
        recipient: 'all',
        weight: 1.0,
        end_turn: true,
      };

      mapping[msg.uuid] = {
        id: msg.uuid,
        message,
        parent: i === 0 ? rootId : chatMessages[i - 1].uuid,
        children: nextMsg ? [nextMsg.uuid] : [],
      };
    }

    return {
      conversation_id: conversationId,
      title: data.title || messages.name || 'Untitled Claude Conversation',
      create_time: createTime,
      update_time: updateTime,
      mapping,
      moderation_results: [],
      current_node: undefined,
      plugin_ids: null,
      conversation_template_id: null,
      _source: 'plugin-claude',
      _import_date: new Date().toISOString(),
      _original_id: conversationId,
    };
  }

  /**
   * Parse Gemini plugin export
   */
  private parseGemini(data: PluginConversation, extractedDir: string): Conversation {
    const messages = data.messages as PluginGeminiMessages;

    // Filter out empty/UI messages
    const validMessages = messages.filter(msg => {
      const text = msg.content?.parts?.[0]?.text;
      return text && text.trim().length > 0;
    });

    const conversationId = `plugin_gemini_${crypto.randomUUID().slice(0, 8)}`;
    const timestamps = validMessages.map(m => m.timestamp).filter(Boolean);
    const createTime = timestamps.length > 0 ? Math.min(...timestamps) / 1000 : undefined;
    const updateTime = timestamps.length > 0 ? Math.max(...timestamps) / 1000 : undefined;

    // Build mapping
    const mapping: ConversationMapping = {};

    // Root node
    const rootId = `${conversationId}_root`;
    mapping[rootId] = {
      id: rootId,
      message: undefined,
      parent: undefined,
      children: validMessages.length > 0 ? [validMessages[0].id] : [],
    };

    // Convert each message
    for (let i = 0; i < validMessages.length; i++) {
      const msg = validMessages[i];
      const nextMsg = validMessages[i + 1];

      const textParts: string[] = [];
      for (const part of msg.content.parts) {
        if (part.text) {
          textParts.push(part.text);
        }
      }

      const message: Message = {
        id: msg.id,
        author: {
          role: msg.role === 'model' ? 'assistant' : 'user',
          metadata: {},
        },
        create_time: msg.timestamp ? msg.timestamp / 1000 : undefined,
        content: {
          content_type: 'text',
          parts: textParts,
        },
        status: 'finished_successfully',
        metadata: {},
        recipient: 'all',
        weight: 1.0,
        end_turn: true,
      };

      mapping[msg.id] = {
        id: msg.id,
        message,
        parent: i === 0 ? rootId : validMessages[i - 1].id,
        children: nextMsg ? [nextMsg.id] : [],
      };
    }

    return {
      conversation_id: conversationId,
      title: data.title || 'Untitled Gemini Conversation',
      create_time: createTime,
      update_time: updateTime,
      mapping,
      moderation_results: [],
      current_node: undefined,
      plugin_ids: null,
      conversation_template_id: null,
      _source: 'plugin-gemini',
      _import_date: new Date().toISOString(),
      _original_id: conversationId,
    };
  }

  /**
   * Generic parser for unknown sources
   */
  private parseGeneric(data: PluginConversation, extractedDir: string): Conversation {
    // Try to detect format from message structure
    if (Array.isArray(data.messages)) {
      // Gemini-like array format
      return this.parseGemini(data, extractedDir);
    } else if ((data.messages as PluginClaudeMessages).chat_messages) {
      // Claude-like format
      return this.parseClaude(data, extractedDir);
    } else {
      // Assume ChatGPT-like mapping format
      return this.parseChatGPT(data, extractedDir);
    }
  }

  /**
   * Parse native OpenAI single-conversation export
   * These have the same structure as full exports but just one conversation
   */
  private parseNativeOpenAI(data: Record<string, unknown>, extractedDir: string): Conversation {
    // This is already in OpenAI format with mapping structure
    const mapping = data.mapping as ConversationMapping;
    const conversationId = (data.conversation_id as string) || `openai_single_${crypto.randomUUID().slice(0, 8)}`;

    return {
      conversation_id: conversationId,
      title: (data.title as string) || 'Untitled Conversation',
      create_time: data.create_time as number | undefined,
      update_time: data.update_time as number | undefined,
      mapping: mapping || {},
      moderation_results: (data.moderation_results as unknown[]) || [],
      current_node: data.current_node as string | undefined,
      plugin_ids: data.plugin_ids as string | null,
      conversation_template_id: data.conversation_template_id as string | null,
      _source: 'single-openai',
      _import_date: new Date().toISOString(),
      _original_id: conversationId,
    };
  }

  /**
   * Parse native Claude single-conversation export
   */
  private parseNativeClaude(data: Record<string, unknown>, extractedDir: string): Conversation {
    const chatMessages = data.chat_messages as PluginClaudeChatMessage[] || [];
    const conversationId = (data.uuid as string) || `claude_single_${crypto.randomUUID().slice(0, 8)}`;
    const createTime = data.created_at ? parseISOTimestamp(data.created_at as string) : undefined;
    const updateTime = data.updated_at ? parseISOTimestamp(data.updated_at as string) : undefined;

    // Build mapping from flat message list
    const mapping: ConversationMapping = {};

    // Root node
    const rootId = `${conversationId}_root`;
    mapping[rootId] = {
      id: rootId,
      message: undefined,
      parent: undefined,
      children: chatMessages.length > 0 ? [chatMessages[0].uuid] : [],
    };

    // Convert each message
    for (let i = 0; i < chatMessages.length; i++) {
      const msg = chatMessages[i];
      const nextMsg = chatMessages[i + 1];

      const message: Message = {
        id: msg.uuid,
        author: {
          role: msg.sender === 'human' ? 'user' : 'assistant',
          metadata: {},
        },
        create_time: msg.created_at ? parseISOTimestamp(msg.created_at) : undefined,
        update_time: msg.updated_at ? parseISOTimestamp(msg.updated_at) : undefined,
        content: {
          content_type: 'text',
          parts: [msg.text],
        },
        status: 'finished_successfully',
        metadata: {
          _files: msg.files,
          _attachments: msg.attachments,
        },
        recipient: 'all',
        weight: 1.0,
        end_turn: true,
      };

      mapping[msg.uuid] = {
        id: msg.uuid,
        message,
        parent: i === 0 ? rootId : chatMessages[i - 1].uuid,
        children: nextMsg ? [nextMsg.uuid] : [],
      };
    }

    return {
      conversation_id: conversationId,
      title: (data.name as string) || 'Untitled Claude Conversation',
      create_time: createTime,
      update_time: updateTime,
      mapping,
      moderation_results: [],
      current_node: undefined,
      plugin_ids: null,
      conversation_template_id: null,
      _source: 'single-claude',
      _import_date: new Date().toISOString(),
      _original_id: conversationId,
    };
  }

  /**
   * Detect if a directory contains a browser plugin or single-conversation export
   */
  static async detectFormat(extractedDir: string): Promise<'plugin-chatgpt' | 'plugin-claude' | 'plugin-gemini' | 'single-openai' | null> {
    // Look for conversation.json (singular)
    const candidates = [
      'conversation.json',
      'conversation (1).json',
      'conversation (2).json',
    ];

    let conversationFile: string | null = null;
    for (const name of candidates) {
      const filePath = path.join(extractedDir, name);
      if (fs.existsSync(filePath)) {
        conversationFile = filePath;
        break;
      }
    }

    if (!conversationFile) {
      return null;
    }

    // Check format
    try {
      const content = fs.readFileSync(conversationFile, 'utf-8');
      const data = JSON.parse(content) as Record<string, unknown>;

      // Check for plugin format (has source field)
      if (data.source) {
        const source = (data.source as string).toLowerCase();
        if (source === 'chatgpt') return 'plugin-chatgpt';
        if (source === 'claude') return 'plugin-claude';
        if (source === 'gemini') return 'plugin-gemini';
        // Unknown source but has plugin format
        return 'plugin-chatgpt';
      }

      // Check for native OpenAI single export (has mapping and conversation_id)
      if (data.mapping && data.conversation_id) {
        return 'single-openai';
      }

      // Check for native Claude single export (has chat_messages array)
      if (data.chat_messages && Array.isArray(data.chat_messages)) {
        return 'plugin-claude';
      }
    } catch {
      return null;
    }

    return null;
  }
}
