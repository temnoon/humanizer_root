/**
 * Theme Context - Simplified 3-mode theme system
 *
 * Supports: light | sepia | dark
 * Persists to localStorage
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'sepia' | 'dark';

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'humanizer-studio-theme';

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'sepia';

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && ['light', 'sepia', 'dark'].includes(stored)) {
    return stored as ThemeMode;
  }

  // Default to sepia (the distraction-free reading mode)
  return 'sepia';
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);

  // Apply theme on mount and changes
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeState((current) => {
      const order: ThemeMode[] = ['light', 'sepia', 'dark'];
      const idx = order.indexOf(current);
      return order[(idx + 1) % order.length];
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * Theme Toggle Component - 3 buttons for light/sepia/dark
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Theme selection">
      <button
        className={`theme-toggle__btn ${theme === 'light' ? 'theme-toggle__btn--active' : ''}`}
        onClick={() => setTheme('light')}
        title="Light theme"
        aria-label="Light theme"
        aria-checked={theme === 'light'}
        role="radio"
      >
        <span aria-hidden="true">&#9788;</span>
      </button>
      <button
        className={`theme-toggle__btn ${theme === 'sepia' ? 'theme-toggle__btn--active' : ''}`}
        onClick={() => setTheme('sepia')}
        title="Sepia theme"
        aria-label="Sepia theme"
        aria-checked={theme === 'sepia'}
        role="radio"
      >
        <span aria-hidden="true">&#9788;</span>
      </button>
      <button
        className={`theme-toggle__btn ${theme === 'dark' ? 'theme-toggle__btn--active' : ''}`}
        onClick={() => setTheme('dark')}
        title="Dark theme"
        aria-label="Dark theme"
        aria-checked={theme === 'dark'}
        role="radio"
      >
        <span aria-hidden="true">&#9790;</span>
      </button>
    </div>
  );
}
