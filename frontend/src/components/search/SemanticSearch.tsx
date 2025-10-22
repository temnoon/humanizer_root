import { useState, useEffect, KeyboardEvent } from 'react';
import './SemanticSearch.css';
import { api, DocumentSearchResult } from '@/lib/api-client';
import type { SidebarView } from '@/types/sidebar';

export interface SearchResult {
  uuid: string;
  content_text: string;
  author_role: string;
  conversation_uuid: string;
  similarity: number;
  distance: number;
}

type UnifiedSearchResult = {
  type: 'conversation' | 'document';
  score: number;
  data: SearchResult | DocumentSearchResult;
};

interface SemanticSearchProps {
  onSelectResult?: (result: SearchResult) => void;
  onSelectConversation?: (conversationId: string) => void;
  onSelectDocument?: (documentId: string) => void;
  onViewChange?: (view: SidebarView) => void;
}

export default function SemanticSearch({
  onSelectResult,
  onSelectConversation,
  onSelectDocument,
  onViewChange
}: SemanticSearchProps) {
  const [query, setQuery] = useState(() => {
    return sessionStorage.getItem('search-query') || '';
  });
  const [unifiedResults, setUnifiedResults] = useState<UnifiedSearchResult[]>(() => {
    const saved = sessionStorage.getItem('search-unified-results');
    return saved ? JSON.parse(saved) : [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(() => {
    return sessionStorage.getItem('search-has-searched') === 'true';
  });

  // Persist search state to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('search-query', query);
  }, [query]);

  useEffect(() => {
    sessionStorage.setItem('search-unified-results', JSON.stringify(unifiedResults));
  }, [unifiedResults]);

  useEffect(() => {
    sessionStorage.setItem('search-has-searched', hasSearched.toString());
  }, [hasSearched]);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      // Search both conversations and documents in parallel
      const [conversationResponse, documentResponse] = await Promise.all([
        api.semanticSearch(query, 20, 0.0),
        api.searchDocuments({ query, semantic: true, limit: 20 })
      ]);

      // Combine results with type information
      const conversationUnified: UnifiedSearchResult[] = conversationResponse.results.map(r => ({
        type: 'conversation' as const,
        score: r.similarity,
        data: r
      }));

      const documentUnified: UnifiedSearchResult[] = documentResponse.results.map(r => ({
        type: 'document' as const,
        score: r.score,
        data: r
      }));

      // Sort by score (highest first)
      const combined = [...conversationUnified, ...documentUnified]
        .sort((a, b) => b.score - a.score);

      setUnifiedResults(combined);
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

  const handleConversationClick = (result: SearchResult) => {
    if (onSelectResult) {
      onSelectResult(result);
    }
    if (onSelectConversation) {
      onSelectConversation(result.conversation_uuid);
    }
    if (onViewChange) {
      onViewChange('conversations');
    }
  };

  const handleDocumentClick = (result: DocumentSearchResult) => {
    if (onSelectDocument) {
      onSelectDocument(result.document_id);
    }
    if (onViewChange) {
      onViewChange('documents');
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
        ) : hasSearched && unifiedResults.length === 0 ? (
          <div className="search-empty">
            <span className="empty-icon">🔍</span>
            <p>No results found</p>
            <small>Try a different query</small>
          </div>
        ) : unifiedResults.length > 0 ? (
          <>
            <div className="results-header">
              <span className="results-count">
                {unifiedResults.length} results
              </span>
              <span className="results-query">"{query}"</span>
            </div>

            <div className="results-list">
              {unifiedResults.map((result, idx) => (
                result.type === 'conversation' ? (
                  <div
                    key={(result.data as SearchResult).uuid}
                    className="result-item"
                    onClick={() => handleConversationClick(result.data as SearchResult)}
                  >
                    <div className="result-header">
                      <span className="result-role">{(result.data as SearchResult).author_role}</span>
                      <span
                        className="result-similarity"
                        style={{ color: getSimilarityColor(result.score) }}
                      >
                        {(result.score * 100).toFixed(0)}%{' '}
                        <small>{getSimilarityLabel(result.score)}</small>
                      </span>
                    </div>
                    <div className="result-content">
                      {(result.data as SearchResult).content_text.length > 200
                        ? (result.data as SearchResult).content_text.substring(0, 200) + '...'
                        : (result.data as SearchResult).content_text}
                    </div>
                    <div className="result-footer">
                      <small className="result-uuid">
                        {(result.data as SearchResult).conversation_uuid.substring(0, 8)}
                      </small>
                      <small className="result-distance">
                        Distance: {(result.data as SearchResult).distance.toFixed(3)}
                      </small>
                    </div>
                  </div>
                ) : (
                  <div
                    key={`${(result.data as DocumentSearchResult).document_id}-${idx}`}
                    className="result-item document-result"
                    onClick={() => handleDocumentClick(result.data as DocumentSearchResult)}
                  >
                    <div className="result-header">
                      <span className="result-role">📄 {(result.data as DocumentSearchResult).document_title}</span>
                      <span
                        className="result-similarity"
                        style={{ color: getSimilarityColor(result.score) }}
                      >
                        {(result.score * 100).toFixed(0)}%{' '}
                        <small>{getSimilarityLabel(result.score)}</small>
                      </span>
                    </div>
                    <div className="result-content">
                      {(result.data as DocumentSearchResult).highlight ||
                       ((result.data as DocumentSearchResult).chunk_text && (result.data as DocumentSearchResult).chunk_text!.length > 200
                        ? (result.data as DocumentSearchResult).chunk_text!.substring(0, 200) + '...'
                        : (result.data as DocumentSearchResult).chunk_text || 'No preview available')}
                    </div>
                    <div className="result-footer">
                      <small className="result-uuid">
                        {(result.data as DocumentSearchResult).document_filename}
                      </small>
                      {(result.data as DocumentSearchResult).page_number && (
                        <small className="result-page">
                          Page {(result.data as DocumentSearchResult).page_number}
                        </small>
                      )}
                      {(result.data as DocumentSearchResult).chunk_index !== undefined && (
                        <small className="result-chunk">
                          Chunk {(result.data as DocumentSearchResult).chunk_index! + 1}
                        </small>
                      )}
                    </div>
                  </div>
                )
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
