/**
 * TypeScript types for Facebook archive import
 */

// ============================================================
// Raw Facebook JSON Structures
// ============================================================

export interface FacebookPost {
  timestamp: number;
  data?: FacebookPostData[];
  attachments?: FacebookAttachment[];
  title?: string;
  tags?: FacebookTag[];
  event?: FacebookEvent;
}

export interface FacebookPostData {
  post?: string;
  update_timestamp?: number;
}

export interface FacebookAttachment {
  data?: FacebookAttachmentData[];
}

export interface FacebookAttachmentData {
  external_context?: {
    url?: string;
    name?: string;
  };
  media?: {
    uri?: string;
    description?: string;
    media_metadata?: {
      photo_metadata?: {
        exif_data?: any[];
      };
      video_metadata?: {
        exif_data?: any[];
      };
    };
    title?: string;
    creation_timestamp?: number;
  };
  place?: {
    name?: string;
    coordinate?: {
      latitude: number;
      longitude: number;
    };
  };
  text?: string;
  name?: string;
}

export interface FacebookTag {
  name: string;
}

export interface FacebookEvent {
  name?: string;
  start_timestamp?: number;
  end_timestamp?: number;
}

export interface FacebookComment {
  timestamp: number;
  data?: FacebookCommentData[];
  title?: string;
}

export interface FacebookCommentData {
  comment?: {
    comment?: string;
    author?: string;
    timestamp?: number;
  };
}

export interface FacebookReaction {
  timestamp: number;
  data?: FacebookReactionData[];
  title?: string;
}

export interface FacebookReactionData {
  reaction?: {
    reaction?: string;
    actor?: string;
  };
}

export interface FacebookPhoto {
  uri: string;
  creation_timestamp: number;
  media_metadata?: {
    photo_metadata?: {
      exif_data?: any[];
      camera_make?: string;
      camera_model?: string;
    };
  };
  title?: string;
  description?: string;
  comments?: FacebookComment[];
}

export interface FacebookVideo {
  uri: string;
  creation_timestamp: number;
  thumbnail?: {
    uri: string;
  };
  media_metadata?: {
    video_metadata?: {
      exif_data?: any[];
    };
  };
  title?: string;
  description?: string;
}

// ============================================================
// Unified Content Model
// ============================================================

export interface ContentItem {
  id: string;
  type: 'post' | 'comment' | 'photo' | 'video' | 'message' | 'document';
  source: 'facebook' | 'openai' | 'claude' | 'instagram' | 'local';

  // Content
  text?: string;
  title?: string;

  // Timestamps
  created_at: number;              // Unix timestamp
  updated_at?: number;

  // Author
  author_name?: string;
  author_id?: string;
  is_own_content: boolean;

  // Relationships
  parent_id?: string;
  thread_id?: string;
  context?: string;                // "commented on David Morris's post"

  // File system
  file_path?: string;              // Path to folder on disk

  // Media
  media_refs?: string[];           // Array of file paths
  media_count?: number;

  // Metadata
  metadata?: any;                  // Source-specific data
  tags?: string[];

  // Embeddings
  embedding?: Float32Array;
  embedding_model?: string;

  // Search
  search_text?: string;
}

export interface MediaFile {
  id: string;
  content_item_id?: string;

  file_path: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;

  type: 'photo' | 'video' | 'audio' | 'document';
  width?: number;
  height?: number;
  duration?: number;

  taken_at?: number;
  uploaded_at?: number;

  caption?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    name?: string;
  };
  people_tagged?: string[];
  metadata?: any;

  embedding?: Float32Array;
  embedding_model?: string;
}

export interface Reaction {
  id: string;
  content_item_id: string;

  reaction_type: 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry';
  reactor_name?: string;
  reactor_id?: string;

  created_at: number;
}

// ============================================================
// Parsed Archive Structure
// ============================================================

export interface FacebookArchive {
  posts: FacebookPost[];
  comments: FacebookComment[];
  reactions: FacebookReaction[];
  photos: FacebookPhoto[];
  videos: FacebookVideo[];
  profile?: any;
}

// ============================================================
// Period Organization
// ============================================================

export interface PeriodSummary {
  period_folder: string;           // "Q1_2008-04-21_to_2008-07-19"
  start_date: number;              // Unix timestamp
  end_date: number;

  posts_count: number;
  comments_count: number;
  photos_count: number;
  videos_count: number;
  reactions_count: number;

  total_characters: number;
  media_size_bytes: number;
}

// ============================================================
// Import Progress
// ============================================================

export interface FacebookImportProgress {
  stage: 'parsing' | 'media' | 'organizing' | 'generating-html' | 'indexing' | 'embeddings' | 'complete';
  current: number;
  total: number;
  message?: string;
}

export interface FacebookImportResult {
  archive_id: string;              // "facebook_import_2025-11-18"
  import_date: number;
  settings: any;                   // ArchiveOrganizationSettings

  periods: PeriodSummary[];
  total_items: number;

  posts_imported: number;
  comments_imported: number;
  photos_imported: number;
  videos_imported: number;
  reactions_imported: number;

  errors?: string[];
}
