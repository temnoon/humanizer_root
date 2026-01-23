/**
 * Batch Query Language (BQL) Types
 *
 * A pipeline DSL for orchestrating archive → workspace → transform flows.
 * Inspired by RLM (Recursive Language Models) for handling large contexts.
 *
 * @see https://arxiv.org/abs/2512.24601 - RLM Paper
 *
 * Core Philosophy:
 * - Metadata-first: Send structure before content
 * - Recursive refinement: LLM can drill down into subsets
 * - Pipeline composition: Chain operations naturally
 */

// ═══════════════════════════════════════════════════════════════════════════
// Pipeline Primitives
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A pipeline step - the atomic unit of BQL execution.
 */
export interface PipelineStep {
  /** Operation type */
  op: PipelineOperation;
  /** Operation-specific parameters */
  params: Record<string, unknown>;
  /** Optional alias for this step's output */
  as?: string;
}

/**
 * Available pipeline operations.
 */
export type PipelineOperation =
  // Source operations (produce content)
  | 'harvest'      // Search archive with semantic query
  | 'load'         // Load from workspace/buffer
  | 'fetch'        // Fetch from external source
  | 'generate'     // LLM generation

  // Filter operations (reduce content)
  | 'filter'       // Filter by predicate
  | 'select'       // Select specific fields
  | 'limit'        // Limit count
  | 'sample'       // Random sample
  | 'dedupe'       // Remove duplicates

  // Transform operations (modify content)
  | 'transform'    // Apply persona/style/namespace
  | 'humanize'     // AI detection + humanization
  | 'chunk'        // Split into chunks
  | 'merge'        // Merge chunks
  | 'annotate'     // Add metadata

  // Analysis operations (extract insights)
  | 'detect'       // AI detection
  | 'cluster'      // Semantic clustering
  | 'summarize'    // Summarization
  | 'extract'      // Extract entities/facts

  // Aggregate operations (combine content)
  | 'group'        // Group by key
  | 'sort'         // Sort by field
  | 'join'         // Join with another source
  | 'union'        // Union multiple sources

  // Output operations (save/export)
  | 'save'         // Save to workspace
  | 'export'       // Export to file
  | 'book'         // Create book project
  | 'print'        // Output to console

  // Control operations
  | 'branch'       // Conditional branching
  | 'loop'         // Iteration
  | 'parallel'     // Parallel execution
  | 'rlm'          // Recursive LLM exploration (RLM-style);

/**
 * A complete pipeline - a sequence of steps.
 */
