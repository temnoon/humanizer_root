/**
 * RLM Context Manager
 *
 * Implements Recursive Language Model (RLM) style context management.
 * Instead of sending full content to LLM, we send metadata and let
 * the LLM programmatically explore the data.
 *
 * @see https://arxiv.org/abs/2512.24601
 *
 * Key Insight from Paper:
 * - LLM receives: metadata about context (size, structure, samples)
 * - LLM has access to: context variable, llm_query() function
 * - LLM writes code to selectively access what it needs
 * - Enables processing 10M+ tokens by recursive drill-down
 */

import type {
  ContextMetadata,
  ContextStructure,
  FieldDescription,
  ContextQuery,
  RlmSession,
  RlmExploration,
  RlmFinding,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════
// Context Metadata Generation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estimate token count for a string.
 * Rough approximation: ~4 chars per token for English text.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Generate metadata for a collection of items.
 */
export function generateContextMetadata(
  items: unknown[],
  options: {
    contentType: string;
    sampleCount?: number;
    includeStats?: boolean;
  }
): ContextMetadata {
  const { contentType, sampleCount = 3, includeStats = true } = options;

  if (items.length === 0) {
    return {
      totalItems: 0,
      totalTokens: 0,
      structure: {
        contentType,
        fields: [],
      },
      samples: [],
      operations: ['filter', 'select', 'sort', 'group', 'summarize'],
    };
  }

  // Analyze structure from first item
  const sample = items[0];
  const fields = analyzeFields(sample, items, includeStats);

  // Estimate total tokens
  const serialized = JSON.stringify(items);
  const totalTokens = estimateTokens(serialized);

  // Get representative samples
  const samples = selectSamples(items, sampleCount);

  return {
    totalItems: items.length,
    totalTokens,
    structure: {
      contentType,
      fields,
      indices: fields.filter(f => f.type === 'string' || f.type === 'number').map(f => f.name),
    },
    samples,
    operations: getAvailableOperations(contentType),
  };
}

/**
 * Analyze fields from items.
 */
function analyzeFields(
  sample: unknown,
  allItems: unknown[],
  includeStats: boolean
): FieldDescription[] {
  if (!sample || typeof sample !== 'object') {
    return [{
      name: 'value',
      type: typeof sample as 'string' | 'number' | 'boolean',
      sample,
    }];
  }

  const fields: FieldDescription[] = [];
  const obj = sample as Record<string, unknown>;

  for (const [name, value] of Object.entries(obj)) {
    const field: FieldDescription = {
      name,
      type: inferType(value),
      sample: truncateSample(value),
    };

    // Add stats for numeric fields
    if (includeStats && field.type === 'number') {
      const values = allItems
        .map(item => (item as Record<string, unknown>)[name])
        .filter((v): v is number => typeof v === 'number');

      if (values.length > 0) {
        field.stats = {
          min: Math.min(...values),
          max: Math.max(...values),
          mean: values.reduce((a, b) => a + b, 0) / values.length,
        };
      }
    }

    // Add unique count for string fields
    if (includeStats && field.type === 'string') {
      const values = allItems
        .map(item => (item as Record<string, unknown>)[name])
        .filter((v): v is string => typeof v === 'string');

      field.stats = { unique: new Set(values).size };
    }

    fields.push(field);
  }

  return fields;
}

function inferType(value: unknown): FieldDescription['type'] {
  if (value === null || value === undefined) return 'string';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';
  if (typeof value === 'object') return 'object';
  return typeof value as 'string' | 'number' | 'boolean';
}

function truncateSample(value: unknown, maxLength: number = 100): unknown {
  if (typeof value === 'string' && value.length > maxLength) {
    return value.slice(0, maxLength) + '...';
  }
  if (Array.isArray(value)) {
    return value.slice(0, 3);
  }
  return value;
}

/**
 * Select representative samples from items.
 */
function selectSamples(items: unknown[], count: number): unknown[] {
  if (items.length <= count) {
    return items;
  }

  // Select evenly distributed samples
  const samples: unknown[] = [];
  const step = Math.floor(items.length / count);

  for (let i = 0; i < count; i++) {
    samples.push(items[i * step]);
  }

  return samples;
}

/**
 * Get available operations for a content type.
 */
function getAvailableOperations(contentType: string): string[] {
  const base = ['filter', 'select', 'limit', 'sort', 'group'];

  switch (contentType) {
    case 'messages':
    case 'passages':
      return [...base, 'cluster', 'summarize', 'extract', 'detect'];
    case 'embeddings':
      return [...base, 'cluster', 'similarity_search'];
    case 'chunks':
      return [...base, 'merge', 'summarize'];
    default:
      return base;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RLM Session Management
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a new RLM exploration session.
 */
export function createRlmSession(
  items: unknown[],
  contentType: string
): RlmSession {
  return {
    id: `rlm-${Date.now()}`,
    rootContext: generateContextMetadata(items, { contentType }),
    explorations: [],
    findings: [],
  };
}

/**
 * Generate the RLM prompt for exploration.
 * This is what the LLM receives instead of the full context.
 */
export function generateRlmPrompt(
  session: RlmSession,
  task: string
): string {
  const meta = session.currentFocus?.metadata ?? session.rootContext;

  return `You are exploring a dataset using recursive queries. You do NOT have direct access to the full data.
Instead, you have metadata about it and can write filter expressions to drill down.

TASK: ${task}

CONTEXT METADATA:
- Total items: ${meta.totalItems}
- Estimated tokens: ${meta.totalTokens}
- Content type: ${meta.structure.contentType}

AVAILABLE FIELDS:
${meta.structure.fields.map(f => {
  let desc = `- ${f.name} (${f.type})`;
  if (f.stats) {
    if ('min' in f.stats) desc += ` [range: ${f.stats.min}-${f.stats.max}, mean: ${f.stats.mean?.toFixed(2)}]`;
    if ('unique' in f.stats) desc += ` [${f.stats.unique} unique values]`;
  }
  return desc;
}).join('\n')}

SAMPLE ITEMS:
${JSON.stringify(meta.samples, null, 2)}

AVAILABLE OPERATIONS:
${meta.operations.join(', ')}

${session.explorations.length > 0 ? `
PREVIOUS EXPLORATIONS:
${session.explorations.map((e, i) => `${i + 1}. ${e.reasoning} → ${e.resultMeta.totalItems} results`).join('\n')}
` : ''}

YOUR RESPONSE FORMAT:
1. REASONING: Explain what you want to explore and why
2. EXPRESSION: Write a filter/query expression (JavaScript-style)
3. DRILL_DEEPER: true/false - do you need to explore the results further?
4. FINDING: If you found what you're looking for, describe it

Example response:
REASONING: Looking for items with high quality scores related to family themes
EXPRESSION: items.filter(i => i.quality > 0.7 && i.text.toLowerCase().includes('family'))
DRILL_DEEPER: true
FINDING: null`;
}

/**
 * Parse LLM response from RLM exploration.
 */
export function parseRlmResponse(response: string): {
  reasoning: string;
  expression: string;
  drillDeeper: boolean;
  finding: string | null;
} {
  const lines = response.split('\n');
  let reasoning = '';
  let expression = '';
  let drillDeeper = false;
  let finding: string | null = null;

  for (const line of lines) {
    if (line.startsWith('REASONING:')) {
      reasoning = line.slice('REASONING:'.length).trim();
    } else if (line.startsWith('EXPRESSION:')) {
      expression = line.slice('EXPRESSION:'.length).trim();
    } else if (line.startsWith('DRILL_DEEPER:')) {
      drillDeeper = line.toLowerCase().includes('true');
    } else if (line.startsWith('FINDING:')) {
      const findingText = line.slice('FINDING:'.length).trim();
      finding = findingText === 'null' ? null : findingText;
    }
  }

  return { reasoning, expression, drillDeeper, finding };
}

/**
 * Execute a filter expression against items.
 * This is a safe subset of JavaScript for filtering.
 */
export function executeFilterExpression(
  items: unknown[],
  expression: string
): { results: unknown[]; error?: string } {
  try {
    // Sanitize expression - only allow safe operations
    const sanitized = sanitizeExpression(expression);

    // Build filter function
    const filterFn = new Function('items', `
      try {
        return ${sanitized};
      } catch (e) {
        return [];
      }
    `);

    const results = filterFn(items);

    if (!Array.isArray(results)) {
      return { results: [], error: 'Expression did not return an array' };
    }

    return { results };
  } catch (error) {
    return { results: [], error: String(error) };
  }
}

/**
 * Sanitize filter expression for safe execution.
 */
function sanitizeExpression(expression: string): string {
  // Remove dangerous patterns
  const dangerous = [
    /eval\s*\(/gi,
    /Function\s*\(/gi,
    /import\s*\(/gi,
    /require\s*\(/gi,
    /process\./gi,
    /global\./gi,
    /__proto__/gi,
    /constructor\s*\[/gi,
  ];

  let sanitized = expression;
  for (const pattern of dangerous) {
    sanitized = sanitized.replace(pattern, '');
  }

  return sanitized;
}

/**
 * Record an exploration in the session.
 */
export function recordExploration(
  session: RlmSession,
  exploration: Omit<RlmExploration, 'resultMeta'>,
  results: unknown[]
): RlmSession {
  const resultMeta = generateContextMetadata(results, {
    contentType: session.rootContext.structure.contentType,
    sampleCount: 3,
  });

  const fullExploration: RlmExploration = {
    ...exploration,
    resultMeta,
  };

  return {
    ...session,
    explorations: [...session.explorations, fullExploration],
    currentFocus: exploration.drillDeeper
      ? { metadata: resultMeta, path: [...(session.currentFocus?.path ?? []), exploration.expression] }
      : session.currentFocus,
  };
}

/**
 * Record a finding in the session.
 */
export function recordFinding(
  session: RlmSession,
  finding: Omit<RlmFinding, 'path'>
): RlmSession {
  return {
    ...session,
    findings: [
      ...session.findings,
      {
        ...finding,
        path: session.currentFocus?.path ?? [],
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Smart Context Compression
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compress context for LLM consumption.
 * Returns either full content (if small enough) or metadata (if large).
 */
export function compressForLlm(
  items: unknown[],
  options: {
    contentType: string;
    maxTokens?: number;
    strategy?: 'full' | 'metadata' | 'hierarchical' | 'auto';
  }
): {
  content: string;
  strategy: 'full' | 'metadata' | 'hierarchical';
  compressed: boolean;
} {
  const { contentType, maxTokens = 4000, strategy = 'auto' } = options;

  const serialized = JSON.stringify(items, null, 2);
  const estimatedTokens = estimateTokens(serialized);

  // Auto-select strategy
  let selectedStrategy: 'full' | 'metadata' | 'hierarchical' = 'full';

  if (strategy === 'auto') {
    if (estimatedTokens <= maxTokens) {
      selectedStrategy = 'full';
    } else if (items.length <= 100) {
      selectedStrategy = 'hierarchical';
    } else {
      selectedStrategy = 'metadata';
    }
  } else {
    selectedStrategy = strategy;
  }

  switch (selectedStrategy) {
    case 'full':
      return {
        content: serialized,
        strategy: 'full',
        compressed: false,
      };

    case 'metadata': {
      const meta = generateContextMetadata(items, { contentType });
      return {
        content: `CONTEXT METADATA (${meta.totalItems} items, ~${meta.totalTokens} tokens):

Structure: ${meta.structure.contentType}
Fields: ${meta.structure.fields.map(f => f.name).join(', ')}

Samples:
${JSON.stringify(meta.samples, null, 2)}

Use RLM exploration to access specific items.`,
        strategy: 'metadata',
        compressed: true,
      };
    }

    case 'hierarchical': {
      // Group items and show summaries
      const groups = groupByFirstField(items);
      const summary = Object.entries(groups)
        .map(([key, groupItems]) => `- ${key}: ${groupItems.length} items`)
        .join('\n');

      return {
        content: `HIERARCHICAL SUMMARY (${items.length} items):

Groups:
${summary}

First item sample:
${JSON.stringify(items[0], null, 2)}`,
        strategy: 'hierarchical',
        compressed: true,
      };
    }
  }
}

function groupByFirstField(items: unknown[]): Record<string, unknown[]> {
  if (items.length === 0 || typeof items[0] !== 'object') {
    return { all: items };
  }

  const firstKey = Object.keys(items[0] as object)[0];
  const groups: Record<string, unknown[]> = {};

  for (const item of items) {
    const key = String((item as Record<string, unknown>)[firstKey] ?? 'unknown');
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }

  return groups;
}
