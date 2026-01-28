/**
 * MediaContext - Media and Transcription State Management
 *
 * Manages media items (images, audio, video) and their transcriptions:
 * - Media item collection with selection
 * - Transcription job tracking
 * - Gallery view settings
 * - Media player state
 *
 * @module @humanizer/studio/contexts/MediaContext
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Media item types */
export type MediaType = 'image' | 'audio' | 'video';

/** Gallery view modes */
export type ViewMode = 'grid' | 'list';

/** Gallery sort options */
export type SortBy = 'date' | 'name' | 'type' | 'size';

/** Media filter options */
export type FilterType = 'all' | 'image' | 'audio' | 'video';

/** Transcription job status */
export type TranscriptionStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** Transcription types */
export type TranscriptionType =
  | 'audio'       // Audio transcription (Whisper)
  | 'ocr'         // Image text extraction
  | 'caption'     // Brief description
  | 'description' // Detailed description
  | 'manual';     // Human-entered

/** Media item */
export interface MediaItem {
  id: string;
  archiveId: string;
  type: MediaType;
  filename: string;
  mimeType: string;
  size: number;
  duration?: number;               // seconds for audio/video
  dimensions?: {
    width: number;
    height: number;
  };
  thumbnailUrl?: string;
  sourceUrl: string;
  conversationId?: string;         // If associated with a conversation
  messageId?: string;              // If associated with a message
  createdAt: Date;

  // Transcription summary
  transcriptionCount: number;
  preferredTranscriptionId?: string;
  latestTranscriptionAt?: Date;
}

/** Transcription job tracking */
export interface TranscriptionJob {
  id: string;
  mediaId: string;
  type: TranscriptionType;
  status: TranscriptionStatus;
  progress?: number;               // 0-100 for processing
  modelId?: string;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

/** Media state */
export interface MediaState {
  // Media items (by ID)
  items: Map<string, MediaItem>;

  // Selection
  selectedIds: Set<string>;

  // Transcription jobs
  transcriptionJobs: Map<string, TranscriptionJob>;

  // Gallery settings
  viewMode: ViewMode;
  sortBy: SortBy;
  sortDirection: 'asc' | 'desc';
  filterType: FilterType;

  // Player state
  activeMediaId: string | null;
  isPlaying: boolean;
  currentTime: number;

  // Loading states
  isLoading: boolean;
  error: string | null;
}

/** Actions for state reducer */
type MediaAction =
  // Items
  | { type: 'SET_ITEMS'; items: MediaItem[] }
  | { type: 'ADD_ITEM'; item: MediaItem }
  | { type: 'UPDATE_ITEM'; id: string; updates: Partial<MediaItem> }
  | { type: 'REMOVE_ITEM'; id: string }
  | { type: 'CLEAR_ITEMS' }
  // Selection
  | { type: 'SELECT_ITEM'; id: string }
  | { type: 'DESELECT_ITEM'; id: string }
  | { type: 'TOGGLE_SELECTION'; id: string }
  | { type: 'SELECT_ALL' }
  | { type: 'DESELECT_ALL' }
  | { type: 'SELECT_RANGE'; fromId: string; toId: string }
  // Transcription jobs
  | { type: 'ADD_JOB'; job: TranscriptionJob }
  | { type: 'UPDATE_JOB'; id: string; updates: Partial<TranscriptionJob> }
  | { type: 'REMOVE_JOB'; id: string }
  // Gallery settings
  | { type: 'SET_VIEW_MODE'; mode: ViewMode }
  | { type: 'SET_SORT_BY'; sortBy: SortBy }
  | { type: 'TOGGLE_SORT_DIRECTION' }
  | { type: 'SET_FILTER_TYPE'; filterType: FilterType }
  // Player
  | { type: 'SET_ACTIVE_MEDIA'; id: string | null }
  | { type: 'SET_PLAYING'; isPlaying: boolean }
  | { type: 'SET_CURRENT_TIME'; time: number }
  // Loading
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_ERROR'; error: string | null };

/** Context value type */
export interface MediaContextValue {
  state: MediaState;

  // Item management
  setItems: (items: MediaItem[]) => void;
  addItem: (item: MediaItem) => void;
  updateItem: (id: string, updates: Partial<MediaItem>) => void;
  removeItem: (id: string) => void;
  clearItems: () => void;
  getItem: (id: string) => MediaItem | undefined;

  // Selection
  selectItem: (id: string) => void;
  deselectItem: (id: string) => void;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  selectRange: (fromId: string, toId: string) => void;
  isSelected: (id: string) => boolean;

