/**
 * BufferSyncContext - AUI Buffer as Single Source of Truth
 *
 * This context bridges the AUI BufferManager (backend) with the React UI.
 * All content displayed in the Studio comes from buffers managed here.
 *
 * Key principles:
 * - No local content state in components
 * - All content changes go through buffer operations
 * - AUI and GUI always in sync via shared buffer state
 *
 * @module @humanizer/studio/contexts/BufferSyncContext
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useApi } from './ApiContext';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A content item stored in a buffer
 */
export interface ContentItem {
  id: string;
  type: 'text' | 'message' | 'conversation' | 'media' | 'transformed' | 'archive-node';
  text: string;
  metadata: {
    source?: {
      type: string;
      path: string[];
      nodeId?: string;
      threadId?: string;
      threadTitle?: string;
    };
    author?: string;
    authorRole?: 'user' | 'assistant' | 'system';
    timestamp?: number;
    wordCount?: number;
    transformHistory?: Array<{
      type: string;
      timestamp: number;
      model?: string;
    }>;
    [key: string]: unknown;
  };
}

/**
 * Buffer summary - use API types
 */
export interface BufferSummary {
  name: string;
  version: string;
  currentBranch: string;
  contentLength: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Buffer version for history
 */
export interface BufferVersion {
  id: string;
  message: string;
  timestamp: number;
  itemCount: number;
}

/**
 * Buffer sync state
 */
interface BufferSyncState {
  // Connection
  sessionId: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;

  // Active buffer
  activeBufferName: string;
  workingContent: ContentItem[];
  isDirty: boolean;

  // All buffers
  buffers: BufferSummary[];

  // History
  history: BufferVersion[];
  canUndo: boolean;
  canRedo: boolean;
  currentVersionIndex: number;
}

/**
 * Buffer sync actions
 */
interface BufferSyncActions {
  // Connection
  connect: () => Promise<void>;
  disconnect: () => void;

  // Buffer management
  createBuffer: (name: string, content?: ContentItem[]) => Promise<void>;
  switchBuffer: (name: string) => Promise<void>;
  deleteBuffer: (name: string) => Promise<void>;
  refreshBuffers: () => Promise<void>;

  // Content operations
  setContent: (content: ContentItem[]) => Promise<void>;
  appendContent: (items: ContentItem[]) => Promise<void>;
  clearContent: () => Promise<void>;
  updateItem: (id: string, updates: Partial<ContentItem>) => Promise<void>;
  removeItem: (id: string) => Promise<void>;

  // Version control
  commit: (message: string) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  checkout: (versionId: string) => Promise<void>;

