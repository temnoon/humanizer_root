import { useEffect, useCallback } from 'react';
import type { GalleryImage } from '../../types';
import { Icons } from '../layout/Icons';

interface ImageLightboxProps {
  image: GalleryImage;
  images: GalleryImage[];
  onClose: () => void;
  onViewConversation: (image: GalleryImage) => void;
}

export function ImageLightbox({ image, images, onClose, onViewConversation }: ImageLightboxProps) {
  // Get all images from the same conversation (for left/right navigation)
  const conversationImages = images.filter(
    img => img.conversationFolder === image.conversationFolder
  );
  const currentIndex = conversationImages.findIndex(img => img.url === image.url);

  // Get unique conversation folders (for up/down navigation)
  const conversationFolders = Array.from(new Set(images.map(img => img.conversationFolder)));
  const currentConvIndex = conversationFolders.indexOf(image.conversationFolder);

  // Navigation functions
  const goToNextImage = useCallback(() => {
    if (conversationImages.length === 0) return;
    const nextIndex = (currentIndex + 1) % conversationImages.length;
    const nextImage = conversationImages[nextIndex];
    window.dispatchEvent(new CustomEvent('lightbox-navigate', { detail: nextImage }));
  }, [conversationImages, currentIndex]);

  const goToPrevImage = useCallback(() => {
    if (conversationImages.length === 0) return;
    const prevIndex = (currentIndex - 1 + conversationImages.length) % conversationImages.length;
    const prevImage = conversationImages[prevIndex];
    window.dispatchEvent(new CustomEvent('lightbox-navigate', { detail: prevImage }));
  }, [conversationImages, currentIndex]);

  const goToNextConversation = useCallback(() => {
    if (conversationFolders.length === 0) return;
    const nextConvIndex = (currentConvIndex + 1) % conversationFolders.length;

    // If we're near the end of loaded images, request more
    if (nextConvIndex > conversationFolders.length - 5) {
      window.dispatchEvent(new CustomEvent('gallery-load-more'));
    }

    const nextFolder = conversationFolders[nextConvIndex];
    const firstImageInConv = images.find(img => img.conversationFolder === nextFolder);
    if (firstImageInConv) {
      window.dispatchEvent(new CustomEvent('lightbox-navigate', { detail: firstImageInConv }));
    }
  }, [conversationFolders, currentConvIndex, images]);

  const goToPrevConversation = useCallback(() => {
    if (conversationFolders.length === 0) return;
    const prevConvIndex = (currentConvIndex - 1 + conversationFolders.length) % conversationFolders.length;
    const prevFolder = conversationFolders[prevConvIndex];
    const firstImageInConv = images.find(img => img.conversationFolder === prevFolder);
    if (firstImageInConv) {
      window.dispatchEvent(new CustomEvent('lightbox-navigate', { detail: firstImageInConv }));
    }
  }, [conversationFolders, currentConvIndex, images]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          goToPrevImage();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goToNextImage();
          break;
        case 'ArrowUp':
          e.preventDefault();
          goToPrevConversation();
          break;
        case 'ArrowDown':
          e.preventDefault();
          goToNextConversation();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goToNextImage, goToPrevImage, goToNextConversation, goToPrevConversation]);

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={onClose}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 'var(--space-lg)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          flexShrink: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-xs)' }}>
            <div className="heading-sm" style={{ color: 'white' }}>
              {image.conversationTitle}
            </div>
            <button
              onClick={() => onViewConversation(image)}
              className="btn-primary"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                color: 'black',
                fontSize: '0.875rem',
                padding: '0.375rem 0.75rem',
              }}
            >
              View Conversation →
            </button>
          </div>
          <div className="text-small" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            {image.width && image.height && `${image.width}×${image.height} • `}
            {formatFileSize(image.sizeBytes)}
            {conversationImages.length > 1 && ` • ${currentIndex + 1} of ${conversationImages.length}`}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-md hover:bg-white/10 transition-smooth"
          style={{ color: 'white' }}
        >
          <Icons.Close />
        </button>
      </div>

      {/* Main image */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-xl)',
          position: 'relative',
          minHeight: 0, // Important for flexbox
          maxHeight: 'calc(100vh - 200px)', // Leave room for header and footer
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={image.url}
          alt={image.conversationTitle}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            borderRadius: '4px',
          }}
        />

        {/* Navigation buttons */}
        {conversationImages.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToPrevImage();
              }}
              className="lightbox-nav-button"
              style={{
                position: 'absolute',
                left: 'var(--space-lg)',
                top: '50%',
                transform: 'translateY(-50%)',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '50%',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
            >
              ←
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToNextImage();
              }}
              className="lightbox-nav-button"
              style={{
                position: 'absolute',
                right: 'var(--space-lg)',
                top: '50%',
                transform: 'translateY(-50%)',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '50%',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
            >
              →
            </button>
          </>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: 'var(--space-lg)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          flexShrink: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-small" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
          ← → Navigate images • ↑ ↓ Switch conversations • Esc Close
        </div>
      </div>
    </div>
  );
}
