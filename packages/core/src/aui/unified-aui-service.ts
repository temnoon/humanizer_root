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
 * @module @humanizer/core/aui/unified-aui-service
 */

import { randomUUID } from 'crypto';
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
  SessionMetadata,
  UserTier,
  UserUsage,
  CostReportOptions,
  CostReport,
  LimitCheckResult,
  McpResult,
  // Archive & clustering types
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
} from './types.js';
import { BufferManager, getBufferManager, initBufferManager } from './buffer-manager.js';
import { AgenticLoop, ToolExecutor, AgentLlmAdapter, createToolExecutor } from './agentic-loop.js';
import { AdminService, getAdminService, initAdminService } from './admin-service.js';
import type { AgenticSearchService, AgenticSearchOptions, AgenticSearchResponse, RefineOptions, SemanticAnchor } from '../agentic-search/index.js';
import { getSessionManager as getSearchSessionManager } from '../agentic-search/index.js';
import type { ConfigManager, PromptTemplate } from '../config/types.js';
import { AUI_DEFAULTS } from './constants.js';
import type { StoredNode, SearchResult } from '../storage/types.js';
import type { AuiPostgresStore, AuiArtifact, CreateArtifactOptions, PersonaProfile, StyleProfile, CreatePersonaProfileOptions, CreateStyleProfileOptions } from '../storage/aui-postgres-store.js';
import { VoiceAnalyzer, getVoiceAnalyzer, type VoiceAnalysisResult, type SuggestedStyle } from './voice-analyzer.js';
import { getBuilderAgent, mergePersonaWithStyle, type PersonaProfileForRewrite } from '../houses/builder.js';

// ═══════════════════════════════════════════════════════════════════════════
// SESSION MANAGER
// ═══════════════════════════════════════════════════════════════════════════

