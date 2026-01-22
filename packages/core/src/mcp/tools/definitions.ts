/**
 * MCP Tool Definitions
 *
 * Complete catalog of tools exposed by the humanizer MCP server.
 * Organized by category: CodeGuard, Hooks, and System tools.
 */

import type { MCPToolDefinition, JSONSchema } from '../types.js';

// ═══════════════════════════════════════════════════════════════════
// SHARED SCHEMAS
// ═══════════════════════════════════════════════════════════════════

const CodeFileSchema: JSONSchema = {
  type: 'object',
  properties: {
    path: { type: 'string', description: 'File path' },
    content: { type: 'string', description: 'File content' },
    language: { type: 'string', description: 'Programming language (optional)' },
  },
  required: ['path', 'content'],
};

const FilesArraySchema: JSONSchema = {
  type: 'array',
  items: CodeFileSchema,
  description: 'Array of code files to analyze',
};

const ReviewDepthSchema: JSONSchema = {
  type: 'string',
  enum: ['surface', 'deep', 'comprehensive'],
  default: 'deep',
  description: 'How deeply to analyze the code',
};

const StrictnessSchema: JSONSchema = {
  type: 'string',
  enum: ['lenient', 'moderate', 'strict'],
  default: 'moderate',
  description: 'How strictly to enforce rules',
};

const SeverityFilterSchema: JSONSchema = {
  type: 'string',
  enum: ['all', 'medium+', 'high-only', 'critical-only'],
  default: 'all',
  description: 'Filter results by severity',
};

const WCAGStandardSchema: JSONSchema = {
  type: 'string',
  enum: ['WCAG-2.1-A', 'WCAG-2.1-AA', 'WCAG-2.1-AAA', 'WCAG-2.2-A', 'WCAG-2.2-AA', 'WCAG-2.2-AAA'],
  default: 'WCAG-2.1-AA',
  description: 'WCAG standard to check against',
};

const AgentIdSchema: JSONSchema = {
  type: 'string',
  enum: ['architect', 'stylist', 'security', 'accessibility', 'data'],
  description: 'CodeGuard agent identifier',
};

// ═══════════════════════════════════════════════════════════════════
// ARCHITECT TOOLS
// ═══════════════════════════════════════════════════════════════════

