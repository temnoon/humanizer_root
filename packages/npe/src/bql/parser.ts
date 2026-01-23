/**
 * BQL Parser
 *
 * Parses batch query language commands into pipeline structures.
 *
 * Syntax Examples:
 * ```
 * harvest "nostalgia" | filter quality > 0.7 | save memories
 * load memories | transform persona=stoic | humanize moderate | export md
 * harvest "childhood" limit 50 | cluster themes | book "Memories"
 * ```
 *
 * Also supports natural language (AUI mode) which gets parsed by LLM.
 */

import type {
  Pipeline,
  PipelineStep,
  PipelineOperation,
  CliCommand,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════
// Token Types
// ═══════════════════════════════════════════════════════════════════════════

interface Token {
  type: 'keyword' | 'string' | 'number' | 'operator' | 'identifier' | 'pipe';
  value: string;
  position: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Lexer
// ═══════════════════════════════════════════════════════════════════════════

const KEYWORDS = new Set([
  // Source
  'harvest', 'load', 'fetch', 'generate',
  // Filter
  'filter', 'select', 'limit', 'sample', 'dedupe',
  // Transform
  'transform', 'humanize', 'chunk', 'merge', 'annotate',
  // Analysis
  'detect', 'cluster', 'summarize', 'extract',
  // Aggregate
  'group', 'sort', 'join', 'union',
  // Output
  'save', 'export', 'book', 'print',
  // Control
  'branch', 'loop', 'parallel', 'rlm',
  // Modifiers
  'from', 'to', 'as', 'by', 'with', 'where', 'into',
]);

const OPERATORS = new Set(['>', '<', '>=', '<=', '==', '!=', '=', '+', '-', '*', '/']);

/**
 * Tokenize BQL input string.
 */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < input.length) {
    const char = input[pos];

    // Skip whitespace
    if (/\s/.test(char)) {
      pos++;
      continue;
    }

    // Pipe operator
    if (char === '|') {
      tokens.push({ type: 'pipe', value: '|', position: pos });
      pos++;
      continue;
    }

    // String literal (double or single quotes)
    if (char === '"' || char === "'") {
      const quote = char;
      const start = pos;
      pos++;
      let value = '';
      while (pos < input.length && input[pos] !== quote) {
        if (input[pos] === '\\' && pos + 1 < input.length) {
          pos++;
          value += input[pos];
        } else {
          value += input[pos];
        }
        pos++;
      }
      pos++; // Skip closing quote
      tokens.push({ type: 'string', value, position: start });
      continue;
    }

    // Number
    if (/\d/.test(char) || (char === '.' && pos + 1 < input.length && /\d/.test(input[pos + 1]))) {
      const start = pos;
      let value = '';
      while (pos < input.length && /[\d.]/.test(input[pos])) {
        value += input[pos];
        pos++;
      }
      tokens.push({ type: 'number', value, position: start });
      continue;
    }

    // Operators (check multi-char first)
    if (OPERATORS.has(input.slice(pos, pos + 2))) {
      tokens.push({ type: 'operator', value: input.slice(pos, pos + 2), position: pos });
      pos += 2;
      continue;
    }
    if (OPERATORS.has(char)) {
      tokens.push({ type: 'operator', value: char, position: pos });
      pos++;
      continue;
    }

    // Identifier or keyword
    if (/[a-zA-Z_]/.test(char)) {
      const start = pos;
      let value = '';
      while (pos < input.length && /[a-zA-Z0-9_-]/.test(input[pos])) {
        value += input[pos];
        pos++;
      }
      const type = KEYWORDS.has(value.toLowerCase()) ? 'keyword' : 'identifier';
      tokens.push({ type, value: value.toLowerCase(), position: start });
      continue;
    }

    // Unknown character - skip
    pos++;
  }

  return tokens;
}

// ═══════════════════════════════════════════════════════════════════════════
// Parser
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse tokens into pipeline steps.
 */
export function parseTokens(tokens: Token[]): { steps: PipelineStep[]; errors: string[] } {
  const steps: PipelineStep[] = [];
  const errors: string[] = [];

  // Split by pipe
  const segments: Token[][] = [];
  let current: Token[] = [];

  for (const token of tokens) {
    if (token.type === 'pipe') {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
    } else {
      current.push(token);
    }
  }
  if (current.length > 0) {
    segments.push(current);
  }

  // Parse each segment as a step
  for (const segment of segments) {
    const step = parseStep(segment);
    if (step.error) {
      errors.push(step.error);
    } else if (step.step) {
      steps.push(step.step);
    }
  }

  return { steps, errors };
}

/**
 * Parse a single pipeline step.
 */
