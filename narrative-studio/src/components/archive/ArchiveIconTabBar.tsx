/**
 * ArchiveIconTabBar - Navigation tabs for archive panel
 *
 * Extracted from ArchivePanel.tsx for reusability.
 */

import { useRef } from 'react';
import type { ViewMode } from '../../hooks/useArchiveState';

interface TabItem {
  id: string;
  icon: string;
  title: string;
}

interface ArchiveIconTabBarProps {
  tabs: TabItem[];
  activeTabId: string;
  effectiveTabId: string;  // For showing selected state (handles 'messages' view case)
  onTabChange: (tabId: ViewMode) => void;
  onFocusConversation?: () => void;  // Called when switching to conversations tab
}

export function ArchiveIconTabBar({
  tabs,
  activeTabId,
  effectiveTabId,
  onTabChange,
  onFocusConversation,
}: ArchiveIconTabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollTabIntoView = (index: number) => {
    const container = scrollRef.current;
    if (!container) return;
    const tabWidth = 38; // 34px button + 4px gap
    const scrollTarget = index * tabWidth - container.clientWidth / 2 + tabWidth / 2;
    container.scrollTo({ left: Math.max(0, scrollTarget), behavior: 'smooth' });
  };

  const navigatePrevTab = () => {
    const currentIndex = tabs.findIndex(t => t.id === activeTabId);
    const prevIndex = currentIndex <= 0 ? tabs.length - 1 : currentIndex - 1;
    onTabChange(tabs[prevIndex].id as ViewMode);
    scrollTabIntoView(prevIndex);
  };

  const navigateNextTab = () => {
    const currentIndex = tabs.findIndex(t => t.id === activeTabId);
    const nextIndex = currentIndex >= tabs.length - 1 ? 0 : currentIndex + 1;
    onTabChange(tabs[nextIndex].id as ViewMode);
    scrollTabIntoView(nextIndex);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '6px 8px',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      <button
        onClick={navigatePrevTab}
        style={{
          width: '22px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 600,
          flexShrink: 0,
        }}
        title="Previous tab"
      >
        ‹
      </button>

      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-xs)',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          flex: 1,
        }}
      >
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              onTabChange(tab.id as ViewMode);
              if (tab.id === 'conversations' && onFocusConversation) {
                onFocusConversation();
              }
            }}
            title={tab.title}
            style={{
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: effectiveTabId === tab.id ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              backgroundImage: effectiveTabId === tab.id ? 'var(--accent-primary-gradient)' : 'none',
              border: effectiveTabId === tab.id ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              color: effectiveTabId === tab.id ? 'var(--text-inverse)' : 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '1.1rem',
              flexShrink: 0,
            }}
          >
            {tab.icon}
          </button>
        ))}
      </div>

      <button
        onClick={navigateNextTab}
        style={{
          width: '22px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 600,
          flexShrink: 0,
        }}
        title="Next tab"
      >
        ›
      </button>
    </div>
  );
}
