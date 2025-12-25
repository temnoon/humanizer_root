/**
 * Operator Registry and Core Operators
 *
 * Operators transform content from parent to child nodes.
 * Each operator is a pure function: input → output.
 */

import type {
  ContentItem,
  OperatorDefinition,
  OperationType,
} from './types';
import {
  humanize,
  transformPersona,
  transformStyle,
  type HumanizationIntensity,
} from '../transform';

// ═══════════════════════════════════════════════════════════════════
// OPERATOR REGISTRY
// ═══════════════════════════════════════════════════════════════════

class OperatorRegistry {
  private operators: Map<string, OperatorDefinition> = new Map();

  register(operator: OperatorDefinition): void {
    this.operators.set(operator.id, operator);
  }

  get(operatorId: string): OperatorDefinition | null {
    return this.operators.get(operatorId) ?? null;
  }

  getAll(): OperatorDefinition[] {
    return Array.from(this.operators.values());
  }

  getByType(type: OperationType): OperatorDefinition[] {
    return this.getAll().filter(op => op.type === type);
  }
}

export const operatorRegistry = new OperatorRegistry();

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

function generateItemId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensureArray(content: ContentItem | ContentItem[]): ContentItem[] {
  return Array.isArray(content) ? content : [content];
}

function getText(content: ContentItem | ContentItem[]): string {
  const items = ensureArray(content);
  return items.map(i => i.text).join('\n\n');
}

// ═══════════════════════════════════════════════════════════════════
// SPLIT OPERATORS
// ═══════════════════════════════════════════════════════════════════

operatorRegistry.register({
  id: 'split:sentence',
  name: 'Split by Sentence',
  type: 'split',
  description: 'Split text into individual sentences',
  inputType: 'any',
  outputType: 'array',

  execute: async (input) => {
    const text = getText(input);

    // Simple sentence splitting (handles ., !, ?)
    // Preserves abbreviations like Mr., Dr., etc.
    const sentences = text
      .replace(/([.!?])\s+(?=[A-Z])/g, '$1|SPLIT|')
      .split('|SPLIT|')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    return sentences.map((text, index): ContentItem => ({
      id: generateItemId(),
      text,
      index,
      metadata: {
        wordCount: text.split(/\s+/).length,
      },
    }));
  },
});

operatorRegistry.register({
  id: 'split:paragraph',
  name: 'Split by Paragraph',
  type: 'split',
  description: 'Split text at paragraph breaks',
  inputType: 'any',
  outputType: 'array',

  execute: async (input) => {
    const text = getText(input);

    const paragraphs = text
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    return paragraphs.map((text, index): ContentItem => ({
      id: generateItemId(),
      text,
      index,
      metadata: {
        wordCount: text.split(/\s+/).length,
      },
    }));
  },
});

operatorRegistry.register({
  id: 'split:chunk',
  name: 'Split by Word Count',
  type: 'split',
  description: 'Split into chunks of N words',
  inputType: 'any',
  outputType: 'array',
  params: [
    {
      name: 'words',
      type: 'number',
      label: 'Words per chunk',
      default: 100,
      min: 10,
      max: 1000,
    },
    {
      name: 'overlap',
      type: 'number',
      label: 'Overlap words',
      default: 0,
      min: 0,
      max: 100,
    },
  ],

  execute: async (input, params) => {
    const text = getText(input);
    const chunkSize = (params?.words as number) || 100;
    const overlap = (params?.overlap as number) || 0;

    const words = text.split(/\s+/);
    const chunks: ContentItem[] = [];

    let i = 0;
    while (i < words.length) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      chunks.push({
        id: generateItemId(),
        text: chunk,
        index: chunks.length,
        metadata: {
          wordCount: Math.min(chunkSize, words.length - i),
        },
      });
      i += chunkSize - overlap;
    }

    return chunks;
  },
});

// ═══════════════════════════════════════════════════════════════════
// FILTER OPERATORS
// ═══════════════════════════════════════════════════════════════════

