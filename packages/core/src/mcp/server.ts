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
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';

import type { MCPServerConfig, MCPResult, HandlerContext } from './types.js';
import { ALL_TOOLS, getToolDefinition } from './tools/definitions.js';
import { getHandler } from './handlers/index.js';
import { initializeDevelopmentAgents, shutdownDevelopmentAgents } from '../houses/codeguard/index.js';
import { getAuiSessionState, getBufferContents } from './handlers/aui.js';

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
          resources: {},
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

    // List resources handler
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const sessionState = getAuiSessionState();
      const resources: Array<{
        uri: string;
        name: string;
        description: string;
        mimeType: string;
      }> = [];

      // Add session state resource
      resources.push({
        uri: 'humanizer://aui/session',
        name: 'AUI Session State',
        description: 'Current state of the AUI session including buffers and history',
        mimeType: 'application/json',
      });

      // Add each buffer as a resource
      for (const buffer of sessionState.buffers) {
        resources.push({
          uri: `humanizer://aui/buffer/${encodeURIComponent(buffer.name)}`,
          name: `Buffer: ${buffer.name}`,
          description: `AUI buffer with ${buffer.itemCount} items`,
          mimeType: 'application/json',
        });
      }

      return { resources };
    });

    // Read resource handler
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      // Parse the URI
      if (uri === 'humanizer://aui/session') {
        const sessionState = getAuiSessionState();
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(sessionState, null, 2),
          }],
        };
      }

      if (uri.startsWith('humanizer://aui/buffer/')) {
        const bufferName = decodeURIComponent(uri.replace('humanizer://aui/buffer/', ''));
        const contents = getBufferContents(bufferName);

        if (contents === null) {
          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({ error: `Buffer "${bufferName}" not found or AUI not initialized` }),
            }],
          };
        }

        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ name: bufferName, itemCount: contents.length, items: contents }, null, 2),
          }],
        };
      }

      return {
        contents: [{
          uri,
          mimeType: 'text/plain',
          text: `Unknown resource: ${uri}`,
        }],
      };
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request, extra): Promise<CallToolResult> => {
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

      // Create handler context with progress reporting capability
      const progressToken = extra._meta?.progressToken;
      const context: HandlerContext = {
        progressToken,
        sendProgress: async (current: number, total?: number) => {
          if (progressToken !== undefined) {
            try {
              // Send progress notification using the extra.sendNotification method
              await extra.sendNotification({
                method: 'notifications/progress',
                params: {
                  progressToken,
                  progress: current,
                  total,
                },
              });
            } catch (err) {
              // Progress notification failed - log but don't fail the handler
              this.log('debug', `Progress notification failed: ${err}`);
            }
          }
        },
      };

      // Execute the handler
      try {
        const result = await handler(args || {}, context);
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
