/**
 * AUI PostgreSQL Store - Unified Export
 *
 * Composes all domain-specific store modules into the main AuiPostgresStore class.
 *
 * @module @humanizer/core/storage/aui
 */

import type { Pool } from 'pg';

// Re-export all types
export * from './types.js';
export * from './row-types.js';
export * from './converters.js';

// Import domain methods
import { createSessionMethods, type SessionStoreMethods } from './sessions.js';
import { createBufferMethods, type BufferStoreMethods } from './buffers.js';
import { createTaskMethods, type TaskStoreMethods } from './tasks.js';
import { createBookMethods, type BookStoreMethods } from './books.js';
import { createClusterArtifactMethods, type ClusterArtifactStoreMethods } from './clusters-artifacts.js';
import { createPersonaStyleMethods, type PersonaStyleStoreMethods } from './persona-style.js';
import { createContentBufferMethods, type ContentBufferStoreMethods } from './content-buffers.js';
import {
  createTranscriptionMethods,
  type TranscriptionStoreMethods,
  type DbTranscriptionVersionRow,
  type DbTranscriptionJobRow,
  type DbTranscriptionNeedingEmbeddingRow,
  type DbTranscriptionStaleEmbeddingRow,
  type TranscriptionNeedingEmbedding,
  type TranscriptionStaleEmbedding,
  type TranscriptionSourceContext,
  rowToTranscriptionVersion,
  rowToTranscriptionJob,
} from './transcriptions.js';
import { type AuiPostgresStoreOptions, DEFAULT_STORE_OPTIONS } from './types.js';

// Re-export method interfaces
export type {
  SessionStoreMethods,
  BufferStoreMethods,
  TaskStoreMethods,
  BookStoreMethods,
  ClusterArtifactStoreMethods,
  PersonaStyleStoreMethods,
  ContentBufferStoreMethods,
  TranscriptionStoreMethods,
};

// Re-export transcription types
export type {
  DbTranscriptionVersionRow,
  DbTranscriptionJobRow,
  DbTranscriptionNeedingEmbeddingRow,
  DbTranscriptionStaleEmbeddingRow,
  TranscriptionNeedingEmbedding,
  TranscriptionStaleEmbedding,
  TranscriptionSourceContext,
};
export { rowToTranscriptionVersion, rowToTranscriptionJob };

// ═══════════════════════════════════════════════════════════════════
// AUI POSTGRES STORE
// ═══════════════════════════════════════════════════════════════════

/**
 * PostgreSQL store for AUI persistent storage
 *
 * Implements write-through + lazy loading pattern for:
 * - Sessions
 * - Buffers (with branches and versions)
 * - Tasks
 * - Books (with chapters)
 * - Clusters
 * - Artifacts
 * - Persona profiles
 * - Style profiles
 * - Content buffers (with provenance chains and operations)
 */
