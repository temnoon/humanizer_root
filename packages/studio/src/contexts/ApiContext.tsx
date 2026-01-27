/**
 * API Context
 *
 * HTTP client wrapper for communicating with the Humanizer API.
 * Automatically includes Bearer token when authenticated.
 */

import React, { createContext, useContext, useMemo } from 'react';
import ky, { type KyInstance } from 'ky';
import { useAuth } from './AuthContext';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface SessionSummary {
  id: string;
  name?: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
  bufferCount: number;
}

export interface Session {
  id: string;
  name?: string;
  userId?: string;
  createdAt: string | number;
  updatedAt: string | number;
  buffers?: Array<{ name: string; version?: string; branch?: string }>;
  searchContext?: {
    query?: string;
    resultsCount: number;
    anchorsCount: number;
  };
}

export interface BufferSummary {
  name: string;
  version: string;
  currentBranch: string;
  createdAt: string;
  updatedAt: string;
  contentLength: number;
}

export interface Buffer {
  name: string;
  version: string;
  currentBranch: string;
  content: unknown[];
  branches: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Result provenance - tracks where content came from
 */
export interface ResultProvenance {
  sourceStore: 'archive' | 'books';
  sourceType: string;
  sourceOriginalId?: string;
  threadRootId?: string;
  threadTitle?: string;
  parentNodeId?: string;
  bookContext?: {
    bookId: string;
    bookTitle?: string;
    bookSlug?: string;
    chapterId?: string;
    chapterTitle?: string;
    chapterPosition?: number;
  };
  sourceCreatedAt?: number;
  author?: string;
  authorRole?: 'user' | 'assistant' | 'system';
  uri: string;
}

/**
 * Quality indicators for a result
 */
export interface QualityIndicators {
  qualityScore: number;
  wordCount: number;
  hasCodeBlocks?: boolean;
  hasMathBlocks?: boolean;
  hasLinks?: boolean;
  hasCitations?: boolean;
  languageScore?: number;
}

/**
 * AI-generated enrichment for a result
 */
export interface ResultEnrichment {
  title?: string;
  summary?: string;
  rating?: number;
  categories?: string[];
  keyTerms?: string[];
  enrichedAt?: number;
}

/**
 * Score breakdown for a search result
 */
export interface ScoreBreakdown {
  denseScore?: number;
  denseRank?: number;
  sparseScore?: number;
  sparseRank?: number;
  fusedScore: number;
  anchorBoost?: number;
  finalScore: number;
}

/**
 * Search result from the API with full provenance and quality data
 */
export interface SearchResult {
  id: string;
  text: string;
  source: 'archive' | 'books';
  score: number;
  wordCount: number;
  hierarchyLevel: number;
  provenance?: ResultProvenance;
  quality?: QualityIndicators;
  enrichment?: ResultEnrichment;
  scoreBreakdown?: ScoreBreakdown;
  title?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface ClusterSummary {
  id: string;
  label: string;
  description?: string;
  nodeCount: number;
  quality: number;
  createdAt: string;
  updatedAt: string;
}

export interface BookSummary {
  id: string;
  title: string;
  description?: string;
  chapterCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// Admin types
export interface AdminStatus {
  status: string;
  message?: string;
}

export interface AdminUsageStats {
  totalTokens: number;
  totalRequests: number;
  totalCostCents: number;
  userCount: number;
}

export interface AdminApiKey {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  usageCount: number;
  createdAt: string;
  revokedAt: string | null;
}

export interface AdminTier {
  tier: string;
  tokensPerMonth: number;
  requestsPerMonth: number;
  costCentsPerMonth: number;
  requestsPerMinute: number;
  maxApiKeys: number;
}

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
  createdAt: string;
  lastActiveAt?: string | null;
  bannedAt?: string | null;
  banReason?: string | null;
  usage?: {
    tokensUsed: number;
    requestsCount: number;
    costMillicents: number;
    period: string;
  } | null;
}

export interface AdminUserListParams {
  search?: string;
  tier?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface AdminPrompt {
  id: string;
  name: string;
  description?: string;
  template: string;
  version?: number;
  usedBy?: string[];
  tags?: string[];
  requiredVariables?: string[];
}

export interface AdminPromptUpdateParams {
  name?: string;
  description?: string;
  template: string;
  usedBy?: string[];
  tags?: string[];
  requiredVariables?: string[];
}

export interface AdminModel {
  id: string;
  name: string;
  provider: string;
  type: string;
  capabilities?: string[];
  contextWindow?: number;
  dimensions?: number;
  maxOutput?: number;
  costPerMtokInput?: number;
  costPerMtokOutput?: number;
  isDefault?: boolean;
  enabled: boolean;
}

export interface AdminProvider {
  id: string;
  name: string;
  type: 'local' | 'cloud';
  status: 'connected' | 'disconnected' | 'error';
  enabled: boolean;
  endpoint?: string;
  apiKeyConfigured: boolean;
  models: Array<{ id: string; name: string; type: string; enabled: boolean }>;
  lastHealthCheck?: string;
  errorMessage?: string;
  rateLimitRpm?: number;
  costPerMtokInput?: number;
  costPerMtokOutput?: number;
}

export interface AdminFeature {
  id: string;
  name: string;
  description: string;
  category: 'core' | 'premium' | 'beta' | 'experimental';
  enabled: boolean;
  tierOverrides: Array<{ tier: string; enabled: boolean }>;
  rolloutPercentage?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSubscription {
  id: string;
  userId: string;
  userEmail: string;
  tier: string;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string;
  monthlyAmount: number;
  createdAt: string;
}

export interface AdminSubscriptionListParams {
  tier?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface AdminAuditEvent {
  id: string;
  timestamp: string;
  action: string;
  category: 'auth' | 'admin' | 'billing' | 'api' | 'system';
  actor: {
    type: 'user' | 'system' | 'api_key';
    id: string;
    email?: string;
  };
  target?: {
    type: string;
    id: string;
    name?: string;
  };
  metadata: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  success: boolean;
}

export interface AdminAuditListParams {
  category?: string;
  success?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AdminCostAnalytics {
  period: { start: string; end: string };
  totalProviderCostMillicents: number;
  totalChargedMillicents: number;
  marginMillicents: number;
  marginPercent: number;
  byProvider: Record<string, { cost: number; requests: number; tokens: number }>;
  byModel: Record<string, { cost: number; requests: number; tokens: number }>;
  daily: Array<{ date: string; cost: number; charged: number }>;
}

export interface ApiClient {
  // Sessions
  listSessions: () => Promise<{ sessions: SessionSummary[]; count: number }>;
  createSession: (options?: { userId?: string; name?: string }) => Promise<Session>;
  getSession: (id: string) => Promise<Session>;
  deleteSession: (id: string) => Promise<{ deleted: boolean }>;

