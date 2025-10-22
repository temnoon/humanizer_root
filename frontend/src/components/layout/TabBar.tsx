/**
 * TabBar Component
 *
 * Displays tabs with icons, titles, and close buttons.
 * Supports:
 * - Click to switch tabs
 * - Close button with click prevention
 * - Pin indicator
 * - Context menu (right-click)
 * - Drag and drop reordering (future)
 * - Keyboard navigation
 */

import React, { useRef, useState } from 'react';
import { useTabStore } from '../../store/tabs';
import './TabBar.css';

export interface TabBarProps {
  position?: 'top' | 'bottom';
}

export default function TabBar({ position = 'top' }: TabBarProps) {
  const tabs = useTabStore(state => state.tabs);
  const activeTabId = useTabStore(state => state.activeTabId);
  const switchTab = useTabStore(state => state.switchTab);
  const closeTab = useTabStore(state => state.closeTab);
  const createTab = useTabStore(state => state.createTab);
  const pinTab = useTabStore(state => state.pinTab);
  const closeOtherTabs = useTabStore(state => state.closeOtherTabs);
  const closeTabsToRight = useTabStore(state => state.closeTabsToRight);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tabId: string;
  } | null>(null);

  const tabBarRef = useRef<HTMLDivElement>(null);

  const handleTabClick = (tabId: string) => {
    switchTab(tabId);
  };

  const handleCloseClick = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    closeTab(tabId);
  };

  const handleNewTabClick = () => {
    createTab();
  };

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      tabId,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handlePinTab = () => {
    if (contextMenu) {
      pinTab(contextMenu.tabId);
      handleCloseContextMenu();
    }
  };

  const handleCloseOtherTabs = () => {
    if (contextMenu) {
      closeOtherTabs(contextMenu.tabId);
      handleCloseContextMenu();
    }
  };

  const handleCloseTabsToRight = () => {
    if (contextMenu) {
      closeTabsToRight(contextMenu.tabId);
      handleCloseContextMenu();
    }
  };

  const handleCloseThisTab = () => {
    if (contextMenu) {
      closeTab(contextMenu.tabId);
      handleCloseContextMenu();
    }
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    if (contextMenu) {
      const handleClick = () => handleCloseContextMenu();
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  // Keyboard shortcuts handled in App.tsx

  // Get tab for context menu
  const contextTab = contextMenu ? tabs.find(t => t.id === contextMenu.tabId) : null;

  return (
    <div className={`tab-bar tab-bar-${position}`} ref={tabBarRef}>
      <div className="tab-bar-inner">
        <div className="tabs-container">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab ${activeTabId === tab.id ? 'active' : ''} ${tab.isPinned ? 'pinned' : ''}`}
              onClick={() => handleTabClick(tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
              title={tab.title}
              aria-label={`Tab: ${tab.title}`}
              aria-selected={activeTabId === tab.id}
              role="tab"
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-title">{tab.title}</span>
              {tab.isPinned && (
                <span className="tab-pin-indicator" title="Pinned">
                  📌
                </span>
              )}
              <button
                className="tab-close"
                onClick={(e) => handleCloseClick(e, tab.id)}
                aria-label={`Close tab: ${tab.title}`}
                title={tab.isPinned ? 'Unpin tab to close' : 'Close tab'}
                disabled={tab.isPinned}
              >
                ×
              </button>
            </button>
          ))}
        </div>

        <button
          className="tab-new"
          onClick={handleNewTabClick}
          title="New Tab (Cmd+T)"
          aria-label="Create new tab"
        >
          +
        </button>
      </div>

      {/* Context Menu */}
      {contextMenu && contextTab && (
        <div
          className="tab-context-menu"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="context-menu-item"
            onClick={handlePinTab}
          >
            {contextTab.isPinned ? '📌 Unpin Tab' : '📌 Pin Tab'}
          </button>
          <div className="context-menu-separator" />
          <button
            className="context-menu-item"
            onClick={handleCloseThisTab}
            disabled={contextTab.isPinned}
          >
            Close Tab
          </button>
          <button
            className="context-menu-item"
            onClick={handleCloseOtherTabs}
          >
            Close Other Tabs
          </button>
          <button
            className="context-menu-item"
            onClick={handleCloseTabsToRight}
          >
            Close Tabs to the Right
          </button>
        </div>
      )}
    </div>
  );
}
