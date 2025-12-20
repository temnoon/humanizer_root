/**
 * GalleryGridView - Image gallery grid with search, source toggle, and load more
 *
 * Extracted from ArchivePanel.tsx for reusability and maintainability.
 */

import { Icons } from '../layout/Icons';
import type { GalleryImage } from '../../types';

type GallerySource = 'openai' | 'facebook';

interface GalleryGridViewProps {
  // Data
  images: GalleryImage[];
  total: number;
  hasMore: boolean;
  loading: boolean;

  // Filter state
  folder?: string;  // If set, filtering by conversation
  source: GallerySource;
  searchQuery: string;

  // Actions
  onSourceChange: (source: GallerySource) => void;
  onSearchChange: (query: string) => void;
  onLoadMore: () => void;
  onImageClick: (image: GalleryImage) => void;
}

export function GalleryGridView({
  images,
  total,
  hasMore,
  loading,
  folder,
  source,
  searchQuery,
  onSourceChange,
  onSearchChange,
  onLoadMore,
  onImageClick,
}: GalleryGridViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Gallery-specific header */}
      <div style={{ padding: 'var(--space-md)', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        {/* Source Toggle - compact (only when not filtering by folder) */}
        {!folder && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
            <button
              onClick={() => onSourceChange('openai')}
              style={{
                padding: '6px 10px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                backgroundColor: source === 'openai' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                color: source === 'openai' ? 'white' : 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              OpenAI
            </button>
            <button
              onClick={() => onSourceChange('facebook')}
              style={{
                padding: '6px 10px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                backgroundColor: source === 'facebook' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                color: source === 'facebook' ? 'white' : 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              📘 Facebook
            </button>
          </div>
        )}

        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
          {total.toLocaleString()} images • {images.length} loaded
        </div>

        {/* Gallery search - compact */}
        <div className="relative">
          <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none u-text-tertiary">
            <Icons.Search />
          </div>
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              paddingLeft: '2.5rem',
              paddingRight: searchQuery ? '2.5rem' : '0.75rem',
              paddingTop: '0.5rem',
              paddingBottom: '0.5rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8125rem',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <Icons.Close />
            </button>
          )}
        </div>
      </div>

      {/* Gallery grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-md)', minHeight: 0 }}>
        {loading && images.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 'var(--space-xl)' }}>
            Loading images...
          </div>
        ) : (
          <>
            {/* Image grid - responsive columns */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                gap: 'var(--space-sm)',
              }}
            >
              {images.map((img, idx) => (
                <div
                  key={idx}
                  className="gallery-image-item"
                  onClick={() => onImageClick(img)}
                  style={{
                    position: 'relative',
                    aspectRatio: '1',
                    overflow: 'hidden',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg-tertiary)',
                    cursor: 'pointer',
                    transition: 'opacity 0.2s',
                  }}
                >
                  <img
                    src={img.url}
                    alt={img.conversationTitle}
                    loading="lazy"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                  {/* Hover overlay with title */}
                  <div
                    className="gallery-image-overlay"
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
                      padding: 'var(--space-xs)',
                      pointerEvents: 'none',
                    }}
                  >
                    <div className="text-tiny" style={{ color: 'white', fontWeight: 600 }}>
                      {img.conversationTitle}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Empty state */}
            {images.length === 0 && !loading && (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 'var(--space-xl)' }}>
                No images found
              </div>
            )}

            {/* Load more button */}
            {hasMore && (
              <button
                onClick={onLoadMore}
                disabled={loading}
                className="btn-secondary mt-4 w-full"
                style={{
                  opacity: loading ? 0.5 : 1,
                }}
              >
                {loading ? 'Loading...' : `Load More (${images.length} of ${total})`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
