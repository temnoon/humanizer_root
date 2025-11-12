/**
 * Conversation Parser - Extract metadata from ChatGPT and Claude conversation exports
 *
 * Supports:
 * - ChatGPT conversation.json format
 * - Claude conversation.json format (via openai_export_parser)
 *
 * Extracts:
 * - Title
 * - Date (created/updated)
 * - Message count
 * - Provider (chatgpt/claude)
 * - First/last messages
 */

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  attachments?: Array<{
    type: string;
    url?: string;
    filename?: string;
  }>;
}

export interface ConversationMetadata {
  provider: 'chatgpt' | 'claude' | 'unknown';
  title: string;
  conversationId?: string;
  created_at?: number;
  updated_at?: number;
  message_count: number;
  has_images: boolean;
  has_code: boolean;
  first_message?: string; // Preview
  model?: string;
}

export interface ParsedConversation {
  metadata: ConversationMetadata;
  messages: ConversationMessage[];
  raw: any; // Original JSON
}

/**
 * Detect conversation provider from JSON structure
 */
function detectProvider(data: any): 'chatgpt' | 'claude' | 'unknown' {
  // ChatGPT format: has "mapping" object with node structure
  if (data.mapping && typeof data.mapping === 'object') {
    return 'chatgpt';
  }

  // Claude format (via parser): has "conversations" array or direct message list
  if (data.type === 'claude' || data.provider === 'claude') {
    return 'claude';
  }

  // Check for direct messages array (could be either)
  if (Array.isArray(data.messages)) {
    return 'unknown'; // Will try both parsers
  }

  return 'unknown';
}

/**
 * Parse ChatGPT conversation export
 * Format: { mapping: { [nodeId]: { message: {...}, children: [...] } } }
 */
function parseChatGPTConversation(data: any): ParsedConversation {
  const metadata: ConversationMetadata = {
    provider: 'chatgpt',
    title: data.title || 'Untitled Conversation',
    conversationId: data.id || data.conversation_id,
    created_at: data.create_time ? data.create_time * 1000 : undefined,
    updated_at: data.update_time ? data.update_time * 1000 : undefined,
    message_count: 0,
    has_images: false,
    has_code: false,
    model: data.model,
  };

  const messages: ConversationMessage[] = [];

  // Build message tree from mapping
  const mapping = data.mapping || {};
  const nodes = Object.values(mapping) as any[];

  // Sort nodes by creation time
  const sortedNodes = nodes
    .filter((node) => node.message && node.message.content)
    .sort((a, b) => {
      const timeA = a.message?.create_time || 0;
      const timeB = b.message?.create_time || 0;
      return timeA - timeB;
    });

  for (const node of sortedNodes) {
    const msg = node.message;
    if (!msg || !msg.content) continue;

    // Extract text content
    const contentParts = msg.content.parts || [];
    const textContent = contentParts
      .filter((p: any) => typeof p === 'string')
      .join('\n');

    if (!textContent.trim()) continue;

    const role = msg.author?.role || 'user';

    messages.push({
      role: role === 'user' ? 'user' : 'assistant',
      content: textContent,
      timestamp: msg.create_time ? msg.create_time * 1000 : undefined,
    });

    // Check for images/code
    if (textContent.includes('![') || textContent.includes('<img')) {
      metadata.has_images = true;
    }
    if (textContent.includes('```')) {
      metadata.has_code = true;
    }
  }

  metadata.message_count = messages.length;
  metadata.first_message = messages[0]?.content.substring(0, 100);

  return { metadata, messages, raw: data };
}

/**
 * Parse Claude conversation export (via openai_export_parser)
 * Format varies - could be direct messages or nested structure
 */
function parseClaudeConversation(data: any): ParsedConversation {
  const metadata: ConversationMetadata = {
    provider: 'claude',
    title: data.title || data.name || 'Untitled Conversation',
    conversationId: data.uuid || data.id,
    created_at: data.created_at ? new Date(data.created_at).getTime() : undefined,
    updated_at: data.updated_at ? new Date(data.updated_at).getTime() : undefined,
    message_count: 0,
    has_images: false,
    has_code: false,
    model: data.model,
  };

  const messages: ConversationMessage[] = [];

  // Find messages array (could be in different locations)
  let msgArray: any[] = [];
  if (Array.isArray(data.messages)) {
    msgArray = data.messages;
  } else if (Array.isArray(data.chat_messages)) {
    msgArray = data.chat_messages;
  } else if (data.conversation?.messages) {
    msgArray = data.conversation.messages;
  }

  for (const msg of msgArray) {
    const role = msg.sender || msg.role || 'user';
    const content = msg.text || msg.content || '';

    if (!content.trim()) continue;

    messages.push({
      role: role === 'human' || role === 'user' ? 'user' : 'assistant',
      content,
      timestamp: msg.created_at ? new Date(msg.created_at).getTime() : undefined,
      attachments: msg.attachments,
    });

    // Check for images/code
    if (content.includes('![') || content.includes('<img') || msg.attachments?.some((a: any) => a.type === 'image')) {
      metadata.has_images = true;
    }
    if (content.includes('```')) {
      metadata.has_code = true;
    }
  }

  metadata.message_count = messages.length;
  metadata.first_message = messages[0]?.content.substring(0, 100);

  return { metadata, messages, raw: data };
}

/**
 * Main entry point: Parse conversation JSON
 */
export function parseConversation(jsonData: any): ParsedConversation {
  const provider = detectProvider(jsonData);

  try {
    if (provider === 'chatgpt') {
      return parseChatGPTConversation(jsonData);
    } else if (provider === 'claude') {
      return parseClaudeConversation(jsonData);
    } else {
      // Try ChatGPT format first, then Claude
      try {
        return parseChatGPTConversation(jsonData);
      } catch {
        return parseClaudeConversation(jsonData);
      }
    }
  } catch (error) {
    console.error('Failed to parse conversation:', error);

    // Return minimal metadata
    return {
      metadata: {
        provider: 'unknown',
        title: 'Unknown Format',
        message_count: 0,
        has_images: false,
        has_code: false,
      },
      messages: [],
      raw: jsonData,
    };
  }
}

/**
 * Check if file content looks like a conversation JSON
 */
export function isConversationJSON(content: string): boolean {
  try {
    const data = JSON.parse(content);

    // Check for ChatGPT structure
    if (data.mapping && typeof data.mapping === 'object') {
      return true;
    }

    // Check for messages array
    if (Array.isArray(data.messages) || Array.isArray(data.chat_messages)) {
      return true;
    }

    // Check for conversation object
    if (data.conversation && data.conversation.messages) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
