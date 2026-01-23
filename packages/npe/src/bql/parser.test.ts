/**
 * Tests for BQL parser
 */

import { describe, it, expect } from 'vitest';
import { tokenize, parseBql, toBql } from './parser.js';

describe('tokenize', () => {
  it('should tokenize simple commands', () => {
    const tokens = tokenize('harvest "memories"');
    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toEqual({ type: 'keyword', value: 'harvest', position: 0 });
    expect(tokens[1]).toEqual({ type: 'string', value: 'memories', position: 8 });
  });

  it('should tokenize pipes', () => {
    const tokens = tokenize('harvest "x" | limit 10');
    expect(tokens.filter(t => t.type === 'pipe')).toHaveLength(1);
  });

  it('should tokenize numbers', () => {
    const tokens = tokenize('limit 100');
    expect(tokens[1]).toEqual({ type: 'number', value: '100', position: 6 });
  });

  it('should tokenize operators', () => {
    const tokens = tokenize('filter quality > 0.7');
    expect(tokens.find(t => t.type === 'operator')).toEqual({
      type: 'operator',
      value: '>',
      position: 15,
    });
  });

  it('should tokenize key=value pairs', () => {
    const tokens = tokenize('transform persona=stoic');
    expect(tokens).toContainEqual({ type: 'identifier', value: 'persona', position: 10 });
    expect(tokens).toContainEqual({ type: 'operator', value: '=', position: 17 });
    expect(tokens).toContainEqual({ type: 'identifier', value: 'stoic', position: 18 });
  });

  it('should handle escaped quotes in strings', () => {
    const tokens = tokenize('harvest "say \\"hello\\""');
    expect(tokens[1].value).toBe('say "hello"');
  });
});

describe('parseBql', () => {
  it('should parse simple harvest command', () => {
    const result = parseBql('harvest "nostalgia"');
    expect(result.pipeline).toBeDefined();
    expect(result.pipeline!.steps).toHaveLength(1);
    expect(result.pipeline!.steps[0].op).toBe('harvest');
    expect(result.pipeline!.steps[0].params.query).toBe('nostalgia');
  });

  it('should parse pipeline with multiple steps', () => {
    const result = parseBql('harvest "memories" | limit 10 | save results');
    expect(result.pipeline!.steps).toHaveLength(3);
    expect(result.pipeline!.steps[0].op).toBe('harvest');
    expect(result.pipeline!.steps[1].op).toBe('limit');
    expect(result.pipeline!.steps[2].op).toBe('save');
  });

  it('should parse filter with comparison', () => {
    const result = parseBql('filter quality > 0.7');
    expect(result.pipeline!.steps[0].params).toHaveProperty('quality_>');
    expect(result.pipeline!.steps[0].params['quality_>']).toBe(0.7);
  });

  it('should parse transform with key=value', () => {
    const result = parseBql('transform persona=stoic style=literary');
    expect(result.pipeline!.steps[0].params.persona).toBe('stoic');
    expect(result.pipeline!.steps[0].params.style).toBe('literary');
  });

  it('should parse limit modifier', () => {
    const result = parseBql('harvest "x" limit 50');
    expect(result.pipeline!.steps[0].params.limit).toBe(50);
  });

  it('should parse as alias', () => {
    const result = parseBql('harvest "x" as my_results');
    expect(result.pipeline!.steps[0].as).toBe('my_results');
  });

  it('should detect natural language (AUI mode)', () => {
    const result = parseBql('find my old vacation stories and make them poetic');
    expect(result.naturalLanguage).toBeDefined();
    expect(result.pipeline).toBeUndefined();
  });

  it('should return errors for invalid syntax', () => {
    const result = parseBql('| harvest');
    // Empty first segment
    expect(result.pipeline?.steps.length ?? 0).toBeLessThan(2);
  });
});

describe('toBql', () => {
  it('should generate BQL from pipeline', () => {
    const result = parseBql('harvest "memories" | limit 10');
    const bql = toBql(result.pipeline!);
    expect(bql).toContain('harvest');
    expect(bql).toContain('memories');
    expect(bql).toContain('limit');
  });

  it('should preserve key=value params', () => {
    const result = parseBql('transform persona=stoic');
    const bql = toBql(result.pipeline!);
    expect(bql).toContain('persona=');
    expect(bql).toContain('stoic');
  });

  it('should preserve aliases', () => {
    const result = parseBql('harvest "x" as results');
    const bql = toBql(result.pipeline!);
    expect(bql).toContain('as results');
  });

  it('should roundtrip simple pipelines', () => {
    const original = 'harvest "test" | limit 10 | save buffer';
    const parsed = parseBql(original);
    const regenerated = toBql(parsed.pipeline!);
    const reparsed = parseBql(regenerated);

    expect(reparsed.pipeline!.steps).toHaveLength(parsed.pipeline!.steps.length);
    expect(reparsed.pipeline!.steps[0].op).toBe(parsed.pipeline!.steps[0].op);
  });
});

describe('complex pipelines', () => {
  it('should parse humanize with intensity', () => {
    const result = parseBql('humanize moderate');
    expect(result.pipeline!.steps[0].op).toBe('humanize');
    expect(result.pipeline!.steps[0].params.query).toBe('moderate');
  });

  it('should parse detect command', () => {
    const result = parseBql('detect');
    expect(result.pipeline!.steps[0].op).toBe('detect');
  });

  it('should parse cluster by theme', () => {
    const result = parseBql('cluster by theme');
    expect(result.pipeline!.steps[0].op).toBe('cluster');
    expect(result.pipeline!.steps[0].params.by).toBe('theme');
  });

  it('should parse export with format', () => {
    const result = parseBql('export md');
    expect(result.pipeline!.steps[0].op).toBe('export');
    expect(result.pipeline!.steps[0].params.query).toBe('md');
  });

  it('should parse book creation', () => {
    const result = parseBql('book "My Memories"');
    expect(result.pipeline!.steps[0].op).toBe('book');
    expect(result.pipeline!.steps[0].params.query).toBe('My Memories');
  });

  it('should parse rlm exploration', () => {
    const result = parseBql('rlm "find mentions of family"');
    expect(result.pipeline!.steps[0].op).toBe('rlm');
    expect(result.pipeline!.steps[0].params.query).toBe('find mentions of family');
  });

  it('should parse full pipeline', () => {
    const result = parseBql(
      'harvest "childhood" limit 50 | filter quality > 0.6 | transform persona=stoic | humanize moderate | save final as my_book'
    );
    expect(result.pipeline!.steps).toHaveLength(5);
    expect(result.pipeline!.steps[0].op).toBe('harvest');
    expect(result.pipeline!.steps[1].op).toBe('filter');
    expect(result.pipeline!.steps[2].op).toBe('transform');
    expect(result.pipeline!.steps[3].op).toBe('humanize');
    expect(result.pipeline!.steps[4].op).toBe('save');
  });
});
