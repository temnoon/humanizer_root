/**
 * @humanizer/core
 *
 * Platinum Agent System - Core infrastructure for multi-agent coordination.
 *
 * This package provides:
 * - Runtime types and base classes for agents
 * - Message bus for inter-agent communication
 * - Configuration management (no hardcoded literals!)
 * - Vimalakirti boundary system (ethical guardrails)
 * - Canon (what agents know)
 * - Doctrine (how agents judge)
 * - Instruments (what agents can do)
 * - UCG (unified content graph / content pyramid)
 *
 * Core Principles:
 * 1. Intelligence is in infrastructure, not model size
 * 2. Pre/post processing handles 80%, LLM only synthesizes
 * 3. All literals (prompts, thresholds) are config-managed
 * 4. Proposal-driven semi-autonomy with user approval
 */

// ═══════════════════════════════════════════════════════════════════
// RUNTIME - Agent types and base classes
// ═══════════════════════════════════════════════════════════════════
export * from './runtime/index.js';

// ═══════════════════════════════════════════════════════════════════
// BUS - Message bus for inter-agent communication
// ═══════════════════════════════════════════════════════════════════
export * from './bus/index.js';

// ═══════════════════════════════════════════════════════════════════
// CONFIG - Configuration management (no hardcoded literals!)
// ═══════════════════════════════════════════════════════════════════
export * from './config/index.js';

// ═══════════════════════════════════════════════════════════════════
// VIMALAKIRTI - Ethical boundary system
// ═══════════════════════════════════════════════════════════════════
export * from './vimalakirti/index.js';

// ═══════════════════════════════════════════════════════════════════
// CANON - What agents know
// ═══════════════════════════════════════════════════════════════════
export * from './canon/index.js';

// ═══════════════════════════════════════════════════════════════════
// DOCTRINE - How agents judge
// ═══════════════════════════════════════════════════════════════════
export * from './doctrine/index.js';

// ═══════════════════════════════════════════════════════════════════
// INSTRUMENTS - What agents can do
// ═══════════════════════════════════════════════════════════════════
export * from './instruments/index.js';

// ═══════════════════════════════════════════════════════════════════
// STORAGE - SQLite-backed UCG storage (canonical location)
// ═══════════════════════════════════════════════════════════════════
export * from './storage/index.js';

// ═══════════════════════════════════════════════════════════════════
// UCG - Unified Content Graph / Content Pyramid types
// ═══════════════════════════════════════════════════════════════════
export * from './ucg/index.js';

// ═══════════════════════════════════════════════════════════════════
// STATE - Agent state persistence
// ═══════════════════════════════════════════════════════════════════
export * from './state/index.js';

// ═══════════════════════════════════════════════════════════════════
// TASKS - Task queue and scheduling
// ═══════════════════════════════════════════════════════════════════
export * from './tasks/index.js';

// ═══════════════════════════════════════════════════════════════════
// COUNCIL - Orchestrator and coordination
// ═══════════════════════════════════════════════════════════════════
export * from './council/index.js';

// ═══════════════════════════════════════════════════════════════════
// HOUSES - Specialized Agent Implementations
// ═══════════════════════════════════════════════════════════════════
export * from './houses/index.js';

// ═══════════════════════════════════════════════════════════════════
// HOOKS - Review Hook System
// ═══════════════════════════════════════════════════════════════════
export * from './hooks/index.js';

// ═══════════════════════════════════════════════════════════════════
// ADAPTERS - UCG Import Adapters for content sources
// ═══════════════════════════════════════════════════════════════════
export * from './adapters/index.js';

// ═══════════════════════════════════════════════════════════════════
// CHUNKING - Content chunking for embedding
// ═══════════════════════════════════════════════════════════════════
export * from './chunking/index.js';

// ═══════════════════════════════════════════════════════════════════
// RETRIEVAL - Hybrid search and quality-gated retrieval
// ═══════════════════════════════════════════════════════════════════
export * from './retrieval/index.js';

// ═══════════════════════════════════════════════════════════════════
// PYRAMID - Multi-resolution content for large documents
// ═══════════════════════════════════════════════════════════════════
export * from './pyramid/index.js';

// ═══════════════════════════════════════════════════════════════════
// CLUSTERING - Density-based clustering (HDBSCAN) for document assembly
// ═══════════════════════════════════════════════════════════════════
export * from './clustering/index.js';
