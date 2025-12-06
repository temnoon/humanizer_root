/**
 * Facebook Feed Component
 * Browse Facebook archive content with quarterly organization
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { FacebookContentItem } from '@/services/api/archive';
import './FacebookFeed.css';

const API_BASE = 'http://localhost:3002';
const ITEMS_PER_PAGE = 50;

const STORAGE_KEYS = {
  filters: 'humanizer-facebook-filters',
  viewMode: 'humanizer-facebook-view-mode',
  period: 'humanizer-facebook-period',
  archive: 'humanizer-facebook-archive',
};

interface Period {
  year: number;
  quarter: number;
  period: string;
  count: number;
  label: string;
}

export function FacebookFeed() {
  const { createBuffer } = useWorkspace();

  // State
  const [items, setItems] = useState<FacebookContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  // Periods
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.period) || '';
  });
  const [showPeriodModal, setShowPeriodModal] = useState(false);

  // Facebook data status
  const [facebookAvailable, setFacebookAvailable] = useState(false);

  // Filters
  const [filters, setFilters] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.filters);
    return saved ? JSON.parse(saved) : {
      type: 'all',
      ownContentOnly: false,
      searchQuery: '',
    };
  });

  const [viewMode, setViewMode] = useState<'feed' | 'gallery'>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.viewMode);
    return (saved as 'feed' | 'gallery') || 'feed';
  });

  // Refs
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Check for Facebook data on mount
  useEffect(() => {
    checkFacebookAvailability();
    loadPeriods();
  }, []);

  // Persist preferences
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.filters, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.viewMode, viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.period, selectedPeriod);
  }, [selectedPeriod]);

  // Check if Facebook data is available
  const checkFacebookAvailability = async () => {
    try {
      // Try to load Facebook periods - if successful, data is available
      const response = await fetch(`${API_BASE}/api/facebook/periods`);
      const data = await response.json();
      setFacebookAvailable(true);
    } catch (err) {
      console.error('No Facebook data available:', err);
      setFacebookAvailable(false);
    }
  };

  // Load periods
  const loadPeriods = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/facebook/periods`);
      const data = await response.json();
      setPeriods(data.periods || []);
    } catch (err) {
      console.error('Failed to load periods:', err);
      setPeriods([]);
    }
  };

  // Load items from API
  const loadItems = useCallback(async (reset = false) => {
    if (loading) return;
    if (!reset && !hasMore) return;

    setLoading(true);
    setError(null);

    try {
      const currentOffset = reset ? 0 : offset;
      const params = new URLSearchParams({
        source: 'facebook',
        limit: ITEMS_PER_PAGE.toString(),
        offset: currentOffset.toString(),
      });

      if (filters.type && filters.type !== 'all' && filters.type !== 'media') {
        params.append('type', filters.type);
      }

      if (selectedPeriod) {
        params.append('period', selectedPeriod);
      }

      const response = await fetch(`${API_BASE}/api/content/items?${params}`);
      const data = await response.json();

      let newItems = data.items || [];

      // Client-side filtering
      if (filters.ownContentOnly) {
        newItems = newItems.filter((item: FacebookContentItem) => item.is_own_content);
      }

      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        newItems = newItems.filter((item: FacebookContentItem) =>
          item.text?.toLowerCase().includes(query) ||
          item.title?.toLowerCase().includes(query)
        );
      }

      if (reset) {
        setItems(newItems);
        setOffset(newItems.length);
      } else {
        setItems(prev => [...prev, ...newItems]);
        setOffset(currentOffset + newItems.length);
      }

      setHasMore(data.hasMore || false);
    } catch (err) {
      console.error('Failed to load items:', err);
      setError('Failed to load Facebook content. Is the archive server running?');
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, offset, filters, selectedPeriod]);

  // Load items when filters change
  useEffect(() => {
    loadItems(true);
  }, [filters.type, filters.ownContentOnly, filters.searchQuery, selectedPeriod]);

  // Infinite scroll
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadItems(false);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loading, loadItems]);

  // Handle item click
  const handleSelectItem = (item: FacebookContentItem) => {
    // Skip if no text content
    if (!item.text) return;

    const title = item.title || `Facebook ${item.type}`;
    const date = new Date(item.created_at * 1000).toLocaleDateString();

    createBuffer(
      title,
      item.text,
      {
        type: 'facebook',
        id: item.id,
        metadata: {
          source: 'facebook',
          contentType: item.type,
          created_at: item.created_at,
          author: item.author_name,
          media_refs: item.media_refs,
          date,
        },
      }
    );
  };

  // Parse media refs
  const getMediaUrls = (item: FacebookContentItem): string[] => {
    if (!item.media_refs) return [];
    try {
      const refs = JSON.parse(item.media_refs);
      // Convert relative paths to full URLs
      return refs.map((ref: string) => {
        if (ref.startsWith('http')) return ref;
        return `${API_BASE}/media/${ref}`;
      });
    } catch {
      return [];
    }
  };

  // Group periods by year for modal
  const periodsByYear = periods.reduce((acc, period) => {
    if (!acc[period.year]) {
      acc[period.year] = [];
    }
    acc[period.year].push(period);
    return acc;
  }, {} as Record<number, Period[]>);

  // Render feed item
  const renderFeedItem = (item: FacebookContentItem) => {
    // Skip items with no text
    if (!item.text) return null;

    const mediaUrls = getMediaUrls(item);
    const date = new Date(item.created_at * 1000);
    const formattedDate = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    return (
      <div
        key={item.id}
        className="feed-item"
        onClick={() => handleSelectItem(item)}
      >
        <div className="feed-item-header">
          <div className="feed-item-meta">
            <span className="feed-item-type">{item.type}</span>
            {item.author_name && (
              <span className="feed-item-author">{item.author_name}</span>
            )}
            <span className="feed-item-date">{formattedDate}</span>
          </div>
          {item.is_own_content && <span className="own-content-badge">You</span>}
        </div>

        {item.title && <h4 className="feed-item-title">{item.title}</h4>}

        <p className="feed-item-text">
          {item.text && item.text.length > 300 ? `${item.text.substring(0, 300)}...` : (item.text || '')}
        </p>

        {/* Display actual media images */}
        {mediaUrls.length > 0 && (
          <div className="feed-item-media-preview">
            {mediaUrls.slice(0, 4).map((url, idx) => (
              <img
                key={idx}
                src={url}
                alt={`Media ${idx + 1}`}
                className="media-thumbnail"
                onError={(e) => {
                  // Fallback for broken images
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ))}
            {mediaUrls.length > 4 && (
              <div className="media-more">+{mediaUrls.length - 4}</div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render gallery item
  const renderGalleryItem = (item: FacebookContentItem) => {
    const mediaUrls = getMediaUrls(item);
    if (mediaUrls.length === 0) return null;

    return (
      <div
        key={item.id}
        className="gallery-item"
        onClick={() => handleSelectItem(item)}
      >
        <div className="gallery-item-image">
          <img
            src={mediaUrls[0]}
            alt="Gallery item"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23ddd" width="200" height="200"/><text x="50%" y="50%" fill="%23999" text-anchor="middle" dy=".3em">📷</text></svg>';
            }}
          />
          {mediaUrls.length > 1 && (
            <div className="gallery-item-count">+{mediaUrls.length - 1}</div>
          )}
        </div>
        <div className="gallery-item-info">
          <span className="gallery-item-date">
            {new Date(item.created_at * 1000).toLocaleDateString()}
          </span>
        </div>
      </div>
    );
  };

  // Show message if no Facebook data
  if (!facebookAvailable && !loading) {
    return (
      <div className="facebook-feed-placeholder">
        <p>No Facebook archive data found</p>
        <p className="help-text">
          Import a Facebook archive using the "Import New" tab
        </p>
      </div>
    );
  }

  return (
    <div className="facebook-feed">
      {/* Period Selection */}
      {periods.length > 0 && (
        <div className="feed-header">
          <button
            className="period-selector-btn"
            onClick={() => setShowPeriodModal(!showPeriodModal)}
          >
            📅 {selectedPeriod || 'All Periods'}
          </button>
        </div>
      )}

      {/* Period Modal */}
      {showPeriodModal && (
        <div className="period-modal">
          <div className="period-modal-header">
            <h3>Select Period</h3>
            <button onClick={() => setShowPeriodModal(false)}>✕</button>
          </div>
          <div className="period-modal-content">
            <button
              className={`period-option ${!selectedPeriod ? 'active' : ''}`}
              onClick={() => {
                setSelectedPeriod('');
                setShowPeriodModal(false);
              }}
            >
              All Periods ({periods.reduce((sum, p) => sum + p.count, 0)} items)
            </button>
            {Object.keys(periodsByYear)
              .sort((a, b) => Number(b) - Number(a))
              .map(year => (
                <div key={year} className="period-year-group">
                  <div className="period-year-label">{year}</div>
                  {periodsByYear[Number(year)].map(period => (
                    <button
                      key={period.period}
                      className={`period-option ${selectedPeriod === period.period ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedPeriod(period.period);
                        setShowPeriodModal(false);
                      }}
                    >
                      {period.label} ({period.count} items)
                    </button>
                  ))}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="feed-filters">
        <select
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          className="filter-select"
        >
          <option value="all">All Types</option>
          <option value="post">Posts</option>
          <option value="comment">Comments</option>
        </select>

        <input
          type="text"
          placeholder="Search..."
          value={filters.searchQuery}
          onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
          className="filter-search"
        />

        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={filters.ownContentOnly}
            onChange={(e) => setFilters({ ...filters, ownContentOnly: e.target.checked })}
          />
          <span>My content only</span>
        </label>

        <div className="view-mode-toggle">
          <button
            className={viewMode === 'feed' ? 'active' : ''}
            onClick={() => setViewMode('feed')}
          >
            📄 Feed
          </button>
          <button
            className={viewMode === 'gallery' ? 'active' : ''}
            onClick={() => setViewMode('gallery')}
          >
            🖼️ Gallery
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="feed-error">
          <p>{error}</p>
        </div>
      )}

      {/* Content */}
      <div className={`feed-content ${viewMode}`}>
        {items.length === 0 && !loading ? (
          <div className="feed-empty">
            <p>No items found</p>
            {filters.searchQuery && <p className="help-text">Try a different search query</p>}
            {selectedPeriod && <p className="help-text">Try selecting a different period</p>}
          </div>
        ) : (
          <>
            {viewMode === 'feed' && items.map(renderFeedItem)}
            {viewMode === 'gallery' && (
              <div className="gallery-grid">
                {items.filter(item => getMediaUrls(item).length > 0).map(renderGalleryItem)}
              </div>
            )}
          </>
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="feed-loading">
            <p>Loading...</p>
          </div>
        )}

        {/* Infinite scroll trigger */}
        <div ref={loadMoreRef} className="load-more-trigger" />

        {/* Load more button (fallback) */}
        {!loading && hasMore && items.length > 0 && (
          <button
            className="btn btn-secondary load-more-btn"
            onClick={() => loadItems(false)}
          >
            Load More
          </button>
        )}
      </div>
    </div>
  );
}
