/**
 * Unified AUI Service
 *
 * Main orchestration service that integrates all AUI subsystems:
 * - Versioned buffers
 * - Agentic loop
 * - Admin (config, prompts, costs, tiers)
 * - Search (via AgenticSearchService)
 * - BQL execution
 *
 * Implementation files:
 * - ./types.ts - Service-specific types
 * - ./session-manager.ts - In-memory session management
 * - ./service-core.ts - Core service methods
 * - ./archive-clustering.ts - Archive and clustering operations
 * - ./books.ts - Book creation and artifact operations
 * - ./persona.ts - Persona harvest and profile operations
 * - ./factory.ts - Factory functions and global instance
 *
 * @module @humanizer/core/aui/service
 */

import type {
  UnifiedAuiSession,
  UnifiedAuiServiceOptions,
  ProcessOptions,
  AuiResponse,
  BqlOptions,
  BqlResult,
  VersionedBuffer,
  BufferVersion,
  BufferBranch,
  BufferDiff,
  MergeResult,
  AgentTask,
  AgentLoopOptions,
  UserTier,
  UserUsage,
  CostReportOptions,
  CostReport,
  LimitCheckResult,
  ArchiveStats,
  EmbedAllOptions,
  EmbedResult,
  ClusterDiscoveryOptions,
  ClusterDiscoveryResult,
  ContentCluster,
  BookFromClusterOptions,
  HarvestOptions,
  HarvestResult,
  GenerateArcOptions,
  NarrativeArc,
  Book,
  BookChapter,
} from '../types.js';
import type { AgenticLoop } from '../agentic-loop.js';
import type { AdminService } from '../admin-service.js';
import type {
  AgenticSearchService,
  AgenticSearchOptions,
  AgenticSearchResponse,
  RefineOptions,
  SemanticAnchor,
} from '../../agentic-search/index.js';
import type { PromptTemplate } from '../../config/types.js';
import type {
  AuiPostgresStore,
  AuiArtifact,
  PersonaProfile,
  StyleProfile,
  CreatePersonaProfileOptions,
  CreateStyleProfileOptions,
} from '../../storage/aui-postgres-store.js';
import type { BooksPostgresStore } from '../../storage/books-postgres-store.js';
import type { PostgresContentStore } from '../../storage/postgres-content-store.js';
import type { BufferService } from '../../buffer/buffer-service.js';
import { BufferServiceImpl } from '../../buffer/buffer-service-impl.js';
import type { ContentBuffer, ProvenanceChain, BufferOperation } from '../../buffer/types.js';
import { BufferManager, getBufferManager, initBufferManager } from '../buffer-manager.js';

// Import module implementations
import { AuiSessionManager } from './session-manager.js';
import type { ServiceDependencies, PersonaHarvestSession } from './types.js';
import {
  createInitializationMethods,
  createSessionMethods,
  createProcessingMethods,
  createBufferMethods,
  createSearchMethods,
  createAdminMethods,
  type SessionMethods,
  type ProcessingMethods,
  type BufferMethods,
  type SearchMethods,
  type AdminMethods,
} from './service-core.js';
import {
  createArchiveMethods,
  createClusteringMethods,
  type ArchiveMethods,
  type ClusteringMethods,
} from './archive-clustering.js';
import {
  createBookMethods,
  createProvenanceMethods,
  createArtifactMethods,
  type BookMethods,
  type ProvenanceMethods,
  type ArtifactMethods,
} from './books.js';
import {
  createPersonaHarvestMethods,
  createStyleProfileMethods,
  createPersonaProfileMethods,
  type PersonaHarvestMethods,
  type StyleProfileMethods,
  type PersonaProfileMethods,
} from './persona.js';
import {
  createDraftingMethods,
  DEFAULT_NARRATOR_PERSONA,
  type DraftingMethods,
} from './drafting.js';
import type {
  DraftingSession,
  DraftVersion,
  StartDraftingOptions,
  GenerateDraftOptions,
  ReviseDraftOptions,
  ExportConfig,
  ExportedArtifact,
  DraftingStatus,
  DraftingProgressCallback,
} from '../types/drafting-types.js';

