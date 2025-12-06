/**
 * embeddingService.ts - API wrapper for embedding operations
 *
 * Connects to archive-server.js endpoints for semantic search,
 * clustering, and anchor management.
 */

import { STORAGE_PATHS } from '../config/storage-paths';

const BASE_URL = STORAGE_PATHS.archiveServerUrl;

export interface EmbeddingStatus {
  status: 'idle' | 'indexing' | 'error';
  stats: {
    conversationCount: number;
    messageCount: number;
    vectorStats: {
      messageCount: number;
      summaryCount: number;
      paragraphCount: number;
    };
  };
  error?: string;
}

export interface SearchResult {
  id: string;
  content: string;
  similarity: number;
  conversationId: string;
  conversationTitle: string;
  messageRole: string;
  embeddingId?: string;
}

export interface Cluster {
  id: string;
  memberCount: number;
  coherence: number;
  sampleTexts: string[];
  memberIds: string[];  // Embedding IDs of all cluster members
}

export interface ClusterMember {
  embeddingId: string;
  messageId: string;
  conversationId: string;
  conversationTitle: string;
  role: string;
  content: string;
  createdAt: number;
}

export interface ClusterMemberConversation {
  conversationId: string;
  conversationTitle: string;
  messageCount: number;
  messages: Array<{
    embeddingId: string;
    messageId: string;
    role: string;
    content: string;
    createdAt: number;
  }>;
}

export interface ClusterMembersResult {
  success: boolean;
  total: number;
  messages: ClusterMember[];
  limit: number;
  offset: number;
  hasMore: boolean;
  conversations?: ClusterMemberConversation[];
  conversationCount?: number;
}

export interface ClusterMemberFilters {
  roles?: ('user' | 'assistant' | 'system' | 'tool')[];
  excludeImagePrompts?: boolean;
  excludeShortMessages?: number;
  limit?: number;
  offset?: number;
  groupByConversation?: boolean;
}

export interface ClusteringResult {
  success: boolean;
  clusterCount: number;
  clusters: Cluster[];
}

export interface Anchor {
  id: string;
  name: string;
  type: 'anchor' | 'anti-anchor';
  sourceCount: number;
}

export interface BetweenResult {
  id: string;
  content: string;
  similarity: number;
}

export const embeddingService = {
  /**
   * Get current embedding status and stats
   */
  async getStatus(): Promise<EmbeddingStatus> {
    const res = await fetch(`${BASE_URL}/api/embeddings/status`);
    if (!res.ok) throw new Error('Failed to get embedding status');
    return res.json();
  },

  /**
   * Search messages by semantic meaning
   */
  async searchMessages(query: string, limit = 20): Promise<{ results: SearchResult[] }> {
    const res = await fetch(`${BASE_URL}/api/embeddings/search/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit }),
    });
    if (!res.ok) throw new Error('Search failed');
    return res.json();
  },

  /**
   * Search content items (messages + Facebook posts/comments) by semantic meaning
   */
  async searchContent(params: {
    query: string;
    limit?: number;
    source?: 'openai' | 'facebook';
    type?: 'post' | 'comment';
  }): Promise<{ results: any[] }> {
    const res = await fetch(`${BASE_URL}/api/content/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Content search failed');
    return res.json();
  },

  /**
   * Find messages similar to a given embedding
   */
  async findSimilar(
    embeddingId: string,
    limit = 10,
    excludeSameConversation = true
  ): Promise<{ results: SearchResult[] }> {
    const res = await fetch(`${BASE_URL}/api/embeddings/similar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeddingId, limit, excludeSameConversation }),
    });
    if (!res.ok) throw new Error('Find similar failed');
    return res.json();
  },

  /**
   * Discover clusters using HDBSCAN
   * IMPORTANT: Use maxSampleSize <= 1500 to avoid OOM
   */
  async discoverClusters(options: {
    minClusterSize?: number;
    minSamples?: number;
    maxSampleSize?: number;
  } = {}): Promise<ClusteringResult> {
    const defaultOptions = {
      minClusterSize: 10,
      minSamples: 5,
      maxSampleSize: 1500, // Critical for OOM prevention
    };

    const res = await fetch(`${BASE_URL}/api/clustering/discover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ options: { ...defaultOptions, ...options } }),
    });
    if (!res.ok) throw new Error('Clustering failed');
    return res.json();
  },

  /**
   * Get all saved anchors
   */
  async getAnchors(): Promise<{ anchors: Anchor[] }> {
    const res = await fetch(`${BASE_URL}/api/anchors`);
    if (!res.ok) throw new Error('Failed to get anchors');
    return res.json();
  },

  /**
   * Create an anchor from source embeddings
   */
  async createAnchor(name: string, sourceIds: string[]): Promise<{ id: string; name: string }> {
    const res = await fetch(`${BASE_URL}/api/anchors/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, sourceIds }),
    });
    if (!res.ok) throw new Error('Failed to create anchor');
    return res.json();
  },

  /**
   * Create an anti-anchor (semantic "avoid" point)
   */
  async createAntiAnchor(name: string, sourceIds: string[]): Promise<{ id: string; name: string }> {
    const res = await fetch(`${BASE_URL}/api/anchors/create-anti`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, sourceIds }),
    });
    if (!res.ok) throw new Error('Failed to create anti-anchor');
    return res.json();
  },

  /**
   * Find content between two anchors
   * position: 0 = closer to anchor, 1 = closer to anti-anchor
   */
  async findBetween(
    anchorId: string,
    antiAnchorId: string,
    position = 0.5,
    limit = 20
  ): Promise<{ results: BetweenResult[] }> {
    const res = await fetch(`${BASE_URL}/api/anchors/between`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anchorId, antiAnchorId, position, limit }),
    });
    if (!res.ok) throw new Error('Find between failed');
    return res.json();
  },

  /**
   * Delete an anchor
   */
  async deleteAnchor(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE_URL}/api/anchors/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete anchor');
    return res.json();
  },

  /**
   * Start building the embedding index
   */
  async buildIndex(archivePath: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${BASE_URL}/api/embeddings/build`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archivePath }),
    });
    if (!res.ok) throw new Error('Failed to start indexing');
    return res.json();
  },

  /**
   * Get cluster members with filtering
   * Can use either memberIds directly or clusterId to look up cached cluster
   */
  async getClusterMembers(
    params: {
      memberIds?: string[];
      clusterId?: string;
    } & ClusterMemberFilters
  ): Promise<ClusterMembersResult> {
    const res = await fetch(`${BASE_URL}/api/clustering/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to get cluster members');
    return res.json();
  },
};
