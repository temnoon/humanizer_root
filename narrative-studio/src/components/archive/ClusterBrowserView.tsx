/**
 * ClusterBrowserView - Browse auto-discovered topic clusters
 *
 * Features:
 * - Cluster discovery with HDBSCAN
 * - View all messages in a cluster (with pagination)
 * - Filter by role (user/assistant)
 * - Filter out image generation prompts
 * - Display as messages or grouped by conversation
 */

import { useState, useCallback } from 'react';
import { useExplore } from '../../contexts/ExploreContext';
import { embeddingService } from '../../services/embeddingService';
import type { Cluster, ClusterMember, ClusterMemberConversation } from '../../services/embeddingService';

interface ClusterBrowserViewProps {
  onNavigate: (conversationId: string, messageIndex?: number) => void;
}

type DisplayMode = 'messages' | 'conversations';
type RoleFilter = 'all' | 'user' | 'assistant';

export function ClusterBrowserView({ onNavigate }: ClusterBrowserViewProps) {
  const {
    clusters,
    clusteringJob,
    clusteringParams,
    setClusteringParams,
    runClustering,
  } = useExplore();

  // UI state
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [showParams, setShowParams] = useState(false);

  // Filter state
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [excludeImagePrompts, setExcludeImagePrompts] = useState(true);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('messages');

  // Member data state
  const [members, setMembers] = useState<ClusterMember[]>([]);
  const [conversations, setConversations] = useState<ClusterMemberConversation[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersTotal, setMembersTotal] = useState(0);
  const [membersOffset, setMembersOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const loading = clusteringJob?.status === 'running';
  const error = clusteringJob?.status === 'error' ? clusteringJob.error : null;

  const getCoherenceColor = (coherence: number) => {
    if (coherence > 0.7) return { bg: 'rgba(34, 197, 94, 0.2)', text: 'var(--success, #22c55e)' };
    if (coherence > 0.5) return { bg: 'rgba(234, 179, 8, 0.2)', text: 'var(--warning, #eab308)' };
    return { bg: 'rgba(107, 114, 128, 0.2)', text: 'var(--text-secondary)' };
  };

  const selectedClusterData = clusters.find(c => c.id === selectedCluster);

  // Fetch cluster members with current filters
  const fetchMembers = useCallback(async (cluster: Cluster, append = false) => {
    setMembersLoading(true);
    try {
      const roles = roleFilter === 'all' ? undefined : [roleFilter];
      const offset = append ? membersOffset + 50 : 0;

      const result = await embeddingService.getClusterMembers({
        memberIds: cluster.memberIds,
        roles,
        excludeImagePrompts,
        limit: 50,
        offset,
        groupByConversation: displayMode === 'conversations',
      });

      if (append) {
        setMembers(prev => [...prev, ...result.messages]);
      } else {
        setMembers(result.messages);
      }

      if (result.conversations) {
        if (append) {
          // Merge conversations
          const existingIds = new Set(conversations.map(c => c.conversationId));
          const newConvs = result.conversations.filter(c => !existingIds.has(c.conversationId));
          setConversations(prev => [...prev, ...newConvs]);
        } else {
          setConversations(result.conversations);
        }
      }

      setMembersTotal(result.total);
      setMembersOffset(offset);
      setHasMore(result.hasMore);
    } catch (err) {
      console.error('Failed to fetch cluster members:', err);
    } finally {
      setMembersLoading(false);
    }
  }, [roleFilter, excludeImagePrompts, displayMode, membersOffset, conversations]);

  // Handle cluster selection
  const handleSelectCluster = useCallback((clusterId: string | null) => {
    if (clusterId === selectedCluster) {
      setSelectedCluster(null);
      setMembers([]);
      setConversations([]);
      return;
    }

    setSelectedCluster(clusterId);
    setMembers([]);
    setConversations([]);
    setMembersOffset(0);

    if (clusterId) {
      const cluster = clusters.find(c => c.id === clusterId);
      if (cluster) {
        fetchMembers(cluster);
      }
    }
  }, [selectedCluster, clusters, fetchMembers]);

  // Handle filter changes - refetch data
  const handleFilterChange = useCallback(() => {
    if (selectedClusterData) {
      setMembersOffset(0);
      fetchMembers(selectedClusterData);
    }
  }, [selectedClusterData, fetchMembers]);

  // Truncate text helper
  const truncate = (text: string, len: number) => {
    if (text.length <= len) return text;
    return text.substring(0, len) + '...';
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div
        style={{
          padding: 'var(--space-md, 1rem)',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: showParams ? 'var(--space-md, 1rem)' : 0,
          }}
        >
          <div>
            <h3
              className="ui-text"
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              Topic Clusters
            </h3>
            {clusters.length > 0 && (
              <p
                className="ui-text"
                style={{
                  fontSize: '12px',
                  color: 'var(--text-tertiary)',
                  margin: 0,
                  marginTop: '4px',
                }}
              >
                {clusters.length} cluster{clusters.length !== 1 ? 's' : ''} discovered
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {/* Settings Button */}
            <button
              onClick={() => setShowParams(!showParams)}
              style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: showParams ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                color: showParams ? 'white' : 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
              title="Clustering parameters"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </button>

            {/* Run Button */}
            <button
              onClick={runClustering}
              disabled={loading}
              className="ui-text"
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 500,
                color: 'white',
                backgroundColor: loading ? 'var(--text-tertiary)' : 'var(--accent-primary)',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s',
              }}
            >
              {loading ? (
                <>
                  <div
                    style={{
                      width: '14px',
                      height: '14px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: 'white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                  Discovering...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                  {clusters.length > 0 ? 'Re-discover' : 'Discover Topics'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Parameters Panel */}
        {showParams && (
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '8px',
              padding: 'var(--space-md, 1rem)',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label
                  className="ui-text"
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--text-tertiary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Min Cluster Size
                </label>
                <input
                  type="number"
                  value={clusteringParams.minClusterSize}
                  onChange={(e) => setClusteringParams({ minClusterSize: parseInt(e.target.value) || 5 })}
                  min={3}
                  max={100}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: '13px',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <div>
                <label
                  className="ui-text"
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--text-tertiary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Min Samples
                </label>
                <input
                  type="number"
                  value={clusteringParams.minSamples}
                  onChange={(e) => setClusteringParams({ minSamples: parseInt(e.target.value) || 3 })}
                  min={2}
                  max={50}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: '13px',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <div>
                <label
                  className="ui-text"
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--text-tertiary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Max Sample Size
                </label>
                <input
                  type="number"
                  value={clusteringParams.maxSampleSize}
                  onChange={(e) => setClusteringParams({ maxSampleSize: parseInt(e.target.value) || 1500 })}
                  min={500}
                  max={10000}
                  step={500}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: '13px',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="excludeCode"
                  checked={clusteringParams.excludeCodeConversations}
                  onChange={(e) => setClusteringParams({ excludeCodeConversations: e.target.checked })}
                  style={{ width: '16px', height: '16px' }}
                />
                <label
                  htmlFor="excludeCode"
                  className="ui-text"
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  Exclude code conversations
                </label>
              </div>
            </div>
            <p
              className="ui-text"
              style={{
                fontSize: '11px',
                color: 'var(--text-tertiary)',
                margin: 0,
                marginTop: '12px',
              }}
            >
              Higher sample size = more accurate but slower. Default 1500 avoids memory issues.
            </p>
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

      {/* Empty State */}
      {!loading && clusters.length === 0 && !error && (
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
              <circle cx="12" cy="12" r="3" />
              <circle cx="19" cy="6" r="2" />
              <circle cx="5" cy="6" r="2" />
              <circle cx="19" cy="18" r="2" />
              <circle cx="5" cy="18" r="2" />
              <path d="M14 10l3-3M10 10l-3-3M14 14l3 3M10 14l-3 3" />
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
            Discover Topics
          </p>
          <p
            className="ui-text"
            style={{
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              maxWidth: '280px',
            }}
          >
            Use HDBSCAN clustering to find natural topic groups in your conversations.
          </p>
        </div>
      )}

      {/* Cluster List */}
      {clusters.length > 0 && (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
          }}
        >
          {/* Cluster List (Left) */}
          <div
            style={{
              width: selectedCluster ? '40%' : '100%',
              minWidth: selectedCluster ? '200px' : undefined,
              borderRight: selectedCluster ? '1px solid var(--border-color)' : 'none',
              overflowY: 'auto',
              padding: 'var(--space-md, 1rem)',
              transition: 'width 0.2s ease',
            }}
          >
            {clusters.map((cluster, idx) => {
              const cohColor = getCoherenceColor(cluster.coherence);
              const isSelected = selectedCluster === cluster.id;

              return (
                <div
                  key={cluster.id}
                  onClick={() => handleSelectCluster(isSelected ? null : cluster.id)}
                  style={{
                    backgroundColor: isSelected
                      ? 'var(--accent-primary)'
                      : 'var(--bg-elevated, var(--bg-tertiary))',
                    color: isSelected ? 'var(--text-inverse, white)' : 'var(--text-primary)',
                    padding: 'var(--space-sm, 0.5rem) var(--space-md, 1rem)',
                    borderRadius: '8px',
                    marginBottom: 'var(--space-sm, 0.5rem)',
                    cursor: 'pointer',
                    border: '2px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  {/* Header */}
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
                        fontSize: '13px',
                        fontWeight: 600,
                      }}
                    >
                      Cluster {idx + 1}
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--bg-secondary)',
                          color: isSelected ? 'white' : 'var(--text-secondary)',
                        }}
                      >
                        {cluster.memberCount} msgs
                      </span>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : cohColor.bg,
                          color: isSelected ? 'white' : cohColor.text,
                        }}
                      >
                        {(cluster.coherence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* Sample Text Preview */}
                  {cluster.sampleTexts.length > 0 && (
                    <p
                      className="ui-text"
                      style={{
                        fontSize: '12px',
                        lineHeight: 1.4,
                        margin: 0,
                        opacity: isSelected ? 0.9 : 0.7,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {cluster.sampleTexts[0]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Cluster Detail (Right) - Full member list */}
          {selectedCluster && selectedClusterData && (
            <div
              style={{
                width: '60%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Detail Header with Filters */}
              <div
                style={{
                  padding: 'var(--space-md, 1rem)',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4
                    className="ui-text"
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      margin: 0,
                    }}
                  >
                    {membersTotal} Messages
                  </h4>
                  <button
                    onClick={() => handleSelectCluster(null)}
                    style={{
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Filter Controls */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* Role Filter */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label className="ui-text" style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      Role:
                    </label>
                    <select
                      value={roleFilter}
                      onChange={(e) => {
                        setRoleFilter(e.target.value as RoleFilter);
                        setTimeout(handleFilterChange, 0);
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <option value="all">All</option>
                      <option value="user">User</option>
                      <option value="assistant">Assistant</option>
                    </select>
                  </div>

                  {/* Display Mode */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label className="ui-text" style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      View:
                    </label>
                    <select
                      value={displayMode}
                      onChange={(e) => {
                        setDisplayMode(e.target.value as DisplayMode);
                        setTimeout(handleFilterChange, 0);
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <option value="messages">Messages</option>
                      <option value="conversations">Conversations</option>
                    </select>
                  </div>

                  {/* Exclude Image Prompts */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={excludeImagePrompts}
                      onChange={(e) => {
                        setExcludeImagePrompts(e.target.checked);
                        setTimeout(handleFilterChange, 0);
                      }}
                      style={{ width: '14px', height: '14px' }}
                    />
                    <span className="ui-text" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Exclude image prompts
                    </span>
                  </label>
                </div>
              </div>

              {/* Member List */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: 'var(--space-md, 1rem)',
                }}
              >
                {membersLoading && members.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)' }}>
                    Loading messages...
                  </div>
                ) : displayMode === 'conversations' && conversations.length > 0 ? (
                  // Conversation view
                  conversations.map((conv) => (
                    <div
                      key={conv.conversationId}
                      style={{
                        marginBottom: 'var(--space-md, 1rem)',
                        backgroundColor: 'var(--bg-elevated, var(--bg-tertiary))',
                        borderRadius: '8px',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Conversation Header */}
                      <div
                        onClick={() => onNavigate(conv.conversationId)}
                        style={{
                          padding: 'var(--space-sm, 0.5rem) var(--space-md, 1rem)',
                          backgroundColor: 'var(--bg-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span
                          className="ui-text"
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {truncate(conv.conversationTitle || 'Untitled', 40)}
                        </span>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '11px',
                            backgroundColor: 'var(--accent-primary)',
                            color: 'white',
                          }}
                        >
                          {conv.messageCount} msgs
                        </span>
                      </div>
                      {/* Message previews */}
                      <div style={{ padding: 'var(--space-sm, 0.5rem)' }}>
                        {conv.messages.slice(0, 3).map((msg) => (
                          <div
                            key={msg.embeddingId}
                            style={{
                              padding: '6px 10px',
                              marginBottom: '4px',
                              borderRadius: '4px',
                              backgroundColor: msg.role === 'user' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                color: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                                textTransform: 'uppercase',
                              }}
                            >
                              {msg.role}
                            </span>
                            <p
                              className="ui-text"
                              style={{
                                fontSize: '12px',
                                color: 'var(--text-secondary)',
                                margin: '2px 0 0 0',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {msg.content}
                            </p>
                          </div>
                        ))}
                        {conv.messages.length > 3 && (
                          <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'center', margin: '8px 0 0 0' }}>
                            +{conv.messages.length - 3} more messages
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  // Message view
                  members.map((msg) => (
                    <div
                      key={msg.embeddingId}
                      onClick={() => onNavigate(msg.conversationId)}
                      style={{
                        backgroundColor: 'var(--bg-elevated, var(--bg-tertiary))',
                        padding: 'var(--space-sm, 0.5rem) var(--space-md, 1rem)',
                        borderRadius: '6px',
                        marginBottom: 'var(--space-sm, 0.5rem)',
                        cursor: 'pointer',
                        borderLeft: msg.role === 'user' ? '3px solid var(--accent-primary)' : '3px solid var(--text-tertiary)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            color: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                            textTransform: 'uppercase',
                          }}
                        >
                          {msg.role}
                        </span>
                        <span
                          className="ui-text"
                          style={{
                            fontSize: '10px',
                            color: 'var(--text-tertiary)',
                          }}
                        >
                          {truncate(msg.conversationTitle || 'Untitled', 30)}
                        </span>
                      </div>
                      <p
                        className="ui-text"
                        style={{
                          fontSize: '12px',
                          lineHeight: 1.5,
                          color: 'var(--text-primary)',
                          margin: 0,
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {msg.content}
                      </p>
                    </div>
                  ))
                )}

                {/* Load More Button */}
                {hasMore && !membersLoading && (
                  <button
                    onClick={() => fetchMembers(selectedClusterData, true)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      marginTop: 'var(--space-sm, 0.5rem)',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      color: 'var(--text-secondary)',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Load More ({membersTotal - members.length} remaining)
                  </button>
                )}

                {membersLoading && members.length > 0 && (
                  <div style={{ textAlign: 'center', padding: '10px', color: 'var(--text-tertiary)' }}>
                    Loading more...
                  </div>
                )}
              </div>
            </div>
          )}
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
