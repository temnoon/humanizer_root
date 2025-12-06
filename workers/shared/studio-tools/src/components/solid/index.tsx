/**
 * Solid.js component exports for @humanizer/studio-tools
 *
 * Usage:
 * ```typescript
 * import { ToolPalette, ToolCard, ToolDrawer } from '@humanizer/studio-tools/solid';
 * import '@humanizer/studio-tools/solid/studio-tools.css';
 * ```
 */

// Main orchestration component
export { ToolPalette } from './ToolPalette';
export type { ToolPaletteProps } from './ToolPalette';

// Individual components
export { ToolCard } from './ToolCard';
export type { ToolCardProps } from './ToolCard';

export { ToolDrawer } from './ToolDrawer';
export type { ToolDrawerProps } from './ToolDrawer';

export { ResultPreview } from './ResultPreview';
export type { ResultPreviewProps, ViewMode } from './ResultPreview';

export { ParameterInput } from './ParameterInput';
export type { ParameterInputProps } from './ParameterInput';

// Re-export core functionality for convenience
export {
  initializeTools,
  initializeToolsWithExtras,
  getTool,
  getFilteredTools,
  getCategoriesSorted,
  setAuthToken,
  configureApiClient,
} from '../../index';
