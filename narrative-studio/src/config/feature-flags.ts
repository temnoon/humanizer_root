/**
 * Feature Flags - Environment Detection & Feature Availability
 *
 * Detects runtime environment (Electron vs Web browser) and exposes
 * feature availability flags for conditional rendering.
 *
 * Usage:
 *   import { features, isElectron, isWeb } from './config/feature-flags';
 *   if (features.localArchives) { ... }
 */

// Detect Electron environment via preload-exposed API
export const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

// Web = not Electron
export const isWeb = !isElectron;

// Production detection (not localhost)
export const isProduction = typeof window !== 'undefined' &&
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1';

/**
 * Feature availability by environment
 */
export const features = {
  // Local archive server (port 3002) - Electron only
  // DEV TESTING: Temporarily enabled for browser testing
  localArchives: isElectron || (typeof window !== 'undefined' && window.location.hostname === 'localhost'),

  // Ollama local LLM integration - Electron only
  ollamaLocal: isElectron,

  // Project Gutenberg book browser - Web only
  gutenberg: isWeb,

  // First-run setup wizard - Electron only
  setupWizard: isElectron,

  // Cloud transformations via npe-api - both environments
  cloudTransformations: true,

  // Books (D1/cloud backed) - both environments
  books: true,

  // Workspaces (IndexedDB + cloud sync) - both environments
  workspaces: true,

  // AI Analysis with GPTZero - both (tier-gated in web)
  aiAnalysis: true,
};

/**
 * Archive Panel tab IDs available in each environment
 */
export const availableTabs = {
  electron: [
    'conversations',
    'gallery',
    'imports',
    'explore',
    'facebook',
    'books',
    'thisbook',
    'workspaces',
  ],
  web: [
    'gutenberg',
    'books',
    'thisbook',
    'workspaces',
  ],
};

/**
 * Get the tabs available for current environment
 */
export function getAvailableTabs(): string[] {
  return isElectron ? availableTabs.electron : availableTabs.web;
}
