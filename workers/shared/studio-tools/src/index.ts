/**
 * @humanizer/studio-tools
 *
 * Unified tool framework for humanizer.com studio interfaces.
 *
 * Usage:
 * ```typescript
 * import {
 *   initializeTools,
 *   getTool,
 *   getFilteredTools,
 *   executeTool,
 *   setAuthToken,
 * } from '@humanizer/studio-tools';
 *
 * // Initialize with core tools
 * initializeTools();
 *
 * // Set auth token
 * setAuthToken(userToken);
 *
 * // Get tools for a specific interface and tier
 * const tools = getFilteredTools({
 *   interfaceId: 'post-social',
 *   userTier: 'pro',
 *   category: 'transformation',
 * });
 *
 * // Execute a tool
 * const tool = getTool('humanizer');
 * const result = await executeTool(tool, inputText, { intensity: 'moderate' });
 * ```
 */

// Type exports
export type {
  // Tools
  ToolDefinition,
  ToolCategory,
  UserTier,
  InterfaceId,
  ApiTarget,
  ToolInputType,
  ToolOutputType,
  ToolContext,
  CategoryDefinition,
  // Parameters
  ParameterDefinition,
  ParameterType,
  ParameterOption,
  LanguageOption,
  // Results
  ToolResult,
  ValidationResult,
  Highlight,
  AnalysisResult,
  ExtractedAsset,
  SessionState,
  ToolError,
  ResultAction,
} from './types';

// Constants
export { SUPPORTED_LANGUAGES } from './types/parameters';

// Category registry
export {
  CATEGORIES,
  getCategory,
  getCategoriesSorted,
  CATEGORY_MAP,
} from './registry/category-registry';

// Tool registry
export {
  registerTool,
  registerTools,
  getTool,
  getAllTools,
  getToolsByCategory,
  getToolsForInterface,
  getToolsForTier,
  getFilteredTools,
  isToolAvailable,
  getUnavailableReason,
  clearRegistry,
} from './registry/tool-registry';
export type { ToolFilterOptions } from './registry/tool-registry';

// Individual tool definitions
export {
  aiDetectionLiteTool,
  aiDetectionGPTZeroTool,
  humanizerTool,
  translationTool,
  roundTripTool,
  CORE_TOOLS,
} from './registry/tools';

// API client
export {
  configureApiClient,
  setAuthToken,
  clearAuthToken,
  getApiConfig,
  executeTool,
  fetchOptions,
  API_URLS,
} from './services/npe-api-client';
export type { ApiConfig, ExecuteOptions } from './services/npe-api-client';

// Initialization
import { registerTools } from './registry/tool-registry';
import { CORE_TOOLS } from './registry/tools';

/**
 * Initialize the tool registry with core tools
 *
 * Call this once at application startup before using tools.
 */
export function initializeTools(): void {
  registerTools(CORE_TOOLS);
}

/**
 * Initialize with custom tools in addition to core tools
 */
export function initializeToolsWithExtras(
  extraTools: import('./types').ToolDefinition[]
): void {
  registerTools([...CORE_TOOLS, ...extraTools]);
}
