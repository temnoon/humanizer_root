/**
 * BQL CLI / AUI Interface
 *
 * Provides both structured CLI commands and natural language (AUI) interaction.
 * The AUI mode uses the LLM to interpret natural language and generate BQL pipelines.
 */

import type { LlmAdapter } from '../llm/types.js';
import type {
  CliCommand,
  CliSession,
  CliResponse,
  Pipeline,
  PipelineResult,
  ExecutionOptions,
} from './types.js';
import { parseBql, toBql, BQL_HELP } from './parser.js';
import { PipelineExecutor, ExecutorServices } from './executor.js';
import { compressForLlm } from './rlm-context.js';

// ═══════════════════════════════════════════════════════════════════════════
// AUI Prompt Construction
// ═══════════════════════════════════════════════════════════════════════════

const AUI_SYSTEM_PROMPT = `You are an AI assistant that helps users work with their text archives using the Batch Query Language (BQL).

Your role is to:
1. Understand user requests in natural language
2. Generate appropriate BQL pipelines
3. Explain what the pipeline will do
4. Suggest refinements

BQL SYNTAX:
${BQL_HELP}

RESPONSE FORMAT:
When the user makes a request, respond with:

UNDERSTANDING: [Brief restatement of what user wants]
PIPELINE: [The BQL pipeline]
EXPLANATION: [What each step does]
ALTERNATIVES: [Optional alternative approaches]

Example:
User: "Find my old memories about summer vacations and make them sound more poetic"
UNDERSTANDING: Search for summer vacation content and apply literary transformation
PIPELINE: harvest "summer vacation memories" limit 20 | transform style=literary | save summer_poems
EXPLANATION:
- harvest: Searches archive for content matching "summer vacation memories"
- limit 20: Takes top 20 results
- transform style=literary: Applies literary prose style
- save: Stores results in "summer_poems" buffer
ALTERNATIVES:
- Add "| humanize moderate" before save to reduce AI-likeness
- Use "cluster by theme" to group related memories first`;

function createAuiPrompt(
  request: string,
  session: CliSession,
  contextHint?: string
): string {
  let prompt = `User request: "${request}"\n`;

  // Add context about available buffers
  if (session.workspace.buffers.size > 0) {
    prompt += `\nAvailable buffers: ${Array.from(session.workspace.buffers.keys()).join(', ')}`;
  }

  // Add context about recent commands
  if (session.history.length > 0) {
    const recent = session.history.slice(-3);
    prompt += `\nRecent commands:\n${recent.map(c => `- ${c.raw}`).join('\n')}`;
  }

  // Add optional context hint
  if (contextHint) {
    prompt += `\n\nContext: ${contextHint}`;
  }

  return prompt;
}

/**
 * Parse AUI response to extract pipeline.
 */
function parseAuiResponse(response: string): {
  understanding: string;
  pipeline: string;
  explanation: string;
  alternatives: string[];
} {
  const lines = response.split('\n');
  let understanding = '';
  let pipeline = '';
  let explanation = '';
  const alternatives: string[] = [];

  let currentSection = '';

  for (const line of lines) {
    if (line.startsWith('UNDERSTANDING:')) {
      currentSection = 'understanding';
      understanding = line.slice('UNDERSTANDING:'.length).trim();
    } else if (line.startsWith('PIPELINE:')) {
      currentSection = 'pipeline';
      pipeline = line.slice('PIPELINE:'.length).trim();
    } else if (line.startsWith('EXPLANATION:')) {
      currentSection = 'explanation';
    } else if (line.startsWith('ALTERNATIVES:')) {
      currentSection = 'alternatives';
    } else if (line.trim().startsWith('-') && currentSection === 'explanation') {
      explanation += line.trim() + '\n';
    } else if (line.trim().startsWith('-') && currentSection === 'alternatives') {
      alternatives.push(line.trim().slice(1).trim());
    } else if (currentSection === 'explanation' && line.trim()) {
      explanation += line.trim() + '\n';
    }
  }

  return { understanding, pipeline, explanation: explanation.trim(), alternatives };
}

// ═══════════════════════════════════════════════════════════════════════════
// CLI Interface
// ═══════════════════════════════════════════════════════════════════════════