// Re-export types
export type {
  PersonaHarvestSession,
  ServiceDependencies,
  StartHarvestResult,
  ExtractTraitsResult,
  FinalizePersonaResult,
  CreateUnifiedAuiOptions,
  InitUnifiedAuiWithStorageOptions,
} from './types.js';
export { AuiSessionManager } from './session-manager.js';

// Re-export factory functions
export {
  createUnifiedAuiService,
  initUnifiedAuiWithStorage,
  initUnifiedAui,
  getUnifiedAui,
  resetUnifiedAui,
} from './factory.js';

// Re-export drafting service
export {
  createDraftingMethods,
  setDraftingMethods,
  getDraftingMethods,
  resetDraftingMethods,
  DEFAULT_NARRATOR_PERSONA,
  type DraftingMethods,
} from './drafting.js';

// Re-export export templates
export {
  generateThemeCss,
  generateHtmlDocument,
  generateMarkdownDocument,
  generateJsonDocument,
  extractHeadings,
  markdownToHtml,
  generateTocHtml,
  HUMANIZER_THEME,
  HUMANIZER_LIGHT_COLORS,
  HUMANIZER_DARK_COLORS,
  DEFAULT_SECTION_STYLES,
} from './export-templates.js';

// Re-export model config service
export {
  ModelConfigService,
  initModelConfigService,
  getModelConfigService,
  resetModelConfigService,
  type ModelConfig,
  type ModelConfigWithSource,
  type ModelConfigInput,
  type ModelParameterOverrides,
  type ModelAvailabilityStatus,
  type ModelConfigServiceOptions,
} from './model-config-service.js';

// Re-export provider config service
export {
  ProviderConfigService,
  initProviderConfigService,
  getProviderConfigService,
  resetProviderConfigService,
  type ProviderConfig,
  type ProviderConfigWithSource,
  type ProviderConfigInput,
  type ProviderHealthStatus,
  type ProviderConfigServiceOptions,
  type DecryptedApiKey,
} from './provider-config-service.js';

// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED AUI SERVICE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * UnifiedAuiService is the main entry point for the AUI system.
 * It orchestrates all subsystems and provides a unified API.
 */
export class UnifiedAuiService {
  private sessionManager: AuiSessionManager;
  private bufferManager: BufferManager;
  private agenticLoop: AgenticLoop | null = null;
  private adminService: AdminService | null = null;
  private agenticSearch: AgenticSearchService | null = null;
  private bqlExecutor: ((pipeline: string) => Promise<{ data?: unknown; error?: string }>) | null =
    null;
  private options: UnifiedAuiServiceOptions;

  // Persistent storage
  private store: AuiPostgresStore | null = null;
  private booksStore: BooksPostgresStore | null = null;
  private archiveStore: PostgresContentStore | null = null;
  private sessionCache: Map<string, UnifiedAuiSession> = new Map();

  // Content buffer service (provenance-aware transformation pipelines)
  private bufferService: BufferService | null = null;

  // In-memory state
  private books: Map<string, Book> = new Map();
  private harvestSessions: Map<string, PersonaHarvestSession> = new Map();

  // Composed method implementations
  private sessionMethods!: SessionMethods;
  private processingMethods!: ProcessingMethods;
  private bufferMethods!: BufferMethods;
  private searchMethods!: SearchMethods;
  private adminMethods!: AdminMethods;
  private archiveMethods!: ArchiveMethods;
  private clusteringMethods!: ClusteringMethods;
  private bookMethods!: BookMethods;
  private provenanceMethods!: ProvenanceMethods;
  private artifactMethods!: ArtifactMethods;
  private personaHarvestMethods!: PersonaHarvestMethods;
  private styleProfileMethods!: StyleProfileMethods;
  private personaProfileMethods!: PersonaProfileMethods;
  private draftingMethods!: DraftingMethods;

  constructor(options?: UnifiedAuiServiceOptions) {
    this.options = options ?? {};
    this.sessionManager = new AuiSessionManager({
      maxSessions: options?.maxSessions,
      sessionTimeoutMs: options?.sessionTimeoutMs,
    });
    this.bufferManager = getBufferManager() ?? initBufferManager();

    // Initialize method implementations
    this.initializeMethodImplementations();
  }

