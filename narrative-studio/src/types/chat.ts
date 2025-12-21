/**
 * Chat Types - AUI Chatbot System
 *
 * Types for conversational AI interface with:
 * - Per-document chat threads
 * - Multi-provider LLM support
 * - Context injection from buffer
 */

/**
 * A chat thread associated with a document (book, page, or buffer)
 */
export interface ChatThread {
  id: string;
  documentId: string | null;     // book_id, page_id, or null for ephemeral
  documentType: 'book' | 'page' | 'buffer' | 'ephemeral';
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A single message in a chat thread
 */
export interface ChatMessage {
  id: string;
  threadId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: ChatMessageMetadata;
}

/**
 * Metadata attached to chat messages
 */
export interface ChatMessageMetadata {
  model?: string;
  provider?: ChatProvider;
  bufferContext?: string;        // Snapshot of buffer when message sent
  tokensUsed?: number;
  processingTimeMs?: number;
}

/**
 * Supported chat providers
 */
export type ChatProvider = 'ollama' | 'cloudflare' | 'openai' | 'anthropic' | 'groq';

/**
 * Options for sending a chat message
 */
export interface ChatOptions {
  provider?: ChatProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  includeBufferContext?: boolean;
  bufferContent?: string;
}

/**
 * Provider configuration for chat
 */
export interface ChatProviderConfig {
  provider: ChatProvider;
  model: string;
  apiKey?: string;               // Required for openai, anthropic, groq
  isAvailable: boolean;
  displayName: string;
}

/**
 * Response from sending a chat message
 */
export interface ChatSendResponse {
  message: ChatMessage;
  thread: ChatThread;
}

/**
 * State for the chat tool in ToolTabContext
 */
export interface ChatToolState {
  activeThreadId: string | null;
  selectedProvider: ChatProvider;
  selectedModel: string;
  isStreaming: boolean;
}

/**
 * Serialized thread for localStorage/D1 storage
 */
export interface SerializedChatThread {
  id: string;
  documentId: string | null;
  documentType: 'book' | 'page' | 'buffer' | 'ephemeral';
  title: string;
  messages: SerializedChatMessage[];
  createdAt: string;             // ISO string
  updatedAt: string;             // ISO string
}

/**
 * Serialized message for storage
 */
export interface SerializedChatMessage {
  id: string;
  threadId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;             // ISO string
  metadata?: ChatMessageMetadata;
}

/**
 * Helper to serialize a thread for storage
 */
export function serializeThread(thread: ChatThread): SerializedChatThread {
  return {
    ...thread,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
    messages: thread.messages.map(serializeMessage),
  };
}

/**
 * Helper to serialize a message for storage
 */
export function serializeMessage(message: ChatMessage): SerializedChatMessage {
  return {
    ...message,
    timestamp: message.timestamp.toISOString(),
  };
}

/**
 * Helper to deserialize a thread from storage
 */
export function deserializeThread(data: SerializedChatThread): ChatThread {
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
    messages: data.messages.map(deserializeMessage),
  };
}

/**
 * Helper to deserialize a message from storage
 */
export function deserializeMessage(data: SerializedChatMessage): ChatMessage {
  return {
    ...data,
    timestamp: new Date(data.timestamp),
  };
}
