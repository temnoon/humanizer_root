/**
 * ArchivePane - Archive Panel Container
 *
 * Container component for the archive panel with tabs:
 * - Browser: Tree view of conversations and content
 * - Search: Unified semantic search (transcripts + content)
 * - Clusters: Discovered topic clusters
 * - Import: Archive import wizard
 *
 * @module @humanizer/studio/components/archive/ArchivePane
 */

import React, { useCallback } from 'react';
import { usePanels, usePanelState } from '../../contexts/PanelContext';
import { ArchiveBrowser } from './ArchiveBrowser';
import { ArchiveSearch } from './ArchiveSearch';
import { ClusterBrowser } from './ClusterBrowser';
import { ImportView } from './ImportView';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ArchivePaneProps {
  /** Archive ID to display */
  archiveId?: string;
  /** Called when a content item is selected */
  onSelectContent?: (contentId: string, type: 'node' | 'transcript') => void;
  /** Called when similar search is requested */
  onSearchSimilar?: (embedding: number[], sourceId: string) => void;
  /** Called when dissimilar search is requested */
  onSearchDissimilar?: (embedding: number[], sourceId: string) => void;
  /** Called when transcription is requested for media */
  onRequestTranscription?: (mediaId: string, archiveId: string) => void;
  /** Optional class name */
  className?: string;
}

// Tab configuration
const TABS = [
  { id: 'browser', label: 'Browse', icon: '📂' },
  { id: 'search', label: 'Search', icon: '🔍' },
  { id: 'clusters', label: 'Clusters', icon: '🎯' },
  { id: 'import', label: 'Import', icon: '📥' },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function ArchivePane({
  archiveId,
  onSelectContent,
  onSearchSimilar,
  onSearchDissimilar,
  onRequestTranscription,
  className = '',
}: ArchivePaneProps): React.ReactElement {
  const panelState = usePanelState();
  const { setArchiveTab, toggleArchive } = usePanels();

  const handleTabChange = useCallback(
    (tabId: typeof TABS[number]['id']) => {
      setArchiveTab(tabId);
    },
    [setArchiveTab]
  );

  // Render tab content
  const renderTabContent = () => {
    switch (panelState.archiveTab) {
      case 'browser':
        return (
          <ArchiveBrowser
            archiveId={archiveId}
            onSelectContent={onSelectContent}
            onSearchSimilar={onSearchSimilar}
            onRequestTranscription={onRequestTranscription}
          />
        );
      case 'search':
        return (
          <ArchiveSearch
            archiveId={archiveId}
            onSelectContent={onSelectContent}
            onSearchSimilar={onSearchSimilar}
            onSearchDissimilar={onSearchDissimilar}
            onRequestTranscription={onRequestTranscription}
          />
        );
      case 'clusters':
        return (
          <ClusterBrowser
            archiveId={archiveId}
            onSelectCluster={(clusterId) => {
              // Switch to search tab and show cluster contents
              setArchiveTab('search');
            }}
            onSearchSimilar={onSearchSimilar}
          />
        );
      case 'import':
        return (
          <ImportView
            onImportComplete={() => {
              // Switch back to browser after import
              setArchiveTab('browser');
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={`archive-pane ${className}`}>
      {/* Panel Header */}
      <div className="panel__header">
        <h2 className="panel__title">Archive</h2>
        <div className="panel__actions">
          {!panelState.isMobile && (
            <button
              className="panel__collapse-btn"
              onClick={toggleArchive}
              aria-label="Collapse archive panel"
              title="Collapse (Cmd+[)"
            >
              ‹
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="panel__tabs" role="tablist" aria-label="Archive views">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`panel__tab ${panelState.archiveTab === tab.id ? 'panel__tab--active' : ''}`}
            role="tab"
            aria-selected={panelState.archiveTab === tab.id}
            aria-controls={`archive-panel-${tab.id}`}
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
        id={`archive-panel-${panelState.archiveTab}`}
        aria-labelledby={`archive-tab-${panelState.archiveTab}`}
      >
        {renderTabContent()}
      </div>
    </div>
  );
}

export default ArchivePane;
