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

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a new AUI session.
   */
  createSession(options?: { userId?: string; name?: string }): UnifiedAuiSession {
    return this.sessionManager.create(options);
  }

  /**
   * Get a session by ID.
   */
  getSession(id: string): UnifiedAuiSession | undefined {
    return this.sessionManager.get(id);
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
  commit(sessionId: string, bufferName: string, message: string): BufferVersion {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }

    const version = this.bufferManager.commit(bufferName, message);
    this.sessionManager.touch(session);

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

      // Get all nodes with embeddings
      const searchResults = await store.searchByEmbedding(new Array(768).fill(0), { limit: 10000, threshold: 0.0 });

      // Apply filters
      let filteredResults = searchResults;

      // Filter by word count
      const minWordCount = options?.minWordCount ?? 7;
      if (minWordCount > 0) {
        filteredResults = filteredResults.filter(result => {
          const wordCount = result.node.text?.split(/\s+/).filter(Boolean).length || 0;
          return wordCount >= minWordCount;
        });
      }

      // Filter by exclude patterns
      if (options?.excludePatterns?.length) {
        const patterns = options.excludePatterns.map(p => new RegExp(p, 'i'));
        filteredResults = filteredResults.filter(result => !patterns.some(p => p.test(result.node.text || '')));
      }

      // Filter by source type
      if (options?.sourceTypes?.length) {
        filteredResults = filteredResults.filter(result =>
          options.sourceTypes!.includes(result.node.sourceType || '')
        );
      }

      // Filter by author role (only user messages by default)
      const authorRoles: string[] = options?.authorRoles || ['user'];
      filteredResults = filteredResults.filter(result =>
        authorRoles.includes((result.node as StoredNode & { authorRole?: string }).authorRole || 'user')
      );

      if (options?.onProgress) {
        options.onProgress({ phase: 'clustering', step: 2, totalSteps: 4, message: `Clustering ${filteredResults.length} passages...` });
      }

      // Simple K-means-like clustering using cosine similarity
      // For now, use a simplified approach based on semantic similarity search
      const maxClusters = options?.maxClusters || 10;
      const minClusterSize = options?.minClusterSize || 5;
      const minSimilarity = options?.minSimilarity || 0.7;

      // Find cluster seeds (passages that are central to many others)
      const clusters: ContentCluster[] = [];
      const assigned = new Set<string>();

      // Sample seed passages for clustering
      const seedCandidates = filteredResults.slice(0, Math.min(filteredResults.length, 100));

      for (const seedResult of seedCandidates) {
        if (assigned.has(seedResult.node.id)) continue;
        if (clusters.length >= maxClusters) break;

        // Find similar passages to this seed
        const seedEmbedding = (seedResult.node as StoredNode & { embedding?: number[] }).embedding;
        if (!seedEmbedding) continue;

        const similarResults = await store.searchByEmbedding(seedEmbedding, { limit: 100, threshold: minSimilarity });
        const clusterMemberResults = similarResults.filter(r => !assigned.has(r.node.id) && r.node.id !== seedResult.node.id);

        if (clusterMemberResults.length + 1 >= minClusterSize) {
          // Create cluster
          const allResults = [seedResult, ...clusterMemberResults];
          const clusterPassages = allResults.map(r => ({
            id: r.node.id,
            text: r.node.text || '',
            sourceType: r.node.sourceType || 'unknown',
            authorRole: (r.node as StoredNode & { authorRole?: string }).authorRole,
            wordCount: r.node.text?.split(/\s+/).filter(Boolean).length || 0,
            distanceFromCentroid: r === seedResult ? 0 : (r.distance ?? 1 - r.score),
            sourceCreatedAt: r.node.sourceCreatedAt ? new Date(r.node.sourceCreatedAt) : undefined,
            title: (r.node as StoredNode & { title?: string }).title,
          }));

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
            description: `Cluster around: ${seedResult.node.text?.substring(0, 100)}...`,
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
        totalPassages: filteredResults.length,
        assignedPassages: assigned.size,
        noisePassages: filteredResults.length - assigned.size,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      throw new Error(`Cluster discovery failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List discovered clusters.
   */
  async listClusters(): Promise<ContentCluster[]> {
    // For now, run discovery - in production, would cache/store results
    const result = await this.discoverClusters({ maxClusters: 20 });
    return result.clusters;
  }

  /**
   * Get a specific cluster by ID.
   */
  async getCluster(clusterId: string): Promise<ContentCluster | undefined> {
    const clusters = await this.listClusters();
    return clusters.find(c => c.id === clusterId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOK CREATION OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  private books: Map<string, Book> = new Map();

  /**
   * Create a book from a cluster.
   */
  async createBookFromCluster(
    clusterId: string,
    options?: BookFromClusterOptions
  ): Promise<Book> {
    const cluster = await this.getCluster(clusterId);
    if (!cluster) {
      throw new Error(`Cluster "${clusterId}" not found`);
    }

    if (options?.onProgress) {
      options.onProgress({ phase: 'gathering', step: 1, totalSteps: 5, message: 'Gathering passages...' });
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
      options.onProgress({ phase: 'generating_arc', step: 2, totalSteps: 5, message: 'Generating narrative arc...' });
    }

    // Generate narrative arc
    const arc = await this.generateArc({
      passages: harvestedPassages,
      arcType: options?.arcType || 'thematic',
      introWordCount: 300,
    });

    if (options?.onProgress) {
      options.onProgress({ phase: 'assembling', step: 4, totalSteps: 5, message: 'Assembling book...' });
    }

    // Create book chapters
    const chapters = arc.chapters.map((ch, idx) => {
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
      },
    };

    this.books.set(book.id, book);

    if (options?.onProgress) {
      options.onProgress({ phase: 'complete', step: 5, totalSteps: 5, message: 'Book created' });
    }

    return book;
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
  async listBooks(): Promise<Book[]> {
    return Array.from(this.books.values());
  }

  /**
   * Get a book by ID.
   */
  async getBook(bookId: string): Promise<Book | undefined> {
    return this.books.get(bookId);
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
// GLOBAL INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

let _unifiedAui: UnifiedAuiService | null = null;

/**
 * Initialize the global unified AUI service.
 */
export async function initUnifiedAui(
  config: CreateUnifiedAuiOptions
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
