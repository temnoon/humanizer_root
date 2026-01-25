/**
 * Unified AUI Service - Archive & Clustering Methods
 *
 * Archive embedding and clustering operations.
 *
 * @module @humanizer/core/aui/service/archive-clustering
 */

import type {
  ArchiveStats,
  EmbedAllOptions,
  EmbedResult,
  ClusterDiscoveryOptions,
  ClusterDiscoveryResult,
  ContentCluster,
} from '../types.js';
import type { StoredNode } from '../../storage/types.js';
import type { ServiceDependencies } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════
// ARCHIVE & EMBEDDING METHODS
// ═══════════════════════════════════════════════════════════════════════════

export interface ArchiveMethods {
  getArchiveStats(): Promise<ArchiveStats>;
  embedAll(options?: EmbedAllOptions): Promise<EmbedResult>;
  embedBatch(nodeIds: string[]): Promise<EmbedResult>;
}

export function createArchiveMethods(deps: ServiceDependencies): ArchiveMethods {
  return {
    async getArchiveStats(): Promise<ArchiveStats> {
      const { getContentStore } = await import('../../storage/postgres-content-store.js');
      const store = getContentStore();

      if (!store) {
        throw new Error('Content store not initialized');
      }

      const storeStats = await store.getStats();
      const nodesNeedingEmbeddings = await store.getNodesNeedingEmbeddings(1);

      return {
        totalNodes: storeStats.totalNodes,
        nodesWithEmbeddings: storeStats.nodesWithEmbeddings,
        nodesNeedingEmbeddings: storeStats.totalNodes - storeStats.nodesWithEmbeddings,
        embeddingCoverage:
          storeStats.totalNodes > 0
            ? (storeStats.nodesWithEmbeddings / storeStats.totalNodes) * 100
            : 0,
        bySourceType: storeStats.nodesBySourceType,
        byAuthorRole: {},
        dateRange: { earliest: null, latest: null },
        avgWordCount: 0,
        totalWordCount: 0,
      };
    },

    async embedAll(options?: EmbedAllOptions): Promise<EmbedResult> {
      const startTime = Date.now();
      const errors: Array<{ nodeId: string; error: string }> = [];

      try {
        const { getContentStore } = await import('../../storage/postgres-content-store.js');
        const { getEmbeddingService } = await import('../../embeddings/embedding-service.js');

        const store = getContentStore();
        const embeddingService = getEmbeddingService();

        if (!store) throw new Error('Content store not initialized');
        if (!embeddingService) throw new Error('Embedding service not initialized');

        const available = await embeddingService.isAvailable();
        if (!available) {
          return {
            success: false,
            embedded: 0,
            skipped: 0,
            failed: 0,
            durationMs: Date.now() - startTime,
            error: 'Ollama embedding service not available',
            errors: [],
          };
        }

        const limit = options?.limit || 100000;
        const nodesNeedingEmbeddings = await store.getNodesNeedingEmbeddings(limit);

        let nodesToEmbed: StoredNode[] = nodesNeedingEmbeddings;

        // Filter by word count
        const minWordCount = options?.minWordCount ?? 7;
        if (minWordCount > 0) {
          nodesToEmbed = nodesToEmbed.filter((node: StoredNode) => {
            const wordCount = node.text?.split(/\s+/).filter(Boolean).length || 0;
            return wordCount >= minWordCount;
          });
        }

        // Filter by source type
        if (options?.sourceTypes?.length) {
          nodesToEmbed = nodesToEmbed.filter((node: StoredNode) =>
            options.sourceTypes!.includes(node.sourceType || '')
          );
        }

        // Filter by author role
        if (options?.authorRoles?.length) {
          nodesToEmbed = nodesToEmbed.filter((node: StoredNode) =>
            options.authorRoles!.includes(
              (node as StoredNode & { authorRole?: string }).authorRole as any
            )
          );
        }

        // Apply custom content filter
        if (options?.contentFilter) {
          nodesToEmbed = nodesToEmbed.filter((node: StoredNode) =>
            options.contentFilter!(node.text || '')
          );
        }

        const skipped = nodesNeedingEmbeddings.length - nodesToEmbed.length;
        const batchSize = options?.batchSize || 50;
        const totalBatches = Math.ceil(nodesToEmbed.length / batchSize);

        let embedded = 0;
        let failed = 0;

        for (let i = 0; i < nodesToEmbed.length; i += batchSize) {
          const batch = nodesToEmbed.slice(i, i + batchSize);
          const currentBatch = Math.floor(i / batchSize) + 1;

          if (options?.onProgress) {
            options.onProgress({
              phase: 'embedding',
              processed: embedded,
              total: nodesToEmbed.length,
              currentBatch,
              totalBatches,
              skipped,
              failed,
              elapsedMs: Date.now() - startTime,
              estimatedRemainingMs:
                embedded > 0
                  ? ((Date.now() - startTime) / embedded) * (nodesToEmbed.length - embedded)
                  : 0,
              errors: errors.map(e => e.error),
            });
          }

          try {
            const results = await embeddingService.embedNodes(batch as any);

            for (const result of results) {
              try {
                await store.storeEmbedding(
                  result.nodeId,
                  result.embedding,
                  embeddingService.getEmbedModel()
                );
                embedded++;
              } catch (storeError) {
                failed++;
                errors.push({
                  nodeId: result.nodeId,
                  error: storeError instanceof Error ? storeError.message : String(storeError),
                });
              }
            }
          } catch (batchError) {
            failed += batch.length;
            for (const node of batch) {
              errors.push({
                nodeId: node.id,
                error: batchError instanceof Error ? batchError.message : String(batchError),
              });
            }
          }
        }

        if (options?.onProgress) {
          options.onProgress({
            phase: 'complete',
            processed: embedded,
            total: nodesToEmbed.length,
            currentBatch: totalBatches,
            totalBatches,
            skipped,
            failed,
            elapsedMs: Date.now() - startTime,
            estimatedRemainingMs: 0,
            errors: errors.map(e => e.error),
          });
        }

        return {
          success: failed === 0,
          embedded,
          skipped,
          failed,
          durationMs: Date.now() - startTime,
          errors,
        };
      } catch (error) {
        return {
          success: false,
          embedded: 0,
          skipped: 0,
          failed: 0,
          durationMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
          errors,
        };
      }
    },

    async embedBatch(nodeIds: string[]): Promise<EmbedResult> {
      const startTime = Date.now();
      const errors: Array<{ nodeId: string; error: string }> = [];

      try {
        const { getContentStore } = await import('../../storage/postgres-content-store.js');
        const { getEmbeddingService } = await import('../../embeddings/embedding-service.js');

        const store = getContentStore();
        const embeddingService = getEmbeddingService();

        if (!store) throw new Error('Content store not initialized');
        if (!embeddingService) throw new Error('Embedding service not initialized');

        const available = await embeddingService.isAvailable();
        if (!available) {
          return {
            success: false,
            embedded: 0,
            skipped: 0,
            failed: 0,
            durationMs: Date.now() - startTime,
            error: 'Ollama embedding service not available',
            errors: [],
          };
        }

        const nodes = await Promise.all(nodeIds.map(id => store.getNode(id)));
        const validNodes = nodes.filter(Boolean) as any[];

        const results = await embeddingService.embedNodes(validNodes);

        let embedded = 0;
        let failed = 0;

        for (const result of results) {
          try {
            await store.storeEmbedding(
              result.nodeId,
              result.embedding,
              embeddingService.getEmbedModel()
            );
            embedded++;
          } catch (storeError) {
            failed++;
            errors.push({
              nodeId: result.nodeId,
              error: storeError instanceof Error ? storeError.message : String(storeError),
            });
          }
        }

        return {
          success: failed === 0,
          embedded,
          skipped: nodeIds.length - validNodes.length,
          failed,
          durationMs: Date.now() - startTime,
          errors,
        };
      } catch (error) {
        return {
          success: false,
          embedded: 0,
          skipped: 0,
          failed: 0,
          durationMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
          errors,
        };
      }
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CLUSTERING METHODS
// ═══════════════════════════════════════════════════════════════════════════

export interface ClusteringMethods {
  discoverClusters(options?: ClusterDiscoveryOptions): Promise<ClusterDiscoveryResult>;
  listClusters(options?: { userId?: string; limit?: number }): Promise<ContentCluster[]>;
  getCluster(clusterId: string): Promise<ContentCluster | undefined>;
  saveCluster(cluster: ContentCluster, userId?: string): Promise<ContentCluster>;
}

export function createClusteringMethods(deps: ServiceDependencies): ClusteringMethods {
  const methods: ClusteringMethods = {
    async discoverClusters(options?: ClusterDiscoveryOptions): Promise<ClusterDiscoveryResult> {
      const startTime = Date.now();

      try {
        const { getContentStore } = await import('../../storage/postgres-content-store.js');
        const store = getContentStore();

        if (!store) throw new Error('Content store not initialized');

        if (options?.onProgress) {
          options.onProgress({
            phase: 'loading',
            step: 1,
            totalSteps: 4,
            message: 'Loading embeddings...',
          });
        }

        const sampleSize = options?.sampleSize || 500;
        const randomNodeIds = await store.getRandomEmbeddedNodeIds(sampleSize);

        if (randomNodeIds.length === 0) {
          return {
            clusters: [],
            totalPassages: 0,
            assignedPassages: 0,
            noisePassages: 0,
            durationMs: Date.now() - startTime,
          };
        }

        const nodes: StoredNode[] = [];
        for (const id of randomNodeIds) {
          const node = await store.getNode(id);
          if (node) nodes.push(node);
        }

        let filteredNodes = nodes;

        // Filter by word count
        const minWordCount = options?.minWordCount ?? 7;
        if (minWordCount > 0) {
          filteredNodes = filteredNodes.filter(node => {
            const wordCount = node.text?.split(/\s+/).filter(Boolean).length || 0;
            return wordCount >= minWordCount;
          });
        }

        // Filter by exclude patterns
        if (options?.excludePatterns?.length) {
          const patterns = options.excludePatterns.map(p => new RegExp(p, 'i'));
          filteredNodes = filteredNodes.filter(
            node => !patterns.some(p => p.test(node.text || ''))
          );
        }

        // Filter by source type
        if (options?.sourceTypes?.length) {
          filteredNodes = filteredNodes.filter(node =>
            options.sourceTypes!.includes(node.sourceType || '')
          );
        }

        // Filter by author role
        const authorRoles: string[] = options?.authorRoles || ['user'];
        filteredNodes = filteredNodes.filter(node =>
          authorRoles.includes((node as StoredNode & { authorRole?: string }).authorRole || 'user')
        );

        if (options?.onProgress) {
          options.onProgress({
            phase: 'clustering',
            step: 2,
            totalSteps: 4,
            message: `Clustering ${filteredNodes.length} passages...`,
          });
        }

        const maxClusters = options?.maxClusters || 10;
        const minClusterSize = options?.minClusterSize || 5;
        const minSimilarity = options?.minSimilarity || 0.7;

        const clusters: ContentCluster[] = [];
        const assigned = new Set<string>();

        const seedCandidates = filteredNodes.slice(0, Math.min(filteredNodes.length, 100));

        for (const seedNode of seedCandidates) {
          if (assigned.has(seedNode.id)) continue;
          if (clusters.length >= maxClusters) break;

          const seedEmbedding = await store.getEmbedding(seedNode.id);
          if (!seedEmbedding) continue;

          const similarResults = await store.searchByEmbedding(seedEmbedding, {
            limit: 100,
            threshold: minSimilarity,
          });
          const clusterMemberResults = similarResults.filter(
            r => !assigned.has(r.node.id) && r.node.id !== seedNode.id
          );

          if (clusterMemberResults.length + 1 >= minClusterSize) {
            const clusterPassages = [
              {
                id: seedNode.id,
                text: seedNode.text || '',
                sourceType: seedNode.sourceType || 'unknown',
                authorRole: (seedNode as StoredNode & { authorRole?: string }).authorRole,
                wordCount: seedNode.text?.split(/\s+/).filter(Boolean).length || 0,
                distanceFromCentroid: 0,
                sourceCreatedAt: seedNode.sourceCreatedAt
                  ? new Date(seedNode.sourceCreatedAt)
                  : undefined,
                title: (seedNode as StoredNode & { title?: string }).title,
              },
              ...clusterMemberResults.map(r => ({
                id: r.node.id,
                text: r.node.text || '',
                sourceType: r.node.sourceType || 'unknown',
                authorRole: (r.node as StoredNode & { authorRole?: string }).authorRole,
                wordCount: r.node.text?.split(/\s+/).filter(Boolean).length || 0,
                distanceFromCentroid: r.distance ?? 1 - r.score,
                sourceCreatedAt: r.node.sourceCreatedAt
                  ? new Date(r.node.sourceCreatedAt)
                  : undefined,
                title: (r.node as StoredNode & { title?: string }).title,
              })),
            ];

            // Extract keywords
            const allText = clusterPassages.map(p => p.text).join(' ');
            const words = allText.toLowerCase().split(/\s+/).filter(w => w.length > 4);
            const wordFreq = new Map<string, number>();
            for (const word of words) {
              wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
            }
            const keywords = [...wordFreq.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([word]) => word);

            // Source distribution
            const sourceDistribution: Record<string, number> = {};
            for (const p of clusterPassages) {
              sourceDistribution[p.sourceType] = (sourceDistribution[p.sourceType] || 0) + 1;
            }

            // Date range
            const dates = clusterPassages.filter(p => p.sourceCreatedAt).map(p => p.sourceCreatedAt!);
            const earliest =
              dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
            const latest =
              dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;

            const cluster: ContentCluster = {
              id: `cluster-${clusters.length + 1}`,
              label: keywords.slice(0, 3).join(', '),
              description: `Cluster around: ${seedNode.text?.substring(0, 100)}...`,
              passages: clusterPassages.slice(0, 20),
              totalPassages: clusterPassages.length,
              coherence:
                similarResults.reduce((sum, r) => sum + r.score, 0) / similarResults.length,
              keywords,
              sourceDistribution,
              dateRange: { earliest, latest },
              avgWordCount:
                clusterPassages.reduce((sum, p) => sum + p.wordCount, 0) / clusterPassages.length,
            };

            clusters.push(cluster);

            for (const p of clusterPassages) {
              assigned.add(p.id);
            }
          }
        }

        if (options?.onProgress) {
          options.onProgress({
            phase: 'complete',
            step: 4,
            totalSteps: 4,
            message: `Found ${clusters.length} clusters`,
          });
        }

        return {
          clusters,
          totalPassages: filteredNodes.length,
          assignedPassages: assigned.size,
          noisePassages: filteredNodes.length - assigned.size,
          durationMs: Date.now() - startTime,
        };
      } catch (error) {
        throw new Error(
          `Cluster discovery failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },

    async listClusters(options?: { userId?: string; limit?: number }): Promise<ContentCluster[]> {
      const store = deps.getStore();
      if (store) {
        try {
          const clusters = await store.listClusters(options);
          if (clusters.length > 0) {
            return clusters;
          }
        } catch (error) {
          console.warn('Failed to list clusters from store:', error);
        }
      }

      const result = await methods.discoverClusters({ maxClusters: options?.limit ?? 20 });
      return result.clusters;
    },

    async getCluster(clusterId: string): Promise<ContentCluster | undefined> {
      const store = deps.getStore();
      if (store) {
        try {
          const cluster = await store.getCluster(clusterId);
          if (cluster) {
            return cluster;
          }
        } catch (error) {
          console.warn('Failed to get cluster from store:', error);
        }
      }

      const clusters = await methods.listClusters();
      return clusters.find(c => c.id === clusterId);
    },

    async saveCluster(cluster: ContentCluster, userId?: string): Promise<ContentCluster> {
      const store = deps.getStore();
      if (!store) {
        return cluster;
      }

      try {
        return await store.saveCluster(cluster, userId);
      } catch (error) {
        console.warn('Failed to save cluster to store:', error);
        return cluster;
      }
    },
  };

  return methods;
}
