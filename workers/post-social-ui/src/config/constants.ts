/**
 * Application Constants
 * 
 * All magic numbers, URLs, limits defined here.
 * NO hardcoded values in components.
 */

// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://post-social-api.tem-527.workers.dev';
export const AUTH_API_URL = import.meta.env.VITE_AUTH_URL || 'https://npe-api.tem-527.workers.dev';

// Content Limits
export const LIMITS = {
  post: {
    minLength: 20,      // words
    maxLength: 5000,    // characters
  },
  comment: {
    minLength: 1,       // words
    maxLength: 2000,    // characters
  },
  search: {
    minQueryLength: 2,
    maxResults: 50,
    debounceMs: 500,
  },
} as const;

// Synthesis Configuration
export const SYNTHESIS = {
  commentThreshold: 5,     // Auto-trigger after N comments
  versionRetention: 50,    // Keep last N versions
} as const;

// UI Configuration
export const UI = {
  toastDuration: 5000,     // ms
  modalAnimationDuration: 250, // ms
  infiniteScrollThreshold: 200, // px from bottom
} as const;

// Local Storage Keys
export const STORAGE_KEYS = {
  theme: 'post-social:theme',
  token: 'post-social:token',
  user: 'post-social:user',
  panelWidths: 'post-social:panel-widths',
  preferences: 'post-social:preferences',
} as const;

// Feature Flags
export const FEATURES = {
  synthesis: true,
  semanticSearch: true,
  realTimeUpdates: false,  // Future: WebSocket
  aiCurator: false,        // Future: AI responds to comments
} as const;
