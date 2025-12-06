/**
 * BookSelector - Top bar book selector dropdown
 *
 * Shows the active book and allows selecting a different book
 * or creating a new one. Compact design for the top bar.
 */

import { useState, useRef, useEffect } from 'react';
import { useActiveBook } from '../../contexts/ActiveBookContext';

export function BookSelector() {
  const {
    activeBook,
    books,
    booksLoading,
    setActiveBook,
    createBook,
    refreshBooks,
  } = useActiveBook();

  const [isOpen, setIsOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Refresh books when dropdown opens
  useEffect(() => {
    if (isOpen) {
      refreshBooks();
    }
  }, [isOpen, refreshBooks]);

  const handleSelectBook = async (bookId: string | null) => {
    await setActiveBook(bookId);
    setIsOpen(false);
  };

  const handleCreateBook = async () => {
    if (!newBookTitle.trim() || creating) return;

    setCreating(true);
    try {
      await createBook(newBookTitle.trim());
      setNewBookTitle('');
      setShowCreateModal(false);
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to create book:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', zIndex: 60 }}>
      {/* Selector button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="ui-text flex items-center gap-2 px-3 py-2 rounded-md transition-smooth hover:opacity-70"
        style={{
          backgroundImage: isOpen ? 'var(--accent-primary-gradient)' : 'none',
          backgroundColor: isOpen ? 'transparent' : 'var(--bg-secondary)',
          color: isOpen ? 'var(--text-inverse)' : 'var(--text-primary)',
          border: activeBook ? '1px solid var(--accent-primary)' : '1px solid transparent',
        }}
        aria-label="Select active book"
        title={activeBook ? `Active book: ${activeBook.title}` : 'No book selected'}
      >
        <span style={{ fontSize: '1rem' }}>
          {activeBook ? '📖' : '📚'}
        </span>
        <div className="hidden sm:flex flex-col items-start" style={{ maxWidth: '150px' }}>
          <span
            className="text-xs font-medium"
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
            }}
          >
            {activeBook ? activeBook.title : 'No Book'}
          </span>
          {activeBook && (
            <span className="text-xs opacity-75">
              {activeBook.stats?.pageCount || 0} passages
            </span>
          )}
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 8L2 4h8L6 8z" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Menu */}
          <div
            className="absolute right-0 mt-2 w-64 shadow-lg overflow-hidden"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 100, // Must be higher than ArchivePanel (z-50)
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: 'var(--space-sm) var(--space-md)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                className="text-xs font-semibold"
                style={{ color: 'var(--text-secondary)', textTransform: 'uppercase' }}
              >
                Active Book
              </span>
              <button
                onClick={() => {
                  setShowCreateModal(true);
                  setIsOpen(false);
                }}
                className="text-xs font-medium px-2 py-1 rounded transition-opacity hover:opacity-80"
                style={{
                  background: 'var(--accent-primary-gradient)',
                  color: 'var(--text-inverse)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                + New
              </button>
            </div>

            {/* Book list */}
            <div style={{ maxHeight: '300px', overflow: 'auto' }}>
              {/* No book option */}
              <button
                onClick={() => handleSelectBook(null)}
                className="w-full text-left transition-smooth"
                style={{
                  padding: 'var(--space-sm) var(--space-md)',
                  backgroundColor: !activeBook ? 'var(--bg-tertiary)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-sm)',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = !activeBook ? 'var(--bg-tertiary)' : 'transparent'}
              >
                <span style={{ opacity: 0.5 }}>📚</span>
                <span
                  className="text-sm"
                  style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}
                >
                  No book selected
                </span>
                {!activeBook && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      color: 'var(--accent-primary)',
                      fontSize: '0.75rem',
                    }}
                  >
                    ✓
                  </span>
                )}
              </button>

              {booksLoading ? (
                <div
                  className="text-sm text-center"
                  style={{ padding: 'var(--space-md)', color: 'var(--text-tertiary)' }}
                >
                  Loading...
                </div>
              ) : books.length === 0 ? (
                <div
                  className="text-sm text-center"
                  style={{ padding: 'var(--space-md)', color: 'var(--text-tertiary)' }}
                >
                  No books yet. Create one to get started!
                </div>
              ) : (
                books.map(book => (
                  <button
                    key={book.id}
                    onClick={() => handleSelectBook(book.id)}
                    className="w-full text-left transition-smooth"
                    style={{
                      padding: 'var(--space-sm) var(--space-md)',
                      backgroundColor: activeBook?.id === book.id ? 'var(--bg-tertiary)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-sm)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = activeBook?.id === book.id ? 'var(--bg-tertiary)' : 'transparent'}
                  >
                    <span>📖</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        className="text-sm font-medium"
                        style={{
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {book.title}
                      </div>
                      <div
                        className="text-xs"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {book.stats?.chapterCount || 0} ch · {book.stats?.pageCount || 0} passages
                      </div>
                    </div>
                    {activeBook?.id === book.id && (
                      <span
                        style={{
                          color: 'var(--accent-primary)',
                          fontSize: '0.75rem',
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Create book modal */}
      {showCreateModal && (
        <>
          <div
            className="fixed inset-0 z-50"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onClick={() => {
              setShowCreateModal(false);
              setNewBookTitle('');
            }}
          />
          <div
            className="fixed z-50"
            style={{
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '8px',
              padding: 'var(--space-lg)',
              width: '90%',
              maxWidth: '400px',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3
              style={{
                margin: '0 0 var(--space-md)',
                color: 'var(--text-primary)',
                fontSize: '1.125rem',
                fontWeight: 600,
              }}
            >
              Create New Book
            </h3>
            <input
              type="text"
              value={newBookTitle}
              onChange={e => setNewBookTitle(e.target.value)}
              placeholder="Book title..."
              autoFocus
              className="ui-text"
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
                  setShowCreateModal(false);
                  setNewBookTitle('');
                }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '0.9375rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBook}
                disabled={!newBookTitle.trim() || creating}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--accent-primary-gradient)',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'var(--text-inverse)',
                  fontWeight: 600,
                  cursor: newBookTitle.trim() && !creating ? 'pointer' : 'not-allowed',
                  opacity: newBookTitle.trim() && !creating ? 1 : 0.5,
                  fontSize: '0.9375rem',
                }}
              >
                {creating ? 'Creating...' : 'Create & Activate'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
