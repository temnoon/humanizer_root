/**
 * Passage System Types
 *
 * Core types for the Unified Passage System - the universal content conduit
 * for Humanizer. All content flows through passages for transformation,
 * editing, and export.
 *
 * @see /docs/PASSAGE_SYSTEM_SPEC_v1.1.md
 */

// ============================================================
// SOURCE TYPES
// ============================================================

export type PassageSourceType = 'archive' | 'file' | 'web' | 'paste' | 'cloud';

export type ArchivePlatform =
  | 'openai'
  | 'anthropic'
  | 'facebook'
  | 'twitter'
  | 'apple-messages'
  | 'whatsapp'
  | 'slack'
  | 'manual'
  | 'import';

export type FileFormat =
  | 'txt'
  | 'md'
  | 'html'
  | 'pdf'
  | 'rtf'
  | 'epub'
  | 'docx';

export type WebPlatform = 'substack' | 'medium' | 'wordpress' | 'generic';

// ============================================================
// POSITION TRACKING (for navigation back to source)
// ============================================================

export interface PassagePosition {
  /** Message ID within a conversation */
  messageId?: string;
  /** Page number (for PDFs) */
  pageNumber?: number;
  /** Chapter index (for EPUBs) */
  chapterIndex?: number;
  /** Paragraph index within source */
  paragraphIndex?: number;
  /** Character offset from start of source */
  characterOffset?: number;
  /** Line number in source file */
  lineNumber?: number;
  /** For conversations: position in message list */
  messageIndex?: number;
}

// ============================================================
// SOURCE TRACKING
// ============================================================

export interface PassageSource {
  /** Type of source */
  type: PassageSourceType;
  /** Human-readable name for display */
  name: string;
  /** Original file path or URL */
  path?: string;
  /** When content was extracted from source */
  extractedAt: Date;
  /** Archive platform (if type === 'archive') */
  platform?: ArchivePlatform;
  /** File format (if type === 'file') */
  fileFormat?: FileFormat;
  /** Web platform (if type === 'web') */
  webPlatform?: WebPlatform;
  /** Conversation ID (for archive sources) */
  conversationId?: string;
  /** Conversation title */
  conversationTitle?: string;
  /** Folder path in archive */
  folder?: string;
  /** Original URL (for web sources) */
  url?: string;
  /** Archive name in local storage */
  archiveName?: string;
}

// ============================================================
// TRANSFORMATION TRACKING
// ============================================================

export interface TransformationRecord {
  /** Unique ID for this transformation */
  id: string;
  /** Tool that was applied */
  tool: string;
  /** Tool settings used */
  settings: Record<string, unknown>;
  /** Timestamp of transformation */
  appliedAt: Date;
  /** Hash of input content (for deduplication) */
  inputHash?: string;
  /** Hash of output content */
  outputHash?: string;
  /** Any analysis results from the tool */
  analysisResult?: Record<string, unknown>;
}

// ============================================================
// PASSAGE METADATA
// ============================================================

export interface PassageMetadata {
  /** Display title (auto-generated or user-set) */
  title?: string;
  /** Original author name */
  author?: string;
  /** Creation date of original content */
  date?: Date;
  /** Tags for organization */
  tags?: string[];
  /** Word count */
  wordCount: number;
  /** Estimated reading time in minutes */
  estimatedReadTime: number;
  /** Character count */
  charCount: number;
  /** Primary language detected */
  language?: string;
}

// ============================================================
// PASSAGE INTERFACE (Core Data Model)
// ============================================================

export type PassageContentType = 'text' | 'markdown' | 'html';

export interface Passage {
  /** Unique identifier */
  id: string;

  // ============================================
  // Content
  // ============================================

  /** The actual text content (may include block markers) */
  content: string;

  /** Content format */
  contentType: PassageContentType;

  // ============================================
  // Source Tracking (Lightroom model)
  // ============================================

  /** Where this passage came from */
  source: PassageSource;

  /** Position in source for navigation */
  position?: PassagePosition;

  // ============================================
  // Metadata
  // ============================================

  /** Passage metadata */
  metadata: PassageMetadata;

  // ============================================
  // Transformation History
  // ============================================

  /** Chain of transformations applied */
  history: TransformationRecord[];

  // ============================================
  // Index Status
  // ============================================

  /** Embedding ID if indexed */
  embeddingId?: string;

  /** Index scope */
  indexScope?: 'local' | 'global';

  /** Content hash for change detection */
  contentHash?: string;

  // ============================================
  // Edit State
  // ============================================

  /** Status: original, edited, or derived */
  status: 'original' | 'edited' | 'derived';

  /** Parent passage ID (if derived from split/transform) */
  parentId?: string;

  /** Child passage IDs (if split into parts) */
  childIds?: string[];

  // ============================================
  // Timestamps
  // ============================================

