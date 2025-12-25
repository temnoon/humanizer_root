/**
 * BufferContext - React integration for the buffer system
 *
 * Provides the content graph, buffers, pipelines, and archive
 * connector to the entire application.
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

import type {
  ContentNode,
  ContentItem,
  Buffer,
  Pipeline,
  OperatorDefinition,
  BufferEvent,
  ArchiveSource,
} from './types';

import { ContentGraph } from './graph';
import { BufferManager } from './buffers';
import { PipelineRunner, PipelineStorage } from './pipeline';
import { ArchiveConnector, type Archive, type ArchiveConversation, type ArchiveMessage } from './archive';
import { operatorRegistry } from './operators';

// ═══════════════════════════════════════════════════════════════════
// CONTEXT TYPE
// ═══════════════════════════════════════════════════════════════════

interface BufferContextType {
  // Core systems
  graph: ContentGraph;
  buffers: BufferManager;
  pipelines: PipelineStorage;
  archive: ArchiveConnector;
  runner: PipelineRunner;

  // Active buffer state (for reactive updates)
  activeBuffer: Buffer | null;
  activeNode: ContentNode | null;
  activeContent: ContentItem | ContentItem[] | null;

  // Buffer operations
  createBuffer: (name: string, nodeId: string) => Buffer;
  deleteBuffer: (bufferId: string) => void;
  setActiveBuffer: (bufferId: string) => void;
  forkBuffer: (bufferId: string, newName?: string) => Buffer | null;

  // Navigation
  navigateTo: (nodeId: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;

  // Operations
  applyOperator: (operatorId: string, params?: Record<string, unknown>) => Promise<void>;
  applyPipeline: (pipelineId: string) => Promise<void>;
  getOperators: () => OperatorDefinition[];
  getPipelines: () => Pipeline[];

  // Archive
  getArchives: () => Archive[];
  getConversations: (archiveId: string) => ArchiveConversation[];
  getMessages: (conversationId: string) => ArchiveMessage[];
  importMessage: (messageId: string) => void;
  importConversation: (conversationId: string) => void;
  importText: (text: string, title?: string, source?: Partial<ArchiveSource>) => void;

  // Graph inspection
  getNodeHistory: () => ContentNode[];
  getNodeChildren: (nodeId: string) => ContentNode[];
}

const BufferContext = createContext<BufferContextType | null>(null);

// ═══════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════

export function useBuffers(): BufferContextType {
  const ctx = useContext(BufferContext);
  if (!ctx) {
    throw new Error('useBuffers must be used within BufferProvider');
  }
  return ctx;
}

// ═══════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════

interface BufferProviderProps {
  children: ReactNode;
}

export function BufferProvider({ children }: BufferProviderProps) {
  // Initialize core systems
  const [graph] = useState(() => new ContentGraph());
  const [buffers] = useState(() => new BufferManager());
  const [pipelines] = useState(() => new PipelineStorage());
  const [archive] = useState(() => new ArchiveConnector(graph));
  const [runner] = useState(() => new PipelineRunner(graph, buffers));

  // Reactive state
  const [activeBuffer, setActiveBufferState] = useState<Buffer | null>(null);
  const [updateTrigger, setUpdateTrigger] = useState(0);

  // Subscribe to buffer events
  useEffect(() => {
    const unsubscribe = buffers.subscribe((event: BufferEvent) => {
      if (
        event.type === 'active-buffer-changed' ||
        event.type === 'buffer-updated' ||
        event.type === 'operation-applied'
      ) {
        setActiveBufferState(buffers.getActiveBuffer());
        setUpdateTrigger(t => t + 1);
      }
    });

    return unsubscribe;
  }, [buffers]);

  // Derived state
  const activeNode = useMemo(() => {
    if (!activeBuffer) return null;
    return graph.getNode(activeBuffer.nodeId);
  }, [activeBuffer, graph, updateTrigger]);

  const activeContent = useMemo(() => {
    return activeNode?.content ?? null;
  }, [activeNode]);

  const canUndo = useMemo(() => {
    if (!activeBuffer) return false;
    return buffers.canUndo(activeBuffer.id);
  }, [activeBuffer, buffers, updateTrigger]);

  const canRedo = useMemo(() => {
    if (!activeBuffer) return false;
    return buffers.canRedo(activeBuffer.id);
  }, [activeBuffer, buffers, updateTrigger]);

  // ─────────────────────────────────────────────────────────────────
  // BUFFER OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  const createBuffer = useCallback((name: string, nodeId: string) => {
    return buffers.createBuffer(name, nodeId);
  }, [buffers]);

  const deleteBuffer = useCallback((bufferId: string) => {
    buffers.deleteBuffer(bufferId);
  }, [buffers]);

  const setActiveBuffer = useCallback((bufferId: string) => {
    buffers.setActiveBuffer(bufferId);
  }, [buffers]);

  const forkBuffer = useCallback((bufferId: string, newName?: string) => {
    return buffers.forkBuffer(bufferId, newName);
  }, [buffers]);

  // ─────────────────────────────────────────────────────────────────
  // NAVIGATION
  // ─────────────────────────────────────────────────────────────────

  const navigateTo = useCallback((nodeId: string) => {
    const buffer = buffers.getActiveBuffer();
    if (buffer) {
      buffers.navigateTo(buffer.id, nodeId);
    }
  }, [buffers]);

  const undo = useCallback(() => {
    const buffer = buffers.getActiveBuffer();
    if (buffer) {
      buffers.undo(buffer.id);
    }
  }, [buffers]);

  const redo = useCallback(() => {
    const buffer = buffers.getActiveBuffer();
    if (buffer) {
      buffers.redo(buffer.id);
    }
  }, [buffers]);

  // ─────────────────────────────────────────────────────────────────
  // OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  const applyOperator = useCallback(async (
    operatorId: string,
    params?: Record<string, unknown>
  ) => {
    await runner.applyToActiveBuffer(operatorId, params);
  }, [runner]);

  const applyPipeline = useCallback(async (pipelineId: string) => {
    const pipeline = pipelines.get(pipelineId);
    if (pipeline) {
      await runner.applyPipelineToActiveBuffer(pipeline);
    }
  }, [runner, pipelines]);

  const getOperators = useCallback(() => {
    return operatorRegistry.getAll();
  }, []);

  const getPipelines = useCallback(() => {
    return pipelines.getAll();
  }, [pipelines]);

  // ─────────────────────────────────────────────────────────────────
  // ARCHIVE
  // ─────────────────────────────────────────────────────────────────

  const getArchives = useCallback(() => {
    return archive.getArchives();
  }, [archive]);

  const getConversations = useCallback((archiveId: string) => {
    return archive.getConversations(archiveId);
  }, [archive]);

  const getMessages = useCallback((conversationId: string) => {
    return archive.getMessages(conversationId);
  }, [archive]);

  const importMessage = useCallback((messageId: string) => {
    const nodeId = archive.importMessage(messageId);
    if (nodeId) {
      // Create or update workspace buffer
      const existing = buffers.getAllBuffers().find(b => b.name === 'workspace');
      if (existing) {
        buffers.navigateTo(existing.id, nodeId);
      } else {
        buffers.createBuffer('workspace', nodeId);
      }
    }
  }, [archive, buffers]);

  const importConversation = useCallback((conversationId: string) => {
    const nodeId = archive.importConversation(conversationId);
    if (nodeId) {
      const existing = buffers.getAllBuffers().find(b => b.name === 'workspace');
      if (existing) {
        buffers.navigateTo(existing.id, nodeId);
      } else {
        buffers.createBuffer('workspace', nodeId);
      }
    }
  }, [archive, buffers]);

  const importText = useCallback((text: string, title?: string, source?: Partial<ArchiveSource>) => {
    archive.loadManualText(text, title);
    // Import the text directly to graph with optional source metadata
    const fullSource: ArchiveSource = {
      type: source?.type ?? 'manual',
      path: source?.path ?? [title ?? 'Manual Input'],
      ...source,
    };
    const node = graph.importFromArchive(text, fullSource, title);

    const existing = buffers.getAllBuffers().find(b => b.name === 'workspace');
    if (existing) {
      buffers.navigateTo(existing.id, node.id);
    } else {
      buffers.createBuffer('workspace', node.id);
    }
  }, [archive, graph, buffers]);

  // ─────────────────────────────────────────────────────────────────
  // GRAPH INSPECTION
  // ─────────────────────────────────────────────────────────────────

  const getNodeHistory = useCallback(() => {
    if (!activeBuffer) return [];
    return graph.getAncestors(activeBuffer.nodeId);
  }, [activeBuffer, graph, updateTrigger]);

  const getNodeChildren = useCallback((nodeId: string) => {
    return graph.getChildren(nodeId);
  }, [graph, updateTrigger]);

  // ─────────────────────────────────────────────────────────────────
  // CONTEXT VALUE
  // ─────────────────────────────────────────────────────────────────

  const value: BufferContextType = {
    graph,
    buffers,
    pipelines,
    archive,
    runner,

    activeBuffer,
    activeNode,
    activeContent,

    createBuffer,
    deleteBuffer,
    setActiveBuffer,
    forkBuffer,

    navigateTo,
    canUndo,
    canRedo,
    undo,
    redo,

    applyOperator,
    applyPipeline,
    getOperators,
    getPipelines,

    getArchives,
    getConversations,
    getMessages,
    importMessage,
    importConversation,
    importText,

    getNodeHistory,
    getNodeChildren,
  };

  return (
    <BufferContext.Provider value={value}>
      {children}
    </BufferContext.Provider>
  );
}
