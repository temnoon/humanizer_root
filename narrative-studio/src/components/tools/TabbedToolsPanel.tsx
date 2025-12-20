/**
 * TabbedToolsPanel - New horizontal-tab based tools panel
 *
 * Replaces the dropdown-based ToolsPanel with:
 * - Horizontal scrollable tool tabs
 * - Individual panes with preserved state
 * - Arrow navigation between tools
 * - Unified buffer integration for content from Archive Panel
 */

import { useEffect, useRef } from 'react';
import { useToolTabs, ToolTabProvider, TOOL_REGISTRY } from '../../contexts/ToolTabContext';
import { useUnifiedBuffer } from '../../contexts/UnifiedBufferContext';
import { useWorkspaceOptional } from '../../contexts/WorkspaceContext';
import { HorizontalToolTabs, ToolLabelBar } from './HorizontalToolTabs';
import { AIAnalysisPane } from './AIAnalysisPane';
import { V2AnalysisPane } from './V2AnalysisPane';
import { V3AnalysisPane } from './V3AnalysisPane';
import { SICAnalysisPane } from './SICAnalysisPane';
import { HumanizerPane, PersonaPane, StylePane, RoundTripPane, AddToBookPane } from './ToolPanes';
import { ExportPane } from './ExportPane';
import { ProfileFactoryPane } from './ProfileFactoryPane';
import { AdminProfilesPane } from './AdminProfilesPane';
import { BufferTreeView } from './BufferTreeView';
import { getContentTypeIcon, getContentTypeLabel } from '../../utils/buffer-text-extraction';

interface HighlightRange {
  start: number;
  end: number;
  reason: string;
  type?: 'tellword' | 'suspect' | 'gptzero';
}

interface TabbedToolsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  onApplyTransform?: (transformedText: string) => void;
  onHighlightText?: (highlights: HighlightRange[]) => void;
}

