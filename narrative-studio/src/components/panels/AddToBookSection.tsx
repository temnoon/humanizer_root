/**
 * AddToBookSection - Collapsible section for adding content to the active book
 *
 * Shows when there's an active book selected, allowing users to:
 * - Select a chapter/section from the book structure
 * - Create new chapters/sections inline
 * - Add current content as a new page
 */

import { useState, useMemo } from 'react';
import { useActiveBook } from '../../contexts/ActiveBookContext';
import { Icons } from '../layout/Icons';
import type { PageSource } from '../../services/booksService';

interface AddToBookSectionProps {
  content: string;
  sourceType?: 'archive' | 'gutenberg' | 'notes' | 'folder' | 'url' | 'manual' | 'synthesis';
  sourceMetadata?: Record<string, unknown>;
  onSuccess?: () => void;
}

export function AddToBookSection({
  content,
  sourceType = 'manual',
  sourceMetadata,
  onSuccess,
}: AddToBookSectionProps) {
  const {
    activeBook,
    addToBook,
    createChapter,
    createSection,
    refreshActiveBook,
  } = useActiveBook();

  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [showNewChapter, setShowNewChapter] = useState(false);
  const [showNewSection, setShowNewSection] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [success, setSuccess] = useState(false);

  // Get sections for selected chapter
  const sectionsForChapter = useMemo(() => {
    if (!activeBook?.chapters || !selectedChapterId) return [];
    const chapter = activeBook.chapters.find(c => c.id === selectedChapterId);
    return chapter?.sections || [];
  }, [activeBook, selectedChapterId]);

  // Build page source from metadata
  const buildPageSource = (): PageSource => {
    const source: PageSource = {
      type: sourceType,
      importedAt: Date.now(),
      originalWordCount: content.trim().split(/\s+/).length,
    };

    // Add archive-specific fields if provided
    if (sourceMetadata?.archiveName) {
      source.archiveName = sourceMetadata.archiveName as string;
    }
    if (sourceMetadata?.conversationId) {
      source.conversationId = sourceMetadata.conversationId as string;
    }
    if (sourceMetadata?.messageId) {
      source.messageId = sourceMetadata.messageId as string;
    }

    return source;
  };

  const handleAddToBook = async () => {
    if (!content.trim()) return;

    setAdding(true);
    setSuccess(false);

    try {
      const page = await addToBook({
        content: content.trim(),
        source: buildPageSource(),
        chapterId: selectedChapterId || undefined,
        sectionId: selectedSectionId || undefined,
        createChapterTitle: !selectedChapterId ? 'Imported Content' : undefined,
        createSectionTitle: !selectedSectionId ? undefined : undefined,
      });

      if (page) {
        setSuccess(true);
        onSuccess?.();
        // Reset selections
        setTimeout(() => {
          setSuccess(false);
        }, 3000);
      }
    } catch (err) {
      console.error('Failed to add to book:', err);
    } finally {
      setAdding(false);
    }
  };

  const handleCreateChapter = async () => {
    if (!newChapterTitle.trim()) return;

    const chapter = await createChapter(newChapterTitle.trim());
    if (chapter) {
      setSelectedChapterId(chapter.id);
      setNewChapterTitle('');
      setShowNewChapter(false);
      // Clear section selection
      setSelectedSectionId(null);
    }
  };

  const handleCreateSection = async () => {
    if (!selectedChapterId) return;

    const section = await createSection(selectedChapterId, newSectionTitle.trim() || undefined);
    if (section) {
      setSelectedSectionId(section.id);
      setNewSectionTitle('');
      setShowNewSection(false);
    }
  };

  // Don't render if no active book
  if (!activeBook) {
    return (
      <div
        style={{
          padding: 'var(--space-md)',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-sm)',
            color: 'var(--text-tertiary)',
            fontSize: '0.8125rem',
          }}
        >
          <span>📚</span>
          <span>Select a book from the top bar to add content</span>
        </div>
      </div>
    );
  }

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div
      style={{
        borderTop: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)',
      }}
    >
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          padding: 'var(--space-md)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            fontSize: '0.625rem',
            color: 'var(--text-tertiary)',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)',
            transition: 'transform 0.15s',
          }}
        >
          &#9654;
        </span>
        <span style={{ fontSize: '1rem' }}>📖</span>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontWeight: 600,
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
            }}
          >
            Add to Book
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
            }}
          >
            {activeBook.title}
          </div>
        </div>
        {success && (
          <span
            style={{
              color: 'var(--success, #22c55e)',
              fontSize: '0.875rem',
            }}
          >
            ✓ Added
          </span>
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div style={{ padding: '0 var(--space-md) var(--space-md)' }}>
          {/* Content preview */}
          <div
            style={{
              padding: 'var(--space-sm)',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: '4px',
              marginBottom: 'var(--space-sm)',
            }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-tertiary)',
                marginBottom: '4px',
              }}
            >
              Content to add ({wordCount} words)
            </div>
            <div
              style={{
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
                maxHeight: '60px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {content.substring(0, 150)}...
            </div>
          </div>

          {/* Chapter selector */}
          <div style={{ marginBottom: 'var(--space-sm)' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                marginBottom: '4px',
              }}
            >
              Chapter
            </label>
            <div style={{ display: 'flex', gap: '4px' }}>
              <select
                value={selectedChapterId || ''}
                onChange={e => {
                  setSelectedChapterId(e.target.value || null);
                  setSelectedSectionId(null);
                }}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '0.8125rem',
                }}
              >
                <option value="">Auto-create chapter</option>
                {activeBook.chapters?.map(chapter => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.title}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowNewChapter(!showNewChapter)}
                style={{
                  padding: '6px 10px',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  color: 'var(--accent-primary)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
                title="Create new chapter"
              >
                +
              </button>
            </div>

            {/* New chapter input */}
            {showNewChapter && (
              <div style={{ marginTop: '4px', display: 'flex', gap: '4px' }}>
                <input
                  type="text"
                  value={newChapterTitle}
                  onChange={e => setNewChapterTitle(e.target.value)}
                  placeholder="New chapter title..."
                  autoFocus
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--accent-primary)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                    fontSize: '0.8125rem',
                  }}
                  onKeyDown={e => e.key === 'Enter' && handleCreateChapter()}
                />
                <button
                  onClick={handleCreateChapter}
                  disabled={!newChapterTitle.trim()}
                  style={{
                    padding: '6px 12px',
                    background: 'var(--accent-primary-gradient)',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    cursor: newChapterTitle.trim() ? 'pointer' : 'not-allowed',
                    opacity: newChapterTitle.trim() ? 1 : 0.5,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  Create
                </button>
              </div>
            )}
          </div>

          {/* Section selector - only show if chapter is selected */}
          {selectedChapterId && (
            <div style={{ marginBottom: 'var(--space-sm)' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '4px',
                }}
              >
                Section
              </label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <select
                  value={selectedSectionId || ''}
                  onChange={e => setSelectedSectionId(e.target.value || null)}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                    fontSize: '0.8125rem',
                  }}
                >
                  <option value="">Auto-create section</option>
                  {sectionsForChapter.map((section, idx) => (
                    <option key={section.id} value={section.id}>
                      {section.title || `Section ${idx + 1}`}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowNewSection(!showNewSection)}
                  style={{
                    padding: '6px 10px',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--accent-primary)',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                  title="Create new section"
                >
                  +
                </button>
              </div>

              {/* New section input */}
              {showNewSection && (
                <div style={{ marginTop: '4px', display: 'flex', gap: '4px' }}>
                  <input
                    type="text"
                    value={newSectionTitle}
                    onChange={e => setNewSectionTitle(e.target.value)}
                    placeholder="Section title (optional)..."
                    autoFocus
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--accent-primary)',
                      borderRadius: '4px',
                      color: 'var(--text-primary)',
                      fontSize: '0.8125rem',
                    }}
                    onKeyDown={e => e.key === 'Enter' && handleCreateSection()}
                  />
                  <button
                    onClick={handleCreateSection}
                    style={{
                      padding: '6px 12px',
                      background: 'var(--accent-primary-gradient)',
                      border: 'none',
                      borderRadius: '4px',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    Create
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Add button */}
          <button
            onClick={handleAddToBook}
            disabled={adding || !content.trim()}
            style={{
              width: '100%',
              padding: '10px',
              background: 'var(--accent-primary-gradient)',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              fontWeight: 600,
              cursor: adding || !content.trim() ? 'not-allowed' : 'pointer',
              opacity: adding || !content.trim() ? 0.5 : 1,
              fontSize: '0.875rem',
            }}
          >
            {adding ? 'Adding...' : `Add to "${activeBook.title}"`}
          </button>
        </div>
      )}
    </div>
  );
}
