/**
 * AUI (Ambient User Interface) Handlers
 *
 * MCP tool handlers for natural language interaction with the humanizer archive.
 * Uses BQL (Batch Query Language) with LLM-powered interpretation via Ollama.
 *
 * Session Management:
 * - A singleton BqlCli instance maintains session state across requests
 * - Buffers persist until explicitly cleared or session reset
 * - Command history is tracked for context in NL interpretation
 */

import type { MCPResult } from '../types.js';

// Lazy-loaded NPE components
let BqlCli: typeof import('@humanizer/npe').BqlCli | null = null;
let OllamaAdapter: typeof import('@humanizer/npe').OllamaAdapter | null = null;
let parseBql: typeof import('@humanizer/npe').parseBql | null = null;
let BQL_HELP: string | null = null;
let BUILTIN_PERSONAS: typeof import('@humanizer/npe').BUILTIN_PERSONAS | null = null;
let BUILTIN_STYLES: typeof import('@humanizer/npe').BUILTIN_STYLES | null = null;

// Singleton instances
let adapter: InstanceType<typeof import('@humanizer/npe').OllamaAdapter> | null = null;
let cli: InstanceType<typeof import('@humanizer/npe').BqlCli> | null = null;

// ═══════════════════════════════════════════════════════════════════
// LAZY LOADING & SESSION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

async function ensureNpeLoaded(): Promise<void> {
  if (!BqlCli) {
    const npe = await import('@humanizer/npe');
    BqlCli = npe.BqlCli;
    OllamaAdapter = npe.OllamaAdapter;
    parseBql = npe.parseBql;
    BQL_HELP = npe.BQL_HELP;
    BUILTIN_PERSONAS = npe.BUILTIN_PERSONAS;
    BUILTIN_STYLES = npe.BUILTIN_STYLES;
  }
}

async function getCli(): Promise<InstanceType<typeof import('@humanizer/npe').BqlCli>> {
  await ensureNpeLoaded();

  if (!cli) {
    adapter = new OllamaAdapter!();

    const isAvailable = await adapter.isAvailable();
    if (!isAvailable) {
      throw new Error('Ollama is not available. Please ensure Ollama is running on localhost:11434');
    }

    cli = new BqlCli!({
      llm: adapter,
      // Storage bridge would be added here for full archive access
      // storage: createStorageBridge(contentStore, embedder),
    });
  }

  return cli;
}

// ═══════════════════════════════════════════════════════════════════
// RESULT HELPERS
// ═══════════════════════════════════════════════════════════════════

function jsonResult(data: unknown): MCPResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message: string): MCPResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

// ═══════════════════════════════════════════════════════════════════
// CORE AUI HANDLERS
// ═══════════════════════════════════════════════════════════════════

interface AuiQueryInput {
  request: string;
  dryRun?: boolean;
  maxItems?: number;
  verbose?: boolean;
}

