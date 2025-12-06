/**
 * Curator Chat Service
 *
 * Service for chatting with a node's curator using the pyramid-based chat system.
 * Includes semantic search through the corpus and citation of relevant passages.
 */

export interface CitedPassage {
  chunkId: string;
  quote: string;
  citation: string;
  relevance: number;
}

export interface ChatTurn {
  role: 'user' | 'curator';
  content: string;
  timestamp: number;
}

export interface ChatResponse {
  conversationId: string;
  sessionId: string;
  response: string;
  turnNumber: number;
  passagesCited: CitedPassage[];
  processingTimeMs: number;
}

export interface ConversationHistory {
  conversationId: string;
  sessionId: string;
  turns: ChatTurn[];
  createdAt: number;
  updatedAt: number;
}

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8788';

/**
 * Send a message to the curator and get a response
 */
export async function sendChatMessage(
  nodeId: string,
  message: string,
  sessionId?: string,
  maxPassages: number = 3
): Promise<ChatResponse> {
  const response = await fetch(
    `${API_BASE}/api/curator-pyramid/node/${nodeId}/chat`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        sessionId,
        maxPassages,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send message');
  }

  return response.json();
}

/**
 * Get conversation history for a session
 */
export async function getConversationHistory(
  nodeId: string,
  sessionId: string
): Promise<ConversationHistory> {
  const response = await fetch(
    `${API_BASE}/api/curator-pyramid/node/${nodeId}/chat/history?sessionId=${sessionId}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get history');
  }

  return response.json();
}

/**
 * Generate a new session ID for a chat conversation
 */
export function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export const curatorChatService = {
  sendChatMessage,
  getConversationHistory,
  generateSessionId,
};
