/**
 * Archive Tabs - Container for tabbed archive navigation
 */

import { useState, useEffect, type ReactNode } from 'react';
import { ArchiveIconTabBar } from './ArchiveIconTabBar';
import { GalleryView } from './GalleryView';
import { ImportView } from './ImportView';
import { BooksView } from './BooksView';
import { FacebookView } from './FacebookView';
import { ExploreView } from './ExploreView';
import type { ArchiveTabId, SelectedFacebookMedia } from './types';

const STORAGE_KEY = 'humanizer-archive-tab';

interface ArchiveTabsProps {
  /** Render the conversations tab content */
  renderConversations: () => ReactNode;
  /** Callback when Facebook media is selected for main workspace */
  onSelectMedia?: (media: SelectedFacebookMedia) => void;
}

export function ArchiveTabs({ renderConversations, onSelectMedia }: ArchiveTabsProps) {
  const [activeTab, setActiveTab] = useState<ArchiveTabId>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved as ArchiveTabId) || 'conversations';
  });

  // Persist active tab
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, activeTab);
  }, [activeTab]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'conversations':
        return renderConversations();
      case 'gallery':
        return <GalleryView />;
      case 'import':
        return <ImportView />;
      case 'books':
        return <BooksView />;
      case 'facebook':
        return <FacebookView onSelectMedia={onSelectMedia} />;
      case 'explore':
        return <ExploreView />;
      default:
        return renderConversations();
    }
  };

  return (
    <div className="archive-tabs">
      <ArchiveIconTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <div className="archive-tabs__content">
        {renderTabContent()}
      </div>
    </div>
  );
}
