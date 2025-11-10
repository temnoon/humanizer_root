import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { CanvasProvider, useCanvas } from './CanvasContext';
import type { ReactNode } from 'react';

describe('CanvasContext', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <CanvasProvider>{children}</CanvasProvider>
  );

  describe('Initial State', () => {
    it('should provide default values', () => {
      const { result } = renderHook(() => useCanvas(), { wrapper });

      expect(result.current.text).toBe('');
      expect(result.current.selectedText).toBe(null);
      expect(result.current.sourceType).toBe('full');
      expect(result.current.activeTool).toBe(null);
    });
  });

  describe('Text Management', () => {
    it('should update text via setText', () => {
      const { result } = renderHook(() => useCanvas(), { wrapper });

      act(() => {
        result.current.setText('Hello, World!');
      });

      expect(result.current.text).toBe('Hello, World!');
    });

    it('should handle empty text', () => {
      const { result } = renderHook(() => useCanvas(), { wrapper });

      act(() => {
        result.current.setText('Some text');
        result.current.setText('');
      });

      expect(result.current.text).toBe('');
    });

    it('should handle long text', () => {
      const { result } = renderHook(() => useCanvas(), { wrapper });
      const longText = 'A'.repeat(10000);

      act(() => {
        result.current.setText(longText);
      });

      expect(result.current.text).toBe(longText);
      expect(result.current.text.length).toBe(10000);
    });
  });

  describe('Selection Management', () => {
    it('should update selectedText', () => {
      const { result } = renderHook(() => useCanvas(), { wrapper });

      act(() => {
        result.current.setText('Full text content');
        result.current.setSelectedText('selected portion');
      });

      expect(result.current.selectedText).toBe('selected portion');
    });

    it('should update sourceType when setting selection', () => {
      const { result } = renderHook(() => useCanvas(), { wrapper });

      act(() => {
        result.current.setSelectedText('some selection');
        result.current.setSourceType('selection');
      });

      expect(result.current.sourceType).toBe('selection');
    });

    it('should clear selection', () => {
      const { result } = renderHook(() => useCanvas(), { wrapper });

      act(() => {
        result.current.setSelectedText('selected text');
        result.current.setSourceType('selection');
        result.current.clearSelection();
      });

      expect(result.current.selectedText).toBe(null);
      expect(result.current.sourceType).toBe('full');
    });
  });

  describe('getActiveText', () => {
    it('should return full text when sourceType is "full"', () => {
      const { result } = renderHook(() => useCanvas(), { wrapper });

      act(() => {
        result.current.setText('Full text content');
        result.current.setSourceType('full');
      });

      expect(result.current.getActiveText()).toBe('Full text content');
    });

    it('should return selected text when sourceType is "selection"', () => {
      const { result } = renderHook(() => useCanvas(), { wrapper });

      act(() => {
        result.current.setText('Full text content');
        result.current.setSelectedText('selected portion');
        result.current.setSourceType('selection');
      });

      expect(result.current.getActiveText()).toBe('selected portion');
    });

    it('should return full text when sourceType is "selection" but no text selected', () => {
      const { result } = renderHook(() => useCanvas(), { wrapper });

      act(() => {
        result.current.setText('Full text content');
        result.current.setSourceType('selection');
      });

      expect(result.current.getActiveText()).toBe('Full text content');
    });

    it('should handle empty text and selection', () => {
      const { result} = renderHook(() => useCanvas(), { wrapper });

      expect(result.current.getActiveText()).toBe('');
    });
  });

  describe('Tool Coordination', () => {
    it('should set active tool', () => {
      const { result } = renderHook(() => useCanvas(), { wrapper });

      act(() => {
        result.current.setActiveTool('allegorical');
      });

      expect(result.current.activeTool).toBe('allegorical');
    });

    it('should clear active tool', () => {
      const { result } = renderHook(() => useCanvas(), { wrapper });

      act(() => {
        result.current.setActiveTool('round-trip');
        result.current.setActiveTool(null);
      });

      expect(result.current.activeTool).toBe(null);
    });

    it('should switch between tools', () => {
      const { result } = renderHook(() => useCanvas(), { wrapper });

      act(() => {
        result.current.setActiveTool('allegorical');
      });
      expect(result.current.activeTool).toBe('allegorical');

      act(() => {
        result.current.setActiveTool('quantum-reading');
      });
      expect(result.current.activeTool).toBe('quantum-reading');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when used outside provider', () => {
      expect(() => {
        renderHook(() => useCanvas());
      }).toThrow('useCanvas must be used within CanvasProvider');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete workflow: set text → select → send to tool → clear', () => {
      const { result } = renderHook(() => useCanvas(), { wrapper });

      // User loads text to canvas
      act(() => {
        result.current.setText('This is the full narrative text for analysis.');
      });
      expect(result.current.text).toBe('This is the full narrative text for analysis.');

      // User selects portion of text
      act(() => {
        result.current.setSelectedText('narrative text');
        result.current.setSourceType('selection');
      });
      expect(result.current.getActiveText()).toBe('narrative text');

      // User sends to tool
      act(() => {
        result.current.setActiveTool('allegorical');
      });
      expect(result.current.activeTool).toBe('allegorical');

      // Tool reads the active text
      const textForProcessing = result.current.getActiveText();
      expect(textForProcessing).toBe('narrative text');

      // User clears selection
      act(() => {
        result.current.clearSelection();
      });
      expect(result.current.selectedText).toBe(null);
      expect(result.current.getActiveText()).toBe('This is the full narrative text for analysis.');
    });

    it('should maintain text when switching tools', () => {
      const { result } = renderHook(() => useCanvas(), { wrapper });

      act(() => {
        result.current.setText('Persistent text');
        result.current.setActiveTool('allegorical');
      });

      const textBeforeSwitch = result.current.text;

      act(() => {
        result.current.setActiveTool('round-trip');
      });

      expect(result.current.text).toBe(textBeforeSwitch);
      expect(result.current.text).toBe('Persistent text');
    });
  });
});
