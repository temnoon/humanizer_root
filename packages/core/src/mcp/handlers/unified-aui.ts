/**
 * Unified AUI MCP Handlers
 *
 * Re-exports all AUI MCP handlers from the modular implementation.
 * This file maintains backward compatibility with existing imports.
 *
 * Handler implementations are organized in:
 * - ./aui/helpers.ts - Shared utilities
 * - ./aui/session.ts - Session management
 * - ./aui/processing.ts - NL processing and agent execution
 * - ./aui/buffer.ts - Buffer lifecycle and version control
 * - ./aui/search.ts - Search operations
 * - ./aui/admin.ts - Admin config, prompts, costs, usage, tiers
 * - ./aui/archive.ts - Archive stats and embedding
 * - ./aui/clustering.ts - Cluster discovery
 * - ./aui/books.ts - Book creation
 * - ./aui/persona.ts - Persona harvest, style profiles, persona management
 *
 * @module @humanizer/core/mcp/handlers/unified-aui
 */

// Re-export everything from the modular implementation
export * from './aui/index.js';
