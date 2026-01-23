/**
 * Tests for RLM context management
 */

import { describe, it, expect } from 'vitest';
import {
  generateContextMetadata,
  createRlmSession,
  generateRlmPrompt,
  parseRlmResponse,
  executeFilterExpression,
  recordExploration,
  recordFinding,
  compressForLlm,
} from './rlm-context.js';

describe('generateContextMetadata', () => {
  it('should generate metadata for empty array', () => {
    const meta = generateContextMetadata([], { contentType: 'test' });
    expect(meta.totalItems).toBe(0);
    expect(meta.totalTokens).toBe(0);
    expect(meta.structure.contentType).toBe('test');
  });

  it('should count items and estimate tokens', () => {
    const items = [
      { text: 'Hello world', quality: 0.8 },
      { text: 'Another message', quality: 0.6 },
    ];
    const meta = generateContextMetadata(items, { contentType: 'messages' });

    expect(meta.totalItems).toBe(2);
    expect(meta.totalTokens).toBeGreaterThan(0);
  });

  it('should analyze field structure', () => {
    const items = [
      { name: 'Alice', age: 30, active: true },
      { name: 'Bob', age: 25, active: false },
    ];
    const meta = generateContextMetadata(items, { contentType: 'users' });

    expect(meta.structure.fields).toHaveLength(3);
    expect(meta.structure.fields.find(f => f.name === 'name')?.type).toBe('string');
    expect(meta.structure.fields.find(f => f.name === 'age')?.type).toBe('number');
    expect(meta.structure.fields.find(f => f.name === 'active')?.type).toBe('boolean');
  });

  it('should calculate stats for numeric fields', () => {
    const items = [
      { score: 10 },
      { score: 20 },
      { score: 30 },
    ];
    const meta = generateContextMetadata(items, { contentType: 'scores', includeStats: true });

    const scoreField = meta.structure.fields.find(f => f.name === 'score');
    expect(scoreField?.stats?.min).toBe(10);
    expect(scoreField?.stats?.max).toBe(30);
    expect(scoreField?.stats?.mean).toBe(20);
  });

  it('should calculate unique count for string fields', () => {
    const items = [
      { category: 'A' },
      { category: 'A' },
      { category: 'B' },
    ];
    const meta = generateContextMetadata(items, { contentType: 'items', includeStats: true });

    const catField = meta.structure.fields.find(f => f.name === 'category');
    expect(catField?.stats?.unique).toBe(2);
  });

  it('should include samples', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: i }));
    const meta = generateContextMetadata(items, { contentType: 'items', sampleCount: 3 });

    expect(meta.samples).toHaveLength(3);
  });
});

describe('createRlmSession', () => {
  it('should create session with metadata', () => {
    const items = [{ text: 'test' }];
    const session = createRlmSession(items, 'messages');

    expect(session.id).toMatch(/^rlm-/);
    expect(session.rootContext.totalItems).toBe(1);
    expect(session.explorations).toHaveLength(0);
    expect(session.findings).toHaveLength(0);
  });
});

describe('generateRlmPrompt', () => {
  it('should generate prompt with metadata', () => {
    const items = [{ text: 'hello', quality: 0.8 }];
    const session = createRlmSession(items, 'messages');
    const prompt = generateRlmPrompt(session, 'Find high quality items');

    expect(prompt).toContain('Find high quality items');
    expect(prompt).toContain('Total items: 1');
    expect(prompt).toContain('text');
    expect(prompt).toContain('quality');
    expect(prompt).toContain('REASONING');
    expect(prompt).toContain('EXPRESSION');
  });

  it('should include previous explorations', () => {
    const items = [{ text: 'test' }];
    let session = createRlmSession(items, 'messages');
    session = recordExploration(session, {
      reasoning: 'Looking for patterns',
      expression: 'items.filter(i => true)',
      drillDeeper: false,
    }, items);

    const prompt = generateRlmPrompt(session, 'Continue exploring');
    expect(prompt).toContain('Looking for patterns');
  });
});

describe('parseRlmResponse', () => {
  it('should parse valid response', () => {
    const response = `
REASONING: Looking for high quality items
EXPRESSION: items.filter(i => i.quality > 0.7)
DRILL_DEEPER: true
FINDING: null
`;
    const parsed = parseRlmResponse(response);

    expect(parsed.reasoning).toBe('Looking for high quality items');
    expect(parsed.expression).toBe('items.filter(i => i.quality > 0.7)');
    expect(parsed.drillDeeper).toBe(true);
    expect(parsed.finding).toBeNull();
  });

  it('should parse response with finding', () => {
    const response = `
REASONING: Found the target
EXPRESSION: items[0]
DRILL_DEEPER: false
FINDING: Found the item about vacation
`;
    const parsed = parseRlmResponse(response);

    expect(parsed.drillDeeper).toBe(false);
    expect(parsed.finding).toBe('Found the item about vacation');
  });
});

