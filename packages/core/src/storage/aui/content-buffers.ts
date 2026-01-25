/**
 * AUI PostgreSQL Store - Content Buffer Methods
 *
 * Content buffer, provenance chain, and buffer operation CRUD operations.
 *
 * @module @humanizer/core/storage/aui/content-buffers
 */

import type { Pool } from 'pg';
import { toSql } from 'pgvector';
import type {
  ContentBuffer,
  BufferState,
  QualityMetrics,
  ProvenanceChain,
  BufferOperation,
} from '../../buffer/types.js';
import {
  INSERT_AUI_CONTENT_BUFFER,
  GET_AUI_CONTENT_BUFFER,
  GET_AUI_CONTENT_BUFFERS_BY_HASH,
  UPDATE_AUI_CONTENT_BUFFER,
  DELETE_AUI_CONTENT_BUFFER,
  LIST_AUI_CONTENT_BUFFERS,
  FIND_SIMILAR_CONTENT_BUFFERS,
  INSERT_AUI_PROVENANCE_CHAIN,
  GET_AUI_PROVENANCE_CHAIN,
  GET_AUI_PROVENANCE_CHAIN_BY_BUFFER,
  UPDATE_AUI_PROVENANCE_CHAIN,
  DELETE_AUI_PROVENANCE_CHAIN,
  FIND_DERIVED_CHAINS,
  INSERT_AUI_BUFFER_OPERATION,
  GET_AUI_BUFFER_OPERATION,
  GET_AUI_BUFFER_OPERATIONS_BY_CHAIN,
  GET_AUI_BUFFER_OPERATIONS_BY_HASH,
  DELETE_AUI_BUFFER_OPERATION,
  GET_NEXT_OPERATION_SEQUENCE,
} from '../schema-aui.js';
import type {
  DbContentBufferRow,
  DbProvenanceChainRow,
  DbBufferOperationRow,
} from './row-types.js';
import {
  rowToContentBuffer,
  rowToProvenanceChain,
  rowToBufferOperation,
} from './converters.js';

export interface ContentBufferStoreMethods {
  // Content buffer methods
  saveContentBuffer(buffer: ContentBuffer): Promise<ContentBuffer>;
  loadContentBuffer(bufferId: string): Promise<ContentBuffer | undefined>;
  findContentBuffersByHash(hash: string): Promise<ContentBuffer[]>;
  updateContentBuffer(
    bufferId: string,
    update: Partial<{
      state: BufferState;
      qualityMetrics: QualityMetrics;
      embedding: number[];
    }>
  ): Promise<ContentBuffer | undefined>;
  deleteContentBuffer(bufferId: string): Promise<boolean>;
  listContentBuffers(options?: {
    state?: BufferState;
    limit?: number;
    offset?: number;
  }): Promise<ContentBuffer[]>;
  findSimilarContentBuffers(
    embedding: number[],
    limit?: number
  ): Promise<Array<ContentBuffer & { similarity: number }>>;

  // Provenance chain methods
  saveProvenanceChain(chain: ProvenanceChain): Promise<ProvenanceChain>;
  loadProvenanceChain(chainId: string): Promise<ProvenanceChain | undefined>;
  getProvenanceChainByBuffer(bufferId: string): Promise<ProvenanceChain | undefined>;
  updateProvenanceChain(
    chainId: string,
    update: Partial<{
      currentBufferId: string;
      childChainIds: string[];
      transformationCount: number;
    }>
  ): Promise<ProvenanceChain | undefined>;
  deleteProvenanceChain(chainId: string): Promise<boolean>;
  findDerivedChains(rootBufferId: string): Promise<ProvenanceChain[]>;

  // Buffer operation methods
  saveBufferOperation(chainId: string, operation: BufferOperation): Promise<BufferOperation>;
  loadBufferOperation(operationId: string): Promise<BufferOperation | undefined>;
  getOperationsByChain(chainId: string): Promise<BufferOperation[]>;
  findOperationsByHash(hash: string): Promise<BufferOperation[]>;
  deleteBufferOperation(operationId: string): Promise<boolean>;

  // Combined loading
  loadFullProvenanceChain(chainId: string): Promise<ProvenanceChain | undefined>;
}

