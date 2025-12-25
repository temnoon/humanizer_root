/**
 * Archive Service
 *
 * Client for the archive-server API (port 3002)
 */

import type {
  ArchiveConversation,
  ArchiveConversationFull,
  ArchiveNode,
  ArchiveMessage,
  FlatMessage,
  ConversationListResponse,
} from './types';

// Default to localhost:3002 for development
const ARCHIVE_API_BASE = import.meta.env.VITE_ARCHIVE_API_URL || 'http://localhost:3002';

/**
 * Fetch conversations from the archive
 */
export async function fetchConversations(options?: {
  limit?: number;
  offset?: number;
  sortBy?: 'recent' | 'oldest' | 'length-desc' | 'length-asc' | 'messages-desc';
  hasMedia?: boolean;
  hasImages?: boolean;
  hasAudio?: boolean;
  minMessages?: number;
}): Promise<ConversationListResponse> {
  const params = new URLSearchParams();

  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  if (options?.sortBy) params.set('sortBy', options.sortBy);
  if (options?.hasMedia !== undefined) params.set('hasMedia', String(options.hasMedia));
  if (options?.hasImages !== undefined) params.set('hasImages', String(options.hasImages));
  if (options?.hasAudio !== undefined) params.set('hasAudio', String(options.hasAudio));
  if (options?.minMessages !== undefined) params.set('minMessages', String(options.minMessages));

  const url = `${ARCHIVE_API_BASE}/api/conversations?${params}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch conversations: ${response.statusText}`);
  }

  return response.json();
}

// API response for single conversation (archive-server pre-flattens messages)
interface ConversationResponse {
  id: string;
  title: string;
  folder: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    created_at: number;
  }>;
  created_at: number;
  updated_at: number;
}

/**
 * Fetch a single conversation's messages
 * Archive-server pre-flattens the tree structure into a linear array
 */
export async function fetchConversation(folder: string): Promise<ConversationResponse> {
  const response = await fetch(`${ARCHIVE_API_BASE}/api/conversations/${encodeURIComponent(folder)}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch conversation: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Convert API response to FlatMessage array
 * The archive-server already flattens messages, so this is a simple mapping
 */
export function getMessages(conv: ConversationResponse, limit = 50): FlatMessage[] {
  return conv.messages.slice(0, limit).map((msg, index) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content || '',
    created_at: msg.created_at,
    has_media: false, // TODO: detect media in content
    media_urls: [],
    index,
  }));
}

/**
 * Format Unix timestamp to readable date
 */
export function formatDate(timestamp: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get year-month grouping key from timestamp
 */
export function getYearMonth(timestamp: number): string {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  });
}

/**
 * Group conversations by year-month
 */
export function groupConversationsByMonth(
  conversations: ArchiveConversation[]
): Map<string, ArchiveConversation[]> {
  const groups = new Map<string, ArchiveConversation[]>();

  for (const conv of conversations) {
    const key = getYearMonth(conv.created_at);
    const group = groups.get(key) || [];
    group.push(conv);
    groups.set(key, group);
  }

  return groups;
}

/**
 * Check if archive server is available
 */
export async function checkArchiveHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${ARCHIVE_API_BASE}/api/archives/current`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get current archive info
 */
export async function getCurrentArchive(): Promise<{
  name: string;
  path: string;
  conversationCount: number;
} | null> {
  try {
    const response = await fetch(`${ARCHIVE_API_BASE}/api/archives/current`);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}
