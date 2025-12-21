/**
 * Chat Service - AUI Chatbot System
 *
 * Orchestrates conversational AI with:
 * - Multi-provider routing (Ollama, Cloudflare, OpenAI, Anthropic, Groq)
 * - Thread management with localStorage persistence
 * - Context injection from buffer content
 */

import {
  type ChatThread,
  type ChatMessage,
  type ChatOptions,
  type ChatProvider,
  type ChatSendResponse,
  type SerializedChatThread,
  serializeThread,
  deserializeThread,
} from '../types/chat';
import * as ollamaService from './ollamaService';
import { STORAGE_PATHS } from '../config/storage-paths';

// ============================================================
// STORAGE
// ============================================================

const THREADS_STORAGE_KEY = 'narrative-studio-chat-threads';
const API_KEYS_STORAGE_KEY = 'narrative-studio-llm-api-keys';

/**
 * Load all threads from localStorage
 */
export function loadThreads(): ChatThread[] {
  try {
    const stored = localStorage.getItem(THREADS_STORAGE_KEY);
    if (!stored) return [];
    const parsed: SerializedChatThread[] = JSON.parse(stored);
    return parsed.map(deserializeThread);
  } catch (error) {
    console.error('[chatService] Failed to load threads:', error);
    return [];
  }
}

/**
 * Save all threads to localStorage
 */
function saveThreads(threads: ChatThread[]): void {
  try {
    const serialized = threads.map(serializeThread);
    localStorage.setItem(THREADS_STORAGE_KEY, JSON.stringify(serialized));
  } catch (error) {
    console.error('[chatService] Failed to save threads:', error);
  }
}

/**
 * Get a single thread by ID
 */
export function getThread(threadId: string): ChatThread | null {
  const threads = loadThreads();
  return threads.find(t => t.id === threadId) || null;
}

/**
 * Get threads for a specific document
 */
export function getThreadsForDocument(documentId: string | null, documentType: string): ChatThread[] {
  const threads = loadThreads();
  if (documentId === null) {
    return threads.filter(t => t.documentType === 'ephemeral');
  }
  return threads.filter(t => t.documentId === documentId && t.documentType === documentType);
}

// ============================================================
// THREAD MANAGEMENT
// ============================================================

/**
 * Create a new chat thread
 */
