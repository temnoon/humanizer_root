/**
 * AUI PostgreSQL Store - Buffer Methods
 *
 * Buffer, branch, and version CRUD operations.
 *
 * @module @humanizer/core/storage/aui/buffers
 */

import { randomUUID } from 'crypto';
import type { Pool } from 'pg';
import type { VersionedBuffer, BufferVersion, BufferBranch } from '../../aui/types.js';
import {
  INSERT_AUI_BUFFER,
  GET_AUI_BUFFER,
  GET_AUI_BUFFER_BY_NAME,
  UPDATE_AUI_BUFFER,
  DELETE_AUI_BUFFER,
  LIST_AUI_BUFFERS,
  INSERT_AUI_BRANCH,
  GET_AUI_BRANCH,
  UPDATE_AUI_BRANCH,
  DELETE_AUI_BRANCH,
  LIST_AUI_BRANCHES,
  INSERT_AUI_VERSION,
  GET_AUI_VERSION,
  GET_AUI_VERSION_HISTORY,
  PRUNE_AUI_VERSIONS,
} from '../schema-aui.js';
import type { DbBufferRow, DbBranchRow, DbVersionRow } from './row-types.js';
import { rowToBuffer, rowToBranch, rowToVersion } from './converters.js';
import type { AuiPostgresStoreOptions } from './types.js';
import { DEFAULT_STORE_OPTIONS } from './types.js';

export interface BufferStoreMethods {
  // Buffer methods
  createBuffer(sessionId: string, name: string, content?: unknown[]): Promise<VersionedBuffer>;
  getBuffer(id: string): Promise<VersionedBuffer | undefined>;
  getBufferByName(sessionId: string, name: string): Promise<VersionedBuffer | undefined>;
  updateBuffer(
    id: string,
    update: Partial<{
      currentBranch: string;
      workingContent: unknown[];
      isDirty: boolean;
      schema: unknown;
    }>
  ): Promise<VersionedBuffer | undefined>;
  deleteBuffer(id: string): Promise<boolean>;
  listBuffers(sessionId: string): Promise<VersionedBuffer[]>;

  // Branch methods
  createBranch(
    bufferId: string,
    name: string,
    options?: {
      headVersionId?: string;
      parentBranch?: string;
      description?: string;
    }
  ): Promise<BufferBranch>;
  getBranch(bufferId: string, name: string): Promise<BufferBranch | undefined>;
  updateBranch(
    bufferId: string,
    name: string,
    update: Partial<{ headVersionId: string; description: string }>
  ): Promise<BufferBranch | undefined>;
  deleteBranch(bufferId: string, name: string): Promise<boolean>;
  listBranches(bufferId: string): Promise<BufferBranch[]>;

  // Version methods
  createVersion(
    bufferId: string,
    version: {
      id: string;
      content: unknown[];
      message: string;
      parentId?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
    }
  ): Promise<BufferVersion>;
  getVersion(id: string): Promise<BufferVersion | undefined>;
  getVersionHistory(bufferId: string, limit?: number): Promise<BufferVersion[]>;
  pruneVersions(bufferId: string, keep?: number): Promise<number>;
}