operatorRegistry.register({
  id: 'filter:sic',
  name: 'Filter by SIC Score',
  type: 'filter',
  description: 'Keep items with SIC score above threshold',
  inputType: 'array',
  outputType: 'array',
  params: [
    {
      name: 'threshold',
      type: 'number',
      label: 'Minimum SIC',
      default: 50,
      min: 0,
      max: 100,
    },
    {
      name: 'comparison',
      type: 'select',
      label: 'Comparison',
      default: '>',
      options: [
        { value: '>', label: 'Greater than' },
        { value: '<', label: 'Less than' },
        { value: '>=', label: 'At least' },
        { value: '<=', label: 'At most' },
      ],
    },
  ],

  execute: async (input, params) => {
    const items = ensureArray(input);
    const threshold = (params?.threshold as number) ?? 50;
    const comparison = (params?.comparison as string) ?? '>';

    return items.filter(item => {
      const score = item.metadata?.sicScore;
      if (score === undefined) return true; // Keep items without scores

      switch (comparison) {
        case '>': return score > threshold;
        case '<': return score < threshold;
        case '>=': return score >= threshold;
        case '<=': return score <= threshold;
        default: return true;
      }
    });
  },
});

operatorRegistry.register({
  id: 'filter:contains',
  name: 'Filter by Content',
  type: 'filter',
  description: 'Keep items containing search term',
  inputType: 'array',
  outputType: 'array',
  params: [
    {
      name: 'term',
      type: 'string',
      label: 'Search term',
      default: '',
    },
    {
      name: 'caseSensitive',
      type: 'boolean',
      label: 'Case sensitive',
      default: false,
    },
  ],

  execute: async (input, params) => {
    const items = ensureArray(input);
    const term = (params?.term as string) ?? '';
    const caseSensitive = (params?.caseSensitive as boolean) ?? false;

    if (!term) return items;

    const searchTerm = caseSensitive ? term : term.toLowerCase();

    return items.filter(item => {
      const text = caseSensitive ? item.text : item.text.toLowerCase();
      return text.includes(searchTerm);
    });
  },
});

operatorRegistry.register({
  id: 'filter:length',
  name: 'Filter by Length',
  type: 'filter',
  description: 'Keep items within word count range',
  inputType: 'array',
  outputType: 'array',
  params: [
    {
      name: 'min',
      type: 'number',
      label: 'Min words',
      default: 0,
      min: 0,
    },
    {
      name: 'max',
      type: 'number',
      label: 'Max words',
      default: 1000,
      min: 1,
    },
  ],

  execute: async (input, params) => {
    const items = ensureArray(input);
    const min = (params?.min as number) ?? 0;
    const max = (params?.max as number) ?? Infinity;

    return items.filter(item => {
      const wordCount = item.metadata?.wordCount ?? item.text.split(/\s+/).length;
      return wordCount >= min && wordCount <= max;
    });
  },
});

// ═══════════════════════════════════════════════════════════════════
// MERGE OPERATORS
// ═══════════════════════════════════════════════════════════════════

operatorRegistry.register({
  id: 'merge:join',
  name: 'Join',
  type: 'merge',
  description: 'Combine items into single text',
  inputType: 'array',
  outputType: 'single',
  params: [
    {
      name: 'separator',
      type: 'string',
      label: 'Separator',
      default: '\n\n',
    },
  ],

  execute: async (input, params) => {
    const items = ensureArray(input);
    const separator = (params?.separator as string) ?? '\n\n';

    const text = items.map(i => i.text).join(separator);

    return {
      id: generateItemId(),
      text,
      metadata: {
        wordCount: text.split(/\s+/).length,
        sourceCount: items.length,
      },
    };
  },
});

// ═══════════════════════════════════════════════════════════════════
// ORDER OPERATORS
// ═══════════════════════════════════════════════════════════════════