export class BqlCli {
  private llm: LlmAdapter;
  private executor: PipelineExecutor;
  private session: CliSession;

  constructor(services: ExecutorServices) {
    this.llm = services.llm;
    this.executor = new PipelineExecutor(services);
    this.session = {
      id: `cli-${Date.now()}`,
      workspace: {
        buffers: new Map(),
        variables: new Map(),
      },
      history: [],
    };
  }

  /**
   * Process user input - either BQL or natural language.
   */
  async process(input: string, options: ExecutionOptions = {}): Promise<CliResponse> {
    const trimmed = input.trim();

    // Handle special commands
    if (trimmed === 'help' || trimmed === '?') {
      return this.showHelp();
    }

    if (trimmed === 'history') {
      return this.showHistory();
    }

    if (trimmed === 'buffers' || trimmed === 'ls') {
      return this.showBuffers();
    }

    if (trimmed.startsWith('clear')) {
      return this.clearBuffer(trimmed.slice(5).trim());
    }

    // Parse input
    const command = parseBql(trimmed);
    this.session.history.push(command);

    // Handle parse errors
    if (command.errors && command.errors.length > 0) {
      return {
        type: 'error',
        message: `Parse errors:\n${command.errors.join('\n')}`,
        suggestions: ['Try "help" for syntax reference'],
      };
    }

    // Handle natural language (AUI mode)
    if (command.naturalLanguage) {
      return this.processAui(command.naturalLanguage, options);
    }

    // Execute BQL pipeline
    if (command.pipeline) {
      return this.executePipeline(command.pipeline, options);
    }

    return {
      type: 'error',
      message: 'Could not parse input',
      suggestions: ['Use BQL syntax or ask in natural language'],
    };
  }

  /**
   * Process natural language request (AUI mode).
   */
  private async processAui(
    request: string,
    options: ExecutionOptions
  ): Promise<CliResponse> {
    try {
      // Get LLM to generate pipeline
      const prompt = createAuiPrompt(request, this.session);
      const response = await this.llm.complete(AUI_SYSTEM_PROMPT, prompt);

      // Parse the response
      const parsed = parseAuiResponse(response);

      // Parse the generated pipeline
      const command = parseBql(parsed.pipeline);

      if (command.errors && command.errors.length > 0) {
        return {
          type: 'error',
          message: `LLM generated invalid pipeline: ${parsed.pipeline}\nErrors: ${command.errors.join(', ')}`,
          suggestions: parsed.alternatives,
        };
      }

      if (!command.pipeline) {
        return {
          type: 'error',
          message: 'LLM did not generate a valid pipeline',
          data: { understanding: parsed.understanding, explanation: parsed.explanation },
        };
      }

      // Show what we're about to do
      const preview: CliResponse = {
        type: 'info',
        message: `Understanding: ${parsed.understanding}\n\nGenerated pipeline:\n  ${parsed.pipeline}\n\n${parsed.explanation}`,
        suggestions: parsed.alternatives.length > 0
          ? ['Alternatives:', ...parsed.alternatives]
          : undefined,
        awaitInput: !options.dryRun,
      };

      // If dry run, just return preview
      if (options.dryRun) {
        return preview;
      }

      // Execute the pipeline
      const result = await this.executor.execute(command.pipeline, options);

      // Update session with results
      if (result.success && result.output.length > 0) {
        this.session.workspace.buffers.set('_last', result.output);
      }

      return this.formatPipelineResult(result, parsed.explanation);
    } catch (error) {
      return {
        type: 'error',
        message: `AUI error: ${error}`,
        suggestions: ['Try using BQL syntax directly'],
      };
    }
  }

  /**
   * Execute a parsed BQL pipeline.
   */
  private async executePipeline(
    pipeline: Pipeline,
    options: ExecutionOptions
  ): Promise<CliResponse> {
    try {
      const result = await this.executor.execute(pipeline, options);

      // Update session
      if (result.success && result.output.length > 0) {
        this.session.workspace.buffers.set('_last', result.output);
      }

      return this.formatPipelineResult(result);
    } catch (error) {
      return {
        type: 'error',
        message: `Execution error: ${error}`,
      };
    }
  }

