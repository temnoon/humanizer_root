/**
 * Archive Tab Types
 */

export type ArchiveTabId =
  | 'conversations'
  | 'gallery'
  | 'import'
  | 'books'
  | 'facebook'
  | 'explore';

/**
 * Selected Facebook Media - for display in main workspace
 */
/**
 * Content item that links to media (post/comment)
 */
export interface LinkedContentItem {
  id: string;
  type: 'post' | 'comment';
  title?: string;
  text?: string;
  created_at: number;
  author_name?: string;
}

export interface SelectedFacebookMedia {
  id: string;
  file_path: string;
  filename: string;
  media_type: 'image' | 'video';
  file_size: number;
  width?: number;
  height?: number;
  created_at: number;
  description?: string;
  context?: {
    album?: string;
    post_title?: string;
  };
  related_post_id?: string;
  // Posts/comments that reference this media
  linkedContent?: LinkedContentItem[];
  // Context for album/post navigation
  relatedMedia?: Array<{
    id: string;
    file_path: string;
    media_type: 'image' | 'video';
    created_at?: number;
  }>;
}

export interface ArchiveTabDefinition {
  id: ArchiveTabId;
  icon: string;
  label: string;
  description: string;
}

export const ARCHIVE_TABS: ArchiveTabDefinition[] = [
  { id: 'conversations', icon: '💬', label: 'Chat', description: 'ChatGPT conversations' },
  { id: 'gallery', icon: '🖼️', label: 'Gallery', description: 'Images and audio files' },
  { id: 'import', icon: '📥', label: 'Import', description: 'Import archives' },
  { id: 'books', icon: '📚', label: 'Books', description: 'Book projects' },
  { id: 'facebook', icon: '👤', label: 'Social', description: 'Facebook archive' },
  { id: 'explore', icon: '🔍', label: 'Explore', description: 'Semantic search' },
];