  // Transcription jobs
  addJob: (job: TranscriptionJob) => void;
  updateJob: (id: string, updates: Partial<TranscriptionJob>) => void;
  removeJob: (id: string) => void;
  getJobsForMedia: (mediaId: string) => TranscriptionJob[];

  // Gallery settings
  setViewMode: (mode: ViewMode) => void;
  setSortBy: (sortBy: SortBy) => void;
  toggleSortDirection: () => void;
  setFilterType: (filterType: FilterType) => void;

  // Player
  setActiveMedia: (id: string | null) => void;
  setPlaying: (isPlaying: boolean) => void;
  setCurrentTime: (time: number) => void;
  playMedia: (id: string) => void;
  pauseMedia: () => void;

  // Computed values
  filteredItems: MediaItem[];
  sortedItems: MediaItem[];
  selectedItems: MediaItem[];
  selectedCount: number;

  // Loading
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Default state */
const defaultState: MediaState = {
  items: new Map(),
  selectedIds: new Set(),
  transcriptionJobs: new Map(),
  viewMode: 'grid',
  sortBy: 'date',
  sortDirection: 'desc',
  filterType: 'all',
  activeMediaId: null,
  isPlaying: false,
  currentTime: 0,
  isLoading: false,
  error: null,
};

// ═══════════════════════════════════════════════════════════════════════════
// REDUCER
// ═══════════════════════════════════════════════════════════════════════════

function mediaReducer(state: MediaState, action: MediaAction): MediaState {
  switch (action.type) {
    // Items
    case 'SET_ITEMS': {
      const items = new Map<string, MediaItem>();
      for (const item of action.items) {
        items.set(item.id, item);
      }
      return { ...state, items };
    }

    case 'ADD_ITEM': {
      const items = new Map(state.items);
      items.set(action.item.id, action.item);
      return { ...state, items };
    }

    case 'UPDATE_ITEM': {
      const existing = state.items.get(action.id);
      if (!existing) return state;
      const items = new Map(state.items);
      items.set(action.id, { ...existing, ...action.updates });
      return { ...state, items };
    }

    case 'REMOVE_ITEM': {
      const items = new Map(state.items);
      items.delete(action.id);
      const selectedIds = new Set(state.selectedIds);
      selectedIds.delete(action.id);
      return { ...state, items, selectedIds };
    }

    case 'CLEAR_ITEMS':
      return {
        ...state,
        items: new Map(),
        selectedIds: new Set(),
        activeMediaId: null,
      };

    // Selection
    case 'SELECT_ITEM': {
      const selectedIds = new Set(state.selectedIds);
      selectedIds.add(action.id);
      return { ...state, selectedIds };
    }

    case 'DESELECT_ITEM': {
      const selectedIds = new Set(state.selectedIds);
      selectedIds.delete(action.id);
      return { ...state, selectedIds };
    }

    case 'TOGGLE_SELECTION': {
      const selectedIds = new Set(state.selectedIds);
      if (selectedIds.has(action.id)) {
        selectedIds.delete(action.id);
      } else {
        selectedIds.add(action.id);
      }
      return { ...state, selectedIds };
    }

    case 'SELECT_ALL': {
      const selectedIds = new Set(state.items.keys());
      return { ...state, selectedIds };
    }

    case 'DESELECT_ALL':
      return { ...state, selectedIds: new Set() };

    case 'SELECT_RANGE': {
      const itemIds = Array.from(state.items.keys());
      const fromIndex = itemIds.indexOf(action.fromId);
      const toIndex = itemIds.indexOf(action.toId);
      if (fromIndex === -1 || toIndex === -1) return state;

      const start = Math.min(fromIndex, toIndex);
      const end = Math.max(fromIndex, toIndex);
      const selectedIds = new Set(state.selectedIds);

      for (let i = start; i <= end; i++) {
        selectedIds.add(itemIds[i]);
      }
      return { ...state, selectedIds };
    }

    // Transcription jobs
    case 'ADD_JOB': {
      const transcriptionJobs = new Map(state.transcriptionJobs);
      transcriptionJobs.set(action.job.id, action.job);
      return { ...state, transcriptionJobs };
    }

    case 'UPDATE_JOB': {
      const existing = state.transcriptionJobs.get(action.id);
      if (!existing) return state;
      const transcriptionJobs = new Map(state.transcriptionJobs);
      transcriptionJobs.set(action.id, { ...existing, ...action.updates });
      return { ...state, transcriptionJobs };
    }

    case 'REMOVE_JOB': {
      const transcriptionJobs = new Map(state.transcriptionJobs);
      transcriptionJobs.delete(action.id);
      return { ...state, transcriptionJobs };
    }

    // Gallery settings
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.mode };

    case 'SET_SORT_BY':
      return { ...state, sortBy: action.sortBy };

    case 'TOGGLE_SORT_DIRECTION':
      return {
        ...state,
        sortDirection: state.sortDirection === 'asc' ? 'desc' : 'asc',
      };

    case 'SET_FILTER_TYPE':
      return { ...state, filterType: action.filterType };

    // Player
    case 'SET_ACTIVE_MEDIA':
      return {
        ...state,
        activeMediaId: action.id,
        currentTime: 0,
        isPlaying: false,
      };

    case 'SET_PLAYING':
      return { ...state, isPlaying: action.isPlaying };

    case 'SET_CURRENT_TIME':
      return { ...state, currentTime: action.time };

    // Loading
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };

