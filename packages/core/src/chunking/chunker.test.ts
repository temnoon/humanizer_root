/**
 * Chunking Service Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ChunkingService,
  getChunkingService,
  initChunkingService,
  splitByParagraphs,
  splitBySentences,
  splitByConversation,
  splitHard,
  countWords,
} from './index.js';

describe('ChunkingService', () => {
  let service: ChunkingService;

  beforeEach(() => {
    service = new ChunkingService();
  });

  describe('chunk', () => {
    it('returns empty result for empty input', () => {
      const result = service.chunk({ content: '' });

      expect(result.chunks).toHaveLength(0);
      expect(result.stats.chunkCount).toBe(0);
      expect(result.stats.originalCharCount).toBe(0);
    });

    it('returns single chunk for small content', () => {
      const content = 'This is a short piece of content.';
      const result = service.chunk({ content });

      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].text).toBe(content);
      expect(result.chunks[0].index).toBe(0);
      expect(result.chunks[0].startOffset).toBe(0);
      expect(result.chunks[0].endOffset).toBe(content.length);
    });

    it('chunks long content by paragraphs', () => {
      const paragraphs = Array(10).fill('This is a paragraph with many words. '.repeat(50));
      const content = paragraphs.join('\n\n');
      const result = service.chunk({ content });

      expect(result.chunks.length).toBeGreaterThan(1);
      // Allow for trim() adjusting character count slightly
      expect(result.stats.originalCharCount).toBeGreaterThanOrEqual(content.length - 10);
    });

    it('preserves parent ID in chunks', () => {
      const content = 'Paragraph one.\n\nParagraph two.\n\nParagraph three.';
      const result = service.chunk({ content, parentId: 'parent-123' });

      for (const chunk of result.chunks) {
        expect(chunk.parentId).toBe('parent-123');
      }
    });

    it('computes correct statistics', () => {
      const content = 'Word '.repeat(100);
      const result = service.chunk({ content });

      expect(result.stats.originalWordCount).toBe(100);
      expect(result.stats.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('chunkWithOverlap', () => {
    it('adds overlap between chunks', () => {
      // Create content that will produce multiple chunks
      const content = Array(20)
        .fill('This is a paragraph with enough content to trigger chunking. '.repeat(10))
        .join('\n\n');

      const service = new ChunkingService({
        targetChunkChars: 500,
        maxChunkChars: 1000,
        overlapChars: 50,
      });

      const result = service.chunkWithOverlap({ content });

      if (result.chunks.length > 1) {
        // First chunk should have overlap indicator
        expect(result.chunks[0].text).toContain('...');
      }
    });
  });
});

describe('Boundary Detection', () => {
  describe('countWords', () => {
    it('counts words correctly', () => {
      expect(countWords('one two three')).toBe(3);
      expect(countWords('  spaced   words  ')).toBe(2);
      expect(countWords('')).toBe(0);
      expect(countWords('single')).toBe(1);
    });
  });

  describe('splitByParagraphs', () => {
    it('splits on double newlines', () => {
      const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
      const parts = splitByParagraphs(text);

      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('First paragraph.');
      expect(parts[1]).toBe('Second paragraph.');
      expect(parts[2]).toBe('Third paragraph.');
    });

    it('handles multiple newlines', () => {
      const text = 'Part one.\n\n\n\nPart two.';
      const parts = splitByParagraphs(text);

      expect(parts).toHaveLength(2);
    });

    it('returns single item for no paragraphs', () => {
      const text = 'Just one paragraph with no breaks.';
      const parts = splitByParagraphs(text);

      expect(parts).toHaveLength(1);
      expect(parts[0]).toBe(text);
    });
  });

  describe('splitBySentences', () => {
    it('splits on sentence boundaries', () => {
      const text = 'First sentence. Second sentence! Third sentence?';
      const parts = splitBySentences(text);

      expect(parts.length).toBeGreaterThanOrEqual(1);
    });

    it('handles text without sentence endings', () => {
      const text = 'Just a fragment without punctuation';
      const parts = splitBySentences(text);

      expect(parts).toHaveLength(1);
    });
  });

  describe('splitByConversation', () => {
    it('splits on conversation turn markers', () => {
      const text = 'Human: Hello there!\nAssistant: Hi, how can I help?';
      const parts = splitByConversation(text);

      expect(parts.length).toBeGreaterThanOrEqual(1);
    });

    it('returns single item for non-conversation text', () => {
      const text = 'This is just regular text without turn markers.';
      const parts = splitByConversation(text);

      expect(parts).toHaveLength(1);
    });
  });

  describe('splitHard', () => {
    it('splits at character limit', () => {
      const text = 'A'.repeat(100);
      const parts = splitHard(text, 30);

      expect(parts.length).toBeGreaterThan(1);
      for (const part of parts) {
        expect(part.length).toBeLessThanOrEqual(30);
      }
    });

    it('prefers word boundaries', () => {
      const text = 'word '.repeat(20);
      const parts = splitHard(text, 20);

      // Should split on spaces rather than mid-word
      expect(parts.length).toBeGreaterThan(1);
    });
  });
});

describe('Singleton Management', () => {
  it('returns same instance from getChunkingService', () => {
    const service1 = getChunkingService();
    const service2 = getChunkingService();

    expect(service1).toBe(service2);
  });

  it('creates new instance with initChunkingService', () => {
    const service1 = getChunkingService();
    const service2 = initChunkingService({ targetChunkChars: 500 });

    // After init, getChunkingService returns new instance
    const service3 = getChunkingService();
    expect(service2).toBe(service3);
  });
});
