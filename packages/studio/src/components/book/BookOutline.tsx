/**
 * BookOutline - Chapter Tree with Drag-Drop Reordering
 *
 * Displays the book's chapter hierarchy with:
 * - Chapter list with position numbers
 * - Click to select/navigate
 * - Drag-drop reordering
 * - Add new chapter button
 * - Word count per chapter
 *
 * @module @humanizer/studio/components/book/BookOutline
 */

import React, { useCallback, useRef, useState } from 'react';
import type { BookChapter } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface BookOutlineProps {
  /** List of chapters */
  chapters: BookChapter[];
  /** Currently active chapter ID */
  activeChapterId?: string;
  /** Called when a chapter is selected */
  onSelectChapter?: (chapterId: string) => void;
  /** Called when chapters are reordered */
  onReorderChapters?: (chapters: BookChapter[]) => void;
  /** Called when add chapter is clicked */
  onAddChapter?: () => void;
  /** Called when a chapter is deleted */
  onDeleteChapter?: (chapterId: string) => void;
  /** Whether the outline is collapsed */
  collapsed?: boolean;
  /** Called when collapse toggle is clicked */
  onToggleCollapse?: () => void;
  /** Whether editing is enabled */
  editable?: boolean;
  /** Optional class name */
  className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Format word count for display */
function formatWordCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function BookOutline({
  chapters,
  activeChapterId,
  onSelectChapter,
  onReorderChapters,
  onAddChapter,
  onDeleteChapter,
  collapsed = false,
  onToggleCollapse,
  editable = true,
  className = '',
}: BookOutlineProps): React.ReactElement {
  // Drag state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'above' | 'below' | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);

  // Handle chapter click
  const handleChapterClick = useCallback(
    (chapterId: string) => {
      onSelectChapter?.(chapterId);
    },
    [onSelectChapter]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, chapterId: string, index: number) => {
      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          onSelectChapter?.(chapterId);
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (index < chapters.length - 1) {
            const nextId = chapters[index + 1].id;
            const nextElement = document.querySelector(`[data-chapter-id="${nextId}"]`);
            (nextElement as HTMLElement)?.focus();
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (index > 0) {
            const prevId = chapters[index - 1].id;
            const prevElement = document.querySelector(`[data-chapter-id="${prevId}"]`);
            (prevElement as HTMLElement)?.focus();
          }
          break;
        case 'Delete':
        case 'Backspace':
          if (editable && onDeleteChapter) {
            e.preventDefault();
            onDeleteChapter(chapterId);
          }
          break;
      }
    },
    [chapters, onSelectChapter, onDeleteChapter, editable]
  );

  // Drag and drop handlers
  const handleDragStart = useCallback(
    (e: React.DragEvent, chapterId: string) => {
      if (!editable) return;

      setDraggedId(chapterId);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', chapterId);

      // Create drag image
      const target = e.currentTarget as HTMLElement;
      if (target) {
        dragNodeRef.current = target as HTMLDivElement;
        target.classList.add('book-outline__item--dragging');
      }
    },
    [editable]
  );

  const handleDragEnd = useCallback(() => {
    if (dragNodeRef.current) {
      dragNodeRef.current.classList.remove('book-outline__item--dragging');
    }
    setDraggedId(null);
    setDragOverId(null);
    setDragOverPosition(null);
    dragNodeRef.current = null;
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, chapterId: string) => {
      e.preventDefault();
      if (!editable || !draggedId || draggedId === chapterId) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const position = e.clientY < midY ? 'above' : 'below';

      setDragOverId(chapterId);
      setDragOverPosition(position);
    },
    [editable, draggedId]
  );

  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
    setDragOverPosition(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      if (!editable || !draggedId || draggedId === targetId || !onReorderChapters) return;

      const draggedIndex = chapters.findIndex((ch) => ch.id === draggedId);
      const targetIndex = chapters.findIndex((ch) => ch.id === targetId);

      if (draggedIndex === -1 || targetIndex === -1) return;

      // Create new array with reordered chapters
      const newChapters = [...chapters];
      const [draggedChapter] = newChapters.splice(draggedIndex, 1);

      // Determine insert position
      let insertIndex = targetIndex;
      if (draggedIndex < targetIndex && dragOverPosition === 'above') {
        insertIndex = targetIndex - 1;
      } else if (draggedIndex > targetIndex && dragOverPosition === 'below') {
        insertIndex = targetIndex + 1;
      }

      // Insert at new position
      newChapters.splice(insertIndex, 0, draggedChapter);

      // Update positions
      const reorderedChapters = newChapters.map((ch, idx) => ({
        ...ch,
        position: idx,
      }));

      onReorderChapters(reorderedChapters);

      // Reset drag state
      setDraggedId(null);
      setDragOverId(null);
      setDragOverPosition(null);
    },
    [editable, draggedId, dragOverPosition, chapters, onReorderChapters]
  );

  // Get item class names
  const getItemClassName = (chapter: BookChapter): string => {
    const classes = ['book-outline__item'];

    if (chapter.id === activeChapterId) {
      classes.push('book-outline__item--active');
    }
    if (chapter.id === draggedId) {
      classes.push('book-outline__item--dragging');
    }
    if (chapter.id === dragOverId) {
      if (dragOverPosition === 'above') {
        classes.push('book-outline__item--drag-over');
      } else if (dragOverPosition === 'below') {
        classes.push('book-outline__item--drag-over-below');
      }
    }

    return classes.join(' ');
  };

  return (
    <div className={`book-outline ${collapsed ? 'book-outline--collapsed' : ''} ${className}`}>
      {/* Header */}
      <div className="book-outline__header">
        <h3 className="book-outline__title">Chapters</h3>
        <div className="book-outline__actions">
          {editable && onAddChapter && (
            <button
              className="book-outline__action"
              onClick={onAddChapter}
              aria-label="Add chapter"
              title="Add chapter"
            >
              +
            </button>
          )}
          {onToggleCollapse && (
            <button
              className="book-outline__action"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand outline' : 'Collapse outline'}
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? '›' : '‹'}
            </button>
          )}
        </div>
      </div>

      {/* Chapter List */}
      <div className="book-outline__list" role="tree" aria-label="Book chapters">
        {chapters.map((chapter, index) => (
          <div
            key={chapter.id}
            className={getItemClassName(chapter)}
            onClick={() => handleChapterClick(chapter.id)}
            onKeyDown={(e) => handleKeyDown(e, chapter.id, index)}
            role="treeitem"
            tabIndex={0}
            aria-selected={chapter.id === activeChapterId}
            aria-level={1}
            data-chapter-id={chapter.id}
            draggable={editable}
            onDragStart={(e) => handleDragStart(e, chapter.id)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, chapter.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, chapter.id)}
          >
            {/* Drag Handle */}
            {editable && (
              <span className="book-outline__drag-handle" aria-hidden="true">
                ⋮⋮
              </span>
            )}

            {/* Chapter Number */}
            <span className="book-outline__number">{index + 1}.</span>

            {/* Chapter Title */}
            <span className="book-outline__item-title">{chapter.title}</span>

            {/* Word Count */}
            <span className="book-outline__word-count">{formatWordCount(chapter.wordCount)}</span>
          </div>
        ))}

        {/* Empty State */}
        {chapters.length === 0 && (
          <div className="panel__empty">
            <span className="panel__empty-icon" aria-hidden="true">
              📖
            </span>
            <span className="panel__empty-title">No chapters yet</span>
            <span className="panel__empty-description">
              {editable
                ? 'Click the + button to add your first chapter'
                : 'This book has no chapters'}
            </span>
          </div>
        )}
      </div>

      {/* Add Chapter Button (alternative at bottom) */}
      {editable && onAddChapter && chapters.length > 0 && (
        <button className="book-outline__add" onClick={onAddChapter}>
          <span aria-hidden="true">+</span>
          <span>Add Chapter</span>
        </button>
      )}
    </div>
  );
}

export default BookOutline;
