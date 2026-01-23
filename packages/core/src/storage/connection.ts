/**
 * PostgreSQL Connection Manager
 *
 * Manages a connection pool to PostgreSQL with:
 * - Lazy initialization
 * - Automatic reconnection
 * - Health checks
 * - Graceful shutdown
 */

import { Pool, PoolConfig, PoolClient } from 'pg';
import { registerTypes } from 'pgvector/pg';
import { toSql, fromSql } from 'pgvector';
import type { PostgresStorageConfig } from './schema-postgres.js';

// ═══════════════════════════════════════════════════════════════════
// CONNECTION MANAGER
// ═══════════════════════════════════════════════════════════════════

/**
 * PostgreSQL connection pool manager
 */
export class ConnectionManager {
  private pool: Pool | null = null;
  private config: PostgresStorageConfig;
  private isShuttingDown = false;

  constructor(config: PostgresStorageConfig) {
    this.config = config;
  }

  /**
   * Get or create the connection pool
   */
  async getPool(): Promise<Pool> {
    if (this.isShuttingDown) {
      throw new Error('Connection manager is shutting down');
    }

    if (!this.pool) {
      this.pool = await this.createPool();
    }

    return this.pool;
  }

  /**
   * Get a client from the pool
   */
  async getClient(): Promise<PoolClient> {
    const pool = await this.getPool();
    return pool.connect();
  }

  /**
   * Execute a query on the pool
   */
  async query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
    const pool = await this.getPool();
    const result = await pool.query(text, params);
    return result.rows as T[];
  }

  /**
   * Execute a query and return first row
   */
  async queryOne<T = unknown>(text: string, params?: unknown[]): Promise<T | undefined> {
    const rows = await this.query<T>(text, params);
    return rows[0];
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if the connection is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const pool = await this.getPool();
      await pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Close the connection pool
   */
  async close(): Promise<void> {
    this.isShuttingDown = true;
    
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    
    this.isShuttingDown = false;
  }

  /**
   * Get pool statistics
   */
  getPoolStats(): PoolStats | null {
    if (!this.pool) {
      return null;
    }

    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────

  private async createPool(): Promise<Pool> {
    const poolConfig: PoolConfig = {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      max: this.config.maxConnections,
      idleTimeoutMillis: this.config.idleTimeoutMs,
      connectionTimeoutMillis: this.config.connectionTimeoutMs,
    };

    const pool = new Pool(poolConfig);

    // Register pgvector type handlers on each new connection
    pool.on('connect', async (client) => {
      await registerTypes(client);
    });

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected PostgreSQL pool error:', err);
    });

    // Verify connection and initialize pgvector types
    const client = await pool.connect();
    try {
      await registerTypes(client);
      await client.query('SELECT 1');
    } finally {
      client.release();
    }

    return pool;
  }
}

// ═══════════════════════════════════════════════════════════════════
// POOL STATS TYPE
// ═══════════════════════════════════════════════════════════════════

export interface PoolStats {
  /** Total number of clients in the pool */
  totalCount: number;
  /** Number of idle clients */
  idleCount: number;
  /** Number of clients waiting for connection */
  waitingCount: number;
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

let _manager: ConnectionManager | null = null;

/**
 * Get the connection manager singleton
 */
export function getConnectionManager(): ConnectionManager {
  if (!_manager) {
    throw new Error('ConnectionManager not initialized. Call initConnectionManager() first.');
  }
  return _manager;
}

/**
 * Initialize the connection manager singleton
 */
export function initConnectionManager(config: PostgresStorageConfig): ConnectionManager {
  if (_manager) {
    // Close existing manager
    _manager.close().catch(console.error);
  }
  _manager = new ConnectionManager(config);
  return _manager;
}

/**
 * Close the connection manager singleton
 */
export async function closeConnectionManager(): Promise<void> {
  if (_manager) {
    await _manager.close();
    _manager = null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// VECTOR HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Convert number array to pgvector format
 */
export function toVector(embedding: number[]): string {
  return toSql(embedding);
}

/**
 * Parse pgvector result to number array
 */
export function fromVector(vectorStr: string | null): number[] | undefined {
  if (!vectorStr) return undefined;
  return fromSql(vectorStr);
}
