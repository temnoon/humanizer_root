/**
 * Layout Context
 * Manages panel sizes, collapse states, and layout persistence
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface LayoutState {
  leftWidth: number;
  rightWidth: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  focusMode: boolean;
}

interface LayoutContextValue extends LayoutState {
  setLeftWidth: (width: number) => void;
  setRightWidth: (width: number) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleFocusMode: () => void;
  resetLayout: () => void;
}

const DEFAULT_LEFT_WIDTH = 300;
const DEFAULT_RIGHT_WIDTH = 350;
const MIN_PANEL_WIDTH = 200;
const MAX_PANEL_WIDTH = 600;

const LayoutContext = createContext<LayoutContextValue | undefined>(undefined);

export function useLayout() {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
}

interface LayoutProviderProps {
  children: ReactNode;
}

export function LayoutProvider({ children }: LayoutProviderProps) {
  const [leftWidth, setLeftWidthState] = useState<number>(() => {
    const saved = localStorage.getItem('humanizer-layout-left-width');
    return saved ? parseInt(saved, 10) : DEFAULT_LEFT_WIDTH;
  });

  const [rightWidth, setRightWidthState] = useState<number>(() => {
    const saved = localStorage.getItem('humanizer-layout-right-width');
    return saved ? parseInt(saved, 10) : DEFAULT_RIGHT_WIDTH;
  });

  const [leftCollapsed, setLeftCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('humanizer-layout-left-collapsed');
    return saved === 'true';
  });

  const [rightCollapsed, setRightCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('humanizer-layout-right-collapsed');
    return saved === 'true';
  });

  const [focusMode, setFocusMode] = useState<boolean>(false);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('humanizer-layout-left-width', leftWidth.toString());
  }, [leftWidth]);

  useEffect(() => {
    localStorage.setItem('humanizer-layout-right-width', rightWidth.toString());
  }, [rightWidth]);

  useEffect(() => {
    localStorage.setItem('humanizer-layout-left-collapsed', leftCollapsed.toString());
  }, [leftCollapsed]);

  useEffect(() => {
    localStorage.setItem('humanizer-layout-right-collapsed', rightCollapsed.toString());
  }, [rightCollapsed]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + B: Toggle left panel
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setLeftCollapsed(prev => !prev);
      }
      // Cmd/Ctrl + \\: Toggle right panel
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        setRightCollapsed(prev => !prev);
      }
      // Cmd/Ctrl + Shift + F: Toggle focus mode
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        setFocusMode(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const setLeftWidth = (width: number) => {
    const clampedWidth = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, width));
    setLeftWidthState(clampedWidth);
  };

  const setRightWidth = (width: number) => {
    const clampedWidth = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, width));
    setRightWidthState(clampedWidth);
  };

  const toggleLeftPanel = () => {
    setLeftCollapsed(prev => !prev);
  };

  const toggleRightPanel = () => {
    setRightCollapsed(prev => !prev);
  };

  const toggleFocusMode = () => {
    setFocusMode(prev => !prev);
  };

  const resetLayout = () => {
    setLeftWidthState(DEFAULT_LEFT_WIDTH);
    setRightWidthState(DEFAULT_RIGHT_WIDTH);
    setLeftCollapsed(false);
    setRightCollapsed(false);
    setFocusMode(false);
  };

  const value: LayoutContextValue = {
    leftWidth,
    rightWidth,
    leftCollapsed,
    rightCollapsed,
    focusMode,
    setLeftWidth,
    setRightWidth,
    toggleLeftPanel,
    toggleRightPanel,
    toggleFocusMode,
    resetLayout,
  };

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
}
