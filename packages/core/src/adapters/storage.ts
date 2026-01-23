/**
 * UCG Storage Bridge
 *
 * This module provides backward-compatible exports for the storage layer,
 * delegating to the PostgreSQL-backed ContentStore.
 *
 * MIGRATION NOTE (Jan 2026): 
 * - SQLite implementation has been replaced with PostgreSQL + pgvector
 * - All methods are now natively async (no more sync-to-async wrapping)
 * - InMemoryUCGStorage has been removed
 */

import {
  PostgresContentStore,
  getContentStore,
  initContentStore,
  closeContentStore,
} from '../storage/postgres-content-store.js';
import type {
  StoredNode,
  StoredLink,
  ImportJob,
  QueryOptions,
  QueryResult,
  ContentStoreStats,
  BatchStoreResult,
} from '../storage/types.js';
import type { PostgresStorageConfig } from '../storage/schema-postgres.js';
import type { ImportedNode, ParseStats, ImportProgress } from './types.js';

// ═══════════════════════════════════════════════════════════════════
// RE-EXPORTS from new storage module
// ═══════════════════════════════════════════════════════════════════

// Re-export types with backward-compatible names
export type { StoredNode as StoredContentNode };
export type { StoredLink as StoredContentLink };
export type { ImportJob };
export type { QueryOptions as NodeQueryOptions };
export type { QueryResult as NodeQueryResult };
export type { PostgresStorageConfig as StorageConfig };

// ═══════════════════════════════════════════════════════════════════
// UCGSTORAGE INTERFACE (backward compatibility)
// ═══════════════════════════════════════════════════════════════════

/**
 * UCG Storage interface
 *
 * @deprecated Use PostgresContentStore directly from '../storage/postgres-content-store.js'
 */
export interface UCGStorage {
  storeNode(node: ImportedNode, jobId?: string): Promise<StoredNode>;
  storeNodes(nodes: ImportedNode[], jobId?: string): Promise<BatchStoreResult>;
  getNode(uri: string): Promise<StoredNode | undefined>;
  getNodeByHash(hash: string): Promise<StoredNode | undefined>;
  queryNodes(options: QueryOptions): Promise<QueryResult>;
  deleteNode(uri: string): Promise<boolean>;
  deleteByJob(jobId: string): Promise<number>;
  createLink(link: { type: string; targetUri: string; metadata?: unknown }, sourceUri: string): Promise<StoredLink>;
  getLinksFrom(uri: string): Promise<StoredLink[]>;
  getLinksTo(uri: string): Promise<StoredLink[]>;
  deleteLink(id: string): Promise<boolean>;
  createJob(adapterId: string, sourcePath: string): Promise<ImportJob>;
  updateJob(jobId: string, update: Partial<ImportJob>): Promise<void>;
  getJob(jobId: string): Promise<ImportJob | undefined>;
  getJobs(status?: ImportJob['status']): Promise<ImportJob[]>;
  getStats(): Promise<ContentStoreStats>;
  healthCheck(): Promise<boolean>;
}

// ═══════════════════════════════════════════════════════════════════
// CONTENT STORE ADAPTER (pass-through for PostgresContentStore)
// ═══════════════════════════════════════════════════════════════════

/**
 * Adapter that wraps PostgresContentStore with UCGStorage interface
 * 
 * Now just a thin pass-through since PostgresContentStore is natively async.
 */
export class ContentStoreAdapter implements UCGStorage {
  private store: PostgresContentStore;

  constructor(store: PostgresContentStore) {
    this.store = store;
  }

  async storeNode(node: ImportedNode, jobId?: string): Promise<StoredNode> {
    return this.store.storeNode(node, jobId);
  }

  async storeNodes(nodes: ImportedNode[], jobId?: string): Promise<BatchStoreResult> {
    return this.store.storeNodes(nodes, jobId);
  }

  async getNode(uri: string): Promise<StoredNode | undefined> {
    return this.store.getNodeByUri(uri);
  }

  async getNodeByHash(hash: string): Promise<StoredNode | undefined> {
    return this.store.getNodeByHash(hash);
  }

  async queryNodes(options: QueryOptions): Promise<QueryResult> {
    return this.store.queryNodes(options);
  }

  async deleteNode(uri: string): Promise<boolean> {
    const node = await this.store.getNodeByUri(uri);
    if (!node) return false;
    return this.store.deleteNode(node.id);
  }

  async deleteByJob(jobId: string): Promise<number> {
    return this.store.deleteByJob(jobId);
  }

  async createLink(
    link: { type: string; targetUri: string; metadata?: unknown },
    sourceUri: string
  ): Promise<StoredLink> {
    const sourceNode = await this.store.getNodeByUri(sourceUri);
    if (!sourceNode) {
      throw new Error(`Source node not found: ${sourceUri}`);
    }
    return this.store.createLink(sourceNode.id, {
      type: link.type as any,
      targetUri: link.targetUri,
      metadata: link.metadata as Record<string, unknown> | undefined,
    });
  }

