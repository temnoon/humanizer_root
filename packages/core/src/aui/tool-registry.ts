/**
 * Tool Registry - Unified Tool Management
 *
 * Manages tool registration, discovery, and execution for the agentic loop.
 * Integrates with drafting, media, search, and book subsystems.
 *
 * @module @humanizer/core/aui/tool-registry
 */

import type { ToolDefinition, ToolResult } from './types.js';
import type { BufferManager } from './buffer-manager.js';
import type { DraftingMethods } from './service/drafting.js';
import type { BookMethods, ArtifactMethods } from './service/books.js';
import type { ClusteringMethods, ArchiveMethods } from './service/archive-clustering.js';
import type { TranscriptionMethods } from './service/transcription.js';
import { ALL_TOOL_DEFINITIONS, isDestructiveTool } from './tool-definitions.js';
import { createDraftingToolHandlers } from './tools/drafting-tools.js';
import { createSearchToolHandlers } from './tools/search-tools.js';
import { createMediaToolHandlers } from './tools/media-tools.js';
import { createBookToolHandlers } from './tools/book-tools.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tool handler function type
 */
export type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>;

/**
 * Tool registration with definition and handler
 */
export interface ToolRegistration {
  definition: ToolDefinition;
  handler: ToolHandler;
  category: 'buffer' | 'drafting' | 'search' | 'media' | 'books' | 'custom';
}

/**
 * Dependencies for the tool registry
 */
