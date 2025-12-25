/**
 * Gallery View - Media browser with images from archive
 */

import { useState, useEffect, useCallback } from 'react';

interface GalleryImage {
  url: string;
  filename: string;
  conversationFolder: string;
  conversationTitle: string;
  conversationCreatedAt: number | null;
  messageIndex: number;
  width?: number;
  height?: number;
  sizeBytes?: number;
}

interface GalleryResponse {
  images: GalleryImage[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

interface LightboxState {
  isOpen: boolean;
  currentIndex: number;
}

export function GalleryView() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lightbox, setLightbox] = useState<LightboxState>({ isOpen: false, currentIndex: 0 });

  const loadGallery = useCallback(async (append = false) => {
    if (!append) {
      setLoading(true);
    }
    setError(null);

    try {
      const offset = append ? images.length : 0;
      const params = new URLSearchParams({
        limit: '50',
        offset: offset.toString(),
      });

      if (searchQuery) {
        params.set('search', searchQuery);
      }

      const response = await fetch(`http://localhost:3002/api/gallery?${params}`);

      if (!response.ok) {
        throw new Error('Failed to load gallery');
      }

      const data: GalleryResponse = await response.json();

      if (append) {
        setImages(prev => [...prev, ...data.images]);
      } else {
        setImages(data.images);
      }
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch (err) {
      console.error('Gallery error:', err);
      setImages([]);
      setError('No images found. Import a ChatGPT archive with images to see your gallery.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, images.length]);

  useEffect(() => {
    loadGallery(false);
  }, [searchQuery]);

  const openLightbox = (index: number) => {
    setLightbox({ isOpen: true, currentIndex: index });
  };

  const closeLightbox = () => {
    setLightbox({ isOpen: false, currentIndex: 0 });
  };

  const navigateLightbox = (delta: number) => {
    setLightbox(prev => ({
      ...prev,
      currentIndex: Math.max(0, Math.min(images.length - 1, prev.currentIndex + delta)),
    }));
  };

  // Handle keyboard navigation in lightbox
  useEffect(() => {
    if (!lightbox.isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') navigateLightbox(-1);
      if (e.key === 'ArrowRight') navigateLightbox(1);
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightbox.isOpen, images.length]);

  if (loading && images.length === 0) {
    return (
      <div className="archive-browser__loading">
        Loading gallery...
      </div>
    );
  }

  return (
    <div className="media-gallery">
      {/* Search and filters */}
      <div className="archive-browser__filters">
        <input
          type="text"
          className="archive-browser__search"
          placeholder="Search images..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {total > 0 && (
          <span className="archive-browser__info-count">
            {images.length} of {total} images
          </span>
        )}
      </div>

      {/* Error/empty state */}
      {error && images.length === 0 && (
        <div className="tool-panel__empty">
          <p>{error}</p>
        </div>
      )}

      {/* Image grid */}
      {images.length > 0 ? (
        <>
          <div className="media-gallery__grid">
            {images.map((image, index) => (
              <div
                key={`${image.conversationFolder}-${image.filename}`}
                className="media-gallery__item"
                onClick={() => openLightbox(index)}
                title={image.conversationTitle}
              >
                <img
                  src={image.url}
                  alt={image.filename}
                  loading="lazy"
                />
                <div className="media-gallery__item-overlay">
                  <span className="media-gallery__item-title">{image.conversationTitle}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Load more button */}
          {hasMore && (
            <div className="media-gallery__load-more">
              <button
                className="archive-browser__btn"
                onClick={() => loadGallery(true)}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      ) : !error && (
        <div className="tool-panel__empty">
          <p>No images found</p>
          <span className="tool-panel__muted">Import a ChatGPT archive to see your images</span>
        </div>
      )}

      {/* Lightbox */}
      {lightbox.isOpen && images[lightbox.currentIndex] && (
        <div className="lightbox" onClick={closeLightbox}>
          <div className="lightbox__content" onClick={e => e.stopPropagation()}>
            <button className="lightbox__close" onClick={closeLightbox}>×</button>
            <img
              className="lightbox__image"
              src={images[lightbox.currentIndex].url}
              alt={images[lightbox.currentIndex].filename}
            />
            <div className="lightbox__info">
              <span className="lightbox__title">{images[lightbox.currentIndex].conversationTitle}</span>
            </div>
            {lightbox.currentIndex > 0 && (
              <button
                className="lightbox__nav lightbox__nav--prev"
                onClick={(e) => { e.stopPropagation(); navigateLightbox(-1); }}
              >
                ←
              </button>
            )}
            {lightbox.currentIndex < images.length - 1 && (
              <button
                className="lightbox__nav lightbox__nav--next"
                onClick={(e) => { e.stopPropagation(); navigateLightbox(1); }}
              >
                →
              </button>
            )}
            <div className="lightbox__counter">
              {lightbox.currentIndex + 1} / {images.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
