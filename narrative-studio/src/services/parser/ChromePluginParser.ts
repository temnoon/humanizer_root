// ============================================================
// CHROME PLUGIN EXPORT PARSER
// ============================================================
// Parses conversation exports from the Chrome browser plugin
// Supports ChatGPT, Claude, and Gemini exports
// Format: folder/conversation.json + folder/media/file_N.ext
//
// Two message formats are supported:
// 1. ChatGPT: messages is an object with tree structure (parent/children)
// 2. Claude/Gemini: messages is an array with linear structure

import * as path from 'path';
import * as fs from 'fs';
import type { Conversation, ExportFormat, ConversationNode, Message } from './types';
import { readJSON, findFiles } from './utils';

export type ChromePluginSource = 'ChatGPT' | 'Claude' | 'Gemini';

// ChatGPT format: messages as object with tree structure
interface ChatGPTMessage {
  id: string;
  message: {
    id: string;
    author: {
      role: 'user' | 'assistant' | 'system' | 'tool';
      name?: string;
      metadata?: Record<string, any>;
    };
    create_time?: number;
    update_time?: number;
    content: {
      content_type: string;
      parts?: any[];
      text?: string;
      thoughts?: any[];
      language?: string;
    };
    status?: string;
    end_turn?: boolean;
    weight?: number;
    metadata?: Record<string, any>;
    recipient?: string;
    channel?: string;
  } | null;
  parent: string | null;
  children: string[];
}

// Claude/Gemini format: messages as array with linear structure
interface LinearMessage {
  id: string;
  role: 'user' | 'model' | 'assistant' | 'system';
  content: {
    parts: Array<{ text?: string; [key: string]: any }>;
  };
  timestamp?: number;
}

interface ChromePluginConversation {
  title: string;
  source: ChromePluginSource;
  messages: Record<string, ChatGPTMessage> | LinearMessage[];
}

export class ChromePluginParser {
  private mediaFileMap: Map<string, string> = new Map(); // asset_pointer -> local path

  /**
   * Parse a Chrome plugin export (folder or zip contents)
   */
  async parseConversations(extractedDir: string): Promise<Conversation[]> {
    const conversations: Conversation[] = [];
    const conversationFiles = this.findConversationFiles(extractedDir);

    console.log(`[ChromePluginParser] Found ${conversationFiles.length} conversation.json files`);

    for (const filePath of conversationFiles) {
      try {
        const data = readJSON<ChromePluginConversation>(filePath);
        if (!data || !data.source || !data.messages) {
          continue;
        }

        // Index media files for this conversation
        const mediaDir = path.join(path.dirname(filePath), 'media');
        this.indexMediaFiles(mediaDir);

        // Detect format and parse accordingly
        const isArrayFormat = Array.isArray(data.messages);
        const conversation = isArrayFormat
          ? this.normalizeLinearConversation(data as { title: string; source: ChromePluginSource; messages: LinearMessage[] }, filePath)
          : this.normalizeTreeConversation(data as { title: string; source: ChromePluginSource; messages: Record<string, ChatGPTMessage> }, filePath);

        conversations.push(conversation);

        const nodeCount = isArrayFormat
          ? (data.messages as LinearMessage[]).length
          : Object.keys(data.messages).length;
        console.log(`[ChromePluginParser] Parsed "${data.title}" (${data.source}) - ${nodeCount} ${isArrayFormat ? 'messages' : 'nodes'}`);
      } catch (err) {
        console.error(`[ChromePluginParser] Failed to parse ${filePath}:`, err);
      }
    }

    return conversations;
  }

  /**
   * Find conversation.json files that match Chrome plugin format
   */
  private findConversationFiles(extractedDir: string): string[] {
    const allFiles = findFiles(extractedDir, /conversation\.json$/i);

    // Filter to only files that look like Chrome plugin exports
    return allFiles.filter(filePath => {
      try {
        const data = readJSON<any>(filePath);
        return this.isChromePluginFormat(data);
      } catch {
        return false;
      }
    });
  }