export interface ToolRegistryDependencies {
  bufferManager: BufferManager;
  draftingMethods?: DraftingMethods;
  bookMethods?: BookMethods;
  artifactMethods?: ArtifactMethods;
  clusteringMethods?: ClusteringMethods;
  archiveMethods?: ArchiveMethods;
  transcriptionMethods?: TranscriptionMethods;
  bqlExecutor?: (pipeline: string) => Promise<{ data?: unknown; error?: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// TOOL REGISTRY CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ToolRegistry manages all available tools for the agentic loop.
 * Auto-discovers and registers tools from subsystems.
 */
export class ToolRegistry {
  private tools = new Map<string, ToolRegistration>();
  private deps: ToolRegistryDependencies;

  constructor(deps: ToolRegistryDependencies) {
    this.deps = deps;
    this.registerBuiltinTools();
    this.registerSubsystemTools();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REGISTRATION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Register a single tool
   */
  register(registration: ToolRegistration): void {
    this.tools.set(registration.definition.name, registration);
  }

  /**
   * Register multiple tools
   */
  registerMany(registrations: ToolRegistration[]): void {
    for (const reg of registrations) {
      this.register(reg);
    }
  }

  /**
   * Register a custom tool handler
   */
  registerCustom(
    name: string,
    handler: ToolHandler,
    definition?: Partial<ToolDefinition>
  ): void {
    const existingDef = ALL_TOOL_DEFINITIONS.find(d => d.name === name);
    this.register({
      definition: {
        name,
        description: definition?.description ?? existingDef?.description ?? `Custom tool: ${name}`,
        parameters: definition?.parameters ?? existingDef?.parameters ?? {},
        required: definition?.required ?? existingDef?.required,
        isDestructive: definition?.isDestructive ?? existingDef?.isDestructive,
      },
      handler,
      category: 'custom',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DISCOVERY
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * List all tool definitions
   */
  listTools(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(r => r.definition);
  }

  /**
   * Get a specific tool definition
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name)?.definition;
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: ToolRegistration['category']): ToolDefinition[] {
    return Array.from(this.tools.values())
      .filter(r => r.category === category)
      .map(r => r.definition);
  }

  /**
   * Check if a tool exists
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Check if a tool is destructive
   */
  isDestructive(name: string): boolean {
    const tool = this.tools.get(name);
    return tool?.definition.isDestructive ?? isDestructiveTool(name);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EXECUTION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Execute a tool by name
   */
  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const startTime = Date.now();

    const registration = this.tools.get(name);
    if (!registration) {
      return {
        success: false,
        error: `Unknown tool: ${name}`,
        durationMs: Date.now() - startTime,
      };
    }

    try {
      const result = await registration.handler(args);
      return {
        ...result,
        durationMs: result.durationMs ?? Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute a BQL pipeline
   */
  async executeBql(pipeline: string): Promise<ToolResult> {
    const startTime = Date.now();

    if (!this.deps.bqlExecutor) {
      return {
        success: false,
        error: 'BQL executor not configured',
        durationMs: Date.now() - startTime,
      };
    }

    try {
      const result = await this.deps.bqlExecutor(pipeline);
      if (result.error) {
        return {
          success: false,
          error: result.error,
          durationMs: Date.now() - startTime,
        };
      }
      return {
        success: true,
        data: result.data,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: BUILTIN BUFFER TOOLS
  // ─────────────────────────────────────────────────────────────────────────

  private registerBuiltinTools(): void {
    const { bufferManager } = this.deps;

    // Buffer tools
    this.register({
      definition: {
        name: 'buffer_list',
        description: 'List all versioned buffers',
        parameters: {},
      },
      handler: async () => {
        const buffers = bufferManager.listBuffers().map(b => ({
          name: b.name,
          itemCount: b.workingContent.length,
          branch: b.currentBranch,
          isDirty: b.isDirty,
        }));
        return { success: true, data: buffers };
      },
      category: 'buffer',
    });

    this.register({
      definition: {
        name: 'buffer_get',
        description: 'Get content from a buffer',
        parameters: {
          name: { type: 'string', description: 'Buffer name' },
          limit: { type: 'number', description: 'Max items to return' },
        },
        required: ['name'],
      },
      handler: async (args) => {
        const buffer = bufferManager.getBuffer(args.name as string);
        if (!buffer) {
          return { success: false, error: `Buffer "${args.name}" not found` };
        }
        const limit = (args.limit as number) ?? 100;
        const content = buffer.workingContent.slice(0, limit);
        return {
          success: true,
          data: { name: buffer.name, content, total: buffer.workingContent.length },
        };
      },
      category: 'buffer',
    });

    this.register({
      definition: {
        name: 'buffer_create',
        description: 'Create a new versioned buffer',
        parameters: {
          name: { type: 'string', description: 'Buffer name' },
          content: { type: 'array', description: 'Initial content' },
        },
        required: ['name'],
      },
      handler: async (args) => {
        const content = (args.content as unknown[]) ?? [];
        const buffer = bufferManager.createBuffer(args.name as string, content);
        return { success: true, data: { name: buffer.name, id: buffer.id } };
      },
      category: 'buffer',
    });

    this.register({
      definition: {
        name: 'buffer_commit',
        description: 'Commit changes to buffer',
        parameters: {
          name: { type: 'string', description: 'Buffer name' },
          message: { type: 'string', description: 'Commit message' },
        },
        required: ['name', 'message'],
      },
      handler: async (args) => {
        const version = bufferManager.commit(args.name as string, args.message as string);
        return { success: true, data: { versionId: version.id, message: version.message } };
      },
      category: 'buffer',
    });

    this.register({
      definition: {
        name: 'buffer_history',
        description: 'Get version history of a buffer',
        parameters: {
          name: { type: 'string', description: 'Buffer name' },
          limit: { type: 'number', description: 'Max versions to return' },
        },
        required: ['name'],
      },
      handler: async (args) => {
        const limit = (args.limit as number) ?? 10;
        const history = bufferManager.getHistory(args.name as string, limit);
        return {
          success: true,
          data: history.map(v => ({ id: v.id, message: v.message, timestamp: v.timestamp })),
        };
      },
      category: 'buffer',
    });

    this.register({
      definition: {
        name: 'buffer_branch_create',
        description: 'Create a new branch',
        parameters: {
          bufferName: { type: 'string', description: 'Buffer name' },
          branchName: { type: 'string', description: 'New branch name' },
        },
        required: ['bufferName', 'branchName'],
      },
      handler: async (args) => {
        const branch = bufferManager.createBranch(
          args.bufferName as string,
          args.branchName as string
        );
        return { success: true, data: { branch: branch.name } };
      },
      category: 'buffer',
    });

    this.register({
      definition: {
        name: 'buffer_branch_switch',
        description: 'Switch to a different branch',
        parameters: {
          bufferName: { type: 'string', description: 'Buffer name' },
          branchName: { type: 'string', description: 'Branch to switch to' },
        },
        required: ['bufferName', 'branchName'],
      },
      handler: async (args) => {
        bufferManager.switchBranch(args.bufferName as string, args.branchName as string);
        return { success: true, data: { branch: args.branchName } };
      },
      category: 'buffer',
    });

    this.register({
      definition: {
        name: 'bql',
        description: 'Execute a BQL pipeline (harvest, transform, save)',
        parameters: {
          pipeline: { type: 'string', description: 'BQL pipeline to execute' },
        },
        required: ['pipeline'],
      },
      handler: async (args) => {
        return this.executeBql(args.pipeline as string);
      },
      category: 'buffer',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: SUBSYSTEM TOOLS
  // ─────────────────────────────────────────────────────────────────────────

  private registerSubsystemTools(): void {
    // Drafting tools
    if (this.deps.draftingMethods) {
      const handlers = createDraftingToolHandlers(this.deps.draftingMethods);
      this.registerMany(handlers);
    }

    // Search/clustering tools
    if (this.deps.clusteringMethods || this.deps.archiveMethods) {
      const handlers = createSearchToolHandlers(
        this.deps.clusteringMethods,
        this.deps.archiveMethods
      );
      this.registerMany(handlers);
    }

    // Media/transcription tools
    if (this.deps.transcriptionMethods) {
      const handlers = createMediaToolHandlers(this.deps.transcriptionMethods);
      this.registerMany(handlers);
    }

    // Book tools
    if (this.deps.bookMethods) {
      const handlers = createBookToolHandlers(
        this.deps.bookMethods,
        this.deps.artifactMethods
      );
      this.registerMany(handlers);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON & FACTORY
// ═══════════════════════════════════════════════════════════════════════════

let _toolRegistry: ToolRegistry | null = null;

/**
 * Initialize the global tool registry
 */
export function initToolRegistry(deps: ToolRegistryDependencies): ToolRegistry {
  _toolRegistry = new ToolRegistry(deps);
  return _toolRegistry;
}

/**
 * Get the global tool registry
 */
export function getToolRegistry(): ToolRegistry | null {
  return _toolRegistry;
}

/**
 * Reset the global tool registry
 */
export function resetToolRegistry(): void {
  _toolRegistry = null;
}

/**
 * Create a ToolExecutor from the registry for use with AgenticLoop
 */
export function createToolExecutorFromRegistry(registry: ToolRegistry) {
  return {
    listTools: () => registry.listTools(),
    getTool: (name: string) => registry.getTool(name),
    execute: (name: string, args: Record<string, unknown>) => registry.execute(name, args),
    executeBql: (pipeline: string) => registry.executeBql(pipeline),
  };
}
