/**
 * MCP Server Types
 *
 * Type definitions for the Model Context Protocol server implementation.
 * These types complement the @modelcontextprotocol/sdk types with
 * humanizer-specific extensions.
 */

import type { CodeFile, DevelopmentHouseType } from '../houses/codeguard/types.js';

// ═══════════════════════════════════════════════════════════════════
// MCP TOOL TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * JSON Schema for tool input validation
 */
export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  enum?: string[];
  default?: unknown;
  description?: string;
  $ref?: string;
  definitions?: Record<string, JSONSchema>;
  oneOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  allOf?: JSONSchema[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

/**
 * MCP Tool definition
 */
export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  category?: 'codeguard' | 'hooks' | 'system';
}

/**
 * MCP Tool result content
 */
export interface MCPResultContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
}

/**
 * MCP Tool result
 */
export interface MCPResult {
  content: MCPResultContent[];
  isError?: boolean;
}

/**
 * Tool handler function type
 */
export type MCPToolHandler<T = unknown> = (args: T) => Promise<MCPResult>;

// ═══════════════════════════════════════════════════════════════════
// TOOL INPUT TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Common file input for tools that analyze code
 */
export interface FilesInput {
  files: CodeFile[];
}

/**
 * Review architecture input
 */
export interface ReviewArchitectureInput {
  files: CodeFile[];
  focus?: 'patterns' | 'coupling' | 'cohesion' | 'complexity' | 'scalability' | 'maintainability' | 'testability';
  depth?: 'surface' | 'deep' | 'comprehensive';
}

/**
 * Suggest patterns input
 */
export interface SuggestPatternsInput {
  context: string;
  problem: string;
  language?: string;
}

/**
 * Analyze coupling input
 */
export interface AnalyzeCouplingInput {
  files: CodeFile[];
  threshold?: number;
}

/**
 * Analyze complexity input
 */
export interface AnalyzeComplexityInput {
  files: CodeFile[];
  threshold?: number;
}

/**
 * Review code style input
 */
export interface ReviewCodeStyleInput {
  files: CodeFile[];
  strictness?: 'lenient' | 'moderate' | 'strict';
  language?: string;
}

/**
 * Validate naming input
 */
export interface ValidateNamingInput {
  files: CodeFile[];
  conventions?: string[];
}

/**
 * Check consistency input
 */
export interface CheckConsistencyInput {
  files: CodeFile[];
}

/**
 * Scan vulnerabilities input
 */
export interface ScanVulnerabilitiesInput {
  files: CodeFile[];
  scanTypes?: Array<'xss' | 'injection' | 'secrets' | 'permissions' | 'crypto' | 'dependencies' | 'authentication' | 'authorization'>;
  severity?: 'all' | 'medium+' | 'high-only' | 'critical-only';
}

/**
 * Review secrets input
 */
export interface ReviewSecretsInput {
  files: CodeFile[];
}

/**
 * Audit accessibility input
 */
export interface AuditAccessibilityInput {
  components: CodeFile[];
  standard?: 'WCAG-2.1-A' | 'WCAG-2.1-AA' | 'WCAG-2.1-AAA' | 'WCAG-2.2-A' | 'WCAG-2.2-AA' | 'WCAG-2.2-AAA';
  depth?: 'basic' | 'comprehensive' | 'certification-ready';
}

/**
 * Validate ARIA input
 */
export interface ValidateAriaInput {
  components: CodeFile[];
}

/**
 * Check contrast input
 */
export interface CheckContrastInput {
  components: CodeFile[];
  level?: 'AA' | 'AAA';
}

/**
 * Validate schemas input
 */
export interface ValidateSchemasInput {
  files: CodeFile[];
}

/**
 * Check compatibility input
 */
export interface CheckCompatibilityInput {
  files: CodeFile[];
  baselineFiles?: CodeFile[];
}

/**
 * Trace data flow input
 */
export interface TraceDataFlowInput {
  entryPoint: string;
  files: CodeFile[];
  maxDepth?: number;
}

/**
 * Trigger review input
 */
export interface TriggerReviewInput {
  files: string[];
  agents?: DevelopmentHouseType[];
}

/**
 * Get agent status input
 */
export interface GetAgentStatusInput {
  agentId: DevelopmentHouseType;
}

// ═══════════════════════════════════════════════════════════════════
// SERVER TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Server configuration
 */
export interface MCPServerConfig {
  name: string;
  version: string;
  enabledAgents?: DevelopmentHouseType[];
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Server status
 */
export interface ServerStatus {
  name: string;
  version: string;
  uptime: number;
  agents: Array<{
    id: DevelopmentHouseType;
    status: 'ready' | 'initializing' | 'error';
  }>;
  toolCount: number;
}

/**
 * Health check response
 */
export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  agents: Record<DevelopmentHouseType, boolean>;
}
