/**
 * FacebookMediaGallery - Sidebar-only media browser
 *
 * Sidebar: collapsible filters + size-adjustable thumbnail grid
 * Click thumbnail -> displays in app's main pane via onSelectItem
 * Double-click -> opens fullscreen lightbox with zoom
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { STORAGE_PATHS } from '../../config/storage-paths';

const API_BASE = STORAGE_PATHS.archiveServerUrl;
const ITEMS_PER_PAGE = 100;

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
}

interface MediaFilters {
  sourceType: string;
  mediaType: string;
  filenamePattern: string;
  sizeRange: string;
  dimensionsPreset: string;
  usePeriodFilter: boolean;
}

export function FacebookMediaGallery({
  selectedPeriod,
  periods,
  onSelectItem,
}: {
  selectedPeriod: string;
  periods: any[];
  onSelectItem?: (item: MediaItem) => void;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedImage, setSelectedImage] = useState<MediaItem | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [thumbnailSize, setThumbnailSize] = useState(90); // pixels
  const [zoomedToFull, setZoomedToFull] = useState(false);

  const [filters, setFilters] = useState<MediaFilters>({
    sourceType: '',
    mediaType: '',
    filenamePattern: '',
    sizeRange: '',
    dimensionsPreset: '',
    usePeriodFilter: true,
  });

  const observerTarget = useRef<HTMLDivElement>(null);

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, []);

  // Load items when filters change
  useEffect(() => {
    setItems([]);
    setOffset(0);
    setHasMore(true);
    loadItems(true);
  }, [filters, selectedPeriod]);

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && hasMore) {
          loadItems(false);
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [loading, hasMore, offset]);

  // Keyboard navigation in lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;

      if (e.key === 'ArrowLeft') {
        setLightboxIndex(prev => prev! > 0 ? prev! - 1 : prev);
      } else if (e.key === 'ArrowRight') {
        setLightboxIndex(prev => prev! < items.length - 1 ? prev! + 1 : prev);
      } else if (e.key === 'Escape') {
        setLightboxIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, items.length]);

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/facebook/media-stats`);
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const loadItems = async (reset: boolean) => {
    if (loading) return;
    setLoading(true);

    try {
      const params = new URLSearchParams({
        limit: ITEMS_PER_PAGE.toString(),
        offset: reset ? '0' : offset.toString(),
      });

      if (filters.sourceType) params.append('sourceType', filters.sourceType);
      if (filters.mediaType) params.append('mediaType', filters.mediaType);
      if (filters.filenamePattern) params.append('filename', filters.filenamePattern);

      // Parse size range
      if (filters.sizeRange) {
        const [min, max] = filters.sizeRange.split('-');
        if (min) params.append('minSize', min);
        if (max) params.append('maxSize', max);
      }

      if (filters.usePeriodFilter && selectedPeriod) {
        params.append('period', selectedPeriod);
      }

      const response = await fetch(`${API_BASE}/api/facebook/media-gallery?${params}`);
      const data = await response.json();

      if (reset) {
        setItems(data.items);
        setOffset(ITEMS_PER_PAGE);
      } else {
        setItems(prev => [...prev, ...data.items]);
        setOffset(prev => prev + ITEMS_PER_PAGE);
      }

      setHasMore(data.hasMore);
    } catch (err) {
      console.error('Failed to load media:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = (item: MediaItem, index: number) => {
    setSelectedImage(item);
    // Notify parent to display in main pane
    if (onSelectItem) {
      onSelectItem(item);
    }
  };

  const getImageUrl = (item: MediaItem): string => {
    const encodedPath = btoa(item.file_path);
    return `${API_BASE}/api/facebook/image?path=${encodedPath}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDownload = (item: MediaItem) => {
    const url = getImageUrl(item);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyPath = (item: MediaItem) => {
    navigator.clipboard.writeText(item.file_path);
    alert('File path copied to clipboard');
  };

  const handleCopyUrl = (item: MediaItem) => {
    const url = getImageUrl(item);
    navigator.clipboard.writeText(url);
    alert('Image URL copied to clipboard');
  };

  // Calculate grid columns based on thumbnail size
  const gridColumns = Math.max(2, Math.floor(320 / (thumbnailSize + 4)));

  return (
    <div style={{
      width: '320px',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      height: '100%',
    }}>
      {/* Compact Stats Bar */}
      {stats && (
        <div style={{
          padding: '0.4rem 0.5rem',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
          fontSize: '0.7rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>
            <strong>{stats.total.toLocaleString()}</strong> items · <strong>{formatFileSize(stats.totalSizeBytes)}</strong>
          </span>
          <button
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
              padding: '0.2rem',
            }}
            title={filtersExpanded ? 'Hide filters' : 'Show filters'}
          >
            {filtersExpanded ? '▼' : '▶'}
          </button>
        </div>
      )}

      {/* Collapsible Filters */}
      {filtersExpanded && (
        <div style={{
          padding: '0.5rem',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
        }}>
          <select
            value={filters.sourceType}
            onChange={(e) => setFilters(prev => ({ ...prev, sourceType: e.target.value }))}
            style={{
              padding: '0.3rem',
              fontSize: '0.7rem',
              borderRadius: '3px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)',
            }}
          >
            <option value="">All Sources</option>
            <option value="uncategorized">📷 Uncategorized</option>
            <option value="message">💬 Messages</option>
            <option value="post">📝 Posts</option>
            <option value="birthday">🎂 Birthday</option>
          </select>

          <select
            value={filters.mediaType}
            onChange={(e) => setFilters(prev => ({ ...prev, mediaType: e.target.value }))}
            style={{
              padding: '0.3rem',
              fontSize: '0.7rem',
              borderRadius: '3px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)',
            }}
          >
            <option value="">All Types</option>
            <option value="image">📷 Images</option>
            <option value="video">🎬 Videos</option>
          </select>

          <input
            type="text"
            value={filters.filenamePattern}
            onChange={(e) => setFilters(prev => ({ ...prev, filenamePattern: e.target.value }))}
            placeholder="Search filename..."
            style={{
              padding: '0.3rem',
              fontSize: '0.7rem',
              borderRadius: '3px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)',
            }}
          />

          <select
            value={filters.sizeRange}
            onChange={(e) => setFilters(prev => ({ ...prev, sizeRange: e.target.value }))}
            style={{
              padding: '0.3rem',
              fontSize: '0.7rem',
              borderRadius: '3px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)',
            }}
          >
            <option value="">All Sizes</option>
            <option value="-102400">{'< 100 KB'}</option>
            <option value="102400-1048576">100 KB - 1 MB</option>
            <option value="1048576-5242880">1 MB - 5 MB</option>
            <option value="5242880-">{'> 5 MB'}</option>
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={filters.usePeriodFilter}
              onChange={(e) => setFilters(prev => ({ ...prev, usePeriodFilter: e.target.checked }))}
            />
            <span>Filter to {selectedPeriod || 'period'}</span>
          </label>

          <button
            onClick={() => setFilters({
              sourceType: '',
              mediaType: '',
              filenamePattern: '',
              sizeRange: '',
              dimensionsPreset: '',
              usePeriodFilter: true,
            })}
            style={{
              padding: '0.3rem',
              fontSize: '0.65rem',
              borderRadius: '3px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)',
              cursor: 'pointer',
            }}
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Thumbnail Size Slider */}
      <div style={{
        padding: '0.5rem',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)',
      }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.7rem',
          color: 'var(--text-secondary)',
        }}>
          <span style={{ whiteSpace: 'nowrap' }}>Size:</span>
          <input
            type="range"
            min="50"
            max="150"
            value={thumbnailSize}
            onChange={(e) => setThumbnailSize(parseInt(e.target.value))}
            style={{
              flex: 1,
              cursor: 'pointer',
            }}
          />
          <span style={{ minWidth: '35px', textAlign: 'right' }}>{thumbnailSize}px</span>
        </label>
      </div>

      {/* Thumbnail Grid */}
      <div style={{
        flex: 1,
        minHeight: 0, // Required for Safari to enable scrolling in flex containers
        overflowY: 'auto',
        padding: '0.5rem',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
          gap: '4px',
        }}>
          {items.map((item, index) => (
            <div
              key={item.id}
              onClick={() => handleItemClick(item, index)}
              onDoubleClick={() => setLightboxIndex(index)}
              style={{
                cursor: 'pointer',
                borderRadius: '3px',
                overflow: 'hidden',
                border: selectedImage?.id === item.id ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                aspectRatio: '1',
                backgroundColor: 'var(--bg-secondary)',
                width: `${thumbnailSize}px`,
                height: `${thumbnailSize}px`,
              }}
            >
              {item.media_type === 'image' ? (
                <img
                  src={getImageUrl(item)}
                  alt={item.filename}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                  loading="lazy"
                />
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: `${thumbnailSize * 0.4}px`,
                }}>
                  🎬
                </div>
              )}
            </div>
          ))}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '1rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            Loading...
          </div>
        )}

        <div ref={observerTarget} style={{ height: '1px' }} />
      </div>

      {/* Lightbox with Zoom Navigation */}
      {lightboxIndex !== null && (() => {
        const currentItem = items[lightboxIndex];
        const hasNaturalSize = currentItem.width && currentItem.height;
        const canZoom = hasNaturalSize && (currentItem.width! > window.innerWidth * 0.9 || currentItem.height! > window.innerHeight * 0.9);

        return (
          <div
            onClick={(e) => {
              // Click background to close
              if (e.target === e.currentTarget) {
                setLightboxIndex(null);
                setZoomedToFull(false);
              }
            }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.95)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              overflow: zoomedToFull ? 'auto' : 'hidden',
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => {
                setLightboxIndex(null);
                setZoomedToFull(false);
              }}
              style={{
                position: 'fixed',
                top: '1rem',
                right: '1rem',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: 'rgba(255,255,255,0.9)',
                color: 'black',
                fontSize: '1rem',
                cursor: 'pointer',
                fontWeight: 600,
                zIndex: 10001,
              }}
            >
              ✕ Close (Esc)
            </button>

            {/* Left Arrow */}
            {lightboxIndex > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(prev => prev! - 1);
                  setZoomedToFull(false);
                }}
                style={{
                  position: 'fixed',
                  left: '2rem',
                  padding: '1rem',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  color: 'black',
                  fontSize: '2rem',
                  cursor: 'pointer',
                  width: '60px',
                  height: '60px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10001,
                }}
              >
                ‹
              </button>
            )}

            {/* Image with Zoom */}
            {currentItem.media_type === 'image' ? (
              <img
                src={getImageUrl(currentItem)}
                alt={currentItem.filename}
                onClick={(e) => {
                  e.stopPropagation();
                  if (canZoom) {
                    setZoomedToFull(!zoomedToFull);
                  }
                }}
                style={{
                  maxWidth: zoomedToFull ? 'none' : '90vw',
                  maxHeight: zoomedToFull ? 'none' : '90vh',
                  width: zoomedToFull ? 'auto' : undefined,
                  height: zoomedToFull ? 'auto' : undefined,
                  objectFit: zoomedToFull ? 'none' : 'contain',
                  cursor: canZoom ? (zoomedToFull ? 'zoom-out' : 'zoom-in') : 'default',
                  transition: 'none',
                }}
              />
            ) : (
              <div style={{ fontSize: '10rem', color: 'white', opacity: 0.5 }}>🎬</div>
            )}

            {/* Right Arrow */}
            {lightboxIndex < items.length - 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(prev => prev! + 1);
                  setZoomedToFull(false);
                }}
                style={{
                  position: 'fixed',
                  right: '2rem',
                  padding: '1rem',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  color: 'black',
                  fontSize: '2rem',
                  cursor: 'pointer',
                  width: '60px',
                  height: '60px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10001,
                }}
              >
                ›
              </button>
            )}

            {/* Image Counter + Zoom Hint */}
            <div style={{
              position: 'fixed',
              bottom: '2rem',
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '0.5rem 1rem',
              borderRadius: '20px',
              backgroundColor: 'rgba(255,255,255,0.9)',
              color: 'black',
              fontSize: '0.85rem',
              fontWeight: 600,
              zIndex: 10001,
              textAlign: 'center',
            }}>
              <div>{lightboxIndex + 1} / {items.length}</div>
              {canZoom && (
                <div style={{ fontSize: '0.7rem', marginTop: '0.2rem', opacity: 0.7 }}>
                  {zoomedToFull ? 'Click to zoom out' : 'Click to zoom to full size'}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
