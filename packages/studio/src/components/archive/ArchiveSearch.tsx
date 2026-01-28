/**
 * ArchiveSearch - Unified Semantic Search
 *
 * Searches across transcripts and content nodes using VECTOR_SEARCH_UNIFIED_CONTENT.
 * Features:
 * - Unified search across transcripts + conversations
 * - Similar/dissimilar search actions on every result
 * - Transcript indicators on media results
 * - One-click transcription trigger
 *
 * @module @humanizer/studio/components/archive/ArchiveSearch
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ArchiveSearchProps {
  /** Archive ID to search within */
  archiveId?: string;
  /** Called when a content item is selected */
  onSelectContent?: (contentId: string, type: 'node' | 'transcript') => void;
  /** Called when similar search is requested */
  onSearchSimilar?: (embedding: number[], sourceId: string) => void;
  /** Called when dissimilar search is requested */
  onSearchDissimilar?: (embedding: number[], sourceId: string) => void;
  /** Called when transcription is requested for media */
  onRequestTranscription?: (mediaId: string, archiveId: string) => void;
  /** Optional class name */
  className?: string;
}

/** Unified search result from VECTOR_SEARCH_UNIFIED_CONTENT */
export interface UnifiedSearchResult {
  id: string;
  contentType: 'transcript' | 'content';
  text: string;
  sourceId: string; // mediaId for transcripts, nodeId for content
  sourceConversationId?: string;
  createdAt?: Date;
  transcriptType?: string; // For transcripts: audio, ocr, caption, description
  similarity: number;
  embedding?: number[]; // For similar/dissimilar searches
  // Media context (for transcripts)
  mediaType?: 'image' | 'audio' | 'video';
  hasTranscript?: boolean;
  transcriptCount?: number;
}

/** Filter modes for search */
type SearchFilter = 'all' | 'transcripts' | 'conversations' | 'media';

// ═══════════════════════════════════════════════════════════════════════════
// MOCK API (Replace with actual API calls)
// ═══════════════════════════════════════════════════════════════════════════

async function searchUnified(
  query: string,
  archiveId: string | undefined,
  filter: SearchFilter,
  limit: number
): Promise<UnifiedSearchResult[]> {
  // TODO: Replace with actual API call to VECTOR_SEARCH_UNIFIED_CONTENT
  // This would call: POST /api/search/unified
  // {
  //   query,
  //   archiveId,
  //   filter,
  //   limit
  // }
  return [];
}

