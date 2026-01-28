/**
 * Book Studio Types
 *
 * Local type definitions for the book studio components.
 * These mirror the core types but are defined locally to avoid
 * cross-package dependencies in the studio.
 *
 * @module @humanizer/studio/components/book/types
 */

// ═══════════════════════════════════════════════════════════════════════════
// NARRATIVE ARC TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A chapter in the narrative arc.
 */
export interface ArcChapter {
  /** Chapter title */
  title: string;
  /** Chapter summary */
  summary: string;
  /** Passage IDs in this chapter */
  passageIds: string[];
  /** Chapter theme */
  theme: string;
  /** Position in arc */
  position: number;
}

/**
 * Generated narrative arc.
 */
export interface NarrativeArc {
  /** Arc title */
  title: string;
  /** Arc type used */
  arcType: string;
  /** Introduction text */
  introduction: string;
  /** Organized chapters */
  chapters: ArcChapter[];
  /** Overall themes identified */
  themes: string[];
  /** Suggested transitions between chapters */
  transitions: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// BOOK TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A chapter in a book.
 */
export interface BookChapter {
  /** Chapter ID */
  id: string;
  /** Chapter title */
  title: string;
  /** Chapter content (assembled from passages) */
  content: string;
  /** Source passage IDs */
  passageIds: string[];
  /** Position in book */
  position: number;
  /** Word count */
  wordCount: number;
}

/**
 * Book status
 */
export type BookStatus = 'draft' | 'published' | 'archived';

/**
 * A book entity.
 */
export interface Book {
  /** Book ID */
  id: string;
  /** Book title */
  title: string;
  /** Book description */
  description: string;
  /** Narrative arc */
  arc: NarrativeArc;
  /** Chapters with full content */
  chapters: BookChapter[];
  /** Source cluster ID (if created from cluster) */
  sourceClusterId?: string;
  /** Creation date */
  createdAt: Date;
  /** Last updated date */
  updatedAt: Date;
  /** Status */
  status: BookStatus;
  /** Metadata */
  metadata: Record<string, unknown>;
}
