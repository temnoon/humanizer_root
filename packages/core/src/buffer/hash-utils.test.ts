/**
 * Hash Utilities Unit Tests
 *
 * Tests for content hashing, word counting, and format detection.
 *
 * @module @humanizer/core/buffer/hash-utils.test
 */

import { describe, it, expect } from 'vitest';
import {
  computeContentHash,
  computeShortHash,
  computeWordCount,
  computeCharCount,
  computeSentenceCount,
  computeParagraphCount,
  detectContentFormat,
  computeDeltaHash,
  computeTextSimilarity,
  generateUUID,
} from './hash-utils.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT HASHING
// ═══════════════════════════════════════════════════════════════════════════

describe('computeContentHash', () => {
  it('returns consistent hash for same content', () => {
    const text = 'Hello, world!';
    const hash1 = computeContentHash(text);
    const hash2 = computeContentHash(text);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex length
  });

  it('returns different hash for different content', () => {
    const hash1 = computeContentHash('Hello');
    const hash2 = computeContentHash('World');

    expect(hash1).not.toBe(hash2);
  });

  it('normalizes whitespace before hashing', () => {
    const hash1 = computeContentHash('  Hello  ');
    const hash2 = computeContentHash('Hello');

    expect(hash1).toBe(hash2);
  });

  it('normalizes line endings (CRLF to LF)', () => {
    const hash1 = computeContentHash('Hello\r\nWorld');
    const hash2 = computeContentHash('Hello\nWorld');

    expect(hash1).toBe(hash2);
  });

  it('handles empty string', () => {
    const hash = computeContentHash('');
    expect(hash).toHaveLength(64);
  });

  it('handles unicode content', () => {
    const hash = computeContentHash('Hello 世界 🌍');
    expect(hash).toHaveLength(64);
  });
});

