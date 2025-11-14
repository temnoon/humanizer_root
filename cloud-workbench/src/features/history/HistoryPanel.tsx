import { useState, useEffect } from 'react';
import { useCanvas } from '../../core/context/CanvasContext';
import { api, type TransformationHistoryItem } from '../../core/adapters/api';
import { TransformationCard } from './TransformationCard';

/**
 * HistoryPanel - Transformation History Browser
 *
 * Features:
 * - List all user's transformation history
 * - Filter by type, favorites
 * - Search by text content
 * - Load transformations back to Canvas
 * - Toggle favorites
 * - Delete transformations
 * - Pagination support
 *
 * Database: transformation_history table
 * API: GET /transformation-history, POST /transformation-history/:id/favorite, DELETE /transformation-history/:id
 */
export function HistoryPanel() {
  const { setText } = useCanvas();
  const [items, setItems] = useState<TransformationHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [favoriteFilter, setFavoriteFilter] = useState<boolean | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadHistory = async (reset = false) => {
    setLoading(true);
    setError(null);

    try {
      const currentOffset = reset ? 0 : offset;

      const filters: any = {
        limit: limit + 1, // Fetch one extra to check if there are more
        offset: currentOffset,
      };

      if (typeFilter !== 'all') {
        filters.type = typeFilter;
      }

      if (favoriteFilter !== undefined) {
        filters.favorite = favoriteFilter;
      }

      const results = await api.getTransformationHistory(filters);

      // Check if there are more items
      const hasMoreItems = results.length > limit;
      const displayItems = hasMoreItems ? results.slice(0, limit) : results;

      if (reset) {
        setItems(displayItems);
        setOffset(0);
      } else {
        setItems(prev => [...prev, ...displayItems]);
      }

      setHasMore(hasMoreItems);
    } catch (err: any) {
      setError(err.message || 'Failed to load transformation history');
      console.error('History load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load on mount and when filters change
  useEffect(() => {
    loadHistory(true);
  }, [typeFilter, favoriteFilter]);

  const handleLoadToCanvas = (text: string) => {
    setText(text);
    // Optional: Show toast notification
    console.log('Loaded to Canvas:', text.substring(0, 50) + '...');
  };

  const handleToggleFavorite = async (id: string) => {
    try {
      const result = await api.toggleFavorite(id);

      // Update local state
      setItems(prev => prev.map(item =>
        item.id === id
          ? { ...item, is_favorite: result.is_favorite }
          : item
      ));
    } catch (err: any) {
      console.error('Toggle favorite error:', err);
      setError('Failed to toggle favorite');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteTransformation(id);

      // Remove from local state
      setItems(prev => prev.filter(item => item.id !== id));
    } catch (err: any) {
      console.error('Delete error:', err);
      setError('Failed to delete transformation');
    }
  };

  const handleLoadMore = () => {
    setOffset(prev => prev + limit);
    loadHistory(false);
  };

  // Client-side search filter
  const filteredItems = items.filter(item => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    return (
      item.input_text.toLowerCase().includes(query) ||
      item.output_text.toLowerCase().includes(query) ||
      item.transformation_type.toLowerCase().includes(query)
    );
  });

  const transformationTypes = [
    { id: 'all', label: 'All Types' },
    { id: 'allegorical', label: '🌟 Allegorical' },
    { id: 'round-trip', label: '🌍 Round-Trip' },
    { id: 'maieutic', label: '🤔 Maieutic' },
    { id: 'personalizer', label: '🎭 Personalizer' },
    { id: 'ai-detection', label: '🔍 AI Detection' },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="panel-header">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>📜 Transformation History</h2>
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          Browse and restore past transformations
        </p>
      </div>

      {/* Filters */}
      <div className="border-b p-4 space-y-3" style={{ borderColor: 'var(--border-color)' }}>
        {/* Search */}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
            Search
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search input or output text..."
            className="input w-full rounded px-3 py-2 text-sm"
          />
        </div>

        {/* Type Filter */}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
            Type
          </label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input w-full rounded px-3 py-2 text-sm"
          >
            {transformationTypes.map(type => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Favorite Filter */}
        <div className="flex gap-2">
          <button
            onClick={() => setFavoriteFilter(undefined)}
            className={`flex-1 rounded px-3 py-2 text-xs font-medium transition-colors ${
              favoriteFilter === undefined
                ? 'btn-primary'
                : 'btn-secondary'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFavoriteFilter(true)}
            className={`flex-1 rounded px-3 py-2 text-xs font-medium transition-colors ${
              favoriteFilter === true
                ? 'btn-primary'
                : 'btn-secondary'
            }`}
          >
            ⭐ Favorites
          </button>
        </div>

        {/* Refresh Button */}
        <button
          onClick={() => loadHistory(true)}
          disabled={loading}
          className="btn-secondary w-full rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? '⏳ Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div
          className="border-b px-4 py-3 text-sm"
          style={{
            borderColor: 'var(--accent-red)',
            background: 'rgba(220, 38, 38, 0.2)',
            color: 'var(--accent-red)',
          }}
        >
          {error}
        </div>
      )}

      {/* Results Count */}
      <div className="border-b px-4 py-2 text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
        {filteredItems.length > 0 ? (
          <>
            Showing {filteredItems.length} {filteredItems.length === 1 ? 'transformation' : 'transformations'}
            {searchQuery && ` matching "${searchQuery}"`}
          </>
        ) : loading ? (
          'Loading...'
        ) : (
          'No transformations found'
        )}
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredItems.length > 0 ? (
          <>
            {filteredItems.map(item => (
              <TransformationCard
                key={item.id}
                item={item}
                onLoadToCanvas={handleLoadToCanvas}
                onToggleFavorite={handleToggleFavorite}
                onDelete={handleDelete}
              />
            ))}

            {/* Load More Button */}
            {hasMore && !searchQuery && (
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="btn-secondary w-full rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {loading ? '⏳ Loading...' : 'Load More'}
              </button>
            )}
          </>
        ) : !loading && (
          <div className="text-center text-sm py-8" style={{ color: 'var(--text-secondary)' }}>
            {searchQuery ? (
              <>No transformations matching "{searchQuery}"</>
            ) : typeFilter !== 'all' ? (
              <>No {typeFilter} transformations yet</>
            ) : favoriteFilter ? (
              <>No favorite transformations yet<br />Star transformations to add them to favorites</>
            ) : (
              <>No transformation history yet<br />Your transformations will appear here automatically</>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
