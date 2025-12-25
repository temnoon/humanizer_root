/**
 * Facebook View - Social archive with feed and media gallery
 *
 * Features:
 * - Feed view: posts and comments with filters
 * - Media gallery: thumbnail grid with size control
 * - Selection: click media to open in main workspace
 * - Two-way linking: click media to see related posts, click posts to see media
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SelectedFacebookMedia } from './types';

const ARCHIVE_SERVER = 'http://localhost:3002';
const ITEMS_PER_PAGE = 50;

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface FacebookPeriod {
  period: string;
  count: number;
  start_date: number;
  end_date: number;
  quarter: number;
  year: number;
}

interface FacebookContentItem {
  id: string;
  type: 'post' | 'comment';
  source: 'facebook';
  text: string;
  title?: string;
  created_at: number;
  author_name?: string;
  is_own_content: boolean;
  file_path?: string;
  media_refs?: string;
  context?: string;
  metadata?: string;
}

interface MediaItem {
  id: string;
  source_type: string;
  media_type: string;
  file_path: string;
  filename: string;
  file_size: number;
  width?: number;
  height?: number;
  created_at: number;
  description?: string;
  context?: string;
  related_post_id?: string;
  album_name?: string;
}

interface MediaStats {
  total: number;
  totalSizeBytes: number;
  bySourceType?: Record<string, number>;
  byMediaType?: Record<string, number>;
}

interface MediaContext {
  posts: Array<{
    id: string;
    text: string;
    created_at: number;
    type: string;
  }>;
  albums: Array<{
    name: string;
    photo_count: number;
  }>;
}

type ViewMode = 'feed' | 'gallery';
type FilterType = 'all' | 'post' | 'comment' | 'media';

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

interface FacebookViewProps {
  /** Callback when a media item is selected for display in main workspace */
  onSelectMedia?: (media: SelectedFacebookMedia) => void;
}

