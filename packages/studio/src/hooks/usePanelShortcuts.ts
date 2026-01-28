/**
 * usePanelShortcuts - Keyboard Shortcuts for Panel Management
 *
 * Provides global keyboard shortcuts for the 3-panel Studio layout:
 * - Cmd/Ctrl + 1: Focus Archive Pane
 * - Cmd/Ctrl + 2: Focus Workspace
 * - Cmd/Ctrl + 3: Focus Tools Pane
 * - Cmd/Ctrl + [: Toggle Archive Pane
 * - Cmd/Ctrl + ]: Toggle Tools Pane
 *
 * @module @humanizer/studio/hooks/usePanelShortcuts
 */

import { useCallback, useEffect } from 'react';
import { usePanels, type FocusablePanel } from '../contexts/PanelContext';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface PanelShortcutOptions {
  /** Whether shortcuts are enabled (default: true) */
  enabled?: boolean;
  /** Custom callback when panel is focused */
  onFocus?: (panel: FocusablePanel) => void;
  /** Custom callback when panel is toggled */
  onToggle?: (panel: 'archive' | 'tools', isOpen: boolean) => void;
}

export interface PanelShortcutHandlers {
  /** Manually focus a panel */
  focusPanelByNumber: (num: 1 | 2 | 3) => void;
  /** Toggle archive panel */
  toggleArchivePanel: () => void;
  /** Toggle tools panel */
  toggleToolsPanel: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Panel selectors for focus management */
const PANEL_FOCUS_SELECTORS: Record<FocusablePanel, string> = {
  archive: '[data-panel="archive"] [tabindex="0"], [data-panel="archive"] button, [data-panel="archive"] input',
  workspace: '[data-panel="workspace"] [tabindex="0"], [data-panel="workspace"] button, [data-panel="workspace"] textarea',
  tools: '[data-panel="tools"] [tabindex="0"], [data-panel="tools"] button, [data-panel="tools"] input',
};

/** Map of number keys to panels */
const NUMBER_TO_PANEL: Record<string, FocusablePanel> = {
  '1': 'archive',
  '2': 'workspace',
  '3': 'tools',
};

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hook to manage panel keyboard shortcuts
 * @param options Configuration options
 * @returns Handlers for manual shortcut invocation
 */
export function usePanelShortcuts(
  options: PanelShortcutOptions = {}
): PanelShortcutHandlers {
  const { enabled = true, onFocus, onToggle } = options;
  const {
    state,
    toggleArchive,
    toggleTools,
    openArchive,
    openTools,
    focusPanel,
  } = usePanels();

  /**
   * Focus the first focusable element in a panel
   */
  const focusPanelElement = useCallback((panel: FocusablePanel) => {
    const selector = PANEL_FOCUS_SELECTORS[panel];
    const element = document.querySelector(selector);

    if (element instanceof HTMLElement) {
      element.focus();
      focusPanel(panel);
      onFocus?.(panel);
    }
  }, [focusPanel, onFocus]);

  /**
   * Focus panel by number (1 = archive, 2 = workspace, 3 = tools)
   */
  const focusPanelByNumber = useCallback(
    (num: 1 | 2 | 3) => {
      const panel = NUMBER_TO_PANEL[String(num)];
      if (!panel) return;

      // If archive is closed and trying to focus it, open it first
      if (panel === 'archive' && !state.archiveOpen) {
        openArchive();
        // Focus after animation
        setTimeout(() => focusPanelElement(panel), 250);
        return;
      }

      // If tools is closed and trying to focus it, open it first
      if (panel === 'tools' && !state.toolsOpen) {
        openTools();
        // Focus after animation
        setTimeout(() => focusPanelElement(panel), 250);
        return;
      }

      focusPanelElement(panel);
    },
    [state.archiveOpen, state.toolsOpen, openArchive, openTools, focusPanelElement]
  );

  /**
   * Toggle archive panel
   */
  const toggleArchivePanel = useCallback(() => {
    const newState = !state.archiveOpen;
    toggleArchive();
    onToggle?.('archive', newState);

    // If opening, focus the panel after animation
    if (newState) {
      setTimeout(() => focusPanelElement('archive'), 250);
    }
  }, [state.archiveOpen, toggleArchive, onToggle, focusPanelElement]);

  /**
   * Toggle tools panel
   */
  const toggleToolsPanel = useCallback(() => {
    const newState = !state.toolsOpen;
    toggleTools();
    onToggle?.('tools', newState);

    // If opening, focus the panel after animation
    if (newState) {
      setTimeout(() => focusPanelElement('tools'), 250);
    }
  }, [state.toolsOpen, toggleTools, onToggle, focusPanelElement]);

  /**
   * Handle keydown events
   */
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd (Mac) or Ctrl (Windows/Linux)
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

      // Don't trigger in input fields (except for panel shortcuts)
      const target = e.target as HTMLElement;
      const isInputField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Cmd/Ctrl + 1/2/3: Focus panels
      if (!e.shiftKey && !e.altKey) {
        const panel = NUMBER_TO_PANEL[e.key];
        if (panel) {
          e.preventDefault();
          focusPanelByNumber(parseInt(e.key, 10) as 1 | 2 | 3);
          return;
        }
      }

      // Skip toggle shortcuts in input fields
      if (isInputField) return;

      // Cmd/Ctrl + [: Toggle archive
      if (e.key === '[') {
        e.preventDefault();
        toggleArchivePanel();
        return;
      }

      // Cmd/Ctrl + ]: Toggle tools
      if (e.key === ']') {
        e.preventDefault();
        toggleToolsPanel();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, focusPanelByNumber, toggleArchivePanel, toggleToolsPanel]);

