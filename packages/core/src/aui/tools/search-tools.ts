/**
 * Search Tool Handlers
 *
 * Tool handlers for archive search and clustering.
 * Provides semantic search, cluster discovery, and archive stats.
 *
 * @module @humanizer/core/aui/tools/search-tools
 */

import type { ToolResult } from '../types.js';
import type { ToolRegistration, ToolHandler } from '../tool-registry.js';
import type { ClusteringMethods, ArchiveMethods } from '../service/archive-clustering.js';
import { SEARCH_TOOLS } from '../tool-definitions.js';

// ═══════════════════════════════════════════════════════════════════════════
// HANDLER FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create search/archive tool handlers
 */
export function createSearchToolHandlers(
  clustering?: ClusteringMethods,
  archive?: ArchiveMethods
): ToolRegistration[] {
  const handlers: Record<string, ToolHandler> = {
    // ─────────────────────────────────────────────────────────────────────────
    // SEARCH
    // ─────────────────────────────────────────────────────────────────────────

    search_archive: async (args) => {
      // Search requires the BookMethods.harvest() which uses agentic search
      // For now, we use clustering's search if available
      if (!clustering) {
        return { success: false, error: 'Search not configured - clustering methods required' };
      }

      // Use cluster discovery as a form of search
      const result = await clustering.discoverClusters({
        sampleSize: (args.limit as number) ?? 50,
        minSimilarity: (args.minRelevance as number) ?? 0.5,
        sourceTypes: args.sourceTypes as string[] | undefined,
        authorRoles: args.authorRoles as ('user' | 'assistant')[] | undefined,
      });

      // Flatten passages from clusters for search-like results
      const passages = result.clusters.flatMap(c =>
        c.passages.map(p => ({
          id: p.id,
          text: p.text.substring(0, 300) + (p.text.length > 300 ? '...' : ''),
          sourceType: p.sourceType,
          relevance: 1 - p.distanceFromCentroid,
          cluster: c.label,
        }))
      );

      return {
        success: true,
        data: {
          query: args.query,
          resultCount: passages.length,
          results: passages.slice(0, (args.limit as number) ?? 50),
        },
      };
    },

    search_refine: async (args) => {
      // Refinement would ideally track previous searches
      // For now, treat as a new search with combined criteria
      if (!clustering) {
        return { success: false, error: 'Search not configured' };
      }

      const result = await clustering.discoverClusters({
        sampleSize: 100,
        minSimilarity: 0.6,
      });

      const passages = result.clusters.flatMap(c => c.passages);
      const excludeSet = new Set(args.excludeIds as string[] ?? []);
      const filtered = passages.filter(p => !excludeSet.has(p.id));

      return {
        success: true,
        data: {
          originalQuery: args.previousQuery,
          refinement: args.refinement,
          resultCount: filtered.length,
          results: filtered.slice(0, 20).map(p => ({
            id: p.id,
            text: p.text.substring(0, 200),
            sourceType: p.sourceType,
          })),
        },
      };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // CLUSTERING
    // ─────────────────────────────────────────────────────────────────────────

    cluster_discover: async (args) => {
      if (!clustering) {
        return { success: false, error: 'Clustering not configured' };
      }

      const result = await clustering.discoverClusters({
        sampleSize: args.sampleSize as number | undefined,
        minClusterSize: args.minClusterSize as number | undefined,
        maxClusters: args.maxClusters as number | undefined,
        minSimilarity: args.minSimilarity as number | undefined,
        sourceTypes: args.sourceTypes as string[] | undefined,
        authorRoles: args.authorRoles as ('user' | 'assistant')[] | undefined,
      });

      return {
        success: true,
        data: {
          clusterCount: result.clusters.length,
          totalPassages: result.totalPassages,
          assignedPassages: result.assignedPassages,
          noisePassages: result.noisePassages,
          durationMs: result.durationMs,
          clusters: result.clusters.map(c => ({
            id: c.id,
            label: c.label,
            passageCount: c.totalPassages,
            coherence: c.coherence,
            keywords: c.keywords.slice(0, 5),
          })),
        },
      };
    },

    cluster_list: async (args) => {
      if (!clustering) {
        return { success: false, error: 'Clustering not configured' };
      }

      const clusters = await clustering.listClusters({
        userId: args.userId as string | undefined,
        limit: args.limit as number | undefined,
      });

      return {
        success: true,
        data: clusters.map(c => ({
          id: c.id,
          label: c.label,
          description: c.description?.substring(0, 100),
          passageCount: c.totalPassages,
          coherence: c.coherence,
          keywords: c.keywords.slice(0, 5),
        })),
      };
    },

    cluster_get: async (args) => {
      if (!clustering) {
        return { success: false, error: 'Clustering not configured' };
      }

      const cluster = await clustering.getCluster(args.clusterId as string);

      if (!cluster) {
        return { success: false, error: `Cluster "${args.clusterId}" not found` };
      }

      return {
        success: true,
        data: {
          id: cluster.id,
          label: cluster.label,
          description: cluster.description,
          totalPassages: cluster.totalPassages,
          coherence: cluster.coherence,
          keywords: cluster.keywords,
          sourceDistribution: cluster.sourceDistribution,
          dateRange: cluster.dateRange,
          avgWordCount: cluster.avgWordCount,
          passages: cluster.passages.slice(0, 20).map(p => ({
            id: p.id,
            text: p.text.substring(0, 200) + (p.text.length > 200 ? '...' : ''),
            sourceType: p.sourceType,
            wordCount: p.wordCount,
            distanceFromCentroid: p.distanceFromCentroid,
          })),
        },
      };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // ARCHIVE
    // ─────────────────────────────────────────────────────────────────────────

    archive_stats: async () => {
      if (!archive) {
        return { success: false, error: 'Archive methods not configured' };
      }

      const stats = await archive.getArchiveStats();

      return {
        success: true,
        data: {
          totalNodes: stats.totalNodes,
          nodesWithEmbeddings: stats.nodesWithEmbeddings,
          nodesNeedingEmbeddings: stats.nodesNeedingEmbeddings,
          embeddingCoverage: `${stats.embeddingCoverage.toFixed(1)}%`,
          bySourceType: stats.bySourceType,
          byAuthorRole: stats.byAuthorRole,
          dateRange: stats.dateRange,
          avgWordCount: stats.avgWordCount,
          totalWordCount: stats.totalWordCount,
        },
      };
    },

    archive_embed: async (args) => {
      if (!archive) {
        return { success: false, error: 'Archive methods not configured' };
      }

      const result = await archive.embedAll({
        limit: args.limit as number | undefined,
        batchSize: args.batchSize as number | undefined,
        minWordCount: args.minWordCount as number | undefined,
        sourceTypes: args.sourceTypes as string[] | undefined,
      });

      return {
        success: result.success,
        data: {
          embedded: result.embedded,
          skipped: result.skipped,
          failed: result.failed,
          durationMs: result.durationMs,
          errorCount: result.errors?.length ?? 0,
        },
        error: result.error,
      };
    },
  };

  // Build registrations from definitions
  return SEARCH_TOOLS.map(def => ({
    definition: def,
    handler: handlers[def.name],
    category: 'search' as const,
  })).filter(reg => reg.handler !== undefined);
}