    case 'SET_ERROR':
      return { ...state, error: action.error };

    default:
      return state;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

const MediaContext = createContext<MediaContextValue | null>(null);

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

export interface MediaProviderProps {
  children: ReactNode;
}

export function MediaProvider({ children }: MediaProviderProps): React.ReactElement {
  const [state, dispatch] = useReducer(mediaReducer, defaultState);

  // Item management
  const setItems = useCallback((items: MediaItem[]) => {
    dispatch({ type: 'SET_ITEMS', items });
  }, []);

  const addItem = useCallback((item: MediaItem) => {
    dispatch({ type: 'ADD_ITEM', item });
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<MediaItem>) => {
    dispatch({ type: 'UPDATE_ITEM', id, updates });
  }, []);

  const removeItem = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_ITEM', id });
  }, []);

  const clearItems = useCallback(() => {
    dispatch({ type: 'CLEAR_ITEMS' });
  }, []);

  const getItem = useCallback(
    (id: string) => state.items.get(id),
    [state.items]
  );

  // Selection
  const selectItem = useCallback((id: string) => {
    dispatch({ type: 'SELECT_ITEM', id });
  }, []);

  const deselectItem = useCallback((id: string) => {
    dispatch({ type: 'DESELECT_ITEM', id });
  }, []);