async function searchBySimilarity(
  embedding: number[],
  archiveId: string | undefined,
  similar: boolean,
  limit: number
): Promise<UnifiedSearchResult[]> {
  // TODO: Replace with actual API call
  // For dissimilar, we'd use 1 - similarity or filter by low similarity
  return [];
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function ArchiveSearch({
  archiveId,
  onSelectContent,
  onSearchSimilar,
  onSearchDissimilar,
  onRequestTranscription,
  className = '',
}: ArchiveSearchProps): React.ReactElement {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchFilter>('all');
  const [results, setResults] = useState<UnifiedSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const searchResults = await searchUnified(searchQuery, archiveId, filter, 50);
        setResults(searchResults);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [archiveId, filter]
  );

  // Handle query change with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(query);
      }, 300);
    } else {
      setResults([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, performSearch]);

  // Handle filter change
  const handleFilterChange = useCallback(
    (newFilter: SearchFilter) => {
      setFilter(newFilter);
      if (query.trim()) {
        performSearch(query);
      }
    },
    [query, performSearch]
  );

  // Handle similar search
  const handleSearchSimilar = useCallback(
    (result: UnifiedSearchResult) => {
      if (result.embedding && onSearchSimilar) {
        onSearchSimilar(result.embedding, result.id);
      }
    },
    [onSearchSimilar]
  );

  // Handle dissimilar search
  const handleSearchDissimilar = useCallback(
    (result: UnifiedSearchResult) => {
      if (result.embedding && onSearchDissimilar) {
        onSearchDissimilar(result.embedding, result.id);
      }
    },
    [onSearchDissimilar]
  );

  // Handle transcription request
  const handleRequestTranscription = useCallback(
    (result: UnifiedSearchResult) => {
      if (onRequestTranscription && archiveId) {
        onRequestTranscription(result.sourceId, archiveId);
      }
    },
    [onRequestTranscription, archiveId]
  );

  // Get score class for color coding
  const getScoreClass = (similarity: number): string => {
    if (similarity >= 0.7) return 'search-result__score--high';
    if (similarity >= 0.4) return 'search-result__score--medium';
    return 'search-result__score--low';
  };

  // Grouped results by content type
  const groupedResults = useMemo(() => {
    const transcripts = results.filter((r) => r.contentType === 'transcript');
    const content = results.filter((r) => r.contentType === 'content');
    return { transcripts, content };
  }, [results]);

  return (
    <div className={`archive-search ${className}`}>
      {/* Search Input */}
      <div className="archive-search-input">
        <div className="archive-search-input__field">
          <span className="archive-search-input__icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="archive-search-input__input"
            placeholder="Search transcripts, conversations, media..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search archive"
          />
          {query && (
            <button
              className="archive-search-input__clear"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Filter Toggle */}
      <div className="search-results__header">
        <span className="search-results__count">
          {isLoading ? 'Searching...' : `${results.length} results`}
        </span>
        <div className="search-mode-toggle">
          {(['all', 'transcripts', 'conversations', 'media'] as SearchFilter[]).map((f) => (
            <button
              key={f}
              className={`search-mode-toggle__option ${filter === f ? 'search-mode-toggle__option--active' : ''}`}
              onClick={() => handleFilterChange(f)}
            >
              {f === 'all' && 'All'}
              {f === 'transcripts' && 'Transcripts'}
              {f === 'conversations' && 'Conversations'}
              {f === 'media' && 'Media'}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="panel__empty">
          <div className="panel__empty-icon">⚠️</div>
          <div className="panel__empty-title">Search Error</div>
          <div className="panel__empty-description">{error}</div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="panel__loading">
          <div className="panel__loading-spinner" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && query && results.length === 0 && (
        <div className="panel__empty">
          <div className="panel__empty-icon">🔍</div>
          <div className="panel__empty-title">No Results</div>
          <div className="panel__empty-description">
            Try different keywords or adjust filters
          </div>
        </div>
      )}

      {/* Initial State */}
      {!query && !isLoading && (
        <div className="panel__empty">
          <div className="panel__empty-icon">🔍</div>
          <div className="panel__empty-title">Unified Search</div>
          <div className="panel__empty-description">
            Search across transcripts, conversations, and media descriptions
          </div>
        </div>
      )}

      {/* Results List */}
      {!isLoading && results.length > 0 && (
        <div className="search-results__list" role="listbox" aria-label="Search results">
          {results.map((result) => (
            <div
              key={result.id}
              className={`search-result ${
                result.contentType === 'transcript'
                  ? 'search-result--transcript'
                  : 'search-result--content'
              }`}
              role="option"
              tabIndex={0}
              onClick={() =>
                onSelectContent?.(result.id, result.contentType === 'transcript' ? 'transcript' : 'node')
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onSelectContent?.(result.id, result.contentType === 'transcript' ? 'transcript' : 'node');
                }
              }}
            >
              {/* Header */}
              <div className="search-result__header">
                <div className="search-result__type">
                  <span className="search-result__type-icon">
                    {result.contentType === 'transcript' ? '🎙️' : '💬'}
                  </span>
                  <span>
                    {result.contentType === 'transcript'
                      ? `${result.transcriptType || 'transcript'}`
                      : 'conversation'}
                  </span>
                  {/* Transcript indicator for media */}
                  {result.mediaType && (
                    <span
                      className={`transcript-badge ${
                        result.hasTranscript
                          ? ''
                          : result.transcriptCount
                            ? 'transcript-badge--pending'
                            : 'transcript-badge--none'
                      }`}
                    >
                      {result.hasTranscript
                        ? `✓ ${result.transcriptCount || 1}`
                        : result.transcriptCount
                          ? '⏳'
                          : 'No transcript'}
                    </span>
                  )}
                </div>
                <span className={`search-result__score ${getScoreClass(result.similarity)}`}>
                  {Math.round(result.similarity * 100)}%
                </span>
              </div>

              {/* Content */}
              <div className="search-result__content">{result.text}</div>

              {/* Meta */}
              <div className="search-result__meta">
                {result.sourceConversationId && (
                  <span>From: {result.sourceConversationId.slice(0, 8)}...</span>
                )}
                {result.createdAt && (
                  <span>{new Date(result.createdAt).toLocaleDateString()}</span>
                )}
              </div>

              {/* Actions */}
              <div className="search-result__actions">
                <button
                  className="search-result__action search-result__action--similar"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSearchSimilar(result);
                  }}
                  title="Find similar content"
                >
                  ↗️ Similar
                </button>
                <button
                  className="search-result__action search-result__action--dissimilar"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSearchDissimilar(result);
                  }}
                  title="Find contrasting content"
                >
                  ↘️ Different
                </button>
                {/* Show transcribe button for media without transcript */}
                {result.mediaType && !result.hasTranscript && (
                  <button
                    className="search-result__action search-result__action--transcribe"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRequestTranscription(result);
                    }}
                    title="Generate transcript for this media"
                  >
                    🎙️ Transcribe
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ArchiveSearch;
