/**
 * Theme Store
 *
 * Manages light/dark/system theme preference with localStorage persistence.
 */

import { createSignal, createEffect, onMount } from 'solid-js';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'post-social-theme';

// Get stored theme or default to 'light'
function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'light';
}

// Get the actual theme (resolves 'system' to light/dark)
function getResolvedTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

// Create the reactive store
const [themeMode, setThemeModeInternal] = createSignal<ThemeMode>(getStoredTheme());
const [resolvedTheme, setResolvedTheme] = createSignal<'light' | 'dark'>(
  getResolvedTheme(getStoredTheme())
);

// Apply theme to document
function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return;

  const resolved = getResolvedTheme(mode);
  setResolvedTheme(resolved);

  // Set data-theme attribute
  if (mode === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', mode);
  }

  // Update meta theme-color for mobile browsers
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', resolved === 'dark' ? '#0f172a' : '#ffffff');
  }
}

// Set theme mode with persistence
export function setThemeMode(mode: ThemeMode) {
  setThemeModeInternal(mode);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, mode);
  }
  applyTheme(mode);
}

// Cycle through themes: light → dark → system → light
export function cycleTheme() {
  const current = themeMode();
  const next: ThemeMode =
    current === 'light' ? 'dark' :
    current === 'dark' ? 'system' : 'light';
  setThemeMode(next);
}

// Toggle between light and dark (ignoring system)
export function toggleTheme() {
  const resolved = resolvedTheme();
  setThemeMode(resolved === 'light' ? 'dark' : 'light');
}

// Initialize theme on app start
export function initTheme() {
  const mode = getStoredTheme();
  applyTheme(mode);

  // Listen for system preference changes
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      if (themeMode() === 'system') {
        setResolvedTheme(e.matches ? 'dark' : 'light');
      }
    });
  }
}

// Export the store
export const themeStore = {
  mode: themeMode,
  resolved: resolvedTheme,
  setMode: setThemeMode,
  cycle: cycleTheme,
  toggle: toggleTheme,
  init: initTheme,
};

export default themeStore;
