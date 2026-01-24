/**
 * PostgreSQL Detection Utilities
 *
 * Detects Postgres.app installation and PostgreSQL server status.
 * Used for onboarding flow in Electron app.
 */

import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import type { PostgresStorageConfig } from './schema-postgres.js';

// ═══════════════════════════════════════════════════════════════════
// DETECTION RESULT TYPES
// ═══════════════════════════════════════════════════════════════════

export interface PostgresDetectionResult {
  /** Postgres.app is installed in /Applications */
  installed: boolean;
  /** PostgreSQL server is responding on configured port */
  running: boolean;
  /** PostgreSQL server version */
  version?: string;
  /** pgvector extension is available */
  pgvectorAvailable: boolean;
  /** Target database exists */
  databaseExists: boolean;
  /** Schema is initialized and version matches */
  schemaValid: boolean;
  /** Current schema version (if exists) */
  schemaVersion?: number;
  /** Error message if detection failed */
  error?: string;
  /** Detected Postgres.app versions */
  installedVersions?: string[];
}

export interface SetupOptions {
  /** Database name to create */
  database: string;
  /** Create database if missing */
  createDatabase?: boolean;
  /** Enable pgvector extension */
  enablePgvector?: boolean;
  /** Initialize schema */
  initializeSchema?: boolean;
}

export interface SetupResult {
  success: boolean;
  error?: string;
  /** Steps completed */
  steps: SetupStep[];
}