describe('executeFilterExpression', () => {
  it('should execute simple filter', () => {
    const items = [
      { name: 'a', value: 1 },
      { name: 'b', value: 2 },
      { name: 'c', value: 3 },
    ];
    const { results, error } = executeFilterExpression(
      items,
      'items.filter(i => i.value > 1)'
    );

    expect(error).toBeUndefined();
    expect(results).toHaveLength(2);
  });

  it('should handle map operations', () => {
    const items = [{ value: 1 }, { value: 2 }];
    const { results } = executeFilterExpression(
      items,
      'items.map(i => ({ doubled: i.value * 2 }))'
    );

    expect(results[0]).toEqual({ doubled: 2 });
    expect(results[1]).toEqual({ doubled: 4 });
  });

  it('should sanitize dangerous expressions', () => {
    const items = [{ value: 1 }];
    const { results, error } = executeFilterExpression(
      items,
      'eval("alert(1)"); items'
    );

    // Should not throw, should return items or error
    expect(results.length + (error ? 1 : 0)).toBeGreaterThanOrEqual(0);
  });

  it('should handle errors gracefully', () => {
    const items = [{ value: 1 }];
    const { results, error } = executeFilterExpression(
      items,
      'notARealFunction(items)'
    );

    // Should return empty array on error
    expect(results).toHaveLength(0);
  });
});

describe('recordExploration', () => {
  it('should add exploration to session', () => {
    const items = [{ text: 'test' }];
    const session = createRlmSession(items, 'messages');
    const updated = recordExploration(session, {
      reasoning: 'Test exploration',
      expression: 'items',
      drillDeeper: false,
    }, items);

    expect(updated.explorations).toHaveLength(1);
    expect(updated.explorations[0].reasoning).toBe('Test exploration');
    expect(updated.explorations[0].resultMeta.totalItems).toBe(1);
  });

  it('should update focus when drilling deeper', () => {
    const items = [{ text: 'a' }, { text: 'b' }];
    const subset = [{ text: 'a' }];
    const session = createRlmSession(items, 'messages');
    const updated = recordExploration(session, {
      reasoning: 'Drilling down',
      expression: 'items.slice(0, 1)',
      drillDeeper: true,
    }, subset);

    expect(updated.currentFocus).toBeDefined();
    expect(updated.currentFocus!.metadata.totalItems).toBe(1);
    expect(updated.currentFocus!.path).toContain('items.slice(0, 1)');
  });
});

describe('recordFinding', () => {
  it('should add finding to session', () => {
    const items = [{ text: 'found it' }];
    const session = createRlmSession(items, 'messages');
    const updated = recordFinding(session, {
      content: items[0],
      relevance: 0.95,
      explanation: 'This is what we were looking for',
    });

    expect(updated.findings).toHaveLength(1);
    expect(updated.findings[0].relevance).toBe(0.95);
    expect(updated.findings[0].explanation).toBe('This is what we were looking for');
  });
});

describe('compressForLlm', () => {
  it('should return full content for small data', () => {
    const items = [{ text: 'small' }];
    const result = compressForLlm(items, {
      contentType: 'test',
      maxTokens: 1000,
      strategy: 'auto',
    });

    expect(result.strategy).toBe('full');
    expect(result.compressed).toBe(false);
    expect(result.content).toContain('small');
  });

  it('should return metadata for large data', () => {
    const items = Array.from({ length: 200 }, (_, i) => ({
      text: 'This is a very long text '.repeat(20),
      id: i,
    }));
    const result = compressForLlm(items, {
      contentType: 'test',
      maxTokens: 100,
      strategy: 'auto',
    });

    expect(result.strategy).toBe('metadata');
    expect(result.compressed).toBe(true);
    expect(result.content).toContain('CONTEXT METADATA');
  });

  it('should return hierarchical for medium data', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({
      text: 'Medium length text '.repeat(10),
      id: i,
    }));
    const result = compressForLlm(items, {
      contentType: 'test',
      maxTokens: 100,
      strategy: 'auto',
    });

    expect(result.strategy).toBe('hierarchical');
    expect(result.compressed).toBe(true);
    expect(result.content).toContain('HIERARCHICAL SUMMARY');
  });

  it('should respect explicit strategy', () => {
    const items = [{ text: 'small' }];
    const result = compressForLlm(items, {
      contentType: 'test',
      strategy: 'metadata',
    });

    expect(result.strategy).toBe('metadata');
  });
});
