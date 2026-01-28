/**
 * ChapterEditor - Chapter Content Editor
 *
 * Provides a focused writing environment for chapter content with:
 * - Auto-saving title
 * - Auto-saving content
 * - Word/character count
 * - Reading time estimate
 * - Save status indicator
 *
 * @module @humanizer/studio/components/book/ChapterEditor
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { BookChapter } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ChapterEditorProps {
  /** Chapter data */
  chapter: BookChapter;
  /** Called when title changes */
  onTitleChange?: (chapterId: string, title: string) => void;
  /** Called when content changes */
  onContentChange?: (chapterId: string, content: string) => void;
  /** Auto-save delay in ms (default: 1000) */
  autoSaveDelay?: number;
  /** Whether editing is enabled */
  editable?: boolean;
  /** Optional class name */
  className?: string;
}

export type SaveStatus = 'saved' | 'saving' | 'unsaved';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_AUTO_SAVE_DELAY = 1000;
const WORDS_PER_MINUTE = 200; // Average reading speed

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Count words in text */
function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

/** Count characters (excluding spaces) */
function countCharacters(text: string): number {
  return text.replace(/\s/g, '').length;
}

/** Estimate reading time in minutes */
function estimateReadingTime(wordCount: number): string {
  const minutes = Math.ceil(wordCount / WORDS_PER_MINUTE);
  if (minutes < 1) return 'Less than 1 min';
  if (minutes === 1) return '1 min read';
  return `${minutes} min read`;
}

/** Format number with commas */
function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function ChapterEditor({
  chapter,
  onTitleChange,
  onContentChange,
  autoSaveDelay = DEFAULT_AUTO_SAVE_DELAY,
  editable = true,
  className = '',
}: ChapterEditorProps): React.ReactElement {
  // Local state
  const [title, setTitle] = useState(chapter.title);
  const [content, setContent] = useState(chapter.content);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  // Refs
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync with prop changes (when switching chapters)
  useEffect(() => {
    setTitle(chapter.title);
    setContent(chapter.content);
    setSaveStatus('saved');
  }, [chapter.id, chapter.title, chapter.content]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = contentRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(400, textarea.scrollHeight)}px`;
    }
  }, [content]);

  // Calculate stats
  const wordCount = countWords(content);
  const charCount = countCharacters(content);
  const readingTime = estimateReadingTime(wordCount);

  // Handle title change with debounced save
  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value;
      setTitle(newTitle);
      setSaveStatus('unsaved');

      // Clear previous timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set new timeout for auto-save
      saveTimeoutRef.current = setTimeout(() => {
        setSaveStatus('saving');
        onTitleChange?.(chapter.id, newTitle);
        setSaveStatus('saved');
      }, autoSaveDelay);
    },
    [chapter.id, onTitleChange, autoSaveDelay]
  );

  // Handle content change with debounced save
  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      setContent(newContent);
      setSaveStatus('unsaved');

      // Clear previous timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set new timeout for auto-save
      saveTimeoutRef.current = setTimeout(() => {
        setSaveStatus('saving');
        onContentChange?.(chapter.id, newContent);
        setSaveStatus('saved');
      }, autoSaveDelay);
    },
    [chapter.id, onContentChange, autoSaveDelay]
  );

  // Handle immediate save on blur
  const handleTitleBlur = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (title !== chapter.title && saveStatus !== 'saved') {
      setSaveStatus('saving');
      onTitleChange?.(chapter.id, title);
      setSaveStatus('saved');
    }
  }, [chapter.id, chapter.title, title, saveStatus, onTitleChange]);

  const handleContentBlur = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (content !== chapter.content && saveStatus !== 'saved') {
      setSaveStatus('saving');
      onContentChange?.(chapter.id, content);
      setSaveStatus('saved');
    }
  }, [chapter.id, chapter.content, content, saveStatus, onContentChange]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Get save status text and class
  const getSaveStatusText = (): string => {
    switch (saveStatus) {
      case 'saving':
        return 'Saving...';
      case 'unsaved':
        return 'Unsaved changes';
      case 'saved':
      default:
        return 'Saved';
    }
  };

  return (
    <div className={`chapter-editor ${className}`}>
      {/* Title Input */}
      <input
        ref={titleRef}
        type="text"
        value={title}
        onChange={handleTitleChange}
        onBlur={handleTitleBlur}
        placeholder="Chapter Title"
        className="chapter-editor__title"
        disabled={!editable}
        aria-label="Chapter title"
      />

      {/* Content Textarea */}
      <textarea
        ref={contentRef}
        value={content}
        onChange={handleContentChange}
        onBlur={handleContentBlur}
        placeholder="Start writing..."
        className="chapter-editor__content"
        disabled={!editable}
        aria-label="Chapter content"
      />

      {/* Stats Footer */}
      <div className="chapter-editor__stats">
        <span className="chapter-editor__stat">
          Words:
          <span className="chapter-editor__stat-value">{formatNumber(wordCount)}</span>
        </span>
        <span className="chapter-editor__stat">
          Characters:
          <span className="chapter-editor__stat-value">{formatNumber(charCount)}</span>
        </span>
        <span className="chapter-editor__stat">
          <span className="chapter-editor__stat-value">{readingTime}</span>
        </span>
        <span
          className={`chapter-editor__stat book-editor__status book-editor__status--${saveStatus}`}
        >
          <span className="book-editor__status-dot" aria-hidden="true" />
          {getSaveStatusText()}
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EMPTY STATE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export interface ChapterEditorEmptyProps {
  /** Called when add chapter is clicked */
  onAddChapter?: () => void;
  /** Optional class name */
  className?: string;
}

export function ChapterEditorEmpty({
  onAddChapter,
  className = '',
}: ChapterEditorEmptyProps): React.ReactElement {
  return (
    <div className={`chapter-editor__empty ${className}`}>
      <span className="chapter-editor__empty-icon" aria-hidden="true">
        📝
      </span>
      <h3 className="chapter-editor__empty-title">No chapter selected</h3>
      <p className="chapter-editor__empty-description">
        Select a chapter from the outline to start editing, or create a new chapter.
      </p>
      {onAddChapter && (
        <button className="chapter-editor__empty-action" onClick={onAddChapter}>
          Create Chapter
        </button>
      )}
    </div>
  );
}

export default ChapterEditor;
