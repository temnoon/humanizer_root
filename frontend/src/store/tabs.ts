/**
 * Tab Store - Zustand
 *
 * Manages multi-view tabs with persistence.
 * Each tab maintains complete app state for independent contexts.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TabStore, AppTab } from '../types/tabs';
import { createDefaultTab } from '../types/tabs';

export const useTabStore = create<TabStore>()(
  persist(
    (set, get) => ({
      // Initial state: one default tab
      tabs: [createDefaultTab({ title: 'Home', icon: '🏠' })],
      activeTabId: null,
      maxTabs: 10,

      // Computed getters
      getActiveTab: () => {
        const { tabs, activeTabId } = get();
        // Initialize activeTabId if null
        if (activeTabId === null && tabs.length > 0) {
          set({ activeTabId: tabs[0].id });
          return tabs[0];
        }
        return tabs.find(t => t.id === activeTabId);
      },

      getTabById: (id: string) => {
        return get().tabs.find(t => t.id === id);
      },

      getTabIndex: (id: string) => {
        return get().tabs.findIndex(t => t.id === id);
      },

      // Create new tab
      createTab: (template = {}) => {
        const { tabs, maxTabs } = get();

        // Enforce max tabs limit
        if (tabs.length >= maxTabs) {
          console.warn(`Maximum ${maxTabs} tabs reached. Close a tab to create a new one.`);
          return tabs[0].id; // Return first tab instead
        }

        const newTab = createDefaultTab(template);

        set(state => ({
          tabs: [...state.tabs, newTab],
          activeTabId: newTab.id,
        }));

        return newTab.id;
      },

      // Close tab
      closeTab: (tabId: string) => {
        const { tabs, activeTabId } = get();

        // Prevent closing if only one tab remains
        if (tabs.length === 1) {
          // Reset the single tab to default instead
          const defaultTab = createDefaultTab({ title: 'Home', icon: '🏠' });
          set({ tabs: [defaultTab], activeTabId: defaultTab.id });
          return;
        }

        const closingIndex = tabs.findIndex(t => t.id === tabId);
        if (closingIndex === -1) return;

        // Don't close pinned tabs
        if (tabs[closingIndex].isPinned) {
          console.warn('Cannot close pinned tab. Unpin it first.');
          return;
        }

        const remainingTabs = tabs.filter(t => t.id !== tabId);

        // Determine next active tab
        let newActiveTabId = activeTabId;
        if (activeTabId === tabId) {
          // If closing active tab, switch to adjacent tab
          if (closingIndex > 0) {
            // Switch to tab on the left
            newActiveTabId = remainingTabs[closingIndex - 1].id;
          } else {
            // Switch to first remaining tab
            newActiveTabId = remainingTabs[0].id;
          }
        }

        set({
          tabs: remainingTabs,
          activeTabId: newActiveTabId,
        });
      },

      // Switch to tab
      switchTab: (tabId: string) => {
        const { tabs } = get();
        const tab = tabs.find(t => t.id === tabId);
        if (!tab) return;

        // Update lastAccessedAt
        set(state => ({
          activeTabId: tabId,
          tabs: state.tabs.map(t =>
            t.id === tabId ? { ...t, lastAccessedAt: new Date() } : t
          ),
        }));
      },

      // Update tab data
      updateTab: (tabId: string, updates: Partial<AppTab>) => {
        set(state => ({
          tabs: state.tabs.map(tab =>
            tab.id === tabId
              ? {
                  ...tab,
                  ...updates,
                  // Merge contentData if provided
                  contentData: updates.contentData
                    ? { ...tab.contentData, ...updates.contentData }
                    : tab.contentData,
                  lastAccessedAt: new Date(),
                }
              : tab
          ),
        }));
      },

      // Toggle pin
      pinTab: (tabId: string) => {
        set(state => ({
          tabs: state.tabs.map(tab =>
            tab.id === tabId ? { ...tab, isPinned: !tab.isPinned } : tab
          ),
        }));
      },

      // Navigate to next tab
      switchToNextTab: () => {
        const { tabs, activeTabId } = get();
        if (tabs.length <= 1) return;

        const currentIndex = tabs.findIndex(t => t.id === activeTabId);
        const nextIndex = (currentIndex + 1) % tabs.length;
        get().switchTab(tabs[nextIndex].id);
      },

      // Navigate to previous tab
      switchToPrevTab: () => {
        const { tabs, activeTabId } = get();
        if (tabs.length <= 1) return;

        const currentIndex = tabs.findIndex(t => t.id === activeTabId);
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        get().switchTab(tabs[prevIndex].id);
      },

      // Switch to tab by index (for Cmd+1-9)
      switchToTabByIndex: (index: number) => {
        const { tabs } = get();
        if (index >= 0 && index < tabs.length) {
          get().switchTab(tabs[index].id);
        }
      },

      // Close all tabs (creates one default tab)
      closeAllTabs: () => {
        const defaultTab = createDefaultTab({ title: 'Home', icon: '🏠' });
        set({
          tabs: [defaultTab],
          activeTabId: defaultTab.id,
        });
      },

      // Close all except specified tab
      closeOtherTabs: (tabId: string) => {
        set(state => {
          const keepTab = state.tabs.find(t => t.id === tabId);
          if (!keepTab) return state;

          return {
            tabs: [keepTab],
            activeTabId: tabId,
          };
        });
      },

      // Close tabs to the right of specified tab
      closeTabsToRight: (tabId: string) => {
        const { tabs } = get();
        const index = tabs.findIndex(t => t.id === tabId);
        if (index === -1 || index === tabs.length - 1) return;

        const remainingTabs = tabs.slice(0, index + 1);
        set({
          tabs: remainingTabs,
        });
      },

      // Settings
      setMaxTabs: (max: number) => {
        set({ maxTabs: Math.max(1, Math.min(max, 20)) }); // Clamp between 1-20
      },
    }),
    {
      name: 'humanizer-tabs',
      version: 1,
    }
  )
);

/**
 * Helper hook to sync app state with active tab
 * Call this when app state changes to update the active tab
 */
export function useSyncTabWithAppState() {
  const updateTab = useTabStore(state => state.updateTab);
  const getActiveTab = useTabStore(state => state.getActiveTab);

  return (updates: Partial<AppTab>) => {
    const activeTab = getActiveTab();
    if (activeTab) {
      updateTab(activeTab.id, updates);
    }
  };
}
