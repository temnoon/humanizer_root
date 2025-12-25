/**
 * ChatGPT Archive Parser
 *
 * Parses OpenAI ChatGPT export format:
 * - conversations.json: Main conversation data
 * - dalle-generations/: Generated images
 * - user-{id}/: User uploaded files
 * - {uuid}/audio/: Voice messages
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { tokenize } from '@humanizer/core';
import type {
  ParsedArchive,
  Conversation,
  Message,
  MessageAuthor,
  MediaFile,
  ArchiveStats,
} from '../types/index.js';

/**
 * ChatGPT conversations.json structure
 */
interface ChatGPTExport {
  id: string;
  title: string;
  create_time: number;
  update_time: number;
  mapping: Record<string, ChatGPTNode>;
  current_node?: string;
}

interface ChatGPTNode {
  id: string;
  message?: ChatGPTMessage;
  parent?: string;
  children: string[];
}

interface ChatGPTMessage {
  id: string;
  author: { role: string; name?: string };
  create_time?: number;
  content: {
    content_type: string;
    parts?: (string | object)[];
    text?: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Parse a ChatGPT export directory
 */
export async function parseChatGPT(archivePath: string): Promise<ParsedArchive> {
  const conversationsPath = join(archivePath, 'conversations.json');

  if (!existsSync(conversationsPath)) {
    throw new Error(`conversations.json not found in ${archivePath}`);
  }

  // Read and parse conversations
  const raw = readFileSync(conversationsPath, 'utf-8');
  const exports: ChatGPTExport[] = JSON.parse(raw);

  const conversations: Conversation[] = [];
  let totalMessages = 0;
  let userMessages = 0;
  let assistantMessages = 0;
  let totalWords = 0;
  let earliest: Date | undefined;
  let latest: Date | undefined;

  for (const exp of exports) {
    const conv = parseConversation(exp);
    conversations.push(conv);

    totalMessages += conv.messages.length;
    for (const msg of conv.messages) {
      if (msg.author.role === 'user') userMessages++;
      if (msg.author.role === 'assistant') assistantMessages++;
      totalWords += msg.content.split(/\s+/).filter(w => w.length > 0).length;
    }

    if (!earliest || conv.createdAt < earliest) earliest = conv.createdAt;
    if (!latest || conv.updatedAt > latest) latest = conv.updatedAt;
  }

  // Scan for media files
  const media = scanMediaFiles(archivePath);

  const stats: ArchiveStats = {
    conversationCount: conversations.length,
    messageCount: totalMessages,
    userMessageCount: userMessages,
    assistantMessageCount: assistantMessages,
    wordCount: totalWords,
    dateRange: { earliest, latest },
  };

  return {
    type: 'chatgpt',
    sourcePath: archivePath,
    conversations,
    stats,
    media,
  };
}

function parseConversation(exp: ChatGPTExport): Conversation {
  const messages: Message[] = [];

  // Walk the tree to extract messages in order
  const visited = new Set<string>();
  const queue: string[] = [];

  // Find root nodes (no parent or parent not in mapping)
  for (const [id, node] of Object.entries(exp.mapping)) {
    if (!node.parent || !exp.mapping[node.parent]) {
      queue.push(id);
    }
  }

  // BFS to maintain order
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = exp.mapping[nodeId];
    if (!node) continue;

    // Extract message if present
    if (node.message && node.message.content) {
      const msg = parseMessage(node.message, nodeId);
      if (msg && msg.content.trim().length > 0) {
        messages.push(msg);
      }
    }

    // Add children to queue
    for (const childId of node.children || []) {
      queue.push(childId);
    }
  }

  // Sort by timestamp
  messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Tokenize messages into sentences
  for (const msg of messages) {
    if (msg.contentType === 'text') {
      msg.sentences = tokenize(msg.content, {
        source: {
          archiveType: 'chatgpt',
          timestamp: msg.timestamp,
          author: msg.author.role,
        },
      });
    }
  }

  return {
    id: exp.id,
    title: exp.title || 'Untitled',
    source: 'chatgpt',
    createdAt: new Date(exp.create_time * 1000),
    updatedAt: new Date(exp.update_time * 1000),
    messages,
  };
}

function parseMessage(msg: ChatGPTMessage, nodeId: string): Message | null {
  let content = '';
  let contentType: Message['contentType'] = 'text';

  if (msg.content.parts) {
    for (const part of msg.content.parts) {
      if (typeof part === 'string') {
        content += part;
      } else if (typeof part === 'object' && part !== null) {
        // Could be image, code, etc.
        const obj = part as Record<string, unknown>;
        if (obj.content_type === 'image_asset_pointer') {
          contentType = 'image';
        }
      }
    }
  } else if (msg.content.text) {
    content = msg.content.text;
  }

  if (!content.trim()) {
    return null;
  }

  const author: MessageAuthor = {
    role: msg.author.role === 'user' ? 'user' :
          msg.author.role === 'assistant' ? 'assistant' :
          msg.author.role === 'system' ? 'system' : 'other',
    name: msg.author.name,
  };

  return {
    id: msg.id || nodeId,
    author,
    content: content.trim(),
    timestamp: msg.create_time ? new Date(msg.create_time * 1000) : new Date(),
    contentType,
  };
}

function scanMediaFiles(archivePath: string): MediaFile[] {
  const media: MediaFile[] = [];

  // Scan dalle-generations
  const dallePath = join(archivePath, 'dalle-generations');
  if (existsSync(dallePath)) {
    for (const file of readdirSync(dallePath)) {
      const filePath = join(dallePath, file);
      const stat = statSync(filePath);
      if (stat.isFile()) {
        media.push({
          originalPath: filePath,
          type: 'image',
          size: stat.size,
        });
      }
    }
  }

  // Scan for audio folders
  try {
    for (const item of readdirSync(archivePath)) {
      const itemPath = join(archivePath, item);
      const audioPath = join(itemPath, 'audio');
      if (existsSync(audioPath) && statSync(audioPath).isDirectory()) {
        for (const file of readdirSync(audioPath)) {
          const filePath = join(audioPath, file);
          const stat = statSync(filePath);
          if (stat.isFile() && file.endsWith('.wav')) {
            media.push({
              originalPath: filePath,
              type: 'audio',
              size: stat.size,
            });
          }
        }
      }
    }
  } catch {
    // Ignore errors scanning subdirectories
  }

  return media;
}

/**
 * Check if a path looks like a ChatGPT export
 */
export function isChatGPTArchive(path: string): boolean {
  return existsSync(join(path, 'conversations.json'));
}
