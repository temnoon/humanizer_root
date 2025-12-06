import { useState, useEffect, useRef, useCallback } from 'react';
import { FacebookMediaGallery } from './FacebookMediaGallery';
import { STORAGE_PATHS } from '../../config/storage-paths';

const API_BASE = STORAGE_PATHS.archiveServerUrl;
const STORAGE_KEY_PERIOD = 'facebook_selected_period';
const STORAGE_KEY_FILTERS = 'facebook_filters';
const STORAGE_KEY_VIEW = 'facebook_view_mode';
const STORAGE_KEY_HEADER_COLLAPSED = 'facebook_header_collapsed';

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
  similarity?: number; // For search results
}

interface FacebookFilters {
  type: 'all' | 'post' | 'comment' | 'media';
  ownContentOnly: boolean;
}

interface FacebookFeedViewProps {
  onSelectItem: (item: FacebookContentItem) => void;
}

export function FacebookFeedView({ onSelectItem }: FacebookFeedViewProps) {
  const [items, setItems] = useState<FacebookContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  // Load filters from localStorage
  const [filters, setFilters] = useState<FacebookFilters>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FILTERS);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load filters from localStorage:', e);
    }
    return { type: 'all', ownContentOnly: false };
  });

  const [searchQuery, setSearchQuery] = useState('');

  // Load period from localStorage
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_PERIOD) || '';
    } catch (e) {
      console.error('Failed to load period from localStorage:', e);
      return '';
    }
  });

  const [periods, setPeriods] = useState<any[]>([]);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [isModalCollapsed, setIsModalCollapsed] = useState(false);
  const [modalPosition, setModalPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // View mode state (persisted in localStorage)
  const [viewMode, setViewMode] = useState<'feed' | 'gallery'>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY_VIEW) as 'feed' | 'gallery') || 'feed';
    } catch (e) {
      return 'feed';
    }
  });

  // Header collapsed state (persisted in localStorage)
  const [headerCollapsed, setHeaderCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HEADER_COLLAPSED);
      return saved === 'true';
    } catch (e) {
      return false;
    }
  });

  const observerTarget = useRef<HTMLDivElement>(null);
  const ITEMS_PER_PAGE = 50;

  // Load items from API
  const loadItems = useCallback(async (reset = false) => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const currentOffset = reset ? 0 : offset;
      const params = new URLSearchParams({
        source: 'facebook',
        limit: ITEMS_PER_PAGE.toString(),
        offset: currentOffset.toString(),
      });

      if (filters.type !== 'all' && filters.type !== 'media') {
        params.append('type', filters.type);
      }

      if (selectedPeriod) {
        params.append('period', selectedPeriod);
      }

      const response = await fetch(`${API_BASE}/api/content/items?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // Apply client-side filters
      let filteredItems = data.items || [];

      // Filter for media items
      if (filters.type === 'media') {
        filteredItems = filteredItems.filter((item: FacebookContentItem) => {
          try {
            const mediaRefs = item.media_refs ? JSON.parse(item.media_refs) : [];
            return mediaRefs.length > 0;
          } catch {
            return false;
          }
        });
      }

      if (filters.ownContentOnly) {
        filteredItems = filteredItems.filter((item: FacebookContentItem) => item.is_own_content);
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filteredItems = filteredItems.filter((item: FacebookContentItem) =>
          item.text?.toLowerCase().includes(query) ||
          item.title?.toLowerCase().includes(query)
        );
      }

      if (reset) {
        setItems(filteredItems);
        setOffset(ITEMS_PER_PAGE);
      } else {
        setItems(prev => [...prev, ...filteredItems]);
        setOffset(prev => prev + ITEMS_PER_PAGE);
      }

      setTotal(data.total || 0);
      setHasMore(filteredItems.length === ITEMS_PER_PAGE);
    } catch (err) {
      console.error('Failed to load Facebook content:', err);
      setError(err instanceof Error ? err.message : 'Failed to load content');
    } finally {
      setLoading(false);
    }
  }, [offset, loading, filters, selectedPeriod, searchQuery]);

  // Load periods on mount
  useEffect(() => {
    const loadPeriods = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/facebook/periods`);
        const data = await response.json();
        setPeriods(data.periods || []);
      } catch (err) {
        console.error('Failed to load periods:', err);
      }
    };
    loadPeriods();
  }, []);

  // Initial load
  useEffect(() => {
    setItems([]);     // Clear old items
    setOffset(0);      // Reset pagination
    setHasMore(true);  // Reset hasMore flag
    loadItems(true);
  }, [filters, selectedPeriod]); // Reload when filters or period change

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadItems();
        }
      },
      { threshold: 0.1 }
    );

    const target = observerTarget.current;
    if (target) {
      observer.observe(target);
    }

    return () => {
      if (target) {
        observer.unobserve(target);
      }
    };
  }, [hasMore, loading, loadItems]);

  // Save period to localStorage when it changes
  useEffect(() => {
    try {
      if (selectedPeriod) {
        localStorage.setItem(STORAGE_KEY_PERIOD, selectedPeriod);
      } else {
        localStorage.removeItem(STORAGE_KEY_PERIOD);
      }
    } catch (e) {
      console.error('Failed to save period to localStorage:', e);
    }
  }, [selectedPeriod]);

  // Save filters to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_FILTERS, JSON.stringify(filters));
    } catch (e) {
      console.error('Failed to save filters to localStorage:', e);
    }
  }, [filters]);

  // Save view mode to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_VIEW, viewMode);
    } catch (e) {
      console.error('Failed to save view mode to localStorage:', e);
    }
  }, [viewMode]);

  // Save header collapsed state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HEADER_COLLAPSED, String(headerCollapsed));
    } catch (e) {
      console.error('Failed to save header collapsed state to localStorage:', e);
    }
  }, [headerCollapsed]);

  // Format date display
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 365) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Extract period label from file path
  const getPeriodLabel = (filePath?: string) => {
    if (!filePath) return null;
    const match = filePath.match(/Q(\d)_(\d{4})-(\d{2})-(\d{2})_to_(\d{4})/);
    if (match) {
      const [_, quarter, year] = match;
      return `Q${quarter} ${year}`;
    }
    return null;
  };

  // Parse context for display
  const getContextDisplay = (item: FacebookContentItem) => {
    try {
      if (item.context) {
        const ctx = JSON.parse(item.context);
        if (ctx.targetAuthor) {
          return `on ${ctx.targetAuthor}'s ${ctx.contextType || 'post'}`;
        }
      }
    } catch {
      // Ignore parse errors
    }
    return null;
  };

  // Count display
  const getCountDisplay = () => {
    if (filters.type === 'post') return `${total.toLocaleString()} posts`;
    if (filters.type === 'comment') return `${total.toLocaleString()} comments`;
    if (filters.type === 'media') return `${items.length.toLocaleString()} media items`;
    return `${total.toLocaleString()} items`;
  };

  // Drag handlers for modal
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - modalPosition.x,
      y: e.clientY - modalPosition.y,
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      setModalPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    }
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--bg-primary)',
    }}>
      {/* Collapsible Header */}
      {headerCollapsed ? (
        /* Collapsed: Just a tiny chevron */
        <div style={{
          padding: '0.3rem 0.5rem',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          alignItems: 'center',
        }}>
          <button
            onClick={() => setHeaderCollapsed(false)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              color: 'var(--text-secondary)',
              padding: '0.2rem',
              lineHeight: 1,
            }}
            title="Show header"
          >
            ▶
          </button>
        </div>
      ) : (
        /* Expanded: Full Header with View Tabs */
        <div style={{
          padding: 'var(--space-md)',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-sm)',
          }}>
            <h3 style={{
              margin: 0,
              fontSize: '1.1rem',
              color: 'var(--text-primary)',
            }}>
              📘 Facebook Archive
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
              }}>
                {viewMode === 'feed' && getCountDisplay()}
              </div>
              <button
                onClick={() => setHeaderCollapsed(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary)',
                  padding: '0.2rem',
                  lineHeight: 1,
                  opacity: 0.7,
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                title="Hide header"
              >
                ▼
              </button>
            </div>
          </div>

        {/* View Tabs */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: 'var(--space-md)',
        }}>
          <button
            onClick={() => setViewMode('feed')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: viewMode === 'feed' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: viewMode === 'feed' ? 'var(--text-inverse)' : 'var(--text-primary)',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            📋 Feed
          </button>
          <button
            onClick={() => setViewMode('gallery')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: viewMode === 'gallery' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: viewMode === 'gallery' ? 'var(--text-inverse)' : 'var(--text-primary)',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            🖼️ Media Gallery
          </button>
        </div>

      </div>
      )}

      {/* Feed View */}
      {viewMode === 'feed' && (
        <div style={{
          flex: 1,
          minHeight: 0, // Required for Safari to enable scrolling in flex containers
          overflowY: 'auto',
          padding: 'var(--space-md)',
        }}>
        {/* Scrollable filters section */}
        <div style={{ marginBottom: 'var(--space-md)' }}>
          {/* Period Selector */}
          <button
            onClick={() => setShowPeriodModal(true)}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              marginBottom: 'var(--space-sm)',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>
              📅 {selectedPeriod
                ? `${selectedPeriod.replace('_', ' ')} (${periods.find(p => p.period === selectedPeriod)?.count || 0})`
                : `All Time (${periods.reduce((sum, p) => sum + p.count, 0)})`
              }
            </span>
            <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>▼</span>
          </button>

          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            style={{
              width: '100%',
              padding: '0.4rem 0.6rem',
              marginBottom: 'var(--space-sm)',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          />

          {/* Compact filter row */}
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              { type: 'all', label: 'All' },
              { type: 'post', label: '📝' },
              { type: 'comment', label: '💬' },
              { type: 'media', label: '🖼️' },
            ].map(f => (
              <button
                key={f.type}
                onClick={() => setFilters(prev => ({ ...prev, type: f.type as any }))}
                style={{
                  padding: '0.3rem 0.5rem',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: filters.type === f.type ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  color: filters.type === f.type ? 'var(--text-inverse)' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  minHeight: 'auto',
                }}
              >
                {f.label}
              </button>
            ))}
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filters.ownContentOnly}
                onChange={(e) => setFilters(prev => ({ ...prev, ownContentOnly: e.target.checked }))}
                style={{ cursor: 'pointer', width: '14px', height: '14px' }}
              />
              Mine
            </label>
          </div>
        </div>

        {error && (
          <div style={{
            padding: 'var(--space-md)',
            backgroundColor: 'var(--bg-error)',
            color: 'var(--text-error)',
            borderRadius: '6px',
            marginBottom: 'var(--space-md)',
          }}>
            {error}
          </div>
        )}

        {items.length === 0 && !loading && (
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-xl)',
            color: 'var(--text-secondary)',
          }}>
            No items found. Try adjusting your filters.
          </div>
        )}

        {items.map((item, index) => (
          <div
            key={`${item.id}-${index}`}
            onClick={() => onSelectItem(item)}
            style={{
              padding: 'var(--space-md)',
              marginBottom: 'var(--space-sm)',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-sm)',
              marginBottom: 'var(--space-xs)',
              flexWrap: 'wrap',
            }}>
              <span style={{
                fontSize: '0.75rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '3px',
                backgroundColor: item.type === 'post'
                  ? 'var(--accent-primary)'
                  : 'var(--accent-secondary)',
                color: 'var(--text-inverse)',
              }}>
                {item.type === 'post' ? '📝 Post' : '💬 Comment'}
              </span>

              {getPeriodLabel(item.file_path) && (
                <span style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '3px',
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)',
                }}>
                  {getPeriodLabel(item.file_path)}
                </span>
              )}

              {item.similarity !== undefined && (
                <span style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '3px',
                  backgroundColor: item.similarity > 0.7
                    ? 'var(--success-bg)'
                    : item.similarity > 0.4
                      ? 'var(--warning-bg)'
                      : 'var(--bg-tertiary)',
                  color: item.similarity > 0.7
                    ? 'var(--success-text)'
                    : item.similarity > 0.4
                      ? 'var(--warning-text)'
                      : 'var(--text-secondary)',
                }}>
                  {(item.similarity * 100).toFixed(1)}% match
                </span>
              )}

              <span style={{
                marginLeft: 'auto',
                fontSize: '0.75rem',
                color: 'var(--text-tertiary)',
              }}>
                {formatDate(item.created_at)}
              </span>
            </div>

            {/* Title */}
            {item.title && (
              <div style={{
                fontSize: '0.9rem',
                fontWeight: 500,
                color: 'var(--text-primary)',
                marginBottom: 'var(--space-xs)',
              }}>
                {item.title}
              </div>
            )}

            {/* Context */}
            {getContextDisplay(item) && (
              <div style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                fontStyle: 'italic',
                marginBottom: 'var(--space-xs)',
              }}>
                {getContextDisplay(item)}
              </div>
            )}

            {/* Content */}
            {item.text && (
              <div style={{
                fontSize: '0.9rem',
                color: 'var(--text-primary)',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {item.text.length > 300
                  ? `${item.text.substring(0, 300)}...`
                  : item.text}
              </div>
            )}
            {!item.text && (
              <div style={{
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
                fontStyle: 'italic',
                lineHeight: '1.5',
              }}>
                [No text content]
              </div>
            )}

            {/* Media indicator */}
            {(() => {
              try {
                const mediaRefs = item.media_refs ? JSON.parse(item.media_refs) : [];
                if (mediaRefs.length > 0) {
                  return (
                    <div style={{
                      marginTop: 'var(--space-sm)',
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                    }}>
                      🖼️ {mediaRefs.length} media file(s)
                    </div>
                  );
                }
              } catch (e) {
                // Ignore JSON parse errors
              }
              return null;
            })()}
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-md)',
            color: 'var(--text-secondary)',
          }}>
            Loading...
          </div>
        )}

        {/* Infinite scroll trigger */}
        <div ref={observerTarget} style={{ height: '20px' }} />

        {/* End of results */}
        {!hasMore && items.length > 0 && (
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-md)',
            color: 'var(--text-tertiary)',
            fontSize: '0.85rem',
          }}>
            — End of results —
          </div>
        )}
        </div>
      )}

      {/* Media Gallery View */}
      {viewMode === 'gallery' && (
        <FacebookMediaGallery
          selectedPeriod={selectedPeriod}
          periods={periods}
          onSelectItem={(mediaItem) => {
            // Convert MediaItem to FacebookContentItem for main pane display
            const contentItem: FacebookContentItem = {
              id: mediaItem.id,
              type: 'post', // Media items are treated as posts
              source: 'facebook',
              text: mediaItem.description || '',
              title: mediaItem.filename,
              created_at: mediaItem.created_at,
              is_own_content: true, // Assume user's own media
              file_path: mediaItem.file_path,
              media_refs: JSON.stringify([mediaItem.file_path]),
              context: mediaItem.context,
              metadata: JSON.stringify({
                media_type: mediaItem.media_type,
                source_type: mediaItem.source_type,
                file_size: mediaItem.file_size,
                width: mediaItem.width,
                height: mediaItem.height,
                filename: mediaItem.filename,
              }),
            };
            onSelectItem(contentItem);
          }}
        />
      )}

      {/* Period Selector Window */}
      {showPeriodModal && (
        <div
          style={{
            position: 'fixed',
            left: `${modalPosition.x}px`,
            top: `${modalPosition.y}px`,
            zIndex: 1000,
            width: '600px',
            maxHeight: isModalCollapsed ? 'auto' : '500px',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            cursor: isDragging ? 'grabbing' : 'default',
          }}
        >
          <style>{`
            .period-row:hover {
              background-color: var(--bg-secondary) !important;
            }
          `}</style>

          {/* Draggable Titlebar */}
          <div
            onMouseDown={handleMouseDown}
            style={{
              padding: '0.6rem 1rem',
              borderBottom: isModalCollapsed ? 'none' : '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'grab',
              backgroundColor: 'var(--bg-secondary)',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
              userSelect: 'none',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}>
              <span>📅</span>
              <span>Time Periods</span>
            </div>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsModalCollapsed(!isModalCollapsed);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.2rem',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '0.25rem 0.5rem',
                  lineHeight: 1,
                  opacity: 0.7,
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
              >
                {isModalCollapsed ? '▼' : '▲'}
              </button>
              <button
                onClick={() => setShowPeriodModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.2rem',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '0.25rem 0.5rem',
                  lineHeight: 1,
                  opacity: 0.7,
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
              >
                ×
              </button>
            </div>
          </div>

          {/* Period List - Spreadsheet Style */}
          {!isModalCollapsed && (
            <div style={{
              overflowY: 'auto',
              flex: 1,
            }}>
              {/* Header Row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 2fr',
                padding: '0.5rem 1rem',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                position: 'sticky',
                top: 0,
              }}>
                <div>Period</div>
                <div style={{ textAlign: 'right' }}>Items</div>
                <div style={{ textAlign: 'right' }}>Date Range</div>
              </div>

              {/* All Time Row */}
              <div
                className="period-row"
                onClick={() => {
                  setSelectedPeriod('');
                }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 2fr',
                  padding: '0.6rem 1rem',
                  borderBottom: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  background: !selectedPeriod ? 'var(--accent-primary-gradient)' : 'transparent',
                  color: !selectedPeriod ? 'var(--text-inverse)' : 'var(--text-primary)',
                  fontSize: '0.85rem',
                  transition: 'background 0.15s ease',
                }}
              >
                <div style={{ fontWeight: 600 }}>All Time</div>
                <div style={{ textAlign: 'right', opacity: 0.9 }}>
                  {periods.reduce((sum, p) => sum + p.count, 0).toLocaleString()}
                </div>
                <div style={{ textAlign: 'right', opacity: 0.7, fontSize: '0.8rem' }}>
                  2008 — 2025
                </div>
              </div>

              {/* Period Rows */}
              {periods.map((period) => {
                const isSelected = selectedPeriod === period.period;
                return (
                  <div
                    key={period.period}
                    className="period-row"
                    onClick={() => {
                      setSelectedPeriod(period.period);
                    }}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 2fr',
                      padding: '0.6rem 1rem',
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--accent-primary-gradient)' : 'transparent',
                      color: isSelected ? 'var(--text-inverse)' : 'var(--text-primary)',
                      fontSize: '0.85rem',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>
                      {period.period.replace('_', ' ')}
                    </div>
                    <div style={{ textAlign: 'right', opacity: 0.9 }}>
                      {period.count.toLocaleString()}
                    </div>
                    <div style={{ textAlign: 'right', opacity: 0.7, fontSize: '0.8rem' }}>
                      {new Date(period.start_date * 1000).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                      {' — '}
                      {new Date(period.end_date * 1000).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
