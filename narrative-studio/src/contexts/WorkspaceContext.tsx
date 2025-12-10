/**
 * Workspace Context
 *
 * Manages persistent workspaces that contain transformation buffer trees.
 * Replaces the legacy "session" system with a proper tree-based model.
 *
 * Key concepts:
 * - Workspace: A complete transformation project with a source and buffer tree
 * - Buffer: A single version of content (original or transformed)
 * - Buffer Tree: Parent-child relationships showing transformation history
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import type {
  Workspace,
  WorkspaceSource,
  Buffer,
  BufferTransform,
  BufferAnalysis,
  BufferNode,
  WorkspaceSummary,
  WorkspaceContextValue,
  WorkspaceState,
} from '../types/workspace';
import { workspaceStorage, createSummary } from '../services/workspaceStorage';

// ============================================================
// ID GENERATION
// ============================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateWorkspaceId(): string {
  return `ws-${generateId()}`;
}

function generateBufferId(): string {
  return `buf-${generateId()}`;
}

/**
 * Generate a content hash for deduplication/change detection.
 */
function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate a display name for a buffer based on its transform.
 */
function generateBufferDisplayName(transform?: BufferTransform): string {
  if (!transform) return 'Original';

  switch (transform.type) {
    case 'humanizer':
      return `Humanizer (${transform.parameters.intensity || 'moderate'})`;
    case 'persona':
      return `Persona: ${transform.parameters.personaName || 'Custom'}`;
    case 'style':
      return `Style: ${transform.parameters.styleName || 'Custom'}`;
    case 'round-trip':
      return `Round-trip: ${transform.parameters.intermediateLanguage || 'Unknown'}`;
    case 'ai-analysis':
      return 'AI Analysis';
    case 'manual-edit':
      return transform.parameters.editDescription || 'Manual Edit';
    default:
      return 'Transformation';
  }
}

/**
 * Generate a workspace name from its source.
 */
function generateWorkspaceName(source: WorkspaceSource): string {
  switch (source.type) {
    case 'archive-message':
      return source.conversationTitle
        ? `${source.conversationTitle.substring(0, 30)}${source.conversationTitle.length > 30 ? '...' : ''}`
        : 'Archive Message';
    case 'book-passage':
      return source.bookTitle
        ? `${source.bookTitle.substring(0, 30)}${source.bookTitle.length > 30 ? '...' : ''}`
        : 'Book Passage';
    case 'paste':
      return 'Pasted Content';
    case 'import':
      return source.fileName || 'Imported File';
    case 'blank':
      return 'New Workspace';
    default:
      return 'Workspace';
  }
}

// ============================================================
// CONTEXT
// ============================================================

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

// ============================================================
// PROVIDER
// ============================================================

interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  // State
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load workspaces on mount
  useEffect(() => {
    async function loadWorkspaces() {
      try {
        setIsLoading(true);
        const summaries = await workspaceStorage.listWorkspaces();

        // Load full workspaces (for now; later we can lazy-load)
        const loaded: Workspace[] = [];
        for (const summary of summaries) {
          const workspace = await workspaceStorage.loadWorkspace(summary.id);
          if (workspace) {
            loaded.push(workspace);
          }
        }

        setWorkspaces(loaded);
        setError(null);
      } catch (err) {
        console.error('Failed to load workspaces:', err);
        setError(err instanceof Error ? err.message : 'Failed to load workspaces');
      } finally {
        setIsLoading(false);
      }
    }

    loadWorkspaces();
  }, []);

  // ============================================================
  // WORKSPACE CRUD
  // ============================================================

  const createWorkspace = useCallback((
    source: WorkspaceSource,
    initialContent: string,
    name?: string
  ): Workspace => {
    const now = Date.now();
    const workspaceId = generateWorkspaceId();
    const rootBufferId = generateBufferId();

    // Create root buffer
    const rootBuffer: Buffer = {
      id: rootBufferId,
      parentId: null,
      childIds: [],
      content: initialContent,
      contentHash: hashContent(initialContent),
      createdAt: now,
      displayName: 'Original',
      starred: false,
    };

    // Create workspace
    const workspace: Workspace = {
      id: workspaceId,
      name: name || generateWorkspaceName(source),
      createdAt: now,
      updatedAt: now,
      source,
      rootBufferId,
      buffers: { [rootBufferId]: rootBuffer },
      activeBufferId: rootBufferId,
      starredBufferIds: [],
      archived: false,
    };

    // Update state
    setWorkspaces(prev => [...prev, workspace]);
    setActiveWorkspaceId(workspaceId);

    // Persist asynchronously
    workspaceStorage.saveWorkspace(workspace).catch(err => {
      console.error('Failed to save new workspace:', err);
    });

    return workspace;
  }, []);

  const loadWorkspace = useCallback((id: string) => {
    const workspace = workspaces.find(w => w.id === id);
    if (workspace) {
      setActiveWorkspaceId(id);
    } else {
      console.warn(`Workspace ${id} not found`);
    }
  }, [workspaces]);

  const saveWorkspace = useCallback(async () => {
    if (!activeWorkspaceId) return;

    const workspace = workspaces.find(w => w.id === activeWorkspaceId);
    if (!workspace) return;

    try {
      await workspaceStorage.saveWorkspace(workspace);
    } catch (err) {
      console.error('Failed to save workspace:', err);
      throw err;
    }
  }, [activeWorkspaceId, workspaces]);

  const deleteWorkspace = useCallback(async (id: string) => {
    try {
      await workspaceStorage.deleteWorkspace(id);
      setWorkspaces(prev => prev.filter(w => w.id !== id));

      if (activeWorkspaceId === id) {
        setActiveWorkspaceId(null);
      }
    } catch (err) {
      console.error('Failed to delete workspace:', err);
      throw err;
    }
  }, [activeWorkspaceId]);

  const renameWorkspace = useCallback((id: string, name: string) => {
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== id) return w;

      const updated = {
        ...w,
        name,
        updatedAt: Date.now(),
      };

      // Persist asynchronously
      workspaceStorage.saveWorkspace(updated).catch(err => {
        console.error('Failed to save renamed workspace:', err);
      });

      return updated;
    }));
  }, []);

  const archiveWorkspace = useCallback((id: string) => {
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== id) return w;

      const updated = {
        ...w,
        archived: true,
        updatedAt: Date.now(),
      };

      workspaceStorage.saveWorkspace(updated).catch(err => {
        console.error('Failed to archive workspace:', err);
      });

      return updated;
    }));
  }, []);

  const unarchiveWorkspace = useCallback((id: string) => {
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== id) return w;

      const updated = {
        ...w,
        archived: false,
        updatedAt: Date.now(),
      };

      workspaceStorage.saveWorkspace(updated).catch(err => {
        console.error('Failed to unarchive workspace:', err);
      });

      return updated;
    }));
  }, []);

  /**
   * Clear the active workspace (deselect without deleting).
   * Used when loading new archive content to reset for fresh workspace creation.
   */
  const clearActiveWorkspace = useCallback(() => {
    setActiveWorkspaceId(null);
  }, []);

  // ============================================================
  // BUFFER OPERATIONS
  // ============================================================

  const createBuffer = useCallback((
    parentId: string,
    transform: BufferTransform,
    content: string,
    providedWorkspace?: Workspace
  ): Buffer => {
    // Use provided workspace or fall back to finding by activeWorkspaceId
    // This handles the case where workspace was just created and state hasn't propagated yet
    const workspaceId = providedWorkspace?.id || activeWorkspaceId;

    console.log('[WorkspaceContext.createBuffer] Called with:', {
      parentId,
      activeWorkspaceId,
      providedWorkspaceId: providedWorkspace?.id,
      workspacesCount: workspaces.length,
      transformType: transform.type,
    });

    if (!workspaceId) {
      throw new Error('No active workspace');
    }

    // Use provided workspace directly, or find from state
    const workspace = providedWorkspace || workspaces.find(w => w.id === workspaceId);
    if (!workspace) {
      throw new Error('Active workspace not found');
    }

    const parentBuffer = workspace.buffers[parentId];
    if (!parentBuffer) {
      console.error('[WorkspaceContext.createBuffer] Parent buffer not found. Available buffers:', Object.keys(workspace.buffers));
      throw new Error(`Parent buffer ${parentId} not found`);
    }

    const now = Date.now();
    const bufferId = generateBufferId();

    // Create new buffer
    const newBuffer: Buffer = {
      id: bufferId,
      parentId,
      childIds: [],
      content,
      contentHash: hashContent(content),
      createdAt: now,
      transform,
      displayName: generateBufferDisplayName(transform),
      starred: false,
    };

    // Update parent's childIds
    const updatedParent = {
      ...parentBuffer,
      childIds: [...parentBuffer.childIds, bufferId],
    };

    // Update workspace
    const updatedWorkspace: Workspace = {
      ...workspace,
      buffers: {
        ...workspace.buffers,
        [parentId]: updatedParent,
        [bufferId]: newBuffer,
      },
      activeBufferId: bufferId,
      updatedAt: now,
    };

    // Update state - need to handle both new workspace (not in state) and existing
    setWorkspaces(prev => {
      const exists = prev.some(w => w.id === workspaceId);
      if (exists) {
        return prev.map(w => w.id === workspaceId ? updatedWorkspace : w);
      } else {
        // Workspace was just created and not in state yet - add it
        return [...prev, updatedWorkspace];
      }
    });

    // Also ensure activeWorkspaceId is set if it wasn't
    if (!activeWorkspaceId && workspaceId) {
      setActiveWorkspaceId(workspaceId);
    }

    // Persist asynchronously
    workspaceStorage.saveWorkspace(updatedWorkspace).catch(err => {
      console.error('Failed to save workspace after creating buffer:', err);
    });

    return newBuffer;
  }, [activeWorkspaceId, workspaces]);

  const setActiveBuffer = useCallback((bufferId: string) => {
    if (!activeWorkspaceId) return;

    setWorkspaces(prev => prev.map(w => {
      if (w.id !== activeWorkspaceId) return w;
      if (!w.buffers[bufferId]) return w;

      const updated = {
        ...w,
        activeBufferId: bufferId,
        updatedAt: Date.now(),
      };

      workspaceStorage.saveWorkspace(updated).catch(err => {
        console.error('Failed to save workspace after setting active buffer:', err);
      });

      return updated;
    }));
  }, [activeWorkspaceId]);

  const setCompareBuffer = useCallback((bufferId: string | undefined, workspaceId?: string) => {
    // Use provided workspaceId or fall back to activeWorkspaceId from state
    const targetWorkspaceId = workspaceId || activeWorkspaceId;

    console.log('[WorkspaceContext.setCompareBuffer] Called with:', {
      bufferId,
      providedWorkspaceId: workspaceId,
      activeWorkspaceId,
      targetWorkspaceId,
    });

    if (!targetWorkspaceId) {
      console.warn('[WorkspaceContext.setCompareBuffer] No workspace ID available');
      return;
    }

    setWorkspaces(prev => prev.map(w => {
      if (w.id !== targetWorkspaceId) return w;
      if (bufferId && !w.buffers[bufferId]) {
        console.warn('[WorkspaceContext.setCompareBuffer] Buffer not found:', bufferId);
        return w;
      }

      const updated = {
        ...w,
        compareBufferId: bufferId,
        updatedAt: Date.now(),
      };

      workspaceStorage.saveWorkspace(updated).catch(err => {
        console.error('Failed to save workspace after setting compare buffer:', err);
      });

      return updated;
    }));
  }, [activeWorkspaceId]);

  const updateBufferAnalysis = useCallback((bufferId: string, analysis: BufferAnalysis) => {
    if (!activeWorkspaceId) return;

    setWorkspaces(prev => prev.map(w => {
      if (w.id !== activeWorkspaceId) return w;

      const buffer = w.buffers[bufferId];
      if (!buffer) return w;

      const updatedBuffer = {
        ...buffer,
        analysis,
      };

      const updated = {
        ...w,
        buffers: {
          ...w.buffers,
          [bufferId]: updatedBuffer,
        },
        updatedAt: Date.now(),
      };

      workspaceStorage.saveWorkspace(updated).catch(err => {
        console.error('Failed to save workspace after updating analysis:', err);
      });

      return updated;
    }));
  }, [activeWorkspaceId]);

  const updateBufferContent = useCallback((bufferId: string, content: string) => {
    if (!activeWorkspaceId) return;

    setWorkspaces(prev => prev.map(w => {
      if (w.id !== activeWorkspaceId) return w;

      const buffer = w.buffers[bufferId];
      if (!buffer) return w;

      const updatedBuffer = {
        ...buffer,
        content,
        contentHash: hashContent(content),
      };

      const updated = {
        ...w,
        buffers: {
          ...w.buffers,
          [bufferId]: updatedBuffer,
        },
        updatedAt: Date.now(),
      };

      workspaceStorage.saveWorkspace(updated).catch(err => {
        console.error('Failed to save workspace after updating content:', err);
      });

      return updated;
    }));
  }, [activeWorkspaceId]);

  const toggleBufferStar = useCallback((bufferId: string) => {
    if (!activeWorkspaceId) return;

    setWorkspaces(prev => prev.map(w => {
      if (w.id !== activeWorkspaceId) return w;

      const buffer = w.buffers[bufferId];
      if (!buffer) return w;

      const nowStarred = !buffer.starred;
      const updatedBuffer = {
        ...buffer,
        starred: nowStarred,
      };

      // Update starred IDs list
      let starredIds = w.starredBufferIds;
      if (nowStarred && !starredIds.includes(bufferId)) {
        starredIds = [...starredIds, bufferId];
      } else if (!nowStarred) {
        starredIds = starredIds.filter(id => id !== bufferId);
      }

      const updated = {
        ...w,
        buffers: {
          ...w.buffers,
          [bufferId]: updatedBuffer,
        },
        starredBufferIds: starredIds,
        updatedAt: Date.now(),
      };

      workspaceStorage.saveWorkspace(updated).catch(err => {
        console.error('Failed to save workspace after toggling star:', err);
      });

      return updated;
    }));
  }, [activeWorkspaceId]);

  const setBufferNote = useCallback((bufferId: string, note: string) => {
    if (!activeWorkspaceId) return;

    setWorkspaces(prev => prev.map(w => {
      if (w.id !== activeWorkspaceId) return w;

      const buffer = w.buffers[bufferId];
      if (!buffer) return w;

      const updatedBuffer = {
        ...buffer,
        note: note || undefined, // Remove empty notes
      };

      const updated = {
        ...w,
        buffers: {
          ...w.buffers,
          [bufferId]: updatedBuffer,
        },
        updatedAt: Date.now(),
      };

      workspaceStorage.saveWorkspace(updated).catch(err => {
        console.error('Failed to save workspace after setting note:', err);
      });

      return updated;
    }));
  }, [activeWorkspaceId]);

  const setBufferDisplayName = useCallback((bufferId: string, displayName: string) => {
    if (!activeWorkspaceId) return;

    setWorkspaces(prev => prev.map(w => {
      if (w.id !== activeWorkspaceId) return w;

      const buffer = w.buffers[bufferId];
      if (!buffer) return w;

      const updatedBuffer = {
        ...buffer,
        displayName,
      };

      const updated = {
        ...w,
        buffers: {
          ...w.buffers,
          [bufferId]: updatedBuffer,
        },
        updatedAt: Date.now(),
      };

      workspaceStorage.saveWorkspace(updated).catch(err => {
        console.error('Failed to save workspace after renaming buffer:', err);
      });

      return updated;
    }));
  }, [activeWorkspaceId]);

  const deleteBuffer = useCallback((bufferId: string) => {
    if (!activeWorkspaceId) return;

    setWorkspaces(prev => prev.map(w => {
      if (w.id !== activeWorkspaceId) return w;

      const buffer = w.buffers[bufferId];
      if (!buffer) return w;

      // Can't delete root buffer
      if (buffer.parentId === null) {
        console.warn('Cannot delete root buffer');
        return w;
      }

      // Collect all descendants to delete
      const toDelete = new Set<string>();
      const collectDescendants = (id: string) => {
        toDelete.add(id);
        const b = w.buffers[id];
        if (b) {
          b.childIds.forEach(collectDescendants);
        }
      };
      collectDescendants(bufferId);

      // Remove from parent's childIds
      const parent = w.buffers[buffer.parentId];
      const updatedParent = parent ? {
        ...parent,
        childIds: parent.childIds.filter(id => id !== bufferId),
      } : null;

      // Build new buffers object
      const newBuffers = { ...w.buffers };
      toDelete.forEach(id => delete newBuffers[id]);
      if (updatedParent) {
        newBuffers[buffer.parentId] = updatedParent;
      }

      // Update starred IDs
      const starredIds = w.starredBufferIds.filter(id => !toDelete.has(id));

      // Update active buffer if needed
      let newActiveId = w.activeBufferId;
      if (toDelete.has(w.activeBufferId)) {
        newActiveId = buffer.parentId;
      }

      // Update compare buffer if needed
      let newCompareId = w.compareBufferId;
      if (newCompareId && toDelete.has(newCompareId)) {
        newCompareId = undefined;
      }

      const updated = {
        ...w,
        buffers: newBuffers,
        activeBufferId: newActiveId,
        compareBufferId: newCompareId,
        starredBufferIds: starredIds,
        updatedAt: Date.now(),
      };

      workspaceStorage.saveWorkspace(updated).catch(err => {
        console.error('Failed to save workspace after deleting buffer:', err);
      });

      return updated;
    }));
  }, [activeWorkspaceId]);

  // ============================================================
  // TREE UTILITIES
  // ============================================================

  const getBufferTree = useCallback((): BufferNode | null => {
    if (!activeWorkspaceId) return null;

    const workspace = workspaces.find(w => w.id === activeWorkspaceId);
    if (!workspace) return null;

    const rootBuffer = workspace.buffers[workspace.rootBufferId];
    if (!rootBuffer) return null;

    const buildNode = (buffer: Buffer, depth: number): BufferNode => {
      const children = buffer.childIds
        .map(id => workspace.buffers[id])
        .filter((b): b is Buffer => b !== undefined)
        .map(child => buildNode(child, depth + 1));

      return {
        ...buffer,
        children,
        depth,
        isActive: buffer.id === workspace.activeBufferId,
        isCompare: buffer.id === workspace.compareBufferId,
      };
    };

    return buildNode(rootBuffer, 0);
  }, [activeWorkspaceId, workspaces]);

  const getActiveBuffer = useCallback((): Buffer | null => {
    if (!activeWorkspaceId) return null;

    const workspace = workspaces.find(w => w.id === activeWorkspaceId);
    if (!workspace) return null;

    return workspace.buffers[workspace.activeBufferId] || null;
  }, [activeWorkspaceId, workspaces]);

  const getCompareBuffer = useCallback((): Buffer | null => {
    if (!activeWorkspaceId) return null;

    const workspace = workspaces.find(w => w.id === activeWorkspaceId);
    if (!workspace || !workspace.compareBufferId) return null;

    return workspace.buffers[workspace.compareBufferId] || null;
  }, [activeWorkspaceId, workspaces]);

  const getActiveWorkspace = useCallback((): Workspace | null => {
    if (!activeWorkspaceId) return null;
    return workspaces.find(w => w.id === activeWorkspaceId) || null;
  }, [activeWorkspaceId, workspaces]);

  // ============================================================
  // LIST UTILITIES
  // ============================================================

  const listWorkspaces = useCallback((): WorkspaceSummary[] => {
    return workspaces
      .map(w => createSummary(w))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [workspaces]);

  // ============================================================
  // CONTEXT VALUE
  // ============================================================

  const value: WorkspaceContextValue = {
    // State
    workspaces,
    activeWorkspaceId,
    isLoading,
    error,

    // Workspace CRUD
    createWorkspace,
    loadWorkspace,
    saveWorkspace,
    deleteWorkspace,
    renameWorkspace,
    archiveWorkspace,
    unarchiveWorkspace,
    clearActiveWorkspace,

    // Buffer operations
    createBuffer,
    setActiveBuffer,
    setCompareBuffer,
    updateBufferAnalysis,
    updateBufferContent,
    toggleBufferStar,
    setBufferNote,
    setBufferDisplayName,
    deleteBuffer,

    // Tree utilities
    getBufferTree,
    getActiveBuffer,
    getCompareBuffer,
    getActiveWorkspace,

    // List utilities
    listWorkspaces,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

// ============================================================
// HOOK
// ============================================================

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}

// ============================================================
// OPTIONAL HOOK (for components that may be outside provider)
// ============================================================

export function useWorkspaceOptional(): WorkspaceContextValue | null {
  return useContext(WorkspaceContext) ?? null;
}
