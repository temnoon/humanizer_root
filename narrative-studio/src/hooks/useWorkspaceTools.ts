/**
 * useWorkspaceTools - Hook for integrating workspace buffer system with tool operations
 *
 * Provides helper functions to:
 * - Auto-create workspaces when tools are used
 * - Create buffers from transformation results
 * - Update buffer analysis results
 * - Get the correct source content based on workspace state
 */

import { useCallback, useMemo } from 'react';
import { useWorkspace, useWorkspaceOptional } from '../contexts/WorkspaceContext';
import { useUnifiedBuffer } from '../contexts/UnifiedBufferContext';
import type {
  WorkspaceSource,
  BufferTransform,
  BufferAnalysis,
  BufferTransformParameters,
} from '../types/workspace';

interface UseWorkspaceToolsOptions {
  // If true, don't throw errors when workspace context is not available
  optional?: boolean;
}

interface TransformationRecord {
  type: BufferTransform['type'];
  parameters: BufferTransformParameters;
  resultContent: string;
  metrics?: {
    processingTimeMs?: number;
    modelUsed?: string;
    provider?: string;
  };
}

interface AnalysisRecord {
  aiScore?: number;
  aiVerdict?: 'human' | 'mixed' | 'ai';
  confidence?: 'low' | 'medium' | 'high';
  burstiness?: number;
  tellWords?: Array<{ word: string; count: number; category: string }>;
  highlights?: Array<{
    start: number;
    end: number;
    type: 'tellword' | 'suspect' | 'gptzero';
    reason: string;
  }>;
  gptzeroScore?: number;
}

export function useWorkspaceTools(options: UseWorkspaceToolsOptions = {}) {
  const workspaceContext = useWorkspaceOptional();
  const unifiedBuffer = useUnifiedBuffer();

  const hasWorkspaceContext = !!workspaceContext;
  const hasActiveWorkspace = workspaceContext?.activeWorkspaceId != null;

  /**
   * Get the current source content for transformation.
   * Prefers workspace active buffer, falls back to unified buffer.
   */
  const getSourceContent = useCallback((): string | null => {
    // First try workspace active buffer
    if (workspaceContext && hasActiveWorkspace) {
      const activeBuffer = workspaceContext.getActiveBuffer();
      if (activeBuffer) {
        return activeBuffer.content;
      }
    }

    // Fall back to unified buffer
    if (unifiedBuffer.workingBuffer) {
      return unifiedBuffer.getTextContent();
    }

    return null;
  }, [workspaceContext, hasActiveWorkspace, unifiedBuffer]);

  /**
   * Get the active buffer ID from workspace, if available.
   */
  const getActiveBufferId = useCallback((): string | null => {
    if (!workspaceContext || !hasActiveWorkspace) {
      return null;
    }
    const workspace = workspaceContext.getActiveWorkspace();
    return workspace?.activeBufferId ?? null;
  }, [workspaceContext, hasActiveWorkspace]);

  /**
   * Ensure a workspace exists for the current content.
   * Creates one if needed using the unified buffer as source.
   */
  const ensureWorkspace = useCallback((content: string): void => {
    if (!workspaceContext) return;

    // Already have an active workspace
    if (hasActiveWorkspace) return;

    // Create a new workspace from the current content
    const source: WorkspaceSource = unifiedBuffer.workingBuffer
      ? inferSourceFromUnifiedBuffer(unifiedBuffer)
      : { type: 'paste' };

    workspaceContext.createWorkspace(source, content);
  }, [workspaceContext, hasActiveWorkspace, unifiedBuffer]);

  /**
   * Record a transformation result, creating a new buffer in the workspace.
   * Also records to UnifiedBuffer for backward compatibility.
   */
  const recordTransformation = useCallback((record: TransformationRecord): void => {
    const { type, parameters, resultContent, metrics } = record;

    // Create BufferTransform object
    const transform: BufferTransform = {
      type,
      parameters,
      timestamp: Date.now(),
      metrics,
    };

    // Create buffer in workspace if available
    if (workspaceContext && hasActiveWorkspace) {
      const activeBufferId = getActiveBufferId();
      if (activeBufferId) {
        try {
          workspaceContext.createBuffer(activeBufferId, transform, resultContent);
        } catch (err) {
          console.error('[useWorkspaceTools] Failed to create buffer:', err);
        }
      }
    }

    // Also record to unified buffer for backward compatibility
    // This maintains the chaining behavior and history
    unifiedBuffer.recordTransformation(
      type,
      parameters,
      resultContent,
      metrics
    );
  }, [workspaceContext, hasActiveWorkspace, getActiveBufferId, unifiedBuffer]);

  /**
   * Record an analysis result on the active buffer.
   */
  const recordAnalysis = useCallback((record: AnalysisRecord): void => {
    if (!workspaceContext || !hasActiveWorkspace) {
      // Record to unified buffer as fallback
      unifiedBuffer.recordAnalysis('ai-analysis', record as unknown as Record<string, unknown>);
      return;
    }

    const activeBufferId = getActiveBufferId();
    if (!activeBufferId) return;

    // Convert to BufferAnalysis format
    const analysis: BufferAnalysis = {
      aiScore: record.aiScore,
      aiVerdict: record.aiVerdict,
      confidence: record.confidence,
      burstiness: record.burstiness,
      tellWords: record.tellWords,
      highlights: record.highlights,
      gptzeroScore: record.gptzeroScore,
      analyzedAt: Date.now(),
    };

    workspaceContext.updateBufferAnalysis(activeBufferId, analysis);

    // Also record to unified buffer for backward compatibility
    unifiedBuffer.recordAnalysis('ai-analysis', record as unknown as Record<string, unknown>);
  }, [workspaceContext, hasActiveWorkspace, getActiveBufferId, unifiedBuffer]);

  /**
   * Check if we should auto-create a workspace for the given content.
   */
  const shouldAutoCreateWorkspace = useCallback((content: string): boolean => {
    if (!workspaceContext) return false;
    if (hasActiveWorkspace) return false;
    if (!content.trim()) return false;
    return true;
  }, [workspaceContext, hasActiveWorkspace]);

  /**
   * Get workspace info for display in UI.
   */
  const workspaceInfo = useMemo(() => {
    if (!workspaceContext || !hasActiveWorkspace) {
      return null;
    }

    const workspace = workspaceContext.getActiveWorkspace();
    const activeBuffer = workspaceContext.getActiveBuffer();
    const bufferTree = workspaceContext.getBufferTree();

    if (!workspace || !activeBuffer) return null;

    return {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      activeBufferId: activeBuffer.id,
      activeBufferName: activeBuffer.displayName || 'Buffer',
      bufferCount: Object.keys(workspace.buffers).length,
      hasChildren: activeBuffer.childIds.length > 0,
      hasParent: activeBuffer.parentId != null,
      isRoot: activeBuffer.parentId == null,
    };
  }, [workspaceContext, hasActiveWorkspace]);

  return {
    // State
    hasWorkspaceContext,
    hasActiveWorkspace,
    workspaceInfo,

    // Content access
    getSourceContent,
    getActiveBufferId,

    // Workspace operations
    ensureWorkspace,
    shouldAutoCreateWorkspace,

    // Recording
    recordTransformation,
    recordAnalysis,

    // Direct access to workspace context for advanced operations
    workspaceContext,
  };
}

