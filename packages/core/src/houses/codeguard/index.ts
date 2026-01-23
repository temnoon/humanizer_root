/**
 * Development House Agents - Barrel Export
 *
 * The Development Houses of the Council. Specialized agents for
 * code development assistance and quality assurance.
 *
 * Houses:
 * - Architect: Code architecture and design patterns
 * - Stylist: Code style and conventions
 * - Security: Security audits and vulnerability scanning
 * - Accessibility: A11y compliance and WCAG validation
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════
export * from './types.js';

// ═══════════════════════════════════════════════════════════════════
// BASE CLASS
// ═══════════════════════════════════════════════════════════════════
export { DevelopmentAgentBase, type DevelopmentAgent } from './development-agent-base.js';

// ═══════════════════════════════════════════════════════════════════
// SHARED UTILITIES
// ═══════════════════════════════════════════════════════════════════
export * from './shared/index.js';

// ═══════════════════════════════════════════════════════════════════
// ARCHITECT - Architecture & Patterns
// ═══════════════════════════════════════════════════════════════════
export {
  ArchitectAgent,
  getArchitectAgent,
  resetArchitectAgent,
  ARCHITECT_CONFIG,
} from './architect.js';

// ═══════════════════════════════════════════════════════════════════
// STYLIST - Code Style & Conventions
// ═══════════════════════════════════════════════════════════════════
export {
  StylistAgent,
  getStylistAgent,
  resetStylistAgent,
  STYLIST_CONFIG,
} from './stylist.js';

// ═══════════════════════════════════════════════════════════════════
// SECURITY - Security Audits
// ═══════════════════════════════════════════════════════════════════
export {
  SecurityAgent,
  getSecurityAgent,
  resetSecurityAgent,
  SECURITY_CONFIG,
} from './security.js';

// ═══════════════════════════════════════════════════════════════════
// ACCESSIBILITY - A11y Compliance
// ═══════════════════════════════════════════════════════════════════
export {
  AccessibilityAgent,
  getAccessibilityAgent,
  resetAccessibilityAgent,
  ACCESSIBILITY_CONFIG,
} from './accessibility.js';

// ═══════════════════════════════════════════════════════════════════
// DATA - Schema & Interface Validation
// ═══════════════════════════════════════════════════════════════════
export {
  DataAgent,
  getDataAgent,
  resetDataAgent,
  DATA_CONFIG,
  type SchemaReport,
  type SchemaIssue,
  type ZodUsageStats,
  type CompatibilityReport,
  type BreakingChange,
  type ContractReport,
  type DataFlowGraph,
} from './data.js';

// ═══════════════════════════════════════════════════════════════════
// IMPORTS FOR CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

import {
  getArchitectAgent as _getArchitectAgent,
  resetArchitectAgent as _resetArchitectAgent,
} from './architect.js';

import {
  getStylistAgent as _getStylistAgent,
  resetStylistAgent as _resetStylistAgent,
} from './stylist.js';

import {
  getSecurityAgent as _getSecurityAgent,
  resetSecurityAgent as _resetSecurityAgent,
} from './security.js';

import {
  getAccessibilityAgent as _getAccessibilityAgent,
  resetAccessibilityAgent as _resetAccessibilityAgent,
} from './accessibility.js';

import {
  getDataAgent as _getDataAgent,
  resetDataAgent as _resetDataAgent,
} from './data.js';

// ═══════════════════════════════════════════════════════════════════
// CONVENIENCE: Initialize All CodeGuard Agents
// ═══════════════════════════════════════════════════════════════════

/**
 * Initialize all CodeGuard agents
 * Call this at application startup to register all agents with the message bus
 */
export async function initializeDevelopmentAgents(): Promise<void> {
  const agents = [
    _getArchitectAgent(),
    _getStylistAgent(),
    _getSecurityAgent(),
    _getAccessibilityAgent(),
    _getDataAgent(),
  ];

  for (const agent of agents) {
    await agent.initialize();
  }
}

/**
 * Shutdown all CodeGuard agents
 * Call this at application shutdown for graceful cleanup
 */
export async function shutdownDevelopmentAgents(): Promise<void> {
  const agents = [
    _getArchitectAgent(),
    _getStylistAgent(),
    _getSecurityAgent(),
    _getAccessibilityAgent(),
    _getDataAgent(),
  ];

  for (const agent of agents) {
    await agent.shutdown();
  }
}

/**
 * Reset all CodeGuard agents (for testing)
 */
export function resetDevelopmentAgents(): void {
  _resetArchitectAgent();
  _resetStylistAgent();
  _resetSecurityAgent();
  _resetAccessibilityAgent();
  _resetDataAgent();
}

/**
 * Get all CodeGuard agents
 */
export function getDevelopmentAgents() {
  return {
    architect: _getArchitectAgent(),
    stylist: _getStylistAgent(),
    security: _getSecurityAgent(),
    accessibility: _getAccessibilityAgent(),
    data: _getDataAgent(),
  };
}

/**
 * Alias for clarity - these are CodeGuard agents for development standards
 */
export const getCodeGuardAgents = getDevelopmentAgents;
export const initializeCodeGuardAgents = initializeDevelopmentAgents;
export const shutdownCodeGuardAgents = shutdownDevelopmentAgents;
export const resetCodeGuardAgents = resetDevelopmentAgents;