export interface SetupStep {
  name: string;
  success: boolean;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════
// POSTGRES.APP DETECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Path to Postgres.app
 */
const POSTGRES_APP_PATH = '/Applications/Postgres.app';
const POSTGRES_VERSIONS_PATH = '/Applications/Postgres.app/Contents/Versions';

/**
 * Check if Postgres.app is installed
 */
export function isPostgresAppInstalled(): boolean {
  return existsSync(POSTGRES_APP_PATH);
}

/**
 * Get installed PostgreSQL versions from Postgres.app
 */
export function getInstalledVersions(): string[] {
  if (!existsSync(POSTGRES_VERSIONS_PATH)) {
    return [];
  }

  try {
    const entries = readdirSync(POSTGRES_VERSIONS_PATH, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && /^\d+/.test(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => parseInt(b) - parseInt(a)); // Latest first
  } catch (error) {
    console.debug('[postgres-detection] Error reading Postgres versions:', error);
    return [];
  }
}

/**
 * Get path to psql binary
 */
export function getPsqlPath(): string | undefined {
  const versions = getInstalledVersions();
  if (versions.length === 0) return undefined;

  const latestVersion = versions[0];
  const psqlPath = join(POSTGRES_VERSIONS_PATH, latestVersion, 'bin', 'psql');

  return existsSync(psqlPath) ? psqlPath : undefined;
}

// ═══════════════════════════════════════════════════════════════════
// SERVER DETECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Check if PostgreSQL server is running and get version
 */
export async function checkServerStatus(
  config: Partial<PostgresStorageConfig>
): Promise<{ running: boolean; version?: string; error?: string }> {
  const pool = new Pool({
    host: config.host ?? 'localhost',
    port: config.port ?? 5432,
    database: 'postgres', // Connect to default database for status check
    user: config.user ?? process.env.PGUSER ?? 'ed',
    password: config.password,
    connectionTimeoutMillis: 5000,
    max: 1,
  });

  try {
    const result = await pool.query('SELECT version()');
    const version = result.rows[0]?.version as string | undefined;
    
    await pool.end();
    
    return {
      running: true,
      version: version ? extractVersionNumber(version) : undefined,
    };
  } catch (error) {
    await pool.end().catch(() => {});
    
    return {
      running: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Extract PostgreSQL version number from full version string
 */
function extractVersionNumber(fullVersion: string): string {
  // "PostgreSQL 16.1 (Postgres.app) on ..." -> "16.1"
  const match = fullVersion.match(/PostgreSQL\s+(\d+\.\d+)/);
  return match ? match[1] : fullVersion;
}

// ═══════════════════════════════════════════════════════════════════
// DATABASE DETECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Check if a database exists
 */
export async function checkDatabaseExists(
  config: Partial<PostgresStorageConfig>,
  databaseName: string
): Promise<boolean> {
  const pool = new Pool({
    host: config.host ?? 'localhost',
    port: config.port ?? 5432,
    database: 'postgres',
    user: config.user ?? process.env.PGUSER ?? 'ed',
    password: config.password,
    connectionTimeoutMillis: 5000,
    max: 1,
  });

  try {
    const result = await pool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [databaseName]
    );
    
    await pool.end();
    return result.rows.length > 0;
  } catch (error) {
    console.debug('[postgres-detection] Database check failed:', error);
    await pool.end().catch(() => {});
    return false;
  }
}

/**
 * Check if pgvector extension is available
 */
export async function checkPgvectorAvailable(
  config: Partial<PostgresStorageConfig>
): Promise<boolean> {
  const pool = new Pool({
    host: config.host ?? 'localhost',
    port: config.port ?? 5432,
    database: 'postgres',
    user: config.user ?? process.env.PGUSER ?? 'ed',
    password: config.password,
    connectionTimeoutMillis: 5000,
    max: 1,
  });

  try {
    // Check if vector extension is available in pg_available_extensions
    const result = await pool.query(
      "SELECT 1 FROM pg_available_extensions WHERE name = 'vector'"
    );
    
    await pool.end();
    return result.rows.length > 0;
  } catch (error) {
    console.debug('[postgres-detection] pgvector check failed:', error);
    await pool.end().catch(() => {});
    return false;
  }
}

/**
 * Check schema version in target database
 */
export async function checkSchemaVersion(
  config: Partial<PostgresStorageConfig>,
  databaseName: string
): Promise<{ valid: boolean; version?: number; error?: string }> {
  const pool = new Pool({
    host: config.host ?? 'localhost',
    port: config.port ?? 5432,
    database: databaseName,
    user: config.user ?? process.env.PGUSER ?? 'ed',
    password: config.password,
    connectionTimeoutMillis: 5000,
    max: 1,
  });

  try {
    // Check if schema_meta table exists
    const tableResult = await pool.query(
      "SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_meta'"
    );

    if (tableResult.rows.length === 0) {
      await pool.end();
      return { valid: false };
    }

    // Get schema version
    const versionResult = await pool.query(
      "SELECT value FROM schema_meta WHERE key = 'schema_version'"
    );

    await pool.end();

    if (versionResult.rows.length === 0) {
      return { valid: false };
    }

    const version = parseInt(versionResult.rows[0].value, 10);
    return { valid: true, version };
  } catch (error) {
    await pool.end().catch(() => {});
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// FULL DETECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Run full PostgreSQL detection
 */
export async function detectPostgres(
  config: Partial<PostgresStorageConfig>
): Promise<PostgresDetectionResult> {
  const result: PostgresDetectionResult = {
    installed: false,
    running: false,
    pgvectorAvailable: false,
    databaseExists: false,
    schemaValid: false,
  };

  // Check Postgres.app installation
  result.installed = isPostgresAppInstalled();
  result.installedVersions = getInstalledVersions();

  // Check server status
  const serverStatus = await checkServerStatus(config);
  result.running = serverStatus.running;
  result.version = serverStatus.version;

  if (!serverStatus.running) {
    result.error = serverStatus.error;
    return result;
  }

  // Check pgvector availability
  result.pgvectorAvailable = await checkPgvectorAvailable(config);

  // Check target database
  const databaseName = config.database ?? 'humanizer_archive';
  result.databaseExists = await checkDatabaseExists(config, databaseName);

  if (!result.databaseExists) {
    return result;
  }

  // Check schema
  const schemaStatus = await checkSchemaVersion(config, databaseName);
  result.schemaValid = schemaStatus.valid;
  result.schemaVersion = schemaStatus.version;

  if (schemaStatus.error) {
    result.error = schemaStatus.error;
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════
// SETUP UTILITIES
// ═══════════════════════════════════════════════════════════════════

/**
 * Create database if it doesn't exist
 */
export async function createDatabase(
  config: Partial<PostgresStorageConfig>,
  databaseName: string
): Promise<SetupStep> {
  const pool = new Pool({
    host: config.host ?? 'localhost',
    port: config.port ?? 5432,
    database: 'postgres',
    user: config.user ?? process.env.PGUSER ?? 'ed',
    password: config.password,
    connectionTimeoutMillis: 10000,
    max: 1,
  });

  try {
    // Check if already exists
    const exists = await pool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [databaseName]
    );

    if (exists.rows.length > 0) {
      await pool.end();
      return { name: 'Create database', success: true };
    }

    // Create database
    await pool.query(`CREATE DATABASE "${databaseName}"`);
    await pool.end();

    return { name: 'Create database', success: true };
  } catch (error) {
    await pool.end().catch(() => {});
    return {
      name: 'Create database',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Enable pgvector extension in database
 */
export async function enablePgvector(
  config: Partial<PostgresStorageConfig>,
  databaseName: string
): Promise<SetupStep> {
  const pool = new Pool({
    host: config.host ?? 'localhost',
    port: config.port ?? 5432,
    database: databaseName,
    user: config.user ?? process.env.PGUSER ?? 'ed',
    password: config.password,
    connectionTimeoutMillis: 10000,
    max: 1,
  });

  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    await pool.end();

    return { name: 'Enable pgvector', success: true };
  } catch (error) {
    await pool.end().catch(() => {});
    return {
      name: 'Enable pgvector',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run full setup for new installation
 */
export async function setupPostgres(
  config: Partial<PostgresStorageConfig>,
  options: SetupOptions
): Promise<SetupResult> {
  const steps: SetupStep[] = [];

  // Step 1: Create database
  if (options.createDatabase !== false) {
    const createDbStep = await createDatabase(config, options.database);
    steps.push(createDbStep);

    if (!createDbStep.success) {
      return {
        success: false,
        error: `Failed to create database: ${createDbStep.error}`,
        steps,
      };
    }
  }

  // Step 2: Enable pgvector
  if (options.enablePgvector !== false) {
    const pgvectorStep = await enablePgvector(config, options.database);
    steps.push(pgvectorStep);

    if (!pgvectorStep.success) {
      return {
        success: false,
        error: `Failed to enable pgvector: ${pgvectorStep.error}`,
        steps,
      };
    }
  }

  // Step 3: Initialize schema (done by ContentStore.initialize())
  // This step is handled separately when ContentStore is created

  return {
    success: true,
    steps,
  };
}

// ═══════════════════════════════════════════════════════════════════
// ONBOARDING HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Get user-friendly status message
 */
export function getStatusMessage(result: PostgresDetectionResult): string {
  if (!result.installed) {
    return 'Postgres.app is not installed. Please download it from https://postgresapp.com/';
  }

  if (!result.running) {
    return 'PostgreSQL is not running. Please start Postgres.app from your menu bar.';
  }

  if (!result.pgvectorAvailable) {
    return 'pgvector extension is not available. Please update Postgres.app to a version with pgvector support.';
  }

  if (!result.databaseExists) {
    return 'Database "humanizer_archive" does not exist. Click "Set Up Database" to create it.';
  }

  if (!result.schemaValid) {
    return 'Database schema needs to be initialized. This will happen automatically on first use.';
  }

  return `PostgreSQL is ready (v${result.version}, schema v${result.schemaVersion})`;
}

/**
 * Get next action for user
 */
export function getNextAction(result: PostgresDetectionResult): {
  action: 'download' | 'start' | 'setup' | 'ready';
  label: string;
  url?: string;
} {
  if (!result.installed) {
    return {
      action: 'download',
      label: 'Download Postgres.app',
      url: 'https://postgresapp.com/downloads.html',
    };
  }

  if (!result.running) {
    return {
      action: 'start',
      label: 'Start PostgreSQL',
    };
  }

  if (!result.databaseExists || !result.schemaValid) {
    return {
      action: 'setup',
      label: 'Set Up Database',
    };
  }

  return {
    action: 'ready',
    label: 'PostgreSQL Ready',
  };
}
