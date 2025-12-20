/**
 * ArchivePanelWrapper - Common panel shell with backdrop, header, and tab bar
 *
 * Extracted from ArchivePanel.tsx to eliminate repeated wrapper code.
 * All archive views use this wrapper for consistent layout.
 */

import type { ReactNode } from 'react';
import { ArchiveIconTabBar } from './ArchiveIconTabBar';
import type { ViewMode } from '../../hooks/useArchiveState';

interface TabItem {
  id: string;
  icon: string;
  title: string;
}

interface ArchivePanelWrapperProps {
  // Panel state
  onClose: () => void;

  // Tab bar props
  tabs: TabItem[];
  viewMode: ViewMode;
  effectiveTabId: string;
  onTabChange: (tabId: ViewMode) => void;
  onFocusConversation: () => void;

  // Optional header customization
  archiveName?: string;
  archivePath?: string;
  showArchiveName?: boolean;

  // Header content (placed after tab bar, inside header section)
  headerContent?: ReactNode;

  // Main content
  children: ReactNode;

  // Lightbox or other overlays (rendered after aside)
  overlay?: ReactNode;
}

export function ArchivePanelWrapper({
  onClose,
  tabs,
  viewMode,
  effectiveTabId,
  onTabChange,
  onFocusConversation,
  archiveName,
  archivePath,
  showArchiveName = false,
  headerContent,
  children,
  overlay,
}: ArchivePanelWrapperProps) {
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
        className="fixed top-16 left-0 bottom-0 w-80 md:w-full md:h-full z-50 md:relative md:top-0 panel"
        style={{
          backgroundColor: 'var(--bg-panel)',
          borderRight: '1px solid var(--border-color)',
          borderRadius: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="panel-header"
          style={{
            padding: showArchiveName ? 'var(--space-lg)' : 'var(--space-md) var(--space-lg)',
            borderBottom: headerContent ? undefined : '1px solid var(--border-color)',
            flexShrink: 0,
          }}
        >
          <div className={`flex items-center justify-between ${showArchiveName ? 'mb-4' : ''}`}>
            <h2 className="heading-md u-text-primary">
              Archive
              {showArchiveName && archiveName && (
                <>
                  {' '}
                  <span
                    className="text-small u-text-tertiary"
                    title={archivePath}
                  >
                    ({archiveName})
                  </span>
                </>
              )}
            </h2>
            <button
              onClick={onClose}
              title="Collapse Archive Panel"
              className="p-2 rounded-md hover:opacity-70"
              style={{
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--bg-tertiary)',
                fontSize: '16px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              ‹
            </button>
          </div>

          {/* Icon Tab Bar */}
          <ArchiveIconTabBar
            tabs={tabs}
            activeTabId={viewMode}
            effectiveTabId={effectiveTabId}
            onTabChange={onTabChange}
            onFocusConversation={onFocusConversation}
          />

          {/* Optional header content (search bar, filters, etc.) */}
          {headerContent}
        </div>

        {/* Main content */}
        {children}
      </aside>

      {/* Overlay (lightbox, modals, etc.) */}
      {overlay}
    </>
  );
}
