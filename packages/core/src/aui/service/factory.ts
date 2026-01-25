/**
 * Unified AUI Service - Factory Functions
 *
 * Factory functions for creating UnifiedAuiService instances and global instance management.
 *
 * @module @humanizer/core/aui/service/factory
 */

import type { UnifiedAuiService } from './index.js';
import type { CreateUnifiedAuiOptions, InitUnifiedAuiWithStorageOptions } from './types.js';
import { initAdminService } from '../admin-service.js';
import { createToolExecutor } from '../agentic-loop.js';

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a fully configured UnifiedAuiService.
 */
export async function createUnifiedAuiService(
  config: CreateUnifiedAuiOptions
): Promise<UnifiedAuiService> {
  // Dynamic import to avoid circular dependency
  const { UnifiedAuiService } = await import('./index.js');
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
    const { AgenticLoop } = await import('../agentic-loop.js');
    const { getBufferManager } = await import('../buffer-manager.js');

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
  const { initContentStore, getContentStore } = await import(
    '../../storage/postgres-content-store.js'
  );
  const contentStore = await initContentStore(config.storageConfig);

  // Initialize AUI store with the same pool
  const { initAuiStore } = await import('../../storage/aui-postgres-store.js');
  const auiStore = initAuiStore(contentStore.getPool(), config.storeOptions);

  // Initialize books store if embedFn provided (enables integrated search)
  let booksStore = null;
  if (config.embedFn) {
    try {
      const { initBooksStore } = await import('../../storage/books-postgres-store.js');
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
    const { UnifiedStore, AgenticSearchService } = await import('../../agentic-search/index.js');
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
  service.setArchiveStore(contentStore);
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
