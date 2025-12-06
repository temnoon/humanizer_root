/**
 * FindSimilar Component
 *
 * Semantic search UI for finding passages similar to a given passage.
 * Uses the archive's embedding index for search.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { usePassages } from '../../contexts/PassageContext';
import { embeddingService, type SearchResult } from '../../services/embeddingService';
import type { Passage } from '../../types/passage';

// ============================================================
// STYLES
// ============================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: 'var(--color-bg-secondary, #ffffff)',
    borderRadius: 'var(--radius-lg, 12px)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--space-md, 16px)',
    borderBottom: '1px solid var(--color-border, #e2e8f0)',
    backgroundColor: 'var(--color-bg-tertiary, #f8fafc)',
  },
  title: {
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--color-text-primary, #1e293b)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-sm, 8px)',
  },
  closeButton: {
    padding: '4px 8px',
    border: 'none',
    background: 'transparent',
    fontSize: '1.2rem',
    cursor: 'pointer',
    color: 'var(--color-text-tertiary, #94a3b8)',
  },
  sourcePreview: {
    padding: 'var(--space-md, 16px)',
    backgroundColor: 'var(--color-bg-primary, #f1f5f9)',
    borderBottom: '1px solid var(--color-border, #e2e8f0)',
  },
  sourceLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-text-tertiary, #94a3b8)',
    marginBottom: 'var(--space-xs, 4px)',
  },
  sourceText: {
    fontSize: '0.875rem',
    color: 'var(--color-text-secondary, #475569)',
    lineHeight: 1.5,
    maxHeight: '80px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md, 16px)',
    padding: 'var(--space-sm, 8px) var(--space-md, 16px)',
    borderBottom: '1px solid var(--color-border, #e2e8f0)',
  },
  controlGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-xs, 4px)',
  },
  label: {
    fontSize: '0.8rem',
    color: 'var(--color-text-tertiary, #94a3b8)',
  },
  select: {
    padding: '6px 10px',
    border: '1px solid var(--color-border, #e2e8f0)',
    borderRadius: 'var(--radius-md, 8px)',
    fontSize: '0.8rem',
    backgroundColor: 'var(--color-bg-primary, #ffffff)',
    cursor: 'pointer',
  },
  searchButton: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: 'var(--radius-md, 8px)',
    backgroundColor: 'var(--color-primary, #0891b2)',
    color: 'white',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    marginLeft: 'auto',
  },
  searchButtonDisabled: {
    backgroundColor: 'var(--color-border, #e2e8f0)',
    color: 'var(--color-text-tertiary, #94a3b8)',
    cursor: 'not-allowed',
  },
  resultsList: {
    flex: 1,
    overflow: 'auto',
    padding: 'var(--space-md, 16px)',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--space-xl, 32px)',
    color: 'var(--color-text-tertiary, #94a3b8)',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--space-xl, 32px)',
    textAlign: 'center',
    color: 'var(--color-text-tertiary, #94a3b8)',
  },
  emptyIcon: {
    fontSize: '2.5rem',
    marginBottom: 'var(--space-md, 16px)',
    opacity: 0.5,
  },
  resultCard: {
    padding: 'var(--space-md, 16px)',
    backgroundColor: 'var(--color-bg-primary, #f8fafc)',
    borderRadius: 'var(--radius-md, 8px)',
    marginBottom: 'var(--space-sm, 8px)',
    border: '1px solid var(--color-border, #e2e8f0)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  resultCardHover: {
    borderColor: 'var(--color-primary, #0891b2)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  resultHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 'var(--space-sm, 8px)',
  },
  resultTitle: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--color-text-primary, #1e293b)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '70%',
  },
  similarityBadge: {
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm, 4px)',
  },
  similarityHigh: {
    backgroundColor: 'var(--color-success-light, #dcfce7)',
    color: 'var(--color-success, #16a34a)',
  },
  similarityMedium: {
    backgroundColor: 'var(--color-warning-light, #fef3c7)',
    color: 'var(--color-warning, #d97706)',
  },
  similarityLow: {
    backgroundColor: 'var(--color-bg-tertiary, #f1f5f9)',
    color: 'var(--color-text-tertiary, #94a3b8)',
  },
  resultContent: {
    fontSize: '0.8rem',
    color: 'var(--color-text-secondary, #475569)',
    lineHeight: 1.5,
    maxHeight: '60px',
    overflow: 'hidden',
  },
  resultMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md, 16px)',
    marginTop: 'var(--space-sm, 8px)',
    fontSize: '0.75rem',
    color: 'var(--color-text-tertiary, #94a3b8)',
  },
  addButton: {
    padding: '4px 10px',
    border: '1px solid var(--color-primary, #0891b2)',
    borderRadius: 'var(--radius-sm, 4px)',
    backgroundColor: 'transparent',
    color: 'var(--color-primary, #0891b2)',
    fontSize: '0.75rem',
    fontWeight: 500,
    cursor: 'pointer',
    marginLeft: 'auto',
  },
  error: {
    padding: 'var(--space-md, 16px)',
    backgroundColor: 'var(--color-error-light, #fef2f2)',
    color: 'var(--color-error, #dc2626)',
    borderRadius: 'var(--radius-md, 8px)',
    fontSize: '0.875rem',
    margin: 'var(--space-md, 16px)',
  },
};

// ============================================================
// TYPES
// ============================================================

export interface FindSimilarProps {
  /** The passage to find similar content for */
  passageId: string;

  /** Callback when panel should close */
  onClose?: () => void;

  /** Callback when user adds a result as a new passage */
  onAddPassage?: (content: string, title: string, source: SearchResult) => void;

  /** Maximum number of results to show */
  maxResults?: number;
}

