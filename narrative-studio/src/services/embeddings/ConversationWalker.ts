/**
 * ConversationWalker - Extract messages from OpenAI conversation tree
 *
 * OpenAI exports conversations in a tree structure (mapping) rather than
 * a linear array. This walker traverses the tree to extract linearized
 * message sequences for embedding.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  OpenAIConversation,
  OpenAIMappingNode,
  Message,
  Conversation,
} from './types.js';

export interface ExtractedConversation {
  conversation: Omit<Conversation, 'isInteresting' | 'summary' | 'summaryEmbeddingId'>;
  messages: Omit<Message, 'embeddingId'>[];
}

export interface WalkOptions {
  /** Only include messages with these roles (default: all) */
  roles?: Array<'user' | 'assistant' | 'system' | 'tool'>;
  /** Minimum content length to include (default: 10) */
  minContentLength?: number;
  /** Maximum content length before truncating (default: no limit) */
  maxContentLength?: number;
}

const DEFAULT_OPTIONS: WalkOptions = {
  minContentLength: 10,
};

/**
 * Walk an archive directory and extract all conversations
 */
export async function* walkArchive(
  archivePath: string,
  options: WalkOptions = {}
): AsyncGenerator<ExtractedConversation> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const entries = await fs.readdir(archivePath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;  // Skip hidden folders

    const conversationPath = path.join(archivePath, entry.name, 'conversation.json');

    try {
      const content = await fs.readFile(conversationPath, 'utf-8');
      const conversation = JSON.parse(content) as OpenAIConversation;

      const extracted = extractConversation(conversation, entry.name, opts);
      if (extracted.messages.length > 0) {
        yield extracted;
      }
    } catch (err) {
      // Skip folders without valid conversation.json
      continue;
    }
  }
}

/**
 * Extract messages from a single conversation
 */
export function extractConversation(
  conversation: OpenAIConversation,
  folder: string,
  options: WalkOptions = {}
): ExtractedConversation {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const messages: Omit<Message, 'embeddingId'>[] = [];

  // Find the linear path from root to current_node
  const linearPath = findLinearPath(conversation.mapping, conversation.current_node);

  // Extract messages along the path
  let tokenTotal = 0;
  for (const nodeId of linearPath) {
    const node = conversation.mapping[nodeId];
    if (!node?.message) continue;

    const role = node.message.author.role;

    // Filter by role if specified
    if (opts.roles && !opts.roles.includes(role)) continue;

    // Extract content
    let content = extractContent(node.message.content);
    if (!content) continue;

    // Apply length filters
    if (opts.minContentLength && content.length < opts.minContentLength) continue;
    if (opts.maxContentLength && content.length > opts.maxContentLength) {
      content = content.substring(0, opts.maxContentLength) + '...';
    }

    // Estimate tokens (rough: ~4 chars per token)
    const tokenCount = Math.ceil(content.length / 4);
    tokenTotal += tokenCount;

    messages.push({
      id: node.message.id,
      conversationId: conversation.id || conversation.conversation_id,
      parentId: node.parent,
      role,
      content,
      createdAt: node.message.create_time || conversation.create_time,
      tokenCount,
    });
  }

  return {
    conversation: {
      id: conversation.id || conversation.conversation_id,
      folder,
      title: conversation.title || folder,
      createdAt: conversation.create_time,
      updatedAt: conversation.update_time,
      messageCount: messages.length,
      totalTokens: tokenTotal,
    },
    messages,
  };
}

/**
 * Find the linear path from root to the current node
 */
function findLinearPath(
  mapping: Record<string, OpenAIMappingNode>,
  currentNode: string
): string[] {
  // Build parent -> children map and find root
  let root: string | null = null;

  for (const [id, node] of Object.entries(mapping)) {
    if (node.parent === null) {
      root = id;
      break;
    }
  }

  if (!root) return [];

  // Walk from root to current node following first child (main branch)
  // This gives us the canonical path
  const path: string[] = [];
  let current: string | null = root;

  while (current) {
    path.push(current);
    const node = mapping[current];

    if (current === currentNode) break;

    // Follow to next node
    if (node.children && node.children.length > 0) {
      // Prefer the path that leads to currentNode
      const nextNode = findPathToTarget(mapping, node.children, currentNode);
      current = nextNode;
    } else {
      break;
    }
  }

  return path;
}

/**
 * Find which child leads to the target node
 */
function findPathToTarget(
  mapping: Record<string, OpenAIMappingNode>,
  children: string[],
  target: string
): string | null {
  // Check if any child is the target
  if (children.includes(target)) return target;

  // DFS to find path to target
  for (const child of children) {
    if (canReach(mapping, child, target)) {
      return child;
    }
  }

  // Default to first child if target not reachable
  return children[0] || null;
}

/**
 * Check if target is reachable from start
 */
function canReach(
  mapping: Record<string, OpenAIMappingNode>,
  start: string,
  target: string,
  visited: Set<string> = new Set()
): boolean {
  if (start === target) return true;
  if (visited.has(start)) return false;

  visited.add(start);
  const node = mapping[start];
  if (!node?.children) return false;

  for (const child of node.children) {
    if (canReach(mapping, child, target, visited)) {
      return true;
    }
  }

  return false;
}

/**
 * Extract text content from message content object
 */
function extractContent(content: {
  content_type: string;
  parts?: (string | Record<string, unknown>)[];
  text?: string;
}): string {
  if (content.text) return content.text;

  if (content.parts && Array.isArray(content.parts)) {
    const textParts = content.parts
      .filter((part): part is string => typeof part === 'string')
      .join('\n');
    return textParts;
  }

  return '';
}

/**
 * Split content into paragraphs
 */
export function splitIntoParagraphs(content: string): string[] {
  return content
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

/**
 * Split content into sentences (simple heuristic)
 */
export function splitIntoSentences(content: string): string[] {
  // Split on sentence-ending punctuation followed by space and capital letter
  // or end of string
  const sentences = content
    .split(/(?<=[.!?])\s+(?=[A-Z])|(?<=[.!?])$/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return sentences;
}

/**
 * Estimate token count for text (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for English
  return Math.ceil(text.length / 4);
}

/**
 * Generate a unique ID for a chunk
 */
export function generateChunkId(messageId: string, granularity: string, index: number): string {
  return `${messageId}_${granularity}_${index}`;
}
