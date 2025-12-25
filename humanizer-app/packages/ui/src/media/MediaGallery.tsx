/**
 * MediaGallery Component
 *
 * Unified gallery view for media from any source.
 */

import { useState, useCallback, type ReactNode } from 'react';
import type {
  MediaItem,
  MediaSource,
  MediaQueryParams,
  GalleryConfig,
  GalleryViewMode,
  DEFAULT_GALLERY_CONFIG,
} from './types';
import { MediaCard, MediaListItem } from './MediaCard';
import { Lightbox } from './Lightbox';

interface MediaGalleryProps {
  /** Media items to display */
  items: MediaItem[];

  /** Total count (for pagination display) */
  total: number;

  /** Whether there are more items to load */
  hasMore: boolean;

  /** Loading state */
  loading: boolean;

  /** Error message */
  error?: string | null;

  /** Current source filter */
  source?: MediaSource;

  /** Available sources */
  availableSources?: MediaSource[];

  /** Search query */
  searchQuery?: string;

  /** Called when source changes */
  onSourceChange?: (source: MediaSource) => void;

  /** Called when search changes */
  onSearchChange?: (query: string) => void;

  /** Called to load more items */
  onLoadMore?: () => void;

  /** Called when item is clicked (if not using internal lightbox) */
  onItemClick?: (item: MediaItem) => void;

  /** Use internal lightbox */
  useLightbox?: boolean;

  /** Gallery configuration */
  config?: Partial<GalleryConfig>;

  /** Custom header content */
  headerContent?: ReactNode;

  /** Additional className */
  className?: string;
}

const SOURCE_LABELS: Record<MediaSource, string> = {
  openai: 'OpenAI',
  facebook: 'Facebook',
  local: 'Local',
  upload: 'Uploads',
};

export function MediaGallery({
  items,
  total,
  hasMore,
  loading,
  error,
  source,
  availableSources = ['openai', 'facebook'],
  searchQuery = '',
  onSourceChange,
  onSearchChange,
  onLoadMore,
  onItemClick,
  useLightbox = true,
  config = {},
  headerContent,
  className = '',
}: MediaGalleryProps) {
  const {
    viewMode = 'grid',
    columns,
    showCaptions = true,
    showMetadataOnHover = true,
    lazyLoad = true,
    pageSize = 50,
  } = config;

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Handle item click
  const handleItemClick = useCallback(
    (item: MediaItem) => {
      if (onItemClick) {
        onItemClick(item);
      } else if (useLightbox) {
        const index = items.findIndex((i) => i.id === item.id);
        if (index >= 0) {
          setLightboxIndex(index);
          setLightboxOpen(true);
        }
      }
    },
    [items, onItemClick, useLightbox]
  );

  // Close lightbox
  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  // Navigate lightbox
  const navigateLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
  }, []);

  // Grid class with column count
  const gridClasses = [
    'media-grid',
    columns && `media-grid--cols-${columns}`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`media-gallery ${className}`}>
      {/* Header */}
      <div className="media-gallery__header">
        {/* Source toggle */}
        {availableSources.length > 1 && onSourceChange && (
          <div className="source-toggle">
            {availableSources.map((src) => (
              <button
                key={src}
                className={`source-toggle__btn ${source === src ? 'source-toggle__btn--active' : ''}`}
                onClick={() => onSourceChange(src)}
              >
                {SOURCE_LABELS[src]}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        {onSearchChange && (
          <div className="media-gallery__search">
            <span>🔍</span>
            <input
              type="text"
              className="media-gallery__search-input"
              placeholder="Search media..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        )}

        {/* Count */}
        <span className="media-gallery__count">
          {items.length.toLocaleString()} of {total.toLocaleString()}
        </span>

        {headerContent}
      </div>

      {/* Content */}
      <div className="media-gallery__content">
        {/* Error state */}
        {error && (
          <div className="media-gallery__empty">
            <div className="media-gallery__empty-icon">⚠️</div>
            <div className="media-gallery__empty-title">Error</div>
            <div className="media-gallery__empty-message">{error}</div>
          </div>
        )}

        {/* Empty state */}
        {!error && !loading && items.length === 0 && (
          <div className="media-gallery__empty">
            <div className="media-gallery__empty-icon">🖼️</div>
            <div className="media-gallery__empty-title">No media found</div>
            <div className="media-gallery__empty-message">
              {searchQuery
                ? 'Try a different search term'
                : 'Import an archive to see your media'}
            </div>
          </div>
        )}

        {/* Grid view */}
        {items.length > 0 && viewMode === 'grid' && (
          <div className={gridClasses}>
            {items.map((item) => (
              <MediaCard
                key={item.id}
                item={item}
                onClick={handleItemClick}
                showMetadataOnHover={showMetadataOnHover}
              />
            ))}
          </div>
        )}

        {/* List view */}
        {items.length > 0 && viewMode === 'list' && (
          <div className="media-list">
            {items.map((item) => (
              <MediaListItem
                key={item.id}
                item={item}
                onClick={handleItemClick}
              />
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && onLoadMore && (
          <div className="media-gallery__load-more">
            <button
              className="media-gallery__load-more-btn"
              onClick={onLoadMore}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}

        {/* Loading indicator */}
        {loading && items.length === 0 && (
          <div className="media-gallery__empty">
            <div className="media-gallery__empty-icon">⏳</div>
            <div className="media-gallery__empty-title">Loading...</div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {useLightbox && (
        <Lightbox
          isOpen={lightboxOpen}
          items={items}
          currentIndex={lightboxIndex}
          onClose={closeLightbox}
          onNavigate={navigateLightbox}
        />
      )}
    </div>
  );
}

export default MediaGallery;
