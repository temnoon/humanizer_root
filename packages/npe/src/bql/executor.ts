/**
 * BQL Pipeline Executor
 *
 * Executes parsed BQL pipelines, integrating with humanizer,
 * transformations, and storage services.
 */

import type { LlmAdapter } from '../llm/types.js';
import type {
  Pipeline,
  PipelineStep,
  PipelineResult,
  StepResult,
  ExecutionOptions,
  RlmSession,
} from './types.js';
import {
  createRlmSession,
  generateRlmPrompt,
  parseRlmResponse,
  executeFilterExpression,
  recordExploration,
  recordFinding,
  compressForLlm,
} from './rlm-context.js';
import { HumanizerService } from '../humanizer/humanizer.js';
import { detect } from '../humanizer/detector.js';
import { TransformerService } from '../transformations/transformer.js';
import { BUILTIN_PERSONAS, BUILTIN_STYLES, BUILTIN_NAMESPACES } from '../transformations/types.js';

// ═══════════════════════════════════════════════════════════════════════════
// Executor Context
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Services available to the executor.
 */
export interface ExecutorServices {
  llm: LlmAdapter;
  humanizer?: HumanizerService;
  transformer?: TransformerService;
  storage?: {
    search: (query: string, limit?: number) => Promise<unknown[]>;
    load: (name: string) => Promise<unknown[]>;
    save: (name: string, data: unknown[]) => Promise<void>;
  };
}

/**
 * Runtime context during execution.
 */
interface ExecutionContext {
  /** Current data flowing through pipeline */
  data: unknown[];
  /** Named buffers */
  buffers: Map<string, unknown[]>;
  /** Variables */
  variables: Map<string, unknown>;
  /** RLM session if in exploration mode */
  rlmSession?: RlmSession;
  /** Execution log */
  log: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Pipeline Executor
// ═══════════════════════════════════════════════════════════════════════════

export class PipelineExecutor {
  private services: ExecutorServices;
  private humanizer: HumanizerService;
  private transformer: TransformerService;

  constructor(services: ExecutorServices) {
    this.services = services;
    this.humanizer = services.humanizer ?? new HumanizerService(services.llm);
    this.transformer = services.transformer ?? new TransformerService(services.llm);
  }

