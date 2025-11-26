/**
 * ExploreView - Main container for semantic exploration features
 *
 * Uses ExploreContext for persistent state across tab switches.
 * Provides three sub-views:
 * 1. Search - Semantic search across all messages
 * 2. Topics - Browse auto-discovered topic clusters
 * 3. Anchors - Create and navigate semantic anchors
 */

import { useState, useEffect } from 'react';
import { useExplore } from '../../contexts/ExploreContext';
import { SemanticSearchView } from './SemanticSearchView';
import { ClusterBrowserView } from './ClusterBrowserView';
import { AnchorManagerView } from './AnchorManagerView';

type ExploreSubView = 'search' | 'clusters' | 'anchors';

interface ExploreViewProps {
  onNavigateToConversation: (conversationId: string, messageIndex?: number) => void;
}

export function ExploreView({ onNavigateToConversation }: ExploreViewProps) {
  const [subView, setSubView] = useState<ExploreSubView>('search');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    embeddingStatus,
    refreshStatus,
    selectedForAnchor,
    toggleSelectForAnchor,
    clearAnchorSelection,
  } = useExplore();

  // Check embedding status on mount (only if not already loaded)
  useEffect(() => {
    if (!embeddingStatus) {
      checkStatus();
    } else {
      setLoading(false);
    }
  }, [embeddingStatus]);

  const checkStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check embedding status');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading && !embeddingStatus) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-xl, 2rem)',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            border: '3px solid var(--border-color)',
            borderTopColor: 'var(--accent-primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '16px',
          }}
        />
        <p
          className="ui-text"
          style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
          }}
        >
          Checking embedding index...
        </p>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Error state
  if (error && !embeddingStatus) {
    return (
      <div
        style={{
          height: '100%',
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
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        </div>
        <p
          className="ui-text"
          style={{
            fontSize: '14px',
            color: '#ef4444',
            marginBottom: '16px',
          }}
        >
          {error}
        </p>
        <button
          onClick={checkStatus}
          className="ui-text"
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 500,
            backgroundColor: 'var(--accent-primary)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // No embeddings yet
  if (embeddingStatus && embeddingStatus.stats.vectorStats.messageCount === 0) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-xl, 2rem)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.3 }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto' }}>
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
            <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
          </svg>
        </div>
        <h3
          className="ui-text"
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '8px',
          }}
        >
          Build Embedding Index
        </h3>
        <p
          className="ui-text"
          style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
            maxWidth: '320px',
            marginBottom: '24px',
          }}
        >
          To enable semantic search, clustering, and anchors, the archive needs to be indexed with embeddings.
        </p>
        <p
          className="ui-text"
          style={{
            fontSize: '12px',
            color: 'var(--text-tertiary)',
            maxWidth: '320px',
          }}
        >
          This process runs automatically when you import an archive with "Build Index" enabled, or can be triggered via the API.
        </p>
      </div>
    );
  }

  // Main view with sub-tabs
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Stats Banner */}
      {embeddingStatus && (
        <div
          style={{
            padding: 'var(--space-sm, 0.5rem) var(--space-md, 1rem)',
            backgroundColor: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: '16px' }}>
            <span
              className="ui-text"
              style={{
                fontSize: '11px',
                color: 'var(--text-tertiary)',
              }}
            >
              <strong style={{ color: 'var(--text-secondary)' }}>
                {embeddingStatus.stats.vectorStats.messageCount.toLocaleString()}
              </strong>{' '}
              vectors
            </span>
            <span
              className="ui-text"
              style={{
                fontSize: '11px',
                color: 'var(--text-tertiary)',
              }}
            >
              <strong style={{ color: 'var(--text-secondary)' }}>
                {embeddingStatus.stats.conversationCount.toLocaleString()}
              </strong>{' '}
              conversations
            </span>
          </div>
          {selectedForAnchor.length > 0 && (
            <span
              className="ui-text"
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                backgroundColor: 'var(--accent-primary)',
                color: 'white',
                borderRadius: '12px',
              }}
            >
              {selectedForAnchor.length} pinned
            </span>
          )}
        </div>
      )}

      {/* Sub-tab bar */}
      <div
        className="tab-bar"
        style={{
          display: 'flex',
          gap: '4px',
          padding: 'var(--space-sm, 0.5rem) var(--space-md, 1rem)',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-primary)',
        }}
      >
        <button
          onClick={() => setSubView('search')}
          className={`tab ${subView === 'search' ? 'tab-active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 500,
            backgroundColor: subView === 'search' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
            color: subView === 'search' ? 'white' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <span className="tab-text">Search</span>
        </button>

        <button
          onClick={() => setSubView('clusters')}
          className={`tab ${subView === 'clusters' ? 'tab-active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 500,
            backgroundColor: subView === 'clusters' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
            color: subView === 'clusters' ? 'white' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <circle cx="19" cy="6" r="2" />
            <circle cx="5" cy="6" r="2" />
            <circle cx="19" cy="18" r="2" />
            <circle cx="5" cy="18" r="2" />
          </svg>
          <span className="tab-text">Topics</span>
        </button>

        <button
          onClick={() => setSubView('anchors')}
          className={`tab ${subView === 'anchors' ? 'tab-active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 500,
            backgroundColor: subView === 'anchors' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
            color: subView === 'anchors' ? 'white' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.15s',
            position: 'relative',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span className="tab-text">Anchors</span>
          {selectedForAnchor.length > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '16px',
                height: '16px',
                backgroundColor: 'var(--accent-secondary, #06b6d4)',
                color: 'white',
                borderRadius: '50%',
                fontSize: '10px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {selectedForAnchor.length}
            </span>
          )}
        </button>
      </div>

      {/* Sub-view content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {subView === 'search' && (
          <SemanticSearchView
            onNavigate={onNavigateToConversation}
            onSelectForAnchor={toggleSelectForAnchor}
            selectedForAnchor={selectedForAnchor.map(s => s.embeddingId || s.id)}
          />
        )}
        {subView === 'clusters' && (
          <ClusterBrowserView onNavigate={onNavigateToConversation} />
        )}
        {subView === 'anchors' && (
          <AnchorManagerView
            onNavigate={onNavigateToConversation}
            selectedEmbeddings={selectedForAnchor}
            onClearSelection={clearAnchorSelection}
          />
        )}
      </div>
    </div>
  );
}