operatorRegistry.register({
  id: 'order:sic',
  name: 'Order by SIC',
  type: 'order',
  description: 'Sort by SIC score',
  inputType: 'array',
  outputType: 'array',
  params: [
    {
      name: 'direction',
      type: 'select',
      label: 'Direction',
      default: 'desc',
      options: [
        { value: 'desc', label: 'High to Low' },
        { value: 'asc', label: 'Low to High' },
      ],
    },
  ],

  execute: async (input, params) => {
    const items = [...ensureArray(input)];
    const direction = (params?.direction as string) ?? 'desc';

    items.sort((a, b) => {
      const aScore = a.metadata?.sicScore ?? 0;
      const bScore = b.metadata?.sicScore ?? 0;
      return direction === 'desc' ? bScore - aScore : aScore - bScore;
    });

    return items.map((item, index) => ({
      ...item,
      index,
    }));
  },
});

operatorRegistry.register({
  id: 'order:length',
  name: 'Order by Length',
  type: 'order',
  description: 'Sort by word count',
  inputType: 'array',
  outputType: 'array',
  params: [
    {
      name: 'direction',
      type: 'select',
      label: 'Direction',
      default: 'desc',
      options: [
        { value: 'desc', label: 'Long to Short' },
        { value: 'asc', label: 'Short to Long' },
      ],
    },
  ],

  execute: async (input, params) => {
    const items = [...ensureArray(input)];
    const direction = (params?.direction as string) ?? 'desc';

    items.sort((a, b) => {
      const aLen = a.metadata?.wordCount ?? a.text.split(/\s+/).length;
      const bLen = b.metadata?.wordCount ?? b.text.split(/\s+/).length;
      return direction === 'desc' ? bLen - aLen : aLen - bLen;
    });

    return items.map((item, index) => ({
      ...item,
      index,
    }));
  },
});

operatorRegistry.register({
  id: 'order:shuffle',
  name: 'Shuffle',
  type: 'order',
  description: 'Randomize order',
  inputType: 'array',
  outputType: 'array',

  execute: async (input) => {
    const items = [...ensureArray(input)];

    // Fisher-Yates shuffle
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }

    return items.map((item, index) => ({
      ...item,
      index,
    }));
  },
});

// ═══════════════════════════════════════════════════════════════════
// SELECT OPERATORS
// ═══════════════════════════════════════════════════════════════════

operatorRegistry.register({
  id: 'select:first',
  name: 'First N',
  type: 'select',
  description: 'Keep first N items',
  inputType: 'array',
  outputType: 'array',
  params: [
    {
      name: 'count',
      type: 'number',
      label: 'Count',
      default: 10,
      min: 1,
    },
  ],

  execute: async (input, params) => {
    const items = ensureArray(input);
    const count = (params?.count as number) ?? 10;
    return items.slice(0, count);
  },
});

operatorRegistry.register({
  id: 'select:last',
  name: 'Last N',
  type: 'select',
  description: 'Keep last N items',
  inputType: 'array',
  outputType: 'array',
  params: [
    {
      name: 'count',
      type: 'number',
      label: 'Count',
      default: 10,
      min: 1,
    },
  ],

  execute: async (input, params) => {
    const items = ensureArray(input);
    const count = (params?.count as number) ?? 10;
    return items.slice(-count);
  },
});

operatorRegistry.register({
  id: 'select:range',
  name: 'Range',
  type: 'select',
  description: 'Keep items in index range',
  inputType: 'array',
  outputType: 'array',
  params: [
    {
      name: 'start',
      type: 'number',
      label: 'Start index',
      default: 0,
      min: 0,
    },
    {
      name: 'end',
      type: 'number',
      label: 'End index',
      default: 10,
      min: 1,
    },
  ],

  execute: async (input, params) => {
    const items = ensureArray(input);
    const start = (params?.start as number) ?? 0;
    const end = (params?.end as number) ?? items.length;
    return items.slice(start, end);
  },
});

// ═══════════════════════════════════════════════════════════════════
// ANNOTATE OPERATORS
// ═══════════════════════════════════════════════════════════════════

