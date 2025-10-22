/**
 * Tab System Types
 *
 * Multi-view tabs allow users to work with multiple contexts simultaneously.
 * Each tab maintains its own complete app state (sidebar, main pane, tool panel).
 */

import type { SidebarView } from './sidebar';
import type { SelectedContent, TransformationResult } from '../App';
import type { MediaItem } from '@/lib/api-client';

/**
 * Main content type displayed in a tab
 */
export type TabContentType =
  | 'conversation'      // Viewing a conversation
  | 'transformation'    // Viewing transformation result
  | 'media'            // Viewing media item
  | 'search'           // Search results view
  | 'welcome'          // Default welcome screen
  | 'interest_list';   // Interest list view

/**
 * Complete tab state
 * Captures all state needed to restore a tab exactly as it was
 */
export interface AppTab {
  // Identity
  id: string;                    // UUID
  title: string;                 // Display title (e.g., "Quantum Discussion")
  icon: string;                  // Emoji icon

  // Sidebar state
  sidebarView: SidebarView;
  sidebarCollapsed: boolean;
  selectedConversation: string | null;
  selectedDocument?: string | null;
  conversationTitle?: string;
  documentTitle?: string;

  // Main pane state
  contentType: TabContentType;
  contentData: {
    conversation?: string;       // Conversation UUID
    transformation?: TransformationResult;
    media?: MediaItem;
    searchQuery?: string;
    interestListId?: string;
  };

  // Tool panel state
  toolPanelCollapsed: boolean;
  selectedContent: SelectedContent | null;
  transformationResult: TransformationResult | null;
  selectedMedia: MediaItem | null;

  // Metadata
  createdAt: Date;
  lastAccessedAt: Date;
  isPinned: boolean;
}

/**
 * Tab store state and actions
 */
export interface TabStore {
  // State
  tabs: AppTab[];
  activeTabId: string | null;
  maxTabs: number;

  // Computed
  getActiveTab: () => AppTab | undefined;
  getTabById: (id: string) => AppTab | undefined;
  getTabIndex: (id: string) => number;

  // Actions - Tab Management
  createTab: (template?: Partial<AppTab>) => string;
  closeTab: (tabId: string) => void;
  switchTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<AppTab>) => void;
  pinTab: (tabId: string) => void;

  // Actions - Navigation
  switchToNextTab: () => void;
  switchToPrevTab: () => void;
  switchToTabByIndex: (index: number) => void;

  // Actions - Bulk
  closeAllTabs: () => void;
  closeOtherTabs: (tabId: string) => void;
  closeTabsToRight: (tabId: string) => void;

  // Actions - Settings
  setMaxTabs: (max: number) => void;
}

/**
 * Create a default tab with welcome screen
 */
export function createDefaultTab(overrides?: Partial<AppTab>): AppTab {
  return {
    id: crypto.randomUUID(),
    title: 'New Tab',
    icon: '📄',

    // Default: show conversations
    sidebarView: 'conversations',
    sidebarCollapsed: false,
    selectedConversation: null,
    conversationTitle: undefined,

    // Default: welcome screen
    contentType: 'welcome',
    contentData: {},

    // Default: tool panel collapsed
    toolPanelCollapsed: true,
    selectedContent: null,
    transformationResult: null,
    selectedMedia: null,

    // Metadata
    createdAt: new Date(),
    lastAccessedAt: new Date(),
    isPinned: false,

    ...overrides,
  };
}

/**
 * Create tab from current app state
 */
export interface CurrentAppState {
  sidebarView: SidebarView;
  sidebarCollapsed: boolean;
  selectedConversation: string | null;
  selectedDocument?: string | null;
  conversationTitle?: string;
  documentTitle?: string;
  toolPanelCollapsed: boolean;
  selectedContent: SelectedContent | null;
  transformationResult: TransformationResult | null;
  selectedMedia: MediaItem | null;
}

export function createTabFromState(state: CurrentAppState, title?: string, icon?: string): Partial<AppTab> {
  // Determine content type based on what's being viewed
  let contentType: TabContentType = 'welcome';
  const contentData: AppTab['contentData'] = {};

  if (state.selectedConversation) {
    contentType = 'conversation';
    contentData.conversation = state.selectedConversation;
  } else if (state.selectedDocument) {
    // TODO: Add 'document' to TabContentType
    contentType = 'welcome'; // For now, use welcome
  } else if (state.transformationResult) {
    contentType = 'transformation';
    contentData.transformation = state.transformationResult;
  } else if (state.selectedMedia) {
    contentType = 'media';
    contentData.media = state.selectedMedia;
  }

  // Use conversation/document title if available
  const tabTitle = title || state.documentTitle || state.conversationTitle || 'New Tab';
  const tabIcon = icon || (state.selectedDocument ? '📄' : state.selectedConversation ? '💬' : '📄');

  return {
    title: tabTitle,
    icon: tabIcon,
    sidebarView: state.sidebarView,
    sidebarCollapsed: state.sidebarCollapsed,
    selectedConversation: state.selectedConversation,
    selectedDocument: state.selectedDocument,
    conversationTitle: state.conversationTitle,
    documentTitle: state.documentTitle,
    contentType,
    contentData,
    toolPanelCollapsed: state.toolPanelCollapsed,
    selectedContent: state.selectedContent,
    transformationResult: state.transformationResult,
    selectedMedia: state.selectedMedia,
  };
}
