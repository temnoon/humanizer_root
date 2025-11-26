/**
 * Book Preview Component
 *
 * Shows a book's structure (chapters or passages) with:
 * - Table of contents navigation
 * - Content preview
 * - Import to editor functionality
 *
 * Used in the Gutenberg browser when a book is selected.
 */

import { Component, createSignal, createEffect, Show, For } from 'solid-js';
import {
  bookCache,
  type ParsedBook,
  type BookChapter,
} from '@/services/bookCache';
import type { GutenbergBook, SimpleBook } from '@/services/gutenberg';

interface BookPreviewProps {
  book: GutenbergBook | SimpleBook;
  onClose: () => void;
  onImport?: (content: string, title: string, source: { bookTitle: string; author: string; chapter?: string }) => void;
}

export const BookPreview: Component<BookPreviewProps> = (props) => {
  const [parsedBook, setParsedBook] = createSignal<ParsedBook | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [loadingStatus, setLoadingStatus] = createSignal('Loading...');
  const [error, setError] = createSignal<string | null>(null);
  const [selectedChapter, setSelectedChapter] = createSignal<BookChapter | null>(null);
  const [expandedChapters, setExpandedChapters] = createSignal<Set<string>>(new Set());

  // Load and parse book on mount
  createEffect(async () => {
    setLoading(true);
    setError(null);

    try {
      const parsed = await bookCache.fetchAndParse(props.book, setLoadingStatus);
      setParsedBook(parsed);

      // Auto-select first chapter
      if (parsed.chapters.length > 0) {
        setSelectedChapter(parsed.chapters[0]);
      }
    } catch (err) {
      console.error('Failed to load book:', err);
      setError(err instanceof Error ? err.message : 'Failed to load book');
    } finally {
      setLoading(false);
    }
  });

  // Get author name
  const author = () => {
    if ('authors' in props.book) {
      return props.book.authors?.[0]?.name || 'Unknown';
    }
    return (props.book as SimpleBook).author || 'Unknown';
  };

  // Toggle chapter expansion (for nested structure)
  const toggleChapter = (chapterId: string) => {
    const expanded = new Set(expandedChapters());
    if (expanded.has(chapterId)) {
      expanded.delete(chapterId);
    } else {
      expanded.add(chapterId);
    }
    setExpandedChapters(expanded);
  };

  // Handle import
  const handleImport = (chapter: BookChapter) => {
    props.onImport?.(
      chapter.content,
      chapter.title,
      {
        bookTitle: props.book.title,
        author: author(),
        chapter: chapter.title,
      }
    );
  };

  // Format word count
  const formatWords = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  return (
    <div class="book-preview">
      {/* Header */}
      <div class="book-preview-header">
        <button class="back-btn" onClick={props.onClose}>
          ← Back
        </button>
        <div class="book-info">
          <h2 class="book-title">{props.book.title}</h2>
          <span class="book-author">{author()}</span>
        </div>
      </div>

      {/* Loading State */}
      <Show when={loading()}>
        <div class="book-preview-loading">
          <div class="spinner"></div>
          <p>{loadingStatus()}</p>
        </div>
      </Show>

      {/* Error State */}
      <Show when={error()}>
        <div class="book-preview-error">
          <p>Failed to load book</p>
          <p class="error-detail">{error()}</p>
          <button onClick={props.onClose}>Go Back</button>
        </div>
      </Show>

      {/* Content */}
      <Show when={!loading() && !error() && parsedBook()}>
        <div class="book-preview-content">
          {/* Stats Bar */}
          <div class="book-stats">
            <span class="stat">
              {parsedBook()!.hasStructure ? '📖 Chapters' : '📄 Passages'}:
              {' '}{parsedBook()!.chapters.length}
            </span>
            <span class="stat">
              📝 {formatWords(parsedBook()!.totalWords)} words
            </span>
            <span class="stat cached">
              💾 Cached
            </span>
          </div>

          {/* Two-column layout */}
          <div class="book-preview-layout">
            {/* Left: Table of Contents */}
            <div class="book-toc">
              <h3 class="toc-title">
                {parsedBook()!.hasStructure ? 'Table of Contents' : 'Passages'}
              </h3>
              <div class="toc-list">
                <For each={parsedBook()!.chapters}>
                  {(chapter) => (
                    <ChapterItem
                      chapter={chapter}
                      isSelected={selectedChapter()?.id === chapter.id}
                      isExpanded={expandedChapters().has(chapter.id)}
                      onSelect={() => setSelectedChapter(chapter)}
                      onToggle={() => toggleChapter(chapter.id)}
                      onImport={() => handleImport(chapter)}
                      formatWords={formatWords}
                    />
                  )}
                </For>
              </div>
            </div>

            {/* Right: Preview */}
            <div class="book-preview-pane">
              <Show
                when={selectedChapter()}
                fallback={
                  <div class="preview-empty">
                    Select a {parsedBook()!.hasStructure ? 'chapter' : 'passage'} to preview
                  </div>
                }
              >
                <div class="preview-header">
                  <h3 class="preview-title">{selectedChapter()!.title}</h3>
                  <span class="preview-words">
                    {formatWords(selectedChapter()!.wordCount)} words
                  </span>
                </div>
                <div class="preview-content">
                  {selectedChapter()!.content}
                </div>
                <div class="preview-actions">
                  <button
                    class="import-btn primary"
                    onClick={() => handleImport(selectedChapter()!)}
                  >
                    📝 Import to Editor
                  </button>
                </div>
              </Show>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

// Chapter/Passage item in TOC
const ChapterItem: Component<{
  chapter: BookChapter;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onImport: () => void;
  formatWords: (count: number) => string;
}> = (props) => {
  const hasChildren = () => props.chapter.children && props.chapter.children.length > 0;
  const levelIndent = () => props.chapter.level * 16;

  return (
    <div class="toc-item-wrapper">
      <div
        class={`toc-item ${props.isSelected ? 'selected' : ''}`}
        style={{ 'padding-left': `${12 + levelIndent()}px` }}
        onClick={props.onSelect}
      >
        <Show when={hasChildren()}>
          <button
            class="expand-btn"
            onClick={(e) => {
              e.stopPropagation();
              props.onToggle();
            }}
          >
            {props.isExpanded ? '▼' : '▶'}
          </button>
        </Show>
        <Show when={!hasChildren()}>
          <span class="toc-bullet">•</span>
        </Show>

        <span class="toc-item-title">{props.chapter.title}</span>
        <span class="toc-item-words">{props.formatWords(props.chapter.wordCount)}</span>

        <button
          class="toc-import-btn"
          onClick={(e) => {
            e.stopPropagation();
            props.onImport();
          }}
          title="Import to editor"
        >
          +
        </button>
      </div>

      <Show when={props.isExpanded && hasChildren()}>
        <div class="toc-children">
          <For each={props.chapter.children}>
            {(child) => (
              <ChapterItem
                chapter={child}
                isSelected={false}
                isExpanded={false}
                onSelect={() => {}}
                onToggle={() => {}}
                onImport={() => {}}
                formatWords={props.formatWords}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default BookPreview;
