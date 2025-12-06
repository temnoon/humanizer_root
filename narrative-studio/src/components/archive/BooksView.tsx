/**
 * BooksView - Bookmaking tool interface for narrative-studio
 * Provides book list, structure navigation, and page editing
 */

import { useState, useEffect } from 'react';
import { Icons } from '../layout/Icons';
import {
  booksService,
  type Book,
  type Chapter,
  type Section,
  type Page,
  type PageSource,
} from '../../services/booksService';

interface BooksViewProps {
  onSelectContent?: (content: string, metadata: Record<string, unknown>) => void;
}

export function BooksView({ onSelectContent }: BooksViewProps) {
  // State
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedPage, setSelectedPage] = useState<Page | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCreateBook, setShowCreateBook] = useState(false);
  const [showCreateChapter, setShowCreateChapter] = useState(false);
  const [showCreateSection, setShowCreateSection] = useState<string | null>(null); // chapterId
  const [showCreatePage, setShowCreatePage] = useState<string | null>(null); // sectionId

  // Form states
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newPageContent, setNewPageContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  // Load books on mount
  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await booksService.listBooks();
      setBooks(result.books || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load books');
      console.error('Failed to load books:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadBook = async (bookId: string) => {
    setLoading(true);
    try {
      const book = await booksService.getBook(bookId);
      setSelectedBook(book);
      // Expand all chapters by default
      if (book.chapters) {
        setExpandedChapters(new Set(book.chapters.map(c => c.id)));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load book');
    } finally {
      setLoading(false);
    }
  };

  const loadPage = async (pageId: string) => {
    if (!selectedBook) return;
    setLoading(true);
    try {
      const page = await booksService.getPage(selectedBook.id, pageId);
      setSelectedPage(page);
      setEditContent(page.content);

      // Notify parent component
      if (onSelectContent) {
        onSelectContent(page.content, {
          source: 'book',
          bookId: selectedBook.id,
          bookTitle: selectedBook.title,
          pageId: page.id,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load page');
    } finally {
      setLoading(false);
    }
  };

  // Create handlers
  const handleCreateBook = async () => {
    if (!newBookTitle.trim()) return;
    try {
      const book = await booksService.createBook({ title: newBookTitle.trim() });
      setBooks(prev => [book, ...prev]);
      setNewBookTitle('');
      setShowCreateBook(false);
      // Auto-select the new book
      setSelectedBook(book);
    } catch (err: any) {
      setError(err.message || 'Failed to create book');
    }
  };

  const handleCreateChapter = async () => {
    if (!selectedBook || !newChapterTitle.trim()) return;
    try {
      const chapter = await booksService.createChapter(selectedBook.id, {
        title: newChapterTitle.trim(),
      });
      // Reload book to get updated structure
      await loadBook(selectedBook.id);
      setNewChapterTitle('');
      setShowCreateChapter(false);
      // Expand the new chapter
      setExpandedChapters(prev => new Set([...prev, chapter.id]));
    } catch (err: any) {
      setError(err.message || 'Failed to create chapter');
    }
  };

  const handleCreateSection = async (chapterId: string) => {
    if (!selectedBook) return;
    try {
      await booksService.createSection(selectedBook.id, chapterId, {
        title: newSectionTitle.trim() || undefined,
      });
      await loadBook(selectedBook.id);
      setNewSectionTitle('');
      setShowCreateSection(null);
    } catch (err: any) {
      setError(err.message || 'Failed to create section');
    }
  };

  const handleCreatePage = async (sectionId: string) => {
    if (!selectedBook || !newPageContent.trim()) return;
    try {
      const source: PageSource = {
        type: 'manual',
        importedAt: Date.now(),
        originalWordCount: newPageContent.trim().split(/\s+/).length,
      };
      const page = await booksService.createPage(selectedBook.id, sectionId, {
        content: newPageContent.trim(),
        contentType: 'text',
        source,
      });
      await loadBook(selectedBook.id);
      setNewPageContent('');
      setShowCreatePage(null);
      // Load the new page
      loadPage(page.id);
    } catch (err: any) {
      setError(err.message || 'Failed to create page');
    }
  };

  const handleSavePage = async () => {
    if (!selectedBook || !selectedPage) return;
    try {
      await booksService.updatePage(selectedBook.id, selectedPage.id, {
        content: editContent,
      });
      setSelectedPage({ ...selectedPage, content: editContent });
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save page');
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    if (!confirm('Delete this book? This cannot be undone.')) return;
    try {
      await booksService.deleteBook(bookId);
      setBooks(prev => prev.filter(b => b.id !== bookId));
      if (selectedBook?.id === bookId) {
        setSelectedBook(null);
        setSelectedPage(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete book');
    }
  };

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  };

  // Render book list
  if (!selectedBook) {
    return (
      <div style={{ padding: 'var(--space-md)', height: '100%', overflow: 'auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-md)',
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}>
            My Books
          </h3>
          <button
            onClick={() => setShowCreateBook(true)}
            style={{
              background: 'var(--accent-primary-gradient)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '0.4rem 0.8rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + New Book
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: 'var(--space-sm)',
            marginBottom: 'var(--space-md)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--error)',
            borderRadius: '4px',
            color: 'var(--error)',
            fontSize: '0.8125rem',
          }}>
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-secondary)' }}>
            Loading books...
          </div>
        )}

        {/* Empty state */}
        {!loading && books.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-xl)',
            color: 'var(--text-secondary)',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>📚</div>
            <p style={{ margin: 0 }}>No books yet</p>
            <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.8125rem', opacity: 0.7 }}>
              Create your first book to get started
            </p>
          </div>
        )}

        {/* Book list */}
        {!loading && books.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {books.map(book => (
              <div
                key={book.id}
                onClick={() => loadBook(book.id)}
                style={{
                  padding: 'var(--space-md)',
                  backgroundColor: 'var(--bg-elevated)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s',
                  border: '1px solid var(--border-color)',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <span style={{ fontSize: '1.25rem' }}>📖</span>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      fontSize: '0.9375rem',
                    }}>
                      {book.title}
                    </div>
                    {book.subtitle && (
                      <div style={{
                        fontSize: '0.8125rem',
                        color: 'var(--text-secondary)',
                        marginTop: '2px',
                      }}>
                        {book.subtitle}
                      </div>
                    )}
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-tertiary)',
                      marginTop: '4px',
                    }}>
                      {book.stats?.chapterCount || 0} chapters
                      {' \u00b7 '}
                      {book.stats?.pageCount || 0} pages
                      {' \u00b7 '}
                      {(book.stats?.wordCount || 0).toLocaleString()} words
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteBook(book.id);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer',
                      padding: '4px',
                      opacity: 0.5,
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
                    title="Delete book"
                  >
                    <Icons.Close />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create book modal */}
        {showCreateBook && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}>
            <div style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '8px',
              padding: 'var(--space-lg)',
              width: '90%',
              maxWidth: '400px',
            }}>
              <h3 style={{ margin: '0 0 var(--space-md)', color: 'var(--text-primary)' }}>
                Create New Book
              </h3>
              <input
                type="text"
                value={newBookTitle}
                onChange={e => setNewBookTitle(e.target.value)}
                placeholder="Book title..."
                autoFocus
                style={{
                  width: '100%',
                  padding: 'var(--space-sm)',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '0.9375rem',
                  marginBottom: 'var(--space-md)',
                }}
                onKeyDown={e => e.key === 'Enter' && handleCreateBook()}
              />
              <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowCreateBook(false);
                    setNewBookTitle('');
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateBook}
                  disabled={!newBookTitle.trim()}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'var(--accent-primary-gradient)',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    fontWeight: 600,
                    cursor: newBookTitle.trim() ? 'pointer' : 'not-allowed',
                    opacity: newBookTitle.trim() ? 1 : 0.5,
                  }}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render book editor
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Book header */}
      <div style={{
        padding: 'var(--space-md)',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <button
            onClick={() => {
              setSelectedBook(null);
              setSelectedPage(null);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <Icons.ArrowLeft />
          </button>
          <span style={{ fontSize: '1.25rem' }}>📖</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {selectedBook.title}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              {selectedBook.chapters?.length || 0} chapters
            </div>
          </div>
          <button
            onClick={() => setShowCreateChapter(true)}
            style={{
              background: 'var(--accent-primary-gradient)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '0.3rem 0.6rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Chapter
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: 'var(--space-sm)',
          margin: 'var(--space-sm)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--error)',
          borderRadius: '4px',
          color: 'var(--error)',
          fontSize: '0.8125rem',
        }}>
          {error}
          <button
            onClick={() => setError(null)}
            style={{
              float: 'right',
              background: 'transparent',
              border: 'none',
              color: 'var(--error)',
              cursor: 'pointer',
            }}
          >
            <Icons.Close />
          </button>
        </div>
      )}

      {/* Two-column layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Structure tree */}
        <div style={{
          width: '50%',
          borderRight: '1px solid var(--border-color)',
          overflow: 'auto',
          padding: 'var(--space-sm)',
        }}>
          {/* Chapters */}
          {selectedBook.chapters?.map(chapter => (
            <div key={chapter.id} style={{ marginBottom: 'var(--space-xs)' }}>
              {/* Chapter header */}
              <div
                onClick={() => toggleChapter(chapter.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-xs)',
                  padding: 'var(--space-xs) var(--space-sm)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <span style={{
                  fontSize: '0.625rem',
                  color: 'var(--text-tertiary)',
                  transform: expandedChapters.has(chapter.id) ? 'rotate(90deg)' : 'rotate(0)',
                  transition: 'transform 0.15s',
                }}>
                  &#9654;
                </span>
                <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                  {chapter.title}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCreateSection(chapter.id);
                  }}
                  style={{
                    marginLeft: 'auto',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    padding: '2px 4px',
                  }}
                  title="Add section"
                >
                  +
                </button>
              </div>

              {/* Sections */}
              {expandedChapters.has(chapter.id) && (
                <div style={{ paddingLeft: 'var(--space-md)', borderLeft: '1px solid var(--border-color)', marginLeft: 'var(--space-sm)' }}>
                  {chapter.sections?.map((section, sIdx) => (
                    <div key={section.id} style={{ marginTop: 'var(--space-xs)' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-xs)',
                        padding: 'var(--space-xs)',
                        fontSize: '0.8125rem',
                        color: 'var(--text-secondary)',
                      }}>
                        <span>{section.title || `Section ${sIdx + 1}`}</span>
                        <button
                          onClick={() => setShowCreatePage(section.id)}
                          style={{
                            marginLeft: 'auto',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--accent-primary)',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                          }}
                          title="Add passage"
                        >
                          + Passage
                        </button>
                      </div>

                      {/* Pages */}
                      <div style={{ paddingLeft: 'var(--space-sm)' }}>
                        {section.pages?.map((page, pIdx) => (
                          <button
                            key={page.id}
                            onClick={() => loadPage(page.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-xs)',
                              width: '100%',
                              padding: 'var(--space-xs)',
                              background: selectedPage?.id === page.id
                                ? 'color-mix(in srgb, var(--accent-primary) 20%, transparent)'
                                : 'transparent',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              textAlign: 'left',
                              color: selectedPage?.id === page.id
                                ? 'var(--accent-primary)'
                                : 'var(--text-tertiary)',
                              fontSize: '0.8125rem',
                            }}
                          >
                            <span style={{ fontSize: '0.75rem' }}>&#128196;</span>
                            <span>Passage {pIdx + 1}</span>
                            <span style={{ marginLeft: 'auto', fontSize: '0.6875rem', opacity: 0.7 }}>
                              {page.wordCount}w
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  {(!chapter.sections || chapter.sections.length === 0) && (
                    <div style={{
                      padding: 'var(--space-sm)',
                      fontSize: '0.75rem',
                      color: 'var(--text-tertiary)',
                      fontStyle: 'italic',
                    }}>
                      No sections yet
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {(!selectedBook.chapters || selectedBook.chapters.length === 0) && (
            <div style={{
              padding: 'var(--space-lg)',
              textAlign: 'center',
              color: 'var(--text-tertiary)',
            }}>
              <p style={{ margin: 0 }}>No chapters yet</p>
              <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.75rem' }}>
                Click "+ Chapter" to add one
              </p>
            </div>
          )}
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-md)' }}>
          {selectedPage ? (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 'var(--space-md)',
              }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  {selectedPage.wordCount} words
                </span>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setEditContent(selectedPage.content);
                        }}
                        style={{
                          padding: '0.3rem 0.6rem',
                          backgroundColor: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          color: 'var(--text-primary)',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSavePage}
                        style={{
                          padding: '0.3rem 0.6rem',
                          background: 'var(--accent-primary-gradient)',
                          border: 'none',
                          borderRadius: '4px',
                          color: 'white',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Save
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditing(true)}
                      style={{
                        padding: '0.3rem 0.6rem',
                        backgroundColor: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        color: 'var(--text-primary)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {isEditing ? (
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: '300px',
                    padding: 'var(--space-sm)',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                    fontSize: '0.9375rem',
                    lineHeight: 1.7,
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              ) : (
                <div style={{
                  fontSize: '0.9375rem',
                  lineHeight: 1.7,
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                }}>
                  {selectedPage.content}
                </div>
              )}
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-tertiary)',
              textAlign: 'center',
            }}>
              <div>
                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>&#128196;</div>
                <p style={{ margin: 0 }}>Select a page to view</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create chapter modal */}
      {showCreateChapter && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            padding: 'var(--space-lg)',
            width: '90%',
            maxWidth: '400px',
          }}>
            <h3 style={{ margin: '0 0 var(--space-md)', color: 'var(--text-primary)' }}>
              Create Chapter
            </h3>
            <input
              type="text"
              value={newChapterTitle}
              onChange={e => setNewChapterTitle(e.target.value)}
              placeholder="Chapter title..."
              autoFocus
              style={{
                width: '100%',
                padding: 'var(--space-sm)',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '0.9375rem',
                marginBottom: 'var(--space-md)',
              }}
              onKeyDown={e => e.key === 'Enter' && handleCreateChapter()}
            />
            <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowCreateChapter(false);
                  setNewChapterTitle('');
                }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateChapter}
                disabled={!newChapterTitle.trim()}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--accent-primary-gradient)',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  fontWeight: 600,
                  cursor: newChapterTitle.trim() ? 'pointer' : 'not-allowed',
                  opacity: newChapterTitle.trim() ? 1 : 0.5,
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create section modal */}
      {showCreateSection && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            padding: 'var(--space-lg)',
            width: '90%',
            maxWidth: '400px',
          }}>
            <h3 style={{ margin: '0 0 var(--space-md)', color: 'var(--text-primary)' }}>
              Create Section
            </h3>
            <input
              type="text"
              value={newSectionTitle}
              onChange={e => setNewSectionTitle(e.target.value)}
              placeholder="Section title (optional)..."
              autoFocus
              style={{
                width: '100%',
                padding: 'var(--space-sm)',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '0.9375rem',
                marginBottom: 'var(--space-md)',
              }}
              onKeyDown={e => e.key === 'Enter' && handleCreateSection(showCreateSection)}
            />
            <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowCreateSection(null);
                  setNewSectionTitle('');
                }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleCreateSection(showCreateSection)}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--accent-primary-gradient)',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create page modal */}
      {showCreatePage && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            padding: 'var(--space-lg)',
            width: '90%',
            maxWidth: '600px',
          }}>
            <h3 style={{ margin: '0 0 var(--space-md)', color: 'var(--text-primary)' }}>
              Create Page
            </h3>
            <textarea
              value={newPageContent}
              onChange={e => setNewPageContent(e.target.value)}
              placeholder="Passage content..."
              autoFocus
              style={{
                width: '100%',
                minHeight: '200px',
                padding: 'var(--space-sm)',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '0.9375rem',
                lineHeight: 1.7,
                marginBottom: 'var(--space-md)',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowCreatePage(null);
                  setNewPageContent('');
                }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleCreatePage(showCreatePage)}
                disabled={!newPageContent.trim()}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--accent-primary-gradient)',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  fontWeight: 600,
                  cursor: newPageContent.trim() ? 'pointer' : 'not-allowed',
                  opacity: newPageContent.trim() ? 1 : 0.5,
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
