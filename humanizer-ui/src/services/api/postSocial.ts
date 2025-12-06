/**
 * Post-Social API Service
 * Node network, semantic search, curator chat
 */

import { ApiClient } from './client';

export interface Node {
  id: string;
  slug: string;
  title: string;
  body: string;
  created: string;
  updated: string;
  narrativeId?: string;
  parentId?: string;
  tags?: string[];
}

export interface Narrative {
  id: string;
  title: string;
  description: string;
  nodeCount: number;
  created: string;
}

export interface SearchResult {
  node: Node;
  similarity: number;
  excerpt: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: Array<{
    nodeId: string;
    excerpt: string;
    similarity: number;
  }>;
}

export interface ChatResponse {
  message: ChatMessage;
  conversationId?: string;
}

export class PostSocialService {
  constructor(private client: ApiClient) {}

  /**
   * List all narratives
   */
  async listNarratives(): Promise<Narrative[]> {
    return this.client.get('/api/narratives');
  }

  /**
   * Get narrative by ID
   */
  async getNarrative(narrativeId: string): Promise<Narrative> {
    return this.client.get(`/api/narratives/${narrativeId}`);
  }

  /**
   * List nodes in narrative
   */
  async listNodes(narrativeId: string): Promise<Node[]> {
    return this.client.get(`/api/narratives/${narrativeId}/nodes`);
  }

  /**
   * Get node by slug
   */
  async getNode(slug: string): Promise<Node> {
    return this.client.get(`/api/nodes/${slug}`);
  }

  /**
   * Create new node
   */
  async createNode(data: {
    slug: string;
    title: string;
    body: string;
    narrativeId?: string;
    parentId?: string;
    tags?: string[];
  }): Promise<Node> {
    return this.client.post('/api/nodes', data);
  }

  /**
   * Update node
   */
  async updateNode(slug: string, data: Partial<Node>): Promise<Node> {
    return this.client.put(`/api/nodes/${slug}`, data);
  }

  /**
   * Delete node
   */
  async deleteNode(slug: string): Promise<{ success: boolean }> {
    return this.client.delete(`/api/nodes/${slug}`);
  }

  /**
   * Semantic search across all nodes
   */
  async search(query: string, options?: {
    limit?: number;
    threshold?: number;
  }): Promise<SearchResult[]> {
    const params: Record<string, string> = { q: query };
    if (options?.limit) params.limit = String(options.limit);
    if (options?.threshold) params.threshold = String(options.threshold);

    return this.client.get('/api/search', params);
  }

  /**
   * Chat with curator (semantic search + LLM)
   */
  async chat(
    message: string,
    options?: {
      conversationId?: string;
      systemPrompt?: string;
      nodeId?: string;
    }
  ): Promise<ChatResponse> {
    return this.client.post('/api/curator/chat', {
      message,
      ...options,
    });
  }

  /**
   * Stream chat with curator (real-time LLM generation)
   */
  async streamChat(
    message: string,
    options: {
      nodeId: string;
      conversationId?: string;
      systemPrompt?: string;
      onChunk: (chunk: string) => void;
      onComplete?: () => void;
      onError?: (error: Error) => void;
    }
  ): Promise<void> {
    const { nodeId, onChunk, onComplete, onError, ...chatOptions } = options;

    return this.client.streamPost(
      '/api/curator/chat',
      {
        message,
        nodeId,
        stream: true,
        ...chatOptions,
      },
      onChunk,
      onComplete,
      onError
    );
  }

  /**
   * Get conversation history
   */
  async getConversation(conversationId: string): Promise<ChatMessage[]> {
    return this.client.get(`/api/curator/conversations/${conversationId}`);
  }

  // ==========================================
  // Node Admin API
  // ==========================================

  /**
   * Get all nodes health status (admin)
   */
  async getNodesHealth(): Promise<any> {
    return this.client.get('/api/admin/nodes/health');
  }

  /**
   * Get specific node health (admin)
   */
  async getNodeHealth(nodeId: string): Promise<any> {
    return this.client.get(`/api/admin/node/${nodeId}/health`);
  }

  /**
   * Rebuild node pyramid (admin)
   */
  async rebuildNode(nodeId: string, config?: {
    force?: boolean;
    rebuildChunks?: boolean;
    rebuildSummaries?: boolean;
    rebuildApex?: boolean;
    rebuildEmbeddings?: boolean;
  }): Promise<any> {
    return this.client.post(`/api/admin/node/${nodeId}/rebuild`, config || {});
  }

  /**
   * Get pyramid stats for node
   */
  async getPyramidStats(nodeId: string): Promise<any> {
    return this.client.get(`/api/admin/node/${nodeId}/pyramid/stats`);
  }

  /**
   * Test curator prompt
   */
  async testCuratorPrompt(nodeId: string, message: string): Promise<any> {
    return this.client.post(`/api/admin/node/${nodeId}/curator/test`, { message });
  }

  /**
   * Get all narratives for a node
   */
  async getNodeNarratives(nodeId: string): Promise<Narrative[]> {
    return this.client.get(`/api/nodes/${nodeId}/narratives`);
  }

  /**
   * Create narrative in node
   */
  async createNarrative(data: {
    title: string;
    description?: string;
    nodeId?: string;
  }): Promise<Narrative> {
    return this.client.post('/api/narratives', data);
  }

  /**
   * Update narrative
   */
  async updateNarrative(narrativeId: string, data: Partial<Narrative>): Promise<Narrative> {
    return this.client.put(`/api/narratives/${narrativeId}`, data);
  }

  /**
   * Delete narrative
   */
  async deleteNarrative(narrativeId: string): Promise<{ success: boolean }> {
    return this.client.delete(`/api/narratives/${narrativeId}`);
  }

  /**
   * Reorder narratives in node
   */
  async reorderNarratives(nodeId: string, narrativeIds: string[]): Promise<{ success: boolean }> {
    return this.client.post(`/api/nodes/${nodeId}/narratives/reorder`, { narrativeIds });
  }

  // ==========================================
  // Gutenberg Processing API
  // ==========================================

  /**
   * Reformat Gutenberg text (removes line breaks, creates chapters)
   */
  async reformatGutenbergText(nodeId: string): Promise<{
    success: boolean;
    nodeId: string;
    chapterCount: number;
    processedAt: number;
  }> {
    return this.client.post(`/api/working-text/node/${nodeId}/reformat`, {});
  }

  /**
   * Get reformatted working texts
   */
  async getWorkingTexts(nodeId: string): Promise<{
    chapters: Array<{
      id: string;
      title: string;
      content: string;
      chapterNumber: number;
    }>;
  }> {
    return this.client.get(`/api/working-text/node/${nodeId}`);
  }

  /**
   * Build pyramid summary with embeddings
   */
  async buildPyramid(nodeId: string): Promise<{
    success: boolean;
    levels: number;
    chunks: number;
    embeddings: number;
  }> {
    return this.client.post(`/api/curator/pyramid/${nodeId}/build`, {});
  }

  /**
   * Get pyramid summary
   */
  async getPyramid(nodeId: string): Promise<{
    summary: string;
    levels: Array<{
      level: number;
      chunks: number;
      summaries: Array<{
        content: string;
        chunkIndex: number;
      }>;
    }>;
  }> {
    return this.client.get(`/api/curator/pyramid/${nodeId}`);
  }
}