export interface Pipeline {
  /** Pipeline identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Pipeline steps */
  steps: PipelineStep[];
  /** Input variables */
  inputs?: Record<string, unknown>;
  /** Pipeline metadata */
  meta?: {
    author?: string;
    description?: string;
    tags?: string[];
    createdAt?: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// RLM Context Management
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Context metadata for RLM-style exploration.
 * The LLM receives this INSTEAD of the full content.
 */
export interface ContextMetadata {
  /** Total items in context */
  totalItems: number;
  /** Total tokens (estimated) */
  totalTokens: number;
  /** Content structure description */
  structure: ContextStructure;
  /** Sample items for LLM to understand format */
  samples: unknown[];
  /** Available operations on this context */
  operations: string[];
  /** Query history for this context */
  queryHistory?: ContextQuery[];
}

/**
 * Describes the structure of the context.
 */
export interface ContextStructure {
  /** Type of content (messages, passages, chunks, etc.) */
  contentType: string;
  /** Fields available on each item */
  fields: FieldDescription[];
  /** Hierarchical relationships */
  hierarchy?: {
    parent?: string;
    children?: string[];
  };
  /** Indices available for filtering */
  indices?: string[];
}

export interface FieldDescription {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  description?: string;
  sample?: unknown;
  stats?: {
    min?: number;
    max?: number;
    mean?: number;
    unique?: number;
  };
}

/**
 * A query made against the context.
 */
export interface ContextQuery {
  /** Natural language description of query intent */
  intent: string;
  /** Generated code/filter expression */
  expression: string;
  /** Number of results returned */
  resultCount: number;
  /** Timestamp */
  timestamp: string;
}

/**
 * RLM exploration session - tracks recursive drill-down.
 */
export interface RlmSession {
  /** Session ID */
  id: string;
  /** Root context metadata */
  rootContext: ContextMetadata;
  /** Current focus (subset being explored) */
  currentFocus?: {
    metadata: ContextMetadata;
    path: string[]; // How we got here
  };
  /** Exploration history */
  explorations: RlmExploration[];
  /** Accumulated findings */
  findings: RlmFinding[];
}

export interface RlmExploration {
  /** LLM's reasoning about what to explore */
  reasoning: string;
  /** Code/expression generated */
  expression: string;
  /** Result metadata */
  resultMeta: ContextMetadata;
  /** Whether LLM wants to drill deeper */
  drillDeeper: boolean;
  /** Optional sub-explorations */
  subExplorations?: RlmExploration[];
}

export interface RlmFinding {
  /** What was found */
  content: unknown;
  /** Path through context to this finding */
  path: string[];
  /** Relevance score */
  relevance: number;
  /** LLM's explanation */
  explanation: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Pipeline Execution
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Result of executing a pipeline step.
 */
export interface StepResult {
  /** Step that was executed */
  step: PipelineStep;
  /** Output data */
  data: unknown[];
  /** Metadata about the result */
  meta: {
    inputCount: number;
    outputCount: number;
    durationMs: number;
    tokensUsed?: number;
  };
  /** Errors if any */
  errors?: string[];
}

/**
 * Result of executing a full pipeline.
 */
export interface PipelineResult {
  /** Pipeline that was executed */
  pipeline: Pipeline;
  /** Results from each step */
  stepResults: StepResult[];
  /** Final output */
  output: unknown[];
  /** Execution statistics */
  stats: {
    totalDurationMs: number;
    totalTokensUsed: number;
    stepsExecuted: number;
    stepsFailed: number;
  };
  /** Whether execution completed successfully */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Pipeline execution options.
 */
export interface ExecutionOptions {
  /** Dry run - don't actually execute, just validate */
  dryRun?: boolean;
  /** Verbose logging */
  verbose?: boolean;
  /** Maximum items to process */
  maxItems?: number;
  /** Maximum tokens to use */
  maxTokens?: number;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Enable RLM-style exploration */
  rlmMode?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// Smart Prompting
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Context for smart prompt construction.
 */
export interface PromptContext {
  /** The user's original request */
  userRequest: string;
  /** Current pipeline state */
  pipelineState?: {
    currentStep: number;
    totalSteps: number;
    intermediateResults: unknown[];
  };
  /** Available data context (RLM-style metadata) */
  dataContext?: ContextMetadata;
  /** Conversation history */
  conversationHistory?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  /** User preferences */
  preferences?: {
    verbosity?: 'terse' | 'normal' | 'detailed';
    style?: string;
    persona?: string;
  };
}

/**
 * A constructed prompt with metadata.
 */
export interface SmartPrompt {
  /** The system prompt */
  system: string;
  /** The user prompt */
  user: string;
  /** Metadata about prompt construction */
  meta: {
    contextTokens: number;
    promptTokens: number;
    strategy: 'direct' | 'rlm' | 'hierarchical' | 'chunked';
    compressionApplied: boolean;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CLI Interface Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * CLI command parsed from user input.
 */
export interface CliCommand {
  /** Raw input string */
  raw: string;
  /** Parsed pipeline (if valid) */
  pipeline?: Pipeline;
  /** Natural language request (for AUI mode) */
  naturalLanguage?: string;
  /** Parse errors if any */
  errors?: string[];
}

/**
 * CLI session state.
 */
export interface CliSession {
  /** Session ID */
  id: string;
  /** Current workspace */
  workspace: {
    buffers: Map<string, unknown[]>;
    variables: Map<string, unknown>;
  };
  /** Command history */
  history: CliCommand[];
  /** Active pipeline (if any) */
  activePipeline?: Pipeline;
  /** RLM session (if exploring) */
  rlmSession?: RlmSession;
}

/**
 * CLI response to display.
 */
export interface CliResponse {
  /** Response type */
  type: 'result' | 'error' | 'info' | 'prompt' | 'help';
  /** Main message */
  message: string;
  /** Structured data to display */
  data?: unknown;
  /** Suggested next commands */
  suggestions?: string[];
  /** Whether to prompt for more input */
  awaitInput?: boolean;
}
