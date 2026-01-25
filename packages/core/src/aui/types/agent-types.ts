/**
 * Unified AUI Types - Agent Types
 *
 * Agentic loop types for the ReAct pattern.
 *
 * @module @humanizer/core/aui/types/agent-types
 */

// ═══════════════════════════════════════════════════════════════════════════
// AGENTIC LOOP TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Step types in the ReAct agentic loop.
 */
export type AgentStepType =
  | 'reason'   // Analyzing current state, deciding next action
  | 'act'      // Executing a tool or action
  | 'observe'  // Processing tool result
  | 'adjust'   // Modifying plan based on observation
  | 'complete' // Task finished successfully
  | 'error';   // Task failed

/**
 * A single step in the agentic reasoning process.
 */
export interface AgentStep {
  /** Unique step identifier */
  id: string;

  /** Type of step */
  type: AgentStepType;

  /** The reasoning or action description */
  content: string;

  /** Tool call details (for 'act' steps) */
  toolCall?: ToolCall;

  /** Tool result (for 'observe' steps) */
  toolResult?: ToolResult;

  /** When this step occurred (epoch ms) */
  timestamp: number;

  /** How long this step took (ms) */
  durationMs?: number;

  /** Tokens used in this step */
  tokensUsed?: number;

  /** Confidence in this step (0-1) */
  confidence?: number;
}

/**
 * A tool call made by the agent.
 */
export interface ToolCall {
  /** Tool name (BQL operation, MCP tool, etc.) */
  tool: string;

  /** Arguments passed to the tool */
  args: Record<string, unknown>;

  /** Raw BQL pipeline (if tool is BQL execution) */
  rawBql?: string;

  /** Whether this is a destructive action */
  isDestructive?: boolean;

  /** Whether user approval is required */
  requiresApproval?: boolean;
}

/**
 * Result from executing a tool.
 */
export interface ToolResult {
  /** Whether execution succeeded */
  success: boolean;

  /** Result data (if successful) */
  data?: unknown;

  /** Error message (if failed) */
  error?: string;

  /** Tokens used by the tool (e.g., for LLM-based tools) */
  tokensUsed?: number;

  /** Cost of this tool call (cents) */
  costCents?: number;

  /** Execution duration (ms) */
  durationMs?: number;

  /** Warnings from the tool */
  warnings?: string[];
}

/**
 * Task status in the agentic loop.
 */
export type AgentTaskStatus =
  | 'pending'        // Task created but not started
  | 'planning'       // Decomposing and planning steps
  | 'executing'      // Running through steps
  | 'awaiting_input' // Waiting for user approval or input
  | 'paused'         // Paused by user
  | 'completed'      // Successfully finished
  | 'failed'         // Failed with error
  | 'cancelled';     // Cancelled by user

/**
 * An agentic task being executed.
 */
export interface AgentTask {
  /** Unique task identifier */
  id: string;

  /** Original user request */
  request: string;

  /** Current task status */
  status: AgentTaskStatus;

  /** All steps executed so far */
  steps: AgentStep[];

  /** Decomposed plan (if planning was done) */
  plan?: AgentPlanStep[];

  /** Index of current step in plan */
  currentStepIndex: number;

  /** Final result (if completed) */
  result?: unknown;

  /** Error message (if failed) */
  error?: string;

  /** When task started (epoch ms) */
  startedAt: number;

  /** When task completed (epoch ms) */
  completedAt?: number;

  /** Total tokens used across all steps */
  totalTokens: number;

  /** Total cost (cents) */
  totalCostCents: number;

  /** Context for this task */
  context: TaskContext;

  /** Priority (1=highest, 5=lowest) */
  priority: number;

  /** User who initiated this task */
  userId?: string;
}

/**
 * A step in the agent's plan.
 */
export interface AgentPlanStep {
  /** Step description */
  description: string;

  /** Tool to use (if known) */
  tool?: string;

  /** Expected output */
  expectedOutput?: string;

  /** Dependencies on other steps (indices) */
  dependsOn?: number[];

  /** Whether this step is completed */
  completed: boolean;

  /** Actual result (when completed) */
  result?: unknown;
}

/**
 * Context for an agentic task.
 */
export interface TaskContext {
  /** Active buffer name */
  activeBuffer?: string;

  /** Active search session ID */
  searchSessionId?: string;

  /** Variables available to the task */
  variables: Map<string, unknown>;

  /** Previous task results (for chaining) */
  previousResults?: unknown[];

  /** Custom context data */
  custom?: Record<string, unknown>;
}

/**
 * Options for the agentic loop.
 */
export interface AgentLoopOptions {
  /** Maximum reasoning steps (default: 20) */
  maxSteps?: number;

  /** Maximum tokens per LLM call */
  maxTokens?: number;

  /** LLM temperature (0-1) */
  temperature?: number;

  /** Auto-approve destructive actions without user confirmation */
  autoApprove?: boolean;

  /** Emit step-by-step updates */
  verbose?: boolean;

  /** Model to use (default: configured default) */
  model?: string;

  /** Callback for each step */
  onStep?: (step: AgentStep) => void;

  /** Callback when approval is needed */
  onApprovalNeeded?: (action: ToolCall) => Promise<boolean>;

  /** Callback for status changes */
  onStatusChange?: (task: AgentTask) => void;

  /** Task priority (1-5) */
  priority?: number;

  /** Maximum time to run (ms) */
  timeoutMs?: number;
}

/**
 * Result from reasoning step.
 */
export interface ReasoningResult {
  /** Next action to take */
  nextAction: 'tool' | 'complete' | 'ask_user' | 'adjust_plan';

  /** Reasoning explanation */
  reasoning: string;

  /** Tool call (if nextAction is 'tool') */
  toolCall?: ToolCall;

  /** Answer (if nextAction is 'complete') */
  answer?: string;

  /** Question (if nextAction is 'ask_user') */
  question?: string;

  /** Plan adjustment (if nextAction is 'adjust_plan') */
  planAdjustment?: string;

  /** Confidence in this decision (0-1) */
  confidence: number;
}

/**
 * A tool definition for the agentic loop.
 */
export interface ToolDefinition {
  /** Tool name */
  name: string;

  /** Tool description */
  description: string;

  /** Parameter schema */
  parameters: Record<string, ToolParameter>;

  /** Required parameters */
  required?: string[];

  /** Whether this is a destructive action */
  isDestructive?: boolean;

  /** Examples of usage */
  examples?: ToolExample[];
}

/**
 * A tool parameter definition.
 */
export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: unknown[];
  default?: unknown;
  items?: ToolParameter; // For arrays
  properties?: Record<string, ToolParameter>; // For objects
}

/**
 * Example usage of a tool.
 */
export interface ToolExample {
  description: string;
  args: Record<string, unknown>;
  expectedOutput?: string;
}
