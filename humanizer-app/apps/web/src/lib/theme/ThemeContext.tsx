/**
 * Theme Context - React integration for theme system
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  type ThemeMode,
  type ResolvedTheme,
  type ThemeSettings,
  loadThemeSettings,
  saveThemeSettings,
  resolveTheme,
  applyTheme,
  watchSystemTheme,
} from './index';

interface ThemeContextValue {
  settings: ThemeSettings;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  setFontFamily: (family: ThemeSettings['fontFamily']) => void;
  setFontSize: (size: ThemeSettings['fontSize']) => void;
  setLineHeight: (height: ThemeSettings['lineHeight']) => void;
  setColorAccent: (accent: ThemeSettings['colorAccent']) => void;
  updateSettings: (updates: Partial<ThemeSettings>) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ThemeSettings>(loadThemeSettings);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(settings.mode));

  // Apply theme on mount and when settings change
  useEffect(() => {
    applyTheme(settings);
    setResolved(resolveTheme(settings.mode));
    saveThemeSettings(settings);
  }, [settings]);

  // Watch for system theme changes when in 'system' mode
  useEffect(() => {
    if (settings.mode !== 'system') return;

    const unwatch = watchSystemTheme(() => {
      setResolved(resolveTheme('system'));
      applyTheme(settings);
    });

    return unwatch;
  }, [settings]);

  const updateSettings = useCallback((updates: Partial<ThemeSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const setMode = useCallback((mode: ThemeMode) => updateSettings({ mode }), [updateSettings]);
  const setFontFamily = useCallback((fontFamily: ThemeSettings['fontFamily']) => updateSettings({ fontFamily }), [updateSettings]);
  const setFontSize = useCallback((fontSize: ThemeSettings['fontSize']) => updateSettings({ fontSize }), [updateSettings]);
  const setLineHeight = useCallback((lineHeight: ThemeSettings['lineHeight']) => updateSettings({ lineHeight }), [updateSettings]);
  const setColorAccent = useCallback((colorAccent: ThemeSettings['colorAccent']) => updateSettings({ colorAccent }), [updateSettings]);

  const value: ThemeContextValue = {
    settings,
    resolved,
    setMode,
    setFontFamily,
    setFontSize,
    setLineHeight,
    setColorAccent,
    updateSettings,
  };

  return (
    <ThemeContext.Provider value={value}>
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
