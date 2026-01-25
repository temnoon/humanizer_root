/**
 * AUI PostgreSQL Store - Cluster and Artifact Methods
 *
 * Cluster and artifact CRUD operations.
 *
 * @module @humanizer/core/storage/aui/clusters-artifacts
 */

import { randomUUID } from 'crypto';
import type { Pool } from 'pg';
import { toSql } from 'pgvector';
import type { ContentCluster } from '../../aui/types.js';
import {
  INSERT_AUI_CLUSTER,
  GET_AUI_CLUSTER,
  LIST_AUI_CLUSTERS,
  FIND_SIMILAR_CLUSTERS,
  DELETE_AUI_CLUSTER,
  CLEANUP_EXPIRED_CLUSTERS,
  INSERT_AUI_ARTIFACT,
  GET_AUI_ARTIFACT,
  LIST_AUI_ARTIFACTS,
  UPDATE_AUI_ARTIFACT_DOWNLOAD,
  DELETE_AUI_ARTIFACT,
  CLEANUP_EXPIRED_ARTIFACTS,
} from '../schema-aui.js';
import type { DbClusterRow, DbArtifactRow } from './row-types.js';
import { rowToCluster, rowToArtifact } from './converters.js';
import type { AuiArtifact, CreateArtifactOptions, AuiPostgresStoreOptions } from './types.js';
import { DEFAULT_STORE_OPTIONS } from './types.js';

