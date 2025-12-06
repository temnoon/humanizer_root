/**
 * Navigation Context
 * Manages hierarchical navigation state for each input source
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface NavigationNode {
  id: string;
  label: string;
  type: string;
  data?: any;
  children?: NavigationNode[];
}

export interface NavigationState {
  sourceType: string | null;
  path: NavigationNode[];
  currentNode: NavigationNode | null;
}

interface NavigationContextValue {
  state: NavigationState;
  navigateTo: (node: NavigationNode) => void;
  navigateBack: () => void;
  navigateToRoot: (sourceType: string) => void;
  resetNavigation: () => void;
}

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined);

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
}

interface NavigationProviderProps {
  children: ReactNode;
}

export function NavigationProvider({ children }: NavigationProviderProps) {
  const [state, setState] = useState<NavigationState>(() => {
    // Try to restore from localStorage
    const saved = localStorage.getItem('humanizer-navigation-state');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return { sourceType: null, path: [], currentNode: null };
      }
    }
    return { sourceType: null, path: [], currentNode: null };
  });

  const saveState = (newState: NavigationState) => {
    setState(newState);
    localStorage.setItem('humanizer-navigation-state', JSON.stringify(newState));
  };

  const navigateTo = (node: NavigationNode) => {
    const newPath = [...state.path, node];
    saveState({
      ...state,
      path: newPath,
      currentNode: node,
    });
  };

  const navigateBack = () => {
    if (state.path.length === 0) return;

    const newPath = state.path.slice(0, -1);
    const newCurrent = newPath[newPath.length - 1] || null;

    saveState({
      ...state,
      path: newPath,
      currentNode: newCurrent,
    });
  };

  const navigateToRoot = (sourceType: string) => {
    saveState({
      sourceType,
      path: [],
      currentNode: null,
    });
  };

  const resetNavigation = () => {
    saveState({
      sourceType: null,
      path: [],
      currentNode: null,
    });
    localStorage.removeItem('humanizer-navigation-state');
  };

  const value: NavigationContextValue = {
    state,
    navigateTo,
    navigateBack,
    navigateToRoot,
    resetNavigation,
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}
