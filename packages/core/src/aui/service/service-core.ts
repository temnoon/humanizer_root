/**
 * Unified AUI Service - Core Methods
 *
 * Core service methods including initialization, sessions, processing,
 * buffers, search, and admin operations.
 *
 * @module @humanizer/core/aui/service/service-core
 */

import type { Pool } from 'pg';
import type {
  UnifiedAuiSession,
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
} from '../types.js';
import type {
  AgenticSearchService,
  AgenticSearchOptions,
  AgenticSearchResponse,
  RefineOptions,
  SemanticAnchor,
} from '../../agentic-search/index.js';
import { getSessionManager as getSearchSessionManager } from '../../agentic-search/index.js';
import type { PromptTemplate } from '../../config/types.js';
import type { AuiPostgresStore } from '../../storage/aui-postgres-store.js';
import type { BooksPostgresStore } from '../../storage/books-postgres-store.js';
import type { PostgresContentStore } from '../../storage/postgres-content-store.js';
import type { BufferService, ArchiveStoreAdapter, BooksStoreAdapter, AuiStoreAdapter } from '../../buffer/buffer-service.js';
import type { ContentBuffer, ProvenanceChain } from '../../buffer/types.js';
import { BufferServiceImpl } from '../../buffer/buffer-service-impl.js';
import type { AuiSessionManager } from './session-manager.js';
import type { ServiceDependencies } from './types.js';
import type { BufferManager } from '../buffer-manager.js';
import { getModelRegistry } from '../../models/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION METHODS
// ═══════════════════════════════════════════════════════════════════════════

export interface InitializationMethods {
  getDefaultEmbeddingModel(): string;
  createAuiStoreAdapter(): AuiStoreAdapter | undefined;
  createArchiveStoreAdapter(): ArchiveStoreAdapter | undefined;
  createBooksStoreAdapter(): BooksStoreAdapter | undefined;
}