export interface ClusterArtifactStoreMethods {
  // Cluster methods
  saveCluster(cluster: ContentCluster, userId?: string): Promise<ContentCluster>;
  getCluster(id: string): Promise<ContentCluster | undefined>;
  listClusters(options?: {
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ContentCluster[]>;
  findSimilarClusters(
    embedding: number[],
    limit?: number
  ): Promise<Array<ContentCluster & { similarity: number }>>;
  deleteCluster(id: string): Promise<boolean>;
  cleanupExpiredClusters(): Promise<number>;

  // Artifact methods
  createArtifact(options: CreateArtifactOptions): Promise<AuiArtifact>;
  getArtifact(id: string): Promise<AuiArtifact | undefined>;
  listArtifacts(options?: {
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<Omit<AuiArtifact, 'content' | 'contentBinary'>[]>;
  exportArtifact(id: string): Promise<AuiArtifact | undefined>;
  deleteArtifact(id: string): Promise<boolean>;
  cleanupExpiredArtifacts(): Promise<number>;
}

export function createClusterArtifactMethods(
  pool: Pool,
  options: Required<AuiPostgresStoreOptions> = DEFAULT_STORE_OPTIONS
): ClusterArtifactStoreMethods {
  const methods: ClusterArtifactStoreMethods = {
    // ═══════════════════════════════════════════════════════════════════
    // CLUSTERS
    // ═══════════════════════════════════════════════════════════════════

    async saveCluster(cluster: ContentCluster, userId?: string): Promise<ContentCluster> {
      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + options.clusterCacheDays * 24 * 60 * 60 * 1000
      );

      let centroidSql: string | null = null;
      if (cluster.centroid && cluster.centroid.length > 0) {
        centroidSql = toSql(cluster.centroid);
      }

      const result = await pool.query(INSERT_AUI_CLUSTER, [
        cluster.id,
        userId ?? null,
        cluster.label,
        cluster.description ?? null,
        JSON.stringify(cluster.passages),
        cluster.totalPassages,
        cluster.coherence ?? null,
        cluster.keywords,
        JSON.stringify(cluster.sourceDistribution),
        cluster.dateRange
          ? JSON.stringify({
              earliest: cluster.dateRange.earliest?.toISOString() ?? null,
              latest: cluster.dateRange.latest?.toISOString() ?? null,
            })
          : null,
        cluster.avgWordCount ?? null,
        centroidSql,
        null, // discovery_options
        now,
        expiresAt,
      ]);

      return rowToCluster(result.rows[0] as DbClusterRow);
    },

    async getCluster(id: string): Promise<ContentCluster | undefined> {
      const result = await pool.query(GET_AUI_CLUSTER, [id]);
      if (result.rows.length === 0) return undefined;

      const row = result.rows[0] as DbClusterRow;
      if (row.expires_at && row.expires_at < new Date()) {
        await methods.deleteCluster(id);
        return undefined;
      }

      return rowToCluster(row);
    },

    async listClusters(listOptions?: {
      userId?: string;
      limit?: number;
      offset?: number;
    }): Promise<ContentCluster[]> {
      const result = await pool.query(LIST_AUI_CLUSTERS, [
        listOptions?.userId ?? null,
        listOptions?.limit ?? 100,
        listOptions?.offset ?? 0,
      ]);

      return result.rows.map((row) => rowToCluster(row as DbClusterRow));
    },

    async findSimilarClusters(
      embedding: number[],
      limit?: number
    ): Promise<Array<ContentCluster & { similarity: number }>> {
      const vectorSql = toSql(embedding);
      const result = await pool.query(FIND_SIMILAR_CLUSTERS, [
        vectorSql,
        limit ?? 10,
      ]);

      return result.rows.map((row) => ({
        ...rowToCluster(row as DbClusterRow),
        similarity: (row as DbClusterRow & { similarity: number }).similarity,
      }));
    },

    async deleteCluster(id: string): Promise<boolean> {
      const result = await pool.query(DELETE_AUI_CLUSTER, [id]);
      return (result.rowCount ?? 0) > 0;
    },

    async cleanupExpiredClusters(): Promise<number> {
      const result = await pool.query(CLEANUP_EXPIRED_CLUSTERS);
      return result.rowCount ?? 0;
    },

    // ═══════════════════════════════════════════════════════════════════
    // ARTIFACTS
    // ═══════════════════════════════════════════════════════════════════

    async createArtifact(createOptions: CreateArtifactOptions): Promise<AuiArtifact> {
      const now = new Date();
      const id = randomUUID();
      const sizeBytes =
        createOptions.content?.length ?? createOptions.contentBinary?.length ?? 0;
      const expiresAt =
        createOptions.expiresAt ??
        new Date(
          now.getTime() + options.artifactExpirationDays * 24 * 60 * 60 * 1000
        );

      const result = await pool.query(INSERT_AUI_ARTIFACT, [
        id,
        createOptions.userId ?? null,
        createOptions.name,
        createOptions.artifactType,
        createOptions.content ?? null,
        createOptions.contentBinary ?? null,
        createOptions.mimeType,
        sizeBytes,
        createOptions.sourceType ?? null,
        createOptions.sourceId ?? null,
        JSON.stringify(createOptions.metadata ?? {}),
        now,
        expiresAt,
      ]);

      return rowToArtifact(result.rows[0] as DbArtifactRow);
    },

    async getArtifact(id: string): Promise<AuiArtifact | undefined> {
      const result = await pool.query(GET_AUI_ARTIFACT, [id]);
      if (result.rows.length === 0) return undefined;

      const row = result.rows[0] as DbArtifactRow;
      if (row.expires_at && row.expires_at < new Date()) {
        await methods.deleteArtifact(id);
        return undefined;
      }

      return rowToArtifact(row);
    },

    async listArtifacts(listOptions?: {
      userId?: string;
      limit?: number;
      offset?: number;
    }): Promise<Omit<AuiArtifact, 'content' | 'contentBinary'>[]> {
      const result = await pool.query(LIST_AUI_ARTIFACTS, [
        listOptions?.userId ?? null,
        listOptions?.limit ?? 100,
        listOptions?.offset ?? 0,
      ]);

      return result.rows.map((row) => {
        const artifact = rowToArtifact(row as DbArtifactRow);
        const { content, contentBinary, ...rest } = artifact;
        return rest;
      });
    },

    async exportArtifact(id: string): Promise<AuiArtifact | undefined> {
      const artifact = await methods.getArtifact(id);
      if (!artifact) return undefined;

      await pool.query(UPDATE_AUI_ARTIFACT_DOWNLOAD, [id]);
      artifact.downloadCount++;
      artifact.lastDownloadedAt = new Date();

      return artifact;
    },

    async deleteArtifact(id: string): Promise<boolean> {
      const result = await pool.query(DELETE_AUI_ARTIFACT, [id]);
      return (result.rowCount ?? 0) > 0;
    },

    async cleanupExpiredArtifacts(): Promise<number> {
      const result = await pool.query(CLEANUP_EXPIRED_ARTIFACTS);
      return result.rowCount ?? 0;
    },
  };

  return methods;
}
