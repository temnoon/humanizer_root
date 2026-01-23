/**
 * Tests for transformer service
 */

import { describe, it, expect } from 'vitest';
import { TransformerService } from './transformer.js';
import { BUILTIN_PERSONAS, BUILTIN_STYLES, BUILTIN_NAMESPACES } from './types.js';
import type { LlmAdapter } from '../llm/types.js';

/**
 * Create a mock adapter that echoes the input with a prefix
 */
function createMockAdapter(transformFn?: (input: string) => string): LlmAdapter {
  return {
    name: 'mock',
    defaultModel: 'mock-model',
    async complete(_system: string, user: string): Promise<string> {
      if (transformFn) {
        return transformFn(user);
      }
      // Default: return a simple transformation
      return `[Transformed] ${user.slice(0, 100)}...`;
    },
  };
}

describe('TransformerService', () => {
  describe('transformPersona', () => {
    it('should transform text with persona', async () => {
      const adapter = createMockAdapter((input) => {
        // Simulate a persona transformation
        if (input.includes('empiricist')) {
          return 'The observed phenomenon suggests measurable outcomes.';
        }
        return input;
      });

      const transformer = new TransformerService(adapter);
      const result = await transformer.transformPersona(
        'Something happened.',
        BUILTIN_PERSONAS.empiricist
      );

      expect(result.text).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.inputWordCount).toBe(2);
      expect(result.outputWordCount).toBeGreaterThanOrEqual(0);
    });

    it('should respect preserveLength option', async () => {
      let capturedPrompt = '';
      const adapter = createMockAdapter((input) => {
        capturedPrompt = input;
        return 'Transformed text here.';
      });

      const transformer = new TransformerService(adapter);
      await transformer.transformPersona(
        'Short text.',
        BUILTIN_PERSONAS.romantic,
        { preserveLength: true }
      );

      expect(capturedPrompt).toContain('same length');
    });

    it('should use all builtin personas', async () => {
      const adapter = createMockAdapter(() => 'Result.');
      const transformer = new TransformerService(adapter);

      for (const [name, persona] of Object.entries(BUILTIN_PERSONAS)) {
        const result = await transformer.transformPersona('Test input.', persona);
        expect(result.text).toBeDefined();
      }
    });
  });

  describe('transformStyle', () => {
    it('should transform text with style', async () => {
      const adapter = createMockAdapter(() => 'The academic analysis demonstrates...');
      const transformer = new TransformerService(adapter);

      const result = await transformer.transformStyle(
        'It works well.',
        BUILTIN_STYLES.academic
      );

      expect(result.text).toBeDefined();
      expect(result.inputWordCount).toBe(3);
    });

    it('should detect viewpoint', async () => {
      let capturedPrompt = '';
      const adapter = createMockAdapter((input) => {
        capturedPrompt = input;
        return 'I walked further.';
      });

      const transformer = new TransformerService(adapter);
      await transformer.transformStyle(
        'I walked down the street. My heart was racing.',
        BUILTIN_STYLES.literary
      );

      expect(capturedPrompt).toContain('First-person');
    });

    it('should detect third person viewpoint', async () => {
      let capturedPrompt = '';
      const adapter = createMockAdapter((input) => {
        capturedPrompt = input;
        return 'She continued onward.';
      });

      const transformer = new TransformerService(adapter);
      await transformer.transformStyle(
        'She walked down the street. Her heart was racing.',
        BUILTIN_STYLES.journalistic
      );

      expect(capturedPrompt).toContain('Third-person');
    });

    it('should use all builtin styles', async () => {
      const adapter = createMockAdapter(() => 'Styled result.');
      const transformer = new TransformerService(adapter);

      for (const [name, style] of Object.entries(BUILTIN_STYLES)) {
        const result = await transformer.transformStyle('Test input text.', style);
        expect(result.text).toBeDefined();
      }
    });
  });

  describe('transformNamespace', () => {
    it('should use 3-step process', async () => {
      const calls: string[] = [];
      const adapter = createMockAdapter((input) => {
        if (input.includes('CORE STRUCTURE')) {
          calls.push('extract');
          return 'Abstract structure: protagonist faces challenge.';
        }
        if (input.includes('universe mapper')) {
          calls.push('map');
          return 'In the sci-fi setting, the pilot faces a malfunction.';
        }
        if (input.includes('reconstruction')) {
          calls.push('reconstruct');
          return 'Captain Zara stared at the failing hyperdrive.';
        }
        return 'Unknown step.';
      });

      const transformer = new TransformerService(adapter);
      const result = await transformer.transformNamespace(
        'John faced a difficult choice.',
        BUILTIN_NAMESPACES.scifi
      );

      expect(calls).toEqual(['extract', 'map', 'reconstruct']);
      expect(result.text).toBeDefined();
    });

    it('should use all builtin namespaces', async () => {
      const adapter = createMockAdapter(() => 'Namespace result.');
      const transformer = new TransformerService(adapter);

      for (const [name, namespace] of Object.entries(BUILTIN_NAMESPACES)) {
        const result = await transformer.transformNamespace('A simple story.', namespace);
        expect(result.text).toBeDefined();
      }
    });
  });

  describe('transformCompound', () => {
    it('should apply multiple transforms in sequence', async () => {
      const transforms: string[] = [];
      const adapter = createMockAdapter((input) => {
        if (input.includes('Empiricist')) {
          transforms.push('persona');
          return 'Observed: something occurred.';
        }
        if (input.includes('Academic')) {
          transforms.push('style');
          return 'The phenomenon demonstrates notable characteristics.';
        }
        return 'Default.';
      });

      const transformer = new TransformerService(adapter);
      const result = await transformer.transformCompound(
        'Something happened.',
        [
          { type: 'persona', definition: BUILTIN_PERSONAS.empiricist },
          { type: 'style', definition: BUILTIN_STYLES.academic },
        ]
      );

      expect(transforms).toEqual(['persona', 'style']);
      expect(result.text).toBeDefined();
      expect(result.inputWordCount).toBe(2);
    });

    it('should pass output of each step to next', async () => {
      let lastInput = '';
      const adapter = createMockAdapter((input) => {
        lastInput = input;
        return 'Step output.';
      });

      const transformer = new TransformerService(adapter);
      await transformer.transformCompound(
        'Original text.',
        [
          { type: 'persona', definition: BUILTIN_PERSONAS.stoic },
          { type: 'style', definition: BUILTIN_STYLES.conversational },
        ]
      );

      // Second call should include "Step output" from first
      expect(lastInput).toContain('Step output');
    });
  });

  describe('sanitizeOutput', () => {
    it('should remove platform artifacts from output', async () => {
      const adapter = createMockAdapter(() =>
        "Here's the transformation:\n\nThe actual content.\n\nLet me know if you need anything else!"
      );

      const transformer = new TransformerService(adapter);
      const result = await transformer.transformPersona(
        'Test.',
        BUILTIN_PERSONAS.absurdist
      );

      // sanitizeOutput should have removed the artifacts
      expect(result.text).not.toContain("Here's the");
      expect(result.text).not.toContain('Let me know');
    });
  });
});