export function createInitializationMethods(
  getStore: () => AuiPostgresStore | null,
  getArchiveStore: () => PostgresContentStore | null,
  getBooksStore: () => BooksPostgresStore | null
): InitializationMethods {
  return {
    getDefaultEmbeddingModel(): string {
      try {
        const registry = getModelRegistry();
        return registry.getDefaultSync?.('embedding')?.id ?? 'nomic-embed-text:latest';
      } catch {
        return 'nomic-embed-text:latest';
      }
    },

    createAuiStoreAdapter(): AuiStoreAdapter | undefined {
      const store = getStore();
      if (!store) return undefined;

      return {
        saveContentBuffer: (buffer: ContentBuffer) => store.saveContentBuffer(buffer),
        loadContentBuffer: (id: string) => store.loadContentBuffer(id),
        findContentBuffersByHash: (hash: string) => store.findContentBuffersByHash(hash),
        deleteContentBuffer: (id: string) => store.deleteContentBuffer(id),
        saveProvenanceChain: (chain: ProvenanceChain) => store.saveProvenanceChain(chain),
        loadProvenanceChain: (id: string) => store.loadProvenanceChain(id),
        findDerivedBuffers: async (_rootBufferId: string) => {
          return [];
        },
        getPersonaProfile: (id: string) => store.getPersonaProfile(id),
        getStyleProfile: (id: string) => store.getStyleProfile(id),
      };
    },

    createArchiveStoreAdapter(): ArchiveStoreAdapter | undefined {
      const store = getArchiveStore();
      if (!store) return undefined;

      return {
        getNode: (nodeId: string) => store.getNode(nodeId),
        createNode: async (node: Omit<import('../../storage/types.js').StoredNode, 'id'>) => {
          const validFormats = ['text', 'markdown', 'html', 'json'] as const;
          const format = validFormats.includes(node.format as any)
            ? (node.format as 'text' | 'markdown' | 'html' | 'json')
            : 'text';

          const imported: import('../../adapters/types.js').ImportedNode = {
            id: `buffer-${Date.now()}`,
            uri: `buffer://manual/${Date.now()}`,
            contentHash: node.contentHash,
            content: node.text,
            format,
            sourceType: node.sourceType ?? 'manual',
            sourceCreatedAt: node.sourceCreatedAt ? new Date(node.sourceCreatedAt) : undefined,
            metadata: node.sourceMetadata ?? {},
          };
          return store.storeNode(imported);
        },
        updateNode: async (nodeId: string, _updates: Partial<import('../../storage/types.js').StoredNode>) => {
          return store.getNode(nodeId);
        },
      };
    },

    createBooksStoreAdapter(): BooksStoreAdapter | undefined {
      const store = getBooksStore();
      if (!store || !store.isAvailable()) return undefined;

      return {
        getChapter: async (_chapterId: string) => {
          return undefined;
        },
        updateChapter: async (_chapterId: string, _content: string, _metadata?: Record<string, unknown>) => {
          return undefined;
        },
        addToChapter: async (bookId: string, chapterId: string, content: string, position?: number) => {
          const node = await store.createNode({
            bookId,
            chapterId,
            text: content,
            format: 'markdown',
            position: position ?? 0,
            hierarchyLevel: 0,
            sourceType: 'synthesized',
          });

          return {
            id: chapterId,
            title: chapterId,
            content,
            passageIds: [],
            position: position ?? 0,
            wordCount: content.split(/\s+/).filter(Boolean).length,
          };
        },
      };
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SESSION METHODS
// ═══════════════════════════════════════════════════════════════════════════

export interface SessionMethods {
  createSession(options?: { userId?: string; name?: string }): Promise<UnifiedAuiSession>;
  getSessionAsync(id: string): Promise<UnifiedAuiSession | undefined>;
  getSession(id: string): UnifiedAuiSession | undefined;
  deleteSession(id: string): boolean;
  listSessions(): UnifiedAuiSession[];
}

export function createSessionMethods(deps: ServiceDependencies): SessionMethods {
  return {
    async createSession(options?: { userId?: string; name?: string }): Promise<UnifiedAuiSession> {
      const sessionManager = deps.getSessionManager();
      const session = sessionManager.create(options);
      const store = deps.getStore();

      if (store) {
        try {
          await store.createSession({
            id: session.id,
            userId: options?.userId,
            name: options?.name,
          });
          deps.getSessionCache().set(session.id, session);
        } catch (error) {
          console.warn('Failed to persist session:', error);
        }
      }

      return session;
    },

    async getSessionAsync(id: string): Promise<UnifiedAuiSession | undefined> {
      const sessionManager = deps.getSessionManager();
      let session = sessionManager.get(id);
      if (session) return session;

      const sessionCache = deps.getSessionCache();
      session = sessionCache.get(id);
      if (session) return session;

      const store = deps.getStore();
      if (store) {
        try {
          const storedSession = await store.getSession(id);
          if (storedSession) {
            sessionCache.set(id, storedSession);
            return storedSession;
          }
        } catch (error) {
          console.warn('Failed to load session from store:', error);
        }
      }

      return undefined;
    },

    getSession(id: string): UnifiedAuiSession | undefined {
      const sessionManager = deps.getSessionManager();
      const session = sessionManager.get(id);
      if (session) return session;
      return deps.getSessionCache().get(id);
    },

    deleteSession(id: string): boolean {
      return deps.getSessionManager().delete(id);
    },

    listSessions(): UnifiedAuiSession[] {
      return deps.getSessionManager().list();
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PROCESSING METHODS
// ═══════════════════════════════════════════════════════════════════════════

export interface ProcessingMethods {
  process(sessionId: string, request: string, options?: ProcessOptions): Promise<AuiResponse>;
  runAgent(sessionId: string, request: string, options?: AgentLoopOptions): Promise<AgentTask>;
  executeBql(sessionId: string, pipeline: string, options?: BqlOptions): Promise<BqlResult>;
}

export function createProcessingMethods(
  deps: ServiceDependencies,
  sessionMethods: SessionMethods
): ProcessingMethods {
  // Helper functions
  function looksLikeBql(request: string): boolean {
    const bqlKeywords = ['harvest', 'load', 'transform', 'save', 'filter', 'select', '|'];
    const lower = request.toLowerCase();
    return bqlKeywords.some(kw => lower.includes(kw));
  }

  function looksLikeSearch(request: string): boolean {
    const searchKeywords = ['find', 'search', 'look for', 'where', 'containing'];
    const lower = request.toLowerCase();
    return searchKeywords.some(kw => lower.includes(kw));
  }

  async function executeBqlAsResponse(
    session: UnifiedAuiSession,
    pipeline: string,
    options?: ProcessOptions
  ): Promise<AuiResponse> {
    const result = await methods.executeBql(session.id, pipeline, {
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

  async function runAgentAsResponse(
    session: UnifiedAuiSession,
    request: string,
    options?: ProcessOptions
  ): Promise<AuiResponse> {
    const agenticLoop = deps.getAgenticLoop();
    if (!agenticLoop) {
      return {
        type: 'error',
        message: 'Agentic loop not configured',
      };
    }

    const task = await methods.runAgent(session.id, request, {
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

  async function searchAsResponse(
    session: UnifiedAuiSession,
    query: string,
    options?: ProcessOptions
  ): Promise<AuiResponse> {
    const agenticSearch = deps.getAgenticSearch();
    if (!agenticSearch) {
      return {
        type: 'error',
        message: 'Agentic search not configured',
      };
    }

    if (!session.searchSessionId) {
      const searchSessionManager = getSearchSessionManager();
      const searchSession = searchSessionManager.createSession();
      session.searchSessionId = searchSession.id;
    }

    const response = await agenticSearch.searchInSession(session.searchSessionId, query, {
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

  const methods: ProcessingMethods = {
    async process(sessionId: string, request: string, options?: ProcessOptions): Promise<AuiResponse> {
      const session = sessionMethods.getSession(sessionId);
      if (!session) {
        return {
          type: 'error',
          message: `Session "${sessionId}" not found`,
        };
      }

      deps.getSessionManager().touch(session);
      session.commandHistory.push(request);
      session.metadata.commandCount++;

      try {
        if (options?.route === 'bql' || looksLikeBql(request)) {
          return await executeBqlAsResponse(session, request, options);
        }

        if (options?.route === 'search' || looksLikeSearch(request)) {
          return await searchAsResponse(session, request, options);
        }

        if (options?.route === 'agent') {
          return await runAgentAsResponse(session, request, options);
        }

        const bqlExecutor = deps.getBqlExecutor();
        if (bqlExecutor) {
          const bqlResult = await methods.executeBql(sessionId, request, { dryRun: true });
          if (bqlResult.type === 'success') {
            return await executeBqlAsResponse(session, request, options);
          }
        }

        const agenticLoop = deps.getAgenticLoop();
        if (agenticLoop) {
          return await runAgentAsResponse(session, request, options);
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
    },

    async runAgent(sessionId: string, request: string, options?: AgentLoopOptions): Promise<AgentTask> {
      const agenticLoop = deps.getAgenticLoop();
      if (!agenticLoop) {
        throw new Error('Agentic loop not configured');
      }

      const session = sessionMethods.getSession(sessionId);
      if (!session) {
        throw new Error(`Session "${sessionId}" not found`);
      }

      deps.getSessionManager().touch(session);
      session.metadata.taskCount++;

      const task = await agenticLoop.run(
        request,
        {
          activeBuffer: session.activeBufferName,
          searchSessionId: session.searchSessionId,
          variables: session.variables,
        },
        options
      );

      session.currentTask = task;
      session.taskHistory.push(task);

      return task;
    },

    async executeBql(sessionId: string, pipeline: string, options?: BqlOptions): Promise<BqlResult> {
      const bqlExecutor = deps.getBqlExecutor();
      if (!bqlExecutor) {
        return {
          type: 'error',
          message: 'BQL executor not configured',
        };
      }

      const session = sessionMethods.getSession(sessionId);
      if (!session) {
        return {
          type: 'error',
          message: `Session "${sessionId}" not found`,
        };
      }

      deps.getSessionManager().touch(session);

      try {
        const result = await bqlExecutor(pipeline);

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
    },
  };

  return methods;
}

// ═══════════════════════════════════════════════════════════════════════════
// BUFFER METHODS
// ═══════════════════════════════════════════════════════════════════════════

export interface BufferMethods {
  createBuffer(sessionId: string, name: string, content?: unknown[]): VersionedBuffer;
  getBuffer(sessionId: string, name: string): VersionedBuffer | undefined;
  listBuffers(sessionId: string): VersionedBuffer[];
  setBufferContent(sessionId: string, bufferName: string, content: unknown[]): void;
  appendToBuffer(sessionId: string, bufferName: string, items: unknown[]): void;
  commit(sessionId: string, bufferName: string, message: string): Promise<BufferVersion>;
  rollback(sessionId: string, bufferName: string, steps?: number): BufferVersion;
  getHistory(sessionId: string, bufferName: string, limit?: number): BufferVersion[];
  branch(sessionId: string, bufferName: string, branchName: string): BufferBranch;
  switchBranch(sessionId: string, bufferName: string, branchName: string): void;
  merge(sessionId: string, bufferName: string, sourceBranch: string, message?: string): MergeResult;
  diff(sessionId: string, bufferName: string, from: string, to: string): BufferDiff;
}

export function createBufferMethods(
  deps: ServiceDependencies,
  sessionMethods: SessionMethods
): BufferMethods {
  return {
    createBuffer(sessionId: string, name: string, content?: unknown[]): VersionedBuffer {
      const session = sessionMethods.getSession(sessionId);
      if (!session) {
        throw new Error(`Session "${sessionId}" not found`);
      }

      const bufferManager = deps.getBufferManager();
      const buffer = bufferManager.createBuffer(name, content);
      session.buffers.set(name, buffer);
      session.activeBufferName = name;
      deps.getSessionManager().touch(session);

      return buffer;
    },

    getBuffer(sessionId: string, name: string): VersionedBuffer | undefined {
      const session = sessionMethods.getSession(sessionId);
      if (!session) {
        throw new Error(`Session "${sessionId}" not found`);
      }

      return deps.getBufferManager().getBuffer(name);
    },

    listBuffers(sessionId: string): VersionedBuffer[] {
      const session = sessionMethods.getSession(sessionId);
      if (!session) {
        throw new Error(`Session "${sessionId}" not found`);
      }

      return deps.getBufferManager().listBuffers();
    },

    setBufferContent(sessionId: string, bufferName: string, content: unknown[]): void {
      const session = sessionMethods.getSession(sessionId);
      if (!session) {
        throw new Error(`Session "${sessionId}" not found`);
      }

      deps.getBufferManager().setWorkingContent(bufferName, content);
      deps.getSessionManager().touch(session);
    },

    appendToBuffer(sessionId: string, bufferName: string, items: unknown[]): void {
      const session = sessionMethods.getSession(sessionId);
      if (!session) {
        throw new Error(`Session "${sessionId}" not found`);
      }

      deps.getBufferManager().appendToBuffer(bufferName, items);
      deps.getSessionManager().touch(session);
    },

    async commit(sessionId: string, bufferName: string, message: string): Promise<BufferVersion> {
      const session = sessionMethods.getSession(sessionId);
      if (!session) {
        throw new Error(`Session "${sessionId}" not found`);
      }

      const bufferManager = deps.getBufferManager();
      const version = bufferManager.commit(bufferName, message);
      deps.getSessionManager().touch(session);

      const store = deps.getStore();
      if (store) {
        try {
          const buffer = bufferManager.getBuffer(bufferName);
          if (buffer) {
            let storedBuffer = await store.getBufferByName(sessionId, bufferName);
            if (!storedBuffer) {
              storedBuffer = await store.createBuffer(sessionId, bufferName, buffer.workingContent);
            }

            await store.createVersion(storedBuffer.id, {
              id: version.id,
              content: version.content,
              message: version.message,
              parentId: version.parentId ?? undefined,
              tags: version.tags,
              metadata: version.metadata,
            });

            await store.updateBranch(storedBuffer.id, buffer.currentBranch, {
              headVersionId: version.id,
            });

            await store.updateBuffer(storedBuffer.id, {
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
    },

    rollback(sessionId: string, bufferName: string, steps?: number): BufferVersion {
      const session = sessionMethods.getSession(sessionId);
      if (!session) {
        throw new Error(`Session "${sessionId}" not found`);
      }

      const version = deps.getBufferManager().rollback(bufferName, steps);
      deps.getSessionManager().touch(session);

      return version;
    },

    getHistory(sessionId: string, bufferName: string, limit?: number): BufferVersion[] {
      const session = sessionMethods.getSession(sessionId);
      if (!session) {
        throw new Error(`Session "${sessionId}" not found`);
      }

      return deps.getBufferManager().getHistory(bufferName, limit);
    },

    branch(sessionId: string, bufferName: string, branchName: string): BufferBranch {
      const session = sessionMethods.getSession(sessionId);
      if (!session) {
        throw new Error(`Session "${sessionId}" not found`);
      }

      const branch = deps.getBufferManager().createBranch(bufferName, branchName);
      deps.getSessionManager().touch(session);

      return branch;
    },

    switchBranch(sessionId: string, bufferName: string, branchName: string): void {
      const session = sessionMethods.getSession(sessionId);
      if (!session) {
        throw new Error(`Session "${sessionId}" not found`);
      }

      deps.getBufferManager().switchBranch(bufferName, branchName);
      deps.getSessionManager().touch(session);
    },

    merge(sessionId: string, bufferName: string, sourceBranch: string, message?: string): MergeResult {
      const session = sessionMethods.getSession(sessionId);
      if (!session) {
        throw new Error(`Session "${sessionId}" not found`);
      }

      const result = deps.getBufferManager().merge(bufferName, sourceBranch, message);
      deps.getSessionManager().touch(session);

      return result;
    },

    diff(sessionId: string, bufferName: string, from: string, to: string): BufferDiff {
      const session = sessionMethods.getSession(sessionId);
      if (!session) {
        throw new Error(`Session "${sessionId}" not found`);
      }

      return deps.getBufferManager().diff(bufferName, from, to);
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SEARCH METHODS
// ═══════════════════════════════════════════════════════════════════════════

export interface SearchMethods {
  search(sessionId: string, query: string, options?: AgenticSearchOptions): Promise<AgenticSearchResponse>;
  refine(sessionId: string, options: RefineOptions): Promise<AgenticSearchResponse>;
  addAnchor(sessionId: string, resultId: string, type: 'positive' | 'negative'): Promise<SemanticAnchor>;
  searchToBuffer(
    sessionId: string,
    bufferName: string,
    options?: { limit?: number; create?: boolean }
  ): Promise<VersionedBuffer>;
}

export function createSearchMethods(
  deps: ServiceDependencies,
  sessionMethods: SessionMethods,
  bufferMethods: BufferMethods
): SearchMethods {
  return {
    async search(sessionId: string, query: string, options?: AgenticSearchOptions): Promise<AgenticSearchResponse> {
      const agenticSearch = deps.getAgenticSearch();
      if (!agenticSearch) {
        throw new Error('Agentic search not configured');
      }

      const session = sessionMethods.getSession(sessionId);
      if (!session) {
        throw new Error(`Session "${sessionId}" not found`);
      }

      deps.getSessionManager().touch(session);
      session.metadata.searchCount++;

      if (!session.searchSessionId) {
        const searchSessionManager = getSearchSessionManager();
        const searchSession = searchSessionManager.createSession();
        session.searchSessionId = searchSession.id;
      }

      return agenticSearch.searchInSession(session.searchSessionId, query, options);
    },

    async refine(sessionId: string, options: RefineOptions): Promise<AgenticSearchResponse> {
      const agenticSearch = deps.getAgenticSearch();
      if (!agenticSearch) {
        throw new Error('Agentic search not configured');
      }

      const session = sessionMethods.getSession(sessionId);
      if (!session) {
        throw new Error(`Session "${sessionId}" not found`);
      }

      if (!session.searchSessionId) {
        throw new Error('No active search session');
      }

      deps.getSessionManager().touch(session);
      return agenticSearch.refineResults(session.searchSessionId, options);
    },

    async addAnchor(sessionId: string, resultId: string, type: 'positive' | 'negative'): Promise<SemanticAnchor> {
      const agenticSearch = deps.getAgenticSearch();
      if (!agenticSearch) {
        throw new Error('Agentic search not configured');
      }

      const session = sessionMethods.getSession(sessionId);
      if (!session) {
        throw new Error(`Session "${sessionId}" not found`);
      }

      if (!session.searchSessionId) {
        throw new Error('No active search session');
      }

      deps.getSessionManager().touch(session);

      if (type === 'positive') {
        return agenticSearch.addPositiveAnchor(session.searchSessionId, resultId);
      } else {
        return agenticSearch.addNegativeAnchor(session.searchSessionId, resultId);
      }
    },

    async searchToBuffer(
      sessionId: string,
      bufferName: string,
      options?: { limit?: number; create?: boolean }
    ): Promise<VersionedBuffer> {
      const agenticSearch = deps.getAgenticSearch();
      if (!agenticSearch) {
        throw new Error('Agentic search not configured');
      }

      const session = sessionMethods.getSession(sessionId);
      if (!session) {
        throw new Error(`Session "${sessionId}" not found`);
      }

      if (!session.searchSessionId) {
        throw new Error('No active search session');
      }

      const searchSessionManager = getSearchSessionManager();
      const results = searchSessionManager.getResults(session.searchSessionId);
      const items = options?.limit ? results.slice(0, options.limit) : results;

      const bufferManager = deps.getBufferManager();
      if (options?.create || !bufferManager.hasBuffer(bufferName)) {
        return bufferMethods.createBuffer(sessionId, bufferName, items);
      } else {
        bufferManager.setWorkingContent(bufferName, items);
        const buffer = bufferManager.getBuffer(bufferName)!;
        session.activeBufferName = bufferName;
        deps.getSessionManager().touch(session);
        return buffer;
      }
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN METHODS
// ═══════════════════════════════════════════════════════════════════════════

export interface AdminMethods {
  getConfig(category: string, key: string): Promise<unknown>;
  setConfig(category: string, key: string, value: unknown): Promise<void>;
  listPrompts(): Promise<PromptTemplate[]>;
  getPrompt(id: string): Promise<PromptTemplate | undefined>;
  setPrompt(template: Omit<PromptTemplate, 'version'>): Promise<void>;
  getCostReport(options: CostReportOptions): Promise<CostReport>;
  getUsage(userId: string): Promise<UserUsage>;
  checkLimits(userId: string): Promise<LimitCheckResult>;
  listTiers(): Promise<UserTier[]>;
  setUserTier(userId: string, tierId: string): Promise<void>;
}

export function createAdminMethods(deps: ServiceDependencies): AdminMethods {
  return {
    async getConfig(category: string, key: string): Promise<unknown> {
      const adminService = deps.getAdminService();
      if (!adminService) {
        throw new Error('Admin service not configured');
      }
      return adminService.getConfig(category as any, key);
    },

    async setConfig(category: string, key: string, value: unknown): Promise<void> {
      const adminService = deps.getAdminService();
      if (!adminService) {
        throw new Error('Admin service not configured');
      }
      await adminService.setConfig(category as any, key, value);
    },

    async listPrompts(): Promise<PromptTemplate[]> {
      const adminService = deps.getAdminService();
      if (!adminService) {
        throw new Error('Admin service not configured');
      }
      return adminService.listPrompts();
    },

    async getPrompt(id: string): Promise<PromptTemplate | undefined> {
      const adminService = deps.getAdminService();
      if (!adminService) {
        throw new Error('Admin service not configured');
      }
      return adminService.getPrompt(id);
    },

    async setPrompt(template: Omit<PromptTemplate, 'version'>): Promise<void> {
      const adminService = deps.getAdminService();
      if (!adminService) {
        throw new Error('Admin service not configured');
      }
      await adminService.setPrompt(template);
    },

    async getCostReport(options: CostReportOptions): Promise<CostReport> {
      const adminService = deps.getAdminService();
      if (!adminService) {
        throw new Error('Admin service not configured');
      }
      return adminService.getCostReport(options);
    },

    async getUsage(userId: string): Promise<UserUsage> {
      const adminService = deps.getAdminService();
      if (!adminService) {
        throw new Error('Admin service not configured');
      }
      return adminService.getUsage(userId);
    },

    async checkLimits(userId: string): Promise<LimitCheckResult> {
      const adminService = deps.getAdminService();
      if (!adminService) {
        throw new Error('Admin service not configured');
      }
      return adminService.checkLimits(userId);
    },

    async listTiers(): Promise<UserTier[]> {
      const adminService = deps.getAdminService();
      if (!adminService) {
        throw new Error('Admin service not configured');
      }
      return adminService.listTiers();
    },

    async setUserTier(userId: string, tierId: string): Promise<void> {
      const adminService = deps.getAdminService();
      if (!adminService) {
        throw new Error('Admin service not configured');
      }
      await adminService.setUserTier(userId, tierId);
    },
  };
}