  /**
   * Format pipeline result for display.
   */
  private formatPipelineResult(result: PipelineResult, explanation?: string): CliResponse {
    if (!result.success) {
      return {
        type: 'error',
        message: `Pipeline failed: ${result.error}`,
        data: {
          stepsExecuted: result.stats.stepsExecuted,
          stepsFailed: result.stats.stepsFailed,
        },
      };
    }

    // Summarize results
    const summary = [
      `✓ Pipeline completed in ${result.stats.totalDurationMs}ms`,
      `  Steps: ${result.stats.stepsExecuted}`,
      `  Output: ${result.output.length} items`,
    ];

    if (result.stats.totalTokensUsed > 0) {
      summary.push(`  Tokens used: ~${result.stats.totalTokensUsed}`);
    }

    // Step breakdown
    const stepSummary = result.stepResults.map((sr, i) =>
      `  ${i + 1}. ${sr.step.op}: ${sr.meta.inputCount} → ${sr.meta.outputCount} (${sr.meta.durationMs}ms)`
    );

    // Preview output
    let outputPreview = '';
    if (result.output.length > 0) {
      const compressed = compressForLlm(result.output, {
        contentType: 'results',
        maxTokens: 500,
        strategy: 'auto',
      });
      outputPreview = `\nOutput preview:\n${compressed.content}`;
    }

    return {
      type: 'result',
      message: [
        ...summary,
        '',
        'Steps:',
        ...stepSummary,
        outputPreview,
      ].join('\n'),
      data: result.output,
      suggestions: [
        'Use "buffers" to see saved data',
        'Use "load _last" to work with results',
      ],
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Built-in Commands
  // ═══════════════════════════════════════════════════════════════════════════

  private showHelp(): CliResponse {
    return {
      type: 'help',
      message: BQL_HELP,
      suggestions: [
        'Try: harvest "memories" | limit 10 | print',
        'Or ask in natural language: "find my old vacation stories"',
      ],
    };
  }

  private showHistory(): CliResponse {
    if (this.session.history.length === 0) {
      return {
        type: 'info',
        message: 'No command history',
      };
    }

    const history = this.session.history
      .slice(-20)
      .map((c, i) => `${i + 1}. ${c.raw}`)
      .join('\n');

    return {
      type: 'info',
      message: `Recent commands:\n${history}`,
    };
  }

  private showBuffers(): CliResponse {
    if (this.session.workspace.buffers.size === 0) {
      return {
        type: 'info',
        message: 'No buffers stored',
        suggestions: ['Save results with: ... | save my_buffer'],
      };
    }

    const buffers = Array.from(this.session.workspace.buffers.entries())
      .map(([name, data]) => `  ${name}: ${data.length} items`)
      .join('\n');

    return {
      type: 'info',
      message: `Stored buffers:\n${buffers}`,
      suggestions: ['Load with: load buffer_name | ...'],
    };
  }

  private clearBuffer(name: string): CliResponse {
    if (!name) {
      this.session.workspace.buffers.clear();
      return {
        type: 'info',
        message: 'All buffers cleared',
      };
    }

    if (this.session.workspace.buffers.has(name)) {
      this.session.workspace.buffers.delete(name);
      return {
        type: 'info',
        message: `Buffer "${name}" cleared`,
      };
    }

    return {
      type: 'error',
      message: `Buffer "${name}" not found`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Session Management
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get current session state.
   */
  getSession(): CliSession {
    return this.session;
  }

  /**
   * Set a buffer directly.
   */
  setBuffer(name: string, data: unknown[]): void {
    this.session.workspace.buffers.set(name, data);
  }

  /**
   * Get a buffer.
   */
  getBuffer(name: string): unknown[] | undefined {
    return this.session.workspace.buffers.get(name);
  }

  /**
   * Reset session.
   */
  reset(): void {
    this.session = {
      id: `cli-${Date.now()}`,
      workspace: {
        buffers: new Map(),
        variables: new Map(),
      },
      history: [],
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Factory
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a BQL CLI instance.
 */
export function createBqlCli(services: ExecutorServices): BqlCli {
  return new BqlCli(services);
}
