/**
 * PanelContext - Panel State Management
 *
 * Manages the 3-panel Studio layout:
 * - Archive Pane (left)
 * - Workspace (center)
 * - Tools Pane (right)
 *
 * Handles:
 * - Panel visibility (open/collapsed)
 * - Active tabs within panels
 * - Mobile sheet states
 * - Focus management between panels
 * - Panel width persistence
 *
 * @module @humanizer/studio/contexts/PanelContext
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Archive pane tabs */
export type ArchiveTab = 'browser' | 'search' | 'clusters' | 'import';

/** Tools pane tabs */
export type ToolsTab = 'analyze' | 'transform' | 'harvest' | 'transcribe';

/** Mobile sheet state */
export type SheetState = 'collapsed' | 'partial' | 'expanded';

/** Panel that can receive focus */
export type FocusablePanel = 'archive' | 'workspace' | 'tools';

/** Panel state */
export interface PanelState {
  // Visibility (desktop)
  archiveOpen: boolean;
  toolsOpen: boolean;

  // Active tabs
  archiveTab: ArchiveTab;
  toolsTab: ToolsTab;

  // Mobile sheet states
  archiveSheetState: SheetState;
  toolsSheetState: SheetState;

  // Focus management
  focusedPanel: FocusablePanel | null;

  // Panel widths (persisted)
  archiveWidth: number;
  toolsWidth: number;

  // Mobile detection
  isMobile: boolean;
}

/** Actions for state reducer */
type PanelAction =
  | { type: 'TOGGLE_ARCHIVE' }
  | { type: 'TOGGLE_TOOLS' }
  | { type: 'OPEN_ARCHIVE' }
  | { type: 'OPEN_TOOLS' }
  | { type: 'CLOSE_ARCHIVE' }
  | { type: 'CLOSE_TOOLS' }
  | { type: 'SET_ARCHIVE_TAB'; tab: ArchiveTab }
  | { type: 'SET_TOOLS_TAB'; tab: ToolsTab }
  | { type: 'SET_ARCHIVE_SHEET_STATE'; state: SheetState }
  | { type: 'SET_TOOLS_SHEET_STATE'; state: SheetState }
  | { type: 'FOCUS_PANEL'; panel: FocusablePanel | null }
  | { type: 'SET_ARCHIVE_WIDTH'; width: number }
  | { type: 'SET_TOOLS_WIDTH'; width: number }
  | { type: 'SET_MOBILE'; isMobile: boolean };

/** Context value type */
export interface PanelContextValue {
  state: PanelState;

  // Panel visibility
  toggleArchive: () => void;
  toggleTools: () => void;
  openArchive: () => void;
  openTools: () => void;
  closeArchive: () => void;
  closeTools: () => void;

  // Tab switching
  setArchiveTab: (tab: ArchiveTab) => void;
  setToolsTab: (tab: ToolsTab) => void;

  // Mobile sheet control
  setArchiveSheetState: (state: SheetState) => void;
  setToolsSheetState: (state: SheetState) => void;

  // Focus management
  focusPanel: (panel: FocusablePanel | null) => void;

