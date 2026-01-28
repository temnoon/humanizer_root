/**
 * ToolsPane - Tools Panel Container
 *
 * Container component for the tools panel with tabs:
 * - Search: Agentic search interface
 * - Transform: AI transformation tools
 * - Harvest: Content extraction
 * - Transcribe: Media transcription launcher
 *
 * @module @humanizer/studio/components/tools/ToolsPane
 */

import React, { useCallback } from 'react';
import { usePanels, usePanelState } from '../../contexts/PanelContext';
import { SearchTool } from './SearchTool';
import { TransformTool } from './TransformTool';
import { HarvestTool } from './HarvestTool';
import { TranscribeTool } from './TranscribeTool';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ToolsPaneProps {
  /** Archive ID for search/harvest context */
  archiveId?: string;
  /** Currently selected content IDs for transformation/harvest */
  selectedContentIds?: string[];
  /** Called when search finds results */
  onSearchResults?: (results: SearchResult[]) => void;
  /** Called when transformation is applied */
  onTransformApplied?: (contentId: string, transformedContent: string) => void;
  /** Called when content is harvested */
  onContentHarvested?: (items: HarvestedItem[]) => void;
  /** Called when transcription is requested */
  onRequestTranscription?: (mediaId: string, archiveId: string, type: TranscriptionType) => void;
  /** Optional class name */
  className?: string;
}

/** Search result from agentic search */
export interface SearchResult {
  id: string;
  type: 'content' | 'transcript' | 'cluster';
  content: string;
  score: number;
  sourceId?: string;
  metadata?: Record<string, unknown>;
}

/** Harvested content item */
export interface HarvestedItem {
  id: string;
  content: string;
  source: string;
  addedAt: Date;
}

/** Transcription types */
export type TranscriptionType = 'audio' | 'ocr' | 'caption' | 'description' | 'manual';

// Tab configuration
const TABS = [
  { id: 'search', label: 'Search', icon: '🔍' },
  { id: 'transform', label: 'Transform', icon: '✨' },
  { id: 'harvest', label: 'Harvest', icon: '🌾' },
  { id: 'transcribe', label: 'Transcribe', icon: '🎙️' },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function ToolsPane({
  archiveId,
  selectedContentIds = [],
  onSearchResults,
  onTransformApplied,
  onContentHarvested,
  onRequestTranscription,
  className = '',
}: ToolsPaneProps): React.ReactElement {
  const panelState = usePanelState();
  const { setToolsTab, toggleTools } = usePanels();

  const handleTabChange = useCallback(
    (tabId: typeof TABS[number]['id']) => {
      setToolsTab(tabId);
    },
    [setToolsTab]
  );

  // Render tab content
  const renderTabContent = () => {
    switch (panelState.toolsTab) {
      case 'search':
        return (
          <SearchTool
            archiveId={archiveId}
            onSearchResults={onSearchResults}
          />
        );
      case 'transform':
        return (
          <TransformTool
            selectedContentIds={selectedContentIds}
            onTransformApplied={onTransformApplied}
          />
        );
      case 'harvest':
        return (
          <HarvestTool
            archiveId={archiveId}
            selectedContentIds={selectedContentIds}
            onContentHarvested={onContentHarvested}
          />
        );
      case 'transcribe':
        return (
          <TranscribeTool
            archiveId={archiveId}
            onRequestTranscription={onRequestTranscription}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={`tools-pane ${className}`}>
      {/* Panel Header */}
      <div className="panel__header">
        <h2 className="panel__title">Tools</h2>
        <div className="panel__actions">
          {!panelState.isMobile && (
            <button
              className="panel__collapse-btn"
              onClick={toggleTools}
              aria-label="Collapse tools panel"
              title="Collapse (Cmd+])"
            >
              ›
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="panel__tabs" role="tablist" aria-label="Tool views">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`panel__tab ${panelState.toolsTab === tab.id ? 'panel__tab--active' : ''}`}
            role="tab"
            aria-selected={panelState.toolsTab === tab.id}
            aria-controls={`tools-panel-${tab.id}`}
            onClick={() => handleTabChange(tab.id)}
          >
            <span aria-hidden="true">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div
        className="panel__content"
        role="tabpanel"
        id={`tools-panel-${panelState.toolsTab}`}
        aria-labelledby={`tools-tab-${panelState.toolsTab}`}
      >
        {renderTabContent()}
      </div>
    </div>
  );
}

export default ToolsPane;
