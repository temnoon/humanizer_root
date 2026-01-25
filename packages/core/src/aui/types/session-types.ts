/**
 * Unified AUI Types - Session Types
 *
 * Session management, service options, and MCP types.
 *
 * @module @humanizer/core/aui/types/session-types
 */

import type { AgenticSearchOptions } from '../../agentic-search/types.js';
import type { VersionedBuffer } from './buffer-types.js';
import type { AgentTask, AgentLoopOptions } from './agent-types.js';

// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED AUI SESSION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Combined AUI session state.
 * A session spans all AUI capabilities: buffers, search, agent tasks.
 */
export interface UnifiedAuiSession {
  /** Session ID */
  id: string;

  /** Optional session name */
  name?: string;

  /** User ID (if authenticated) */
  userId?: string;

  // Buffer state
  /** Versioned buffers in this session */
  buffers: Map<string, VersionedBuffer>;

  /** Currently active buffer name */
  activeBufferName?: string;

  // Search state
  /** Linked search session ID */
  searchSessionId?: string;

  // Task state
  /** Currently running agent task */
  currentTask?: AgentTask;

  /** Completed task history */
  taskHistory: AgentTask[];

  // BQL state
  /** Command history */
  commandHistory: string[];

  /** Session variables */
  variables: Map<string, unknown>;

  // Metadata
  /** When created (epoch ms) */
  createdAt: number;

  /** When last updated (epoch ms) */
  updatedAt: number;

  /** When this session expires (epoch ms) */
  expiresAt?: number;

  /** Session metadata */
  metadata: SessionMetadata;
}

/**
 * Session metadata.
 */
export interface SessionMetadata {
  /** Total commands executed */
  commandCount: number;

  /** Total searches performed */
  searchCount: number;

  /** Total agent tasks run */
  taskCount: number;

  /** User agent string */
  userAgent?: string;

  /** Client IP (for rate limiting) */
  clientIp?: string;

  /** Custom metadata */
  custom?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE OPTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Options for UnifiedAuiService.
 */
export interface UnifiedAuiServiceOptions {
  /** Default agent loop options */
  defaultAgentOptions?: Partial<AgentLoopOptions>;

  /** Default search options */
  defaultSearchOptions?: Partial<AgenticSearchOptions>;

  /** Maximum sessions to keep */
  maxSessions?: number;

  /** Session timeout (ms) */
  sessionTimeoutMs?: number;

  /** Enable cost tracking */
  enableCostTracking?: boolean;

  /** Enable audit logging */
  enableAuditLogging?: boolean;

  /** Verbose logging */
  verbose?: boolean;
}

/**
 * Options for processing a request.
 */
export interface ProcessOptions {
  /** Whether this is a dry run */
  dryRun?: boolean;

  /** Maximum items to return */
  maxItems?: number;

  /** Verbose output */
  verbose?: boolean;

  /** Route hints (bypass intent detection) */
  route?: 'search' | 'bql' | 'agent' | 'admin';
}

/**
 * Response from processing a request.
 */
export interface AuiResponse {
  /** Response type */
  type: 'success' | 'error' | 'awaiting_input' | 'partial';

  /** Human-readable message */
  message: string;

  /** Result data */
  data?: unknown;

  /** Suggestions for next actions */
  suggestions?: string[];

  /** Whether more input is needed */
  awaitInput?: boolean;

  /** Prompt for user input (if awaitInput) */
  inputPrompt?: string;

  /** Tokens used */
  tokensUsed?: number;

  /** Cost (cents) */
  costCents?: number;
}

/**
 * Options for BQL execution.
 */
export interface BqlOptions {
  /** Dry run (parse only) */
  dryRun?: boolean;

  /** Maximum items */
  maxItems?: number;

  /** Verbose output */
  verbose?: boolean;

  /** Timeout (ms) */
  timeoutMs?: number;
}

/**
 * Result from BQL execution.
 */
export interface BqlResult {
  /** Execution type */
  type: 'success' | 'error' | 'partial';

  /** Message */
  message: string;

  /** Result data */
  data?: unknown[];

  /** Pipeline that was executed */
  pipeline?: string;

  /** Suggestions */
  suggestions?: string[];

  /** Execution statistics */
  stats?: BqlStats;
}

/**
 * BQL execution statistics.
 */
export interface BqlStats {
  /** Operations executed */
  operationsCount: number;

  /** Items processed */
  itemsProcessed: number;

  /** Items produced */
  itemsProduced: number;

  /** Duration (ms) */
  durationMs: number;

  /** Tokens used (if LLM operations) */
  tokensUsed?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// MCP TYPES (for tool definitions)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * MCP tool definition.
 */
export interface McpToolDefinition {
  /** Tool name */
  name: string;

  /** Tool description */
  description: string;

  /** Input schema */
  inputSchema: {
    type: 'object';
    properties: Record<string, McpPropertySchema>;
    required?: string[];
  };
}

/**
 * MCP property schema.
 */
export interface McpPropertySchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: unknown[];
  default?: unknown;
  items?: McpPropertySchema;
  properties?: Record<string, McpPropertySchema>;
  required?: string[];
}

/**
 * MCP tool result.
 */
export interface McpResult {
  content: Array<{
    type: 'text' | 'image';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}
