/**
 * StudioLayout - 3-Panel Studio Layout
 *
 * Orchestrates the responsive 3-panel Studio interface:
 * - Archive Pane (left) - archive browser, search, clusters, import
 * - Workspace (center) - main content editing area
 * - Tools Pane (right) - search, transform, harvest, transcribe tools
 *
 * Features:
 * - Responsive desktop (3-panel grid) and mobile (bottom sheets) layouts
 * - Resizable panels with persistence
 * - Keyboard shortcuts (Cmd+1/2/3, Cmd+[/])
 * - Focus management and accessibility
 *
 * @module @humanizer/studio/components/studio/StudioLayout
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePanels, usePanelState } from '../../contexts/PanelContext';
import { usePanelShortcuts, usePanelFocus, useAnnounce } from '../../hooks/usePanelShortcuts';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface StudioLayoutProps {
  /** Archive pane content */
  archivePane?: ReactNode;
  /** Main workspace content */
  workspace: ReactNode;
  /** Tools pane content */
  toolsPane?: ReactNode;
  /** Optional class name */
  className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function StudioLayout({
  archivePane,
  workspace,
  toolsPane,
  className = '',
}: StudioLayoutProps): React.ReactElement {
  const panelState = usePanelState();
  const {
    toggleArchive,
    toggleTools,
    setArchiveWidth,
    setToolsWidth,
    setArchiveSheetState,
    setToolsSheetState,
  } = usePanels();

  const announce = useAnnounce();

  // Initialize keyboard shortcuts
  usePanelShortcuts({
    onFocus: (panel) => {
      announce(`Focused ${panel} panel`);
    },
    onToggle: (panel, isOpen) => {
      announce(`${panel} panel ${isOpen ? 'opened' : 'closed'}`);
    },
  });

  // Focus management for each panel
  const archiveFocus = usePanelFocus('archive');
  const workspaceFocus = usePanelFocus('workspace');
  const toolsFocus = usePanelFocus('tools');

  // Resize state
  const [isResizingArchive, setIsResizingArchive] = useState(false);
  const [isResizingTools, setIsResizingTools] = useState(false);
  const resizeStartRef = useRef<{ x: number; width: number } | null>(null);

  // Mobile sheet gesture state
  const [archiveDragOffset, setArchiveDragOffset] = useState(0);
  const [toolsDragOffset, setToolsDragOffset] = useState(0);
  const sheetDragStartRef = useRef<{ y: number; time: number } | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // RESIZE HANDLERS (Desktop)
  // ─────────────────────────────────────────────────────────────────────────

  const handleArchiveResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingArchive(true);
    resizeStartRef.current = {
      x: e.clientX,
      width: panelState.archiveWidth,
    };
  }, [panelState.archiveWidth]);

  const handleToolsResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingTools(true);
    resizeStartRef.current = {
      x: e.clientX,
      width: panelState.toolsWidth,
    };
  }, [panelState.toolsWidth]);

  useEffect(() => {
    if (!isResizingArchive && !isResizingTools) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeStartRef.current) return;

      const deltaX = e.clientX - resizeStartRef.current.x;

      if (isResizingArchive) {
        setArchiveWidth(resizeStartRef.current.width + deltaX);
      } else if (isResizingTools) {
        setToolsWidth(resizeStartRef.current.width - deltaX);
      }
    };

    const handleMouseUp = () => {
      setIsResizingArchive(false);
      setIsResizingTools(false);
      resizeStartRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingArchive, isResizingTools, setArchiveWidth, setToolsWidth]);

  // ─────────────────────────────────────────────────────────────────────────
  // MOBILE SHEET GESTURE HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  const DRAG_THRESHOLD = 50;
  const VELOCITY_THRESHOLD = 0.5;

  const handleSheetTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    sheetDragStartRef.current = { y: touch.clientY, time: Date.now() };
  }, []);

  const handleArchiveSheetTouchMove = useCallback((e: React.TouchEvent) => {
    if (!sheetDragStartRef.current) return;
    const touch = e.touches[0];
    const deltaY = sheetDragStartRef.current.y - touch.clientY;
    setArchiveDragOffset(deltaY);
  }, []);

  const handleToolsSheetTouchMove = useCallback((e: React.TouchEvent) => {
    if (!sheetDragStartRef.current) return;
    const touch = e.touches[0];
    const deltaY = sheetDragStartRef.current.y - touch.clientY;
    setToolsDragOffset(deltaY);
  }, []);

  const handleArchiveSheetTouchEnd = useCallback(() => {
    if (!sheetDragStartRef.current) return;

    const deltaTime = Date.now() - sheetDragStartRef.current.time;
    const velocity = Math.abs(archiveDragOffset) / deltaTime;
    const isQuickSwipe = velocity > VELOCITY_THRESHOLD;
    const draggedUp = archiveDragOffset > 0;

    let newState = panelState.archiveSheetState;

    if (isQuickSwipe || Math.abs(archiveDragOffset) > DRAG_THRESHOLD) {
      if (draggedUp) {
        if (newState === 'collapsed') newState = 'partial';
        else if (newState === 'partial') newState = 'expanded';
      } else {
        if (newState === 'expanded') newState = 'partial';
        else if (newState === 'partial') newState = 'collapsed';
      }
    }

    setArchiveSheetState(newState);
    setArchiveDragOffset(0);
    sheetDragStartRef.current = null;
  }, [archiveDragOffset, panelState.archiveSheetState, setArchiveSheetState]);

  const handleToolsSheetTouchEnd = useCallback(() => {
    if (!sheetDragStartRef.current) return;

    const deltaTime = Date.now() - sheetDragStartRef.current.time;
    const velocity = Math.abs(toolsDragOffset) / deltaTime;
    const isQuickSwipe = velocity > VELOCITY_THRESHOLD;
    const draggedUp = toolsDragOffset > 0;

    let newState = panelState.toolsSheetState;

    if (isQuickSwipe || Math.abs(toolsDragOffset) > DRAG_THRESHOLD) {
      if (draggedUp) {
        if (newState === 'collapsed') newState = 'partial';
        else if (newState === 'partial') newState = 'expanded';
      } else {
        if (newState === 'expanded') newState = 'partial';
        else if (newState === 'partial') newState = 'collapsed';
      }
    }

    setToolsSheetState(newState);
    setToolsDragOffset(0);
    sheetDragStartRef.current = null;
  }, [toolsDragOffset, panelState.toolsSheetState, setToolsSheetState]);

  // ─────────────────────────────────────────────────────────────────────────
  // BACKDROP HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  const handleBackdropClick = useCallback(() => {
    if (panelState.archiveSheetState !== 'collapsed') {
      setArchiveSheetState('collapsed');
    }
    if (panelState.toolsSheetState !== 'collapsed') {
      setToolsSheetState('collapsed');
    }
  }, [
    panelState.archiveSheetState,
    panelState.toolsSheetState,
    setArchiveSheetState,
    setToolsSheetState,
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  // Compute layout classes
  const layoutClasses = [
    'studio-layout',
    !panelState.archiveOpen && !panelState.toolsOpen && 'studio-layout--both-collapsed',
    !panelState.archiveOpen && panelState.toolsOpen && 'studio-layout--archive-collapsed',
    panelState.archiveOpen && !panelState.toolsOpen && 'studio-layout--tools-collapsed',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // Compute archive panel classes
  const archivePanelClasses = [
    'panel',
    'panel--archive',
    !panelState.archiveOpen && !panelState.isMobile && 'panel--collapsed',
    panelState.isMobile && 'panel--mobile-sheet',
    panelState.isMobile && `panel--sheet-${panelState.archiveSheetState}`,
  ]
    .filter(Boolean)
    .join(' ');

  // Compute tools panel classes
  const toolsPanelClasses = [
    'panel',
    'panel--tools',
    !panelState.toolsOpen && !panelState.isMobile && 'panel--collapsed',
    panelState.isMobile && 'panel--mobile-sheet',
    panelState.isMobile && `panel--sheet-${panelState.toolsSheetState}`,
  ]
    .filter(Boolean)
    .join(' ');

  // Show backdrop when any sheet is expanded
  const showBackdrop =
    panelState.isMobile &&
    (panelState.archiveSheetState !== 'collapsed' ||
      panelState.toolsSheetState !== 'collapsed');

  // Custom CSS properties for panel widths
  const layoutStyle = panelState.isMobile
    ? undefined
    : {
        '--panel-archive-width': `${panelState.archiveWidth}px`,
        '--panel-tools-width': `${panelState.toolsWidth}px`,
      } as React.CSSProperties;

  return (
    <div className={layoutClasses} style={layoutStyle}>
      {/* Archive Pane */}
      <aside
        className={archivePanelClasses}
        data-panel="archive"
        role="complementary"
        aria-label="Archive panel"
        onFocus={archiveFocus.handleFocus}
        onBlur={archiveFocus.handleBlur}
        data-focused={archiveFocus['data-focused']}
        style={
          panelState.isMobile && archiveDragOffset !== 0
            ? { transform: `translateY(${-archiveDragOffset}px)` }
            : undefined
        }
      >
        {/* Mobile sheet handle */}
        {panelState.isMobile && (
          <div
            className="panel__sheet-handle"
            onTouchStart={handleSheetTouchStart}
            onTouchMove={handleArchiveSheetTouchMove}
            onTouchEnd={handleArchiveSheetTouchEnd}
            role="button"
            tabIndex={0}
            aria-label={
              panelState.archiveSheetState === 'expanded'
                ? 'Collapse archive panel'
                : 'Expand archive panel'
            }
          >
            <div className="panel__sheet-handle-bar" />
            <span className="panel__sheet-handle-title">Archive</span>
          </div>
        )}

        {/* Archive content */}
        {archivePane}

        {/* Desktop resize handle */}
        {!panelState.isMobile && (
          <div
            className={`panel__resize-handle ${isResizingArchive ? 'panel__resize-handle--dragging' : ''}`}
            onMouseDown={handleArchiveResizeStart}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize archive panel"
            tabIndex={0}
          />
        )}
      </aside>

      {/* Workspace */}
      <main
        className="panel panel--workspace"
        data-panel="workspace"
        role="main"
        onFocus={workspaceFocus.handleFocus}
        onBlur={workspaceFocus.handleBlur}
        data-focused={workspaceFocus['data-focused']}
      >
        {workspace}
      </main>

      {/* Tools Pane */}
      <aside
        className={toolsPanelClasses}
        data-panel="tools"
        role="complementary"
        aria-label="Tools panel"
        onFocus={toolsFocus.handleFocus}
        onBlur={toolsFocus.handleBlur}
        data-focused={toolsFocus['data-focused']}
        style={
          panelState.isMobile && toolsDragOffset !== 0
            ? { transform: `translateY(${-toolsDragOffset}px)` }
            : undefined
        }
      >
        {/* Mobile sheet handle */}
        {panelState.isMobile && (
          <div
            className="panel__sheet-handle"
            onTouchStart={handleSheetTouchStart}
            onTouchMove={handleToolsSheetTouchMove}
            onTouchEnd={handleToolsSheetTouchEnd}
            role="button"
            tabIndex={0}
            aria-label={
              panelState.toolsSheetState === 'expanded'
                ? 'Collapse tools panel'
                : 'Expand tools panel'
            }
          >
            <div className="panel__sheet-handle-bar" />
            <span className="panel__sheet-handle-title">Tools</span>
          </div>
        )}

        {/* Tools content */}
        {toolsPane}

        {/* Desktop resize handle */}
        {!panelState.isMobile && (
          <div
            className={`panel__resize-handle ${isResizingTools ? 'panel__resize-handle--dragging' : ''}`}
            onMouseDown={handleToolsResizeStart}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize tools panel"
            tabIndex={0}
          />
        )}
      </aside>

      {/* Edge toggle buttons (when panels are collapsed) */}
      {!panelState.isMobile && !panelState.archiveOpen && (
        <button
          className="panel-toggle panel-toggle--archive"
          onClick={toggleArchive}
          aria-label="Open archive panel"
          title="Open archive panel (Cmd+[)"
        >
          <span aria-hidden="true">&#9654;</span>
        </button>
      )}
      {!panelState.isMobile && !panelState.toolsOpen && (
        <button
          className="panel-toggle panel-toggle--tools"
          onClick={toggleTools}
          aria-label="Open tools panel"
          title="Open tools panel (Cmd+])"
        >
          <span aria-hidden="true">&#9664;</span>
        </button>
      )}

      {/* Mobile backdrop */}
      <div
        className={`panel-backdrop ${showBackdrop ? 'panel-backdrop--visible' : ''}`}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Screen reader live regions */}
      <div id="aria-live-polite" aria-live="polite" aria-atomic="true" className="sr-only" />
      <div id="aria-live-assertive" aria-live="assertive" aria-atomic="true" className="sr-only" />
    </div>
  );
}

export default StudioLayout;
