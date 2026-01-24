/**
 * Unified AUI MCP Tool Definitions
 *
 * 40+ MCP tools for the Agentic User Interface:
 * - Session management
 * - Natural language processing
 * - Versioned buffer operations
 * - Search integration
 * - Admin capabilities
 *
 * @module @humanizer/core/mcp/tools/unified-aui
 */

import type { McpToolDefinition } from '../../aui/types.js';
import { TOOL_NAMES } from '../../aui/constants.js';

// ═══════════════════════════════════════════════════════════════════════════
// SESSION TOOLS
// ═══════════════════════════════════════════════════════════════════════════

const sessionTools: McpToolDefinition[] = [
  {
    name: TOOL_NAMES.SESSION_CREATE,
    description: 'Create a new AUI session for managing buffers, tasks, and searches',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Optional session name' },
        userId: { type: 'string', description: 'Optional user ID to associate' },
      },
    },
  },
  {
    name: TOOL_NAMES.SESSION_GET,
    description: 'Get session state including buffers, active task, and metadata',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: TOOL_NAMES.SESSION_LIST,
    description: 'List all active AUI sessions',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: TOOL_NAMES.SESSION_DELETE,
    description: 'Delete an AUI session and all its resources',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID to delete' },
      },
      required: ['sessionId'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// PROCESSING TOOLS
// ═══════════════════════════════════════════════════════════════════════════

const processingTools: McpToolDefinition[] = [
  {
    name: TOOL_NAMES.PROCESS,
    description: 'Process a natural language request - routes to BQL, search, or agent automatically',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        request: { type: 'string', description: 'Natural language request' },
        dryRun: { type: 'boolean', description: 'Parse only without execution' },
        route: {
          type: 'string',
          description: 'Force routing to specific handler',
          enum: ['bql', 'search', 'agent'],
        },
      },
      required: ['sessionId', 'request'],
    },
  },
  {
    name: TOOL_NAMES.AGENT_RUN,
    description: 'Run a multi-step agentic task using ReAct pattern',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        request: { type: 'string', description: 'Task description' },
        maxSteps: { type: 'number', description: 'Maximum reasoning steps (default: 20)' },
        autoApprove: { type: 'boolean', description: 'Auto-approve destructive actions' },
      },
      required: ['sessionId', 'request'],
    },
  },
  {
    name: TOOL_NAMES.AGENT_STEP,
    description: 'Execute a single step of an agent task',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        taskId: { type: 'string', description: 'Task ID to step' },
      },
      required: ['sessionId', 'taskId'],
    },
  },
  {
    name: TOOL_NAMES.AGENT_INTERRUPT,
    description: 'Interrupt a running agent task',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        taskId: { type: 'string', description: 'Task ID to interrupt' },
        reason: { type: 'string', description: 'Reason for interruption' },
      },
      required: ['sessionId', 'taskId'],
    },
  },
  {
    name: TOOL_NAMES.AGENT_STATUS,
    description: 'Get status of an agent task',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        taskId: { type: 'string', description: 'Task ID' },
      },
      required: ['sessionId', 'taskId'],
    },
  },
  {
    name: TOOL_NAMES.AGENT_RESUME,
    description: 'Resume a paused or awaiting-input agent task',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        taskId: { type: 'string', description: 'Task ID to resume' },
        userInput: { type: 'string', description: 'User input if awaiting' },
      },
      required: ['sessionId', 'taskId'],
    },
  },
  {
    name: TOOL_NAMES.BQL_EXECUTE,
    description: 'Execute a BQL pipeline directly',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        pipeline: { type: 'string', description: 'BQL pipeline (e.g., harvest "topic" | limit 10 | save results)' },
        dryRun: { type: 'boolean', description: 'Parse only without execution' },
      },
      required: ['sessionId', 'pipeline'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// BUFFER LIFECYCLE TOOLS
// ═══════════════════════════════════════════════════════════════════════════

const bufferLifecycleTools: McpToolDefinition[] = [
  {
    name: TOOL_NAMES.BUFFER_CREATE,
    description: 'Create a new versioned buffer',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        name: { type: 'string', description: 'Buffer name' },
        content: { type: 'array', description: 'Initial content array' },
      },
      required: ['sessionId', 'name'],
    },
  },
  {
    name: TOOL_NAMES.BUFFER_LIST,
    description: 'List all buffers in the session',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: TOOL_NAMES.BUFFER_GET,
    description: 'Get buffer contents',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        name: { type: 'string', description: 'Buffer name' },
        limit: { type: 'number', description: 'Max items to return' },
        offset: { type: 'number', description: 'Offset for pagination' },
      },
      required: ['sessionId', 'name'],
    },
  },
  {
    name: TOOL_NAMES.BUFFER_SET,
    description: 'Set buffer working content (replaces all)',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        name: { type: 'string', description: 'Buffer name' },
        content: { type: 'array', description: 'New content array' },
      },
      required: ['sessionId', 'name', 'content'],
    },
  },
  {
    name: TOOL_NAMES.BUFFER_APPEND,
    description: 'Append items to buffer',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        name: { type: 'string', description: 'Buffer name' },
        items: { type: 'array', description: 'Items to append' },
      },
      required: ['sessionId', 'name', 'items'],
    },
  },
  {
    name: TOOL_NAMES.BUFFER_DELETE,
    description: 'Delete a buffer',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        name: { type: 'string', description: 'Buffer name to delete' },
      },
      required: ['sessionId', 'name'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// BUFFER VERSION CONTROL TOOLS
// ═══════════════════════════════════════════════════════════════════════════

const bufferVersionTools: McpToolDefinition[] = [
  {
    name: TOOL_NAMES.BUFFER_COMMIT,
    description: 'Commit buffer changes as a new version',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        name: { type: 'string', description: 'Buffer name' },
        message: { type: 'string', description: 'Commit message' },
      },
      required: ['sessionId', 'name', 'message'],
    },
  },
  {
    name: TOOL_NAMES.BUFFER_ROLLBACK,
    description: 'Rollback buffer to previous version',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        name: { type: 'string', description: 'Buffer name' },
        steps: { type: 'number', description: 'Number of versions to rollback (default: 1)' },
      },
      required: ['sessionId', 'name'],
    },
  },
  {
    name: TOOL_NAMES.BUFFER_HISTORY,
    description: 'Get version history of a buffer',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        name: { type: 'string', description: 'Buffer name' },
        limit: { type: 'number', description: 'Max versions to return' },
      },
      required: ['sessionId', 'name'],
    },
  },
  {
    name: TOOL_NAMES.BUFFER_TAG,
    description: 'Tag a version for easy reference',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        name: { type: 'string', description: 'Buffer name' },
        versionId: { type: 'string', description: 'Version ID to tag' },
        tag: { type: 'string', description: 'Tag name' },
      },
      required: ['sessionId', 'name', 'versionId', 'tag'],
    },
  },
  {
    name: TOOL_NAMES.BUFFER_CHECKOUT,
    description: 'Checkout a specific version',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        name: { type: 'string', description: 'Buffer name' },
        versionIdOrTag: { type: 'string', description: 'Version ID or tag to checkout' },
      },
      required: ['sessionId', 'name', 'versionIdOrTag'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// BUFFER BRANCHING TOOLS
// ═══════════════════════════════════════════════════════════════════════════

const bufferBranchTools: McpToolDefinition[] = [
  {
    name: TOOL_NAMES.BUFFER_BRANCH_CREATE,
    description: 'Create a new branch from current HEAD',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        bufferName: { type: 'string', description: 'Buffer name' },
        branchName: { type: 'string', description: 'New branch name' },
        description: { type: 'string', description: 'Branch description' },
      },
      required: ['sessionId', 'bufferName', 'branchName'],
    },
  },
  {
    name: TOOL_NAMES.BUFFER_BRANCH_SWITCH,
    description: 'Switch to a different branch',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        bufferName: { type: 'string', description: 'Buffer name' },
        branchName: { type: 'string', description: 'Branch to switch to' },
      },
      required: ['sessionId', 'bufferName', 'branchName'],
    },
  },
  {
    name: TOOL_NAMES.BUFFER_BRANCH_LIST,
    description: 'List all branches in a buffer',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        bufferName: { type: 'string', description: 'Buffer name' },
      },
      required: ['sessionId', 'bufferName'],
    },
  },
  {
    name: TOOL_NAMES.BUFFER_BRANCH_DELETE,
    description: 'Delete a branch (not current)',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        bufferName: { type: 'string', description: 'Buffer name' },
        branchName: { type: 'string', description: 'Branch to delete' },
      },
      required: ['sessionId', 'bufferName', 'branchName'],
    },
  },
  {
    name: TOOL_NAMES.BUFFER_MERGE,
    description: 'Merge a branch into current branch',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        bufferName: { type: 'string', description: 'Buffer name' },
        sourceBranch: { type: 'string', description: 'Branch to merge from' },
        message: { type: 'string', description: 'Merge commit message' },
        strategy: {
          type: 'string',
          description: 'Merge strategy',
          enum: ['auto', 'ours', 'theirs', 'union'],
        },
      },
      required: ['sessionId', 'bufferName', 'sourceBranch'],
    },
  },
  {
    name: TOOL_NAMES.BUFFER_DIFF,
    description: 'Diff between two versions',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        bufferName: { type: 'string', description: 'Buffer name' },
        fromVersion: { type: 'string', description: 'From version ID (or "HEAD", "working")' },
        toVersion: { type: 'string', description: 'To version ID (or "HEAD", "working")' },
      },
      required: ['sessionId', 'bufferName', 'fromVersion', 'toVersion'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// SEARCH TOOLS
// ═══════════════════════════════════════════════════════════════════════════

const searchTools: McpToolDefinition[] = [
  {
    name: TOOL_NAMES.SEARCH,
    description: 'Semantic search across archive and books',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        query: { type: 'string', description: 'Search query' },
        target: {
          type: 'string',
          description: 'Where to search',
          enum: ['archive', 'books', 'all'],
        },
        limit: { type: 'number', description: 'Max results (default: 20)' },
        threshold: { type: 'number', description: 'Min similarity threshold (0-1)' },
      },
      required: ['sessionId', 'query'],
    },
  },
  {
    name: TOOL_NAMES.SEARCH_REFINE,
    description: 'Refine search results with additional criteria',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        query: { type: 'string', description: 'Refinement query' },
        minScore: { type: 'number', description: 'Minimum score to keep' },
        minWordCount: { type: 'number', description: 'Minimum word count' },
        limit: { type: 'number', description: 'Max results after refinement' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: TOOL_NAMES.SEARCH_ANCHOR_ADD,
    description: 'Add a semantic anchor (positive or negative example)',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        resultId: { type: 'string', description: 'Result ID to anchor' },
        type: {
          type: 'string',
          description: 'Anchor type',
          enum: ['positive', 'negative'],
        },
      },
      required: ['sessionId', 'resultId', 'type'],
    },
  },
  {
    name: TOOL_NAMES.SEARCH_ANCHOR_REMOVE,
    description: 'Remove a semantic anchor',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        anchorId: { type: 'string', description: 'Anchor ID to remove' },
      },
      required: ['sessionId', 'anchorId'],
    },
  },
  {
    name: TOOL_NAMES.SEARCH_TO_BUFFER,
    description: 'Save search results to a buffer',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        bufferName: { type: 'string', description: 'Target buffer name' },
        limit: { type: 'number', description: 'Max results to save' },
        create: { type: 'boolean', description: 'Create buffer if not exists' },
      },
      required: ['sessionId', 'bufferName'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN CONFIG TOOLS
// ═══════════════════════════════════════════════════════════════════════════

const adminConfigTools: McpToolDefinition[] = [
  {
    name: TOOL_NAMES.ADMIN_CONFIG_GET,
    description: 'Get a configuration value',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Config category',
          enum: ['prompts', 'thresholds', 'limits', 'labels', 'features', 'secrets', 'agents'],
        },
        key: { type: 'string', description: 'Config key' },
      },
      required: ['category', 'key'],
    },
  },
  {
    name: TOOL_NAMES.ADMIN_CONFIG_SET,
    description: 'Set a configuration value',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Config category' },
        key: { type: 'string', description: 'Config key' },
        value: { type: 'string', description: 'Config value (JSON encoded)' },
        reason: { type: 'string', description: 'Reason for change (audit)' },
      },
      required: ['category', 'key', 'value'],
    },
  },
  {
    name: TOOL_NAMES.ADMIN_CONFIG_LIST,
    description: 'List all config in a category',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Config category' },
      },
      required: ['category'],
    },
  },
  {
    name: TOOL_NAMES.ADMIN_CONFIG_AUDIT,
    description: 'Get config change audit history',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by category' },
        limit: { type: 'number', description: 'Max entries (default: 50)' },
      },
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN PROMPT TOOLS
// ═══════════════════════════════════════════════════════════════════════════

