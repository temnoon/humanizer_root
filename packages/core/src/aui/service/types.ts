/**
 * Unified AUI Service Types
 *
 * Type definitions for the UnifiedAuiService and related components.
 *
 * @module @humanizer/core/aui/service/types
 */

import type { VoiceAnalysisResult, SuggestedStyle } from '../voice-analyzer.js';
import type { VoiceFingerprint } from '../../storage/aui-postgres-store.js';
import type { AgentLlmAdapter } from '../agentic-loop.js';
import type { AgenticSearchService } from '../../agentic-search/index.js';
import type { ConfigManager } from '../../config/types.js';
import type { UnifiedAuiServiceOptions } from '../types.js';
import type { PostgresStorageConfig } from '../../storage/schema-postgres.js';

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
  voiceFingerprint: VoiceFingerprint;
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
// FACTORY TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Options for creating a UnifiedAuiService
 */
export interface CreateUnifiedAuiOptions {
  llmAdapter?: AgentLlmAdapter;
  configManager?: ConfigManager;
  agenticSearch?: AgenticSearchService;
  bqlExecutor?: (pipeline: string) => Promise<{ data?: unknown; error?: string }>;
  options?: UnifiedAuiServiceOptions;
}

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

// ═══════════════════════════════════════════════════════════════════════════
// METHOD DEPENDENCY INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Shared dependencies for method factories
 */
export interface ServiceDependencies {
  getStore: () => import('../../storage/aui-postgres-store.js').AuiPostgresStore | null;
  getBooksStore: () => import('../../storage/books-postgres-store.js').BooksPostgresStore | null;
  getArchiveStore: () => import('../../storage/postgres-content-store.js').PostgresContentStore | null;
  getAgenticSearch: () => AgenticSearchService | null;
  getAgenticLoop: () => import('../agentic-loop.js').AgenticLoop | null;
  getAdminService: () => import('../admin-service.js').AdminService | null;
  getBqlExecutor: () => ((pipeline: string) => Promise<{ data?: unknown; error?: string }>) | null;
  getBufferService: () => import('../../buffer/buffer-service.js').BufferService;
  getBufferManager: () => import('../buffer-manager.js').BufferManager;
  getSessionManager: () => import('./session-manager.js').AuiSessionManager;
  getDefaultEmbeddingModel: () => string;
  getBooks: () => Map<string, import('../types.js').Book>;
  getHarvestSessions: () => Map<string, PersonaHarvestSession>;
  getSessionCache: () => Map<string, import('../types.js').UnifiedAuiSession>;
}
