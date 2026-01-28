/**
 * MediaThumbnail - Individual Media Item Thumbnail
 *
 * Displays a thumbnail for a media item with:
 * - Type badge (image/audio/video)
 * - Duration for audio/video
 * - Transcription indicator
 * - Selection checkbox
 * - Hover overlay with actions
 *
 * @module @humanizer/studio/components/media/MediaThumbnail
 */

import React, { useCallback, useRef } from 'react';
import type { MediaItem } from '../../contexts/MediaContext';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface MediaThumbnailProps {
  /** Media item to display */
  item: MediaItem;
  /** Whether this item is selected */
  isSelected?: boolean;
  /** Whether selection mode is active */
  selectionMode?: boolean;
  /** Called when item is clicked */
  onClick?: (item: MediaItem) => void;
  /** Called when selection is toggled */
  onToggleSelect?: (item: MediaItem) => void;
  /** Called when play is requested */
  onPlay?: (item: MediaItem) => void;
  /** Called when transcription is requested */
  onTranscribe?: (item: MediaItem) => void;
  /** Optional class name */
  className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Format duration in seconds to MM:SS or HH:MM:SS */
function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Get icon for media type */
function getTypeIcon(type: MediaItem['type']): string {
  switch (type) {
    case 'image':
      return '🖼️';
    case 'audio':
      return '🎵';
    case 'video':
      return '🎬';
    default:
      return '📁';
  }
}

/** Get default thumbnail based on type */
function getDefaultThumbnail(type: MediaItem['type']): string {
  switch (type) {
    case 'audio':
      return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23374151" width="100" height="100"/%3E%3Ctext x="50" y="55" text-anchor="middle" fill="%239CA3AF" font-size="30"%3E🎵%3C/text%3E%3C/svg%3E';
    case 'video':
      return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23374151" width="100" height="100"/%3E%3Ctext x="50" y="55" text-anchor="middle" fill="%239CA3AF" font-size="30"%3E🎬%3C/text%3E%3C/svg%3E';
    default:
      return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23374151" width="100" height="100"/%3E%3Ctext x="50" y="55" text-anchor="middle" fill="%239CA3AF" font-size="30"%3E🖼️%3C/text%3E%3C/svg%3E';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function MediaThumbnail({
  item,
  isSelected = false,
  selectionMode = false,
  onClick,
  onToggleSelect,
  onPlay,
  onTranscribe,
  className = '',
}: MediaThumbnailProps): React.ReactElement {
  const checkboxRef = useRef<HTMLInputElement>(null);

  // Handle click
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // If clicking checkbox area or in selection mode, toggle selection
      if (selectionMode || e.shiftKey || e.metaKey || e.ctrlKey) {
        e.preventDefault();
        onToggleSelect?.(item);
      } else {
        onClick?.(item);
      }
    },
    [item, selectionMode, onClick, onToggleSelect]
  );

  // Handle checkbox change
  const handleCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      onToggleSelect?.(item);
    },
    [item, onToggleSelect]
  );

  // Handle keyboard
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (e.shiftKey || selectionMode) {
          onToggleSelect?.(item);
        } else {
          onClick?.(item);
        }
      }
    },
    [item, selectionMode, onClick, onToggleSelect]
  );

  // Handle play button
  const handlePlay = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onPlay?.(item);
    },
    [item, onPlay]
  );

  // Handle transcribe button
  const handleTranscribe = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onTranscribe?.(item);
    },
    [item, onTranscribe]
  );

  const thumbnailUrl = item.thumbnailUrl || getDefaultThumbnail(item.type);
  const hasTranscription = item.transcriptionCount > 0;
  const isPlayable = item.type === 'audio' || item.type === 'video';

  return (
    <div
      className={`media-thumb media-thumb--${item.type} ${isSelected ? 'media-thumb--selected' : ''} ${className}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="gridcell"
      aria-selected={isSelected}
      aria-label={`${item.filename}, ${item.type}${hasTranscription ? ', has transcription' : ''}`}
    >
      {/* Thumbnail Image */}
      <img
        className="media-thumb__image"
        src={thumbnailUrl}
        alt={item.filename}
        loading="lazy"
      />

      {/* Selection Checkbox */}
      {(selectionMode || isSelected) && (
        <input
          ref={checkboxRef}
          type="checkbox"
          className="media-thumb__checkbox"
          checked={isSelected}
          onChange={handleCheckboxChange}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${item.filename}`}
        />
      )}

      {/* Transcription Badge */}
      {hasTranscription && (
        <div
          className="media-thumb__transcript-badge"
          title={`${item.transcriptionCount} transcription${item.transcriptionCount !== 1 ? 's' : ''}`}
        >
          {item.transcriptionCount}
        </div>
      )}

      {/* Duration Badge (for audio/video) */}
      {isPlayable && item.duration !== undefined && (
        <div className="media-thumb__duration">
          {formatDuration(item.duration)}
        </div>
      )}

      {/* Type Badge */}
      <div className={`media-thumb__type-badge media-thumb__type-badge--${item.type}`}>
        {item.type}
      </div>

      {/* Hover Overlay */}
      <div className="media-thumb__overlay">
        <div className="media-thumb__actions">
          {isPlayable && (
            <button
              className="media-thumb__action media-thumb__action--play"
              onClick={handlePlay}
              aria-label={`Play ${item.filename}`}
            >
              ▶
            </button>
          )}
          {!hasTranscription && (
            <button
              className="media-thumb__action media-thumb__action--transcribe"
              onClick={handleTranscribe}
              aria-label={`Transcribe ${item.filename}`}
            >
              🎙️
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default MediaThumbnail;
