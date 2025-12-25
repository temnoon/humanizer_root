/**
 * Books View - Book projects with build status
 */

import { useState, useEffect } from 'react';

interface Book {
  id: string;
  title: string;
  subtitle?: string;
  author?: string;
  status: 'draft' | 'building' | 'complete';
  wordCount?: number;
  chapterCount?: number;
  pageCount?: number;
  updatedAt?: string;
}

export function BooksView() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('humanizer-auth-token');
      const response = await fetch('https://npe-api.tem-527.workers.dev/books', {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });

      if (response.status === 401) {
        setError('Sign in to see your books');
        setBooks([]);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load books');
      }

      const data = await response.json();
      setBooks(data.books || []);
    } catch (err) {
      setError('Could not load books');
      setBooks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleNewBook = () => {
    // TODO: Open book creation modal
    console.log('Create new book');
  };

  if (loading) {
    return (
      <div className="archive-browser__loading">
        Loading books...
      </div>
    );
  }

  return (
    <div className="books-list">
      {/* Create new book button */}
      <button className="tool-card tool-card--subtle" onClick={handleNewBook}>
        <span className="tool-card__name">+ New Book</span>
        <span className="tool-card__desc">Start a new book project</span>
      </button>

      {/* Error state */}
      {error && (
        <div className="tool-panel__empty">
          <p>{error}</p>
        </div>
      )}

      {/* Books list */}
      {books.length > 0 ? (
        books.map(book => (
          <div key={book.id} className="book-card">
            <div className="book-card__cover">📖</div>
            <div className="book-card__info">
              <div className="book-card__title">{book.title}</div>
              {book.subtitle && (
                <div className="book-card__meta">{book.subtitle}</div>
              )}
              <div className="book-card__meta">
                {book.chapterCount && `${book.chapterCount} chapters`}
                {book.wordCount && ` · ${book.wordCount.toLocaleString()} words`}
              </div>
            </div>
            <span className={`book-card__status book-card__status--${book.status}`}>
              {book.status}
            </span>
          </div>
        ))
      ) : !error && (
        <div className="tool-panel__empty">
          <p>No books yet</p>
          <span className="tool-panel__muted">Create your first book to get started</span>
        </div>
      )}
    </div>
  );
}