  // Width control
  setArchiveWidth: (width: number) => void;
  setToolsWidth: (width: number) => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'humanizer-panel-state';
const MOBILE_BREAKPOINT = 768;
const DEFAULT_ARCHIVE_WIDTH = 280;
const DEFAULT_TOOLS_WIDTH = 320;
const MIN_ARCHIVE_WIDTH = 200;
const MAX_ARCHIVE_WIDTH = 400;
const MIN_TOOLS_WIDTH = 280;
const MAX_TOOLS_WIDTH = 480;

/** Default state */
const defaultState: PanelState = {
  archiveOpen: true,
  toolsOpen: true,
  archiveTab: 'browser',
  toolsTab: 'analyze',
  archiveSheetState: 'collapsed',
  toolsSheetState: 'collapsed',
  focusedPanel: null,
  archiveWidth: DEFAULT_ARCHIVE_WIDTH,
  toolsWidth: DEFAULT_TOOLS_WIDTH,
  isMobile: false,
};

// ═══════════════════════════════════════════════════════════════════════════
// REDUCER
// ═══════════════════════════════════════════════════════════════════════════

function panelReducer(state: PanelState, action: PanelAction): PanelState {
  switch (action.type) {
    case 'TOGGLE_ARCHIVE':
      return { ...state, archiveOpen: !state.archiveOpen };

    case 'TOGGLE_TOOLS':
      return { ...state, toolsOpen: !state.toolsOpen };

    case 'OPEN_ARCHIVE':
      return { ...state, archiveOpen: true };

    case 'OPEN_TOOLS':
      return { ...state, toolsOpen: true };

    case 'CLOSE_ARCHIVE':
      return { ...state, archiveOpen: false };

    case 'CLOSE_TOOLS':
      return { ...state, toolsOpen: false };

    case 'SET_ARCHIVE_TAB':
      return { ...state, archiveTab: action.tab };

    case 'SET_TOOLS_TAB':
      return { ...state, toolsTab: action.tab };

    case 'SET_ARCHIVE_SHEET_STATE':
      return { ...state, archiveSheetState: action.state };

    case 'SET_TOOLS_SHEET_STATE':
      return { ...state, toolsSheetState: action.state };

    case 'FOCUS_PANEL':
      return { ...state, focusedPanel: action.panel };

    case 'SET_ARCHIVE_WIDTH':
      return {
        ...state,
        archiveWidth: Math.max(MIN_ARCHIVE_WIDTH, Math.min(MAX_ARCHIVE_WIDTH, action.width)),
      };

    case 'SET_TOOLS_WIDTH':
      return {
        ...state,
        toolsWidth: Math.max(MIN_TOOLS_WIDTH, Math.min(MAX_TOOLS_WIDTH, action.width)),
      };

    case 'SET_MOBILE':
      return { ...state, isMobile: action.isMobile };

    default:
      return state;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════

/** Load persisted state from localStorage */
function loadPersistedState(): Partial<PanelState> {
  if (typeof window === 'undefined') return {};

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};

    const parsed = JSON.parse(stored);
    return {
      archiveOpen: parsed.archiveOpen ?? defaultState.archiveOpen,
      toolsOpen: parsed.toolsOpen ?? defaultState.toolsOpen,
      archiveTab: parsed.archiveTab ?? defaultState.archiveTab,
      toolsTab: parsed.toolsTab ?? defaultState.toolsTab,
      archiveWidth: parsed.archiveWidth ?? defaultState.archiveWidth,
      toolsWidth: parsed.toolsWidth ?? defaultState.toolsWidth,
    };
  } catch {
    return {};
  }
}

/** Persist state to localStorage */
function persistState(state: PanelState): void {
  if (typeof window === 'undefined') return;

  try {
    const toStore = {
      archiveOpen: state.archiveOpen,
      toolsOpen: state.toolsOpen,
      archiveTab: state.archiveTab,
      toolsTab: state.toolsTab,
      archiveWidth: state.archiveWidth,
      toolsWidth: state.toolsWidth,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // Ignore storage errors
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

const PanelContext = createContext<PanelContextValue | null>(null);

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

export interface PanelProviderProps {
  children: ReactNode;
}

export function PanelProvider({ children }: PanelProviderProps): React.ReactElement {
  // Initialize state with persisted values
  const [state, dispatch] = useReducer(panelReducer, defaultState, (initial) => ({
    ...initial,
    ...loadPersistedState(),
    isMobile: typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT,
  }));

  // Persist state changes
  useEffect(() => {
    persistState(state);
  }, [state]);

  // Track window resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
      if (isMobile !== state.isMobile) {
        dispatch({ type: 'SET_MOBILE', isMobile });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [state.isMobile]);

  // Action creators
  const toggleArchive = useCallback(() => dispatch({ type: 'TOGGLE_ARCHIVE' }), []);
  const toggleTools = useCallback(() => dispatch({ type: 'TOGGLE_TOOLS' }), []);
  const openArchive = useCallback(() => dispatch({ type: 'OPEN_ARCHIVE' }), []);
  const openTools = useCallback(() => dispatch({ type: 'OPEN_TOOLS' }), []);
  const closeArchive = useCallback(() => dispatch({ type: 'CLOSE_ARCHIVE' }), []);
  const closeTools = useCallback(() => dispatch({ type: 'CLOSE_TOOLS' }), []);

  const setArchiveTab = useCallback((tab: ArchiveTab) => {
    dispatch({ type: 'SET_ARCHIVE_TAB', tab });
  }, []);

  const setToolsTab = useCallback((tab: ToolsTab) => {
    dispatch({ type: 'SET_TOOLS_TAB', tab });
  }, []);

  const setArchiveSheetState = useCallback((sheetState: SheetState) => {
    dispatch({ type: 'SET_ARCHIVE_SHEET_STATE', state: sheetState });
  }, []);

  const setToolsSheetState = useCallback((sheetState: SheetState) => {
    dispatch({ type: 'SET_TOOLS_SHEET_STATE', state: sheetState });
  }, []);

  const focusPanel = useCallback((panel: FocusablePanel | null) => {
    dispatch({ type: 'FOCUS_PANEL', panel });
  }, []);

  const setArchiveWidth = useCallback((width: number) => {
    dispatch({ type: 'SET_ARCHIVE_WIDTH', width });
  }, []);

  const setToolsWidth = useCallback((width: number) => {
    dispatch({ type: 'SET_TOOLS_WIDTH', width });
  }, []);

  // Memoize context value
  const value = useMemo<PanelContextValue>(
    () => ({
      state,
      toggleArchive,
      toggleTools,
      openArchive,
      openTools,
      closeArchive,
      closeTools,
      setArchiveTab,
      setToolsTab,
      setArchiveSheetState,
      setToolsSheetState,
      focusPanel,
      setArchiveWidth,
      setToolsWidth,
    }),
    [
      state,
      toggleArchive,
      toggleTools,
      openArchive,
      openTools,
      closeArchive,
      closeTools,
      setArchiveTab,
      setToolsTab,
      setArchiveSheetState,
      setToolsSheetState,
      focusPanel,
      setArchiveWidth,
      setToolsWidth,
    ]
  );

  return <PanelContext.Provider value={value}>{children}</PanelContext.Provider>;
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════

/** Use panel context - throws if used outside provider */
export function usePanels(): PanelContextValue {
  const context = useContext(PanelContext);
  if (!context) {
    throw new Error('usePanels must be used within a PanelProvider');
  }
  return context;
}

/** Use only panel state (for components that don't need actions) */
export function usePanelState(): PanelState {
  const { state } = usePanels();
  return state;
}

/** Check if archive is visible */
export function useArchiveVisible(): boolean {
  const { state } = usePanels();
  return state.archiveOpen;
}

/** Check if tools is visible */
export function useToolsVisible(): boolean {
  const { state } = usePanels();
  return state.toolsOpen;
}

/** Get current focused panel */
export function useFocusedPanel(): FocusablePanel | null {
  const { state } = usePanels();
  return state.focusedPanel;
}

/** Check if currently in mobile view */
export function useIsMobile(): boolean {
  const { state } = usePanels();
  return state.isMobile;
}

export default PanelContext;
