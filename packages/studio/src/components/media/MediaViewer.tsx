/**
 * MediaViewer - Lightbox Media Viewer
 *
 * Full-screen viewer for media items with:
 * - Image display with zoom
 * - Audio/video player integration
 * - Navigation between items
 * - Transcription panel toggle
 * - Keyboard shortcuts
 *
 * @module @humanizer/studio/components/media/MediaViewer
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaItem } from '../../contexts/MediaContext';
import { MediaPlayer } from './MediaPlayer';
import { TranscriptionPanel } from './TranscriptionPanel';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface MediaViewerProps {
  /** Media item to display */
  item: MediaItem;
  /** All items for navigation */
  items?: MediaItem[];
  /** Called when viewer should close */
  onClose?: () => void;
  /** Called when navigation occurs */
  onNavigate?: (item: MediaItem) => void;
  /** Called when transcription is requested */
  onRequestTranscription?: (item: MediaItem) => void;
  /** Archive ID for transcription context */
  archiveId?: string;
  /** Optional class name */
  className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function MediaViewer({
  item,
  items = [],
  onClose,
  onNavigate,
  onRequestTranscription,
  archiveId,
  className = '',
}: MediaViewerProps): React.ReactElement {
  // State
  const [showTranscription, setShowTranscription] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);

  // Navigation helpers
  const currentIndex = items.findIndex((i) => i.id === item.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < items.length - 1;

  // Navigate to previous item
  const goToPrev = useCallback(() => {
    if (hasPrev && items[currentIndex - 1]) {
      onNavigate?.(items[currentIndex - 1]);
    }
  }, [hasPrev, items, currentIndex, onNavigate]);

  // Navigate to next item
  const goToNext = useCallback(() => {
    if (hasNext && items[currentIndex + 1]) {
      onNavigate?.(items[currentIndex + 1]);
    }
  }, [hasNext, items, currentIndex, onNavigate]);

  // Toggle transcription panel
  const toggleTranscription = useCallback(() => {
    setShowTranscription((prev) => !prev);
  }, []);

  // Toggle zoom (images only)
  const toggleZoom = useCallback(() => {
    if (item.type === 'image') {
      setIsZoomed((prev) => !prev);
    }
  }, [item.type]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose?.();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          goToPrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goToNext();
          break;
        case 't':
        case 'T':
          e.preventDefault();
          toggleTranscription();
          break;
        case '+':
        case '=':
          e.preventDefault();
          if (item.type === 'image') setIsZoomed(true);
          break;
        case '-':
          e.preventDefault();
          if (item.type === 'image') setIsZoomed(false);
          break;
        case '0':
          e.preventDefault();
          if (item.type === 'image') setIsZoomed(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrev, goToNext, toggleTranscription, onClose, item.type]);

  // Focus container on mount
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose?.();
      }
    },
    [onClose]
  );

  // Handle time update from player
  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  // Handle segment click from transcription
  const handleSegmentClick = useCallback((startTime: number) => {
    setCurrentTime(startTime);
    // The MediaPlayer will seek to this time via its currentTime prop
  }, []);

  const isPlayable = item.type === 'audio' || item.type === 'video';
  const hasTranscription = item.transcriptionCount > 0;

  return (
    <div
      ref={containerRef}
      className={`media-viewer ${showTranscription ? 'media-viewer--with-transcript' : ''} ${className}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Viewing ${item.filename}`}
      tabIndex={-1}
      onClick={handleBackdropClick}
    >
      {/* Close Button */}
      <button
        className="media-viewer__close"
        onClick={onClose}
        aria-label="Close viewer (Escape)"
      >
        ×
      </button>

      {/* Navigation Arrows */}
      {items.length > 1 && (
        <>
          <button
            className="media-viewer__nav media-viewer__nav--prev"
            onClick={goToPrev}
            disabled={!hasPrev}
            aria-label="Previous (Left arrow)"
          >
            ‹
          </button>
          <button
            className="media-viewer__nav media-viewer__nav--next"
            onClick={goToNext}
            disabled={!hasNext}
            aria-label="Next (Right arrow)"
          >
            ›
          </button>
        </>
      )}

      {/* Main Content Area */}
      <div className="media-viewer__content">
        {/* Media Display */}
        <div className={`media-viewer__media ${isZoomed ? 'media-viewer__media--zoomed' : ''}`}>
          {item.type === 'image' ? (
            <img
              className="media-viewer__image"
              src={item.sourceUrl}
              alt={item.filename}
              onClick={toggleZoom}
            />
          ) : (
            <MediaPlayer
              item={item}
              currentTime={currentTime}
              onTimeUpdate={handleTimeUpdate}
              autoPlay={false}
            />
          )}
        </div>

        {/* Transcription Panel */}
        {showTranscription && (
          <div className="media-viewer__transcript">
            <TranscriptionPanel
              mediaId={item.id}
              archiveId={archiveId}
              currentTime={isPlayable ? currentTime : undefined}
              onSegmentClick={isPlayable ? handleSegmentClick : undefined}
              onRequestTranscription={
                !hasTranscription ? () => onRequestTranscription?.(item) : undefined
              }
            />
          </div>
        )}
      </div>

      {/* Bottom Toolbar */}
      <div className="media-viewer__toolbar">
        {/* File Info */}
        <div className="media-viewer__info">
          <span className="media-viewer__filename">{item.filename}</span>
          <span className="media-viewer__meta">
            {item.type}
            {item.dimensions && ` • ${item.dimensions.width}×${item.dimensions.height}`}
            {item.duration !== undefined && ` • ${formatDuration(item.duration)}`}
          </span>
        </div>

        {/* Actions */}
        <div className="media-viewer__actions">
          {/* Transcription Toggle */}
          <button
            className={`media-viewer__action ${showTranscription ? 'media-viewer__action--active' : ''}`}
            onClick={toggleTranscription}
            aria-pressed={showTranscription}
            aria-label="Toggle transcription (T)"
          >
            <span aria-hidden="true">📝</span>
            <span>{hasTranscription ? `${item.transcriptionCount}` : 'Transcribe'}</span>
          </button>

          {/* Zoom (images only) */}
          {item.type === 'image' && (
            <button
              className={`media-viewer__action ${isZoomed ? 'media-viewer__action--active' : ''}`}
              onClick={toggleZoom}
              aria-pressed={isZoomed}
              aria-label={isZoomed ? 'Zoom out (-)' : 'Zoom in (+)'}
            >
              <span aria-hidden="true">{isZoomed ? '🔍-' : '🔍+'}</span>
            </button>
          )}
        </div>

        {/* Position Indicator */}
        {items.length > 1 && (
          <div className="media-viewer__position">
            {currentIndex + 1} / {items.length}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function
function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default MediaViewer;