  async getLinksFrom(uri: string): Promise<StoredLink[]> {
    const node = await this.store.getNodeByUri(uri);
    if (!node) return [];
    return this.store.getLinksFrom(node.id);
  }

  async getLinksTo(uri: string): Promise<StoredLink[]> {
    const node = await this.store.getNodeByUri(uri);
    if (!node) return [];
    return this.store.getLinksTo(node.id);
  }

  async deleteLink(id: string): Promise<boolean> {
    // Links are deleted via CASCADE when nodes are deleted
    // Direct link deletion not implemented in new schema
    return false;
  }

  async createJob(adapterId: string, sourcePath: string): Promise<ImportJob> {
    return this.store.createJob(adapterId, sourcePath);
  }

  async updateJob(jobId: string, update: Partial<ImportJob>): Promise<void> {
    return this.store.updateJob(jobId, update);
  }

  async getJob(jobId: string): Promise<ImportJob | undefined> {
    return this.store.getJob(jobId);
  }

  async getJobs(status?: ImportJob['status']): Promise<ImportJob[]> {
    return this.store.getJobs(status);
  }

  async getStats(): Promise<ContentStoreStats> {
    return this.store.getStats();
  }

  async healthCheck(): Promise<boolean> {
    return this.store.healthCheck();
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

let _storage: UCGStorage | null = null;

/**
 * Get the UCG storage instance
 *
 * @deprecated Use getContentStore() from '../storage/postgres-content-store.js' instead
 */
export function getUCGStorage(): UCGStorage {
  if (!_storage) {
    // Wrap the PostgresContentStore with adapter
    _storage = new ContentStoreAdapter(getContentStore());
  }
  return _storage;
}

/**
 * Set a custom UCG storage instance
 *
 * @deprecated Initialize ContentStore directly
 */
export function setUCGStorage(storage: UCGStorage): void {
  _storage = storage;
}

/**
 * Reset the UCG storage
 *
 * @deprecated Use closeContentStore() instead
 */
export function resetUCGStorage(): void {
  _storage = null;
}

// ═══════════════════════════════════════════════════════════════════
// IMPORT SERVICE
// ═══════════════════════════════════════════════════════════════════

/**
 * Import service that coordinates adapters and storage
 */
export class ImportService {
  private storage: UCGStorage;
  private onProgress?: (progress: ImportProgress) => void;

  constructor(
    storage: UCGStorage,
    onProgress?: (progress: ImportProgress) => void
  ) {
    this.storage = storage;
    this.onProgress = onProgress;
  }

  /**
   * Run an import job
   */
  async runImport(
    adapter: {
      id: string;
      parse: (
        source: { type: string; path: string },
        options?: { onProgress?: (p: ImportProgress) => void; jobId?: string }
      ) => AsyncGenerator<ImportedNode, ParseStats, undefined>;
    },
    sourcePath: string
  ): Promise<ImportJob> {
    // Create job
    const job = await this.storage.createJob(adapter.id, sourcePath);

    try {
      await this.storage.updateJob(job.id, {
        status: 'running',
        startedAt: Date.now(),
      });

      const source = { type: 'directory' as const, path: sourcePath };
      const generator = adapter.parse(source, {
        onProgress: this.onProgress,
        jobId: job.id,
      });

      let stats: ParseStats | undefined;
      let nodesImported = 0;
      let nodesSkipped = 0;
      let nodesFailed = 0;
      let linksCreated = 0;

      while (true) {
        const result = await generator.next();

        if (result.done) {
          stats = result.value;
          break;
        }

        // Store the node
        try {
          const existing = await this.storage.getNodeByHash(result.value.contentHash);
          if (existing) {
            nodesSkipped++;
          } else {
            await this.storage.storeNode(result.value, job.id);
            nodesImported++;

            // Count links
            if (result.value.links) {
              linksCreated += result.value.links.length;
            }
          }
        } catch {
          nodesFailed++;
        }

        // Update job periodically
        if ((nodesImported + nodesSkipped + nodesFailed) % 100 === 0) {
          await this.storage.updateJob(job.id, {
            nodesImported,
            nodesSkipped,
            nodesFailed,
            linksCreated,
          });
        }
      }

      await this.storage.updateJob(job.id, {
        status: 'completed',
        completedAt: Date.now(),
        nodesImported,
        nodesSkipped,
        nodesFailed,
        linksCreated,
        stats: stats as unknown as Record<string, unknown> | undefined,
      });

      return (await this.storage.getJob(job.id)) as ImportJob;
    } catch (error) {
      await this.storage.updateJob(job.id, {
        status: 'failed',
        completedAt: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      });

      return (await this.storage.getJob(job.id)) as ImportJob;
    }
  }
}
