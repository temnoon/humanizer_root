/**
 * ToolTabContext - State management for horizontal tool tabs
 *
 * Preserves each tool's state when navigating between tabs.
 * State persists to localStorage for session continuity.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

// Tool identifiers
export type ToolId =
  | 'ai-analysis'      // Unified AI detection (native + GPTZero)
  | 'sic-analysis'     // Subjective Intentional Constraint analysis
  | 'humanizer'        // Computer Humanizer
  | 'persona'          // Persona Transformation
  | 'style'            // Style Transformation
  | 'round-trip'       // Round-Trip Translation
  | 'export'           // Export workspace buffers
  | 'profile-factory'  // Create custom profiles from sample text
  | 'add-to-book'      // Add to Book
  | 'admin-profiles';  // Admin: Manage global profiles (admin only)

// Tool metadata for display
export interface ToolMeta {
  id: ToolId;
  icon: string;
  label: string;
  shortLabel: string;
  description: string;
}

export const TOOL_REGISTRY: ToolMeta[] = [
  {
    id: 'ai-analysis',
    icon: '🔍',
    label: 'AI Analysis',
    shortLabel: 'AI',
    description: 'Analyze text for AI-generated patterns',
  },
  {
    id: 'sic-analysis',
    icon: '🎯',
    label: 'SIC Analysis',
    shortLabel: 'SIC',
    description: 'Analyze constraint traces - the cost of authorship',
  },
  {
    id: 'humanizer',
    icon: '🤖',
    label: 'Computer Humanizer',
    shortLabel: 'Human',
    description: 'Remove AI tell-words and improve naturalness',
  },
  {
    id: 'persona',
    icon: '👤',
    label: 'Persona',
    shortLabel: 'Persona',
    description: 'Change narrative voice/perspective',
  },
  {
    id: 'style',
    icon: '✍️',
    label: 'Style',
    shortLabel: 'Style',
    description: 'Change writing patterns',
  },
  {
    id: 'round-trip',
    icon: '🔄',
    label: 'Round-Trip',
    shortLabel: 'Trip',
    description: 'Translate through intermediate language',
  },
  {
    id: 'export',
    icon: '⬆️',
    label: 'Export',
    shortLabel: 'Export',
    description: 'Export buffers as text, markdown, or JSON',
  },
  {
    id: 'profile-factory',
    icon: '🧪',
    label: 'Profile Factory',
    shortLabel: 'Factory',
    description: 'Create custom profiles from sample text',
  },
  {
    id: 'add-to-book',
    icon: '📖',
    label: 'Add to Book',
    shortLabel: 'Book',
    description: 'Add content to your active book',
  },
  {
    id: 'admin-profiles',
    icon: '⚙️',
    label: 'Manage Profiles',
    shortLabel: 'Admin',
    description: 'Admin: Manage global transformation profiles',
  },
];

// State for AI Analysis tool
export interface AIAnalysisState {
  includeGPTZero: boolean;
  useLLMJudge: boolean;
  lastResult?: any;
}

// State for SIC Analysis tool
export interface SICAnalysisState {
  lastResult?: any;
}

// State for Humanizer tool
export interface HumanizerState {
  intensity: 'light' | 'moderate' | 'aggressive';
  useLLM: boolean;
  lastResult?: any;
}

// State for Persona tool
export interface PersonaState {
  selectedPersona: string;
  lastResult?: any;
}

// State for Style tool
export interface StyleState {
  selectedStyle: string;
  lastResult?: any;
}

// State for Round-Trip tool
export interface RoundTripState {
  intermediateLanguage: string;
  lastResult?: any;
}

// State for Export tool
export interface ExportState {
  format: 'plain' | 'markdown' | 'json' | 'diff';
  scope: 'active' | 'compare' | 'chain' | 'starred';
  includeMetadata: boolean;
  includeTimestamps: boolean;
}

// State for Add to Book tool
export interface AddToBookState {
  selectedChapterId: string | null;
  selectedSectionId: string | null;
}

// State for Profile Factory tool
export interface ProfileFactoryState {
  step: 'input' | 'analyze' | 'edit' | 'test' | 'save';
}

// State for Admin Profiles tool
export interface AdminProfilesState {
  activeTab: 'personas' | 'styles' | 'feedback';
}

// Combined tool states
export interface ToolStates {
  'ai-analysis': AIAnalysisState;
  'sic-analysis': SICAnalysisState;
  'humanizer': HumanizerState;
  'persona': PersonaState;
  'style': StyleState;
  'round-trip': RoundTripState;
  'export': ExportState;
  'profile-factory': ProfileFactoryState;
  'add-to-book': AddToBookState;
  'admin-profiles': AdminProfilesState;
}

// Default states
const defaultToolStates: ToolStates = {
  'ai-analysis': {
    includeGPTZero: false,
    useLLMJudge: false,
  },
  'sic-analysis': {
    // No default options needed
  },
  'humanizer': {
    intensity: 'moderate',
    useLLM: false,
  },
  'persona': {
    selectedPersona: '',
  },
  'style': {
    selectedStyle: '',
  },
  'round-trip': {
    intermediateLanguage: 'spanish',
  },
  'export': {
    format: 'markdown',
    scope: 'active',
    includeMetadata: true,
    includeTimestamps: false,
  },
  'profile-factory': {
    step: 'input',
  },
  'add-to-book': {
    selectedChapterId: null,
    selectedSectionId: null,
  },
  'admin-profiles': {
    activeTab: 'personas',
  },
};

// Context interface
interface ToolTabContextValue {
  // Active tool
  activeToolId: ToolId;
  setActiveToolId: (id: ToolId) => void;

  // Navigation
  navigateNext: () => void;
  navigatePrev: () => void;

  // Tool states
  toolStates: ToolStates;
  updateToolState: <T extends ToolId>(toolId: T, state: Partial<ToolStates[T]>) => void;

  // Transform source setting
  transformSource: 'original' | 'active' | 'buffer';
  setTransformSource: (source: 'original' | 'active' | 'buffer') => void;

  // Processing state
  isTransforming: boolean;
  setIsTransforming: (value: boolean) => void;
}

const ToolTabContext = createContext<ToolTabContextValue | null>(null);

const STORAGE_KEY = 'narrative-studio-tool-tabs';

interface StoredState {
  activeToolId: ToolId;
  toolStates: ToolStates;
  transformSource: 'original' | 'active' | 'buffer';
}

export function ToolTabProvider({ children }: { children: ReactNode }) {
  // Load initial state from localStorage
  const [activeToolId, setActiveToolIdInternal] = useState<ToolId>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: StoredState = JSON.parse(stored);
        return parsed.activeToolId || 'ai-analysis';
      }
    } catch (e) {
      console.warn('Failed to load tool tab state:', e);
    }
    return 'ai-analysis';
  });

  const [toolStates, setToolStates] = useState<ToolStates>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: StoredState = JSON.parse(stored);
        return { ...defaultToolStates, ...parsed.toolStates };
      }
    } catch (e) {
      console.warn('Failed to load tool states:', e);
    }
    return defaultToolStates;
  });

  const [transformSource, setTransformSourceInternal] = useState<'original' | 'active' | 'buffer'>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: StoredState = JSON.parse(stored);
        return parsed.transformSource || 'active';
      }
    } catch (e) {
      console.warn('Failed to load transform source:', e);
    }
    return 'active';
  });

  const [isTransforming, setIsTransforming] = useState(false);

  // Persist state changes
  useEffect(() => {
    const state: StoredState = {
      activeToolId,
      toolStates,
      transformSource,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [activeToolId, toolStates, transformSource]);

  // Set active tool
  const setActiveToolId = useCallback((id: ToolId) => {
    setActiveToolIdInternal(id);
  }, []);

  // Navigate to next tool
  const navigateNext = useCallback(() => {
    const currentIndex = TOOL_REGISTRY.findIndex(t => t.id === activeToolId);
    const nextIndex = (currentIndex + 1) % TOOL_REGISTRY.length;
    setActiveToolIdInternal(TOOL_REGISTRY[nextIndex].id);
  }, [activeToolId]);

  // Navigate to previous tool
  const navigatePrev = useCallback(() => {
    const currentIndex = TOOL_REGISTRY.findIndex(t => t.id === activeToolId);
    const prevIndex = (currentIndex - 1 + TOOL_REGISTRY.length) % TOOL_REGISTRY.length;
    setActiveToolIdInternal(TOOL_REGISTRY[prevIndex].id);
  }, [activeToolId]);

  // Update specific tool state
  const updateToolState = useCallback(<T extends ToolId>(
    toolId: T,
    state: Partial<ToolStates[T]>
  ) => {
    setToolStates(prev => ({
      ...prev,
      [toolId]: { ...prev[toolId], ...state },
    }));
  }, []);

  // Set transform source
  const setTransformSource = useCallback((source: 'original' | 'active' | 'buffer') => {
    setTransformSourceInternal(source);
  }, []);

  return (
    <ToolTabContext.Provider
      value={{
        activeToolId,
        setActiveToolId,
        navigateNext,
        navigatePrev,
        toolStates,
        updateToolState,
        transformSource,
        setTransformSource,
        isTransforming,
        setIsTransforming,
      }}
    >
      {children}
    </ToolTabContext.Provider>
  );
}

export function useToolTabs() {
  const context = useContext(ToolTabContext);
  if (!context) {
    throw new Error('useToolTabs must be used within a ToolTabProvider');
  }
  return context;
}

// Hook for specific tool state
export function useToolState<T extends ToolId>(toolId: T) {
  const { toolStates, updateToolState } = useToolTabs();

  const state = toolStates[toolId] as ToolStates[T];
  const setState = useCallback((newState: Partial<ToolStates[T]>) => {
    updateToolState(toolId, newState);
  }, [toolId, updateToolState]);

  return [state, setState] as const;
}
