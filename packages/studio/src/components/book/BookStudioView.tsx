/**
 * BookStudioView - Main Book Studio Layout
 *
 * Combines all book editing components into a cohesive interface:
 * - BookOutline (left sidebar with chapter tree)
 * - ChapterEditor (main content area)
 * - BookMetadata (accessible via info button)
 * - Mobile-responsive layout with bottom sheet outline
 *
 * @module @humanizer/studio/components/book/BookStudioView
 */

import React, { useCallback, useEffect, useState } from 'react';
import type { Book, BookChapter } from './types';
import { BookOutline } from './BookOutline';
import { ChapterEditor, ChapterEditorEmpty } from './ChapterEditor';
import { BookMetadata } from './BookMetadata';
import { useIsMobile } from '../../contexts/PanelContext';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface BookStudioViewProps {
  /** Book data */
  book: Book;
  /** Called when the book is updated */
  onBookUpdate?: (updates: Partial<Book>) => void;
  /** Called when a chapter is updated */
  onChapterUpdate?: (chapterId: string, updates: Partial<BookChapter>) => void;
  /** Called when chapters are reordered */
  onChaptersReorder?: (chapters: BookChapter[]) => void;
  /** Called when a new chapter should be added */
  onAddChapter?: () => void;
  /** Called when a chapter should be deleted */
  onDeleteChapter?: (chapterId: string) => void;
  /** Called when export is requested */
  onExport?: (format: 'markdown' | 'html' | 'json') => void;
  /** Whether editing is enabled */
  editable?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Error message */
  error?: string | null;
  /** Optional class name */
  className?: string;
}