/**
 * Infer a WorkspaceSource from the UnifiedBuffer content.
 */
function inferSourceFromUnifiedBuffer(
  buffer: ReturnType<typeof useUnifiedBuffer>
): WorkspaceSource {
  const workingBuffer = buffer.workingBuffer;
  if (!workingBuffer) {
    return { type: 'paste' };
  }

  const contentType = workingBuffer.contentType;
  const metadata = workingBuffer.metadata;

  switch (contentType) {
    case 'message':
      return {
        type: 'archive-message',
        archiveName: metadata?.source?.archiveName,
        conversationId: metadata?.source?.conversationId,
        conversationTitle: workingBuffer.displayName,
        messageIndex: metadata?.source?.messageIndex,
      };

    case 'conversation':
      return {
        type: 'archive-message',
        archiveName: metadata?.source?.archiveName,
        conversationId: metadata?.source?.conversationId,
        conversationTitle: workingBuffer.displayName,
      };

    case 'facebook-post':
      return {
        type: 'facebook-post',
        facebookPostId: (metadata?.source as Record<string, unknown>)?.postId as string | undefined,
        facebookAuthor: workingBuffer.displayName?.split(' - ')?.[0],
        facebookTitle: workingBuffer.displayName,
        facebookTimestamp: (metadata?.source as Record<string, unknown>)?.timestamp as number | undefined,
      };

    case 'facebook-comment':
      return {
        type: 'facebook-comment',
        facebookPostId: (metadata?.source as Record<string, unknown>)?.parentPostId as string | undefined,
        facebookAuthor: workingBuffer.displayName?.split(' - ')?.[0],
        facebookTimestamp: (metadata?.source as Record<string, unknown>)?.timestamp as number | undefined,
      };

    case 'text':
      if ((metadata?.source as Record<string, unknown>)?.fileName) {
        return {
          type: 'import',
          fileName: (metadata.source as Record<string, unknown>).fileName as string,
          importedAt: Date.now(),
        };
      }
      return { type: 'paste' };

    default:
      return { type: 'paste' };
  }
}

export type { TransformationRecord, AnalysisRecord };
