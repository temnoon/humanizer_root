/**
 * GutenbergView - Project Gutenberg Book Browser
 *
 * Provides access to public domain literature for experimentation
 * with transformations, persona creation, and style exploration.
 *
 * Features:
 * - Curated collection of featured books
 * - Search Gutenberg catalog via gutendex.com API
 * - Preview excerpts before loading
 * - "Use as Source" to load book into workspace
 */

import { useState } from 'react';

interface GutenbergBook {
  id: number;
  title: string;
  authors: Array<{ name: string }>;
  subjects: string[];
  languages: string[];
  download_count: number;
}

interface GutenbergViewProps {
  onSelectText?: (text: string, title: string) => void;
}

export function GutenbergView({ onSelectText }: GutenbergViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GutenbergBook[]>([]);
  const [selectedBook, setSelectedBook] = useState<GutenbergBook | null>(null);
  const [bookText, setBookText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Featured books for quick access (curated collection)
  const featuredBooks: GutenbergBook[] = [
    { id: 1342, title: 'Pride and Prejudice', authors: [{ name: 'Austen, Jane' }], subjects: ['Fiction'], languages: ['en'], download_count: 50000 },
    { id: 84, title: 'Frankenstein', authors: [{ name: 'Shelley, Mary' }], subjects: ['Fiction', 'Gothic'], languages: ['en'], download_count: 40000 },
    { id: 1661, title: 'Sherlock Holmes', authors: [{ name: 'Doyle, Arthur Conan' }], subjects: ['Fiction', 'Mystery'], languages: ['en'], download_count: 35000 },
    { id: 11, title: "Alice's Adventures in Wonderland", authors: [{ name: 'Carroll, Lewis' }], subjects: ['Fiction', 'Fantasy'], languages: ['en'], download_count: 30000 },
    { id: 2701, title: 'Moby Dick', authors: [{ name: 'Melville, Herman' }], subjects: ['Fiction', 'Adventure'], languages: ['en'], download_count: 25000 },
    { id: 1232, title: 'The Prince', authors: [{ name: 'Machiavelli, Niccolò' }], subjects: ['Political Science'], languages: ['en'], download_count: 20000 },
  ];

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`https://gutendex.com/books/?search=${encodeURIComponent(searchQuery)}&languages=en`);
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (err) {
      setError('Failed to search Gutenberg. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadBookPreview = async (book: GutenbergBook) => {
    setSelectedBook(book);
    setBookText(null);
    setLoading(true);
    setError(null);
    try {
      // Try to fetch plain text version
      const textUrl = `https://www.gutenberg.org/files/${book.id}/${book.id}-0.txt`;
      const response = await fetch(textUrl);
      if (!response.ok) {
        // Fallback to alternative format
        const altUrl = `https://www.gutenberg.org/cache/epub/${book.id}/pg${book.id}.txt`;
        const altResponse = await fetch(altUrl);
        if (!altResponse.ok) throw new Error('Book text not available');
        const text = await altResponse.text();
        setBookText(text.slice(0, 10000)); // First 10K chars for preview
      } else {
        const text = await response.text();
        setBookText(text.slice(0, 10000));
      }
    } catch (err) {
      setError('Could not load book preview. Try another book.');
    } finally {
      setLoading(false);
    }
  };

  const handleUseAsSource = () => {
    if (bookText && selectedBook && onSelectText) {
      onSelectText(bookText, selectedBook.title);
    }
  };

  const displayBooks = searchResults.length > 0 ? searchResults : featuredBooks;

  return (
    <div className="gutenberg-view" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 'var(--space-md)' }}>
      {/* Search Section */}
      <div style={{ marginBottom: 'var(--space-md)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search Gutenberg catalog..."
            style={{
              flex: 1,
              padding: 'var(--space-sm)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
            }}
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            style={{
              padding: 'var(--space-sm) var(--space-md)',
              background: 'var(--accent-primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? '...' : 'Search'}
          </button>
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
          {searchResults.length > 0
            ? `${searchResults.length} results`
            : 'Featured public domain books for experimentation'}
        </div>
      </div>

      {error && (
        <div style={{ padding: 'var(--space-sm)', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)' }}>
          {error}
        </div>
      )}

      {/* Two-panel layout */}
      <div style={{ display: 'flex', flex: 1, gap: 'var(--space-md)', minHeight: 0 }}>
        {/* Book List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {displayBooks.map((book) => (
            <div
              key={book.id}
              onClick={() => loadBookPreview(book)}
              style={{
                padding: 'var(--space-sm)',
                background: selectedBook?.id === book.id ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                border: selectedBook?.id === book.id ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{book.title}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {book.authors.map(a => a.name).join(', ')}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                {book.subjects.slice(0, 3).join(' • ')}
              </div>
            </div>
          ))}
        </div>

        {/* Preview Panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)' }}>
          {selectedBook ? (
            <>
              <div style={{ marginBottom: 'var(--space-md)' }}>
                <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>{selectedBook.title}</h3>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  by {selectedBook.authors.map(a => a.name).join(', ')}
                </div>
              </div>
              {loading ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                  Loading preview...
                </div>
              ) : bookText ? (
                <>
                  <div style={{ flex: 1, overflowY: 'auto', fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                    {bookText.slice(0, 3000)}...
                  </div>
                  <button
                    onClick={handleUseAsSource}
                    style={{
                      marginTop: 'var(--space-md)',
                      padding: 'var(--space-sm) var(--space-md)',
                      background: 'var(--color-success)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Use as Source
                  </button>
                </>
              ) : null}
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
              Select a book to preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