function parseStep(tokens: Token[]): { step?: PipelineStep; error?: string } {
  if (tokens.length === 0) {
    return { error: 'Empty step' };
  }

  const first = tokens[0];
  if (first.type !== 'keyword') {
    return { error: `Expected operation keyword, got: ${first.value}` };
  }

  const op = first.value as PipelineOperation;
  const params: Record<string, unknown> = {};
  let alias: string | undefined;

  let i = 1;
  while (i < tokens.length) {
    const token = tokens[i];

    // Handle 'as' alias
    if (token.type === 'keyword' && token.value === 'as' && i + 1 < tokens.length) {
      alias = tokens[i + 1].value;
      i += 2;
      continue;
    }

    // Handle key=value pairs
    if (token.type === 'identifier' && i + 1 < tokens.length) {
      const next = tokens[i + 1];
      if (next.type === 'operator' && next.value === '=' && i + 2 < tokens.length) {
        const valueToken = tokens[i + 2];
        params[token.value] = parseValue(valueToken);
        i += 3;
        continue;
      }
    }

    // Handle comparison operators (for filter)
    if (token.type === 'identifier' && i + 1 < tokens.length) {
      const next = tokens[i + 1];
      if (next.type === 'operator' && i + 2 < tokens.length) {
        const valueToken = tokens[i + 2];
        params[`${token.value}_${next.value}`] = parseValue(valueToken);
        i += 3;
        continue;
      }
    }

    // Handle modifiers (from, to, by, with, where, into, limit)
    if (token.type === 'keyword' && i + 1 < tokens.length) {
      const valueToken = tokens[i + 1];
      params[token.value] = parseValue(valueToken);
      i += 2;
      continue;
    }

    // Handle positional arguments (query string, name, etc.)
    if (token.type === 'string' || token.type === 'identifier' || token.type === 'number') {
      // First positional arg is usually 'query' or 'name'
      if (!params.query && !params.name) {
        params.query = parseValue(token);
      } else if (!params.target) {
        params.target = parseValue(token);
      }
      i++;
      continue;
    }

    i++;
  }

  return {
    step: { op, params, as: alias },
  };
}

function parseValue(token: Token): unknown {
  if (token.type === 'number') {
    return parseFloat(token.value);
  }
  if (token.type === 'string' || token.type === 'identifier') {
    // Handle boolean-like values
    if (token.value === 'true') return true;
    if (token.value === 'false') return false;
    return token.value;
  }
  return token.value;
}

// ═══════════════════════════════════════════════════════════════════════════
// High-Level Parse Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse a BQL command string into a pipeline.
 */
export function parseBql(input: string): CliCommand {
  const raw = input.trim();

  // Check if it looks like BQL (starts with known keyword)
  const firstWord = raw.split(/\s+/)[0]?.toLowerCase();
  const isBql = KEYWORDS.has(firstWord);

  if (!isBql) {
    // Treat as natural language for AUI interpretation
    return {
      raw,
      naturalLanguage: raw,
    };
  }

  // Parse as BQL
  const tokens = tokenize(raw);
  const { steps, errors } = parseTokens(tokens);

  if (errors.length > 0) {
    return { raw, errors };
  }

  const pipeline: Pipeline = {
    id: `bql-${Date.now()}`,
    name: 'CLI Pipeline',
    steps,
  };

  return { raw, pipeline };
}

/**
 * Generate BQL string from a pipeline.
 */
export function toBql(pipeline: Pipeline): string {
  return pipeline.steps.map(step => {
    const parts: string[] = [step.op];

    // Add query/name first if present
    if (step.params.query) {
      parts.push(`"${step.params.query}"`);
    }
    if (step.params.name && !step.params.query) {
      parts.push(`"${step.params.name}"`);
    }

    // Add other params
    for (const [key, value] of Object.entries(step.params)) {
      if (key === 'query' || key === 'name') continue;

      // Handle comparison operators
      if (key.includes('_')) {
        const [field, op] = key.split('_');
        parts.push(`${field} ${op} ${formatValue(value)}`);
      } else if (KEYWORDS.has(key)) {
        // Modifier keyword
        parts.push(`${key} ${formatValue(value)}`);
      } else {
        // Key=value
        parts.push(`${key}=${formatValue(value)}`);
      }
    }

    // Add alias
    if (step.as) {
      parts.push(`as ${step.as}`);
    }

    return parts.join(' ');
  }).join(' | ');
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    return `"${value}"`;
  }
  return String(value);
}

// ═══════════════════════════════════════════════════════════════════════════
// Help / Documentation
// ═══════════════════════════════════════════════════════════════════════════

export const BQL_HELP = `
BQL - Batch Query Language
===========================

Pipeline Syntax:
  operation [args] [modifiers] | operation [args] | ...

Source Operations:
  harvest "query"           Search archive with semantic query
  harvest "query" limit N   Limit results
  harvest "query" from src  Specify source (archive, workspace, etc.)
  load buffer_name          Load from workspace buffer
  fetch url                 Fetch from external source
  generate "prompt"         Generate content with LLM

Filter Operations:
  filter field > value      Filter by comparison
  filter quality > 0.7      Example: quality threshold
  select field1,field2      Select specific fields
  limit N                   Limit to N items
  sample N                  Random sample of N items
  dedupe                    Remove duplicates

Transform Operations:
  transform persona=stoic   Apply persona transformation
  transform style=academic  Apply style transformation
  transform ns=scifi        Apply namespace transformation
  humanize light|moderate|aggressive   Humanize AI-generated text
  chunk                     Split into chunks
  merge                     Merge chunks
  annotate key=value        Add metadata

Analysis Operations:
  detect                    Run AI detection
  cluster                   Semantic clustering
  cluster by theme          Cluster with hint
  summarize                 Summarize content
  extract entities          Extract named entities

Output Operations:
  save buffer_name          Save to workspace buffer
  export md|json|txt        Export to file
  book "Title"              Create book project
  print                     Print to console

RLM Mode:
  rlm "exploration task"    Enter recursive exploration mode

Examples:
  harvest "nostalgia" | filter quality > 0.7 | save memories
  load memories | transform persona=stoic | humanize moderate | export md
  harvest "childhood" limit 50 | cluster by theme | book "Memories"
  rlm "find all mentions of family across the archive"
`;