export class AuiPostgresStore
  implements
    SessionStoreMethods,
    BufferStoreMethods,
    TaskStoreMethods,
    BookStoreMethods,
    ClusterArtifactStoreMethods,
    PersonaStyleStoreMethods,
    ContentBufferStoreMethods,
    TranscriptionStoreMethods
{
  private pool: Pool;
  private options: Required<AuiPostgresStoreOptions>;

  // Domain method implementations
  private sessionMethods: SessionStoreMethods;
  private bufferMethods: BufferStoreMethods;
  private taskMethods: TaskStoreMethods;
  private bookMethods: BookStoreMethods;
  private clusterArtifactMethods: ClusterArtifactStoreMethods;
  private personaStyleMethods: PersonaStyleStoreMethods;
  private contentBufferMethods: ContentBufferStoreMethods;
  private transcriptionMethods: TranscriptionStoreMethods;

  constructor(pool: Pool, options: AuiPostgresStoreOptions = {}) {
    this.pool = pool;
    this.options = { ...DEFAULT_STORE_OPTIONS, ...options };

    // Initialize domain methods
    this.sessionMethods = createSessionMethods(pool, this.options);
    this.bufferMethods = createBufferMethods(pool, this.options);
    this.taskMethods = createTaskMethods(pool);
    this.bookMethods = createBookMethods(pool);
    this.clusterArtifactMethods = createClusterArtifactMethods(pool, this.options);
    this.personaStyleMethods = createPersonaStyleMethods(pool);
    this.contentBufferMethods = createContentBufferMethods(pool);
    this.transcriptionMethods = createTranscriptionMethods(pool);
  }

  // ═══════════════════════════════════════════════════════════════════
  // SESSION METHODS (delegated)
  // ═══════════════════════════════════════════════════════════════════

  createSession: SessionStoreMethods['createSession'] = (...args) =>
    this.sessionMethods.createSession(...args);
  getSession: SessionStoreMethods['getSession'] = (...args) =>
    this.sessionMethods.getSession(...args);
  updateSession: SessionStoreMethods['updateSession'] = (...args) =>
    this.sessionMethods.updateSession(...args);
  deleteSession: SessionStoreMethods['deleteSession'] = (...args) =>
    this.sessionMethods.deleteSession(...args);
  listSessions: SessionStoreMethods['listSessions'] = (...args) =>
    this.sessionMethods.listSessions(...args);
  touchSession: SessionStoreMethods['touchSession'] = (...args) =>
    this.sessionMethods.touchSession(...args);
  cleanupExpiredSessions: SessionStoreMethods['cleanupExpiredSessions'] = () =>
    this.sessionMethods.cleanupExpiredSessions();

  // ═══════════════════════════════════════════════════════════════════
  // BUFFER METHODS (delegated)
  // ═══════════════════════════════════════════════════════════════════

  createBuffer: BufferStoreMethods['createBuffer'] = (...args) =>
    this.bufferMethods.createBuffer(...args);
  getBuffer: BufferStoreMethods['getBuffer'] = (...args) =>
    this.bufferMethods.getBuffer(...args);
  getBufferByName: BufferStoreMethods['getBufferByName'] = (...args) =>
    this.bufferMethods.getBufferByName(...args);
  updateBuffer: BufferStoreMethods['updateBuffer'] = (...args) =>
    this.bufferMethods.updateBuffer(...args);
  deleteBuffer: BufferStoreMethods['deleteBuffer'] = (...args) =>
    this.bufferMethods.deleteBuffer(...args);
  listBuffers: BufferStoreMethods['listBuffers'] = (...args) =>
    this.bufferMethods.listBuffers(...args);
  createBranch: BufferStoreMethods['createBranch'] = (...args) =>
    this.bufferMethods.createBranch(...args);
  getBranch: BufferStoreMethods['getBranch'] = (...args) =>
    this.bufferMethods.getBranch(...args);
  updateBranch: BufferStoreMethods['updateBranch'] = (...args) =>
    this.bufferMethods.updateBranch(...args);
  deleteBranch: BufferStoreMethods['deleteBranch'] = (...args) =>
    this.bufferMethods.deleteBranch(...args);
  listBranches: BufferStoreMethods['listBranches'] = (...args) =>
    this.bufferMethods.listBranches(...args);
  createVersion: BufferStoreMethods['createVersion'] = (...args) =>
    this.bufferMethods.createVersion(...args);
  getVersion: BufferStoreMethods['getVersion'] = (...args) =>
    this.bufferMethods.getVersion(...args);
  getVersionHistory: BufferStoreMethods['getVersionHistory'] = (...args) =>
    this.bufferMethods.getVersionHistory(...args);
  pruneVersions: BufferStoreMethods['pruneVersions'] = (...args) =>
    this.bufferMethods.pruneVersions(...args);

  // ═══════════════════════════════════════════════════════════════════
  // TASK METHODS (delegated)
  // ═══════════════════════════════════════════════════════════════════

  createTask: TaskStoreMethods['createTask'] = (...args) =>
    this.taskMethods.createTask(...args);
  getTask: TaskStoreMethods['getTask'] = (...args) =>
    this.taskMethods.getTask(...args);
  updateTask: TaskStoreMethods['updateTask'] = (...args) =>
    this.taskMethods.updateTask(...args);
  getTaskHistory: TaskStoreMethods['getTaskHistory'] = (...args) =>
    this.taskMethods.getTaskHistory(...args);

  // ═══════════════════════════════════════════════════════════════════
  // BOOK METHODS (delegated)
  // ═══════════════════════════════════════════════════════════════════

  createBook: BookStoreMethods['createBook'] = (...args) =>
    this.bookMethods.createBook(...args);
  getBook: BookStoreMethods['getBook'] = (...args) =>
    this.bookMethods.getBook(...args);
  updateBook: BookStoreMethods['updateBook'] = (...args) =>
    this.bookMethods.updateBook(...args);
  deleteBook: BookStoreMethods['deleteBook'] = (...args) =>
    this.bookMethods.deleteBook(...args);
  listBooks: BookStoreMethods['listBooks'] = (...args) =>
    this.bookMethods.listBooks(...args);
  createChapter: BookStoreMethods['createChapter'] = (...args) =>
    this.bookMethods.createChapter(...args);
  getChapters: BookStoreMethods['getChapters'] = (...args) =>
    this.bookMethods.getChapters(...args);
  updateChapter: BookStoreMethods['updateChapter'] = (...args) =>
    this.bookMethods.updateChapter(...args);
  deleteChapter: BookStoreMethods['deleteChapter'] = (...args) =>
    this.bookMethods.deleteChapter(...args);

  // ═══════════════════════════════════════════════════════════════════
  // CLUSTER & ARTIFACT METHODS (delegated)
  // ═══════════════════════════════════════════════════════════════════

  saveCluster: ClusterArtifactStoreMethods['saveCluster'] = (...args) =>
    this.clusterArtifactMethods.saveCluster(...args);
  getCluster: ClusterArtifactStoreMethods['getCluster'] = (...args) =>
    this.clusterArtifactMethods.getCluster(...args);
  listClusters: ClusterArtifactStoreMethods['listClusters'] = (...args) =>
    this.clusterArtifactMethods.listClusters(...args);
  findSimilarClusters: ClusterArtifactStoreMethods['findSimilarClusters'] = (...args) =>
    this.clusterArtifactMethods.findSimilarClusters(...args);
  deleteCluster: ClusterArtifactStoreMethods['deleteCluster'] = (...args) =>
    this.clusterArtifactMethods.deleteCluster(...args);
  cleanupExpiredClusters: ClusterArtifactStoreMethods['cleanupExpiredClusters'] = () =>
    this.clusterArtifactMethods.cleanupExpiredClusters();
  createArtifact: ClusterArtifactStoreMethods['createArtifact'] = (...args) =>
    this.clusterArtifactMethods.createArtifact(...args);
  getArtifact: ClusterArtifactStoreMethods['getArtifact'] = (...args) =>
    this.clusterArtifactMethods.getArtifact(...args);
  listArtifacts: ClusterArtifactStoreMethods['listArtifacts'] = (...args) =>
    this.clusterArtifactMethods.listArtifacts(...args);
  exportArtifact: ClusterArtifactStoreMethods['exportArtifact'] = (...args) =>
    this.clusterArtifactMethods.exportArtifact(...args);
  deleteArtifact: ClusterArtifactStoreMethods['deleteArtifact'] = (...args) =>
    this.clusterArtifactMethods.deleteArtifact(...args);
  cleanupExpiredArtifacts: ClusterArtifactStoreMethods['cleanupExpiredArtifacts'] = () =>
    this.clusterArtifactMethods.cleanupExpiredArtifacts();

  // ═══════════════════════════════════════════════════════════════════
  // PERSONA & STYLE METHODS (delegated)
  // ═══════════════════════════════════════════════════════════════════

  createPersonaProfile: PersonaStyleStoreMethods['createPersonaProfile'] = (...args) =>
    this.personaStyleMethods.createPersonaProfile(...args);
  getPersonaProfile: PersonaStyleStoreMethods['getPersonaProfile'] = (...args) =>
    this.personaStyleMethods.getPersonaProfile(...args);
  getPersonaProfileByName: PersonaStyleStoreMethods['getPersonaProfileByName'] = (...args) =>
    this.personaStyleMethods.getPersonaProfileByName(...args);
  getDefaultPersonaProfile: PersonaStyleStoreMethods['getDefaultPersonaProfile'] = (...args) =>
    this.personaStyleMethods.getDefaultPersonaProfile(...args);
  updatePersonaProfile: PersonaStyleStoreMethods['updatePersonaProfile'] = (...args) =>
    this.personaStyleMethods.updatePersonaProfile(...args);
  deletePersonaProfile: PersonaStyleStoreMethods['deletePersonaProfile'] = (...args) =>
    this.personaStyleMethods.deletePersonaProfile(...args);
  listPersonaProfiles: PersonaStyleStoreMethods['listPersonaProfiles'] = (...args) =>
    this.personaStyleMethods.listPersonaProfiles(...args);
  createStyleProfile: PersonaStyleStoreMethods['createStyleProfile'] = (...args) =>
    this.personaStyleMethods.createStyleProfile(...args);
  getStyleProfile: PersonaStyleStoreMethods['getStyleProfile'] = (...args) =>
    this.personaStyleMethods.getStyleProfile(...args);
  getStyleProfileByName: PersonaStyleStoreMethods['getStyleProfileByName'] = (...args) =>
    this.personaStyleMethods.getStyleProfileByName(...args);
  getDefaultStyleProfile: PersonaStyleStoreMethods['getDefaultStyleProfile'] = (...args) =>
    this.personaStyleMethods.getDefaultStyleProfile(...args);
  updateStyleProfile: PersonaStyleStoreMethods['updateStyleProfile'] = (...args) =>
    this.personaStyleMethods.updateStyleProfile(...args);
  deleteStyleProfile: PersonaStyleStoreMethods['deleteStyleProfile'] = (...args) =>
    this.personaStyleMethods.deleteStyleProfile(...args);
  listStyleProfiles: PersonaStyleStoreMethods['listStyleProfiles'] = (...args) =>
    this.personaStyleMethods.listStyleProfiles(...args);

  // ═══════════════════════════════════════════════════════════════════
  // CONTENT BUFFER METHODS (delegated)
  // ═══════════════════════════════════════════════════════════════════

  saveContentBuffer: ContentBufferStoreMethods['saveContentBuffer'] = (...args) =>
    this.contentBufferMethods.saveContentBuffer(...args);
  loadContentBuffer: ContentBufferStoreMethods['loadContentBuffer'] = (...args) =>
    this.contentBufferMethods.loadContentBuffer(...args);
  findContentBuffersByHash: ContentBufferStoreMethods['findContentBuffersByHash'] = (...args) =>
    this.contentBufferMethods.findContentBuffersByHash(...args);
  updateContentBuffer: ContentBufferStoreMethods['updateContentBuffer'] = (...args) =>
    this.contentBufferMethods.updateContentBuffer(...args);
  deleteContentBuffer: ContentBufferStoreMethods['deleteContentBuffer'] = (...args) =>
    this.contentBufferMethods.deleteContentBuffer(...args);
  listContentBuffers: ContentBufferStoreMethods['listContentBuffers'] = (...args) =>
    this.contentBufferMethods.listContentBuffers(...args);
  findSimilarContentBuffers: ContentBufferStoreMethods['findSimilarContentBuffers'] = (...args) =>
    this.contentBufferMethods.findSimilarContentBuffers(...args);
  saveProvenanceChain: ContentBufferStoreMethods['saveProvenanceChain'] = (...args) =>
    this.contentBufferMethods.saveProvenanceChain(...args);
  loadProvenanceChain: ContentBufferStoreMethods['loadProvenanceChain'] = (...args) =>
    this.contentBufferMethods.loadProvenanceChain(...args);
  getProvenanceChainByBuffer: ContentBufferStoreMethods['getProvenanceChainByBuffer'] = (...args) =>
    this.contentBufferMethods.getProvenanceChainByBuffer(...args);
  updateProvenanceChain: ContentBufferStoreMethods['updateProvenanceChain'] = (...args) =>
    this.contentBufferMethods.updateProvenanceChain(...args);
  deleteProvenanceChain: ContentBufferStoreMethods['deleteProvenanceChain'] = (...args) =>
    this.contentBufferMethods.deleteProvenanceChain(...args);
  findDerivedChains: ContentBufferStoreMethods['findDerivedChains'] = (...args) =>
    this.contentBufferMethods.findDerivedChains(...args);
  saveBufferOperation: ContentBufferStoreMethods['saveBufferOperation'] = (...args) =>
    this.contentBufferMethods.saveBufferOperation(...args);
  loadBufferOperation: ContentBufferStoreMethods['loadBufferOperation'] = (...args) =>
    this.contentBufferMethods.loadBufferOperation(...args);
  getOperationsByChain: ContentBufferStoreMethods['getOperationsByChain'] = (...args) =>
    this.contentBufferMethods.getOperationsByChain(...args);
  findOperationsByHash: ContentBufferStoreMethods['findOperationsByHash'] = (...args) =>
    this.contentBufferMethods.findOperationsByHash(...args);
  deleteBufferOperation: ContentBufferStoreMethods['deleteBufferOperation'] = (...args) =>
    this.contentBufferMethods.deleteBufferOperation(...args);
  loadFullProvenanceChain: ContentBufferStoreMethods['loadFullProvenanceChain'] = (...args) =>
    this.contentBufferMethods.loadFullProvenanceChain(...args);

  // ═══════════════════════════════════════════════════════════════════
  // TRANSCRIPTION METHODS (delegated)
  // ═══════════════════════════════════════════════════════════════════

  createTranscriptionVersion: TranscriptionStoreMethods['createTranscriptionVersion'] = (...args) =>
    this.transcriptionMethods.createTranscriptionVersion(...args);
  getTranscriptionVersion: TranscriptionStoreMethods['getTranscriptionVersion'] = (...args) =>
    this.transcriptionMethods.getTranscriptionVersion(...args);
  getTranscriptionVersionsForMedia: TranscriptionStoreMethods['getTranscriptionVersionsForMedia'] = (...args) =>
    this.transcriptionMethods.getTranscriptionVersionsForMedia(...args);
  getPreferredTranscription: TranscriptionStoreMethods['getPreferredTranscription'] = (...args) =>
    this.transcriptionMethods.getPreferredTranscription(...args);
  listTranscriptionVersions: TranscriptionStoreMethods['listTranscriptionVersions'] = (...args) =>
    this.transcriptionMethods.listTranscriptionVersions(...args);
  setPreferredTranscriptionVersion: TranscriptionStoreMethods['setPreferredTranscriptionVersion'] = (...args) =>
    this.transcriptionMethods.setPreferredTranscriptionVersion(...args);
  deleteTranscriptionVersion: TranscriptionStoreMethods['deleteTranscriptionVersion'] = (...args) =>
    this.transcriptionMethods.deleteTranscriptionVersion(...args);
  deleteTranscriptionsForMedia: TranscriptionStoreMethods['deleteTranscriptionsForMedia'] = (...args) =>
    this.transcriptionMethods.deleteTranscriptionsForMedia(...args);
  updateTranscriptionStatus: TranscriptionStoreMethods['updateTranscriptionStatus'] = (...args) =>
    this.transcriptionMethods.updateTranscriptionStatus(...args);
  completeTranscription: TranscriptionStoreMethods['completeTranscription'] = (...args) =>
    this.transcriptionMethods.completeTranscription(...args);
  getTranscriptionSummary: TranscriptionStoreMethods['getTranscriptionSummary'] = (...args) =>
    this.transcriptionMethods.getTranscriptionSummary(...args);
  createTranscriptionJob: TranscriptionStoreMethods['createTranscriptionJob'] = (...args) =>
    this.transcriptionMethods.createTranscriptionJob(...args);
  getTranscriptionJob: TranscriptionStoreMethods['getTranscriptionJob'] = (...args) =>
    this.transcriptionMethods.getTranscriptionJob(...args);
  updateTranscriptionJob: TranscriptionStoreMethods['updateTranscriptionJob'] = (...args) =>
    this.transcriptionMethods.updateTranscriptionJob(...args);
  getPendingTranscriptionJobs: TranscriptionStoreMethods['getPendingTranscriptionJobs'] = (...args) =>
    this.transcriptionMethods.getPendingTranscriptionJobs(...args);
  getTranscriptionJobsForMedia: TranscriptionStoreMethods['getTranscriptionJobsForMedia'] = (...args) =>
    this.transcriptionMethods.getTranscriptionJobsForMedia(...args);
  deleteTranscriptionJob: TranscriptionStoreMethods['deleteTranscriptionJob'] = (...args) =>
    this.transcriptionMethods.deleteTranscriptionJob(...args);
  cleanupCompletedTranscriptionJobs: TranscriptionStoreMethods['cleanupCompletedTranscriptionJobs'] = (...args) =>
    this.transcriptionMethods.cleanupCompletedTranscriptionJobs(...args);
  // Embedding management (first-class citizen in universal content space)
  updateTranscriptionEmbedding: TranscriptionStoreMethods['updateTranscriptionEmbedding'] = (...args) =>
    this.transcriptionMethods.updateTranscriptionEmbedding(...args);
  getTranscriptionsNeedingEmbedding: TranscriptionStoreMethods['getTranscriptionsNeedingEmbedding'] = (...args) =>
    this.transcriptionMethods.getTranscriptionsNeedingEmbedding(...args);
  getTranscriptionsWithStaleEmbedding: TranscriptionStoreMethods['getTranscriptionsWithStaleEmbedding'] = (...args) =>
    this.transcriptionMethods.getTranscriptionsWithStaleEmbedding(...args);
  updateSourceContext: TranscriptionStoreMethods['updateSourceContext'] = (...args) =>
    this.transcriptionMethods.updateSourceContext(...args);

  // ═══════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Run all cleanup tasks
   */
  async runCleanup(): Promise<{
    sessions: number;
    clusters: number;
    artifacts: number;
  }> {
    const [sessions, clusters, artifacts] = await Promise.all([
      this.cleanupExpiredSessions(),
      this.cleanupExpiredClusters(),
      this.cleanupExpiredArtifacts(),
    ]);

    return { sessions, clusters, artifacts };
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

let _auiStore: AuiPostgresStore | null = null;

/**
 * Get the AUI store singleton
 */
export function getAuiStore(): AuiPostgresStore | null {
  return _auiStore;
}

/**
 * Initialize the AUI store singleton
 */
export function initAuiStore(
  pool: Pool,
  options?: AuiPostgresStoreOptions
): AuiPostgresStore {
  _auiStore = new AuiPostgresStore(pool, options);
  return _auiStore;
}

/**
 * Reset the AUI store singleton
 */
export function resetAuiStore(): void {
  _auiStore = null;
}