export async function handleAuiQuery(args: AuiQueryInput): Promise<MCPResult> {
  try {
    if (!args.request || args.request.length < 5) {
      return errorResult('Request must be at least 5 characters');
    }

    const bqlCli = await getCli();

    const response = await bqlCli.process(args.request, {
      dryRun: args.dryRun ?? false,
      maxItems: args.maxItems ?? 100,
      verbose: args.verbose ?? false,
    });

    return jsonResult({
      type: response.type,
      message: response.message,
      data: response.data ? summarizeData(response.data) : undefined,
      suggestions: response.suggestions,
      awaitInput: response.awaitInput,
    });
  } catch (err) {
    return errorResult(`AUI query failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

interface BqlExecuteInput {
  pipeline: string;
  dryRun?: boolean;
  maxItems?: number;
  verbose?: boolean;
}

export async function handleBqlExecute(args: BqlExecuteInput): Promise<MCPResult> {
  try {
    if (!args.pipeline || args.pipeline.length < 3) {
      return errorResult('Pipeline must be at least 3 characters');
    }

    const bqlCli = await getCli();

    // Process the pipeline directly (BQL syntax, not natural language)
    const response = await bqlCli.process(args.pipeline, {
      dryRun: args.dryRun ?? false,
      maxItems: args.maxItems ?? 100,
      verbose: args.verbose ?? false,
    });

    return jsonResult({
      type: response.type,
      message: response.message,
      data: response.data ? summarizeData(response.data) : undefined,
      suggestions: response.suggestions,
    });
  } catch (err) {
    return errorResult(`BQL execution failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

interface BqlParseInput {
  request: string;
}

export async function handleBqlParse(args: BqlParseInput): Promise<MCPResult> {
  try {
    if (!args.request || args.request.length < 5) {
      return errorResult('Request must be at least 5 characters');
    }

    const bqlCli = await getCli();

    // Process with dry run to get the generated pipeline without executing
    const response = await bqlCli.process(args.request, {
      dryRun: true,
    });

    return jsonResult({
      type: response.type,
      message: response.message,
      suggestions: response.suggestions,
      note: 'This is a dry run - use aui_query with dryRun=false to execute',
    });
  } catch (err) {
    return errorResult(`BQL parse failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// SESSION MANAGEMENT HANDLERS
// ═══════════════════════════════════════════════════════════════════

export async function handleAuiBuffers(): Promise<MCPResult> {
  try {
    const bqlCli = await getCli();
    const session = bqlCli.getSession();

    const buffers = Array.from(session.workspace.buffers.entries()).map(([name, data]) => ({
      name,
      itemCount: Array.isArray(data) ? data.length : 1,
      preview: Array.isArray(data) && data.length > 0
        ? summarizeItem(data[0])
        : undefined,
    }));

    return jsonResult({
      buffers,
      count: buffers.length,
      message: buffers.length === 0
        ? 'No buffers stored. Save results with: ... | save buffer_name'
        : `${buffers.length} buffer(s) available`,
    });
  } catch (err) {
    return errorResult(`List buffers failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

interface AuiBufferGetInput {
  name: string;
  limit?: number;
  offset?: number;
}

export async function handleAuiBufferGet(args: AuiBufferGetInput): Promise<MCPResult> {
  try {
    if (!args.name) {
      return errorResult('Buffer name is required');
    }

    const bqlCli = await getCli();
    const data = bqlCli.getBuffer(args.name);

    if (!data) {
      return errorResult(`Buffer "${args.name}" not found`);
    }

    const limit = args.limit ?? 10;
    const offset = args.offset ?? 0;
    const items = Array.isArray(data) ? data.slice(offset, offset + limit) : [data];

    return jsonResult({
      name: args.name,
      totalItems: Array.isArray(data) ? data.length : 1,
      offset,
      limit,
      items: items.map(summarizeItem),
    });
  } catch (err) {
    return errorResult(`Get buffer failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

interface AuiBufferSetInput {
  name: string;
  data: unknown[];
}

export async function handleAuiBufferSet(args: AuiBufferSetInput): Promise<MCPResult> {
  try {
    if (!args.name) {
      return errorResult('Buffer name is required');
    }

    if (!Array.isArray(args.data)) {
      return errorResult('Data must be an array');
    }

    const bqlCli = await getCli();
    bqlCli.setBuffer(args.name, args.data);

    return jsonResult({
      success: true,
      name: args.name,
      itemCount: args.data.length,
      message: `Buffer "${args.name}" set with ${args.data.length} items`,
    });
  } catch (err) {
    return errorResult(`Set buffer failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

interface AuiBufferClearInput {
  name?: string;
}

export async function handleAuiBufferClear(args: AuiBufferClearInput): Promise<MCPResult> {
  try {
    const bqlCli = await getCli();
    const response = await bqlCli.process(args.name ? `clear ${args.name}` : 'clear');

    return jsonResult({
      type: response.type,
      message: response.message,
    });
  } catch (err) {
    return errorResult(`Clear buffer failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

interface AuiHistoryInput {
  limit?: number;
}

export async function handleAuiHistory(args: AuiHistoryInput): Promise<MCPResult> {
  try {
    const bqlCli = await getCli();
    const session = bqlCli.getSession();

    const limit = args.limit ?? 10;
    const history = session.history.slice(-limit).map((cmd, i) => ({
      index: session.history.length - limit + i + 1,
      command: cmd.raw,
      wasBql: !!cmd.pipeline,
      wasNaturalLanguage: !!cmd.naturalLanguage,
    }));

    return jsonResult({
      history,
      total: session.history.length,
      showing: history.length,
    });
  } catch (err) {
    return errorResult(`Get history failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function handleAuiReset(): Promise<MCPResult> {
  try {
    const bqlCli = await getCli();
    bqlCli.reset();

    return jsonResult({
      success: true,
      message: 'AUI session reset. All buffers and history cleared.',
    });
  } catch (err) {
    return errorResult(`Reset failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// RLM EXPLORATION HANDLERS
// ═══════════════════════════════════════════════════════════════════

interface RlmExploreInput {
  task: string;
  maxDepth?: number;
  maxExplorations?: number;
}

export async function handleRlmExplore(args: RlmExploreInput): Promise<MCPResult> {
  try {
    if (!args.task || args.task.length < 10) {
      return errorResult('Task must be at least 10 characters');
    }

    const bqlCli = await getCli();

    // Use the RLM operation in BQL
    const pipeline = `rlm "${args.task.replace(/"/g, '\\"')}"`;
    const response = await bqlCli.process(pipeline, {
      maxItems: args.maxExplorations ?? 10,
    });

    return jsonResult({
      type: response.type,
      message: response.message,
      data: response.data ? summarizeData(response.data) : undefined,
      suggestions: response.suggestions,
      note: 'RLM exploration uses metadata-first queries to navigate large datasets',
    });
  } catch (err) {
    return errorResult(`RLM exploration failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

interface RlmFindingsInput {
  limit?: number;
  minRelevance?: number;
}

export async function handleRlmFindings(args: RlmFindingsInput): Promise<MCPResult> {
  try {
    const bqlCli = await getCli();
    const session = bqlCli.getSession();

    if (!session.rlmSession) {
      return jsonResult({
        findings: [],
        message: 'No RLM session active. Start one with rlm_explore.',
      });
    }

    const limit = args.limit ?? 10;
    const minRelevance = args.minRelevance ?? 0.5;

    const findings = session.rlmSession.findings
      .filter(f => f.relevance >= minRelevance)
      .slice(0, limit)
      .map(f => ({
        content: summarizeItem(f.content),
        path: f.path,
        relevance: f.relevance,
        explanation: f.explanation,
      }));

    return jsonResult({
      findings,
      total: session.rlmSession.findings.length,
      showing: findings.length,
      explorationCount: session.rlmSession.explorations.length,
    });
  } catch (err) {
    return errorResult(`Get findings failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// HELP HANDLERS
// ═══════════════════════════════════════════════════════════════════

interface BqlHelpInput {
  topic?: 'syntax' | 'operations' | 'examples' | 'personas' | 'styles';
}

export async function handleBqlHelp(args: BqlHelpInput): Promise<MCPResult> {
  try {
    await ensureNpeLoaded();

    if (!args.topic || args.topic === 'syntax') {
      return jsonResult({
        topic: 'syntax',
        help: BQL_HELP,
      });
    }

    if (args.topic === 'operations') {
      return jsonResult({
        topic: 'operations',
        categories: {
          source: ['harvest', 'load', 'fetch', 'generate'],
          filter: ['filter', 'select', 'limit', 'sample', 'dedupe'],
          transform: ['transform', 'humanize', 'chunk', 'merge', 'annotate'],
          analysis: ['detect', 'cluster', 'summarize', 'extract'],
          aggregate: ['group', 'sort', 'join', 'union'],
          output: ['save', 'export', 'book', 'print'],
          control: ['rlm', 'branch', 'loop', 'parallel'],
        },
      });
    }

    if (args.topic === 'examples') {
      return jsonResult({
        topic: 'examples',
        examples: [
          {
            description: 'Search and save',
            bql: 'harvest "childhood memories" | limit 20 | save childhood',
          },
          {
            description: 'Transform with persona',
            bql: 'load childhood | transform persona=romantic style=literary | save poetic_childhood',
          },
          {
            description: 'Humanize content',
            bql: 'harvest "tech notes" | humanize moderate | save humanized_notes',
          },
          {
            description: 'Filter by quality',
            bql: 'harvest "work" | filter quality > 0.7 | limit 50 | save quality_work',
          },
          {
            description: 'Cluster and analyze',
            bql: 'harvest "memories" limit 100 | cluster | save memory_themes',
          },
          {
            description: 'AI detection',
            bql: 'load draft | detect | filter aiLikelihood > 0.5 | save needs_humanizing',
          },
        ],
      });
    }

    if (args.topic === 'personas') {
      const personas = Object.keys(BUILTIN_PERSONAS ?? {});
      return jsonResult({
        topic: 'personas',
        available: personas,
        usage: 'transform persona=PERSONA_NAME',
        description: 'Personas define WHO perceives/narrates - worldview, attention patterns, epistemics',
      });
    }

    if (args.topic === 'styles') {
      const styles = Object.keys(BUILTIN_STYLES ?? {});
      return jsonResult({
        topic: 'styles',
        available: styles,
        usage: 'transform style=STYLE_NAME',
        description: 'Styles define HOW text is written - sentence patterns, vocabulary, tone',
      });
    }

    return errorResult(`Unknown topic: ${args.topic}`);
  } catch (err) {
    return errorResult(`Help failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function summarizeData(data: unknown): unknown {
  if (!Array.isArray(data)) {
    return summarizeItem(data);
  }

  if (data.length === 0) {
    return { items: [], count: 0 };
  }

  if (data.length <= 5) {
    return {
      items: data.map(summarizeItem),
      count: data.length,
    };
  }

  return {
    preview: data.slice(0, 3).map(summarizeItem),
    count: data.length,
    note: `Showing 3 of ${data.length} items`,
  };
}

function summarizeItem(item: unknown): unknown {
  if (item === null || item === undefined) {
    return null;
  }

  if (typeof item === 'string') {
    return item.length > 200 ? item.substring(0, 200) + '...' : item;
  }

  if (typeof item === 'number' || typeof item === 'boolean') {
    return item;
  }

  if (typeof item === 'object') {
    const obj = item as Record<string, unknown>;

    // Common content structures
    if ('text' in obj || 'content' in obj) {
      const text = (obj.text || obj.content) as string;
      return {
        ...(obj.id ? { id: obj.id } : {}),
        text: typeof text === 'string' && text.length > 200 ? text.substring(0, 200) + '...' : text,
        ...(obj.source ? { source: obj.source } : {}),
        ...(obj.similarity !== undefined ? { similarity: obj.similarity } : {}),
        ...(obj.quality !== undefined ? { quality: obj.quality } : {}),
        ...(obj.aiLikelihood !== undefined ? { aiLikelihood: obj.aiLikelihood } : {}),
      };
    }

    // Generic object summarization
    const keys = Object.keys(obj).slice(0, 5);
    const summary: Record<string, unknown> = {};
    for (const key of keys) {
      const val = obj[key];
      if (typeof val === 'string' && val.length > 100) {
        summary[key] = val.substring(0, 100) + '...';
      } else if (Array.isArray(val)) {
        summary[key] = `[${val.length} items]`;
      } else if (typeof val === 'object' && val !== null) {
        summary[key] = '{...}';
      } else {
        summary[key] = val;
      }
    }

    if (Object.keys(obj).length > 5) {
      summary['...'] = `${Object.keys(obj).length - 5} more fields`;
    }

    return summary;
  }

  return String(item);
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER REGISTRY
// ═══════════════════════════════════════════════════════════════════

export const AUI_HANDLERS: Record<string, (args: unknown) => Promise<MCPResult>> = {
  // Core AUI
  aui_query: handleAuiQuery as (args: unknown) => Promise<MCPResult>,
  bql_execute: handleBqlExecute as (args: unknown) => Promise<MCPResult>,
  bql_parse: handleBqlParse as (args: unknown) => Promise<MCPResult>,

  // Session management
  aui_buffers: handleAuiBuffers as (args: unknown) => Promise<MCPResult>,
  aui_buffer_get: handleAuiBufferGet as (args: unknown) => Promise<MCPResult>,
  aui_buffer_set: handleAuiBufferSet as (args: unknown) => Promise<MCPResult>,
  aui_buffer_clear: handleAuiBufferClear as (args: unknown) => Promise<MCPResult>,
  aui_history: handleAuiHistory as (args: unknown) => Promise<MCPResult>,
  aui_reset: handleAuiReset as (args: unknown) => Promise<MCPResult>,

  // RLM exploration
  rlm_explore: handleRlmExplore as (args: unknown) => Promise<MCPResult>,
  rlm_findings: handleRlmFindings as (args: unknown) => Promise<MCPResult>,

  // Help
  bql_help: handleBqlHelp as (args: unknown) => Promise<MCPResult>,
};
