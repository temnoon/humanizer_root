/**
 * SearchTool - Agentic Search Interface
 *
 * Provides intelligent search capabilities:
 * - Natural language query input
 * - Semantic search across content and transcripts
 * - Search history and suggestions
 * - Results with similarity scoring
 *
 * @module @humanizer/studio/components/tools/SearchTool
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { SearchResult } from './ToolsPane';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface SearchToolProps {
  /** Archive ID to search within */
  archiveId?: string;
  /** Called when search produces results */
  onSearchResults?: (results: SearchResult[]) => void;
  /** Optional class name */
  className?: string;
}

interface SearchHistoryItem {
  query: string;
  timestamp: Date;
  resultCount: number;
}

type SearchMode = 'semantic' | 'keyword' | 'hybrid';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const DEBOUNCE_MS = 300;
const MAX_HISTORY = 10;
const STORAGE_KEY = 'humanizer-search-history';

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function SearchTool({
  archiveId,
  onSearchResults,
  className = '',
}: SearchToolProps): React.ReactElement {
  // State
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('semantic');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Load history from storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setHistory(parsed.map((h: { query: string; timestamp: string; resultCount: number }) => ({
          ...h,
          timestamp: new Date(h.timestamp),
        })));
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Save history to storage
  const saveHistory = useCallback((items: SearchHistoryItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Execute search
  const executeSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || !archiveId) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      // TODO: Wire to VECTOR_SEARCH_UNIFIED_CONTENT endpoint
      // For now, simulate search with placeholder
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Placeholder results - will be replaced with real API call
      const mockResults: SearchResult[] = [];

      setResults(mockResults);
      onSearchResults?.(mockResults);

      // Add to history
      const newHistory: SearchHistoryItem[] = [
        { query: searchQuery, timestamp: new Date(), resultCount: mockResults.length },
        ...history.filter((h) => h.query !== searchQuery),
      ].slice(0, MAX_HISTORY);

      setHistory(newHistory);
      saveHistory(newHistory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [archiveId, history, onSearchResults, saveHistory]);

  // Debounced search
  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      setShowHistory(false);

      // Clear existing debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Set new debounce
      if (value.trim()) {
        debounceRef.current = setTimeout(() => {
          executeSearch(value);
        }, DEBOUNCE_MS);
      } else {
        setResults([]);
      }
    },
    [executeSearch]
  );

  // Handle form submit
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      executeSearch(query);
    },
    [executeSearch, query]
  );

  // Handle history item click
  const handleHistoryClick = useCallback(
    (item: SearchHistoryItem) => {
      setQuery(item.query);
      setShowHistory(false);
      executeSearch(item.query);
    },
    [executeSearch]
  );

  // Clear search
  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setError(null);
    inputRef.current?.focus();
  }, []);

  // Get score color class
  const getScoreClass = (score: number): string => {
    if (score >= 0.7) return 'search-result__score--high';
    if (score >= 0.4) return 'search-result__score--medium';
    return 'search-result__score--low';
  };

  return (
    <div className={`search-tool ${className}`}>
      {/* Search Input */}
      <form className="search-tool__form" onSubmit={handleSubmit}>
        <div className="search-tool__input-wrapper">
          <span className="search-tool__icon" aria-hidden="true">
            🔍
          </span>
          <input
            ref={inputRef}
            type="text"
            className="search-tool__input"
            placeholder="Search content and transcripts..."
            value={query}
            onChange={handleQueryChange}
            onFocus={() => setShowHistory(true)}
            onBlur={() => setTimeout(() => setShowHistory(false), 200)}
            aria-label="Search query"
            aria-describedby="search-help"
          />
          {query && (
            <button
              type="button"
              className="search-tool__clear"
              onClick={handleClear}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
        <span id="search-help" className="visually-hidden">
          Enter a natural language query to search your archive
        </span>
      </form>

      {/* Search Mode Toggle */}
      <div className="search-tool__modes">
        <button
          className={`search-tool__mode ${mode === 'semantic' ? 'search-tool__mode--active' : ''}`}
          onClick={() => setMode('semantic')}
          aria-pressed={mode === 'semantic'}
        >
          Semantic
        </button>
        <button
          className={`search-tool__mode ${mode === 'keyword' ? 'search-tool__mode--active' : ''}`}
          onClick={() => setMode('keyword')}
          aria-pressed={mode === 'keyword'}
        >
          Keyword
        </button>
        <button
          className={`search-tool__mode ${mode === 'hybrid' ? 'search-tool__mode--active' : ''}`}
          onClick={() => setMode('hybrid')}
          aria-pressed={mode === 'hybrid'}
        >
          Hybrid
        </button>
      </div>

      {/* Search History */}
      {showHistory && history.length > 0 && !query && (
        <div className="search-tool__history" role="listbox" aria-label="Search history">
          <div className="search-tool__history-header">Recent Searches</div>
          {history.map((item, index) => (
            <button
              key={`${item.query}-${index}`}
              className="search-tool__history-item"
              role="option"
              onClick={() => handleHistoryClick(item)}
            >
              <span className="search-tool__history-query">{item.query}</span>
              <span className="search-tool__history-meta">
                {item.resultCount} results
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Loading State */}
      {isSearching && (
        <div className="search-tool__loading" aria-live="polite">
          <span className="search-tool__spinner" aria-hidden="true" />
          Searching...
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="search-tool__error" role="alert">
          <span aria-hidden="true">⚠️</span>
          {error}
        </div>
      )}

      {/* Results */}
      {!isSearching && results.length > 0 && (
        <div className="search-tool__results" role="listbox" aria-label="Search results">
          <div className="search-tool__results-header">
            <span>{results.length} results</span>
          </div>
          {results.map((result) => (
            <div
              key={result.id}
              className={`search-result search-result--${result.type}`}
              role="option"
              tabIndex={0}
            >
              <div className="search-result__header">
                <span className="search-result__type">
                  <span className="search-result__type-icon" aria-hidden="true">
                    {result.type === 'transcript' ? '🎙️' : result.type === 'cluster' ? '🎯' : '📝'}
                  </span>
                  {result.type}
                </span>
                <span className={`search-result__score ${getScoreClass(result.score)}`}>
                  {Math.round(result.score * 100)}%
                </span>
              </div>
              <div className="search-result__content">
                {result.content.length > 200
                  ? `${result.content.substring(0, 200)}...`
                  : result.content}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isSearching && !error && query && results.length === 0 && (
        <div className="search-tool__empty">
          <span aria-hidden="true">🔍</span>
          <p>No results found for "{query}"</p>
          <p className="search-tool__empty-hint">
            Try different keywords or switch to semantic search
          </p>
        </div>
      )}

      {/* Initial State */}
      {!query && !showHistory && (
        <div className="search-tool__placeholder">
          <span aria-hidden="true">🔍</span>
          <p>Search your archive</p>
          <p className="search-tool__placeholder-hint">
            Use natural language to find content across messages and transcripts
          </p>
        </div>
      )}
    </div>
  );
}

export default SearchTool;
