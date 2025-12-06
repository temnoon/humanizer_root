/**
 * ExploreContext - Persistent state for semantic exploration
 *
 * Maintains search results, clusters, anchors, and async job state
 * across tab switches in the Archive panel.
 */

import React, { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { embeddingService } from '../services/embeddingService';
import type { SearchResult, Cluster, Anchor, EmbeddingStatus } from '../services/embeddingService';

// Job status for async operations
export type JobStatus = 'idle' | 'running' | 'completed' | 'error';

export interface ClusteringJob {
  id: string;
  status: JobStatus;
  progress: number;
  startedAt: number;
  completedAt?: number;
  error?: string;
  params: ClusteringParams;
  results?: Cluster[];
}

export interface ClusteringParams {
  minClusterSize: number;
  minSamples: number;
  maxSampleSize: number;
  excludeCodeConversations: boolean;
}

export interface ProjectedPoint {
  id: string;
  x: number;
  y: number;
  z?: number;
  label: string;
  type: 'message' | 'cluster' | 'anchor';
  clusterId?: string;
  similarity?: number;
}

interface ExploreState {
  // Search state
  searchQuery: string;
  searchResults: SearchResult[];
  searchLoading: boolean;
  searchSource: '' | 'openai' | 'facebook';
  searchType: '' | 'post' | 'comment';

  // Clustering state
  clusters: Cluster[];
  clusteringJob: ClusteringJob | null;
  clusteringParams: ClusteringParams;

  // Anchor state
  anchors: Anchor[];
  selectedForAnchor: SearchResult[];

  // Visualization state
  projectedPoints: ProjectedPoint[];
  visualizationMode: '2d' | '3d';

  // Embedding status
  embeddingStatus: EmbeddingStatus | null;
}

interface ExploreContextValue extends ExploreState {
  // Search actions
  setSearchQuery: (query: string) => void;
  setSearchSource: (source: '' | 'openai' | 'facebook') => void;
  setSearchType: (type: '' | 'post' | 'comment') => void;
  executeSearch: (query: string) => Promise<void>;
  clearSearch: () => void;

  // Clustering actions
  setClusteringParams: (params: Partial<ClusteringParams>) => void;
  runClustering: () => Promise<void>;
  cancelClustering: () => void;

  // Anchor actions
  toggleSelectForAnchor: (result: SearchResult) => void;
  clearAnchorSelection: () => void;
  createAnchor: (name: string, isAnti?: boolean) => Promise<void>;
  deleteAnchor: (id: string) => Promise<void>;
  refreshAnchors: () => Promise<void>;

  // Visualization actions
  setVisualizationMode: (mode: '2d' | '3d') => void;
  computeProjection: () => Promise<void>;

  // Status
  refreshStatus: () => Promise<void>;
}

const defaultClusteringParams: ClusteringParams = {
  minClusterSize: 10,
  minSamples: 5,
  maxSampleSize: 1500,
  excludeCodeConversations: true,
};

const ExploreContext = createContext<ExploreContextValue | undefined>(undefined);

interface ExploreProviderProps {
  children: ReactNode;
}

export function ExploreProvider({ children }: ExploreProviderProps) {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchSource, setSearchSource] = useState<'' | 'openai' | 'facebook'>('');
  const [searchType, setSearchType] = useState<'' | 'post' | 'comment'>('');

  // Clustering state
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [clusteringJob, setClusteringJob] = useState<ClusteringJob | null>(null);
  const [clusteringParams, setClusteringParamsState] = useState<ClusteringParams>(defaultClusteringParams);

  // Anchor state
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [selectedForAnchor, setSelectedForAnchor] = useState<SearchResult[]>([]);

  // Visualization state
  const [projectedPoints, setProjectedPoints] = useState<ProjectedPoint[]>([]);
  const [visualizationMode, setVisualizationMode] = useState<'2d' | '3d'>('2d');

  // Embedding status
  const [embeddingStatus, setEmbeddingStatus] = useState<EmbeddingStatus | null>(null);

  // Refs for cancellation
  const clusteringAbortRef = useRef<AbortController | null>(null);

  // Search actions
  const executeSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      // Use content search if source is specified, otherwise use message search
      if (searchSource) {
        const data = await embeddingService.searchContent({
          query,
          limit: 50,
          source: searchSource,
          type: searchType || undefined,
        });
        setSearchResults(data.results);
      } else {
        const data = await embeddingService.searchMessages(query, 50);
        setSearchResults(data.results);
      }
    } catch (err) {
      console.error('Search failed:', err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [searchSource, searchType]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  // Clustering actions
  const setClusteringParams = useCallback((params: Partial<ClusteringParams>) => {
    setClusteringParamsState(prev => ({ ...prev, ...params }));
  }, []);

  const runClustering = useCallback(async () => {
    const jobId = `cluster-${Date.now()}`;

    setClusteringJob({
      id: jobId,
      status: 'running',
      progress: 0,
      startedAt: Date.now(),
      params: clusteringParams,
    });

    try {
      const data = await embeddingService.discoverClusters({
        minClusterSize: clusteringParams.minClusterSize,
        minSamples: clusteringParams.minSamples,
        maxSampleSize: clusteringParams.maxSampleSize,
      });

      setClusters(data.clusters);
      setClusteringJob(prev => prev ? {
        ...prev,
        status: 'completed',
        progress: 100,
        completedAt: Date.now(),
        results: data.clusters,
      } : null);
    } catch (err) {
      setClusteringJob(prev => prev ? {
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : 'Clustering failed',
      } : null);
    }
  }, [clusteringParams]);

  const cancelClustering = useCallback(() => {
    if (clusteringAbortRef.current) {
      clusteringAbortRef.current.abort();
    }
    setClusteringJob(prev => prev ? {
      ...prev,
      status: 'idle',
    } : null);
  }, []);

  // Anchor actions
  const toggleSelectForAnchor = useCallback((result: SearchResult) => {
    setSelectedForAnchor(prev => {
      const id = result.embeddingId || result.id;
      const exists = prev.find(p => (p.embeddingId || p.id) === id);
      if (exists) {
        return prev.filter(p => (p.embeddingId || p.id) !== id);
      }
      return [...prev, result];
    });
  }, []);

  const clearAnchorSelection = useCallback(() => {
    setSelectedForAnchor([]);
  }, []);

  const createAnchor = useCallback(async (name: string, isAnti = false) => {
    const sourceIds = selectedForAnchor
      .map(s => s.embeddingId || s.id)
      .filter(Boolean) as string[];

    if (sourceIds.length === 0) return;

    try {
      if (isAnti) {
        await embeddingService.createAntiAnchor(name, sourceIds);
      } else {
        await embeddingService.createAnchor(name, sourceIds);
      }
      clearAnchorSelection();
      // Refresh anchors list
      const data = await embeddingService.getAnchors();
      setAnchors(data.anchors || []);
    } catch (err) {
      console.error('Failed to create anchor:', err);
    }
  }, [selectedForAnchor, clearAnchorSelection]);

  const deleteAnchor = useCallback(async (id: string) => {
    try {
      await embeddingService.deleteAnchor(id);
      setAnchors(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error('Failed to delete anchor:', err);
    }
  }, []);

  const refreshAnchors = useCallback(async () => {
    try {
      const data = await embeddingService.getAnchors();
      setAnchors(data.anchors || []);
    } catch (err) {
      console.error('Failed to refresh anchors:', err);
    }
  }, []);

  // Visualization actions
  const computeProjection = useCallback(async () => {
    // TODO: Implement t-SNE/UMAP projection via backend API
    // For now, this is a placeholder
    console.log('Computing projection...');
  }, []);

  // Status
  const refreshStatus = useCallback(async () => {
    try {
      const status = await embeddingService.getStatus();
      setEmbeddingStatus(status);
    } catch (err) {
      console.error('Failed to refresh status:', err);
    }
  }, []);

  const value: ExploreContextValue = {
    // State
    searchQuery,
    searchResults,
    searchLoading,
    searchSource,
    searchType,
    clusters,
    clusteringJob,
    clusteringParams,
    anchors,
    selectedForAnchor,
    projectedPoints,
    visualizationMode,
    embeddingStatus,

    // Actions
    setSearchQuery,
    setSearchSource,
    setSearchType,
    executeSearch,
    clearSearch,
    setClusteringParams,
    runClustering,
    cancelClustering,
    toggleSelectForAnchor,
    clearAnchorSelection,
    createAnchor,
    deleteAnchor,
    refreshAnchors,
    setVisualizationMode,
    computeProjection,
    refreshStatus,
  };

  return (
    <ExploreContext.Provider value={value}>
      {children}
    </ExploreContext.Provider>
  );
}

export function useExplore() {
  const context = useContext(ExploreContext);
  if (context === undefined) {
    throw new Error('useExplore must be used within an ExploreProvider');
  }
  return context;
}
