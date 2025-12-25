/**
 * Explore View - Semantic search across the archive
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface SearchResult {
  id: string;
  content: string;
  score: number;
  conversationTitle?: string;
  messageRole?: string;
  source: 'chatgpt' | 'facebook' | 'book';
}

export function ExploreView() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await fetch('http://localhost:3002/api/embeddings/search/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          limit: 20,
        }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      setError('Semantic search requires embeddings. Build embeddings from the Import tab.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim()) {
      debounceRef.current = setTimeout(() => {
        search(query);
      }, 300);
    } else {
      setResults([]);
      setHasSearched(false);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, search]);

  const getScoreClass = (score: number): string => {
    if (score >= 0.7) return 'explore-result__score--high';
    if (score >= 0.4) return 'explore-result__score--medium';
    return 'explore-result__score--low';
  };

  const handleResultClick = (result: SearchResult) => {
    // TODO: Navigate to the result in the appropriate tab
    console.log('Selected result:', result);
  };

  return (
    <div className="explore-tab">
      {/* Search input */}
      <div className="explore-search">
        <span className="explore-search__icon">🔍</span>
        <input
          type="text"
          className="explore-search__input"
          placeholder="Search by meaning, not just keywords..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Loading state */}
      {loading && (
        <div className="archive-browser__loading">
          Searching...
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="tool-panel__empty">
          <p>{error}</p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="explore-results">
          {results.map(result => (
            <div
              key={result.id}
              className="explore-result"
              onClick={() => handleResultClick(result)}
            >
              <span className={`explore-result__score ${getScoreClass(result.score)}`}>
                {(result.score * 100).toFixed(0)}% match
              </span>
              {result.conversationTitle && (
                <div style={{ fontSize: '0.75rem', color: 'var(--studio-text-secondary)', marginBottom: '0.25rem' }}>
                  {result.conversationTitle}
                </div>
              )}
              <div className="explore-result__text">
                {result.content.substring(0, 200)}
                {result.content.length > 200 ? '...' : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state after search */}
      {hasSearched && !loading && !error && results.length === 0 && (
        <div className="tool-panel__empty">
          <p>No results found</p>
          <span className="tool-panel__muted">Try different keywords or phrases</span>
        </div>
      )}

      {/* Initial state */}
      {!hasSearched && !loading && (
        <div className="tool-panel__empty">
          <p>Semantic Search</p>
          <span className="tool-panel__muted">
            Find content by meaning across all your archives
          </span>
        </div>
      )}
    </div>
  );
}
