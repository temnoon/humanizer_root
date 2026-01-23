/**
 * BQL - Batch Query Language
 *
 * A pipeline DSL for orchestrating archive → workspace → transform flows.
 * Integrates RLM (Recursive Language Models) concepts for handling large contexts.
 *
 * @example
 * ```typescript
 * import { createBqlCli, parseBql, PipelineExecutor } from '@humanizer/npe/bql';
 *
 * // Option 1: CLI/AUI Interface
 * const cli = createBqlCli({ llm: myAdapter });
 * const result = await cli.process('harvest "memories" | humanize moderate | save');
 *
 * // Option 2: Direct Pipeline Execution
 * const pipeline = parseBql('harvest "nostalgia" | filter quality > 0.7');
 * const executor = new PipelineExecutor({ llm: myAdapter });
 * const result = await executor.execute(pipeline.pipeline);
 *
 * // Natural Language (AUI mode)
 * const nlResult = await cli.process('find my old vacation stories and make them poetic');
 * ```
 */

// Types
export type {
  // Pipeline types
  PipelineStep,
  PipelineOperation,
  Pipeline,
  PipelineResult,
  StepResult,
  ExecutionOptions,

  // RLM types
  ContextMetadata,
  ContextStructure,
  FieldDescription,
  ContextQuery,
  RlmSession,
  RlmExploration,
  RlmFinding,

  // CLI types
  CliCommand,
  CliSession,
  CliResponse,

  // Prompting types
  PromptContext,
  SmartPrompt,
} from './types.js';

// Parser
export {
  tokenize,
  parseBql,
  toBql,
  BQL_HELP,
} from './parser.js';

// RLM Context Management
export {
  generateContextMetadata,
  createRlmSession,
  generateRlmPrompt,
  parseRlmResponse,
  executeFilterExpression,
  recordExploration,
  recordFinding,
  compressForLlm,
} from './rlm-context.js';

// Executor
export {
  PipelineExecutor,
  type ExecutorServices,
} from './executor.js';

// CLI Interface
export {
  BqlCli,
  createBqlCli,
} from './cli.js';
