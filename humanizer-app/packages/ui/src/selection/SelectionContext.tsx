/**
 * SelectionContext
 *
 * Provides text selection state and actions across the app.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type { TextSelection, TransformAction, SelectionMode } from './types';

interface SelectionContextValue {
  /** Current selection */
  selection: TextSelection | null;

  /** Selection mode */
  mode: SelectionMode;

  /** Set the current selection */
  setSelection: (selection: TextSelection | null) => void;

  /** Clear the selection */
  clearSelection: () => void;

  /** Available transform actions */
  actions: TransformAction[];

  /** Register a transform action */
  registerAction: (action: TransformAction) => void;

  /** Unregister a transform action */
  unregisterAction: (id: string) => void;

  /** Execute an action on current selection */
  executeAction: (actionId: string) => Promise<void>;

  /** Enter editing mode */
  startEditing: () => void;

  /** Exit editing mode */
  stopEditing: () => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

interface SelectionProviderProps {
  children: ReactNode;

  /** Default actions to register */
  defaultActions?: TransformAction[];

  /** Container element to watch for selections */
  containerRef?: React.RefObject<HTMLElement>;
}

export function SelectionProvider({
  children,
  defaultActions = [],
  containerRef,
}: SelectionProviderProps) {
  const [selection, setSelectionState] = useState<TextSelection | null>(null);
  const [mode, setMode] = useState<SelectionMode>('none');
  const [actions, setActions] = useState<TransformAction[]>(defaultActions);
  const isProcessingRef = useRef(false);

  // Update selection from DOM selection
  const updateFromDOMSelection = useCallback(() => {
    if (isProcessingRef.current) return;

    const domSelection = window.getSelection();
    if (!domSelection || domSelection.isCollapsed) {
      if (mode !== 'editing') {
        setSelectionState(null);
        setMode('none');
      }
      return;
    }

    const text = domSelection.toString().trim();
    if (!text) {
      setSelectionState(null);
      setMode('none');
      return;
    }

    // Check if selection is within container (if specified)
    if (containerRef?.current) {
      const anchorNode = domSelection.anchorNode;
      if (anchorNode && !containerRef.current.contains(anchorNode)) {
        return;
      }
    }

    const range = domSelection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    setSelectionState({
      text,
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      rect,
      anchorNode: domSelection.anchorNode,
    });
    setMode('selected');
  }, [containerRef, mode]);

  // Listen for selection changes
  useEffect(() => {
    const handleSelectionChange = () => {
      // Debounce slightly to avoid rapid updates
      requestAnimationFrame(updateFromDOMSelection);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [updateFromDOMSelection]);

  // Set selection manually
  const setSelection = useCallback((newSelection: TextSelection | null) => {
    setSelectionState(newSelection);
    setMode(newSelection ? 'selected' : 'none');
  }, []);

  // Clear selection
  const clearSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setSelectionState(null);
    setMode('none');
  }, []);

  // Register action
  const registerAction = useCallback((action: TransformAction) => {
    setActions((prev) => {
      // Replace if exists, otherwise add
      const exists = prev.findIndex((a) => a.id === action.id);
      if (exists >= 0) {
        const updated = [...prev];
        updated[exists] = action;
        return updated;
      }
      return [...prev, action];
    });
  }, []);

  // Unregister action
  const unregisterAction = useCallback((id: string) => {
    setActions((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Execute action
  const executeAction = useCallback(
    async (actionId: string) => {
      if (!selection) return;

      const action = actions.find((a) => a.id === actionId);
      if (!action) return;

      isProcessingRef.current = true;
      try {
        await action.handler(selection);
      } finally {
        isProcessingRef.current = false;
      }
    },
    [selection, actions]
  );

  // Start editing
  const startEditing = useCallback(() => {
    setMode('editing');
  }, []);

  // Stop editing
  const stopEditing = useCallback(() => {
    setMode(selection ? 'selected' : 'none');
  }, [selection]);

  const value: SelectionContextValue = {
    selection,
    mode,
    setSelection,
    clearSelection,
    actions,
    registerAction,
    unregisterAction,
    executeAction,
    startEditing,
    stopEditing,
  };

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

/**
 * Hook to use selection context
 */
export function useSelection() {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error('useSelection must be used within a SelectionProvider');
  }
  return context;
}

export default SelectionProvider;