  // Convenience methods
  importText: (text: string, title?: string, metadata?: Record<string, unknown>) => Promise<void>;
  importArchiveNode: (node: ArchiveNode) => Promise<void>;
  getTextContent: () => string;
}

/**
 * Archive node type for import
 */
export interface ArchiveNode {
  id: string;
  text: string;
  type?: string;
  sourceType?: string;
  threadId?: string;
  threadTitle?: string;
  authorRole?: 'user' | 'assistant' | 'system';
  timestamp?: number;
  wordCount?: number;
  [key: string]: unknown;
}

type BufferSyncContextType = BufferSyncState & BufferSyncActions;

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

const BufferSyncContext = createContext<BufferSyncContextType | null>(null);

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useBufferSync(): BufferSyncContextType {
  const ctx = useContext(BufferSyncContext);
  if (!ctx) {
    throw new Error('useBufferSync must be used within BufferSyncProvider');
  }
  return ctx;
}

/**
 * Convenience hook to just get content
 */
export function useBufferContent(): {
  content: ContentItem[];
  text: string;
  isEmpty: boolean;
  isDirty: boolean;
} {
  const { workingContent, isDirty } = useBufferSync();

  return useMemo(() => ({
    content: workingContent,
    text: workingContent.map(item => item.text).join('\n\n'),
    isEmpty: workingContent.length === 0,
    isDirty,
  }), [workingContent, isDirty]);
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_BUFFER_NAME = 'workspace';
const POLL_INTERVAL_MS = 2000; // Poll for changes every 2 seconds

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

interface BufferSyncProviderProps {
  children: ReactNode;
  /** Auto-connect on mount */
  autoConnect?: boolean;
  /** Polling interval in ms (0 to disable) */
  pollInterval?: number;
}

export function BufferSyncProvider({
  children,
  autoConnect = true,
  pollInterval = POLL_INTERVAL_MS,
}: BufferSyncProviderProps) {
  const api = useApi();

  // ─────────────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────────────

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const [activeBufferName, setActiveBufferName] = useState(DEFAULT_BUFFER_NAME);
  const [workingContent, setWorkingContent] = useState<ContentItem[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  const [buffers, setBuffers] = useState<BufferSummary[]>([]);
  const [history, setHistory] = useState<BufferVersion[]>([]);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(0);

  const isConnected = sessionId !== null && !connectionError;

  // ─────────────────────────────────────────────────────────────────────────
  // CONNECTION
  // ─────────────────────────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    if (isConnecting || sessionId) return;

    setIsConnecting(true);
    setConnectionError(null);

    try {
      // Create a new session
      const session = await api.createSession({ name: 'Studio Session' });
      setSessionId(session.id);

      // Create default workspace buffer
      try {
        await api.createBuffer(session.id, DEFAULT_BUFFER_NAME, []);
      } catch {
        // Buffer might already exist, that's OK
      }

      // Load buffer list
      const result = await api.listBuffers(session.id);
      setBuffers(result.buffers);

      // Load workspace content
      try {
        const buffer = await api.getBuffer(session.id, DEFAULT_BUFFER_NAME);
        setWorkingContent((buffer.content as ContentItem[]) ?? []);
        setIsDirty(false); // Fresh from server = not dirty
      } catch {
        setWorkingContent([]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed';
      setConnectionError(message);
      console.error('[BufferSync] Connection failed:', error);
    } finally {
      setIsConnecting(false);
    }
  }, [api, isConnecting, sessionId]);

  const disconnect = useCallback(() => {
    if (sessionId) {
      api.deleteSession(sessionId).catch(console.error);
    }
    setSessionId(null);
    setWorkingContent([]);
    setBuffers([]);
    setHistory([]);
    setConnectionError(null);
  }, [api, sessionId]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => {
      // Don't disconnect on unmount - session persists
    };
  }, [autoConnect]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────────────
  // BUFFER MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  const refreshBuffers = useCallback(async () => {
    if (!sessionId) return;

    try {
      const result = await api.listBuffers(sessionId);
      setBuffers(result.buffers);
    } catch (error) {
      console.error('[BufferSync] Failed to refresh buffers:', error);
    }
  }, [api, sessionId]);

  const createBuffer = useCallback(async (name: string, content: ContentItem[] = []) => {
    if (!sessionId) throw new Error('Not connected');

    await api.createBuffer(sessionId, name, content);
    await refreshBuffers();
  }, [api, sessionId, refreshBuffers]);

  const switchBuffer = useCallback(async (name: string) => {
    if (!sessionId) throw new Error('Not connected');

    try {
      const buffer = await api.getBuffer(sessionId, name);
      setActiveBufferName(name);
      setWorkingContent((buffer.content as ContentItem[]) ?? []);
      setIsDirty(false); // Fresh from server = not dirty

      // Load history
      const historyResult = await api.getBufferHistory(sessionId, name, 20);
      setHistory(historyResult.history as BufferVersion[]);
      setCurrentVersionIndex(0);
    } catch (error) {
      console.error('[BufferSync] Failed to switch buffer:', error);
      throw error;
    }
  }, [api, sessionId]);

  const deleteBuffer = useCallback(async (name: string) => {
    if (!sessionId) throw new Error('Not connected');
    if (name === DEFAULT_BUFFER_NAME) {
      throw new Error('Cannot delete the workspace buffer');
    }

    // API doesn't have deleteBuffer yet, so we clear it instead
    await api.setBufferContent(sessionId, name, []);
    await refreshBuffers();

    // If we deleted the active buffer, switch to workspace
    if (name === activeBufferName) {
      await switchBuffer(DEFAULT_BUFFER_NAME);
    }
  }, [api, sessionId, activeBufferName, refreshBuffers, switchBuffer]);

  // ─────────────────────────────────────────────────────────────────────────
  // CONTENT OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  const setContent = useCallback(async (content: ContentItem[]) => {
    if (!sessionId) throw new Error('Not connected');

    // Optimistic update
    setWorkingContent(content);
    setIsDirty(true);

    try {
      await api.setBufferContent(sessionId, activeBufferName, content);
    } catch (error) {
      // Rollback on error
      console.error('[BufferSync] Failed to set content:', error);
      // Reload from server
      const buffer = await api.getBuffer(sessionId, activeBufferName);
      setWorkingContent((buffer.content as ContentItem[]) ?? []);
      setIsDirty(false);
      throw error;
    }
  }, [api, sessionId, activeBufferName]);

  const appendContent = useCallback(async (items: ContentItem[]) => {
    if (!sessionId) throw new Error('Not connected');

    // Optimistic update
    setWorkingContent(prev => [...prev, ...items]);
    setIsDirty(true);

    try {
      await api.appendToBuffer(sessionId, activeBufferName, items);
    } catch (error) {
      console.error('[BufferSync] Failed to append content:', error);
      // Reload from server
      const buffer = await api.getBuffer(sessionId, activeBufferName);
      setWorkingContent((buffer.content as ContentItem[]) ?? []);
      throw error;
    }
  }, [api, sessionId, activeBufferName]);

  const clearContent = useCallback(async () => {
    await setContent([]);
  }, [setContent]);

  const updateItem = useCallback(async (id: string, updates: Partial<ContentItem>) => {
    const newContent = workingContent.map(item =>
      item.id === id ? { ...item, ...updates } : item
    );
    await setContent(newContent);
  }, [workingContent, setContent]);

  const removeItem = useCallback(async (id: string) => {
    const newContent = workingContent.filter(item => item.id !== id);
    await setContent(newContent);
  }, [workingContent, setContent]);

  // ─────────────────────────────────────────────────────────────────────────
  // VERSION CONTROL
  // ─────────────────────────────────────────────────────────────────────────

  const commit = useCallback(async (message: string) => {
    if (!sessionId) throw new Error('Not connected');
    if (!isDirty) return;

    try {
      await api.commitBuffer(sessionId, activeBufferName, message);
      setIsDirty(false);

      // Reload history
      const historyResult = await api.getBufferHistory(sessionId, activeBufferName, 20);
      setHistory(historyResult.history as BufferVersion[]);
      setCurrentVersionIndex(0);
    } catch (error) {
      console.error('[BufferSync] Failed to commit:', error);
      throw error;
    }
  }, [api, sessionId, activeBufferName, isDirty]);

  const undo = useCallback(async () => {
    if (!sessionId || history.length < 2) return;

    const nextIndex = Math.min(currentVersionIndex + 1, history.length - 1);
    const version = history[nextIndex];

    if (version) {
      // Load that version's content
      // Note: API would need a checkout endpoint, for now we just track locally
      setCurrentVersionIndex(nextIndex);
    }
  }, [sessionId, history, currentVersionIndex]);

  const redo = useCallback(async () => {
    if (!sessionId || currentVersionIndex <= 0) return;

    const nextIndex = currentVersionIndex - 1;
    const version = history[nextIndex];

    if (version) {
      setCurrentVersionIndex(nextIndex);
    }
  }, [sessionId, history, currentVersionIndex]);

  const checkout = useCallback(async (versionId: string) => {
    if (!sessionId) throw new Error('Not connected');

    // Find version in history
    const index = history.findIndex(v => v.id === versionId);
    if (index >= 0) {
      setCurrentVersionIndex(index);
    }
  }, [sessionId, history]);

  const canUndo = history.length > 1 && currentVersionIndex < history.length - 1;
  const canRedo = currentVersionIndex > 0;

  // ─────────────────────────────────────────────────────────────────────────
  // CONVENIENCE METHODS
  // ─────────────────────────────────────────────────────────────────────────

  const importText = useCallback(async (
    text: string,
    title?: string,
    metadata?: Record<string, unknown>
  ) => {
    const item: ContentItem = {
      id: crypto.randomUUID(),
      type: 'text',
      text,
      metadata: {
        source: {
          type: 'direct',
          path: [title ?? 'Imported Text'],
        },
        timestamp: Date.now(),
        wordCount: text.split(/\s+/).filter(Boolean).length,
        ...metadata,
      },
    };

    await appendContent([item]);
  }, [appendContent]);

  const importArchiveNode = useCallback(async (node: ArchiveNode) => {
    const item: ContentItem = {
      id: crypto.randomUUID(),
      type: 'archive-node',
      text: node.text,
      metadata: {
        source: {
          type: node.sourceType ?? node.type ?? 'archive',
          path: [node.threadTitle ?? 'Archive', node.id],
          nodeId: node.id,
          threadId: node.threadId,
          threadTitle: node.threadTitle,
        },
        authorRole: node.authorRole,
        timestamp: node.timestamp,
        wordCount: node.wordCount ?? node.text.split(/\s+/).filter(Boolean).length,
      },
    };

    // Replace content (or append based on preference)
    await setContent([item]);
  }, [setContent]);

  const getTextContent = useCallback((): string => {
    return workingContent.map(item => item.text).join('\n\n');
  }, [workingContent]);

  // ─────────────────────────────────────────────────────────────────────────
  // POLLING (for AUI sync)
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!sessionId || pollInterval <= 0) return;

    const intervalId = setInterval(async () => {
      try {
        const buffer = await api.getBuffer(sessionId, activeBufferName);
        const serverContent = (buffer.content as ContentItem[]) ?? [];

        // Only update if content changed (compare by length for now)
        if (serverContent.length !== workingContent.length) {
          setWorkingContent(serverContent);
          // When syncing from server, reset dirty state
          setIsDirty(false);
        }
      } catch {
        // Ignore polling errors
      }
    }, pollInterval);

    return () => clearInterval(intervalId);
  }, [api, sessionId, activeBufferName, pollInterval, workingContent.length]);

  // ─────────────────────────────────────────────────────────────────────────
  // CONTEXT VALUE
  // ─────────────────────────────────────────────────────────────────────────

  const value: BufferSyncContextType = useMemo(() => ({
    // State
    sessionId,
    isConnected,
    isConnecting,
    connectionError,
    activeBufferName,
    workingContent,
    isDirty,
    buffers,
    history,
    canUndo,
    canRedo,
    currentVersionIndex,

    // Actions
    connect,
    disconnect,
    createBuffer,
    switchBuffer,
    deleteBuffer,
    refreshBuffers,
    setContent,
    appendContent,
    clearContent,
    updateItem,
    removeItem,
    commit,
    undo,
    redo,
    checkout,
    importText,
    importArchiveNode,
    getTextContent,
  }), [
    sessionId, isConnected, isConnecting, connectionError,
    activeBufferName, workingContent, isDirty, buffers, history,
    canUndo, canRedo, currentVersionIndex,
    connect, disconnect, createBuffer, switchBuffer, deleteBuffer, refreshBuffers,
    setContent, appendContent, clearContent, updateItem, removeItem,
    commit, undo, redo, checkout, importText, importArchiveNode, getTextContent,
  ]);

  return (
    <BufferSyncContext.Provider value={value}>
      {children}
    </BufferSyncContext.Provider>
  );
}

export default BufferSyncContext;
