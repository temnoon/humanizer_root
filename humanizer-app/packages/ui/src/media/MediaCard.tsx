/**
 * MediaCard Component
 *
 * Individual media item display for grid/list views.
 */

import { useCallback, useState, type KeyboardEvent } from 'react';
import type { MediaItem, MediaType } from './types';

interface MediaCardProps {
  /** Media item to display */
  item: MediaItem;

  /** Called when card is clicked */
  onClick?: (item: MediaItem) => void;

  /** Whether this card is selected */
  isSelected?: boolean;

  /** Show type badge */
  showTypeBadge?: boolean;

  /** Show metadata on hover */
  showMetadataOnHover?: boolean;

  /** Additional className */
  className?: string;
}

const TYPE_ICONS: Record<MediaType, string> = {
  image: '🖼️',
  video: '🎬',
  audio: '🎵',
  document: '📄',
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaCard({
  item,
  onClick,
  isSelected = false,
  showTypeBadge = false,
  showMetadataOnHover = true,
  className = '',
}: MediaCardProps) {
  const [imageError, setImageError] = useState(false);

  const handleClick = useCallback(() => {
    onClick?.(item);
  }, [item, onClick]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick?.(item);
      }
    },
    [item, onClick]
  );

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  const cardClasses = [
    'media-card',
    isSelected && 'media-card--selected',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const thumbnailUrl = item.thumbnailUrl || item.url;

  return (
    <div
      className={cardClasses}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${item.type}: ${item.filename}`}
      aria-selected={isSelected}
    >
      {/* Media thumbnail */}
      {!imageError ? (
        <img
          className="media-card__image"
          src={thumbnailUrl}
          alt={item.filename}
          loading="lazy"
          onError={handleImageError}
        />
      ) : (
        <div className="media-card__placeholder">
          <span>{TYPE_ICONS[item.type]}</span>
        </div>
      )}

      {/* Type badge */}
      {showTypeBadge && item.type !== 'image' && (
        <span className="media-card__type-badge">
          {TYPE_ICONS[item.type]}
        </span>
      )}

      {/* Duration for audio/video */}
      {item.duration && (
        <span className="media-card__duration">
          {formatDuration(item.duration)}
        </span>
      )}

      {/* Hover overlay with metadata */}
      {showMetadataOnHover && (
        <div className="media-card__overlay">
          <span className="media-card__title">
            {item.context.containerTitle || item.filename}
          </span>
          {item.sizeBytes && (
            <span className="media-card__meta">
              {formatFileSize(item.sizeBytes)}
              {item.width && item.height && ` • ${item.width}×${item.height}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * List view variant of MediaCard
 */
interface MediaListItemProps extends MediaCardProps {}

export function MediaListItem({
  item,
  onClick,
  isSelected = false,
  className = '',
}: MediaListItemProps) {
  const handleClick = useCallback(() => {
    onClick?.(item);
  }, [item, onClick]);

  const thumbnailUrl = item.thumbnailUrl || item.url;

  return (
    <div
      className={`media-list-item ${isSelected ? 'media-list-item--selected' : ''} ${className}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      <img
        className="media-list-item__thumb"
        src={thumbnailUrl}
        alt={item.filename}
        loading="lazy"
      />
      <div className="media-list-item__info">
        <div className="media-list-item__title">
          {item.context.containerTitle || item.filename}
        </div>
        <div className="media-list-item__meta">
          {item.filename}
          {item.sizeBytes && ` • ${formatFileSize(item.sizeBytes)}`}
        </div>
      </div>
    </div>
  );
}

export default MediaCard;
