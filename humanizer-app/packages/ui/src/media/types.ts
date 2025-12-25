/**
 * Unified Media Types
 *
 * Common types for media from any source (OpenAI, Facebook, local, etc.)
 */

/** Media source identifier */
export type MediaSource = 'openai' | 'facebook' | 'local' | 'upload';

/** Media type */
export type MediaType = 'image' | 'video' | 'audio' | 'document';

/**
 * Unified media item - works for all sources
 */
export interface MediaItem {
  /** Unique identifier */
  id: string;

  /** Display URL (resolved, ready to use) */
  url: string;

  /** Thumbnail URL (if available) */
  thumbnailUrl?: string;

  /** Original filename */
  filename: string;

  /** Media type */
  type: MediaType;

  /** Source system */
  source: MediaSource;

  /** MIME type */
  mimeType?: string;

  /** Dimensions for images/video */
  width?: number;
  height?: number;

  /** File size in bytes */
  sizeBytes?: number;

  /** Duration for audio/video (seconds) */
  duration?: number;

  /** Creation timestamp */
  createdAt?: number;

  /** Context information */
  context: MediaContext;

  /** Additional metadata from source */
  metadata?: Record<string, unknown>;
}

/**
 * Context where the media appears
 */
export interface MediaContext {
  /** Parent container ID (conversation folder, album ID, etc.) */
  containerId: string;

  /** Parent container title */
  containerTitle: string;

  /** Index within container (message index, album position) */
  index?: number;

  /** Associated text/caption */
  caption?: string;

  /** Tags */
  tags?: string[];
}

/**
 * Gallery query parameters
 */
export interface MediaQueryParams {
  /** Source filter */
  source?: MediaSource;

  /** Type filter */
  type?: MediaType;

  /** Container filter (conversation, album) */
  containerId?: string;

  /** Search query */
  search?: string;

  /** Date range */
  startDate?: number;
  endDate?: number;

  /** Pagination */
  offset?: number;
  limit?: number;

  /** Sort */
  sortBy?: 'date' | 'name' | 'size';
  sortDir?: 'asc' | 'desc';
}

/**
 * Gallery response
 */
export interface MediaGalleryResponse {
  items: MediaItem[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Lightbox state
 */
export interface LightboxState {
  isOpen: boolean;
  currentIndex: number;
  items: MediaItem[];
}

/**
 * Gallery view mode
 */
export type GalleryViewMode = 'grid' | 'list' | 'timeline';

/**
 * Gallery configuration
 */
export interface GalleryConfig {
  /** View mode */
  viewMode: GalleryViewMode;

  /** Grid columns (for grid mode) */
  columns?: number;

  /** Show captions */
  showCaptions: boolean;

  /** Show metadata overlay on hover */
  showMetadataOnHover: boolean;

  /** Enable lazy loading */
  lazyLoad: boolean;

  /** Items per page for infinite scroll */
  pageSize: number;
}

export const DEFAULT_GALLERY_CONFIG: GalleryConfig = {
  viewMode: 'grid',
  columns: 4,
  showCaptions: true,
  showMetadataOnHover: true,
  lazyLoad: true,
  pageSize: 50,
};