  /**
   * Check if data matches Chrome plugin format
   */
  private isChromePluginFormat(data: any): boolean {
    if (!data) return false;

    // Chrome plugin exports have:
    // 1. `source` field with provider name
    // 2. `messages` as either an object (ChatGPT) or array (Claude/Gemini)
    const hasSource = typeof data.source === 'string' &&
      ['ChatGPT', 'Claude', 'Gemini'].includes(data.source);
    const hasMessages = data.messages !== undefined;

    if (!hasSource || !hasMessages) return false;

    // Check for array format (Claude/Gemini)
    if (Array.isArray(data.messages)) {
      if (data.messages.length === 0) return true; // Empty array is valid
      const first = data.messages[0];
      return first && 'role' in first && 'content' in first;
    }

    // Check for object format (ChatGPT)
    if (typeof data.messages === 'object') {
      const firstKey = Object.keys(data.messages)[0];
      if (!firstKey) return true; // Empty object is valid
      const first = data.messages[firstKey];
      return first && 'parent' in first && 'children' in first;
    }

    return false;
  }

  /**
   * Index media files in the media directory
   * Creates mapping from file-service:// URLs to local paths
   */
  private indexMediaFiles(mediaDir: string): void {
    this.mediaFileMap.clear();

    if (!fs.existsSync(mediaDir)) {
      return;
    }

    try {
      const files = fs.readdirSync(mediaDir);
      // Files are named file_0.jpg, file_1.jpg, etc.
      files.forEach(filename => {
        const match = filename.match(/^file_(\d+)\.\w+$/);
        if (match) {
          const index = parseInt(match[1], 10);
          const fullPath = path.join(mediaDir, filename);
          // We'll map by index and also store the path
          this.mediaFileMap.set(`file_${index}`, fullPath);
        }
      });

      if (this.mediaFileMap.size > 0) {
        console.log(`[ChromePluginParser] Indexed ${this.mediaFileMap.size} media files`);
      }
    } catch (err) {
      console.warn(`[ChromePluginParser] Failed to index media files:`, err);
    }
  }

  /**
   * Consolidate streaming fragments into complete messages.
   * Gemini exports include BOTH the complete response AND streaming chunks.
   * We detect and skip chunks that are duplicates/subsets of previous content.
   */
  private consolidateStreamingFragments(messages: LinearMessage[]): LinearMessage[] {
    if (messages.length === 0) return messages;

    const consolidated: LinearMessage[] = [];
    const seenTexts: string[] = [];

    for (const msg of messages) {
      const msgText = msg.content?.parts
        ?.map(part => part.text || (typeof part === 'string' ? part : ''))
        .filter(Boolean)
        .join('\n')
        .trim() || '';

      if (!msgText) continue;

      // Skip if this text is contained in any previous longer message
      let isDuplicate = false;
      for (const prevText of seenTexts) {
        if (prevText.includes(msgText) || prevText.startsWith(msgText)) {
          isDuplicate = true;
          break;
        }
      }

      if (isDuplicate) continue;

      // Check if this supersedes a previous shorter message
      // Remove any previous messages that are subsets of this one
      const newSeenTexts: string[] = [msgText];
      const indicesToKeep: number[] = [];

      for (let i = 0; i < consolidated.length; i++) {
        const prevText = seenTexts[i];
        if (!msgText.includes(prevText) && !msgText.startsWith(prevText)) {
          indicesToKeep.push(i);
          newSeenTexts.push(prevText);
        }
      }

      // Rebuild consolidated array if we removed any
      if (indicesToKeep.length < consolidated.length) {
        const newConsolidated = indicesToKeep.map(i => consolidated[i]);
        consolidated.length = 0;
        consolidated.push(...newConsolidated);
        seenTexts.length = 0;
        seenTexts.push(...newSeenTexts.slice(1)); // Skip the current one, add at end
      }

      // Add this message
      consolidated.push({
        ...msg,
        content: { parts: [{ text: msgText }] }
      });
      seenTexts.push(msgText);
    }

    console.log(`[ChromePluginParser] Deduplicated ${messages.length} fragments → ${consolidated.length} messages`);
    return consolidated;
  }

