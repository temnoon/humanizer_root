/**
 * Node System API Service
 * 
 * Handles all API calls for Nodes, Narratives, Subscriptions, and Comments
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

export async function postComment(
  narrativeId: string,
  commentData: {
    content: string;
    context?: {
      selectedText?: string;
      position?: number;
    };
  },
  token: string
): Promise<NarrativeComment> {
  const data = await api.post<CommentResponse>(
    `/api/narratives/${narrativeId}/comments`,
    commentData,
    token
  );
  return data.comment;
}

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

export async function deleteComment(commentId: string, token: string): Promise<boolean> {
  try {
    await api.delete(`/api/narrative-comments/${commentId}`, token);
    return true;
  } catch (err) {
    console.error('Failed to delete comment:', err);
    return false;
  }
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
};