operatorRegistry.register({
  id: 'annotate:wordcount',
  name: 'Add Word Count',
  type: 'annotate',
  description: 'Calculate and attach word counts',
  inputType: 'any',
  outputType: 'same',

  execute: async (input) => {
    const items = ensureArray(input);

    const annotated = items.map(item => ({
      ...item,
      metadata: {
        ...item.metadata,
        wordCount: item.text.split(/\s+/).length,
      },
    }));

    return Array.isArray(input) ? annotated : annotated[0];
  },
});

// ═══════════════════════════════════════════════════════════════════
// TRANSFORM OPERATORS - API-backed transformations
// ═══════════════════════════════════════════════════════════════════

operatorRegistry.register({
  id: 'transform:humanize',
  name: 'Humanize',
  type: 'transform',
  description: 'Transform AI text to human voice using SIC-optimized techniques',
  inputType: 'any',
  outputType: 'same',
  params: [
    {
      name: 'intensity',
      type: 'select',
      label: 'Intensity',
      default: 'moderate',
      options: [
        { value: 'light', label: 'Light (50%)' },
        { value: 'moderate', label: 'Moderate (70%)' },
        { value: 'aggressive', label: 'Aggressive (95%)' },
      ],
    },
    {
      name: 'enableSicAnalysis',
      type: 'boolean',
      label: 'Enable SIC Analysis',
      default: false,
    },
  ],

  execute: async (input, params) => {
    const text = getText(input);
    const intensity = (params?.intensity as HumanizationIntensity) || 'moderate';
    const enableSicAnalysis = (params?.enableSicAnalysis as boolean) ?? false;

    const result = await humanize(text, {
      intensity,
      enableSicAnalysis,
      enableLLMPolish: true,
    });

    // Return single item with transformed text
    const outputItem: ContentItem = {
      id: generateItemId(),
      text: result.transformed,
      metadata: {
        transformationId: result.transformationId,
        modelUsed: result.metadata?.modelUsed,
        processingTimeMs: result.metadata?.processingTimeMs,
        // Store improvement metrics
        aiConfidenceBefore: result.metadata?.baseline?.detection?.confidence,
        aiConfidenceAfter: result.metadata?.final?.detection?.confidence,
      },
    };

    return Array.isArray(input) ? [outputItem] : outputItem;
  },
});

operatorRegistry.register({
  id: 'transform:persona',
  name: 'Apply Persona',
  type: 'transform',
  description: 'Transform text using a persona voice',
  inputType: 'any',
  outputType: 'same',
  params: [
    {
      name: 'persona',
      type: 'string',
      label: 'Persona',
      default: 'Academic',
    },
  ],

  execute: async (input, params) => {
    const text = getText(input);
    const persona = (params?.persona as string) || 'Academic';

    const result = await transformPersona(text, persona, {
      preserveLength: true,
      enableValidation: true,
    });

    const outputItem: ContentItem = {
      id: generateItemId(),
      text: result.transformed,
      metadata: {
        transformationId: result.transformationId,
        persona,
        modelUsed: result.metadata?.modelUsed,
        processingTimeMs: result.metadata?.processingTimeMs,
      },
    };

    return Array.isArray(input) ? [outputItem] : outputItem;
  },
});

operatorRegistry.register({
  id: 'transform:style',
  name: 'Apply Style',
  type: 'transform',
  description: 'Transform text using a writing style',
  inputType: 'any',
  outputType: 'same',
  params: [
    {
      name: 'style',
      type: 'string',
      label: 'Style',
      default: 'Formal',
    },
  ],

  execute: async (input, params) => {
    const text = getText(input);
    const style = (params?.style as string) || 'Formal';

    const result = await transformStyle(text, style, {
      preserveLength: true,
      enableValidation: true,
    });

    const outputItem: ContentItem = {
      id: generateItemId(),
      text: result.transformed,
      metadata: {
        transformationId: result.transformationId,
        style,
        modelUsed: result.metadata?.modelUsed,
        processingTimeMs: result.metadata?.processingTimeMs,
      },
    };

    return Array.isArray(input) ? [outputItem] : outputItem;
  },
});

// ═══════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════

export { OperatorRegistry };