  const toggleSelection = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_SELECTION', id });
  }, []);

  const selectAll = useCallback(() => {
    dispatch({ type: 'SELECT_ALL' });
  }, []);

  const deselectAll = useCallback(() => {
    dispatch({ type: 'DESELECT_ALL' });
  }, []);

  const selectRange = useCallback((fromId: string, toId: string) => {
    dispatch({ type: 'SELECT_RANGE', fromId, toId });
  }, []);

  const isSelected = useCallback(
    (id: string) => state.selectedIds.has(id),
    [state.selectedIds]
  );

  // Transcription jobs
  const addJob = useCallback((job: TranscriptionJob) => {
    dispatch({ type: 'ADD_JOB', job });
  }, []);

  const updateJob = useCallback((id: string, updates: Partial<TranscriptionJob>) => {
    dispatch({ type: 'UPDATE_JOB', id, updates });
  }, []);

  const removeJob = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_JOB', id });
  }, []);

  const getJobsForMedia = useCallback(
    (mediaId: string) =>
      Array.from(state.transcriptionJobs.values()).filter(
        (job) => job.mediaId === mediaId
      ),
    [state.transcriptionJobs]
  );

  // Gallery settings
  const setViewMode = useCallback((mode: ViewMode) => {
    dispatch({ type: 'SET_VIEW_MODE', mode });
  }, []);

  const setSortBy = useCallback((sortBy: SortBy) => {
    dispatch({ type: 'SET_SORT_BY', sortBy });
  }, []);

  const toggleSortDirection = useCallback(() => {
    dispatch({ type: 'TOGGLE_SORT_DIRECTION' });
  }, []);

  const setFilterType = useCallback((filterType: FilterType) => {
    dispatch({ type: 'SET_FILTER_TYPE', filterType });
  }, []);

  // Player
  const setActiveMedia = useCallback((id: string | null) => {
    dispatch({ type: 'SET_ACTIVE_MEDIA', id });
  }, []);

  const setPlaying = useCallback((isPlaying: boolean) => {
    dispatch({ type: 'SET_PLAYING', isPlaying });
  }, []);

  const setCurrentTime = useCallback((time: number) => {
    dispatch({ type: 'SET_CURRENT_TIME', time });
  }, []);

  const playMedia = useCallback((id: string) => {
    dispatch({ type: 'SET_ACTIVE_MEDIA', id });
    dispatch({ type: 'SET_PLAYING', isPlaying: true });
  }, []);

  const pauseMedia = useCallback(() => {
    dispatch({ type: 'SET_PLAYING', isPlaying: false });
  }, []);

  // Loading
  const setLoading = useCallback((isLoading: boolean) => {
    dispatch({ type: 'SET_LOADING', isLoading });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', error });
  }, []);

  // Computed values
  const filteredItems = useMemo(() => {
    const items = Array.from(state.items.values());
    if (state.filterType === 'all') return items;
    return items.filter((item) => item.type === state.filterType);
  }, [state.items, state.filterType]);

  const sortedItems = useMemo(() => {
    const items = [...filteredItems];
    const direction = state.sortDirection === 'asc' ? 1 : -1;

    items.sort((a, b) => {
      switch (state.sortBy) {
        case 'date':
          return direction * (a.createdAt.getTime() - b.createdAt.getTime());
        case 'name':
          return direction * a.filename.localeCompare(b.filename);
        case 'type':
          return direction * a.type.localeCompare(b.type);
        case 'size':
          return direction * (a.size - b.size);
        default:
          return 0;
      }
    });

    return items;
  }, [filteredItems, state.sortBy, state.sortDirection]);

  const selectedItems = useMemo(
    () =>
      Array.from(state.selectedIds)
        .map((id) => state.items.get(id))
        .filter((item): item is MediaItem => item !== undefined),
    [state.items, state.selectedIds]
  );

  const selectedCount = state.selectedIds.size;

  // Memoize context value
  const value = useMemo<MediaContextValue>(
    () => ({
      state,
      setItems,
      addItem,
      updateItem,
      removeItem,
      clearItems,
      getItem,
      selectItem,
      deselectItem,
      toggleSelection,
      selectAll,
      deselectAll,
      selectRange,
      isSelected,
      addJob,
      updateJob,
      removeJob,
      getJobsForMedia,
      setViewMode,
      setSortBy,
      toggleSortDirection,
      setFilterType,
      setActiveMedia,
      setPlaying,
      setCurrentTime,
      playMedia,
      pauseMedia,
      filteredItems,
      sortedItems,
      selectedItems,
      selectedCount,
      setLoading,
      setError,
    }),
    [
      state,
      setItems,
      addItem,
      updateItem,
      removeItem,
      clearItems,
      getItem,
      selectItem,
      deselectItem,
      toggleSelection,
      selectAll,
      deselectAll,
      selectRange,
      isSelected,
      addJob,
      updateJob,
      removeJob,
      getJobsForMedia,
      setViewMode,
      setSortBy,
      toggleSortDirection,
      setFilterType,
      setActiveMedia,
      setPlaying,
      setCurrentTime,
      playMedia,
      pauseMedia,
      filteredItems,
      sortedItems,
      selectedItems,
      selectedCount,
      setLoading,
      setError,
    ]
  );

  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════

/** Use media context - throws if used outside provider */
export function useMedia(): MediaContextValue {
  const context = useContext(MediaContext);
  if (!context) {
    throw new Error('useMedia must be used within a MediaProvider');
  }
  return context;
}

/** Use only media state (for components that don't need actions) */
export function useMediaState(): MediaState {
  const { state } = useMedia();
  return state;
}

/** Use media selection state */
export function useMediaSelection() {
  const {
    state,
    selectItem,
    deselectItem,
    toggleSelection,
    selectAll,
    deselectAll,
    selectRange,
    isSelected,
    selectedItems,
    selectedCount,
  } = useMedia();

  return {
    selectedIds: state.selectedIds,
    selectItem,
    deselectItem,
    toggleSelection,
    selectAll,
    deselectAll,
    selectRange,
    isSelected,
    selectedItems,
    selectedCount,
  };
}

/** Use media player state */
export function useMediaPlayer() {
  const {
    state,
    setActiveMedia,
    setPlaying,
    setCurrentTime,
    playMedia,
    pauseMedia,
    getItem,
  } = useMedia();

  const activeItem = state.activeMediaId ? getItem(state.activeMediaId) : null;

  return {
    activeMediaId: state.activeMediaId,
    activeItem,
    isPlaying: state.isPlaying,
    currentTime: state.currentTime,
    setActiveMedia,
    setPlaying,
    setCurrentTime,
    playMedia,
    pauseMedia,
  };
}

/** Use gallery settings */
export function useGallerySettings() {
  const {
    state,
    setViewMode,
    setSortBy,
    toggleSortDirection,
    setFilterType,
    sortedItems,
  } = useMedia();

  return {
    viewMode: state.viewMode,
    sortBy: state.sortBy,
    sortDirection: state.sortDirection,
    filterType: state.filterType,
    setViewMode,
    setSortBy,
    toggleSortDirection,
    setFilterType,
    items: sortedItems,
  };
}

export default MediaContext;
