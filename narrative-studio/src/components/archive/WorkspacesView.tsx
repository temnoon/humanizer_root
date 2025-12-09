/**
 * WorkspacesView - List and manage transformation workspaces
 *
 * Displays workspace cards in the Archive Panel's Workspaces tab.
 * Allows loading, renaming, archiving, and deleting workspaces.
 */

import { useState, useEffect, useMemo } from 'react';
import { useWorkspaceOptional } from '../../contexts/WorkspaceContext';
import { workspaceStorage } from '../../services/workspaceStorage';
import type { WorkspaceSummary, WorkspaceSource } from '../../types/workspace';
import './WorkspacesView.css';

// Source type icons
const SOURCE_ICONS: Record<WorkspaceSource['type'], string> = {
  'archive-message': '💬',
  'book-passage': '📖',
  'paste': '📋',
  'import': '📥',
  'blank': '📝',
};

interface WorkspacesViewProps {
  onSelectWorkspace?: (workspaceId: string) => void;
}

export function WorkspacesView({ onSelectWorkspace }: WorkspacesViewProps) {
  const workspaceContext = useWorkspaceOptional();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [storageStats, setStorageStats] = useState<{
    workspaceCount: number;
    totalSize: number;
    nearQuota: boolean;
  } | null>(null);

  // Load workspaces on mount
  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const summaries = await workspaceStorage.listWorkspaces();
      setWorkspaces(summaries);
      const stats = workspaceStorage.getStorageStats();
      setStorageStats(stats);
    } catch (err) {
      console.error('Failed to load workspaces:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workspaces');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter workspaces based on archived state
  const filteredWorkspaces = useMemo(() => {
    return workspaces.filter(ws => showArchived ? ws.archived : !ws.archived);
  }, [workspaces, showArchived]);

  // Active and archived counts
  const activeCounts = useMemo(() => {
    const active = workspaces.filter(ws => !ws.archived).length;
    const archived = workspaces.filter(ws => ws.archived).length;
    return { active, archived };
  }, [workspaces]);

  // Handle workspace selection
  const handleSelect = async (workspaceId: string) => {
    if (!workspaceContext) return;
    workspaceContext.loadWorkspace(workspaceId);
    onSelectWorkspace?.(workspaceId);
  };

  // Handle rename
  const handleStartRename = (ws: WorkspaceSummary) => {
    setEditingId(ws.id);
    setEditName(ws.name);
  };

  const handleSaveRename = async () => {
    if (!editingId || !editName.trim() || !workspaceContext) return;
    workspaceContext.renameWorkspace(editingId, editName.trim());
    await workspaceContext.saveWorkspace();
    setEditingId(null);
    setEditName('');
    await loadWorkspaces();
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setEditName('');
  };

  // Handle archive/unarchive
  const handleToggleArchive = async (ws: WorkspaceSummary) => {
    if (!workspaceContext) return;
    if (ws.archived) {
      workspaceContext.unarchiveWorkspace(ws.id);
    } else {
      workspaceContext.archiveWorkspace(ws.id);
    }
    await workspaceContext.saveWorkspace();
    await loadWorkspaces();
  };

  // Handle delete
  const handleDelete = async (ws: WorkspaceSummary) => {
    const confirmed = confirm(
      `Delete workspace "${ws.name}"?\n\nThis will permanently remove all ${ws.bufferCount} buffer versions.`
    );
    if (!confirmed) return;

    if (workspaceContext) {
      await workspaceContext.deleteWorkspace(ws.id);
      await loadWorkspaces();
    }
  };

  // Format date
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  // Format storage size
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Get AI score class
  const getScoreClass = (score: number | undefined): string => {
    if (score === undefined) return '';
    if (score <= 30) return 'workspaces-view__score--good';
    if (score <= 60) return 'workspaces-view__score--warning';
    return 'workspaces-view__score--high';
  };

  // Get source description
  const getSourceDescription = (source: WorkspaceSource | undefined): string => {
    if (!source) return 'Unknown';
    switch (source.type) {
      case 'archive-message':
        return source.conversationTitle || 'Archive Message';
      case 'book-passage':
        return source.bookTitle || 'Book Passage';
      case 'import':
        return source.fileName || 'Imported File';
      case 'paste':
        return 'Pasted Content';
      case 'blank':
        return 'New Document';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="workspaces-view">
      {/* Header */}
      <div className="workspaces-view__header">
        <h2 className="workspaces-view__title">Workspaces</h2>
        <div className="workspaces-view__actions">
          <button
            onClick={loadWorkspaces}
            className="workspaces-view__btn workspaces-view__btn--secondary"
            title="Refresh list"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="workspaces-view__tabs">
        <button
          className={`workspaces-view__tab ${!showArchived ? 'workspaces-view__tab--active' : ''}`}
          onClick={() => setShowArchived(false)}
        >
          Active ({activeCounts.active})
        </button>
        <button
          className={`workspaces-view__tab ${showArchived ? 'workspaces-view__tab--active' : ''}`}
          onClick={() => setShowArchived(true)}
        >
          Archived ({activeCounts.archived})
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="workspaces-view__loading">
          <div className="workspaces-view__spinner" />
          <p>Loading workspaces...</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="workspaces-view__error">
          <p>{error}</p>
          <button
            onClick={loadWorkspaces}
            className="workspaces-view__btn workspaces-view__btn--primary"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && filteredWorkspaces.length === 0 && (
        <div className="workspaces-view__empty">
          <div className="workspaces-view__empty-icon">
            {showArchived ? '📦' : '📂'}
          </div>
          <p className="workspaces-view__empty-title">
            {showArchived ? 'No archived workspaces' : 'No workspaces yet'}
          </p>
          <p className="workspaces-view__empty-text">
            {showArchived
              ? 'Archived workspaces will appear here'
              : 'Workspaces are created automatically when you use transformation tools'}
          </p>
        </div>
      )}

      {/* Workspace list */}
      {!isLoading && !error && filteredWorkspaces.length > 0 && (
        <div className="workspaces-view__list">
          {filteredWorkspaces.map((ws) => {
            const isActive = workspaceContext?.activeWorkspaceId === ws.id;
            const isEditing = editingId === ws.id;

            return (
              <div
                key={ws.id}
                className={`workspaces-view__card ${isActive ? 'workspaces-view__card--active' : ''}`}
                onClick={() => !isEditing && handleSelect(ws.id)}
              >
                {/* Card header */}
                <div className="workspaces-view__card-header">
                  <span className="workspaces-view__source-icon">
                    {ws.source ? (SOURCE_ICONS[ws.source.type] || '📄') : '📄'}
                  </span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename();
                        if (e.key === 'Escape') handleCancelRename();
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="workspaces-view__name-input"
                      autoFocus
                    />
                  ) : (
                    <span className="workspaces-view__name">{ws.name}</span>
                  )}
                  {isActive && (
                    <span className="workspaces-view__badge">Active</span>
                  )}
                </div>

                {/* Card body */}
                <div className="workspaces-view__card-body">
                  {ws.previewText && (
                    <p className="workspaces-view__preview">{ws.previewText}</p>
                  )}
                  <div className="workspaces-view__meta">
                    <span className="workspaces-view__source">
                      {getSourceDescription(ws.source)}
                    </span>
                    <span className="workspaces-view__dot">·</span>
                    <span className="workspaces-view__buffers">
                      {ws.bufferCount} version{ws.bufferCount !== 1 ? 's' : ''}
                    </span>
                    {ws.starredCount > 0 && (
                      <>
                        <span className="workspaces-view__dot">·</span>
                        <span className="workspaces-view__starred">
                          ★ {ws.starredCount}
                        </span>
                      </>
                    )}
                    {ws.bestAiScore !== undefined && (
                      <>
                        <span className="workspaces-view__dot">·</span>
                        <span className={`workspaces-view__score ${getScoreClass(ws.bestAiScore)}`}>
                          {Math.round(ws.bestAiScore)}% AI
                        </span>
                      </>
                    )}
                  </div>
                  <div className="workspaces-view__date">
                    {formatDate(ws.updatedAt)}
                  </div>
                </div>

                {/* Card actions */}
                <div className="workspaces-view__card-actions" onClick={(e) => e.stopPropagation()}>
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleSaveRename}
                        className="workspaces-view__action-btn"
                        title="Save"
                      >
                        ✓
                      </button>
                      <button
                        onClick={handleCancelRename}
                        className="workspaces-view__action-btn"
                        title="Cancel"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleStartRename(ws)}
                        className="workspaces-view__action-btn"
                        title="Rename"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleToggleArchive(ws)}
                        className="workspaces-view__action-btn"
                        title={ws.archived ? 'Unarchive' : 'Archive'}
                      >
                        {ws.archived ? '📤' : '📦'}
                      </button>
                      <button
                        onClick={() => handleDelete(ws)}
                        className="workspaces-view__action-btn workspaces-view__action-btn--danger"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer with storage info */}
      {!isLoading && storageStats && (
        <div className="workspaces-view__footer">
          <span className="workspaces-view__storage">
            {storageStats.workspaceCount} workspace{storageStats.workspaceCount !== 1 ? 's' : ''} · {formatSize(storageStats.totalSize)}
          </span>
          {storageStats.nearQuota && (
            <span className="workspaces-view__quota-warning">
              ⚠️ Near storage limit
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default WorkspacesView;