  return {
    focusPanelByNumber,
    toggleArchivePanel,
    toggleToolsPanel,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ADDITIONAL HOOKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hook for focus management within a panel
 * Used by individual panel components
 */
export function usePanelFocus(panel: FocusablePanel) {
  const { state, focusPanel } = usePanels();
  const isFocused = state.focusedPanel === panel;

  const handleFocus = useCallback(() => {
    focusPanel(panel);
  }, [focusPanel, panel]);

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      // Only clear focus if focus moved outside the panel
      const relatedTarget = e.relatedTarget as HTMLElement;
      const panelElement = e.currentTarget as HTMLElement;

      if (!panelElement.contains(relatedTarget)) {
        focusPanel(null);
      }
    },
    [focusPanel]
  );

  return {
    isFocused,
    handleFocus,
    handleBlur,
    'data-focused': isFocused ? 'true' : undefined,
  };
}

/**
 * Hook for list navigation within a panel
 * Supports arrow key navigation
 */
export function useListNavigation<T>(
  items: T[],
  options?: {
    onSelect?: (item: T, index: number) => void;
    wrap?: boolean;
  }
) {
  const { onSelect, wrap = true } = options || {};

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, activeIndex: number, setActiveIndex: (i: number) => void) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex(
            wrap
              ? (activeIndex + 1) % items.length
              : Math.min(activeIndex + 1, items.length - 1)
          );
          break;

        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex(
            wrap
              ? (activeIndex - 1 + items.length) % items.length
              : Math.max(activeIndex - 1, 0)
          );
          break;

        case 'Enter':
        case ' ':
          e.preventDefault();
          if (items[activeIndex]) {
            onSelect?.(items[activeIndex], activeIndex);
          }
          break;

        case 'Home':
          e.preventDefault();
          setActiveIndex(0);
          break;

        case 'End':
          e.preventDefault();
          setActiveIndex(items.length - 1);
          break;
      }
    },
    [items, wrap, onSelect]
  );

  return { handleKeyDown };
}

/**
 * Hook for grid navigation (2D)
 * Supports arrow key navigation in a grid layout
 */
export function useGridNavigation(
  rows: number,
  cols: number,
  options?: {
    onSelect?: (row: number, col: number) => void;
  }
) {
  const { onSelect } = options || {};

  const handleKeyDown = useCallback(
    (
      e: React.KeyboardEvent,
      position: { row: number; col: number },
      setPosition: (p: { row: number; col: number }) => void
    ) => {
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          setPosition({
            ...position,
            col: Math.min(position.col + 1, cols - 1),
          });
          break;

        case 'ArrowLeft':
          e.preventDefault();
          setPosition({
            ...position,
            col: Math.max(position.col - 1, 0),
          });
          break;

        case 'ArrowDown':
          e.preventDefault();
          setPosition({
            ...position,
            row: Math.min(position.row + 1, rows - 1),
          });
          break;

        case 'ArrowUp':
          e.preventDefault();
          setPosition({
            ...position,
            row: Math.max(position.row - 1, 0),
          });
          break;

        case 'Enter':
        case ' ':
          e.preventDefault();
          onSelect?.(position.row, position.col);
          break;

        case 'Home':
          e.preventDefault();
          setPosition({ row: 0, col: 0 });
          break;

        case 'End':
          e.preventDefault();
          setPosition({ row: rows - 1, col: cols - 1 });
          break;
      }
    },
    [rows, cols, onSelect]
  );

  return { handleKeyDown };
}

/**
 * Hook for screen reader announcements
 */
export function useAnnounce() {
  const announce = useCallback(
    (message: string, priority: 'polite' | 'assertive' = 'polite') => {
      // Find or create the live region
      let region = document.getElementById(`aria-live-${priority}`);

      if (!region) {
        region = document.createElement('div');
        region.id = `aria-live-${priority}`;
        region.setAttribute('aria-live', priority);
        region.setAttribute('aria-atomic', 'true');
        region.className = 'sr-only';
        document.body.appendChild(region);
      }

      // Clear and set message (triggers announcement)
      region.textContent = '';
      requestAnimationFrame(() => {
        region!.textContent = message;
      });
    },
    []
  );

  return announce;
}

export default usePanelShortcuts;
