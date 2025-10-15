import { useState, KeyboardEvent } from 'react';
import './SemanticSearch.css';
import { api } from '@/lib/api-client';

export interface SearchResult {
  uuid: string;
  content_text: string;
  author_role: string;
  conversation_uuid: string;
  similarity: number;
  distance: number;
}

interface SemanticSearchProps {
  onSelectResult?: (result: SearchResult) => void;
  onSelectConversation?: (conversationId: string) => void;
}

export default function SemanticSearch({
  onSelectResult,
  onSelectConversation
}: SemanticSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await api.semanticSearch(query, 20, 0.0);
      setResults(response.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleResultClick = (result: SearchResult) => {
    if (onSelectResult) {
      onSelectResult(result);
    }
    if (onSelectConversation) {
      onSelectConversation(result.conversation_uuid);
    }
  };

  const getSimilarityColor = (similarity: number): string => {
    if (similarity >= 0.8) return 'var(--color-success)';
    if (similarity >= 0.6) return 'var(--color-primary)';
    if (similarity >= 0.4) return 'var(--color-warning)';
    return 'var(--color-text-tertiary)';
  };

  const getSimilarityLabel = (similarity: number): string => {
    if (similarity >= 0.8) return 'Excellent';
    if (similarity >= 0.6) return 'Good';
    if (similarity >= 0.4) return 'Fair';
    return 'Weak';
  };

  return (
    <div className="semantic-search">
      <div className="search-header">
        <h3>Semantic Search</h3>
        <p className="search-hint">Search by meaning, not keywords</p>
      </div>

      <div className="search-input-container">
        <input
          type="text"
          className="search-input"
          placeholder="e.g., 'consciousness and emergence'"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
        />
        <button
          className="search-button"
          onClick={handleSearch}
          disabled={!query.trim() || isLoading}
        >
          {isLoading ? '⏳' : '🔍'}
        </button>
      </div>

      {error && (
        <div className="search-error">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <div className="search-results">
        {isLoading ? (
          <div className="search-loading">
            <div className="loading-spinner"></div>
            <p>Searching embedding space...</p>
          </div>
        ) : hasSearched && results.length === 0 ? (
          <div className="search-empty">
            <span className="empty-icon">🔍</span>
            <p>No results found</p>
            <small>Try a different query</small>
          </div>
        ) : results.length > 0 ? (
          <>
            <div className="results-header">
              <span className="results-count">{results.length} results</span>
              <span className="results-query">"{query}"</span>
            </div>
            <div className="results-list">
              {results.map((result) => (
                <div
                  key={result.uuid}
                  className="result-item"
                  onClick={() => handleResultClick(result)}
                >
                  <div className="result-header">
                    <span className="result-role">{result.author_role}</span>
                    <span
                      className="result-similarity"
                      style={{ color: getSimilarityColor(result.similarity) }}
                    >
                      {(result.similarity * 100).toFixed(0)}%{' '}
                      <small>{getSimilarityLabel(result.similarity)}</small>
                    </span>
                  </div>
                  <div className="result-content">
                    {result.content_text.length > 200
                      ? result.content_text.substring(0, 200) + '...'
                      : result.content_text}
                  </div>
                  <div className="result-footer">
                    <small className="result-uuid">
                      {result.conversation_uuid.substring(0, 8)}
                    </small>
                    <small className="result-distance">
                      Distance: {result.distance.toFixed(3)}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
