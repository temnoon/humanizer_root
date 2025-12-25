/**
 * Archive Icon Tab Bar - Horizontal navigation for archive tabs
 */

import { ARCHIVE_TABS, type ArchiveTabId } from './types';

interface ArchiveIconTabBarProps {
  activeTab: ArchiveTabId;
  onTabChange: (tab: ArchiveTabId) => void;
}

export function ArchiveIconTabBar({ activeTab, onTabChange }: ArchiveIconTabBarProps) {
  return (
    <nav className="archive-tabs__nav">
      {ARCHIVE_TABS.map(tab => (
        <button
          key={tab.id}
          className={`archive-tabs__tab ${activeTab === tab.id ? 'archive-tabs__tab--active' : ''}`}
          onClick={() => onTabChange(tab.id)}
          title={tab.description}
        >
          <span className="archive-tabs__tab-icon">{tab.icon}</span>
          <span className="archive-tabs__tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
