// TransformationStateContext - Persistent state for all transformation forms
// Survives navigation, page refresh, and phone sleep
// Only clears on explicit reset or logout

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type {
  AllegoricalProjectionResponse,
  RoundTripTranslationResponse
} from '../../../workers/shared/types';

// ========== TYPES ==========

interface DetectionResult {
  verdict: 'human' | 'ai' | 'uncertain';
  confidence: number;
  explanation: string;
  method: 'local' | 'gptzero' | 'hybrid';
  signals: {
    burstiness: number;
    tellWordScore: number;
    readabilityPattern: number;
    lexicalDiversity: number;
  };
  metrics: {
    fleschReadingEase: number;
    gunningFog: number;
    wordCount: number;
    sentenceCount: number;
    avgSentenceLength: number;
  };
  detectedTellWords: Array<{
    word: string;
    category: string;
    count: number;
  }>;
  processingTimeMs: number;
  message?: string;
}

interface AllegoricalState {
  text: string;
  persona: string;
  namespace: string;
  style: string;
  model: string;
  lengthPreference: 'shorter' | 'same' | 'longer' | 'much_longer';
  result: AllegoricalProjectionResponse | null;
}

interface RoundTripState {
  text: string;
  language: string;
  result: RoundTripTranslationResponse | null;
}

interface AIDetectorState {
  text: string;
  useAPI: boolean;
  result: DetectionResult | null;
}

interface MaieuticState {
  text: string;
  depth: number;
  result: any | null;
}

interface PersonalizerState {
  text: string;
  voiceId: string;
  result: any | null;
}

interface TransformationState {
  allegorical: AllegoricalState;
  roundTrip: RoundTripState;
  aiDetector: AIDetectorState;
  maieutic: MaieuticState;
  personalizer: PersonalizerState;
}

type TransformationType = keyof TransformationState;

// ========== CONTEXT ==========

interface TransformationStateContextValue {
  state: TransformationState;

  // Update methods for each transformation type
  updateAllegorical: (updates: Partial<AllegoricalState>) => void;
  updateRoundTrip: (updates: Partial<RoundTripState>) => void;
  updateAIDetector: (updates: Partial<AIDetectorState>) => void;
  updateMaieutic: (updates: Partial<MaieuticState>) => void;
  updatePersonalizer: (updates: Partial<PersonalizerState>) => void;

  // Load from history
  loadInput: (type: TransformationType, text: string) => void;
  loadOutput: (type: TransformationType, result: any) => void;

  // Reset methods
  reset: (type: TransformationType) => void;
  resetAll: () => void;
}

const TransformationStateContext = createContext<TransformationStateContextValue | null>(null);

// ========== DEFAULT STATE ==========

const getDefaultState = (): TransformationState => ({
  allegorical: {
    text: '',
    persona: '',
    namespace: '',
    style: '',
    model: '',
    lengthPreference: 'same',
    result: null
  },
  roundTrip: {
    text: '',
    language: '',
    result: null
  },
  aiDetector: {
    text: '',
    useAPI: false,
    result: null
  },
  maieutic: {
    text: '',
    depth: 2,
    result: null
  },
  personalizer: {
    text: '',
    voiceId: '',
    result: null
  }
});

// ========== LOCALSTORAGE HELPERS ==========

const STORAGE_KEY = 'humanizer_transformation_state';
const STORAGE_VERSION = '1.0';

const loadFromLocalStorage = (): TransformationState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return getDefaultState();

    const parsed = JSON.parse(stored);

    // Version check
    if (parsed.version !== STORAGE_VERSION) {
      console.log('[TransformationState] Version mismatch, using defaults');
      return getDefaultState();
    }

    return parsed.state || getDefaultState();
  } catch (err) {
    console.error('[TransformationState] Failed to load from localStorage:', err);
    return getDefaultState();
  }
};

const saveToLocalStorage = (state: TransformationState) => {
  try {
    const data = {
      version: STORAGE_VERSION,
      state,
      timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('[TransformationState] Failed to save to localStorage:', err);
  }
};

const clearLocalStorage = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('[TransformationState] Failed to clear localStorage:', err);
  }
};

// ========== PROVIDER ==========

export function TransformationStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TransformationState>(() => loadFromLocalStorage());

  // Save to localStorage whenever state changes
  useEffect(() => {
    saveToLocalStorage(state);
  }, [state]);

  // Update methods for each transformation type
  const updateAllegorical = (updates: Partial<AllegoricalState>) => {
    setState(prev => ({
      ...prev,
      allegorical: { ...prev.allegorical, ...updates }
    }));
  };

  const updateRoundTrip = (updates: Partial<RoundTripState>) => {
    setState(prev => ({
      ...prev,
      roundTrip: { ...prev.roundTrip, ...updates }
    }));
  };

  const updateAIDetector = (updates: Partial<AIDetectorState>) => {
    setState(prev => ({
      ...prev,
      aiDetector: { ...prev.aiDetector, ...updates }
    }));
  };

  const updateMaieutic = (updates: Partial<MaieuticState>) => {
    setState(prev => ({
      ...prev,
      maieutic: { ...prev.maieutic, ...updates }
    }));
  };

  const updatePersonalizer = (updates: Partial<PersonalizerState>) => {
    setState(prev => ({
      ...prev,
      personalizer: { ...prev.personalizer, ...updates }
    }));
  };

  // Load from history
  const loadInput = (type: TransformationType, text: string) => {
    setState(prev => ({
      ...prev,
      [type]: { ...prev[type], text }
    }));
  };

  const loadOutput = (type: TransformationType, result: any) => {
    setState(prev => ({
      ...prev,
      [type]: { ...prev[type], result }
    }));
  };

  // Reset methods
  const reset = (type: TransformationType) => {
    const defaultState = getDefaultState();
    setState(prev => ({
      ...prev,
      [type]: defaultState[type]
    }));
  };

  const resetAll = () => {
    setState(getDefaultState());
    clearLocalStorage();
  };

  const value: TransformationStateContextValue = {
    state,
    updateAllegorical,
    updateRoundTrip,
    updateAIDetector,
    updateMaieutic,
    updatePersonalizer,
    loadInput,
    loadOutput,
    reset,
    resetAll
  };

  return (
    <TransformationStateContext.Provider value={value}>
      {children}
    </TransformationStateContext.Provider>
  );
}

// ========== HOOK ==========

export function useTransformationState() {
  const context = useContext(TransformationStateContext);
  if (!context) {
    throw new Error('useTransformationState must be used within TransformationStateProvider');
  }
  return context;
}