export function createBufferMethods(
  pool: Pool,
  options: Required<AuiPostgresStoreOptions> = DEFAULT_STORE_OPTIONS
): BufferStoreMethods {
  const methods: BufferStoreMethods = {
    // ═══════════════════════════════════════════════════════════════════
    // BUFFERS
    // ═══════════════════════════════════════════════════════════════════

    async createBuffer(
      sessionId: string,
      name: string,
      content?: unknown[]
    ): Promise<VersionedBuffer> {
      const now = new Date();
      const id = randomUUID();

      const result = await pool.query(INSERT_AUI_BUFFER, [
        id,
        sessionId,
        name,
        'main', // current_branch
        JSON.stringify(content ?? []),
        false, // is_dirty
        null, // schema
        now,
        now,
      ]);

      const bufferRow = result.rows[0] as DbBufferRow;

      // Create default 'main' branch
      await methods.createBranch(id, 'main');

      return rowToBuffer(bufferRow);
    },

    async getBuffer(id: string): Promise<VersionedBuffer | undefined> {
      const result = await pool.query(GET_AUI_BUFFER, [id]);
      if (result.rows.length === 0) return undefined;
      return rowToBuffer(result.rows[0] as DbBufferRow);
    },

    async getBufferByName(
      sessionId: string,
      name: string
    ): Promise<VersionedBuffer | undefined> {
      const result = await pool.query(GET_AUI_BUFFER_BY_NAME, [sessionId, name]);
      if (result.rows.length === 0) return undefined;
      return rowToBuffer(result.rows[0] as DbBufferRow);
    },

    async updateBuffer(
      id: string,
      update: Partial<{
        currentBranch: string;
        workingContent: unknown[];
        isDirty: boolean;
        schema: unknown;
      }>
    ): Promise<VersionedBuffer | undefined> {
      const result = await pool.query(UPDATE_AUI_BUFFER, [
        id,
        update.currentBranch ?? null,
        update.workingContent ? JSON.stringify(update.workingContent) : null,
        update.isDirty ?? null,
        update.schema ? JSON.stringify(update.schema) : null,
      ]);

      if (result.rows.length === 0) return undefined;
      return rowToBuffer(result.rows[0] as DbBufferRow);
    },

    async deleteBuffer(id: string): Promise<boolean> {
      const result = await pool.query(DELETE_AUI_BUFFER, [id]);
      return (result.rowCount ?? 0) > 0;
    },

    async listBuffers(sessionId: string): Promise<VersionedBuffer[]> {
      const result = await pool.query(LIST_AUI_BUFFERS, [sessionId]);
      return result.rows.map((row) => rowToBuffer(row as DbBufferRow));
    },

    // ═══════════════════════════════════════════════════════════════════
    // BRANCHES
    // ═══════════════════════════════════════════════════════════════════

    async createBranch(
      bufferId: string,
      name: string,
      branchOptions?: {
        headVersionId?: string;
        parentBranch?: string;
        description?: string;
      }
    ): Promise<BufferBranch> {
      const now = new Date();
      const id = randomUUID();

      const result = await pool.query(INSERT_AUI_BRANCH, [
        id,
        bufferId,
        name,
        branchOptions?.headVersionId ?? null,
        branchOptions?.parentBranch ?? null,
        branchOptions?.description ?? null,
        now,
      ]);

      return rowToBranch(result.rows[0] as DbBranchRow);
    },

    async getBranch(bufferId: string, name: string): Promise<BufferBranch | undefined> {
      const result = await pool.query(GET_AUI_BRANCH, [bufferId, name]);
      if (result.rows.length === 0) return undefined;
      return rowToBranch(result.rows[0] as DbBranchRow);
    },

    async updateBranch(
      bufferId: string,
      name: string,
      update: Partial<{ headVersionId: string; description: string }>
    ): Promise<BufferBranch | undefined> {
      const result = await pool.query(UPDATE_AUI_BRANCH, [
        bufferId,
        name,
        update.headVersionId ?? null,
        update.description ?? null,
      ]);

      if (result.rows.length === 0) return undefined;
      return rowToBranch(result.rows[0] as DbBranchRow);
    },

    async deleteBranch(bufferId: string, name: string): Promise<boolean> {
      const result = await pool.query(DELETE_AUI_BRANCH, [bufferId, name]);
      return (result.rowCount ?? 0) > 0;
    },

    async listBranches(bufferId: string): Promise<BufferBranch[]> {
      const result = await pool.query(LIST_AUI_BRANCHES, [bufferId]);
      return result.rows.map((row) => rowToBranch(row as DbBranchRow));
    },

    // ═══════════════════════════════════════════════════════════════════
    // VERSIONS
    // ═══════════════════════════════════════════════════════════════════

    async createVersion(
      bufferId: string,
      version: {
        id: string;
        content: unknown[];
        message: string;
        parentId?: string;
        tags?: string[];
        metadata?: Record<string, unknown>;
      }
    ): Promise<BufferVersion> {
      const now = new Date();

      const result = await pool.query(INSERT_AUI_VERSION, [
        version.id,
        bufferId,
        JSON.stringify(version.content),
        version.message,
        version.parentId ?? null,
        version.tags ?? [],
        JSON.stringify(version.metadata ?? {}),
        now,
      ]);

      return rowToVersion(result.rows[0] as DbVersionRow);
    },

    async getVersion(id: string): Promise<BufferVersion | undefined> {
      const result = await pool.query(GET_AUI_VERSION, [id]);
      if (result.rows.length === 0) return undefined;
      return rowToVersion(result.rows[0] as DbVersionRow);
    },

    async getVersionHistory(bufferId: string, limit?: number): Promise<BufferVersion[]> {
      const result = await pool.query(GET_AUI_VERSION_HISTORY, [
        bufferId,
        limit ?? options.maxVersionHistory,
      ]);
      return result.rows.map((row) => rowToVersion(row as DbVersionRow));
    },

    async pruneVersions(bufferId: string, keep?: number): Promise<number> {
      const result = await pool.query(PRUNE_AUI_VERSIONS, [
        bufferId,
        keep ?? options.maxVersionHistory,
      ]);
      return result.rowCount ?? 0;
    },
  };

  return methods;
}