class AuiSessionManager {
  private sessions: Map<string, UnifiedAuiSession> = new Map();
  private maxSessions: number;
  private sessionTimeoutMs: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options?: { maxSessions?: number; sessionTimeoutMs?: number; cleanupIntervalMs?: number }) {
    this.maxSessions = options?.maxSessions ?? AUI_DEFAULTS.maxSessions;
    this.sessionTimeoutMs = options?.sessionTimeoutMs ?? AUI_DEFAULTS.sessionTimeoutMs;

    // Start cleanup interval
    const cleanupIntervalMs = options?.cleanupIntervalMs ?? AUI_DEFAULTS.cleanupIntervalMs;
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
  }

  create(options?: { userId?: string; name?: string }): UnifiedAuiSession {
    // Evict old sessions if at capacity
    if (this.sessions.size >= this.maxSessions) {
      this.evictOldest();
    }

    const now = Date.now();
    const session: UnifiedAuiSession = {
      id: randomUUID(),
      name: options?.name,
      userId: options?.userId,
      buffers: new Map(),
      taskHistory: [],
      commandHistory: [],
      variables: new Map(),
      createdAt: now,
      updatedAt: now,
      expiresAt: now + this.sessionTimeoutMs,
      metadata: {
        commandCount: 0,
        searchCount: 0,
        taskCount: 0,
      },
    };

    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): UnifiedAuiSession | undefined {
    const session = this.sessions.get(id);
    if (session && this.isExpired(session)) {
      this.sessions.delete(id);
      return undefined;
    }
    return session;
  }

  delete(id: string): boolean {
    return this.sessions.delete(id);
  }

  list(): UnifiedAuiSession[] {
    const sessions: UnifiedAuiSession[] = [];
    for (const session of this.sessions.values()) {
      if (!this.isExpired(session)) {
        sessions.push(session);
      }
    }
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  touch(session: UnifiedAuiSession): void {
    session.updatedAt = Date.now();
    session.expiresAt = session.updatedAt + this.sessionTimeoutMs;
  }

  private isExpired(session: UnifiedAuiSession): boolean {
    return session.expiresAt ? Date.now() > session.expiresAt : false;
  }

  private evictOldest(): void {
    let oldest: UnifiedAuiSession | null = null;
    for (const session of this.sessions.values()) {
      if (!oldest || session.updatedAt < oldest.updatedAt) {
        oldest = session;
      }
    }
    if (oldest) {
      this.sessions.delete(oldest.id);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (session.expiresAt && now > session.expiresAt) {
        this.sessions.delete(id);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.sessions.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PERSONA HARVEST TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Persona harvest session state
 */
export interface PersonaHarvestSession {
  harvestId: string;
  sessionId: string;
  name: string;
  status: 'collecting' | 'analyzing' | 'finalizing' | 'complete';
  samples: Array<{
    text: string;
    source: 'user-provided' | 'archive';
    archiveNodeId?: string;
    addedAt: Date;
  }>;
  analysis?: VoiceAnalysisResult;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Result from starting a harvest session
 */
export interface StartHarvestResult {
  harvestId: string;
  status: 'collecting';
}

/**
 * Result from extracting traits
 */
export interface ExtractTraitsResult {
  voiceTraits: string[];
  toneMarkers: string[];
  voiceFingerprint: import('../storage/aui-postgres-store.js').VoiceFingerprint;
  suggestedStyles: SuggestedStyle[];
  confidence: number;
}

/**
 * Result from finalizing a persona
 */
export interface FinalizePersonaResult {
  personaId: string;
  styleIds: string[];
}

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
  private bqlExecutor: ((pipeline: string) => Promise<{ data?: unknown; error?: string }>) | null = null;
  private options: UnifiedAuiServiceOptions;

  // Persistent storage
  private store: AuiPostgresStore | null = null;
  private booksStore: import('../storage/books-postgres-store.js').BooksPostgresStore | null = null;
  private sessionCache: Map<string, UnifiedAuiSession> = new Map();

  constructor(options?: UnifiedAuiServiceOptions) {
    this.options = options ?? {};
    this.sessionManager = new AuiSessionManager({
      maxSessions: options?.maxSessions,
      sessionTimeoutMs: options?.sessionTimeoutMs,
    });
    this.bufferManager = getBufferManager() ?? initBufferManager();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Set the agentic loop (optional - enables agent tasks).
   */
  setAgenticLoop(loop: AgenticLoop): void {
    this.agenticLoop = loop;
  }

  /**
   * Set the admin service (optional - enables admin features).
   */
  setAdminService(service: AdminService): void {
    this.adminService = service;
  }

  /**
   * Set the agentic search service (optional - enables search).
   */
  setAgenticSearch(service: AgenticSearchService): void {
    this.agenticSearch = service;
  }

  /**
   * Set the BQL executor function.
   */
  setBqlExecutor(executor: (pipeline: string) => Promise<{ data?: unknown; error?: string }>): void {
    this.bqlExecutor = executor;
  }

  /**
   * Set the persistent store (enables persistence across restarts).
   */
  setStore(store: AuiPostgresStore): void {
    this.store = store;
  }

  /**
   * Set the books store (enables book node storage and search).
   */
  setBooksStore(store: import('../storage/books-postgres-store.js').BooksPostgresStore): void {
    this.booksStore = store;
  }

  /**
   * Check if persistent storage is enabled.
   */
  hasStore(): boolean {
    return this.store !== null;
  }

  /**
   * Check if books store is available.
   */
  hasBooksStore(): boolean {
    return this.booksStore !== null && this.booksStore.isAvailable();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a new AUI session.
   */
  async createSession(options?: { userId?: string; name?: string }): Promise<UnifiedAuiSession> {
    const session = this.sessionManager.create(options);

    // Persist to store if available
    if (this.store) {
      try {
        await this.store.createSession({
          id: session.id,
          userId: options?.userId,
          name: options?.name,
        });
        this.sessionCache.set(session.id, session);
      } catch (error) {
        console.warn('Failed to persist session:', error);
      }
    }

    return session;
  }

  /**
   * Get a session by ID.
   * Checks in-memory cache first, then loads from store if available.
   */
  async getSessionAsync(id: string): Promise<UnifiedAuiSession | undefined> {
    // Check in-memory first
    let session = this.sessionManager.get(id);
    if (session) {
      return session;
    }

    // Check cache
    session = this.sessionCache.get(id);
    if (session) {
      return session;
    }

    // Try to load from store
    if (this.store) {
      try {
        const storedSession = await this.store.getSession(id);
        if (storedSession) {
          // Rehydrate into session manager
          this.sessionCache.set(id, storedSession);
          return storedSession;
        }
      } catch (error) {
        console.warn('Failed to load session from store:', error);
      }
    }

    return undefined;
  }

  /**
   * Get a session by ID (synchronous, in-memory only).
   * For async with store loading, use getSessionAsync().
   */
  getSession(id: string): UnifiedAuiSession | undefined {
    // Check in-memory first
    const session = this.sessionManager.get(id);
    if (session) return session;

    // Check cache
    return this.sessionCache.get(id);
  }

  /**
   * Delete a session.
   */
  deleteSession(id: string): boolean {
    return this.sessionManager.delete(id);
  }

  /**
   * List all active sessions.
   */
  listSessions(): UnifiedAuiSession[] {
    return this.sessionManager.list();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NATURAL LANGUAGE PROCESSING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Process a natural language request.
   * Routes to appropriate subsystem based on intent detection.
   */
  async process(
    sessionId: string,
    request: string,
    options?: ProcessOptions
  ): Promise<AuiResponse> {
    const session = this.getSession(sessionId);
    if (!session) {
      return {
        type: 'error',
        message: `Session "${sessionId}" not found`,
      };
    }

    this.sessionManager.touch(session);
    session.commandHistory.push(request);
    session.metadata.commandCount++;

    try {
      // Route based on explicit route or detected intent
      if (options?.route === 'bql' || this.looksLikeBql(request)) {
        return await this.executeBqlAsResponse(session, request, options);
      }

      if (options?.route === 'search' || this.looksLikeSearch(request)) {
        return await this.searchAsResponse(session, request, options);
      }

      if (options?.route === 'agent') {
        return await this.runAgentAsResponse(session, request, options);
      }

      // Default: try BQL first, then agent
      if (this.bqlExecutor) {
        const bqlResult = await this.executeBql(sessionId, request, { dryRun: true });
        if (bqlResult.type === 'success') {
          // Valid BQL, execute it
          return await this.executeBqlAsResponse(session, request, options);
        }
      }

      // Fall back to agent if available
      if (this.agenticLoop) {
        return await this.runAgentAsResponse(session, request, options);
      }

      return {
        type: 'error',
        message: 'No suitable handler found. Please configure BQL executor or agentic loop.',
        suggestions: ['Check system configuration'],
      };
    } catch (error) {
      return {
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Run an agentic task for complex multi-step requests.
   */
  async runAgent(
    sessionId: string,
    request: string,
    options?: AgentLoopOptions
  ): Promise<AgentTask> {
    if (!this.agenticLoop) {
      throw new Error('Agentic loop not configured');
    }

    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }

    this.sessionManager.touch(session);
    session.metadata.taskCount++;

    const task = await this.agenticLoop.run(request, {
      activeBuffer: session.activeBufferName,
      searchSessionId: session.searchSessionId,
      variables: session.variables,
    }, options);

    session.currentTask = task;
    session.taskHistory.push(task);

    return task;
  }

  /**
   * Execute a BQL pipeline directly.
   */
  async executeBql(
    sessionId: string,
    pipeline: string,
    options?: BqlOptions
  ): Promise<BqlResult> {
    if (!this.bqlExecutor) {
      return {
        type: 'error',
        message: 'BQL executor not configured',
      };
    }

    const session = this.getSession(sessionId);
    if (!session) {
      return {
        type: 'error',
        message: `Session "${sessionId}" not found`,
      };
    }

    this.sessionManager.touch(session);

    try {
      const result = await this.bqlExecutor(pipeline);

      if (result.error) {
        return {
          type: 'error',
          message: result.error,
          pipeline,
        };
      }

      return {
        type: 'success',
        message: 'Pipeline executed successfully',
        data: Array.isArray(result.data) ? result.data : result.data ? [result.data] : [],
        pipeline,
      };
    } catch (error) {
      return {
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
        pipeline,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUFFER OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a versioned buffer in a session.
   */
  createBuffer(
    sessionId: string,
    name: string,
    content?: unknown[]
  ): VersionedBuffer {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }

    const buffer = this.bufferManager.createBuffer(name, content);
    session.buffers.set(name, buffer);
    session.activeBufferName = name;
    this.sessionManager.touch(session);

    return buffer;
  }

  /**
   * Get a buffer from a session.
   */
  getBuffer(sessionId: string, name: string): VersionedBuffer | undefined {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }

    return this.bufferManager.getBuffer(name);
  }

  /**
   * List all buffers in a session.
   */
  listBuffers(sessionId: string): VersionedBuffer[] {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }

    return this.bufferManager.listBuffers();
  }

  /**
   * Set working content in a buffer.
   */
  setBufferContent(sessionId: string, bufferName: string, content: unknown[]): void {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }

    this.bufferManager.setWorkingContent(bufferName, content);
    this.sessionManager.touch(session);
  }

  /**
   * Append to a buffer.
   */
  appendToBuffer(sessionId: string, bufferName: string, items: unknown[]): void {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }

    this.bufferManager.appendToBuffer(bufferName, items);
    this.sessionManager.touch(session);
  }

  /**
   * Commit buffer changes.
   */
  async commit(sessionId: string, bufferName: string, message: string): Promise<BufferVersion> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }

    const version = this.bufferManager.commit(bufferName, message);
    this.sessionManager.touch(session);

    // Persist to store if available
    if (this.store) {
      try {
        const buffer = this.bufferManager.getBuffer(bufferName);
        if (buffer) {
          // Get or create buffer in store
          let storedBuffer = await this.store.getBufferByName(sessionId, bufferName);
          if (!storedBuffer) {
            storedBuffer = await this.store.createBuffer(sessionId, bufferName, buffer.workingContent);
          }

          // Create version in store
          await this.store.createVersion(storedBuffer.id, {
            id: version.id,
            content: version.content,
            message: version.message,
            parentId: version.parentId ?? undefined,
            tags: version.tags,
            metadata: version.metadata,
          });

          // Update branch head
          await this.store.updateBranch(storedBuffer.id, buffer.currentBranch, {
            headVersionId: version.id,
          });

          // Update buffer state
          await this.store.updateBuffer(storedBuffer.id, {
            workingContent: buffer.workingContent,
            isDirty: buffer.isDirty,
            currentBranch: buffer.currentBranch,
          });
        }
      } catch (error) {
        console.warn('Failed to persist commit to store:', error);
      }
    }

    return version;
  }

  /**
   * Rollback buffer to previous version.
   */
  rollback(sessionId: string, bufferName: string, steps?: number): BufferVersion {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }

    const version = this.bufferManager.rollback(bufferName, steps);
    this.sessionManager.touch(session);

    return version;
  }

  /**
   * Get buffer history.
   */
  getHistory(sessionId: string, bufferName: string, limit?: number): BufferVersion[] {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }

    return this.bufferManager.getHistory(bufferName, limit);
  }

  /**
   * Create a branch.
   */
  branch(sessionId: string, bufferName: string, branchName: string): BufferBranch {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }

    const branch = this.bufferManager.createBranch(bufferName, branchName);
    this.sessionManager.touch(session);

    return branch;
  }

  /**
   * Switch branch.
   */
  switchBranch(sessionId: string, bufferName: string, branchName: string): void {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }

    this.bufferManager.switchBranch(bufferName, branchName);
    this.sessionManager.touch(session);
  }

  /**
   * Merge branches.
   */
  merge(sessionId: string, bufferName: string, sourceBranch: string, message?: string): MergeResult {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }

    const result = this.bufferManager.merge(bufferName, sourceBranch, message);
    this.sessionManager.touch(session);

    return result;
  }

  /**
   * Diff between versions.
   */
  diff(sessionId: string, bufferName: string, from: string, to: string): BufferDiff {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }

    return this.bufferManager.diff(bufferName, from, to);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEARCH OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Perform a search.
   */
  async search(
    sessionId: string,
    query: string,
    options?: AgenticSearchOptions
  ): Promise<AgenticSearchResponse> {
    if (!this.agenticSearch) {
      throw new Error('Agentic search not configured');
    }

    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }

    this.sessionManager.touch(session);
    session.metadata.searchCount++;

    // Use existing search session or create one
    if (!session.searchSessionId) {
      const searchSessionManager = getSearchSessionManager();
      const searchSession = searchSessionManager.createSession();
      session.searchSessionId = searchSession.id;
    }

    return this.agenticSearch.searchInSession(session.searchSessionId, query, options);
  }

  /**
   * Refine search results.
   */
  async refine(
    sessionId: string,
    options: RefineOptions
  ): Promise<AgenticSearchResponse> {
    if (!this.agenticSearch) {
      throw new Error('Agentic search not configured');
    }

    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }

    if (!session.searchSessionId) {
      throw new Error('No active search session');
    }

    this.sessionManager.touch(session);
    return this.agenticSearch.refineResults(session.searchSessionId, options);
  }

  /**
   * Add a semantic anchor.
   */
  async addAnchor(
    sessionId: string,
    resultId: string,
    type: 'positive' | 'negative'
  ): Promise<SemanticAnchor> {
    if (!this.agenticSearch) {
      throw new Error('Agentic search not configured');
    }

    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }

    if (!session.searchSessionId) {
      throw new Error('No active search session');
    }

    this.sessionManager.touch(session);

    if (type === 'positive') {
      return this.agenticSearch.addPositiveAnchor(session.searchSessionId, resultId);
    } else {
      return this.agenticSearch.addNegativeAnchor(session.searchSessionId, resultId);
    }
  }

  /**
   * Save search results to a buffer.
   */
  async searchToBuffer(
    sessionId: string,
    bufferName: string,
    options?: { limit?: number; create?: boolean }
  ): Promise<VersionedBuffer> {
    if (!this.agenticSearch) {
      throw new Error('Agentic search not configured');
    }

    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }

    if (!session.searchSessionId) {
      throw new Error('No active search session');
    }

    const searchSessionManager = getSearchSessionManager();
    const results = searchSessionManager.getResults(session.searchSessionId);
    const items = options?.limit ? results.slice(0, options.limit) : results;

    if (options?.create || !this.bufferManager.hasBuffer(bufferName)) {
      return this.createBuffer(sessionId, bufferName, items);
    } else {
      this.bufferManager.setWorkingContent(bufferName, items);
      const buffer = this.bufferManager.getBuffer(bufferName)!;
      session.activeBufferName = bufferName;
      this.sessionManager.touch(session);
      return buffer;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get config value.
   */
  async getConfig(category: string, key: string): Promise<unknown> {
    if (!this.adminService) {
      throw new Error('Admin service not configured');
    }

    return this.adminService.getConfig(category as any, key);
  }

  /**
   * Set config value.
   */
  async setConfig(category: string, key: string, value: unknown): Promise<void> {
    if (!this.adminService) {
      throw new Error('Admin service not configured');
    }

    await this.adminService.setConfig(category as any, key, value);
  }

  /**
   * List prompts.
   */
  async listPrompts(): Promise<PromptTemplate[]> {
    if (!this.adminService) {
      throw new Error('Admin service not configured');
    }

    return this.adminService.listPrompts();
  }

  /**
   * Get prompt.
   */
  async getPrompt(id: string): Promise<PromptTemplate | undefined> {
    if (!this.adminService) {
      throw new Error('Admin service not configured');
    }

    return this.adminService.getPrompt(id);
  }

  /**
   * Set prompt.
   */
  async setPrompt(template: Omit<PromptTemplate, 'version'>): Promise<void> {
    if (!this.adminService) {
      throw new Error('Admin service not configured');
    }

    await this.adminService.setPrompt(template);
  }

  /**
   * Get cost report.
   */
  async getCostReport(options: CostReportOptions): Promise<CostReport> {
    if (!this.adminService) {
      throw new Error('Admin service not configured');
    }

    return this.adminService.getCostReport(options);
  }

  /**
   * Get user usage.
   */
  async getUsage(userId: string): Promise<UserUsage> {
    if (!this.adminService) {
      throw new Error('Admin service not configured');
    }

    return this.adminService.getUsage(userId);
  }

  /**
   * Check user limits.
   */
  async checkLimits(userId: string): Promise<LimitCheckResult> {
    if (!this.adminService) {
      throw new Error('Admin service not configured');
    }

    return this.adminService.checkLimits(userId);
  }

  /**
   * List tiers.
   */
  async listTiers(): Promise<UserTier[]> {
    if (!this.adminService) {
      throw new Error('Admin service not configured');
    }

    return this.adminService.listTiers();
  }

  /**
   * Set user tier.
   */
  async setUserTier(userId: string, tierId: string): Promise<void> {
    if (!this.adminService) {
      throw new Error('Admin service not configured');
    }

    await this.adminService.setUserTier(userId, tierId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ARCHIVE & EMBEDDING OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get archive statistics including embedding coverage.
   */
  async getArchiveStats(): Promise<ArchiveStats> {
    // Import content store
    const { getContentStore } = await import('../storage/postgres-content-store.js');
    const store = getContentStore();

    if (!store) {
      throw new Error('Content store not initialized');
    }

    // Use the built-in stats method
    const storeStats = await store.getStats();
    const nodesNeedingEmbeddings = await store.getNodesNeedingEmbeddings(1);

    return {
      totalNodes: storeStats.totalNodes,
      nodesWithEmbeddings: storeStats.nodesWithEmbeddings,
      nodesNeedingEmbeddings: storeStats.totalNodes - storeStats.nodesWithEmbeddings,
      embeddingCoverage: storeStats.totalNodes > 0
        ? (storeStats.nodesWithEmbeddings / storeStats.totalNodes) * 100
        : 0,
      bySourceType: storeStats.nodesBySourceType,
      byAuthorRole: {}, // Not currently tracked in store stats
      dateRange: { earliest: null, latest: null }, // Would need additional query
      avgWordCount: 0, // Would need additional query
      totalWordCount: 0, // Would need additional query
    };
  }

  /**
   * Embed all archive content that needs embeddings.
   */
  async embedAll(options?: EmbedAllOptions): Promise<EmbedResult> {
    const startTime = Date.now();
    const errors: Array<{ nodeId: string; error: string }> = [];

    try {
      const { getContentStore } = await import('../storage/postgres-content-store.js');
      const { getEmbeddingService } = await import('../embeddings/embedding-service.js');

      const store = getContentStore();
      const embeddingService = getEmbeddingService();

      if (!store) throw new Error('Content store not initialized');
      if (!embeddingService) throw new Error('Embedding service not initialized');

      // Check if Ollama is available
      const available = await embeddingService.isAvailable();
      if (!available) {
        return {
          success: false,
          embedded: 0,
          skipped: 0,
          failed: 0,
          durationMs: Date.now() - startTime,
          error: 'Ollama embedding service not available',
          errors: [],
        };
      }

      // Get nodes needing embeddings
      const limit = options?.limit || 100000;
      const nodesNeedingEmbeddings = await store.getNodesNeedingEmbeddings(limit);

      // Apply filters
      let nodesToEmbed: StoredNode[] = nodesNeedingEmbeddings;

      // Filter by word count
      const minWordCount = options?.minWordCount ?? 7;
      if (minWordCount > 0) {
        nodesToEmbed = nodesToEmbed.filter((node: StoredNode) => {
          const wordCount = node.text?.split(/\s+/).filter(Boolean).length || 0;
          return wordCount >= minWordCount;
        });
      }

      // Filter by source type
      if (options?.sourceTypes?.length) {
        nodesToEmbed = nodesToEmbed.filter((node: StoredNode) =>
          options.sourceTypes!.includes(node.sourceType || '')
        );
      }

      // Filter by author role
      if (options?.authorRoles?.length) {
        nodesToEmbed = nodesToEmbed.filter((node: StoredNode) =>
          options.authorRoles!.includes((node as StoredNode & { authorRole?: string }).authorRole as any)
        );
      }

      // Apply custom content filter
      if (options?.contentFilter) {
        nodesToEmbed = nodesToEmbed.filter((node: StoredNode) =>
          options.contentFilter!(node.text || '')
        );
      }

      const skipped = nodesNeedingEmbeddings.length - nodesToEmbed.length;
      const batchSize = options?.batchSize || 50;
      const totalBatches = Math.ceil(nodesToEmbed.length / batchSize);

      let embedded = 0;
      let failed = 0;

      for (let i = 0; i < nodesToEmbed.length; i += batchSize) {
        const batch = nodesToEmbed.slice(i, i + batchSize);
        const currentBatch = Math.floor(i / batchSize) + 1;

        // Report progress
        if (options?.onProgress) {
          options.onProgress({
            phase: 'embedding',
            processed: embedded,
            total: nodesToEmbed.length,
            currentBatch,
            totalBatches,
            skipped,
            failed,
            elapsedMs: Date.now() - startTime,
            estimatedRemainingMs: embedded > 0
              ? ((Date.now() - startTime) / embedded) * (nodesToEmbed.length - embedded)
              : 0,
            errors: errors.map(e => e.error),
          });
        }

        try {
          // Generate embeddings
          const results = await embeddingService.embedNodes(batch as any);

          // Store embeddings
          for (const result of results) {
            try {
              await store.storeEmbedding(
                result.nodeId,
                result.embedding,
                embeddingService.getEmbedModel()
              );
              embedded++;
            } catch (storeError) {
              failed++;
              errors.push({
                nodeId: result.nodeId,
                error: storeError instanceof Error ? storeError.message : String(storeError),
              });
            }
          }
        } catch (batchError) {
          failed += batch.length;
          for (const node of batch) {
            errors.push({
              nodeId: node.id,
              error: batchError instanceof Error ? batchError.message : String(batchError),
            });
          }
        }
      }

      // Report completion
      if (options?.onProgress) {
        options.onProgress({
          phase: 'complete',
          processed: embedded,
          total: nodesToEmbed.length,
          currentBatch: totalBatches,
          totalBatches,
          skipped,
          failed,
          elapsedMs: Date.now() - startTime,
          estimatedRemainingMs: 0,
          errors: errors.map(e => e.error),
        });
      }

      return {
        success: failed === 0,
        embedded,
        skipped,
        failed,
        durationMs: Date.now() - startTime,
        errors,
      };
    } catch (error) {
      return {
        success: false,
        embedded: 0,
        skipped: 0,
        failed: 0,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        errors,
      };
    }
  }

  /**
   * Embed a batch of nodes by ID.
   */
  async embedBatch(nodeIds: string[]): Promise<EmbedResult> {
    const startTime = Date.now();
    const errors: Array<{ nodeId: string; error: string }> = [];

    try {
      const { getContentStore } = await import('../storage/postgres-content-store.js');
      const { getEmbeddingService } = await import('../embeddings/embedding-service.js');

      const store = getContentStore();
      const embeddingService = getEmbeddingService();

      if (!store) throw new Error('Content store not initialized');
      if (!embeddingService) throw new Error('Embedding service not initialized');

      const available = await embeddingService.isAvailable();
      if (!available) {
        return {
          success: false,
          embedded: 0,
          skipped: 0,
          failed: 0,
          durationMs: Date.now() - startTime,
          error: 'Ollama embedding service not available',
          errors: [],
        };
      }

      // Get nodes by ID
      const nodes = await Promise.all(
        nodeIds.map(id => store.getNode(id))
      );
      const validNodes = nodes.filter(Boolean) as any[];

      const results = await embeddingService.embedNodes(validNodes);

      let embedded = 0;
      let failed = 0;

      for (const result of results) {
        try {
          await store.storeEmbedding(
            result.nodeId,
            result.embedding,
            embeddingService.getEmbedModel()
          );
          embedded++;
        } catch (storeError) {
          failed++;
          errors.push({
            nodeId: result.nodeId,
            error: storeError instanceof Error ? storeError.message : String(storeError),
          });
        }
      }

      return {
        success: failed === 0,
        embedded,
        skipped: nodeIds.length - validNodes.length,
        failed,
        durationMs: Date.now() - startTime,
        errors,
      };
    } catch (error) {
      return {
        success: false,
        embedded: 0,
        skipped: 0,
        failed: 0,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        errors,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLUSTERING OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Discover semantic clusters in the archive.
   */
  async discoverClusters(options?: ClusterDiscoveryOptions): Promise<ClusterDiscoveryResult> {
    const startTime = Date.now();

    try {
      const { getContentStore } = await import('../storage/postgres-content-store.js');
      const store = getContentStore();

      if (!store) throw new Error('Content store not initialized');

      // Report progress
      if (options?.onProgress) {
        options.onProgress({ phase: 'loading', step: 1, totalSteps: 4, message: 'Loading embeddings...' });
      }

      // Get random sample of nodes with embeddings (not using zero vector search)
      const sampleSize = options?.sampleSize || 500;
      const randomNodeIds = await store.getRandomEmbeddedNodeIds(sampleSize);

      if (randomNodeIds.length === 0) {
        return {
          clusters: [],
          totalPassages: 0,
          assignedPassages: 0,
          noisePassages: 0,
          durationMs: Date.now() - startTime,
        };
      }

      // Fetch nodes and apply filters
      const nodes: StoredNode[] = [];
      for (const id of randomNodeIds) {
        const node = await store.getNode(id);
        if (node) nodes.push(node);
      }

      // Apply filters
      let filteredNodes = nodes;

      // Filter by word count
      const minWordCount = options?.minWordCount ?? 7;
      if (minWordCount > 0) {
        filteredNodes = filteredNodes.filter(node => {
          const wordCount = node.text?.split(/\s+/).filter(Boolean).length || 0;
          return wordCount >= minWordCount;
        });
      }

      // Filter by exclude patterns
      if (options?.excludePatterns?.length) {
        const patterns = options.excludePatterns.map(p => new RegExp(p, 'i'));
        filteredNodes = filteredNodes.filter(node => !patterns.some(p => p.test(node.text || '')));
      }

      // Filter by source type
      if (options?.sourceTypes?.length) {
        filteredNodes = filteredNodes.filter(node =>
          options.sourceTypes!.includes(node.sourceType || '')
        );
      }

      // Filter by author role (only user messages by default)
      const authorRoles: string[] = options?.authorRoles || ['user'];
      filteredNodes = filteredNodes.filter(node =>
        authorRoles.includes((node as StoredNode & { authorRole?: string }).authorRole || 'user')
      );

      if (options?.onProgress) {
        options.onProgress({ phase: 'clustering', step: 2, totalSteps: 4, message: `Clustering ${filteredNodes.length} passages...` });
      }

      // Simple K-means-like clustering using cosine similarity
      const maxClusters = options?.maxClusters || 10;
      const minClusterSize = options?.minClusterSize || 5;
      const minSimilarity = options?.minSimilarity || 0.7;

      // Find cluster seeds (passages that are central to many others)
      const clusters: ContentCluster[] = [];
      const assigned = new Set<string>();

      // Sample seed passages for clustering
      const seedCandidates = filteredNodes.slice(0, Math.min(filteredNodes.length, 100));

      for (const seedNode of seedCandidates) {
        if (assigned.has(seedNode.id)) continue;
        if (clusters.length >= maxClusters) break;

        // Find similar passages to this seed - fetch embedding from store
        const seedEmbedding = await store.getEmbedding(seedNode.id);
        if (!seedEmbedding) continue;

        const similarResults = await store.searchByEmbedding(seedEmbedding, { limit: 100, threshold: minSimilarity });
        const clusterMemberResults = similarResults.filter(r => !assigned.has(r.node.id) && r.node.id !== seedNode.id);

        if (clusterMemberResults.length + 1 >= minClusterSize) {
          // Create cluster - seed node as first passage, then similar results
          const clusterPassages = [
            {
              id: seedNode.id,
              text: seedNode.text || '',
              sourceType: seedNode.sourceType || 'unknown',
              authorRole: (seedNode as StoredNode & { authorRole?: string }).authorRole,
              wordCount: seedNode.text?.split(/\s+/).filter(Boolean).length || 0,
              distanceFromCentroid: 0,
              sourceCreatedAt: seedNode.sourceCreatedAt ? new Date(seedNode.sourceCreatedAt) : undefined,
              title: (seedNode as StoredNode & { title?: string }).title,
            },
            ...clusterMemberResults.map(r => ({
              id: r.node.id,
              text: r.node.text || '',
              sourceType: r.node.sourceType || 'unknown',
              authorRole: (r.node as StoredNode & { authorRole?: string }).authorRole,
              wordCount: r.node.text?.split(/\s+/).filter(Boolean).length || 0,
              distanceFromCentroid: r.distance ?? 1 - r.score,
              sourceCreatedAt: r.node.sourceCreatedAt ? new Date(r.node.sourceCreatedAt) : undefined,
              title: (r.node as StoredNode & { title?: string }).title,
            })),
          ];

          // Extract keywords from cluster
          const allText = clusterPassages.map(p => p.text).join(' ');
          const words = allText.toLowerCase().split(/\s+/).filter(w => w.length > 4);
          const wordFreq = new Map<string, number>();
          for (const word of words) {
            wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
          }
          const keywords = [...wordFreq.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([word]) => word);

          // Source distribution
          const sourceDistribution: Record<string, number> = {};
          for (const p of clusterPassages) {
            sourceDistribution[p.sourceType] = (sourceDistribution[p.sourceType] || 0) + 1;
          }

          // Date range
          const dates = clusterPassages
            .filter(p => p.sourceCreatedAt)
            .map(p => p.sourceCreatedAt!);
          const earliest = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
          const latest = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;

          const cluster: ContentCluster = {
            id: `cluster-${clusters.length + 1}`,
            label: keywords.slice(0, 3).join(', '),
            description: `Cluster around: ${seedNode.text?.substring(0, 100)}...`,
            passages: clusterPassages.slice(0, 20), // Top 20 passages
            totalPassages: clusterPassages.length,
            coherence: similarResults.reduce((sum, r) => sum + r.score, 0) / similarResults.length,
            keywords,
            sourceDistribution,
            dateRange: { earliest, latest },
            avgWordCount: clusterPassages.reduce((sum, p) => sum + p.wordCount, 0) / clusterPassages.length,
          };

          clusters.push(cluster);

          // Mark as assigned
          for (const p of clusterPassages) {
            assigned.add(p.id);
          }
        }
      }

      if (options?.onProgress) {
        options.onProgress({ phase: 'complete', step: 4, totalSteps: 4, message: `Found ${clusters.length} clusters` });
      }

      return {
        clusters,
        totalPassages: filteredNodes.length,
        assignedPassages: assigned.size,
        noisePassages: filteredNodes.length - assigned.size,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      throw new Error(`Cluster discovery failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List discovered clusters.
   */
  async listClusters(options?: { userId?: string; limit?: number }): Promise<ContentCluster[]> {
    // If store available, load from store first
    if (this.store) {
      try {
        const clusters = await this.store.listClusters(options);
        if (clusters.length > 0) {
          return clusters;
        }
      } catch (error) {
        console.warn('Failed to list clusters from store:', error);
      }
    }

    // Fall back to discovery
    const result = await this.discoverClusters({ maxClusters: options?.limit ?? 20 });
    return result.clusters;
  }

  /**
   * Get a specific cluster by ID.
   */
  async getCluster(clusterId: string): Promise<ContentCluster | undefined> {
    // If store available, try to get from store first
    if (this.store) {
      try {
        const cluster = await this.store.getCluster(clusterId);
        if (cluster) {
          return cluster;
        }
      } catch (error) {
        console.warn('Failed to get cluster from store:', error);
      }
    }

    // Fall back to search
    const clusters = await this.listClusters();
    return clusters.find(c => c.id === clusterId);
  }

  /**
   * Save a discovered cluster to the store for caching.
   */
  async saveCluster(cluster: ContentCluster, userId?: string): Promise<ContentCluster> {
    if (!this.store) {
      return cluster;
    }

    try {
      return await this.store.saveCluster(cluster, userId);
    } catch (error) {
      console.warn('Failed to save cluster to store:', error);
      return cluster;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOK CREATION OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  private books: Map<string, Book> = new Map();

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSONA HARVEST STATE
  // ═══════════════════════════════════════════════════════════════════════════

  private harvestSessions: Map<string, PersonaHarvestSession> = new Map();

  /**
   * Create a book from a cluster.
   *
   * If a personaId is provided, or useDefaultPersona is enabled (default),
   * the chapter content will be rewritten to match the persona's voice.
   */
  async createBookFromCluster(
    clusterId: string,
    options?: BookFromClusterOptions
  ): Promise<Book> {
    const cluster = await this.getCluster(clusterId);
    if (!cluster) {
      throw new Error(`Cluster "${clusterId}" not found`);
    }

    // ─────────────────────────────────────────────────────────────────
    // PHASE 0: RESOLVE PERSONA
    // ─────────────────────────────────────────────────────────────────
    let persona: PersonaProfile | undefined;
    let style: StyleProfile | undefined;
    let personaForRewrite: PersonaProfileForRewrite | undefined;

    // Explicit persona takes precedence
    if (options?.personaId && this.store) {
      persona = await this.store.getPersonaProfile(options.personaId);
      if (!persona) {
        console.warn(`Persona "${options.personaId}" not found, proceeding without persona`);
      }
    }
    // Fall back to user's default persona if enabled (default: true)
    else if (options?.useDefaultPersona !== false && options?.userId && this.store) {
      persona = await this.store.getDefaultPersonaProfile(options.userId);
    }

    // If persona found, optionally fetch style
    if (persona && this.store) {
      if (options?.styleId) {
        style = await this.store.getStyleProfile(options.styleId);
      } else {
        style = await this.store.getDefaultStyleProfile(persona.id);
      }
      // Merge persona + style into rewrite-ready format
      personaForRewrite = mergePersonaWithStyle(persona, style);
    }

    // Calculate total steps based on whether persona rewriting is enabled
    const hasPersona = !!personaForRewrite;
    const hasIndexing = this.booksStore?.isAvailable() ?? false;
    const totalSteps = 4 + (hasPersona ? 1 : 0) + (hasIndexing ? 1 : 0);

    if (options?.onProgress) {
      options.onProgress({ phase: 'gathering', step: 1, totalSteps, message: 'Gathering passages...' });
    }

    const maxPassages = options?.maxPassages || 50;
    const passages = cluster.passages.slice(0, maxPassages);

    // Convert to harvested passages
    const harvestedPassages = passages.map(p => ({
      id: p.id,
      text: p.text,
      relevance: 1 - p.distanceFromCentroid,
      sourceType: p.sourceType,
      authorRole: p.authorRole,
      title: p.title,
      sourceCreatedAt: p.sourceCreatedAt,
      wordCount: p.wordCount,
    }));

    if (options?.onProgress) {
      options.onProgress({ phase: 'generating_arc', step: 2, totalSteps, message: 'Generating narrative arc...' });
    }

    // Generate narrative arc
    const arc = await this.generateArc({
      passages: harvestedPassages,
      arcType: options?.arcType || 'thematic',
      introWordCount: 300,
    });

    if (options?.onProgress) {
      options.onProgress({ phase: 'assembling', step: 3, totalSteps, message: 'Assembling book...' });
    }

    // Create book chapters
    let chapters = arc.chapters.map((ch, idx) => {
      const chapterPassages = harvestedPassages.filter(p => ch.passageIds.includes(p.id));
      const content = chapterPassages.map(p => p.text).join('\n\n---\n\n');

      return {
        id: `chapter-${idx + 1}`,
        title: ch.title,
        content,
        passageIds: ch.passageIds,
        position: idx,
        wordCount: content.split(/\s+/).filter(Boolean).length,
      };
    });

    // ─────────────────────────────────────────────────────────────────
    // PHASE: PERSONA REWRITING (if persona is configured)
    // ─────────────────────────────────────────────────────────────────
    let currentStep = 4;
    if (personaForRewrite) {
      if (options?.onProgress) {
        options.onProgress({
          phase: 'persona_rewriting',
          step: currentStep,
          totalSteps,
          message: `Applying ${persona!.name} voice to ${chapters.length} chapters...`,
        });
      }

      const builder = getBuilderAgent();

      // Rewrite each chapter's content with the persona
      chapters = await Promise.all(
        chapters.map(async (chapter) => {
          const result = await builder.rewriteForPersonaWithRetry({
            text: chapter.content,
            persona: personaForRewrite,
            sourceType: 'book-chapter',
          }, { maxPasses: 3 });

          return {
            ...chapter,
            content: result.rewritten,
            wordCount: result.rewritten.split(/\s+/).filter(Boolean).length,
          };
        })
      );

      currentStep++;
    }

    const book: Book = {
      id: `book-${Date.now()}`,
      title: options?.title || arc.title,
      description: cluster.description,
      arc,
      chapters,
      sourceClusterId: clusterId,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'draft',
      metadata: {
        passageCount: passages.length,
        totalWordCount: chapters.reduce((sum, ch) => sum + ch.wordCount, 0),
        arcType: options?.arcType || 'thematic',
        // Track persona used (if any)
        personaId: persona?.id,
        personaName: persona?.name,
        styleId: style?.id,
        styleName: style?.name,
      },
    };

    // Persist to store if available
    if (this.store) {
      try {
        const storedBook = await this.store.createBook(book);
        book.id = storedBook.id;
      } catch (error) {
        console.warn('Failed to persist book to store:', error);
      }
    }

    this.books.set(book.id, book);

    // Index book content in books store for unified search
    if (this.booksStore && this.booksStore.isAvailable()) {
      if (options?.onProgress) {
        options.onProgress({
          phase: 'indexing',
          step: currentStep,
          totalSteps,
          message: 'Indexing book content for search...',
        });
      }
      currentStep++;

      try {
        await this.indexBookContent(book, options?.embedFn);
      } catch (error) {
        console.warn('Failed to index book content:', error);
      }
    }

    if (options?.onProgress) {
      options.onProgress({ phase: 'complete', step: totalSteps, totalSteps, message: 'Book created' });
    }

    return book;
  }

  /**
   * Create a book with explicit persona consistency.
   *
   * This is a convenience method that:
   * 1. Resolves the persona (explicit or user's default)
   * 2. Gathers passages (from cluster or search query)
   * 3. Creates a cluster if needed
   * 4. Creates the book with persona-consistent chapters
   *
   * @throws Error if no persona is available (none specified and no default set)
   */
  async createBookWithPersona(options: {
    /** User ID for default persona lookup */
    userId: string;
    /** Cluster to source content from (mutually exclusive with query) */
    clusterId?: string;
    /** Search query to source content from (mutually exclusive with clusterId) */
    query?: string;
    /** Explicit persona ID (uses user's default if not provided) */
    personaId?: string;
    /** Specific style within the persona */
    styleId?: string;
    /** Book title */
    title?: string;
    /** Narrative arc type */
    arcType?: 'chronological' | 'thematic' | 'dramatic' | 'exploratory';
    /** Maximum passages to include */
    maxPassages?: number;
    /** Progress callback */
    onProgress?: (progress: { phase: string; step: number; totalSteps: number; message: string }) => void;
    /** Embedding function for indexing */
    embedFn?: (text: string) => Promise<number[]>;
  }): Promise<Book> {
    // Validate input
    if (!options.clusterId && !options.query) {
      throw new Error('Either clusterId or query is required');
    }

    // Resolve persona
    let personaId = options.personaId;
    if (!personaId && this.store) {
      const defaultPersona = await this.store.getDefaultPersonaProfile(options.userId);
      if (defaultPersona) {
        personaId = defaultPersona.id;
      }
    }

    if (!personaId) {
      throw new Error('No persona specified and no default persona set. Create a persona first.');
    }

    // If query provided, harvest passages and create a cluster
    let clusterId = options.clusterId;
    if (!clusterId && options.query) {
      // Harvest passages from the query
      const harvestResult = await this.harvest({
        query: options.query,
        limit: options.maxPassages ?? 50,
      });

      if (harvestResult.passages.length === 0) {
        throw new Error(`No passages found for query: "${options.query}"`);
      }

      // Create a temporary cluster from harvested passages
      const clusterPassages = harvestResult.passages.map(p => ({
        id: p.id,
        text: p.text,
        sourceType: p.sourceType ?? 'unknown',
        authorRole: 'author' as const,
        distanceFromCentroid: 1 - (p.relevance ?? 0.5),
        wordCount: p.wordCount ?? p.text.split(/\s+/).filter(Boolean).length,
      }));

      const totalWords = clusterPassages.reduce((sum, p) => sum + p.wordCount, 0);
      const avgWordCount = clusterPassages.length > 0 ? Math.round(totalWords / clusterPassages.length) : 0;

      const tempCluster: ContentCluster = {
        id: `cluster-${Date.now()}`,
        label: options.title ?? `From: ${options.query}`,
        description: `Harvested from query: ${options.query}`,
        passages: clusterPassages,
        totalPassages: harvestResult.passages.length,
        coherence: 0.7,
        keywords: options.query!.split(/\s+/).filter(w => w.length > 3),
        sourceDistribution: {},
        dateRange: {
          earliest: null,
          latest: null,
        },
        avgWordCount,
      };

      // Save cluster (creates or updates in store)
      const savedCluster = await this.saveCluster(tempCluster, options.userId);
      clusterId = savedCluster.id;
    }

    // Create the book with persona
    return this.createBookFromCluster(clusterId!, {
      title: options.title,
      personaId,
      styleId: options.styleId,
      userId: options.userId,
      useDefaultPersona: false, // We already resolved it
      arcType: options.arcType,
      maxPassages: options.maxPassages,
      onProgress: options.onProgress as BookFromClusterOptions['onProgress'],
      embedFn: options.embedFn,
    });
  }

  /**
   * Index book content into the books store for unified search.
   * Creates chunked nodes with embeddings for each chapter.
   */
  private async indexBookContent(
    book: Book,
    embedFn?: (text: string) => Promise<number[]>
  ): Promise<void> {
    if (!this.booksStore || !this.booksStore.isAvailable()) {
      return;
    }

    let position = 0;

    for (const chapter of book.chapters) {
      // Create L0 node (chapter content as single chunk)
      const node = await this.booksStore.createNode({
        bookId: book.id,
        chapterId: chapter.id,
        text: chapter.content,
        format: 'markdown',
        position: position++,
        hierarchyLevel: 0,
        sourceType: 'synthesized',
        metadata: {
          chapterTitle: chapter.title,
          passageIds: chapter.passageIds,
          wordCount: chapter.wordCount,
        },
      });

      // Generate and store embedding if embedFn provided
      if (embedFn) {
        try {
          const embedding = await embedFn(chapter.content);
          await this.booksStore.updateNodeEmbedding(
            node.id,
            embedding,
            'nomic-embed-text', // default model
            node.contentHash
          );
        } catch (error) {
          console.warn(`Failed to embed chapter ${chapter.title}:`, error);
        }
      }
    }

    // Create apex node (book summary) if we have the arc introduction
    if (book.arc?.introduction && embedFn) {
      try {
        const apexNode = await this.booksStore.createNode({
          bookId: book.id,
          text: book.arc.introduction,
          format: 'markdown',
          position: 0,
          hierarchyLevel: 2, // Apex level
          sourceType: 'synthesized',
          metadata: {
            bookTitle: book.title,
            arcType: book.arc.arcType,
            themes: book.arc.themes,
          },
        });

        const apexEmbedding = await embedFn(book.arc.introduction);
        await this.booksStore.updateNodeEmbedding(
          apexNode.id,
          apexEmbedding,
          'nomic-embed-text',
          apexNode.contentHash
        );
      } catch (error) {
        console.warn('Failed to create/embed apex node:', error);
      }
    }
  }

  /**
   * Harvest passages for a theme.
   */
  async harvest(options: HarvestOptions): Promise<HarvestResult> {
    const startTime = Date.now();

    if (!this.agenticSearch) {
      throw new Error('Agentic search not configured');
    }

    // Use semantic search to find relevant passages
    const searchResults = await this.agenticSearch.search(options.query, {
      limit: options.limit || 50,
      target: 'archive',
      threshold: options.minRelevance || 0.5,
    });

    let passages = searchResults.results.map(r => ({
      id: r.id,
      text: r.text,
      relevance: r.score,
      sourceType: r.source || 'unknown',
      authorRole: (r as any).authorRole,
      title: (r as any).title,
      sourceCreatedAt: (r as any).sourceCreatedAt ? new Date((r as any).sourceCreatedAt) : undefined,
      wordCount: r.text.split(/\s+/).filter(Boolean).length,
    }));

    // Apply excludes
    if (options.excludeIds?.length) {
      passages = passages.filter(p => !options.excludeIds!.includes(p.id));
    }

    // Apply date range
    if (options.dateRange) {
      passages = passages.filter(p => {
        if (!p.sourceCreatedAt) return false;
        if (options.dateRange!.start && p.sourceCreatedAt < options.dateRange!.start) return false;
        if (options.dateRange!.end && p.sourceCreatedAt > options.dateRange!.end) return false;
        return true;
      });
    }

    // Apply source diversity
    if (options.maxFromSingleSource) {
      const bySource = new Map<string, typeof passages>();
      for (const p of passages) {
        const sourcePassages = bySource.get(p.sourceType) || [];
        bySource.set(p.sourceType, [...sourcePassages, p]);
      }

      passages = [];
      for (const sourcePassages of bySource.values()) {
        passages.push(...sourcePassages.slice(0, options.maxFromSingleSource));
      }
      passages.sort((a, b) => b.relevance - a.relevance);
    }

    return {
      passages,
      query: options.query,
      candidatesFound: searchResults.results.length,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Generate a narrative arc from passages.
   */
  async generateArc(options: GenerateArcOptions): Promise<NarrativeArc> {
    const { passages, arcType = 'thematic' } = options;

    // Organize passages based on arc type
    let organizedPassages = [...passages];

    switch (arcType) {
      case 'chronological':
        organizedPassages.sort((a, b) => {
          const dateA = a.sourceCreatedAt?.getTime() || 0;
          const dateB = b.sourceCreatedAt?.getTime() || 0;
          return dateA - dateB;
        });
        break;
      case 'thematic':
        // Group by source type or similar themes
        organizedPassages.sort((a, b) => {
          if (a.sourceType !== b.sourceType) {
            return a.sourceType.localeCompare(b.sourceType);
          }
          return b.relevance - a.relevance;
        });
        break;
      case 'dramatic':
        // Build tension: lower relevance first, highest at end
        organizedPassages.sort((a, b) => a.relevance - b.relevance);
        break;
      case 'exploratory':
        // Random/discovery order
        organizedPassages = organizedPassages.sort(() => Math.random() - 0.5);
        break;
    }

    // Create chapters (group into 3-5 chapters)
    const chapterCount = Math.min(5, Math.max(3, Math.ceil(passages.length / 10)));
    const passagesPerChapter = Math.ceil(passages.length / chapterCount);

    const chapters: NarrativeArc['chapters'] = [];
    for (let i = 0; i < chapterCount; i++) {
      const chapterPassages = organizedPassages.slice(
        i * passagesPerChapter,
        (i + 1) * passagesPerChapter
      );

      if (chapterPassages.length === 0) continue;

      // Generate chapter title from first passage
      const firstWords = chapterPassages[0].text.split(/\s+/).slice(0, 5).join(' ');

      chapters.push({
        title: `Chapter ${i + 1}: ${firstWords}...`,
        summary: chapterPassages.slice(0, 2).map(p => p.text.substring(0, 100)).join(' | '),
        passageIds: chapterPassages.map(p => p.id),
        theme: `Theme ${i + 1}`,
        position: i,
      });
    }

    // Extract themes from all passages
    const allText = passages.map(p => p.text).join(' ');
    const words = allText.toLowerCase().split(/\s+/).filter(w => w.length > 5);
    const wordFreq = new Map<string, number>();
    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
    const themes = [...wordFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);

    // Generate transitions
    const transitions = chapters.slice(0, -1).map((_, i) =>
      `Transition from ${chapters[i].title} to ${chapters[i + 1].title}`
    );

    // Generate title
    const title = themes.length > 0
      ? `Reflections on ${themes.slice(0, 2).join(' and ')}`
      : 'Collected Thoughts';

    // Generate introduction
    const introduction = `This collection brings together ${passages.length} passages exploring ${themes.slice(0, 3).join(', ')}. ` +
      `Organized ${arcType === 'chronological' ? 'chronologically' : 'thematically'}, ` +
      `these reflections span ${chapters.length} chapters, each offering a unique perspective on the journey.`;

    return {
      title,
      arcType,
      introduction,
      chapters,
      themes,
      transitions,
    };
  }

  /**
   * List all books.
   */
  async listBooks(options?: { userId?: string; limit?: number }): Promise<Book[]> {
    // If store available, load from store
    if (this.store) {
      try {
        const books = await this.store.listBooks(options);
        // Cache in memory
        for (const book of books) {
          this.books.set(book.id, book);
        }
        return books;
      } catch (error) {
        console.warn('Failed to list books from store:', error);
      }
    }

    // Fall back to in-memory
    return Array.from(this.books.values());
  }

  /**
   * Get a book by ID.
   */
  async getBook(bookId: string): Promise<Book | undefined> {
    // Check in-memory first
    let book = this.books.get(bookId);
    if (book) return book;

    // Try to load from store
    if (this.store) {
      try {
        book = await this.store.getBook(bookId);
        if (book) {
          this.books.set(bookId, book);
          return book;
        }
      } catch (error) {
        console.warn('Failed to load book from store:', error);
      }
    }

    return undefined;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ARTIFACT EXPORT OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Export a book as an artifact (markdown, etc.)
   */
  async exportBook(
    bookId: string,
    format: 'markdown' | 'html' | 'json' = 'markdown'
  ): Promise<AuiArtifact | undefined> {
    if (!this.store) {
      throw new Error('Persistent store not configured - cannot create artifacts');
    }

    const book = await this.getBook(bookId);
    if (!book) {
      throw new Error(`Book "${bookId}" not found`);
    }

    let content: string;
    let mimeType: string;

    switch (format) {
      case 'markdown':
        content = this.bookToMarkdown(book);
        mimeType = 'text/markdown';
        break;
      case 'html':
        content = this.bookToHtml(book);
        mimeType = 'text/html';
        break;
      case 'json':
        content = JSON.stringify(book, null, 2);
        mimeType = 'application/json';
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    const artifact = await this.store.createArtifact({
      name: `${book.title.replace(/[^a-zA-Z0-9]/g, '_')}.${format === 'markdown' ? 'md' : format}`,
      artifactType: format,
      content,
      mimeType,
      sourceType: 'book',
      sourceId: bookId,
      metadata: {
        bookTitle: book.title,
        chapterCount: book.chapters.length,
        wordCount: book.chapters.reduce((sum, ch) => sum + ch.wordCount, 0),
      },
    });

    return artifact;
  }

  /**
   * Download an artifact by ID.
   */
  async downloadArtifact(artifactId: string): Promise<AuiArtifact | undefined> {
    if (!this.store) {
      throw new Error('Persistent store not configured');
    }

    return this.store.exportArtifact(artifactId);
  }

  /**
   * List artifacts.
   */
  async listArtifacts(options?: {
    userId?: string;
    limit?: number;
  }): Promise<Omit<AuiArtifact, 'content' | 'contentBinary'>[]> {
    if (!this.store) {
      return [];
    }

    return this.store.listArtifacts(options);
  }

  /**
   * Convert a book to markdown format.
   */
  private bookToMarkdown(book: Book): string {
    const lines: string[] = [];

    // Title
    lines.push(`# ${book.title}`);
    lines.push('');

    // Description
    if (book.description) {
      lines.push(`*${book.description}*`);
      lines.push('');
    }

    // Introduction
    if (book.arc?.introduction) {
      lines.push('## Introduction');
      lines.push('');
      lines.push(book.arc.introduction);
      lines.push('');
    }

    // Chapters
    for (const chapter of book.chapters) {
      lines.push(`## ${chapter.title}`);
      lines.push('');
      lines.push(chapter.content);
      lines.push('');
    }

    // Metadata footer
    lines.push('---');
    lines.push('');
    lines.push(`*Generated by humanizer.com*`);
    lines.push(`*Created: ${book.createdAt.toISOString()}*`);

    return lines.join('\n');
  }

  /**
   * Convert a book to HTML format.
   */
  private bookToHtml(book: Book): string {
    const lines: string[] = [];

    lines.push('<!DOCTYPE html>');
    lines.push('<html lang="en">');
    lines.push('<head>');
    lines.push(`  <meta charset="UTF-8">`);
    lines.push(`  <meta name="viewport" content="width=device-width, initial-scale=1.0">`);
    lines.push(`  <title>${this.escapeHtml(book.title)}</title>`);
    lines.push('  <style>');
    lines.push('    body { font-family: Georgia, serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }');
    lines.push('    h1 { border-bottom: 2px solid #333; padding-bottom: 0.5rem; }');
    lines.push('    h2 { color: #444; margin-top: 2rem; }');
    lines.push('    .intro { font-style: italic; color: #666; }');
    lines.push('    .chapter { margin-bottom: 2rem; }');
    lines.push('    .footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #ccc; font-size: 0.9rem; color: #888; }');
    lines.push('  </style>');
    lines.push('</head>');
    lines.push('<body>');

    lines.push(`  <h1>${this.escapeHtml(book.title)}</h1>`);

    if (book.description) {
      lines.push(`  <p class="intro">${this.escapeHtml(book.description)}</p>`);
    }

    if (book.arc?.introduction) {
      lines.push('  <section class="introduction">');
      lines.push('    <h2>Introduction</h2>');
      lines.push(`    <p>${this.escapeHtml(book.arc.introduction)}</p>`);
      lines.push('  </section>');
    }

    for (const chapter of book.chapters) {
      lines.push('  <section class="chapter">');
      lines.push(`    <h2>${this.escapeHtml(chapter.title)}</h2>`);
      // Convert newlines to paragraphs
      const paragraphs = chapter.content.split('\n\n').filter(Boolean);
      for (const para of paragraphs) {
        lines.push(`    <p>${this.escapeHtml(para)}</p>`);
      }
      lines.push('  </section>');
    }

    lines.push('  <div class="footer">');
    lines.push('    <p>Generated by humanizer.com</p>');
    lines.push(`    <p>Created: ${book.createdAt.toISOString()}</p>`);
    lines.push('  </div>');

    lines.push('</body>');
    lines.push('</html>');

    return lines.join('\n');
  }

  /**
   * Escape HTML special characters.
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSONA HARVEST OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Start a persona harvest session.
   * This begins the interactive persona creation flow.
   */
  async startPersonaHarvest(
    sessionId: string,
    options: { name: string }
  ): Promise<StartHarvestResult> {
    const harvestId = randomUUID();
    const now = new Date();

    const harvestSession: PersonaHarvestSession = {
      harvestId,
      sessionId,
      name: options.name,
      status: 'collecting',
      samples: [],
      createdAt: now,
      updatedAt: now,
    };

    this.harvestSessions.set(harvestId, harvestSession);

    return {
      harvestId,
      status: 'collecting',
    };
  }

  /**
   * Add a writing sample to the harvest session.
   */
  async addPersonaSample(
    harvestId: string,
    options: { text: string; source?: 'user-provided' | 'archive'; archiveNodeId?: string }
  ): Promise<{ totalSamples: number }> {
    const harvest = this.harvestSessions.get(harvestId);
    if (!harvest) {
      throw new Error(`Harvest session "${harvestId}" not found`);
    }

    if (harvest.status !== 'collecting') {
      throw new Error(`Harvest session is in "${harvest.status}" status, cannot add samples`);
    }

    harvest.samples.push({
      text: options.text,
      source: options.source ?? 'user-provided',
      archiveNodeId: options.archiveNodeId,
      addedAt: new Date(),
    });
    harvest.updatedAt = new Date();

    return { totalSamples: harvest.samples.length };
  }

  /**
   * Harvest samples from the archive using semantic search.
   */
  async harvestFromArchive(
    harvestId: string,
    options: { query: string; minRelevance?: number; limit?: number }
  ): Promise<{ samplesFound: number; totalSamples: number }> {
    const harvest = this.harvestSessions.get(harvestId);
    if (!harvest) {
      throw new Error(`Harvest session "${harvestId}" not found`);
    }

    if (harvest.status !== 'collecting') {
      throw new Error(`Harvest session is in "${harvest.status}" status, cannot add samples`);
    }

    // Use the harvest method to find relevant passages
    const harvestResult = await this.harvest({
      query: options.query,
      minRelevance: options.minRelevance ?? 0.6,
      limit: options.limit ?? 20,
    });

    // Add passages as samples
    let samplesFound = 0;
    for (const passage of harvestResult.passages) {
      // Skip if already have this passage
      if (harvest.samples.some(s => s.archiveNodeId === passage.id)) {
        continue;
      }

      // Only add user messages for voice analysis
      if (passage.authorRole === 'user' || !passage.authorRole) {
        harvest.samples.push({
          text: passage.text,
          source: 'archive',
          archiveNodeId: passage.id,
          addedAt: new Date(),
        });
        samplesFound++;
      }
    }

    harvest.updatedAt = new Date();

    return {
      samplesFound,
      totalSamples: harvest.samples.length,
    };
  }

  /**
   * Extract voice traits and fingerprint from collected samples.
   */
  async extractPersonaTraits(harvestId: string): Promise<ExtractTraitsResult> {
    const harvest = this.harvestSessions.get(harvestId);
    if (!harvest) {
      throw new Error(`Harvest session "${harvestId}" not found`);
    }

    if (harvest.samples.length === 0) {
      throw new Error('No samples collected. Add samples before extracting traits.');
    }

    harvest.status = 'analyzing';
    harvest.updatedAt = new Date();

    // Use VoiceAnalyzer to analyze samples
    const voiceAnalyzer = getVoiceAnalyzer();
    const sampleTexts = harvest.samples.map(s => s.text);
    const analysis = voiceAnalyzer.analyze(sampleTexts);

    harvest.analysis = analysis;
    harvest.updatedAt = new Date();

    return {
      voiceTraits: analysis.proposedTraits.voiceTraits,
      toneMarkers: analysis.proposedTraits.toneMarkers,
      voiceFingerprint: analysis.fingerprint,
      suggestedStyles: analysis.suggestedStyles,
      confidence: analysis.proposedTraits.confidence,
    };
  }

  /**
   * Finalize the persona and create it with optional styles.
   */
  async finalizePersona(
    harvestId: string,
    options: {
      voiceTraits?: string[];
      toneMarkers?: string[];
      formalityRange?: [number, number];
      styles?: Array<{
        name: string;
        forbiddenPhrases?: string[];
        preferredPatterns?: string[];
        useContractions?: boolean;
        useRhetoricalQuestions?: boolean;
        formalityLevel?: number;
        isDefault?: boolean;
      }>;
      setAsDefault?: boolean;
    }
  ): Promise<FinalizePersonaResult> {
    const harvest = this.harvestSessions.get(harvestId);
    if (!harvest) {
      throw new Error(`Harvest session "${harvestId}" not found`);
    }

    if (!this.store) {
      throw new Error('Persistent store not configured - cannot save persona');
    }

    // Get the AUI session for userId
    const session = await this.getSessionAsync(harvest.sessionId);
    const userId = session?.userId;

    harvest.status = 'finalizing';
    harvest.updatedAt = new Date();

    // Use analysis if available, or run it
    let analysis = harvest.analysis;
    if (!analysis && harvest.samples.length > 0) {
      const voiceAnalyzer = getVoiceAnalyzer();
      analysis = voiceAnalyzer.analyze(harvest.samples.map(s => s.text));
      harvest.analysis = analysis;
    }

    // Build persona options
    const personaOptions: CreatePersonaProfileOptions = {
      userId,
      name: harvest.name,
      voiceTraits: options.voiceTraits ?? analysis?.proposedTraits.voiceTraits ?? [],
      toneMarkers: options.toneMarkers ?? analysis?.proposedTraits.toneMarkers ?? [],
      formalityRange: options.formalityRange ?? analysis?.proposedTraits.formalityRange ?? [0.3, 0.7],
      voiceFingerprint: analysis?.fingerprint,
      referenceExamples: harvest.samples.slice(0, 5).map(s => s.text.substring(0, 500)),
      isDefault: options.setAsDefault ?? false,
      metadata: {
        harvestId,
        samplesCount: harvest.samples.length,
        harvestedAt: new Date().toISOString(),
      },
    };

    // Create the persona
    const persona = await this.store.createPersonaProfile(personaOptions);

    // Create styles
    const styleIds: string[] = [];

    // If user provided styles, use those; otherwise use suggested styles from analysis
    if (options.styles && options.styles.length > 0) {
      for (let i = 0; i < options.styles.length; i++) {
        const styleOpts = options.styles[i];
        const style = await this.store.createStyleProfile({
          personaId: persona.id,
          name: styleOpts.name,
          forbiddenPhrases: styleOpts.forbiddenPhrases ?? [],
          preferredPatterns: styleOpts.preferredPatterns ?? [],
          useContractions: styleOpts.useContractions ?? true,
          useRhetoricalQuestions: styleOpts.useRhetoricalQuestions ?? false,
          formalityLevel: styleOpts.formalityLevel ?? 0.5,
          isDefault: styleOpts.isDefault ?? (i === 0), // First style is default
        });
        styleIds.push(style.id);
      }
    } else if (analysis?.suggestedStyles) {
      // Use suggested styles from voice analysis
      for (let i = 0; i < analysis.suggestedStyles.length; i++) {
        const suggested = analysis.suggestedStyles[i];
        const style = await this.store.createStyleProfile({
          personaId: persona.id,
          name: suggested.name,
          description: suggested.description,
          forbiddenPhrases: [],
          preferredPatterns: [],
          useContractions: suggested.useContractions,
          useRhetoricalQuestions: suggested.useRhetoricalQuestions,
          formalityLevel: suggested.formalityLevel,
          sentenceVariety: suggested.sentenceVariety,
          paragraphStyle: suggested.paragraphStyle,
          isDefault: i === 0, // First style is default
        });
        styleIds.push(style.id);
      }
    }

    harvest.status = 'complete';
    harvest.updatedAt = new Date();

    // Clean up harvest session after a delay
    setTimeout(() => {
      this.harvestSessions.delete(harvestId);
    }, 60000); // Keep for 1 minute for reference

    return {
      personaId: persona.id,
      styleIds,
    };
  }

  /**
   * Get harvest session status.
   */
  getHarvestSession(harvestId: string): PersonaHarvestSession | undefined {
    return this.harvestSessions.get(harvestId);
  }

  /**
   * Generate a composite sample demonstrating the persona's voice.
   *
   * This allows users to preview what content would look like when written
   * in the persona's voice, before committing to save the persona.
   */
  async generatePersonaSample(
    harvestId: string,
    options?: {
      wordCount?: number;
      topic?: string;
    }
  ): Promise<{
    sample: string;
    personaPreview: {
      name: string;
      voiceTraits: string[];
      toneMarkers: string[];
    };
    metrics: {
      forbiddenPhrasesRemoved: number;
      preferredPatternsUsed: number;
      passCount: number;
    };
  }> {
    const harvest = this.harvestSessions.get(harvestId);
    if (!harvest) {
      throw new Error(`Harvest session "${harvestId}" not found`);
    }

    // Extract traits if not already done
    if (!harvest.analysis) {
      await this.extractPersonaTraits(harvestId);
    }

    if (!harvest.analysis) {
      throw new Error('Failed to extract persona traits from samples');
    }

    const analysis = harvest.analysis;
    const wordCount = options?.wordCount ?? 300;
    const topic = options?.topic ?? 'a reflection on everyday moments and observations';

    // Build a temporary persona for rewriting
    const tempPersona: PersonaProfileForRewrite = {
      name: harvest.name,
      description: `Voice harvested from ${harvest.samples.length} samples`,
      voiceTraits: analysis.proposedTraits.voiceTraits,
      toneMarkers: analysis.proposedTraits.toneMarkers,
      formalityRange: [
        analysis.suggestedStyles?.[0]?.formalityLevel ?? 0.4,
        analysis.suggestedStyles?.[0]?.formalityLevel ?? 0.6,
      ] as [number, number],
      styleGuide: {
        // Use forbidden phrases from the default corpus (common AI phrases)
        forbiddenPhrases: [
          'delve', 'delve into', 'dive into', 'tapestry', 'rich tapestry',
          'the fact that', 'in conclusion', 'it is worth noting',
          'it is important to note', 'essentially', 'fundamentally',
          'at its core', 'at its essence', 'beacon', 'stark',
          'however, it is', 'moreover,', 'furthermore,', 'thus,',
          'hence,', 'consequently,', 'nonetheless,', 'notwithstanding',
          'leveraging', 'leverage', 'utilize', 'utilization',
        ],
        preferredPatterns: [],
        useContractions: analysis.suggestedStyles?.[0]?.useContractions ?? true,
        useRhetoricalQuestions: analysis.suggestedStyles?.[0]?.useRhetoricalQuestions ?? false,
      },
      referenceExamples: harvest.samples.slice(0, 3).map(s => s.text),
    };

    // Generate raw sample content using LLM
    const builder = getBuilderAgent();
    const rawSample = await builder['callAI']('creative', `
Write a ${wordCount}-word piece about ${topic}.
Write naturally and reflectively.
Draw on personal observation and lived experience.
Avoid clichés and academic language.
Output only the content, no titles or meta-commentary.
    `.trim(), {
      systemPrompt: `You are a skilled writer with these voice characteristics:
Voice traits: ${tempPersona.voiceTraits.join(', ')}
Tone: ${tempPersona.toneMarkers.join(', ')}

Write naturally. Avoid phrases like: ${tempPersona.styleGuide.forbiddenPhrases.slice(0, 10).join(', ')}.
${tempPersona.styleGuide.useContractions ? 'Use contractions naturally.' : 'Avoid contractions.'}`,
    });

    // Rewrite to match persona more precisely
    const result = await builder.rewriteForPersonaWithRetry({
      text: rawSample,
      persona: tempPersona,
      sourceType: 'sample-preview',
    }, { maxPasses: 3 });

    // Calculate metrics
    const changesApplied = result.changesApplied || [];
    const forbiddenPhrasesRemoved = changesApplied.filter(c =>
      c.toLowerCase().includes('removed') || c.toLowerCase().includes('replaced')
    ).length;
    const preferredPatternsUsed = changesApplied.filter(c =>
      c.toLowerCase().includes('pattern') || c.toLowerCase().includes('used')
    ).length;

    return {
      sample: result.rewritten,
      personaPreview: {
        name: harvest.name,
        voiceTraits: analysis.proposedTraits.voiceTraits,
        toneMarkers: analysis.proposedTraits.toneMarkers,
      },
      metrics: {
        forbiddenPhrasesRemoved,
        preferredPatternsUsed,
        passCount: result.passCount ?? 1,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STYLE PROFILE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a style profile for an existing persona.
   */
  async createStyleProfile(options: CreateStyleProfileOptions): Promise<StyleProfile> {
    if (!this.store) {
      throw new Error('Persistent store not configured');
    }
    return this.store.createStyleProfile(options);
  }

  /**
   * Get a style profile by ID.
   */
  async getStyleProfile(id: string): Promise<StyleProfile | undefined> {
    if (!this.store) {
      throw new Error('Persistent store not configured');
    }
    return this.store.getStyleProfile(id);
  }

  /**
   * Get the default style for a persona.
   */
  async getDefaultStyleProfile(personaId: string): Promise<StyleProfile | undefined> {
    if (!this.store) {
      throw new Error('Persistent store not configured');
    }
    return this.store.getDefaultStyleProfile(personaId);
  }

  /**
   * List styles for a persona.
   */
  async listStyleProfiles(personaId: string): Promise<StyleProfile[]> {
    if (!this.store) {
      throw new Error('Persistent store not configured');
    }
    return this.store.listStyleProfiles(personaId);
  }

  /**
   * Update a style profile.
   */
  async updateStyleProfile(
    id: string,
    update: Partial<Omit<StyleProfile, 'id' | 'personaId' | 'createdAt' | 'updatedAt'>>
  ): Promise<StyleProfile | undefined> {
    if (!this.store) {
      throw new Error('Persistent store not configured');
    }
    return this.store.updateStyleProfile(id, update);
  }

  /**
   * Delete a style profile.
   */
  async deleteStyleProfile(id: string): Promise<boolean> {
    if (!this.store) {
      throw new Error('Persistent store not configured');
    }
    return this.store.deleteStyleProfile(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSONA PROFILE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get a persona profile by ID.
   */
  async getPersonaProfile(id: string): Promise<PersonaProfile | undefined> {
    if (!this.store) {
      throw new Error('Persistent store not configured');
    }
    return this.store.getPersonaProfile(id);
  }

  /**
   * List persona profiles.
   */
  async listPersonaProfiles(options?: {
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<PersonaProfile[]> {
    if (!this.store) {
      throw new Error('Persistent store not configured');
    }
    return this.store.listPersonaProfiles(options);
  }

  /**
   * Get the default persona profile for a user.
   */
  async getDefaultPersonaProfile(userId: string): Promise<PersonaProfile | undefined> {
    if (!this.store) {
      throw new Error('Persistent store not configured');
    }
    return this.store.getDefaultPersonaProfile(userId);
  }

  /**
   * Set a persona as the default for a user.
   *
   * Verifies that the persona exists and optionally that it belongs to the user.
   * Clears any previous default persona for the user.
   */
  async setDefaultPersona(userId: string, personaId: string): Promise<PersonaProfile> {
    if (!this.store) {
      throw new Error('Persistent store not configured');
    }

    // Verify persona exists
    const persona = await this.store.getPersonaProfile(personaId);
    if (!persona) {
      throw new Error(`Persona "${personaId}" not found`);
    }

    // Verify ownership if persona has a userId
    if (persona.userId && persona.userId !== userId) {
      throw new Error(`Persona "${personaId}" does not belong to user "${userId}"`);
    }

    // Update persona to be default (store handles clearing previous default)
    const updated = await this.store.updatePersonaProfile(personaId, { isDefault: true });
    if (!updated) {
      throw new Error(`Failed to set persona "${personaId}" as default`);
    }

    return updated;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if request looks like BQL.
   */
  private looksLikeBql(request: string): boolean {
    const bqlKeywords = ['harvest', 'load', 'transform', 'save', 'filter', 'select', '|'];
    const lower = request.toLowerCase();
    return bqlKeywords.some(kw => lower.includes(kw));
  }

  /**
   * Check if request looks like a search.
   */
  private looksLikeSearch(request: string): boolean {
    const searchKeywords = ['find', 'search', 'look for', 'where', 'containing'];
    const lower = request.toLowerCase();
    return searchKeywords.some(kw => lower.includes(kw));
  }

  /**
   * Execute BQL and return AuiResponse.
   */
  private async executeBqlAsResponse(
    session: UnifiedAuiSession,
    pipeline: string,
    options?: ProcessOptions
  ): Promise<AuiResponse> {
    const result = await this.executeBql(session.id, pipeline, {
      dryRun: options?.dryRun,
      maxItems: options?.maxItems,
      verbose: options?.verbose,
    });

    return {
      type: result.type,
      message: result.message,
      data: result.data,
      suggestions: result.suggestions,
    };
  }

  /**
   * Run agent and return AuiResponse.
   */
  private async runAgentAsResponse(
    session: UnifiedAuiSession,
    request: string,
    options?: ProcessOptions
  ): Promise<AuiResponse> {
    if (!this.agenticLoop) {
      return {
        type: 'error',
        message: 'Agentic loop not configured',
      };
    }

    const task = await this.runAgent(session.id, request, {
      maxSteps: 10,
      verbose: options?.verbose,
    });

    if (task.status === 'completed') {
      return {
        type: 'success',
        message: 'Task completed',
        data: task.result,
      };
    } else if (task.status === 'awaiting_input') {
      return {
        type: 'awaiting_input',
        message: 'Awaiting user input',
        awaitInput: true,
        inputPrompt: task.steps[task.steps.length - 1]?.content,
      };
    } else {
      return {
        type: 'error',
        message: task.error ?? 'Task failed',
      };
    }
  }

  /**
   * Search and return AuiResponse.
   */
  private async searchAsResponse(
    session: UnifiedAuiSession,
    query: string,
    options?: ProcessOptions
  ): Promise<AuiResponse> {
    if (!this.agenticSearch) {
      return {
        type: 'error',
        message: 'Agentic search not configured',
      };
    }

    const response = await this.search(session.id, query, {
      limit: options?.maxItems ?? 20,
    });

    return {
      type: 'success',
      message: `Found ${response.results.length} results`,
      data: response.results.map(r => ({
        id: r.id,
        text: r.text.substring(0, 200),
        score: r.score,
        source: r.source,
      })),
    };
  }

  /**
   * Destroy the service and clean up resources.
   */
  destroy(): void {
    this.sessionManager.destroy();
    this.agenticLoop = null;
    this.adminService = null;
    this.agenticSearch = null;
    this.bqlExecutor = null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

export interface CreateUnifiedAuiOptions {
  llmAdapter?: AgentLlmAdapter;
  configManager?: ConfigManager;
  agenticSearch?: AgenticSearchService;
  bqlExecutor?: (pipeline: string) => Promise<{ data?: unknown; error?: string }>;
  options?: UnifiedAuiServiceOptions;
}

/**
 * Create a fully configured UnifiedAuiService.
 */
export async function createUnifiedAuiService(
  config: CreateUnifiedAuiOptions
): Promise<UnifiedAuiService> {
  const service = new UnifiedAuiService(config.options);

  // Set up BQL executor if provided
  if (config.bqlExecutor) {
    service.setBqlExecutor(config.bqlExecutor);
  }

  // Set up agentic search if provided
  if (config.agenticSearch) {
    service.setAgenticSearch(config.agenticSearch);
  }

  // Set up admin service if config manager provided
  if (config.configManager) {
    const adminService = initAdminService(config.configManager, {
      enableCostTracking: config.options?.enableCostTracking,
    });
    service.setAdminService(adminService);
  }

  // Set up agentic loop if LLM adapter provided
  if (config.llmAdapter && config.bqlExecutor) {
    const { AgenticLoop } = await import('./agentic-loop.js');
    const { getBufferManager } = await import('./buffer-manager.js');

    const bufferManager = getBufferManager();
    const toolExecutor = createToolExecutor(config.bqlExecutor, bufferManager);
    const loop = new AgenticLoop(config.llmAdapter, toolExecutor, {
      verbose: config.options?.verbose,
      defaultOptions: config.options?.defaultAgentOptions,
    });

    service.setAgenticLoop(loop);
  }

  return service;
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY WITH STORAGE
// ═══════════════════════════════════════════════════════════════════════════

import type { PostgresStorageConfig } from '../storage/schema-postgres.js';

/**
 * Options for initializing UnifiedAuiService with storage
 */
export interface InitUnifiedAuiWithStorageOptions extends CreateUnifiedAuiOptions {
  /** PostgreSQL storage config for archive (humanizer_archive) */
  storageConfig: PostgresStorageConfig;
  /** Optional books database config (humanizer_books) - defaults to same host/port */
  booksConfig?: {
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
  };
  /** AUI store options */
  storeOptions?: {
    maxVersionHistory?: number;
    sessionExpirationMs?: number;
    clusterCacheDays?: number;
    artifactExpirationDays?: number;
  };
  /** Embedding function for search (required for integrated search) */
  embedFn?: (text: string) => Promise<number[]>;
}

/**
 * Initialize UnifiedAuiService with PostgreSQL persistent storage.
 *
 * This sets up the service with:
 * - Archive storage (humanizer_archive)
 * - Books storage (humanizer_books) - optional, for integrated search
 * - Unified search across both databases
 * - AUI persistence (sessions, buffers, books, clusters, artifacts)
 */
export async function initUnifiedAuiWithStorage(
  config: InitUnifiedAuiWithStorageOptions
): Promise<UnifiedAuiService> {
  // Initialize content store (which runs migrations including AUI tables)
  const { initContentStore, getContentStore } = await import('../storage/postgres-content-store.js');
  const contentStore = await initContentStore(config.storageConfig);

  // Initialize AUI store with the same pool
  const { initAuiStore } = await import('../storage/aui-postgres-store.js');
  const auiStore = initAuiStore(contentStore.getPool(), config.storeOptions);

  // Initialize books store if embedFn provided (enables integrated search)
  let booksStore = null;
  if (config.embedFn) {
    try {
      const { initBooksStore } = await import('../storage/books-postgres-store.js');
      const booksDbConfig = {
        host: config.booksConfig?.host ?? config.storageConfig.host,
        port: config.booksConfig?.port ?? config.storageConfig.port,
        database: config.booksConfig?.database ?? 'humanizer_books',
        user: config.booksConfig?.user ?? config.storageConfig.user,
        password: config.booksConfig?.password ?? config.storageConfig.password,
        maxConnections: config.storageConfig.maxConnections ?? 10,
        idleTimeoutMs: config.storageConfig.idleTimeoutMs ?? 30000,
        connectionTimeoutMs: config.storageConfig.connectionTimeoutMs ?? 10000,
        embeddingDimension: config.storageConfig.embeddingDimension ?? 768,
      };
      booksStore = await initBooksStore(booksDbConfig);
    } catch (error) {
      console.warn('Failed to initialize books store, using stub:', error);
    }
  }

  // Create unified store and agentic search service if embedFn provided
  let agenticSearchService = config.agenticSearch;
  if (config.embedFn && !agenticSearchService) {
    const { UnifiedStore, AgenticSearchService } = await import('../agentic-search/index.js');
    const unifiedStore = new UnifiedStore(contentStore, booksStore ?? undefined);
    agenticSearchService = new AgenticSearchService(unifiedStore, config.embedFn);
  }

  // Create the service with agentic search
  const service = await createUnifiedAuiService({
    ...config,
    agenticSearch: agenticSearchService,
  });

  // Attach the stores
  service.setStore(auiStore);
  if (booksStore) {
    service.setBooksStore(booksStore);
  }

  return service;
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

let _unifiedAui: UnifiedAuiService | null = null;

/**
 * Initialize the global unified AUI service.
 */
export async function initUnifiedAui(
  config: CreateUnifiedAuiOptions = {}
): Promise<UnifiedAuiService> {
  _unifiedAui = await createUnifiedAuiService(config);
  return _unifiedAui;
}

/**
 * Get the global unified AUI service.
 */
export function getUnifiedAui(): UnifiedAuiService | null {
  return _unifiedAui;
}

/**
 * Reset the global unified AUI service.
 */
export function resetUnifiedAui(): void {
  if (_unifiedAui) {
    _unifiedAui.destroy();
    _unifiedAui = null;
  }
}
