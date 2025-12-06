/**
 * Node Admin Service
 *
 * Service layer for node administration:
 * - Health checks
 * - Pyramid stats
 * - Rebuild operations
 * - Curator prompt testing
 */

import { api } from './api';

// ==========================================
// Types
// ==========================================

export interface NodeHealth {
  nodeId: string;
  nodeName: string;
  hasChunks: boolean;
  hasSummaries: boolean;
  hasApex: boolean;
  hasEmbeddings: boolean;
  pyramidDepth: number;
  chunkCount: number;
  issues: string[];
  recommendations: string[];
}

export interface AllNodesHealth {
  total: number;
  healthy: number;
  unhealthy: number;
  nodes: NodeHealth[];
}

export interface PyramidStats {
  nodeId: string;
  stats: {
    chunkCount: number;
    summaryCount: number;
    levelCounts: Record<number, number>;
    hasApex: boolean;
  };
  apex: {
    narrativeArc: string;
    coreThemes: string[];
    theQuestion: string;
    resonanceHooks: string[];
    lifecycleState: string;
    sourceTitle?: string;
    sourceAuthor?: string;
  } | null;
}

export interface RebuildConfig {
  sourceType: 'gutenberg' | 'raw_text' | 'existing_chunks';
  sourceId?: string;          // Gutenberg ID
  rawText?: string;           // For raw_text mode
  rebuildOptions: {
    deleteExisting: boolean;
    rebuildChunks: boolean;
    rebuildSummaries: boolean;
    rebuildApex: boolean;
    rebuildEmbeddings: boolean;
  };
  pyramidConfig?: {
    branchingFactor?: number;
    summaryTargetWords?: number;
    apexTargetWords?: number;
  };
}

export interface RebuildResult {
  success: boolean;
  nodeId: string;
  error?: string;
  stats: {
    chunksCreated: number;
    summariesCreated: number;
    apexCreated: boolean;
    embeddingsCreated: number;
    processingTimeMs: number;
  };
  apex?: {
    narrativeArc: string;
    coreThemes: string[];
    theQuestion: string;
    resonanceHooks: string[];
  };
  metadata?: any;
}

export interface RebuildStatus {
  nodeId: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  phase?: 'chunks' | 'summaries' | 'apex' | 'embeddings' | 'complete';
  progress?: {
    phase: string;
    currentLevel: number;
    totalLevels: number;
    itemsProcessed: number;
    itemsTotal: number;
  };
  result?: RebuildResult;
  startedAt?: number;
  completedAt?: number;
}

export interface CuratorPrompt {
  nodeId: string;
  prompt: string;
  characterCount: number;
  wordCount: number;
}

// ==========================================
// API Calls
// ==========================================

/**
 * Get health check for a specific node
 */
export async function getNodeHealth(
  nodeId: string,
  token: string
): Promise<NodeHealth> {
  return api.get(`/api/admin/node/${nodeId}/health`, token);
}

/**
 * Get health check for all nodes
 */
export async function getAllNodesHealth(
  token: string
): Promise<AllNodesHealth> {
  return api.get(`/api/admin/node/health`, token);
}

/**
 * Get pyramid statistics for a node
 */
export async function getNodePyramidStats(
  nodeId: string,
  token: string
): Promise<PyramidStats> {
  return api.get(`/api/admin/node/${nodeId}/pyramid`, token);
}

/**
 * Get curator prompt for a node
 */
export async function getCuratorPrompt(
  nodeId: string,
  token: string
): Promise<CuratorPrompt> {
  return api.get(`/api/admin/node/${nodeId}/curator-prompt`, token);
}

/**
 * Trigger a full node rebuild
 */
export async function rebuildNode(
  nodeId: string,
  config: RebuildConfig,
  token: string
): Promise<{ message: string; nodeId: string; nodeName: string; config: RebuildConfig }> {
  return api.post(`/api/admin/node/${nodeId}/rebuild`, config, token);
}

/**
 * Get rebuild status
 */
export async function getRebuildStatus(
  nodeId: string,
  token: string
): Promise<RebuildStatus> {
  return api.get(`/api/admin/node/${nodeId}/rebuild-status`, token);
}

/**
 * Clear rebuild status
 */
export async function clearRebuildStatus(
  nodeId: string,
  token: string
): Promise<void> {
  await api.delete(`/api/admin/node/${nodeId}/rebuild-status`, token);
}

/**
 * Quick fix: Rebuild only apex
 */
export async function rebuildApex(
  nodeId: string,
  token: string
): Promise<{ message: string; nodeId: string }> {
  return api.post(`/api/admin/node/${nodeId}/rebuild-apex`, {}, token);
}

/**
 * Quick fix: Rebuild only embeddings
 */
export async function rebuildEmbeddings(
  nodeId: string,
  token: string
): Promise<{ message: string; nodeId: string }> {
  return api.post(`/api/admin/node/${nodeId}/rebuild-embeddings`, {}, token);
}

/**
 * Batch rebuild multiple nodes
 */
export async function rebuildBatch(
  nodeIds: string[],
  config: RebuildConfig,
  maxConcurrent: number,
  token: string
): Promise<{ message: string; total: number; processed: number; results: any[] }> {
  return api.post(`/api/admin/node/rebuild-batch`, {
    nodeIds,
    config,
    maxConcurrent,
  }, token);
}

// Export service object
export const nodeAdminService = {
  getNodeHealth,
  getAllNodesHealth,
  getNodePyramidStats,
  getCuratorPrompt,
  rebuildNode,
  getRebuildStatus,
  clearRebuildStatus,
  rebuildApex,
  rebuildEmbeddings,
  rebuildBatch,
};
