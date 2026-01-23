/**
 * Integration Module
 *
 * Wiring between agents and infrastructure services.
 *
 * This module provides adapters that connect:
 * - Harvester agent → Hybrid search + Clustering
 * - (Future) Curator agent → Quality gate + Pyramid
 * - (Future) MCP tools → All UCG services
 */

// ═══════════════════════════════════════════════════════════════════
// HARVESTER SEARCH INTEGRATION
// ═══════════════════════════════════════════════════════════════════

export {
  HarvesterSearchAdapter,
  createHarvesterSearchAdapter,
  getHarvesterSearchAdapter,
  initHarvesterSearchAdapter,
  resetHarvesterSearchAdapter,
} from './harvester-search.js';

export type {
  EmbedderFn,
  HarvesterSearchOptions,
  HarvesterSearchResult,
  DiscoveryOptions,
  DiscoveredCluster,
} from './harvester-search.js';
