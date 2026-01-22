#!/usr/bin/env node
/**
 * Humanizer MCP Server - Entry Point
 *
 * CLI entry point for the MCP server. Run with:
 *   npx humanizer-mcp
 *   node dist/mcp/index.js
 *
 * For Claude Desktop, add to ~/.claude_desktop_config.json:
 * {
 *   "mcpServers": {
 *     "humanizer": {
 *       "command": "npx",
 *       "args": ["humanizer-mcp"]
 *     }
 *   }
 * }
 */

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

export { HumanizerMCPServer, createMCPServer } from './server.js';
export type {
  MCPToolDefinition,
  MCPResult,
  MCPResultContent,
  MCPToolHandler,
  MCPServerConfig,
  ServerStatus,
  HealthCheck,
} from './types.js';
export { ALL_TOOLS, getToolDefinition, getToolsByCategory } from './tools/index.js';
export { getHandler, ALL_HANDLERS } from './handlers/index.js';

// ═══════════════════════════════════════════════════════════════════
// CLI ENTRY
// ═══════════════════════════════════════════════════════════════════

import { createMCPServer } from './server.js';

async function main(): Promise<void> {
  const server = createMCPServer({
    logLevel: process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error' || 'info',
  });

  // Handle shutdown signals
  const shutdown = async () => {
    await server.shutdown();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await server.start();
  } catch (err) {
    console.error('Failed to start MCP server:', err);
    process.exit(1);
  }
}

// Run if this is the main module
// In ESM, we check import.meta.url
const isMain = import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') || '');
if (isMain || process.argv[1]?.includes('mcp/index')) {
  main().catch(console.error);
}
