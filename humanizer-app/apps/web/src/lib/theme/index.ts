/**
 * Theme System for Humanizer Studio
 *
 * Supports: light, dark, sepia (default)
 * Persists preference to localStorage
 * Respects system preference when set to 'system'
 */

export type ThemeMode = 'light' | 'dark' | 'sepia' | 'system';
export type ResolvedTheme = 'light' | 'dark' | 'sepia';

export interface ThemeSettings {
  mode: ThemeMode;
  fontFamily: 'serif' | 'sans-serif' | 'mono';
  fontSize: 'small' | 'medium' | 'large';
  lineHeight: 'tight' | 'normal' | 'relaxed';
  colorAccent: 'amber' | 'blue' | 'green' | 'purple';
}

const STORAGE_KEY = 'humanizer-theme-settings';

const DEFAULT_SETTINGS: ThemeSettings = {
  mode: 'sepia',  // Sepia is the new default
  fontFamily: 'serif',
  fontSize: 'medium',
  lineHeight: 'normal',
  colorAccent: 'amber',
};

export function loadThemeSettings(): ThemeSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Failed to load theme settings:', e);
  }
  return DEFAULT_SETTINGS;
}

export function saveThemeSettings(settings: ThemeSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save theme settings:', e);
  }
}

export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') {
    return getSystemTheme();
  }
  return mode;
}

export function applyTheme(settings: ThemeSettings): void {
  const root = document.documentElement;
  const resolved = resolveTheme(settings.mode);

  // Set theme mode
  root.setAttribute('data-theme', resolved);

  // Set font family
  root.setAttribute('data-font', settings.fontFamily);

  // Set font size
  root.setAttribute('data-size', settings.fontSize);

  // Set line height
  root.setAttribute('data-spacing', settings.lineHeight);

  // Set color accent
  root.setAttribute('data-accent', settings.colorAccent);
}

// Hook into system theme changes
export function watchSystemTheme(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => callback();

  mediaQuery.addEventListener('change', handler);
  return () => mediaQuery.removeEventListener('change', handler);
}
