/**
 * Tests for LLM response normalizer
 */

import { describe, it, expect } from 'vitest';
import { extractJson, safeJsonParse, cleanResponse, normalize } from './normalizer.js';

describe('extractJson', () => {
  it('should extract from markdown code block', () => {
    const response = `Here's the JSON:
\`\`\`json
{"score": 75, "notes": "test"}
\`\`\`
Hope this helps!`;

    const extracted = extractJson(response);
    expect(extracted).toBe('{"score": 75, "notes": "test"}');
  });

  it('should extract from generic code block', () => {
    const response = `\`\`\`
{"key": "value"}
\`\`\``;

    const extracted = extractJson(response);
    expect(extracted).toBe('{"key": "value"}');
  });

  it('should extract bare JSON object', () => {
    const response = 'Some text {"result": true} more text';
    const extracted = extractJson(response);
    expect(extracted).toBe('{"result": true}');
  });

  it('should extract JSON array', () => {
    const response = 'Results: [1, 2, 3]';
    const extracted = extractJson(response);
    expect(extracted).toBe('[1, 2, 3]');
  });

  it('should prefer objects over arrays', () => {
    const response = '[1, 2] then {"key": "value"}';
    const extracted = extractJson(response);
    expect(extracted).toBe('{"key": "value"}');
  });

  it('should return trimmed response if no JSON found', () => {
    const response = '  Just plain text  ';
    const extracted = extractJson(response);
    expect(extracted).toBe('Just plain text');
  });

  it('should handle nested JSON', () => {
    const response = '{"outer": {"inner": {"deep": true}}}';
    const extracted = extractJson(response);
    const parsed = JSON.parse(extracted);
    expect(parsed.outer.inner.deep).toBe(true);
  });
});

describe('safeJsonParse', () => {
  it('should parse valid JSON', () => {
    const result = safeJsonParse('{"score": 50}', { score: 0 });
    expect(result.score).toBe(50);
  });

  it('should return fallback on invalid JSON', () => {
    const fallback = { score: 42, notes: 'default' };
    const result = safeJsonParse('not valid json', fallback);
    expect(result).toEqual(fallback);
  });

  it('should extract from code blocks before parsing', () => {
    const result = safeJsonParse('```json\n{"value": 123}\n```', { value: 0 });
    expect(result.value).toBe(123);
  });

  it('should handle empty string', () => {
    const fallback = { empty: true };
    const result = safeJsonParse('', fallback);
    expect(result).toEqual(fallback);
  });

  it('should preserve type information', () => {
    interface MyType { name: string; count: number }
    const result = safeJsonParse<MyType>('{"name": "test", "count": 5}', { name: '', count: 0 });
    expect(result.name).toBe('test');
    expect(result.count).toBe(5);
  });
});

describe('cleanResponse', () => {
  it('should remove "Here\'s the..." preambles', () => {
    const response = "Here's the analysis you requested: The text is good.";
    const cleaned = cleanResponse(response);
    expect(cleaned).toBe('The text is good.');
  });

  it('should remove "Let me know..." suffixes', () => {
    const response = 'The answer is 42. Let me know if you need anything else.';
    const cleaned = cleanResponse(response);
    expect(cleaned).toBe('The answer is 42.');
  });

  it('should remove excessive newlines', () => {
    const response = 'First paragraph.\n\n\n\n\nSecond paragraph.';
    const cleaned = cleanResponse(response);
    expect(cleaned).toBe('First paragraph.\n\nSecond paragraph.');
  });

  it('should trim whitespace', () => {
    const response = '   Some text   ';
    const cleaned = cleanResponse(response);
    expect(cleaned).toBe('Some text');
  });

  it('should handle multiple patterns', () => {
    const response = "I'll provide the answer: Result here. Feel free to ask more questions.";
    const cleaned = cleanResponse(response);
    expect(cleaned).toBe('Result here.');
  });
});

describe('normalize', () => {
  it('should clean and extract JSON', () => {
    const response = "Here's the JSON:\n```json\n{\"result\": true}\n```\nHope this helps!";
    const normalized = normalize(response);
    expect(normalized).toBe('{"result": true}');
  });

  it('should handle clean JSON', () => {
    const response = '{"score": 100}';
    const normalized = normalize(response);
    expect(normalized).toBe('{"score": 100}');
  });
});
