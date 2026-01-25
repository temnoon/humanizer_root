/**
 * AUI MCP Handlers - Unified Export
 *
 * Re-exports all AUI MCP handlers and provides the unified handler registry.
 *
 * @module @humanizer/core/mcp/handlers/aui
 */

import type { MCPResult } from '../../types.js';
import { TOOL_NAMES } from '../../../aui/constants.js';

// Re-export helpers
export { jsonResult, errorResult, getService, withErrorHandling } from './helpers.js';

// Re-export session handlers
export {
  handleSessionCreate,
  handleSessionGet,
  handleSessionList,
  handleSessionDelete,
} from './session.js';

// Re-export processing handlers
export {
  handleProcess,
  handleAgentRun,
  handleAgentStep,
  handleAgentInterrupt,
  handleAgentStatus,
  handleAgentResume,
  handleBqlExecute,
} from './processing.js';

// Re-export buffer handlers
export {
  handleBufferCreate,
  handleBufferList,
  handleBufferGet,
  handleBufferSet,
  handleBufferAppend,
  handleBufferDelete,
  handleBufferCommit,
  handleBufferRollback,
  handleBufferHistory,
  handleBufferTag,
  handleBufferCheckout,
  handleBufferBranchCreate,
  handleBufferBranchSwitch,
  handleBufferBranchList,
  handleBufferBranchDelete,
  handleBufferMerge,
  handleBufferDiff,
} from './buffer.js';

// Re-export search handlers
export {
  handleSearch,
  handleSearchRefine,
  handleSearchAnchorAdd,
  handleSearchAnchorRemove,
  handleSearchToBuffer,
} from './search.js';

// Re-export admin handlers
export {
  handleAdminConfigGet,
  handleAdminConfigSet,
  handleAdminConfigList,
  handleAdminConfigAudit,
  handleAdminPromptList,
  handleAdminPromptGet,
  handleAdminPromptSet,
  handleAdminPromptTest,
  handleAdminCostRecord,
  handleAdminCostReport,
  handleAdminUsageGet,
  handleAdminUsageCheck,
  handleAdminUsageReport,
  handleAdminTierList,
  handleAdminTierGet,
  handleAdminTierSet,
  handleAdminUserTierGet,
  handleAdminUserTierSet,
} from './admin.js';

// Re-export archive handlers
export {
  handleArchiveStats,
  handleArchiveEmbedAll,
  handleArchiveEmbedBatch,
} from './archive.js';

// Re-export clustering handlers
export {
  handleClusterDiscover,
  handleClusterList,
  handleClusterGet,
} from './clustering.js';

// Re-export book handlers
export {
  handleBookCreateFromCluster,
  handleBookHarvest,
  handleBookGenerateArc,
  handleBookList,
  handleBookGet,
  handleBookCreateWithPersona,
} from './books.js';

// Re-export persona handlers
export {
  handlePersonaStartHarvest,
  handlePersonaAddSample,
  handlePersonaHarvestArchive,
  handlePersonaExtractTraits,
  handlePersonaFinalize,
  handlePersonaGenerateSample,
  handleStyleCreate,
  handleStyleList,
  handleStyleGet,
  handleStyleUpdate,
  handleStyleDelete,
  handlePersonaList,
  handlePersonaGet,
  handlePersonaGetDefault,
  handlePersonaSetDefault,
} from './persona.js';

// Import all handlers for registry
import {
  handleSessionCreate,
  handleSessionGet,
  handleSessionList,
  handleSessionDelete,
} from './session.js';

import {
  handleProcess,
  handleAgentRun,
  handleAgentStep,
  handleAgentInterrupt,
  handleAgentStatus,
  handleAgentResume,
  handleBqlExecute,
} from './processing.js';

import {
  handleBufferCreate,
  handleBufferList,
  handleBufferGet,
  handleBufferSet,
  handleBufferAppend,
  handleBufferDelete,
  handleBufferCommit,
  handleBufferRollback,
  handleBufferHistory,
  handleBufferTag,
  handleBufferCheckout,
  handleBufferBranchCreate,
  handleBufferBranchSwitch,
  handleBufferBranchList,
  handleBufferBranchDelete,
  handleBufferMerge,
  handleBufferDiff,
} from './buffer.js';

import {
  handleSearch,
  handleSearchRefine,
  handleSearchAnchorAdd,
  handleSearchAnchorRemove,
  handleSearchToBuffer,
} from './search.js';

import {
  handleAdminConfigGet,
  handleAdminConfigSet,
  handleAdminConfigList,
  handleAdminConfigAudit,
  handleAdminPromptList,
  handleAdminPromptGet,
  handleAdminPromptSet,
  handleAdminPromptTest,
  handleAdminCostRecord,
  handleAdminCostReport,
  handleAdminUsageGet,
  handleAdminUsageCheck,
  handleAdminUsageReport,
  handleAdminTierList,
  handleAdminTierGet,
  handleAdminTierSet,
  handleAdminUserTierGet,
  handleAdminUserTierSet,
} from './admin.js';