type ViewMode = 'chapter' | 'metadata';

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function BookStudioView({
  book,
  onBookUpdate,
  onChapterUpdate,
  onChaptersReorder,
  onAddChapter,
  onDeleteChapter,
  onExport,
  editable = true,
  isLoading = false,
  error = null,
  className = '',
}: BookStudioViewProps): React.ReactElement {
  // Mobile detection
  const isMobile = useIsMobile();

  // Local state
  const [activeChapterId, setActiveChapterId] = useState<string | null>(() => {
    // Default to first chapter
    return book.chapters.length > 0 ? book.chapters[0].id : null;
  });
  const [viewMode, setViewMode] = useState<ViewMode>('chapter');
  const [outlineCollapsed, setOutlineCollapsed] = useState(false);
  const [mobileOutlineExpanded, setMobileOutlineExpanded] = useState(false);

  // Get active chapter
  const activeChapter = activeChapterId
    ? book.chapters.find((ch) => ch.id === activeChapterId)
    : null;

  // Update active chapter when book changes
  useEffect(() => {
    if (activeChapterId && !book.chapters.find((ch) => ch.id === activeChapterId)) {
      // Current chapter was deleted, select first available
      setActiveChapterId(book.chapters.length > 0 ? book.chapters[0].id : null);
    }
  }, [book.chapters, activeChapterId]);

  // Handle chapter selection
  const handleSelectChapter = useCallback((chapterId: string) => {
    setActiveChapterId(chapterId);
    setViewMode('chapter');
    // Close mobile outline when selecting
    setMobileOutlineExpanded(false);
  }, []);

  // Handle chapter title change
  const handleChapterTitleChange = useCallback(
    (chapterId: string, title: string) => {
      onChapterUpdate?.(chapterId, { title });
    },
    [onChapterUpdate]
  );

  // Handle chapter content change
  const handleChapterContentChange = useCallback(
    (chapterId: string, content: string) => {
      const wordCount = content.split(/\s+/).filter((w) => w.length > 0).length;
      onChapterUpdate?.(chapterId, { content, wordCount });
    },
    [onChapterUpdate]
  );

  // Handle book metadata changes
  const handleTitleChange = useCallback(
    (title: string) => {
      onBookUpdate?.({ title });
    },
    [onBookUpdate]
  );

  const handleDescriptionChange = useCallback(
    (description: string) => {
      onBookUpdate?.({ description });
    },
    [onBookUpdate]
  );

  const handleStatusChange = useCallback(
    (status: Book['status']) => {
      onBookUpdate?.({ status });
    },
    [onBookUpdate]
  );

  // Handle outline toggle
  const handleToggleOutline = useCallback(() => {
    if (isMobile) {
      setMobileOutlineExpanded((prev) => !prev);
    } else {
      setOutlineCollapsed((prev) => !prev);
    }
  }, [isMobile]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + I for info/metadata
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault();
        setViewMode((prev) => (prev === 'metadata' ? 'chapter' : 'metadata'));
      }

      // Cmd/Ctrl + \ for outline toggle
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        handleToggleOutline();
      }

      // Escape to close mobile outline
      if (e.key === 'Escape' && isMobile && mobileOutlineExpanded) {
        setMobileOutlineExpanded(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobile, mobileOutlineExpanded, handleToggleOutline]);

  // Get layout class
  const getLayoutClass = (): string => {
    const classes = ['book-studio'];
    if (outlineCollapsed && !isMobile) {
      classes.push('book-studio--outline-collapsed');
    }
    if (className) {
      classes.push(className);
    }
    return classes.join(' ');
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`book-studio book-studio--loading ${className}`}>
        <div className="book-studio__loading">
          <div className="book-studio__spinner" aria-hidden="true" />
          <span>Loading book...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`book-studio book-studio--error ${className}`}>
        <div className="book-studio__empty">
          <span className="book-studio__empty-icon" aria-hidden="true">
            ⚠️
          </span>
          <h3 className="book-studio__empty-title">Error loading book</h3>
          <p className="book-studio__empty-description">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={getLayoutClass()}>
      {/* Outline (sidebar on desktop, bottom sheet on mobile) */}
      <BookOutline
        chapters={book.chapters}
        activeChapterId={activeChapterId ?? undefined}
        onSelectChapter={handleSelectChapter}
        onReorderChapters={onChaptersReorder}
        onAddChapter={onAddChapter}
        onDeleteChapter={onDeleteChapter}
        collapsed={outlineCollapsed && !isMobile}
        onToggleCollapse={handleToggleOutline}
        editable={editable}
        className={isMobile ? (mobileOutlineExpanded ? 'book-outline--expanded' : '') : ''}
      />

      {/* Editor Area */}
      <div className="book-editor">
        {/* Editor Header */}
        <div className="book-editor__header">
          {/* Breadcrumb */}
          <nav className="book-editor__breadcrumb" aria-label="Breadcrumb">
            <button
              className="book-editor__breadcrumb-link"
              onClick={() => setViewMode('metadata')}
            >
              {book.title}
            </button>
            {viewMode === 'chapter' && activeChapter && (
              <>
                <span className="book-editor__breadcrumb-separator" aria-hidden="true">
                  /
                </span>
                <span className="book-editor__breadcrumb-current">{activeChapter.title}</span>
              </>
            )}
            {viewMode === 'metadata' && (
              <>
                <span className="book-editor__breadcrumb-separator" aria-hidden="true">
                  /
                </span>
                <span className="book-editor__breadcrumb-current">Book Info</span>
              </>
            )}
          </nav>

          {/* Actions */}
          <div className="book-editor__actions">
            {/* Mobile outline toggle */}
            {isMobile && (
              <button
                className="book-toolbar__btn"
                onClick={handleToggleOutline}
                aria-label="Toggle chapters"
              >
                📑
              </button>
            )}

            {/* View toggle */}
            <div className="book-toolbar">
              <button
                className={`book-toolbar__btn ${viewMode === 'chapter' ? 'book-toolbar__btn--primary' : ''}`}
                onClick={() => setViewMode('chapter')}
                aria-pressed={viewMode === 'chapter'}
              >
                Edit
              </button>
              <button
                className={`book-toolbar__btn ${viewMode === 'metadata' ? 'book-toolbar__btn--primary' : ''}`}
                onClick={() => setViewMode('metadata')}
                aria-pressed={viewMode === 'metadata'}
              >
                Info
              </button>
            </div>

            {/* Export dropdown */}
            {onExport && (
              <>
                <span className="book-toolbar__divider" aria-hidden="true" />
                <div className="book-toolbar">
                  <button
                    className="book-toolbar__btn"
                    onClick={() => onExport('markdown')}
                    title="Export as Markdown"
                  >
                    Export
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Editor Content */}
        <div className="book-editor__scroll">
          {viewMode === 'metadata' ? (
            <BookMetadata
              book={book}
              onTitleChange={handleTitleChange}
              onDescriptionChange={handleDescriptionChange}
              onStatusChange={handleStatusChange}
              editable={editable}
            />
          ) : activeChapter ? (
            <ChapterEditor
              chapter={activeChapter}
              onTitleChange={handleChapterTitleChange}
              onContentChange={handleChapterContentChange}
              editable={editable}
            />
          ) : (
            <ChapterEditorEmpty onAddChapter={editable ? onAddChapter : undefined} />
          )}
        </div>
      </div>

      {/* Mobile backdrop */}
      {isMobile && mobileOutlineExpanded && (
        <div
          className="panel-backdrop panel-backdrop--visible"
          onClick={() => setMobileOutlineExpanded(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EMPTY STATE FOR NO BOOK
// ═══════════════════════════════════════════════════════════════════════════

export interface BookStudioEmptyProps {
  /** Called when create book is clicked */
  onCreateBook?: () => void;
  /** Optional class name */
  className?: string;
}

export function BookStudioEmpty({
  onCreateBook,
  className = '',
}: BookStudioEmptyProps): React.ReactElement {
  return (
    <div className={`book-studio book-studio--empty ${className}`}>
      <div className="book-studio__empty">
        <span className="book-studio__empty-icon" aria-hidden="true">
          📚
        </span>
        <h2 className="book-studio__empty-title">No book selected</h2>
        <p className="book-studio__empty-description">
          Select a book from your library to start editing, or create a new book from your archive
          content.
        </p>
        {onCreateBook && (
          <button className="book-studio__empty-action" onClick={onCreateBook}>
            Create New Book
          </button>
        )}
      </div>
    </div>
  );
}

export default BookStudioView;