// ============================================================
// COMPONENT
// ============================================================

export function FindSimilar({
  passageId,
  onClose,
  onAddPassage,
  maxResults = 20,
}: FindSimilarProps) {
  const { getPassage, addPassage, createFromMarkdown } = usePassages();

  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [resultLimit, setResultLimit] = useState(10);

  const passage = getPassage(passageId);

  // Auto-search when component mounts
  useEffect(() => {
    if (passage) {
      handleSearch();
    }
  }, [passageId]); // Only on mount and passage change

  const handleSearch = useCallback(async () => {
    if (!passage) return;

    setIsSearching(true);
    setError(null);

    try {
      // Use the passage content as a semantic search query
      // Truncate to avoid massive queries
      const queryText = passage.content.substring(0, 2000);

      const response = await embeddingService.searchMessages(queryText, resultLimit);
      setResults(response.results);
    } catch (err: any) {
      setError(err.message || 'Search failed');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [passage, resultLimit]);

  const getSimilarityStyle = useCallback((similarity: number) => {
    if (similarity >= 0.7) return styles.similarityHigh;
    if (similarity >= 0.4) return styles.similarityMedium;
    return styles.similarityLow;
  }, []);

  const handleAddResult = useCallback((result: SearchResult) => {
    if (onAddPassage) {
      onAddPassage(result.content, result.conversationTitle, result);
    } else {
      // Default behavior: create a new passage from the result
      const newPassage = createFromMarkdown(
        result.content,
        {
          type: 'archive',
          platform: 'openai',
          name: result.conversationTitle,
          conversationId: result.conversationId,
          extractedAt: new Date(),
        },
        {
          title: `From: ${result.conversationTitle}`,
        }
      );
      addPassage(newPassage);
    }
  }, [onAddPassage, createFromMarkdown, addPassage]);

  if (!passage) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>Not Found</div>
          <div>Passage not found</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.title}>
          <span>Find Similar</span>
        </div>
        {onClose && (
          <button style={styles.closeButton} onClick={onClose} title="Close">
            x
          </button>
        )}
      </div>

      {/* Source passage preview */}
      <div style={styles.sourcePreview}>
        <div style={styles.sourceLabel}>Finding content similar to:</div>
        <div style={styles.sourceText}>
          {passage.metadata.title || passage.content.substring(0, 200)}
        </div>
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        <div style={styles.controlGroup}>
          <span style={styles.label}>Results:</span>
          <select
            style={styles.select}
            value={resultLimit}
            onChange={(e) => setResultLimit(Number(e.target.value))}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
        <button
          style={{
            ...styles.searchButton,
            ...(isSearching ? styles.searchButtonDisabled : {}),
          }}
          onClick={handleSearch}
          disabled={isSearching}
        >
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={styles.error}>{error}</div>
      )}

      {/* Results */}
      <div style={styles.resultsList}>
        {isSearching ? (
          <div style={styles.loading}>
            Searching archive for similar content...
          </div>
        ) : results.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>&#128269;</div>
            <div>No similar content found</div>
            <div style={{ fontSize: '0.8rem', marginTop: '8px' }}>
              Make sure the archive embedding index is built
            </div>
          </div>
        ) : (
          results.map((result) => (
            <div
              key={result.id}
              style={{
                ...styles.resultCard,
                ...(hoveredId === result.id ? styles.resultCardHover : {}),
              }}
              onMouseEnter={() => setHoveredId(result.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div style={styles.resultHeader}>
                <div style={styles.resultTitle}>
                  {result.conversationTitle || 'Untitled'}
                </div>
                <div
                  style={{
                    ...styles.similarityBadge,
                    ...getSimilarityStyle(result.similarity),
                  }}
                >
                  {Math.round(result.similarity * 100)}%
                </div>
              </div>
              <div style={styles.resultContent}>
                {result.content.substring(0, 200)}
                {result.content.length > 200 && '...'}
              </div>
              <div style={styles.resultMeta}>
                <span>{result.messageRole}</span>
                <span>{result.content.split(/\s+/).length} words</span>
                <button
                  style={styles.addButton}
                  onClick={() => handleAddResult(result)}
                >
                  Add as Passage
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default FindSimilar;
