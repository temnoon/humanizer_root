/**
 * Sheet Context
 *
 * Provides coordination between multiple bottom sheets.
 * Ensures only one sheet can be fully expanded at a time.
 *
 * Usage:
 * ```tsx
 * // In App or layout wrapper
 * <SheetProvider>
 *   <StudioLayout />
 * </SheetProvider>
 *
 * // In component with bottom sheets
 * const { registerSheet, getSheetState, expandSheet } = useSheetContext();
 * ```
 */

import { createContext, useContext, ParentComponent, createSignal, Accessor, batch } from 'solid-js';
import type { SheetState } from '@/components/studio/BottomSheet';

interface SheetInfo {
  id: string;
  state: SheetState;
}

interface SheetContextValue {
  /** Register a new sheet */
  registerSheet: (id: string, initialState?: SheetState) => void;

  /** Unregister a sheet */
  unregisterSheet: (id: string) => void;

  /** Get current state of a sheet */
  getSheetState: (id: string) => SheetState;

  /** Set state of a sheet (collapses others if expanded) */
  setSheetState: (id: string, state: SheetState) => void;

  /** Expand a sheet (collapses all others) */
  expandSheet: (id: string) => void;

  /** Collapse all sheets */
  collapseAll: () => void;

  /** Check if any sheet is expanded */
  isAnyExpanded: Accessor<boolean>;

  /** Get all registered sheet IDs */
  getSheetIds: () => string[];

  /** Get the currently expanded sheet ID (if any) */
  expandedSheetId: Accessor<string | null>;
}

const SheetContext = createContext<SheetContextValue>();

export const SheetProvider: ParentComponent = (props) => {
  const [sheets, setSheets] = createSignal<Map<string, SheetState>>(new Map());
  const [expandedSheetId, setExpandedSheetId] = createSignal<string | null>(null);

  const registerSheet = (id: string, initialState: SheetState = 'collapsed') => {
    setSheets(prev => {
      const next = new Map(prev);
      next.set(id, initialState);
      return next;
    });

    if (initialState === 'expanded') {
      setExpandedSheetId(id);
    }
  };

  const unregisterSheet = (id: string) => {
    setSheets(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });

    if (expandedSheetId() === id) {
      setExpandedSheetId(null);
    }
  };

  const getSheetState = (id: string): SheetState => {
    return sheets().get(id) || 'collapsed';
  };

  const setSheetState = (id: string, state: SheetState) => {
    batch(() => {
      // If expanding this sheet, collapse any currently expanded sheet
      if (state === 'expanded') {
        const currentExpanded = expandedSheetId();
        if (currentExpanded && currentExpanded !== id) {
          setSheets(prev => {
            const next = new Map(prev);
            next.set(currentExpanded, 'collapsed');
            next.set(id, state);
            return next;
          });
        } else {
          setSheets(prev => {
            const next = new Map(prev);
            next.set(id, state);
            return next;
          });
        }
        setExpandedSheetId(id);
      } else {
        setSheets(prev => {
          const next = new Map(prev);
          next.set(id, state);
          return next;
        });

        // If we're collapsing the currently expanded sheet, clear the expanded ID
        if (expandedSheetId() === id && state === 'collapsed') {
          setExpandedSheetId(null);
        }
      }
    });
  };

  const expandSheet = (id: string) => {
    setSheetState(id, 'expanded');
  };

  const collapseAll = () => {
    batch(() => {
      setSheets(prev => {
        const next = new Map(prev);
        for (const key of next.keys()) {
          next.set(key, 'collapsed');
        }
        return next;
      });
      setExpandedSheetId(null);
    });
  };

  const isAnyExpanded = () => expandedSheetId() !== null;

  const getSheetIds = () => Array.from(sheets().keys());

  const contextValue: SheetContextValue = {
    registerSheet,
    unregisterSheet,
    getSheetState,
    setSheetState,
    expandSheet,
    collapseAll,
    isAnyExpanded,
    getSheetIds,
    expandedSheetId,
  };

  return (
    <SheetContext.Provider value={contextValue}>
      {props.children}
    </SheetContext.Provider>
  );
};

export function useSheetContext() {
  const context = useContext(SheetContext);

  if (!context) {
    throw new Error('useSheetContext must be used within a SheetProvider');
  }

  return context;
}

/**
 * Hook to connect a BottomSheet to the context
 */
export function useSheetCoordination(sheetId: string, initialState: SheetState = 'collapsed') {
  const context = useContext(SheetContext);

  // If no context, return standalone state
  if (!context) {
    const [state, setState] = createSignal<SheetState>(initialState);
    return {
      state,
      setState,
      isOtherExpanded: () => false,
    };
  }

  // Register on mount (handled in effect in component)
  context.registerSheet(sheetId, initialState);

  const state = () => context.getSheetState(sheetId);
  const setState = (newState: SheetState) => context.setSheetState(sheetId, newState);
  const isOtherExpanded = () => {
    const expanded = context.expandedSheetId();
    return expanded !== null && expanded !== sheetId;
  };

  return {
    state,
    setState,
    isOtherExpanded,
    unregister: () => context.unregisterSheet(sheetId),
  };
}

export default SheetContext;
