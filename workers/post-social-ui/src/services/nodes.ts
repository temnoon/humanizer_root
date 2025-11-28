/**
 * Node System API Service
 * 
 * Handles all API calls for Nodes, Narratives, Subscriptions, and Comments
 * 
 * Phase 4 Update: Added contextQuote support for comments
 */

import { api } from './api';
import type { 
  Node, 
  Narrative, 
  NarrativeVersion, 
  NarrativeComment,
  NodeSubscription,
  VersionComparison
} from '@/types/models';

// ===== NODES =====

interface NodesListResponse {
  nodes: Node[];
}

interface NodeResponse {
  node: Node;
}

interface ListNodesOptions {
  mine?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listNodes(
  token?: string,
  options?: ListNodesOptions
): Promise<Node[]> {
  const params = new URLSearchParams();
  if (options?.mine) params.append('mine', 'true');
  if (options?.search) params.append('search', options.search);
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());
  
  const queryString = params.toString();
  const url = queryString ? `/api/nodes?${queryString}` : '/api/nodes';
  const data = await api.get<NodesListResponse>(url, token);
  return data.nodes || [];
}

export async function getNode(slug: string, token?: string): Promise<Node | null> {
  try {
    const data = await api.get<NodeResponse>(`/api/nodes/${slug}`, token);
    return data.node || null;
  } catch (err) {
    console.error('Failed to fetch node:', err);
    return null;
  }
}

export async function createNode(
  nodeData: {
    name: string;
    description?: string;
    curatorConfig?: Record<string, unknown>;
    curatorRules?: Record<string, unknown>;
  },
  token: string
): Promise<Node> {
  const data = await api.post<NodeResponse>('/api/nodes', nodeData, token);
  return data.node;
}

export async function updateNode(
  nodeId: string,
  updates: Partial<{
    name: string;
    description: string;
    curatorConfig: Record<string, unknown>;
    curatorRules: Record<string, unknown>;
    status: 'active' | 'archived';
  }>,
  token: string
): Promise<Node> {
  const data = await api.put<NodeResponse>(`/api/nodes/${nodeId}`, updates, token);
  return data.node;
}

// ===== NARRATIVES =====

interface NarrativeResponse {
  narrative: Narrative;
}

interface VersionsResponse {
  versions: {
    id: string;
    version: number;
    changes: Record<string, unknown>;
    trigger: Record<string, unknown>;
    createdAt: number;
  }[];
}

interface VersionResponse {
  version: NarrativeVersion;
}

interface CompareResponse {
  comparison: VersionComparison;
}

export async function publishNarrative(
  nodeId: string,
  narrativeData: {
    title: string;
    content: string;
    tags?: string[];
    visibility?: 'public' | 'node-only' | 'private';
  },
  token: string
): Promise<Narrative> {
  const data = await api.post<NarrativeResponse>(
    `/api/nodes/${nodeId}/narratives`,
    narrativeData,
    token
  );
  return data.narrative;
}

export async function getNarrative(id: string, token?: string): Promise<Narrative | null> {
  try {
    const data = await api.get<NarrativeResponse>(`/api/narratives/${id}`, token);
    return data.narrative || null;
  } catch (err) {
    console.error('Failed to fetch narrative:', err);
    return null;
  }
}

export async function getNarrativeBySlug(
  nodeSlug: string,
  narrativeSlug: string,
  version?: number,
  token?: string
): Promise<Narrative | null> {
  try {
    const url = version 
      ? `/api/narratives/${nodeSlug}/narratives/${narrativeSlug}?version=${version}`
      : `/api/narratives/${nodeSlug}/narratives/${narrativeSlug}`;
    const data = await api.get<NarrativeResponse>(url, token);
    return data.narrative || null;
  } catch (err) {
    console.error('Failed to fetch narrative:', err);
    return null;
  }
}

export async function updateNarrative(
  id: string,
  updates: {
    content?: string;
    title?: string;
    tags?: string[];
    visibility?: 'public' | 'node-only' | 'private';
    changeReason?: string;
  },
  token: string
): Promise<Narrative> {
  const data = await api.put<NarrativeResponse>(`/api/narratives/${id}`, updates, token);
  return data.narrative;
}

