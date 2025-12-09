/**
 * BufferTreeView - Visual tree component for navigating workspace buffers
 *
 * Displays the buffer hierarchy as a collapsible tree with:
 * - Transform type icons
 * - AI score badges
 * - Active/compare buffer indicators
 * - Click to select, Shift+click for compare
 */

import { useState, useCallback } from 'react';
import { useWorkspaceOptional } from '../../contexts/WorkspaceContext';
import type { BufferNode } from '../../types/workspace';
import './BufferTreeView.css';

// Transform type icons
const TRANSFORM_ICONS: Record<string, string> = {
  humanizer: '🤖',
  persona: '👤',
  style: '🎨',
  'round-trip': '🔄',
  'ai-analysis': '🔬',
  'manual-edit': '✏️',
  original: '📄',
};

interface BufferTreeViewProps {
  /** Whether the tree is collapsible */
  collapsible?: boolean;
  /** Initial collapsed state */
  defaultCollapsed?: boolean;
  /** Callback when a buffer is selected */
  onBufferSelect?: (bufferId: string) => void;
  /** Callback when compare buffer is selected */
  onCompareSelect?: (bufferId: string) => void;
}

export function BufferTreeView({
  collapsible = true,
  defaultCollapsed = false,
  onBufferSelect,
  onCompareSelect,
}: BufferTreeViewProps) {
  const workspaceContext = useWorkspaceOptional();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const bufferTree = workspaceContext?.getBufferTree();
  const activeWorkspace = workspaceContext?.getActiveWorkspace();

  // Toggle node expansion
  const toggleExpanded = useCallback((bufferId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(bufferId)) {
        next.delete(bufferId);
      } else {
        next.add(bufferId);
      }
      return next;
    });
  }, []);

  // Handle buffer click
  const handleBufferClick = useCallback((bufferId: string, event: React.MouseEvent) => {
    if (!workspaceContext) return;

    if (event.shiftKey) {
      // Shift+click sets compare buffer
      workspaceContext.setCompareBuffer(bufferId);
      onCompareSelect?.(bufferId);
    } else {
      // Regular click sets active buffer
      workspaceContext.setActiveBuffer(bufferId);
      onBufferSelect?.(bufferId);
    }
  }, [workspaceContext, onBufferSelect, onCompareSelect]);

  // Handle star toggle
  const handleStarClick = useCallback((bufferId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    workspaceContext?.toggleBufferStar(bufferId);
  }, [workspaceContext]);

  // No workspace context or no tree
  if (!workspaceContext || !bufferTree || !activeWorkspace) {
    return (
      <div className="buffer-tree buffer-tree--empty">
        <span className="buffer-tree__empty-text">No workspace active</span>
      </div>
    );
  }

  // Get transform icon
  const getIcon = (node: BufferNode): string => {
    if (!node.transform) return TRANSFORM_ICONS.original;
    return TRANSFORM_ICONS[node.transform.type] || '📄';
  };

  // Format AI score
  const formatAiScore = (score: number | undefined): string | null => {
    if (score === undefined) return null;
    return `${Math.round(score)}%`;
  };

  // Get AI score color class
  const getScoreClass = (score: number | undefined): string => {
    if (score === undefined) return '';
    if (score <= 30) return 'buffer-tree__score--good';
    if (score <= 60) return 'buffer-tree__score--warning';
    return 'buffer-tree__score--high';
  };

  // Render a single buffer node
  const renderNode = (node: BufferNode): JSX.Element => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id) || node.depth === 0;
    const aiScore = node.analysis?.aiScore;

    const nodeClasses = [
      'buffer-tree__node',
      node.isActive && 'buffer-tree__node--active',
      node.isCompare && 'buffer-tree__node--compare',
      node.starred && 'buffer-tree__node--starred',
    ].filter(Boolean).join(' ');

    return (
      <div key={node.id} className="buffer-tree__item">
        <div
          className={nodeClasses}
          onClick={(e) => handleBufferClick(node.id, e)}
          style={{ paddingLeft: `calc(var(--space-sm) + ${node.depth * 16}px)` }}
          role="treeitem"
          aria-selected={node.isActive}
          aria-expanded={hasChildren ? isExpanded : undefined}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleBufferClick(node.id, e as unknown as React.MouseEvent);
            }
          }}
        >
          {/* Expand/collapse toggle for nodes with children */}
          {hasChildren ? (
            <button
              className="buffer-tree__expand-btn"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(node.id);
              }}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              <span className={`buffer-tree__expand-icon ${isExpanded ? 'buffer-tree__expand-icon--open' : ''}`}>
                ▶
              </span>
            </button>
          ) : (
            <span className="buffer-tree__expand-spacer" />
          )}

          {/* Transform type icon */}
          <span className="buffer-tree__icon" title={node.transform?.type || 'Original'}>
            {getIcon(node)}
          </span>

          {/* Buffer name */}
          <span className="buffer-tree__name">
            {node.displayName || 'Buffer'}
          </span>

          {/* Indicators */}
          <span className="buffer-tree__indicators">
            {/* AI Score badge */}
            {aiScore !== undefined && (
              <span
                className={`buffer-tree__score ${getScoreClass(aiScore)}`}
                title={`AI Detection: ${Math.round(aiScore)}%`}
              >
                {formatAiScore(aiScore)}
              </span>
            )}

            {/* Star button */}
            <button
              className={`buffer-tree__star-btn ${node.starred ? 'buffer-tree__star-btn--active' : ''}`}
              onClick={(e) => handleStarClick(node.id, e)}
              title={node.starred ? 'Unstar' : 'Star'}
              aria-label={node.starred ? 'Unstar buffer' : 'Star buffer'}
            >
              {node.starred ? '★' : '☆'}
            </button>

            {/* Active indicator */}
            {node.isActive && (
              <span className="buffer-tree__badge buffer-tree__badge--active" title="Active buffer">
                A
              </span>
            )}

            {/* Compare indicator */}
            {node.isCompare && (
              <span className="buffer-tree__badge buffer-tree__badge--compare" title="Compare buffer">
                C
              </span>
            )}
          </span>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="buffer-tree__children" role="group">
            {node.children.map(child => renderNode(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="buffer-tree" role="tree" aria-label="Buffer tree">
      {/* Header */}
      {collapsible && (
        <button
          className="buffer-tree__header"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-expanded={!isCollapsed}
        >
          <span className={`buffer-tree__collapse-icon ${isCollapsed ? '' : 'buffer-tree__collapse-icon--open'}`}>
            ▶
          </span>
          <span className="buffer-tree__header-title">
            Buffer Tree
          </span>
          <span className="buffer-tree__header-count">
            {Object.keys(activeWorkspace.buffers).length} versions
          </span>
        </button>
      )}

      {/* Tree content */}
      {!isCollapsed && (
        <div className="buffer-tree__content">
          {renderNode(bufferTree)}

          {/* Help text */}
          <div className="buffer-tree__help">
            Click to select · Shift+click to compare
          </div>
        </div>
      )}
    </div>
  );
}

export default BufferTreeView;