import {
  handleArchiveStats,
  handleArchiveEmbedAll,
  handleArchiveEmbedBatch,
} from './archive.js';

import {
  handleClusterDiscover,
  handleClusterList,
  handleClusterGet,
} from './clustering.js';

import {
  handleBookCreateFromCluster,
  handleBookHarvest,
  handleBookGenerateArc,
  handleBookList,
  handleBookGet,
  handleBookCreateWithPersona,
} from './books.js';

import {
  handlePersonaStartHarvest,
  handlePersonaAddSample,
  handlePersonaHarvestArchive,
  handlePersonaExtractTraits,
  handlePersonaFinalize,
  handlePersonaGenerateSample,
  handleStyleCreate,
  handleStyleList,
  handleStyleGet,
  handleStyleUpdate,
  handleStyleDelete,
  handlePersonaList,
  handlePersonaGet,
  handlePersonaGetDefault,
  handlePersonaSetDefault,
} from './persona.js';

// ═══════════════════════════════════════════════════════════════════════════
// HANDLER REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

type AuiHandler = (args: unknown) => Promise<MCPResult>;

export const UNIFIED_AUI_HANDLERS: Record<string, AuiHandler> = {
  // Session
  [TOOL_NAMES.SESSION_CREATE]: handleSessionCreate as AuiHandler,
  [TOOL_NAMES.SESSION_GET]: handleSessionGet as AuiHandler,
  [TOOL_NAMES.SESSION_LIST]: handleSessionList as AuiHandler,
  [TOOL_NAMES.SESSION_DELETE]: handleSessionDelete as AuiHandler,

  // Processing
  [TOOL_NAMES.PROCESS]: handleProcess as AuiHandler,
  [TOOL_NAMES.AGENT_RUN]: handleAgentRun as AuiHandler,
  [TOOL_NAMES.AGENT_STEP]: handleAgentStep as AuiHandler,
  [TOOL_NAMES.AGENT_INTERRUPT]: handleAgentInterrupt as AuiHandler,
  [TOOL_NAMES.AGENT_STATUS]: handleAgentStatus as AuiHandler,
  [TOOL_NAMES.AGENT_RESUME]: handleAgentResume as AuiHandler,
  [TOOL_NAMES.BQL_EXECUTE]: handleBqlExecute as AuiHandler,

  // Buffer lifecycle
  [TOOL_NAMES.BUFFER_CREATE]: handleBufferCreate as AuiHandler,
  [TOOL_NAMES.BUFFER_LIST]: handleBufferList as AuiHandler,
  [TOOL_NAMES.BUFFER_GET]: handleBufferGet as AuiHandler,
  [TOOL_NAMES.BUFFER_SET]: handleBufferSet as AuiHandler,
  [TOOL_NAMES.BUFFER_APPEND]: handleBufferAppend as AuiHandler,
  [TOOL_NAMES.BUFFER_DELETE]: handleBufferDelete as AuiHandler,

  // Buffer version control
  [TOOL_NAMES.BUFFER_COMMIT]: handleBufferCommit as AuiHandler,
  [TOOL_NAMES.BUFFER_ROLLBACK]: handleBufferRollback as AuiHandler,
  [TOOL_NAMES.BUFFER_HISTORY]: handleBufferHistory as AuiHandler,
  [TOOL_NAMES.BUFFER_TAG]: handleBufferTag as AuiHandler,
  [TOOL_NAMES.BUFFER_CHECKOUT]: handleBufferCheckout as AuiHandler,

  // Buffer branching
  [TOOL_NAMES.BUFFER_BRANCH_CREATE]: handleBufferBranchCreate as AuiHandler,
  [TOOL_NAMES.BUFFER_BRANCH_SWITCH]: handleBufferBranchSwitch as AuiHandler,
  [TOOL_NAMES.BUFFER_BRANCH_LIST]: handleBufferBranchList as AuiHandler,
  [TOOL_NAMES.BUFFER_BRANCH_DELETE]: handleBufferBranchDelete as AuiHandler,
  [TOOL_NAMES.BUFFER_MERGE]: handleBufferMerge as AuiHandler,
  [TOOL_NAMES.BUFFER_DIFF]: handleBufferDiff as AuiHandler,

  // Search
  [TOOL_NAMES.SEARCH]: handleSearch as AuiHandler,
  [TOOL_NAMES.SEARCH_REFINE]: handleSearchRefine as AuiHandler,
  [TOOL_NAMES.SEARCH_ANCHOR_ADD]: handleSearchAnchorAdd as AuiHandler,
  [TOOL_NAMES.SEARCH_ANCHOR_REMOVE]: handleSearchAnchorRemove as AuiHandler,
  [TOOL_NAMES.SEARCH_TO_BUFFER]: handleSearchToBuffer as AuiHandler,

  // Admin config
  [TOOL_NAMES.ADMIN_CONFIG_GET]: handleAdminConfigGet as AuiHandler,
  [TOOL_NAMES.ADMIN_CONFIG_SET]: handleAdminConfigSet as AuiHandler,
  [TOOL_NAMES.ADMIN_CONFIG_LIST]: handleAdminConfigList as AuiHandler,
  [TOOL_NAMES.ADMIN_CONFIG_AUDIT]: handleAdminConfigAudit as AuiHandler,

  // Admin prompts
  [TOOL_NAMES.ADMIN_PROMPT_LIST]: handleAdminPromptList as AuiHandler,
  [TOOL_NAMES.ADMIN_PROMPT_GET]: handleAdminPromptGet as AuiHandler,
  [TOOL_NAMES.ADMIN_PROMPT_SET]: handleAdminPromptSet as AuiHandler,
  [TOOL_NAMES.ADMIN_PROMPT_TEST]: handleAdminPromptTest as AuiHandler,

  // Admin costs & usage
  [TOOL_NAMES.ADMIN_COST_RECORD]: handleAdminCostRecord as AuiHandler,
  [TOOL_NAMES.ADMIN_COST_REPORT]: handleAdminCostReport as AuiHandler,
  [TOOL_NAMES.ADMIN_USAGE_GET]: handleAdminUsageGet as AuiHandler,
  [TOOL_NAMES.ADMIN_USAGE_CHECK]: handleAdminUsageCheck as AuiHandler,
  [TOOL_NAMES.ADMIN_USAGE_REPORT]: handleAdminUsageReport as AuiHandler,

  // Admin tiers
  [TOOL_NAMES.ADMIN_TIER_LIST]: handleAdminTierList as AuiHandler,
  [TOOL_NAMES.ADMIN_TIER_GET]: handleAdminTierGet as AuiHandler,
  [TOOL_NAMES.ADMIN_TIER_SET]: handleAdminTierSet as AuiHandler,
  [TOOL_NAMES.ADMIN_USER_TIER_GET]: handleAdminUserTierGet as AuiHandler,
  [TOOL_NAMES.ADMIN_USER_TIER_SET]: handleAdminUserTierSet as AuiHandler,

  // Archive & embedding
  [TOOL_NAMES.ARCHIVE_STATS]: handleArchiveStats as AuiHandler,
  [TOOL_NAMES.ARCHIVE_EMBED_ALL]: handleArchiveEmbedAll as AuiHandler,
  [TOOL_NAMES.ARCHIVE_EMBED_BATCH]: handleArchiveEmbedBatch as AuiHandler,

  // Clustering
  [TOOL_NAMES.CLUSTER_DISCOVER]: handleClusterDiscover as AuiHandler,
  [TOOL_NAMES.CLUSTER_LIST]: handleClusterList as AuiHandler,
  [TOOL_NAMES.CLUSTER_GET]: handleClusterGet as AuiHandler,

  // Book creation
  [TOOL_NAMES.BOOK_CREATE_FROM_CLUSTER]: handleBookCreateFromCluster as AuiHandler,
  [TOOL_NAMES.BOOK_HARVEST]: handleBookHarvest as AuiHandler,
  [TOOL_NAMES.BOOK_GENERATE_ARC]: handleBookGenerateArc as AuiHandler,
  [TOOL_NAMES.BOOK_LIST]: handleBookList as AuiHandler,
  [TOOL_NAMES.BOOK_GET]: handleBookGet as AuiHandler,
  'book_create_with_persona': handleBookCreateWithPersona as AuiHandler,

  // Persona harvest
  'persona_start_harvest': handlePersonaStartHarvest as AuiHandler,
  'persona_add_sample': handlePersonaAddSample as AuiHandler,
  'persona_harvest_archive': handlePersonaHarvestArchive as AuiHandler,
  'persona_extract_traits': handlePersonaExtractTraits as AuiHandler,
  'persona_generate_sample': handlePersonaGenerateSample as AuiHandler,
  'persona_finalize': handlePersonaFinalize as AuiHandler,
  'persona_list': handlePersonaList as AuiHandler,
  'persona_get': handlePersonaGet as AuiHandler,
  'persona_get_default': handlePersonaGetDefault as AuiHandler,
  'persona_set_default': handlePersonaSetDefault as AuiHandler,

  // Style profiles
  'style_create': handleStyleCreate as AuiHandler,
  'style_list': handleStyleList as AuiHandler,
  'style_get': handleStyleGet as AuiHandler,
  'style_update': handleStyleUpdate as AuiHandler,
  'style_delete': handleStyleDelete as AuiHandler,
};
