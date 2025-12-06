/**
 * PageEditorView - Rich editor for book pages with comparison view
 *
 * Features:
 * - Side-by-side original/current content
 * - In-place editing with markdown support
 * - Source provenance display
 * - Save/cancel/revert operations
 * - Word count tracking
 */

import { useState, useEffect, useMemo } from 'react';
import { useActiveBook } from '../../contexts/ActiveBookContext';
import { booksService, type Page } from '../../services/booksService';
import { MarkdownRenderer } from '../markdown/MarkdownRenderer';
import { MarkdownEditor } from '../markdown/MarkdownEditor';
import { Icons } from '../layout/Icons';

interface PageEditorViewProps {
  bookId: string;
  pageId: string;
  onClose: () => void;
  onSaved?: () => void;
}

type ViewMode = 'split' | 'edit' | 'preview';

export function PageEditorView({ bookId, pageId, onClose, onSaved }: PageEditorViewProps) {
  const { refreshActiveBook } = useActiveBook();
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editedContent, setEditedContent] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [hasChanges, setHasChanges] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showSplitConfirm, setShowSplitConfirm] = useState(false);
  const [splitting, setSplitting] = useState(false);

  // Load page on mount
  useEffect(() => {
    loadPage();
  }, [bookId, pageId]);

  const loadPage = async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await booksService.getPage(bookId, pageId);
      setPage(loaded);
      setEditedContent(loaded.content);
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to load page:', err);
      setError(err instanceof Error ? err.message : 'Failed to load page');
    } finally {
      setLoading(false);
    }
  };

  // Track changes
  useEffect(() => {
    if (page) {
      setHasChanges(editedContent !== page.content);
    }
  }, [editedContent, page?.content]);

  // Word counts
  const wordCounts = useMemo(() => {
    const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
    return {
      original: page?.originalContent ? countWords(page.originalContent) : 0,
      current: countWords(editedContent),
      saved: page ? countWords(page.content) : 0,
    };
  }, [page, editedContent]);

  // Save handler
  const handleSave = async () => {
    if (!page) return;

    setSaving(true);
    setError(null);
    try {
      await booksService.updatePage(bookId, pageId, { content: editedContent });
      await loadPage(); // Reload to get updated timestamps
      await refreshActiveBook();
      onSaved?.();
    } catch (err) {
      console.error('Failed to save page:', err);
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Revert to saved
  const handleRevert = () => {
    if (page) {
      setEditedContent(page.content);
    }
  };

  // Restore original
  const handleRestoreOriginal = () => {
    if (page?.originalContent) {
      setEditedContent(page.originalContent);
    }
  };

  // Split page at cursor position
  const handleSplit = async () => {
    if (!page || cursorPosition <= 0 || cursorPosition >= editedContent.length) {
      setError('Cannot split: cursor position invalid');
      return;
    }

    // First save any changes
    if (hasChanges) {
      await handleSave();
    }

    setSplitting(true);
    setError(null);
    try {
      await booksService.splitPage(bookId, pageId, cursorPosition);
      await refreshActiveBook();
      onSaved?.();
      onClose(); // Close editor after split
    } catch (err) {
      console.error('Failed to split page:', err);
      setError(err instanceof Error ? err.message : 'Failed to split page');
    } finally {
      setSplitting(false);
      setShowSplitConfirm(false);
    }
  };


  // Format source attribution
  const getSourceAttribution = () => {
    if (!page?.source) return null;

    const { source } = page;
    switch (source.type) {
      case 'archive':
        return {
          icon: '💬',
          label: 'Conversation',
          detail: source.archiveName || 'Archive',
        };
      case 'gutenberg':
        return {
          icon: '📚',
          label: source.gutenbergTitle || 'Project Gutenberg',
          detail: source.gutenbergAuthor,
        };
      case 'url':
        return {
          icon: '🔗',
          label: source.siteName || 'Web',
          detail: source.url,
        };
      case 'notes':
        return {
          icon: '📝',
          label: 'Notes',
          detail: source.notePath,
        };
      case 'manual':
        return {
          icon: '✍️',
          label: 'Manual Entry',
          detail: null,
        };
      default:
        return {
          icon: '📄',
          label: source.type,
          detail: null,
        };
    }
  };

  const sourceAttribution = getSourceAttribution();

  // Loading state
  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-tertiary)',
        }}
      >
        <div className="animate-spin" style={{ marginBottom: 'var(--space-md)' }}>
          <Icons.Archive />
        </div>
        <p>Loading page...</p>
      </div>
    );
  }

  // Error state
  if (error && !page) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-xl)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>⚠️</div>
        <h3 style={{ margin: 0, color: 'var(--text-primary)', marginBottom: 'var(--space-sm)' }}>
          Failed to Load Page
        </h3>
        <p style={{ margin: 0, color: 'var(--text-tertiary)', marginBottom: 'var(--space-lg)' }}>
          {error}
        </p>
        <button
          onClick={onClose}
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
    );
  }

  if (!page) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          padding: 'var(--space-md) var(--space-lg)',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Left: Title and metadata */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <button
                onClick={onClose}
                style={{
                  padding: '6px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  display: 'flex',
                }}
                title="Close editor"
              >
                <Icons.ChevronLeft />
              </button>
              <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Edit Page
              </h2>
              {hasChanges && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    backgroundColor: 'var(--accent-yellow)',
                    color: 'white',
                    borderRadius: '10px',
                    fontWeight: 500,
                  }}
                >
                  Unsaved
                </span>
              )}
            </div>
            {sourceAttribution && (
              <div
                style={{
                  marginTop: '4px',
                  marginLeft: '36px',
                  fontSize: '0.8125rem',
                  color: 'var(--text-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-xs)',
                }}
              >
                <span>{sourceAttribution.icon}</span>
                <span>{sourceAttribution.label}</span>
                {sourceAttribution.detail && (
                  <>
                    <span style={{ opacity: 0.5 }}>·</span>
                    <span style={{ opacity: 0.7 }}>{sourceAttribution.detail}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Center: View mode toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: '6px',
              padding: '2px',
            }}
          >
            {(['split', 'edit', 'preview'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  backgroundColor: viewMode === mode ? 'var(--bg-primary)' : 'transparent',
                  color: viewMode === mode ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {mode === 'split' ? 'Split' : mode === 'edit' ? 'Edit' : 'Preview'}
              </button>
            ))}
          </div>

          {/* Right: Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            {/* Split button */}
            <button
              onClick={() => setShowSplitConfirm(true)}
              disabled={cursorPosition <= 0 || cursorPosition >= editedContent.length - 1}
              style={{
                padding: '6px 12px',
                fontSize: '0.8125rem',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: cursorPosition > 0 && cursorPosition < editedContent.length - 1
                  ? 'var(--text-secondary)'
                  : 'var(--text-tertiary)',
                cursor: cursorPosition > 0 && cursorPosition < editedContent.length - 1 ? 'pointer' : 'default',
                opacity: cursorPosition > 0 && cursorPosition < editedContent.length - 1 ? 1 : 0.5,
              }}
              title="Split passage at cursor position"
            >
              ✂️ Split
            </button>
            {page.originalContent && editedContent !== page.originalContent && (
              <button
                onClick={handleRestoreOriginal}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.8125rem',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
                title="Restore original content"
              >
                Restore Original
              </button>
            )}
            {hasChanges && (
              <button
                onClick={handleRevert}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.8125rem',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Revert
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              style={{
                padding: '6px 16px',
                fontSize: '0.8125rem',
                fontWeight: 500,
                backgroundColor: hasChanges ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                border: 'none',
                borderRadius: '6px',
                color: hasChanges ? 'white' : 'var(--text-tertiary)',
                cursor: hasChanges && !saving ? 'pointer' : 'default',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Split confirmation modal */}
        {showSplitConfirm && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 200,
            }}
            onClick={() => setShowSplitConfirm(false)}
          >
            <div
              style={{
                backgroundColor: 'var(--bg-panel)',
                borderRadius: '12px',
                padding: 'var(--space-lg)',
                maxWidth: '400px',
                width: '90%',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: 0, marginBottom: 'var(--space-md)', color: 'var(--text-primary)' }}>
                Split Page
              </h3>
              <p style={{ margin: 0, marginBottom: 'var(--space-md)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                This will split the page at position {cursorPosition} (of {editedContent.length} characters).
                A new page will be created with the content after the cursor.
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowSplitConfirm(false)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSplit}
                  disabled={splitting}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'var(--accent-primary)',
                    border: 'none',
                    borderRadius: '6px',
                    color: 'white',
                    cursor: splitting ? 'default' : 'pointer',
                    opacity: splitting ? 0.7 : 1,
                  }}
                >
                  {splitting ? 'Splitting...' : 'Split Page'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Word count bar */}
        <div
          style={{
            marginTop: 'var(--space-sm)',
            marginLeft: '36px',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-lg)',
            fontSize: '0.75rem',
            color: 'var(--text-tertiary)',
          }}
        >
          <span>
            <strong style={{ color: 'var(--text-secondary)' }}>{wordCounts.current}</strong> words
          </span>
          {wordCounts.original > 0 && wordCounts.original !== wordCounts.current && (
            <span>
              Original: {wordCounts.original} words
              <span
                style={{
                  marginLeft: '4px',
                  color: wordCounts.current > wordCounts.original ? 'var(--accent-green)' : 'var(--accent-yellow)',
                }}
              >
                ({wordCounts.current > wordCounts.original ? '+' : ''}
                {wordCounts.current - wordCounts.original})
              </span>
            </span>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div
            style={{
              marginTop: 'var(--space-sm)',
              padding: 'var(--space-sm) var(--space-md)',
              backgroundColor: 'var(--accent-red)20',
              borderRadius: '6px',
              color: 'var(--accent-red)',
              fontSize: '0.8125rem',
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex' }}>
        {viewMode === 'split' ? (
          <>
            {/* Original pane */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                borderRight: '1px solid var(--border-color)',
                minWidth: 0,
              }}
            >
              <div
                style={{
                  padding: 'var(--space-sm) var(--space-md)',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderBottom: '1px solid var(--border-color)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {page.originalContent ? 'Original' : 'Saved Version'}
              </div>
              <div
                style={{
                  flex: 1,
                  overflow: 'auto',
                  padding: 'var(--space-lg)',
                }}
              >
                <div style={{ maxWidth: '65ch', margin: '0 auto' }}>
                  <MarkdownRenderer content={page.originalContent || page.content} />
                </div>
              </div>
            </div>

            {/* Edited pane */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'var(--bg-secondary)',
                minWidth: 0,
              }}
            >
              <div
                style={{
                  padding: 'var(--space-sm) var(--space-md)',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderBottom: '1px solid var(--border-color)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Current (Editing)
              </div>
              <div
                style={{
                  flex: 1,
                  overflow: 'auto',
                  padding: 'var(--space-md)',
                }}
              >
                <MarkdownEditor
                  content={editedContent}
                  onChange={setEditedContent}
                  onCursorChange={setCursorPosition}
                  placeholder="Start writing..."
                />
              </div>
            </div>
          </>
        ) : viewMode === 'edit' ? (
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: 'var(--space-lg)',
              backgroundColor: 'var(--bg-secondary)',
            }}
          >
            <div style={{ maxWidth: '80ch', margin: '0 auto' }}>
              <MarkdownEditor
                content={editedContent}
                onChange={setEditedContent}
                onCursorChange={setCursorPosition}
                placeholder="Start writing..."
              />
            </div>
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: 'var(--space-lg)',
            }}
          >
            <div style={{ maxWidth: '65ch', margin: '0 auto' }}>
              <MarkdownRenderer content={editedContent} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