  /**
   * Infer user vs assistant roles for messages.
   * The Chrome plugin marks ALL messages as "model" regardless of actual author.
   * We use heuristics to detect the actual role:
   * 1. Alternating pattern (user, assistant, user, assistant...)
   * 2. Content analysis (short prompts vs long responses)
   */
  private inferMessageRoles(messages: LinearMessage[]): LinearMessage[] {
    if (messages.length === 0) return messages;

    // Heuristic patterns for user messages
    const userPatterns = [
      /^(yes|no|ok|okay|sure|proceed|continue|go ahead)/i,
      /^please\b/i,
      /\?$/,  // Ends with question mark
      /^(I would like|I want|can you|could you|please|let's)/i,
      /^(attached|here is|this is)/i,  // User providing context
    ];

    // Heuristic patterns for assistant messages
    const assistantPatterns = [
      /^(here is the text|I have reviewed|I propose|I'll|I will|Let me)/i,
      /^(Module [IVX]+|Chapter|Section)/i,
      /^#{1,3}\s/,  // Markdown headers
    ];

    // Detect if first message is likely a user message
    const firstText = messages[0]?.content?.parts?.[0]?.text || '';
    const firstIsUser =
      firstText.length < 1000 || // Short messages are likely user
      userPatterns.some(p => p.test(firstText)) ||
      !assistantPatterns.some(p => p.test(firstText));

    // Apply alternating roles
    return messages.map((msg, index) => {
      const text = msg.content?.parts?.[0]?.text || '';

      // Skip system messages (e.g., "Gemini can make mistakes")
      if (text.includes('can make mistakes') || text.includes('double-check')) {
        return { ...msg, role: 'system' as const };
      }

      // Determine role based on position and heuristics
      let inferredRole: 'user' | 'model';

      // Primary: alternating pattern
      const shouldBeUser = firstIsUser ? (index % 2 === 0) : (index % 2 === 1);

      // Secondary: content-based override for clear cases
      const clearlyUser = text.length < 200 && userPatterns.some(p => p.test(text));
      const clearlyAssistant = text.length > 2000 || assistantPatterns.some(p => p.test(text));

      if (clearlyUser && !clearlyAssistant) {
        inferredRole = 'user';
      } else if (clearlyAssistant && !clearlyUser) {
        inferredRole = 'model';
      } else {
        inferredRole = shouldBeUser ? 'user' : 'model';
      }

      return { ...msg, role: inferredRole };
    });
  }

  /**
   * Normalize Claude/Gemini linear array format to standard format
   */
  private normalizeLinearConversation(
    data: { title: string; source: ChromePluginSource; messages: LinearMessage[] },
    filePath: string
  ): Conversation {
    const mapping: Record<string, ConversationNode> = {};
    let firstTimestamp: number | null = null;
    let lastTimestamp: number | null = null;

    // Consolidate streaming fragments before processing
    const consolidatedMessages = this.consolidateStreamingFragments(data.messages);

    // Infer user vs assistant roles (Chrome plugin marks everything as "model")
    const messagesWithRoles = this.inferMessageRoles(consolidatedMessages);
    console.log(`[ChromePluginParser] Inferred roles for ${messagesWithRoles.length} messages`);

    // Create a root node
    const rootId = 'root';
    mapping[rootId] = {
      id: rootId,
      message: undefined,
      parent: undefined,
      children: [],
    };

    let previousNodeId = rootId;

    // Convert linear messages to tree structure
    for (let i = 0; i < messagesWithRoles.length; i++) {
      const msg = messagesWithRoles[i];
      const nodeId = msg.id || `msg_${i}`;

      // Track timestamps (convert from milliseconds if needed)
      const timestamp = msg.timestamp
        ? (msg.timestamp > 10000000000 ? Math.floor(msg.timestamp / 1000) : msg.timestamp)
        : undefined;

      if (timestamp) {
        if (firstTimestamp === null || timestamp < firstTimestamp) {
          firstTimestamp = timestamp;
        }
        if (lastTimestamp === null || timestamp > lastTimestamp) {
          lastTimestamp = timestamp;
        }
      }

      // Extract text content from parts
      const textContent = msg.content?.parts
        ?.map(part => part.text || (typeof part === 'string' ? part : ''))
        .filter(Boolean)
        .join('\n') || '';

      // Map role: "model" -> "assistant"
      const role = msg.role === 'model' ? 'assistant' : msg.role;

      const message: Message = {
        id: nodeId,
        author: {
          role: role as 'user' | 'assistant' | 'system' | 'tool',
          metadata: {},
        },
        create_time: timestamp,
        content: {
          content_type: 'text',
          parts: [textContent],
        },
        status: 'finished_successfully',
        metadata: {},
        recipient: 'all',
        weight: 1,
        end_turn: true,
      };

      mapping[nodeId] = {
        id: nodeId,
        message,
        parent: previousNodeId,
        children: [],
      };

      // Update parent's children
      mapping[previousNodeId].children.push(nodeId);
      previousNodeId = nodeId;
    }

    // Map source to our export format
    const sourceMap: Record<ChromePluginSource, ExportFormat> = {
      'ChatGPT': 'openai',
      'Claude': 'claude',
      'Gemini': 'openai', // Treat Gemini as openai-like for now
    };

    const conversation: Conversation = {
      conversation_id: rootId,
      id: rootId,
      title: data.title || 'Untitled Conversation',
      create_time: firstTimestamp || Math.floor(Date.now() / 1000),
      update_time: lastTimestamp || Math.floor(Date.now() / 1000),
      mapping,
      moderation_results: [],
      current_node: previousNodeId, // Last message
      plugin_ids: null,
      conversation_template_id: null,

      // Extended metadata
      _source: sourceMap[data.source] || 'unknown',
      _import_date: new Date().toISOString(),
      _original_id: rootId,
      _media_files: Array.from(this.mediaFileMap.values()),
    };

    return conversation;
  }

  /**
   * Normalize ChatGPT tree format to standard format
   */
  private normalizeTreeConversation(
    data: { title: string; source: ChromePluginSource; messages: Record<string, ChatGPTMessage> },
    filePath: string
  ): Conversation {
    // Find root node and build the tree
    const mapping: Record<string, ConversationNode> = {};
    let rootId: string | null = null;
    let firstTimestamp: number | null = null;
    let lastTimestamp: number | null = null;

    // Convert messages to mapping format
    for (const [nodeId, node] of Object.entries(data.messages)) {
      if (node.parent === null && node.message === null) {
        rootId = nodeId;
      }

      const message = node.message ? this.normalizeMessage(node.message) : undefined;

      // Track timestamps
      if (message?.create_time) {
        if (firstTimestamp === null || message.create_time < firstTimestamp) {
          firstTimestamp = message.create_time;
        }
        if (lastTimestamp === null || message.create_time > lastTimestamp) {
          lastTimestamp = message.create_time;
        }
      }

      mapping[nodeId] = {
        id: nodeId,
        message,
        parent: node.parent || undefined,
        children: node.children || [],
      };
    }

    // Find current_node (the last message in the main branch)
    let currentNode = rootId;
    if (rootId && mapping[rootId]) {
      let node = mapping[rootId];
      while (node.children && node.children.length > 0) {
        // Follow the first child (main branch)
        const nextId = node.children[0];
        if (mapping[nextId]) {
          currentNode = nextId;
          node = mapping[nextId];
        } else {
          break;
        }
      }
    }

    // Map source to our export format
    const sourceMap: Record<ChromePluginSource, ExportFormat> = {
      'ChatGPT': 'openai',
      'Claude': 'claude',
      'Gemini': 'openai',
    };

    const conversation: Conversation = {
      conversation_id: rootId || `chrome-${Date.now()}`,
      id: rootId || `chrome-${Date.now()}`,
      title: data.title || 'Untitled Conversation',
      create_time: firstTimestamp || Math.floor(Date.now() / 1000),
      update_time: lastTimestamp || Math.floor(Date.now() / 1000),
      mapping,
      moderation_results: [],
      current_node: currentNode || undefined,
      plugin_ids: null,
      conversation_template_id: null,

      // Extended metadata
      _source: sourceMap[data.source] || 'unknown',
      _import_date: new Date().toISOString(),
      _original_id: rootId,
      _media_files: Array.from(this.mediaFileMap.values()),
    };

    return conversation;
  }

  /**
   * Normalize a message from ChatGPT tree format
   */
  private normalizeMessage(msg: ChatGPTMessage['message']): Message | undefined {
    if (!msg) return undefined;

    // Skip system messages that are hidden
    if (msg.metadata?.is_visually_hidden_from_conversation) {
      return undefined;
    }

    // Process content based on type
    let content = msg.content;

    // Handle multimodal content with images
    if (content.content_type === 'multimodal_text' && Array.isArray(content.parts)) {
      content = {
        ...content,
        parts: content.parts.map((part: any) => {
          if (typeof part === 'string') return part;
          if (part.content_type === 'image_asset_pointer') {
            // Convert asset pointer to local file reference
            return this.resolveImageReference(part);
          }
          return JSON.stringify(part);
        }),
      };
    }

    // Handle thoughts/reasoning content
    if (content.content_type === 'thoughts') {
      content = {
        content_type: 'text',
        parts: ['[Thinking...]'],
      };
    }

    return {
      id: msg.id,
      author: {
        role: msg.author.role,
        name: msg.author.name,
        metadata: msg.author.metadata || {},
      },
      create_time: msg.create_time,
      update_time: msg.update_time,
      content: content as any,
      status: msg.status,
      metadata: msg.metadata || {},
      recipient: msg.recipient,
      weight: msg.weight,
      end_turn: msg.end_turn,
    };
  }

  /**
   * Resolve image asset pointer to local file reference
   */
  private resolveImageReference(part: any): string {
    const assetPointer = part.asset_pointer;
    const dalleMetadata = part.metadata?.dalle;

    // For now, return a markdown image reference with metadata
    let result = `![Image](${assetPointer})`;

    if (dalleMetadata?.prompt) {
      result += `\n\n*DALL-E Prompt: ${dalleMetadata.prompt}*`;
    }

    return result;
  }

  /**
   * Detect if a directory contains Chrome plugin export format
   */
  static async detectFormat(extractedDir: string): Promise<boolean> {
    const conversationFiles = findFiles(extractedDir, /conversation\.json$/i);

    if (conversationFiles.length === 0) {
      return false;
    }

    // Check first file for Chrome plugin structure
    try {
      const data = readJSON<any>(conversationFiles[0]);
      if (!data) return false;

      // Chrome plugin exports have `source` field with provider name
      const hasSource = typeof data.source === 'string' &&
        ['ChatGPT', 'Claude', 'Gemini'].includes(data.source);

      if (!hasSource) return false;

      // Check for array format (Claude/Gemini)
      if (Array.isArray(data.messages)) {
        if (data.messages.length === 0) return true;
        const first = data.messages[0];
        return first && 'role' in first && 'content' in first;
      }

      // Check for object format (ChatGPT)
      if (data.messages && typeof data.messages === 'object') {
        const firstKey = Object.keys(data.messages)[0];
        if (!firstKey) return true;
        const first = data.messages[firstKey];
        return first && 'parent' in first && 'children' in first;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Get the source type from a conversation file
   */
  static getSourceType(filePath: string): ChromePluginSource | null {
    try {
      const data = readJSON<any>(filePath);
      if (data?.source && ['ChatGPT', 'Claude', 'Gemini'].includes(data.source)) {
        return data.source as ChromePluginSource;
      }
    } catch {
      // Ignore errors
    }
    return null;
  }
}
