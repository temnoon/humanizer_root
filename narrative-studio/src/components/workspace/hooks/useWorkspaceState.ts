/**
 * useWorkspaceState - Manages workspace state and effects for MainWorkspace
 *
 * Extracted from MainWorkspace.tsx to:
 * 1. Isolate the workspace creation/switching logic
 * 2. Make debugging easier for the "first transformation" bug
 * 3. Enable easier testing
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useWorkspaceOptional } from '../../../contexts/WorkspaceContext';
import { useUnifiedBuffer } from '../../../contexts/UnifiedBufferContext';
import { useWorkspaceTools } from '../../../hooks/useWorkspaceTools';
import type { Buffer, Workspace, BufferNode } from '../../../types/workspace';

interface UseWorkspaceStateOptions {
  /** Enable verbose logging for debugging */
  debug?: boolean;
}

interface WorkspaceContent {
  left: string | null;
  right: string | null;
  leftWordCount: number;
  rightWordCount: number;
  aiScoreDelta: number | null;
}

interface UseWorkspaceStateReturn {
  // Core state
  hasWorkspace: boolean;
  activeWorkspace: Workspace | null;
  workspaceActiveBuffer: Buffer | null;
  workspaceCompareBuffer: Buffer | null;
  bufferTree: BufferNode | null;
  workspaceContent: WorkspaceContent;

  // Compare mode
  workspaceCompareMode: boolean;
  setWorkspaceCompareMode: (mode: boolean) => void;
  handleToggleCompareMode: () => void;

  // Buffer selection
  handleWorkspaceBufferSelect: (bufferId: string, isCompare: boolean) => void;

  // Context access
  workspaceContext: ReturnType<typeof useWorkspaceOptional>;
  unifiedBuffer: ReturnType<typeof useUnifiedBuffer>;
  workspaceTools: ReturnType<typeof useWorkspaceTools>;
}

