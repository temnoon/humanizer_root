/**
 * Studio Components Index
 * 
 * Studio-First Architecture Components:
 * - StudioLayout: 3-panel resizable shell
 * - NavigationPanel: Left panel (FIND)
 * - ContentPanel: Center panel (FOCUS)
 * - ContextPanel: Right panel (TRANSFORM)
 * - EditorPanel: Markdown editor for center
 * - CuratorPanel: AI tools for right
 * - ArchivePanel: Legacy archive browser
 * - Lightbox: Media overlay
 */

// Layout
export { StudioLayout } from './StudioLayout';

// Panel Components
export { NavigationPanel } from './NavigationPanel';
export type { CenterMode } from './NavigationPanel';
export { ContentPanel } from './ContentPanel';
export { ContextPanel } from './ContextPanel';

// Specialized Panels
export { ArchivePanel } from './ArchivePanel';
export { EditorPanel } from './EditorPanel';
export { CuratorPanel } from './CuratorPanel';
export { CuratorRulesEditor } from './CuratorRulesEditor';
export { AdminPanel } from './AdminPanel';
export { SynthesisDashboard } from './SynthesisDashboard';
export { GutenbergBrowser } from './GutenbergBrowser';
export { NodeSeeder } from './NodeSeeder';
export { NodeCreationWizard } from './NodeCreationWizard';
export { TransformPanel } from './TransformPanel';
export { PersonaBrowser } from './PersonaBrowser';
export { CommentSection } from './CommentSection';

// Overlay
export { Lightbox, openLightbox, closeLightbox, useLightbox } from './Lightbox';
export type { LightboxItem } from './Lightbox';
