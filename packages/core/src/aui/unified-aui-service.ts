/**
 * Unified AUI Service
 *
 * Re-exports from the modular implementation for backward compatibility.
 *
 * Implementation files:
 * - ./service/types.ts - Service-specific types
 * - ./service/session-manager.ts - In-memory session management
 * - ./service/service-core.ts - Core service methods
 * - ./service/archive-clustering.ts - Archive and clustering operations
 * - ./service/books.ts - Book creation and artifact operations
 * - ./service/persona.ts - Persona harvest and profile operations
 * - ./service/factory.ts - Factory functions and global instance
 * - ./service/index.ts - Main UnifiedAuiService class composition
 *
 * @module @humanizer/core/aui/unified-aui-service
 */

// Re-export everything from the modular implementation
export * from './service/index.js';
