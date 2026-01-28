/**
 * ClusterBrowser - Semantic Cluster Navigation
 *
 * Browse discovered topic clusters from archive analysis.
 * Features:
 * - Cluster cards with keywords and descriptions
 * - Similar/dissimilar search from cluster embeddings
 * - Expand to show representative passages
 *
 * @module @humanizer/studio/components/archive/ClusterBrowser
 */

import React, { useState, useCallback, useEffect } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ClusterBrowserProps {
  /** Archive ID to show clusters for */
  archiveId?: string;
  /** Called when a cluster is selected */
  onSelectCluster?: (clusterId: string) => void;
  /** Called when similar search is requested */
  onSearchSimilar?: (embedding: number[], sourceId: string) => void;
  /** Optional class name */
  className?: string;
}

/** Cluster data from clustering service */
export interface ClusterInfo {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  passageCount: number;
  coherence: number; // 0-1
  dateRange?: {
    earliest: Date;
    latest: Date;
  };
  sourceDistribution?: Record<string, number>;
  embedding?: number[]; // Cluster centroid for similar search
  representativePassages?: Array<{
    id: string;
    text: string;
    similarity: number;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCK API (Replace with actual API calls)
// ═══════════════════════════════════════════════════════════════════════════

async function fetchClusters(archiveId: string | undefined): Promise<ClusterInfo[]> {
  // TODO: Replace with actual API call
  // GET /api/archive/{archiveId}/clusters
  return [];
}

async function discoverClusters(
  archiveId: string,
  options?: { minClusterSize?: number; maxClusters?: number }
): Promise<ClusterInfo[]> {
  // TODO: Replace with actual API call
  // POST /api/clustering/discover
  return [];
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function ClusterBrowser({
  archiveId,
  onSelectCluster,
  onSearchSimilar,
  className = '',
}: ClusterBrowserProps): React.ReactElement {
  const [clusters, setClusters] = useState<ClusterInfo[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing clusters
  useEffect(() => {
    if (archiveId) {
      setIsLoading(true);
      setError(null);
      fetchClusters(archiveId)
        .then(setClusters)
        .catch((err) => setError(err.message))
        .finally(() => setIsLoading(false));
    }
  }, [archiveId]);

  // Run cluster discovery
  const handleDiscover = useCallback(async () => {
    if (!archiveId) return;

    setIsDiscovering(true);
    setError(null);

    try {
      const discovered = await discoverClusters(archiveId, {
        minClusterSize: 5,
        maxClusters: 20,
      });
      setClusters(discovered);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery failed');
    } finally {
      setIsDiscovering(false);
    }
  }, [archiveId]);

  // Toggle cluster expansion
  const toggleExpand = useCallback((clusterId: string) => {
    setExpandedId((prev) => (prev === clusterId ? null : clusterId));
  }, []);

  // Handle cluster selection
  const handleSelect = useCallback(
    (cluster: ClusterInfo) => {
      onSelectCluster?.(cluster.id);
    },
    [onSelectCluster]
  );

  // Handle similar search from cluster centroid
  const handleSearchSimilar = useCallback(
    (cluster: ClusterInfo, e: React.MouseEvent) => {
      e.stopPropagation();
      if (cluster.embedding && onSearchSimilar) {
        onSearchSimilar(cluster.embedding, cluster.id);
      }
    },
    [onSearchSimilar]
  );

  // Get coherence color
  const getCoherenceColor = (coherence: number): string => {
    if (coherence >= 0.7) return 'var(--color-success)';
    if (coherence >= 0.4) return 'var(--color-warning)';
    return 'var(--studio-text-tertiary)';
  };

  return (
    <div className={`cluster-browser ${className}`}>
      {/* Header with discover button */}
      <div className="search-results__header">
        <span className="search-results__count">
          {clusters.length} cluster{clusters.length !== 1 ? 's' : ''}
        </span>
        <button
          className="search-results__filter search-results__filter--active"
          onClick={handleDiscover}
          disabled={isDiscovering || !archiveId}
        >
          {isDiscovering ? 'Discovering...' : '🔍 Discover'}
        </button>
      </div>

      {/* Loading State */}
      {(isLoading || isDiscovering) && (
        <div className="panel__loading">
          <div className="panel__loading-spinner" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="panel__empty">
          <div className="panel__empty-icon">⚠️</div>
          <div className="panel__empty-title">Error</div>
          <div className="panel__empty-description">{error}</div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isDiscovering && !error && clusters.length === 0 && (
        <div className="panel__empty">
          <div className="panel__empty-icon">🎯</div>
          <div className="panel__empty-title">No Clusters Yet</div>
          <div className="panel__empty-description">
            Click "Discover" to find topic clusters in your archive
          </div>
        </div>
      )}

      {/* Cluster List */}
      {!isLoading && !isDiscovering && clusters.length > 0 && (
        <div className="cluster-list">
          {clusters.map((cluster) => (
            <div
              key={cluster.id}
              className="cluster-card"
              role="button"
              tabIndex={0}
              onClick={() => handleSelect(cluster)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSelect(cluster);
              }}
            >
              {/* Header */}
              <div className="cluster-card__header">
                <h3 className="cluster-card__title">{cluster.label}</h3>
                <span className="cluster-card__count">
                  {cluster.passageCount} items
                </span>
              </div>

              {/* Description */}
              <p className="cluster-card__description">{cluster.description}</p>

              {/* Keywords */}
              <div className="cluster-card__keywords">
                {cluster.keywords.slice(0, 5).map((keyword, i) => (
                  <span key={i} className="cluster-card__keyword">
                    {keyword}
                  </span>
                ))}
                {cluster.keywords.length > 5 && (
                  <span className="cluster-card__keyword">
                    +{cluster.keywords.length - 5} more
                  </span>
                )}
              </div>

              {/* Coherence indicator */}
              <div
                className="search-result__meta"
                style={{ color: getCoherenceColor(cluster.coherence) }}
              >
                Coherence: {Math.round(cluster.coherence * 100)}%
                {cluster.dateRange && (
                  <span>
                    {' '}
                    · {new Date(cluster.dateRange.earliest).toLocaleDateString()} -{' '}
                    {new Date(cluster.dateRange.latest).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="cluster-card__actions">
                <button
                  className="search-result__action search-result__action--similar"
                  onClick={(e) => handleSearchSimilar(cluster, e)}
                  title="Find content similar to this cluster"
                >
                  ↗️ Find Similar
                </button>
                <button
                  className="search-result__action"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(cluster.id);
                  }}
                  title={expandedId === cluster.id ? 'Hide samples' : 'Show samples'}
                >
                  {expandedId === cluster.id ? '▲ Hide' : '▼ Samples'}
                </button>
              </div>

              {/* Expanded representative passages */}
              {expandedId === cluster.id && cluster.representativePassages && (
                <div style={{ marginTop: 'var(--space-sm)' }}>
                  {cluster.representativePassages.map((passage) => (
                    <div
                      key={passage.id}
                      className="search-result"
                      style={{ marginTop: 'var(--space-xs)', borderLeft: 'none' }}
                    >
                      <div className="search-result__content">{passage.text}</div>
                      <div className="search-result__meta">
                        <span
                          className={`search-result__score ${
                            passage.similarity >= 0.7
                              ? 'search-result__score--high'
                              : passage.similarity >= 0.4
                                ? 'search-result__score--medium'
                                : 'search-result__score--low'
                          }`}
                        >
                          {Math.round(passage.similarity * 100)}% match
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ClusterBrowser;