  // Buffers
  listBuffers: (sessionId: string) => Promise<{ buffers: BufferSummary[]; count: number }>;
  createBuffer: (sessionId: string, name: string, content?: unknown[]) => Promise<BufferSummary>;
  getBuffer: (sessionId: string, name: string) => Promise<Buffer>;
  setBufferContent: (sessionId: string, name: string, content: unknown[]) => Promise<void>;
  appendToBuffer: (sessionId: string, name: string, items: unknown[]) => Promise<void>;
  commitBuffer: (sessionId: string, name: string, message: string) => Promise<{ version: string }>;
  getBufferHistory: (sessionId: string, name: string, limit?: number) => Promise<{ history: unknown[] }>;

  // Search
  search: (
    sessionId: string,
    query: string,
    options?: { sources?: string[]; limit?: number; threshold?: number }
  ) => Promise<{ results: SearchResult[]; count: number }>;
  findSimilar: (
    sessionId: string,
    text: string,
    options?: { limit?: number; threshold?: number }
  ) => Promise<{ results: SearchResult[]; count: number }>;
  addAnchor: (
    sessionId: string,
    resultId: string,
    type: 'positive' | 'negative'
  ) => Promise<{ id: string; type: string }>;

  // Clusters
  listClusters: (options?: { userId?: string; limit?: number }) => Promise<{ clusters: ClusterSummary[] }>;
  discoverClusters: (options?: {
    minClusterSize?: number;
    maxClusters?: number;
  }) => Promise<{ clusters: ClusterSummary[] }>;

  // Books
  listBooks: (options?: { userId?: string; limit?: number }) => Promise<{ books: BookSummary[] }>;
  createBookFromCluster: (
    clusterId: string,
    options?: { title?: string; personaId?: string }
  ) => Promise<BookSummary>;
  exportBook: (bookId: string, format?: 'markdown' | 'html' | 'json') => Promise<string>;