export async function listVersions(narrativeId: string, token?: string): Promise<VersionsResponse['versions']> {
  const data = await api.get<VersionsResponse>(`/api/narratives/${narrativeId}/versions`, token);
  return data.versions || [];
}

export async function getVersion(
  narrativeId: string, 
  version: number, 
  token?: string
): Promise<NarrativeVersion | null> {
  try {
    const data = await api.get<VersionResponse>(
      `/api/narratives/${narrativeId}/versions/${version}`,
      token
    );
    return data.version || null;
  } catch (err) {
    console.error('Failed to fetch version:', err);
    return null;
  }
}

export async function compareVersions(
  narrativeId: string,
  fromVersion: number,
  toVersion: number,
  format: 'structured' | 'unified' | 'side-by-side' = 'structured',
  token?: string
): Promise<VersionComparison | null> {
  try {
    const data = await api.get<CompareResponse>(
      `/api/narratives/${narrativeId}/versions/compare?from=${fromVersion}&to=${toVersion}&format=${format}`,
      token
    );
    return data.comparison || null;
  } catch (err) {
    console.error('Failed to compare versions:', err);
    return null;
  }
}

export async function deleteNarrative(id: string, token: string): Promise<boolean> {
  try {
    await api.delete(`/api/narratives/${id}`, token);
    return true;
  } catch (err) {
    console.error('Failed to delete narrative:', err);
    return false;
  }
}

// ===== SUBSCRIPTIONS =====

interface SubscriptionsResponse {
  subscriptions: NodeSubscription[];
}

interface SubscriptionResponse {
  subscription: NodeSubscription;
}

interface SubscriptionCheckResponse {
  subscribed: boolean;
  subscription?: NodeSubscription;
}

export async function getSubscriptions(token: string): Promise<NodeSubscription[]> {
  const data = await api.get<SubscriptionsResponse>('/api/subscriptions', token);
  return data.subscriptions || [];
}

export async function subscribe(
  nodeId: string,
  preferences?: {
    notifyNewNarrative?: boolean;
    notifyUpdates?: boolean;
    emailDigest?: 'realtime' | 'daily' | 'weekly' | 'none';
  },
  token?: string
): Promise<NodeSubscription> {
  const data = await api.post<SubscriptionResponse>(
    '/api/subscriptions',
    { nodeId, preferences },
    token
  );
  return data.subscription;
}

export async function unsubscribe(nodeId: string, token: string): Promise<boolean> {
  try {
    await api.delete(`/api/subscriptions/${nodeId}`, token);
    return true;
  } catch (err) {
    console.error('Failed to unsubscribe:', err);
    return false;
  }
}

export async function checkSubscription(
  nodeId: string,
  token: string
): Promise<{ subscribed: boolean; subscription?: NodeSubscription }> {
  try {
    const data = await api.get<SubscriptionCheckResponse>(
      `/api/subscriptions/check/${nodeId}`,
      token
    );
    return data;
  } catch (err) {
    console.error('Failed to check subscription:', err);
    return { subscribed: false };
  }
}

export async function markRead(nodeId: string, token: string): Promise<boolean> {
  try {
    await api.post(`/api/subscriptions/${nodeId}/mark-read`, {}, token);
    return true;
  } catch (err) {
    console.error('Failed to mark as read:', err);
    return false;
  }
}

// ===== COMMENTS =====

interface CommentsResponse {
  comments: NarrativeComment[];
}

interface CommentResponse {
  comment: NarrativeComment;
}

/**
 * List comments on a narrative
 * @param narrativeId - The narrative ID
 * @param status - Optional filter by status
 * @param token - Auth token (needed to see pending comments as owner)
 */
export async function listComments(
  narrativeId: string,
  status?: 'pending' | 'approved' | 'rejected' | 'synthesized',
  token?: string
): Promise<NarrativeComment[]> {
  const url = status
    ? `/api/narratives/${narrativeId}/comments?status=${status}`
    : `/api/narratives/${narrativeId}/comments`;
  const data = await api.get<CommentsResponse>(url, token);
  return data.comments || [];
}