export function createContentBufferMethods(pool: Pool): ContentBufferStoreMethods {
  const methods: ContentBufferStoreMethods = {
    // ═══════════════════════════════════════════════════════════════════
    // CONTENT BUFFERS
    // ═══════════════════════════════════════════════════════════════════

    async saveContentBuffer(buffer: ContentBuffer): Promise<ContentBuffer> {
      const now = new Date();

      let embeddingSql: string | null = null;
      if (buffer.embedding && buffer.embedding.length > 0) {
        embeddingSql = toSql(buffer.embedding);
      }

      const result = await pool.query(INSERT_AUI_CONTENT_BUFFER, [
        buffer.id,
        buffer.contentHash,
        buffer.text,
        buffer.wordCount,
        buffer.format,
        buffer.state,
        JSON.stringify(buffer.origin),
        buffer.qualityMetrics ? JSON.stringify(buffer.qualityMetrics) : null,
        embeddingSql,
        new Date(buffer.createdAt),
        new Date(buffer.updatedAt),
      ]);

      return rowToContentBuffer(result.rows[0] as DbContentBufferRow);
    },

    async loadContentBuffer(bufferId: string): Promise<ContentBuffer | undefined> {
      const result = await pool.query(GET_AUI_CONTENT_BUFFER, [bufferId]);
      if (result.rows.length === 0) return undefined;
      return rowToContentBuffer(result.rows[0] as DbContentBufferRow);
    },

    async findContentBuffersByHash(hash: string): Promise<ContentBuffer[]> {
      const result = await pool.query(GET_AUI_CONTENT_BUFFERS_BY_HASH, [hash]);
      return result.rows.map((row) => rowToContentBuffer(row as DbContentBufferRow));
    },

    async updateContentBuffer(
      bufferId: string,
      update: Partial<{
        state: BufferState;
        qualityMetrics: QualityMetrics;
        embedding: number[];
      }>
    ): Promise<ContentBuffer | undefined> {
      let embeddingSql: string | null = null;
      if (update.embedding && update.embedding.length > 0) {
        embeddingSql = toSql(update.embedding);
      }

      const result = await pool.query(UPDATE_AUI_CONTENT_BUFFER, [
        bufferId,
        update.state ?? null,
        update.qualityMetrics ? JSON.stringify(update.qualityMetrics) : null,
        embeddingSql,
      ]);

      if (result.rows.length === 0) return undefined;
      return rowToContentBuffer(result.rows[0] as DbContentBufferRow);
    },

    async deleteContentBuffer(bufferId: string): Promise<boolean> {
      const result = await pool.query(DELETE_AUI_CONTENT_BUFFER, [bufferId]);
      return (result.rowCount ?? 0) > 0;
    },

    async listContentBuffers(options?: {
      state?: BufferState;
      limit?: number;
      offset?: number;
    }): Promise<ContentBuffer[]> {
      const result = await pool.query(LIST_AUI_CONTENT_BUFFERS, [
        options?.state ?? null,
        options?.limit ?? 100,
        options?.offset ?? 0,
      ]);
      return result.rows.map((row) => rowToContentBuffer(row as DbContentBufferRow));
    },

    async findSimilarContentBuffers(
      embedding: number[],
      limit?: number
    ): Promise<Array<ContentBuffer & { similarity: number }>> {
      const vectorSql = toSql(embedding);
      const result = await pool.query(FIND_SIMILAR_CONTENT_BUFFERS, [
        vectorSql,
        limit ?? 10,
      ]);

      return result.rows.map((row) => ({
        ...rowToContentBuffer(row as DbContentBufferRow),
        similarity: (row as DbContentBufferRow & { similarity: number }).similarity,
      }));
    },

    // ═══════════════════════════════════════════════════════════════════
    // PROVENANCE CHAINS
    // ═══════════════════════════════════════════════════════════════════

    async saveProvenanceChain(chain: ProvenanceChain): Promise<ProvenanceChain> {
      const now = new Date();

      const result = await pool.query(INSERT_AUI_PROVENANCE_CHAIN, [
        chain.id,
        chain.rootBufferId,
        chain.currentBufferId,
        chain.branch.name,
        chain.branch.description ?? null,
        chain.branch.isMain,
        chain.parentChainId ?? null,
        chain.childChainIds,
        chain.transformationCount,
        now,
      ]);

      return rowToProvenanceChain(result.rows[0] as DbProvenanceChainRow);
    },

    async loadProvenanceChain(chainId: string): Promise<ProvenanceChain | undefined> {
      const result = await pool.query(GET_AUI_PROVENANCE_CHAIN, [chainId]);
      if (result.rows.length === 0) return undefined;
      return rowToProvenanceChain(result.rows[0] as DbProvenanceChainRow);
    },

    async getProvenanceChainByBuffer(bufferId: string): Promise<ProvenanceChain | undefined> {
      const result = await pool.query(GET_AUI_PROVENANCE_CHAIN_BY_BUFFER, [bufferId]);
      if (result.rows.length === 0) return undefined;
      return rowToProvenanceChain(result.rows[0] as DbProvenanceChainRow);
    },

    async updateProvenanceChain(
      chainId: string,
      update: Partial<{
        currentBufferId: string;
        childChainIds: string[];
        transformationCount: number;
      }>
    ): Promise<ProvenanceChain | undefined> {
      const result = await pool.query(UPDATE_AUI_PROVENANCE_CHAIN, [
        chainId,
        update.currentBufferId ?? null,
        update.childChainIds ?? null,
        update.transformationCount ?? null,
      ]);

      if (result.rows.length === 0) return undefined;
      return rowToProvenanceChain(result.rows[0] as DbProvenanceChainRow);
    },

    async deleteProvenanceChain(chainId: string): Promise<boolean> {
      const result = await pool.query(DELETE_AUI_PROVENANCE_CHAIN, [chainId]);
      return (result.rowCount ?? 0) > 0;
    },

    async findDerivedChains(rootBufferId: string): Promise<ProvenanceChain[]> {
      const result = await pool.query(FIND_DERIVED_CHAINS, [rootBufferId]);
      return result.rows.map((row) => rowToProvenanceChain(row as DbProvenanceChainRow));
    },

    // ═══════════════════════════════════════════════════════════════════
    // BUFFER OPERATIONS
    // ═══════════════════════════════════════════════════════════════════

    async saveBufferOperation(
      chainId: string,
      operation: BufferOperation
    ): Promise<BufferOperation> {
      // Get next sequence number
      const seqResult = await pool.query(GET_NEXT_OPERATION_SEQUENCE, [chainId]);
      const sequenceNumber = seqResult.rows[0].next_seq as number;

      const result = await pool.query(INSERT_AUI_BUFFER_OPERATION, [
        operation.id,
        chainId,
        sequenceNumber,
        operation.type,
        JSON.stringify(operation.performer),
        JSON.stringify(operation.parameters),
        operation.hashes.beforeHash,
        operation.hashes.afterHash,
        operation.hashes.deltaHash ?? null,
        operation.qualityImpact ? JSON.stringify(operation.qualityImpact) : null,
        operation.description,
        operation.durationMs ?? null,
        operation.costCents ?? null,
        new Date(operation.timestamp),
      ]);

      return rowToBufferOperation(result.rows[0] as DbBufferOperationRow);
    },

    async loadBufferOperation(operationId: string): Promise<BufferOperation | undefined> {
      const result = await pool.query(GET_AUI_BUFFER_OPERATION, [operationId]);
      if (result.rows.length === 0) return undefined;
      return rowToBufferOperation(result.rows[0] as DbBufferOperationRow);
    },

    async getOperationsByChain(chainId: string): Promise<BufferOperation[]> {
      const result = await pool.query(GET_AUI_BUFFER_OPERATIONS_BY_CHAIN, [chainId]);
      return result.rows.map((row) => rowToBufferOperation(row as DbBufferOperationRow));
    },

    async findOperationsByHash(hash: string): Promise<BufferOperation[]> {
      const result = await pool.query(GET_AUI_BUFFER_OPERATIONS_BY_HASH, [hash]);
      return result.rows.map((row) => rowToBufferOperation(row as DbBufferOperationRow));
    },

    async deleteBufferOperation(operationId: string): Promise<boolean> {
      const result = await pool.query(DELETE_AUI_BUFFER_OPERATION, [operationId]);
      return (result.rowCount ?? 0) > 0;
    },

    // ═══════════════════════════════════════════════════════════════════
    // COMBINED LOADING
    // ═══════════════════════════════════════════════════════════════════

    async loadFullProvenanceChain(chainId: string): Promise<ProvenanceChain | undefined> {
      const chain = await methods.loadProvenanceChain(chainId);
      if (!chain) return undefined;

      const operations = await methods.getOperationsByChain(chainId);
      return {
        ...chain,
        operations,
      };
    },
  };

  return methods;
}
