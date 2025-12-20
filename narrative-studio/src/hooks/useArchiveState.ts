/**
 * useArchiveState - Centralized state management for Archive Panel
 *
 * Handles:
 * - View mode switching
 * - Search state (conversations, messages, gallery)
 * - Filter state with tag categorization
 * - Sort direction
 * - Recent searches with localStorage persistence
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ConversationMetadata } from '../types';

// Types
export type ViewMode =
  | 'conversations'
  | 'messages'
  | 'gallery'
  | 'imports'
  | 'explore'
  | 'facebook'
  | 'books'
  | 'thisbook'
  | 'workspaces'
  | 'gutenberg'
  | 'paste';

export type FilterCategory = 'date' | 'size' | 'media';

export interface ActiveFilters {
  date?: string;
  size?: string;
  media?: string;
}

export interface ArchivePersistedState {
  conversationSearch: string;
  messageSearch: string;
  activeFilters: ActiveFilters;
  recentSearches: string[];
  sortDirection: 'ascending' | 'descending';
}

export interface UseArchiveStateOptions {
  defaultViewMode?: ViewMode;
  localArchivesEnabled?: boolean;
}

const STORAGE_KEY = 'archive-panel-state';
const MAX_RECENT_SEARCHES = 10;

export function useArchiveState(options: UseArchiveStateOptions = {}) {
  const { defaultViewMode = 'conversations', localArchivesEnabled = true } = options;

  // Core state
  const [viewMode, setViewModeInternal] = useState<ViewMode>(
    localArchivesEnabled ? defaultViewMode : 'gutenberg'
  );
  const [conversationSearch, setConversationSearch] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [gallerySearch, setGallerySearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({});
  const [showingCategory, setShowingCategory] = useState<FilterCategory | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const [sortDirection, setSortDirection] = useState<'ascending' | 'descending'>('descending');

  // Computed: current search based on view mode
  const currentSearchQuery = useMemo(() => {
    if (viewMode === 'messages') return messageSearch;
    if (viewMode === 'gallery') return gallerySearch;
    return conversationSearch;
  }, [viewMode, conversationSearch, messageSearch, gallerySearch]);

  // Computed: has active filters
  const hasActiveFilters = Object.keys(activeFilters).length > 0;

  // Load persisted state on mount
  useEffect(() => {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      try {
        const state: ArchivePersistedState = JSON.parse(savedState);
        setConversationSearch(state.conversationSearch || '');
        setMessageSearch(state.messageSearch || '');
        setActiveFilters(state.activeFilters || {});
        setRecentSearches(state.recentSearches || []);
        setSortDirection(state.sortDirection || 'descending');
      } catch (err) {
        console.error('Failed to restore archive state:', err);
      }
    }
  }, []);

  // Persist state changes
  useEffect(() => {
    const state: ArchivePersistedState = {
      conversationSearch,
      messageSearch,
      activeFilters,
      recentSearches,
      sortDirection,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [conversationSearch, messageSearch, activeFilters, recentSearches, sortDirection]);

  // View mode setter with side effects
  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeInternal(mode);
    // Reset filter dropdown when changing views
    setShowingCategory(null);
  }, []);

  // Search handlers
  const handleSearchChange = useCallback((value: string) => {
    if (viewMode === 'messages') {
      setMessageSearch(value);
    } else if (viewMode === 'gallery') {
      setGallerySearch(value);
    } else {
      setConversationSearch(value);
    }
  }, [viewMode]);

  const clearSearch = useCallback(() => {
    handleSearchChange('');
  }, [handleSearchChange]);

  // Save current search to recent searches
  const saveCurrentSearch = useCallback(() => {
    const query = currentSearchQuery.trim();
    if (!query) return;

    setRecentSearches(prev => {
      const filtered = prev.filter(s => s !== query);
      return [query, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    });
  }, [currentSearchQuery]);

  const selectRecentSearch = useCallback((search: string) => {
    handleSearchChange(search);
    setShowRecentSearches(false);
  }, [handleSearchChange]);

  // Filter handlers
  const selectFilter = useCallback((category: FilterCategory, tag: string) => {
    setActiveFilters(prev => ({ ...prev, [category]: tag }));
    setShowingCategory(null);
  }, []);

  const removeFilter = useCallback((category: FilterCategory) => {
    setActiveFilters(prev => {
      const next = { ...prev };
      delete next[category];
      return next;
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setActiveFilters({});
    setShowingCategory(null);
  }, []);

  const toggleSortDirection = useCallback(() => {
    setSortDirection(prev => prev === 'descending' ? 'ascending' : 'descending');
  }, []);

  // Tag categorization from conversations
  const categorizeConversationTags = useCallback((conversations: ConversationMetadata[]) => {
    const allTags = conversations.flatMap(c => c.tags || []);
    const tagCounts = new Map<string, number>();
    allTags.forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });

    const categorized = {
      date: [] as string[],
      size: [] as string[],
      media: [] as string[],
    };

    tagCounts.forEach((count, tag) => {
      if (/\d{4}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Q[1-4]/i.test(tag)) {
        categorized.date.push(tag);
      } else if (/long|short|medium|quick|extended/i.test(tag)) {
        categorized.size.push(tag);
      } else if (/image|video|audio|media|dalle|gpt-4o/i.test(tag)) {
        categorized.media.push(tag);
      }
    });

    // Sort by relevance
    categorized.date.sort((a, b) => b.localeCompare(a)); // Newest first
    categorized.size.sort();
    categorized.media.sort();

    return categorized;
  }, []);

  // Filter conversations
  const filterConversations = useCallback((
    conversations: ConversationMetadata[],
    search: string,
    filters: ActiveFilters,
    sort: 'ascending' | 'descending'
  ) => {
    let filtered = [...conversations];

    // Apply search
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(conv =>
        conv.title.toLowerCase().includes(searchLower) ||
        conv.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Apply filters
    if (filters.date) {
      filtered = filtered.filter(conv => conv.tags?.includes(filters.date!));
    }
    if (filters.size) {
      filtered = filtered.filter(conv => conv.tags?.includes(filters.size!));
    }
    if (filters.media) {
      filtered = filtered.filter(conv => conv.tags?.includes(filters.media!));
    }

    // Sort
    filtered.sort((a, b) => {
      const aTime = a.created_at || 0;
      const bTime = b.created_at || 0;
      return sort === 'descending' ? bTime - aTime : aTime - bTime;
    });

    return filtered;
  }, []);

  return {
    // View mode
    viewMode,
    setViewMode,

    // Search
    conversationSearch,
    messageSearch,
    setMessageSearch,
    gallerySearch,
    currentSearchQuery,
    handleSearchChange,
    clearSearch,
    saveCurrentSearch,
    recentSearches,
    showRecentSearches,
    setShowRecentSearches,
    selectRecentSearch,

    // Filters
    activeFilters,
    hasActiveFilters,
    showingCategory,
    setShowingCategory,
    selectFilter,
    removeFilter,
    clearAllFilters,
    categorizeConversationTags,
    filterConversations,

    // Sort
    sortDirection,
    toggleSortDirection,
  };
}
