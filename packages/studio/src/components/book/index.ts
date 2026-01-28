/**
 * Book Studio Components
 *
 * Manuscript editor with outline navigation and chapter editing.
 *
 * @module @humanizer/studio/components/book
 */

// Types
export type {
  Book,
  BookChapter,
  BookStatus,
  NarrativeArc,
  ArcChapter,
} from './types';

// Components
export { BookStudioView, BookStudioEmpty, type BookStudioViewProps, type BookStudioEmptyProps } from './BookStudioView';
export { BookOutline, type BookOutlineProps } from './BookOutline';
export { ChapterEditor, ChapterEditorEmpty, type ChapterEditorProps, type ChapterEditorEmptyProps, type SaveStatus } from './ChapterEditor';
export { BookMetadata, type BookMetadataProps } from './BookMetadata';