  private initializeMethodImplementations(): void {
    // Create dependencies getter
    const deps: ServiceDependencies = {
      getStore: () => this.store,
      getBooksStore: () => this.booksStore,
      getArchiveStore: () => this.archiveStore,
      getAgenticSearch: () => this.agenticSearch,
      getAgenticLoop: () => this.agenticLoop,
      getAdminService: () => this.adminService,
      getBqlExecutor: () => this.bqlExecutor,
      getBufferService: () => this.getBufferService(),
      getBufferManager: () => this.bufferManager,
      getSessionManager: () => this.sessionManager,
      getDefaultEmbeddingModel: () => this.getDefaultEmbeddingModel(),
      getBooks: () => this.books,
      getHarvestSessions: () => this.harvestSessions,
      getSessionCache: () => this.sessionCache,
    };

    // Create initialization methods
    const initMethods = createInitializationMethods(
      () => this.store,
      () => this.archiveStore,
      () => this.booksStore
    );
    this.getDefaultEmbeddingModel = initMethods.getDefaultEmbeddingModel;
    this.createAuiStoreAdapter = initMethods.createAuiStoreAdapter;
    this.createArchiveStoreAdapter = initMethods.createArchiveStoreAdapter;
    this.createBooksStoreAdapter = initMethods.createBooksStoreAdapter;

    // Create core methods
    this.sessionMethods = createSessionMethods(deps);
    this.processingMethods = createProcessingMethods(deps, this.sessionMethods);
    this.bufferMethods = createBufferMethods(deps, this.sessionMethods);
    this.searchMethods = createSearchMethods(deps, this.sessionMethods, this.bufferMethods);
    this.adminMethods = createAdminMethods(deps);

    // Create archive and clustering methods
    this.archiveMethods = createArchiveMethods(deps);
    this.clusteringMethods = createClusteringMethods(deps);

    // Create book and artifact methods
    this.bookMethods = createBookMethods(deps, this.clusteringMethods);
    this.provenanceMethods = createProvenanceMethods(deps);
    this.artifactMethods = createArtifactMethods(deps, this.bookMethods);

    // Create persona methods
    this.personaHarvestMethods = createPersonaHarvestMethods(
      deps,
      this.sessionMethods,
      this.bookMethods
    );
    this.styleProfileMethods = createStyleProfileMethods(deps);
    this.personaProfileMethods = createPersonaProfileMethods(deps);

    // Create drafting methods
    this.draftingMethods = createDraftingMethods(deps, this.clusteringMethods, this.bookMethods);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  setAgenticLoop(loop: AgenticLoop): void {
    this.agenticLoop = loop;
  }

  setAdminService(service: AdminService): void {
    this.adminService = service;
  }

  setAgenticSearch(service: AgenticSearchService): void {
    this.agenticSearch = service;
  }

  setBqlExecutor(executor: (pipeline: string) => Promise<{ data?: unknown; error?: string }>): void {
    this.bqlExecutor = executor;
  }

  setStore(store: AuiPostgresStore): void {
    this.store = store;
  }

  setBooksStore(store: BooksPostgresStore): void {
    this.booksStore = store;
  }

  setArchiveStore(store: PostgresContentStore): void {
    this.archiveStore = store;
  }

  hasStore(): boolean {
    return this.store !== null;
  }

  hasArchiveStore(): boolean {
    return this.archiveStore !== null;
  }

  getArchiveStore(): PostgresContentStore | null {
    return this.archiveStore;
  }

  hasBooksStore(): boolean {
    return this.booksStore !== null && this.booksStore.isAvailable();
  }

  setBufferService(service: BufferService): void {
    this.bufferService = service;
  }

  hasBufferService(): boolean {
    return this.bufferService !== null;
  }

  getBufferService(): BufferService {
    if (!this.bufferService) {
      this.bufferService = new BufferServiceImpl({
        auiStore: this.store ? this.createAuiStoreAdapter() : undefined,
        archiveStore: this.archiveStore ? this.createArchiveStoreAdapter() : undefined,
        booksStore: this.booksStore ? this.createBooksStoreAdapter() : undefined,
      });
    }
    return this.bufferService;
  }

  rebuildBufferService(): BufferService {
    this.bufferService = null;
    return this.getBufferService();
  }

  // Private adapter creation (implemented via initMethods)
  private getDefaultEmbeddingModel!: () => string;
  private createAuiStoreAdapter!: () => import('../../buffer/buffer-service.js').AuiStoreAdapter | undefined;
  private createArchiveStoreAdapter!: () => import('../../buffer/buffer-service.js').ArchiveStoreAdapter | undefined;
  private createBooksStoreAdapter!: () => import('../../buffer/buffer-service.js').BooksStoreAdapter | undefined;

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION MANAGEMENT - Delegated
  // ═══════════════════════════════════════════════════════════════════════════

  createSession = (options?: { userId?: string; name?: string }): Promise<UnifiedAuiSession> =>
    this.sessionMethods.createSession(options);

  getSessionAsync = (id: string): Promise<UnifiedAuiSession | undefined> =>
    this.sessionMethods.getSessionAsync(id);

  getSession = (id: string): UnifiedAuiSession | undefined => this.sessionMethods.getSession(id);

  deleteSession = (id: string): boolean => this.sessionMethods.deleteSession(id);

  listSessions = (): UnifiedAuiSession[] => this.sessionMethods.listSessions();

  // ═══════════════════════════════════════════════════════════════════════════
  // PROCESSING METHODS - Delegated
  // ═══════════════════════════════════════════════════════════════════════════

  process = (sessionId: string, request: string, options?: ProcessOptions): Promise<AuiResponse> =>
    this.processingMethods.process(sessionId, request, options);

  runAgent = (sessionId: string, request: string, options?: AgentLoopOptions): Promise<AgentTask> =>
    this.processingMethods.runAgent(sessionId, request, options);

  executeBql = (sessionId: string, pipeline: string, options?: BqlOptions): Promise<BqlResult> =>
    this.processingMethods.executeBql(sessionId, pipeline, options);

  // ═══════════════════════════════════════════════════════════════════════════
  // BUFFER METHODS - Delegated
  // ═══════════════════════════════════════════════════════════════════════════

  createBuffer = (sessionId: string, name: string, content?: unknown[]): VersionedBuffer =>
    this.bufferMethods.createBuffer(sessionId, name, content);

  getBuffer = (sessionId: string, name: string): VersionedBuffer | undefined =>
    this.bufferMethods.getBuffer(sessionId, name);

  listBuffers = (sessionId: string): VersionedBuffer[] => this.bufferMethods.listBuffers(sessionId);

  setBufferContent = (sessionId: string, bufferName: string, content: unknown[]): void =>
    this.bufferMethods.setBufferContent(sessionId, bufferName, content);

  appendToBuffer = (sessionId: string, bufferName: string, items: unknown[]): void =>
    this.bufferMethods.appendToBuffer(sessionId, bufferName, items);

  commit = (sessionId: string, bufferName: string, message: string): Promise<BufferVersion> =>
    this.bufferMethods.commit(sessionId, bufferName, message);

  rollback = (sessionId: string, bufferName: string, steps?: number): BufferVersion =>
    this.bufferMethods.rollback(sessionId, bufferName, steps);

  getHistory = (sessionId: string, bufferName: string, limit?: number): BufferVersion[] =>
    this.bufferMethods.getHistory(sessionId, bufferName, limit);

  branch = (sessionId: string, bufferName: string, branchName: string): BufferBranch =>
    this.bufferMethods.branch(sessionId, bufferName, branchName);

  switchBranch = (sessionId: string, bufferName: string, branchName: string): void =>
    this.bufferMethods.switchBranch(sessionId, bufferName, branchName);

  merge = (sessionId: string, bufferName: string, sourceBranch: string, message?: string): MergeResult =>
    this.bufferMethods.merge(sessionId, bufferName, sourceBranch, message);

  diff = (sessionId: string, bufferName: string, from: string, to: string): BufferDiff =>
    this.bufferMethods.diff(sessionId, bufferName, from, to);

  // ═══════════════════════════════════════════════════════════════════════════
  // SEARCH METHODS - Delegated
  // ═══════════════════════════════════════════════════════════════════════════

  search = (
    sessionId: string,
    query: string,
    options?: AgenticSearchOptions
  ): Promise<AgenticSearchResponse> => this.searchMethods.search(sessionId, query, options);

  refine = (sessionId: string, options: RefineOptions): Promise<AgenticSearchResponse> =>
    this.searchMethods.refine(sessionId, options);

  addAnchor = (
    sessionId: string,
    resultId: string,
    type: 'positive' | 'negative'
  ): Promise<SemanticAnchor> => this.searchMethods.addAnchor(sessionId, resultId, type);

  searchToBuffer = (
    sessionId: string,
    bufferName: string,
    options?: { limit?: number; create?: boolean }
  ): Promise<VersionedBuffer> => this.searchMethods.searchToBuffer(sessionId, bufferName, options);

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN METHODS - Delegated
  // ═══════════════════════════════════════════════════════════════════════════

  getConfig = (category: string, key: string): Promise<unknown> =>
    this.adminMethods.getConfig(category, key);

  setConfig = (category: string, key: string, value: unknown): Promise<void> =>
    this.adminMethods.setConfig(category, key, value);

  listPrompts = (): Promise<PromptTemplate[]> => this.adminMethods.listPrompts();

  getPrompt = (id: string): Promise<PromptTemplate | undefined> => this.adminMethods.getPrompt(id);

  setPrompt = (template: Omit<PromptTemplate, 'version'>): Promise<void> =>
    this.adminMethods.setPrompt(template);

  getCostReport = (options: CostReportOptions): Promise<CostReport> =>
    this.adminMethods.getCostReport(options);

  getUsage = (userId: string): Promise<UserUsage> => this.adminMethods.getUsage(userId);

  checkLimits = (userId: string): Promise<LimitCheckResult> =>
    this.adminMethods.checkLimits(userId);

  listTiers = (): Promise<UserTier[]> => this.adminMethods.listTiers();

  setUserTier = (userId: string, tierId: string): Promise<void> =>
    this.adminMethods.setUserTier(userId, tierId);

  // ═══════════════════════════════════════════════════════════════════════════
  // ARCHIVE METHODS - Delegated
  // ═══════════════════════════════════════════════════════════════════════════

  getArchiveStats = (): Promise<ArchiveStats> => this.archiveMethods.getArchiveStats();

  embedAll = (options?: EmbedAllOptions): Promise<EmbedResult> =>
    this.archiveMethods.embedAll(options);

  embedBatch = (nodeIds: string[]): Promise<EmbedResult> => this.archiveMethods.embedBatch(nodeIds);

  // ═══════════════════════════════════════════════════════════════════════════
  // CLUSTERING METHODS - Delegated
  // ═══════════════════════════════════════════════════════════════════════════

  discoverClusters = (options?: ClusterDiscoveryOptions): Promise<ClusterDiscoveryResult> =>
    this.clusteringMethods.discoverClusters(options);

  listClusters = (options?: { userId?: string; limit?: number }): Promise<ContentCluster[]> =>
    this.clusteringMethods.listClusters(options);

  getCluster = (clusterId: string): Promise<ContentCluster | undefined> =>
    this.clusteringMethods.getCluster(clusterId);

  saveCluster = (cluster: ContentCluster, userId?: string): Promise<ContentCluster> =>
    this.clusteringMethods.saveCluster(cluster, userId);

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOK METHODS - Delegated
  // ═══════════════════════════════════════════════════════════════════════════

  createBookFromCluster = (clusterId: string, options?: BookFromClusterOptions): Promise<Book> =>
    this.bookMethods.createBookFromCluster(clusterId, options);

  createBookWithPersona = (options: Parameters<BookMethods['createBookWithPersona']>[0]): Promise<Book> =>
    this.bookMethods.createBookWithPersona(options);

  harvest = (options: HarvestOptions): Promise<HarvestResult> => this.bookMethods.harvest(options);

  generateArc = (options: GenerateArcOptions): Promise<NarrativeArc> =>
    this.bookMethods.generateArc(options);

  listBooks = (options?: { userId?: string; limit?: number }): Promise<Book[]> =>
    this.bookMethods.listBooks(options);

  getBook = (bookId: string): Promise<Book | undefined> => this.bookMethods.getBook(bookId);

  // ═══════════════════════════════════════════════════════════════════════════
  // PROVENANCE METHODS - Delegated
  // ═══════════════════════════════════════════════════════════════════════════

  createChapterFromBuffer = (
    buffer: ContentBuffer,
    bookId: string,
    options?: { chapterTitle?: string; chapterId?: string; position?: number }
  ): Promise<BookChapter> => this.provenanceMethods.createChapterFromBuffer(buffer, bookId, options);

  transformAndCommitToBook = (
    options: Parameters<ProvenanceMethods['transformAndCommitToBook']>[0]
  ): Promise<{ chapter: BookChapter; buffer: ContentBuffer; provenance: ProvenanceChain }> =>
    this.provenanceMethods.transformAndCommitToBook(options);

  getChapterProvenance = (
    bookId: string,
    chapterId: string
  ): Promise<ProvenanceChain | undefined> =>
    this.provenanceMethods.getChapterProvenance(bookId, chapterId);

  traceToArchiveOrigin = (
    buffer: ContentBuffer
  ): Promise<{ archiveNodeIds: string[]; transformationCount: number; operations: BufferOperation[] }> =>
    this.provenanceMethods.traceToArchiveOrigin(buffer);

  // ═══════════════════════════════════════════════════════════════════════════
  // ARTIFACT METHODS - Delegated
  // ═══════════════════════════════════════════════════════════════════════════

  exportBook = (
    bookId: string,
    format?: 'markdown' | 'html' | 'json'
  ): Promise<AuiArtifact | undefined> => this.artifactMethods.exportBook(bookId, format);

  downloadArtifact = (artifactId: string): Promise<AuiArtifact | undefined> =>
    this.artifactMethods.downloadArtifact(artifactId);

  listArtifacts = (
    options?: { userId?: string; limit?: number }
  ): Promise<Omit<AuiArtifact, 'content' | 'contentBinary'>[]> =>
    this.artifactMethods.listArtifacts(options);

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSONA HARVEST METHODS - Delegated
  // ═══════════════════════════════════════════════════════════════════════════

  startPersonaHarvest = (
    sessionId: string,
    options: { name: string }
  ): Promise<import('./types.js').StartHarvestResult> =>
    this.personaHarvestMethods.startPersonaHarvest(sessionId, options);

  addPersonaSample = (
    harvestId: string,
    options: { text: string; source?: 'user-provided' | 'archive'; archiveNodeId?: string }
  ): Promise<{ totalSamples: number }> =>
    this.personaHarvestMethods.addPersonaSample(harvestId, options);

  harvestFromArchive = (
    harvestId: string,
    options: { query: string; minRelevance?: number; limit?: number }
  ): Promise<{ samplesFound: number; totalSamples: number }> =>
    this.personaHarvestMethods.harvestFromArchive(harvestId, options);

  extractPersonaTraits = (harvestId: string): Promise<import('./types.js').ExtractTraitsResult> =>
    this.personaHarvestMethods.extractPersonaTraits(harvestId);

  finalizePersona = (
    harvestId: string,
    options: Parameters<PersonaHarvestMethods['finalizePersona']>[1]
  ): Promise<import('./types.js').FinalizePersonaResult> =>
    this.personaHarvestMethods.finalizePersona(harvestId, options);

  getHarvestSession = (harvestId: string): PersonaHarvestSession | undefined =>
    this.personaHarvestMethods.getHarvestSession(harvestId);

  generatePersonaSample = (
    harvestId: string,
    options?: { wordCount?: number; topic?: string }
  ): ReturnType<PersonaHarvestMethods['generatePersonaSample']> =>
    this.personaHarvestMethods.generatePersonaSample(harvestId, options);

  // ═══════════════════════════════════════════════════════════════════════════
  // STYLE PROFILE METHODS - Delegated
  // ═══════════════════════════════════════════════════════════════════════════

  createStyleProfile = (options: CreateStyleProfileOptions): Promise<StyleProfile> =>
    this.styleProfileMethods.createStyleProfile(options);

  getStyleProfile = (id: string): Promise<StyleProfile | undefined> =>
    this.styleProfileMethods.getStyleProfile(id);

  getDefaultStyleProfile = (personaId: string): Promise<StyleProfile | undefined> =>
    this.styleProfileMethods.getDefaultStyleProfile(personaId);

  listStyleProfiles = (personaId: string): Promise<StyleProfile[]> =>
    this.styleProfileMethods.listStyleProfiles(personaId);

  updateStyleProfile = (
    id: string,
    update: Partial<Omit<StyleProfile, 'id' | 'personaId' | 'createdAt' | 'updatedAt'>>
  ): Promise<StyleProfile | undefined> => this.styleProfileMethods.updateStyleProfile(id, update);

  deleteStyleProfile = (id: string): Promise<boolean> =>
    this.styleProfileMethods.deleteStyleProfile(id);

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSONA PROFILE METHODS - Delegated
  // ═══════════════════════════════════════════════════════════════════════════

  getPersonaProfile = (id: string): Promise<PersonaProfile | undefined> =>
    this.personaProfileMethods.getPersonaProfile(id);

  listPersonaProfiles = (options?: {
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<PersonaProfile[]> => this.personaProfileMethods.listPersonaProfiles(options);

  getDefaultPersonaProfile = (userId: string): Promise<PersonaProfile | undefined> =>
    this.personaProfileMethods.getDefaultPersonaProfile(userId);

  setDefaultPersona = (userId: string, personaId: string): Promise<PersonaProfile> =>
    this.personaProfileMethods.setDefaultPersona(userId, personaId);

  // ═══════════════════════════════════════════════════════════════════════════
  // DRAFTING LOOP METHODS - Delegated
  // ═══════════════════════════════════════════════════════════════════════════

  startDrafting = (options: StartDraftingOptions): Promise<DraftingSession> =>
    this.draftingMethods.startDrafting(options);

  gatherMaterial = (
    sessionId: string,
    onProgress?: DraftingProgressCallback
  ): Promise<import('../types/drafting-types.js').GatherResult> =>
    this.draftingMethods.gatherMaterial(sessionId, onProgress);

  generateDraft = (
    sessionId: string,
    options?: GenerateDraftOptions,
    onProgress?: DraftingProgressCallback
  ): Promise<DraftVersion> =>
    this.draftingMethods.generateDraft(sessionId, options, onProgress);

  reviseDraft = (
    sessionId: string,
    options: ReviseDraftOptions,
    onProgress?: DraftingProgressCallback
  ): Promise<DraftVersion> =>
    this.draftingMethods.reviseDraft(sessionId, options, onProgress);

  finalizeDraft = (
    sessionId: string,
    config?: ExportConfig,
    onProgress?: DraftingProgressCallback
  ): Promise<ExportedArtifact[]> =>
    this.draftingMethods.finalizeDraft(sessionId, config, onProgress);

  getDraftingSession = (sessionId: string): DraftingSession | undefined =>
    this.draftingMethods.getDraftingSession(sessionId);

  listDraftingSessions = (options?: {
    userId?: string;
    status?: DraftingStatus;
    limit?: number;
  }): DraftingSession[] =>
    this.draftingMethods.listDraftingSessions(options);

  deleteDraftingSession = (sessionId: string): boolean =>
    this.draftingMethods.deleteDraftingSession(sessionId);

  getDraftVersion = (sessionId: string, version: number): DraftVersion | undefined =>
    this.draftingMethods.getDraftVersion(sessionId, version);

  compareDraftVersions = (
    sessionId: string,
    fromVersion: number,
    toVersion: number
  ): { additions: string[]; removals: string[]; wordCountDiff: number } | undefined =>
    this.draftingMethods.compareDraftVersions(sessionId, fromVersion, toVersion);

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════════════

  destroy(): void {
    this.sessionManager.destroy();
    this.agenticLoop = null;
    this.adminService = null;
    this.agenticSearch = null;
    this.bqlExecutor = null;
  }
}