export const ARCHITECT_TOOLS: MCPToolDefinition[] = [
  {
    name: 'review_architecture',
    description: 'Analyze codebase architecture: detect patterns, measure coupling, assess design quality',
    category: 'codeguard',
    inputSchema: {
      type: 'object',
      properties: {
        files: FilesArraySchema,
        focus: {
          type: 'string',
          enum: ['patterns', 'coupling', 'cohesion', 'complexity', 'scalability', 'maintainability', 'testability'],
          default: 'patterns',
          description: 'Primary focus area for the review',
        },
        depth: ReviewDepthSchema,
      },
      required: ['files'],
    },
  },
  {
    name: 'suggest_patterns',
    description: 'Recommend design patterns based on problem context',
    category: 'codeguard',
    inputSchema: {
      type: 'object',
      properties: {
        context: { type: 'string', description: 'Description of the current code context' },
        problem: { type: 'string', description: 'The problem you are trying to solve' },
        language: { type: 'string', description: 'Target programming language' },
      },
      required: ['context', 'problem'],
    },
  },
  {
    name: 'detect_anti_patterns',
    description: 'Find architectural anti-patterns and code smells',
    category: 'codeguard',
    inputSchema: {
      type: 'object',
      properties: {
        files: FilesArraySchema,
      },
      required: ['files'],
    },
  },
  {
    name: 'analyze_coupling',
    description: 'Measure module coupling and identify circular dependencies',
    category: 'codeguard',
    inputSchema: {
      type: 'object',
      properties: {
        files: FilesArraySchema,
        threshold: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          default: 70,
          description: 'Coupling score threshold (0-100, higher = more acceptable coupling)',
        },
      },
      required: ['files'],
    },
  },
  {
    name: 'analyze_complexity',
    description: 'Calculate cyclomatic complexity and cognitive complexity metrics',
    category: 'codeguard',
    inputSchema: {
      type: 'object',
      properties: {
        files: FilesArraySchema,
        threshold: {
          type: 'number',
          minimum: 1,
          default: 10,
          description: 'Complexity threshold to flag as high complexity',
        },
      },
      required: ['files'],
    },
  },
  {
    name: 'validate_structure',
    description: 'Validate codebase structure against architectural constraints (dependency rules, layer architecture)',
    category: 'codeguard',
    inputSchema: {
      type: 'object',
      properties: {
        files: FilesArraySchema,
        constraints: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['dependency', 'layer', 'module', 'pattern'],
                description: 'Type of constraint',
              },
              rule: {
                type: 'string',
                description: 'Constraint rule (e.g., "ui cannot import from server" or "presentation -> business -> data")',
              },
            },
            required: ['type', 'rule'],
          },
          description: 'Architectural constraints to validate',
        },
      },
      required: ['files', 'constraints'],
    },
  },
  {
    name: 'plan_refactoring',
    description: 'Create a refactoring plan based on code analysis, with effort estimates and suggested order',
    category: 'codeguard',
    inputSchema: {
      type: 'object',
      properties: {
        files: FilesArraySchema,
        targetPattern: {
          type: 'string',
          description: 'Optional target design pattern to introduce',
        },
        goals: {
          type: 'array',
          items: { type: 'string' },
          description: 'Refactoring goals (e.g., "reduce complexity", "improve testability")',
        },
      },
      required: ['files'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// STYLIST TOOLS
// ═══════════════════════════════════════════════════════════════════

export const STYLIST_TOOLS: MCPToolDefinition[] = [
  {
    name: 'review_code_style',
    description: 'Check code style, formatting, and convention adherence',
    category: 'codeguard',
    inputSchema: {
      type: 'object',
      properties: {
        files: FilesArraySchema,
        strictness: StrictnessSchema,
        language: { type: 'string', description: 'Programming language for language-specific rules' },
      },
      required: ['files'],
    },
  },
  {
    name: 'validate_naming',
    description: 'Check naming conventions for variables, functions, classes, and files',
    category: 'codeguard',
    inputSchema: {
      type: 'object',
      properties: {
        files: FilesArraySchema,
        conventions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific naming conventions to check (e.g., "camelCase", "PascalCase")',
        },
      },
      required: ['files'],
    },
  },
  {
    name: 'check_consistency',
    description: 'Find style inconsistencies across the codebase',
    category: 'codeguard',
    inputSchema: {
      type: 'object',
      properties: {
        files: FilesArraySchema,
      },
      required: ['files'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// SECURITY TOOLS
// ═══════════════════════════════════════════════════════════════════

export const SECURITY_TOOLS: MCPToolDefinition[] = [
  {
    name: 'scan_vulnerabilities',
    description: 'Scan code for security vulnerabilities (XSS, injection, etc.)',
    category: 'codeguard',
    inputSchema: {
      type: 'object',
      properties: {
        files: FilesArraySchema,
        scanTypes: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['xss', 'injection', 'secrets', 'permissions', 'crypto', 'dependencies', 'authentication', 'authorization'],
          },
          description: 'Types of vulnerabilities to scan for (default: all)',
        },
        severity: SeverityFilterSchema,
      },
      required: ['files'],
    },
  },
  {
    name: 'review_secrets',
    description: 'Check for exposed secrets, API keys, and credentials',
    category: 'codeguard',
    inputSchema: {
      type: 'object',
      properties: {
        files: FilesArraySchema,
        includeEnvFiles: {
          type: 'boolean',
          default: false,
          description: 'Include .env.example files in the scan',
        },
      },
      required: ['files'],
    },
  },
  {
    name: 'audit_crypto',
    description: 'Audit cryptographic implementations for weaknesses',
    category: 'codeguard',
    inputSchema: {
      type: 'object',
      properties: {
        files: FilesArraySchema,
      },
      required: ['files'],
    },
  },
  {
    name: 'audit_permissions',
    description: 'Audit permission models and access control patterns',
    category: 'codeguard',
    inputSchema: {
      type: 'object',
      properties: {
        files: FilesArraySchema,
      },
      required: ['files'],
    },
  },
  {
    name: 'review_auth',
    description: 'Review authentication implementation for security issues (rate limiting, session config, password policies)',
    category: 'codeguard',
    inputSchema: {
      type: 'object',
      properties: {
        files: FilesArraySchema,
      },
      required: ['files'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// ACCESSIBILITY TOOLS
// ═══════════════════════════════════════════════════════════════════

export const ACCESSIBILITY_TOOLS: MCPToolDefinition[] = [
  {
    name: 'audit_accessibility',
    description: 'WCAG compliance audit for UI components',
    category: 'codeguard',
    inputSchema: {
      type: 'object',
      properties: {
        components: FilesArraySchema,
        standard: WCAGStandardSchema,
        depth: {
          type: 'string',
          enum: ['basic', 'comprehensive', 'certification-ready'],
          default: 'comprehensive',
          description: 'Audit thoroughness level',
        },
      },
      required: ['components'],
    },
  },
  {
    name: 'validate_aria',
    description: 'Check ARIA attribute usage and validity',
    category: 'codeguard',
    inputSchema: {
      type: 'object',
      properties: {
        components: FilesArraySchema,
      },
      required: ['components'],
    },
  },
  {
    name: 'check_contrast',
    description: 'Validate color contrast ratios meet WCAG requirements',
    category: 'codeguard',
    inputSchema: {
      type: 'object',
      properties: {
        components: FilesArraySchema,
        level: {
          type: 'string',
          enum: ['AA', 'AAA'],
          default: 'AA',
          description: 'WCAG contrast level requirement',
        },
      },
      required: ['components'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// DATA TOOLS
// ═══════════════════════════════════════════════════════════════════

export const DATA_TOOLS: MCPToolDefinition[] = [
  {
    name: 'validate_schemas',
    description: 'Check Zod schema usage and validation patterns',
    category: 'codeguard',
    inputSchema: {
      type: 'object',
      properties: {
        files: FilesArraySchema,
      },
      required: ['files'],
    },
  },
  {
    name: 'check_compatibility',
    description: 'Check interface and type compatibility between versions',
    category: 'codeguard',
    inputSchema: {
      type: 'object',
      properties: {
        files: FilesArraySchema,
        baselineFiles: {
          ...FilesArraySchema,
          description: 'Baseline files to compare against (for version comparison)',
        },
      },
      required: ['files'],
    },
  },
  {
    name: 'trace_data_flow',
    description: 'Trace data flow through the system from an entry point',
    category: 'codeguard',
    inputSchema: {
      type: 'object',
      properties: {
        entryPoint: { type: 'string', description: 'Starting function or module path' },
        files: FilesArraySchema,
        maxDepth: {
          type: 'number',
          minimum: 1,
          maximum: 20,
          default: 10,
          description: 'Maximum depth to trace',
        },
      },
      required: ['entryPoint', 'files'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// HOOKS TOOLS
// ═══════════════════════════════════════════════════════════════════

export const HOOKS_TOOLS: MCPToolDefinition[] = [
  {
    name: 'trigger_review',
    description: 'Manually trigger a code review on specified files',
    category: 'hooks',
    inputSchema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'File paths to review',
        },
        agents: {
          type: 'array',
          items: AgentIdSchema,
          description: 'Specific agents to run (default: all)',
        },
      },
      required: ['files'],
    },
  },
  {
    name: 'run_full_review',
    description: 'Run all CodeGuard agents on the specified files',
    category: 'hooks',
    inputSchema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'File paths to review',
        },
      },
      required: ['files'],
    },
  },
  {
    name: 'get_hooks_config',
    description: 'Get current review hooks configuration',
    category: 'hooks',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'set_hooks_enabled',
    description: 'Enable or disable review hooks',
    category: 'hooks',
    inputSchema: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', description: 'Enable or disable hooks' },
      },
      required: ['enabled'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// SYSTEM TOOLS
// ═══════════════════════════════════════════════════════════════════

export const SYSTEM_TOOLS: MCPToolDefinition[] = [
  {
    name: 'ping',
    description: 'Health check - verify the MCP server is running',
    category: 'system',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_agents',
    description: 'List all available CodeGuard agents and their capabilities',
    category: 'system',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_agent_status',
    description: 'Get the status of a specific agent',
    category: 'system',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: AgentIdSchema,
      },
      required: ['agentId'],
    },
  },
  {
    name: 'get_server_status',
    description: 'Get overall server status including all agents',
    category: 'system',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'health_check',
    description: 'Detailed health check of all agents with individual status',
    category: 'system',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// ALL TOOLS
// ═══════════════════════════════════════════════════════════════════

export const ALL_TOOLS: MCPToolDefinition[] = [
  ...ARCHITECT_TOOLS,
  ...STYLIST_TOOLS,
  ...SECURITY_TOOLS,
  ...ACCESSIBILITY_TOOLS,
  ...DATA_TOOLS,
  ...HOOKS_TOOLS,
  ...SYSTEM_TOOLS,
];

/**
 * Get tools by category
 */
export function getToolsByCategory(category: 'codeguard' | 'hooks' | 'system'): MCPToolDefinition[] {
  return ALL_TOOLS.filter(tool => tool.category === category);
}

/**
 * Get a tool definition by name
 */
export function getToolDefinition(name: string): MCPToolDefinition | undefined {
  return ALL_TOOLS.find(tool => tool.name === name);
}
