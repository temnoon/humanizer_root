/**
 * Core tool type definitions
 */

import type { ParameterDefinition } from './parameters';
import type { ToolResult, ValidationResult } from './results';

/**
 * Tool categories based on primary function
 */
export type ToolCategory =
  | 'analysis'
  | 'transformation'
  | 'extraction'
  | 'generation'
  | 'publishing';

/**
 * User subscription tiers
 */
export type UserTier = 'free' | 'pro' | 'premium' | 'admin';

/**
 * Interface identifiers where tools can be used
 */
export type InterfaceId = 'narrative-studio' | 'post-social' | 'all';

/**
 * API backend targets
 */
export type ApiTarget = 'npe' | 'post-social' | 'local' | 'ollama';

/**
 * Input types that tools can accept
 */
export type ToolInputType = 'text' | 'selection' | 'none';

/**
 * Output types that tools can produce
 */
export type ToolOutputType = 'text' | 'analysis' | 'asset' | 'session';

/**
 * Context available to tool functions
 */
export interface ToolContext {
  interfaceId: InterfaceId;
  userTier: UserTier;
  userId?: string;
  authToken?: string;
  locale?: string;
}

/**
 * Complete tool definition
 */
export interface ToolDefinition {
  // Identity
  id: string;
  name: string;
  description: string;
  longDescription?: string;

  // Classification
  category: ToolCategory;
  tier: UserTier;
  availableIn: InterfaceId[];

  // UI
  icon: string;
  color?: string;

  // Parameters
  parameters: ParameterDefinition[];

  // Behavior
  inputType: ToolInputType;
  outputType: ToolOutputType;
  supportsStreaming?: boolean;

  // Execution
  endpoint: string;
  apiTarget: ApiTarget;

  // Optional hooks
  validateInput?: (input: string) => ValidationResult;
  formatResult?: (raw: unknown) => ToolResult;
  getDefaultParameters?: (context: ToolContext) => Record<string, unknown>;
}

/**
 * Category definition for UI
 */
export interface CategoryDefinition {
  id: ToolCategory;
  name: string;
  description: string;
  icon: string;
  order: number;
}