// Inner panel that uses the context
function TabbedToolsPanelInner({
  isOpen,
  onClose,
  content: propContent,
  onApplyTransform,
  onHighlightText,
}: TabbedToolsPanelProps) {
  const { activeToolId, transformSource, setTransformSource, toolStates, updateToolState } = useToolTabs();
  const { workingBuffer, getTextContent, clearWorkingBuffer } = useUnifiedBuffer();
  const workspaceContext = useWorkspaceOptional();

  // Track previous content to detect changes
  const prevContentRef = useRef<string>('');

  // Get workspace info if available
  const hasActiveWorkspace = workspaceContext?.activeWorkspaceId != null;
  const activeWorkspace = hasActiveWorkspace ? workspaceContext?.getActiveWorkspace() : null;
  const activeBuffer = hasActiveWorkspace ? workspaceContext?.getActiveBuffer() : null;

  // Get the original content (from workspace buffer, unified buffer, or prop)
  const workspaceContent = activeBuffer?.content || '';
  const bufferText = workingBuffer ? getTextContent() : '';
  const originalContent = workspaceContent || bufferText || propContent;

  // Reset to "original" when content changes
  useEffect(() => {
    // Only trigger on actual content changes, not initial mount
    if (prevContentRef.current && prevContentRef.current !== originalContent) {
      // Content has changed - reset transform source to 'original'
      setTransformSource('original');

      // Clear any cached analysis results so they refresh
      updateToolState('ai-analysis', { lastResult: undefined });
      updateToolState('humanizer', { lastResult: undefined });
      updateToolState('persona', { lastResult: undefined });
      updateToolState('style', { lastResult: undefined });
      updateToolState('round-trip', { lastResult: undefined });
    }
    prevContentRef.current = originalContent;
  }, [originalContent, setTransformSource, updateToolState]);

  if (!isOpen) return null;

  // Get the active tool metadata
  const activeTool = TOOL_REGISTRY.find(t => t.id === activeToolId);

  // Check for content sources
  const hasBufferContent = !!workingBuffer;
  const hasWorkspaceContent = hasActiveWorkspace && !!activeBuffer;

  // Get the active (transformed) content from last transformation result
  // Check all tool states for a lastResult with transformed text
  const getLastTransformedText = (): string | null => {
    const toolsWithResults: Array<keyof typeof toolStates> = ['humanizer', 'persona', 'style', 'round-trip'];
    for (const toolId of toolsWithResults) {
      const state = toolStates[toolId];
      if (state && 'lastResult' in state && state.lastResult?.transformed) {
        return state.lastResult.transformed;
      }
    }
    return null;
  };

  const lastTransformed = getLastTransformedText();

  // Determine effective content based on transformSource
  let effectiveContent: string;
  if (transformSource === 'active' && lastTransformed) {
    effectiveContent = lastTransformed;
  } else if (transformSource === 'buffer' && hasBufferContent) {
    effectiveContent = bufferText;
  } else {
    effectiveContent = originalContent;
  }

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className="fixed top-16 right-0 bottom-0 w-80 md:w-full md:h-full z-50 md:relative md:top-0 overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-panel)',
          borderLeft: '1px solid var(--border-color)',
          borderRadius: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header with close button */}
        <div
          style={{
            padding: 'var(--space-md) var(--space-lg)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            Tools
          </h2>
          <button
            onClick={onClose}
            title="Collapse Tools Panel"
            style={{
              padding: 'var(--space-xs) var(--space-sm)',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-tertiary)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            ›
          </button>
        </div>

        {/* Horizontal Tool Tabs */}
        <HorizontalToolTabs />

        {/* Tool Label Bar */}
        <ToolLabelBar />

        {/* Buffer Tree - shown when workspace is active (streamlined) */}
        {hasWorkspaceContent && (
          <BufferTreeView collapsible={true} defaultCollapsed={true} />
        )}

        {/* Buffer Indicator - shows when content is loaded but no workspace */}
        {!hasWorkspaceContent && hasBufferContent && workingBuffer && (
          <div className="tools-panel__buffer-indicator">
            <span className="tools-panel__buffer-icon">
              {getContentTypeIcon(workingBuffer.contentType)}
            </span>
            <span className="tools-panel__buffer-name">
              {workingBuffer.displayName}
            </span>
            <span className="tools-panel__buffer-stats">
              {effectiveContent.split(/\s+/).filter(Boolean).length} words
            </span>
            <button
              onClick={clearWorkingBuffer}
              className="tools-panel__buffer-clear"
              title="Clear buffer"
            >
              ×
            </button>
          </div>
        )}

        {/* Source selector - only when no workspace and chaining is relevant */}
        {!hasWorkspaceContent && lastTransformed && (
          <div className="tools-panel__source-selector">
            <select
              value={transformSource}
              onChange={(e) => setTransformSource(e.target.value as 'original' | 'active')}
              className="tools-panel__source-select"
            >
              <option value="original">From: Original</option>
              <option value="active">From: Last transform</option>
            </select>
          </div>
        )}

        {/* Active Tool Pane */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
          }}
        >
          {activeToolId === 'v2-analysis' && (
            <V2AnalysisPane content={effectiveContent} />
          )}
          {activeToolId === 'ai-analysis' && (
            <AIAnalysisPane content={effectiveContent} onHighlightText={onHighlightText} />
          )}
          {activeToolId === 'v3-analysis' && (
            <V3AnalysisPane content={effectiveContent} onHighlightText={onHighlightText} />
          )}
          {activeToolId === 'sic-analysis' && (
            <SICAnalysisPane content={effectiveContent} onHighlightText={onHighlightText} />
          )}
          {activeToolId === 'humanizer' && (
            <HumanizerPane content={effectiveContent} onApplyTransform={onApplyTransform} />
          )}
          {activeToolId === 'persona' && (
            <PersonaPane content={effectiveContent} onApplyTransform={onApplyTransform} />
          )}
          {activeToolId === 'style' && (
            <StylePane content={effectiveContent} onApplyTransform={onApplyTransform} />
          )}
          {activeToolId === 'round-trip' && (
            <RoundTripPane content={effectiveContent} onApplyTransform={onApplyTransform} />
          )}
          {activeToolId === 'export' && (
            <ExportPane content={effectiveContent} />
          )}
          {activeToolId === 'profile-factory' && (
            <ProfileFactoryPane content={effectiveContent} />
          )}
          {activeToolId === 'add-to-book' && (
            <AddToBookPane content={effectiveContent} />
          )}
          {activeToolId === 'admin-profiles' && (
            <AdminProfilesPane />
          )}
        </div>
      </aside>
    </>
  );
}

// Export the panel wrapped in its provider
export function TabbedToolsPanel(props: TabbedToolsPanelProps) {
  return (
    <ToolTabProvider>
      <TabbedToolsPanelInner {...props} />
    </ToolTabProvider>
  );
}

// Export the provider separately for apps that want to manage it differently
export { ToolTabProvider } from '../../contexts/ToolTabContext';
