/**
 * MediaGallery - Media Grid/List View
 *
 * Displays media items in a grid or list layout with:
 * - Grid/list view toggle
 * - Sorting and filtering
 * - Multi-select with checkboxes
 * - Keyboard navigation
 * - Empty state handling
 *
 * @module @humanizer/studio/components/media/MediaGallery
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useMedia,
  useMediaSelection,
  useGallerySettings,
  type MediaItem,
  type ViewMode,
  type SortBy,
  type FilterType,
} from '../../contexts/MediaContext';
import { MediaThumbnail } from './MediaThumbnail';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface MediaGalleryProps {
  /** Archive ID for context */
  archiveId?: string;
  /** Called when a media item is opened */
  onOpenMedia?: (item: MediaItem) => void;
  /** Called when transcription is requested */
  onRequestTranscription?: (item: MediaItem) => void;
  /** Optional class name */
  className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'date', label: 'Date' },
  { value: 'name', label: 'Name' },
  { value: 'type', label: 'Type' },
  { value: 'size', label: 'Size' },
];

const FILTER_OPTIONS: { value: FilterType; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: '📁' },
  { value: 'image', label: 'Images', icon: '🖼️' },
  { value: 'audio', label: 'Audio', icon: '🎵' },
  { value: 'video', label: 'Video', icon: '🎬' },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function MediaGallery({
  archiveId,
  onOpenMedia,
  onRequestTranscription,
  className = '',
}: MediaGalleryProps): React.ReactElement {
  // Context
  const { state, playMedia } = useMedia();
  const {
    selectedIds,
    selectItem,
    deselectItem,
    toggleSelection,
    selectAll,
    deselectAll,
    selectRange,
    isSelected,
    selectedCount,
  } = useMediaSelection();
  const {
    viewMode,
    sortBy,
    sortDirection,
    filterType,
    setViewMode,
    setSortBy,
    toggleSortDirection,
    setFilterType,
    items,
  } = useGallerySettings();

  // Local state
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);

  // Refs
  const gridRef = useRef<HTMLDivElement>(null);

  // Calculate grid columns for keyboard navigation
  const [gridColumns, setGridColumns] = useState(4);

  useEffect(() => {
    const updateColumns = () => {
      if (gridRef.current && viewMode === 'grid') {
        const gridWidth = gridRef.current.clientWidth;
        const thumbSize = 120 + 8; // --gallery-thumb-size + gap
        setGridColumns(Math.max(1, Math.floor(gridWidth / thumbSize)));
      } else {
        setGridColumns(1);
      }
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, [viewMode]);

  // Handle item click
  const handleItemClick = useCallback(
    (item: MediaItem) => {
      onOpenMedia?.(item);
    },
    [onOpenMedia]
  );

  // Handle selection toggle
  const handleToggleSelect = useCallback(
    (item: MediaItem) => {
      const itemIndex = items.findIndex((i) => i.id === item.id);

      // Shift+click for range select
      if (lastSelectedIndex !== null && itemIndex !== lastSelectedIndex) {
        const fromId = items[lastSelectedIndex].id;
        const toId = item.id;
        selectRange(fromId, toId);
      } else {
        toggleSelection(item.id);
      }

      setLastSelectedIndex(itemIndex);
      setSelectionMode(true);
    },
    [items, lastSelectedIndex, selectRange, toggleSelection]
  );

  // Handle play
  const handlePlay = useCallback(
    (item: MediaItem) => {
      playMedia(item.id);
      onOpenMedia?.(item);
    },
    [playMedia, onOpenMedia]
  );

  // Handle transcribe
  const handleTranscribe = useCallback(
    (item: MediaItem) => {
      onRequestTranscription?.(item);
    },
    [onRequestTranscription]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (items.length === 0) return;

      let newIndex = focusedIndex;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          newIndex = Math.min(focusedIndex + 1, items.length - 1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          newIndex = Math.max(focusedIndex - 1, 0);
          break;
        case 'ArrowDown':
          e.preventDefault();
          newIndex = Math.min(focusedIndex + gridColumns, items.length - 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          newIndex = Math.max(focusedIndex - gridColumns, 0);
          break;
        case 'Home':
          e.preventDefault();
          newIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          newIndex = items.length - 1;
          break;
        case 'Enter':
          e.preventDefault();
          onOpenMedia?.(items[focusedIndex]);
          return;
        case ' ':
          e.preventDefault();
          toggleSelection(items[focusedIndex].id);
          setSelectionMode(true);
          return;
        case 'a':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            selectAll();
            setSelectionMode(true);
          }
          return;
        case 'Escape':
          deselectAll();
          setSelectionMode(false);
          return;
        default:
          return;
      }

      setFocusedIndex(newIndex);

      // Shift+Arrow for range selection
      if (e.shiftKey) {
        const fromId = items[focusedIndex].id;
        const toId = items[newIndex].id;
        selectRange(fromId, toId);
        setSelectionMode(true);
      }

      // Focus the element
      const gridElement = gridRef.current;
      if (gridElement) {
        const focusableElements = gridElement.querySelectorAll('[tabindex="0"]');
        (focusableElements[newIndex] as HTMLElement)?.focus();
      }
    },
    [
      focusedIndex,
      gridColumns,
      items,
      onOpenMedia,
      toggleSelection,
      selectAll,
      deselectAll,
      selectRange,
    ]
  );

  // Clear selection mode when selection is empty
  useEffect(() => {
    if (selectedCount === 0) {
      setSelectionMode(false);
    }
  }, [selectedCount]);

  return (
    <div className={`media-gallery-container ${className}`}>
      {/* Toolbar */}
      <div className="media-gallery__toolbar">
        {/* Selection Info */}
        {selectedCount > 0 && (
          <div className="media-gallery__selection-info">
            <span>{selectedCount} selected</span>
            <button
              className="media-gallery__clear-selection"
              onClick={deselectAll}
              aria-label="Clear selection"
            >
              ×
            </button>
          </div>
        )}

        {/* Filter Buttons */}
        <div className="media-gallery__filters" role="group" aria-label="Filter by type">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`media-gallery__filter ${filterType === option.value ? 'media-gallery__filter--active' : ''}`}
              onClick={() => setFilterType(option.value)}
              aria-pressed={filterType === option.value}
            >
              <span aria-hidden="true">{option.icon}</span>
              <span className="media-gallery__filter-label">{option.label}</span>
            </button>
          ))}
        </div>

        {/* Sort & View Controls */}
        <div className="media-gallery__controls">
          {/* Sort Dropdown */}
          <div className="media-gallery__sort">
            <label htmlFor="sort-select" className="visually-hidden">
              Sort by
            </label>
            <select
              id="sort-select"
              className="media-gallery__sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              className="media-gallery__sort-direction"
              onClick={toggleSortDirection}
              aria-label={`Sort ${sortDirection === 'asc' ? 'ascending' : 'descending'}`}
            >
              {sortDirection === 'asc' ? '↑' : '↓'}
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="media-gallery__view-toggle" role="group" aria-label="View mode">
            <button
              className={`media-gallery__view-btn ${viewMode === 'grid' ? 'media-gallery__view-btn--active' : ''}`}
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              aria-label="Grid view"
            >
              ⊞
            </button>
            <button
              className={`media-gallery__view-btn ${viewMode === 'list' ? 'media-gallery__view-btn--active' : ''}`}
              onClick={() => setViewMode('list')}
              aria-pressed={viewMode === 'list'}
              aria-label="List view"
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      {/* Gallery Grid/List */}
      {items.length > 0 ? (
        <div
          ref={gridRef}
          className={`media-gallery media-gallery--${viewMode}`}
          role="grid"
          aria-label="Media gallery"
          onKeyDown={handleKeyDown}
        >
          {items.map((item, index) => (
            <MediaThumbnail
              key={item.id}
              item={item}
              isSelected={isSelected(item.id)}
              selectionMode={selectionMode}
              onClick={handleItemClick}
              onToggleSelect={handleToggleSelect}
              onPlay={handlePlay}
              onTranscribe={handleTranscribe}
            />
          ))}
        </div>
      ) : (
        <div className="media-gallery__empty">
          <span aria-hidden="true">📷</span>
          <p>No media items</p>
          <p className="media-gallery__empty-hint">
            {filterType !== 'all'
              ? `No ${filterType} files found. Try changing the filter.`
              : 'Import an archive to see media here.'}
          </p>
        </div>
      )}

      {/* Item Count */}
      <div className="media-gallery__footer">
        <span className="media-gallery__count">
          {items.length} item{items.length !== 1 ? 's' : ''}
          {state.isLoading && ' • Loading...'}
        </span>
      </div>
    </div>
  );
}

export default MediaGallery;
