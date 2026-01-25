/**
 * AUI PostgreSQL Store
 *
 * Re-exports from the modular implementation for backward compatibility.
 *
 * Implementation files:
 * - ./aui/types.ts - Public types (AuiArtifact, PersonaProfile, StyleProfile, options)
 * - ./aui/row-types.ts - Database row interfaces
 * - ./aui/converters.ts - Row-to-domain conversion functions
 * - ./aui/sessions.ts - Session CRUD methods
 * - ./aui/buffers.ts - Buffer, branch, version CRUD methods
 * - ./aui/tasks.ts - Task CRUD methods
 * - ./aui/books.ts - Book, chapter CRUD methods
 * - ./aui/clusters-artifacts.ts - Cluster and artifact CRUD methods
 * - ./aui/persona-style.ts - Persona and style profile CRUD methods
 * - ./aui/content-buffers.ts - ContentBuffer, provenance, operation methods
 * - ./aui/index.ts - Main AuiPostgresStore class composition
 *
 * @module @humanizer/core/storage/aui-postgres-store
 */

// Re-export everything from the modular implementation
export * from './aui/index.js';