  /** When passage was created in the system */
  createdAt: Date;

  /** When passage was last modified */
  updatedAt: Date;
}

// ============================================================
// UI STATE (separate from data model)
// ============================================================

export interface PassageUIState {
  /** Whether passage is currently selected */
  isSelected: boolean;
  /** Whether passage content is expanded in list view */
  isExpanded: boolean;
  /** Whether passage is being edited */
  isEditing: boolean;
  /** Scroll position within passage (for restore) */
  scrollPosition?: number;
  /** Text selection range (if any) */
  selection?: { start: number; end: number };
}

// ============================================================
// COLLECTION TYPES
// ============================================================

export type CollectionType = 'manual' | 'search' | 'cluster' | 'filter' | 'date-range';

export interface PassageCollection {
  /** Unique identifier */
  id: string;
  /** Collection name */
  name: string;
  /** How collection was created */
  type: CollectionType;
  /** Search query (if type === 'search') */
  query?: string;
  /** Passage IDs in this collection */
  passageIds: string[];
  /** Collection creation date */
  createdAt: Date;
  /** Collection statistics */
  stats: {
    passageCount: number;
    totalWordCount: number;
    dateRange?: { start: Date; end: Date };
  };
}

// ============================================================
// EDIT OVERLAY (for non-destructive editing)
// ============================================================

export type EditType = 'replace' | 'insert' | 'delete' | 'merge' | 'split';

export interface PassageEdit {
  /** Unique identifier */
  id: string;
  /** Passage being edited */
  passageId: string;
  /** Type of edit */
  editType: EditType;
  /** Hash of content before edit */
  originalHash?: string;
  /** Edit diff or new content */
  diff: string;
  /** When edit was made */
  createdAt: Date;
  /** Edit description (for undo UI) */
  description?: string;
}

// ============================================================
// INDEX SCHEMA TYPES (for persistence)
// ============================================================

export interface PassageIndexEntry {
  /** Passage ID */
  id: string;
  /** Source ID reference */
  sourceId: string;
  /** Extracted content (cached) */
  content: string;
  /** Content type */
  contentType: PassageContentType;
  /** Position data (serialized) */
  positionJson?: string;
  /** Title */
  title?: string;
  /** Author */
  author?: string;
  /** Original creation date (timestamp) */
  createdTimestamp?: number;
  /** Word count */
  wordCount: number;
  /** Extraction timestamp */
  extractedAt: number;
  /** Embedding ID (for join) */
  embeddingId?: string;
  /** Content hash */
  contentHash: string;
  /** Status */
  status: 'original' | 'edited' | 'derived';
  /** Parent passage ID */
  parentId?: string;
  /** Index scope */
  indexScope: 'local' | 'global';
}

export interface SourceIndexEntry {
  /** Source ID */
  id: string;
  /** Source type */
  type: PassageSourceType;
  /** Source name */
  name: string;
  /** Path (file path or URL) */
  path?: string;
  /** When indexed */
  indexedAt: number;
  /** Index scope */
  scope: 'local' | 'global';
  /** Platform (for archives) */
  platform?: ArchivePlatform;
  /** Archive name */
  archiveName?: string;
}

// ============================================================
// TYPE GUARDS
// ============================================================

export function isPassage(obj: unknown): obj is Passage {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'content' in obj &&
    'contentType' in obj &&
    'source' in obj &&
    'metadata' in obj &&
    'history' in obj
  );
}

// ============================================================
// FACTORY HELPERS
// ============================================================

/** Generate unique passage ID */
export function generatePassageId(): string {
  return `passage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Calculate estimated read time (200 wpm average) */
export function calculateReadTime(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 200));
}

/** Create content hash for change detection */
export function hashContent(content: string): string {
  // Simple hash for now - could use crypto.subtle.digest for stronger hash
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/** Create a new passage from text */
export function createPassage(
  content: string,
  source: PassageSource,
  options: {
    contentType?: PassageContentType;
    position?: PassagePosition;
    title?: string;
    author?: string;
    date?: Date;
    tags?: string[];
  } = {}
): Passage {
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const now = new Date();

  return {
    id: generatePassageId(),
    content,
    contentType: options.contentType || 'text',
    source,
    position: options.position,
    metadata: {
      title: options.title,
      author: options.author,
      date: options.date,
      tags: options.tags,
      wordCount,
      charCount: content.length,
      estimatedReadTime: calculateReadTime(wordCount),
    },
    history: [],
    status: 'original',
    contentHash: hashContent(content),
    createdAt: now,
    updatedAt: now,
  };
}

/** Create UI state for a passage */
export function createPassageUIState(
  overrides: Partial<PassageUIState> = {}
): PassageUIState {
  return {
    isSelected: false,
    isExpanded: false,
    isEditing: false,
    ...overrides,
  };
}