/**
 * Post a comment on a narrative
 * @param narrativeId - The narrative ID
 * @param commentData - Comment content and optional context
 * @param token - Auth token
 */
export async function postComment(
  narrativeId: string,
  commentData: {
    content: string;
    contextQuote?: string;  // Text the user selected/quoted
    context?: {
      selectedText?: string;
      position?: number;
    };
  },
  token: string
): Promise<NarrativeComment> {
  // Transform contextQuote to context format if provided
  const payload: {
    content: string;
    context?: { selectedText?: string; position?: number };
  } = {
    content: commentData.content,
  };
  
  if (commentData.contextQuote) {
    payload.context = {
      selectedText: commentData.contextQuote,
      ...commentData.context,
    };
  } else if (commentData.context) {
    payload.context = commentData.context;
  }
  
  const data = await api.post<CommentResponse>(
    `/api/narratives/${narrativeId}/comments`,
    payload,
    token
  );
  return data.comment;
}

/**
 * Evaluate a comment (Node owner only)
 */
export async function evaluateComment(
  commentId: string,
  evaluation: {
    status: 'approved' | 'rejected';
    quality?: number;
    relevance?: number;
    perspective?: string;
  },
  token: string
): Promise<NarrativeComment> {
  const data = await api.post<CommentResponse>(
    `/api/narrative-comments/${commentId}/evaluate`,
    evaluation,
    token
  );
  return data.comment;
}

/**
 * Delete a comment (author or Node owner)
 */
export async function deleteComment(commentId: string, token: string): Promise<boolean> {
  try {
    await api.delete(`/api/narrative-comments/${commentId}`, token);
    return true;
  } catch (err) {
    console.error('Failed to delete comment:', err);
    return false;
  }
}

/**
 * Get a single comment with full details
 */
export async function getComment(commentId: string, token?: string): Promise<NarrativeComment | null> {
  try {
    const data = await api.get<CommentResponse>(`/api/narrative-comments/${commentId}`, token);
    return data.comment || null;
  } catch (err) {
    console.error('Failed to fetch comment:', err);
    return null;
  }
}

// ===== CHAPTERS =====

interface ChaptersResponse {
  nodeId: string;
  source: 'chunks' | 'narratives';
  chapters: Array<{
    chapterNumber: number;
    title: string;
    // From chunks
    chunkCount?: number;
    estimatedWords?: number;
    published?: boolean;
    // From narratives
    narrativeId?: string;
    slug?: string;
    currentVersion?: number;
    wordCount?: number;
    readingTime?: number;
    visibility?: string;
    createdAt?: number;
    updatedAt?: number;
  }>;
}

interface PublishChaptersResponse {
  success: boolean;
  nodeId: string;
  nodeName: string;
  published: Array<{
    chapterNumber: number;
    narrativeId: string;
    title: string;
    slug: string;
    wordCount: number;
  }>;
  skipped: number[];
  summary: {
    totalChapters: number;
    publishedCount: number;
    skippedCount: number;
    totalWords: number;
  };
}

/**
 * Get chapters for a node (from chunks or published narratives)
 */
export async function getChapters(
  nodeId: string,
  source: 'chunks' | 'narratives' = 'narratives',
  token?: string
): Promise<ChaptersResponse> {
  const data = await api.get<ChaptersResponse>(
    `/api/nodes/${nodeId}/chapters?source=${source}`,
    token
  );
  return data;
}

/**
 * Publish chapters from chunks as narratives
 */
export async function publishChapters(
  nodeId: string,
  options?: {
    visibility?: 'public' | 'node-only' | 'private';
    chaptersToPublish?: number[];
  },
  token?: string
): Promise<PublishChaptersResponse> {
  const data = await api.post<PublishChaptersResponse>(
    `/api/nodes/${nodeId}/publish-chapters`,
    options || {},
    token
  );
  return data;
}

// ===== CURATOR RESPONSE =====

