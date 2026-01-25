/**
 * AUI PostgreSQL Store - Session Methods
 *
 * Session CRUD operations.
 *
 * @module @humanizer/core/storage/aui/sessions
 */

import { randomUUID } from 'crypto';
import type { Pool } from 'pg';
import type { UnifiedAuiSession, SessionMetadata } from '../../aui/types.js';
import {
  INSERT_AUI_SESSION,
  GET_AUI_SESSION,
  UPDATE_AUI_SESSION,
  DELETE_AUI_SESSION,
  LIST_AUI_SESSIONS,
  TOUCH_AUI_SESSION,
  CLEANUP_EXPIRED_SESSIONS,
} from '../schema-aui.js';
import type { DbSessionRow } from './row-types.js';
import { rowToSession } from './converters.js';
import type { AuiPostgresStoreOptions } from './types.js';
import { DEFAULT_STORE_OPTIONS } from './types.js';

export interface SessionStoreMethods {
  createSession(options?: {
    id?: string;
    userId?: string;
    name?: string;
  }): Promise<UnifiedAuiSession>;

  getSession(id: string): Promise<UnifiedAuiSession | undefined>;

  updateSession(
    id: string,
    update: Partial<{
      name: string;
      activeBufferName: string;
      searchSessionId: string;
      commandHistory: string[];
      variables: Record<string, unknown>;
      metadata: SessionMetadata;
      expiresAt: Date;
    }>
  ): Promise<UnifiedAuiSession | undefined>;

  deleteSession(id: string): Promise<boolean>;

  listSessions(options?: {
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<UnifiedAuiSession[]>;

  touchSession(id: string): Promise<void>;

  cleanupExpiredSessions(): Promise<number>;
}

export function createSessionMethods(
  pool: Pool,
  options: Required<AuiPostgresStoreOptions> = DEFAULT_STORE_OPTIONS
): SessionStoreMethods {
  return {
    async createSession(createOptions?: {
      id?: string;
      userId?: string;
      name?: string;
    }): Promise<UnifiedAuiSession> {
      const now = new Date();
      const id = createOptions?.id || randomUUID();
      const expiresAt = new Date(now.getTime() + options.sessionExpirationMs);

      const result = await pool.query(INSERT_AUI_SESSION, [
        id,
        createOptions?.userId ?? null,
        createOptions?.name ?? null,
        null, // active_buffer_name
        null, // search_session_id
        [], // command_history
        {}, // variables
        { commandCount: 0, searchCount: 0, taskCount: 0 }, // metadata
        now,
        now,
        expiresAt,
      ]);

      return rowToSession(result.rows[0] as DbSessionRow);
    },

    async getSession(id: string): Promise<UnifiedAuiSession | undefined> {
      const result = await pool.query(GET_AUI_SESSION, [id]);
      if (result.rows.length === 0) return undefined;

      const row = result.rows[0] as DbSessionRow;
      if (row.expires_at && row.expires_at < new Date()) {
        await this.deleteSession(id);
        return undefined;
      }

      return rowToSession(row);
    },

    async updateSession(
      id: string,
      update: Partial<{
        name: string;
        activeBufferName: string;
        searchSessionId: string;
        commandHistory: string[];
        variables: Record<string, unknown>;
        metadata: SessionMetadata;
        expiresAt: Date;
      }>
    ): Promise<UnifiedAuiSession | undefined> {
      const result = await pool.query(UPDATE_AUI_SESSION, [
        id,
        update.name ?? null,
        update.activeBufferName ?? null,
        update.searchSessionId ?? null,
        update.commandHistory ?? null,
        update.variables ? JSON.stringify(update.variables) : null,
        update.metadata ? JSON.stringify(update.metadata) : null,
        update.expiresAt ?? null,
      ]);

      if (result.rows.length === 0) return undefined;
      return rowToSession(result.rows[0] as DbSessionRow);
    },

    async deleteSession(id: string): Promise<boolean> {
      const result = await pool.query(DELETE_AUI_SESSION, [id]);
      return (result.rowCount ?? 0) > 0;
    },

    async listSessions(listOptions?: {
      userId?: string;
      limit?: number;
      offset?: number;
    }): Promise<UnifiedAuiSession[]> {
      const result = await pool.query(LIST_AUI_SESSIONS, [
        listOptions?.userId ?? null,
        listOptions?.limit ?? 100,
        listOptions?.offset ?? 0,
      ]);

      return result.rows.map((row) => rowToSession(row as DbSessionRow));
    },

    async touchSession(id: string): Promise<void> {
      await pool.query(TOUCH_AUI_SESSION, [id]);
    },

    async cleanupExpiredSessions(): Promise<number> {
      const result = await pool.query(CLEANUP_EXPIRED_SESSIONS);
      return result.rowCount ?? 0;
    },
  };
}
