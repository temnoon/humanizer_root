/**
 * Lightbox Component
 *
 * Full-screen media viewer with navigation.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { MediaItem } from './types';

interface LightboxProps {
  /** Whether lightbox is open */
  isOpen: boolean;

  /** Media items to display */
  items: MediaItem[];

  /** Current index */
  currentIndex: number;

  /** Called to close lightbox */
  onClose: () => void;

  /** Called when navigating */
  onNavigate: (index: number) => void;

  /** Additional className */
  className?: string;
}

export function Lightbox({
  isOpen,
  items,
  currentIndex,
  onClose,
  onNavigate,
  className = '',
}: LightboxProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  const currentItem = items[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < items.length - 1;

  // Navigate to previous
  const goToPrev = useCallback(() => {
    if (hasPrev) {
      onNavigate(currentIndex - 1);
    }
  }, [hasPrev, currentIndex, onNavigate]);

  // Navigate to next
  const goToNext = useCallback(() => {
    if (hasNext) {
      onNavigate(currentIndex + 1);
    }
  }, [hasNext, currentIndex, onNavigate]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          goToPrev();
          break;
        case 'ArrowRight':
          goToNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, goToPrev, goToNext]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !currentItem) {
    return null;
  }

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <div
      className={`lightbox ${className}`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Media viewer"
    >
      <div ref={contentRef} className="lightbox__content">
        {/* Close button */}
        <button
          className="lightbox__close"
          onClick={onClose}
          aria-label="Close viewer"
        >
          ×
        </button>

        {/* Media display */}
        {currentItem.type === 'image' && (
          <img
            className="lightbox__media"
            src={currentItem.url}
            alt={currentItem.filename}
          />
        )}

        {currentItem.type === 'video' && (
          <video
            className="lightbox__media"
            src={currentItem.url}
            controls
            autoPlay
          />
        )}

        {currentItem.type === 'audio' && (
          <div className="lightbox__audio">
            <div className="lightbox__audio-icon">🎵</div>
            <audio src={currentItem.url} controls autoPlay />
          </div>
        )}

        {/* Navigation arrows */}
        {hasPrev && (
          <button
            className="lightbox__nav lightbox__nav--prev"
            onClick={goToPrev}
            aria-label="Previous"
          >
            ←
          </button>
        )}

        {hasNext && (
          <button
            className="lightbox__nav lightbox__nav--next"
            onClick={goToNext}
            aria-label="Next"
          >
            →
          </button>
        )}

        {/* Info bar */}
        <div className="lightbox__info">
          <span className="lightbox__title">
            {currentItem.context.containerTitle || currentItem.filename}
          </span>
          {currentItem.context.caption && (
            <span className="lightbox__caption">
              {currentItem.context.caption}
            </span>
          )}
          <span className="lightbox__counter">
            {currentIndex + 1} / {items.length}
          </span>
        </div>
      </div>
    </div>
  );
}

export default Lightbox;
