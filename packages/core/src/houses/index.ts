/**
 * House Agents - Barrel Export
 *
 * The Houses of the Council. Each house has specialized responsibilities
 * and capabilities for advancing Book and Node projects.
 *
 * Book-Making Houses:
 * - Model Master: AI model routing and control
 * - Harvester: Archive search and extraction
 * - Curator: Content quality assessment
 * - Builder: Chapter composition
 * - Reviewer: Quality checks and signoffs
 * - Project Manager: Project lifecycle coordination
 * - Explorer: Format discovery and import intelligence
 *
 * Development Houses:
 * - Architect: Code architecture and design patterns
 * - Stylist: Code style and conventions
 * - Security: Security audits and vulnerability scanning
 * - Accessibility: A11y compliance and WCAG validation
 */

// ═══════════════════════════════════════════════════════════════════
// IMPORTS FOR LOCAL USE
// ═══════════════════════════════════════════════════════════════════

import {
  getModelMasterAgent as _getModelMasterAgent,
  resetModelMasterAgent as _resetModelMasterAgent,
} from './model-master.js';

import {
  getHarvesterAgent as _getHarvesterAgent,
  resetHarvesterAgent as _resetHarvesterAgent,
} from './harvester.js';

import {
  getCuratorAgent as _getCuratorAgent,
  resetCuratorAgent as _resetCuratorAgent,
} from './curator.js';

import {
  getReviewerAgent as _getReviewerAgent,
  resetReviewerAgent as _resetReviewerAgent,
} from './reviewer.js';

import {
  getBuilderAgent as _getBuilderAgent,
  resetBuilderAgent as _resetBuilderAgent,
} from './builder.js';

import {
  getProjectManagerAgent as _getProjectManagerAgent,
  resetProjectManagerAgent as _resetProjectManagerAgent,
} from './project-manager.js';

import {
  getExplorerAgent as _getExplorerAgent,
  resetExplorerAgent as _resetExplorerAgent,
} from './explorer.js';

// ═══════════════════════════════════════════════════════════════════
// MODEL MASTER - AI Routing
// ═══════════════════════════════════════════════════════════════════
export {
  ModelMasterAgent,
  getModelMasterAgent,
  resetModelMasterAgent,
  MODEL_MASTER_CONFIG,
  type AIRequest,
  type AIResponse,
  type RouterDecision,
  type BudgetStatus,
  type ModelInfo,
  /** @deprecated Use ModelInfo instead */
  type ModelClass,
} from './model-master.js';

// Re-export LLM provider infrastructure
export {
  getProviderManager,
  initializeProviders,
  resetProviderManager,
  type ProviderConfig,
  type LlmProvider,
  type LlmRequest,
  type LlmResponse,
  ProviderError,
  ProviderUnavailableError,
} from '../llm-providers/index.js';

// ═══════════════════════════════════════════════════════════════════
// HARVESTER - Archive Search
// ═══════════════════════════════════════════════════════════════════
export {
  HarvesterAgent,
  getHarvesterAgent,
  resetHarvesterAgent,
  HARVESTER_CONFIG,
  type HarvestResult,
  type HarvestQuery,
  type DiscoveryResult,
  type HarvesterIntention,
} from './harvester.js';

// ═══════════════════════════════════════════════════════════════════
// CURATOR - Quality Assessment
// ═══════════════════════════════════════════════════════════════════
export {
  CuratorAgent,
  getCuratorAgent,
  resetCuratorAgent,
  CURATOR_CONFIG,
  type PassageAssessment,
  type ThreadCoherence,
  type SemanticCluster,
  type CuratorIntention,
  type RedundancyReport,
  type CardAssignmentProposal,
  type AssignmentProposalBatch,
} from './curator.js';

// ═══════════════════════════════════════════════════════════════════
// REVIEWER - Quality Checks & Signoffs
// ═══════════════════════════════════════════════════════════════════
export {
  ReviewerAgent,
  getReviewerAgent,
  resetReviewerAgent,
  REVIEWER_CONFIG,
  type ChapterReview,
  type ReviewIssue,
  type StyleCheck,
  type HumanizationCheck,
  type CitationCheck,
  type ReviewerIntention,
  type FactVerification,
  type SignoffDecision,
} from './reviewer.js';