  /**
   * Execute a complete pipeline.
   */
  async execute(pipeline: Pipeline, options: ExecutionOptions = {}): Promise<PipelineResult> {
    const startTime = Date.now();
    const stepResults: StepResult[] = [];
    let totalTokensUsed = 0;

    const context: ExecutionContext = {
      data: [],
      buffers: new Map(),
      variables: new Map(Object.entries(pipeline.inputs ?? {})),
      log: [],
    };

    if (options.verbose) {
      context.log.push(`Starting pipeline: ${pipeline.name}`);
    }

    // Dry run validation
    if (options.dryRun) {
      return this.validatePipeline(pipeline);
    }

    try {
      for (let i = 0; i < pipeline.steps.length; i++) {
        const step = pipeline.steps[i];

        if (options.verbose) {
          context.log.push(`Step ${i + 1}/${pipeline.steps.length}: ${step.op}`);
        }

        const stepStart = Date.now();
        const inputCount = context.data.length;

        // Execute step
        const result = await this.executeStep(step, context, options);

        // Update context with result
        context.data = result.data;

        // Handle 'as' alias
        if (step.as) {
          context.buffers.set(step.as, result.data);
        }

        const stepResult: StepResult = {
          step,
          data: result.data,
          meta: {
            inputCount,
            outputCount: result.data.length,
            durationMs: Date.now() - stepStart,
            tokensUsed: result.tokensUsed,
          },
          errors: result.errors,
        };

        stepResults.push(stepResult);
        totalTokensUsed += result.tokensUsed ?? 0;

        // Check for errors
        if (result.errors && result.errors.length > 0) {
          if (options.verbose) {
            context.log.push(`  Errors: ${result.errors.join(', ')}`);
          }
        }

        // Check limits
        if (options.maxItems && context.data.length > options.maxItems) {
          context.data = context.data.slice(0, options.maxItems);
        }
      }

      return {
        pipeline,
        stepResults,
        output: context.data,
        stats: {
          totalDurationMs: Date.now() - startTime,
          totalTokensUsed,
          stepsExecuted: stepResults.length,
          stepsFailed: stepResults.filter(r => r.errors?.length).length,
        },
        success: true,
      };
    } catch (error) {
      return {
        pipeline,
        stepResults,
        output: [],
        stats: {
          totalDurationMs: Date.now() - startTime,
          totalTokensUsed,
          stepsExecuted: stepResults.length,
          stepsFailed: stepResults.filter(r => r.errors?.length).length + 1,
        },
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Execute a single pipeline step.
   */
  private async executeStep(
    step: PipelineStep,
    context: ExecutionContext,
    options: ExecutionOptions
  ): Promise<{ data: unknown[]; tokensUsed?: number; errors?: string[] }> {
    switch (step.op) {
      // Source operations
      case 'harvest':
        return this.executeHarvest(step, context);
      case 'load':
        return this.executeLoad(step, context);
      case 'generate':
        return this.executeGenerate(step, context);

      // Filter operations
      case 'filter':
        return this.executeFilter(step, context);
      case 'limit':
        return this.executeLimit(step, context);
      case 'select':
        return this.executeSelect(step, context);
      case 'sample':
        return this.executeSample(step, context);
      case 'dedupe':
        return this.executeDedupe(step, context);

      // Transform operations
      case 'transform':
        return this.executeTransform(step, context);
      case 'humanize':
        return this.executeHumanize(step, context);

      // Analysis operations
      case 'detect':
        return this.executeDetect(step, context);
      case 'cluster':
        return this.executeCluster(step, context);
      case 'summarize':
        return this.executeSummarize(step, context);

      // Aggregate operations
      case 'sort':
        return this.executeSort(step, context);
      case 'group':
        return this.executeGroup(step, context);

      // Output operations
      case 'save':
        return this.executeSave(step, context);
      case 'print':
        return this.executePrint(step, context);

      // RLM operations
      case 'rlm':
        return this.executeRlm(step, context, options);

      default:
        return { data: context.data, errors: [`Unknown operation: ${step.op}`] };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Source Operations
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeHarvest(
    step: PipelineStep,
    context: ExecutionContext
  ): Promise<{ data: unknown[]; errors?: string[] }> {
    const query = step.params.query as string;
    const limit = step.params.limit as number | undefined;

    if (!this.services.storage?.search) {
      return { data: [], errors: ['Storage service not configured'] };
    }

    try {
      const results = await this.services.storage.search(query, limit);
      return { data: results };
    } catch (error) {
      return { data: [], errors: [String(error)] };
    }
  }

  private async executeLoad(
    step: PipelineStep,
    context: ExecutionContext
  ): Promise<{ data: unknown[]; errors?: string[] }> {
    const name = step.params.query as string ?? step.params.name as string;

    // Check local buffers first
    if (context.buffers.has(name)) {
      return { data: context.buffers.get(name)! };
    }

    // Try storage
    if (this.services.storage?.load) {
      try {
        const data = await this.services.storage.load(name);
        return { data };
      } catch (error) {
        return { data: [], errors: [String(error)] };
      }
    }

    return { data: [], errors: [`Buffer not found: ${name}`] };
  }

  private async executeGenerate(
    step: PipelineStep,
    context: ExecutionContext
  ): Promise<{ data: unknown[]; tokensUsed?: number }> {
    const prompt = step.params.query as string;

    const response = await this.services.llm.complete(
      'You are a helpful assistant.',
      prompt
    );

    return {
      data: [{ text: response, generated: true }],
      tokensUsed: Math.ceil(response.length / 4),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Filter Operations
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeFilter(
    step: PipelineStep,
    context: ExecutionContext
  ): Promise<{ data: unknown[] }> {
    const data = context.data;

    // Build filter predicate from params
    const predicates: Array<(item: unknown) => boolean> = [];

    for (const [key, value] of Object.entries(step.params)) {
      if (key.includes('_>')) {
        const field = key.replace('_>', '');
        predicates.push((item) => {
          const v = (item as Record<string, unknown>)[field];
          return typeof v === 'number' && v > (value as number);
        });
      } else if (key.includes('_<')) {
        const field = key.replace('_<', '');
        predicates.push((item) => {
          const v = (item as Record<string, unknown>)[field];
          return typeof v === 'number' && v < (value as number);
        });
      } else if (key.includes('_>=')) {
        const field = key.replace('_>=', '');
        predicates.push((item) => {
          const v = (item as Record<string, unknown>)[field];
          return typeof v === 'number' && v >= (value as number);
        });
      } else if (key.includes('_==')) {
        const field = key.replace('_==', '');
        predicates.push((item) => {
          const v = (item as Record<string, unknown>)[field];
          return v === value;
        });
      }
    }

    if (predicates.length === 0) {
      return { data };
    }

    const filtered = data.filter((item) =>
      predicates.every((pred) => pred(item))
    );

    return { data: filtered };
  }

  private async executeLimit(
    step: PipelineStep,
    context: ExecutionContext
  ): Promise<{ data: unknown[] }> {
    const limit = step.params.query as number ?? step.params.limit as number ?? 10;
    return { data: context.data.slice(0, limit) };
  }

  private async executeSelect(
    step: PipelineStep,
    context: ExecutionContext
  ): Promise<{ data: unknown[] }> {
    const fields = (step.params.query as string)?.split(',').map(s => s.trim()) ?? [];

    if (fields.length === 0) {
      return { data: context.data };
    }

    const selected = context.data.map((item) => {
      const obj = item as Record<string, unknown>;
      const result: Record<string, unknown> = {};
      for (const field of fields) {
        if (field in obj) {
          result[field] = obj[field];
        }
      }
      return result;
    });

    return { data: selected };
  }

  private async executeSample(
    step: PipelineStep,
    context: ExecutionContext
  ): Promise<{ data: unknown[] }> {
    const count = step.params.query as number ?? 10;
    const shuffled = [...context.data].sort(() => Math.random() - 0.5);
    return { data: shuffled.slice(0, count) };
  }

  private async executeDedupe(
    step: PipelineStep,
    context: ExecutionContext
  ): Promise<{ data: unknown[] }> {
    const seen = new Set<string>();
    const deduped = context.data.filter((item) => {
      const key = JSON.stringify(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return { data: deduped };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Transform Operations
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeTransform(
    step: PipelineStep,
    context: ExecutionContext
  ): Promise<{ data: unknown[]; tokensUsed?: number }> {
    const persona = step.params.persona as string;
    const style = step.params.style as string;
    const ns = step.params.ns as string ?? step.params.namespace as string;

    let tokensUsed = 0;
    const results: unknown[] = [];

    for (const item of context.data) {
      const text = extractText(item);
      if (!text) {
        results.push(item);
        continue;
      }

      let transformed = text;

      if (persona && BUILTIN_PERSONAS[persona]) {
        const result = await this.transformer.transformPersona(
          transformed,
          BUILTIN_PERSONAS[persona]
        );
        transformed = result.text;
        tokensUsed += Math.ceil(transformed.length / 4);
      }

      if (style && BUILTIN_STYLES[style]) {
        const result = await this.transformer.transformStyle(
          transformed,
          BUILTIN_STYLES[style]
        );
        transformed = result.text;
        tokensUsed += Math.ceil(transformed.length / 4);
      }

      if (ns && BUILTIN_NAMESPACES[ns]) {
        const result = await this.transformer.transformNamespace(
          transformed,
          BUILTIN_NAMESPACES[ns]
        );
        transformed = result.text;
        tokensUsed += Math.ceil(transformed.length / 4);
      }

      results.push({ ...item as object, text: transformed, transformed: true });
    }

    return { data: results, tokensUsed };
  }

  private async executeHumanize(
    step: PipelineStep,
    context: ExecutionContext
  ): Promise<{ data: unknown[]; tokensUsed?: number }> {
    const intensity = (step.params.query ?? step.params.intensity ?? 'moderate') as
      'light' | 'moderate' | 'aggressive';

    let tokensUsed = 0;
    const results: unknown[] = [];

    for (const item of context.data) {
      const text = extractText(item);
      if (!text) {
        results.push(item);
        continue;
      }

      const result = await this.humanizer.humanize(text, { intensity });
      tokensUsed += Math.ceil(result.humanizedText.length / 4);

      results.push({
        ...item as object,
        text: result.humanizedText,
        humanized: true,
        improvement: result.improvement,
      });
    }

    return { data: results, tokensUsed };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Analysis Operations
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeDetect(
    step: PipelineStep,
    context: ExecutionContext
  ): Promise<{ data: unknown[] }> {
    const results = context.data.map((item) => {
      const text = extractText(item);
      if (!text) return item;

      const detection = detect(text);
      return {
        ...item as object,
        detection: {
          aiLikelihood: detection.aiLikelihood,
          verdict: detection.verdict,
          confidence: detection.confidence,
        },
      };
    });

    return { data: results };
  }

  private async executeCluster(
    step: PipelineStep,
    context: ExecutionContext
  ): Promise<{ data: unknown[] }> {
    // Simple clustering by keyword/theme (placeholder for real clustering)
    const by = step.params.by as string ?? 'theme';

    // Group by first significant word for now
    const groups = new Map<string, unknown[]>();

    for (const item of context.data) {
      const text = extractText(item);
      if (!text) continue;

      const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 4);
      const key = words[0] ?? 'other';

      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    const clustered = Array.from(groups.entries()).map(([cluster, items]) => ({
      cluster,
      items,
      count: items.length,
    }));

    return { data: clustered };
  }

  private async executeSummarize(
    step: PipelineStep,
    context: ExecutionContext
  ): Promise<{ data: unknown[]; tokensUsed?: number }> {
    // Combine all text and summarize
    const texts = context.data.map(extractText).filter(Boolean);
    const combined = texts.join('\n\n');

    const response = await this.services.llm.complete(
      'You are a summarization assistant. Provide concise summaries.',
      `Summarize the following content:\n\n${combined}`
    );

    return {
      data: [{ summary: response, sourceCount: texts.length }],
      tokensUsed: Math.ceil(response.length / 4),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Aggregate Operations
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeSort(
    step: PipelineStep,
    context: ExecutionContext
  ): Promise<{ data: unknown[] }> {
    const by = step.params.by as string ?? step.params.query as string;
    const desc = step.params.desc === true || step.params.order === 'desc';

    if (!by) return { data: context.data };

    const sorted = [...context.data].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[by];
      const bVal = (b as Record<string, unknown>)[by];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return desc ? bVal - aVal : aVal - bVal;
      }

      const aStr = String(aVal ?? '');
      const bStr = String(bVal ?? '');
      return desc ? bStr.localeCompare(aStr) : aStr.localeCompare(bStr);
    });

    return { data: sorted };
  }

  private async executeGroup(
    step: PipelineStep,
    context: ExecutionContext
  ): Promise<{ data: unknown[] }> {
    const by = step.params.by as string ?? step.params.query as string;

    if (!by) return { data: context.data };

    const groups = new Map<string, unknown[]>();

    for (const item of context.data) {
      const key = String((item as Record<string, unknown>)[by] ?? 'undefined');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    const grouped = Array.from(groups.entries()).map(([key, items]) => ({
      [by]: key,
      items,
      count: items.length,
    }));

    return { data: grouped };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Output Operations
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeSave(
    step: PipelineStep,
    context: ExecutionContext
  ): Promise<{ data: unknown[]; errors?: string[] }> {
    const name = step.params.query as string ?? step.params.name as string ?? 'default';

    context.buffers.set(name, context.data);

    if (this.services.storage?.save) {
      try {
        await this.services.storage.save(name, context.data);
      } catch (error) {
        return { data: context.data, errors: [String(error)] };
      }
    }

    return { data: context.data };
  }

  private async executePrint(
    step: PipelineStep,
    context: ExecutionContext
  ): Promise<{ data: unknown[] }> {
    // In a real CLI, this would output to console
    context.log.push(`PRINT: ${JSON.stringify(context.data, null, 2)}`);
    return { data: context.data };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RLM Operations
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeRlm(
    step: PipelineStep,
    context: ExecutionContext,
    options: ExecutionOptions
  ): Promise<{ data: unknown[]; tokensUsed?: number }> {
    const task = step.params.query as string;
    const maxIterations = step.params.maxIterations as number ?? 5;

    // Initialize RLM session
    let session = createRlmSession(context.data, 'items');
    let tokensUsed = 0;
    let currentData = context.data;

    for (let i = 0; i < maxIterations; i++) {
      // Generate prompt with metadata
      const prompt = generateRlmPrompt(session, task);

      // Get LLM response
      const response = await this.services.llm.complete(
        'You are exploring a dataset using recursive queries. Respond in the specified format.',
        prompt
      );
      tokensUsed += Math.ceil(response.length / 4);

      // Parse response
      const parsed = parseRlmResponse(response);

      // Execute filter expression
      const { results, error } = executeFilterExpression(currentData, parsed.expression);

      if (error) {
        context.log.push(`RLM iteration ${i + 1}: Error - ${error}`);
        continue;
      }

      // Record exploration
      session = recordExploration(session, {
        reasoning: parsed.reasoning,
        expression: parsed.expression,
        drillDeeper: parsed.drillDeeper,
      }, results);

      // Record finding if present
      if (parsed.finding) {
        session = recordFinding(session, {
          content: results,
          relevance: 1.0,
          explanation: parsed.finding,
        });
      }

      context.log.push(
        `RLM iteration ${i + 1}: ${parsed.reasoning} → ${results.length} results`
      );

      // Update current data if drilling deeper
      if (parsed.drillDeeper && results.length > 0) {
        currentData = results;
      } else {
        // Done exploring
        break;
      }
    }

    // Return findings or final filtered data
    if (session.findings.length > 0) {
      return {
        data: session.findings.map(f => f.content).flat() as unknown[],
        tokensUsed,
      };
    }

    return { data: currentData, tokensUsed };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Validation
  // ═══════════════════════════════════════════════════════════════════════════

  private validatePipeline(pipeline: Pipeline): PipelineResult {
    const errors: string[] = [];

    for (const step of pipeline.steps) {
      // Validate operation exists
      const validOps = [
        'harvest', 'load', 'fetch', 'generate',
        'filter', 'select', 'limit', 'sample', 'dedupe',
        'transform', 'humanize', 'chunk', 'merge', 'annotate',
        'detect', 'cluster', 'summarize', 'extract',
        'group', 'sort', 'join', 'union',
        'save', 'export', 'book', 'print',
        'branch', 'loop', 'parallel', 'rlm',
      ];

      if (!validOps.includes(step.op)) {
        errors.push(`Invalid operation: ${step.op}`);
      }
    }

    return {
      pipeline,
      stepResults: [],
      output: [],
      stats: {
        totalDurationMs: 0,
        totalTokensUsed: 0,
        stepsExecuted: 0,
        stepsFailed: errors.length,
      },
      success: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════════

function extractText(item: unknown): string | undefined {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    return (obj.text ?? obj.content ?? obj.body ?? obj.message) as string | undefined;
  }
  return undefined;
}
