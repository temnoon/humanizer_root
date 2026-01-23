/**
 * Humanizer MCP Server
 *
 * Main MCP server implementation that exposes CodeGuard agent capabilities
 * to MCP-compatible clients like Claude Desktop.
 *
 * Features:
 * - 21 tools across 5 agent categories
 * - Stdio transport for CLI integration
 * - Graceful agent lifecycle management
 * - JSON-RPC 2.0 compliant
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';

import type { MCPServerConfig, MCPResult } from './types.js';
import { ALL_TOOLS, getToolDefinition } from './tools/definitions.js';
import { getHandler } from './handlers/index.js';
import { initializeDevelopmentAgents, shutdownDevelopmentAgents } from '../houses/codeguard/index.js';

// ═══════════════════════════════════════════════════════════════════
// MCP SERVER CLASS
// ═══════════════════════════════════════════════════════════════════

export class HumanizerMCPServer {
  private server: Server;
  private config: MCPServerConfig;
  private initialized = false;
  private startTime = Date.now();

  constructor(config: Partial<MCPServerConfig> = {}) {
    this.config = {
      name: config.name || 'humanizer-platinum',
      version: config.version || '1.0.0',
      enabledAgents: config.enabledAgents || ['architect', 'stylist', 'security', 'accessibility', 'data'],
      logLevel: config.logLevel || 'info',
    };

    this.server = new Server(
      {
        name: this.config.name,
        version: this.config.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  // ─────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────

  /**
   * Initialize the server and all agents
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.log('info', 'Initializing Humanizer MCP Server...');

    // Initialize all CodeGuard agents
    await initializeDevelopmentAgents();

    this.initialized = true;
    this.log('info', `Server initialized with ${ALL_TOOLS.length} tools`);
  }

  /**
   * Start the server with stdio transport
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    this.log('info', 'Starting MCP server...');
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    this.log('info', 'MCP server running on stdio');
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.log('info', 'Shutting down MCP server...');
    
    await shutdownDevelopmentAgents();
    await this.server.close();
    
    this.log('info', 'Server shutdown complete');
  }

  // ─────────────────────────────────────────────────────────────────
  // HANDLER SETUP
  // ─────────────────────────────────────────────────────────────────

  private setupHandlers(): void {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = ALL_TOOLS.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));

      return { tools };
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
      const { name, arguments: args } = request.params;

      this.log('debug', `Tool call: ${name}`, args);

      // Find the handler
      const handler = getHandler(name);
      if (!handler) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
          isError: true,
        };
      }

      // Execute the handler
      try {
        const result = await handler(args || {});
        // Convert our MCPResult to CallToolResult format
        return {
          content: result.content.map(c => ({
            type: 'text' as const,
            text: c.text || '',
          })),
          isError: result.isError,
        };
      } catch (err) {
        this.log('error', `Tool ${name} failed`, err);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
            }),
          }],
          isError: true,
        };
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────────────────────────

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown): void {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const configLevel = levels[this.config.logLevel || 'info'];
    const messageLevel = levels[level];

    if (messageLevel >= configLevel) {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
      
      // Use stderr for logging to avoid interfering with stdio transport
      if (data) {
        console.error(prefix, message, data);
      } else {
        console.error(prefix, message);
      }
    }
  }

  /**
   * Get server uptime in milliseconds
   */
  getUptime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Get server info
   */
  getInfo(): { name: string; version: string; uptime: number; toolCount: number } {
    return {
      name: this.config.name,
      version: this.config.version,
      uptime: this.getUptime(),
      toolCount: ALL_TOOLS.length,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════

/**
 * Create and return a new MCP server instance
 */
export function createMCPServer(config?: Partial<MCPServerConfig>): HumanizerMCPServer {
  return new HumanizerMCPServer(config);
}
