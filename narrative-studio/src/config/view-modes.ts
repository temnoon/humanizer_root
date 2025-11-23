/**
 * View Mode Configuration
 * Centralized constants for workspace view modes
 */

export const VIEW_MODES = {
  SPLIT: 'split',
  SINGLE_ORIGINAL: 'single-original',
  SINGLE_TRANSFORMED: 'single-transformed'
} as const;

export type ViewMode = typeof VIEW_MODES[keyof typeof VIEW_MODES];

/**
 * Display labels for view mode toggle buttons
 * Note: Include emoji icons for visual distinction
 */
export const VIEW_MODE_LABELS = {
  [VIEW_MODES.SPLIT]: '⟷ Split View',
  [VIEW_MODES.SINGLE_ORIGINAL]: '📄 Original Only',
  [VIEW_MODES.SINGLE_TRANSFORMED]: '✨ Result Only'
} as const;

/**
 * Default view mode for new sessions
 */
export const DEFAULT_VIEW_MODE: ViewMode = VIEW_MODES.SPLIT;

/**
 * View mode for AI detection/analysis results
 */
export const ANALYSIS_VIEW_MODE: ViewMode = VIEW_MODES.SINGLE_TRANSFORMED;

/**
 * View mode for transformations (persona, style, etc.)
 */
export const TRANSFORMATION_VIEW_MODE: ViewMode = VIEW_MODES.SPLIT;
