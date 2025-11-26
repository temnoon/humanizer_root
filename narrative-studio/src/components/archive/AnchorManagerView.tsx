/**
 * AnchorManagerView - Create and navigate semantic anchors
 *
 * Anchors are semantic "bookmarks" computed from message embeddings.
 * Anti-anchors define what to avoid. "Find Between" locates content
 * along the semantic axis between two anchors.
 */

import { useState, useEffect, useCallback } from 'react';
import { embeddingService } from '../../services/embeddingService';
import type { Anchor, SearchResult, BetweenResult } from '../../services/embeddingService';

interface AnchorManagerViewProps {
  onNavigate: (conversationId: string, messageIndex?: number) => void;
  selectedEmbeddings?: SearchResult[];
  onClearSelection?: () => void;
}

export function AnchorManagerView({
  onNavigate,
  selectedEmbeddings = [],
  onClearSelection,
}: AnchorManagerViewProps) {
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create anchor form
  const [anchorName, setAnchorName] = useState('');
  const [anchorType, setAnchorType] = useState<'anchor' | 'anti-anchor'>('anchor');
  const [creating, setCreating] = useState(false);

  // Find between
  const [selectedAnchorA, setSelectedAnchorA] = useState<string | null>(null);
  const [selectedAnchorB, setSelectedAnchorB] = useState<string | null>(null);
  const [betweenPosition, setBetweenPosition] = useState(0.5);
  const [betweenResults, setBetweenResults] = useState<BetweenResult[]>([]);
  const [findingBetween, setFindingBetween] = useState(false);

  // Load anchors on mount
  useEffect(() => {
    loadAnchors();
  }, []);

  const loadAnchors = async () => {
    setLoading(true);
    try {
      const data = await embeddingService.getAnchors();
      setAnchors(data.anchors || []);
    } catch (err) {
      // If endpoint doesn't exist yet, just set empty
      setAnchors([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnchor = useCallback(async () => {
    if (!anchorName.trim() || selectedEmbeddings.length === 0) return;

    setCreating(true);
    setError(null);
    try {
      const sourceIds = selectedEmbeddings
        .map(e => e.embeddingId || e.id)
        .filter(Boolean) as string[];

      if (anchorType === 'anchor') {
        await embeddingService.createAnchor(anchorName.trim(), sourceIds);
      } else {
        await embeddingService.createAntiAnchor(anchorName.trim(), sourceIds);
      }

      setAnchorName('');
      onClearSelection?.();
      await loadAnchors();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create anchor');
    } finally {
      setCreating(false);
    }
  }, [anchorName, anchorType, selectedEmbeddings, onClearSelection]);

  const handleDeleteAnchor = useCallback(async (id: string) => {
    try {
      await embeddingService.deleteAnchor(id);
      setAnchors(prev => prev.filter(a => a.id !== id));
      if (selectedAnchorA === id) setSelectedAnchorA(null);
      if (selectedAnchorB === id) setSelectedAnchorB(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete anchor');
    }
  }, [selectedAnchorA, selectedAnchorB]);

  const handleFindBetween = useCallback(async () => {
    if (!selectedAnchorA || !selectedAnchorB) return;

    setFindingBetween(true);
    setError(null);
    try {
      const data = await embeddingService.findBetween(
        selectedAnchorA,
        selectedAnchorB,
        betweenPosition,
        20
      );
      setBetweenResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Find between failed');
      setBetweenResults([]);
    } finally {
      setFindingBetween(false);
    }
  }, [selectedAnchorA, selectedAnchorB, betweenPosition]);

  const getSimilarityColor = (similarity: number) => {
    if (similarity > 0.7) return { bg: 'rgba(34, 197, 94, 0.2)', text: 'var(--success, #22c55e)' };
    if (similarity > 0.4) return { bg: 'rgba(234, 179, 8, 0.2)', text: 'var(--warning, #eab308)' };
    return { bg: 'rgba(107, 114, 128, 0.2)', text: 'var(--text-secondary)' };
  };

  const anchorsList = anchors.filter(a => a.type === 'anchor');
  const antiAnchorsList = anchors.filter(a => a.type === 'anti-anchor');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      {/* Create Anchor Section */}
      <div
        style={{
          padding: 'var(--space-md, 1rem)',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <h3
          className="ui-text"
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
            marginBottom: 'var(--space-sm, 0.5rem)',
          }}
        >
          Create Anchor
        </h3>

        {selectedEmbeddings.length === 0 ? (
          <p
            className="ui-text"
            style={{
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              margin: 0,
              padding: 'var(--space-sm, 0.5rem)',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '6px',
              textAlign: 'center',
            }}
          >
            Select messages from Search tab using the "Pin" button
          </p>
        ) : (
          <div>
            <div
              style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '8px',
              }}
            >
              <input
                type="text"
                value={anchorName}
                onChange={(e) => setAnchorName(e.target.value)}
                placeholder="Anchor name..."
                className="ui-text"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '13px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
              />
              <select
                value={anchorType}
                onChange={(e) => setAnchorType(e.target.value as 'anchor' | 'anti-anchor')}
                className="ui-text"
                style={{
                  padding: '8px 12px',
                  fontSize: '13px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                <option value="anchor">Anchor</option>
                <option value="anti-anchor">Anti-Anchor</option>
              </select>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                className="ui-text"
                style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                }}
              >
                {selectedEmbeddings.length} message{selectedEmbeddings.length !== 1 ? 's' : ''} selected
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={onClearSelection}
                  className="ui-text"
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  Clear
                </button>
                <button
                  onClick={handleCreateAnchor}
                  disabled={creating || !anchorName.trim()}
                  className="ui-text"
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    backgroundColor: creating || !anchorName.trim()
                      ? 'var(--text-tertiary)'
                      : 'var(--accent-primary)',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    cursor: creating || !anchorName.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            margin: 'var(--space-md, 1rem)',
            padding: 'var(--space-sm, 0.5rem) var(--space-md, 1rem)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            color: '#ef4444',
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      )}

      {/* Anchors List */}
      <div
        style={{
          padding: 'var(--space-md, 1rem)',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <h4
          className="ui-text"
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            margin: 0,
            marginBottom: 'var(--space-sm, 0.5rem)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Anchors ({anchorsList.length})
        </h4>

        {anchorsList.length === 0 ? (
          <p
            className="ui-text"
            style={{
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              margin: 0,
            }}
          >
            No anchors yet
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {anchorsList.map((anchor) => (
              <div
                key={anchor.id}
                onClick={() => {
                  if (selectedAnchorA === anchor.id) {
                    setSelectedAnchorA(null);
                  } else if (!selectedAnchorA) {
                    setSelectedAnchorA(anchor.id);
                  } else if (selectedAnchorB === anchor.id) {
                    setSelectedAnchorB(null);
                  } else {
                    setSelectedAnchorB(anchor.id);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  backgroundColor: selectedAnchorA === anchor.id || selectedAnchorB === anchor.id
                    ? 'var(--accent-primary)'
                    : 'var(--bg-elevated, var(--bg-tertiary))',
                  color: selectedAnchorA === anchor.id || selectedAnchorB === anchor.id
                    ? 'white'
                    : 'var(--text-primary)',
                  borderRadius: '16px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: '10px' }}>
                  {selectedAnchorA === anchor.id ? 'A' : selectedAnchorB === anchor.id ? 'B' : ''}
                </span>
                <span>{anchor.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteAnchor(anchor.id);
                  }}
                  style={{
                    width: '14px',
                    height: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    opacity: 0.6,
                    color: 'inherit',
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Anti-Anchors List */}
      <div
        style={{
          padding: 'var(--space-md, 1rem)',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <h4
          className="ui-text"
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            margin: 0,
            marginBottom: 'var(--space-sm, 0.5rem)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Anti-Anchors ({antiAnchorsList.length})
        </h4>

        {antiAnchorsList.length === 0 ? (
          <p
            className="ui-text"
            style={{
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              margin: 0,
            }}
          >
            No anti-anchors yet
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {antiAnchorsList.map((anchor) => (
              <div
                key={anchor.id}
                onClick={() => {
                  if (selectedAnchorA === anchor.id) {
                    setSelectedAnchorA(null);
                  } else if (!selectedAnchorA) {
                    setSelectedAnchorA(anchor.id);
                  } else if (selectedAnchorB === anchor.id) {
                    setSelectedAnchorB(null);
                  } else {
                    setSelectedAnchorB(anchor.id);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  backgroundColor: selectedAnchorA === anchor.id || selectedAnchorB === anchor.id
                    ? 'var(--accent-secondary, #06b6d4)'
                    : 'var(--bg-elevated, var(--bg-tertiary))',
                  color: selectedAnchorA === anchor.id || selectedAnchorB === anchor.id
                    ? 'white'
                    : 'var(--text-primary)',
                  borderRadius: '16px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  border: '1px dashed var(--border-color)',
                }}
              >
                <span style={{ fontSize: '10px' }}>
                  {selectedAnchorA === anchor.id ? 'A' : selectedAnchorB === anchor.id ? 'B' : ''}
                </span>
                <span>{anchor.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteAnchor(anchor.id);
                  }}
                  style={{
                    width: '14px',
                    height: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    opacity: 0.6,
                    color: 'inherit',
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Find Between Section */}
      <div
        style={{
          padding: 'var(--space-md, 1rem)',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <h4
          className="ui-text"
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            margin: 0,
            marginBottom: 'var(--space-sm, 0.5rem)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Find Between Anchors
        </h4>

        {selectedAnchorA && selectedAnchorB ? (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
              }}
            >
              <span
                className="ui-text"
                style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                }}
              >
                A
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={betweenPosition}
                onChange={(e) => setBetweenPosition(parseFloat(e.target.value))}
                style={{
                  flex: 1,
                  accentColor: 'var(--accent-primary)',
                }}
              />
              <span
                className="ui-text"
                style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                }}
              >
                B
              </span>
              <span
                className="ui-text"
                style={{
                  fontSize: '11px',
                  color: 'var(--text-tertiary)',
                  minWidth: '36px',
                }}
              >
                {(betweenPosition * 100).toFixed(0)}%
              </span>
            </div>
            <button
              onClick={handleFindBetween}
              disabled={findingBetween}
              className="ui-text"
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '13px',
                fontWeight: 500,
                backgroundColor: findingBetween ? 'var(--text-tertiary)' : 'var(--accent-primary)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: findingBetween ? 'not-allowed' : 'pointer',
              }}
            >
              {findingBetween ? 'Finding...' : 'Find Content'}
            </button>
          </div>
        ) : (
          <p
            className="ui-text"
            style={{
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              margin: 0,
            }}
          >
            Click two anchors above to select them (A and B)
          </p>
        )}
      </div>

      {/* Between Results */}
      {betweenResults.length > 0 && (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--space-md, 1rem)',
          }}
        >
          <h4
            className="ui-text"
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              margin: 0,
              marginBottom: 'var(--space-sm, 0.5rem)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Results ({betweenResults.length})
          </h4>

          {betweenResults.map((result, idx) => {
            const simColor = getSimilarityColor(result.similarity);

            return (
              <div
                key={`${result.id}-${idx}`}
                onClick={() => {
                  // Would need conversationId to navigate
                  // For now just display
                }}
                style={{
                  backgroundColor: 'var(--bg-elevated, var(--bg-tertiary))',
                  padding: 'var(--space-sm, 0.5rem) var(--space-md, 1rem)',
                  borderRadius: '6px',
                  marginBottom: 'var(--space-sm, 0.5rem)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '4px',
                  }}
                >
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: simColor.bg,
                      color: simColor.text,
                    }}
                  >
                    {(result.similarity * 100).toFixed(0)}%
                  </span>
                </div>
                <p
                  className="ui-text"
                  style={{
                    fontSize: '12px',
                    lineHeight: 1.4,
                    color: 'var(--text-primary)',
                    margin: 0,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {result.content}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state for results */}
      {betweenResults.length === 0 && anchors.length === 0 && !loading && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-xl, 2rem)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto' }}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <p
            className="ui-text"
            style={{
              fontSize: '14px',
              color: 'var(--text-secondary)',
              marginBottom: '8px',
            }}
          >
            Semantic Anchors
          </p>
          <p
            className="ui-text"
            style={{
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              maxWidth: '280px',
            }}
          >
            Create semantic bookmarks from search results. Use "Find Between" to discover content along thematic axes.
          </p>
        </div>
      )}
    </div>
  );
}
