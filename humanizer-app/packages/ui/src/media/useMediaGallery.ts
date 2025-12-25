/**
 * useMediaGallery Hook
 *
 * Manages media gallery state with fetching, filtering, and pagination.
 */

import { useState, useCallback, useEffect } from 'react';
import type {
  MediaItem,
  MediaSource,
  MediaQueryParams,
  MediaGalleryResponse,
} from './types';

interface UseMediaGalleryOptions {
  /** API endpoint base URL */
  apiBaseUrl: string;

  /** Initial source */
  initialSource?: MediaSource;

  /** Items per page */
  pageSize?: number;

  /** Debounce delay for search (ms) */
  searchDebounce?: number;

  /** Auto-load on mount */
  autoLoad?: boolean;
}

interface UseMediaGalleryState {
  items: MediaItem[];
  total: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  source: MediaSource;
  searchQuery: string;
}

interface UseMediaGalleryReturn extends UseMediaGalleryState {
  setSource: (source: MediaSource) => void;
  setSearchQuery: (query: string) => void;
  loadMore: () => void;
  refresh: () => void;
}

/**
 * Adapter to convert legacy GalleryImage to unified MediaItem
 */
function adaptLegacyImage(img: {
  url: string;
  filename: string;
  conversationFolder: string;
  conversationTitle: string;
  conversationCreatedAt: number | null;
  messageIndex: number;
  width?: number;
  height?: number;
  sizeBytes?: number;
}, source: MediaSource): MediaItem {
  return {
    id: `${source}-${img.conversationFolder}-${img.filename}`,
    url: img.url,
    filename: img.filename,
    type: 'image',
    source,
    width: img.width,
    height: img.height,
    sizeBytes: img.sizeBytes,
    createdAt: img.conversationCreatedAt || undefined,
    context: {
      containerId: img.conversationFolder,
      containerTitle: img.conversationTitle,
      index: img.messageIndex,
    },
  };
}

export function useMediaGallery(options: UseMediaGalleryOptions): UseMediaGalleryReturn {
  const {
    apiBaseUrl,
    initialSource = 'openai',
    pageSize = 50,
    searchDebounce = 300,
    autoLoad = true,
  } = options;

  const [state, setState] = useState<UseMediaGalleryState>({
    items: [],
    total: 0,
    hasMore: false,
    loading: false,
    error: null,
    source: initialSource,
    searchQuery: '',
  });

  // Fetch media from API
  const fetchMedia = useCallback(
    async (append = false) => {
      setState((prev) => ({
        ...prev,
        loading: true,
        error: null,
      }));

      try {
        const offset = append ? state.items.length : 0;
        const params = new URLSearchParams({
          limit: pageSize.toString(),
          offset: offset.toString(),
        });

        if (state.searchQuery) {
          params.set('search', state.searchQuery);
        }

        // Build endpoint based on source
        let endpoint = `${apiBaseUrl}/api/gallery`;
        if (state.source === 'facebook') {
          endpoint = `${apiBaseUrl}/api/facebook/gallery`;
        }

        const response = await fetch(`${endpoint}?${params}`);

        if (!response.ok) {
          throw new Error('Failed to load media');
        }

        const data = await response.json();

        // Adapt legacy format to unified format
        const newItems: MediaItem[] = data.images.map((img: any) =>
          adaptLegacyImage(img, state.source)
        );

        setState((prev) => ({
          ...prev,
          items: append ? [...prev.items, ...newItems] : newItems,
          total: data.total,
          hasMore: data.hasMore,
          loading: false,
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load media',
          items: append ? prev.items : [],
        }));
      }
    },
    [apiBaseUrl, pageSize, state.source, state.searchQuery, state.items.length]
  );

  // Set source
  const setSource = useCallback((source: MediaSource) => {
    setState((prev) => ({
      ...prev,
      source,
      items: [],
      total: 0,
      hasMore: false,
    }));
  }, []);

  // Set search query
  const setSearchQuery = useCallback((query: string) => {
    setState((prev) => ({
      ...prev,
      searchQuery: query,
    }));
  }, []);

  // Load more
  const loadMore = useCallback(() => {
    if (!state.loading && state.hasMore) {
      fetchMedia(true);
    }
  }, [fetchMedia, state.loading, state.hasMore]);

  // Refresh
  const refresh = useCallback(() => {
    fetchMedia(false);
  }, [fetchMedia]);

  // Auto-load on mount and when source/search changes
  useEffect(() => {
    if (autoLoad) {
      const timer = setTimeout(() => {
        fetchMedia(false);
      }, state.searchQuery ? searchDebounce : 0);

      return () => clearTimeout(timer);
    }
  }, [state.source, state.searchQuery, autoLoad, searchDebounce]);

  return {
    ...state,
    setSource,
    setSearchQuery,
    loadMore,
    refresh,
  };
}

export default useMediaGallery;
