/**
 * AUI Clustering Handlers
 *
 * MCP handlers for cluster discovery and management.
 *
 * @module @humanizer/core/mcp/handlers/aui/clustering
 */

import type { MCPResult } from '../../types.js';
import { jsonResult, errorResult, getService } from './helpers.js';

export async function handleClusterDiscover(args: {
  sampleSize?: number;
  minClusterSize?: number;
  maxClusters?: number;
  minSimilarity?: number;
  excludePatterns?: string[];
  minWordCount?: number;
  sourceTypes?: string[];
  authorRoles?: ('user' | 'assistant')[];
  generateLabels?: boolean;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const result = await service.discoverClusters({
      sampleSize: args.sampleSize,
      minClusterSize: args.minClusterSize,
      maxClusters: args.maxClusters,
      minSimilarity: args.minSimilarity,
      excludePatterns: args.excludePatterns,
      minWordCount: args.minWordCount,
      sourceTypes: args.sourceTypes,
      authorRoles: args.authorRoles,
      generateLabels: args.generateLabels,
    });
    return jsonResult({
      clusters: result.clusters.map(c => ({
        id: c.id,
        label: c.label,
        description: c.description.substring(0, 200),
        totalPassages: c.totalPassages,
        coherence: c.coherence,
        keywords: c.keywords.slice(0, 5),
      })),
      totalPassages: result.totalPassages,
      assignedPassages: result.assignedPassages,
      noisePassages: result.noisePassages,
      durationMs: result.durationMs,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleClusterList(): Promise<MCPResult> {
  try {
    const service = getService();
    const clusters = await service.listClusters();
    return jsonResult({
      clusters: clusters.map(c => ({
        id: c.id,
        label: c.label,
        totalPassages: c.totalPassages,
        coherence: c.coherence,
        keywords: c.keywords?.slice(0, 5) || [],
        sourceDistribution: c.sourceDistribution,
      })),
      count: clusters.length,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}

export async function handleClusterGet(args: {
  clusterId: string;
  passageLimit?: number;
}): Promise<MCPResult> {
  try {
    const service = getService();
    const cluster = await service.getCluster(args.clusterId);
    if (!cluster) {
      return errorResult(`Cluster "${args.clusterId}" not found`);
    }

    const passageLimit = args.passageLimit ?? 10;
    return jsonResult({
      id: cluster.id,
      label: cluster.label,
      description: cluster.description,
      passages: cluster.passages.slice(0, passageLimit).map(p => ({
        id: p.id,
        text: p.text.substring(0, 300) + (p.text.length > 300 ? '...' : ''),
        sourceType: p.sourceType,
        wordCount: p.wordCount,
      })),
      totalPassages: cluster.totalPassages,
      coherence: cluster.coherence,
      keywords: cluster.keywords,
      sourceDistribution: cluster.sourceDistribution,
      dateRange: cluster.dateRange,
      avgWordCount: cluster.avgWordCount,
    });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}