export function FacebookView({ onSelectMedia }: FacebookViewProps) {
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return (localStorage.getItem('fb_view_mode') as ViewMode) || 'feed';
    } catch { return 'feed'; }
  });

  // Feed state
  const [items, setItems] = useState<FacebookContentItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedOffset, setFeedOffset] = useState(0);
  const [feedHasMore, setFeedHasMore] = useState(true);
  const [feedTotal, setFeedTotal] = useState(0);

  // Filters
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [ownContentOnly, setOwnContentOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Periods
  const [periods, setPeriods] = useState<FacebookPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);

  // Media gallery state
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaOffset, setMediaOffset] = useState(0);
  const [mediaHasMore, setMediaHasMore] = useState(true);
  const [mediaStats, setMediaStats] = useState<MediaStats | null>(null);
  const [thumbnailSize, setThumbnailSize] = useState(90);

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxZoomed, setLightboxZoomed] = useState(false);
  const [mediaContext, setMediaContext] = useState<MediaContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);

  // Selected item for main display
  const [selectedItem, setSelectedItem] = useState<FacebookContentItem | MediaItem | null>(null);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Refs
  const feedObserverRef = useRef<HTMLDivElement>(null);
  const mediaObserverRef = useRef<HTMLDivElement>(null);

  // ═══════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════

  // Load periods on mount
  useEffect(() => {
    loadPeriods();
    loadMediaStats();
  }, []);

  // Save view mode
  useEffect(() => {
    try {
      localStorage.setItem('fb_view_mode', viewMode);
    } catch {}
  }, [viewMode]);

  const loadPeriods = async () => {
    try {
      const res = await fetch(`${ARCHIVE_SERVER}/api/facebook/periods`);
      if (res.ok) {
        const data = await res.json();
        setPeriods(data.periods || []);
      }
    } catch (err) {
      console.error('Failed to load periods:', err);
    }
  };

  const loadMediaStats = async () => {
    try {
      const res = await fetch(`${ARCHIVE_SERVER}/api/facebook/media-stats`);
      if (res.ok) {
        const data = await res.json();
        setMediaStats(data);
      }
    } catch (err) {
      console.error('Failed to load media stats:', err);
    }
  };

  // Load feed items
  const loadFeedItems = useCallback(async (reset = false) => {
    if (feedLoading) return;
    setFeedLoading(true);
    setError(null);

    try {
      const currentOffset = reset ? 0 : feedOffset;
      const params = new URLSearchParams({
        source: 'facebook',
        limit: ITEMS_PER_PAGE.toString(),
        offset: currentOffset.toString(),
      });

      if (filterType !== 'all' && filterType !== 'media') {
        params.append('type', filterType);
      }
      if (selectedPeriod) {
        params.append('period', selectedPeriod);
      }

      const res = await fetch(`${ARCHIVE_SERVER}/api/content/items?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      let filteredItems = data.items || [];

      // Client-side filters
      if (filterType === 'media') {
        filteredItems = filteredItems.filter((item: FacebookContentItem) => {
          try {
            const refs = item.media_refs ? JSON.parse(item.media_refs) : [];
            return refs.length > 0;
          } catch { return false; }
        });
      }
      if (ownContentOnly) {
        filteredItems = filteredItems.filter((item: FacebookContentItem) => item.is_own_content);
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filteredItems = filteredItems.filter((item: FacebookContentItem) =>
          item.text?.toLowerCase().includes(q) || item.title?.toLowerCase().includes(q)
        );
      }

      if (reset) {
        setItems(filteredItems);
        setFeedOffset(ITEMS_PER_PAGE);
      } else {
        setItems(prev => [...prev, ...filteredItems]);
        setFeedOffset(prev => prev + ITEMS_PER_PAGE);
      }

      setFeedTotal(data.total || 0);
      setFeedHasMore(filteredItems.length === ITEMS_PER_PAGE);
    } catch (err) {
      console.error('Failed to load feed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load feed');
    } finally {
      setFeedLoading(false);
    }
  }, [feedOffset, feedLoading, filterType, selectedPeriod, ownContentOnly, searchQuery]);

  // Load media items
  const loadMediaItems = useCallback(async (reset = false) => {
    if (mediaLoading) return;
    setMediaLoading(true);

    try {
      const currentOffset = reset ? 0 : mediaOffset;
      const params = new URLSearchParams({
        limit: '100',
        offset: currentOffset.toString(),
      });

      if (selectedPeriod) {
        params.append('period', selectedPeriod);
      }

      const res = await fetch(`${ARCHIVE_SERVER}/api/facebook/media-gallery?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      if (reset) {
        setMedia(data.items || []);
        setMediaOffset(100);
      } else {
        setMedia(prev => [...prev, ...(data.items || [])]);
        setMediaOffset(prev => prev + 100);
      }

      setMediaHasMore(data.hasMore ?? false);
    } catch (err) {
      console.error('Failed to load media:', err);
    } finally {
      setMediaLoading(false);
    }
  }, [mediaOffset, mediaLoading, selectedPeriod]);

  // Load media context (related posts/albums)
  const loadMediaContext = async (mediaId: string) => {
    setLoadingContext(true);
    setMediaContext(null);

    try {
      const res = await fetch(`${ARCHIVE_SERVER}/api/facebook/media/${mediaId}/context`);
      if (res.ok) {
        const data = await res.json();
        // Transform API response to expected format
        const posts = data.contentItems || [];
        const albums: Array<{ name: string; photo_count: number }> = [];

        // Extract album info from media context if available
        if (data.media?.context) {
          try {
            const ctx = typeof data.media.context === 'string'
              ? JSON.parse(data.media.context)
              : data.media.context;
            if (ctx.album) {
              albums.push({ name: ctx.album, photo_count: 0 });
            }
          } catch {
            // Ignore parse errors
          }
        }

        setMediaContext({ posts, albums });
      }
    } catch (err) {
      console.error('Failed to load media context:', err);
    } finally {
      setLoadingContext(false);
    }
  };

  // Reload feed when filters change
  useEffect(() => {
    if (viewMode === 'feed') {
      setItems([]);
      setFeedOffset(0);
      setFeedHasMore(true);
      loadFeedItems(true);
    }
  }, [filterType, selectedPeriod, ownContentOnly]);

  // Reload media when period changes
  useEffect(() => {
    if (viewMode === 'gallery') {
      setMedia([]);
      setMediaOffset(0);
      setMediaHasMore(true);
      loadMediaItems(true);
    }
  }, [selectedPeriod, viewMode]);

  // Infinite scroll for feed
  useEffect(() => {
    if (viewMode !== 'feed') return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && feedHasMore && !feedLoading) {
          loadFeedItems();
        }
      },
      { threshold: 0.1 }
    );

    const target = feedObserverRef.current;
    if (target) observer.observe(target);
    return () => { if (target) observer.unobserve(target); };
  }, [feedHasMore, feedLoading, viewMode, loadFeedItems]);

  // Infinite scroll for media
  useEffect(() => {
    if (viewMode !== 'gallery') return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && mediaHasMore && !mediaLoading) {
          loadMediaItems();
        }
      },
      { threshold: 0.1 }
    );

    const target = mediaObserverRef.current;
    if (target) observer.observe(target);
    return () => { if (target) observer.unobserve(target); };
  }, [mediaHasMore, mediaLoading, viewMode, loadMediaItems]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxIndex(null);
        setLightboxZoomed(false);
        setMediaContext(null);
      } else if (e.key === 'ArrowLeft' && lightboxIndex > 0) {
        setLightboxIndex(lightboxIndex - 1);
        setLightboxZoomed(false);
      } else if (e.key === 'ArrowRight' && lightboxIndex < media.length - 1) {
        setLightboxIndex(lightboxIndex + 1);
        setLightboxZoomed(false);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, media.length]);

  // Load context when lightbox opens
  useEffect(() => {
    if (lightboxIndex !== null && media[lightboxIndex]) {
      loadMediaContext(media[lightboxIndex].id);
    }
  }, [lightboxIndex]);

  // ═══════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════

  const getImageUrl = (item: MediaItem) => {
    const encoded = btoa(item.file_path);
    return `${ARCHIVE_SERVER}/api/facebook/image?path=${encoded}`;
  };

  const formatDate = (ts: number) => {
    return new Date(ts * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Handle media selection for main workspace
  const handleSelectMedia = async (item: MediaItem, index: number) => {
    if (onSelectMedia) {
      // Parse context if available
      let context: { album?: string; post_title?: string } | undefined;
      if (item.context) {
        try {
          context = typeof item.context === 'string' ? JSON.parse(item.context) : item.context;
        } catch {
          // Ignore parse errors
        }
      }

      // Fetch contextual related media and linked content from API
      let relatedMedia: Array<{ id: string; file_path: string; media_type: 'image' | 'video'; created_at?: number }> = [];
      let linkedContent: Array<{ id: string; type: 'post' | 'comment'; title?: string; text?: string; created_at: number; author_name?: string }> = [];
      try {
        const res = await fetch(`${ARCHIVE_SERVER}/api/facebook/media/${item.id}/context`);
        if (res.ok) {
          const data = await res.json();
          // Get related media (already sorted by created_at ASC in API)
          if (data.relatedMedia && data.relatedMedia.length > 0) {
            relatedMedia = data.relatedMedia.map((m: { id: string; file_path: string; media_type: string; created_at?: number }) => ({
              id: m.id,
              file_path: m.file_path,
              media_type: m.media_type as 'image' | 'video',
              created_at: m.created_at,
            }));
          }
          // Get linked posts/comments that reference this media
          if (data.contentItems && data.contentItems.length > 0) {
            linkedContent = data.contentItems.map((c: { id: string; type: string; title?: string; text?: string; created_at: number; author_name?: string }) => ({
              id: c.id,
              type: c.type as 'post' | 'comment',
              title: c.title,
              text: c.text,
              created_at: c.created_at,
              author_name: c.author_name,
            }));
          }
        }
      } catch (err) {
        console.error('Failed to fetch media context:', err);
      }

      // Fallback: if no related media found, just include the current item
      if (relatedMedia.length === 0) {
        relatedMedia = [{
          id: item.id,
          file_path: item.file_path,
          media_type: item.media_type as 'image' | 'video',
          created_at: item.created_at,
        }];
      }

      onSelectMedia({
        id: item.id,
        file_path: item.file_path,
        filename: item.filename,
        media_type: item.media_type as 'image' | 'video',
        file_size: item.file_size,
        width: item.width,
        height: item.height,
        created_at: item.created_at,
        description: item.description,
        context,
        related_post_id: item.related_post_id,
        linkedContent,
        relatedMedia,
      });
    } else {
      // Fallback to lightbox if no callback provided
      setLightboxIndex(index);
    }
  };

  const totalPeriodCount = periods.reduce((sum, p) => sum + p.count, 0);
  const gridColumns = Math.max(2, Math.floor(300 / (thumbnailSize + 4)));

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  return (
    <div className="facebook-view">
      {/* Header with view tabs */}
      <div className="facebook-view__header">
        <div className="facebook-view__tabs">
          <button
            className={`facebook-view__tab ${viewMode === 'feed' ? 'facebook-view__tab--active' : ''}`}
            onClick={() => setViewMode('feed')}
          >
            Feed
          </button>
          <button
            className={`facebook-view__tab ${viewMode === 'gallery' ? 'facebook-view__tab--active' : ''}`}
            onClick={() => setViewMode('gallery')}
          >
            Gallery
          </button>
        </div>

        {/* Period selector */}
        <button
          className="facebook-view__period-btn"
          onClick={() => setShowPeriodPicker(!showPeriodPicker)}
        >
          {selectedPeriod ? selectedPeriod.replace('_', ' ') : 'All Time'}
          <span className="facebook-view__period-count">
            ({selectedPeriod
              ? periods.find(p => p.period === selectedPeriod)?.count || 0
              : totalPeriodCount})
          </span>
        </button>
      </div>

      {/* Period picker dropdown */}
      {showPeriodPicker && (
        <div className="facebook-view__period-picker">
          <button
            className={`facebook-view__period-option ${!selectedPeriod ? 'facebook-view__period-option--active' : ''}`}
            onClick={() => { setSelectedPeriod(''); setShowPeriodPicker(false); }}
          >
            All Time ({totalPeriodCount})
          </button>
          {periods.map(p => (
            <button
              key={p.period}
              className={`facebook-view__period-option ${selectedPeriod === p.period ? 'facebook-view__period-option--active' : ''}`}
              onClick={() => { setSelectedPeriod(p.period); setShowPeriodPicker(false); }}
            >
              {p.period.replace('_', ' ')} ({p.count})
            </button>
          ))}
        </div>
      )}

      {/* Feed View */}
      {viewMode === 'feed' && (
        <div className="facebook-view__feed">
          {/* Feed filters */}
          <div className="facebook-view__filters">
            <input
              type="text"
              className="facebook-view__search"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="facebook-view__filter-row">
              {(['all', 'post', 'comment', 'media'] as FilterType[]).map(t => (
                <button
                  key={t}
                  className={`facebook-view__filter-btn ${filterType === t ? 'facebook-view__filter-btn--active' : ''}`}
                  onClick={() => setFilterType(t)}
                >
                  {t === 'all' ? 'All' : t === 'post' ? 'Posts' : t === 'comment' ? 'Comments' : 'Media'}
                </button>
              ))}
              <label className="facebook-view__checkbox">
                <input
                  type="checkbox"
                  checked={ownContentOnly}
                  onChange={(e) => setOwnContentOnly(e.target.checked)}
                />
                Mine
              </label>
            </div>
          </div>

          {/* Feed items */}
          <div className="facebook-view__feed-list">
            {error && <div className="facebook-view__error">{error}</div>}

            {items.length === 0 && !feedLoading && (
              <div className="facebook-view__empty">
                <p>No items found</p>
                <span>Try adjusting filters or import a Facebook archive</span>
              </div>
            )}

            {items.map((item, i) => (
              <div
                key={`${item.id}-${i}`}
                className="facebook-view__item"
                onClick={() => setSelectedItem(item)}
              >
                <div className="facebook-view__item-header">
                  <span className={`facebook-view__item-type facebook-view__item-type--${item.type}`}>
                    {item.type === 'post' ? 'Post' : 'Comment'}
                  </span>
                  <span className="facebook-view__item-date">{formatDate(item.created_at)}</span>
                </div>
                {item.title && <div className="facebook-view__item-title">{item.title}</div>}
                <div className="facebook-view__item-text">
                  {item.text?.substring(0, 200) || '[No text]'}
                  {item.text && item.text.length > 200 && '...'}
                </div>
                {(() => {
                  try {
                    const refs = item.media_refs ? JSON.parse(item.media_refs) : [];
                    if (refs.length > 0) {
                      return <div className="facebook-view__item-media">{refs.length} media</div>;
                    }
                  } catch {}
                  return null;
                })()}
              </div>
            ))}

            {feedLoading && <div className="facebook-view__loading">Loading...</div>}
            <div ref={feedObserverRef} style={{ height: 20 }} />
          </div>
        </div>
      )}

      {/* Gallery View */}
      {viewMode === 'gallery' && (
        <div className="facebook-view__gallery">
          {/* Stats bar */}
          {mediaStats && (
            <div className="facebook-view__stats">
              <strong>{mediaStats.total.toLocaleString()}</strong> items
              <span className="facebook-view__stats-sep">|</span>
              <strong>{formatFileSize(mediaStats.totalSizeBytes)}</strong>
            </div>
          )}

          {/* Size slider */}
          <div className="facebook-view__size-slider">
            <span>Size:</span>
            <input
              type="range"
              min="50"
              max="150"
              value={thumbnailSize}
              onChange={(e) => setThumbnailSize(parseInt(e.target.value))}
            />
            <span>{thumbnailSize}px</span>
          </div>

          {/* Thumbnail grid */}
          <div
            className="facebook-view__grid"
            style={{ gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }}
          >
            {media.map((item, index) => (
              <div
                key={item.id}
                className="facebook-view__thumb"
                style={{ width: thumbnailSize, height: thumbnailSize }}
                onClick={() => handleSelectMedia(item, index)}
              >
                {item.media_type === 'image' ? (
                  <img
                    src={getImageUrl(item)}
                    alt={item.filename}
                    loading="lazy"
                  />
                ) : (
                  <div className="facebook-view__thumb-video">Video</div>
                )}
              </div>
            ))}
          </div>

          {mediaLoading && <div className="facebook-view__loading">Loading...</div>}
          <div ref={mediaObserverRef} style={{ height: 20 }} />
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && media[lightboxIndex] && (
        <div
          className="facebook-lightbox"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setLightboxIndex(null);
              setLightboxZoomed(false);
              setMediaContext(null);
            }
          }}
        >
          {/* Close button */}
          <button
            className="facebook-lightbox__close"
            onClick={() => {
              setLightboxIndex(null);
              setLightboxZoomed(false);
              setMediaContext(null);
            }}
          >
            Close (Esc)
          </button>

          {/* Navigation arrows */}
          {lightboxIndex > 0 && (
            <button
              className="facebook-lightbox__nav facebook-lightbox__nav--prev"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(lightboxIndex - 1);
                setLightboxZoomed(false);
              }}
            >
              ‹
            </button>
          )}
          {lightboxIndex < media.length - 1 && (
            <button
              className="facebook-lightbox__nav facebook-lightbox__nav--next"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(lightboxIndex + 1);
                setLightboxZoomed(false);
              }}
            >
              ›
            </button>
          )}

          {/* Image */}
          <img
            className={`facebook-lightbox__image ${lightboxZoomed ? 'facebook-lightbox__image--zoomed' : ''}`}
            src={getImageUrl(media[lightboxIndex])}
            alt={media[lightboxIndex].filename}
            onClick={(e) => {
              e.stopPropagation();
              setLightboxZoomed(!lightboxZoomed);
            }}
          />

          {/* Info panel */}
          <div className="facebook-lightbox__info">
            <div className="facebook-lightbox__counter">
              {lightboxIndex + 1} / {media.length}
            </div>
            <div className="facebook-lightbox__filename">
              {media[lightboxIndex].filename}
            </div>
            <div className="facebook-lightbox__meta">
              {formatDate(media[lightboxIndex].created_at)}
              {media[lightboxIndex].width && media[lightboxIndex].height && (
                <> | {media[lightboxIndex].width} x {media[lightboxIndex].height}</>
              )}
              {media[lightboxIndex].file_size && (
                <> | {formatFileSize(media[lightboxIndex].file_size)}</>
              )}
            </div>

            {/* Related posts/albums */}
            {loadingContext && <div className="facebook-lightbox__context-loading">Loading context...</div>}
            {mediaContext && (
              <div className="facebook-lightbox__context">
                {mediaContext.posts?.length > 0 && (
                  <div className="facebook-lightbox__related">
                    <strong>Related Posts:</strong>
                    {mediaContext.posts.slice(0, 3).map(post => (
                      <button
                        key={post.id}
                        className="facebook-lightbox__related-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Open post in main view
                          console.log('Open post:', post.id);
                        }}
                      >
                        {post.text?.substring(0, 50) || '[No text]'}...
                      </button>
                    ))}
                  </div>
                )}
                {mediaContext.albums?.length > 0 && (
                  <div className="facebook-lightbox__albums">
                    <strong>Albums:</strong> {mediaContext.albums.map(a => a.name).join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
