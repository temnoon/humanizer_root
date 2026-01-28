/**
 * ArchiveBrowser - Tree View Browser
 *
 * Hierarchical tree view of archive contents:
 * - Conversations with nested messages
 * - Media items with transcript indicators
 * - Similar/dissimilar search actions
 * - One-click transcription trigger
 *
 * @module @humanizer/studio/components/archive/ArchiveBrowser
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ArchiveBrowserProps {
  /** Archive ID to display */
  archiveId?: string;
  /** Called when a content item is selected */
  onSelectContent?: (contentId: string, type: 'node' | 'transcript') => void;
  /** Called when similar search is requested */
  onSearchSimilar?: (embedding: number[], sourceId: string) => void;
  /** Called when transcription is requested for media */
  onRequestTranscription?: (mediaId: string, archiveId: string) => void;
  /** Optional class name */
  className?: string;
}

/** Tree node representing a conversation, message, or media item */
export interface TreeNode {
  id: string;
  type: 'conversation' | 'message' | 'media';
  label: string;
  children?: TreeNode[];
  level: number;
  // Conversation-specific
  messageCount?: number;
  createdAt?: Date;
  source?: string; // 'chatgpt', 'claude', 'facebook', etc.
  // Media-specific
  mediaType?: 'image' | 'audio' | 'video' | 'document';
  hasTranscript?: boolean;
  transcriptCount?: number;
  transcriptStatus?: 'none' | 'pending' | 'completed';
  // For linking media to surrounding messages
  contextMessage?: string;
  contextDirection?: 'before' | 'after' | 'contains';
  // Search capability
  embedding?: number[];
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DATA (Replace with actual API calls)
// ═══════════════════════════════════════════════════════════════════════════

async function fetchArchiveTree(archiveId: string | undefined): Promise<TreeNode[]> {
  // TODO: Replace with actual API call
  // This would call: GET /api/archive/{archiveId}/tree
  // Returns hierarchical tree of conversations -> messages -> media
  return [];
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function ArchiveBrowser({
  archiveId,
  onSelectContent,
  onSearchSimilar,
  onRequestTranscription,
  className = '',
}: ArchiveBrowserProps): React.ReactElement {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Load tree data
  useEffect(() => {
    if (archiveId) {
      setIsLoading(true);
      fetchArchiveTree(archiveId)
        .then(setTree)
        .finally(() => setIsLoading(false));
    }
  }, [archiveId]);

  // Toggle node expansion
  const toggleExpand = useCallback((nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // Select node
  const handleSelect = useCallback(
    (node: TreeNode) => {
      setSelectedId(node.id);
      if (node.type === 'media' && node.hasTranscript) {
        onSelectContent?.(node.id, 'transcript');
      } else {
        onSelectContent?.(node.id, 'node');
      }
    },
    [onSelectContent]
  );

  // Handle similar search
  const handleSearchSimilar = useCallback(
    (node: TreeNode, e: React.MouseEvent) => {
      e.stopPropagation();
      if (node.embedding && onSearchSimilar) {
        onSearchSimilar(node.embedding, node.id);
      }
    },
    [onSearchSimilar]
  );

  // Handle transcription request
  const handleRequestTranscription = useCallback(
    (node: TreeNode, e: React.MouseEvent) => {
      e.stopPropagation();
      if (node.type === 'media' && archiveId && onRequestTranscription) {
        onRequestTranscription(node.id, archiveId);
      }
    },
    [archiveId, onRequestTranscription]
  );

  // Filter tree based on search
  const filteredTree = useMemo(() => {
    if (!searchFilter.trim()) return tree;

    const filterNode = (node: TreeNode): TreeNode | null => {
      const matchesFilter = node.label.toLowerCase().includes(searchFilter.toLowerCase());
      const filteredChildren = node.children
        ?.map(filterNode)
        .filter((n): n is TreeNode => n !== null);

      if (matchesFilter || (filteredChildren && filteredChildren.length > 0)) {
        return {
          ...node,
          children: filteredChildren,
        };
      }
      return null;
    };

    return tree.map(filterNode).filter((n): n is TreeNode => n !== null);
  }, [tree, searchFilter]);

  // Get icon for node type
  const getNodeIcon = (node: TreeNode): string => {
    if (node.type === 'conversation') return '💬';
    if (node.type === 'message') return '📝';
    if (node.type === 'media') {
      switch (node.mediaType) {
        case 'image':
          return '🖼️';
        case 'audio':
          return '🎵';
        case 'video':
          return '🎬';
        case 'document':
          return '📄';
        default:
          return '📎';
      }
    }
    return '📁';
  };

  // Get source icon
  const getSourceIcon = (source?: string): string => {
    switch (source) {
      case 'chatgpt':
        return '🤖';
      case 'claude':
        return '🎭';
      case 'facebook':
        return '👤';
      case 'instagram':
        return '📷';
      case 'twitter':
        return '🐦';
      default:
        return '';
    }
  };

  // Render a single tree node
  const renderNode = (node: TreeNode): React.ReactElement => {
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedId === node.id;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} className="archive-tree__node">
        <div
          className={`archive-tree__item archive-tree__item--level-${Math.min(node.level, 3)} ${
            isSelected ? 'archive-tree__item--selected' : ''
          }`}
          role="treeitem"
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-selected={isSelected}
          tabIndex={0}
          onClick={() => handleSelect(node)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSelect(node);
            if (e.key === 'ArrowRight' && hasChildren && !isExpanded) toggleExpand(node.id);
            if (e.key === 'ArrowLeft' && isExpanded) toggleExpand(node.id);
          }}
        >
          {/* Expand/Collapse button */}
          {hasChildren ? (
            <button
              className={`archive-tree__expand ${isExpanded ? 'archive-tree__expand--expanded' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.id);
              }}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              ▸
            </button>
          ) : (
            <span style={{ width: 20 }} />
          )}

          {/* Icon */}
          <span
            className={`archive-tree__icon archive-tree__icon--${node.type}`}
            aria-hidden="true"
          >
            {getNodeIcon(node)}
          </span>

          {/* Label */}
          <span className="archive-tree__label">{node.label}</span>

          {/* Source indicator */}
          {node.source && (
            <span className="archive-tree__meta" title={node.source}>
              {getSourceIcon(node.source)}
            </span>
          )}

          {/* Message count */}
          {node.messageCount !== undefined && (
            <span className="archive-tree__meta">{node.messageCount}</span>
          )}

          {/* Badges */}
          <div className="archive-tree__badges">
            {/* Transcript indicator for media */}
            {node.type === 'media' && (
              <>
                {node.transcriptStatus === 'completed' && node.transcriptCount ? (
                  <span
                    className="archive-tree__transcript-indicator archive-tree__transcript-indicator--has-transcript"
                    title={`${node.transcriptCount} transcript(s) available`}
                  >
                    🎙️ {node.transcriptCount}
                  </span>
                ) : node.transcriptStatus === 'pending' ? (
                  <span
                    className="archive-tree__transcript-indicator archive-tree__transcript-indicator--has-transcript"
                    title="Transcription in progress"
                  >
                    ⏳
                  </span>
                ) : (
                  <button
                    className="archive-tree__transcript-indicator archive-tree__transcript-indicator--no-transcript"
                    title="Click to transcribe"
                    onClick={(e) => handleRequestTranscription(node, e)}
                  >
                    + 🎙️
                  </button>
                )}
              </>
            )}

            {/* Similar search button */}
            {node.embedding && (
              <button
                className="search-result__action search-result__action--similar"
                onClick={(e) => handleSearchSimilar(node, e)}
                title="Find similar"
                style={{ padding: '2px 4px', fontSize: '10px' }}
              >
                ↗️
              </button>
            )}
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div role="group">{node.children!.map(renderNode)}</div>
        )}
      </div>
    );
  };

  return (
    <div className={`archive-browser ${className}`}>
      {/* Search/Filter */}
      <div className="archive-search-input">
        <div className="archive-search-input__field">
          <span className="archive-search-input__icon">🔍</span>
          <input
            type="text"
            className="archive-search-input__input"
            placeholder="Filter conversations..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            aria-label="Filter archive"
          />
          {searchFilter && (
            <button
              className="archive-search-input__clear"
              onClick={() => setSearchFilter('')}
              aria-label="Clear filter"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="panel__loading">
          <div className="panel__loading-spinner" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredTree.length === 0 && (
        <div className="panel__empty">
          <div className="panel__empty-icon">📂</div>
          <div className="panel__empty-title">
            {searchFilter ? 'No Matches' : 'No Archive Selected'}
          </div>
          <div className="panel__empty-description">
            {searchFilter
              ? 'Try different filter terms'
              : 'Select an archive or import one to browse contents'}
          </div>
        </div>
      )}

      {/* Tree View */}
      {!isLoading && filteredTree.length > 0 && (
        <div className="archive-tree" role="tree" aria-label="Archive contents">
          {filteredTree.map(renderNode)}
        </div>
      )}
    </div>
  );
}

export default ArchiveBrowser;