export function createThread(
  documentId: string | null,
  documentType: 'book' | 'page' | 'buffer' | 'ephemeral' = 'ephemeral',
  title?: string
): ChatThread {
  const now = new Date();
  const thread: ChatThread = {
    id: crypto.randomUUID(),
    documentId,
    documentType,
    title: title || `Chat ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };

  const threads = loadThreads();
  threads.unshift(thread); // Add at the beginning
  saveThreads(threads);

  console.log('[chatService] Created thread:', thread.id);
  return thread;
}

/**
 * Update a thread's title
 */
export function updateThreadTitle(threadId: string, title: string): ChatThread | null {
  const threads = loadThreads();
  const index = threads.findIndex(t => t.id === threadId);
  if (index === -1) return null;

  threads[index] = {
    ...threads[index],
    title,
    updatedAt: new Date(),
  };

  saveThreads(threads);
  return threads[index];
}

/**
 * Delete a thread
 */
export function deleteThread(threadId: string): boolean {
  const threads = loadThreads();
  const filtered = threads.filter(t => t.id !== threadId);
  if (filtered.length === threads.length) return false;

  saveThreads(filtered);
  console.log('[chatService] Deleted thread:', threadId);
  return true;
}

/**
 * Add a message to a thread
 */
function addMessageToThread(threadId: string, message: ChatMessage): ChatThread | null {
  const threads = loadThreads();
  const index = threads.findIndex(t => t.id === threadId);
  if (index === -1) return null;

  threads[index] = {
    ...threads[index],
    messages: [...threads[index].messages, message],
    updatedAt: new Date(),
  };

  saveThreads(threads);
  return threads[index];
}

// ============================================================
// SYSTEM PROMPT
// ============================================================

/**
 * Build system prompt with optional buffer context
 */
function buildSystemPrompt(bufferContent?: string): string {
  const basePrompt = `You are a helpful AI assistant integrated into Narrative Studio, a writing and content transformation tool.

You help users with:
- Discussing and analyzing their content
- Suggesting improvements and edits
- Answering questions about writing style and structure
- Providing creative feedback

Be conversational, helpful, and concise. When suggesting changes to text, format them clearly.`;

  if (bufferContent && bufferContent.trim()) {
    const truncatedContent = bufferContent.substring(0, 4000);
    const isTruncated = bufferContent.length > 4000;

    return `${basePrompt}

Current document context:
---
${truncatedContent}${isTruncated ? '\n[...content truncated]' : ''}
---

The user may ask questions about this content or request changes. When suggesting edits, be specific about what to change.`;
  }

  return basePrompt;
}

// ============================================================
// PROVIDER ROUTING
// ============================================================

/**
 * Get stored API keys
 */
function getApiKeys(): Record<string, string> {
  try {
    const stored = localStorage.getItem(API_KEYS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Store an API key
 */
export function setApiKey(provider: ChatProvider, key: string): void {
  const keys = getApiKeys();
  keys[provider] = key;
  localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(keys));
}

/**
 * Get an API key
 */
export function getApiKey(provider: ChatProvider): string | null {
  return getApiKeys()[provider] || null;
}

/**
 * Delete an API key
 */
export function deleteApiKey(provider: ChatProvider): void {
  const keys = getApiKeys();
  delete keys[provider];
  localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(keys));
}

/**
 * List providers with configured API keys
 */
export function getConfiguredProviders(): ChatProvider[] {
  const keys = getApiKeys();
  return Object.keys(keys).filter(k => keys[k]) as ChatProvider[];
}

/**
 * Send chat to Ollama (local)
 */
async function sendToOllama(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: ChatOptions
): Promise<string> {
  const model = options.model || 'qwen3:latest';
  return await ollamaService.chat(messages, {
    model,
    temperature: options.temperature ?? 0.7,
  });
}

/**
 * Send chat to Cloudflare Workers AI
 */
async function sendToCloudflare(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: ChatOptions
): Promise<string> {
  const model = options.model || '@cf/meta/llama-3.1-70b-instruct';

  const response = await fetch(`${STORAGE_PATHS.npeApiUrl}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      model,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cloudflare chat failed: ${error}`);
  }

  const data = await response.json();
  return data.response || data.content || '';
}

/**
 * Send chat to OpenAI
 */
async function sendToOpenAI(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: ChatOptions
): Promise<string> {
  const apiKey = getApiKey('openai');
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const model = options.model || 'gpt-4o';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI chat failed: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * Send chat to Anthropic
 */
async function sendToAnthropic(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: ChatOptions
): Promise<string> {
  const apiKey = getApiKey('anthropic');
  if (!apiKey) throw new Error('Anthropic API key not configured');

  const model = options.model || 'claude-sonnet-4-20250514';

  // Anthropic API has a different format - system prompt is separate
  const systemMessage = messages.find(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens ?? 2048,
      system: systemMessage?.content,
      messages: chatMessages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Anthropic chat failed: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.content[0]?.text || '';
}

/**
 * Send chat to Groq
 */
async function sendToGroq(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: ChatOptions
): Promise<string> {
  const apiKey = getApiKey('groq');
  if (!apiKey) throw new Error('Groq API key not configured');

  const model = options.model || 'llama-3.3-70b-versatile';

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Groq chat failed: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

// ============================================================
// MAIN CHAT FUNCTION
// ============================================================

/**
 * Send a message to a chat thread
 * Returns the assistant's response message and updated thread
 */
export async function sendMessage(
  threadId: string,
  content: string,
  options: ChatOptions = {}
): Promise<ChatSendResponse> {
  const startTime = Date.now();
  const provider = options.provider || 'ollama';
  const model = options.model || getDefaultModel(provider);

  // Get or create thread
  let thread = getThread(threadId);
  if (!thread) {
    throw new Error(`Thread not found: ${threadId}`);
  }

  // Create user message
  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    threadId,
    role: 'user',
    content,
    timestamp: new Date(),
  };

  // Add user message to thread
  thread = addMessageToThread(threadId, userMessage)!;

  // Build messages array for LLM
  const systemPrompt = buildSystemPrompt(options.bufferContent);
  const llmMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...thread.messages.slice(-20).map(m => ({ // Keep last 20 messages for context
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  // Route to appropriate provider
  let responseContent: string;

  console.log(`[chatService] Sending to ${provider} with model ${model}`);

  switch (provider) {
    case 'ollama':
      responseContent = await sendToOllama(llmMessages, { ...options, model });
      break;
    case 'cloudflare':
      responseContent = await sendToCloudflare(llmMessages, { ...options, model });
      break;
    case 'openai':
      responseContent = await sendToOpenAI(llmMessages, { ...options, model });
      break;
    case 'anthropic':
      responseContent = await sendToAnthropic(llmMessages, { ...options, model });
      break;
    case 'groq':
      responseContent = await sendToGroq(llmMessages, { ...options, model });
      break;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }

  const processingTimeMs = Date.now() - startTime;

  // Create assistant message
  const assistantMessage: ChatMessage = {
    id: crypto.randomUUID(),
    threadId,
    role: 'assistant',
    content: responseContent,
    timestamp: new Date(),
    metadata: {
      model,
      provider,
      processingTimeMs,
      bufferContext: options.includeBufferContext ? options.bufferContent?.substring(0, 500) : undefined,
    },
  };

  // Add assistant message to thread
  thread = addMessageToThread(threadId, assistantMessage)!;

  console.log(`[chatService] Response received in ${processingTimeMs}ms`);

  return {
    message: assistantMessage,
    thread,
  };
}

/**
 * Get default model for a provider
 */
export function getDefaultModel(provider: ChatProvider): string {
  const defaults: Record<ChatProvider, string> = {
    ollama: 'qwen3:latest',
    cloudflare: '@cf/meta/llama-3.1-70b-instruct',
    openai: 'gpt-4o',
    anthropic: 'claude-sonnet-4-20250514',
    groq: 'llama-3.3-70b-versatile',
  };
  return defaults[provider];
}

/**
 * Get available models for a provider
 */
export function getModelsForProvider(provider: ChatProvider): Array<{ id: string; name: string }> {
  const models: Record<ChatProvider, Array<{ id: string; name: string }>> = {
    ollama: [
      { id: 'qwen3:latest', name: 'Qwen 3 (Latest)' },
      { id: 'llama3.2:3b', name: 'Llama 3.2 3B' },
      { id: 'llama3.2:latest', name: 'Llama 3.2 (Latest)' },
      { id: 'mistral:latest', name: 'Mistral (Latest)' },
    ],
    cloudflare: [
      { id: '@cf/meta/llama-3.1-70b-instruct', name: 'Llama 3.1 70B' },
      { id: '@cf/meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B' },
      { id: '@cf/openai/gpt-oss-120b', name: 'GPT-OSS 120B' },
    ],
    openai: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    ],
    anthropic: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
    ],
    groq: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
      { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
    ],
  };
  return models[provider] || [];
}

/**
 * Get display name for a provider
 */
export function getProviderDisplayName(provider: ChatProvider): string {
  const names: Record<ChatProvider, string> = {
    ollama: 'Ollama (Local)',
    cloudflare: 'Cloudflare AI',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    groq: 'Groq',
  };
  return names[provider];
}
