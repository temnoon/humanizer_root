/**
 * BookMetadata - Book title, description, and cover editor
 *
 * Displays and allows editing of:
 * - Book title
 * - Book description
 * - Cover image (upload/change)
 * - Status (draft/published/archived)
 * - Statistics (chapter count, word count, etc.)
 *
 * @module @humanizer/studio/components/book/BookMetadata
 */

import React, { useCallback, useRef, useState } from 'react';
import type { Book } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface BookMetadataProps {
  /** Book data */
  book: Book;
  /** Called when title changes */
  onTitleChange?: (title: string) => void;
  /** Called when description changes */
  onDescriptionChange?: (description: string) => void;
  /** Called when status changes */
  onStatusChange?: (status: Book['status']) => void;
  /** Called when cover image changes */
  onCoverChange?: (file: File) => void;
  /** Whether editing is enabled */
  editable?: boolean;
  /** Optional class name */
  className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Format date for display */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/** Format number with commas */
function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function BookMetadata({
  book,
  onTitleChange,
  onDescriptionChange,
  onStatusChange,
  onCoverChange,
  editable = true,
  className = '',
}: BookMetadataProps): React.ReactElement {
  // Local state for editing
  const [title, setTitle] = useState(book.title);
  const [description, setDescription] = useState(book.description);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate statistics
  const chapterCount = book.chapters.length;
  const totalWordCount = book.chapters.reduce((sum, ch) => sum + ch.wordCount, 0);
  const avgChapterWords = chapterCount > 0 ? Math.round(totalWordCount / chapterCount) : 0;

  // Get cover image URL from metadata if available
  const coverUrl = book.metadata?.coverUrl as string | undefined;

  // Handle title blur (save)
  const handleTitleBlur = useCallback(() => {
    if (title !== book.title) {
      onTitleChange?.(title);
    }
  }, [title, book.title, onTitleChange]);

  // Handle description blur (save)
  const handleDescriptionBlur = useCallback(() => {
    if (description !== book.description) {
      onDescriptionChange?.(description);
    }
  }, [description, book.description, onDescriptionChange]);

  // Handle cover click
  const handleCoverClick = useCallback(() => {
    if (editable) {
      fileInputRef.current?.click();
    }
  }, [editable]);

  // Handle file selection
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && onCoverChange) {
        onCoverChange(file);
      }
    },
    [onCoverChange]
  );

  // Handle keyboard on cover
  const handleCoverKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCoverClick();
      }
    },
    [handleCoverClick]
  );

  return (
    <div className={`book-metadata ${className}`}>
      {/* Cover Image */}
      <div
        className={`book-metadata__cover ${coverUrl ? 'book-metadata__cover--has-image' : ''}`}
        onClick={handleCoverClick}
        onKeyDown={handleCoverKeyDown}
        role="button"
        tabIndex={editable ? 0 : -1}
        aria-label={coverUrl ? 'Change cover image' : 'Add cover image'}
      >
        {coverUrl ? (
          <>
            <img
              src={coverUrl}
              alt={`Cover for ${book.title}`}
              className="book-metadata__cover-image"
            />
            {editable && (
              <div className="book-metadata__cover-overlay">
                <button className="book-metadata__cover-change">Change Cover</button>
              </div>
            )}
          </>
        ) : (
          <div className="book-metadata__cover-placeholder">
            <span className="book-metadata__cover-placeholder-icon" aria-hidden="true">
              📚
            </span>
            <span className="book-metadata__cover-placeholder-text">
              {editable ? 'Click to add cover' : 'No cover'}
            </span>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          aria-hidden="true"
        />
      </div>

      {/* Form Fields */}
      <div className="book-metadata__form">
        {/* Title */}
        <div className="book-metadata__field">
          <label htmlFor="book-title" className="book-metadata__label">
            Title
          </label>
          {editable ? (
            <input
              id="book-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              placeholder="Untitled Book"
              className="book-metadata__input"
            />
          ) : (
            <span className="book-metadata__input">{book.title}</span>
          )}
        </div>

        {/* Description */}
        <div className="book-metadata__field">
          <label htmlFor="book-description" className="book-metadata__label">
            Description
          </label>
          {editable ? (
            <textarea
              id="book-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              placeholder="Write a brief description..."
              className="book-metadata__textarea"
              rows={4}
            />
          ) : (
            <p className="book-metadata__textarea">{book.description || 'No description'}</p>
          )}
        </div>

        {/* Status */}
        <div className="book-metadata__field">
          <label htmlFor="book-status" className="book-metadata__label">
            Status
          </label>
          {editable && onStatusChange ? (
            <select
              id="book-status"
              value={book.status}
              onChange={(e) => onStatusChange(e.target.value as Book['status'])}
              className="book-metadata__status-select"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          ) : (
            <span className="book-metadata__status-select">{book.status}</span>
          )}
        </div>

        {/* Statistics */}
        <div className="book-metadata__info">
          <div className="book-metadata__info-item">
            <span className="book-metadata__info-label">Chapters</span>
            <span className="book-metadata__info-value">{formatNumber(chapterCount)}</span>
          </div>
          <div className="book-metadata__info-item">
            <span className="book-metadata__info-label">Total Words</span>
            <span className="book-metadata__info-value">{formatNumber(totalWordCount)}</span>
          </div>
          <div className="book-metadata__info-item">
            <span className="book-metadata__info-label">Avg Words/Chapter</span>
            <span className="book-metadata__info-value">{formatNumber(avgChapterWords)}</span>
          </div>
          <div className="book-metadata__info-item">
            <span className="book-metadata__info-label">Created</span>
            <span className="book-metadata__info-value">{formatDate(book.createdAt)}</span>
          </div>
          <div className="book-metadata__info-item">
            <span className="book-metadata__info-label">Last Updated</span>
            <span className="book-metadata__info-value">{formatDate(book.updatedAt)}</span>
          </div>
          {book.sourceClusterId && (
            <div className="book-metadata__info-item">
              <span className="book-metadata__info-label">Source</span>
              <span className="book-metadata__info-value">Cluster</span>
            </div>
          )}
        </div>

        {/* Arc Info (if available) */}
        {book.arc && (
          <div className="book-metadata__info">
            <div className="book-metadata__info-item">
              <span className="book-metadata__info-label">Arc Type</span>
              <span className="book-metadata__info-value">{book.arc.arcType}</span>
            </div>
            {book.arc.themes.length > 0 && (
              <div className="book-metadata__info-item">
                <span className="book-metadata__info-label">Themes</span>
                <span className="book-metadata__info-value">{book.arc.themes.slice(0, 3).join(', ')}</span>
              </div>
            )}
          </div>
        )}

        {/* Persona Info (if available) */}
        {typeof book.metadata?.personaName === 'string' && (
          <div className="book-metadata__info">
            <div className="book-metadata__info-item">
              <span className="book-metadata__info-label">Voice</span>
              <span className="book-metadata__info-value">{book.metadata.personaName}</span>
            </div>
            {typeof book.metadata.styleName === 'string' && (
              <div className="book-metadata__info-item">
                <span className="book-metadata__info-label">Style</span>
                <span className="book-metadata__info-value">{book.metadata.styleName}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default BookMetadata;
