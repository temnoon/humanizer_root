/**
 * UCG Storage Module
 *
 * PostgreSQL-backed storage for the Universal Content Graph.
 * Provides content persistence, embedding storage with pgvector, and search.
 *
 * MIGRATION NOTE (Jan 2026):
 * - SQLite has been replaced with PostgreSQL + pgvector
 * - All storage operations are now async
 * - Use Postgres.app for local development
 *
 * Usage:
 * ```typescript
 * import { initContentStore, getContentStore } from '@humanizer/core/storage';
 *
 * // Initialize with PostgreSQL connection
 * await initContentStore({
 *   host: 'localhost',
 *   port: 5432,
 *   database: 'humanizer_archive',
 * });
 *
 * // Use the store
 * const store = getContentStore();
 * const node = await store.storeNode(importedNode);
 * ```
 */

// Types
export type {
  StoredNode,
  StoredLink,
  ImportJob,
  ImportJobStatus,
  QueryOptions,
  QueryResult,
  SearchResult,
  EmbeddingSearchOptions,
  KeywordSearchOptions,
  ContentStoreStats,
  BatchStoreResult,
  BatchEmbeddingResult,
  ContentFormat,
  AuthorRole,
  MediaRef,
  ContentLinkType,
  // Fine-grained deduplication types
  ParagraphHashRecord,
  LineHashRecord,
  // Paste detection types
  PasteSegmentRecord,
  PasteStats,
  // Media-text association types
  MediaTextAssociationType,
  MediaTextAssociation,
  MediaTextStats,
} from './types.js';

export { KNOWN_GIZMO_IDS } from './types.js';

// Fine-grained deduplication types (from postgres-content-store)
export type {
  DuplicateMatch,
  DuplicateMatchDetailed,
  DuplicateStats,
} from './postgres-content-store.js';

// PostgreSQL Schema and Config
export type { PostgresStorageConfig } from './schema-postgres.js';
export {
  SCHEMA_VERSION,
  initializeSchema,
  DEFAULT_POSTGRES_CONFIG,
} from './schema-postgres.js';

// PostgreSQL Content Store
export {
  PostgresContentStore,
  getContentStore,
  initContentStore,
  closeContentStore,
} from './postgres-content-store.js';

// Connection Manager
export {
  ConnectionManager,
  getConnectionManager,
  initConnectionManager,
  closeConnectionManager,
  toVector,
  fromVector,
  type PoolStats,
} from './connection.js';

// Postgres Detection and Setup
export {
  detectPostgres,
  isPostgresAppInstalled,
  getInstalledVersions,
  getPsqlPath,
  checkServerStatus,
  checkDatabaseExists,
  checkPgvectorAvailable,
  checkSchemaVersion,
  setupPostgres,
  createDatabase,
  enablePgvector,
  getStatusMessage,
  getNextAction,
  type PostgresDetectionResult,
  type SetupOptions,
  type SetupResult,
  type SetupStep,
} from './postgres-detection.js';

// Books Store (humanizer_books database)
export {
  BooksPostgresStore,
  initBooksStore,
  getBooksStore,
  getBooksPool,
  closeBooksStore,
  resetBooksStore,
  type BooksPostgresStoreOptions,
  type CreateBookNodeOptions,
} from './books-postgres-store.js';

// Books Schema
export type { BooksStorageConfig } from './schema-books.js';
export {
  BOOKS_SCHEMA_VERSION,
  initializeBooksSchema,
  DEFAULT_BOOKS_CONFIG,
} from './schema-books.js';

// AUI Store (sessions, buffers, books metadata, clusters, artifacts)
export {
  AuiPostgresStore,
  initAuiStore,
  getAuiStore,
  resetAuiStore,
  type AuiPostgresStoreOptions,
  type AuiArtifact,
  type CreateArtifactOptions,
} from './aui-postgres-store.js';

// AUI Schema
export { runAuiMigration } from './schema-aui.js';

// Legacy SQLite exports (DEPRECATED - kept for reference only)
// NOTE: The old content-store.ts and schema.ts files are kept in the repo
// for reference but are no longer used. They will be removed in a future version.