describe('computeShortHash', () => {
  it('returns first 12 characters of full hash', () => {
    const text = 'Hello, world!';
    const fullHash = computeContentHash(text);
    const shortHash = computeShortHash(text);

    expect(shortHash).toBe(fullHash.slice(0, 12));
    expect(shortHash).toHaveLength(12);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// WORD COUNT
// ═══════════════════════════════════════════════════════════════════════════

describe('computeWordCount', () => {
  it('counts words correctly', () => {
    expect(computeWordCount('Hello world')).toBe(2);
    expect(computeWordCount('One two three four five')).toBe(5);
  });

  it('handles multiple spaces', () => {
    expect(computeWordCount('Hello    world')).toBe(2);
  });

  it('handles newlines and tabs', () => {
    expect(computeWordCount('Hello\nworld\tthere')).toBe(3);
  });

  it('returns 0 for empty string', () => {
    expect(computeWordCount('')).toBe(0);
  });

  it('returns 0 for whitespace-only string', () => {
    expect(computeWordCount('   \n\t  ')).toBe(0);
  });

  it('handles punctuation attached to words', () => {
    expect(computeWordCount('Hello, world!')).toBe(2);
  });
});

describe('computeCharCount', () => {
  it('counts characters excluding whitespace', () => {
    expect(computeCharCount('Hello world')).toBe(10);
    expect(computeCharCount('a b c')).toBe(3);
  });

  it('returns 0 for empty string', () => {
    expect(computeCharCount('')).toBe(0);
  });
});

describe('computeSentenceCount', () => {
  it('counts sentences by punctuation', () => {
    expect(computeSentenceCount('Hello. World.')).toBe(2);
    expect(computeSentenceCount('Hello! World?')).toBe(2);
  });

  it('handles multiple punctuation marks', () => {
    expect(computeSentenceCount('What?! Really...')).toBe(2);
  });

  it('returns 0 for empty string', () => {
    expect(computeSentenceCount('')).toBe(0);
  });

  it('returns 1 for sentence without ending punctuation', () => {
    expect(computeSentenceCount('Hello world')).toBe(1);
  });
});

describe('computeParagraphCount', () => {
  it('counts paragraphs by double newlines', () => {
    expect(computeParagraphCount('Para 1\n\nPara 2')).toBe(2);
    expect(computeParagraphCount('Para 1\n\nPara 2\n\nPara 3')).toBe(3);
  });

  it('handles single paragraph', () => {
    expect(computeParagraphCount('Hello world')).toBe(1);
  });

  it('returns 0 for empty string', () => {
    expect(computeParagraphCount('')).toBe(0);
  });

  it('ignores single newlines', () => {
    expect(computeParagraphCount('Line 1\nLine 2\nLine 3')).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FORMAT DETECTION
// ═══════════════════════════════════════════════════════════════════════════

describe('detectContentFormat', () => {
  describe('detects HTML', () => {
    it('recognizes HTML tags', () => {
      expect(detectContentFormat('<div>Hello</div>')).toBe('html');
      expect(detectContentFormat('<p>Paragraph</p>')).toBe('html');
      expect(detectContentFormat('<!DOCTYPE html>')).toBe('html');
    });
  });

  describe('detects Markdown', () => {
    it('recognizes headers', () => {
      expect(detectContentFormat('# Header\n\nSome text with [link](url)')).toBe('markdown');
    });

    it('recognizes links and images', () => {
      expect(detectContentFormat('Check this [link](http://example.com) and ![image](img.png)')).toBe('markdown');
    });

    it('recognizes lists', () => {
      expect(detectContentFormat('- Item 1\n- Item 2\n\n1. First\n2. Second')).toBe('markdown');
    });

    it('recognizes code blocks', () => {
      expect(detectContentFormat('```\ncode here\n```\n\nSome **bold** text')).toBe('markdown');
    });
  });

  describe('detects code', () => {
    it('recognizes JavaScript with significant indentation', () => {
      const js = `
function hello() {
  const x = 1;
  const y = 2;
  const z = 3;
  if (x > 0) {
    return x;
  }
  return y + z;
}

export function main() {
  const result = hello();
  console.log(result);
}
      `;
      expect(detectContentFormat(js)).toBe('code');
    });

    it('recognizes Python with significant indentation', () => {
      const python = `
def hello():
    x = 1
    y = 2
    z = 3
    if x > 0:
        return x
    return y + z

class MyClass:
    def __init__(self):
        self.value = 42
      `;
      expect(detectContentFormat(python)).toBe('code');
    });

    it('recognizes control flow with braces and semicolons', () => {
      const code = `
if (condition) {
  doSomething();
  doMore();
  doEvenMore();
} else {
  doOther();
  doAnother();
}
for (let i = 0; i < 10; i++) {
  process(i);
}
      `;
      expect(detectContentFormat(code)).toBe('code');
    });
  });

  describe('detects plain text', () => {
    it('recognizes prose', () => {
      expect(detectContentFormat('Hello, this is just some plain text without any special formatting.')).toBe('text');
    });

    it('returns text for ambiguous content', () => {
      expect(detectContentFormat('A simple sentence.')).toBe('text');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DELTA AND SIMILARITY
// ═══════════════════════════════════════════════════════════════════════════

describe('computeDeltaHash', () => {
  it('returns consistent hash for same before/after', () => {
    const delta1 = computeDeltaHash('before', 'after');
    const delta2 = computeDeltaHash('before', 'after');

    expect(delta1).toBe(delta2);
    expect(delta1).toHaveLength(64);
  });

  it('returns different hash for different changes', () => {
    const delta1 = computeDeltaHash('before', 'after1');
    const delta2 = computeDeltaHash('before', 'after2');

    expect(delta1).not.toBe(delta2);
  });
});

describe('computeTextSimilarity', () => {
  it('returns 1 for identical text', () => {
    expect(computeTextSimilarity('hello world', 'hello world')).toBe(1);
  });

  it('returns 1 for both empty', () => {
    expect(computeTextSimilarity('', '')).toBe(1);
  });

  it('returns 0 when one is empty', () => {
    expect(computeTextSimilarity('hello', '')).toBe(0);
    expect(computeTextSimilarity('', 'world')).toBe(0);
  });

  it('returns value between 0 and 1 for partial overlap', () => {
    const similarity = computeTextSimilarity('hello world', 'hello there');
    expect(similarity).toBeGreaterThan(0);
    expect(similarity).toBeLessThan(1);
  });

  it('is case insensitive', () => {
    expect(computeTextSimilarity('Hello World', 'hello world')).toBe(1);
  });

  it('returns 0 for completely different text', () => {
    expect(computeTextSimilarity('apple banana', 'car door')).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// UUID GENERATION
// ═══════════════════════════════════════════════════════════════════════════

describe('generateUUID', () => {
  it('returns a valid UUID format', () => {
    const uuid = generateUUID();
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    expect(uuid).toMatch(uuidPattern);
  });

  it('generates unique UUIDs', () => {
    const uuids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      uuids.add(generateUUID());
    }
    expect(uuids.size).toBe(100);
  });
});