interface CuratorResponseResult {
  response: string;
  model: string;
  processingTimeMs: number;
}

/**
 * Generate curator response to a comment
 */
export async function generateCuratorResponse(
  comment: string,
  narrativeContent: string,
  existingComments?: string,
  token?: string
): Promise<CuratorResponseResult> {
  const data = await api.post<CuratorResponseResult>(
    '/api/curator/respond',
    { comment, narrativeContent, existingComments },
    token
  );
  return data;
}

// ===== CURATOR PYRAMID =====

interface WellKnownBook {
  slug: string;
  gutenbergId: string;
}

interface WellKnownBooksResponse {
  books: WellKnownBook[];
}

interface PyramidBuildResponse {
  success: boolean;
  nodeId: string;
  gutenbergId: string;
  metadata: {
    title: string;
    author: string;
    language: string;
  };
  stats: {
    totalChunks: number;
    averageTokens: number;
    pyramidDepth: number;
    processingTimeMs: number;
  };
  apex: {
    themes: string[];
    theQuestion: string;
    resonanceHooks: string[];
  };
}

interface PyramidStatsResponse {
  nodeId: string;
  stats: {
    chunkCount: number;
    summaryCount: number;
    hasApex: boolean;
  };
  apex?: {
    coreThemes: string[];
    theQuestion: string;
    sourceTitle: string;
    sourceAuthor: string;
  };
}

interface ChatResponse {
  conversationId: string;
  sessionId: string;
  response: string;
  turnNumber: number;
  passagesCited: Array<{
    chunkId: string;
    quote: string;
    citation: string;
    relevance: number;
  }>;
  processingTimeMs: number;
}

export async function getWellKnownBooks(): Promise<WellKnownBook[]> {
  const data = await api.get<WellKnownBooksResponse>('/api/curator-pyramid/well-known-books');
  return data.books || [];
}

export async function buildPyramidFromGutenberg(
  nodeId: string,
  gutenbergSlug: string,
  token: string
): Promise<PyramidBuildResponse> {
  const data = await api.post<PyramidBuildResponse>(
    '/api/curator-pyramid/build',
    { nodeId, gutenbergSlug },
    token
  );
  return data;
}

export async function buildPyramidFromGutenbergId(
  nodeId: string,
  gutenbergId: string,
  token: string
): Promise<PyramidBuildResponse> {
  const data = await api.post<PyramidBuildResponse>(
    '/api/curator-pyramid/build',
    { nodeId, gutenbergId },
    token
  );
  return data;
}

export async function getPyramidStats(
  nodeId: string,
  token?: string
): Promise<PyramidStatsResponse | null> {
  try {
    const data = await api.get<PyramidStatsResponse>(
      `/api/curator-pyramid/node/${nodeId}/stats`,
      token
    );
    return data;
  } catch {
    return null;
  }
}

export async function chatWithCurator(
  nodeId: string,
  message: string,
  sessionId?: string,
  token?: string
): Promise<ChatResponse> {
  const payload: { message: string; sessionId?: string } = { message };
  if (sessionId) payload.sessionId = sessionId;

  const data = await api.post<ChatResponse>(
    `/api/curator-pyramid/node/${nodeId}/chat`,
    payload,
    token
  );
  return data;
}

// Export as a service object for consistency
export const nodesService = {
  // Nodes
  listNodes,
  getNode,
  createNode,
  updateNode,

  // Narratives
  publishNarrative,
  getNarrative,
  getNarrativeBySlug,
  updateNarrative,
  deleteNarrative,
  listVersions,
  getVersion,
  compareVersions,

  // Subscriptions
  getSubscriptions,
  subscribe,
  unsubscribe,
  checkSubscription,
  markRead,

  // Comments
  listComments,
  postComment,
  evaluateComment,
  deleteComment,
  getComment,

  // Chapters
  getChapters,
  publishChapters,

  // Curator Response
  generateCuratorResponse,

  // Curator Pyramid
  getWellKnownBooks,
  buildPyramidFromGutenberg,
  buildPyramidFromGutenbergId,
  getPyramidStats,
  chatWithCurator,
};
