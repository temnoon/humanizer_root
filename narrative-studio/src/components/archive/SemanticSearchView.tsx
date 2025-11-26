/**
 * SemanticSearchView - Search by meaning across all messages
 *
 * Uses ExploreContext for persistent search state.
 */

import { useEffect, useCallback } from 'react';
import { useExplore } from '../../contexts/ExploreContext';
import { embeddingService } from '../../services/embeddingService';
import type { SearchResult } from '../../services/embeddingService';

interface SemanticSearchViewProps {
  onNavigate: (conversationId: string, messageIndex?: number) => void;
  onSelectForAnchor?: (result: SearchResult) => void;
  selectedForAnchor?: string[];
}

export function SemanticSearchView({
  onNavigate,
  onSelectForAnchor,
  selectedForAnchor = [],
}: SemanticSearchViewProps) {
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    searchLoading,
    executeSearch,
  } = useExplore();

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      return;
    }

    const timeout = setTimeout(() => {
      executeSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery, executeSearch]);

  const handleFindSimilar = useCallback(async (result: SearchResult) => {
    if (!result.embeddingId) return;

    try {
      const data = await embeddingService.findSimilar(result.embeddingId, 20, true);
      // For find similar, we update the query to indicate what we're showing
      setSearchQuery(`Similar to: "${result.content.substring(0, 50)}..."`);
    } catch (err) {
      console.error('Find similar failed:', err);
    }
  }, [setSearchQuery]);

  const getSimilarityColor = (similarity: number) => {
    if (similarity > 0.7) return { bg: 'rgba(34, 197, 94, 0.2)', text: 'var(--success, #22c55e)' };
    if (similarity > 0.4) return { bg: 'rgba(234, 179, 8, 0.2)', text: 'var(--warning, #eab308)' };
    return { bg: 'rgba(107, 114, 128, 0.2)', text: 'var(--text-secondary)' };
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Search Input */}
      <div style={{ padding: 'var(--space-md, 1rem)', paddingBottom: 0 }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by meaning..."
            className="ui-text"
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              paddingLeft: '2.75rem',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '14px',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-primary)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '1rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
              pointerEvents: 'none',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          {searchLoading && (
            <div
              style={{
                position: 'absolute',
                right: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
              }}
            >
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid var(--border-color)',
                  borderTopColor: 'var(--accent-primary)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Results List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-md, 1rem)',
        }}
      >
        {searchResults.length === 0 && !searchLoading && searchQuery.trim() && (
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--space-xl, 2rem)',
              color: 'var(--text-tertiary)',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.5 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto' }}>
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <p className="ui-text" style={{ fontSize: '14px' }}>
              No results found
            </p>
          </div>
        )}

        {searchResults.length === 0 && !searchLoading && !searchQuery.trim() && (
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--space-xl, 2rem)',
              color: 'var(--text-tertiary)',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.3 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto' }}>
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <p className="ui-text" style={{ fontSize: '14px', marginBottom: '4px' }}>
              Semantic Search
            </p>
            <p className="ui-text" style={{ fontSize: '12px', opacity: 0.7 }}>
              Search for meaning, not just keywords
            </p>
          </div>
        )}

        {searchResults.map((result, idx) => {
          const simColor = getSimilarityColor(result.similarity);
          const isSelectedForAnchor = selectedForAnchor.includes(result.embeddingId || result.id);

          return (
            <div
              key={`${result.id}-${idx}`}
              style={{
                backgroundColor: isSelectedForAnchor
                  ? 'var(--accent-primary)'
                  : 'var(--bg-elevated, var(--bg-tertiary))',
                color: isSelectedForAnchor ? 'var(--text-inverse, white)' : 'var(--text-primary)',
                padding: 'var(--space-sm, 0.5rem) var(--space-md, 1rem)',
                borderRadius: '8px',
                marginBottom: 'var(--space-sm, 0.5rem)',
                cursor: 'pointer',
                border: '2px solid transparent',
                transition: 'all 0.15s ease',
              }}
              onClick={() => onNavigate(result.conversationId)}
              onMouseEnter={(e) => {
                if (!isSelectedForAnchor) {
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'transparent';
              }}
            >
              {/* Header Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '6px',
                }}
              >
                <span
                  className="ui-text"
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: isSelectedForAnchor
                      ? 'rgba(255,255,255,0.7)'
                      : 'var(--text-tertiary)',
                  }}
                >
                  {result.messageRole}
                </span>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: isSelectedForAnchor ? 'rgba(255,255,255,0.2)' : simColor.bg,
                    color: isSelectedForAnchor ? 'white' : simColor.text,
                  }}
                >
                  {(result.similarity * 100).toFixed(0)}%
                </span>
              </div>

              {/* Content Preview */}
              <p
                className="ui-text"
                style={{
                  fontSize: '13px',
                  lineHeight: 1.5,
                  margin: 0,
                  marginBottom: '8px',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  opacity: isSelectedForAnchor ? 1 : 0.9,
                }}
              >
                {result.content}
              </p>

              {/* Footer Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <span
                  className="ui-text"
                  style={{
                    fontSize: '11px',
                    color: isSelectedForAnchor
                      ? 'rgba(255,255,255,0.7)'
                      : 'var(--text-tertiary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    flex: 1,
                  }}
                >
                  {result.conversationTitle}
                </span>

                <div style={{ display: 'flex', gap: '4px' }}>
                  {/* Find Similar Button */}
                  {result.embeddingId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFindSimilar(result);
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: '10px',
                        fontWeight: 500,
                        backgroundColor: isSelectedForAnchor
                          ? 'rgba(255,255,255,0.2)'
                          : 'var(--bg-secondary)',
                        color: isSelectedForAnchor ? 'white' : 'var(--text-secondary)',
                        border: '1px solid ' + (isSelectedForAnchor ? 'rgba(255,255,255,0.3)' : 'var(--border-color)'),
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = isSelectedForAnchor
                          ? 'rgba(255,255,255,0.3)'
                          : 'var(--accent-primary)';
                        e.currentTarget.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = isSelectedForAnchor
                          ? 'rgba(255,255,255,0.2)'
                          : 'var(--bg-secondary)';
                        e.currentTarget.style.color = isSelectedForAnchor ? 'white' : 'var(--text-secondary)';
                      }}
                    >
                      Similar
                    </button>
                  )}

                  {/* Select for Anchor Button */}
                  {onSelectForAnchor && result.embeddingId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectForAnchor(result);
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: '10px',
                        fontWeight: 500,
                        backgroundColor: isSelectedForAnchor
                          ? 'rgba(255,255,255,0.2)'
                          : 'var(--bg-secondary)',
                        color: isSelectedForAnchor ? 'white' : 'var(--text-secondary)',
                        border: '1px solid ' + (isSelectedForAnchor ? 'rgba(255,255,255,0.3)' : 'var(--border-color)'),
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = isSelectedForAnchor
                          ? 'rgba(255,255,255,0.3)'
                          : 'var(--accent-secondary, #06b6d4)';
                        e.currentTarget.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = isSelectedForAnchor
                          ? 'rgba(255,255,255,0.2)'
                          : 'var(--bg-secondary)';
                        e.currentTarget.style.color = isSelectedForAnchor ? 'white' : 'var(--text-secondary)';
                      }}
                    >
                      {isSelectedForAnchor ? 'Pinned' : 'Pin'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Results Count */}
      {searchResults.length > 0 && (
        <div
          style={{
            padding: 'var(--space-sm, 0.5rem) var(--space-md, 1rem)',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <p
            className="ui-text"
            style={{
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              margin: 0,
            }}
          >
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