  // Admin
  admin: {
    // Status
    getStatus: () => Promise<AdminStatus>;

    // Users
    listUsers: (params?: AdminUserListParams) => Promise<{ users: AdminUser[]; total: number }>;
    getUser: (userId: string) => Promise<AdminUser>;
    updateUserRole: (userId: string, role: string, reason: string) => Promise<void>;
    banUser: (userId: string, reason: string, duration?: string) => Promise<void>;

    // Tiers
    listTiers: () => Promise<{ tiers: AdminTier[] }>;
    updateTier: (tierId: string, params: Partial<AdminTier>) => Promise<void>;

    // API Keys
    listApiKeys: (params?: { userId?: string; status?: string; limit?: number; offset?: number }) => Promise<{ keys: AdminApiKey[]; total: number }>;
    revokeApiKey: (keyId: string, reason?: string) => Promise<void>;

    // Models
    listModels: () => Promise<{ models: AdminModel[]; byProvider: Record<string, AdminModel[]>; total: number }>;
    updateModel: (modelId: string, params: { enabled?: boolean; isDefault?: boolean }) => Promise<void>;

    // Prompts
    listPrompts: () => Promise<{ prompts: AdminPrompt[] }>;
    getPrompt: (id: string) => Promise<AdminPrompt>;
    updatePrompt: (id: string, params: AdminPromptUpdateParams) => Promise<void>;

    // Providers
    listProviders: () => Promise<{ providers: AdminProvider[] }>;
    updateProvider: (providerId: string, params: Partial<AdminProvider>) => Promise<void>;
    checkProviderHealth: (providerId: string) => Promise<{ status: string; latencyMs: number; checkedAt: string }>;

    // Features
    listFeatures: () => Promise<{ features: AdminFeature[] }>;
    updateFeature: (featureId: string, params: { enabled?: boolean; rolloutPercentage?: number; tierOverrides?: Array<{ tier: string; enabled: boolean }> }) => Promise<void>;

    // Subscriptions
    listSubscriptions: (params?: AdminSubscriptionListParams) => Promise<{ subscriptions: AdminSubscription[]; stats: { total: number; active: number; canceling: number; mrr: number }; total: number }>;
    getSubscription: (subscriptionId: string) => Promise<AdminSubscription>;

    // Analytics
    getUsage: (params?: { startDate?: string; endDate?: string; groupBy?: string }) => Promise<AdminUsageStats & { byModel?: Record<string, unknown>; byOperation?: Record<string, unknown>; byPeriod?: Record<string, unknown> }>;
    getCostAnalytics: (params?: { startDate?: string; endDate?: string }) => Promise<AdminCostAnalytics>;
    getRevenueAnalytics: (params?: { startDate?: string; endDate?: string }) => Promise<{ period: { start: string; end: string }; totalRevenueMillicents: number; totalCostMillicents: number; marginMillicents: number; byTier: Record<string, unknown> }>;

    // Audit
    listAuditEvents: (params?: AdminAuditListParams) => Promise<{ events: AdminAuditEvent[]; total: number }>;
    getAuditEvent: (eventId: string) => Promise<AdminAuditEvent>;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

const ApiContext = createContext<ApiClient | null>(null);

export function useApi(): ApiClient {
  const ctx = useContext(ApiContext);
  if (!ctx) {
    throw new Error('useApi must be used within ApiProvider');
  }
  return ctx;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

interface ApiProviderProps {
  baseUrl?: string;
  children: React.ReactNode;
}

export function ApiProvider({ baseUrl = 'http://localhost:3030', children }: ApiProviderProps) {
  const { getToken } = useAuth();

  // Create a ky instance with auth token support
  const client: KyInstance = useMemo(
    () =>
      ky.create({
        prefixUrl: baseUrl,
        headers: {
          'Content-Type': 'application/json',
        },
        hooks: {
          beforeRequest: [
            (request) => {
              // Add auth token if available
              const token = getToken();
              if (token) {
                request.headers.set('Authorization', `Bearer ${token}`);
              }
            },
          ],
        },
      }),
    [baseUrl, getToken]
  );

  const api: ApiClient = useMemo(
    () => ({
      // Sessions
      listSessions: () => client.get('sessions').json(),
      createSession: (options) => client.post('sessions', { json: options }).json(),
      getSession: (id) => client.get(`sessions/${id}`).json(),
      deleteSession: (id) => client.delete(`sessions/${id}`).json(),

      // Buffers
      listBuffers: (sessionId) => client.get(`sessions/${sessionId}/buffers`).json(),
      createBuffer: (sessionId, name, content) =>
        client.post(`sessions/${sessionId}/buffers`, { json: { name, content } }).json(),
      getBuffer: (sessionId, name) => client.get(`sessions/${sessionId}/buffers/${name}`).json(),
      setBufferContent: async (sessionId, name, content) => {
        await client.put(`sessions/${sessionId}/buffers/${name}/content`, { json: { content } });
      },
      appendToBuffer: async (sessionId, name, items) => {
        await client.post(`sessions/${sessionId}/buffers/${name}/append`, { json: { items } });
      },
      commitBuffer: (sessionId, name, message) =>
        client.post(`sessions/${sessionId}/buffers/${name}/commit`, { json: { message } }).json(),
      getBufferHistory: (sessionId, name, limit) =>
        client.get(`sessions/${sessionId}/buffers/${name}/history`, { searchParams: { limit: limit ?? 10 } }).json(),

      // Search
      search: (sessionId, query, options) =>
        client.post('search', { json: { sessionId, query, ...options } }).json(),
      findSimilar: (sessionId, text, options) =>
        client.post('search/similar', { json: { sessionId, text, ...options } }).json(),
      addAnchor: (sessionId, resultId, type) =>
        client.post('search/anchor', { json: { sessionId, resultId, type } }).json(),

      // Clusters
      listClusters: (options) => client.get('clusters', { searchParams: options }).json(),
      discoverClusters: (options) => client.post('clusters/discover', { json: options }).json(),

      // Books
      listBooks: (options) => client.get('books', { searchParams: options }).json(),
      createBookFromCluster: (clusterId, options) =>
        client.post('books/from-cluster', { json: { clusterId, ...options } }).json(),
      exportBook: (bookId, format) =>
        client.get(`books/${bookId}/export`, { searchParams: { format: format ?? 'markdown' } }).text(),

      // Admin
      admin: {
        // Status
        getStatus: () => client.get('admin/status').json(),

        // Users
        listUsers: (params) => client.get('admin/users', { searchParams: params as Record<string, string | number> }).json(),
        getUser: (userId) => client.get(`admin/users/${userId}`).json(),
        updateUserRole: async (userId, role, reason) => {
          await client.put(`admin/users/${userId}/role`, { json: { role, reason } });
        },
        banUser: async (userId, reason, duration) => {
          await client.post(`admin/users/${userId}/ban`, { json: { reason, duration } });
        },

        // Tiers
        listTiers: () => client.get('admin/tiers').json(),
        updateTier: async (tierId, params) => {
          await client.put(`admin/tiers/${tierId}`, { json: params });
        },

        // API Keys
        listApiKeys: (params) => client.get('admin/api-keys', { searchParams: params as Record<string, string | number> ?? {} }).json(),
        revokeApiKey: async (keyId, reason) => {
          await client.delete(`admin/api-keys/${keyId}`, { json: { reason: reason ?? 'Admin revocation' } });
        },

        // Models
        listModels: () => client.get('admin/models').json(),
        updateModel: async (modelId, params) => {
          await client.put(`admin/models/${modelId}`, { json: params });
        },

        // Prompts
        listPrompts: () => client.get('admin/prompts').json(),
        getPrompt: (id) => client.get(`admin/prompts/${id}`).json<{ prompt: AdminPrompt }>().then(r => r.prompt),
        updatePrompt: async (id, params) => {
          await client.put(`admin/prompts/${id}`, { json: params });
        },

        // Providers
        listProviders: () => client.get('admin/providers').json(),
        updateProvider: async (providerId, params) => {
          await client.put(`admin/providers/${providerId}`, { json: params });
        },
        checkProviderHealth: (providerId) => client.post(`admin/providers/${providerId}/health`).json(),

        // Features
        listFeatures: () => client.get('admin/features').json(),
        updateFeature: async (featureId, params) => {
          await client.put(`admin/features/${featureId}`, { json: params });
        },

        // Subscriptions
        listSubscriptions: (params) => client.get('admin/subscriptions', { searchParams: params as Record<string, string | number> ?? {} }).json(),
        getSubscription: (subscriptionId) => client.get(`admin/subscriptions/${subscriptionId}`).json(),

        // Analytics
        getUsage: (params) => client.get('admin/analytics/usage', { searchParams: params as Record<string, string | number> ?? {} }).json(),
        getCostAnalytics: (params) => client.get('admin/analytics/costs', { searchParams: params as Record<string, string | number> ?? {} }).json(),
        getRevenueAnalytics: (params) => client.get('admin/analytics/revenue', { searchParams: params as Record<string, string | number> ?? {} }).json(),

        // Audit
        listAuditEvents: (params) => client.get('admin/audit', { searchParams: params as Record<string, string | number> ?? {} }).json(),
        getAuditEvent: (eventId) => client.get(`admin/audit/${eventId}`).json(),
      },
    }),
    [client]
  );

  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}