// ═══════════════════════════════════════════════════════════════════
// BUILDER - Chapter Composition
// ═══════════════════════════════════════════════════════════════════
export {
  BuilderAgent,
  getBuilderAgent,
  resetBuilderAgent,
  BUILDER_CONFIG,
  type ChapterDraft,
  type ChapterStructure,
  type StyleAnalysis,
  type CompositionPlan,
  type PassageForComposition,
  type BuilderIntention,
  type ChapterOutline,
  type TransitionResult,
  type StructureAnalysis,
  type ImprovementSuggestion,
} from './builder.js';

// ═══════════════════════════════════════════════════════════════════
// PROJECT MANAGER - Lifecycle Coordination
// ═══════════════════════════════════════════════════════════════════
export {
  ProjectManagerAgent,
  getProjectManagerAgent,
  resetProjectManagerAgent,
  PROJECT_MANAGER_CONFIG,
  type ProjectStatus,
  type PhaseRequirements,
  type AssignWorkRequest,
  type PhaseAdvanceResult,
  type ProjectManagerIntention,
} from './project-manager.js';

// ═══════════════════════════════════════════════════════════════════
// EXPLORER - Format Discovery
// ═══════════════════════════════════════════════════════════════════
export {
  ExplorerAgent,
  getExplorerAgent,
  resetExplorerAgent,
  EXPLORER_CONFIG,
  type StructureInsight,
  type DetectedPattern,
  type FormatHypothesis,
  type ProbeSample,
  type UserQuery,
  type LearnedFormat,
  type DiscoverySession,
  type KnownFormatSignature,
} from './explorer.js';

// ═══════════════════════════════════════════════════════════════════
// CODEGUARD HOUSES (Development Standards Enforcement)
// ═══════════════════════════════════════════════════════════════════
export * from './codeguard/index.js';

// Import for convenience functions
import {
  initializeDevelopmentAgents as _initializeDevelopmentAgents,
  shutdownDevelopmentAgents as _shutdownDevelopmentAgents,
  resetDevelopmentAgents as _resetDevelopmentAgents,
} from './codeguard/index.js';

// ═══════════════════════════════════════════════════════════════════
// CONVENIENCE: Initialize All Agents
// ═══════════════════════════════════════════════════════════════════

/**
 * Initialize all house agents (book-making only)
 * Call this at application startup to register all agents with the message bus
 */
export async function initializeAllHouseAgents(): Promise<void> {
  const agents = [
    _getModelMasterAgent(),
    _getHarvesterAgent(),
    _getCuratorAgent(),
    _getReviewerAgent(),
    _getBuilderAgent(),
    _getProjectManagerAgent(),
    _getExplorerAgent(),
  ];

  for (const agent of agents) {
    await agent.initialize();
  }
}

/**
 * Initialize all agents (book-making + development)
 */
export async function initializeAllAgents(): Promise<void> {
  await initializeAllHouseAgents();
  await _initializeDevelopmentAgents();
}

/**
 * Shutdown all house agents (book-making only)
 * Call this at application shutdown for graceful cleanup
 */
export async function shutdownAllHouseAgents(): Promise<void> {
  const agents = [
    _getModelMasterAgent(),
    _getHarvesterAgent(),
    _getCuratorAgent(),
    _getReviewerAgent(),
    _getBuilderAgent(),
    _getProjectManagerAgent(),
    _getExplorerAgent(),
  ];

  for (const agent of agents) {
    await agent.shutdown();
  }
}

/**
 * Shutdown all agents (book-making + development)
 */
export async function shutdownAllAgents(): Promise<void> {
  await shutdownAllHouseAgents();
  await _shutdownDevelopmentAgents();
}

/**
 * Reset all house agents (for testing)
 */
export function resetAllHouseAgents(): void {
  _resetModelMasterAgent();
  _resetHarvesterAgent();
  _resetCuratorAgent();
  _resetReviewerAgent();
  _resetBuilderAgent();
  _resetProjectManagerAgent();
  _resetExplorerAgent();
}

/**
 * Reset all agents (for testing)
 */
export function resetAllAgents(): void {
  resetAllHouseAgents();
  _resetDevelopmentAgents();
}
