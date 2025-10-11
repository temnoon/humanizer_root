import { useState, useEffect } from 'react';
import api, { MediaItem } from '@/lib/api-client';
import './MediaGallery.css';

export default function MediaGallery() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedCount, setLoadedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    loadMedia();
  }, [currentPage]);

  const loadMedia = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await api.getMedia(currentPage, 50);

      setMedia(result.items);
      setTotalCount(result.total);
      setTotalPages(result.total_pages);
      setLoadedCount(result.items.length);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load media:', err);
      setError(err instanceof Error ? err.message : 'Failed to load media');
      setLoading(false);
    }
  };

  const getMediaUrl = (item: MediaItem): string => {
    // Universal media endpoint - works for all sources
    if (item.file_path) {
      return api.getMediaFile(item.file_id);
    }
    // Fallback to placeholder
    return `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><rect fill='%23374151' width='200' height='200'/><text x='50%' y='50%' text-anchor='middle' fill='%239ca3af' font-size='16' dy='.3em'>No Image</text></svg>`;
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading && loadedCount === 0) {
    return (
      <div className="media-gallery-loading">
        <div className="loading-spinner"></div>
        <p className="loading-text">Loading media library...</p>
        {totalCount > 0 && (
          <p className="loading-progress">
            {loadedCount} / {totalCount}
          </p>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="media-gallery-error">
        <p className="error-icon">⚠️</p>
        <p className="error-text">{error}</p>
        <button className="retry-button" onClick={loadMedia}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="media-gallery">
      {/* Header */}
      <div className="media-gallery-header">
        <div className="media-stats">
          <p className="media-count">{totalCount} images</p>
          <p className="media-page">
            Page {currentPage} of {totalPages}
          </p>
        </div>

        <div className="media-controls">
          <button
            className={`view-toggle ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
          >
            ▦
          </button>
          <button
            className={`view-toggle ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            aria-label="List view"
          >
            ☰
          </button>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className={`media-grid ${viewMode}`}>
        {media.map((item) => (
          <div
            key={item.file_id}
            className="media-item"
            onClick={() => setSelectedMedia(item)}
          >
            <div className="media-thumbnail">
              <img
                src={getMediaUrl(item)}
                alt={item.filename || item.file_id}
                loading="lazy"
              />
            </div>

            {viewMode === 'list' && (
              <div className="media-info">
                <p className="media-filename">
                  {item.filename || item.file_id}
                </p>
                <div className="media-meta">
                  <span>{formatFileSize(item.size_bytes)}</span>
                  {item.width && item.height && (
                    <span>
                      {item.width} × {item.height}
                    </span>
                  )}
                  <span>{formatDate(item.created_at)}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="media-pagination">
          <button
            className="pagination-button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            ← Previous
          </button>

          <span className="pagination-info">
            Page {currentPage} of {totalPages}
          </span>

          <button
            className="pagination-button"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next →
          </button>
        </div>
      )}

      {/* Lightbox Modal */}
      {selectedMedia && (
        <div className="media-lightbox" onClick={() => setSelectedMedia(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="lightbox-close"
              onClick={() => setSelectedMedia(null)}
              aria-label="Close"
            >
              ×
            </button>

            <div className="lightbox-image">
              <img
                src={getMediaUrl(selectedMedia)}
                alt={selectedMedia.filename || selectedMedia.file_id}
              />
            </div>

            <div className="lightbox-metadata">
              <h3>Image Details</h3>

              <div className="metadata-grid">
                <div className="metadata-item">
                  <span className="metadata-label">File ID:</span>
                  <span className="metadata-value">{selectedMedia.file_id}</span>
                </div>

                {selectedMedia.filename && (
                  <div className="metadata-item">
                    <span className="metadata-label">Filename:</span>
                    <span className="metadata-value">{selectedMedia.filename}</span>
                  </div>
                )}

                {selectedMedia.size_bytes && (
                  <div className="metadata-item">
                    <span className="metadata-label">Size:</span>
                    <span className="metadata-value">
                      {formatFileSize(selectedMedia.size_bytes)}
                    </span>
                  </div>
                )}

                {selectedMedia.width && selectedMedia.height && (
                  <div className="metadata-item">
                    <span className="metadata-label">Dimensions:</span>
                    <span className="metadata-value">
                      {selectedMedia.width} × {selectedMedia.height} px
                    </span>
                  </div>
                )}

                {selectedMedia.content_type && (
                  <div className="metadata-item">
                    <span className="metadata-label">Type:</span>
                    <span className="metadata-value">{selectedMedia.content_type}</span>
                  </div>
                )}

                <div className="metadata-item">
                  <span className="metadata-label">Created:</span>
                  <span className="metadata-value">
                    {formatDate(selectedMedia.created_at)}
                  </span>
                </div>

                {selectedMedia.source_archive && (
                  <div className="metadata-item">
                    <span className="metadata-label">Archive:</span>
                    <span className="metadata-value">{selectedMedia.source_archive}</span>
                  </div>
                )}

                {selectedMedia.file_path && (
                  <div className="metadata-item full-width">
                    <span className="metadata-label">Path:</span>
                    <span className="metadata-value metadata-path">
                      {selectedMedia.file_path}
                    </span>
                  </div>
                )}
              </div>

              <div className="lightbox-actions">
                <button
                  className="action-button"
                  onClick={() => navigator.clipboard.writeText(selectedMedia.file_id)}
                >
                  Copy File ID
                </button>
                {selectedMedia.file_path && (
                  <button
                    className="action-button"
                    onClick={() => window.open(getMediaUrl(selectedMedia), '_blank')}
                  >
                    View Full Size
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
