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
import { HorizontalToolTabs, ToolLabelBar } from './HorizontalToolTabs';
import { AIAnalysisPane } from './AIAnalysisPane';
import { HumanizerPane, PersonaPane, StylePane, RoundTripPane, AddToBookPane } from './ToolPanes';
import { ProfileFactoryPane } from './ProfileFactoryPane';
import { AdminProfilesPane } from './AdminProfilesPane';
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

  // Track previous content to detect changes
  const prevContentRef = useRef<string>('');

  // Get the original content (from buffer or prop)
  const bufferText = workingBuffer ? getTextContent() : '';
  const originalContent = bufferText || propContent;

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

  // hasBufferContent is derived from workingBuffer (originalContent already computed above)
  const hasBufferContent = !!workingBuffer;

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

        {/* Buffer Indicator - shows when content is loaded from Archive */}
        {hasBufferContent && workingBuffer && (
          <div
            style={{
              padding: 'var(--space-sm) var(--space-md)',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: 'var(--accent-primary)',
              backgroundImage: 'var(--accent-primary-gradient)',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '1rem' }}>
                  {getContentTypeIcon(workingBuffer.contentType)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-inverse)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {workingBuffer.displayName}
                  </div>
                  <div style={{
                    fontSize: '0.625rem',
                    color: 'rgba(255, 255, 255, 0.75)',
                  }}>
                    {getContentTypeLabel(workingBuffer.contentType)} · {effectiveContent.split(/\s+/).filter(Boolean).length} words
                  </div>
                </div>
              </div>
              <button
                onClick={clearWorkingBuffer}
                title="Clear buffer"
                style={{
                  padding: '4px 8px',
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  color: 'var(--text-inverse)',
                }}
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Transform Source Selector (compact) */}
        <div
          style={{
            padding: 'var(--space-sm) var(--space-md)',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <span style={{ fontSize: '0.625rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
              Source:
            </span>
            <select
              value={transformSource}
              onChange={(e) => setTransformSource(e.target.value as 'original' | 'active')}
              style={{
                flex: 1,
                padding: '4px 8px',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.75rem',
              }}
            >
              <option value="original">Original text</option>
              <option value="active" disabled={!lastTransformed}>
                {lastTransformed ? 'Last transformed (chain)' : 'Last transformed (none yet)'}
              </option>
            </select>
          </div>
          {/* Show current content source and word count */}
          <div style={{ fontSize: '0.625rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            Using: {transformSource === 'active' && lastTransformed ? 'transformed' : 'original'} · {effectiveContent.split(/\s+/).filter(Boolean).length} words
          </div>
        </div>

        {/* Active Tool Pane */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
          }}
        >
          {activeToolId === 'ai-analysis' && (
            <AIAnalysisPane content={effectiveContent} onHighlightText={onHighlightText} />
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