export function useWorkspaceState(options: UseWorkspaceStateOptions = {}): UseWorkspaceStateReturn {
  const { debug = false } = options;

  // Track the last unified buffer ID we processed to prevent duplicate workspace creation
  const lastProcessedBufferIdRef = useRef<string | null>(null);

  // Contexts
  const workspaceContext = useWorkspaceOptional();
  const unifiedBuffer = useUnifiedBuffer();
  const workspaceTools = useWorkspaceTools();

  // Derived state
  const hasWorkspace = !!(workspaceContext?.activeWorkspaceId);
  const activeWorkspace = workspaceContext?.getActiveWorkspace() ?? null;
  const workspaceActiveBuffer = workspaceContext?.getActiveBuffer() ?? null;
  const workspaceCompareBuffer = workspaceContext?.getCompareBuffer() ?? null;
  const bufferTree = workspaceContext?.getBufferTree() ?? null;

  // Compare mode state
  const [workspaceCompareMode, setWorkspaceCompareMode] = useState(true);
  const [userToggledOff, setUserToggledOff] = useState(false);

  const log = useCallback((...args: unknown[]) => {
    if (debug) {
      console.log('[useWorkspaceState]', ...args);
    }
  }, [debug]);

  // === CRITICAL EFFECT: Auto-create workspace when unified buffer changes ===
  // This is where Bug #1 originates. The issue is that:
  // 1. When archive content is loaded, unified buffer changes
  // 2. This effect runs and creates a workspace
  // 3. BUT React state updates are async, so the workspace isn't "ready" immediately
  // 4. If a transformation runs before the state propagates, it fails to record
  useEffect(() => {
    const currentBufferId = unifiedBuffer.workingBuffer?.id;

    log('Unified buffer effect triggered', {
      currentBufferId,
      lastProcessedId: lastProcessedBufferIdRef.current,
      hasWorkspaceContext: !!workspaceContext,
      hasWorkspace,
      activeWorkspaceId: workspaceContext?.activeWorkspaceId,
    });

    // Skip if no buffer or no context
    if (!currentBufferId || !workspaceContext) {
      log('Skipping: no buffer or context');
      return;
    }

    // Skip if we already processed this buffer
    if (lastProcessedBufferIdRef.current === currentBufferId) {
      log('Skipping: already processed this buffer');
      return;
    }

    const content = unifiedBuffer.getTextContent();
    if (!content.trim()) {
      log('Skipping: empty content');
      return;
    }

    // Mark this buffer as being processed
    lastProcessedBufferIdRef.current = currentBufferId;

    if (hasWorkspace) {
      // NEW: When we have a workspace but detect a NEW buffer, we need to:
      // 1. Clear the old workspace
      // 2. Create a new one for the new content
      log('New content detected while workspace exists - clearing and recreating');

      // Clear workspace synchronously
      workspaceContext.clearActiveWorkspace();

      // Create new workspace immediately (don't wait for effect re-run)
      // This ensures the workspace exists BEFORE any transformation might run
      const newWorkspace = workspaceTools.createWorkspaceFromUnifiedBuffer();
      log('Created new workspace:', newWorkspace?.id, newWorkspace?.name);
    } else {
      // No workspace - create one
      log('No workspace exists - creating from unified buffer');
      const newWorkspace = workspaceTools.createWorkspaceFromUnifiedBuffer();
      log('Created workspace:', newWorkspace?.id, newWorkspace?.name);
    }
  }, [unifiedBuffer.workingBuffer?.id, workspaceContext, hasWorkspace, workspaceTools, log]);

  // Auto-enable split view when compare buffer is first set
  useEffect(() => {
    if (workspaceCompareBuffer && !workspaceCompareMode && !userToggledOff) {
      setWorkspaceCompareMode(true);
    }
  }, [workspaceCompareBuffer, workspaceCompareMode, userToggledOff]);

  // Reset userToggledOff when compare buffer changes
  useEffect(() => {
    if (workspaceCompareBuffer) {
      setUserToggledOff(false);
    }
  }, [workspaceCompareBuffer?.id]);

  // Handler for toggling comparison mode
  const handleToggleCompareMode = useCallback(() => {
    const newMode = !workspaceCompareMode;
    setWorkspaceCompareMode(newMode);
    if (!newMode) {
      setUserToggledOff(true);
    }
  }, [workspaceCompareMode]);

  // Handle workspace buffer selection
  const handleWorkspaceBufferSelect = useCallback((bufferId: string, isCompare: boolean) => {
    if (!workspaceContext) return;
    if (isCompare) {
      workspaceContext.setCompareBuffer(bufferId || undefined);
    } else {
      if (bufferId) {
        workspaceContext.setActiveBuffer(bufferId);
      }
    }
  }, [workspaceContext]);

  // Memoized workspace content
  const workspaceContent = useMemo((): WorkspaceContent => {
    if (!hasWorkspace) {
      return { left: null, right: null, leftWordCount: 0, rightWordCount: 0, aiScoreDelta: null };
    }

    const leftContent = workspaceCompareBuffer?.content || '';
    const rightContent = workspaceActiveBuffer?.content || '';

    const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;
    const leftWordCount = countWords(leftContent);
    const rightWordCount = countWords(rightContent);

    // Calculate AI score delta if both buffers have analysis
    let aiScoreDelta: number | null = null;
    const leftScore = workspaceCompareBuffer?.analysis?.aiScore;
    const rightScore = workspaceActiveBuffer?.analysis?.aiScore;
    if (leftScore !== undefined && rightScore !== undefined) {
      aiScoreDelta = rightScore - leftScore;
    }

    return {
      left: leftContent,
      right: rightContent,
      leftWordCount,
      rightWordCount,
      aiScoreDelta,
    };
  }, [hasWorkspace, workspaceCompareBuffer, workspaceActiveBuffer]);

  return {
    // Core state
    hasWorkspace,
    activeWorkspace,
    workspaceActiveBuffer,
    workspaceCompareBuffer,
    bufferTree,
    workspaceContent,

    // Compare mode
    workspaceCompareMode,
    setWorkspaceCompareMode,
    handleToggleCompareMode,

    // Buffer selection
    handleWorkspaceBufferSelect,

    // Context access
    workspaceContext,
    unifiedBuffer,
    workspaceTools,
  };
}
