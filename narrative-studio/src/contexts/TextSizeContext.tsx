import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

type TextSize = 'sm' | 'md' | 'lg';

interface TextSizeContextType {
  textSize: TextSize;
  setTextSize: (size: TextSize) => void;
  increaseTextSize: () => void;
  decreaseTextSize: () => void;
}

const TextSizeContext = createContext<TextSizeContextType | undefined>(undefined);

interface TextSizeProviderProps {
  children: ReactNode;
}

export function TextSizeProvider({ children }: TextSizeProviderProps) {
  const [textSize, setTextSizeState] = useState<TextSize>(() => {
    const stored = localStorage.getItem('narrative-studio-text-size');
    if (stored === 'sm' || stored === 'md' || stored === 'lg') {
      return stored;
    }
    return 'md';
  });

  useEffect(() => {
    localStorage.setItem('narrative-studio-text-size', textSize);
  }, [textSize]);

  const setTextSize = (size: TextSize) => {
    setTextSizeState(size);
  };

  const increaseTextSize = () => {
    setTextSizeState((current) => {
      if (current === 'sm') return 'md';
      if (current === 'md') return 'lg';
      return 'lg';
    });
  };

  const decreaseTextSize = () => {
    setTextSizeState((current) => {
      if (current === 'lg') return 'md';
      if (current === 'md') return 'sm';
      return 'sm';
    });
  };

  return (
    <TextSizeContext.Provider
      value={{
        textSize,
        setTextSize,
        increaseTextSize,
        decreaseTextSize,
      }}
    >
      {children}
    </TextSizeContext.Provider>
  );
}

export function useTextSize() {
  const context = useContext(TextSizeContext);
  if (context === undefined) {
    throw new Error('useTextSize must be used within a TextSizeProvider');
  }
  return context;
}