const adminPromptTools: McpToolDefinition[] = [
  {
    name: TOOL_NAMES.ADMIN_PROMPT_LIST,
    description: 'List all prompt templates',
    inputSchema: {
      type: 'object',
      properties: {
        tag: { type: 'string', description: 'Filter by tag' },
        usedBy: { type: 'string', description: 'Filter by agent/house' },
      },
    },
  },
  {
    name: TOOL_NAMES.ADMIN_PROMPT_GET,
    description: 'Get a prompt template',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Prompt template ID' },
      },
      required: ['id'],
    },
  },
  {
    name: TOOL_NAMES.ADMIN_PROMPT_SET,
    description: 'Create or update a prompt template',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Prompt ID' },
        name: { type: 'string', description: 'Human-readable name' },
        template: { type: 'string', description: 'Prompt template text' },
        description: { type: 'string', description: 'What this prompt does' },
        requiredVariables: {
          type: 'array',
          description: 'Required variable names',
          items: { type: 'string', description: 'Variable name' },
        },
      },
      required: ['id', 'name', 'template'],
    },
  },
  {
    name: TOOL_NAMES.ADMIN_PROMPT_TEST,
    description: 'Test a prompt template with variables',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Prompt ID' },
        variables: {
          type: 'object',
          description: 'Variables to substitute',
        },
      },
      required: ['id', 'variables'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN COST & USAGE TOOLS
// ═══════════════════════════════════════════════════════════════════════════

const adminCostTools: McpToolDefinition[] = [
  {
    name: TOOL_NAMES.ADMIN_COST_RECORD,
    description: 'Record an LLM cost entry',
    inputSchema: {
      type: 'object',
      properties: {
        model: { type: 'string', description: 'Model name' },
        operation: { type: 'string', description: 'Operation type' },
        inputTokens: { type: 'number', description: 'Input tokens' },
        outputTokens: { type: 'number', description: 'Output tokens' },
        latencyMs: { type: 'number', description: 'Latency in ms' },
        success: { type: 'boolean', description: 'Whether call succeeded' },
        userId: { type: 'string', description: 'User ID to attribute' },
      },
      required: ['model', 'operation', 'inputTokens', 'outputTokens', 'latencyMs', 'success'],
    },
  },
  {
    name: TOOL_NAMES.ADMIN_COST_REPORT,
    description: 'Generate LLM cost report',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date (ISO format)' },
        endDate: { type: 'string', description: 'End date (ISO format)' },
        groupBy: {
          type: 'string',
          description: 'Group by period',
          enum: ['day', 'week', 'month'],
        },
        userId: { type: 'string', description: 'Filter by user' },
        model: { type: 'string', description: 'Filter by model' },
      },
      required: ['startDate'],
    },
  },
  {
    name: TOOL_NAMES.ADMIN_USAGE_GET,
    description: 'Get usage for a user',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID' },
        period: {
          type: 'string',
          description: 'Usage period',
          enum: ['day', 'month'],
        },
      },
      required: ['userId'],
    },
  },
  {
    name: TOOL_NAMES.ADMIN_USAGE_CHECK,
    description: 'Check if user is within limits',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID' },
      },
      required: ['userId'],
    },
  },
  {
    name: TOOL_NAMES.ADMIN_USAGE_REPORT,
    description: 'Generate usage report',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date (ISO format)' },
        endDate: { type: 'string', description: 'End date (ISO format)' },
        groupBy: {
          type: 'string',
          description: 'Group by dimension',
          enum: ['user', 'tier', 'model', 'operation'],
        },
        limit: { type: 'number', description: 'Max results' },
      },
      required: ['startDate'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN TIER TOOLS
// ═══════════════════════════════════════════════════════════════════════════

const adminTierTools: McpToolDefinition[] = [
  {
    name: TOOL_NAMES.ADMIN_TIER_LIST,
    description: 'List all user tiers',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: TOOL_NAMES.ADMIN_TIER_GET,
    description: 'Get tier details',
    inputSchema: {
      type: 'object',
      properties: {
        tierId: { type: 'string', description: 'Tier ID' },
      },
      required: ['tierId'],
    },
  },
  {
    name: TOOL_NAMES.ADMIN_TIER_SET,
    description: 'Create or update a tier',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Tier ID' },
        name: { type: 'string', description: 'Tier name' },
        description: { type: 'string', description: 'Tier description' },
        limits: { type: 'object', description: 'Tier limits (JSON)' },
        features: {
          type: 'array',
          description: 'Enabled features',
          items: { type: 'string', description: 'Feature flag' },
        },
        priceMonthly: { type: 'number', description: 'Monthly price (cents)' },
        isPublic: { type: 'boolean', description: 'Whether tier is public' },
      },
      required: ['id', 'name'],
    },
  },
  {
    name: TOOL_NAMES.ADMIN_USER_TIER_GET,
    description: 'Get user\'s current tier',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID' },
      },
      required: ['userId'],
    },
  },
  {
    name: TOOL_NAMES.ADMIN_USER_TIER_SET,
    description: 'Set user\'s tier',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID' },
        tierId: { type: 'string', description: 'New tier ID' },
      },
      required: ['userId', 'tierId'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT ALL TOOLS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * All Unified AUI MCP tools.
 */
export const UNIFIED_AUI_TOOLS: McpToolDefinition[] = [
  ...sessionTools,
  ...processingTools,
  ...bufferLifecycleTools,
  ...bufferVersionTools,
  ...bufferBranchTools,
  ...searchTools,
  ...adminConfigTools,
  ...adminPromptTools,
  ...adminCostTools,
  ...adminTierTools,
];

/**
 * Get tool by name.
 */
export function getAuiTool(name: string): McpToolDefinition | undefined {
  return UNIFIED_AUI_TOOLS.find(t => t.name === name);
}

/**
 * Get tools by category.
 */
export function getAuiToolsByCategory(category: string): McpToolDefinition[] {
  switch (category) {
    case 'session':
      return sessionTools;
    case 'processing':
      return processingTools;
    case 'buffer-lifecycle':
      return bufferLifecycleTools;
    case 'buffer-version':
      return bufferVersionTools;
    case 'buffer-branch':
      return bufferBranchTools;
    case 'search':
      return searchTools;
    case 'admin-config':
      return adminConfigTools;
    case 'admin-prompt':
      return adminPromptTools;
    case 'admin-cost':
      return adminCostTools;
    case 'admin-tier':
      return adminTierTools;
    default:
      return [];
  }
}
