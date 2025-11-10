import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * CanvasContext - Shared state for Canvas content and text selection
 *
 * Purpose: Enable Canvas → Tool communication by providing a central
 * source of truth for the active text being analyzed/transformed.
 *
 * Features:
 * - Full canvas text management
 * - Text selection tracking
 * - Source type (full vs selection)
 * - Tool coordination
 */

export type SourceType = 'full' | 'selection';

interface CanvasContextType {
  // Text management
  text: string;
  setText: (text: string) => void;

  // Selection management
  selectedText: string | null;
  setSelectedText: (text: string | null) => void;
  clearSelection: () => void;

  // Source type (what gets sent to tools)
  sourceType: SourceType;
  setSourceType: (type: SourceType) => void;

  // Helper to get the active text (full or selection)
  getActiveText: () => string;

  // Tool coordination
  activeTool: string | null;
  setActiveTool: (toolId: string | null) => void;
}

const CanvasContext = createContext<CanvasContextType | undefined>(undefined);

interface CanvasProviderProps {
  children: ReactNode;
}

export function CanvasProvider({ children }: CanvasProviderProps) {
  const [text, setText] = useState<string>('');
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<SourceType>('full');
  const [activeTool, setActiveTool] = useState<string | null>(null);

  const clearSelection = () => {
    setSelectedText(null);
    setSourceType('full');
  };

  const getActiveText = (): string => {
    if (sourceType === 'selection' && selectedText) {
      return selectedText;
    }
    return text;
  };

  const value: CanvasContextType = {
    text,
    setText,
    selectedText,
    setSelectedText,
    clearSelection,
    sourceType,
    setSourceType,
    getActiveText,
    activeTool,
    setActiveTool,
  };

  return (
    <CanvasContext.Provider value={value}>
      {children}
    </CanvasContext.Provider>
  );
}

/**
 * Hook to access Canvas context
 * @throws {Error} if used outside CanvasProvider
 */
export function useCanvas(): CanvasContextType {
  const context = useContext(CanvasContext);
  if (!context) {
    throw new Error('useCanvas must be used within CanvasProvider');
  }
  return context;
}
