/**
 * Panel History Context
 * Tracks navigation history for left and right panels
 * Enables back/forward navigation through panel states
 */

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface PanelState {
  id: string;
  type: string;
  data?: any;
  timestamp: number;
}

interface PanelHistory {
  stack: PanelState[];
  currentIndex: number;
}

interface PanelHistoryContextValue {
  // Left panel
  leftHistory: PanelHistory;
  pushLeftState: (state: Omit<PanelState, 'timestamp'>) => void;
  goBackLeft: () => void;
  goForwardLeft: () => void;
  canGoBackLeft: boolean;
  canGoForwardLeft: boolean;
  currentLeftState: PanelState | null;

  // Right panel
  rightHistory: PanelHistory;
  pushRightState: (state: Omit<PanelState, 'timestamp'>) => void;
  goBackRight: () => void;
  goForwardRight: () => void;
  canGoBackRight: boolean;
  canGoForwardRight: boolean;
  currentRightState: PanelState | null;

  // Reset
  resetHistory: () => void;
}

const PanelHistoryContext = createContext<PanelHistoryContextValue | undefined>(undefined);

export function usePanelHistory() {
  const context = useContext(PanelHistoryContext);
  if (!context) {
    throw new Error('usePanelHistory must be used within PanelHistoryProvider');
  }
  return context;
}

interface PanelHistoryProviderProps {
  children: ReactNode;
}

const initialHistory: PanelHistory = {
  stack: [],
  currentIndex: -1,
};

export function PanelHistoryProvider({ children }: PanelHistoryProviderProps) {
  const [leftHistory, setLeftHistory] = useState<PanelHistory>(initialHistory);
  const [rightHistory, setRightHistory] = useState<PanelHistory>(initialHistory);

  // Left panel methods
  const pushLeftState = useCallback((state: Omit<PanelState, 'timestamp'>) => {
    setLeftHistory((prev) => {
      const newState: PanelState = { ...state, timestamp: Date.now() };
      const newStack = [...prev.stack.slice(0, prev.currentIndex + 1), newState];
      return {
        stack: newStack,
        currentIndex: newStack.length - 1,
      };
    });
  }, []);

  const goBackLeft = useCallback(() => {
    setLeftHistory((prev) => ({
      ...prev,
      currentIndex: Math.max(0, prev.currentIndex - 1),
    }));
  }, []);

  const goForwardLeft = useCallback(() => {
    setLeftHistory((prev) => ({
      ...prev,
      currentIndex: Math.min(prev.stack.length - 1, prev.currentIndex + 1),
    }));
  }, []);

  // Right panel methods
  const pushRightState = useCallback((state: Omit<PanelState, 'timestamp'>) => {
    setRightHistory((prev) => {
      const newState: PanelState = { ...state, timestamp: Date.now() };
      const newStack = [...prev.stack.slice(0, prev.currentIndex + 1), newState];
      return {
        stack: newStack,
        currentIndex: newStack.length - 1,
      };
    });
  }, []);

  const goBackRight = useCallback(() => {
    setRightHistory((prev) => ({
      ...prev,
      currentIndex: Math.max(0, prev.currentIndex - 1),
    }));
  }, []);

  const goForwardRight = useCallback(() => {
    setRightHistory((prev) => ({
      ...prev,
      currentIndex: Math.min(prev.stack.length - 1, prev.currentIndex + 1),
    }));
  }, []);

  const resetHistory = useCallback(() => {
    setLeftHistory(initialHistory);
    setRightHistory(initialHistory);
  }, []);

  const value: PanelHistoryContextValue = {
    leftHistory,
    pushLeftState,
    goBackLeft,
    goForwardLeft,
    canGoBackLeft: leftHistory.currentIndex > 0,
    canGoForwardLeft: leftHistory.currentIndex < leftHistory.stack.length - 1,
    currentLeftState: leftHistory.stack[leftHistory.currentIndex] || null,

    rightHistory,
    pushRightState,
    goBackRight,
    goForwardRight,
    canGoBackRight: rightHistory.currentIndex > 0,
    canGoForwardRight: rightHistory.currentIndex < rightHistory.stack.length - 1,
    currentRightState: rightHistory.stack[rightHistory.currentIndex] || null,

    resetHistory,
  };

  return (
    <PanelHistoryContext.Provider value={value}>
      {children}
    </PanelHistoryContext.Provider>
  );
}
